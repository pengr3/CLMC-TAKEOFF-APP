/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — morphing ContextBar, four mutually-exclusive states (SC-4).
 *
 * FAILS today because `@renderer/components/ContextBar` does not exist yet — the
 * import cannot be resolved (missing MODULE, not a syntax/config error). Turns GREEN
 * when plan 18-08 lands the ContextBar that morphs on activeTool + selection and
 * re-homes the chain indicator + Snap/Arc toggles (RibbonToolbar ChainBadge / S-6 / S-7).
 *
 * Contract pinned here (18-03-PLAN testid_contract):
 *   container       data-testid="context-bar"
 *   morph roots     data-testid="context-bar-{placing|scale|selected|idle}"
 *     placing  = activeTool is a markup tool (count/linear/area/perimeter/wall)
 *     scale    = activeTool === 'scale'
 *     selected = activeTool === 'select' && selectedMarkupIds.length > 0
 *     idle     = otherwise
 *   placing carries   context-snap-toggle + context-arc-toggle + "Enter to finish · Esc to cancel"
 *   chain indicator   shows the armed item name when getChainArmedItem() !== null
 *   exactly ONE morph root is present at a time
 *
 * Konva isolation: ContextBar imports the CanvasViewport module refs
 * (getChainArmedItem) and the reactive Arc seam (getArcSticky / subscribeArcSticky),
 * both transitively react-konva-adjacent. Mock them so the render stays pure jsdom,
 * mirroring toolrail-tools.test.ts + arc-toggle.test.ts. A `vi.hoisted` holder lets
 * the tests flip the mocked chain/arc reads between renders.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

const seam = vi.hoisted(() => ({
  chainArmed: null as { name: string; color: string } | null,
  arcSticky: false
}))

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => ({ activate: vi.fn(), cancel: vi.fn(), activateVerify: vi.fn() }),
  setChainArmedFromTotals: vi.fn()
}))

// Reactive chain-armed read seam (tool-switch-placement-stuck). Mocked wholesale so
// the chip read resolves without pulling in CanvasViewport / react-konva.
// subscribeChainArmed is a no-op subscription (returns an unsubscribe) for the
// useSyncExternalStore consumer; getChainArmedItem returns the hoisted seam value.
vi.mock('@renderer/lib/markup-chain-ref', () => ({
  getChainArmedItem: () => seam.chainArmed,
  setChainArmedItem: (v: { name: string; color: string } | null) => {
    seam.chainArmed = v
  },
  subscribeChainArmed: () => () => {}
}))

// Reactive Arc read seam (added in 18-04). Mocked wholesale so the on-state read
// resolves without pulling in useMarkupTool / react-konva. subscribeArcSticky is a
// no-op subscription (returns an unsubscribe) for useSyncExternalStore consumers.
vi.mock('@renderer/lib/markup-arc-ref', () => ({
  getArcSticky: () => seam.arcSticky,
  setArcStickyState: (v: boolean) => {
    seam.arcSticky = v
  },
  subscribeArcSticky: () => () => {},
  getArcStickyToggleHandler: () => () => {},
  setArcStickyToggleHandler: () => {},
  getArcHeldHandler: () => null,
  setArcHeldHandler: () => {}
}))

import { ContextBar } from '@renderer/components/ContextBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { LinearMarkup } from '@renderer/types/markup'
import type { ActiveTool } from '@renderer/types/viewer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderBar(): void {
  act(() => {
    root.render(React.createElement(ContextBar))
  })
}

const MORPH_ROOTS = [
  'context-bar-placing',
  'context-bar-scale',
  'context-bar-selected',
  'context-bar-idle'
] as const

function presentRoots(): string[] {
  return MORPH_ROOTS.filter((id) => container.querySelector(`[data-testid="${id}"]`) !== null)
}

function makeLinear(page: number, id: string, name = 'Skirting'): LinearMarkup {
  return {
    id,
    type: 'linear',
    page,
    name,
    categoryId: 'cat-1',
    color: '#5bbf6a',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    createdAt: Date.now()
  }
}

// Seed one linear markup on the current page + a matching category so the selected
// morph has real data to resolve (name + category chip) in 18-08.
function seedSelectedMarkup(): void {
  useMarkupStore.setState({
    pageMarkups: { 1: [makeLinear(1, 'm1')] },
    categories: {
      'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
    },
    categoryOrder: ['cat-1']
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seam.chainArmed = null
  seam.arcSticky = false
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
    viewMode: 'plan',
    selectedMarkupIds: [],
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

describe('ContextBar — morph states (SC-4)', () => {
  it('placing: a markup tool (count) renders context-bar-placing with Snap+Arc toggles and the finish/cancel hint', () => {
    useViewerStore.setState({ activeTool: 'count' })
    renderBar()
    expect(container.querySelector('[data-testid="context-bar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="context-bar-placing"]')).not.toBeNull()
    // Snap + Arc toggles appear on the context bar as well as the rail (D-04 / D-05).
    expect(container.querySelector('[data-testid="context-snap-toggle"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="context-arc-toggle"]')).not.toBeNull()
    // The placing hint (mockup.html:334).
    expect(container.textContent).toContain('Enter to finish')
    expect(container.textContent).toContain('Esc to cancel')
    // Only the placing root — no other morph leaks through.
    expect(presentRoots()).toEqual(['context-bar-placing'])
  })

  it('placing: the chain item name shows when getChainArmedItem() is armed', () => {
    seam.chainArmed = { name: 'Slab', color: '#4f9cf0' }
    useViewerStore.setState({ activeTool: 'count' })
    renderBar()
    expect(container.querySelector('[data-testid="context-bar-placing"]')).not.toBeNull()
    expect(container.textContent).toContain('Slab')
  })

  it('scale: activeTool "scale" renders context-bar-scale with a calibration hint', () => {
    useViewerStore.setState({ activeTool: 'scale' })
    renderBar()
    const scaleRoot = container.querySelector('[data-testid="context-bar-scale"]')
    expect(scaleRoot).not.toBeNull()
    // The scale morph carries a (non-empty) calibration hint.
    expect((scaleRoot!.textContent ?? '').trim().length).toBeGreaterThan(0)
    expect(presentRoots()).toEqual(['context-bar-scale'])
  })

  it('selected: Select tool + a selected markup renders context-bar-selected', () => {
    seedSelectedMarkup()
    useViewerStore.setState({ activeTool: 'select', selectedMarkupIds: ['m1'] })
    renderBar()
    expect(container.querySelector('[data-testid="context-bar-selected"]')).not.toBeNull()
    expect(presentRoots()).toEqual(['context-bar-selected'])
  })

  it('idle: Select tool with NO selection renders context-bar-idle', () => {
    useViewerStore.setState({ activeTool: 'select', selectedMarkupIds: [] })
    renderBar()
    expect(container.querySelector('[data-testid="context-bar-idle"]')).not.toBeNull()
    expect(presentRoots()).toEqual(['context-bar-idle'])
  })

  it('exactly ONE morph root is present in every state (mutual exclusivity)', () => {
    const cases: Array<{ activeTool: ActiveTool; selectedMarkupIds: string[]; expected: string }> = [
      { activeTool: 'count', selectedMarkupIds: [], expected: 'context-bar-placing' },
      { activeTool: 'scale', selectedMarkupIds: [], expected: 'context-bar-scale' },
      { activeTool: 'select', selectedMarkupIds: ['m1'], expected: 'context-bar-selected' },
      { activeTool: 'select', selectedMarkupIds: [], expected: 'context-bar-idle' }
    ]
    for (const c of cases) {
      seedSelectedMarkup()
      useViewerStore.setState({ activeTool: c.activeTool, selectedMarkupIds: c.selectedMarkupIds })
      renderBar()
      expect(presentRoots()).toEqual([c.expected])
    }
  })
})
