import { useEffect } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useMarkupStore } from '../stores/markupStore'
import { getMarkupUndoHandler } from '../lib/markup-undo-ref'

interface KeyboardShortcutHandlers {
  openPdf: () => void                          // kept for backwards compat
  openProject: () => void                      // Ctrl+O — extension-sniffing Open (D-20)
  saveProject: () => void                      // Ctrl+S (routes to Save As if no path — handled inside useProject)
  saveProjectAs: () => void                    // Ctrl+Shift+S
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
  /** D-18: Export BOQ — Ctrl+Shift+E. App.tsx wires to handleExportClick. */
  exportBoq: () => void
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

/**
 * Pure helper used by both the shortcut handler and the unit test.
 * "Ctrl+S on a project that has never been saved routes through Save As" — D-13.
 */
export function chooseSaveShortcut(currentFilePath: string | null): 'save' | 'save-as' {
  return currentFilePath ? 'save' : 'save-as'
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const totalPages = useViewerStore((s) => s.totalPages)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl+O: extension-sniffing open (D-20)
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        if (isTextInputActive()) return
        e.preventDefault()
        handlers.openProject()
        return
      }

      // Ctrl+Shift+S: Save As (must be checked before Ctrl+S to avoid conflict)
      if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        if (isTextInputActive()) return
        e.preventDefault()
        handlers.saveProjectAs()
        return
      }

      // Ctrl+Shift+E: Export BOQ (D-18)
      if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        if (isTextInputActive()) return
        e.preventDefault()
        handlers.exportBoq()
        return
      }

      // Ctrl+S: Save (routes to Save As internally if currentFilePath is null — D-13)
      if (e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        if (isTextInputActive()) return
        e.preventDefault()
        handlers.saveProject()
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

      // Plan 09-02: Delete — remove the currently selected markup(s) as a
      // single undoable command. isTextInputActive() guard is mandatory
      // (T-09-02-01) so pressing Delete inside a name-input or context-menu
      // text field never wipes a committed markup.
      if (e.key === 'Delete') {
        if (isTextInputActive()) return
        const selectedIds = useViewerStore.getState().selectedMarkupIds
        if (selectedIds.length === 0) return
        if (selectedIds.length === 1) {
          // Single-select: look up the markup's page so we call deleteMarkup
          // with the correct (page, id) pair. The Wave 0 invariant (page-
          // scoped clear on every page transition) guarantees the id lives
          // on the current page, but reading the page from the markup
          // itself is the safest path against any drift.
          const id = selectedIds[0]
          const allPages = useMarkupStore.getState().pageMarkups
          let pageOfMarkup = -1
          for (const [pageKey, list] of Object.entries(allPages)) {
            if (list.some((m) => m.id === id)) {
              pageOfMarkup = Number(pageKey)
              break
            }
          }
          if (pageOfMarkup > 0) {
            useMarkupStore.getState().deleteMarkup(pageOfMarkup, id)
          }
        } else {
          // Multi-select: route through deleteGroup so the entire batch is a
          // single undoable command (Wave 0 contract — MarkupCommand
          // 'delete-group').
          const idSet = new Set(selectedIds)
          const allMarkups = Object.values(useMarkupStore.getState().pageMarkups).flat()
          const toDelete = allMarkups.filter((m) => idSet.has(m.id))
          if (toDelete.length > 0) {
            useMarkupStore.getState().deleteGroup(toDelete)
          }
        }
        // CRITICAL: clear selection AFTER the delete so selectedMarkupIds never
        // points at a removed markup. The keyboard handler owns the selection
        // lifecycle (Wave 0 SUMMARY decision) — markupStore stays free of
        // viewerStore imports.
        useViewerStore.getState().clearSelection()
        return
      }

      // Plan 09-02: Ctrl+A — select every markup on the current page while in
      // 'select' mode. isTextInputActive() guard preserves the OS-standard
      // "Select All" inside any focused text input (T-09-02-01 / D-27 pattern).
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        if (isTextInputActive()) return
        e.preventDefault()
        if (useViewerStore.getState().activeTool !== 'select') return
        if (totalPages === 0) return
        const currentPage = useViewerStore.getState().currentPage
        const allIds = useMarkupStore.getState().getMarkups(currentPage).map((m) => m.id)
        useViewerStore.getState().setSelectedMarkupIds(allIds)
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
