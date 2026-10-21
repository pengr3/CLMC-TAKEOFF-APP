/** @vitest-environment jsdom */
import { beforeEach, expect, it } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import ExcelJS from 'exceljs'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { EstimateRow } from '@renderer/components/EstimateRow'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { buildBoqCsv, buildBoqXlsx } from '../main/boq-writers'
import type { AggregateOptions } from '@renderer/lib/boq-types'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { useMarkupStore } from '@renderer/stores/markupStore'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export const measuredFixture: AggregateOptions = {
  markups: {
    1: [
      {
        id: 'line',
        type: 'linear',
        page: 1,
        name: 'Wire',
        categoryId: '',
        color: '#123456',
        createdAt: 1,
        points: [
          { x: 0, y: 0 },
          { x: 10000, y: 0 }
        ]
      }
    ]
  },
  pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } },
  totalPages: 1,
  categoriesById: {},
  categoryOrder: [],
  categoryItemOrder: {},
  getColorForName: () => null,
  rates: { 'Wire|linear': { material: 10, labor: 5, markup: 20, basis: 'm', review: 'reviewed' } }
}

beforeEach(() => {
  useProjectStore.getState().reset()
  useScaleStore.setState({ globalUnit: 'm' })
})

const oracleUnits = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 } as const
it.each(['count', 'linear', 'perimeter', 'area', 'wall'] as const)(
  'preserves %s money for every supported source/display unit, rate magnitude and reopen',
  async (type) => {
    const base = {
      id: type,
      name: 'Grid A|B',
      type,
      page: 1,
      categoryId: '',
      color: '#123456',
      createdAt: 1
    }
    const points =
      type === 'area' || type === 'perimeter'
        ? [
            { x: 0, y: 0 },
            { x: 10000, y: 0 },
            { x: 10000, y: 2000 },
            { x: 0, y: 2000 }
          ]
        : [
            { x: 0, y: 0 },
            { x: 10000, y: 0 }
          ]
    const markup =
      type === 'count'
        ? { ...base, point: { x: 0, y: 0 }, sequence: 1 }
        : { ...base, points, wallHeight: 2000 }
    const baseQty = type === 'count' ? 1 : type === 'linear' ? 10 : type === 'perimeter' ? 24 : 20
    const power = type === 'area' || type === 'wall' ? 2 : type === 'count' ? 0 : 1
    const near = (actual: number, expected: number): void =>
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
        Math.max(1e-9, Math.abs(expected) * 1e-12)
      )
    for (const sourceUnit of Object.keys(oracleUnits) as Array<keyof typeof oracleUnits>) {
      const sourceSize = type === 'wall' ? 1 : oracleUnits[sourceUnit] ** power
      const basis =
        type === 'count' ? 'ea' : type === 'wall' ? 'm²' : sourceUnit + (power === 2 ? '²' : '')
      for (const rate of [0, 0.000001, 100000000]) {
        for (const unit of Object.keys(oracleUnits) as Array<keyof typeof oracleUnits>) {
          useMarkupStore.getState().reset()
          useMarkupStore.setState({ pageMarkups: { 1: [markup] } })
          useScaleStore.setState({
            globalUnit: unit,
            pageScales: { 1: { pixelsPerMm: 1, displayUnit: unit } }
          })
          useProjectStore.setState({
            rates: {
              [`Grid A|B|${type}`]: {
                material: rate * sourceSize,
                labor: (rate * sourceSize) / 2,
                markup: rate === 0 ? 0 : 20,
                basis,
                review: 'reviewed'
              }
            }
          })
          const saved = JSON.parse(
            JSON.stringify(
              snapshotProject({
                pdfOriginalFilename: 'plan.pdf',
                pdfSha256: 'abc',
                pdfTotalPages: 1,
                perPageDimensions: {}
              })
            )
          )
          hydrateStores(saved)
          const boq = aggregateBoq({ totalPages: 1 })
          const row = boq.categories[0].items[0]
          near(row.cost, baseQty * rate * 1.5)
          near(row.price, row.cost * (rate === 0 ? 1 : 1.2))
          near(row.margin, row.cost * (rate === 0 ? 0 : 0.2))
          const targetSize = type === 'wall' ? 1 : oracleUnits[unit] ** power
          near(row.quantity, baseQty / targetSize)
          near(row.material, rate * targetSize)
          near(row.labor, (rate * targetSize) / 2)
          if (sourceUnit === 'm' && rate === 100000000) {
            const fields = buildBoqCsv(boq)
              .split('\r\n')
              .find((line) => line.startsWith('Grid A|B,'))!
              .split(',')
            expect(fields[2]).toBe(row.uom)
            near(Number(fields[5]), row.cost)
            near(Number(fields[8]), row.price)
            near(Number(fields[9]), row.margin)
            const wb = new ExcelJS.Workbook()
            await wb.xlsx.load(await buildBoqXlsx(boq))
            let checked = false
            wb.getWorksheet('BOQ')!.eachRow((r) => {
              if (r.getCell(1).value !== 'Grid A|B') return
              checked = true
              expect(r.getCell(3).value).toBe(row.uom)
              near(r.getCell(4).value as number, row.material)
              near(r.getCell(6).value as number, row.cost)
              near(r.getCell(9).value as number, row.price)
              near(r.getCell(10).value as number, row.margin)
            })
            expect(checked).toBe(true)
          }
        }
      }
    }
  }
)

it('retains zero quantity, zero rates, and explicit zero markup', () => {
  const input = {
    ...measuredFixture,
    markups: {
      1: [
        {
          ...measuredFixture.markups![1][0],
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 0 }
          ]
        }
      ]
    },
    rates: { ...measuredFixture.rates }
  }
  input.rates!['Wire|linear'] = { material: 0, labor: 0, markup: 0, basis: 'm', review: 'reviewed' }
  const row = aggregateBoq({ ...input, globalUnit: 'ft' }).categories[0].items[0]
  expect([
    row.quantity,
    row.material,
    row.labor,
    row.markup,
    row.cost,
    row.price,
    row.margin
  ]).toEqual([0, 0, 0, 0, 0, 0, 0])
})

it('keeps measured money and real XLSX/CSV rate units invariant through m-ft-m', async () => {
  for (const globalUnit of ['m', 'ft', 'm'] as const) {
    const boq = aggregateBoq({ ...measuredFixture, globalUnit })
    const row = boq.categories[0].items[0]
    const factor = globalUnit === 'ft' ? 0.3048 : 1
    expect(row.cost).toBeCloseTo(150, 10)
    expect(row.price).toBeCloseTo(180, 10)
    expect(row.margin).toBeCloseTo(30, 10)
    expect(row.material).toBeCloseTo(10 * factor, 10)
    expect(row.labor).toBeCloseTo(5 * factor, 10)
    expect(row.quantity).toBeCloseTo(10 / factor, 10)
    const csv = buildBoqCsv(boq)
      .split('\r\n')
      .find((line) => line.startsWith('Wire,'))!
      .split(',')
    expect(csv[2]).toBe(globalUnit)
    expect(Number(csv[3])).toBeCloseTo(row.material, 2)
    expect(Number(csv[5])).toBe(150)
    expect(Number(csv[8])).toBe(180)
    expect(Number(csv[9])).toBe(30)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await buildBoqXlsx(boq))
    let found = false
    wb.getWorksheet('BOQ')!.eachRow((r) => {
      if (r.getCell(1).value !== 'Wire') return
      found = true
      expect(r.getCell(3).value).toBe(globalUnit)
      expect(r.getCell(4).value).toBeCloseTo(row.material, 10)
      expect(r.getCell(5).value).toBeCloseTo(row.labor, 10)
      expect(r.getCell(6).value).toBeCloseTo(150, 10)
      expect(r.getCell(9).value).toBeCloseTo(180, 10)
    })
    expect(found).toBe(true)
  }
})

it('edits the visible ft rate and converts the untouched labor with it', () => {
  useProjectStore.setState({ rates: measuredFixture.rates! })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (unit: 'm' | 'ft'): void =>
    act(() => {
      const item = aggregateBoq({
        ...measuredFixture,
        rates: useProjectStore.getState().rates,
        globalUnit: unit
      }).categories[0].items[0]
      root.render(React.createElement(EstimateRow, { item }))
    })
  try {
    render('m')
    render('ft')
    const material = container.querySelector<HTMLInputElement>(
      '[data-testid="estimate-row-material-input"]'
    )!
    const labor = container.querySelector<HTMLInputElement>(
      '[data-testid="estimate-row-labor-input"]'
    )!
    expect(Number(material.value)).toBeCloseTo(3.048, 10)
    expect(Number(labor.value)).toBeCloseTo(1.524, 10)
    act(() => {
      material.value = '6.096'
      material.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const entry = useProjectStore.getState().rates['Wire|linear']
    expect(entry.basis).toBe('ft')
    expect(entry.material).toBe(6.096)
    expect(entry.labor).toBeCloseTo(1.524, 10)
    const result = aggregateBoq({
      ...measuredFixture,
      rates: useProjectStore.getState().rates,
      globalUnit: 'm'
    }).categories[0].items[0]
    expect(result.material).toBeCloseTo(20, 10)
    expect(result.labor).toBeCloseTo(5, 10)
    expect(result.cost).toBeCloseTo(250, 10)
  } finally {
    act(() => root.unmount())
    container.remove()
  }
})
