import { describe, it, expect } from 'vitest'
// import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
// import { useMarkupStore } from '@renderer/stores/markupStore'
// import { useScaleStore } from '@renderer/stores/scaleStore'
// import { useViewerStore } from '@renderer/stores/viewerStore'

describe('project-serialize', () => {
  it('snapshot includes D-02 fields (formatVersion, createdAt, updatedAt, pdf, globalUnit, categories, categoryOrder, currentPage, pages)', () => {
    expect(true).toBe(false)
  })

  it('excludes transient state (undoStack, redoStack, calibMode, activeTool)', () => {
    expect(true).toBe(false)
  })

  it('hydrate round-trip: snapshot -> JSON.stringify -> JSON.parse -> hydrate reproduces store state', () => {
    expect(true).toBe(false)
  })

  it('hydrate clears undo/redo stacks', () => {
    expect(true).toBe(false)
  })

  it('coords stable round-trip — Markup.point/points bytes unchanged after save/load', () => {
    expect(true).toBe(false)
  })
})
