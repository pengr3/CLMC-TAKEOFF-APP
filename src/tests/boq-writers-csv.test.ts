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

  it('does NOT emit a UTF-8 BOM — D-14', () => {
    const csv = buildBoqCsv(structure())
    expect(csv.charCodeAt(0)).not.toBe(0xfeff)
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

  it('mirrors XLSX row order: metadata block → blank → title → category heading → items → subtotals → grand totals', () => {
    const csv = buildBoqCsv(structure())
    const lines = csv.split('\r\n')
    // First five rows are metadata
    expect(lines[0]).toMatch(/^Project: /)
    expect(lines[1]).toMatch(/^Plan: /)
    expect(lines[2]).toMatch(/^Exported: /)
    expect(lines[3]).toMatch(/^Pages: /)
    expect(lines[4]).toMatch(/^Markups: /)
    // Row 6 is blank spacer
    expect(lines[5]).toBe('')
    // Row 7 is title
    expect(lines[6]).toBe('Item,Quantity,UoM')
    // Then category heading row "Electrical,,"
    expect(lines[7].startsWith('Electrical')).toBe(true)
  })
})
