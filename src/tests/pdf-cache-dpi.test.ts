/** @vitest-environment jsdom */
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pageDocument, mountRenderer, flushRaster } from './helpers/pdf-render-harness'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { MAX_CANVAS_DIM } from '@renderer/lib/constants'
import { computePixelsPerMm, pixelsToRealWorld } from '@renderer/lib/scale-math'
import { PdfPageCache, PDF_RASTER_BUDGET } from '@renderer/lib/pdf-page-cache'

const image = vi.hoisted(() => ({ width: 0, height: 0 }))
vi.mock('react-konva', () => ({
  Image: (props: { width: number; height: number }) => {
    image.width = props.width
    image.height = props.height
    return null
  }
}))

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
})
afterEach(() => {
  vi.restoreAllMocks()
})

it('keeps canonical page geometry when a large DPR raster hits the canvas clamp', async () => {
  const pdf = pageDocument(10000, 6000)
  const h = await mountRenderer(pdf.doc, 1, true)
  try {
    expect(h.current().pageSize).toEqual({ width: 20000, height: 12000 })
    expect(h.current().pageCanvas!.width).toBe(MAX_CANVAS_DIM)
    expect(image).toEqual({ width: 20000, height: 12000 })
    // PDF landmarks x=1000 and x=2500 are 1500 PDF units apart. At the
    // established scale=2 they are 3000 page units, representing 10 metres.
    const screen = (x: number): { x: number; y: number } =>
      h.transform.point({ x: x * 2, y: 800 * 2 })
    await act(async () => {
      h.calibration().activate()
    })
    await act(async () => {
      h.calibration().recordClick(screen(1000))
    })
    await act(async () => {
      h.calibration().recordClick(screen(2500))
    })
    const line = h.calibration().state
    expect(line.startPoint!.x).toBeCloseTo(2000)
    expect(line.endPoint!.x).toBeCloseTo(5000)
    expect(line.linePixelLength).toBeCloseTo(3000)
    expect(
      pixelsToRealWorld(
        line.linePixelLength,
        computePixelsPerMm(line.linePixelLength, 10, 'm'),
        'm'
      )
    ).toBeCloseTo(10)
  } finally {
    h.unmount()
  }
})

it('evicts least recent rasters but preserves displayed ownership until release', () => {
  const cache = new PdfPageCache(800)
  const make = (): import('@renderer/lib/pdf-page-cache').PageRaster => {
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    const raster = { canvas, width: 10, height: 10 }
    cache.track(raster, null)
    return raster
  }
  const a = make(),
    b = make(),
    c = make()
  cache.retain(a)
  cache.put('a', a)
  cache.put('b', b)
  cache.get('b')
  cache.put('c', c)
  expect(cache.get('a')).toBeUndefined()
  expect(a.canvas.width).toBe(10)
  expect(cache.stats()).toMatchObject({ retainedBytes: 800, displayedBytes: 400 })
  cache.release(a)
  expect(a.canvas.width).toBe(0)
  cache.clear()
  expect(cache.stats().liveBytes).toBe(0)
  const d = make(),
    e = make(),
    f = make()
  cache.put('d', d)
  cache.put('e', e)
  cache.get('d')
  cache.put('f', f)
  expect(cache.get('d')).toBe(d)
  expect(cache.get('e')).toBeUndefined()
  expect(e.canvas.width).toBe(0)
  cache.clear()
})

it('bounds actual retained canvas bytes across navigation and frees all backing on unmount', async () => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  const pdf = pageDocument(2400, 2400, 12)
  const h = await mountRenderer(pdf.doc)
  try {
    for (let page = 2; page <= 12; page++) {
      await act(async () => {
        useViewerStore.getState().setPage(page)
      })
      await flushRaster()
    }
    const aliveBytes = pdf.canvases.reduce((n, c) => n + c.width * c.height * 4, 0)
    // At most one retained 92 MB raster plus the currently displayed owner.
    expect(aliveBytes).toBeLessThanOrEqual(128 * 1024 * 1024 + 4800 * 4800 * 4)
  } finally {
    h.unmount()
  }
  expect(pdf.canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true)
})

it('rerenders on monitor DPR changes without changing logical geometry', async () => {
  const pdf = pageDocument(5000, 3000)
  const h = await mountRenderer(pdf.doc)
  try {
    const oldCanvas = h.current().pageCanvas
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })
    await flushRaster()
    expect(h.current().pageCanvas).not.toBe(oldCanvas)
    expect(h.current().pageSize).toEqual({ width: 10000, height: 6000 })
  } finally {
    h.unmount()
  }
})

it('never admits an oversized raster, and records the foreground transient separately', async () => {
  const pdf = pageDocument(10000, 6000, 3)
  const h = await mountRenderer(pdf.doc)
  const stats = h.current().getRasterStats
  try {
    expect(stats()).toMatchObject({
      retainedBytes: 0,
      entries: 0,
      transientBytes: 0,
      peakAdjacentBytes: 0
    })
    expect(stats().displayedBytes).toBeGreaterThan(PDF_RASTER_BUDGET)
    expect(stats().peakForegroundBytes).toBe(
      h.current().pageCanvas!.width * h.current().pageCanvas!.height * 4
    )
    expect(pdf.render).toHaveBeenCalledTimes(1)
  } finally {
    h.unmount()
  }
  expect(stats().liveBytes).toBe(0)
})

it('serializes and cancels adjacent work before another document can allocate or cache it', async () => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  const old = pageDocument(1000, 600, 3)
  let finish: (() => void) | undefined
  const cancel = vi.fn()
  old.render
    .mockImplementationOnce(({ canvas }) => {
      old.canvases.push(canvas)
      return { promise: Promise.resolve(), cancel: vi.fn() }
    })
    .mockImplementationOnce(({ canvas }) => {
      old.canvases.push(canvas)
      return {
        promise: new Promise<void>((resolve) => {
          finish = resolve
        }),
        cancel
      }
    })
  const h = await mountRenderer(old.doc)
  const next = pageDocument(1200, 800)
  try {
    expect(finish).toBeTypeOf('function')
    expect(h.current().getRasterStats().adjacentBytes).toBe(2000 * 1200 * 4)
    await act(async () => {
      useViewerStore.setState({ pdfDocument: next.doc, totalPages: 1 })
    })
    expect(cancel).toHaveBeenCalledOnce()
    expect(h.current().pageCanvas).toBeNull()
    expect(next.render).not.toHaveBeenCalled()
    await act(async () => {
      finish!()
    })
    await flushRaster()
    expect(h.current().pageSize).toEqual({ width: 2400, height: 1600 })
    expect(old.canvases.every((c) => c.width === 0)).toBe(true)
    expect(h.current().getRasterStats().retainedBytes).toBe(2400 * 1600 * 4)
    expect(h.current().getRasterStats().peakAdjacentBytes).toBe(2000 * 1200 * 4)
  } finally {
    h.unmount()
  }
})

it.each(['null', 'unmount', 'dpr'] as const)(
  'discards a cancelled foreground that resolves late after %s',
  async (change) => {
    const pdf = pageDocument(1000, 600)
    let finish: (() => void) | undefined
    const cancel = vi.fn()
    pdf.render.mockImplementationOnce(({ canvas }) => {
      pdf.canvases.push(canvas)
      return {
        promise: new Promise<void>((resolve) => {
          finish = resolve
        }),
        cancel
      }
    })
    const h = await mountRenderer(pdf.doc)
    const stats = h.current().getRasterStats
    let unmounted = false
    try {
      expect(h.current().pageCanvas).toBeNull()
      if (change === 'unmount') {
        h.unmount()
        unmounted = true
      } else
        await act(async () => {
          if (change === 'null') useViewerStore.setState({ pdfDocument: null })
          else {
            Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.25 })
            window.dispatchEvent(new Event('resize'))
          }
        })
      expect(cancel).toHaveBeenCalledOnce()
      await act(async () => {
        finish!()
      })
      await flushRaster()
      expect(pdf.canvases[0].width).toBe(0)
      if (change === 'dpr') {
        expect(h.current().pageCanvas!.width).toBe(2500)
        expect(stats().retainedBytes).toBe(2500 * 1500 * 4)
      } else expect(stats().liveBytes).toBe(0)
    } finally {
      if (!unmounted) h.unmount()
    }
  }
)

it('ignores pending old getPage results during rapid page switches and document reset', async () => {
  const pdf = pageDocument(1000, 600, 30)
  let resolvePage: ((page: typeof pdf.page) => void) | undefined
  vi.mocked(pdf.doc.getPage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePage = resolve
      })
  )
  const h = await mountRenderer(pdf.doc)
  try {
    for (let n = 2; n <= 20; n++) {
      await act(async () => {
        useViewerStore.getState().setPage(n)
      })
    }
    await act(async () => {
      resolvePage!(pdf.page)
    })
    await flushRaster()
    expect(h.current().pageSize).toEqual({ width: 2000, height: 1200 })
    // Only latest foreground and its two neighbors may actually render.
    expect(pdf.render.mock.calls.length).toBeLessThanOrEqual(3)
    expect(h.current().getRasterStats().retainedBytes).toBeLessThanOrEqual(PDF_RASTER_BUDGET)
    await act(async () => {
      useViewerStore.setState({ pdfDocument: null })
    })
    expect(h.current().pageCanvas).toBeNull()
    expect(h.current().getRasterStats().liveBytes).toBe(0)
  } finally {
    h.unmount()
  }
})

it('observes a resolution media query change even without a window resize and removes listeners', async () => {
  const queries: Array<{ listener?: EventListener; remove: ReturnType<typeof vi.fn> }> = []
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => {
      const item = { listener: undefined as EventListener | undefined, remove: vi.fn() }
      queries.push(item)
      return {
        addEventListener: (_: string, fn: EventListener) => {
          item.listener = fn
        },
        removeEventListener: item.remove
      }
    })
  })
  const pdf = pageDocument(1000, 600)
  const h = await mountRenderer(pdf.doc)
  try {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.5 })
    await act(async () => {
      queries[0].listener!(new Event('change'))
    })
    await flushRaster()
    expect(h.current().pageCanvas!.width).toBe(3000)
    expect(queries[0].remove).toHaveBeenCalled()
  } finally {
    h.unmount()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  }
  expect(queries.at(-1)!.remove).toHaveBeenCalled()
})

it('keeps the old DPR image alive until the replacement has actually committed', async () => {
  const pdf = pageDocument(1000, 600)
  const h = await mountRenderer(pdf.doc)
  const old = h.current().pageCanvas!
  const oldWidth = old.width
  let finish: (() => void) | undefined
  pdf.render.mockImplementationOnce(({ canvas }) => {
    pdf.canvases.push(canvas)
    return {
      promise: new Promise<void>((resolve) => {
        finish = resolve
      }),
      cancel: vi.fn()
    }
  })
  try {
    await act(async () => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
      window.dispatchEvent(new Event('resize'))
    })
    await flushRaster()
    expect(h.current().pageCanvas).toBe(old)
    expect(old.width).toBe(oldWidth)
    expect(h.current().getRasterStats().retainedBytes).toBe(0)
    await act(async () => {
      finish!()
    })
    await flushRaster()
    expect(h.current().pageCanvas).not.toBe(old)
    expect(old.width).toBe(0)
  } finally {
    h.unmount()
  }
})

it('plateaus the default cache across 40 mixed page sizes and all supported DPRs', async () => {
  const pdf = pageDocument(1000, 600, 40)
  vi.mocked(pdf.doc.getPage).mockImplementation(
    async (n) =>
      pageDocument(n % 3 === 0 ? 7000 : n % 2 ? 2400 : 800, n % 3 === 0 ? 5000 : n % 2 ? 2400 : 600)
        .page
  )
  const h = await mountRenderer(pdf.doc)
  const stats = h.current().getRasterStats
  try {
    for (let n = 1; n <= 40; n++) {
      await act(async () => {
        useViewerStore.getState().setPage(n)
        Object.defineProperty(window, 'devicePixelRatio', {
          configurable: true,
          value: [1, 1.25, 1.5, 2][n % 4]
        })
        window.dispatchEvent(new Event('resize'))
      })
      await flushRaster()
      expect(stats().retainedBytes).toBeLessThanOrEqual(PDF_RASTER_BUDGET)
      expect(stats().transientBytes).toBe(0)
      expect(stats().liveBytes).toBeLessThanOrEqual(PDF_RASTER_BUDGET + stats().displayedBytes)
    }
  } finally {
    h.unmount()
  }
  expect(stats().liveBytes).toBe(0)
})
