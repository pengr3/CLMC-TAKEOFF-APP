/** @vitest-environment jsdom */
/**
 * Regression test for the mid-draw Ctrl+Z bug (Apr 2026).
 *
 * Before this fix, pressing Ctrl+Z while drawing a linear/area/perimeter
 * polyline/polygon would fall through to `markupStore.undo()` and remove a
 * previously committed markup — leaving the user no way to undo a misclicked
 * vertex short of pressing Escape and redrawing from scratch.
 *
 * `useMarkupTool.popLastPoint()` now removes the most recent in-progress
 * vertex when called during `drawing` mode. The Ctrl+Z handler in
 * `useKeyboardShortcuts` prefers this over the committed-markup undo stack
 * via the module-level ref in `lib/markup-undo-ref.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React, { useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type Konva from 'konva'
import { useMarkupTool } from '@renderer/hooks/useMarkupTool'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

type Tool = ReturnType<typeof useMarkupTool>

interface Probe {
  current: Tool | null
}

// Identity-transform Konva.Stage shim — hook only uses getAbsoluteTransform.
function makeFakeStage(): Konva.Stage {
  const id = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x, y: p.y })
  const identity = {
    copy: () => ({
      invert: () => ({ point: id }),
      point: id
    })
  }
  return {
    getAbsoluteTransform: () => identity
  } as unknown as Konva.Stage
}

function HookHost({ probe }: { probe: Probe }): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(makeFakeStage())
  probe.current = useMarkupTool(stageRef)
  return React.createElement('div', null, null)
}

function mount(probe: Probe): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(React.createElement(HookHost, { probe }))
  })
  return {
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

// @ts-expect-error — React's act() uses this flag to validate the test env
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useViewerStore.setState({ currentPage: 1, totalPages: 1, activeTool: 'select' })
  document.body.innerHTML = ''
})

describe('useMarkupTool.popLastPoint (mid-draw Ctrl+Z)', () => {
  it('returns false when not drawing', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    let popped = true
    act(() => {
      popped = probe.current!.popLastPoint()
    })
    expect(popped).toBe(false)
    unmount()
  })

  it('returns false when drawing with zero points', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => probe.current!.activate('linear'))
    expect(probe.current!.state.mode).toBe('drawing')
    expect(probe.current!.state.points).toHaveLength(0)
    let popped = true
    act(() => {
      popped = probe.current!.popLastPoint()
    })
    expect(popped).toBe(false)
    unmount()
  })

  it('pops the last vertex while drawing a linear polyline', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
      probe.current!.recordClick({ x: 30, y: 30 })
    })
    expect(probe.current!.state.points).toHaveLength(3)

    let popped = false
    act(() => {
      popped = probe.current!.popLastPoint()
    })
    expect(popped).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)
    expect(probe.current!.state.points[0]).toMatchObject({ x: 10, y: 10 })
    expect(probe.current!.state.points[1]).toMatchObject({ x: 20, y: 20 })
    unmount()
  })

  it('pops vertex-by-vertex until empty, then returns false', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
    })
    act(() => {
      expect(probe.current!.popLastPoint()).toBe(true)
    })
    expect(probe.current!.state.points).toHaveLength(1)
    act(() => {
      expect(probe.current!.popLastPoint()).toBe(true)
    })
    expect(probe.current!.state.points).toHaveLength(0)
    let popped = true
    act(() => {
      popped = probe.current!.popLastPoint()
    })
    expect(popped).toBe(false)
    unmount()
  })

  it('pops vertices on an in-progress area polygon', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('area')
      probe.current!.recordClick({ x: 0, y: 0 })
      probe.current!.recordClick({ x: 10, y: 0 })
      probe.current!.recordClick({ x: 10, y: 10 })
    })
    expect(probe.current!.state.points).toHaveLength(3)
    act(() => {
      expect(probe.current!.popLastPoint()).toBe(true)
    })
    expect(probe.current!.state.points).toHaveLength(2)
    unmount()
  })

  it('pops vertices on an in-progress perimeter polygon', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('perimeter')
      probe.current!.recordClick({ x: 0, y: 0 })
      probe.current!.recordClick({ x: 10, y: 0 })
    })
    act(() => {
      expect(probe.current!.popLastPoint()).toBe(true)
    })
    expect(probe.current!.state.points).toHaveLength(1)
    unmount()
  })

  it('does NOT touch committed markups when popping in-progress vertices', () => {
    // Seed a committed count pin so the undo stack is non-empty
    const store = useMarkupStore.getState()
    const cat = store.getOrCreateCategory('Test')
    store.placeMarkup({
      id: 'committed-1',
      type: 'count',
      page: 1,
      name: 'Prior',
      categoryId: cat.id,
      color: '#000000',
      createdAt: 1,
      point: { x: 5, y: 5 },
      sequence: 1
    })
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)

    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
    })
    act(() => {
      expect(probe.current!.popLastPoint()).toBe(true)
    })
    expect(probe.current!.state.points).toHaveLength(1)
    // Committed markup must remain untouched
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().getMarkups(1)[0].id).toBe('committed-1')
    unmount()
  })
})

describe('markup-undo-ref module-level handler (wired from CanvasViewport → consumed by useKeyboardShortcuts)', () => {
  it('setMarkupUndoHandler stores and getMarkupUndoHandler returns the same reference; clearing unsets it', async () => {
    const { setMarkupUndoHandler, getMarkupUndoHandler } = await import(
      '@renderer/lib/markup-undo-ref'
    )
    expect(getMarkupUndoHandler()).toBeNull()
    const fn = () => true
    setMarkupUndoHandler(fn)
    expect(getMarkupUndoHandler()).toBe(fn)
    setMarkupUndoHandler(null)
    expect(getMarkupUndoHandler()).toBeNull()
  })
})
