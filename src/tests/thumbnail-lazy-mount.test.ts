/** @vitest-environment jsdom */
/**
 * Tests for Thumbnail lazy mount via IntersectionObserver (D-17).
 *
 * Uses React.createElement (not JSX) — mirrors existing .test.ts convention.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock useThumbnailRender to track when it's called
const mockRenderCalled = vi.fn()
vi.mock('@renderer/hooks/useThumbnailRender', () => ({
  useThumbnailRender: vi.fn((pdfDoc: unknown, pageNumber: number) => {
    mockRenderCalled(pageNumber)
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

// IntersectionObserver mock — controllable
type IOCallbackFn = IntersectionObserverCallback
const ioInstances: Array<{ callback: IOCallbackFn; elements: Element[]; disconnect: ReturnType<typeof vi.fn>; observe: ReturnType<typeof vi.fn> }> = []

function setupIO(): void {
  ioInstances.length = 0
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: vi.fn((callback: IOCallbackFn) => {
      const instance = {
        callback,
        elements: [] as Element[],
        observe: vi.fn((el: Element) => {
          instance.elements.push(el)
        }),
        disconnect: vi.fn()
      }
      ioInstances.push(instance)
      return instance
    })
  })
}

function triggerIntersection(instanceIndex: number, isIntersecting: boolean): void {
  const inst = ioInstances[instanceIndex]
  if (!inst) return
  const entries: IntersectionObserverEntry[] = inst.elements.map((el) => ({
    isIntersecting,
    target: el,
    boundingClientRect: el.getBoundingClientRect(),
    intersectionRect: isIntersecting ? el.getBoundingClientRect() : ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRectReadOnly),
    rootBounds: null,
    intersectionRatio: isIntersecting ? 1 : 0,
    time: performance.now()
  }))
  act(() => {
    inst.callback(entries, inst as unknown as IntersectionObserver)
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
  setupIO()

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
  it('tile does NOT call useThumbnailRender while NOT intersecting (D-17)', () => {
    const { unmount } = mountThumbnail(1)

    // No intersection triggered — useThumbnailRender should not have been called
    // (or if it was, it received null pdfDocument which is expected)
    // The key behavior: no canvas element should be rendered in the DOM
    // (Thumbnail should show skeleton before intersection)
    expect(mockRenderCalled).not.toHaveBeenCalled()

    unmount()
  })

  it('IntersectionObserver intersection triggers rasterization (D-17)', () => {
    const { container, unmount } = mountThumbnail(1)

    // Before intersection: no useThumbnailRender call
    expect(mockRenderCalled).not.toHaveBeenCalled()

    // Trigger intersection
    triggerIntersection(0, true)

    // After intersection: useThumbnailRender should be called
    expect(mockRenderCalled).toHaveBeenCalledWith(1)

    unmount()
  })

  it('non-intersecting tile shows skeleton placeholder', () => {
    const { container, unmount } = mountThumbnail(1)

    // Before intersection: tile should show skeleton (a div with background color)
    // We check for the tile wrapper being present
    const tileWrapper = container.querySelector('[data-thumbnail-tile]')
    expect(tileWrapper).not.toBeNull()

    // Canvas should NOT be mounted yet
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeNull()

    unmount()
  })

  it('IntersectionObserver is observed on mount and disconnected on unmount', () => {
    const { unmount } = mountThumbnail(1)

    // IO should have been created
    expect(ioInstances.length).toBeGreaterThan(0)
    expect(ioInstances[0].observe).toHaveBeenCalled()

    unmount()

    // IO should be disconnected on unmount
    expect(ioInstances[0].disconnect).toHaveBeenCalled()
  })

  it('page label is displayed below the tile', () => {
    const { container, unmount } = mountThumbnail(2)

    const label = container.querySelector('[data-thumbnail-label]')
    expect(label).not.toBeNull()
    expect(label?.textContent).toBe('Page 2')

    unmount()
  })

  it('active tile gets accent outline; idle tile gets border color', () => {
    const { container: activeContainer, unmount: activeUnmount } = mountThumbnail(1, true)
    const { container: idleContainer, unmount: idleUnmount } = mountThumbnail(2, false)

    const activeTile = activeContainer.querySelector('[data-thumbnail-tile]') as HTMLElement
    const idleTile = idleContainer.querySelector('[data-thumbnail-tile]') as HTMLElement

    expect(activeTile).not.toBeNull()
    expect(idleTile).not.toBeNull()

    // Active: should have accent color (#0078d4) in border/outline
    const activeStyle = activeTile.style
    const hasAccent =
      activeStyle.outline?.includes('#0078d4') ||
      activeStyle.border?.includes('#0078d4') ||
      activeStyle.borderColor === '#0078d4'
    expect(hasAccent).toBe(true)

    // Idle: should have border color (#3c3c3c)
    const idleStyle = idleTile.style
    const hasIdle =
      idleStyle.outline?.includes('#3c3c3c') ||
      idleStyle.border?.includes('#3c3c3c') ||
      idleStyle.borderColor === '#3c3c3c'
    expect(hasIdle).toBe(true)

    activeUnmount()
    idleUnmount()
  })
})
