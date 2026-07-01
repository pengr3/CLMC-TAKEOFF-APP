import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { CountMarkup } from '@renderer/types/markup'
import type { ProjectFileV2 } from '@renderer/lib/project-schema'

const sampleMarkup: CountMarkup = {
  id: 'm1',
  type: 'count',
  page: 1,
  name: 'Switch',
  categoryId: 'c1',
  color: '#0078d4',
  createdAt: 1000,
  point: { x: 0.5, y: 0.5 },
  sequence: 1
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: { 1: [sampleMarkup] },
    categories: { c1: { id: 'c1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
    categoryOrder: ['c1'],
    undoStack: [{ type: 'place', markup: sampleMarkup }],
    redoStack: []
  })
  useScaleStore.setState({
    pageScales: { 1: { pixelsPerMm: 5, displayUnit: 'm' } },
    globalUnit: 'm',
    calibMode: 'idle'
  })
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 1,
    pageViewports: { 1: { zoom: 1.5, panX: 10, panY: 20 } },
    filePath: 'C:/plans.pdf',
    fileName: 'plans.pdf',
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select'
  })
})

describe('project-serialize', () => {
  it('snapshot includes D-02 fields (formatVersion, createdAt, updatedAt, pdf, globalUnit, categories, categoryOrder, currentPage, pages)', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    for (const key of [
      'formatVersion',
      'createdAt',
      'updatedAt',
      'pdf',
      'globalUnit',
      'categories',
      'categoryOrder',
      'currentPage',
      'pages'
    ]) {
      expect(snap).toHaveProperty(key)
    }
    expect(snap.pages[0].markups[0].id).toBe('m1')
    expect(snap.formatVersion).toBe(2)
    expect(snap.pdf.originalFilename).toBe('plans.pdf')
    expect((snap.pdf as Record<string, unknown>).absolutePath).toBeUndefined()
    expect((snap.pdf as Record<string, unknown>).relativePath).toBeUndefined()
  })

  it('excludes transient state (undoStack, redoStack, calibMode, activeTool)', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    const json = JSON.stringify(snap)
    expect(json).not.toMatch(/undoStack/)
    expect(json).not.toMatch(/redoStack/)
    expect(json).not.toMatch(/calibMode/)
    expect(json).not.toMatch(/"activeTool"/)
  })

  it('hydrate round-trip: snapshot -> JSON.stringify -> JSON.parse -> hydrate reproduces markup + scale state', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    const text = JSON.stringify(snap)
    // Wipe state
    useMarkupStore.setState({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    useScaleStore.setState({ pageScales: {}, globalUnit: 'm', calibMode: 'idle' })
    useViewerStore.setState({ currentPage: 1, pageViewports: {}, activeTool: 'select' })
    hydrateStores(JSON.parse(text))
    expect(useMarkupStore.getState().pageMarkups[1][0].id).toBe('m1')
    expect(useScaleStore.getState().pageScales[1].pixelsPerMm).toBe(5)
  })

  it('hydrate intentionally DROPS pageViewports — every page refits to current canvas on open (see debug/pdf-not-fitting-on-open)', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // Snapshot still WRITES viewport (preserves forward compatibility / file format)
    expect(snap.pages[0].viewport).toEqual({ zoom: 1.5, panX: 10, panY: 20 })

    // Wipe state to a clean baseline
    useMarkupStore.setState({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    useScaleStore.setState({ pageScales: {}, globalUnit: 'm', calibMode: 'idle' })
    useViewerStore.setState({ currentPage: 1, pageViewports: {}, activeTool: 'select' })

    hydrateStores(JSON.parse(JSON.stringify(snap)))

    // Contract: pageViewports is NOT restored; CanvasViewport will auto-fit each
    // page on first display against the current canvas size. This is intentional
    // — saved viewports are absolute pixel transforms that don't survive a
    // monitor / window-size change.
    expect(useViewerStore.getState().pageViewports).toEqual({})
  })

  it('hydrate clears undo/redo stacks', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    useMarkupStore.setState({ undoStack: [{ type: 'place', markup: sampleMarkup }] })
    hydrateStores(snap)
    expect(useMarkupStore.getState().undoStack).toEqual([])
    expect(useMarkupStore.getState().redoStack).toEqual([])
  })

  it('coords stable round-trip — Markup.point/points bytes unchanged after save/load', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    const text = JSON.stringify(snap)
    const parsed = JSON.parse(text)
    expect(parsed.pages[0].markups[0].point).toEqual(sampleMarkup.point)
  })

  // ===========================================================================
  // Phase 16 — PriceEntry round-trip + legacy-scalar coercion (proof b). The
  // Phase-15 scalar `rates: Record<string, number>` WIDENS to
  // Record<string, { material, labor, markup }>. Additive on ProjectFileV2 — NO
  // formatVersion bump. RED until Wave 1 (16-02/16-03) widens projectStore +
  // snapshotProject/hydrateStores to the PriceEntry shape. Mirrors the
  // hiddenItemNames analog in project-schema-hidden.test.ts; casts to `any`
  // where the field is referenced before the types land. Do NOT "fix" the
  // source — Wave 1-3 does.
  // ===========================================================================

  // Minimal V2 fixture for the hydrate-side rates tests (mirrors the
  // project-schema-hidden.test.ts MINIMAL_V2 shape).
  const MINIMAL_V2: ProjectFileV2 = {
    formatVersion: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pdf: { originalFilename: 'test.pdf', sha256: 'abc', totalPages: 1 },
    globalUnit: 'm',
    categories: {},
    categoryOrder: [],
    currentPage: 1,
    pages: [{ pageIndex: 1, dimensions: { width: 800, height: 600 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] }]
  }

  it('snapshotProject emits a PriceEntry rates map read from projectStore (Phase 16)', () => {
    // MUST FAIL — snapshotProject does not yet emit the PriceEntry rates shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ rates: { 'Skirting|perimeter': { material: 12, labor: 4, markup: 25 } } })
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap as any).rates).toEqual({ 'Skirting|perimeter': { material: 12, labor: 4, markup: 25 } })
  })

  it('hydrateStores accepts a PriceEntry rates map and writes it to projectStore (Phase 16)', () => {
    // MUST FAIL — hydrateStores does not yet consume the PriceEntry rates shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = {
      ...MINIMAL_V2,
      rates: { 'Outlet|count': { material: 7, labor: 2, markup: 40 } }
    } as unknown as ProjectFileV2
    hydrateStores(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates).toEqual({ 'Outlet|count': { material: 7, labor: 2, markup: 40 } })
  })

  it('hydrateStores coerces a Phase-15 legacy scalar rate → { material, labor:0, markup:30 } (proof b back-compat)', () => {
    // MUST FAIL — hydrateStores does not yet coerce a legacy scalar to PriceEntry.
    // A Phase-15 .clmc stored `rates: { 'X|count': 50 }` (a plain number). On load
    // it must become { material: 50, labor: 0, markup: 30 } (D-06 / A2).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = { ...MINIMAL_V2, rates: { 'X|count': 50 } } as unknown as ProjectFileV2
    hydrateStores(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates['X|count']).toEqual({ material: 50, labor: 0, markup: 30 })
  })

  it('hydrateStores defaults a missing markup on a PriceEntry object → 30 (proof b)', () => {
    // MUST FAIL — an object entry lacking `markup` must default markup to 30
    // (Pitfall 5 — distinguish "no markup field" → 30 from "markup: 0" → 0).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = { ...MINIMAL_V2, rates: { 'Y|count': { material: 3, labor: 1 } } } as unknown as ProjectFileV2
    hydrateStores(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates['Y|count'].markup).toBe(30)
  })

  it('hydrateStores coerces per-field malformed values to 0 while valid fields survive; never throws (proof b)', () => {
    // MUST FAIL — negative/non-number material fields must coerce to 0 while a
    // valid material survives; the call must not throw (T-16-02-01 hardening).
    const call = (): void =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hydrateStores({
        ...MINIMAL_V2,
        rates: {
          'A|count': { material: -5, labor: 2, markup: 30 },   // negative material → 0
          'B|count': { material: 'x', labor: 1, markup: 30 },  // non-number material → 0
          'C|count': { material: 10, labor: 3, markup: 30 }    // valid → survives
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as unknown as ProjectFileV2)
    expect(call).not.toThrow()
    call()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rates = (useProjectStore.getState() as any).rates
    expect(rates['A|count'].material).toBe(0)
    expect(rates['B|count'].material).toBe(0)
    expect(rates['C|count'].material).toBe(10)
  })

  it('hydrateStores defaults rates to {} when absent (legacy .clmc, Phase 16)', () => {
    // MUST FAIL — `rates` state field does not yet exist on projectStore.
    hydrateStores(MINIMAL_V2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates).toEqual({})
  })

  // ===========================================================================
  // WR-01 — project-wide defaultMarkupPct round-trip + coercion. Mirrors the
  // `rates` round-trip/coercion cases above: snapshotProject emits it from the
  // store; hydrateStores restores it (finite ≥0) inside the dirty-suspend bracket
  // and DEFAULTS to 30 when the field is absent (legacy .clmc) or invalid. A
  // stored 0 is a legitimate "no default markup" and must be preserved (distinct
  // from absent → 30).
  // ===========================================================================

  it('snapshotProject emits defaultMarkupPct read from projectStore (WR-01)', () => {
    useProjectStore.setState({ defaultMarkupPct: 42 })
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap as any).defaultMarkupPct).toBe(42)
  })

  it('defaultMarkupPct round-trips: snapshot -> JSON -> hydrate deep-equals (WR-01)', () => {
    useProjectStore.setState({ defaultMarkupPct: 27.5 })
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    const text = JSON.stringify(snap)
    // Wipe to a different value so a stale in-memory value can't mask a bad restore.
    useProjectStore.setState({ defaultMarkupPct: 99 })
    hydrateStores(JSON.parse(text))
    expect(useProjectStore.getState().defaultMarkupPct).toBe(27.5)
  })

  it('hydrateStores defaults defaultMarkupPct to 30 when absent (legacy .clmc, WR-01)', () => {
    // MINIMAL_V2 carries no defaultMarkupPct key — every legacy/Phase-15/early-
    // Phase-16 file must load with the 30% default. Seed a different value first.
    useProjectStore.setState({ defaultMarkupPct: 99 })
    hydrateStores(MINIMAL_V2)
    expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
  })

  it('hydrateStores preserves a stored defaultMarkupPct of 0 (distinct from absent → 30) (WR-01)', () => {
    useProjectStore.setState({ defaultMarkupPct: 99 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hydrateStores({ ...MINIMAL_V2, defaultMarkupPct: 0 } as unknown as ProjectFileV2)
    expect(useProjectStore.getState().defaultMarkupPct).toBe(0)
  })

  it('hydrateStores coerces an invalid defaultMarkupPct (negative / NaN / non-number) → 30; never throws (WR-01)', () => {
    const cases: unknown[] = [-5, NaN, Infinity, 'x', null, {}]
    for (const bad of cases) {
      useProjectStore.setState({ defaultMarkupPct: 99 })
      const call = (): void =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hydrateStores({ ...MINIMAL_V2, defaultMarkupPct: bad } as unknown as ProjectFileV2)
      expect(call).not.toThrow()
      call()
      // Invalid value coerces to the 30 default (the finite-≥0 guard's fallback).
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
    }
  })
})
