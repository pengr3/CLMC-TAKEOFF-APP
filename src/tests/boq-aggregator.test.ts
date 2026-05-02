import { describe, it, expect } from 'vitest'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { AreaMarkup, LinearMarkup, PerimeterMarkup, CountMarkup } from '@renderer/types/markup'

const PIXELS_PER_MM = 1 // 1 pixel = 1 mm makes pixelLengthToReal in 'mm' a pass-through

function countMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string }): CountMarkup {
  return {
    id: opts.id, type: 'count', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    point: { x: 0, y: 0 }, sequence: 1
  }
}
function linearMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string; len: number }): LinearMarkup {
  return {
    id: opts.id, type: 'linear', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    points: [{ x: 0, y: 0 }, { x: opts.len, y: 0 }]
  }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function areaMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string; side: number }): AreaMarkup {
  const s = opts.side
  return {
    id: opts.id, type: 'area', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    points: [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }]
  }
}
function perimeterMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string; side: number }): PerimeterMarkup {
  const s = opts.side
  return {
    id: opts.id, type: 'perimeter', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    points: [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }]
  }
}

describe('aggregateBoq — D-01..D-13 / EXPRT-01', () => {
  it('empty project returns empty categories + grandTotals', () => {
    const result = aggregateBoq({
      markups: {}, pageScales: {}, globalUnit: 'mm', totalPages: 0,
      categoriesById: {}, categoryOrder: [], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => null
    })
    expect(result.categories).toEqual([])
    expect(result.grandTotals).toEqual([])
    expect(result.metadata.totalMarkups).toBe(0)
    expect(result.metadata.totalPages).toBe(0)
  })

  it('count markups across two pages aggregate into a single row with quantity 2', () => {
    const result = aggregateBoq({
      markups: {
        1: [countMarkup({ id: 'a', page: 1, name: 'Outlet', categoryId: 'cat-elec', color: '#0078d4' })],
        2: [countMarkup({ id: 'b', page: 2, name: 'Outlet', categoryId: 'cat-elec', color: '#0078d4' })]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' }, 2: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 2,
      categoriesById: { 'cat-elec': { id: 'cat-elec', name: 'Electrical' } },
      categoryOrder: ['cat-elec'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4'
    })
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].name).toBe('Electrical')
    expect(result.categories[0].items).toHaveLength(1)
    expect(result.categories[0].items[0].label).toBe('Outlet')
    expect(result.categories[0].items[0].quantity).toBe(2)
    expect(result.categories[0].items[0].uom).toBe('ea')
    expect(result.categories[0].items[0].color).toBe('#0078d4')
  })

  it('perimeter markup synthesizes two rows: "(perimeter)" and "(area)" — D-01, D-02', () => {
    // 10x10 square: perimeter = 40 mm, area = 100 mm²
    const result = aggregateBoq({
      markups: {
        1: [perimeterMarkup({ id: 'p1', page: 1, name: 'Wall', categoryId: 'cat-c', color: '#107c10', side: 10 })]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-c': { id: 'cat-c', name: 'Civil' } },
      categoryOrder: ['cat-c'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#107c10'
    })
    const labels = result.categories[0].items.map(i => i.label).sort()
    expect(labels).toEqual(['Wall (area)', 'Wall (perimeter)'])
    const perim = result.categories[0].items.find(i => i.label === 'Wall (perimeter)')!
    const area = result.categories[0].items.find(i => i.label === 'Wall (area)')!
    expect(perim.quantity).toBe(40)
    expect(perim.uom).toBe('mm')
    expect(area.quantity).toBe(100)
    expect(area.uom).toBe('mm²')
  })

  it('same name with two non-perimeter types triggers (type) suffix on both rows — D-02', () => {
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'c', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          linearMarkup({ id: 'l', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4', len: 5 })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4'
    })
    const labels = result.categories[0].items.map(i => i.label).sort()
    expect(labels).toEqual(['Outlet (count)', 'Outlet (linear)'])
  })

  it('uncalibrated page excludes length/area/perimeter; counts export — D-06', () => {
    const result = aggregateBoq({
      markups: {
        1: [linearMarkup({ id: 'l1', page: 1, name: 'Wire', categoryId: 'cat-e', color: '#0078d4', len: 5 })],
        2: [
          countMarkup({ id: 'c2', page: 2, name: 'Switch', categoryId: 'cat-e', color: '#0078d4' }),
          linearMarkup({ id: 'l2', page: 2, name: 'WireUnscaled', categoryId: 'cat-e', color: '#0078d4', len: 99 })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } /* page 2 missing */ },
      globalUnit: 'mm', totalPages: 2,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4'
    })
    const labels = result.categories[0].items.map(i => i.label).sort()
    expect(labels).toEqual(['Switch', 'Wire']) // WireUnscaled excluded; Switch (count) kept
  })

  it('categoryOrder is preserved; empty categories excluded — D-11', () => {
    const result = aggregateBoq({
      markups: {
        1: [countMarkup({ id: 'a', page: 1, name: 'Pipe', categoryId: 'cat-p', color: '#107c10' })]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: {
        'cat-p': { id: 'cat-p', name: 'Plumbing' },
        'cat-e': { id: 'cat-e', name: 'Electrical' }
      },
      categoryOrder: ['cat-e', 'cat-p'], // Electrical FIRST in order, but EMPTY → must be excluded
      pdfOriginalFilename: 'plan.pdf', currentFilePath: null, getColorForName: () => '#107c10'
    })
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].name).toBe('Plumbing')
  })

  it('mixed-UoM category produces one subtotal row per UoM — D-12, Q3', () => {
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'c', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'c2', page: 1, name: 'Switch', categoryId: 'cat-e', color: '#0078d4' }),
          linearMarkup({ id: 'l', page: 1, name: 'Wire', categoryId: 'cat-e', color: '#0078d4', len: 7 })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4'
    })
    const subtotals = result.categories[0].subtotals
    const byUom: Record<string, number> = {}
    for (const s of subtotals) byUom[s.uom] = s.total
    expect(byUom['ea']).toBe(2)
    expect(byUom['mm']).toBe(7)
    expect(result.grandTotals.find(g => g.uom === 'ea')?.total).toBe(2)
    expect(result.grandTotals.find(g => g.uom === 'mm')?.total).toBe(7)
  })

  it('getColorForName value is carried into the row (D-13)', () => {
    const result = aggregateBoq({
      markups: { 1: [countMarkup({ id: 'a', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })] },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: (n) => n === 'Outlet' ? '#d13438' : null
    })
    expect(result.categories[0].items[0].color).toBe('#d13438')
  })
})
