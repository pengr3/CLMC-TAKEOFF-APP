/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useBoqLive } from '@renderer/hooks/useBoqLive'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqStructure } from '@renderer/lib/boq-types'
import type { CountMarkup } from '@renderer/types/markup'

// Phase 17 (Req 2, D-11 / Pitfall 4): a reorderItems dispatch (which mutates
// markupStore.categoryItemOrder) must recompute the live BoqStructure — proving
// useBoqLive lists categoryItemOrder as BOTH a primitive selector AND a memo dep.
// Mirrors use-boq-live.test.ts's render harness.

async function callHook(): Promise<{ current: () => BoqStructure; cleanup: () => void }> {
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

function countMarkup(opts: {
  id: string
  page: number
  name: string
  categoryId: string
  color: string
  sequence?: number
}): CountMarkup {
  return {
    id: opts.id,
    type: 'count',
    page: opts.page,
    name: opts.name,
    categoryId: opts.categoryId,
    color: opts.color,
    createdAt: 0,
    point: { x: 0, y: 0 },
    sequence: opts.sequence ?? 1
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

describe('useBoqLive — live recompute on categoryItemOrder change (Phase 17 Req 2)', () => {
  beforeEach(() => {
    resetStores()
  })

  it('recomputes item order when categoryItemOrder changes', async () => {
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } },
      globalUnit: 'mm'
    })
    // Placement order Zebra then Apple; no manual order yet → placement order holds.
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          countMarkup({ id: 'z', page: 1, name: 'Zebra', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'a', page: 1, name: 'Apple', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e'],
      categoryItemOrder: {}
    })

    const harness = await callHook()
    try {
      // First render — placement order (NOT alphabetical).
      expect(harness.current().categories[0].items.map((i) => i.label)).toEqual([
        'Zebra',
        'Apple'
      ])

      // Dispatch a reorder — the live sheet must recompute to the new order.
      await act(async () => {
        useMarkupStore.getState().reorderItems('cat-e', ['Apple|count', 'Zebra|count'])
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      expect(harness.current().categories[0].items.map((i) => i.label)).toEqual([
        'Apple',
        'Zebra'
      ])
    } finally {
      harness.cleanup()
    }
  })

  it('undoing a reorder recomputes the sheet back to the prior order', async () => {
    useViewerStore.setState({ totalPages: 1, fileName: 'demo.pdf' })
    useScaleStore.setState({
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } },
      globalUnit: 'mm'
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          countMarkup({ id: 'z', page: 1, name: 'Zebra', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'a', page: 1, name: 'Apple', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e'],
      categoryItemOrder: {}
    })

    const harness = await callHook()
    try {
      await act(async () => {
        useMarkupStore.getState().reorderItems('cat-e', ['Apple|count', 'Zebra|count'])
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(harness.current().categories[0].items.map((i) => i.label)).toEqual([
        'Apple',
        'Zebra'
      ])

      await act(async () => {
        useMarkupStore.getState().undo()
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      // One Ctrl+Z reverts the sheet to placement order.
      expect(harness.current().categories[0].items.map((i) => i.label)).toEqual([
        'Zebra',
        'Apple'
      ])
    } finally {
      harness.cleanup()
    }
  })
})
