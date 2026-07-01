import { describe, it, expect } from 'vitest'
import { buildBoqCsv } from '../main/boq-writers'
import type { BoqStructure } from '@renderer/lib/boq-types'

function structure(): BoqStructure {
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
      subtotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }]
    }],
    grandTotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }]
  }
}

describe('buildBoqCsv — D-14 / EXPRT-02', () => {
  it('uses CRLF (\\r\\n) line endings — D-14, RESEARCH §Pitfall 4', () => {
    const csv = buildBoqCsv(structure())
    // First line ending must be CRLF
    const firstNewline = csv.indexOf('\n')
    expect(firstNewline).toBeGreaterThan(0)
    expect(csv.charCodeAt(firstNewline - 1)).toBe(0x0d) // CR
    expect(csv.charCodeAt(firstNewline)).toBe(0x0a) // LF
  })

  it('emits a UTF-8 BOM at byte 0 so Excel renders m² correctly (reverses D-14 after UAT GAP)', () => {
    const csv = buildBoqCsv(structure())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('counts written as integers (no decimal); length/area at 2dp', () => {
    const csv = buildBoqCsv(structure())
    // Outlet row: count → integer "5"
    expect(csv).toMatch(/Outlet,5,ea/)
    // Wire row: 12.345 → 12.35 (or 12.34 depending on rounding mode; toFixed gives 12.35)
    expect(csv).toMatch(/Wire,12\.\d{2},m/)
  })

  it('RFC 4180 quoting for commas inside fields', () => {
    const s = structure()
    s.categories[0].items[0].label = 'Outlet, AC'
    const csv = buildBoqCsv(s)
    expect(csv).toContain('"Outlet, AC"')
  })

  it('RFC 4180 quoting for double-quotes inside fields (doubled)', () => {
    const s = structure()
    s.categories[0].items[0].label = 'Wire "red"'
    const csv = buildBoqCsv(s)
    expect(csv).toContain('"Wire ""red"""')
  })

  it('safeText neutralises leading-whitespace formula-injection bypass (BL-01)', () => {
    // Excel/Sheets ignore leading spaces and tabs before formula triggers.
    // safeText must catch '\t=cmd|/c calc' and ' =SUM()' even though s[0] !== '='.
    const cases = [
      { label: ' =cmd|/c calc!A1', expectedPrefix: "' =cmd" },
      { label: '\t=SUM(A:A)', expectedPrefix: "'\t=SUM" },
      { label: '  +1+2', expectedPrefix: "'  +1+2" },
      { label: '   @cell', expectedPrefix: "'   @cell" }
    ]
    for (const c of cases) {
      const s = structure()
      s.categories[0].items[0].label = c.label
      const csv = buildBoqCsv(s)
      // The injected label must appear with a leading apostrophe in the CSV.
      // csv-stringify quotes fields containing whitespace or commas, so we
      // search for the apostrophe-prefixed form anywhere in the output.
      expect(csv).toContain(`'${c.label}`)
    }
  })

  it('mirrors XLSX row order: metadata block → blank → title → category heading → items → subtotals → grand totals', () => {
    const csv = buildBoqCsv(structure())
    // Strip the UTF-8 BOM before line-splitting so row-zero assertions stay clean.
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    // First five rows are metadata
    expect(lines[0]).toMatch(/^Project: /)
    expect(lines[1]).toMatch(/^Plan: /)
    expect(lines[2]).toMatch(/^Exported: /)
    expect(lines[3]).toMatch(/^Pages: /)
    expect(lines[4]).toMatch(/^Markups: /)
    // Row 6 is blank spacer
    expect(lines[5]).toBe('')
    // Row 7 is title — Phase 16 nine-column layout
    // (Item · Quantity · UoM · Material · Labor · Cost · Markup · Price · Margin).
    // Widened from the Phase-15 5-column 'Item,Quantity,UoM,Rate,Cost' header per
    // D-08; the priced 9-column assertion below (see ~line 133) matches. RED until
    // Wave 3 (16-05) widens buildBoqCsv.
    expect(lines[6]).toBe('Item,Quantity,UoM,Material,Labor,Cost,Markup,Price,Margin')
    // Then category heading row "Electrical,,,,,,,,"
    expect(lines[7].startsWith('Electrical')).toBe(true)
  })
})

// =============================================================================
// Phase 16 — nine-column export (proof f, csv side). The Phase-15 5-column
// priced layout WIDENS to Item·Quantity·UoM·Material·Labor·Cost·Markup·Price·
// Margin (D-08). Money + markup cells are emitted as plain numerics (no ₱
// glyph); the UTF-8 BOM on line 1 is preserved. RED until Wave 3 (16-05) widens
// buildBoqCsv. The fixture carries the widened money fields (cast through
// `unknown`). Do NOT "fix" the source to make these green — Wave 1-3 does.
// =============================================================================

function pricedStructure(): BoqStructure {
  // Outlet: material 3, labor 1, qty 5 → cost 20, markup 30, price 26, margin 6.
  // Wire: material 2, labor 0, qty 12.345 → cost 24.69, markup 30, price 32.097,
  //   margin 7.407 (csv writes money at 2dp).
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
      subtotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }],
      costSubtotal: 44.69,
      priceSubtotal: 58.097,
      marginSubtotal: 13.407
    }],
    grandTotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }],
    grandTotalCost: 44.69,
    grandTotalPrice: 58.097,
    grandTotalMargin: 13.407
  } as unknown as BoqStructure
}

describe('buildBoqCsv — Phase 16 nine-column export (proof f)', () => {
  it('title row is the 9-column set (Item,Quantity,UoM,Material,Labor,Cost,Markup,Price,Margin)', () => {
    const csv = buildBoqCsv(pricedStructure())
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    // Title is the first row after the 5 metadata rows + blank spacer.
    expect(lines[6]).toBe('Item,Quantity,UoM,Material,Labor,Cost,Markup,Price,Margin')
    expect(lines[6]).toContain('Material')
    expect(lines[6]).toContain('Labor')
    expect(lines[6]).toContain('Markup')
    expect(lines[6]).toContain('Price')
    expect(lines[6]).toContain('Margin')
  })

  it('Material/Labor/Cost/Markup/Price/Margin are emitted as numeric values (not a "₱…"-prefixed string)', () => {
    const csv = buildBoqCsv(pricedStructure())
    // Outlet: count qty 5 (int), material 3, labor 1, cost 20, markup 30,
    //   price 26, margin 6 → "Outlet,5,ea,3,1,20,30,26,6".
    expect(csv).toMatch(/Outlet,5,ea,3,1,20,30,26,6/)
    // Wire: 12.345 at 2dp, material 2, labor 0, cost 24.69, markup 30, price
    //   32.10 (2dp), margin 7.41 (2dp) → "Wire,12.35,m,2,0,24.69,30,32.10,7.41".
    expect(csv).toMatch(/Wire,12\.35,m,2,0,24\.69,30,32\.10,7\.41/)
    // No ₱ glyph leaks into the data cells — currency lives in display, not CSV.
    expect(csv).not.toContain('₱')
  })

  it('UTF-8 BOM still leads byte 0 with the wider 9-column layout', () => {
    const csv = buildBoqCsv(pricedStructure())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
