/** @vitest-environment jsdom */
/**
 * RED (quick-260820-plx) — Show All / Hide All are STATE INDICATORS, not just
 * actions.
 *
 * FAILS today because TopActionBar renders the Eye / EyeOff BarButtons with no
 * `active` prop, so BarButton always paints them transparent with
 * aria-pressed="false" regardless of what is actually hidden.
 *
 * Turns GREEN when the two buttons derive `active` reactively from
 * projectStore.hiddenItemNames vs every markup key (`${name}|${categoryId}` —
 * the VISIBILITY key, Pitfall 1, deliberately NOT the `${name}|${type}` rate
 * key used by pricing):
 *   Show All lit  ⟺ nothing is hidden
 *   Hide All lit  ⟺ there is at least one markup AND every key is hidden
 *   partial state ⟹ NEITHER lit
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

function showAllPressed(): string | null {
  return byLabel('Show All markups').getAttribute('aria-pressed')
}

function hideAllPressed(): string | null {
  return byLabel('Hide All markups').getAttribute('aria-pressed')
}

// Two count markups so a PARTIAL hidden state exists. Keys = "A|c1", "B|c1".
function placeTwoCounts(): void {
  useMarkupStore.setState({
    pageMarkups: {
      1: [
        {
          id: 'm1',
          type: 'count',
          page: 1,
          name: 'A',
          categoryId: 'c1',
          color: '#0078d4',
          createdAt: 0,
          point: { x: 0, y: 0 },
          sequence: 1
        },
        {
          id: 'm2',
          type: 'count',
          page: 1,
          name: 'B',
          categoryId: 'c1',
          color: '#0078d4',
          createdAt: 1,
          point: { x: 10, y: 10 },
          sequence: 2
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
  placeTwoCounts()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('TopActionBar — Show All / Hide All highlight (quick-260820-plx)', () => {
  it('nothing hidden → Show All lit, Hide All dark', () => {
    renderBar()
    expect(useProjectStore.getState().hiddenItemNames).toEqual([])
    expect(showAllPressed()).toBe('true')
    expect(hideAllPressed()).toBe('false')
  })

  it('every key hidden → Hide All lit, Show All dark', () => {
    act(() => {
      useProjectStore.getState().setHiddenItemNames(['A|c1', 'B|c1'])
    })
    renderBar()
    expect(showAllPressed()).toBe('false')
    expect(hideAllPressed()).toBe('true')
  })

  it('partial hidden state → NEITHER lit', () => {
    act(() => {
      useProjectStore.getState().setHiddenItemNames(['A|c1'])
    })
    renderBar()
    expect(showAllPressed()).toBe('false')
    expect(hideAllPressed()).toBe('false')
  })

  it('highlight updates live from a store change with no re-render (reactive selector)', () => {
    renderBar()
    expect(showAllPressed()).toBe('true')
    expect(hideAllPressed()).toBe('false')

    // No renderBar() here — a getState() one-shot read would leave both stale.
    act(() => {
      useProjectStore.getState().setHiddenItemNames(['A|c1', 'B|c1'])
    })

    expect(hideAllPressed()).toBe('true')
    expect(showAllPressed()).toBe('false')
  })

  it('empty project (zero markups, nothing hidden) → Hide All NOT lit', () => {
    useMarkupStore.getState().reset()
    renderBar()
    // Without the allItemKeys.length > 0 guard, [].every() is vacuously true
    // and Hide All would light up on an empty project.
    expect(hideAllPressed()).toBe('false')
  })

  it('disabled contract is untouched by the highlight wiring', () => {
    renderBar()
    expect(byLabel('Show All markups').getAttribute('aria-disabled')).toBe('false')
    expect(byLabel('Hide All markups').getAttribute('aria-disabled')).toBe('false')

    act(() => {
      useViewerStore.setState({ totalPages: 0 })
    })
    expect(byLabel('Show All markups').getAttribute('aria-disabled')).toBe('true')
    expect(byLabel('Hide All markups').getAttribute('aria-disabled')).toBe('true')
  })
})
