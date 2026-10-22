import { expect, it } from 'vitest'
import { snapshotProject } from '@renderer/lib/project-serialize'
import { validateProjectData } from '../shared/project-validation'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { CountMarkup } from '@renderer/types/markup'

const category = { id: 'c', name: 'Electrical', color: '#abc', paletteIndex: 0 }
const pin: CountMarkup = { id: 'one', name: 'Switch', type: 'count', page: 1, point: { x: 100, y: 100 }, categoryId: 'c', color: '#abc', sequence: 1, createdAt: 1 }
it.each([[['c', 'c']], [[]], [['missing']]])('rejects malformed category order %j at admission', order => {
  const d = snapshotProject({ pdfOriginalFilename: 'plan.pdf', pdfSha256: 'a'.repeat(64), pdfTotalPages: 1, perPageDimensions: { 1: { width: 595, height: 842 } } })
  d.categories = { c: category }; d.categoryOrder = order; d.pages[0].markups = [pin]
  expect(() => validateProjectData(d)).toThrow(/category/)
})
it('rejects a dangling markup category', () => {
  const d = snapshotProject({ pdfOriginalFilename: 'plan.pdf', pdfSha256: 'a'.repeat(64), pdfTotalPages: 1, perPageDimensions: { 1: { width: 595, height: 842 } } })
  d.categories = {}; d.categoryOrder = []; d.pages[0].markups = [pin]
  expect(() => validateProjectData(d)).toThrow(/category/)
})
it.each([[['c', 'c']], [[]], [['missing']]])('defensively counts each actual bucket once with malformed order %j', order => {
  const boq = aggregateBoq({ markups: { 1: [pin] }, totalPages: 1, categoriesById: { c: category }, categoryOrder: order,
    rates: { 'Switch|count': { material: 100, labor: 0, markup: 30, basis: 'ea', review: 'reviewed' } }, pageScales: {} })
  expect(boq.grandTotalPrice).toBe(130)
  expect(boq.categories).toHaveLength(1)
})
