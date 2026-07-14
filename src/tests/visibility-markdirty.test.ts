/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — Show All / Hide All both call markDirty() (SC-6, Pitfall 7).
 *
 * FAILS today because `@renderer/components/TopActionBar` does not exist yet — the
 * import cannot be resolved. Turns GREEN when plan 18-05 re-homes handleShowAll /
 * handleHideAll VERBATIM (RibbonToolbar.tsx:242-258): setHiddenItemNames does NOT
 * markDirty internally (it is built for hydration), so BOTH handlers MUST call
 * markDirty() explicitly or Save silently drops the visibility change.
 *
 * Show/Hide All live on the TopActionBar right group (Q1 home = adjacent to Totals).
 *
 * Contract pinned here (18-02 testid_contract):
 *   Show All aria-label="Show All markups" (disabled = totalPages===0)
 *   Hide All aria-label="Hide All markups" (disabled = totalPages===0 || !hasMarkups)
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

function byLabel(label: string): HTMLButtonElement {
  const el = container.querySelector(`[aria-label="${label}"], [title="${label}"]`)
  if (!el) throw new Error(`button not found: ${label}`)
  return el as HTMLButtonElement
}

// Seed one count markup so hasMarkups === true (Hide All enabled). Key = "X|c1".
function placeOneCount(): void {
  useMarkupStore.setState({
    pageMarkups: {
      1: [
        {
          id: 'm1',
          type: 'count',
          page: 1,
          name: 'X',
          categoryId: 'c1',
          color: '#0078d4',
          createdAt: 0,
          point: { x: 0, y: 0 },
          sequence: 1
        }
      ]
    }
  })
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
  placeOneCount()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('TopActionBar — Show All / Hide All markDirty (SC-6, Pitfall 7)', () => {
  it('Show All clears hidden items AND calls markDirty()', () => {
    renderBar()
    // Pre-hide something so the clear is observable.
    act(() => {
      useProjectStore.getState().setHiddenItemNames(['X|c1'])
    })
    const markDirty = vi.spyOn(useProjectStore.getState(), 'markDirty')

    act(() => byLabel('Show All markups').click())

    expect(useProjectStore.getState().hiddenItemNames).toEqual([])
    expect(markDirty).toHaveBeenCalled()
  })

  it('Hide All hides every markup key (name|categoryId) AND calls markDirty()', () => {
    renderBar()
    const markDirty = vi.spyOn(useProjectStore.getState(), 'markDirty')

    act(() => byLabel('Hide All markups').click())

    expect(useProjectStore.getState().hiddenItemNames).toContain('X|c1')
    expect(markDirty).toHaveBeenCalled()
  })

  it('Hide All is disabled when there are no markups (hasMarkups:false)', () => {
    useMarkupStore.getState().reset() // no markups
    renderBar()
    expect(byLabel('Hide All markups').getAttribute('aria-disabled')).toBe('true')
    // Show All is only gated on totalPages, so it stays enabled here.
    expect(byLabel('Show All markups').getAttribute('aria-disabled')).toBe('false')
  })

  it('both Show All and Hide All are disabled with no PDF (totalPages===0 guard)', () => {
    useViewerStore.setState({ totalPages: 0 })
    renderBar()
    expect(byLabel('Show All markups').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Hide All markups').getAttribute('aria-disabled')).toBe('true')
  })
})
