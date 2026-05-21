import type { Markup } from '../types/markup'

/**
 * Module-level refs for the Phase 13 post-commit re-open dispatch.
 *
 * Two distinct surfaces share one file:
 *
 * 1. _markupReopenHandler — the function registered by CanvasViewport that
 *    useKeyboardShortcuts calls between getMarkupUndoHandler (Phase 10) and
 *    useMarkupStore.getState().undo() (Phase 3). Returns true when a re-open
 *    transition fired (D-17 all four conditions satisfied), false when the
 *    caller should fall through to whole-markup undo. See markup-undo-ref.ts
 *    for the canonical pattern.
 *
 * 2. _reopenSnapshot — the original committed Markup that was removed at re-open
 *    trigger time. Consumed by either commitShape (on Enter — to build the
 *    reopen-recommit command) OR the Esc handler in CanvasViewport (on cancel
 *    — to restoreFromReopen). Cleared after consumption.
 *
 * Why module-level and not useMarkupTool state: cancel() resets useMarkupTool
 * to INITIAL_STATE which would wipe a hook-held snapshot mid-gesture if the
 * user navigates pages or switches tools during re-open. Module-level survives
 * that. (Phase 10 prior art: markup-undo-ref.ts uses the same reasoning.)
 *
 * Why not Zustand: this is transient UX state with no need for re-render
 * subscription. Module ref avoids store-traffic overhead.
 *
 * Lives in its own module to avoid a circular import between
 * useKeyboardShortcuts (reads handler), CanvasViewport (sets handler),
 * useMarkupTool (reads snapshot), and the store.
 */

let _markupReopenHandler: (() => boolean) | null = null

export function setMarkupReopenHandler(handler: (() => boolean) | null): void {
  _markupReopenHandler = handler
}

export function getMarkupReopenHandler(): (() => boolean) | null {
  return _markupReopenHandler
}

let _reopenSnapshot: Markup | null = null

export function setReopenSnapshot(markup: Markup | null): void {
  _reopenSnapshot = markup
}

export function getReopenSnapshot(): Markup | null {
  return _reopenSnapshot
}
