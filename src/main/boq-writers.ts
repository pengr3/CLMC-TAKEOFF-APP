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
  // Phase 16 (D-03/D-05): the widened {material, labor, markup} estimate model.
  // `material`/`labor` are ₱ per unit; `markup` is a PERCENT (30 = 30%, NOT a
  // fraction). materialCost/laborCost = rate × quantity; cost = materialCost +
  // laborCost (internal); price = cost × (1 + markup/100) (client); margin =
  // price − cost. This is the 4th of the four inline BoqItemRow mirrors
  // (boq-types.ts canonical + the two preload copies were widened in 16-02); the
  // writer's copy is widened here to complete the 4-way type lock. The writer
  // mirror deliberately omits `categoryId` (same as the preload mirrors) — it is
  // not needed at the file-I/O boundary.
  material: number
  labor: number
  markup: number
  materialCost: number
  laborCost: number
  cost: number
  price: number
  margin: number
  color: string | null
  type: BoqRowType
}
export interface BoqSubtotal { uom: string; total: number }
export interface BoqCategoryGroup {
  name: string
  items: BoqItemRow[]
  subtotals: BoqSubtotal[]
  // Phase 16: three unit-agnostic single-₱ per-category subtotals (Σ over rows),
  // PARALLEL to the per-UoM quantity subtotals above (D-07).
  costSubtotal: number
  priceSubtotal: number
  marginSubtotal: number
}
export interface BoqStructure {
  metadata: BoqMetadata
  categories: BoqCategoryGroup[]
  grandTotals: BoqSubtotal[]
  // Phase 16: three project-wide grand totals (Σ over category subtotals).
  grandTotalCost: number
  grandTotalPrice: number
  grandTotalMargin: number
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
// Phase 16 (D-08): percent DISPLAY format for the Markup cell. The stored value
// is the percent NUMBER (e.g. 30), so this is a pure suffix — NEVER Excel's '0%'
// format, which multiplies the stored value by 100 (30 → "3000%"). The Markup
// cell must NOT carry the ₱ glyph. Sibling local constant to NUMFMT_PESO (same
// duplication-with-test-lock convention; no renderer import).
const NUMFMT_PERCENT = '0"%"'
const COL_WIDTH_ITEM = 36
const COL_WIDTH_QTY = 12
const COL_WIDTH_UOM = 8
// Phase 16: money/markup column widths (~14 each) for the six added columns.
const COL_WIDTH_MONEY = 14
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

/**
 * CSV money formatter (Phase 16). Emits a whole number as a plain integer string
 * ('3', '20') and a fractional value at 2 decimals PRESERVING the trailing zero
 * ('32.10', '24.69'). Distinct from `Number(x.toFixed(2))` which would strip the
 * trailing zero (32.10 → 32.1). No ₱ glyph — the CSV carries numeric values only
 * (currency lives in display, protected by the UTF-8 BOM). Guards non-finite → 0.
 */
function csvMoney(n: number): string {
  const v = money(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
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
  // Phase 16 (D-07/D-08): 9-column layout — Item · Quantity · UoM | Material ·
  // Labor · Cost (internal) | Markup · Price · Margin (client).
  ws.columns = [
    { key: 'item', width: COL_WIDTH_ITEM },
    { key: 'quantity', width: COL_WIDTH_QTY },
    { key: 'uom', width: COL_WIDTH_UOM },
    { key: 'material', width: COL_WIDTH_MONEY },
    { key: 'labor', width: COL_WIDTH_MONEY },
    { key: 'cost', width: COL_WIDTH_MONEY },
    { key: 'markup', width: COL_WIDTH_MONEY },
    { key: 'price', width: COL_WIDTH_MONEY },
    { key: 'margin', width: COL_WIDTH_MONEY }
  ]

  // Metadata block — D-09. 5 single-column rows + blank spacer.
  ws.addRow([safeText(`Project: ${b.metadata.projectName}`)])
  ws.addRow([safeText(`Plan: ${b.metadata.planFilename}`)])
  ws.addRow([`Exported: ${b.metadata.exportedDate}`])
  ws.addRow([`Pages: ${b.metadata.totalPages}`])
  ws.addRow([`Markups: ${b.metadata.totalMarkups}`])
  ws.addRow([])

  // Title row — D-10 + Phase 16 estimate layout. Bold + frozen.
  // Locked column order (D-07/D-08): Item · Quantity · UoM · Material · Labor ·
  // Cost · Markup · Price · Margin.
  ws.addRow(['Item', 'Quantity', 'UoM', 'Material', 'Labor', 'Cost', 'Markup', 'Price', 'Margin'])
  const titleRowIdx = ws.lastRow!.number
  ws.getRow(titleRowIdx).font = { bold: true }
  // Pitfall 2: views set BEFORE writeBuffer, immediately after title row.
  ws.views = [{ state: 'frozen', ySplit: titleRowIdx }]

  // Per-category groups
  for (const cat of b.categories) {
    appendCategoryHeading(ws, cat.name)
    for (const item of cat.items) appendItemRow(ws, item)
    for (const sub of cat.subtotals) appendSubtotalRow(ws, sub)
    // Phase 16: three ₱ subtotals per category (Cost/Price/Margin) — unit-agnostic
    // single numbers, NOT bucketed per-UoM like the quantity subtotals above.
    appendMoneySubtotalRows(ws, cat.costSubtotal, cat.priceSubtotal, cat.marginSubtotal)
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

  // Phase 16: one ₱ grand-total row carrying Cost/Price/Margin (Σ over the
  // category subtotals) in their matching group columns (Cost→6, Price→8,
  // Margin→9). Native numbers with the ₱ numFmt so SUM() stays correct.
  appendMoneyGrandRow(ws, b.grandTotalCost, b.grandTotalPrice, b.grandTotalMargin)

  // writeBuffer — TS declares Promise<ExcelJS.Buffer> but runtime is Node Buffer.
  // Cast for IPC consistency. Pitfall 10.
  const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer
  return buf
}

/**
 * D-11: bold heading, merged across A:I (Phase 16 — widened from A:E to cover the
 * 9-column Material/Labor/Cost/Markup/Price/Margin layout), NO color (color is
 * per-name-group, not per-category).
 */
function appendCategoryHeading(ws: ExcelJS.Worksheet, name: string): void {
  const r = ws.addRow([safeText(name), null, null, null, null, null, null, null, null])
  // Pitfall 6: mergeCells AFTER addRow, using the new row's number.
  ws.mergeCells(`A${r.number}:I${r.number}`)
  r.font = { bold: true }
}

/**
 * D-13: Item-cell only fill; quantity + the six money/markup cells are native
 * numbers with a display numFmt. Phase 16 9-column layout (D-07/D-08):
 *   4 Material · 5 Labor · 6 Cost · 7 Markup · 8 Price · 9 Margin.
 * Material/Labor/Cost/Price/Margin carry the ₱ numFmt; Markup carries the percent
 * numFmt. Every money value is money()-guarded (non-finite → 0).
 */
function appendItemRow(ws: ExcelJS.Worksheet, item: BoqItemRow): void {
  const material = money(item.material)
  const labor = money(item.labor)
  const cost = money(item.cost)
  const markup = money(item.markup)
  const price = money(item.price)
  const margin = money(item.margin)
  const r = ws.addRow([
    safeText(item.label), item.quantity, item.uom,
    material, labor, cost, markup, price, margin
  ])
  // Pitfall 3: native number — keeps SUM() working.
  const qtyCell = r.getCell(2)
  qtyCell.value = item.quantity
  qtyCell.numFmt = numFmtForUom(item.uom)
  // Phase 16: Material/Labor/Cost/Price/Margin are NATIVE numbers carrying a ₱
  // display numFmt (NEVER a pre-formatted "₱123.45" string — that breaks SUM()).
  // Markup is a NATIVE number carrying the PERCENT numFmt (NOT ₱). Numbers bypass
  // safeText (the formula-injection guard is label-only; numbers can't trigger
  // formulas).
  setMoneyCell(r, 4, material, NUMFMT_PESO)
  setMoneyCell(r, 5, labor, NUMFMT_PESO)
  setMoneyCell(r, 6, cost, NUMFMT_PESO)
  setMoneyCell(r, 7, markup, NUMFMT_PERCENT)
  setMoneyCell(r, 8, price, NUMFMT_PESO)
  setMoneyCell(r, 9, margin, NUMFMT_PESO)
  if (item.color !== null) {
    r.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(item.color) }
    }
  }
}

/** Set a native-number cell with a display numFmt (₱ or percent). */
function setMoneyCell(r: ExcelJS.Row, col: number, value: number, fmt: string): void {
  const cell = r.getCell(col)
  cell.value = value
  cell.numFmt = fmt
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
 * Phase 16: per-category ₱ Cost/Price/Margin subtotal — a single bold, light-gray
 * row carrying three unit-agnostic NATIVE numbers in their matching group columns
 * (Cost→6, Price→8, Margin→9), each with the ₱ numFmt so SUM() works. The row is
 * padded to 9 cells; the Markup column (7) is intentionally blank on a subtotal.
 */
function appendMoneySubtotalRows(
  ws: ExcelJS.Worksheet,
  costSubtotal: number,
  priceSubtotal: number,
  marginSubtotal: number
): void {
  const cost = money(costSubtotal)
  const price = money(priceSubtotal)
  const margin = money(marginSubtotal)
  const r = ws.addRow(['Subtotal (cost)', null, null, null, null, cost, null, price, margin])
  r.font = { bold: true }
  setMoneyCell(r, 6, cost, NUMFMT_PESO)
  setMoneyCell(r, 8, price, NUMFMT_PESO)
  setMoneyCell(r, 9, margin, NUMFMT_PESO)
  r.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL_ARGB } }
  })
}

/**
 * Phase 16: the pinned ₱ grand-total Cost/Price/Margin row — a single bold,
 * darker-gray row carrying three unit-agnostic NATIVE numbers in their matching
 * group columns (Cost→6, Price→8, Margin→9), each with the ₱ numFmt. Padded to 9
 * cells; the Markup column (7) is intentionally blank on a grand-total.
 */
function appendMoneyGrandRow(
  ws: ExcelJS.Worksheet,
  cost: number,
  price: number,
  margin: number
): void {
  const c = money(cost)
  const p = money(price)
  const m = money(margin)
  const r = ws.addRow(['Grand Total (cost)', null, null, null, null, c, null, p, m])
  r.font = { bold: true }
  setMoneyCell(r, 6, c, NUMFMT_PESO)
  setMoneyCell(r, 8, p, NUMFMT_PESO)
  setMoneyCell(r, 9, m, NUMFMT_PESO)
  r.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_TOTAL_FILL_ARGB } }
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
  // Phase 16 estimate layout — locked order Item · Quantity · UoM · Material ·
  // Labor · Cost · Markup · Price · Margin (D-07/D-08).
  rows.push(['Item', 'Quantity', 'UoM', 'Material', 'Labor', 'Cost', 'Markup', 'Price', 'Margin'])

  for (const cat of b.categories) {
    rows.push([safeText(cat.name), '', '', '', '', '', '', '', ''])  // bare-text heading per D-14, padded to 9 cells
    for (const item of cat.items) {
      rows.push([
        safeText(item.label),
        item.uom === 'ea' ? Math.round(item.quantity) : Number(item.quantity.toFixed(2)),
        item.uom,
        // Phase 16: Material/Labor/Cost/Markup/Price/Margin as plain numeric values
        // (same discipline as the quantity column above) — NO ₱ glyph in the cell;
        // the BOM + Excel display carry the currency. csvMoney keeps whole numbers
        // integer-clean and fractional values at 2dp (trailing zero preserved).
        // Locked order: Material · Labor · Cost · Markup · Price · Margin.
        csvMoney(item.material),
        csvMoney(item.labor),
        csvMoney(item.cost),
        csvMoney(item.markup),   // plain percent number (e.g. 30)
        csvMoney(item.price),
        csvMoney(item.margin)
      ])
    }
    for (const sub of cat.subtotals) {
      rows.push([
        safeText('Subtotal'),
        sub.uom === 'ea' ? Math.round(sub.total) : Number(sub.total.toFixed(2)),
        sub.uom,
        '', '', '', '', '', ''  // money columns blank — the ₱ Cost/Price/Margin subtotal is its own row below
      ])
    }
    // Phase 16: per-category ₱ Cost/Price/Margin subtotal — Cost→col 6, Price→col 8,
    // Margin→col 9 (Markup col 7 blank on a subtotal). Padded to 9 cells.
    rows.push([
      'Subtotal (cost)', '', '', '', '',
      csvMoney(cat.costSubtotal), '',
      csvMoney(cat.priceSubtotal),
      csvMoney(cat.marginSubtotal)
    ])
  }

  for (const gt of b.grandTotals) {
    rows.push([
      safeText('Grand Total'),
      gt.uom === 'ea' ? Math.round(gt.total) : Number(gt.total.toFixed(2)),
      gt.uom,
      '', '', '', '', '', ''  // money columns blank — the ₱ grand-total Cost/Price/Margin is its own row below
    ])
  }

  // Phase 16: grand-total ₱ Cost/Price/Margin (Σ category subtotals) — Cost→col 6,
  // Price→col 8, Margin→col 9. Padded to 9 cells.
  rows.push([
    'Grand Total (cost)', '', '', '', '',
    csvMoney(b.grandTotalCost), '',
    csvMoney(b.grandTotalPrice),
    csvMoney(b.grandTotalMargin)
  ])

  // UTF-8 BOM (﻿ → bytes 0xEF 0xBB 0xBF) so Excel on Windows
  // auto-detects UTF-8 instead of falling back to Windows-1252 and
  // rendering 'm²' as 'mÂ²'. Reverses original D-14 decision after
  // Phase 5 UAT scenario 2 GAP — Excel is the primary target tool and
  // BOM-stripping behavior is universal in modern parsers (csv-parse,
  // Sheets, Numbers all transparently handle the BOM).
  return '﻿' + stringify(rows, { record_delimiter: '\r\n', bom: false })
}
