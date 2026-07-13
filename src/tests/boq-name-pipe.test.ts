import { describe, it, expect } from 'vitest'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { LinearMarkup } from '@renderer/types/markup'

// RENAME-PIPE (/code-review 17 --fix): freehand rename can produce a name containing a
// literal '|'. The aggregator must split the `${name}|${type}` bucket key on its LAST '|'
// (the type word never contains one) so name/type/uom/rate stay correct in the export.

describe('RENAME-PIPE: aggregator recovers a name containing a literal "|"', () => {
  it('splits the bucket key on the LAST "|" so name/type/uom/rate are correct', () => {
    const grid: LinearMarkup = {
      id: 'g',
      type: 'linear',
      page: 1,
      name: 'Grid A|B',
      categoryId: 'cat-e',
      color: '#0078d4',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      createdAt: 1
    }
    const result = aggregateBoq({
      markups: { 1: [grid] },
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } },
      globalUnit: 'mm',
      totalPages: 1,
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'],
      rates: { 'Grid A|B|linear': { material: 10, labor: 0, markup: 0 } },
      getColorForName: () => null
    })
    const row = result.categories[0].items[0]
    expect(row.label).toBe('Grid A|B') // NOT mis-split to 'Grid A'
    expect(row.type).toBe('linear')
    expect(row.uom).toBe('mm') // linear uom, not the 'area' fallback of a bogus type
    expect(row.material).toBe(10) // rate key matched, not price 0
  })
})
