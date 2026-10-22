import { beforeEach, expect, it } from 'vitest'
import { hydrateStores, snapshotProject } from '@renderer/lib/project-serialize'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'

beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
})
const params = { pdfOriginalFilename: 'old-clamped.pdf', pdfSha256: 'a'.repeat(64), pdfTotalPages: 1,
  perPageDimensions: { 1: { width: 7000.25, height: 5000 } } }

it('quarantines raw old-runtime clamped coordinates and calibration without guessing DPR', () => {
  const old = snapshotProject(params)
  delete old.pages[0].coordinateBasis
  // Historical DPR 2, clamp 16384 backing pixels -> stage width 8192.
  old.pages[0].markups = [{ id: 'pin', type: 'count', name: 'Pin', page: 1, categoryId: '', color: '#abc', createdAt: 1,
    point: { x: 4096, y: 2000 }, sequence: 1 }]
  old.pages[0].scale = { pixelsPerMm: 0.8192, displayUnit: 'm' }
  hydrateStores(old)
  expect(useProjectStore.getState().geometryReviewPages).toEqual([1])
  expect(useMarkupStore.getState().pageMarkups[1][0]).toEqual(old.pages[0].markups[0])
  expect(useScaleStore.getState().pageScales[1]).toBeUndefined()
  expect(snapshotProject(params).pages[0].coordinateBasis).toBe('legacy-unverified')
})

it('persists the canonical basis for new files and does not repeatedly quarantine them', () => {
  const current = snapshotProject(params)
  expect(current.pages[0].coordinateBasis).toBe('pdf-base-scale-2')
  hydrateStores(current)
  expect(useProjectStore.getState().geometryReviewPages).toEqual([])
})

it('requires recalibration before accepting measured geometry; verified repositioning survives reopen', () => {
  const old = snapshotProject(params)
  delete old.pages[0].coordinateBasis
  old.pages[0].markups = [{ id: 'span', type: 'linear', name: 'Span', page: 1, categoryId: '', color: '#abc', createdAt: 1,
    points: [{ x: 0, y: 0 }, { x: 8192, y: 0 }] }]
  old.pages[0].scale = { pixelsPerMm: 0.8192, displayUnit: 'm' }
  hydrateStores(old)
  expect(useProjectStore.getState().verifyGeometryPage(1)).toBe(false)
  // User checks endpoints against PDF landmarks and repositions the span.
  useMarkupStore.setState({ pageMarkups: { 1: [{ ...old.pages[0].markups[0], points: [{ x: 0, y: 0 }, { x: 14000.5, y: 0 }] }] } })
  useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1.40005, displayUnit: 'm' } } })
  expect(useProjectStore.getState().verifyGeometryPage(1)).toBe(true)
  const upgraded = snapshotProject(params)
  expect(upgraded.pages[0].coordinateBasis).toBe('pdf-base-scale-2')
  hydrateStores(upgraded)
  expect(useProjectStore.getState().geometryReviewPages).toEqual([])
  const scale = useScaleStore.getState().pageScales[1].pixelsPerMm
  expect(14000.5 / scale).toBeCloseTo(10000)
  expect(14000.5 ** 2 / scale ** 2).toBeCloseTo(100_000_000)
})
