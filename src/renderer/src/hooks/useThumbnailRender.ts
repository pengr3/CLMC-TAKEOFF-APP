import { useState, useEffect, useRef } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from '../lib/pdf-setup'
import { PDF_BASE_SCALE } from '../lib/constants'
import { useMarkupStore } from '../stores/markupStore'
import type { Markup } from '../types/markup'

// ---- Module-level constants ----

// Stable empty-array reference for the pageMarkups selector fallback.
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop.
const EMPTY_MARKUPS: Markup[] = []

// Target CSS width for thumbnail tiles (matches thumbnailDefaultWidth token from UI-SPEC).
// Canvas pixel width = TARGET_CSS_WIDTH * dpr — bounds memory regardless of source page size.
const TARGET_CSS_WIDTH = 140

// ---- Markup overlay drawing (pure function, not exported) ----

/**
 * drawMarkupOverlay — renders all markups for a page onto the overlay canvas.
 *
 * Markup coordinate system assumption (A1):
 * Markup coords are stored in PDF_BASE_SCALE=2.0 stage units (per STATE.md
 * markup coordinate decision). Thumbnail renders at a lower scale computed
 * from TARGET_CSS_WIDTH. The conversion factor is:
 *   scale = (thumbnailScale / PDF_BASE_SCALE) * dpr
 * where thumbnailScale = (TARGET_CSS_WIDTH * dpr) / page.getViewport({scale:1}).width
 *
 * If markups appear offset on first run, re-verify coordinate storage format in
 * types/markup.ts — coords may be stored in a different reference frame.
 * MANUAL VERIFY: Open a project with count pins, check thumbnail shows pins at
 * correct positions relative to the page.
 */
function drawMarkupOverlay(
  ctx: CanvasRenderingContext2D,
  markups: Markup[],
  thumbnailScale: number,
  pdfBaseScale: number
): void {
  const dpr = window.devicePixelRatio || 1
  const scale = (thumbnailScale / pdfBaseScale) * dpr

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const m of markups) {
    ctx.fillStyle = m.color
    ctx.strokeStyle = m.color
    ctx.lineWidth = 1.5 * dpr

    if (m.type === 'count') {
      ctx.beginPath()
      ctx.arc(m.point.x * scale, m.point.y * scale, 3 * dpr, 0, Math.PI * 2)
      ctx.fill()
    } else if (m.type === 'linear') {
      ctx.beginPath()
      m.points.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else {
      // area + perimeter — closed polygon outline
      ctx.beginPath()
      m.points.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.stroke()
    }
  }
}

// ---- Return type ----

export interface ThumbnailRenderResult {
  pageCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  overlayCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  cssWidth: number
  cssHeight: number
  isRendering: boolean
}

// ---- Hook ----

/**
 * useThumbnailRender — low-DPI PDF raster + two-canvas markup overlay.
 *
 * Returns refs for two canvases (page raster + markup overlay) that should be
 * stacked with absolute positioning in the caller's JSX. The page canvas is
 * stable across markup changes; only the overlay is redrawn on markup commit
 * (debounced 200ms per D-19).
 *
 * @param pdfDocument  PDF.js document proxy (null until loaded)
 * @param pageNumber   1-indexed page number
 */
export function useThumbnailRender(
  pdfDocument: PDFDocumentProxy | null,
  pageNumber: number
): ThumbnailRenderResult {
  // Two-canvas composite refs — set imperatively after rasterization
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // CSS dimensions (in CSS pixels, not canvas pixels)
  const [cssWidth, setCssWidth] = useState(TARGET_CSS_WIDTH)
  const [cssHeight, setCssHeight] = useState(Math.round(TARGET_CSS_WIDTH * 1.414)) // A4 aspect estimate until rendered

  const [isRendering, setIsRendering] = useState(false)

  // Stable ref to the computed thumbnailScale — set during rasterization,
  // read inside the markup subscription closure (avoids stale closure).
  const thumbnailScaleRef = useRef<number>(0)

  // Render task ref for cancellation (mirrors usePdfRenderer.ts pattern)
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null)

  // Debounce timer ref for markup overlay refresh
  const refreshTimerRef = useRef<number | null>(null)

  // ---- Effect 1: Rasterize the page when pdfDocument / pageNumber changes ----
  useEffect(() => {
    if (!pdfDocument) {
      // Clear canvas refs when no document
      pageCanvasRef.current = null
      overlayCanvasRef.current = null
      return
    }

    let cancelled = false
    setIsRendering(true)

    async function rasterize(): Promise<void> {
      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      try {
        const page = await pdfDocument!.getPage(pageNumber)
        if (cancelled) return

        const dpr = window.devicePixelRatio || 1
        const baseViewport = page.getViewport({ scale: 1 })

        // Cap-pixel-dimensions approach: fix canvas width, derive scale
        const targetCanvasWidth = TARGET_CSS_WIDTH * dpr
        const scale = targetCanvasWidth / baseViewport.width
        thumbnailScaleRef.current = scale / dpr // CSS-unit scale for drawMarkupOverlay

        const viewport = page.getViewport({ scale })
        const canvasWidth = Math.floor(viewport.width)
        const canvasHeight = Math.floor(viewport.height)
        const cssW = Math.round(canvasWidth / dpr)
        const cssH = Math.round(canvasHeight / dpr)

        // Page canvas (stable — only redrawn when page/doc changes)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvasWidth
        pageCanvas.height = canvasHeight

        const transform: [number, number, number, number, number, number] | undefined =
          dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

        const renderTask = page.render({ canvas: pageCanvas, viewport, transform })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (cancelled) return

        // Overlay canvas (refreshed on markup commits)
        const overlayCanvas = document.createElement('canvas')
        overlayCanvas.width = canvasWidth
        overlayCanvas.height = canvasHeight

        pageCanvasRef.current = pageCanvas
        overlayCanvasRef.current = overlayCanvas

        setCssWidth(cssW)
        setCssHeight(cssH)
        setIsRendering(false)

        // Draw initial markup overlay
        const markups = useMarkupStore.getState().pageMarkups[pageNumber] ?? EMPTY_MARKUPS
        const ctx = overlayCanvas.getContext('2d')
        if (ctx && markups.length > 0) {
          drawMarkupOverlay(ctx, markups, thumbnailScaleRef.current, PDF_BASE_SCALE)
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'RenderingCancelledException') return
        console.error('Thumbnail render error:', err)
        setIsRendering(false)
      }
    }

    rasterize()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDocument, pageNumber])

  // ---- Effect 2: Subscribe to markup changes — debounced overlay refresh ----
  useEffect(() => {
    const unsub = useMarkupStore.subscribe(
      (s) => s.pageMarkups[pageNumber] ?? EMPTY_MARKUPS,
      (_next, prev) => {
        // Only react when value actually changed (Object.is equality check handles this)
        const latest = useMarkupStore.getState().pageMarkups[pageNumber] ?? EMPTY_MARKUPS
        if (latest === prev) return

        if (refreshTimerRef.current !== null) {
          window.clearTimeout(refreshTimerRef.current)
        }

        refreshTimerRef.current = window.setTimeout(() => {
          // Read latest at fire time (Pitfall 10 — NOT from subscription closure)
          const currentMarkups = useMarkupStore.getState().pageMarkups[pageNumber] ?? EMPTY_MARKUPS
          const canvas = overlayCanvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          drawMarkupOverlay(ctx, currentMarkups, thumbnailScaleRef.current, PDF_BASE_SCALE)
        }, 200)
      },
      { equalityFn: Object.is }
    )

    return () => {
      unsub()
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [pageNumber])

  return {
    pageCanvasRef,
    overlayCanvasRef,
    cssWidth,
    cssHeight,
    isRendering
  }
}
