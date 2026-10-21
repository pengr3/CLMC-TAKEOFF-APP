/** @vitest-environment jsdom */
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pageDocument, mountRenderer, flushRaster } from './helpers/pdf-render-harness'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { MAX_CANVAS_DIM } from '@renderer/lib/constants'

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
})
afterEach(() => { vi.restoreAllMocks() })

it('keeps canonical page geometry when a large DPR raster hits the canvas clamp', async () => {
  const pdf = pageDocument(10000, 6000)
  const h = await mountRenderer(pdf.doc)
  try {
    expect(h.current().pageSize).toEqual({ width: 20000, height: 12000 })
    expect(h.current().pageCanvas!.width).toBe(MAX_CANVAS_DIM)
  } finally { h.unmount() }
})

it('bounds actual retained canvas bytes across navigation and frees all backing on unmount', async () => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  const pdf = pageDocument(2400, 2400, 12)
  const h = await mountRenderer(pdf.doc)
  try {
    for (let page = 2; page <= 12; page++) {
      await act(async () => { useViewerStore.getState().setPage(page) })
      await flushRaster()
    }
    const aliveBytes = pdf.canvases.reduce((n, c) => n + c.width * c.height * 4, 0)
    // At most one retained 92 MB raster plus the currently displayed owner.
    expect(aliveBytes).toBeLessThanOrEqual(128 * 1024 * 1024 + 4800 * 4800 * 4)
  } finally { h.unmount() }
  expect(pdf.canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true)
})

it('rerenders on monitor DPR changes without changing logical geometry', async () => {
  const pdf = pageDocument(5000, 3000)
  const h = await mountRenderer(pdf.doc)
  try {
    const oldCanvas = h.current().pageCanvas
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    await flushRaster()
    expect(h.current().pageCanvas).not.toBe(oldCanvas)
    expect(h.current().pageSize).toEqual({ width: 10000, height: 6000 })
  } finally { h.unmount() }
})
