/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useBoqLive } from '@renderer/hooks/useBoqLive'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqStructure } from '@renderer/lib/boq-types'
import type { CountMarkup, LinearMarkup } from '@renderer/types/markup'

// Render the hook into a tiny harness component. `current()` always
// returns the value captured during the most-recent render — pulling the
// value via a getter avoids stale snapshots when the test re-renders.
async function callHook(): Promise<{ current: () => BoqStructure; cleanup: () => void }> {
  // Mutable holder, written via useLayoutEffect (post-render commit) so the
  // assignment is not a render-time side effect — keeps eslint-plugin-
  // react-hooks v7 (react-hooks/immutability) quiet.
  const holder: { value: BoqStructure | null } = { value: null }

  function Harness(): null {
    const v = useBoqLive()
    React.useLayoutEffect(() => {
      holder.value = v
    })
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Harness))
    await new Promise<void>((res) => setTimeout(res, 0))
  })

  return {
    current: () => {
      if (!holder.value) throw new Error('useBoqLive harness — no value captured yet')
      return holder.value
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

function countMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string; sequence?: number }): CountMarkup {
  return {
    id: opts.id, type: 'count', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    point: { x: 0, y: 0 }, sequence: opts.sequence ?? 1
  }
}

function linearMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string; len: number }): LinearMarkup {
  return {
    id: opts.id, type: 'linear', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    points: [{ x: 0, y: 0 }, { x: opts.len, y: 0 }]
  }
}

function resetStores(): void {
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
  useProjectStore.getState().reset()
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null,
    pdfBytes: null,
    pageScales: {},
    activeTool: 'select'
  })
}

describe('useBoqLive — VIEW-01 live aggregator subscription', () => {
  beforeEach(() => {
    resetStores()
  })

  it('returns BoqStructure matching aggregateBoq() snapshot (VIEW-01)', async () => {
    // Seed deterministic store state.
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } }, globalUnit: 'mm' })
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          countMarkup({ id: 'c1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          linearMarkup({ id: 'l1', page: 1, name: 'Wire', categoryId: 'cat-e', color: '#0078d4', len: 5 })
        ]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e']
    })

    const harness = await callHook()
    try {
      // Compare against direct aggregator call with the same inputs.
      const expected = aggregateBoq()
      const live = harness.current()
      // Defensive — both readings should have identical category structure.
      expect(live.categories).toEqual(expected.categories)
      expect(live.grandTotals).toEqual(expected.grandTotals)
      // Specific assertions — single category with two rows (Outlet, Wire).
      expect(live.categories).toHaveLength(1)
      expect(live.categories[0].name).toBe('Electrical')
      const labels = live.categories[0].items.map((r) => r.label).sort()
      expect(labels).toEqual(['Outlet', 'Wire'])
      // Metadata propagation — fileName flowed through.
      expect(live.metadata.planFilename).toBe('demo.pdf')
      expect(live.metadata.totalMarkups).toBe(2)
      expect(live.metadata.totalPages).toBe(1)
    } finally {
      harness.cleanup()
    }
  })

  it('recomputes when pageMarkups changes', async () => {
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } }, globalUnit: 'mm' })
    useMarkupStore.setState({
      pageMarkups: {
        1: [countMarkup({ id: 'c1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e']
    })

    const harness = await callHook()
    try {
      // First render — single Outlet count.
      expect(harness.current().categories[0].items[0].quantity).toBe(1)

      // Add a second Outlet on the same page. Direct setState produces a new
      // pageMarkups object reference — Zustand notifies subscribers.
      await act(async () => {
        useMarkupStore.setState((s) => ({
          pageMarkups: {
            ...s.pageMarkups,
            1: [
              ...s.pageMarkups[1],
              countMarkup({ id: 'c2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4', sequence: 2 })
            ]
          }
        }))
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      expect(harness.current().categories[0].items[0].quantity).toBe(2)
    } finally {
      harness.cleanup()
    }
  })

  it('returns empty categories when no markups exist', async () => {
    // Fresh stores already empty after beforeEach reset.
    const harness = await callHook()
    try {
      const live = harness.current()
      expect(live.categories).toEqual([])
      expect(live.grandTotals).toEqual([])
      expect(live.metadata.totalMarkups).toBe(0)
    } finally {
      harness.cleanup()
    }
  })

  // ===========================================================================
  // Phase 16 — live cost/price/margin recompute (proof c). The Phase-15 scalar
  // `rates` fixture WIDENS to the {material,labor,markup} PriceEntry shape;
  // editing an entry must flow cost/price/margin into the live BoqStructure
  // through useBoqLive's selector + memo dep. RED until Wave 1 (16-02/16-03)
  // widens the aggregator to emit price/margin and useBoqLive stays subscribed
  // to the widened `rates`. Casts to `any` where the PriceEntry map / new read
  // fields are referenced before the types land. Do NOT "fix" the source to make
  // this green — Wave 1-3 does. (The VIEW-01 snapshot + recompute-on-pageMarkups
  // cases above stay GREEN — only this rates fixture shape changed.)
  // ===========================================================================

  it('recomputes cost/price/margin when rates (PriceEntry) change', async () => {
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } }, globalUnit: 'mm' })
    useMarkupStore.setState({
      pageMarkups: {
        1: [countMarkup({ id: 'c1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e']
    })
    // Seed a PriceEntry { material:5, labor:0, markup:30 } for the single Outlet
    // → cost = 5×1 = 5; price = 5×1.3 = 6.5; margin = 1.5.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ rates: { 'Outlet|count': { material: 5, labor: 0, markup: 30 } } })

    const harness = await callHook()
    try {
      // First render — cost/price/margin read the seeded PriceEntry.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = harness.current().categories[0].items[0] as any
      expect(first.cost).toBe(5)
      expect(first.price).toBeCloseTo(6.5, 6)
      expect(first.margin).toBeCloseTo(1.5, 6)

      // Edit material 5 → 10 — useBoqLive must re-subscribe and recompute:
      // cost = 10; price = 10×1.3 = 13; margin = 3.
      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useProjectStore as any).setState({ rates: { 'Outlet|count': { material: 10, labor: 0, markup: 30 } } })
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = harness.current().categories[0].items[0] as any
      expect(next.cost).toBe(10)
      expect(next.price).toBeCloseTo(13, 6)
      expect(next.margin).toBeCloseTo(3, 6)
    } finally {
      harness.cleanup()
    }
  })

  // ===========================================================================
  // WR-01 — changing the project-wide defaultMarkupPct recomputes price/margin
  // live for an UN-PRICED row. Mirrors the "recomputes when rates change" case:
  // useBoqLive must have defaultMarkupPct as BOTH a primitive selector AND a memo
  // dep, or the header control's edit would leave stale prices on the sheet.
  // ===========================================================================

  it('recomputes price/margin when defaultMarkupPct changes (WR-01)', async () => {
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } }, globalUnit: 'mm' })
    useMarkupStore.setState({
      pageMarkups: {
        1: [countMarkup({ id: 'c1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e']
    })
    // Price the row with material=10 but NO explicit markup entry, so the row's
    // markup falls back to the project default. defaultMarkupPct starts at 30
    // (reset() default) → cost 10, price 10×1.3 = 13, margin 3.
    ;(useProjectStore as any).setState({ rates: { 'Outlet|count': { material: 10, labor: 0 } } })

    const harness = await callHook()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = harness.current().categories[0].items[0] as any
      expect(first.markup).toBe(30)
      expect(first.cost).toBe(10)
      expect(first.price).toBeCloseTo(13, 6)
      expect(first.margin).toBeCloseTo(3, 6)

      // Change the project default markup 30 → 50 via the store action. useBoqLive
      // must re-subscribe (selector) and recompute (memo dep): markup 50 → price
      // 10×1.5 = 15, margin 5.
      await act(async () => {
        useProjectStore.getState().setDefaultMarkupPct(50)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = harness.current().categories[0].items[0] as any
      expect(next.markup).toBe(50)
      expect(next.cost).toBe(10)
      expect(next.price).toBeCloseTo(15, 6)
      expect(next.margin).toBeCloseTo(5, 6)
    } finally {
      harness.cleanup()
    }
  })
})
