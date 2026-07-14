/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — left ToolRail tool buttons + Set Scale (SC-1 / SC-2).
 *
 * FAILS today because `@renderer/components/ToolRail` does not exist yet — the
 * import cannot be resolved. It turns GREEN when plan 18-07 lands the ToolRail
 * that re-homes RibbonToolbar's renderToolsTab handlers verbatim.
 *
 * Contract pinned here (from 18-01-PLAN testid_contract):
 *   - container   data-testid="tool-rail"
 *   - tool buttons data-testid="rail-tool-{select|count|linear|area|perimeter|wall|scale}"
 *   - active tool  aria-pressed="true"
 *   - markup tools aria-disabled="true" when totalPages===0 (setScaleDisabled)
 *   - NO element with role="tab" anywhere (SC-1: the 7-tab ribbon is gone)
 *   - Set Scale click → getCalibrationControls().activate() (not calibrating)
 *   - right-click Set Scale (page calibrated) → ScaleContextMenu (role="menu")
 *   - disarm-on-retap (P2): re-tapping the armed tool → select + setChainArmedFromTotals(null)
 *
 * Konva isolation: ToolRail imports the CanvasViewport module control refs, which
 * transitively pull in react-konva. Mock the module so the render stays in pure
 * jsdom, mirroring ribbon-leave-estimating-reveals-plan.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => {
  // Stable calibration-controls object so the same spies the component calls are
  // the ones the test asserts against.
  const calibrationControls = {
    activate: vi.fn(),
    cancel: vi.fn(),
    activateVerify: vi.fn()
  }
  return {
    getCanvasControls: () => null,
    getCalibrationControls: () => calibrationControls,
    getChainArmedItem: () => null,
    setChainArmedFromTotals: vi.fn()
  }
})

import { ToolRail } from '@renderer/components/ToolRail'
import { getCalibrationControls, setChainArmedFromTotals } from '@renderer/components/CanvasViewport'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { DEFAULT_UNIT } from '@renderer/types/scale'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderRail(): void {
  act(() => {
    root.render(React.createElement(ToolRail))
  })
}

function tool(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="rail-tool-${name}"]`)
  if (!el) throw new Error(`rail tool not found: ${name}`)
  return el as HTMLButtonElement
}

beforeEach(() => {
  vi.clearAllMocks()
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
    snapEnabled: true,
    snapSuspended: false
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

describe('ToolRail — tools + Set Scale (SC-1 / SC-2)', () => {
  it('renders data-testid="tool-rail" with all 7 tool buttons and NO role="tab" (SC-1)', () => {
    renderRail()
    expect(container.querySelector('[data-testid="tool-rail"]')).not.toBeNull()
    for (const t of ['select', 'count', 'linear', 'area', 'perimeter', 'wall', 'scale']) {
      expect(container.querySelector(`[data-testid="rail-tool-${t}"]`)).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-testid^="rail-tool-"]').length).toBe(7)
    // SC-1: the tab strip is gone — no tablist survives anywhere in the rail.
    expect(container.querySelector('[role="tab"]')).toBeNull()
  })

  it('the active tool carries aria-pressed="true" (Select active by default)', () => {
    renderRail()
    expect(tool('select').getAttribute('aria-pressed')).toBe('true')
    expect(tool('count').getAttribute('aria-pressed')).toBe('false')

    act(() => tool('count').click())
    expect(tool('count').getAttribute('aria-pressed')).toBe('true')
    expect(tool('select').getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking Count arms the count tool (activeTool → count)', () => {
    renderRail()
    act(() => tool('count').click())
    expect(useViewerStore.getState().activeTool).toBe('count')
  })

  it('re-tapping the armed tool disarms to select AND calls setChainArmedFromTotals(null) (P2)', () => {
    renderRail()
    act(() => tool('count').click())
    expect(useViewerStore.getState().activeTool).toBe('count')

    act(() => tool('count').click())
    expect(useViewerStore.getState().activeTool).toBe('select')
    expect(setChainArmedFromTotals).toHaveBeenCalledWith(null)
  })

  it('with no PDF (totalPages:0) the markup tools carry aria-disabled="true"; Select stays enabled', () => {
    useViewerStore.setState({ totalPages: 0, activeTool: 'select' })
    renderRail()
    for (const t of ['count', 'linear', 'area', 'perimeter', 'wall']) {
      expect(tool(t).getAttribute('aria-disabled')).toBe('true')
    }
    expect(tool('select').getAttribute('aria-disabled')).not.toBe('true')
  })

  it('clicking Set Scale while not calibrating calls getCalibrationControls().activate()', () => {
    renderRail()
    act(() => tool('scale').click())
    expect(getCalibrationControls()!.activate).toHaveBeenCalledTimes(1)
  })

  it('right-clicking Set Scale (page calibrated) opens the ScaleContextMenu (role="menu")', () => {
    // The scale-actions menu is gated on pageScale !== null.
    useScaleStore.getState().setScale(1, 2, DEFAULT_UNIT)
    renderRail()
    expect(container.querySelector('[role="menu"]')).toBeNull()

    act(() => {
      tool('scale').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
  })
})
