/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { Splitter } from '@renderer/components/Splitter'

/**
 * Phase-18 splitter-drag perf: proves the App-side wiring drives the live Totals
 * width IMPERATIVELY (no React render per pointermove) and commits ONCE on
 * pointerup.
 *
 * Root cause of the residual lag/"trail": App bound onDragWidth directly to a
 * `setTotalsDragWidth` useState setter, so EVERY pointermove (~60-120x/sec)
 * re-rendered App + the heavy (non-memo) TotalsPanel. The fix mirrors App.tsx
 * handleTotalsDragWidth / handleTotalsCommitWidth:
 *   - onDragWidth writes `panel.style.width` via a ref and freezes the width
 *     transition — NO setState, so NO component re-renders,
 *   - onCommit restores the transition and calls setTotalsWidth ONCE (the single
 *     re-render + single localStorage write).
 *
 * This harness reproduces that exact wiring (a ref'd "panel" node + a
 * render-counting probe) and asserts the render count stays flat across the
 * whole drag and ticks exactly once on pointerup. If a future change reintroduces
 * a per-move setState, the render-count assertion fails.
 */

interface Harness {
  separator: () => Element
  panel: () => HTMLDivElement
  renderCount: () => number
  committedWidth: () => number
  cleanup: () => void
}

/**
 * Test double that mirrors App's Totals wiring:
 *   - `committedWidth` React state = useUiPanels().totals.width,
 *   - a ref to the width-bearing panel div (like totalsPanelRef → TotalsPanel),
 *   - onDragWidth: imperative style.width + frozen transition, NO setState,
 *   - onCommit: restore transition + setCommittedWidth (single render).
 * A sibling probe counts every render of this subtree.
 */
function Harness({ onRender }: { onRender: () => void }): React.ReactElement {
  const [committedWidth, setCommittedWidth] = React.useState(320)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const baseTransitionRef = React.useRef<string | null>(null)

  onRender()

  const onDragWidth = React.useCallback((w: number): void => {
    const el = panelRef.current
    if (!el) return
    if (baseTransitionRef.current === null) {
      baseTransitionRef.current = el.style.transition
      el.style.transition = 'none'
    }
    el.style.width = `${w}px`
  }, [])

  const onCommit = React.useCallback((finalWidth: number): void => {
    const el = panelRef.current
    if (el && baseTransitionRef.current !== null) {
      el.style.transition = baseTransitionRef.current
      baseTransitionRef.current = null
    }
    setCommittedWidth(finalWidth)
  }, [])

  return React.createElement(
    'div',
    null,
    React.createElement('div', {
      ref: panelRef,
      'data-testid': 'panel',
      'data-committed': committedWidth,
      style: { width: committedWidth, transition: 'width 150ms ease-out' }
    }),
    React.createElement(Splitter, {
      side: 'right',
      panelWidth: committedWidth,
      containerWidth: 1000,
      minWidth: 28,
      onDragWidth,
      onCommit,
      ariaLabel: 'Resize Totals panel'
    })
  )
}

function mountHarness(): Harness {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  let renders = 0
  act(() => {
    root.render(React.createElement(Harness, { onRender: () => { renders += 1 } }))
  })
  return {
    separator: () => {
      const el = container.querySelector('[role="separator"]')
      if (!el) throw new Error('separator not found')
      return el
    },
    panel: () => container.querySelector('[data-testid="panel"]') as HTMLDivElement,
    renderCount: () => renders,
    committedWidth: () =>
      Number((container.querySelector('[data-testid="panel"]') as HTMLDivElement).dataset.committed),
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

function pointerEvent(type: string, clientX: number): Event {
  try {
    return new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 })
  } catch {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 })
  }
}
function firePointerDown(node: Element, clientX: number): void {
  act(() => { node.dispatchEvent(pointerEvent('pointerdown', clientX)) })
}
function firePointerMove(clientX: number): void {
  act(() => { window.dispatchEvent(pointerEvent('pointermove', clientX)) })
}
function firePointerUp(clientX: number): void {
  act(() => { window.dispatchEvent(pointerEvent('pointerup', clientX)) })
}

describe('Splitter drag — imperative width (no per-pointermove re-render)', () => {
  it('mutates panel width via ref on every move WITHOUT re-rendering, commits once on pointerup', () => {
    const h = mountHarness()
    try {
      const rendersAfterMount = h.renderCount()
      expect(rendersAfterMount).toBeGreaterThan(0)

      // Drag left (side="right" → panel grows): startX 600, startWidth 320.
      firePointerDown(h.separator(), 600) // pointerdown flips Splitter.isDragging → its OWN render, not App's

      const rendersAfterDown = h.renderCount()

      firePointerMove(560) // dx 40  → 360
      firePointerMove(500) // dx 100 → 420
      firePointerMove(440) // dx 160 → 480

      // THE KEY ASSERTION: no Harness (App-proxy) render fired across the moves.
      expect(h.renderCount()).toBe(rendersAfterDown)

      // Width was driven imperatively to the last move value...
      expect(h.panel().style.width).toBe('480px')
      // ...with the transition frozen so the panel tracks the pointer 1:1.
      expect(h.panel().style.transition).toBe('none')
      // ...and the committed React width is still the pre-drag value (no commit yet).
      expect(h.committedWidth()).toBe(320)

      firePointerUp(440)

      // Commit fired exactly one re-render (the single setState / localStorage write).
      expect(h.renderCount()).toBe(rendersAfterDown + 1)
      expect(h.committedWidth()).toBe(480)
      // Transition restored for the collapse/expand animation.
      expect(h.panel().style.transition).toBe('width 150ms ease-out')
      // Committed prop reconciles style.width to the SAME value the drag left — no jump.
      expect(h.panel().style.width).toBe('480px')
    } finally {
      h.cleanup()
    }
  })

  it('a pointerdown with no move never freezes the transition and leaves the width unchanged', () => {
    const h = mountHarness()
    try {
      firePointerDown(h.separator(), 600)
      firePointerUp(600) // no move → onDragWidth never fired → no transition freeze

      // The collapse/expand transition was never touched (drag-freeze only happens
      // on the FIRST onDragWidth, which requires an actual pointermove).
      expect(h.panel().style.transition).toBe('width 150ms ease-out')
      // Width stays at the committed start value (commit(320) is a same-value no-op).
      expect(h.panel().style.width).toBe('320px')
      expect(h.committedWidth()).toBe(320)
    } finally {
      h.cleanup()
    }
  })
})
