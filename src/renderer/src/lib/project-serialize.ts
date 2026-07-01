import type { ProjectFileV2 } from './project-schema'
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
export function snapshotProject(params: SnapshotParams): ProjectFileV2 {
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
    formatVersion: 2,
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
export function hydrateStores(data: ProjectFileV2): void {
  suspendDirtyTracking()
  try {
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

    // Each hydrate() is ONE setState call per store.
    useMarkupStore.getState().hydrate({
      pageMarkups,
      categories: data.categories,
      categoryOrder: data.categoryOrder
    })

    useScaleStore.getState().hydrate({
      pageScales,
      globalUnit: data.globalUnit
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
        if (typeof v === 'number') {
          safeRates[k] = {
            material: coerceField(v, 0),
            labor: 0,
            markup: DEFAULT_MARKUP_PCT
          }
        } else if (v && typeof v === 'object') {
          const e = v as Partial<PriceEntry>
          safeRates[k] = {
            material: coerceField(e.material, 0),
            labor: coerceField(e.labor, 0),
            markup: coerceField(e.markup, DEFAULT_MARKUP_PCT)
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
