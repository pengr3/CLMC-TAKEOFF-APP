/** @vitest-environment jsdom */
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pageDocument, mountRenderer, flushRaster } from './helpers/pdf-render-harness'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { MAX_CANVAS_DIM } from '@renderer/lib/constants'
import { computePixelsPerMm, pixelsToRealWorld } from '@renderer/lib/scale-math'
import { PdfPageCache } from '@renderer/lib/pdf-page-cache'

const image = vi.hoisted(() => ({ width: 0, height: 0 }))
vi.mock('react-konva', () => ({ Image: (props: { width: number; height: number }) => {
  image.width = props.width
  image.height = props.height
  return null
} }))

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
})
afterEach(() => { vi.restoreAllMocks() })

it('keeps canonical page geometry when a large DPR raster hits the canvas clamp', async () => {
  const pdf = pageDocument(10000, 6000)
  const h = await mountRenderer(pdf.doc, 1, true)
  try {
    expect(h.current().pageSize).toEqual({ width: 20000, height: 12000 })
    expect(h.current().pageCanvas!.width).toBe(MAX_CANVAS_DIM)
    expect(image).toEqual({ width: 20000, height: 12000 })
    // PDF landmarks x=1000 and x=2500 are 1500 PDF units apart. At the
    // established scale=2 they are 3000 page units, representing 10 metres.
    const screen = (x: number): { x: number; y: number } => h.transform.point({ x: x * 2, y: 800 * 2 })
    await act(async () => { h.calibration().activate() })
    await act(async () => { h.calibration().recordClick(screen(1000)) })
    await act(async () => { h.calibration().recordClick(screen(2500)) })
    const line = h.calibration().state
    expect(line.startPoint!.x).toBeCloseTo(2000)
    expect(line.endPoint!.x).toBeCloseTo(5000)
    expect(line.linePixelLength).toBeCloseTo(3000)
    expect(pixelsToRealWorld(line.linePixelLength,
      computePixelsPerMm(line.linePixelLength, 10, 'm'), 'm')).toBeCloseTo(10)
  } finally { h.unmount() }
})

it('evicts least recent rasters but preserves displayed ownership until release', () => {
  const cache = new PdfPageCache(800)
  const make = (): import('@renderer/lib/pdf-page-cache').PageRaster => {
    const canvas = document.createElement('canvas')
    canvas.width = 10; canvas.height = 10
    const raster = { canvas, width: 10, height: 10 }
    cache.track(raster, null)
    return raster
  }
  const a = make(), b = make(), c = make()
  cache.retain(a)
  cache.put('a', a); cache.put('b', b)
  cache.get('b')
  cache.put('c', c)
  expect(cache.get('a')).toBeUndefined()
  expect(a.canvas.width).toBe(10)
  expect(cache.stats()).toMatchObject({ retainedBytes: 800, displayedBytes: 400 })
  cache.release(a)
  expect(a.canvas.width).toBe(0)
  cache.clear()
  expect(cache.stats().liveBytes).toBe(0)
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
