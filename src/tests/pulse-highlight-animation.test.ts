/** @vitest-environment jsdom */
/**
 * PulseHighlight animation tests (plan 06-03 / D-12).
 *
 * Asserts the parent-owned-lifecycle 1500ms rAF fade-out contract:
 *   - opacity starts at 0.85, reaches ~0 at t=1
 *   - stroke linearly deflates 6/zoom → 2/zoom over 1500ms
 *   - onComplete fires when progress reaches 1
 *   - cancelAnimationFrame is called on unmount (no React state-update-on-
 *     unmounted-component warning)
 *
 * Strategy: stub `requestAnimationFrame` / `cancelAnimationFrame` with a
 * controllable queue so we can drive frames deterministically. We also stub
 * `performance.now` so the simulated time advances exactly 1500ms across the
 * fade. react-konva is mocked the same way as in
 * highlight-overlay-listening.test.ts — Circle / Line render as <div> with
 * props as data-* attributes — so jsdom queries can read the live opacity /
 * strokeWidth values rendered on the most recent frame.
 *
 * Mirrors canvas-header-bar.test.ts (jsdom + React.createElement render
 * harness; vitest include glob is *.test.ts so JSX is not allowed).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('react-konva', () => {
  function makeStub(role: string) {
    return function KonvaStub(props: Record<string, unknown>): React.ReactElement {
      const data: Record<string, string> = { 'data-konva-role': role }
      for (const key of Object.keys(props)) {
        if (key === 'children' || key === 'key') continue
        const v = props[key]
        if (v === undefined || v === null) continue
        if (typeof v === 'function') continue
        if (Array.isArray(v) || typeof v === 'object') {
          data[`data-${key.toLowerCase()}`] = JSON.stringify(v)
        } else {
          data[`data-${key.toLowerCase()}`] = String(v)
        }
      }
      return React.createElement('div', data)
    }
  }
  return {
    Circle: makeStub('circle'),
    Line: makeStub('line'),
    Group: makeStub('group'),
    Layer: makeStub('layer'),
    Stage: makeStub('stage'),
    Rect: makeStub('rect'),
    Text: makeStub('text'),
    Image: makeStub('image')
  }
})

import { PulseHighlight } from '@renderer/components/PulseHighlight'
import type { CountMarkup } from '@renderer/types/markup'

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

function makeCount(name = 'Outlet'): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page: 1,
    name,
    categoryId: 'cat-1',
    color: '#0078d4',
    sequence: 1,
    point: { x: 50, y: 60 },
    createdAt: 1
  }
}

/**
 * Drive requestAnimationFrame deterministically. Each call to advance(ms)
 * sets the simulated `performance.now()` value, then flushes the queued
 * rAF callback (running it inside React.act so state updates commit).
 */
interface RafController {
  advance: (ms: number) => void
  cancelCalls: number[]
  scheduledIds: Set<number>
  install: () => void
  uninstall: () => void
}

function installRafController(): RafController {
  let now = 0
  let nextId = 1
  let queued: { id: number; cb: FrameRequestCallback } | null = null
  const scheduledIds = new Set<number>()
  const cancelCalls: number[] = []

  const originalRaf = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  const originalNow = performance.now.bind(performance)

  function install(): void {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      const id = nextId++
      queued = { id, cb }
      scheduledIds.add(id)
      return id
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number): void => {
      cancelCalls.push(id)
      if (queued && queued.id === id) {
        queued = null
      }
      scheduledIds.delete(id)
    }) as typeof cancelAnimationFrame
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  }

  function uninstall(): void {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
    // performance.now restored by vi.restoreAllMocks() in afterEach
    void originalNow
  }

  function advance(ms: number): void {
    now += ms
    if (queued) {
      const { cb } = queued
      // Drain in act() so React state updates flush.
      act(() => {
        cb(now)
      })
    }
  }

  return {
    advance,
    get cancelCalls() {
      return cancelCalls
    },
    scheduledIds,
    install,
    uninstall
  }
}

// @ts-expect-error — React's act() uses this flag to validate the test env.
// Without it React 19 emits "The current testing environment is not configured
// to support act(...)" which the unmount-cleanup test's errSpy would catch as
// a false positive. Mirrors markup-tool-pop-last-point.test.ts:66 and
// markup-tool-strictmode.test.ts:91.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PulseHighlight animation (D-12)', () => {
  it('opacity starts at OPACITY_PEAK (0.85) on first render', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { container, unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 1,
          onComplete
        })
      )
      try {
        const circle = container.querySelector('[data-konva-role="circle"]')!
        const opacity = parseFloat(circle.getAttribute('data-opacity')!)
        // At t=0: easeOut = 1 - (1-0)^2 = 0; opacity = 0.85 * (1 - 0) = 0.85.
        expect(opacity).toBeCloseTo(0.85, 5)
        expect(onComplete).not.toHaveBeenCalled()
      } finally {
        unmount()
      }
    } finally {
      raf.uninstall()
    }
  })

  it('opacity reaches ~0 at t=1 (after simulated 1500ms)', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { container, unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 1,
          onComplete
        })
      )
      try {
        // First-rendered state already kicked off rAF — advance 1500ms in
        // one tick to drive progress to 1.
        raf.advance(1500)
        const circle = container.querySelector('[data-konva-role="circle"]')!
        const opacity = parseFloat(circle.getAttribute('data-opacity')!)
        // At t=1: easeOut = 1 - 0^2 = 1; opacity = 0.85 * (1 - 1) = 0.
        expect(opacity).toBeCloseTo(0, 5)
      } finally {
        unmount()
      }
    } finally {
      raf.uninstall()
    }
  })

  it('stroke decreases linearly from 6/zoom to 2/zoom over 1500ms (D-12)', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { container, unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 2,
          onComplete
        })
      )
      try {
        // t=0 → strokeWidth = 6/2 = 3 (peak)
        const circleAtStart = container.querySelector('[data-konva-role="circle"]')!
        expect(parseFloat(circleAtStart.getAttribute('data-strokewidth')!)).toBeCloseTo(3, 5)

        // t=0.5 → strokePx = 6 + (2-6)*0.5 = 4; strokeWidth = 4/2 = 2.
        raf.advance(750)
        const circleMid = container.querySelector('[data-konva-role="circle"]')!
        expect(parseFloat(circleMid.getAttribute('data-strokewidth')!)).toBeCloseTo(2, 5)

        // t=1 → strokePx = 2; strokeWidth = 2/2 = 1.
        raf.advance(750)
        const circleEnd = container.querySelector('[data-konva-role="circle"]')!
        expect(parseFloat(circleEnd.getAttribute('data-strokewidth')!)).toBeCloseTo(1, 5)
      } finally {
        unmount()
      }
    } finally {
      raf.uninstall()
    }
  })

  it('calls onComplete when fade reaches t=1', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 1,
          onComplete
        })
      )
      try {
        expect(onComplete).not.toHaveBeenCalled()
        raf.advance(1500)
        expect(onComplete).toHaveBeenCalledTimes(1)
      } finally {
        unmount()
      }
    } finally {
      raf.uninstall()
    }
  })

  it('does NOT call onComplete before t=1', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 1,
          onComplete
        })
      )
      try {
        raf.advance(1499)
        expect(onComplete).not.toHaveBeenCalled()
      } finally {
        unmount()
      }
    } finally {
      raf.uninstall()
    }
  })

  it('cancelAnimationFrame is called on unmount (no state update on unmounted component)', () => {
    const raf = installRafController()
    raf.install()
    try {
      const onComplete = vi.fn()
      const { unmount } = mount(
        React.createElement(PulseHighlight, {
          markups: [makeCount()],
          color: '#0078d4',
          currentZoom: 1,
          onComplete
        })
      )
      // Mid-animation unmount.
      raf.advance(500)
      // Spy on console.error to detect any "state update on unmounted" warning
      // React may emit if cleanup is broken.
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        unmount()
        // After unmount, the queued frame's id should have been cancelled.
        expect(raf.cancelCalls.length).toBeGreaterThanOrEqual(1)
        // No React warning fired during unmount.
        expect(errSpy).not.toHaveBeenCalled()
      } finally {
        errSpy.mockRestore()
      }
    } finally {
      raf.uninstall()
    }
  })
})
