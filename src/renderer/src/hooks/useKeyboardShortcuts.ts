import { useEffect } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useMarkupStore } from '../stores/markupStore'
import { getMarkupUndoHandler } from '../lib/markup-undo-ref'

interface KeyboardShortcutHandlers {
  openPdf: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
}

/**
 * Returns true if the user is currently typing in a text input / textarea /
 * contenteditable element. Global keyboard shortcuts that would interfere
 * with native edit-undo (Ctrl+Z) should bail when this returns true.
 *
 * Addresses Pitfall 7 — global Ctrl+Z firing while user types a markup name
 * would delete a committed markup instead of undoing the typo.
 */
export function isTextInputActive(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  if (el instanceof HTMLInputElement) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true
    if (el.contentEditable === 'true') return true
    // Attribute fallback — handles environments (e.g. jsdom, legacy HTML)
    // where the IDL property does not reflect the attribute. An empty string
    // attribute value also means "contenteditable" per the HTML spec.
    const attr = el.getAttribute('contenteditable')
    if (attr !== null && (attr === '' || attr.toLowerCase() === 'true')) return true
  }
  return false
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const totalPages = useViewerStore((s) => s.totalPages)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl+O: Open PDF
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        handlers.openPdf()
        return
      }

      // Ctrl+Z: Undo markup action (respects native edit-undo in text inputs — Pitfall 7).
      // While a linear/area/perimeter draw is in progress, prefer popping the last
      // placed vertex so a mid-draw misclick can be corrected without undoing a
      // previously committed markup.
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        if (isTextInputActive()) return
        e.preventDefault()
        const handledByDraw = getMarkupUndoHandler()?.() ?? false
        if (!handledByDraw) {
          useMarkupStore.getState().undo()
        }
        return
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo markup action
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (isTextInputActive()) return
        e.preventDefault()
        useMarkupStore.getState().redo()
        return
      }

      // Only handle remaining shortcuts when a PDF is loaded
      if (totalPages === 0) return

      // Ctrl+=: Zoom in
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handlers.zoomIn()
        return
      }

      // Ctrl+-: Zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault()
        handlers.zoomOut()
        return
      }

      // Ctrl+0: Fit to window
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        handlers.fitToWindow()
        return
      }

      // ArrowLeft / PageUp: Previous page
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        useViewerStore.getState().prevPage()
        return
      }

      // ArrowRight / PageDown: Next page
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        useViewerStore.getState().nextPage()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers, totalPages])
}
