import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { CountMarkup } from '@renderer/types/markup'

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
      pdfAbsolutePath: 'C:/plans.pdf',
      pdfRelativePath: null,
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
  })

  it('excludes transient state (undoStack, redoStack, calibMode, activeTool)', () => {
    const snap = snapshotProject({
      pdfAbsolutePath: 'C:/plans.pdf',
      pdfRelativePath: null,
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

  it('hydrate round-trip: snapshot -> JSON.stringify -> JSON.parse -> hydrate reproduces store state', () => {
    const snap = snapshotProject({
      pdfAbsolutePath: 'C:/plans.pdf',
      pdfRelativePath: null,
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
    expect(useViewerStore.getState().pageViewports[1].zoom).toBe(1.5)
  })

  it('hydrate clears undo/redo stacks', () => {
    const snap = snapshotProject({
      pdfAbsolutePath: 'C:/plans.pdf',
      pdfRelativePath: null,
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
      pdfAbsolutePath: 'C:/plans.pdf',
      pdfRelativePath: null,
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    const text = JSON.stringify(snap)
    const parsed = JSON.parse(text)
    expect(parsed.pages[0].markups[0].point).toEqual(sampleMarkup.point)
  })
})
