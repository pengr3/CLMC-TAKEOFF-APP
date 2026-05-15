/**
 * RED stubs — Wave 0: hidden-item skip-render not yet implemented in any markup renderer.
 * All tests MUST FAIL at runtime (components render normally even when hidden).
 * TypeScript compiles cleanly.
 *
 * Strategy: mock react-konva so each Konva shape renders as a <div data-konva-role="...">.
 * If a component returns null (hidden), container will have no [data-konva-role] nodes.
 * If it renders normally (not hidden), we'll find nodes — and the expect(null) check fails.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

// Mock react-konva BEFORE importing the components under test.
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
      return React.createElement('div', data, (props.children as React.ReactNode) ?? null)
    }
  }
  return {
    Circle: makeStub('circle'),
    Line: makeStub('line'),
    Group: makeStub('group'),
    Layer: makeStub('layer'),
    Stage: makeStub('stage'),
    Text: makeStub('text'),
    Rect: makeStub('rect'),
  }
})

// Import AFTER mocking.
import { CountPinMarkup } from '@renderer/components/markup/CountPinMarkup'
import { LinearMarkup } from '@renderer/components/markup/LinearMarkup'
import { AreaMarkup } from '@renderer/components/markup/AreaMarkup'
import { PerimeterMarkup } from '@renderer/components/markup/PerimeterMarkup'
import type { CountMarkup, LinearMarkup as LinearMarkupType, AreaMarkup as AreaMarkupType, PerimeterMarkup as PerimeterMarkupType, Category } from '@renderer/types/markup'

const fakeCategory: Category = { id: 'cat-1', name: 'Test', color: '#dc2626', paletteIndex: 0 }
const commonProps = { category: fakeCategory, currentZoom: 1, pageScale: null }

function makeCount(name: string): CountMarkup {
  return { id: 'c1', type: 'count', page: 1, name, categoryId: 'cat-1', color: '#dc2626', createdAt: 1, sequence: 1, point: { x: 10, y: 10 } }
}
function makeLinear(name: string): LinearMarkupType {
  return { id: 'l1', type: 'linear', page: 1, name, categoryId: 'cat-1', color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }
}
function makeArea(name: string): AreaMarkupType {
  return { id: 'a1', type: 'area', page: 1, name, categoryId: 'cat-1', color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }
}
function makePerimeter(name: string): PerimeterMarkupType {
  return { id: 'p1', type: 'perimeter', page: 1, name, categoryId: 'cat-1', color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }
}

interface MountResult { container: HTMLElement; unmount: () => void }

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => { root.render(element) })
  return { container, unmount: () => { act(() => { root.unmount() }); container.remove() } }
}

beforeEach(() => {
  useMarkupStore.setState({ pageMarkups: {}, categories: {}, categoryOrder: [], undoStack: [], redoStack: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ currentFilePath: null, isDirty: false, isSaving: false, isExporting: false, lastSavedAt: null, hiddenItemNames: [] })
  document.body.innerHTML = ''
})

describe('markup renderers — hidden-item skip', () => {
  it('CountPinMarkup returns null when markup.name is in hiddenItemNames', () => {
    // MUST FAIL — hidden-item skip not yet implemented in CountPinMarkup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden'] })

    const { container, unmount } = mount(
      React.createElement(CountPinMarkup, { ...commonProps, markup: makeCount('Hidden') })
    )
    // If hidden, no Konva nodes should be rendered
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('LinearMarkup returns null when hidden', () => {
    // MUST FAIL — hidden-item skip not yet implemented in LinearMarkup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden'] })

    const { container, unmount } = mount(
      React.createElement(LinearMarkup, { ...commonProps, markup: makeLinear('Hidden') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('AreaMarkup returns null when hidden', () => {
    // MUST FAIL — hidden-item skip not yet implemented in AreaMarkup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden'] })

    const { container, unmount } = mount(
      React.createElement(AreaMarkup, { ...commonProps, markup: makeArea('Hidden') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('PerimeterMarkup returns null when hidden', () => {
    // MUST FAIL — hidden-item skip not yet implemented in PerimeterMarkup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden'] })

    const { container, unmount } = mount(
      React.createElement(PerimeterMarkup, { ...commonProps, markup: makePerimeter('Hidden') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })
})
