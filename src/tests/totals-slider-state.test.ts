/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// Exercise the real App, Splitter, TotalsPanel, toolbar, and shared UI store.
// Isolate only the PDF canvas and unrelated file/keyboard plumbing.
const { appRender } = vi.hoisted(() => ({ appRender: vi.fn() }))
vi.mock('@renderer/components/TitleBar', () => ({
  TitleBar: () => {
    appRender()
    return null
  }
}))
vi.mock('@renderer/components/CanvasViewport', () => ({
  CanvasViewport: () => null,
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  getChainArmedItem: () => null,
  setChainArmedFromTotals: vi.fn()
}))
vi.mock('@renderer/components/ContextBar', () => ({ ContextBar: () => null }))
vi.mock('@renderer/components/ToolRail', () => ({ ToolRail: () => null }))
vi.mock('@renderer/components/EstimatePanel', () => ({ EstimatePanel: () => null }))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({}),
  startRecoverySchedule: () => () => {}
}))
vi.mock('@renderer/hooks/useExport', () => ({ useExport: () => ({}) }))
vi.mock('@renderer/hooks/useCloseGuard', () => ({ useCloseGuard: () => {} }))
vi.mock('@renderer/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => {} }))
vi.mock('@renderer/lib/pdf-setup', () => ({}))

import App from '@renderer/App'
import { __resetUiPanelsForTests } from '@renderer/hooks/useUiPanels'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let container: HTMLDivElement
let root: Root
let writes: ReturnType<typeof vi.fn>

function mount(open = true, width = 320): void {
  window.localStorage.setItem(
    'clmc.ui',
    JSON.stringify({
      totals: { open, width },
      collapsedCategories: []
    })
  )
  writes.mockClear()
  __resetUiPanelsForTests()
  act(() => {
    root.render(React.createElement(App))
  })
}

function find(selector: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`Missing ${selector}`)
  return el
}

function click(label: string): void {
  act(() => {
    find(`[aria-label="${label}"]`).click()
  })
}

function pointer(type: string, x: number): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x })
  act(() => {
    if (type === 'pointerdown') find('[role="separator"]').dispatchEvent(event)
    else window.dispatchEvent(event)
  })
}

function stored(): { open: boolean; width: number } {
  return JSON.parse(window.localStorage.getItem('clmc.ui')!).totals
}

const toggle = 'Toggle Totals panel visibility'
const panel = '[data-testid="totals-panel"]'
const rail = '[data-testid="totals-panel-rail"]'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200)
  const values = new Map<string, string>()
  writes = vi.fn((key: string, value: string) => {
    values.set(key, value)
  })
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: writes
    }
  })
  useViewerStore.setState({ totalPages: 0, currentPage: 1, viewMode: 'plan' })
  useMarkupStore.setState({ pageMarkups: {}, categories: {}, categoryOrder: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  appRender.mockClear()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.restoreAllMocks()
})

describe('Totals slider open/closed state in the real App shell', () => {
  it('dragging after toolbar collapse reveals content immediately and starts at the visible rail width', () => {
    mount()
    click(toggle)
    expect(find(rail).style.width).toBe('28px')
    writes.mockClear()
    pointer('pointerdown', 1000)
    pointer('pointermove', 900)
    expect(find(panel).textContent).toContain('Open a PDF to begin.')
    expect(find(panel).style.width).toBe('128px')
    expect(writes).not.toHaveBeenCalled()
    pointer('pointerup', 900)
    expect(stored()).toEqual({ open: true, width: 128 })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(find(`[aria-label="${toggle}"]`).getAttribute('aria-pressed')).toBe('true')
  })

  it('minimum drag uses the same rail as chevron collapse and remembers the expanded width', () => {
    mount(true, 420)
    click('Collapse Totals')
    const expectedRail = find(rail).outerHTML
    click('Expand Totals')
    writes.mockClear()
    pointer('pointerdown', 600)
    pointer('pointermove', 1200)
    expect(find(rail).style.width).toBe('28px')
    expect(container.querySelector(panel)).toBeNull()
    pointer('pointerup', 1200)
    expect(find(rail).outerHTML).toBe(expectedRail)
    expect(stored()).toEqual({ open: false, width: 420 })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(find(`[aria-label="${toggle}"]`).getAttribute('aria-pressed')).toBe('false')
    click(toggle)
    expect(find(panel).style.width).toBe('420px')
  })

  it('regular resizing keeps App renders flat during moves and writes once on release', () => {
    mount()
    pointer('pointerdown', 600)
    const renders = appRender.mock.calls.length
    pointer('pointermove', 560)
    pointer('pointermove', 500)
    pointer('pointermove', 440)
    expect(appRender).toHaveBeenCalledTimes(renders)
    expect(find(panel).style.width).toBe('480px')
    expect(find(panel).style.transition).toBe('none')
    expect(writes).not.toHaveBeenCalled()
    pointer('pointerup', 440)
    expect(stored()).toEqual({ open: true, width: 480 })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(find(panel).style.transition).toBe('width 150ms ease-out')
  })

  it('can cross the collapsed boundary both ways in a single drag and reopen after chevron collapse', () => {
    mount()
    click('Collapse Totals')
    writes.mockClear()
    pointer('pointerdown', 1000)
    pointer('pointermove', 800)
    expect(find(panel).style.width).toBe('228px')
    pointer('pointermove', 1100)
    expect(find(rail).style.width).toBe('28px')
    pointer('pointermove', 700)
    expect(find(panel).style.width).toBe('328px')
    pointer('pointerup', 700)
    expect(stored()).toEqual({ open: true, width: 328 })
    expect(writes).toHaveBeenCalledTimes(1)
  })

  it('a click without dragging leaves a collapsed panel closed with its previous expanded width', () => {
    mount(false, 420)
    pointer('pointerdown', 1000)
    pointer('pointerup', 1000)
    expect(find(rail).style.width).toBe('28px')
    expect(stored()).toEqual({ open: false, width: 420 })
    click('Expand Totals')
    expect(find(panel).style.width).toBe('420px')
  })

  it('repairs the old persisted open-at-minimum-width state on startup', () => {
    mount(true, 28)
    expect(find(rail).style.width).toBe('28px')
    click(toggle)
    expect(find(panel).style.width).toBe('320px')
  })
})
