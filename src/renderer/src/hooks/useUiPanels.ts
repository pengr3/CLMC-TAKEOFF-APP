import { useCallback, useEffect, useState } from 'react'

/**
 * useUiPanels — localStorage-backed UI panel state for Phase 6 chrome
 * (thumbnail strip width/open, totals panel width/open, collapsed BOQ
 * categories).
 *
 * Persisted under the `clmc.ui` localStorage key — NEVER inside `.clmc`
 * project files (D-03 cross-cutting constraint). Estimator preferences
 * follow the workstation, not the project.
 *
 * Hardening (T-06-01-01):
 * - readStorage() does a defensive shape check covering all four type-bearing
 *   fields. Any of (a) missing key, (b) JSON.parse throw, (c) shape mismatch
 *   silently resets to DEFAULTS — no thrown errors, no console noise.
 *
 * Drag-resize note (Splitter coordination, Phase 6 Wave 1 — 06-02):
 * - This hook commits widths immediately to localStorage on every state
 *   change. The Splitter MUST hold the in-flight pointermove width in
 *   local component state and only call setThumbnailsWidth/setTotalsWidth
 *   on pointerup — otherwise we'd write 60-120 times per second during
 *   a drag. See 06-RESEARCH §5 for the locked pattern.
 */

const STORAGE_KEY = 'clmc.ui'

export interface UiState {
  thumbnails: { open: boolean; width: number }
  totals: { open: boolean; width: number }
  collapsedCategories: string[]
}

const DEFAULTS: UiState = {
  thumbnails: { open: true, width: 140 },
  totals: { open: true, width: 320 },
  collapsedCategories: []
}

function readStorage(): UiState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    if (
      typeof parsed?.thumbnails?.open === 'boolean' &&
      typeof parsed?.thumbnails?.width === 'number' &&
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

export interface UseUiPanelsApi {
  thumbnails: { open: boolean; width: number }
  totals: { open: boolean; width: number }
  collapsedCategories: string[]

  setThumbnailsOpen: (open: boolean) => void
  setThumbnailsWidth: (width: number) => void
  setTotalsOpen: (open: boolean) => void
  setTotalsWidth: (width: number) => void
  toggleCategoryCollapsed: (categoryName: string) => void
}

export function useUiPanels(): UseUiPanelsApi {
  // Sync read on mount — Electron renderer has localStorage available
  // immediately; no SSR / hydration mismatch concern.
  const [state, setState] = useState<UiState>(readStorage)

  // Persist on every state change. Drag-resize callers MUST debounce via
  // local component state (see Splitter pattern in 06-02).
  useEffect(() => {
    writeStorage(state)
  }, [state])

  const setThumbnailsOpen = useCallback(
    (open: boolean) => setState((s) => ({ ...s, thumbnails: { ...s.thumbnails, open } })),
    []
  )
  const setThumbnailsWidth = useCallback(
    (width: number) => setState((s) => ({ ...s, thumbnails: { ...s.thumbnails, width } })),
    []
  )
  const setTotalsOpen = useCallback(
    (open: boolean) => setState((s) => ({ ...s, totals: { ...s.totals, open } })),
    []
  )
  const setTotalsWidth = useCallback(
    (width: number) => setState((s) => ({ ...s, totals: { ...s.totals, width } })),
    []
  )
  const toggleCategoryCollapsed = useCallback(
    (name: string) =>
      setState((s) => ({
        ...s,
        collapsedCategories: s.collapsedCategories.includes(name)
          ? s.collapsedCategories.filter((c) => c !== name)
          : [...s.collapsedCategories, name]
      })),
    []
  )

  return {
    thumbnails: state.thumbnails,
    totals: state.totals,
    collapsedCategories: state.collapsedCategories,
    setThumbnailsOpen,
    setThumbnailsWidth,
    setTotalsOpen,
    setTotalsWidth,
    toggleCategoryCollapsed
  }
}
