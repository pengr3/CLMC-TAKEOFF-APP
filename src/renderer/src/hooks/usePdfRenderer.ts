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

export function usePdfRenderer() {
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null)

  const pdfDocument = useViewerStore((s) => s.pdfDocument) as PDFDocumentProxy | null
  const currentPage = useViewerStore((s) => s.currentPage)

  useEffect(() => {
    if (!pdfDocument) {
      setPageCanvas(null)
      setPageSize(null)
      return
    }

    let cancelled = false

    async function renderCurrentPage() {
      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      try {
        const page = await pdfDocument!.getPage(currentPage)
        if (cancelled) return

        const renderScale = clampedRenderScale(page, PDF_BASE_SCALE)
        const viewport = page.getViewport({ scale: renderScale })
        const dpr = window.devicePixelRatio || 1

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!

        // Physical pixel dimensions (for sharp HiDPI rendering)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)

        const transform: [number, number, number, number, number, number] | undefined =
          dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          transform
        })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (cancelled) return

        // Store CSS-pixel dimensions for Konva Image sizing
        setPageSize({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height)
        })
        setPageCanvas(canvas)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'RenderingCancelledException') return
        console.error('PDF render error:', err)
      }
    }

    renderCurrentPage()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
    }
  }, [pdfDocument, currentPage])

  return { pageCanvas, pageSize }
}
