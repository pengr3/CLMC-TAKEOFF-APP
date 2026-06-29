/** @vitest-environment jsdom */
/**
 * ArcPreview render tests (plan 14-04 / D-01).
 *
 * Asserts the two branches of the live 3-click arc preview:
 *   (a) a NON-collinear start/on-arc/end input renders a CURVED sampled preview
 *       — a single points-bearing Konva Line with many points (NOT a 2-point
 *       straight Line) whose sampled vertices actually deviate from the straight
 *       chord (i.e. solveCircle was exercised and produced a real curve), with
 *       no NaN coordinates;
 *   (b) a COLLINEAR start/on-arc/end input degrades to a straight 2-point dashed
 *       Line (4 numbers: x0,y0,x1,y1), no Arc, no NaN radius.
 *
 * Strategy mirrors pulse-highlight-animation.test.ts: react-konva is mocked so
 * Line renders as a <div> carrying its props as data-* attributes, and jsdom
 * reads them back. The vitest include glob is *.test.ts, so JSX is not allowed —
 * we build the tree with React.createElement.
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
    Line: makeStub('line'),
    Arc: makeStub('arc'),
    Rect: makeStub('rect'),
    RegularPolygon: makeStub('regularpolygon'),
    Group: makeStub('group'),
    Layer: makeStub('layer')
  }
})

import { ArcPreview } from '@renderer/components/markup/ArcPreview'

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

// @ts-expect-error — React's act() uses this flag to validate the test env.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

function readPoints(el: Element): number[] {
  return JSON.parse(el.getAttribute('data-points')!) as number[]
}

describe('ArcPreview (D-01)', () => {
  it('renders a curved sampled preview (many points, off-chord) for non-collinear input', () => {
    // A clear semicircle: start (-100,0), on-arc top (0,100), end (100,0).
    const { container, unmount } = mount(
      React.createElement(ArcPreview, {
        start: { x: -100, y: 0 },
        onArc: { x: 0, y: 100 },
        end: { x: 100, y: 0 },
        currentZoom: 1,
        color: '#dc2626'
      })
    )
    try {
      const lines = container.querySelectorAll('[data-konva-role="line"]')
      expect(lines.length).toBe(1)
      const pts = readPoints(lines[0])
      // A sampled curve has many vertices, NOT a 2-point straight chord.
      expect(pts.length).toBeGreaterThan(4)
      // All coordinates finite (no NaN from the solver).
      expect(pts.every((n) => Number.isFinite(n))).toBe(true)
      // The curve must actually bend: at least one sampled point's y deviates
      // far from the straight chord (y=0 along this chord). solveCircle was
      // exercised and produced a real arc.
      const maxY = Math.max(...pts.filter((_, i) => i % 2 === 1))
      expect(maxY).toBeGreaterThan(50)
      // Stroke uses the passed color, not a hardcoded hex.
      expect(lines[0].getAttribute('data-stroke')).toBe('#dc2626')
    } finally {
      unmount()
    }
  })

  it('degrades to a straight 2-point dashed Line for collinear input (no NaN)', () => {
    // All three points on the x-axis → collinear → straight fallback.
    const { container, unmount } = mount(
      React.createElement(ArcPreview, {
        start: { x: 0, y: 0 },
        onArc: { x: 50, y: 0 },
        end: { x: 100, y: 0 },
        currentZoom: 2,
        color: '#0078d4'
      })
    )
    try {
      const lines = container.querySelectorAll('[data-konva-role="line"]')
      expect(lines.length).toBe(1)
      // Straight fallback = exactly the two endpoints (4 numbers).
      const pts = readPoints(lines[0])
      expect(pts).toEqual([0, 0, 100, 0])
      expect(pts.every((n) => Number.isFinite(n))).toBe(true)
      // No Arc node was rendered (the reserved degenerate-Arc path).
      expect(container.querySelectorAll('[data-konva-role="arc"]').length).toBe(0)
      // Zoom-compensation: strokeWidth = 2 / 2 = 1.
      expect(parseFloat(lines[0].getAttribute('data-strokewidth')!)).toBeCloseTo(1, 5)
      // Dash is zoom-compensated too: [8/2, 4/2] = [4, 2].
      expect(JSON.parse(lines[0].getAttribute('data-dash')!)).toEqual([4, 2])
    } finally {
      unmount()
    }
  })
})
