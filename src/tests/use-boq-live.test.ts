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

// Render the hook into a tiny harness component, capture the latest value.
async function callHook(): Promise<{ value: BoqStructure; rerender: () => Promise<void>; cleanup: () => void }> {
  let captured: BoqStructure = { metadata: { projectName: '', planFilename: '', exportedDate: '', totalPages: 0, totalMarkups: 0 }, categories: [], grandTotals: [] }
  let rerenderTrigger: ((n: number) => void) | null = null

  function Harness(): null {
    const [, setN] = React.useState(0)
    rerenderTrigger = setN
    captured = useBoqLive()
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
    value: captured,
    rerender: async () => {
      await act(async () => {
        if (rerenderTrigger) rerenderTrigger((n) => n + 1)
        await new Promise<void>((res) => setTimeout(res, 0))
      })
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
      // Defensive — both readings should have identical category structure.
      expect(harness.value.categories).toEqual(expected.categories)
      expect(harness.value.grandTotals).toEqual(expected.grandTotals)
      // Specific assertions — single category with two rows (Outlet, Wire).
      expect(harness.value.categories).toHaveLength(1)
      expect(harness.value.categories[0].name).toBe('Electrical')
      const labels = harness.value.categories[0].items.map((r) => r.label).sort()
      expect(labels).toEqual(['Outlet', 'Wire'])
      // Metadata propagation — fileName flowed through.
      expect(harness.value.metadata.planFilename).toBe('demo.pdf')
      expect(harness.value.metadata.totalMarkups).toBe(2)
      expect(harness.value.metadata.totalPages).toBe(1)
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
      expect(harness.value.categories[0].items[0].quantity).toBe(1)

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

      expect(harness.value.categories[0].items[0].quantity).toBe(2)
    } finally {
      harness.cleanup()
    }
  })

  it('returns empty categories when no markups exist', async () => {
    // Fresh stores already empty after beforeEach reset.
    const harness = await callHook()
    try {
      expect(harness.value.categories).toEqual([])
      expect(harness.value.grandTotals).toEqual([])
      expect(harness.value.metadata.totalMarkups).toBe(0)
    } finally {
      harness.cleanup()
    }
  })
})
