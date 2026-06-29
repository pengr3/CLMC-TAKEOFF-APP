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
