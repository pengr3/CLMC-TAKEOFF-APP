/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — consolidated status line, folded calibration nudge (SC-5).
 *
 * Imports the REAL StatusBar (`@renderer/components/StatusBar`) — the component 18-06
 * upgrades IN PLACE into the single consolidated status line. This file is RED TODAY
 * *not* via a missing module (StatusBar exists) but via a missing BEHAVIOR: StatusBar
 * has no folded scale-nudge branch and does not yet read per-page markups, so the
 * branch-c assertion below queries a `[data-testid="status-set-scale-link"]` that does
 * not exist yet. It turns GREEN when 18-06 folds CanvasHeaderBar.tsx:53-80's 3-branch
 * scale segment (incl. the "Page not calibrated → Set Scale" nudge) into StatusBar's
 * Scale slot, reusing getCalibrationControls()?.activate() (Pitfall 5 — do NOT
 * duplicate the trigger).
 *
 * Migrated from canvas-header-bar.test.ts:206-254 (the nudge → activate() assertions).
 * canvas-header-bar.test.ts STAYS in place until 18-09 deletes CanvasHeaderBar.
 *
 * A `vi.hoisted` calibration-controls object is shared with the CanvasViewport mock so
 * the SAME activate() spy the nudge calls is the one asserted here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

const calib = vi.hoisted(() => ({
  controls: { activate: vi.fn(), cancel: vi.fn(), activateVerify: vi.fn() }
}))

// StatusBar does not import CanvasViewport today; 18-06 wires getCalibrationControls
// in when it folds the nudge. The mock is forward-compatible + keeps react-konva out.
vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => calib.controls,
  getChainArmedItem: () => null,
  setChainArmedFromTotals: vi.fn()
}))

import { StatusBar } from '@renderer/components/StatusBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup, LinearMarkup } from '@renderer/types/markup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderStatus(): void {
  act(() => {
    root.render(React.createElement(StatusBar))
  })
}

function makeCount(page: number, id = 'c1', name = 'Outlet'): CountMarkup {
  return {
    id,
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color: '#0078d4',
    sequence: 1,
    point: { x: 10, y: 20 },
    createdAt: Date.now()
  }
}

function makeLinear(page: number, id = 'l1', name = 'Wall'): LinearMarkup {
  return {
    id,
    type: 'linear',
    page,
    name,
    categoryId: 'cat-1',
    color: '#d13438',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    createdAt: Date.now()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  useViewerStore.setState({
    filePath: 'C:/x.pdf',
    fileName: 'x.pdf',
    currentPage: 1,
    totalPages: 3,
    pageViewports: {},
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select',
    viewMode: 'plan',
    selectedMarkupIds: [],
    snapEnabled: true,
    snapSuspended: false
  })
  useScaleStore.getState().reset()
  useMarkupStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Consolidated status line — page + scale + folded nudge (SC-5)', () => {
  it('carries BOTH page and scale on one line: "Page 1 of 3" + the calibrated ratio', () => {
    // 1:100 drawing scale → pixelsPerMm = 1/100 → formatScaleRatio "1:100".
    useScaleStore.getState().setScale(1, 1 / 100, 'm')
    renderStatus()
    expect(container.textContent).toContain('Page 1 of 3')
    expect(container.textContent).toContain('1:100')
  })

  it('branch-c: uncalibrated page + a non-count markup renders the Set Scale nudge link that calls getCalibrationControls().activate()', () => {
    // Linear markup on an uncalibrated page → the folded nudge branch (c).
    useMarkupStore.setState({ pageMarkups: { 1: [makeLinear(1)] }, categories: {}, categoryOrder: [] })
    renderStatus()
    const link = container.querySelector('[data-testid="status-set-scale-link"]') as HTMLElement | null
    // RED today: StatusBar has no nudge branch, so this element does not exist yet.
    expect(link).not.toBeNull()
    act(() => link!.click())
    expect(calib.controls.activate).toHaveBeenCalledTimes(1)
    expect(calib.controls.cancel).not.toHaveBeenCalled()
    expect(calib.controls.activateVerify).not.toHaveBeenCalled()
  })

  it('branch-b: uncalibrated page + only count markups shows "Not Set" and NO nudge link', () => {
    useMarkupStore.setState({ pageMarkups: { 1: [makeCount(1)] }, categories: {}, categoryOrder: [] })
    renderStatus()
    expect(container.textContent).toContain('Not Set')
    expect(container.querySelector('[data-testid="status-set-scale-link"]')).toBeNull()
  })

  it('the snap indicator reflects snapEnabled (reflect-only — the pill is retired as a control)', () => {
    useViewerStore.setState({ snapEnabled: true, snapSuspended: false })
    renderStatus()
    expect(container.textContent).toContain('Snap:')
    expect(container.textContent).toContain('ON')

    act(() => {
      useViewerStore.setState({ snapEnabled: false })
    })
    renderStatus()
    expect(container.textContent).toContain('OFF')
  })
})
