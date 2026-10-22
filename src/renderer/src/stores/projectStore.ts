import { create } from 'zustand'
import { useMarkupStore } from './markupStore'
import { useScaleStore } from './scaleStore'
import { useViewerStore } from './viewerStore'
import { DEFAULT_MARKUP_PCT } from '../lib/estimate-defaults'
import type { PriceEntry } from '../lib/boq-types'
import { inferredRateBasis } from '../lib/rate-units'

export interface SaveFailure {
  path: string
  stage: 'write' | 'validate' | 'backup' | 'replace'
  message: string
  firstSave: boolean
}

interface ProjectStoreState {
  preservedSource: { path: string; format: number; backup: boolean } | null
  upgradeRequested: boolean
  recoveryWarning: string | null
  saveFailure: SaveFailure | null
  lastSaveOutcome: { revision: number; message: string; at: number } | null
  setSaveFailure: (failure: SaveFailure | null) => void
  documentSessionId: string
  editRevision: number
  savedRevision: number
  acknowledgeSavedRevision: (path: string, session: string, revision: number) => boolean
  currentFilePath: string | null
  isDirty: boolean
  isSaving: boolean
  isExporting: boolean
  lastSavedAt: number | null
  hiddenItemNames: string[]
  /** Derived in-memory O(1) lookup — NOT persisted in .clmc. Kept in sync with hiddenItemNames. */
  hiddenItemSet: Set<string>
  /**
   * Per-(name|type) PriceEntry `{ material, labor, markup }` (Phase 16 — widens
   * the Phase-15 scalar ₱ rate). `material`/`labor` are ₱ per unit; `markup` is a
   * PERCENT (30 = 30%). The map IS the O(1) lookup — no derived Set needed
   * (unlike hiddenItemNames). Persisted in .clmc, category-INDEPENDENT (key is
   * `${name}|${type}`, NOT name|categoryId).
   */
  rates: Record<string, PriceEntry>
  /**
   * PROJECT-wide default markup PERCENT (30 = 30%) applied to any BOQ row that has
   * no explicit PriceEntry markup (WR-01). PROJECT data — persisted in the .clmc and
   * follows the project, NOT the workstation (which is why it lives here + in the
   * Estimate sheet header, not the generic Settings tab). Initial value 30 (=
   * DEFAULT_MARKUP_PCT). The aggregator reads `entry?.markup ?? opts.defaultMarkup ??
   * DEFAULT_MARKUP_PCT`, so a project default of 0 is honored (0 ?? 30 === 0) and an
   * explicit per-entry markup:0 still wins.
   */
  defaultMarkupPct: number

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
  /**
   * Merge a partial PriceEntry patch into the entry at a `${name}|${type}` key
   * and mark the project dirty so Save persists the edit (Phase 16 — replaces the
   * scalar setRate). A material-only patch preserves the existing labor/markup; a
   * brand-new entry seeds `{ material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT }`
   * before applying the patch. Mirrors toggleHiddenItem incl. the trailing
   * get().markDirty() — without it an edited price would not survive Save.
   */
  setPrice: (key: string, patch: Partial<PriceEntry>) => void
  getUnresolvedRateKeys: () => string[]
  acknowledgeRateBasis: (keys: readonly string[]) => void
  /**
   * Set the project-wide default markup % (WR-01). Coerces to a finite value ≥ 0
   * (Number.isFinite(pct) && pct >= 0 ? pct : 0), then marks the project dirty so
   * Save persists it — mirrors setPrice's trailing get().markDirty(). A cleared /
   * NaN / negative input lands as 0 (a legitimate "no markup" default).
   */
  setDefaultMarkupPct: (pct: number) => void
  /**
   * Phase 17 (Req 1, D-03): move the PriceEntry at `oldKey` (a `${name}|${type}`
   * rate key) to `newKey`, deleting `oldKey`. No-op when `oldKey` is absent or equals
   * `newKey`. The rename command captures the moved entry so undo can move it back.
   * Mirrors setPrice's trailing get().markDirty() so a rename survives Save.
   */
  reKeyRate: (oldKey: string, newKey: string) => void
  /**
   * Phase 17 (Req 1, D-03): move the composite visibility key `oldKey`
   * (`${name}|${categoryId}` — Pitfall 1) to `newKey` in hiddenItemNames, rebuilding
   * hiddenItemSet. No-op when `oldKey` is not hidden or equals `newKey`. Mirrors
   * toggleHiddenItem's filter + `new Set(next)` rebuild + trailing markDirty.
   */
  reKeyHidden: (oldKey: string, newKey: string) => void
  /**
   * Phase 17 (move-group hidden re-key): atomically remove `remove` keys and add `add`
   * keys to hiddenItemNames, rebuilding hiddenItemSet. Order-independent and idempotent
   * (result is deduped). moveGroup uses this to migrate a group's composite visibility
   * keys (`${name}|${categoryId}`) from its source category to the target in ONE step —
   * a plain reKeyHidden can't, because several source categories collapse to one target
   * key (reKeyHidden's 1:1 rename would create duplicates). No-op when both lists are
   * empty. Marks dirty. Undo passes the swapped lists.
   */
  setHiddenBatch: (remove: string[], add: string[]) => void
  /**
   * Phase 17 (D-07): seed a fresh blank PriceEntry `{ material: 0, labor: 0, markup:
   * DEFAULT_MARKUP_PCT }` at `key` (used by copy/duplicate redo in 17-04). Marks dirty.
   */
  addBlankRate: (key: string) => void
  /**
   * Phase 17 (D-07): delete the PriceEntry at `key` (used by copy/duplicate undo in
   * 17-04). No-op when absent. Marks dirty.
   */
  removeRate: (key: string) => void
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

// Factory kept as a function so the store is created once and REUSED across Vite
// HMR updates (see the import.meta.hot block below). Keeps the store a singleton
// so dirty-tracking subscriptions and every consumer share one instance in dev.
// Return type left to inference (see viewerStore.ts) so ReturnType<> stays exact.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createProjectStore = () =>
  create<ProjectStoreState>((set, get) => ({
    preservedSource: null,
    upgradeRequested: false,
    recoveryWarning: null,
    saveFailure: null,
    lastSaveOutcome: null,
    setSaveFailure: (saveFailure) => set({ saveFailure }),
    documentSessionId: crypto.randomUUID(),
    editRevision: 0,
    savedRevision: 0,
    acknowledgeSavedRevision: (path, session, revision) => {
      if (get().documentSessionId !== session) return false
      const clean = get().editRevision === revision
      set({ currentFilePath: path, savedRevision: revision, isDirty: !clean, lastSavedAt: Date.now(), saveFailure: null,
        lastSaveOutcome: { revision, at: Date.now(), message: clean ? 'Saved' : 'Earlier changes saved. Newer changes are still unsaved.' } })
      return clean
    },
    currentFilePath: null,
    isDirty: false,
    isSaving: false,
    isExporting: false,
    lastSavedAt: null,
    hiddenItemNames: [],
    hiddenItemSet: new Set<string>(),
    rates: {},
    defaultMarkupPct: DEFAULT_MARKUP_PCT,

    setSaved: (filePath) =>
      set({ currentFilePath: filePath, isDirty: false, savedRevision: get().editRevision, lastSavedAt: Date.now() }),

    setSaving: (v) => set({ isSaving: v }),

    setExporting: (v) => set({ isExporting: v }),

    setCurrentFilePath: (filePath) => set({ currentFilePath: filePath }),

    markDirty: () => {
      if (_hydrating) return
      set({ isDirty: true, editRevision: get().editRevision + 1 })
    },

    reset: () =>
      set({
        preservedSource: null,
        upgradeRequested: false,
        recoveryWarning: null,
        saveFailure: null,
        lastSaveOutcome: null,
        documentSessionId: crypto.randomUUID(),
        editRevision: 0,
        savedRevision: 0,
        currentFilePath: null,
        isDirty: false,
        isSaving: false,
        isExporting: false,
        lastSavedAt: null,
        hiddenItemNames: [],
        hiddenItemSet: new Set(),
        rates: {},
        defaultMarkupPct: DEFAULT_MARKUP_PCT
      }),

    toggleHiddenItem: (name) => {
      set((s) => {
        const idx = s.hiddenItemNames.indexOf(name)
        const next =
          idx >= 0 ? s.hiddenItemNames.filter((n) => n !== name) : [...s.hiddenItemNames, name]
        return { hiddenItemNames: next, hiddenItemSet: new Set(next) }
      })
      get().markDirty()
    },

    setHiddenItemNames: (names) => {
      set({ hiddenItemNames: names, hiddenItemSet: new Set(names) })
    },

    setPrice: (key, patch) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return
      set((s) => {
        const cur = s.rates[key] ?? { material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT,
          basis: inferredRateBasis(key, useScaleStore.getState().globalUnit), review: 'reviewed' as const }
        return { rates: { ...s.rates, [key]: { ...cur, ...patch } } }
      })
      get().markDirty()
    },

    getUnresolvedRateKeys: () => Object.keys(get().rates).filter(key => get().rates[key].review !== 'reviewed'),

    acknowledgeRateBasis: (keys) => {
      const unresolved = keys.filter(key => Object.hasOwn(get().rates, key) && get().rates[key].review !== 'reviewed')
      if (unresolved.length === 0) return
      set(s => {
        const rates = { ...s.rates }
        for (const key of unresolved) rates[key] = { ...rates[key], review: 'reviewed' }
        return { rates }
      })
      get().markDirty()
    },

    setDefaultMarkupPct: (pct) => {
      const safe = Number.isFinite(pct) && pct >= 0 ? pct : 0
      set({ defaultMarkupPct: safe })
      get().markDirty()
    },

    reKeyRate: (oldKey, newKey) => {
      if (['__proto__', 'constructor', 'prototype'].includes(newKey)) return
      set((s) => {
        const entry = s.rates[oldKey]
        if (entry === undefined || oldKey === newKey) return s
        const next = { ...s.rates }
        delete next[oldKey]
        next[newKey] = entry
        return { rates: next }
      })
      get().markDirty()
    },

    reKeyHidden: (oldKey, newKey) => {
      set((s) => {
        if (oldKey === newKey || !s.hiddenItemNames.includes(oldKey)) return s
        const next = s.hiddenItemNames.map((n) => (n === oldKey ? newKey : n))
        return { hiddenItemNames: next, hiddenItemSet: new Set(next) }
      })
      get().markDirty()
    },

    setHiddenBatch: (remove, add) => {
      if (remove.length === 0 && add.length === 0) return
      set((s) => {
        const removeSet = new Set(remove)
        const kept = s.hiddenItemNames.filter((n) => !removeSet.has(n))
        const keptSet = new Set(kept)
        const next = [...kept]
        for (const k of add) {
          if (!keptSet.has(k)) {
            keptSet.add(k)
            next.push(k)
          }
        }
        return { hiddenItemNames: next, hiddenItemSet: new Set(next) }
      })
      get().markDirty()
    },

    addBlankRate: (key) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return
      set((s) => ({
        rates: { ...s.rates, [key]: { material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT,
          basis: inferredRateBasis(key, useScaleStore.getState().globalUnit), review: 'reviewed' } }
      }))
      get().markDirty()
    },

    removeRate: (key) => {
      set((s) => {
        if (s.rates[key] === undefined) return s
        const next = { ...s.rates }
        delete next[key]
        return { rates: next }
      })
      get().markDirty()
    }
  }))

// See viewerStore.ts for the full rationale. Prod build strips this; Vitest falls
// through to `createProjectStore()` (double optional-chain guards the web-transform
// stub whose `import.meta.hot.data` is undefined).
export const useProjectStore =
  (import.meta.hot?.data?.store as ReturnType<typeof createProjectStore> | undefined) ??
  createProjectStore()

if (import.meta.hot) {
  if (import.meta.hot.data) import.meta.hot.data.store = useProjectStore
  import.meta.hot.accept()
}

// Shallow-equal for array-tuple selectors returned by subscribeWithSelector.
function shallowEqualArr(a: readonly unknown[], b: readonly unknown[]): boolean {
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
    // Phase 17 (Req 2): watch categoryItemOrder so a reorder-only change (no
    // pageMarkups/categories mutation) still marks the project dirty.
    (s) => [s.pageMarkups, s.categories, s.categoryOrder, s.categoryItemOrder] as const,
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
