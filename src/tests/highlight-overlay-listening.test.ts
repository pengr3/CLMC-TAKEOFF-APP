/** @vitest-environment jsdom */
/**
 * Regression guard tests (plan 06-03) — every Konva shape inside the two
 * transient overlay components MUST have `listening={false}`. If either
 * component lets a shape become hit-testable, the ring on top of a Count Pin
 * Group would steal the underlying Group's `onMouseEnter` / `onContextMenu`
 * events — breaking the existing tooltip and recolor flows (UI-SPEC §
 * "Transient overlay coexistence", D-11 / D-12).
 *
 * Strategy: Mock `react-konva` so its `Circle` / `Line` components render as
 * plain DOM nodes (a `<div>` per shape) carrying the original props as
 * `data-*` attributes. We then walk the rendered tree from jsdom and assert
 * every node carries `data-listening="false"`.
 *
 * Mirrors canvas-header-bar.test.ts (jsdom + React.createElement + createRoot).
 * The vitest include glob is *.test.ts — no JSX, only React.createElement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock react-konva BEFORE importing the components under test. Each Konva
// shape renders as a `<div>` carrying its props as data-attributes so jsdom
// queries can introspect them. Booleans/numbers are stringified so attribute
// readback returns predictable values; arrays are JSON-stringified.
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

import { HoverRing } from '@renderer/components/HoverRing'
import { PulseHighlight } from '@renderer/components/PulseHighlight'
import type { CountMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup } from '@renderer/types/markup'

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

function makeLinear(name = 'Wall'): LinearMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'linear',
    page: 1,
    name,
    categoryId: 'cat-1',
    color: '#d13438',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 }
    ],
    createdAt: 2
  }
}

function makeArea(name = 'Floor'): AreaMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'area',
    page: 1,
    name,
    categoryId: 'cat-1',
    color: '#107c10',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ],
    createdAt: 3
  }
}

function makePerimeter(name = 'Boundary'): PerimeterMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'perimeter',
    page: 1,
    name,
    categoryId: 'cat-1',
    color: '#bf6900',
    points: [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 110 }
    ],
    createdAt: 4
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HoverRing — listening={false} regression guard (D-11)', () => {
  it('every Konva shape inside HoverRing has listening={false}', () => {
    const markups = [makeCount(), makeLinear(), makeArea(), makePerimeter()]
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups, currentZoom: 1 })
    )
    try {
      const shapes = container.querySelectorAll('[data-konva-role]')
      // One shape per markup (4 total — 1 Circle + 3 Lines).
      expect(shapes.length).toBe(4)
      shapes.forEach((node) => {
        expect(node.getAttribute('data-listening')).toBe('false')
      })
    } finally {
      unmount()
    }
  })

  it('renders no Konva shapes when markups array is empty', () => {
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups: [], currentZoom: 1 })
    )
    try {
      const shapes = container.querySelectorAll('[data-konva-role]')
      expect(shapes.length).toBe(0)
    } finally {
      unmount()
    }
  })

  it('uses zoom-compensated stroke (divides by currentZoom)', () => {
    // At currentZoom = 4, stroke (base 2) should be 2/4 = 0.5.
    const markups = [makeCount()]
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups, currentZoom: 4 })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      const strokeWidth = parseFloat(circle.getAttribute('data-strokewidth')!)
      expect(strokeWidth).toBeCloseTo(0.5, 5)
    } finally {
      unmount()
    }
  })

  it('count markup ring radius = PIN_RADIUS_WORLD + (4 / currentZoom)', () => {
    // currentZoom=2 → radius = 10 + 4/2 = 12
    const markups = [makeCount()]
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups, currentZoom: 2 })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      const radius = parseFloat(circle.getAttribute('data-radius')!)
      expect(radius).toBeCloseTo(12, 5)
    } finally {
      unmount()
    }
  })

  it('white stroke at 0.4 opacity (UI-SPEC locked values)', () => {
    const markups = [makeCount()]
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups, currentZoom: 1 })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      expect(circle.getAttribute('data-stroke')).toBe('#ffffff')
      expect(parseFloat(circle.getAttribute('data-opacity')!)).toBeCloseTo(0.4, 5)
    } finally {
      unmount()
    }
  })

  it('area markup is rendered as a closed polygon (last point appended)', () => {
    const markups = [makeArea()]
    const { container, unmount } = mount(
      React.createElement(HoverRing, { markups, currentZoom: 1 })
    )
    try {
      const line = container.querySelector('[data-konva-role="line"]')!
      const points = JSON.parse(line.getAttribute('data-points')!) as number[]
      // makeArea() has 4 points (8 numbers); closing duplicates the first
      // point at the end (10 numbers total).
      expect(points.length).toBe(10)
      expect(points[0]).toBe(points[8])
      expect(points[1]).toBe(points[9])
    } finally {
      unmount()
    }
  })
})

describe('PulseHighlight — listening={false} regression guard (D-12)', () => {
  it('every Konva shape inside PulseHighlight has listening={false}', () => {
    const markups = [makeCount(), makeLinear(), makeArea(), makePerimeter()]
    const onComplete = (): void => {}
    const { container, unmount } = mount(
      React.createElement(PulseHighlight, {
        markups,
        color: '#0078d4',
        currentZoom: 1,
        onComplete
      })
    )
    try {
      const shapes = container.querySelectorAll('[data-konva-role]')
      // One shape per markup (4 total — 1 Circle + 3 Lines).
      expect(shapes.length).toBe(4)
      shapes.forEach((node) => {
        expect(node.getAttribute('data-listening')).toBe('false')
      })
    } finally {
      unmount()
    }
  })

  it('uses zoom-compensated peak stroke (6/currentZoom at t=0)', () => {
    // At currentZoom = 2, the t=0 stroke (peak 6) should be 6/2 = 3.
    const markups = [makeCount()]
    const onComplete = (): void => {}
    const { container, unmount } = mount(
      React.createElement(PulseHighlight, {
        markups,
        color: '#0078d4',
        currentZoom: 2,
        onComplete
      })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      // First-render strokeWidth is 6/zoom (peak) since rAF hasn't ticked yet.
      const strokeWidth = parseFloat(circle.getAttribute('data-strokewidth')!)
      expect(strokeWidth).toBeCloseTo(3, 5)
    } finally {
      unmount()
    }
  })

  it('uses per-name-group color from props (not hardcoded white)', () => {
    const markups = [makeCount()]
    const onComplete = (): void => {}
    const { container, unmount } = mount(
      React.createElement(PulseHighlight, {
        markups,
        color: '#bf6900',
        currentZoom: 1,
        onComplete
      })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      expect(circle.getAttribute('data-stroke')).toBe('#bf6900')
    } finally {
      unmount()
    }
  })

  it('count markup ring radius = PIN_RADIUS_WORLD + (8 / currentZoom)', () => {
    // currentZoom=2 → radius = 10 + 8/2 = 14 (sits OUTSIDE HoverRing's 12).
    const markups = [makeCount()]
    const onComplete = (): void => {}
    const { container, unmount } = mount(
      React.createElement(PulseHighlight, {
        markups,
        color: '#0078d4',
        currentZoom: 2,
        onComplete
      })
    )
    try {
      const circle = container.querySelector('[data-konva-role="circle"]')!
      const radius = parseFloat(circle.getAttribute('data-radius')!)
      expect(radius).toBeCloseTo(14, 5)
    } finally {
      unmount()
    }
  })
})
