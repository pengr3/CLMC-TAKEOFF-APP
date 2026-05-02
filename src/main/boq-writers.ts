import ExcelJS from 'exceljs'
import { stringify } from 'csv-stringify/sync'

// =============================================================================
// BoqStructure types — inline-duplicated from renderer/src/lib/boq-types.ts.
// Per Q4 (RESEARCH Open Question 4): no shared types directory; main duplicates
// inline. Cross-process structural lock is enforced by Wave 0 tests which
// import from both sides — TS will surface drift at test compile time.
// NEVER let these definitions diverge from boq-types.ts without updating BOTH.
// =============================================================================
export interface BoqMetadata {
  projectName: string
  planFilename: string
  exportedDate: string
  totalPages: number
  totalMarkups: number
}
export type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter-length' | 'perimeter-area'
export interface BoqItemRow {
  label: string
  quantity: number
  uom: string
  color: string | null
  type: BoqRowType
}
export interface BoqSubtotal { uom: string; total: number }
export interface BoqCategoryGroup {
  name: string
  items: BoqItemRow[]
  subtotals: BoqSubtotal[]
}
export interface BoqStructure {
  metadata: BoqMetadata
  categories: BoqCategoryGroup[]
  grandTotals: BoqSubtotal[]
}

// =============================================================================
// Cell-format constants
// =============================================================================
const NUMFMT_INTEGER = '0'
const NUMFMT_DECIMAL = '0.00'
const COL_WIDTH_ITEM = 36
const COL_WIDTH_QTY = 12
const COL_WIDTH_UOM = 8
const SUBTOTAL_FILL_ARGB = 'FFEFEFEF'   // Q1: light gray, distinct from canvas dark theme
const GRAND_TOTAL_FILL_ARGB = 'FFCCCCCC' // slightly darker than subtotal for visual stratification
const SHEET_NAME = 'BOQ'                 // D-08

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a hex color '#RRGGBB' or 'RRGGBB' (or already-prefixed 'AARRGGBB')
 * to ExcelJS's 8-char ARGB form. Throws on malformed input — fail-fast is
 * correct for a pure builder; the renderer already validates Markup.color
 * via the per-name-group palette (Phase 03.1 D-23).
 */
function hexToArgb(hex: string): string {
  const stripped = hex.replace(/^#/, '').toUpperCase()
  if (stripped.length === 6) return `FF${stripped}`
  if (stripped.length === 8) return stripped
  throw new Error(`Invalid hex color: ${hex}`)
}

/**
 * T-05-02-01 / T-05-02-02 mitigation: prefix an apostrophe to any label string
 * that begins with '=', '+', '-', '@' so Excel/Sheets/Numbers treat the cell
 * as text instead of a formula. Apply ONLY to label strings — never to numeric
 * quantities (apostrophe-prefix on numbers breaks SUM and corrupts CSV display).
 *
 * Excel renders a leading apostrophe as nothing in the cell view; the literal
 * character is preserved in the underlying data, which is acceptable for a
 * BOQ deliverable (and far better than letting `=cmd|/c calc!A1` execute).
 */
function safeText(s: string): string {
  if (s.length === 0) return s
  const first = s[0]
  if (first === '=' || first === '+' || first === '-' || first === '@') return `'${s}`
  return s
}

/** numFmt selector for a quantity cell based on its UoM. */
function numFmtForUom(uom: string): string {
  return uom === 'ea' ? NUMFMT_INTEGER : NUMFMT_DECIMAL
}

// =============================================================================
// XLSX builder — D-08, D-09, D-10, D-11, D-12, D-13, EXPRT-01
// =============================================================================

/**
 * Build the BOQ workbook from a BoqStructure. Returns a Node Buffer ready for
 * fs.writeFile. NEVER call this from the renderer — main process only.
 *
 * Verified against exceljs@4.4.0 in this repo on 2026-05-02 (RESEARCH §1).
 */
export async function buildBoqXlsx(b: BoqStructure): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CLMC Takeoff'
  wb.created = new Date()
  const ws = wb.addWorksheet(SHEET_NAME)

  // Column widths BEFORE rows (key only — no header property to avoid auto-row).
  ws.columns = [
    { key: 'item', width: COL_WIDTH_ITEM },
    { key: 'quantity', width: COL_WIDTH_QTY },
    { key: 'uom', width: COL_WIDTH_UOM }
  ]

  // Metadata block — D-09. 5 single-column rows + blank spacer.
  ws.addRow([safeText(`Project: ${b.metadata.projectName}`)])
  ws.addRow([safeText(`Plan: ${b.metadata.planFilename}`)])
  ws.addRow([`Exported: ${b.metadata.exportedDate}`])
  ws.addRow([`Pages: ${b.metadata.totalPages}`])
  ws.addRow([`Markups: ${b.metadata.totalMarkups}`])
  ws.addRow([])

  // Title row — D-10. Bold + frozen.
  ws.addRow(['Item', 'Quantity', 'UoM'])
  const titleRowIdx = ws.lastRow!.number
  ws.getRow(titleRowIdx).font = { bold: true }
  // Pitfall 2: views set BEFORE writeBuffer, immediately after title row.
  ws.views = [{ state: 'frozen', ySplit: titleRowIdx }]

  // Per-category groups
  for (const cat of b.categories) {
    appendCategoryHeading(ws, cat.name)
    for (const item of cat.items) appendItemRow(ws, item)
    for (const sub of cat.subtotals) appendSubtotalRow(ws, sub)
  }

  // Grand totals — same like-typed-only rule as subtotals (D-12)
  for (const gt of b.grandTotals) {
    const r = ws.addRow([safeText('Grand Total'), gt.total, gt.uom])
    r.font = { bold: true }
    r.getCell(2).numFmt = numFmtForUom(gt.uom)
    r.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_TOTAL_FILL_ARGB } }
    })
  }

  // writeBuffer — TS declares Promise<ExcelJS.Buffer> but runtime is Node Buffer.
  // Cast for IPC consistency. Pitfall 10.
  const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer
  return buf
}

/** D-11: bold heading, merged across A:C, NO color (color is per-name-group, not per-category). */
function appendCategoryHeading(ws: ExcelJS.Worksheet, name: string): void {
  const r = ws.addRow([safeText(name), null, null])
  // Pitfall 6: mergeCells AFTER addRow, using the new row's number.
  ws.mergeCells(`A${r.number}:C${r.number}`)
  r.font = { bold: true }
}

/** D-13: Item-cell only fill; quantity is native number with display numFmt. */
function appendItemRow(ws: ExcelJS.Worksheet, item: BoqItemRow): void {
  const r = ws.addRow([safeText(item.label), item.quantity, item.uom])
  // Pitfall 3: native number — keeps SUM() working.
  const qtyCell = r.getCell(2)
  qtyCell.value = item.quantity
  qtyCell.numFmt = numFmtForUom(item.uom)
  if (item.color !== null) {
    r.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(item.color) }
    }
  }
}

/** D-12: bold + light-gray fill (Q1) on every cell of the row. */
function appendSubtotalRow(ws: ExcelJS.Worksheet, sub: BoqSubtotal): void {
  const r = ws.addRow([safeText('Subtotal'), sub.total, sub.uom])
  r.font = { bold: true }
  r.getCell(2).numFmt = numFmtForUom(sub.uom)
  r.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL_ARGB } }
  })
}

// =============================================================================
// CSV builder — D-14, EXPRT-02
// =============================================================================

/**
 * Build the BOQ CSV from a BoqStructure. Returns a UTF-8 string ready for
 * Buffer.from(text, 'utf-8') + atomicWriteFile. NEVER call from the renderer
 * (csv-stringify is a main-process import per the no-renderer-bundle rule).
 *
 * Mirrors XLSX row sequence per D-14. Counts emitted as integers; lengths/areas
 * at 2dp via Number(x.toFixed(2)). RFC 4180 quoting + \r\n line endings via
 * csv-stringify/sync. Verified against csv-stringify@6.7.0 in this repo on
 * 2026-05-02 (RESEARCH §4).
 */
export function buildBoqCsv(b: BoqStructure): string {
  const rows: (string | number)[][] = []

  // Metadata block — single-column rows mirror XLSX layout
  rows.push([safeText(`Project: ${b.metadata.projectName}`)])
  rows.push([safeText(`Plan: ${b.metadata.planFilename}`)])
  rows.push([`Exported: ${b.metadata.exportedDate}`])
  rows.push([`Pages: ${b.metadata.totalPages}`])
  rows.push([`Markups: ${b.metadata.totalMarkups}`])
  rows.push([])  // blank spacer — emits as ''\r\n
  rows.push(['Item', 'Quantity', 'UoM'])

  for (const cat of b.categories) {
    rows.push([safeText(cat.name), '', ''])  // bare-text heading per D-14
    for (const item of cat.items) {
      rows.push([
        safeText(item.label),
        item.uom === 'ea' ? Math.round(item.quantity) : Number(item.quantity.toFixed(2)),
        item.uom
      ])
    }
    for (const sub of cat.subtotals) {
      rows.push([
        safeText('Subtotal'),
        sub.uom === 'ea' ? Math.round(sub.total) : Number(sub.total.toFixed(2)),
        sub.uom
      ])
    }
  }

  for (const gt of b.grandTotals) {
    rows.push([
      safeText('Grand Total'),
      gt.uom === 'ea' ? Math.round(gt.total) : Number(gt.total.toFixed(2)),
      gt.uom
    ])
  }

  // UTF-8 BOM (﻿ → bytes 0xEF 0xBB 0xBF) so Excel on Windows
  // auto-detects UTF-8 instead of falling back to Windows-1252 and
  // rendering 'm²' as 'mÂ²'. Reverses original D-14 decision after
  // Phase 5 UAT scenario 2 GAP — Excel is the primary target tool and
  // BOM-stripping behavior is universal in modern parsers (csv-parse,
  // Sheets, Numbers all transparently handle the BOM).
  return '﻿' + stringify(rows, { record_delimiter: '\r\n', bom: false })
}
