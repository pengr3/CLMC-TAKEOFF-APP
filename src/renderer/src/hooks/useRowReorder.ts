import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useMarkupStore } from '../stores/markupStore'

/** A row's stable key + the Y coordinate of its vertical midpoint (viewport px). */
export interface RowRect {
  key: string
  mid: number
}

export interface UseRowReorderReturn {
  /**
   * Attach to the grip handle's `onPointerDown` ONLY — drag starts ONLY from the grip (D-09).
   * `itemKey` is the dragged row's `name|type` bucket key; `getRowRects` returns ALL rows in
   * the category in current visual (top→bottom) order, read live per move so a mid-drag scroll
   * keeps the drop index correct (Pitfall 5).
   */
  onGripPointerDown: (e: React.PointerEvent, itemKey: string, getRowRects: () => RowRect[]) => void
  /** Key of the row currently lifted (dragging), or null — drives the lifted-row treatment. */
  liftedKey: string | null
  /** Current drop-boundary index (0..rows.length), or null — drives the insertion line. */
  insertionIndex: number | null
}

/** Distance (px) from a scroll edge that triggers auto-scroll during a drag (Pitfall 5). */
const AUTO_SCROLL_EDGE = 24
/** Auto-scroll delta per animation frame (px). */
const AUTO_SCROLL_SPEED = 8

/**
 * Count how many row midpoints sit above `clientY` — that count is the drop-boundary index
 * (0 = above the first row, rows.length = below the last). Rows are supplied in visual order.
 */
function computeDropIndex(clientY: number, rows: RowRect[]): number {
  let index = 0
  for (const row of rows) {
    if (clientY > row.mid) index++
  }
  return index
}

/**
 * Return a new array with `itemKey` moved to `dropIndex`, where `dropIndex` is expressed in the
 * coordinate space of the ORIGINAL array (0..length). Removing the item first then re-inserting
 * accounts for the index shift when the item started above the drop point.
 */
export function moveKey(order: string[], itemKey: string, dropIndex: number): string[] {
  const from = order.indexOf(itemKey)
  if (from === -1) return order.slice()
  const next = order.slice()
  next.splice(from, 1)
  const to = dropIndex > from ? dropIndex - 1 : dropIndex
  next.splice(to, 0, itemKey)
  return next
}

/** Order-sensitive equality — the no-op-dispatch guard. */
function ordersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** Nearest scrollable ancestor of `node` (overflowY auto/scroll and actually overflowing), or null. */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = node?.parentElement ?? null
  while (el) {
    const overflowY = window.getComputedStyle(el).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el
    }
    el = el.parentElement
  }
  return null
}

/**
 * useRowReorder — the shared pointer-events drag lifecycle for within-category row reorder
 * (Phase 17 Req 2, D-09/D-10). Reuses the app's proven window-listener idiom (Splitter /
 * useDraggable) — NOT HTML5 DnD, NO new package.
 *
 * A grip pointerdown registers `pointermove` + `pointerup` on `window` (element-scoped listeners
 * drop events on fast drags); each move recomputes the drop index from the live row midpoints
 * and updates the lifted-row + insertion-line state; pointerup removes BOTH window listeners
 * atomically (T-17-07: no leaked listener on an interrupted drag) and dispatches exactly ONE
 * undoable `reorderItems(catKey, newOrder)` — skipped when the order is unchanged.
 *
 * Both estimating surfaces (totals panel + Estimate sheet) consume this hook so they never
 * diverge; the category block supplies `getRowRects` and renders the returned lift/insertion state.
 */
export function useRowReorder(catKey: string, orderedKeys: string[]): UseRowReorderReturn {
  const [liftedKey, setLiftedKey] = useState<string | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)

  // LW-02: teardown for the in-progress drag (removes the window listeners + cancels the
  // rAF), or null when no drag is active. A drag's onUp clears this to null on a normal
  // drop; the unmount effect below invokes it so an interrupted drag (component unmounts
  // mid-drag — e.g. the user closes/switches project before releasing) can't leak a
  // stale listener that later dispatches reorderItems against the wrong project.
  const activeDragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      activeDragCleanupRef.current?.()
      activeDragCleanupRef.current = null
    }
  }, [])

  const onGripPointerDown = useCallback(
    (e: React.PointerEvent, itemKey: string, getRowRects: () => RowRect[]): void => {
      // Drag ONLY from the grip: never let the pointerdown reach the row's click/cycle (D-09).
      e.preventDefault()
      e.stopPropagation()

      // Optional pointer capture for robustness (jsdom-safe — mirrors useDraggable:62).
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId)
      } catch {
        // non-pointer / jsdom environments may throw — degrade gracefully
      }

      const startOrder = [...orderedKeys]
      let dropIndex = startOrder.indexOf(itemKey)
      setLiftedKey(itemKey)
      setInsertionIndex(dropIndex)

      // Auto-scroll (Pitfall 5): while the pointer sits near a scroll edge, nudge the nearest
      // scroll parent a small delta per frame. Reads the latest pointer Y each frame; cancelled
      // atomically on pointerup. Never starts when there is no scrollable ancestor (e.g. jsdom).
      const scrollParent = findScrollParent(e.currentTarget as HTMLElement)
      let latestY = e.clientY
      let rafId = 0
      const tick = (): void => {
        if (scrollParent) {
          const rect = scrollParent.getBoundingClientRect()
          if (latestY < rect.top + AUTO_SCROLL_EDGE) scrollParent.scrollTop -= AUTO_SCROLL_SPEED
          else if (latestY > rect.bottom - AUTO_SCROLL_EDGE)
            scrollParent.scrollTop += AUTO_SCROLL_SPEED
        }
        rafId = requestAnimationFrame(tick)
      }
      if (scrollParent) rafId = requestAnimationFrame(tick)

      const onMove = (ev: PointerEvent): void => {
        latestY = ev.clientY
        // Read rects live each move so a scroll mid-drag keeps the drop index correct (Pitfall 5).
        dropIndex = computeDropIndex(ev.clientY, getRowRects())
        setInsertionIndex(dropIndex)
      }
      // Atomic listener removal + rAF cancel — no dropped events on fast drags, no leak
      // (T-17-07 / Splitter T-06-02-02). Shared by the normal pointerup drop AND the
      // unmount safety net (LW-02) so both tear the drag down the same way.
      const removeDragListeners = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (rafId) cancelAnimationFrame(rafId)
      }
      const onUp = (): void => {
        // Both listeners removed (and rAF cancelled) before any dispatch.
        removeDragListeners()
        activeDragCleanupRef.current = null
        setLiftedKey(null)
        setInsertionIndex(null)
        const newOrder = moveKey(startOrder, itemKey, dropIndex)
        // ONE dispatch, guarded — a no-op drag (order unchanged) dispatches nothing.
        if (!ordersEqual(newOrder, startOrder)) {
          useMarkupStore.getState().reorderItems(catKey, newOrder)
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      // Expose this drag's teardown so an unmount mid-drag removes the listeners without
      // dispatching (LW-02). onUp clears it back to null on a normal drop.
      activeDragCleanupRef.current = removeDragListeners
    },
    [catKey, orderedKeys]
  )

  return { onGripPointerDown, liftedKey, insertionIndex }
}
