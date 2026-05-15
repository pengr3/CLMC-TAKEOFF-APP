import { create } from 'zustand'
import { useMarkupStore } from './markupStore'
import { useScaleStore } from './scaleStore'
import { useViewerStore } from './viewerStore'

interface ProjectStoreState {
  currentFilePath: string | null
  isDirty: boolean
  isSaving: boolean
  isExporting: boolean
  lastSavedAt: number | null
  hiddenItemNames: string[]
  /** Derived in-memory O(1) lookup — NOT persisted in .clmc. Kept in sync with hiddenItemNames. */
  hiddenItemSet: Set<string>

  setSaved: (filePath: string) => void
  setSaving: (v: boolean) => void
  setExporting: (v: boolean) => void
  setCurrentFilePath: (filePath: string | null) => void
  markDirty: () => void
  reset: () => void
  /**
   * Flip a name in/out of hiddenItemNames and syncs hiddenItemSet for O(1) renderer lookups.
   * Marks the project dirty so Save persists the change.
   * D-16: visibility toggle is NOT undoable — direct projectStore action, no MarkupCommand.
   */
  toggleHiddenItem: (name: string) => void
  /** Set hiddenItemNames + hiddenItemSet atomically. Used by hydrateStores during load — dirty tracking already suspended. */
  setHiddenItemNames: (names: string[]) => void
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
  isExporting: false,
  lastSavedAt: null,
  hiddenItemNames: [],
  hiddenItemSet: new Set<string>(),

  setSaved: (filePath) =>
    set({ currentFilePath: filePath, isDirty: false, lastSavedAt: Date.now() }),

  setSaving: (v) => set({ isSaving: v }),

  setExporting: (v) => set({ isExporting: v }),

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
    isExporting: false,
    lastSavedAt: null,
    hiddenItemNames: [],
    hiddenItemSet: new Set()
  }),

  toggleHiddenItem: (name) => {
    set((s) => {
      const idx = s.hiddenItemNames.indexOf(name)
      const next = idx >= 0
        ? s.hiddenItemNames.filter((n) => n !== name)
        : [...s.hiddenItemNames, name]
      return { hiddenItemNames: next, hiddenItemSet: new Set(next) }
    })
    get().markDirty()
  },

  setHiddenItemNames: (names) => {
    set({ hiddenItemNames: names, hiddenItemSet: new Set(names) })
  }
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
