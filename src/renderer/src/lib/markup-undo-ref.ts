/**
 * Module-level ref for the in-progress markup undo handler.
 *
 * CanvasViewport registers a handler here while it is mounted. That handler
 * returns `true` when a vertex was popped from an in-progress polyline or
 * polygon (meaning the caller should treat Ctrl+Z as handled) and `false`
 * when no drawing is in progress (caller should fall through to the
 * committed-markup undo stack).
 *
 * Lives in its own module to avoid a circular import between
 * `useKeyboardShortcuts` and `CanvasViewport` (the former reads the handler,
 * the latter imports the former).
 */

let _markupUndoHandler: (() => boolean) | null = null

export function setMarkupUndoHandler(handler: (() => boolean) | null): void {
  _markupUndoHandler = handler
}

export function getMarkupUndoHandler(): (() => boolean) | null {
  return _markupUndoHandler
}
