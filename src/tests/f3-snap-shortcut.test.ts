/** @vitest-environment jsdom */
/**
 * REGRESSION (F3 snap-toggle reliability) — locks in the two-cause fix in
 * useKeyboardShortcuts:
 *
 *  Cause A — listener churn. The window keydown/keyup/blur listeners used to be
 *  registered inside a useEffect whose deps were [handlers, totalPages]. App.tsx
 *  passes a FRESH handlers object literal on every render, so the effect tore down
 *  and re-added all three listeners on every App re-render — and a keypress that
 *  arrived during the removeEventListener→addEventListener gap was silently dropped
 *  ("F3 sometimes doesn't fire", worst while spamming during placement). Fix: the
 *  hook reads the latest handlers/totalPages through refs and registers the window
 *  listeners ONCE (mount-only effect). This test proves keydown is registered
 *  exactly once across many re-renders and that F3 still fires afterward.
 *
 *  Cause B — focus guard. The F3 branch used to bail via `if (isTextInputActive())
 *  return`, so a focused field (e.g. a markup-name popup) suppressed the snap
 *  toggle. F3 types nothing, so it is now exempt from that guard. This test proves
 *  F3 toggles snapEnabled even while an <input> is document.activeElement, while a
 *  companion regression proves the text-conflicting shortcuts (Shift+A, Ctrl+Z,
 *  Delete) KEEP their guards.
 *
 * Modelled on use-keyboard-shortcuts-export.test.ts and arc-toggle-sync.test.ts
 * (mounted useKeyboardShortcuts host + window KeyboardEvent dispatch).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import {
  setArcStickyToggleHandler,
  setArcHeldHandler,
  setArcStickyState
} from '@renderer/lib/markup-arc-ref'
import type { CountMarkup } from '@renderer/types/markup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

type Handlers = Parameters<typeof useKeyboardShortcuts>[0]

function makeHandlers(): Handlers {
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

function HookHost({ handlers }: { handlers: Handlers }): null {
  useKeyboardShortcuts(handlers)
  return null
}

// Host that re-renders with a BRAND-NEW handlers object literal on every render —
// exactly what App.tsx does (it passes an inline object to useKeyboardShortcuts).
const churnProbe: { rerender: () => void; renders: number } = { rerender: () => {}, renders: 0 }
function ChurnHost(): null {
  const [, setTick] = React.useState(0)
  churnProbe.rerender = (): void => setTick((t) => t + 1)
  churnProbe.renders++
  useKeyboardShortcuts(makeHandlers()) // fresh object identity every render
  return null
}

let container: HTMLDivElement
let root: Root

function focusInput(): HTMLInputElement {
  const input = document.createElement('input')
  document.body.appendChild(input)
  input.focus()
  return input
}

function makeCount(id: string, categoryId: string): CountMarkup {
  return {
    id,
    type: 'count',
    page: 1,
    name: 'X',
    categoryId,
    sequence: 1,
    point: { x: 1, y: 1 },
    createdAt: 1
  }
}

beforeEach(() => {
  useViewerStore.setState({
    totalPages: 3,
    currentPage: 1,
    activeTool: 'select',
    snapEnabled: true,
    snapSuspended: false,
    selectedMarkupIds: []
  })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  setArcStickyToggleHandler(null)
  setArcHeldHandler(null)
  setArcStickyState(false)
  churnProbe.renders = 0
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  setArcStickyToggleHandler(null)
  setArcHeldHandler(null)
  setArcStickyState(false)
})

describe('F3 is exempt from the isTextInputActive guard (Cause B)', () => {
  it('F3 toggles snapEnabled even when a text input is document.activeElement', () => {
    const input = focusInput()
    expect(document.activeElement).toBe(input)

    act(() => {
      root.render(React.createElement(HookHost, { handlers: makeHandlers() }))
    })
    expect(useViewerStore.getState().snapEnabled).toBe(true)

    // With a field focused, the old guard swallowed F3. It must now fire.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }))
    })
    expect(useViewerStore.getState().snapEnabled).toBe(false)

    // Spamming flips it back — a real repeatable toggle, focus notwithstanding.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }))
    })
    expect(useViewerStore.getState().snapEnabled).toBe(true)

    input.remove()
  })

  it('F3 also toggles when no input is focused (baseline unchanged)', () => {
    act(() => {
      root.render(React.createElement(HookHost, { handlers: makeHandlers() }))
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }))
    })
    expect(useViewerStore.getState().snapEnabled).toBe(false)
  })
})

describe('window listeners register once, not per-render (Cause A)', () => {
  it("registers window keydown exactly once despite many re-renders with fresh handlers", () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    act(() => {
      root.render(React.createElement(ChurnHost))
    })

    // Force several App-style re-renders, each passing a brand-new handlers object.
    for (let i = 0; i < 6; i++) {
      act(() => churnProbe.rerender())
    }
    expect(churnProbe.renders).toBeGreaterThan(6) // re-renders actually happened

    const keydownRegs = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length
    // The buggy version would register 7 times (1 mount + 6 re-renders). The ref
    // refactor registers exactly once — the whole point of the fix.
    expect(keydownRegs).toBe(1)
    addSpy.mockRestore()
  })

  it('F3 still fires after many re-renders — no keypress dropped', () => {
    act(() => {
      root.render(React.createElement(ChurnHost))
    })
    for (let i = 0; i < 6; i++) {
      act(() => churnProbe.rerender())
    }

    useViewerStore.setState({ snapEnabled: true })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }))
    })
    expect(useViewerStore.getState().snapEnabled).toBe(false)
  })
})

describe('text-conflicting shortcuts KEEP their isTextInputActive guards (regression)', () => {
  it('Shift+A bails while a text input is focused, and fires when not', () => {
    const toggleSpy = vi.fn()
    setArcStickyToggleHandler(toggleSpy)
    act(() => {
      root.render(React.createElement(HookHost, { handlers: makeHandlers() }))
    })

    const input = focusInput()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).not.toHaveBeenCalled()

    input.blur()
    input.remove()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))
    })
    expect(toggleSpy).toHaveBeenCalledTimes(1) // guard opened once focus left
  })

  it('Ctrl+Z bails while a text input is focused, and fires when not', () => {
    const undoSpy = vi.spyOn(useMarkupStore.getState(), 'undo').mockImplementation(() => {})
    act(() => {
      root.render(React.createElement(HookHost, { handlers: makeHandlers() }))
    })

    const input = focusInput()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    expect(undoSpy).not.toHaveBeenCalled()

    input.blur()
    input.remove()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    expect(undoSpy).toHaveBeenCalledTimes(1)
    undoSpy.mockRestore()
  })

  it('Delete bails while a text input is focused, and fires when not', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Test')
    useMarkupStore.getState().placeMarkup(makeCount('m-1', cat.id))
    useViewerStore.setState({ selectedMarkupIds: ['m-1'] })
    const delSpy = vi.spyOn(useMarkupStore.getState(), 'deleteMarkup').mockImplementation(() => {})
    act(() => {
      root.render(React.createElement(HookHost, { handlers: makeHandlers() }))
    })

    const input = focusInput()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    })
    expect(delSpy).not.toHaveBeenCalled() // guard held — committed markup safe

    input.blur()
    input.remove()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    })
    expect(delSpy).toHaveBeenCalledTimes(1)
    delSpy.mockRestore()
  })
})
