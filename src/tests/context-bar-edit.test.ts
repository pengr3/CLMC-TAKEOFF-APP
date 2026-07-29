/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — ContextBar selected-markup edit ops (SC-4).
 *
 * FAILS today because `@renderer/components/ContextBar` does not exist yet — the
 * import cannot be resolved (missing MODULE, not a syntax/config error). Turns GREEN
 * when plan 18-08 lands the ContextBar selected-markup panel, which re-homes the
 * SAME store ops the right-click MarkupContextMenu already dispatches
 * (CanvasViewport.tsx:2718-2723):
 *   - inline rename via InlineRenameInput → useMarkupStore.renameGroup(old, new)
 *     on the native Enter path (NOT a synthetic onChange — Phase 15/17 pattern)
 *   - a display-only category chip (getCategory(categoryId).name)
 *   - Recolor → MARKUP_PALETTE swatch row → useMarkupStore.recolorGroup(name, hex)
 *   - Delete → useMarkupStore.deleteMarkup(page, id)
 *
 * Store ops are spied by injecting vi.fn()s onto the REAL markupStore via setState
 * (the inline-rename-input.test.ts / estimate-row-edit.test.ts convention), so the
 * assertions pin the exact (old,new) / (name,hex) / (page,id) arguments rather than
 * state mutation. getCategory stays REAL so the chip resolves the seeded category.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => ({ activate: vi.fn(), cancel: vi.fn(), activateVerify: vi.fn() }),
  setChainArmedFromTotals: vi.fn()
}))

vi.mock('@renderer/lib/markup-chain-ref', () => ({
  getChainArmedItem: () => null,
  setChainArmedItem: () => {},
  subscribeChainArmed: () => () => {}
}))

vi.mock('@renderer/lib/markup-arc-ref', () => ({
  getArcSticky: () => false,
  setArcStickyState: () => {},
  subscribeArcSticky: () => () => {},
  getArcStickyToggleHandler: () => () => {},
  setArcStickyToggleHandler: () => {},
  getArcHeldHandler: () => null,
  setArcHeldHandler: () => {}
}))

import { ContextBar } from '@renderer/components/ContextBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'
import type { LinearMarkup } from '@renderer/types/markup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

// renameGroup must return an { ok } object — InlineRenameInput destructures it.
const renameSpy = vi.fn(() => ({ ok: true }))
const recolorSpy = vi.fn()
const deleteSpy = vi.fn()

function renderBar(): void {
  act(() => {
    root.render(React.createElement(ContextBar))
  })
}

function makeLinear(page: number, id: string, name = 'Skirting'): LinearMarkup {
  return {
    id,
    type: 'linear',
    page,
    name,
    categoryId: 'cat-1',
    color: '#5bbf6a',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    createdAt: Date.now()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks can drop the default implementation — re-arm the { ok:true } path.
  renameSpy.mockImplementation(() => ({ ok: true }))
  window.localStorage.clear()
  useViewerStore.setState({
    totalPages: 3,
    currentPage: 1,
    filePath: 'C:/x.pdf',
    fileName: 'x.pdf',
    pageViewports: {},
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select',
    viewMode: 'plan',
    selectedMarkupIds: ['m1'],
    snapEnabled: true,
    snapSuspended: false
  })
  useScaleStore.getState().reset()
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  // Seed one selected linear markup + its category, then inject the op spies onto
  // the real store (getCategory stays real so the chip resolves 'Electrical').
  useMarkupStore.setState({
    pageMarkups: { 1: [makeLinear(1, 'm1', 'Skirting')] },
    categories: {
      'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
    },
    categoryOrder: ['cat-1'],
    renameGroup: renameSpy,
    recolorGroup: recolorSpy,
    deleteMarkup: deleteSpy
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ContextBar — selected-markup edit ops (SC-4)', () => {
  it('selection alone does NOT steal keyboard focus into the rename input (focus-steal regression guard)', () => {
    renderBar()
    // The auto-focusing InlineRenameInput must NOT be mounted on mere selection —
    // if it were, isTextInputActive() would trap F3/Delete/Shift+A/Ctrl+Z.
    const input = container.querySelector('input[aria-label="Rename Skirting"]')
    expect(input).toBeNull()
    // And nothing may have grabbed focus into a text field: document.activeElement
    // must not be a text input (this is exactly what useKeyboardShortcuts guards on).
    const active = document.activeElement
    const isTextInput =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    expect(isTextInput).toBe(false)
  })

  it('rename: input is mounted only after clicking the Rename affordance; typing + native Enter commits via renameGroup(old, new)', () => {
    renderBar()
    // Not present on mere selection…
    expect(container.querySelector('input[aria-label="Rename Skirting"]')).toBeNull()

    // …clicking the click-to-edit name trigger mounts the auto-focusing editor.
    const trigger = container.querySelector(
      '[data-testid="context-rename-trigger"]'
    ) as HTMLElement | null
    expect(trigger).not.toBeNull()
    act(() => trigger!.click())

    const input = container.querySelector('input[aria-label="Rename Skirting"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    act(() => {
      input!.value = 'Trunking'
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(renameSpy).toHaveBeenCalledTimes(1)
    expect(renameSpy).toHaveBeenCalledWith('Skirting', 'Trunking')
  })

  it('category chip shows the markup category name (display-only)', () => {
    renderBar()
    expect(container.textContent).toContain('Electrical')
  })

  it('Recolor opens the MARKUP_PALETTE swatch row; clicking a swatch calls recolorGroup(name, hex)', () => {
    renderBar()
    const recolorBtn = container.querySelector('[aria-label="Recolor"]') as HTMLElement | null
    expect(recolorBtn).not.toBeNull()
    act(() => recolorBtn!.click())

    // The swatch row reuses MarkupContextMenu's `Color ${hex}` aria-label convention.
    const hex = MARKUP_PALETTE[6]
    const swatch = container.querySelector(`[aria-label="Color ${hex}"]`) as HTMLElement | null
    expect(swatch).not.toBeNull()
    act(() => swatch!.click())
    expect(recolorSpy).toHaveBeenCalledWith('Skirting', hex)
  })

  it('Delete calls deleteMarkup(page, id) for the selected markup', () => {
    renderBar()
    const deleteBtn = container.querySelector('[aria-label="Delete markup"]') as HTMLElement | null
    expect(deleteBtn).not.toBeNull()
    act(() => deleteBtn!.click())
    expect(deleteSpy).toHaveBeenCalledWith(1, 'm1')
  })
})
