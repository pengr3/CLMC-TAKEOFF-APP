/** @vitest-environment jsdom */
/**
 * REGRESSION (Phase 18 verification) — Arc-mode write/read lockstep + Shift+A guard.
 *
 * Locks in the two invariants that together make the reported "Arc ON but draws
 * linear / Arc OFF but draws arcs" desync impossible:
 *
 *  1. WRITE↔READ LOCKSTEP. The registered arc-sticky toggle handler — the SAME
 *     callback ToolRail / ContextBar onClick AND Shift+A invoke through
 *     getArcStickyToggleHandler — flips useMarkupTool's arcMode off→sticky→off,
 *     and the published reactive seam (getArcSticky) tracks it in lockstep. Both
 *     derive from the single markupState.arcMode source (CanvasViewport publishes
 *     `setArcStickyState(arcMode === 'sticky')`), so no inversion can occur.
 *
 *  2. Shift+A FOCUS GUARD. The Shift+A keyboard path invokes that handler when no
 *     text input is focused, and correctly BAILS when a text input IS focused
 *     (the isTextInputActive guard). This is precisely the guard that silently
 *     swallowed Shift+A while the now-removed ContextBar auto-focus (fixed in
 *     285f3d4) trapped keyboard focus — so this pins that the focus-steal fix is
 *     what restores Shift+A while a markup is selected.
 *
 * Modelled on markup-tool-arc-cancel.test.ts (useMarkupTool HookHost + fake
 * stage) and use-keyboard-shortcuts-export.test.ts (dispatch window KeyboardEvent
 * against a mounted useKeyboardShortcuts). Hermetic: only the module-level
 * arc-ref seam is shared, and it is reset around every test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type Konva from 'konva'
import { useMarkupTool } from '@renderer/hooks/useMarkupTool'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import {
  getArcStickyToggleHandler,
  setArcStickyToggleHandler,
  setArcHeldHandler,
  getArcSticky,
  setArcStickyState
} from '@renderer/lib/markup-arc-ref'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

type Tool = ReturnType<typeof useMarkupTool>
interface Probe {
  current: Tool | null
}

// Identity-transform Konva.Stage shim — useMarkupTool only calls
// getAbsoluteTransform, which arc toggling never exercises.
function makeFakeStage(): Konva.Stage {
  const id = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x, y: p.y })
  const identity = {
    copy: () => ({ invert: () => ({ point: id }), point: id })
  }
  return { getAbsoluteTransform: () => identity } as unknown as Konva.Stage
}

// Host that mirrors CanvasViewport's arc wiring exactly:
//  - registers toggleArcSticky/setArcHeld on the module ref (CanvasViewport:392-393)
//  - publishes markupState.arcMode into the reactive seam on every change
//    (CanvasViewport:408) so the seam and hook state move in lockstep.
function ArcHost({ probe }: { probe: Probe }): null {
  const stageRef = useRef<Konva.Stage | null>(makeFakeStage())
  const tool = useMarkupTool(stageRef)
  probe.current = tool
  useEffect(() => {
    setArcStickyToggleHandler(tool.toggleArcSticky)
    setArcHeldHandler(tool.setArcHeld)
    return () => {
      setArcStickyToggleHandler(null)
      setArcHeldHandler(null)
    }
  }, [tool.toggleArcSticky, tool.setArcHeld])
  useEffect(() => {
    setArcStickyState(tool.state.arcMode === 'sticky')
  }, [tool.state.arcMode])
  return null
}

function KbHost({ handlers }: { handlers: Parameters<typeof useKeyboardShortcuts>[0] }): null {
  useKeyboardShortcuts(handlers)
  return null
}

function noopHandlers(): Parameters<typeof useKeyboardShortcuts>[0] {
  return {
    openPdf: vi.fn(),
    openProject: vi.fn(),
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToWindow: vi.fn(),
    exportBoq: vi.fn()
  }
}

function mount(element: React.ReactElement): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(element)
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
  useViewerStore.setState({ currentPage: 1, totalPages: 3, activeTool: 'select' })
  // Known Arc-off snapshot on the real seam + no registered handler.
  setArcStickyState(false)
  setArcStickyToggleHandler(null)
  setArcHeldHandler(null)
  document.body.innerHTML = ''
})

afterEach(() => {
  setArcStickyState(false)
  setArcStickyToggleHandler(null)
  setArcHeldHandler(null)
})

describe('arc toggle ↔ reactive seam lockstep (write/read consistency)', () => {
  it('the registered toggle handler flips arcMode off→sticky→off with getArcSticky in lockstep', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(React.createElement(ArcHost, { probe }))

    // Baseline: Arc off in both the hook state and the published seam.
    expect(probe.current!.state.arcMode).toBe('off')
    expect(getArcSticky()).toBe(false)

    // Drive through the SAME handler the ToolRail/ContextBar onClick and the
    // Shift+A shortcut invoke — getArcStickyToggleHandler(). off → sticky.
    act(() => {
      getArcStickyToggleHandler()!()
    })
    expect(probe.current!.state.arcMode).toBe('sticky')
    expect(getArcSticky()).toBe(true) // seam tracked the flip — no inversion

    // sticky → off. The seam must follow back down in lockstep.
    act(() => {
      getArcStickyToggleHandler()!()
    })
    expect(probe.current!.state.arcMode).toBe('off')
    expect(getArcSticky()).toBe(false)

    // A third toggle proves the functional-updater flip never gets stuck: it
    // strictly alternates off→sticky→off→sticky, and the seam stays in lockstep.
    act(() => {
      getArcStickyToggleHandler()!()
    })
    expect(probe.current!.state.arcMode).toBe('sticky')
    expect(getArcSticky()).toBe(true)

    unmount()
  })

  it('the published seam is never inverted relative to arcMode', () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(React.createElement(ArcHost, { probe }))

    // Across a run of toggles, getArcSticky() must equal (arcMode === 'sticky')
    // at every settled step — the defining non-inversion invariant.
    for (let i = 0; i < 5; i++) {
      act(() => {
        getArcStickyToggleHandler()!()
      })
      expect(getArcSticky()).toBe(probe.current!.state.arcMode === 'sticky')
    }

    unmount()
  })
})

describe('Shift+A keyboard path honours the isTextInputActive guard (focus-steal fix)', () => {
  it('Shift+A invokes the registered arc toggle handler when NO text input is focused', () => {
    const toggleSpy = vi.fn()
    setArcStickyToggleHandler(toggleSpy)
    const { unmount } = mount(React.createElement(KbHost, { handlers: noopHandlers() }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('Shift+A BAILS (never invokes the handler) when a text input IS focused', () => {
    const toggleSpy = vi.fn()
    setArcStickyToggleHandler(toggleSpy)

    // A focused <input> is exactly the focus-steal condition the 285f3d4 fix
    // removed for mere selection. With focus trapped, the isTextInputActive
    // guard must swallow Shift+A so a capital 'A' types instead of toggling arc.
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    const { unmount } = mount(React.createElement(KbHost, { handlers: noopHandlers() }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).not.toHaveBeenCalled()

    input.remove()
    unmount()
  })

  it('after focus leaves the input, Shift+A toggles again — proving the guard, not a latch, gated it', () => {
    const toggleSpy = vi.fn()
    setArcStickyToggleHandler(toggleSpy)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const { unmount } = mount(React.createElement(KbHost, { handlers: noopHandlers() }))

    // Blocked while focused.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).not.toHaveBeenCalled()

    // Focus returns to the canvas/body — the guard opens and Shift+A works again.
    input.blur()
    expect(document.activeElement).not.toBe(input)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).toHaveBeenCalledTimes(1)

    input.remove()
    unmount()
  })
})
