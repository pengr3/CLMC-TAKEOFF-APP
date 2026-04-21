/** @vitest-environment jsdom */
/**
 * Render tests for MarkupNamePopup — D-25 inheritance + D-26 palette + D-28 payload shape.
 *
 * Uses React.createElement (not JSX) because this test file has a `.ts` extension and
 * vitest.config.ts's include glob captures only `*.test.ts` (not `.tsx`). Creating
 * elements programmatically keeps us within the existing pipeline without touching config.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MarkupNamePopup } from '@renderer/components/MarkupNamePopup'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'
import type { CountMarkup } from '@renderer/types/markup'

function makeCount(page: number, name: string, color: string, createdAt: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color,
    sequence: 1,
    point: { x: 10, y: 10 },
    createdAt
  }
}

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(element) })
  return {
    container,
    root,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    }
  }
}

const defaultProps = {
  mode: 'count-pre' as const,
  screenPos: { x: 100, y: 100 },
  containerSize: { width: 1000, height: 800 },
  onConfirm: vi.fn(),
  onCancel: vi.fn()
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  vi.clearAllMocks()
  // Reset body between tests to avoid leaked nodes
  document.body.innerHTML = ''
})

describe('MarkupNamePopup — color swatch row (D-26)', () => {
  it('renders exactly 10 swatch buttons inside a radiogroup', () => {
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, defaultProps)
    )
    const group = container.querySelector('[role="radiogroup"]')
    expect(group).not.toBeNull()
    const swatches = group!.querySelectorAll('[role="radio"]')
    expect(swatches.length).toBe(10)
    unmount()
  })

  it('defaults to first palette color (MARKUP_PALETTE[0]) when store is empty', () => {
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, defaultProps)
    )
    const swatches = container.querySelectorAll('[role="radio"]')
    const checked = Array.from(swatches).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[0]}`)
    unmount()
  })

  it('clicking a swatch makes aria-checked exclusive to that swatch', () => {
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, defaultProps)
    )
    const swatches = container.querySelectorAll('[role="radio"]')
    const target = swatches[4] as HTMLButtonElement // 5th swatch
    act(() => { target.click() })
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[4]}`)
    unmount()
  })

  it('onConfirm payload includes the selected color + name + categoryName', () => {
    const onConfirm = vi.fn()
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, { ...defaultProps, onConfirm })
    )
    // Type a name via the input's native value setter so React picks up the change
    const nameInput = container.querySelector(
      'input[placeholder*="Light"]'
    ) as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!
    act(() => {
      valueSetter.call(nameInput, 'Switch')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // Click swatch 3 (index 3 → MARKUP_PALETTE[3])
    const swatches = container.querySelectorAll('[role="radio"]')
    act(() => { (swatches[3] as HTMLButtonElement).click() })
    // Click the primary button ("Start Count" in count-pre mode)
    const primaryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Start Count'
    ) as HTMLButtonElement
    act(() => { primaryBtn.click() })

    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Switch',
      categoryName: '',
      color: MARKUP_PALETTE[3]
    })
    unmount()
  })
})

describe('MarkupNamePopup — D-25 color inheritance', () => {
  it('pre-selects existing color when initialName matches a stored markup', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'Switch', MARKUP_PALETTE[5], 1000)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, { ...defaultProps, initialName: 'Switch' })
    )
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[5]}`)
    unmount()
  })

  it('auto-switches selected color when user types a known name', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'Switch', MARKUP_PALETTE[7], 1000)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, defaultProps)
    )
    const nameInput = container.querySelector(
      'input[placeholder*="Light"]'
    ) as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!
    act(() => {
      valueSetter.call(nameInput, 'Switch')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[7]}`)
    unmount()
  })

  it('user override sticks — typing a known name after clicking a swatch keeps the user choice', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'Switch', MARKUP_PALETTE[7], 1000)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, defaultProps)
    )
    // User clicks swatch 2 first (manual override)
    const swatches = container.querySelectorAll('[role="radio"]')
    act(() => { (swatches[2] as HTMLButtonElement).click() })
    // Then types "Switch" — inheritance should NOT override their choice
    const nameInput = container.querySelector(
      'input[placeholder*="Light"]'
    ) as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!
    act(() => {
      valueSetter.call(nameInput, 'Switch')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[2]}`)
    unmount()
  })

  it('initialColor prop is honored over inheritance and disables auto-switch', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'Switch', MARKUP_PALETTE[7], 1000)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(
      React.createElement(MarkupNamePopup, {
        ...defaultProps,
        initialName: 'Switch',
        initialColor: MARKUP_PALETTE[9]
      })
    )
    // Should show the explicit initialColor, not the inherited MARKUP_PALETTE[7]
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[9]}`)
    unmount()
  })
})
