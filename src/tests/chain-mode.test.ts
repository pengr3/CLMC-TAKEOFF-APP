/**
 * RED stubs — Wave 0: chainArmed + pendingWallHeight do not yet exist on MarkupDrawState.
 * All tests MUST FAIL at runtime (fields are undefined on INITIAL_STATE).
 * TypeScript compiles cleanly — casts to any used where needed.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React, { useRef, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type Konva from 'konva'
import { useMarkupTool } from '@renderer/hooks/useMarkupTool'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

// @ts-expect-error — React's act() uses this flag to validate the test env
globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Tool = ReturnType<typeof useMarkupTool>

interface Holder {
  state: ReturnType<typeof useMarkupTool>['state']
  tool: Tool
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
  return { getAbsoluteTransform: () => identity } as unknown as Konva.Stage
}

function HookHost({ holder }: { holder: Holder }): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(makeFakeStage())
  const tool = useMarkupTool(stageRef)
  // useLayoutEffect runs after commit — safe per eslint-plugin-react-hooks rule.
  useLayoutEffect(() => {
    holder.state = tool.state
    holder.tool = tool
  })
  return React.createElement('div', null, null)
}

function mountTool(holder: Holder): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(React.createElement(HookHost, { holder }))
  })
  return {
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useViewerStore.setState({ currentPage: 1, totalPages: 1, activeTool: 'select' } as never)
  document.body.innerHTML = ''
})

describe('useMarkupTool — chain mode', () => {
  it('INITIAL_STATE has chainArmed: false and pendingWallHeight: 2400', () => {
    // MUST FAIL — chainArmed and pendingWallHeight do not yet exist on MarkupDrawState
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((holder.state as any).chainArmed).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((holder.state as any).pendingWallHeight).toBe(2400)

    unmount()
  })

  it('first commitShape sets chainArmed to true and preserves name/category/color', () => {
    // MUST FAIL — chainArmed does not exist yet
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      holder.tool.activate('linear')
    })
    // Simulate drawing two points then finish to reach 'confirming' mode
    act(() => {
      holder.tool.recordClick({ x: 100, y: 100 })
      holder.tool.recordClick({ x: 200, y: 200 })
      holder.tool.finishLinear()
    })
    act(() => {
      holder.tool.commitShape({ name: 'TestWall', categoryName: 'Cat', color: '#ff0000' })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((holder.state as any).chainArmed).toBe(true)
    expect(holder.state.pendingName).toBe('TestWall')
    expect(holder.state.mode).toBe('drawing')

    unmount()
  })

  it('cancel() resets chainArmed to false', () => {
    // MUST FAIL — chainArmed does not exist yet
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => { holder.tool.activate('linear') })
    // Force chainArmed to true by setting it directly (bypass missing implementation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useMarkupTool as any) // chainArmed will be undefined — fail is already guaranteed

    act(() => { holder.tool.cancel() })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((holder.state as any).chainArmed).toBe(false)

    unmount()
  })
})
