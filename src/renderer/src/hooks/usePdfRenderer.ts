import { useState, useEffect, useLayoutEffect } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from '../lib/pdf-setup'
import { MAX_CANVAS_DIM, PDF_BASE_SCALE } from '../lib/constants'
import { PdfPageCache, type PageRaster, type RasterStats } from '../lib/pdf-page-cache'
import { useViewerStore } from '../stores/viewerStore'

export function clampedRenderScale(
  page: PDFPageProxy,
  desiredScale: number,
  dpr = window.devicePixelRatio || 1
): number {
  const viewport = page.getViewport({ scale: desiredScale })
  return (
    desiredScale * Math.min(1, MAX_CANVAS_DIM / (Math.max(viewport.width, viewport.height) * dpr))
  )
}

function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1)
  useEffect(() => {
    let query: MediaQueryList | undefined
    const update = (): void => {
      const next = window.devicePixelRatio || 1
      setDpr(next)
      query?.removeEventListener('change', update)
      query = window.matchMedia?.(`(resolution: ${next}dppx)`)
      query?.addEventListener('change', update)
    }
    update()
    window.addEventListener('resize', update)
    return () => {
      query?.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return dpr
}

interface Frame {
  raster: PageRaster
  size: { width: number; height: number }
  document: PDFDocumentProxy
  page: number
}

export function usePdfRenderer(): {
  pageCanvas: HTMLCanvasElement | null
  pageSize: { width: number; height: number } | null
  getRasterStats: () => RasterStats
} {
  const [frame, setFrame] = useState<Frame | null>(null)
  // Per-consumer lifetime; never creates or destroys the single PDF.js document.
  const [session] = useState(() => ({
    cache: new PdfPageCache(),
    owned: new Set<PageRaster>(),
    tail: Promise.resolve(),
    generation: 0,
    document: null as PDFDocumentProxy | null,
    dpr: 0
  }))
  const pdfDocument = useViewerStore((s) => s.pdfDocument) as PDFDocumentProxy | null
  const currentPage = useViewerStore((s) => s.currentPage)
  const totalPages = useViewerStore((s) => s.totalPages)
  const dpr = useDevicePixelRatio()
  const visible = frame?.document === pdfDocument && frame.page === currentPage ? frame : null

  // Release only after React has committed the replacement image (or removed it).
  useLayoutEffect(() => {
    for (const raster of session.owned) {
      if (raster !== visible?.raster) {
        session.cache.release(raster)
        session.owned.delete(raster)
      }
    }
  }, [session, visible])

  useEffect(() => {
    const { cache } = session
    if (session.document !== pdfDocument || session.dpr !== dpr) {
      session.generation++
      session.document = pdfDocument
      session.dpr = dpr
      cache.clear()
    }
    if (!pdfDocument) {
      setFrame(null)
      return
    }

    const doc = pdfDocument
    const generation = session.generation
    let cancelled = false
    let activeTask: ReturnType<PDFPageProxy['render']> | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const valid = (): boolean => !cancelled && generation === session.generation
    const key = (page: number): string => `${generation}:${dpr}:${page}`
    const display = (raster: PageRaster): void => {
      if (!session.owned.has(raster)) {
        cache.retain(raster)
        session.owned.add(raster)
      }
      setFrame({
        raster,
        size: { width: raster.width, height: raster.height },
        document: doc,
        page: currentPage
      })
    }

    async function render(pageNumber: number, adjacent: boolean): Promise<void> {
      if (!valid()) return
      const cached = cache.get(key(pageNumber))
      if (cached) {
        if (!adjacent) display(cached)
        return
      }
      let raster: PageRaster | undefined
      try {
        const page = await doc.getPage(pageNumber)
        if (!valid()) return
        const logical = page.getViewport({ scale: PDF_BASE_SCALE })
        const viewport = page.getViewport({ scale: clampedRenderScale(page, PDF_BASE_SCALE, dpr) })
        const width = Math.max(1, Math.floor(viewport.width * dpr))
        const height = Math.max(1, Math.floor(viewport.height * dpr))
        // An oversized foreground is displayable, but useless prefetch is skipped.
        if (adjacent && width * height * 4 > cache.budget) return
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        raster = { canvas, width: logical.width, height: logical.height }
        cache.track(raster, adjacent ? 'adjacent' : 'foreground')
        activeTask = page.render({
          canvas,
          viewport,
          transform: [width / viewport.width, 0, 0, height / viewport.height, 0, 0]
        })
        await activeTask.promise
        cache.finish(raster)
        if (!valid()) return
        if (!adjacent) display(raster)
        cache.put(key(pageNumber), raster)
      } catch (err: unknown) {
        if (valid() && !adjacent && (err as Error)?.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', err)
        }
      } finally {
        activeTask = null
        if (raster) {
          cache.finish(raster)
          cache.discard(raster)
        }
      }
    }

    // One lane includes cancellation settlement: rapid navigation cannot allocate
    // a new backing canvas for every abandoned foreground or adjacent request.
    session.tail = session.tail.then(async () => {
      await render(currentPage, false)
      if (!valid()) return
      timer = setTimeout(() => {
        session.tail = session.tail.then(async () => {
          if (currentPage > 1) await render(currentPage - 1, true)
          if (currentPage < totalPages) await render(currentPage + 1, true)
        })
      }, 0)
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      activeTask?.cancel()
    }
  }, [pdfDocument, currentPage, totalPages, dpr, session])

  useEffect(
    () => () => {
      session.generation++
      session.cache.clear()
      for (const raster of session.owned) session.cache.release(raster)
      session.owned.clear()
    },
    [session]
  )

  return {
    pageCanvas: visible?.raster.canvas ?? null,
    // Stable identity prevents viewport effects from running on every render.
    pageSize: visible?.size ?? null,
    getRasterStats: () => session.cache.stats()
  }
}
