import { describe, expect, it } from 'vitest'
import { buildMarkupSummary } from '@renderer/lib/markup-summary'
import type {
  AreaMarkup,
  CountMarkup,
  LinearMarkup,
  PerimeterMarkup,
  WallMarkup
} from '@renderer/types/markup'
import type { PageScale } from '@renderer/types/scale'

const base = {
  id: 'hover-test',
  page: 1,
  name: 'Reference',
  categoryId: '',
  color: '#123456',
  createdAt: 0
}
const scale: PageScale = { pixelsPerMm: 0.1, displayUnit: 'm' }
const line: LinearMarkup = {
  ...base,
  type: 'linear',
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 }
  ],
  arcs: { 0: { midX: 100, midY: -100 } }
}
const area: AreaMarkup = {
  ...base,
  type: 'area',
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 0, y: 100 }
  ],
  arcs: line.arcs
}
const perimeter: PerimeterMarkup = { ...area, type: 'perimeter' }
const wall: WallMarkup = { ...line, type: 'wall', wallHeight: 3000 }

describe('canvas hover measurement summaries', () => {
  it('measures a semicircular run by pi rather than its two-metre chord', () => {
    expect(buildMarkupSummary(line, scale)).toBe('Reference — 3.1 m')
  })
  it('includes the semicircular area beyond a two-square-metre rectangle', () => {
    expect(buildMarkupSummary(area, scale)).toBe('Reference — 3.6 m²')
  })
  it('matches the native curved outline: 4 + pi metres and 2 + pi/2 square metres', () => {
    expect(buildMarkupSummary(perimeter, scale)).toBe('Reference — P:7.1 m  A:3.6 m²')
  })
  it('also measures an arc on the closing edge', () => {
    const closing: PerimeterMarkup = {
      ...perimeter,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 0 }
      ],
      arcs: { 3: { midX: 100, midY: -100 } }
    }
    expect(buildMarkupSummary(closing, scale)).toBe('Reference — P:7.1 m  A:3.6 m²')
  })
  it('reports a curved wall as arc length times height in square metres', () => {
    expect(buildMarkupSummary(wall, scale)).toBe('Reference — 9.4 m²')
    expect(buildMarkupSummary(wall, { ...scale, displayUnit: 'ft' })).toBe('Reference — 9.4 m²')
  })
  it('does not close a straight wall run or synthesize polygon area', () => {
    expect(buildMarkupSummary({ ...wall, arcs: undefined }, scale)).toBe('Reference — 6.0 m²')
  })
  it('converts curved length to the calibrated display unit', () => {
    expect(buildMarkupSummary(line, { ...scale, displayUnit: 'ft' })).toBe('Reference — 10.3 ft')
  })
  it('retains straight measurements and count sequence summaries', () => {
    expect(buildMarkupSummary({ ...line, arcs: undefined }, scale)).toBe('Reference — 2.0 m')
    expect(buildMarkupSummary({ ...perimeter, arcs: undefined }, scale)).toBe(
      'Reference — P:6.0 m  A:2.0 m²'
    )
    const pin: CountMarkup = { ...base, type: 'count', point: { x: 0, y: 0 }, sequence: 5 }
    expect(buildMarkupSummary(pin, null)).toBe('Reference — #5')
  })
  it('keeps names without fabricated quantities when uncalibrated or wall height is invalid', () => {
    expect(buildMarkupSummary(line, null)).toBe('Reference')
    expect(buildMarkupSummary(line, { ...scale, pixelsPerMm: 0 })).toBe('Reference')
    expect(buildMarkupSummary({ ...wall, wallHeight: 0 }, scale)).toBe('Reference')
  })
})
