import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'

// Reset to a known-clean state at the start of every test. Mirrors
// src/tests/viewer-store-selection.test.ts so behaviour stays orthogonal.
// Note: `vertexEditMarkupId` is included in the reset so these tests will
// fail (RED) on the assertions referencing it until the Wave 1 implementation
// adds the field + setVertexEditMarkupId/clearVertexEdit actions to the store.
beforeEach(() => {
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
    selectedMarkupIds: [],
    vertexEditMarkupId: null
  })
})

describe('viewerStore — vertexEditMarkupId', () => {
  it('initialises with vertexEditMarkupId equal to null', () => {
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })

  it('setVertexEditMarkupId(id) sets vertexEditMarkupId', () => {
    useViewerStore.getState().setVertexEditMarkupId('markup-abc')
    expect(useViewerStore.getState().vertexEditMarkupId).toBe('markup-abc')
  })

  it('clearVertexEdit() resets vertexEditMarkupId to null', () => {
    useViewerStore.getState().setVertexEditMarkupId('markup-abc')
    useViewerStore.getState().clearVertexEdit()
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })

  it('setPage() clears vertexEditMarkupId (vertex edit is page-scoped)', () => {
    // Need a totalPages > 1 so setPage(2) is in-range — otherwise setPage
    // short-circuits and the assertion would never go RED on a working impl
    useViewerStore.setState({
      filePath: '/p.pdf',
      fileName: 'p.pdf',
      totalPages: 5,
      currentPage: 1,
      vertexEditMarkupId: 'some-id'
    })
    useViewerStore.getState().setPage(2)
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })

  it('nextPage() clears vertexEditMarkupId', () => {
    useViewerStore.setState({
      filePath: '/p.pdf',
      fileName: 'p.pdf',
      totalPages: 5,
      currentPage: 1,
      vertexEditMarkupId: 'some-id'
    })
    useViewerStore.getState().nextPage()
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })

  it('prevPage() clears vertexEditMarkupId', () => {
    useViewerStore.setState({
      filePath: '/p.pdf',
      fileName: 'p.pdf',
      totalPages: 5,
      currentPage: 3,
      vertexEditMarkupId: 'some-id'
    })
    useViewerStore.getState().prevPage()
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })

  it('resetViewer() clears vertexEditMarkupId', () => {
    useViewerStore.getState().setVertexEditMarkupId('some-id')
    useViewerStore.getState().resetViewer()
    expect(useViewerStore.getState().vertexEditMarkupId).toBeNull()
  })
})
