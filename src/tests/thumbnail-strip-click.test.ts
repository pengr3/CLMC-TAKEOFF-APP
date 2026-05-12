/** @vitest-environment jsdom */
/**
 * Tests for ThumbnailStrip — click-to-navigate (PDF-05) and tile rendering.
 *
 * Uses React.createElement (not JSX) — mirrors markup-context-menu.test.ts
 * convention (vitest.config.ts glob captures only *.test.ts, not .tsx).
 */

// Set act environment flag per pulse-highlight-animation.test.ts:66 and
// markup-tool-strictmode.test.ts:91 patterns.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock useThumbnailRender to avoid PDF.js canvas issues in jsdom
vi.mock('@renderer/hooks/useThumbnailRender', () => ({
  useThumbnailRender: vi.fn(() => ({
    pageCanvasRef: { current: null },
    overlayCanvasRef: { current: null },
    cssWidth: 140,
    cssHeight: 198,
    isRendering: false
  }))
}))

// Mock pdf-setup to prevent worker loading
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

// IntersectionObserver mock — must be a class (not arrow function) to support `new IO(...)`
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }
}

function setupIOmock(): void {
  MockIntersectionObserver.instances = []
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver
  })
}

import { ThumbnailStrip } from '@renderer/components/ThumbnailStrip'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

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
      act(() => root.unmount())
      container.remove()
    }
  }
}

beforeEach(() => {
  setupIOmock()

  useViewerStore.setState({
    filePath: '/test.pdf',
    fileName: 'test.pdf',
    currentPage: 1,
    totalPages: 3,
    pageViewports: {},
    pdfDocument: null,
    pageScales: {},
    activeTool: 'select'
  })
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

describe('ThumbnailStrip', () => {
  it('renders one Thumbnail tile per page (PDF-05)', () => {
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen: vi.fn()
      })
    )

    // With totalPages=3, there should be 3 tile wrappers with data-thumbnail-page
    const tiles = container.querySelectorAll('[data-thumbnail-page]')
    expect(tiles.length).toBe(3)

    unmount()
  })

  it('clicking a tile calls viewerStore.setPage(N) (PDF-05)', () => {
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen: vi.fn()
      })
    )

    // Clicking tile 2 should call setPage(2)
    const tile2 = container.querySelector('[data-thumbnail-page="2"]') as HTMLElement
    expect(tile2).not.toBeNull()

    act(() => {
      tile2.click()
    })

    // viewerStore.setPage(2) should have been called — verify via store state
    // (setPage clamps to [1, totalPages] so with totalPages=3, page 2 is valid)
    expect(useViewerStore.getState().currentPage).toBe(2)

    unmount()
  })

  it('active page tile has 2px accent border (D-16)', () => {
    // currentPage = 1, so tile for page 1 should have accent border
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen: vi.fn()
      })
    )

    const tile1 = container.querySelector('[data-thumbnail-page="1"]') as HTMLElement
    expect(tile1).not.toBeNull()
    // Active tile should have accent color border — check cssText for any variant jsdom expands to
    const cssText = tile1.style.cssText
    const hasAccentBorder = cssText.includes('#0078d4') || cssText.includes('rgb(0, 120, 212)')
    expect(hasAccentBorder).toBe(true)

    unmount()
  })

  it('idle page tile has 1px border (D-16)', () => {
    // currentPage = 1, so tiles for pages 2,3 should have idle border
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen: vi.fn()
      })
    )

    const tile2 = container.querySelector('[data-thumbnail-page="2"]') as HTMLElement
    expect(tile2).not.toBeNull()
    // Idle tile should have border with COLORS.border (#3c3c3c) — check cssText
    const cssText = tile2.style.cssText
    const hasIdleBorder = cssText.includes('#3c3c3c') || cssText.includes('rgb(60, 60, 60)')
    expect(hasIdleBorder).toBe(true)

    unmount()
  })

  it('renders collapsed rail with expand button when !open', () => {
    const onSetOpen = vi.fn()
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: false,
        width: 160,
        onSetOpen
      })
    )

    const expandBtn = container.querySelector('[aria-label="Expand Thumbnails"]')
    expect(expandBtn).not.toBeNull()

    act(() => {
      ;(expandBtn as HTMLElement).click()
    })
    expect(onSetOpen).toHaveBeenCalledWith(true)

    unmount()
  })

  it('renders collapse button when open', () => {
    const onSetOpen = vi.fn()
    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen
      })
    )

    const collapseBtn = container.querySelector('[aria-label="Collapse Thumbnails"]')
    expect(collapseBtn).not.toBeNull()

    act(() => {
      ;(collapseBtn as HTMLElement).click()
    })
    expect(onSetOpen).toHaveBeenCalledWith(false)

    unmount()
  })
})
