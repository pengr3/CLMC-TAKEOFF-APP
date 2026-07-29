/**
 * Reactive readable seam for the current chain-armed markup item (name + color).
 *
 * The chain-armed state (markupState.chainArmed + pendingName + pendingColor)
 * lives in useMarkupTool's React state and is published from CanvasViewport. The
 * ContextBar placing-state chip (18-08) READS it to show the armed group name.
 *
 * Originally this was a bare module var + getter ON CanvasViewport
 * (getChainArmedItem), read during ContextBar render. That is NOT enough: the
 * chain-armed item can CHANGE (in particular, CLEAR) with no coincident change
 * to anything ContextBar subscribes to (activeTool / selection / snap / arc).
 *
 * The concrete failure (debug/resolved/tool-switch-placement-stuck.md): switching
 * from an actively-placing tool (Count, chain armed) to another markup tool
 * (Linear) resets the useMarkupTool machine — but ContextBar had already read the
 * stale armed item during the activeTool-change render and never re-rendered
 * again, so the chip kept showing the PRIOR group's name over the fresh, empty
 * Linear tool. This is the exact staleness the 18-04 Arc seam calls out
 * getChainArmedItem for (markup-arc-ref.ts) but never fixed here.
 *
 * The fix mirrors that Arc seam: a getSnapshot/subscribe pair shaped for React's
 * useSyncExternalStore(subscribeChainArmed, getChainArmedItem). CanvasViewport
 * publishes into setChainArmedItem on every chain-state change; the writer
 * notifies subscribers AFTER committing the new value, and ONLY on a real change
 * so getSnapshot stays referentially stable between notifications (a fresh
 * {name,color} with identical fields must not churn subscribers or trip React's
 * "getSnapshot should be cached" guard). Runtime-only in-memory state — the chain
 * flags are a locked never-serialized Phase-8/14 decision.
 */

export interface ChainArmedItem {
  name: string
  color: string
}

let _chainArmed: ChainArmedItem | null = null
const _listeners = new Set<() => void>()

/** getSnapshot — the current chain-armed item, or null when nothing is armed. */
export function getChainArmedItem(): ChainArmedItem | null {
  return _chainArmed
}

/**
 * Publish the chain-armed item. No-op (no reassign, no notify) when the value is
 * unchanged by VALUE, so the stored reference stays stable between real changes.
 */
export function setChainArmedItem(next: ChainArmedItem | null): void {
  const prev = _chainArmed
  const unchanged =
    prev === next ||
    (prev !== null && next !== null && prev.name === next.name && prev.color === next.color)
  if (unchanged) return
  _chainArmed = next
  // Notify strictly AFTER committing the new value so getChainArmedItem() reads
  // the new value inside each callback (useSyncExternalStore contract).
  _listeners.forEach((cb) => cb())
}

export function subscribeChainArmed(cb: () => void): () => void {
  _listeners.add(cb)
  return () => {
    _listeners.delete(cb)
  }
}
