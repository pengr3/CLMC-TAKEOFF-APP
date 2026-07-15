/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { Splitter } from '@renderer/components/Splitter'

/**
 * Splitter width-drag / commit contract (Phase 6, guarded during the Phase-18
 * splitter-drag-lag perf fix).
 *
 * The Phase-18 perf fix memoizes CanvasViewport / EstimatePanel AND drives the
 * live Totals width IMPERATIVELY (App writes el.style.width via a ref on every
 * onDragWidth — NO setState until pointerup). NONE of that is allowed to change
 * the Splitter's behavioral contract, which App depends on:
 *   - onDragWidth fires on EVERY pointermove with the clamped candidate width
 *     (App writes this straight to the panel node's style.width — live resize),
 *   - the candidate is clamped to [minWidth, containerWidth * 0.5],
 *   - onCommit fires EXACTLY ONCE on pointerup with the final width
 *     (App: setTotalsWidth — the single re-render + single localStorage write),
 *   - after pointerup the window listeners are gone (no late drag callbacks).
 *
 * The companion suite splitter-drag-imperative.test.ts proves the App-side
 * wiring: onDragWidth mutates the DOM without a React render, and only the
 * pointerup commit re-renders.
 *
 * side="right": dragging LEFT (clientX decreases) grows the panel — dx = startX - clientX.
 */

interface Handles {
  separator: () => Element
  cleanup: () => void
}

function mountSplitter(opts: {
  onDragWidth: (w: number) => void
  onCommit: (w: number) => void
  panelWidth?: number
  containerWidth?: number
  minWidth?: number
}): Handles {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(
      React.createElement(Splitter, {
        side: 'right',
        panelWidth: opts.panelWidth ?? 320,
        containerWidth: opts.containerWidth ?? 1000,
        minWidth: opts.minWidth ?? 28,
        onDragWidth: opts.onDragWidth,
        onCommit: opts.onCommit,
        ariaLabel: 'Resize Totals panel'
      })
    )
  })
  return {
    separator: () => {
      const el = container.querySelector('[role="separator"]')
      if (!el) throw new Error('separator not found')
      return el
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

/** PointerEvent when supported, else MouseEvent (jsdom fallback) — carries clientX. */
function pointerEvent(type: string, clientX: number): Event {
  try {
    return new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 })
  } catch {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 })
  }
}

function firePointerDown(node: Element, clientX: number): void {
  act(() => {
    node.dispatchEvent(pointerEvent('pointerdown', clientX))
  })
}
function firePointerMove(clientX: number): void {
  act(() => {
    window.dispatchEvent(pointerEvent('pointermove', clientX))
  })
}
function firePointerUp(clientX: number): void {
  act(() => {
    window.dispatchEvent(pointerEvent('pointerup', clientX))
  })
}

describe('Splitter — width-drag / commit contract (side="right")', () => {
  it('fires onDragWidth per pointermove and commits the final width ONCE on pointerup', () => {
    const onDragWidth = vi.fn()
    const onCommit = vi.fn()
    const h = mountSplitter({ onDragWidth, onCommit })
    try {
      // startX = 600, startWidth = 320. Drag left → panel grows.
      firePointerDown(h.separator(), 600)
      firePointerMove(560) // dx = 40  → 360
      firePointerMove(500) // dx = 100 → 420
      firePointerUp(500)

      expect(onDragWidth.mock.calls.map((c) => c[0])).toEqual([360, 420])
      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith(420) // last live width
    } finally {
      h.cleanup()
    }
  })

  it('clamps the candidate width to [minWidth, containerWidth * 0.5]', () => {
    const onDragWidth = vi.fn()
    const onCommit = vi.fn()
    // container 1000 → 50% cap = 500; minWidth 28.
    const h = mountSplitter({ onDragWidth, onCommit, panelWidth: 320, containerWidth: 1000, minWidth: 28 })
    try {
      firePointerDown(h.separator(), 600)
      firePointerMove(0)    // dx = 600 → 920 → capped to 500 (50%)
      firePointerMove(1000) // dx = -400 → -80 → floored to 28 (min)
      firePointerUp(1000)

      expect(onDragWidth.mock.calls.map((c) => c[0])).toEqual([500, 28])
      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith(28)
    } finally {
      h.cleanup()
    }
  })

  it('removes the window listeners on pointerup — a later move fires no more callbacks', () => {
    const onDragWidth = vi.fn()
    const onCommit = vi.fn()
    const h = mountSplitter({ onDragWidth, onCommit })
    try {
      firePointerDown(h.separator(), 600)
      firePointerMove(560) // → 360
      firePointerUp(560)   // commit 360, listeners removed

      onDragWidth.mockClear()
      firePointerMove(400) // inert — drag already ended
      expect(onDragWidth).not.toHaveBeenCalled()
      expect(onCommit).toHaveBeenCalledTimes(1)
    } finally {
      h.cleanup()
    }
  })
})
