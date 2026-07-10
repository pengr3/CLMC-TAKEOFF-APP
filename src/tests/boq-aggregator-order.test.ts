import { describe, it, expect } from 'vitest'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { CountMarkup } from '@renderer/types/markup'

// Phase 17 (Req 2, D-11): aggregateBoq orders rows WITHIN a category by the persisted
// `categoryItemOrder` (a rank map over `${name}|${type}` bucket keys), replacing the
// former alphabetical `localeCompare` sort. Default (no order) = PLACEMENT order.
// Unranked/newly-added items append after ranked ones (stable sort). These tests
// inject the order via opts (no store dependency), mirroring boq-aggregator.test.ts.

const PIXELS_PER_MM = 1

function countMarkup(opts: {
  id: string
  page: number
  name: string
  categoryId: string
  color: string
}): CountMarkup {
  return {
    id: opts.id,
    type: 'count',
    page: opts.page,
    name: opts.name,
    categoryId: opts.categoryId,
    color: opts.color,
    createdAt: 0,
    point: { x: 0, y: 0 },
    sequence: 1
  }
}

const BASE = {
  pageScales: { 1: { pixelsPerMm: PIXELS_PER_MM, displayUnit: 'mm' } },
  globalUnit: 'mm',
  totalPages: 1,
  pdfOriginalFilename: 'plan.pdf',
  currentFilePath: null as string | null,
  getColorForName: (): string | null => '#0078d4'
}

describe('aggregateBoq — manual item order (Phase 17 Req 2, D-11)', () => {
  it('an ABSENT order yields PLACEMENT order, NOT alphabetical (Zebra placed first stays first)', () => {
    // Placement order: Zebra then Apple. The old localeCompare sort would flip these
    // to [Apple, Zebra]; the new default (no categoryItemOrder) must keep placement.
    const result = aggregateBoq({
      ...BASE,
      markups: {
        1: [
          countMarkup({ id: 'z', page: 1, name: 'Zebra', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'a', page: 1, name: 'Apple', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e']
      // no categoryItemOrder → {} default
    })
    const labels = result.categories[0].items.map((i) => i.label)
    expect(labels).toEqual(['Zebra', 'Apple'])
    // Explicit regression proof: it is NOT the alphabetical order.
    expect(labels).not.toEqual(['Apple', 'Zebra'])
  })

  it('an injected categoryItemOrder positions rows by rank', () => {
    // Placement order A, B, C; injected order ranks them C, A, B.
    const result = aggregateBoq({
      ...BASE,
      markups: {
        1: [
          countMarkup({ id: 'a', page: 1, name: 'Apple', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'b', page: 1, name: 'Banana', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'c', page: 1, name: 'Cherry', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'],
      categoryItemOrder: { 'cat-e': ['Cherry|count', 'Apple|count', 'Banana|count'] }
    })
    const labels = result.categories[0].items.map((i) => i.label)
    expect(labels).toEqual(['Cherry', 'Apple', 'Banana'])
  })

  it('an unranked/new bucket appends AFTER ranked ones, in placement order (stable sort)', () => {
    // Placement A, B, C, D; only Cherry + Apple are ranked. Banana + Date are new
    // (rank Infinity) → they append after the ranked pair, preserving placement order
    // (Banana before Date), proving newly-added items append rather than alpha-sort.
    const result = aggregateBoq({
      ...BASE,
      markups: {
        1: [
          countMarkup({ id: 'a', page: 1, name: 'Apple', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'b', page: 1, name: 'Banana', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'c', page: 1, name: 'Cherry', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'd', page: 1, name: 'Date', categoryId: 'cat-e', color: '#0078d4' })
        ]
      },
      categoriesById: { 'cat-e': { id: 'cat-e', name: 'Electrical' } },
      categoryOrder: ['cat-e'],
      categoryItemOrder: { 'cat-e': ['Cherry|count', 'Apple|count'] }
    })
    const labels = result.categories[0].items.map((i) => i.label)
    expect(labels).toEqual(['Cherry', 'Apple', 'Banana', 'Date'])
  })

  it('the uncategorized bucket is ordered via the __uncat__ key', () => {
    // Uncategorized markups (empty categoryId) bucket under '__uncat__'; the order map
    // keys on '__uncat__' too. Placement X, Y; injected order flips to Y, X.
    const result = aggregateBoq({
      ...BASE,
      markups: {
        1: [
          countMarkup({ id: 'x', page: 1, name: 'Xenon', categoryId: '', color: '#0078d4' }),
          countMarkup({ id: 'y', page: 1, name: 'Yttrium', categoryId: '', color: '#0078d4' })
        ]
      },
      categoriesById: {},
      categoryOrder: [],
      categoryItemOrder: { __uncat__: ['Yttrium|count', 'Xenon|count'] }
    })
    const labels = result.categories[0].items.map((i) => i.label)
    expect(labels).toEqual(['Yttrium', 'Xenon'])
  })

  it('an order entry for one category does not affect another category', () => {
    // cat-e is reordered; cat-c is untouched → cat-c keeps placement order.
    const result = aggregateBoq({
      ...BASE,
      markups: {
        1: [
          countMarkup({ id: 'e1', page: 1, name: 'Alpha', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'e2', page: 1, name: 'Beta', categoryId: 'cat-e', color: '#0078d4' }),
          countMarkup({ id: 'c1', page: 1, name: 'Gamma', categoryId: 'cat-c', color: '#107c10' }),
          countMarkup({ id: 'c2', page: 1, name: 'Delta', categoryId: 'cat-c', color: '#107c10' })
        ]
      },
      categoriesById: {
        'cat-e': { id: 'cat-e', name: 'Electrical' },
        'cat-c': { id: 'cat-c', name: 'Civil' }
      },
      categoryOrder: ['cat-e', 'cat-c'],
      categoryItemOrder: { 'cat-e': ['Beta|count', 'Alpha|count'] }
    })
    const elec = result.categories.find((c) => c.name === 'Electrical')!
    const civil = result.categories.find((c) => c.name === 'Civil')!
    expect(elec.items.map((i) => i.label)).toEqual(['Beta', 'Alpha'])
    // Civil never reordered → placement order Gamma, Delta (NOT alphabetical Delta, Gamma).
    expect(civil.items.map((i) => i.label)).toEqual(['Gamma', 'Delta'])
  })
})
