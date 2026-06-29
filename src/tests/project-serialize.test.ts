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
  // Phase 15 — rates round-trip (proof b). RED until Plan 15-04 adds `rates` to
  // projectStore + snapshotProject/hydrateStores. Mirrors the hiddenItemNames
  // analog in project-schema-hidden.test.ts; casts to `any` where the field is
  // referenced before the types land. Do NOT "fix" the source — Wave 1-3 does.
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

  it('snapshotProject emits rates read from projectStore (Phase 15)', () => {
    // MUST FAIL — snapshotProject does not yet read `rates` from projectStore.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ rates: { 'Skirting|perimeter': 12 } })
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap as any).rates).toEqual({ 'Skirting|perimeter': 12 })
  })

  it('hydrateStores accepts rates and writes them to projectStore (Phase 15)', () => {
    // MUST FAIL — hydrateStores does not yet consume `rates`.
    const data: ProjectFileV2 & { rates?: Record<string, number> } = {
      ...MINIMAL_V2,
      rates: { 'Outlet|count': 7 }
    }
    hydrateStores(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates).toEqual({ 'Outlet|count': 7 })
  })

  it('hydrateStores defaults rates to {} when absent (legacy .clmc, Phase 15)', () => {
    // MUST FAIL — `rates` state field does not yet exist on projectStore.
    hydrateStores(MINIMAL_V2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).rates).toEqual({})
  })
})
