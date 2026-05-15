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

function makeCountItem(name: string): BoqItemRow {
  return { label: name, quantity: 3, uom: 'ea', color: '#0078d4', type: 'count' }
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
  // Reset projectStore. hiddenItemNames does not yet exist; cast suppresses compile error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ currentFilePath: null, isDirty: false, isSaving: false, isExporting: false, lastSavedAt: null, hiddenItemNames: [] })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('TotalsRow — lightbulb visibility toggle', () => {
  it('renders a Lightbulb icon (visible state) when item is not hidden', () => {
    // MUST FAIL — lightbulb slot does not yet exist on TotalsRow
    const item = makeCountItem('Outlet')
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item)))

    // Look for lightbulb slot by title attribute (Hide from canvas = visible state)
    const lightbulb = container.querySelector('[title="Hide from canvas"]')
    expect(lightbulb).not.toBeNull()

    unmount()
  })

  it('renders LightbulbOff when item name is in hiddenItemNames', () => {
    // MUST FAIL — lightbulb slot does not yet exist on TotalsRow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Outlet'] })

    const item = makeCountItem('Outlet')
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item)))

    // LightbulbOff state has title "Show on canvas"
    const lightbulbOff = container.querySelector('[title="Show on canvas"]')
    expect(lightbulbOff).not.toBeNull()

    unmount()
  })

  it('clicking lightbulb toggles hiddenItemNames AND does NOT call row onClick', () => {
    // MUST FAIL — lightbulb slot does not yet exist on TotalsRow (Pitfall 9: e.stopPropagation)
    const onClickSpy = vi.fn()
    const item = makeCountItem('Outlet')
    const { container, unmount } = mount(React.createElement(TotalsRow, makeRowProps(item, onClickSpy)))

    const lightbulb = container.querySelector('[title="Hide from canvas"]')
    expect(lightbulb).not.toBeNull()

    act(() => {
      lightbulb?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    // hiddenItemNames should now contain 'Outlet'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hidden = (useProjectStore.getState() as any).hiddenItemNames as string[]
    expect(hidden).toContain('Outlet')

    // Row onClick must NOT have been called (e.stopPropagation on the lightbulb)
    expect(onClickSpy).not.toHaveBeenCalled()

    unmount()
  })
})
