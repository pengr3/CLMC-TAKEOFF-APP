/**
 * RED stubs — Wave 0: Lightbulb visibility slot does not yet exist on TotalsRow.
 * All tests MUST FAIL at runtime (slot is not rendered).
 * TypeScript compiles cleanly.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { TotalsRow } from '@renderer/components/TotalsRow'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>()
  const ls: Storage = {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
}

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(element) })
  return {
    container,
    root,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    }
  }
}

/**
 * Build a count BoqItemRow with an explicit categoryId.
 * categoryId=null → uncategorized (key becomes "name|")
 * categoryId='cat-1' → key becomes "name|cat-1"
 */
function makeCountItem(name: string, categoryId: string | null = null): BoqItemRow {
  return { label: name, quantity: 3, uom: 'ea', color: '#0078d4', type: 'count', categoryId }
}

const noop = vi.fn()

function makeRowProps(item: BoqItemRow, onClick?: () => void) {
  return {
    item,
    cycleIndex: 0,
    currentPageMatches: [],
    onHover: noop,
    onClick: onClick ?? noop,
    onContextMenu: noop,
    onTriggerPulse: noop
  }
}

beforeEach(() => {
  installLocalStoragePolyfill()
  useMarkupStore.setState({ pageMarkups: {}, categories: {}, categoryOrder: [], undoStack: [], redoStack: [] })
  useViewerStore.setState({ currentPage: 1, totalPages: 1, activeTool: 'select', pageViewports: {}, pageScales: {} } as never)
  // Reset projectStore — reset both hiddenItemNames and the derived hiddenItemSet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ currentFilePath: null, isDirty: false, isSaving: false, isExporting: false, lastSavedAt: null, hiddenItemNames: [], hiddenItemSet: new Set<string>() })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('TotalsRow — lightbulb visibility toggle', () => {
  it('renders a Lightbulb icon (visible state) when item is not hidden', () => {
    const item = makeCountItem('Outlet')
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item)))

    // Look for lightbulb slot by title attribute (Hide from canvas = visible state)
    const lightbulb = container.querySelector('[title="Hide from canvas"]')
    expect(lightbulb).not.toBeNull()

    unmount()
  })

  it('renders LightbulbOff when item composite key is in hiddenItemNames', () => {
    // The composite key for an uncategorized "Outlet" item is "Outlet|"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Outlet|'], hiddenItemSet: new Set(['Outlet|']) })

    const item = makeCountItem('Outlet', null) // null categoryId → key "Outlet|"
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item)))

    // LightbulbOff state has title "Show on canvas"
    const lightbulbOff = container.querySelector('[title="Show on canvas"]')
    expect(lightbulbOff).not.toBeNull()

    unmount()
  })

  it('renders LightbulbOff when item with categoryId is hidden by composite key', () => {
    // A categorized item: name="Outlet", categoryId="cat-1" → key "Outlet|cat-1"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Outlet|cat-1'], hiddenItemSet: new Set(['Outlet|cat-1']) })

    const item = makeCountItem('Outlet', 'cat-1')
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item)))

    const lightbulbOff = container.querySelector('[title="Show on canvas"]')
    expect(lightbulbOff).not.toBeNull()

    unmount()
  })

  it('clicking lightbulb toggles hiddenItemNames with composite key AND does NOT call row onClick', () => {
    const onClickSpy = vi.fn()
    const item = makeCountItem('Outlet', null) // uncategorized → composite key "Outlet|"
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item, onClickSpy)))

    const lightbulb = container.querySelector('[title="Hide from canvas"]')
    expect(lightbulb).not.toBeNull()

    act(() => {
      lightbulb?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    // hiddenItemNames should now contain the composite key 'Outlet|' (not bare 'Outlet')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hidden = (useProjectStore.getState() as any).hiddenItemNames as string[]
    expect(hidden).toContain('Outlet|')

    // Row onClick must NOT have been called (e.stopPropagation on the lightbulb)
    expect(onClickSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('items with same name but different categoryId hide independently', () => {
    // "Outlet" uncategorized (key "Outlet|") and "Outlet" in cat-1 (key "Outlet|cat-1")
    // Hiding one must NOT hide the other.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Outlet|cat-1'], hiddenItemSet: new Set(['Outlet|cat-1']) })

    // Uncategorized "Outlet" — should NOT be hidden
    const itemUncat = makeCountItem('Outlet', null)
    const { container: c1, unmount: u1 } = mount(React.createElement(TotalsRow, makeRowProps(itemUncat)))
    const uncatLightbulb = c1.querySelector('[title="Hide from canvas"]')
    expect(uncatLightbulb).not.toBeNull() // should be visible (not hidden)
    u1()

    // Categorized "Outlet" in cat-1 — should BE hidden
    const itemCat = makeCountItem('Outlet', 'cat-1')
    const { container: c2, unmount: u2 } = mount(React.createElement(TotalsRow, makeRowProps(itemCat)))
    const catLightbulbOff = c2.querySelector('[title="Show on canvas"]')
    expect(catLightbulbOff).not.toBeNull() // should show as hidden
    u2()
  })
})
