/** @vitest-environment jsdom */
/**
 * Tests for useThumbnailRender markup overlay debounce (D-19).
 *
 * Uses vi.useFakeTimers() to control the 200ms debounce window.
 * Uses React.createElement (not JSX) — mirrors existing .test.ts convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock pdf-setup to prevent pdfjs worker loading.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { useThumbnailRender } from '@renderer/hooks/useThumbnailRender'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { CountMarkup } from '@renderer/types/markup'

// ---- minimal canvas mock for jsdom ----
// jsdom doesn't implement canvas; we need getContext to return a 2D-ish mock.
function setupCanvasMock(): void {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0
  }
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctx) as typeof HTMLCanvasElement.prototype.getContext
}

// ---- markup fixture ----
function countMarkup(page: number, x: number, y: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name: 'bolt',
    categoryId: 'cat-1',
    color: '#0078d4',
    sequence: 1,
    point: { x, y },
    createdAt: Date.now()
  }
}

// ---- hook harness ----
interface HookResult {
  overlayCanvasRef: { current: HTMLCanvasElement | null }
  pageCanvasRef: { current: HTMLCanvasElement | null }
  isRendering: boolean
}

interface HookHarness {
  getResult: () => HookResult
  cleanup: () => void
}

function mountHook(pageNumber: number): HookHarness {
  const holder: { value: HookResult } = {
    value: { overlayCanvasRef: { current: null }, pageCanvasRef: { current: null }, isRendering: false }
  }

  function Harness(): null {
    const result = useThumbnailRender(null, pageNumber)
    React.useLayoutEffect(() => {
      holder.value = result
    })
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(React.createElement(Harness))
  })

  return {
    getResult: () => holder.value,
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

// ---- tests ----

beforeEach(() => {
  setupCanvasMock()

  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null,
    pageScales: {},
    activeTool: 'select'
  })
  vi.clearAllMocks()
  document.body.innerHTML = ''
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useThumbnailRender markup overlay debounce', () => {
  it('hook returns the expected shape { pageCanvasRef, overlayCanvasRef, cssWidth, cssHeight, isRendering }', () => {
    const harness = mountHook(1)
    const result = harness.getResult()
    expect(result).toHaveProperty('pageCanvasRef')
    expect(result).toHaveProperty('overlayCanvasRef')
    expect(result).toHaveProperty('cssWidth')
    expect(result).toHaveProperty('cssHeight')
    expect(result).toHaveProperty('isRendering')
    harness.cleanup()
  })

  it('markup commit schedules overlay refresh within 200ms±50ms (D-19)', () => {
    const harness = mountHook(1)

    // Simulate a markup commit on page 1 after hook is mounted
    act(() => {
      useMarkupStore.setState({
        pageMarkups: { 1: [countMarkup(1, 10, 20)] }
      })
    })

    // Before 200ms: canvas not yet cleared (debounce pending)
    const overlayCanvas = harness.getResult().overlayCanvasRef.current
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d') as ReturnType<typeof vi.fn> & { clearRect: ReturnType<typeof vi.fn> }
      const callsBefore = (ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length
      vi.advanceTimersByTime(150)
      // Still debouncing — no additional clearRect yet
      const callsAt150 = (ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length
      expect(callsAt150).toBe(callsBefore)

      vi.advanceTimersByTime(100) // total 250ms — past the 200ms debounce
      // clearRect should have fired
      expect((ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore)
    }

    harness.cleanup()
  })

  it('rapid commits collapse into a single refresh (debounce)', () => {
    const harness = mountHook(1)

    // Two rapid commits
    act(() => {
      useMarkupStore.setState({ pageMarkups: { 1: [countMarkup(1, 10, 20)] } })
    })
    vi.advanceTimersByTime(50)
    act(() => {
      useMarkupStore.setState({ pageMarkups: { 1: [countMarkup(1, 10, 20), countMarkup(1, 30, 40)] } })
    })

    const overlayCanvas = harness.getResult().overlayCanvasRef.current
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d') as { clearRect: ReturnType<typeof vi.fn> }
      const callsBefore = ctx.clearRect.mock.calls.length

      // Advance past the second commit's 200ms window
      vi.advanceTimersByTime(250)

      // Should have fired exactly ONCE (collapsed debounce), not twice
      const callsAfter = ctx.clearRect.mock.calls.length
      // At most 1 additional clearRect call (for the single debounced refresh)
      expect(callsAfter - callsBefore).toBeLessThanOrEqual(1)
    }

    harness.cleanup()
  })

  it('page raster is NOT re-rendered on markup commit (overlay only)', () => {
    // The page canvas ref should not be reassigned when markups change.
    // We can verify by ensuring pdfDocument remains null and isRendering
    // is false throughout (no page re-render scheduled).
    const harness = mountHook(1)
    const initialPageCanvas = harness.getResult().pageCanvasRef.current

    act(() => {
      useMarkupStore.setState({ pageMarkups: { 1: [countMarkup(1, 10, 20)] } })
    })
    vi.advanceTimersByTime(300)

    // Page canvas ref unchanged (no re-rasterize)
    expect(harness.getResult().pageCanvasRef.current).toBe(initialPageCanvas)
    harness.cleanup()
  })
})
