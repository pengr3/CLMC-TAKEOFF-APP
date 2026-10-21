/** @vitest-environment jsdom */
import { act } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { pageDocument, mountRenderer, flushRaster } from './helpers/pdf-render-harness'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { computePixelsPerMm } from '@renderer/lib/scale-math'
import {
  polylineLength,
  polygonArea,
  pixelLengthToReal,
  pixelAreaToReal
} from '@renderer/lib/markup-math'
import type { ProjectFileV2 } from '@renderer/lib/project-schema'

const image = vi.hoisted(() => ({ width: 0, height: 0 }))
vi.mock('react-konva', () => ({
  Image: (props: { width: number; height: number }) => {
    image.width = props.width
    image.height = props.height
    return null
  }
}))

beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
})

it.each([1, 1.25, 1.5, 2])(
  'preserves PDF landmarks, 10m/100m² and reopened geometry at DPR %s',
  async (dpr) => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr })
    // 14000 canonical width crosses the 16384 physical clamp at DPR 1.25.
    const pdf = pageDocument(7000.25, 5000.125)
    const h = await mountRenderer(pdf.doc, 1, true)
    try {
      const geometry = h.current().pageSize!
      expect(geometry).toEqual({ width: 14000.5, height: 10000.25 })
      const call = pdf.render.mock.calls[0][0]
      // Independent PDF landmark: x=1000 -> raster -> the ACTUAL image bounds.
      const rasterX = 1000 * (call.viewport.width / 7000.25) * call.transform![0]
      const pageX = (rasterX / h.current().pageCanvas!.width) * image.width
      expect(pageX).toBeCloseTo(2000, 9)
      const screen = (x: number, y: number): { x: number; y: number } =>
        h.transform.point({ x: x * 2, y: y * 2 })
      await act(async () => {
        h.calibration().activate()
      })
      await act(async () => {
        h.calibration().recordClick(screen(1000, 800))
      })
      await act(async () => {
        h.calibration().recordClick(screen(2500, 800))
      })
      const state = h.calibration().state
      const points = [state.startPoint!, state.endPoint!]
      const pixelsPerMm = computePixelsPerMm(state.linePixelLength, 10, 'm')
      expect(pixelsPerMm).toBeCloseTo(0.3, 12)
      useScaleStore.setState({ pageScales: { 1: { pixelsPerMm, displayUnit: 'm' } } })
      useMarkupStore.setState({
        pageMarkups: {
          1: [
            {
              id: 'known',
              type: 'linear',
              page: 1,
              name: '10 m span',
              categoryId: '',
              color: '#000000',
              createdAt: 1,
              points
            }
          ]
        }
      })
      const saved = JSON.parse(
        JSON.stringify(
          snapshotProject({
            pdfOriginalFilename: 'known.pdf',
            pdfSha256: 'known',
            pdfTotalPages: 1,
            perPageDimensions: { 1: geometry }
          })
        )
      ) as ProjectFileV2
      await act(async () => {
        hydrateStores(saved)
        Object.defineProperty(window, 'devicePixelRatio', {
          configurable: true,
          value: dpr === 2 ? 1 : 2
        })
        window.dispatchEvent(new Event('resize'))
      })
      await flushRaster()
      const reopened = useMarkupStore.getState().pageMarkups[1][0]
      expect(reopened.type).toBe('linear')
      if (reopened.type !== 'linear') throw new Error('Expected persisted line')
      expect(reopened.points).toEqual(points)
      const scale = useScaleStore.getState().pageScales[1].pixelsPerMm
      expect(scale).toBe(pixelsPerMm)
      expect(pixelLengthToReal(polylineLength(reopened.points), scale, 'm')).toBeCloseTo(10, 10)
      const square = [
        points[0],
        points[1],
        { x: points[1].x, y: points[1].y + 3000 },
        { x: points[0].x, y: points[0].y + 3000 }
      ]
      expect(pixelAreaToReal(polygonArea(square), scale, 'm')).toBeCloseTo(100, 9)
      expect(h.current().pageSize).toEqual(geometry)
    } finally {
      h.unmount()
    }
  }
)

it.each([4095.75, 4096.25, 8191.75, 8192.25])(
  'does not round canonical dimensions at clamp boundary %s',
  async (width) => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    const pdf = pageDocument(width, 3000.125)
    const h = await mountRenderer(pdf.doc)
    try {
      expect(h.current().pageSize).toEqual({ width: width * 2, height: 6000.25 })
      const size = h.current().pageSize
      await h.rerender()
      await act(async () => {
        useViewerStore.setState({ selectedMarkupIds: ['irrelevant'] })
      })
      expect(h.current().pageSize).toBe(size)
      expect(h.current().pageCanvas!.width).toBeLessThanOrEqual(16384)
    } finally {
      h.unmount()
    }
  }
)
