/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — ToolRail Snap toggle (SC-3).
 *
 * FAILS today because `@renderer/components/ToolRail` does not exist yet. Turns
 * GREEN when plan 18-07 renders the rail Snap toggle.
 *
 * Contract (18-PATTERNS S-6): the Snap toggle reads viewerStore.snapEnabled and,
 * on click, calls setSnapEnabled(!snapEnabled) — the SAME field F3 mutates. This
 * test proves both directions: the toggle drives the store, and an external
 * change to snapEnabled (the F3 path) flips the toggle's aria-pressed. That
 * shared-field guarantee is why the rail toggle and F3 stay in sync for free.
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

function snapToggle(): HTMLButtonElement {
  const el = container.querySelector('[data-testid="rail-snap-toggle"]')
  if (!el) throw new Error('rail-snap-toggle not found')
  return el as HTMLButtonElement
}

beforeEach(() => {
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

describe('ToolRail — Snap toggle (SC-3)', () => {
  it('aria-pressed reflects snapEnabled (true by seed)', () => {
    renderRail()
    expect(snapToggle().getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking the toggle calls setSnapEnabled(false) so snapEnabled becomes false', () => {
    renderRail()
    act(() => snapToggle().click())
    expect(useViewerStore.getState().snapEnabled).toBe(false)
    expect(snapToggle().getAttribute('aria-pressed')).toBe('false')
  })

  it('an external snapEnabled change (the F3 path) flips aria-pressed — shared field', () => {
    renderRail()
    expect(snapToggle().getAttribute('aria-pressed')).toBe('true')

    // F3 mutates viewerStore.snapEnabled directly; the rail toggle reads the same
    // field, so its on-state must follow with no click on the toggle itself.
    act(() => {
      useViewerStore.setState({ snapEnabled: false })
    })
    expect(snapToggle().getAttribute('aria-pressed')).toBe('false')
  })
})
