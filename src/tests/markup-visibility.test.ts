/**
 * Hidden-item skip-render tests for all five markup renderer components.
 *
 * Strategy: mock react-konva so each Konva shape renders as a <div data-konva-role="...">.
 * If a component returns null (hidden), container will have no [data-konva-role] nodes.
 * If it renders normally (not hidden), we'll find nodes.
 *
 * Visibility key is the composite string `name|categoryId` (not bare name), so
 * these tests seed `hiddenItemSet` with e.g. `new Set(['Hidden|cat-1'])` and use
 * markups that have `categoryId: 'cat-1'`.
 *
 * This also verifies that two markups sharing the same name but different
 * categoryIds hide independently (only the matching one is suppressed).
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

function makeCount(name: string, categoryId = 'cat-1'): CountMarkup {
  return { id: 'c1', type: 'count', page: 1, name, categoryId, color: '#dc2626', createdAt: 1, sequence: 1, point: { x: 10, y: 10 } }
}
function makeLinear(name: string, categoryId = 'cat-1'): LinearMarkupType {
  return { id: 'l1', type: 'linear', page: 1, name, categoryId, color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }
}
function makeArea(name: string, categoryId = 'cat-1'): AreaMarkupType {
  return { id: 'a1', type: 'area', page: 1, name, categoryId, color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }
}
function makePerimeter(name: string, categoryId = 'cat-1'): PerimeterMarkupType {
  return { id: 'p1', type: 'perimeter', page: 1, name, categoryId, color: '#dc2626', createdAt: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }
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
  ;(useProjectStore as any).setState({ currentFilePath: null, isDirty: false, isSaving: false, isExporting: false, lastSavedAt: null, hiddenItemNames: [], hiddenItemSet: new Set<string>() })
  document.body.innerHTML = ''
})

describe('markup renderers — hidden-item skip (composite key)', () => {
  it('CountPinMarkup returns null when composite key "name|categoryId" is in hiddenItemSet', () => {
    // Composite key for name="Hidden", categoryId="cat-1" is "Hidden|cat-1"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|cat-1'], hiddenItemSet: new Set(['Hidden|cat-1']) })

    const { container, unmount } = mount(
      React.createElement(CountPinMarkup, { ...commonProps, markup: makeCount('Hidden', 'cat-1') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('CountPinMarkup renders normally when only a different category is hidden', () => {
    // Only "Hidden|cat-2" is hidden; our markup is "Hidden|cat-1"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|cat-2'], hiddenItemSet: new Set(['Hidden|cat-2']) })

    const { container, unmount } = mount(
      React.createElement(CountPinMarkup, { ...commonProps, markup: makeCount('Hidden', 'cat-1') })
    )
    // Should render (not hidden) — nodes exist
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBeGreaterThan(0)
    unmount()
  })

  it('LinearMarkup returns null when composite key is in hiddenItemSet', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|cat-1'], hiddenItemSet: new Set(['Hidden|cat-1']) })

    const { container, unmount } = mount(
      React.createElement(LinearMarkup, { ...commonProps, markup: makeLinear('Hidden', 'cat-1') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('AreaMarkup returns null when composite key is in hiddenItemSet', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|cat-1'], hiddenItemSet: new Set(['Hidden|cat-1']) })

    const { container, unmount } = mount(
      React.createElement(AreaMarkup, { ...commonProps, markup: makeArea('Hidden', 'cat-1') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('PerimeterMarkup returns null when composite key is in hiddenItemSet', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|cat-1'], hiddenItemSet: new Set(['Hidden|cat-1']) })

    const { container, unmount } = mount(
      React.createElement(PerimeterMarkup, { ...commonProps, markup: makePerimeter('Hidden', 'cat-1') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })

  it('uncategorized markup uses key "name|" (empty string suffix)', () => {
    // Uncategorized: categoryId='' → key "Hidden|"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useProjectStore as any).setState({ hiddenItemNames: ['Hidden|'], hiddenItemSet: new Set(['Hidden|']) })

    const { container, unmount } = mount(
      React.createElement(CountPinMarkup, { ...commonProps, markup: makeCount('Hidden', '') })
    )
    const nodes = container.querySelectorAll('[data-konva-role]')
    expect(nodes.length).toBe(0)
    unmount()
  })
})
