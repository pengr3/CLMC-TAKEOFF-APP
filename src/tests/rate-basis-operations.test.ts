import { beforeEach, expect, it } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { validateV2 } from '@renderer/lib/project-schema'
import { hydrateStores, snapshotProject } from '@renderer/lib/project-serialize'

const price = {
  material: 10,
  labor: 5,
  markup: 20,
  basis: 'm' as const,
  review: 'legacy-unresolved' as const
}
function saved() {
  return snapshotProject({
    pdfOriginalFilename: 'plan.pdf',
    pdfSha256: 'abc',
    pdfTotalPages: 1,
    perPageDimensions: {}
  })
}
beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.setState({
    globalUnit: 'ft',
    pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } }
  })
  const cat = (id: string) => ({ id, name: id, color: '#123456', paletteIndex: 0 })
  const line = (id: string, categoryId: string, name = 'A|B') => ({
    id,
    categoryId,
    name,
    page: 1,
    type: 'linear' as const,
    color: '#123456',
    createdAt: 1,
    points: [
      { x: 0, y: 0 },
      { x: 10000, y: 0 }
    ]
  })
  useMarkupStore.setState({
    pageMarkups: { 1: [line('a', 'c1'), line('b', 'c2'), line('c', 'c1', 'Other')] },
    categories: { c1: cat('c1'), c2: cat('c2') },
    categoryOrder: ['c1', 'c2']
  })
  useProjectStore.setState({
    rates: { 'A|B|linear': { ...price }, 'Other|linear': { ...price, material: 2 } }
  })
})

it('retains exact basis, unresolved review and money through rename, categories, ordering, undo/redo and reopen', () => {
  const initial = aggregateBoq({ totalPages: 1 }).grandTotalCost
  const initialRates = useProjectStore.getState().rates
  expect(useMarkupStore.getState().renameGroup('A|B', 'Other').ok).toBe(false)
  expect(useMarkupStore.getState().renameGroup('A|B', 'Renamed').ok).toBe(true)
  expect(useProjectStore.getState().rates['Renamed|linear']).toEqual(price)
  useMarkupStore.getState().moveGroup('Renamed', 'c1')
  useMarkupStore.getState().reorderItems('c1', ['Other|linear', 'Renamed|linear'])
  for (let i = 0; i < 3; i++) useMarkupStore.getState().undo()
  expect(useProjectStore.getState().rates).toEqual(initialRates)
  for (let i = 0; i < 3; i++) useMarkupStore.getState().redo()
  expect(useProjectStore.getState().rates['Renamed|linear']).toEqual(price)
  hydrateStores(JSON.parse(JSON.stringify(saved())))
  expect(aggregateBoq({ totalPages: 1 }).grandTotalCost).toBeCloseTo(initial, 9)
  expect(useProjectStore.getState().getUnresolvedRateKeys()).toContain('Renamed|linear')
})

it.each(['copyGroup', 'duplicateGroup'] as const)(
  '%s captures a new blank basis for exact redo even after units change',
  (method) => {
    if (method === 'copyGroup') useMarkupStore.getState().copyGroup('A|B', 'c2')
    else useMarkupStore.getState().duplicateGroup('A|B')
    const key = 'A|B (2)|linear'
    const blank = { material: 0, labor: 0, markup: 30, basis: 'ft', review: 'reviewed' }
    expect(useProjectStore.getState().rates[key]).toEqual(blank)
    useMarkupStore.getState().undo()
    expect(useProjectStore.getState().rates[key]).toBeUndefined()
    useScaleStore.setState({ globalUnit: 'cm' })
    useMarkupStore.getState().redo()
    expect(useProjectStore.getState().rates[key]).toEqual(blank)
    expect(useProjectStore.getState().rates['A|B|linear']).toEqual(price)
  }
)

it.each(['bogus', 'm²', 'ea', null, {}, Infinity])(
  'rejects malformed/incompatible explicit linear basis %j before hydration changes state',
  (basis) => {
    const input = JSON.parse(JSON.stringify(saved()))
    input.rates['A|B|linear'].basis = basis
    expect(() => validateV2(input)).toThrow(/basis/i)
    const session = useProjectStore.getState().documentSessionId
    expect(() => hydrateStores(input)).toThrow(/basis/i)
    expect(useProjectStore.getState().documentSessionId).toBe(session)
  }
)

it.each([-1, NaN, Infinity, '10', null])(
  'rejects invalid explicit monetary input %j',
  (material) => {
    const input = saved()
    input.rates!['A|B|linear'] = { ...price, material }
    expect(() => validateV2(input)).toThrow(/rate/i)
  }
)

it('distinguishes valid legacy inference from an invalid new review status', () => {
  const input = saved()
  input.rates!['A|B|linear'] = { ...price, review: 'auto-reviewed' }
  expect(() => validateV2(input)).toThrow(/review/i)
})
