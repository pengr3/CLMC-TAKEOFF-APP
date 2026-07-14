/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — ToolRail chain badge gate (SC-2).
 *
 * FAILS today because `@renderer/components/ToolRail` does not exist yet. Turns
 * GREEN when plan 18-07 renders the chain badge on the armed tool button.
 *
 * Contract (18-PATTERNS P3 / Pitfall 6): the chain-armed chip is gated on
 *   activeTool === tool && getChainArmedItem() !== null
 * and read at render time (re-renders are driven by activeTool changes). Here the
 * armed item is stubbed via the CanvasViewport mock; the badge must appear inside
 * the matching tool button only while that tool is active.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  // Chain-armed item is present → the badge should render on the armed tool.
  getChainArmedItem: () => ({ name: 'Concrete Slab', color: '#4f9cf0' }),
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

function countButton(): HTMLElement {
  const el = container.querySelector('[data-testid="rail-tool-count"]')
  if (!el) throw new Error('rail-tool-count not found')
  return el as HTMLElement
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
    activeTool: 'count',
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

describe('ToolRail — chain badge gate (SC-2)', () => {
  it('shows the chain-armed item name inside the armed tool button (activeTool===count)', () => {
    renderRail()
    expect(countButton().textContent).toContain('Concrete Slab')
  })

  it('hides the badge when a different tool is active (gate is activeTool===tool)', () => {
    renderRail()
    expect(countButton().textContent).toContain('Concrete Slab')

    // Switch away from count — the badge must disappear even though
    // getChainArmedItem() still returns an item.
    act(() => {
      useViewerStore.setState({ activeTool: 'select' })
    })
    expect(countButton().textContent).not.toContain('Concrete Slab')
    expect(container.textContent).not.toContain('Concrete Slab')
  })
})
