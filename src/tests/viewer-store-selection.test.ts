import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'

beforeEach(() => {
  // Reset to a known-clean state at the start of every test. Mirrors
  // src/tests/viewer-store.test.ts so behaviour stays orthogonal.
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null,
    pdfBytes: null,
    pageScales: {},
    activeTool: 'select',
    selectedMarkupIds: []
  })
})

describe('viewerStore — selectedMarkupIds', () => {
  it('initialises with selectedMarkupIds equal to []', () => {
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('setSelectedMarkupIds(["id-a","id-b"]) sets state to ["id-a","id-b"]', () => {
    useViewerStore.getState().setSelectedMarkupIds(['id-a', 'id-b'])
    expect(useViewerStore.getState().selectedMarkupIds).toEqual(['id-a', 'id-b'])
  })

  it('clearSelection() resets selectedMarkupIds to []', () => {
    useViewerStore.getState().setSelectedMarkupIds(['id-a', 'id-b'])
    useViewerStore.getState().clearSelection()
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('setPage() clears selectedMarkupIds (selection is page-scoped per D-01)', () => {
    // Need a totalPages > 1 so setPage(2) is in-range
    useViewerStore.getState().setFile('/p.pdf', 'p.pdf', 5)
    useViewerStore.getState().setSelectedMarkupIds(['id-a'])
    useViewerStore.getState().setPage(2)
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('nextPage() clears selectedMarkupIds', () => {
    useViewerStore.getState().setFile('/p.pdf', 'p.pdf', 5)
    useViewerStore.getState().setSelectedMarkupIds(['id-a'])
    useViewerStore.getState().nextPage()
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('prevPage() clears selectedMarkupIds', () => {
    useViewerStore.getState().setFile('/p.pdf', 'p.pdf', 5)
    useViewerStore.getState().setPage(3)
    useViewerStore.getState().setSelectedMarkupIds(['id-a'])
    useViewerStore.getState().prevPage()
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('resetViewer() clears selectedMarkupIds', () => {
    useViewerStore.getState().setSelectedMarkupIds(['id-a'])
    useViewerStore.getState().resetViewer()
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })

  it('hydrate() clears selectedMarkupIds', () => {
    useViewerStore.getState().setSelectedMarkupIds(['id-a'])
    useViewerStore.getState().hydrate({ currentPage: 1, pageViewports: {} })
    expect(useViewerStore.getState().selectedMarkupIds).toEqual([])
  })
})
