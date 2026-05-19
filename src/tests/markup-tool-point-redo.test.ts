/** @vitest-environment jsdom */
/**
 * Phase 10: Tests for repushLastPoint (in-progress Ctrl+Y redo) and SC3 auto-cancel
 * on first-point Ctrl+Z.
 *
 * These tests are intentionally RED in Wave 0: repushLastPoint does not exist on
 * UseMarkupToolReturn yet (Wave 1 adds it), and setMarkupRedoHandler /
 * getMarkupRedoHandler are not yet exported from markup-undo-ref.ts.
 *
 * Success Criteria covered:
 *   SC1 — popLastPoint regression: still works after redoPoints field is added
 *   SC2 — repushLastPoint re-adds the most recently popped vertex (LIFO, cleared on new click)
 *   SC3 — Ctrl+Z on the first (only) point cancels the markup (mode → 'idle')
 *   SC4 — repushLastPoint does not touch committed markups
 *   SC5 — repushLastPoint is tool-type-agnostic (area, perimeter, wall)
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

describe('useMarkupTool.repushLastPoint (in-progress Ctrl+Y redo, MARK-09 SC1-SC5)', () => {
  it('SC1 — popLastPoint returns true and removes last vertex (regression guard)', () => {
    // Ensures pop still works after redoPoints field is added — expected to pass immediately
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
    expect(probe.current!.state.points[1]).toMatchObject({ x: 20, y: 20 })
    unmount()
  })

  it('SC2 — repushLastPoint after pop re-adds the popped vertex', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
      probe.current!.recordClick({ x: 30, y: 30 })
    })
    expect(probe.current!.state.points).toHaveLength(3)

    act(() => {
      probe.current!.popLastPoint()
    })
    expect(probe.current!.state.points).toHaveLength(2)

    let repushed = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(true)
    expect(probe.current!.state.points).toHaveLength(3)
    expect(probe.current!.state.points[2]).toMatchObject({ x: 30, y: 30 })
    unmount()
  })

  it('SC2 — multiple pops and repushes are navigable LIFO', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
      probe.current!.recordClick({ x: 30, y: 30 })
    })

    // Pop p3 then p2
    act(() => { probe.current!.popLastPoint() })  // redoPoints = [p3]
    act(() => { probe.current!.popLastPoint() })  // redoPoints = [p2, p3]
    expect(probe.current!.state.points).toHaveLength(1)

    // First repush should give p2 (the last popped)
    let r1 = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      r1 = probe.current!.repushLastPoint()
    })
    expect(r1).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)
    expect(probe.current!.state.points[1]).toMatchObject({ x: 20, y: 20 })

    // Second repush should give p3
    let r2 = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      r2 = probe.current!.repushLastPoint()
    })
    expect(r2).toBe(true)
    expect(probe.current!.state.points).toHaveLength(3)
    expect(probe.current!.state.points[2]).toMatchObject({ x: 30, y: 30 })
    unmount()
  })

  it('SC2 — new click after pop clears redoPoints (no stale repush)', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
      probe.current!.recordClick({ x: 30, y: 30 })
    })

    act(() => { probe.current!.popLastPoint() })
    // Now there should be 1 item in redoPoints

    // Place a new point — this must clear redoPoints
    act(() => { probe.current!.recordClick({ x: 99, y: 99 }) })
    expect(probe.current!.state.points).toHaveLength(3)

    // repushLastPoint must return false (redoPoints cleared)
    let repushed = true
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(false)
    unmount()
  })

  it('SC3 — Ctrl+Z on first point cancels markup and resets to idle', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
    })
    expect(probe.current!.state.points).toHaveLength(1)
    expect(probe.current!.state.mode).toBe('drawing')

    let popped = false
    act(() => {
      popped = probe.current!.popLastPoint()
    })
    expect(popped).toBe(true)
    // SC3: must cancel to idle (Wave 1 — RED until extended popLastPoint)
    expect(probe.current!.state.mode).toBe('idle')
    expect(probe.current!.state.points).toHaveLength(0)
    unmount()
  })

  it('SC4 — repushLastPoint does not touch committed markups', () => {
    // Seed a committed count markup in markupStore
    const store = useMarkupStore.getState()
    const cat = store.getOrCreateCategory('Test')
    store.placeMarkup({
      id: 'committed-sc4',
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

    // repushLastPoint with nothing to repush must return false
    let repushed = true
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(false)

    // Committed markup must remain untouched
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().getMarkups(1)[0].id).toBe('committed-sc4')
    unmount()
  })

  it('SC5 — repushLastPoint works for area tool', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('area')
      probe.current!.recordClick({ x: 0, y: 0 })
      probe.current!.recordClick({ x: 10, y: 0 })
      probe.current!.recordClick({ x: 10, y: 10 })
    })
    act(() => { probe.current!.popLastPoint() })
    expect(probe.current!.state.points).toHaveLength(2)

    let repushed = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(true)
    expect(probe.current!.state.points).toHaveLength(3)
    unmount()
  })

  it('SC5 — repushLastPoint works for perimeter tool', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('perimeter')
      probe.current!.recordClick({ x: 0, y: 0 })
      probe.current!.recordClick({ x: 10, y: 0 })
    })
    act(() => { probe.current!.popLastPoint() })
    expect(probe.current!.state.points).toHaveLength(1)

    let repushed = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)
    unmount()
  })

  it('SC5 — repushLastPoint works for wall tool', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('wall')
      probe.current!.recordClick({ x: 0, y: 0 })
      probe.current!.recordClick({ x: 10, y: 0 })
    })
    act(() => { probe.current!.popLastPoint() })
    expect(probe.current!.state.points).toHaveLength(1)

    let repushed = false
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)
    unmount()
  })

  it('returns false when no popped points to repush (redoPoints empty)', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => {
      probe.current!.activate('linear')
      probe.current!.recordClick({ x: 10, y: 10 })
      probe.current!.recordClick({ x: 20, y: 20 })
    })

    let repushed = true
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(false)
    expect(probe.current!.state.points).toHaveLength(2)
    unmount()
  })

  it('returns false when not in drawing mode (idle state)', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    // No activate — hook starts in idle mode
    expect(probe.current!.state.mode).toBe('idle')

    let repushed = true
    act(() => {
      // @ts-expect-error — repushLastPoint does not exist yet (Wave 1 adds it — RED)
      repushed = probe.current!.repushLastPoint()
    })
    expect(repushed).toBe(false)
    unmount()
  })
})

describe('markup-undo-ref module — redo handler (MARK-09 SC2 wiring)', () => {
  it('setMarkupRedoHandler / getMarkupRedoHandler store and retrieve the same reference', async () => {
    // @ts-expect-error — setMarkupRedoHandler and getMarkupRedoHandler do not exist yet (Wave 1 — RED)
    const { setMarkupRedoHandler, getMarkupRedoHandler } = await import(
      '@renderer/lib/markup-undo-ref'
    )
    expect(getMarkupRedoHandler()).toBeNull()
    const fn = (): boolean => true
    setMarkupRedoHandler(fn)
    expect(getMarkupRedoHandler()).toBe(fn)
    setMarkupRedoHandler(null)
    expect(getMarkupRedoHandler()).toBeNull()
  })
})
