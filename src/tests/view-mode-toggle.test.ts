/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — standalone Plan|Estimate toggle, NO auto-reset (SC-5, R-1).
 *
 * FAILS today because `@renderer/components/TopActionBar` does not exist yet — the
 * import cannot be resolved. Turns GREEN when plan 18-05 renders the right-group
 * Plan|Estimate segmented control WITHOUT the Phase-16 tab-leave reset useEffect
 * (R-1: RibbonToolbar.tsx:170-174 is intentionally DELETED — with the tabs gone
 * there is no "leaving a tab" event, so the standalone toggle is self-consistent).
 *
 * REPLACES ribbon-leave-estimating-reveals-plan.test.ts (deleted in this plan's
 * Task 3): its premise — leaving the Estimating TAB resets viewMode→'plan' — is
 * void once the 7-tab ribbon is removed.
 *
 * Contract pinned here (18-02 testid_contract):
 *   role="radiogroup" data-testid="view-mode-toggle"
 *   radios role="radio" data-testid="view-mode-plan" / "view-mode-estimate"
 *   click → setViewMode(mode); NO reset side effect on re-render.
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
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok')
  })
}))

import { TopActionBar } from '@renderer/components/TopActionBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

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

function radio(mode: 'plan' | 'estimate'): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="view-mode-${mode}"]`)
  if (!el) throw new Error(`view-mode radio not found: ${mode}`)
  return el as HTMLButtonElement
}

beforeEach(() => {
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

describe('TopActionBar — standalone Plan|Estimate toggle (SC-5, R-1)', () => {
  it('renders a role="radiogroup" with Plan and Estimate role="radio" buttons (testids preserved)', () => {
    renderBar()
    const group = container.querySelector('[data-testid="view-mode-toggle"]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('role')).toBe('radiogroup')

    expect(radio('plan').getAttribute('role')).toBe('radio')
    expect(radio('estimate').getAttribute('role')).toBe('radio')
  })

  it('clicking Estimate sets viewMode to estimate; clicking Plan sets it back (both directions)', () => {
    renderBar()
    act(() => radio('estimate').click())
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    act(() => radio('plan').click())
    expect(useViewerStore.getState().viewMode).toBe('plan')
  })

  it('NO auto-reset: after selecting Estimate a re-render does NOT revert viewMode to plan (R-1)', () => {
    renderBar()
    act(() => radio('estimate').click())
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    // The standalone toggle has no tab-leave trigger. Re-rendering the bar — which
    // would re-run any ported reset useEffect if one still existed — must leave
    // viewMode on 'estimate'. This is the crux of R-1 (deleted RibbonToolbar reset).
    renderBar()
    expect(useViewerStore.getState().viewMode).toBe('estimate')

    // An unrelated store change + re-render likewise must not reset it.
    act(() => {
      useViewerStore.setState({ currentPage: 2 })
    })
    renderBar()
    expect(useViewerStore.getState().viewMode).toBe('estimate')
  })

  it('aria-checked reflects the active mode and flips on toggle', () => {
    renderBar()
    // Seeded viewMode:'plan'.
    expect(radio('plan').getAttribute('aria-checked')).toBe('true')
    expect(radio('estimate').getAttribute('aria-checked')).toBe('false')

    act(() => radio('estimate').click())
    expect(radio('plan').getAttribute('aria-checked')).toBe('false')
    expect(radio('estimate').getAttribute('aria-checked')).toBe('true')
  })
})
