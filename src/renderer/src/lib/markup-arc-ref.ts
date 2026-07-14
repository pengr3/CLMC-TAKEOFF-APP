/**
 * Module-level refs for the arc-mode keybinding handlers (Phase 14, D-02).
 *
 * The arc-mode flags (`arcHeld` one-off, `arcMode` sticky) live in
 * useMarkupTool's React state, not a Zustand store — so useKeyboardShortcuts
 * cannot read them via getState(). CanvasViewport registers the setters here
 * while it is mounted; the global key handler in useKeyboardShortcuts reads them
 * to drive hold-A (one-off) and Shift+A (sticky toggle).
 *
 * Lives in its own module to avoid a circular import between
 * useKeyboardShortcuts (reads the handlers) and CanvasViewport (imports the
 * former). Mirrors lib/markup-undo-ref.ts.
 */

let _setArcHeld: ((held: boolean) => void) | null = null
let _toggleArcSticky: (() => void) | null = null

export function setArcHeldHandler(handler: ((held: boolean) => void) | null): void {
  _setArcHeld = handler
}

export function getArcHeldHandler(): ((held: boolean) => void) | null {
  return _setArcHeld
}

export function setArcStickyToggleHandler(handler: (() => void) | null): void {
  _toggleArcSticky = handler
}

export function getArcStickyToggleHandler(): (() => void) | null {
  return _toggleArcSticky
}

/**
 * Phase 18 (18-04, R-2 / Pitfall 1): a REACTIVE readable seam for the current
 * sticky-arc on/off state.
 *
 * The sticky-arc flag lives in useMarkupTool's React state, exposed above only
 * as *setters*. Sibling surfaces (ToolRail 18-07, ContextBar 18-08) need to
 * READ whether Arc is on to render its chrome. A bare module-var getter (like
 * getChainArmedItem) is not enough: Shift+A flips arc mode with NO coincident
 * store change, so a non-observable read would leave those surfaces stale until
 * an unrelated re-render.
 *
 * Therefore this is a getSnapshot/subscribe pair shaped for React's
 * useSyncExternalStore(subscribeArcSticky, getArcSticky). CanvasViewport
 * publishes markupState.arcMode into setArcStickyState on every change; the
 * writer notifies subscribers AFTER committing the new value. Arc flags stay
 * off any store (locked Phase-14 decision, STATE.md:183) — this is a
 * runtime-only in-memory boolean + listener Set, never serialized.
 */
let _arcSticky = false
const _arcListeners = new Set<() => void>()

export function getArcSticky(): boolean {
  return _arcSticky
}

export function setArcStickyState(on: boolean): void {
  if (on === _arcSticky) return
  _arcSticky = on
  // Notify strictly AFTER updating the value so getArcSticky() reads the new
  // value inside each callback (useSyncExternalStore contract).
  _arcListeners.forEach((cb) => cb())
}

export function subscribeArcSticky(cb: () => void): () => void {
  _arcListeners.add(cb)
  return () => {
    _arcListeners.delete(cb)
  }
}
