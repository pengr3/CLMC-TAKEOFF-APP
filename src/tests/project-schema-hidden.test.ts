/**
 * RED stubs — Wave 0: hiddenItemNames not yet in snapshotProject/hydrateStores/projectStore.
 * All tests MUST FAIL at runtime.
 * TypeScript compiles cleanly — casts to any used where needed.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { ProjectFileV2 } from '@renderer/lib/project-schema'

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>()
  const ls: Storage = {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
}

const MINIMAL_SNAPSHOT_PARAMS = {
  pdfOriginalFilename: 'test.pdf',
  pdfSha256: 'abc123',
  pdfTotalPages: 1,
  perPageDimensions: { 1: { width: 800, height: 600 } }
}

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

beforeEach(() => {
  installLocalStoragePolyfill()
  useMarkupStore.setState({ pageMarkups: {}, categories: {}, categoryOrder: [], undoStack: [], redoStack: [] })
  useScaleStore.setState({ pageScales: {}, globalUnit: 'm', calibMode: 'idle' })
  useViewerStore.setState({ currentPage: 1, totalPages: 1, activeTool: 'select', pageViewports: {}, pageScales: {} } as never)
  // Reset projectStore; hiddenItemNames does not yet exist on the store.
  useProjectStore.setState({ currentFilePath: null, isDirty: false, isSaving: false, isExporting: false, lastSavedAt: null } as never)
})

describe('project schema — hiddenItemNames', () => {
  it('snapshotProject emits hiddenItemNames from projectStore', () => {
    // MUST FAIL — snapshotProject does not yet read hiddenItemNames from projectStore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Outlet'] })
    const snap = snapshotProject(MINIMAL_SNAPSHOT_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap as any).hiddenItemNames).toEqual(['Outlet'])
  })

  it('hydrateStores accepts hiddenItemNames and writes to projectStore', () => {
    // MUST FAIL — hydrateStores does not yet consume hiddenItemNames
    const data: ProjectFileV2 & { hiddenItemNames?: string[] } = {
      ...MINIMAL_V2,
      hiddenItemNames: ['Switch']
    }
    hydrateStores(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).hiddenItemNames).toEqual(['Switch'])
  })

  it('hydrateStores defaults to [] when hiddenItemNames absent', () => {
    // MUST FAIL — hiddenItemNames state field does not yet exist on projectStore
    hydrateStores(MINIMAL_V2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useProjectStore.getState() as any).hiddenItemNames).toEqual([])
  })
})
