/** @vitest-environment jsdom */
/**
 * ToolRail — rail declutter: the armed-item NAME is NOT shown on tool buttons.
 *
 * The rail used to render a chain badge (color swatch + armed item name) on the
 * active tool button. That duplicated the ContextBar header ("PLACING · Count ·
 * Pin Lights"), so the badge was removed. This test locks in the new contract:
 * even when an item IS armed (stubbed via the CanvasViewport mock's
 * getChainArmedItem), the rail surfaces only the tool's own label ("Count", …)
 * and never the armed item's name — regardless of which tool is active.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  // An item IS armed — the rail must STILL not surface its name (declutter).
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

describe('ToolRail — armed item name is not shown on the rail (declutter)', () => {
  it('does NOT render the armed item name on the active tool button (label only)', () => {
    renderRail()
    // The tool's own label stays visible…
    expect(countButton().textContent).toContain('Count')
    // …but the armed item's name is never surfaced on the rail, even though
    // getChainArmedItem() returns an armed item.
    expect(countButton().textContent).not.toContain('Concrete Slab')
    expect(container.textContent).not.toContain('Concrete Slab')
  })

  it('keeps the armed name off the rail regardless of which tool is active', () => {
    renderRail()
    expect(container.textContent).not.toContain('Concrete Slab')

    // Switch away from count — still no armed-item name anywhere on the rail.
    act(() => {
      useViewerStore.setState({ activeTool: 'select' })
    })
    expect(countButton().textContent).not.toContain('Concrete Slab')
    expect(container.textContent).not.toContain('Concrete Slab')
  })
})
