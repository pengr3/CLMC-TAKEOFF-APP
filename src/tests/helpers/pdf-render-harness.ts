import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { vi } from 'vitest'
import { usePdfRenderer } from '@renderer/hooks/usePdfRenderer'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import Konva from 'konva'
import { PdfPageImage } from '@renderer/components/PdfPageImage'
import { useCalibrationMode } from '@renderer/hooks/useCalibrationMode'

// Test factories intentionally infer the precise mock/hook API for callers.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
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

export async function mountRenderer(doc: PDFDocumentProxy, totalPages = doc.numPages, image = false) {
  useViewerStore.setState({ pdfDocument: doc, totalPages, currentPage: 1 })
  const holder: { value: ReturnType<typeof usePdfRenderer> | null } = { value: null }
  const calibration: { value: ReturnType<typeof useCalibrationMode> | null } = { value: null }
  const transform = new Konva.Transform().translate(-173, 91).scale(0.65, 0.65)
  const stageRef = { current: {
    getAbsoluteTransform: () => transform,
    container: () => document.body
  } as unknown as Konva.Stage }
  function Harness() {
    const value = usePdfRenderer()
    const calib = useCalibrationMode(stageRef)
    React.useLayoutEffect(() => { holder.value = value })
    React.useLayoutEffect(() => { calibration.value = calib })
    return image && value.pageCanvas && value.pageSize
      ? React.createElement(PdfPageImage, { canvas: value.pageCanvas, size: value.pageSize }) : null
  }
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  await act(async () => { root.render(React.createElement(Harness)) })
  await flushRaster()
  return {
    current: () => holder.value!,
    calibration: () => calibration.value!,
    transform,
    unmount: () => { act(() => root.unmount()); el.remove() }
  }
}
