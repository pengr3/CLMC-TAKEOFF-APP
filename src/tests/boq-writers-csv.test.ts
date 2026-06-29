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
    // Row 7 is title — Phase 15 priced layout (Item · Quantity · UoM · Rate · Cost).
    // (Migrated from the legacy 3-column 'Item,Quantity,UoM' header that Wave 0
    // [15-01] left un-updated when it added the 5-column priced assertion below;
    // both are in this file and were mutually exclusive — see line ~131.)
    expect(lines[6]).toBe('Item,Quantity,UoM,Rate,Cost')
    // Then category heading row "Electrical,,,,"
    expect(lines[7].startsWith('Electrical')).toBe(true)
  })
})

// =============================================================================
// Phase 15 — Rate/Cost columns (proof a, csv side). RED until Plan 15-05 adds
// the Rate and Cost columns to buildBoqCsv. The fixture carries rate/cost/
// costSubtotal/grandTotalCost (cast through `unknown`). Do NOT "fix" the source
// to make these green — Wave 1-3 does.
// =============================================================================

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
      subtotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }],
      costSubtotal: 39.69
    }],
    grandTotals: [{ uom: 'ea', total: 5 }, { uom: 'm', total: 12.345 }],
    grandTotalCost: 39.69
  } as unknown as BoqStructure
}

describe('buildBoqCsv — Phase 15 Rate/Cost columns (proof a)', () => {
  it('title row contains Rate and Cost (Item,Quantity,UoM,Rate,Cost)', () => {
    const csv = buildBoqCsv(pricedStructure())
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    // Title is the first row after the 5 metadata rows + blank spacer.
    expect(lines[6]).toBe('Item,Quantity,UoM,Rate,Cost')
    expect(lines[6]).toContain('Rate')
    expect(lines[6]).toContain('Cost')
  })

  it('rate/cost are emitted as numeric values (not a "₱…"-prefixed string)', () => {
    const csv = buildBoqCsv(pricedStructure())
    // Outlet: count qty 5 (int), rate 3, cost 15 → "Outlet,5,ea,3,15"
    expect(csv).toMatch(/Outlet,5,ea,3,15/)
    // Wire: 12.345 at 2dp, rate 2, cost 24.69 → "Wire,12.35,m,2,24.69" (cost 2dp)
    expect(csv).toMatch(/Wire,12\.35,m,2,24\.69/)
    // No ₱ glyph leaks into the data cells — currency lives in display, not CSV.
    expect(csv).not.toContain('₱')
  })

  it('UTF-8 BOM still leads byte 0 with the wider 5-column layout', () => {
    const csv = buildBoqCsv(pricedStructure())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
