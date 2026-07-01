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

  it('perimeter markup synthesizes ONE length row (no area) — D-01, D-02 (Phase 15 one-row contract)', () => {
    // 10x10 square: perimeter = 40 mm. Phase 15 drops the area synthesis —
    // a lone perimeter markup yields exactly ONE row (length), labelled plainly
    // 'Wall' because it now follows the D-02 collision rule and there is no
    // same-named count/linear/area row in the category to force a suffix.
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
    // Exactly ONE row — the area row is gone.
    expect(result.categories[0].items).toHaveLength(1)
    const labels = result.categories[0].items.map(i => i.label)
    // Lone perimeter → plain label, no '(perimeter)' suffix and no '(area)' row.
    expect(labels).toEqual(['Wall'])
    expect(labels.some(l => l.includes('(area)'))).toBe(false)
    const item = result.categories[0].items[0]
    expect(item.label).toBe('Wall')
    expect(item.type).toBe('perimeter')
    expect(item.uom).toBe('mm')
    expect(item.quantity).toBe(40)
  })

  it('WR-07: perimeter with an arc on the CLOSING edge — LENGTH reflects it (Phase-14 arc regression guard; area row dropped in Phase 15)', () => {
    // Square side 100 (CCW): v0(0,0) v1(100,0) v2(100,100) v3(0,100).
    // Closing edge is v3→v0 (a vertical chord, length 100); the arc keys on
    // index n-1 = 3 in the closing-augmented array (pts[3]→pts[4]=pts[0]).
    // Arc mid at (-50, 50) → a left-bulging semicircle on the closing edge:
    // R = 50. This is the Phase-14 arc-length regression guard — it MUST survive
    // the Phase-15 perimeter one-row change. The area assertion is intentionally
    // dropped (perimeter no longer synthesizes an area row).
    const s = 100
    const arcedClosing: PerimeterMarkup = {
      id: 'pc', type: 'perimeter', page: 1, name: 'Curved', categoryId: 'cat-c',
      color: '#107c10', createdAt: 0,
      points: [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }],
      arcs: { 3: { midX: -50, midY: 50 } }
    }
    const result = aggregateBoq({
      markups: { 1: [arcedClosing] },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-c': { id: 'cat-c', name: 'Civil' } },
      categoryOrder: ['cat-c'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#107c10'
    })
    // Exactly ONE row — the area row is gone. Lone perimeter → plain label 'Curved'.
    expect(result.categories[0].items).toHaveLength(1)
    expect(result.categories[0].items.some(i => i.label.includes('(area)'))).toBe(false)
    const perim = result.categories[0].items.find(i => i.label === 'Curved')!
    // LENGTH oracle: three straight sides (300) + semicircle arc on the closing
    // edge (π·R = π·50 ≈ 157.0796) = 457.0796. Phase-14 arc-aware length MUST hold.
    const R = 50
    expect(perim.quantity).toBeCloseTo(300 + Math.PI * R, 4)
    expect(perim.type).toBe('perimeter')
    expect(perim.uom).toBe('mm')
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

  // ===========================================================================
  // Phase 16 — money-math RED cases (proof a). The Phase-15 scalar rate/cost
  // contract WIDENS to the {material, labor, markup} PriceEntry shape:
  //   materialCost = material × qty;  laborCost = labor × qty;
  //   cost = materialCost + laborCost;  price = cost × (1 + markup/100);
  //   margin = price − cost.
  // Per category: costSubtotal / priceSubtotal / marginSubtotal (Σ rows).
  // Per structure: grandTotalCost / grandTotalPrice / grandTotalMargin (Σ cats).
  // Absent ENTRY → material/labor 0, markup 30 (DEFAULT_MARKUP_PCT); an entry
  // present with explicit markup 0 is honored (NOT overridden to 30) — Pitfall 5.
  //
  // These FAIL at runtime until Wave 1 (16-02/16-03) widens the aggregator (it
  // still emits scalar `rate`/`cost` + a single costSubtotal/grandTotalCost).
  // They COMPILE today via `as any` casts on the injected PriceEntry `rates`
  // values + the new read fields, mirroring how project-schema-hidden.test.ts
  // casts to any before the types land. Do NOT "fix" the source to make these
  // green — that is Wave 1-3's job. The perimeter collision case (proof c below)
  // stays a Phase-15 keeper and must remain GREEN.
  // ===========================================================================

  it('proof c — perimeter joins the D-02 collision set: same name as a linear → (perimeter) suffix', () => {
    // One perimeter 'Skirting' + one linear 'Skirting' in the SAME category.
    // Phase 15: perimeter is now a first-class collision member, so BOTH rows
    // gain a type-word suffix: 'Skirting (linear)' and 'Skirting (perimeter)'.
    const result = aggregateBoq({
      markups: {
        1: [
          perimeterMarkup({ id: 'pc', page: 1, name: 'Skirting', categoryId: 'cat-c', color: '#107c10', side: 10 }),
          linearMarkup({ id: 'lc', page: 1, name: 'Skirting', categoryId: 'cat-c', color: '#107c10', len: 5 })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-c': { id: 'cat-c', name: 'Civil' } },
      categoryOrder: ['cat-c'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#107c10'
    })
    expect(result.categories[0].items).toHaveLength(2)
    const labels = result.categories[0].items.map(i => i.label).sort()
    expect(labels).toEqual(['Skirting (linear)', 'Skirting (perimeter)'])
  })

  it('proof a — material/labor/cost/price/margin at the row level (PriceEntry)', () => {
    // 3 'Outlet' count markups + a PriceEntry { material:5, labor:3, markup:30 }
    // for key 'Outlet|count':
    //   materialCost = 5 × 3 = 15;  laborCost = 3 × 3 = 9;  cost = 24;
    //   price = 24 × 1.3 = 31.2;    margin = 31.2 − 24 = 7.2.
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o3', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 5, labor: 3, markup: 30 } as any }
    } as any)
    const row = result.categories[0].items[0]
    expect(row.quantity).toBe(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    expect(r.material).toBe(5)
    expect(r.labor).toBe(3)
    expect(r.markup).toBe(30)
    expect(r.materialCost).toBe(15)
    expect(r.laborCost).toBe(9)
    expect(r.cost).toBe(24)
    // price = cost × (1 + markup/100) = 24 × 1.3 = 31.2; margin = 7.2.
    expect(r.price).toBeCloseTo(31.2, 6)
    expect(r.margin).toBeCloseTo(7.2, 6)
  })

  it('proof a — absent ENTRY → material/labor 0, cost 0, markup 30, price 0, margin 0; never throws', () => {
    // No rates passed at all → the Outlet row must read material/labor 0, cost 0,
    // markup DEFAULTS to 30 (Pitfall 5 — a genuinely-unpriced row is ₱0 but keeps
    // the 30% project default markup), and price/margin are 0 (0 × 1.3 = 0).
    const call = (): ReturnType<typeof aggregateBoq> =>
      aggregateBoq({
        markups: { 1: [countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })] },
        pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
        globalUnit: 'mm', totalPages: 1,
        categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
        categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
        currentFilePath: null, getColorForName: () => '#0078d4'
      })
    expect(call).not.toThrow()
    const row = call().categories[0].items[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    expect(r.material).toBe(0)
    expect(r.labor).toBe(0)
    expect(r.cost).toBe(0)
    // Absent-entry markup default is 30, NOT 0.
    expect(r.markup).toBe(30)
    expect(r.price).toBe(0)
    expect(r.margin).toBe(0)
  })

  it('proof a — explicit markup 0 is honored (NOT overridden to 30) — distinct from "no entry"', () => {
    // An entry present with markup:0 → price == cost, margin 0. This proves the
    // "no entry → 30" default is DISTINCT from "entry with explicit markup 0 → 0".
    //   material 10, labor 0, qty 2 → cost 20; markup 0 → price 20; margin 0.
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 10, labor: 0, markup: 0 } as any }
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result.categories[0].items[0] as any
    expect(r.markup).toBe(0)
    expect(r.cost).toBe(20)
    expect(r.price).toBe(20)
    expect(r.margin).toBe(0)
  })

  it('proof a — Cost/Price/Margin subtotals = Σ rows; grand totals = Σ categories', () => {
    // Two priced rows in Electrical:
    //   Outlet|count { material:5, labor:0, markup:30 } ×2 → cost 10, price 13,  margin 3
    //   Wire|linear  { material:3, labor:0, markup:30 } ×7 → cost 21, price 27.3, margin 6.3
    //   → costSubtotal 31, priceSubtotal 40.3, marginSubtotal 9.3
    // A second category Civil:
    //   Pipe|count   { material:4, labor:0, markup:30 } ×1 → cost 4,  price 5.2,  margin 1.2
    //   → costSubtotal 4, priceSubtotal 5.2, marginSubtotal 1.2
    // grandTotalCost = 35, grandTotalPrice = 45.5, grandTotalMargin = 10.5.
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          linearMarkup({ id: 'w1', page: 1, name: 'Wire', categoryId: 'cat-e', color: '#0078d4', len: 7 }),
          countMarkup({ id: 'p1', page: 1, name: 'Pipe', categoryId: 'cat-c', color: '#107c10' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: {
        'cat-e': { id: 'cat-e', name: 'Electrical' },
        'cat-c': { id: 'cat-c', name: 'Civil' }
      },
      categoryOrder: ['cat-e', 'cat-c'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      rates: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'Outlet|count': { material: 5, labor: 0, markup: 30 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'Wire|linear': { material: 3, labor: 0, markup: 30 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'Pipe|count': { material: 4, labor: 0, markup: 30 } as any
      }
    } as any)
    const elec = result.categories.find(c => c.name === 'Electrical')!
    const civil = result.categories.find(c => c.name === 'Civil')!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = elec as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = civil as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = result as any
    // Electrical subtotals — Σ of the two rows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(elec.items.reduce((acc, it) => acc + (it as any).cost, 0)).toBe(31)
    expect(e.costSubtotal).toBe(31)
    expect(e.priceSubtotal).toBeCloseTo(40.3, 6)
    expect(e.marginSubtotal).toBeCloseTo(9.3, 6)
    // Civil subtotals.
    expect(c.costSubtotal).toBe(4)
    expect(c.priceSubtotal).toBeCloseTo(5.2, 6)
    expect(c.marginSubtotal).toBeCloseTo(1.2, 6)
    // Grand totals = Σ category subtotals.
    expect(g.grandTotalCost).toBe(35)
    expect(g.grandTotalPrice).toBeCloseTo(45.5, 6)
    expect(g.grandTotalMargin).toBeCloseTo(10.5, 6)
  })

  it('proof b — PriceEntry is category-independent: same name|type in two categories reads ONE entry', () => {
    // 'Outlet|count' appears in Electrical AND Civil; a single rates entry → both
    // rows read the same material/labor/markup (the price map is keyed by
    // (name,type), category-INDEPENDENT).
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'oe', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'oc', page: 1, name: 'Outlet', categoryId: 'cat-c', color: '#107c10' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: {
        'cat-e': { id: 'cat-e', name: 'Electrical' },
        'cat-c': { id: 'cat-c', name: 'Civil' }
      },
      categoryOrder: ['cat-e', 'cat-c'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 5, labor: 2, markup: 40 } as any }
    } as any)
    const elec = result.categories.find(c => c.name === 'Electrical')!
    const civil = result.categories.find(c => c.name === 'Civil')!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e0 = elec.items[0] as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c0 = civil.items[0] as any
    expect(e0.material).toBe(5)
    expect(e0.labor).toBe(2)
    expect(e0.markup).toBe(40)
    expect(c0.material).toBe(5)
    expect(c0.labor).toBe(2)
    expect(c0.markup).toBe(40)
  })

  // ===========================================================================
  // WR-01 — the project-wide `defaultMarkup` option. Fallback is
  // `entry?.markup ?? opts.defaultMarkup ?? DEFAULT_MARKUP_PCT`:
  //   • no option passed  → 30 (the pre-WR-01 markup-default-30, kept green above)
  //   • defaultMarkup: 40 → an un-priced row's markup is 40 (price uses 40)
  //   • entry markup: 0   → still 0 even with defaultMarkup: 40 (per-entry wins)
  //   • defaultMarkup: 0  → un-priced row markup 0 (price === cost)
  // ===========================================================================

  it('WR-01 — defaultMarkup: 40 → an un-priced row uses 40 (price uses 40)', () => {
    // 2 un-priced Outlet counts, material/labor 0 → cost 0, so price is 0 regardless
    // of markup — assert the emitted markup itself is 40. Then a priced material=10
    // row proves the 40 flows into price: cost 20 → price 20×1.4 = 28, margin 8.
    const unpriced = aggregateBoq({
      markups: {
        1: [countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      defaultMarkup: 40
    })
    expect(unpriced.categories[0].items[0].markup).toBe(40)

    // A priced row (material only, no entry markup) picks up the 40 default.
    const priced = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // Entry has NO markup field → falls back to the 40 default.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 10, labor: 0 } as any },
      defaultMarkup: 40
    })
    const r = priced.categories[0].items[0]
    expect(r.markup).toBe(40)
    expect(r.cost).toBe(20)
    expect(r.price).toBeCloseTo(28, 6)
    expect(r.margin).toBeCloseTo(8, 6)
  })

  it('WR-01 — an entry with explicit markup:0 is NOT overridden by defaultMarkup:40', () => {
    // material 10, qty 2 → cost 20; explicit markup 0 → price == cost, margin 0.
    // The 40 project default must NOT leak in (per-entry markup wins, nullish `??`).
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 10, labor: 0, markup: 0 } as any },
      defaultMarkup: 40
    })
    const r = result.categories[0].items[0]
    expect(r.markup).toBe(0)
    expect(r.cost).toBe(20)
    expect(r.price).toBe(20)
    expect(r.margin).toBe(0)
  })

  it('WR-01 — defaultMarkup: 0 → an un-priced row markup 0, price === cost (0 honored)', () => {
    // material 10, qty 2 → cost 20; project default markup 0 (0 ?? 30 === 0) →
    // price == cost == 20, margin 0. Proves a project default of 0 is honored.
    const result = aggregateBoq({
      markups: {
        1: [
          countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'o2', page: 1, name: 'Outlet', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
      globalUnit: 'mm', totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'], pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null, getColorForName: () => '#0078d4',
      // Entry has material only, no markup → falls back to the defaultMarkup: 0.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rates: { 'Outlet|count': { material: 10, labor: 0 } as any },
      defaultMarkup: 0
    })
    const r = result.categories[0].items[0]
    expect(r.markup).toBe(0)
    expect(r.cost).toBe(20)
    expect(r.price).toBe(20)
    expect(r.margin).toBe(0)
  })
})
