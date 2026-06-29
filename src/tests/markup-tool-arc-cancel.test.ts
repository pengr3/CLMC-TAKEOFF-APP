/** @vitest-environment jsdom */
/**
 * Regression test for the "curved preview persists after arc is turned off" bug
 * (Phase 14 UAT).
 *
 * The arc 3-click gesture captures an on-arc shaping point into
 * `state.arcOnArc`. The on-canvas curved ArcPreview renders while `arcOnArc` is
 * set. Before this fix, toggling arc mode off (Shift+A), releasing the one-off
 * hold (A keyup), or placing a plain straight vertex did NOT clear a captured
 * `arcOnArc`, so the curved preview kept animating over the subsequent straight
 * edges. These tests pin that any of those three actions cancels the in-flight
 * arc capture — while sticky mode correctly keeps it across a hold release.
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

/**
 * Capture an on-arc shaping point on an ALREADY-active linear draw. Does NOT
 * call activate() — activate resets INITIAL_STATE (arc flags included), so each
 * test activates first, sets the arc mode, then calls this.
 */
function captureOnArc(probe: Probe): void {
  act(() => {
    probe.current!.recordArcClick({ x: 0, y: 0 }) // start vertex (points = 1)
    probe.current!.recordArcClick({ x: 50, y: 20 }) // on-arc shaping point
  })
  expect(probe.current!.state.arcOnArc).not.toBeNull()
}

describe('useMarkupTool — arc capture cancellation', () => {
  it('toggleArcSticky to OFF clears an in-flight arcOnArc', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => probe.current!.activate('linear'))
    act(() => probe.current!.toggleArcSticky()) // sticky ON
    captureOnArc(probe)

    act(() => probe.current!.toggleArcSticky()) // sticky OFF
    expect(probe.current!.state.arcMode).toBe('off')
    expect(probe.current!.state.arcOnArc).toBeNull()
    unmount()
  })

  it('releasing the one-off hold (setArcHeld false) clears arcOnArc when not sticky', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => probe.current!.activate('linear'))
    act(() => probe.current!.setArcHeld(true))
    captureOnArc(probe)

    act(() => probe.current!.setArcHeld(false))
    expect(probe.current!.state.arcOnArc).toBeNull()
    unmount()
  })

  it('placing a straight vertex (recordClick) clears a stale arcOnArc', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => probe.current!.activate('linear'))
    act(() => probe.current!.setArcHeld(true))
    captureOnArc(probe)
    expect(probe.current!.state.points).toHaveLength(1)

    act(() => probe.current!.recordClick({ x: 100, y: 0 })) // straight vertex
    expect(probe.current!.state.arcOnArc).toBeNull()
    expect(probe.current!.state.points).toHaveLength(2)
    unmount()
  })

  it('sticky keeps arcOnArc across a one-off hold release', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    act(() => probe.current!.activate('linear'))
    act(() => probe.current!.toggleArcSticky()) // sticky ON
    captureOnArc(probe)

    act(() => {
      probe.current!.setArcHeld(true)
      probe.current!.setArcHeld(false)
    })
    // Sticky is still on → the in-flight arc capture must survive.
    expect(probe.current!.state.arcMode).toBe('sticky')
    expect(probe.current!.state.arcOnArc).not.toBeNull()
    unmount()
  })
})
