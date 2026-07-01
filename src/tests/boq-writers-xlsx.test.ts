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
// Phase 16 — 10-column export (proof f, writer side). The Phase-15 5-column
// priced layout (Item·Quantity·UoM·Rate·Cost) WIDENED to a 9-column set, then to
// the locked 10-column set at UAT 2026-07-01 by inserting UNIT PRICE (col 8) and
// renaming "Price" → "TOTAL" (col 9):
//   Item·Quantity·UoM·Material·Labor·Cost·Markup·UNIT PRICE·TOTAL·Margin.
// Money cells (Material/Labor/Cost/UNIT PRICE/TOTAL/Margin) stay native numbers
// with the ₱ NUMFMT_PESO; the Markup cell is a native number with a PERCENT numFmt
// (NOT ₱). UNIT PRICE = (material+labor)×(1+markup/100) == price/qty. Per-category
// Cost/TOTAL/Margin subtotal rows + grand Cost/TOTAL/Margin rows (cols 7 Markup +
// 8 UNIT PRICE blank there); the category heading merge is A:J. The fixture carries
// the widened per-row/category/structure money fields (cast through `unknown`
// because BoqStructure does not declare all of them).
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

describe('buildBoqXlsx — Phase 16 ten-column export (proof f)', () => {
  it('title row is Item / Quantity / UoM / Material / Labor / Cost / Markup / UNIT PRICE / TOTAL / Margin (10 columns)', async () => {
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
    // Locked 10-column header. UNIT PRICE at index 7 (col 8), TOTAL at index 8
    // (col 9), Margin at index 9 (col 10).
    const header = [
      'Item', 'Quantity', 'UoM', 'Material', 'Labor', 'Cost', 'Markup', 'UNIT PRICE', 'TOTAL', 'Margin'
    ]
    header.forEach((label, i) => {
      expect(title.getCell(i + 1).value).toBe(label)
    })
    // Explicit spot-checks on the two changed positions.
    expect(title.getCell(8).value).toBe('UNIT PRICE')
    expect(title.getCell(9).value).toBe('TOTAL')
    expect(title.getCell(10).value).toBe('Margin')
  })

  it('item-row Material/Labor/Cost/UNIT PRICE/TOTAL/Margin cells are native numbers with a ₱ numFmt', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    let foundOutlet = false
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Outlet') {
        // Outlet: material 3, labor 1, cost 20, markup 30, qty 5.
        // UNIT PRICE = (3+1)×(1+30/100) = 4×1.3 = 5.2. TOTAL (price) = 26. Margin 6.
        // Material col 4, Labor col 5, Cost col 6, UNIT PRICE col 8, TOTAL col 9,
        // Margin col 10.
        const money: Array<[number, number]> = [
          [4, 3], [5, 1], [6, 20], [8, 5.2], [9, 26], [10, 6]
        ]
        for (const [col, expected] of money) {
          const cell = row.getCell(col)
          // Native number (NOT a "₱…"-prefixed string) so SUM() works.
          expect(typeof cell.value).toBe('number')
          expect(cell.value).toBeCloseTo(expected, 10)
          // ₱ lives in the numFmt, not the value.
          expect(typeof cell.numFmt).toBe('string')
          expect(cell.numFmt).toContain(PESO)
        }
        foundOutlet = true
      }
    })
    expect(foundOutlet).toBe(true)
  })

  it('UNIT PRICE (col 8) equals (material+labor)×(1+markup/100) and equals price/quantity', async () => {
    const buf = await buildBoqXlsx(pricedStructure())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('BOQ')!
    // Outlet fixture: material 5-equivalent proof uses (material+labor)=4, markup 30.
    // material 3, labor 1 → base 4; ×1.3 = 5.2; and price/qty = 26/5 = 5.2.
    let checked = 0
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Outlet') {
        const unit = row.getCell(8).value as number
        expect(unit).toBeCloseTo((3 + 1) * (1 + 30 / 100), 10) // 5.2
        expect(unit).toBeCloseTo(26 / 5, 10)                   // price/qty
        checked++
      }
      if (row.getCell(1).value === 'Wire') {
        // Wire: material 2, labor 0, markup 30, qty 12.345, price 32.097.
        const unit = row.getCell(8).value as number
        expect(unit).toBeCloseTo((2 + 0) * (1 + 30 / 100), 10) // 2.6
        expect(unit).toBeCloseTo(32.097 / 12.345, 10)          // price/qty
        checked++
      }
    })
    expect(checked).toBe(2)
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

  it('per-category Cost/TOTAL/Margin subtotal rows exist as native numbers with ₱ numFmt; cols 7+8 blank', async () => {
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
    const priceCell = sub!.getCell(9)  // TOTAL now at col 9
    const marginCell = sub!.getCell(10) // Margin now at col 10
    expect(typeof costCell.value).toBe('number')
    expect(costCell.value).toBe(44.69)
    expect(costCell.numFmt).toContain(PESO)
    expect(priceCell.value).toBeCloseTo(58.097, 6)
    expect(priceCell.numFmt).toContain(PESO)
    expect(marginCell.value).toBeCloseTo(13.407, 6)
    expect(marginCell.numFmt).toContain(PESO)
    // Markup (7) AND UNIT PRICE (8) are blank on a subtotal row.
    expect(sub!.getCell(7).value == null || sub!.getCell(7).value === '').toBe(true)
    expect(sub!.getCell(8).value == null || sub!.getCell(8).value === '').toBe(true)
  })

  it('grand-total Cost/TOTAL/Margin rows exist as native numbers with ₱ numFmt; cols 7+8 blank', async () => {
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
    expect(grand!.getCell(9).value).toBeCloseTo(58.097, 6)  // TOTAL at col 9
    expect(grand!.getCell(9).numFmt).toContain(PESO)
    expect(grand!.getCell(10).value).toBeCloseTo(13.407, 6) // Margin at col 10
    expect(grand!.getCell(10).numFmt).toContain(PESO)
    // Markup (7) AND UNIT PRICE (8) are blank on a grand-total row.
    expect(grand!.getCell(7).value == null || grand!.getCell(7).value === '').toBe(true)
    expect(grand!.getCell(8).value == null || grand!.getCell(8).value === '').toBe(true)
  })

  it('category heading merge spans A:J (not A:I/A:E) to cover the 10-column layout', async () => {
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
    // merge A:J across the 10-column layout, not the prior A:I or old A:E.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws as any).model?.merges ?? []
    expect(merges).toContain(`A${headingRowNum}:J${headingRowNum}`)
    expect(merges).not.toContain(`A${headingRowNum}:I${headingRowNum}`)
    expect(merges).not.toContain(`A${headingRowNum}:E${headingRowNum}`)
  })
})
