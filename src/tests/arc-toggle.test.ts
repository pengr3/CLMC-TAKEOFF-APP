/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — ToolRail Arc toggle via the REAL reactive seam (SC-3).
 *
 * FAILS today for TWO reasons: `@renderer/components/ToolRail` does not exist,
 * and `@renderer/lib/markup-arc-ref` does not yet export getArcSticky /
 * setArcStickyState / subscribeArcSticky. Turns GREEN when 18-04 adds the
 * reactive seam AND 18-07 renders the Arc toggle consuming it via
 * useSyncExternalStore(subscribeArcSticky, getArcSticky).
 *
 * WHY this test uses the REAL markup-arc-ref (only CanvasViewport is mocked):
 * it must exercise genuine reactivity. Shift+A flips arc mode with NO coincident
 * store change and NO click on the toggle. A non-reactive implementation (a bare
 * getArcSticky() read at render, like getChainArmedItem) would leave the toggle
 * stale after Shift+A. So the reactivity assertion below calls setArcStickyState
 * externally (the Shift+A-equivalent publish) with NO manual re-render and NO
 * unrelated interaction, and requires aria-pressed to update. A mock-and-manual-
 * re-render would hide exactly the stale-chrome regression this pins down.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  getChainArmedItem: () => null,
  setChainArmedFromTotals: vi.fn()
}))

import { ToolRail } from '@renderer/components/ToolRail'
import {
  getArcStickyToggleHandler,
  setArcStickyToggleHandler,
  getArcSticky,
  setArcStickyState
} from '@renderer/lib/markup-arc-ref'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderRail(): void {
  act(() => {
    root.render(React.createElement(ToolRail))
  })
}

function arcToggle(): HTMLButtonElement {
  const el = container.querySelector('[data-testid="rail-arc-toggle"]')
  if (!el) throw new Error('rail-arc-toggle not found')
  return el as HTMLButtonElement
}

beforeEach(() => {
  // Start from a known Arc-off snapshot on the real seam.
  if (typeof setArcStickyState === 'function') setArcStickyState(false)
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
  // Reset the real seam + the registered toggle handler so tests stay isolated.
  if (typeof setArcStickyState === 'function') setArcStickyState(false)
  setArcStickyToggleHandler(null)
})

describe('ToolRail — Arc toggle via the real reactive seam (SC-3)', () => {
  it('clicking the Arc toggle invokes the registered getArcStickyToggleHandler', () => {
    // This is the exact registration path CanvasViewport uses at mount.
    const toggleSpy = vi.fn()
    setArcStickyToggleHandler(toggleSpy)
    expect(getArcStickyToggleHandler()).toBe(toggleSpy)

    renderRail()
    act(() => arcToggle().click())
    expect(toggleSpy).toHaveBeenCalledTimes(1)
  })

  it('a Shift+A-equivalent setArcStickyState flips aria-pressed with NO click / NO manual re-render', () => {
    setArcStickyToggleHandler(vi.fn())
    renderRail()
    // Arc off at start.
    expect(arcToggle().getAttribute('aria-pressed')).toBe('false')

    // Simulate the Shift+A publish: external seam write, no interaction with the
    // toggle and no re-render call. Because the toggle reads the seam through
    // useSyncExternalStore(subscribeArcSticky, getArcSticky), this alone must
    // re-render the toggle to its on-state.
    act(() => {
      setArcStickyState(true)
    })
    expect(getArcSticky()).toBe(true)
    expect(arcToggle().getAttribute('aria-pressed')).toBe('true')

    // And back off — again with no toggle interaction.
    act(() => {
      setArcStickyState(false)
    })
    expect(arcToggle().getAttribute('aria-pressed')).toBe('false')
  })
})
