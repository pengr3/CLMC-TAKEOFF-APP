import { describe, it, expect, beforeEach } from 'vitest'
import {
  useProjectStore,
  attachDirtyTracking,
  suspendDirtyTracking,
  resumeDirtyTracking
} from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { hydrateStores } from '@renderer/lib/project-serialize'
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

let detach: () => void = () => {}

beforeEach(() => {
  // Detach subscriptions first so resets below don't fire dirty listeners
  detach()
  // Reset all stores (no subscriptions active, so no isDirty side-effects)
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 1,
    pageViewports: {},
    filePath: null,
    fileName: null,
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select'
  })
  // Reset projectStore last — after all store resets are done
  useProjectStore.getState().reset()
  // Re-attach subscriptions for this test
  detach = attachDirtyTracking()
})

describe('projectStore', () => {
  it('dirty on place — placing a markup flips isDirty=true', () => {
    expect(useProjectStore.getState().isDirty).toBe(false)
    useMarkupStore.getState().placeMarkup(sampleMarkup)
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('dirty on scale — setScale flips isDirty=true', () => {
    expect(useProjectStore.getState().isDirty).toBe(false)
    useScaleStore.getState().setScale(1, 5, 'm')
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('dirty on viewport — setZoom flips isDirty=true', () => {
    expect(useProjectStore.getState().isDirty).toBe(false)
    useViewerStore.getState().setZoom(1, 2)
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('stays clean on hydrate — hydrating stores does NOT flip isDirty', () => {
    // Build a minimal ProjectFileV2 to hydrate from
    const snap: ProjectFileV2 = {
      formatVersion: 2,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      pdf: { originalFilename: 'plans.pdf', sha256: 'x', totalPages: 1 },
      globalUnit: 'm',
      categories: {},
      categoryOrder: [],
      currentPage: 1,
      pages: [
        {
          pageIndex: 1,
          dimensions: { width: 595, height: 842 },
          scale: null,
          viewport: { zoom: 1, panX: 0, panY: 0 },
          markups: [sampleMarkup]
        }
      ]
    }
    hydrateStores(snap)
    expect(useProjectStore.getState().isDirty).toBe(false)
    expect(useMarkupStore.getState().pageMarkups[1][0].id).toBe('m1')
  })

  it('clean after save — setSaved(path) sets isDirty=false and currentFilePath', () => {
    useMarkupStore.getState().placeMarkup(sampleMarkup)
    expect(useProjectStore.getState().isDirty).toBe(true)
    useProjectStore.getState().setSaved('C:/proj/plans.clmc')
    expect(useProjectStore.getState().isDirty).toBe(false)
    expect(useProjectStore.getState().currentFilePath).toBe('C:/proj/plans.clmc')
    expect(useProjectStore.getState().lastSavedAt).toBeGreaterThan(0)
  })

  it('reset clears currentFilePath and isDirty', () => {
    useProjectStore.getState().setSaved('C:/p.clmc')
    useMarkupStore.getState().placeMarkup(sampleMarkup)
    expect(useProjectStore.getState().isDirty).toBe(true)
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().currentFilePath).toBeNull()
    expect(useProjectStore.getState().isDirty).toBe(false)
    expect(useProjectStore.getState().lastSavedAt).toBeNull()
  })
})

describe('projectStore isSaving (D-12)', () => {
  it('isSaving primitive selector defaults to false', () => {
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().isSaving).toBe(false)
  })

  it('setSaving(true) flips isSaving to true; setSaving(false) flips back', () => {
    useProjectStore.getState().setSaving(true)
    expect(useProjectStore.getState().isSaving).toBe(true)
    useProjectStore.getState().setSaving(false)
    expect(useProjectStore.getState().isSaving).toBe(false)
  })

  it('reset() resets isSaving to false even when mid-save', () => {
    useProjectStore.getState().setSaving(true)
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().isSaving).toBe(false)
  })

  it('setSaving does NOT flip isDirty (orthogonal to user-data dirty-tracking)', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().setSaving(true)
    expect(useProjectStore.getState().isDirty).toBe(false)
    useProjectStore.getState().setSaving(false)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
})

describe('useProjectStore — isExporting (D-19 race guard)', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
  })

  it('isExporting defaults to false', () => {
    expect(useProjectStore.getState().isExporting).toBe(false)
  })

  it('setExporting(true) flips to true; setExporting(false) flips back', () => {
    useProjectStore.getState().setExporting(true)
    expect(useProjectStore.getState().isExporting).toBe(true)
    useProjectStore.getState().setExporting(false)
    expect(useProjectStore.getState().isExporting).toBe(false)
  })

  it('reset() zeroes isExporting back to false', () => {
    useProjectStore.getState().setExporting(true)
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().isExporting).toBe(false)
  })
})

// Re-export for potential external use in test verification
export { suspendDirtyTracking, resumeDirtyTracking }
