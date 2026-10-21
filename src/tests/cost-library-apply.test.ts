import { beforeEach, describe, it, expect } from 'vitest'
import { applyLibraryRate } from '@renderer/lib/apply-library-rate'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { buildBoqCsv } from '../main/boq-writers'
import {
  validateLibraryRows,
  COST_LIBRARY_HEADERS,
  type CostLibraryItem
} from '../shared/cost-library'
import type { BoqItemRow } from '@renderer/lib/boq-types'

const source: CostLibraryItem = {
  code: 'E1',
  description: 'Power outlet',
  category: 'Electrical',
  unit: 'pcs',
  material: 100,
  labor: 80
}
const target: BoqItemRow = {
  label: 'Outlet',
  type: 'count',
  uom: 'ea',
  quantity: 2,
  categoryId: 'c1',
  material: 0,
  labor: 0,
  markup: 30,
  materialCost: 0,
  laborCost: 0,
  cost: 0,
  price: 0,
  margin: 0,
  color: null
}
beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.setState({
    pageMarkups: {
      1: [
        {
          id: 'm1',
          type: 'count',
          page: 1,
          name: 'Outlet',
          categoryId: 'c1',
          color: '#0078d4',
          createdAt: 1,
          sequence: 1,
          point: { x: 10, y: 20 }
        }
      ]
    },
    categories: { c1: { id: 'c1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
    categoryOrder: ['c1'],
    undoStack: [],
    redoStack: []
  })
  useScaleStore.setState({ pageScales: {}, globalUnit: 'm' })
})
describe('explicit library application', () => {
  it('copies both rates, preserves explicit markup, marks dirty and leaves markup geometry/names intact', () => {
    useProjectStore.getState().setPrice('Outlet|count', { material: 5, labor: 6, markup: 17.5 })
    useProjectStore.getState().setSaved('test.clmc')
    const markups = useMarkupStore.getState().pageMarkups
    expect(applyLibraryRate(target, source).ok).toBe(true)
    expect(useProjectStore.getState().rates['Outlet|count']).toEqual({
      material: 100,
      labor: 80,
      markup: 17.5,
      basis: 'ea', review: 'reviewed'
    })
    expect(useProjectStore.getState().isDirty).toBe(true)
    expect(useMarkupStore.getState().pageMarkups).toBe(markups)
  })
  it('uses the effective project default for a previously unpriced row', () => {
    useProjectStore.getState().setDefaultMarkupPct(12)
    applyLibraryRate(target, source)
    expect(useProjectStore.getState().rates['Outlet|count'].markup).toBe(12)
  })
  it.each(['m', 'm²', 'can'])(
    'blocks incompatible unit %s without dirtying the project',
    (unit) => {
      expect(applyLibraryRate(target, { ...source, unit }).ok).toBe(false)
      expect(useProjectStore.getState().rates).toEqual({})
      expect(useProjectStore.getState().isDirty).toBe(false)
    }
  )
  it('blocks invalid numeric rates even if invoked outside the picker', () => {
    expect(applyLibraryRate(target, { ...source, material: Infinity }).ok).toBe(false)
    expect(useProjectStore.getState().rates).toEqual({})
  })
  it('retains applied rates in saved project independently of later imports and exports them', () => {
    applyLibraryRate(target, source)
    const snap = JSON.parse(
      JSON.stringify(
        snapshotProject({
          pdfOriginalFilename: 'plan.pdf',
          pdfSha256: 'abc',
          pdfTotalPages: 1,
          perPageDimensions: { 1: { width: 100, height: 100 } }
        })
      )
    )
    validateLibraryRows([
      Array.from(COST_LIBRARY_HEADERS),
      ['E1', 'Revised outlet', 'Electrical', 'ea', 999, 999]
    ])
    expect(useProjectStore.getState().rates['Outlet|count'].material).toBe(100)
    useProjectStore.getState().reset()
    hydrateStores(snap)
    expect(useProjectStore.getState().rates['Outlet|count']).toEqual({
      material: 100,
      labor: 80,
      markup: 30,
      basis: 'ea', review: 'reviewed'
    })
    const m = useMarkupStore.getState()
    const boq = aggregateBoq({
      markups: m.pageMarkups,
      totalPages: 1,
      pageScales: {},
      globalUnit: 'm',
      categoriesById: m.categories,
      categoryOrder: m.categoryOrder,
      pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null,
      getColorForName: () => null
    })
    expect(boq.grandTotalCost).toBe(180)
    expect(boq.grandTotalPrice).toBe(234)
    expect(buildBoqCsv(boq)).toContain('100')
    useProjectStore.getState().setPrice('Outlet|count', { material: 123 })
    expect(useProjectStore.getState().rates['Outlet|count'].labor).toBe(80)
  })
})
