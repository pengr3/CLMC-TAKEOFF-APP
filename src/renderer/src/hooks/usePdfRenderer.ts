import { useState, useEffect, useRef } from 'react'
import { PDFDocumentProxy, PDFPageProxy } from '../lib/pdf-setup'
import { MAX_CANVAS_DIM, PDF_BASE_SCALE } from '../lib/constants'
import { useViewerStore } from '../stores/viewerStore'

export function clampedRenderScale(page: PDFPageProxy, desiredScale: number): number {
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: desiredScale })
  const physicalWidth = viewport.width * dpr
  const physicalHeight = viewport.height * dpr
  const maxDim = Math.max(physicalWidth, physicalHeight)
  if (maxDim > MAX_CANVAS_DIM) {
    return desiredScale * (MAX_CANVAS_DIM / maxDim)
  }
  return desiredScale
}

// Module-level canvas cache: survives re-renders, keyed by "docId-pageNumber"
interface CachedPage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

const pageCache = new Map<string, CachedPage>()
let cachedDocumentRef: PDFDocumentProxy | null = null

function getCacheKey(pageNumber: number): string {
  return `page-${pageNumber}`
}

function clearCache(): void {
  pageCache.clear()
}

async function renderPageToCanvas(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<CachedPage> {
  const page = await pdfDocument.getPage(pageNumber)
  const renderScale = clampedRenderScale(page, PDF_BASE_SCALE)
  const viewport = page.getViewport({ scale: renderScale })
  const dpr = window.devicePixelRatio || 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)

  const transform: [number, number, number, number, number, number] | undefined =
    dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

  const renderTask = page.render({ canvas, viewport, transform })
  await renderTask.promise

  return {
    canvas,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height)
  }
}

export function usePdfRenderer() {
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null)
  const preRenderAbortRef = useRef(false)

  const pdfDocument = useViewerStore((s) => s.pdfDocument) as PDFDocumentProxy | null
  const currentPage = useViewerStore((s) => s.currentPage)
  const totalPages = useViewerStore((s) => s.totalPages)

  useEffect(() => {
    if (!pdfDocument) {
      setPageCanvas(null)
      setPageSize(null)
      return
    }

    // If the document changed, clear cache
    if (cachedDocumentRef !== pdfDocument) {
      clearCache()
      cachedDocumentRef = pdfDocument
    }

    let cancelled = false
    preRenderAbortRef.current = true // Abort any prior pre-renders
    preRenderAbortRef.current = false
    const localAbortRef = preRenderAbortRef

    async function renderCurrentPage() {
      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      const cacheKey = getCacheKey(currentPage)

      // Cache hit: instant display, no async work
      const cached = pageCache.get(cacheKey)
      if (cached) {
        setPageSize({ width: cached.width, height: cached.height })
        setPageCanvas(cached.canvas)
        // Still pre-render adjacent pages
        preRenderAdjacentPages()
        return
      }

      // Cache miss: render from scratch
      try {
        const page = await pdfDocument!.getPage(currentPage)
        if (cancelled) return

        const renderScale = clampedRenderScale(page, PDF_BASE_SCALE)
        const viewport = page.getViewport({ scale: renderScale })
        const dpr = window.devicePixelRatio || 1

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)

        const transform: [number, number, number, number, number, number] | undefined =
          dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

        const renderTask = page.render({ canvas, viewport, transform })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (cancelled) return

        const result: CachedPage = {
          canvas,
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height)
        }

        // Store in cache
        pageCache.set(cacheKey, result)

        setPageSize({ width: result.width, height: result.height })
        setPageCanvas(result.canvas)

        // Pre-render adjacent pages in background
        preRenderAdjacentPages()
      } catch (err: unknown) {
        if ((err as Error)?.name === 'RenderingCancelledException') return
        console.error('PDF render error:', err)
      }
    }

    function preRenderAdjacentPages() {
      const adjacentPages: number[] = []
      if (currentPage > 1) adjacentPages.push(currentPage - 1)
      if (currentPage < totalPages) adjacentPages.push(currentPage + 1)

      // Filter out already-cached pages
      const toRender = adjacentPages.filter((p) => !pageCache.has(getCacheKey(p)))
      if (toRender.length === 0) return

      // Use requestIdleCallback if available, else setTimeout
      const schedule =
        typeof window.requestIdleCallback === 'function'
          ? window.requestIdleCallback
          : (fn: () => void) => setTimeout(fn, 0)

      for (const pageNum of toRender) {
        schedule(async () => {
          if (localAbortRef.current || cancelled) return
          if (pageCache.has(getCacheKey(pageNum))) return // Another render beat us

          try {
            const result = await renderPageToCanvas(pdfDocument!, pageNum)
            if (localAbortRef.current || cancelled) return
            pageCache.set(getCacheKey(pageNum), result)
          } catch (err: unknown) {
            if ((err as Error)?.name === 'RenderingCancelledException') return
            // Silently ignore pre-render failures -- they'll be retried when navigated to
          }
        })
      }
    }

    renderCurrentPage()

    return () => {
      cancelled = true
      preRenderAbortRef.current = true
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
    }
  }, [pdfDocument, currentPage, totalPages])

  return { pageCanvas, pageSize }
}
