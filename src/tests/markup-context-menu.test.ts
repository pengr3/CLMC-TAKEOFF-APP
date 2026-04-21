/** @vitest-environment jsdom */
/**
 * Render tests for MarkupContextMenu (plan 03.1-05) — D-28/D-29 contract.
 *
 * Uses React.createElement (not JSX) because vitest.config.ts's include glob
 * captures only *.test.ts (not .tsx). Mirrors markup-namepopup.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MarkupContextMenu } from '@renderer/components/MarkupContextMenu'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'
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

function makeCount(page: number, name: string, color: string, createdAt: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color,
    sequence: 1,
    point: { x: 0, y: 0 },
    createdAt
  }
}

const baseProps = {
  screenPos: { x: 50, y: 50 },
  currentColor: MARKUP_PALETTE[0]
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
  document.body.innerHTML = ''
})

describe('MarkupContextMenu — structure + swatch contract (D-28)', () => {
  it('renders exactly 10 swatches inside a radiogroup and a Delete menuitem', () => {
    const { container, unmount } = mount(
      React.createElement(MarkupContextMenu, {
        ...baseProps,
        onRecolor: vi.fn(),
        onDelete: vi.fn(),
        onClose: vi.fn()
      })
    )
    const group = container.querySelector('[role="radiogroup"]')
    expect(group).not.toBeNull()
    const swatches = group!.querySelectorAll('[role="radio"]')
    expect(swatches.length).toBe(10)
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    )
    expect(deleteBtn).toBeDefined()
    expect(deleteBtn!.getAttribute('role')).toBe('menuitem')
    unmount()
  })

  it('currentColor prop marks exactly that swatch aria-checked="true"', () => {
    const { container, unmount } = mount(
      React.createElement(MarkupContextMenu, {
        ...baseProps,
        currentColor: MARKUP_PALETTE[6],
        onRecolor: vi.fn(),
        onDelete: vi.fn(),
        onClose: vi.fn()
      })
    )
    const checked = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-checked') === 'true'
    )
    expect(checked.length).toBe(1)
    expect(checked[0].getAttribute('aria-label')).toBe(`Color ${MARKUP_PALETTE[6]}`)
    unmount()
  })

  it('clicking a swatch calls onRecolor(hex) then onClose', () => {
    const onRecolor = vi.fn()
    const onClose = vi.fn()
    const { container, unmount } = mount(
      React.createElement(MarkupContextMenu, {
        ...baseProps,
        onRecolor,
        onDelete: vi.fn(),
        onClose
      })
    )
    const swatch = container.querySelectorAll('[role="radio"]')[4] as HTMLButtonElement
    act(() => {
      swatch.click()
    })
    expect(onRecolor).toHaveBeenCalledWith(MARKUP_PALETTE[4])
    expect(onRecolor).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
    unmount()
  })

  it('clicking Delete calls onDelete then onClose', () => {
    const onDelete = vi.fn()
    const onClose = vi.fn()
    const { container, unmount } = mount(
      React.createElement(MarkupContextMenu, {
        ...baseProps,
        onRecolor: vi.fn(),
        onDelete,
        onClose
      })
    )
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    ) as HTMLButtonElement
    act(() => {
      deleteBtn.click()
    })
    expect(onDelete).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    unmount()
  })

  it('Escape key calls onClose (not onRecolor / not onDelete)', async () => {
    const onClose = vi.fn()
    const onRecolor = vi.fn()
    const onDelete = vi.fn()
    const { unmount } = mount(
      React.createElement(MarkupContextMenu, {
        ...baseProps,
        onRecolor,
        onDelete,
        onClose
      })
    )
    // setTimeout(0) defers listener registration — wait a microtask tick
    await new Promise((r) => setTimeout(r, 10))
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalled()
    expect(onRecolor).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
    unmount()
  })
})

describe('MarkupContextMenu + markupStore.recolorGroup integration (D-29)', () => {
  it('onRecolor wired to recolorGroup flips every markup sharing the name', () => {
    const markupA = makeCount(1, 'Switch', MARKUP_PALETTE[0], 1)
    const markupB = makeCount(1, 'Switch', MARKUP_PALETTE[0], 2)
    const markupC = makeCount(1, 'Outlet', MARKUP_PALETTE[0], 3)
    useMarkupStore.setState({
      pageMarkups: { 1: [markupA, markupB, markupC] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[5])

    const markups = useMarkupStore.getState().getMarkups(1)
    const switches = markups.filter((m) => m.name === 'Switch')
    const outlets = markups.filter((m) => m.name === 'Outlet')
    expect(switches.every((m) => m.color === MARKUP_PALETTE[5])).toBe(true)
    // Other names are untouched — D-29 scope is name-group, not all markups
    expect(outlets.every((m) => m.color === MARKUP_PALETTE[0])).toBe(true)
  })
})
