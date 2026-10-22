import type { ProjectFile, ProjectFileV3 } from './project-schema'
import { validateProjectData } from '../../../shared/project-validation'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import {
  useProjectStore,
  suspendDirtyTracking,
  resumeDirtyTracking
} from '../stores/projectStore'
import type { Markup } from '../types/markup'
import type { PageScale } from '../types/scale'
import type { ViewportState } from '../types/viewer'
import type { PriceEntry } from './boq-types'
import { DEFAULT_MARKUP_PCT } from './estimate-defaults'
import { inferredRateBasis, validateRateEntries } from './rate-units'

export interface SnapshotParams {
  pdfOriginalFilename: string  // display name only (D-04); v1 path-based fields removed in Phase 4.1
  pdfSha256: string
  pdfTotalPages: number
  perPageDimensions: Record<number, { width: number; height: number }>
  createdAt?: string // optional; defaults to "now" for first save
}

/**
 * Snapshot the current store state into a JSON-serializable ProjectFileV2.
 * Reads from .getState() (one shot per store) — no React hooks.
 * Excludes transient state (D-09): undoStack, redoStack, calibMode, activeTool,
 * pdfDocument.
 */
export function snapshotProject(params: SnapshotParams, captured?: ProjectFile): ProjectFileV3 {
  if (captured) {
    return {
      ...captured,
      formatVersion: 3,
      minimumReaderVersion: 3,
      createdAt: params.createdAt ?? captured.createdAt,
      pdf: { originalFilename: params.pdfOriginalFilename, sha256: params.pdfSha256, totalPages: params.pdfTotalPages },
      pages: captured.pages.map(page => ({ ...page, dimensions: params.perPageDimensions[page.pageIndex] ?? page.dimensions }))
    }
  }
  const markup = useMarkupStore.getState()
  const scale = useScaleStore.getState()
  const viewer = useViewerStore.getState()

  const now = new Date().toISOString()

  const pages = Array.from({ length: params.pdfTotalPages }, (_, i) => {
    const pageIndex = i + 1
    return {
      pageIndex,
      dimensions: params.perPageDimensions[pageIndex] ?? { width: 0, height: 0 },
      scale: scale.pageScales[pageIndex] ?? null,
      viewport: viewer.pageViewports[pageIndex] ?? { zoom: 1, panX: 0, panY: 0 },
      markups: markup.pageMarkups[pageIndex] ?? []
    }
  })

  return {
    formatVersion: 3,
    minimumReaderVersion: 3,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    pdf: {
      originalFilename: params.pdfOriginalFilename,
      sha256: params.pdfSha256,
      totalPages: params.pdfTotalPages
    },
    globalUnit: scale.globalUnit,
    categories: markup.categories,
    categoryOrder: markup.categoryOrder,
    // Phase 17 (Req 2, D-11): persist the per-category manual item order additively
    // (read from markupStore, exactly like categoryOrder above). No formatVersion bump.
    categoryItemOrder: markup.categoryItemOrder,
    currentPage: viewer.currentPage,
    pages,
    hiddenItemNames: useProjectStore.getState().hiddenItemNames,
    rates: useProjectStore.getState().rates,
    defaultMarkupPct: useProjectStore.getState().defaultMarkupPct
  }
}

/**
 * Hydrate the three Zustand stores from a validated ProjectFileV2.
 * Brackets all store writes with suspendDirtyTracking()/resumeDirtyTracking()
 * so opening a .clmc file does NOT leave isDirty=true (Pitfall 1).
 * Each store's dedicated hydrate() method uses ONE setState call per store (Pitfall 2).
 * Calls reset() before hydrate() to guarantee a clean slate when opening
 * a second project in the same session (Runtime State Inventory).
 * Excludes transient state (D-09): undoStack, redoStack, calibMode, activeTool.
 */
export function hydrateStores(data: ProjectFile): void {
  // Validate before resetting any live stores, including recovery/direct hydration.
  validateRateEntries(data.rates)
  validateProjectData(data)
  suspendDirtyTracking()
  try {
    useProjectStore.getState().reset()
    // Rebuild per-page maps from the dense pages array
    const pageMarkups: Record<number, Markup[]> = {}
    const pageScales: Record<number, PageScale> = {}
    const pageViewports: Record<number, ViewportState> = {}

    for (const page of data.pages) {
      pageMarkups[page.pageIndex] = page.markups
      if (page.scale) pageScales[page.pageIndex] = page.scale
      pageViewports[page.pageIndex] = page.viewport
    }

    // Clean slate first (Runtime State Inventory — opening a 2nd project in same session).
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    // viewerStore keeps its existing resetViewer for filePath/fileName etc;
    // we don't call it here because loadPdfFromPath will set those fields.

    // Hydrate the per-category manual item order — additive Phase 17 field (Req 2,
    // D-11; threat-model mitigation T-17-01). A crafted/corrupt .clmc could carry a
    // non-object, or values that are not string arrays; this order feeds aggregateBoq,
    // so coerce to a safe Record<string,string[]> here (accept only array values, keep
    // only string elements), defaulting to {} when absent/non-object. Never throws. An
    // injected key with no matching bucket is inert — the aggregator only ranks buckets
    // it builds. Mirrors the safeRates per-field coercion discipline below.
    const rawOrder = (data as { categoryItemOrder?: unknown }).categoryItemOrder
    const safeOrder: Record<string, string[]> = {}
    if (rawOrder && typeof rawOrder === 'object') {
      for (const [k, v] of Object.entries(rawOrder as Record<string, unknown>)) {
        // T-17-01 hardening (LW-01): a crafted `.clmc` with a dunder key
        // (`{ "__proto__": [...] }`) would, via the Annex-B legacy accessor, silently
        // repoint safeOrder's own prototype instead of being sanitized. Drop dunder keys
        // outright so the coercion "always sanitizes untrusted fields / never throws"
        // contract holds; a real bucket key is never one of these reserved names.
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
        if (Array.isArray(v)) {
          safeOrder[k] = v.filter((x): x is string => typeof x === 'string')
        }
      }
    }

    // Each hydrate() is ONE setState call per store.
    useMarkupStore.getState().hydrate({
      pageMarkups,
      categories: data.categories,
      categoryOrder: data.categoryOrder,
      categoryItemOrder: safeOrder
    })

    useScaleStore.getState().hydrate({
      pageScales,
      globalUnit: data.globalUnit ?? 'm'
    })

    // viewerStore — do NOT touch filePath/fileName/totalPages here;
    // those are owned by usePdfDocument.loadPdfFromPath which runs after hydrate.
    useViewerStore.getState().hydrate({
      currentPage: data.currentPage,
      pageViewports
    })

    // Hydrate rates — additive Phase 15 field, WIDENED to PriceEntry in Phase 16
    // (threat-model mitigation T-15-02-01 / T-16-02-01). A crafted/corrupt .clmc
    // could carry negative, NaN/Infinity, non-number, or non-object values; those
    // flow into cost math (material/labor × quantity) and ₱ export cells, so
    // sanitize per-field here. Two accepted input forms:
    //   • legacy Phase-15 scalar number n → { material: n (finite-≥0 else 0),
    //     labor: 0, markup: DEFAULT_MARKUP_PCT } (D-06 back-compat / A2)
    //   • Phase-16 object → per-field coerce: material/labor finite-≥0 else 0;
    //     markup finite-≥0 else DEFAULT_MARKUP_PCT (absent markup → 30, distinct
    //     from an explicit markup:0 which is honored).
    // Entries whose value is neither number nor a non-null object are dropped;
    // default to {} when data.rates is absent/non-object. Never throws.
    const coerceField = (v: unknown, fallback: number): number =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
    const safeRates: Record<string, PriceEntry> = {}
    if (data.rates && typeof data.rates === 'object') {
      for (const [k, v] of Object.entries(data.rates as Record<string, unknown>)) {
        // T-15-02-01 hardening (mirrors the safeOrder LW-01 guard above): a crafted
        // `.clmc` with a dunder key (`{ "__proto__": {...} }`) would, via the Annex-B
        // legacy accessor, silently repoint safeRates's own prototype on the bracket
        // assignment below instead of storing a rate. Drop dunder keys outright — a real
        // `${name}|${type}` rate key is never one of these reserved names.
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
        if (typeof v === 'number') {
          safeRates[k] = {
            material: coerceField(v, 0),
            labor: 0,
            markup: DEFAULT_MARKUP_PCT,
            basis: inferredRateBasis(k, data.globalUnit),
            review: 'legacy-unresolved'
          }
        } else if (v && typeof v === 'object') {
          const e = v as Partial<PriceEntry>
          safeRates[k] = {
            material: coerceField(e.material, 0),
            labor: coerceField(e.labor, 0),
            markup: coerceField(e.markup, DEFAULT_MARKUP_PCT),
            basis: e.basis ?? inferredRateBasis(k, data.globalUnit),
            review: e.basis && e.review === 'reviewed' ? 'reviewed' : 'legacy-unresolved'
          }
        }
        // else: neither number nor object → drop the entry entirely.
      }
    }

    // Hydrate the project-wide default markup — additive Phase 16 field (WR-01).
    // Absent in every pre-WR-01 .clmc (legacy / Phase-15 / early-Phase-16) → 30.
    // A crafted/corrupt file could carry a negative, NaN/Infinity, or non-number
    // value; those flow into every un-priced row's price math, so coerce to a
    // finite ≥0 value here, DEFAULTING to DEFAULT_MARKUP_PCT (30) when absent or
    // invalid. A stored 0 is a legitimate "no default markup" and is preserved.
    const rawDefaultMarkup = (data as { defaultMarkupPct?: unknown }).defaultMarkupPct
    const safeDefaultMarkupPct =
      typeof rawDefaultMarkup === 'number' && Number.isFinite(rawDefaultMarkup) && rawDefaultMarkup >= 0
        ? rawDefaultMarkup
        : DEFAULT_MARKUP_PCT

    // Hydrate visibility state — additive Phase 8 field.
    // Array.isArray guard tolerates pre-Phase 8 files where the field is absent (defaults to []).
    // MUST run inside the suspend/resume bracket so markDirty stays suppressed.
    useProjectStore.setState({
      hiddenItemNames: Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [],
      hiddenItemSet: new Set(Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : []),
      rates: safeRates,
      defaultMarkupPct: safeDefaultMarkupPct
    })
  } finally {
    resumeDirtyTracking()
    // Final safety reset — even if a subscription fired in the wrong order during
    // the brief window between reset() and hydrate(), mark clean here.
    useProjectStore.setState({ isDirty: false })
  }
}
