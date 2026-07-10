/** @vitest-environment jsdom */
/**
 * TotalsPanel group-operations wiring — Phase 17 Wave 4 (17-06).
 *
 * Two contracts:
 *
 * A. Menu → command routing (D-01/D-05/D-07/D-08). Renders the real TotalsPanel over a
 *    seeded store (one count group "Slab" in category "Electrical"), right-clicks the row to
 *    open the shared context menu, then asserts each of the four group actions:
 *      - Duplicate  → duplicateGroup('Slab') immediately, NO dialog (D-08).
 *      - Move to…   → mounts GroupCategoryDialog mode='move'; confirming dispatches
 *                     moveGroup('Slab', categoryName) (D-05).
 *      - Copy to…   → mounts GroupCategoryDialog mode='copy' with a non-empty autoName
 *                     preview ('Slab (2)') (D-07).
 *      - Rename     → sets the renaming target so the inline editor (InlineRenameInput,
 *                     aria-label "Rename Slab") mounts in place of the label (D-02).
 *    Store command actions are injected as spies via setState (the row-reorder-drag.test.ts
 *    convention) and the real commands are restored in beforeEach so no spy leaks forward.
 *
 * B. Double-click guard regression (D-02 — LOAD-BEARING perceived performance). Renders a
 *    bare TotalsRow and dispatches two rapid clicks — a { detail: 1 } click THEN a
 *    { detail: 2 } click — asserting the single-click cycle/arm callbacks fired AT MOST ONCE.
 *    The redundant SECOND click (detail === 2) is skipped by handleClick's early-return; the
 *    FIRST click (detail 1) still fires instantly, so the instant single-click is preserved.
 *
 * Harness mirrors totals-panel-render.test.ts (React.createElement + jsdom + localStorage
 * polyfill; vitest.config.ts include glob is *.test.ts only).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsPanel } from '@renderer/components/TotalsPanel'
import { TotalsRow } from '@renderer/components/TotalsRow'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { DEFAULT_UNIT } from '@renderer/types/scale'
import type { CountMarkup } from '@renderer/types/markup'
import type { BoqItemRow } from '@renderer/lib/boq-types'

// React 19 emits "act environment not configured" unless this flag is set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>()
  const ls: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
}

function makeCount(page: number, name: string, color: string, sequence: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color,
    sequence,
    point: { x: 10, y: 20 },
    createdAt: Date.now()
  }
}

/** Set a controlled React input's value and fire the native `input` event React listens on. */
function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function findMenuItem(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
    (b) => b.textContent === text
  ) as HTMLButtonElement | undefined
}

/** The genuine commands — restored before every test so no injected mock leaks forward. */
const REAL = {
  moveGroup: useMarkupStore.getState().moveGroup,
  copyGroup: useMarkupStore.getState().copyGroup,
  duplicateGroup: useMarkupStore.getState().duplicateGroup
}

const baseProps = {
  open: true,
  width: 320,
  onSetOpen: vi.fn()
}

beforeEach(() => {
  installLocalStoragePolyfill()
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null
  })
  useScaleStore.setState({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    categoryItemOrder: {},
    undoStack: [],
    redoStack: [],
    // Restore the real commands so a spy injected by a prior test cannot leak forward
    // (zustand's setState spreads the previous state object onto the next).
    moveGroup: REAL.moveGroup,
    copyGroup: REAL.copyGroup,
    duplicateGroup: REAL.duplicateGroup
  })
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

/** Seed one "Slab" count group, mount the panel, right-click its row to open the menu. */
function mountPanelAndOpenMenu(): MountResult {
  useViewerStore.setState({
    filePath: '/test.pdf',
    fileName: 'test.pdf',
    currentPage: 1,
    totalPages: 1,
    pageViewports: {},
    pdfDocument: null
  })
  useMarkupStore.setState({
    pageMarkups: { 1: [makeCount(1, 'Slab', '#0078d4', 1)] },
    categories: { 'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
    categoryOrder: ['cat-1'],
    categoryItemOrder: {},
    undoStack: [],
    redoStack: []
  })
  const mounted = mount(React.createElement(TotalsPanel, baseProps))
  const row = mounted.container.querySelector('[data-testid="totals-row"]') as HTMLElement
  expect(row).not.toBeNull()
  act(() => {
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }))
  })
  return mounted
}

describe('TotalsPanel group ops — menu → command routing (17-06)', () => {
  it('Duplicate dispatches duplicateGroup(name) immediately with no dialog (D-08)', () => {
    const duplicateSpy = vi.fn()
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      useMarkupStore.setState({ duplicateGroup: duplicateSpy as unknown as typeof REAL.duplicateGroup })
      const dupBtn = findMenuItem(container, 'Duplicate')
      expect(dupBtn).toBeDefined()
      act(() => {
        dupBtn!.click()
      })
      expect(duplicateSpy).toHaveBeenCalledTimes(1)
      expect(duplicateSpy).toHaveBeenCalledWith('Slab')
      // No dialog opened (D-08 — Duplicate is immediate).
      expect(container.querySelector('[data-testid="group-category-dialog"]')).toBeNull()
    } finally {
      unmount()
    }
  })

  it('Move to… mounts the dialog (mode=move); confirm dispatches moveGroup(name, categoryName) (D-05)', () => {
    const moveSpy = vi.fn()
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      useMarkupStore.setState({ moveGroup: moveSpy as unknown as typeof REAL.moveGroup })
      const moveBtn = findMenuItem(container, 'Move to…')
      expect(moveBtn).toBeDefined()
      act(() => {
        moveBtn!.click()
      })
      // Dialog mounted in move mode — the body names the group being moved.
      const dialog = container.querySelector('[data-testid="group-category-dialog"]')
      expect(dialog).not.toBeNull()
      const body = container.querySelector('[data-testid="group-category-dialog-body"]')
      expect(body!.textContent).toContain('Move')
      expect(body!.textContent).toContain('Slab')

      // Type a destination category and confirm.
      const input = container.querySelector('input') as HTMLInputElement
      expect(input).not.toBeNull()
      act(() => {
        setInputValue(input, 'Finishes')
      })
      const confirmBtn = container.querySelector(
        'button[aria-label="Move Group"]'
      ) as HTMLButtonElement
      expect(confirmBtn).not.toBeNull()
      act(() => {
        confirmBtn.click()
      })
      expect(moveSpy).toHaveBeenCalledTimes(1)
      expect(moveSpy).toHaveBeenCalledWith('Slab', 'Finishes')
      // Dialog closed after confirm.
      expect(container.querySelector('[data-testid="group-category-dialog"]')).toBeNull()
    } finally {
      unmount()
    }
  })

  it('Copy to… mounts the dialog (mode=copy) with a non-empty autoName preview (D-07)', () => {
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      const copyBtn = findMenuItem(container, 'Copy to…')
      expect(copyBtn).toBeDefined()
      act(() => {
        copyBtn!.click()
      })
      const dialog = container.querySelector('[data-testid="group-category-dialog"]')
      expect(dialog).not.toBeNull()
      // Copy mode shows the auto-name preview line "Copy as 'Slab (2)' into…" (first-free).
      const body = container.querySelector('[data-testid="group-category-dialog-body"]')
      expect(body!.textContent).toContain('Copy as')
      expect(body!.textContent).toContain('Slab (2)')
    } finally {
      unmount()
    }
  })

  it('HG-01: confirming Move with a BLANK category field neither creates a category nor moves the group', () => {
    const moveSpy = vi.fn()
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      useMarkupStore.setState({ moveGroup: moveSpy as unknown as typeof REAL.moveGroup })
      act(() => {
        findMenuItem(container, 'Move to…')!.click()
      })
      // Category field is left EMPTY (auto-focused; user presses the primary action).
      const confirmBtn = container.querySelector(
        'button[aria-label="Move Group"]'
      ) as HTMLButtonElement
      expect(confirmBtn).not.toBeNull()
      // Guarded: the button is disabled while the trimmed input is empty.
      expect(confirmBtn.disabled).toBe(true)
      act(() => {
        confirmBtn.click()
      })
      // No move dispatched — and since a disabled button swallows the click, the dialog
      // stays open (no blank-named category created downstream).
      expect(moveSpy).not.toHaveBeenCalled()
      // The store never minted a blank-named category via the guarded moveGroup path.
      const names = Object.values(useMarkupStore.getState().categories).map((c) => c.name)
      expect(names).not.toContain('')
    } finally {
      unmount()
    }
  })

  it('HG-01: pressing Enter with a BLANK category field (bypassing the disabled button) is a no-op', () => {
    const moveSpy = vi.fn()
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      useMarkupStore.setState({ moveGroup: moveSpy as unknown as typeof REAL.moveGroup })
      act(() => {
        findMenuItem(container, 'Move to…')!.click()
      })
      const dialog = container.querySelector(
        '[data-testid="group-category-dialog"]'
      ) as HTMLElement
      expect(dialog).not.toBeNull()
      // Enter reaches the backdrop handleKey → handleConfirm, bypassing the disabled
      // button entirely; handleConfirm's own non-empty guard must reject it.
      act(() => {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(moveSpy).not.toHaveBeenCalled()
      // Dialog stays open (a rejected confirm does not close it).
      expect(container.querySelector('[data-testid="group-category-dialog"]')).not.toBeNull()
    } finally {
      unmount()
    }
  })

  it('Copy to… confirm dispatches copyGroup(name, categoryName) (D-07)', () => {
    const copySpy = vi.fn()
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      useMarkupStore.setState({ copyGroup: copySpy as unknown as typeof REAL.copyGroup })
      act(() => {
        findMenuItem(container, 'Copy to…')!.click()
      })
      const input = container.querySelector('input') as HTMLInputElement
      act(() => {
        setInputValue(input, 'Finishes')
      })
      const confirmBtn = container.querySelector(
        'button[aria-label="Copy Group"]'
      ) as HTMLButtonElement
      expect(confirmBtn).not.toBeNull()
      act(() => {
        confirmBtn.click()
      })
      expect(copySpy).toHaveBeenCalledTimes(1)
      expect(copySpy).toHaveBeenCalledWith('Slab', 'Finishes')
    } finally {
      unmount()
    }
  })

  it('Rename opens the inline editor in place of the label (D-02)', () => {
    const { container, unmount } = mountPanelAndOpenMenu()
    try {
      // Before: the label text is shown, no rename input.
      expect(container.querySelector('input[aria-label="Rename Slab"]')).toBeNull()
      act(() => {
        findMenuItem(container, 'Rename')!.click()
      })
      // After: the inline rename editor is mounted for this group.
      const editor = container.querySelector('input[aria-label="Rename Slab"]')
      expect(editor).not.toBeNull()
    } finally {
      unmount()
    }
  })
})

describe('TotalsRow double-click guard — single-click stays instant (D-02)', () => {
  const item: BoqItemRow = {
    label: 'Slab',
    quantity: 1,
    uom: 'ea',
    color: '#0078d4',
    type: 'count',
    categoryId: 'cat-1'
  }

  it('two rapid clicks (detail 1 then detail 2) fire the cycle/arm callbacks AT MOST ONCE', () => {
    const onClick = vi.fn()
    const onArmTool = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick,
        onContextMenu: vi.fn(),
        onArmTool
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      // First (single) click — detail 1 — fires the cycle/arm instantly.
      act(() => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      })
      // Redundant SECOND click of a double-click — detail 2 — must be skipped by the
      // e.detail === 2 early-return (it opens rename via onDoubleClick instead).
      act(() => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
      })

      // Cycle/arm fired for the FIRST click only — never twice. Proves the instant
      // single-click is preserved when double-click rename is armed.
      expect(onArmTool).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledTimes(1)
    } finally {
      unmount()
    }
  })
})
