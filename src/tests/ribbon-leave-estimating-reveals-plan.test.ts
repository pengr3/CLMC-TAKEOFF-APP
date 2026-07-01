/** @vitest-environment jsdom */
/**
 * RibbonToolbar — leaving the Estimating tab reveals the Plan workspace
 * (Phase 16 UAT gap GAP-1).
 *
 * UAT symptom: on the Estimating tab with the Estimate sheet showing
 * (viewMode==='estimate'), clicking another ribbon tab (e.g. Home) changed the
 * tab but left the center area stuck on the Estimate grid — the Plan canvas was
 * never revealed. Root cause: `activeTab` is local ribbon useState while
 * `viewMode` lives in viewerStore, and nothing tied them together.
 *
 * Fix: a useEffect in RibbonToolbar watches `activeTab`; when it changes to any
 * tab OTHER than 'estimating' while viewMode==='estimate', it calls
 * setViewMode('plan'). This test drives the real RibbonToolbar against the REAL
 * viewerStore and asserts viewMode transitions to 'plan' on leaving Estimating,
 * and — critically — that the Plan|Estimate toggle still works WHILE on the
 * Estimating tab (the effect must no-op there).
 *
 * Konva is not exercised: RibbonToolbar only imports control-accessor functions
 * from CanvasViewport, so that module (which transitively pulls in react-konva)
 * is mocked, mirroring the sibling toolbar render tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// RibbonToolbar imports getCanvasControls / getCalibrationControls /
// getChainArmedItem / setChainArmedFromTotals from CanvasViewport, which
// transitively imports react-konva + Konva. Mock the module so the render test
// stays in pure jsdom (no WebGL/canvas stack), matching sibling toolbar tests.
vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  getChainArmedItem: () => null,
  setChainArmedFromTotals: vi.fn()
}))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok')
  })
}))

import { RibbonToolbar } from '@renderer/components/RibbonToolbar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderRibbon(): void {
  act(() => {
    root.render(
      React.createElement(RibbonToolbar, {
        onOpenClick: vi.fn(),
        onReplaceClick: vi.fn(),
        onExportClick: vi.fn()
      })
    )
  })
}

function clickTab(label: string): void {
  const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[]
  const tab = tabs.find((t) => t.textContent === label)
  if (!tab) throw new Error(`tab not found: ${label}`)
  act(() => {
    tab.click()
  })
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
    viewMode: 'plan'
  })
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

describe('RibbonToolbar — leaving Estimating reveals Plan (GAP-1)', () => {
  it('switching from Estimating (viewMode=estimate) to Home resets viewMode to plan', () => {
    renderRibbon()
    // Land on the Estimating tab and open the Estimate sheet via the toggle.
    clickTab('Estimating')
    const estimateToggle = container.querySelector(
      '[data-testid="view-mode-estimate"]'
    ) as HTMLButtonElement
    expect(estimateToggle).not.toBeNull()
    act(() => {
      estimateToggle.click()
    })
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    // Leaving Estimating for Home must reveal the Plan workspace.
    clickTab('Home')
    expect(useViewerStore.getState().viewMode).toBe('plan')
  })

  it('leaving Estimating for any non-Estimating tab (Tools) reveals Plan', () => {
    renderRibbon()
    // Seed the store directly into the estimate view while on Estimating.
    clickTab('Estimating')
    act(() => {
      useViewerStore.getState().setViewMode('estimate')
    })
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    clickTab('Tools')
    expect(useViewerStore.getState().viewMode).toBe('plan')
  })

  it('Plan|Estimate toggle still works while ON the Estimating tab (effect no-ops there)', () => {
    renderRibbon()
    clickTab('Estimating')

    const estimateToggle = container.querySelector(
      '[data-testid="view-mode-estimate"]'
    ) as HTMLButtonElement
    const planToggle = container.querySelector(
      '[data-testid="view-mode-plan"]'
    ) as HTMLButtonElement

    // Toggle to Estimate — must stick (we are still on the Estimating tab).
    act(() => {
      estimateToggle.click()
    })
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    // Toggle back to Plan explicitly — normal toggle behavior, unchanged.
    act(() => {
      planToggle.click()
    })
    expect(useViewerStore.getState().viewMode).toBe('plan')
  })

  it('returning to Estimating does NOT auto-restore Estimate (defaults to Plan)', () => {
    renderRibbon()
    clickTab('Estimating')
    act(() => {
      useViewerStore.getState().setViewMode('estimate')
    })
    clickTab('Home')
    expect(useViewerStore.getState().viewMode).toBe('plan')

    // Coming back to Estimating leaves us on Plan — the sheet is not auto-reopened.
    clickTab('Estimating')
    expect(useViewerStore.getState().viewMode).toBe('plan')
  })
})
