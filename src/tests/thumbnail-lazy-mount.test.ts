/** @vitest-environment jsdom */
/**
 * Tests for Thumbnail lazy mount via IntersectionObserver (D-17).
 *
 * Uses React.createElement (not JSX) — mirrors existing .test.ts convention.
 */

// Set act environment flag per pulse-highlight-animation.test.ts:66 pattern.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Track calls to useThumbnailRender
const mockRenderCalled = vi.fn()

vi.mock('@renderer/hooks/useThumbnailRender', () => ({
  useThumbnailRender: vi.fn((_pdfDoc: unknown, pageNumber: number) => {
    if (_pdfDoc !== null) {
      mockRenderCalled(pageNumber)
    }
    return {
      pageCanvasRef: { current: null },
      overlayCanvasRef: { current: null },
      cssWidth: 140,
      cssHeight: 198,
      isRendering: false
    }
  })
}))

// Mock pdf-setup
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

// IntersectionObserver mock — class-based (not arrow function)
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  elements: Element[] = []
  observe = vi.fn((el: Element) => { this.elements.push(el) })
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  triggerIntersection(isIntersecting: boolean): void {
    const entries: IntersectionObserverEntry[] = this.elements.map((el) => ({
      isIntersecting,
      target: el,
      boundingClientRect: el.getBoundingClientRect(),
      intersectionRect: isIntersecting ? el.getBoundingClientRect() : ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRectReadOnly),
      rootBounds: null,
      intersectionRatio: isIntersecting ? 1 : 0,
      time: performance.now()
    }))
    act(() => {
      this.callback(entries, this as unknown as IntersectionObserver)
    })
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

import { Thumbnail } from '@renderer/components/Thumbnail'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mountThumbnail(pageNumber: number, isActive = false): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      React.createElement(Thumbnail, {
        pageNumber,
        isActive,
        pageLabel: `Page ${pageNumber}`,
        pageScale: null,
        markupCount: 0
      })
    )
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

describe('Thumbnail lazy mount', () => {
  it('tile does NOT call useThumbnailRender with pdfDoc while NOT intersecting (D-17)', () => {
    // pdfDocument is null in store, and isVisible starts false
    // so useThumbnailRender receives null pdfDocument (not yet visible)
    const { unmount } = mountThumbnail(1)

    // No intersection triggered — mockRenderCalled should not have been called
    // (only called when pdfDoc is non-null, which only happens after intersection)
    expect(mockRenderCalled).not.toHaveBeenCalled()

    unmount()
  })

  it('IntersectionObserver intersection triggers rasterization (D-17)', () => {
    // Set a fake pdfDocument so when intersection fires, useThumbnailRender gets a real doc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useViewerStore.setState({ pdfDocument: { getPage: vi.fn(), getPageLabels: vi.fn() } as any })

    const { unmount } = mountThumbnail(1)

    // Before intersection: no render called with pdfDoc
    expect(mockRenderCalled).not.toHaveBeenCalled()

    // Get the IO instance that was created for this tile
    const ioInstance = MockIntersectionObserver.instances[0]
    expect(ioInstance).toBeDefined()

    // Trigger intersection
    ioInstance.triggerIntersection(true)

    // After intersection: useThumbnailRender should have been called with pageNumber=1
    expect(mockRenderCalled).toHaveBeenCalledWith(1)

    unmount()
  })

  it('non-intersecting tile shows skeleton placeholder (no canvas)', () => {
    const { container, unmount } = mountThumbnail(1)

    // Before intersection: tile should show skeleton
    const tileWrapper = container.querySelector('[data-thumbnail-tile]')
    expect(tileWrapper).not.toBeNull()

    // Canvas should NOT be mounted yet (only after IO + render completes)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeNull()

    unmount()
  })

  it('IntersectionObserver is observed on mount and disconnected on unmount', () => {
    const { unmount } = mountThumbnail(1)

    // IO should have been created and observe called
    const ioInstance = MockIntersectionObserver.instances[0]
    expect(ioInstance).toBeDefined()
    expect(ioInstance.observe).toHaveBeenCalled()

    unmount()

    // IO should be disconnected on unmount
    expect(ioInstance.disconnect).toHaveBeenCalled()
  })

  it('page label is displayed below the tile', () => {
    const { container, unmount } = mountThumbnail(2)

    const label = container.querySelector('[data-thumbnail-label]')
    expect(label).not.toBeNull()
    expect(label?.textContent).toBe('Page 2')

    unmount()
  })

  it('active tile gets accent border; idle tile gets idle border', () => {
    const { container: activeContainer, unmount: activeUnmount } = mountThumbnail(1, true)
    const { container: idleContainer, unmount: idleUnmount } = mountThumbnail(2, false)

    const activeTile = activeContainer.querySelector('[data-thumbnail-tile]') as HTMLElement
    const idleTile = idleContainer.querySelector('[data-thumbnail-tile]') as HTMLElement

    expect(activeTile).not.toBeNull()
    expect(idleTile).not.toBeNull()

    // Active: should have accent color (#0078d4) in border — check cssText
    const activeCssText = activeTile.style.cssText
    const hasAccent = activeCssText.includes('#0078d4') || activeCssText.includes('rgb(0, 120, 212)')
    expect(hasAccent).toBe(true)

    // Idle: should have border color (#3c3c3c) — check cssText
    const idleCssText = idleTile.style.cssText
    const hasIdle = idleCssText.includes('#3c3c3c') || idleCssText.includes('rgb(60, 60, 60)')
    expect(hasIdle).toBe(true)

    activeUnmount()
    idleUnmount()
  })
})
