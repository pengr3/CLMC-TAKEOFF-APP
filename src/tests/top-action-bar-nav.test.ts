/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — TopActionBar page / zoom / totals nav (SC-5).
 *
 * FAILS today because `@renderer/components/TopActionBar` does not exist yet — the
 * import cannot be resolved. Turns GREEN when plan 18-05 lands the center
 * page/zoom group + the right-group Totals toggle (bodies lifted verbatim from
 * RibbonToolbar — D-08 behavior parity).
 *
 * Contract pinned here (18-02 testid_contract):
 *   Page prev aria-label="Previous page" (disabled currentPage===1),
 *   Page next aria-label="Next page"     (disabled currentPage===totalPages),
 *   readout "Page {n} of {m}" aria-live="polite"
 *   Zoom out aria-label="Zoom out" (disabled totalPages===0 || zoom<=MIN_ZOOM),
 *   Zoom in  aria-label="Zoom in"  (disabled totalPages===0 || zoom>=MAX_ZOOM),
 *   Fit      aria-label="Fit"; all dispatch getCanvasControls().zoomOut/zoomIn/fitToWindow
 *   Totals toggle: aria-pressed reflects totals.open; click → setTotalsOpen(!open)
 *
 * Konva isolation: mock CanvasViewport so getCanvasControls returns stable vi.fn
 * spies the test can assert against.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => {
  // Stable controls object so the same spies the component calls are the ones the
  // test asserts against.
  const canvasControls = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToWindow: vi.fn()
  }
  return {
    getCanvasControls: () => canvasControls,
    getCalibrationControls: () => null,
    getChainArmedItem: () => null,
    setChainArmedFromTotals: vi.fn()
  }
})
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok')
  })
}))

import { TopActionBar } from '@renderer/components/TopActionBar'
import { getCanvasControls } from '@renderer/components/CanvasViewport'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { MIN_ZOOM, MAX_ZOOM } from '@renderer/lib/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderBar(): void {
  act(() => {
    root.render(
      React.createElement(TopActionBar, {
        onOpenClick: vi.fn(),
        onReplaceClick: vi.fn(),
        onExportClick: vi.fn()
      })
    )
  })
}

function byLabel(label: string): HTMLButtonElement {
  const el = container.querySelector(`[aria-label="${label}"], [title="${label}"]`)
  if (!el) throw new Error(`button not found: ${label}`)
  return el as HTMLButtonElement
}

// Totals keeps its verbatim RibbonToolbar title while its visible label flips
// Show/Hide — so the title/aria-label is the stable handle.
function totalsToggle(): HTMLButtonElement {
  const el = container.querySelector(
    '[aria-label="Toggle Totals panel visibility"], [title="Toggle Totals panel visibility"]'
  )
  if (!el) throw new Error('totals toggle not found')
  return el as HTMLButtonElement
}

beforeEach(() => {
  vi.clearAllMocks()
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
    viewMode: 'plan'
  })
  useScaleStore.getState().reset()
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('TopActionBar — page / zoom / totals nav (SC-5)', () => {
  it('at page 1 of 3: Previous disabled, Next enabled; clicking Next advances currentPage to 2', () => {
    renderBar()
    expect(byLabel('Previous page').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Next page').getAttribute('aria-disabled')).toBe('false')

    act(() => {
      byLabel('Next page').click()
    })
    expect(useViewerStore.getState().currentPage).toBe(2)
  })

  it('at the last page (3 of 3) Next is disabled', () => {
    useViewerStore.setState({ currentPage: 3 })
    renderBar()
    expect(byLabel('Next page').getAttribute('aria-disabled')).toBe('true')
  })

  it('the page readout shows "Page 1 of 3" with aria-live="polite"', () => {
    renderBar()
    const readout = container.querySelector('[aria-live="polite"]')
    expect(readout).not.toBeNull()
    expect(readout!.textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 1 of 3')
  })

  it('Zoom in / Zoom out / Fit each dispatch through getCanvasControls()', () => {
    // Seeded zoom is DEFAULT (1) → between MIN and MAX, so both zoom buttons enabled.
    renderBar()
    act(() => byLabel('Zoom in').click())
    act(() => byLabel('Zoom out').click())
    act(() => byLabel('Fit').click())

    const controls = getCanvasControls()!
    expect(controls.zoomIn).toHaveBeenCalledTimes(1)
    expect(controls.zoomOut).toHaveBeenCalledTimes(1)
    expect(controls.fitToWindow).toHaveBeenCalledTimes(1)
  })

  it('Zoom in disabled at MAX_ZOOM; Zoom out disabled at MIN_ZOOM; both disabled with no PDF', () => {
    // At MAX_ZOOM → zoom-in disabled, zoom-out still enabled.
    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: MAX_ZOOM, panX: 0, panY: 0 })
    })
    renderBar()
    expect(byLabel('Zoom in').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Zoom out').getAttribute('aria-disabled')).toBe('false')

    // At MIN_ZOOM → zoom-out disabled, zoom-in still enabled.
    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: MIN_ZOOM, panX: 0, panY: 0 })
    })
    renderBar()
    expect(byLabel('Zoom out').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Zoom in').getAttribute('aria-disabled')).toBe('false')

    // No PDF → both zoom buttons disabled (totalPages===0 guard).
    useViewerStore.setState({ totalPages: 0 })
    renderBar()
    expect(byLabel('Zoom in').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Zoom out').getAttribute('aria-disabled')).toBe('true')
  })

  it('Totals toggle: aria-pressed reflects totals.open and clicking flips it (setTotalsOpen negation)', () => {
    // useUiPanels defaults totals.open = true (localStorage cleared in beforeEach).
    renderBar()
    expect(totalsToggle().getAttribute('aria-pressed')).toBe('true')

    act(() => {
      totalsToggle().click()
    })
    // Clicking dispatched setTotalsOpen(!true) → false; aria-pressed follows.
    expect(totalsToggle().getAttribute('aria-pressed')).toBe('false')
  })
})
