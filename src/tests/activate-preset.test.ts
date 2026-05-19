/**
 * RED stub — Plan 07.1-01: activatePreset does not yet exist on UseMarkupToolReturn.
 * All tests MUST FAIL at runtime (activatePreset is undefined on the hook return).
 * TypeScript casts to any are used where needed to allow the test file to compile.
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

describe('useMarkupTool — activatePreset', () => {
  it('activatePreset is defined on the hook return value', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (holder.tool as any).activatePreset).toBe('function')

    unmount()
  })

  it('activatePreset("count", preset) sets mode:"placing", toolType:"count", chainArmed:true', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('count', {
        name: 'Socket',
        categoryName: 'Electrical',
        color: '#ff0000'
      })
    })

    expect(holder.state.mode).toBe('placing')
    expect(holder.state.toolType).toBe('count')
    expect(holder.state.chainArmed).toBe(true)
    expect(holder.state.pendingName).toBe('Socket')
    expect(holder.state.pendingCategoryName).toBe('Electrical')
    expect(holder.state.pendingColor).toBe('#ff0000')

    unmount()
  })

  it('activatePreset("linear", preset) sets mode:"drawing", toolType:"linear", chainArmed:true', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('linear', {
        name: 'Conduit Run',
        categoryName: 'Electrical',
        color: '#0000ff'
      })
    })

    expect(holder.state.mode).toBe('drawing')
    expect(holder.state.toolType).toBe('linear')
    expect(holder.state.chainArmed).toBe(true)
    expect(holder.state.pendingName).toBe('Conduit Run')

    unmount()
  })

  it('activatePreset("area", preset) sets mode:"drawing", toolType:"area", chainArmed:true', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('area', {
        name: 'Floor Tiles',
        categoryName: 'Flooring',
        color: '#00ff00'
      })
    })

    expect(holder.state.mode).toBe('drawing')
    expect(holder.state.toolType).toBe('area')
    expect(holder.state.chainArmed).toBe(true)

    unmount()
  })

  it('activatePreset("perimeter", preset) sets mode:"drawing", toolType:"perimeter", chainArmed:true', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('perimeter', {
        name: 'Room Edge',
        categoryName: 'Masonry',
        color: '#aaaaaa'
      })
    })

    expect(holder.state.mode).toBe('drawing')
    expect(holder.state.toolType).toBe('perimeter')
    expect(holder.state.chainArmed).toBe(true)

    unmount()
  })

  it('activatePreset("wall", preset) sets mode:"drawing", toolType:"wall", pendingWallHeight from preset', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('wall', {
        name: 'External Wall',
        categoryName: 'Structure',
        color: '#888888',
        wallHeight: 3000
      })
    })

    expect(holder.state.mode).toBe('drawing')
    expect(holder.state.toolType).toBe('wall')
    expect(holder.state.chainArmed).toBe(true)
    expect(holder.state.pendingWallHeight).toBe(3000)

    unmount()
  })

  it('activatePreset("wall", preset) defaults pendingWallHeight to 2400 when wallHeight not provided', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('wall', {
        name: 'Internal Wall',
        categoryName: 'Structure',
        color: '#888888'
        // wallHeight omitted
      })
    })

    expect(holder.state.pendingWallHeight).toBe(2400)

    unmount()
  })

  it('activatePreset with empty categoryName uses UNCATEGORIZED fallback', () => {
    const holder = { state: null as never, tool: null as never }
    const { unmount } = mountTool(holder)

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(holder.tool as any).activatePreset('count', {
        name: 'Item',
        categoryName: '',
        color: '#ffffff'
      })
    })

    expect(holder.state.pendingCategoryName).toBe('Uncategorized')

    unmount()
  })
})
