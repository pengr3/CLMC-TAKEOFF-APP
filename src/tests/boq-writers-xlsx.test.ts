import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildBoqXlsx } from '../main/boq-writers'
import type { BoqStructure } from '@renderer/lib/boq-types'

function fixtureStructure(): BoqStructure {
  return {
    metadata: {
      projectName: 'Test', planFilename: 'plan.pdf',
      exportedDate: '2026-05-02', totalPages: 1, totalMarkups: 2
    },
    categories: [{
      name: 'Electrical',
      items: [
        { label: 'Outlet', quantity: 5, uom: 'ea', color: '#0078d4', type: 'count' },
        { label: 'Wire', quantity: 12.345, uom: 'm', color: '#d13438', type: 'linear' }
      ],
      subtotals: [
        { uom: 'ea', total: 5 },
        { uom: 'm', total: 12.345 }
      ]
    }],
    grandTotals: [
      { uom: 'ea', total: 5 },
      { uom: 'm', total: 12.345 }
    ]
  }
}

describe('buildBoqXlsx — round-trip via ExcelJS load — EXPRT-01 native number', () => {
  it('produces a Buffer that loads back as a workbook with sheet "BOQ" — D-08', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    expect(Buffer.isBuffer(buf)).toBe(true)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    expect(wb.getWorksheet('BOQ')).toBeDefined()
  })

  it('column widths are 36 / 12 / 8 (Item / Quantity / UoM)', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    expect(ws.columns[0].width).toBe(36)
    expect(ws.columns[1].width).toBe(12)
    expect(ws.columns[2].width).toBe(8)
  })

  it('quantity cell on item row is a native number (typeof === number) — D-03 / SUM() works', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundLinearQty = false
    ws.eachRow((row) => {
      const itemCell = row.getCell(1)
      const qtyCell = row.getCell(2)
      if (itemCell.value === 'Wire') {
        expect(typeof qtyCell.value).toBe('number')
        expect(qtyCell.value).toBe(12.345)
        foundLinearQty = true
      }
    })
    expect(foundLinearQty).toBe(true)
  })

  it('count cell numFmt is "0", length cell numFmt is "0.00" — D-03', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    ws.eachRow((row) => {
      const itemCell = row.getCell(1)
      const qtyCell = row.getCell(2)
      if (itemCell.value === 'Outlet') expect(qtyCell.numFmt).toBe('0')
      if (itemCell.value === 'Wire') expect(qtyCell.numFmt).toBe('0.00')
    })
  })

  it('Item-cell ARGB fill matches input color — D-13', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    ws.eachRow((row) => {
      const itemCell = row.getCell(1)
      if (itemCell.value === 'Outlet') {
        const fill = itemCell.fill as ExcelJS.FillPattern
        expect(fill.fgColor?.argb).toBe('FF0078D4')
      }
      if (itemCell.value === 'Wire') {
        const fill = itemCell.fill as ExcelJS.FillPattern
        expect(fill.fgColor?.argb).toBe('FFD13438')
      }
    })
  })

  it('title row "Item / Quantity / UoM" is bold and worksheet has frozen view — D-10', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let titleRowNum = 0
    ws.eachRow((row, rowNum) => {
      if (row.getCell(1).value === 'Item' && row.getCell(2).value === 'Quantity') titleRowNum = rowNum
    })
    expect(titleRowNum).toBeGreaterThan(0)
    expect(ws.getRow(titleRowNum).font?.bold).toBe(true)
    expect(ws.views[0].state).toBe('frozen')
    expect(ws.views[0].ySplit).toBe(titleRowNum)
  })

  it('subtotal/grand-total rows have light-gray fill FFEFEFEF — Q1', async () => {
    const buf = await buildBoqXlsx(fixtureStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundSubtotal = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Subtotal') {
        foundSubtotal = true
        const fill = row.getCell(1).fill as ExcelJS.FillPattern
        expect(fill.fgColor?.argb).toBe('FFEFEFEF')
        expect(row.font?.bold).toBe(true)
      }
    })
    expect(foundSubtotal).toBe(true)
  })
})

// =============================================================================
// Phase 15 — Rate/Cost columns (proof a, writer side). RED until Plan 15-05
// adds the Rate/Cost columns + ₱ numFmt + cost subtotal/grand-total rows + the
// A:E heading merge to buildBoqXlsx. The fixture carries rate/cost/costSubtotal/
// grandTotalCost (cast through `unknown` because BoqStructure does not yet
// declare them). Do NOT "fix" the source to make these green — Wave 1-3 does.
// =============================================================================

// The Philippine Peso glyph (U+20B1). The xlsx Rate/Cost numFmt must contain it.
const PESO = '₱'

function pricedStructure(): BoqStructure {
  return {
    metadata: {
      projectName: 'Test', planFilename: 'plan.pdf',
      exportedDate: '2026-05-02', totalPages: 1, totalMarkups: 2
    },
    categories: [{
      name: 'Electrical',
      items: [
        { label: 'Outlet', quantity: 5, uom: 'ea', color: '#0078d4', type: 'count', rate: 3, cost: 15 },
        { label: 'Wire', quantity: 12.345, uom: 'm', color: '#d13438', type: 'linear', rate: 2, cost: 24.69 }
      ],
      subtotals: [
        { uom: 'ea', total: 5 },
        { uom: 'm', total: 12.345 }
      ],
      costSubtotal: 39.69
    }],
    grandTotals: [
      { uom: 'ea', total: 5 },
      { uom: 'm', total: 12.345 }
    ],
    grandTotalCost: 39.69
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as BoqStructure
}

describe('buildBoqXlsx — Phase 15 Rate/Cost columns (proof a)', () => {
  it('title row is Item / Quantity / UoM / Rate / Cost (5 columns)', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let titleRowNum = 0
    ws.eachRow((row, rowNum) => {
      if (row.getCell(1).value === 'Item' && row.getCell(2).value === 'Quantity') titleRowNum = rowNum
    })
    expect(titleRowNum).toBeGreaterThan(0)
    const title = ws.getRow(titleRowNum)
    expect(title.getCell(1).value).toBe('Item')
    expect(title.getCell(2).value).toBe('Quantity')
    expect(title.getCell(3).value).toBe('UoM')
    expect(title.getCell(4).value).toBe('Rate')
    expect(title.getCell(5).value).toBe('Cost')
  })

  it('item-row Cost cell (getCell(5)) is a native number with a ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundWireCost = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Wire') {
        const costCell = row.getCell(5)
        // Native number (NOT a "₱…"-prefixed string) so SUM() works.
        expect(typeof costCell.value).toBe('number')
        expect(costCell.value).toBe(24.69)
        // ₱ lives in the numFmt, not the value.
        expect(typeof costCell.numFmt).toBe('string')
        expect(costCell.numFmt).toContain(PESO)
        foundWireCost = true
      }
    })
    expect(foundWireCost).toBe(true)
  })

  it('item-row Rate cell (getCell(4)) is a native number with a ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundOutletRate = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Outlet') {
        const rateCell = row.getCell(4)
        expect(typeof rateCell.value).toBe('number')
        expect(rateCell.value).toBe(3)
        expect(rateCell.numFmt).toContain(PESO)
        foundOutletRate = true
      }
    })
    expect(foundOutletRate).toBe(true)
  })

  it('a category cost-subtotal row and a grand-total-cost row exist with ₱ amounts', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let costSubtotal: ExcelJS.Cell | null = null
    let grandTotalCost: ExcelJS.Cell | null = null
    ws.eachRow((row) => {
      const label = String(row.getCell(1).value ?? '')
      // Cost subtotal carries 39.69 in the Cost column (cell 5).
      if (label.includes('Subtotal') && row.getCell(5).value === 39.69) costSubtotal = row.getCell(5)
      if (label.includes('Grand Total') && row.getCell(5).value === 39.69) grandTotalCost = row.getCell(5)
    })
    expect(costSubtotal).not.toBeNull()
    expect(grandTotalCost).not.toBeNull()
    expect(typeof costSubtotal!.value).toBe('number')
    expect(costSubtotal!.numFmt).toContain(PESO)
    expect(typeof grandTotalCost!.value).toBe('number')
    expect(grandTotalCost!.numFmt).toContain(PESO)
  })

  it('category heading merge spans A:E (not A:C) to cover the Rate/Cost columns', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    // Find the 'Electrical' heading row.
    let headingRowNum = 0
    ws.eachRow((row, rowNum) => {
      if (row.getCell(1).value === 'Electrical') headingRowNum = rowNum
    })
    expect(headingRowNum).toBeGreaterThan(0)
    // ExcelJS exposes merged ranges via the worksheet model. The heading must
    // merge A:E across the 5-column layout, not the old A:C.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws as any).model?.merges ?? []
    expect(merges).toContain(`A${headingRowNum}:E${headingRowNum}`)
    expect(merges).not.toContain(`A${headingRowNum}:C${headingRowNum}`)
  })
})
