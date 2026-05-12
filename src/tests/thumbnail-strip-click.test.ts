/** @vitest-environment jsdom */
/**
 * Tests for ThumbnailStrip — click-to-navigate (PDF-05) and tile rendering.
 *
 * Uses React.createElement (not JSX) — mirrors markup-context-menu.test.ts
 * convention (vitest.config.ts glob captures only *.test.ts, not .tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock canvas + IntersectionObserver for jsdom
vi.mock('@renderer/hooks/useThumbnailRender', () => ({
  useThumbnailRender: vi.fn(() => ({
    pageCanvasRef: { current: null },
    overlayCanvasRef: { current: null },
    cssWidth: 140,
    cssHeight: 198,
    isRendering: false
  }))
}))

// Mock pdf-setup
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

// Install IntersectionObserver mock globally
let ioCallback: IntersectionObserverCallback | null = null
const mockIOInstances: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; callback: IntersectionObserverCallback }> = []

function setupIntersectionObserverMock(): void {
  mockIOInstances.length = 0
  ioCallback = null
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: vi.fn((callback: IntersectionObserverCallback) => {
      ioCallback = callback
      const instance = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        callback
      }
      mockIOInstances.push(instance)
      return instance
    })
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
  setupIntersectionObserverMock()

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

    // With totalPages=3, there should be 3 tile wrappers
    // Tiles are identified by data-thumbnail-page attribute
    const tiles = container.querySelectorAll('[data-thumbnail-page]')
    expect(tiles.length).toBe(3)

    unmount()
  })

  it('clicking a tile calls viewerStore.setPage(N) (PDF-05)', () => {
    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')

    const { container, unmount } = mount(
      React.createElement(ThumbnailStrip, {
        open: true,
        width: 160,
        onSetOpen: vi.fn()
      })
    )

    // Click the tile for page 2
    const tile2 = container.querySelector('[data-thumbnail-page="2"]') as HTMLElement
    expect(tile2).not.toBeNull()

    act(() => {
      tile2.click()
    })

    expect(setPageSpy).toHaveBeenCalledWith(2)
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
    // Active tile should have accent color border
    const style = tile1.style
    // Accept either outline or border with accent color
    const hasAccentBorder =
      style.outline?.includes('#0078d4') ||
      style.border?.includes('#0078d4') ||
      style.borderColor === '#0078d4'
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
    // Idle tile should have border with COLORS.border (#3c3c3c)
    const style = tile2.style
    const hasIdleBorder =
      style.outline?.includes('#3c3c3c') ||
      style.border?.includes('#3c3c3c') ||
      style.borderColor === '#3c3c3c'
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

    // Click expand
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
