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
