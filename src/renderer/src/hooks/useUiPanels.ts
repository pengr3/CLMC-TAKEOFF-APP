import { useSyncExternalStore } from 'react'

/**
 * useUiPanels — localStorage-backed UI panel state for Phase 6 chrome
 * (totals panel width/open, collapsed BOQ categories).
 *
 * Persisted under the `clmc.ui` localStorage key — NEVER inside `.clmc`
 * project files (D-03 cross-cutting constraint). Estimator preferences
 * follow the workstation, not the project.
 *
 * Hardening (T-06-01-01):
 * - readStorage() does a defensive shape check covering all type-bearing
 *   fields. Any of (a) missing key, (b) JSON.parse throw, (c) shape mismatch
 *   silently resets to DEFAULTS — no thrown errors, no console noise.
 *
 * Drag-resize note (Splitter coordination, Phase 6 Wave 1 — 06-02):
 * - This hook commits widths immediately to localStorage on every state
 *   change. The Splitter MUST hold the in-flight pointermove width in
 *   local component state and only call setTotalsWidth on pointerup —
 *   otherwise we'd write 60-120 times per second during a drag.
 *   See 06-RESEARCH §5 for the locked pattern.
 *
 * SHARED STORE (quick-260820-plx):
 * - The state lives at MODULE scope and is read through useSyncExternalStore,
 *   so every caller observes the SAME UiState. This is load-bearing, not a
 *   refactor: App.tsx renders <TotalsPanel open={totals.open}> from its own
 *   useUiPanels() call while TopActionBar's Totals button flips open via a
 *   second call. With the previous per-component useState, the top bar
 *   mutated a PRIVATE copy (plus localStorage) and the panel never moved —
 *   the button was inert. The same isolation made collapsedCategories diverge
 *   between TotalsCategoryBlock and EstimateCategoryBlock: each kept its own
 *   array and clobbered the other's in storage, visible after a reload.
 * - UseUiPanelsApi is unchanged, so no call site changes.
 * - One deliberate behavioral delta: the old `useEffect(() =>
 *   writeStorage(state), [state])` wrote on every mount; the store now writes
 *   only on an actual mutation. Nothing depends on a mount write, and it
 *   removes a pointless boot write.
 */

const STORAGE_KEY = 'clmc.ui'

export interface UiState {
  totals: { open: boolean; width: number }
  collapsedCategories: string[]
}

const DEFAULTS: UiState = {
  totals: { open: true, width: 320 },
  collapsedCategories: []
}

function readStorage(): UiState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    if (
      typeof parsed?.totals?.open === 'boolean' &&
      typeof parsed?.totals?.width === 'number' &&
      Array.isArray(parsed?.collapsedCategories)
    ) {
      return parsed as UiState
    }
    return DEFAULTS
  } catch {
    // T-06-01-01: parse failure → silent reset
    return DEFAULTS
  }
}

function writeStorage(s: UiState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // T-06-01-02: ignore quota / serialization errors — UI state loss is non-critical
  }
}

// --- Module-level store (the single source of truth for every consumer) ---

let state: UiState | null = null
const listeners = new Set<() => void>()

/**
 * Reference-stable snapshot. useSyncExternalStore re-invokes getSnapshot on
 * every render and throws "getSnapshot should be cached" (or loops forever) if
 * a fresh object comes back each call — so the SAME reference must be returned
 * until a mutation replaces it.
 */
function getSnapshot(): UiState {
  if (state === null) state = readStorage()
  return state
}

function emit(): void {
  for (const listener of Array.from(listeners)) listener()
}

/**
 * The ONLY write path. One localStorage write per committed change — the
 * Splitter's pointerup-only contract depends on this (T-PLX-03).
 */
function apply(updater: (s: UiState) => UiState): void {
  const next = updater(getSnapshot())
  if (next === state) return
  state = next
  writeStorage(next)
  emit()
}

/**
 * On the 0→1 listener transition, reconcile in-memory state against storage.
 *
 * In production App.tsx keeps at least one consumer mounted for the whole
 * session, so this only ever runs at boot — where memory and storage are
 * already identical (writes are synchronous on every change), making it a
 * no-op. In tests it is the reset that stops module state from surviving a
 * `beforeEach` localStorage clear and leaking across cases.
 *
 * The returned closure deletes its own listener — the only thing preventing an
 * unbounded listener set across mount/unmount cycles (T-PLX-02).
 */
function subscribe(listener: () => void): () => void {
  const wasEmpty = listeners.size === 0
  listeners.add(listener)
  if (wasEmpty) {
    const fresh = readStorage()
    if (JSON.stringify(fresh) !== JSON.stringify(getSnapshot())) {
      state = fresh
      emit()
    }
  }
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Test-only reset for first-render determinism (no waiting on the
 * first-subscribe reconcile). Adding a named export does not change
 * UseUiPanelsApi or any call site.
 */
export function __resetUiPanelsForTests(): void {
  state = null
}

// Module-scope setters are permanently stable references, so useCallback is no
// longer needed. Updater bodies are lifted verbatim from the previous hook.
function setTotalsOpen(open: boolean): void {
  apply((s) => ({ ...s, totals: { ...s.totals, open } }))
}

function setTotalsWidth(width: number): void {
  apply((s) => ({ ...s, totals: { ...s.totals, width } }))
}

function toggleCategoryCollapsed(name: string): void {
  apply((s) => ({
    ...s,
    collapsedCategories: s.collapsedCategories.includes(name)
      ? s.collapsedCategories.filter((c) => c !== name)
      : [...s.collapsedCategories, name]
  }))
}

export interface UseUiPanelsApi {
  totals: { open: boolean; width: number }
  collapsedCategories: string[]

  setTotalsOpen: (open: boolean) => void
  setTotalsWidth: (width: number) => void
  toggleCategoryCollapsed: (categoryName: string) => void
}

export function useUiPanels(): UseUiPanelsApi {
  // No getServerSnapshot third argument — this is an Electron renderer; there
  // is no SSR / hydration path.
  const s = useSyncExternalStore(subscribe, getSnapshot)

  return {
    totals: s.totals,
    collapsedCategories: s.collapsedCategories,
    setTotalsOpen,
    setTotalsWidth,
    toggleCategoryCollapsed
  }
}
