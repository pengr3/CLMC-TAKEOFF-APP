/** @vitest-environment jsdom */
/**
 * useDraggable — D-10/D-11/D-12/D-14 modal drag hook.
 *
 * Coverage:
 *   1. Initial position === null on mount (D-14)
 *   2. pointermove updates position after onPointerDown was triggered on a
 *      non-interactive element
 *   3. onPointerDown on an interactive control (INPUT, BUTTON, SELECT, TEXTAREA,
 *      role="button") MUST NOT start a drag — pointermove after that target
 *      leaves position unchanged (D-12 enhanced guard via .closest())
 *   4. window.removeEventListener is called for pointermove and pointerup on
 *      unmount — no listener leak (Pitfall 8 / T-09-01-01)
 *   5. Remount resets position to null (D-14)
 *   6. Position is clamped to ±(window.innerWidth/2 - 50) and ±(window.innerHeight/2 - 50)
 *      so the drag handle remains reachable at all times (review concern)
 *
 * Uses createRoot + useLayoutEffect-into-holder pattern (matches
 * use-ui-panels.test.ts) so the eslint-plugin-react-hooks v7
 * react-hooks/immutability rule is not violated.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useDraggable, type UseDraggableReturn } from '@renderer/hooks/useDraggable'

interface Harness {
  current: () => UseDraggableReturn
  cleanup: () => void
}

async function callHook(): Promise<Harness> {
  const holder: { value: UseDraggableReturn | null } = { value: null }

  function HarnessComp(): null {
    const v = useDraggable()
    React.useLayoutEffect(() => {
      holder.value = v
    })
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(HarnessComp))
    await new Promise<void>((res) => setTimeout(res, 0))
  })

  return {
    current: () => {
      if (!holder.value) throw new Error('useDraggable harness — no value captured yet')
      return holder.value
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

/**
 * Build a synthetic React.PointerEvent-shaped object accepted by the onPointerDown
 * handler. The handler uses .target, .clientX, .clientY, .pointerId, and
 * e.currentTarget.setPointerCapture — all of which we stub here.
 */
function makePointerDown(opts: {
  target: HTMLElement
  clientX?: number
  clientY?: number
}): React.PointerEvent {
  const setPointerCapture = vi.fn()
  return {
    target: opts.target,
    currentTarget: { setPointerCapture } as unknown as Element,
    clientX: opts.clientX ?? 100,
    clientY: opts.clientY ?? 100,
    pointerId: 1
  } as unknown as React.PointerEvent
}

function dispatchPointerMove(clientX: number, clientY: number): void {
  const ev = new Event('pointermove') as PointerEvent & { clientX: number; clientY: number }
  ;(ev as unknown as { clientX: number }).clientX = clientX
  ;(ev as unknown as { clientY: number }).clientY = clientY
  window.dispatchEvent(ev)
}

function dispatchPointerUp(): void {
  window.dispatchEvent(new Event('pointerup'))
}

beforeEach(() => {
  document.body.innerHTML = ''
  // jsdom defaults: innerWidth=1024, innerHeight=768 — keep deterministic for clamp tests
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
})

describe('useDraggable — initial state (D-14)', () => {
  it('returns position === null on initial mount (no drag yet)', async () => {
    const h = await callHook()
    try {
      expect(h.current().position).toBeNull()
    } finally {
      h.cleanup()
    }
  })
})

describe('useDraggable — drag flow (D-11)', () => {
  it('pointermove after onPointerDown on non-interactive element updates position by delta', async () => {
    const h = await callHook()
    try {
      // Trigger drag start on a plain DIV (non-interactive)
      const div = document.createElement('div')
      document.body.appendChild(div)

      await act(async () => {
        h.current().onPointerDown(makePointerDown({ target: div, clientX: 100, clientY: 100 }))
      })

      // Move pointer by (+50, +30)
      await act(async () => {
        dispatchPointerMove(150, 130)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      const pos = h.current().position
      expect(pos).not.toBeNull()
      expect(pos!.x).toBe(50)
      expect(pos!.y).toBe(30)
    } finally {
      h.cleanup()
    }
  })
})

describe('useDraggable — interactive control guard (D-12)', () => {
  it.each([
    ['button', 'BUTTON'],
    ['input', 'INPUT'],
    ['select', 'SELECT'],
    ['textarea', 'TEXTAREA']
  ])('skips drag when onPointerDown target is <%s>', async (tag) => {
    const h = await callHook()
    try {
      const el = document.createElement(tag) as HTMLElement
      document.body.appendChild(el)

      await act(async () => {
        h.current().onPointerDown(makePointerDown({ target: el, clientX: 100, clientY: 100 }))
      })

      await act(async () => {
        dispatchPointerMove(200, 200)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      // Position should remain null — drag never started
      expect(h.current().position).toBeNull()
    } finally {
      h.cleanup()
    }
  })

  it('skips drag when onPointerDown target is a span with role="button" (closest() match)', async () => {
    const h = await callHook()
    try {
      const wrapper = document.createElement('span')
      wrapper.setAttribute('role', 'button')
      const inner = document.createElement('span')
      // Inner is the actual click target; .closest('[role="button"]') still matches the wrapper
      wrapper.appendChild(inner)
      document.body.appendChild(wrapper)

      await act(async () => {
        h.current().onPointerDown(makePointerDown({ target: inner, clientX: 100, clientY: 100 }))
      })

      await act(async () => {
        dispatchPointerMove(200, 200)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      expect(h.current().position).toBeNull()
    } finally {
      h.cleanup()
    }
  })
})

describe('useDraggable — cleanup (T-09-01-01, Pitfall 8)', () => {
  it('removes pointermove and pointerup listeners from window on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const h = await callHook()

    h.cleanup()

    const removed = removeSpy.mock.calls.map((c) => c[0])
    expect(removed).toContain('pointermove')
    expect(removed).toContain('pointerup')

    removeSpy.mockRestore()
  })
})

describe('useDraggable — remount resets to null (D-14)', () => {
  it('after dragging then remounting, position is null again', async () => {
    // First mount: drag to (+50, +30)
    const h1 = await callHook()
    const div = document.createElement('div')
    document.body.appendChild(div)
    await act(async () => {
      h1.current().onPointerDown(makePointerDown({ target: div, clientX: 100, clientY: 100 }))
    })
    await act(async () => {
      dispatchPointerMove(150, 130)
      dispatchPointerUp()
      await new Promise<void>((res) => setTimeout(res, 0))
    })
    expect(h1.current().position).not.toBeNull()
    h1.cleanup()

    // Second mount: fresh hook instance, position must be null
    const h2 = await callHook()
    try {
      expect(h2.current().position).toBeNull()
    } finally {
      h2.cleanup()
    }
  })
})

describe('useDraggable — viewport clamping (review concern)', () => {
  it('clamps x to +(window.innerWidth/2 - 50) when dragged far right', async () => {
    const h = await callHook()
    try {
      const div = document.createElement('div')
      document.body.appendChild(div)
      await act(async () => {
        h.current().onPointerDown(makePointerDown({ target: div, clientX: 100, clientY: 100 }))
      })
      // window.innerWidth=1024 → clampX = 462. Drag delta of +10000 must clamp.
      await act(async () => {
        dispatchPointerMove(10100, 100)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      const expectedClampX = window.innerWidth / 2 - 50 // 462
      const expectedClampY = window.innerHeight / 2 - 50 // 334
      const pos = h.current().position
      expect(pos).not.toBeNull()
      expect(pos!.x).toBe(expectedClampX)
      // Y did not move beyond clamp, so it should be unchanged from start (= 0)
      expect(pos!.y).toBe(0)
      expect(expectedClampY).toBe(334) // sanity — assertion about clamp constant itself
    } finally {
      h.cleanup()
    }
  })

  it('clamps y to -(window.innerHeight/2 - 50) when dragged far up', async () => {
    const h = await callHook()
    try {
      const div = document.createElement('div')
      document.body.appendChild(div)
      await act(async () => {
        h.current().onPointerDown(makePointerDown({ target: div, clientX: 100, clientY: 100 }))
      })
      await act(async () => {
        dispatchPointerMove(100, -10000)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      const expectedClampY = -(window.innerHeight / 2 - 50) // -334
      const pos = h.current().position
      expect(pos).not.toBeNull()
      expect(pos!.y).toBe(expectedClampY)
    } finally {
      h.cleanup()
    }
  })
})
