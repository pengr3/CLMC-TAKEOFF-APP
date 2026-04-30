import { create } from 'zustand'
import { useMarkupStore } from './markupStore'
import { useScaleStore } from './scaleStore'
import { useViewerStore } from './viewerStore'

interface ProjectStoreState {
  currentFilePath: string | null
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: number | null

  setSaved: (filePath: string) => void
  setSaving: (v: boolean) => void
  setCurrentFilePath: (filePath: string | null) => void
  markDirty: () => void
  reset: () => void
}

// Module-level guard — Pitfall 1 protection.
// Exported ONLY via suspend/resume helpers, never read externally.
let _hydrating = false

export function suspendDirtyTracking(): void {
  _hydrating = true
}

export function resumeDirtyTracking(): void {
  _hydrating = false
}

export function isHydrating(): boolean {
  return _hydrating
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  currentFilePath: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  setSaved: (filePath) =>
    set({ currentFilePath: filePath, isDirty: false, lastSavedAt: Date.now() }),

  setSaving: (v) => set({ isSaving: v }),

  setCurrentFilePath: (filePath) => set({ currentFilePath: filePath }),

  markDirty: () => {
    if (_hydrating) return
    if (get().isDirty) return
    set({ isDirty: true })
  },

  reset: () => set({
    currentFilePath: null,
    isDirty: false,
    isSaving: false,
    lastSavedAt: null
  })
}))

// Shallow-equal for array-tuple selectors returned by subscribeWithSelector.
function shallowEqualArr(
  a: readonly unknown[],
  b: readonly unknown[]
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Wire three subscribeWithSelector subscriptions — one per source-of-truth store.
 * Each watches only the fields that represent "user work" (excluding transient/UI state).
 * Call ONCE from App.tsx on mount. Returns an unsubscribe for test cleanup / hot reload.
 */
export function attachDirtyTracking(): () => void {
  const markDirty = useProjectStore.getState().markDirty

  const unsubMarkup = useMarkupStore.subscribe(
    (s) => [s.pageMarkups, s.categories, s.categoryOrder] as const,
    () => markDirty(),
    { equalityFn: shallowEqualArr }
  )

  const unsubScale = useScaleStore.subscribe(
    (s) => [s.pageScales, s.globalUnit] as const,
    () => markDirty(),
    { equalityFn: shallowEqualArr }
  )

  const unsubViewer = useViewerStore.subscribe(
    (s) => [s.pageViewports, s.currentPage] as const,
    () => markDirty(),
    { equalityFn: shallowEqualArr }
  )

  return () => {
    unsubMarkup()
    unsubScale()
    unsubViewer()
  }
}
