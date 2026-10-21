import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { vi } from 'vitest'
import { usePdfRenderer } from '@renderer/hooks/usePdfRenderer'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

export function pageDocument(width: number, height: number, count = 1) {
  const canvases: HTMLCanvasElement[] = []
  const render = vi.fn(({ canvas }: { canvas: HTMLCanvasElement }) => {
    canvases.push(canvas)
    return { promise: Promise.resolve(), cancel: vi.fn() }
  })
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: width * scale, height: height * scale }),
    render
  } as unknown as PDFPageProxy
  const doc = { numPages: count, getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
  return { doc, page, render, canvases }
}

export async function flushRaster() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)) })
}

export async function mountRenderer(doc: PDFDocumentProxy, totalPages = doc.numPages) {
  useViewerStore.setState({ pdfDocument: doc, totalPages, currentPage: 1 })
  const holder: { value: ReturnType<typeof usePdfRenderer> | null } = { value: null }
  function Harness() {
    const value = usePdfRenderer()
    React.useLayoutEffect(() => { holder.value = value })
    return null
  }
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  await act(async () => { root.render(React.createElement(Harness)) })
  await flushRaster()
  return {
    current: () => holder.value!,
    unmount: () => { act(() => root.unmount()); el.remove() }
  }
}
