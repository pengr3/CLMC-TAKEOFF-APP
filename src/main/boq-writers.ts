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
export type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
export interface BoqItemRow {
  label: string
  quantity: number
  uom: string
  color: string | null
  type: BoqRowType
  rate: number
  cost: number
}
export interface BoqSubtotal { uom: string; total: number }
export interface BoqCategoryGroup {
  name: string
  items: BoqItemRow[]
  subtotals: BoqSubtotal[]
  costSubtotal: number
}
export interface BoqStructure {
  metadata: BoqMetadata
  categories: BoqCategoryGroup[]
  grandTotals: BoqSubtotal[]
  grandTotalCost: number
}

// =============================================================================
// Cell-format constants
// =============================================================================
const NUMFMT_INTEGER = '0'
const NUMFMT_DECIMAL = '0.00'
// Currency display format for Rate/Cost cells. ₱ (U+20B1, Philippine Peso) is a
// hardcoded constant this phase — there is no Settings currency picker yet
// (deferred). This is the main-process writer's OWN local copy: boq-writers.ts
// runs in the main process and CANNOT import the renderer's CURRENCY_SYMBOL
// (src/renderer/src/lib/currency.ts) across the process boundary. The duplication
// is deliberate (same convention as the inline BoqRowType/BoqItemRow mirrors and
// NUMFMT_DECIMAL above) — a future picker changes both seams. The ₱ glyph is safe
// inside the numFmt literal because the xlsx XML is UTF-8 (RESEARCH §ExcelJS ₱).
const NUMFMT_PESO = '₱#,##0.00'
const COL_WIDTH_ITEM = 36
const COL_WIDTH_QTY = 12
const COL_WIDTH_UOM = 8
const COL_WIDTH_RATE = 14
const COL_WIDTH_COST = 14
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
// CSV/XLSX formula-injection guard — Excel/Sheets ignore leading whitespace
// and tabs before formula triggers, so the regex strips those before checking.
// Reference: OWASP CSV Injection cheatsheet; documented bypass for first-char-only
// guards. Matches space, tab, vertical tab, form feed, and other Unicode whitespace.
const FORMULA_TRIGGER_RE = /^\s*[=+\-@]/

function safeText(s: string): string {
  if (s.length === 0) return s
  if (FORMULA_TRIGGER_RE.test(s)) return `'${s}`
  return s
}

/** numFmt selector for a quantity cell based on its UoM. */
function numFmtForUom(uom: string): string {
  return uom === 'ea' ? NUMFMT_INTEGER : NUMFMT_DECIMAL
}

/**
 * Coerce a ₱ money value to a finite number, defaulting non-finite (undefined /
 * NaN / Infinity) to 0. Two reasons: (1) the locked "a row with no rate set =
 * rate 0 / cost 0" rule (CONTEXT line 27) — an unpriced row must render ₱0.00,
 * never throw; (2) the do-not-edit pre-Phase-15 writer fixtures construct
 * BoqItemRow/BoqCategoryGroup/BoqStructure without the now-required rate/cost/
 * costSubtotal/grandTotalCost fields, so these are `undefined` at runtime — a bare
 * `.toFixed()` would throw and regress a previously-green test. Mirrors the
 * renderer-side `Number.isFinite(...) ? ... : 0` formatCost guard from Plan 15-03.
 */
function money(n: number): number {
  return Number.isFinite(n) ? n : 0
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
    { key: 'uom', width: COL_WIDTH_UOM },
    { key: 'rate', width: COL_WIDTH_RATE },
    { key: 'cost', width: COL_WIDTH_COST }
  ]

  // Metadata block — D-09. 5 single-column rows + blank spacer.
  ws.addRow([safeText(`Project: ${b.metadata.projectName}`)])
  ws.addRow([safeText(`Plan: ${b.metadata.planFilename}`)])
  ws.addRow([`Exported: ${b.metadata.exportedDate}`])
  ws.addRow([`Pages: ${b.metadata.totalPages}`])
  ws.addRow([`Markups: ${b.metadata.totalMarkups}`])
  ws.addRow([])

  // Title row — D-10 + Phase 15 priced layout. Bold + frozen.
  // Locked column order (CONTEXT line 44): Item · Quantity · UoM · Rate · Cost.
  ws.addRow(['Item', 'Quantity', 'UoM', 'Rate', 'Cost'])
  const titleRowIdx = ws.lastRow!.number
  ws.getRow(titleRowIdx).font = { bold: true }
  // Pitfall 2: views set BEFORE writeBuffer, immediately after title row.
  ws.views = [{ state: 'frozen', ySplit: titleRowIdx }]

  // Per-category groups
  for (const cat of b.categories) {
    appendCategoryHeading(ws, cat.name)
    for (const item of cat.items) appendItemRow(ws, item)
    for (const sub of cat.subtotals) appendSubtotalRow(ws, sub)
    // Phase 15: one ₱ cost subtotal per category (unit-agnostic — NOT bucketed
    // per-UoM like the quantity subtotals above).
    appendCostSubtotalRow(ws, cat.costSubtotal)
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

  // Phase 15: one ₱ grand-total cost row (Σ category cost subtotals) in the Cost
  // column. Native number with the ₱ numFmt so SUM() stays correct.
  {
    const grandTotalCost = money(b.grandTotalCost)
    const r = ws.addRow(['Grand Total (cost)', null, null, null, grandTotalCost])
    r.font = { bold: true }
    // WR-03: addRow already placed grandTotalCost in cell 5 — only the numFmt
    // needs setting (the explicit value reassignment was redundant).
    r.getCell(5).numFmt = NUMFMT_PESO
    r.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_TOTAL_FILL_ARGB } }
    })
  }

  // writeBuffer — TS declares Promise<ExcelJS.Buffer> but runtime is Node Buffer.
  // Cast for IPC consistency. Pitfall 10.
  const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer
  return buf
}

/**
 * D-11: bold heading, merged across A:E (Phase 15 — widened from A:C to cover the
 * Rate/Cost columns), NO color (color is per-name-group, not per-category).
 */
function appendCategoryHeading(ws: ExcelJS.Worksheet, name: string): void {
  const r = ws.addRow([safeText(name), null, null, null, null])
  // Pitfall 6: mergeCells AFTER addRow, using the new row's number.
  ws.mergeCells(`A${r.number}:E${r.number}`)
  r.font = { bold: true }
}

/** D-13: Item-cell only fill; quantity/rate/cost are native numbers with display numFmt. */
function appendItemRow(ws: ExcelJS.Worksheet, item: BoqItemRow): void {
  const rate = money(item.rate)
  const cost = money(item.cost)
  const r = ws.addRow([safeText(item.label), item.quantity, item.uom, rate, cost])
  // Pitfall 3: native number — keeps SUM() working.
  const qtyCell = r.getCell(2)
  qtyCell.value = item.quantity
  qtyCell.numFmt = numFmtForUom(item.uom)
  // Phase 15: Rate/Cost are NATIVE numbers carrying a ₱ display numFmt (NEVER a
  // pre-formatted "₱123.45" string — that breaks SUM()). Numbers bypass safeText
  // (the formula-injection guard is label-only; numbers can't trigger formulas).
  const rateCell = r.getCell(4)
  rateCell.value = rate
  rateCell.numFmt = NUMFMT_PESO
  const costCell = r.getCell(5)
  costCell.value = cost
  costCell.numFmt = NUMFMT_PESO
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

/**
 * Phase 15: per-category ₱ cost subtotal — a single unit-agnostic number in the
 * Cost column (cell 5). Mirrors appendSubtotalRow (bold + light-gray fill on every
 * cell) but carries the cost as a NATIVE number with the ₱ numFmt so SUM() works.
 */
function appendCostSubtotalRow(ws: ExcelJS.Worksheet, costSubtotal: number): void {
  const value = money(costSubtotal)
  const r = ws.addRow(['Subtotal (cost)', null, null, null, value])
  r.font = { bold: true }
  // WR-03: addRow already placed value in cell 5 — only the numFmt needs
  // setting (the explicit value reassignment was redundant).
  r.getCell(5).numFmt = NUMFMT_PESO
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
  // Phase 15 priced layout — locked order Item · Quantity · UoM · Rate · Cost.
  rows.push(['Item', 'Quantity', 'UoM', 'Rate', 'Cost'])

  for (const cat of b.categories) {
    rows.push([safeText(cat.name), '', '', '', ''])  // bare-text heading per D-14, padded to 5 cells
    for (const item of cat.items) {
      rows.push([
        safeText(item.label),
        item.uom === 'ea' ? Math.round(item.quantity) : Number(item.quantity.toFixed(2)),
        item.uom,
        // Phase 15: Rate/Cost as plain numeric values (same discipline as the
        // quantity column above) — NO ₱ glyph in the cell; the BOM + Excel display
        // carry the currency. Keeps the column SUM-friendly in any tool.
        Number(money(item.rate).toFixed(2)),
        Number(money(item.cost).toFixed(2))
      ])
    }
    for (const sub of cat.subtotals) {
      rows.push([
        safeText('Subtotal'),
        sub.uom === 'ea' ? Math.round(sub.total) : Number(sub.total.toFixed(2)),
        sub.uom,
        '',  // Rate column blank on a quantity subtotal row
        ''   // Cost column blank — the ₱ cost subtotal is its own row below
      ])
    }
    // Phase 15: per-category ₱ cost subtotal — a single number in the Cost column.
    rows.push(['Subtotal (cost)', '', '', '', Number(money(cat.costSubtotal).toFixed(2))])
  }

  for (const gt of b.grandTotals) {
    rows.push([
      safeText('Grand Total'),
      gt.uom === 'ea' ? Math.round(gt.total) : Number(gt.total.toFixed(2)),
      gt.uom,
      '',  // Rate column blank on a quantity grand-total row
      ''   // Cost column blank — the ₱ grand-total cost is its own row below
    ])
  }

  // Phase 15: grand-total ₱ cost (Σ category cost subtotals) in the Cost column.
  rows.push(['Grand Total (cost)', '', '', '', Number(money(b.grandTotalCost).toFixed(2))])

  // UTF-8 BOM (﻿ → bytes 0xEF 0xBB 0xBF) so Excel on Windows
  // auto-detects UTF-8 instead of falling back to Windows-1252 and
  // rendering 'm²' as 'mÂ²'. Reverses original D-14 decision after
  // Phase 5 UAT scenario 2 GAP — Excel is the primary target tool and
  // BOM-stripping behavior is universal in modern parsers (csv-parse,
  // Sheets, Numbers all transparently handle the BOM).
  return '﻿' + stringify(rows, { record_delimiter: '\r\n', bom: false })
}
