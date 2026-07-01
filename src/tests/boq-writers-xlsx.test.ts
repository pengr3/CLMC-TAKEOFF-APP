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
// Phase 16 — 9-column export (proof f, writer side). The Phase-15 5-column
// priced layout (Item·Quantity·UoM·Rate·Cost) WIDENS to the locked 9-column set
// Item·Quantity·UoM·Material·Labor·Cost·Markup·Price·Margin (D-07/D-08). Money
// cells (Material/Labor/Cost/Price/Margin) stay native numbers with the ₱
// NUMFMT_PESO; the Markup cell is a native number with a PERCENT numFmt (NOT ₱).
// Per-category Cost/Price/Margin subtotal rows + grand Cost/Price/Margin rows;
// the category heading merge widens A:E → A:I. RED until Wave 3 (16-05) widens
// buildBoqXlsx. The fixture carries the widened per-row/category/structure money
// fields (cast through `unknown` because BoqStructure does not yet declare
// them). Do NOT "fix" the source to make these green — Wave 1-3 does.
// =============================================================================

// The Philippine Peso glyph (U+20B1). The xlsx money numFmts must contain it.
const PESO = '₱'

function pricedStructure(): BoqStructure {
  // Outlet: material 3, labor 1, qty 5 → materialCost 15, laborCost 5, cost 20,
  //   markup 30 → price 26, margin 6.
  // Wire: material 2, labor 0, qty 12.345 → materialCost 24.69, laborCost 0,
  //   cost 24.69, markup 30 → price 32.097, margin 7.407.
  // Category subtotals: cost 44.69, price 58.097, margin 13.407.
  // Grand totals mirror the single category.
  return {
    metadata: {
      projectName: 'Test', planFilename: 'plan.pdf',
      exportedDate: '2026-05-02', totalPages: 1, totalMarkups: 2
    },
    categories: [{
      name: 'Electrical',
      items: [
        {
          label: 'Outlet', quantity: 5, uom: 'ea', color: '#0078d4', type: 'count',
          material: 3, labor: 1, markup: 30,
          materialCost: 15, laborCost: 5, cost: 20, price: 26, margin: 6
        },
        {
          label: 'Wire', quantity: 12.345, uom: 'm', color: '#d13438', type: 'linear',
          material: 2, labor: 0, markup: 30,
          materialCost: 24.69, laborCost: 0, cost: 24.69, price: 32.097, margin: 7.407
        }
      ],
      subtotals: [
        { uom: 'ea', total: 5 },
        { uom: 'm', total: 12.345 }
      ],
      costSubtotal: 44.69,
      priceSubtotal: 58.097,
      marginSubtotal: 13.407
    }],
    grandTotals: [
      { uom: 'ea', total: 5 },
      { uom: 'm', total: 12.345 }
    ],
    grandTotalCost: 44.69,
    grandTotalPrice: 58.097,
    grandTotalMargin: 13.407
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as BoqStructure
}

describe('buildBoqXlsx — Phase 16 nine-column export (proof f)', () => {
  it('title row is Item / Quantity / UoM / Material / Labor / Cost / Markup / Price / Margin (9 columns)', async () => {
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
    expect(title.getCell(4).value).toBe('Material')
    expect(title.getCell(5).value).toBe('Labor')
    expect(title.getCell(6).value).toBe('Cost')
    expect(title.getCell(7).value).toBe('Markup')
    expect(title.getCell(8).value).toBe('Price')
    expect(title.getCell(9).value).toBe('Margin')
  })

  it('item-row Material/Labor/Cost/Price/Margin cells are native numbers with a ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundOutlet = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Outlet') {
        // Material col 4, Labor col 5, Cost col 6, Price col 8, Margin col 9.
        const money: Array<[number, number]> = [
          [4, 3], [5, 1], [6, 20], [8, 26], [9, 6]
        ]
        for (const [col, expected] of money) {
          const cell = row.getCell(col)
          // Native number (NOT a "₱…"-prefixed string) so SUM() works.
          expect(typeof cell.value).toBe('number')
          expect(cell.value).toBe(expected)
          // ₱ lives in the numFmt, not the value.
          expect(typeof cell.numFmt).toBe('string')
          expect(cell.numFmt).toContain(PESO)
        }
        foundOutlet = true
      }
    })
    expect(foundOutlet).toBe(true)
  })

  it('item-row Markup cell (getCell(7)) is a native number with a PERCENT numFmt (NOT ₱)', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundMarkup = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Outlet') {
        const markupCell = row.getCell(7)
        expect(typeof markupCell.value).toBe('number')
        expect(markupCell.value).toBe(30)
        // Percent-style numFmt — must NOT carry the ₱ glyph.
        expect(typeof markupCell.numFmt).toBe('string')
        expect(markupCell.numFmt).not.toContain(PESO)
        expect(markupCell.numFmt).toContain('%')
        foundMarkup = true
      }
    })
    expect(foundMarkup).toBe(true)
  })

  it('per-category Cost/Price/Margin subtotal rows exist as native numbers with ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let sub: ExcelJS.Row | null = null
    ws.eachRow((row) => {
      // Subtotal row carries costSubtotal 44.69 in the Cost column (cell 6).
      if (String(row.getCell(1).value ?? '').includes('Subtotal') && row.getCell(6).value === 44.69) sub = row
    })
    expect(sub).not.toBeNull()
    const costCell = sub!.getCell(6)
    const priceCell = sub!.getCell(8)
    const marginCell = sub!.getCell(9)
    expect(typeof costCell.value).toBe('number')
    expect(costCell.value).toBe(44.69)
    expect(costCell.numFmt).toContain(PESO)
    expect(priceCell.value).toBeCloseTo(58.097, 6)
    expect(priceCell.numFmt).toContain(PESO)
    expect(marginCell.value).toBeCloseTo(13.407, 6)
    expect(marginCell.numFmt).toContain(PESO)
  })

  it('grand-total Cost/Price/Margin rows exist as native numbers with ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let grand: ExcelJS.Row | null = null
    ws.eachRow((row) => {
      if (String(row.getCell(1).value ?? '').includes('Grand Total') && row.getCell(6).value === 44.69) grand = row
    })
    expect(grand).not.toBeNull()
    expect(typeof grand!.getCell(6).value).toBe('number')
    expect(grand!.getCell(6).numFmt).toContain(PESO)
    expect(grand!.getCell(8).value).toBeCloseTo(58.097, 6)
    expect(grand!.getCell(8).numFmt).toContain(PESO)
    expect(grand!.getCell(9).value).toBeCloseTo(13.407, 6)
    expect(grand!.getCell(9).numFmt).toContain(PESO)
  })

  it('category heading merge spans A:I (not A:E) to cover the 9-column layout', async () => {
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
    // merge A:I across the 9-column layout, not the old A:E.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws as any).model?.merges ?? []
    expect(merges).toContain(`A${headingRowNum}:I${headingRowNum}`)
    expect(merges).not.toContain(`A${headingRowNum}:E${headingRowNum}`)
  })
})
