export const COST_LIBRARY_HEADERS = [
  'Item Code',
  'Description',
  'Category',
  'Unit',
  'Material Unit Rate',
  'Labor Unit Rate'
] as const
export const COST_LIBRARY_UNITS = [
  'ea',
  'mm',
  'cm',
  'm',
  'in',
  'ft',
  'mm²',
  'cm²',
  'm²',
  'in²',
  'ft²'
] as const
export const MAX_LIBRARY_ITEMS = 10000
export const LIBRARY_IMPORT_MESSAGES = {
  timeout:
    'Import took too long and was stopped. Your current library was kept. Remove unused sheets or use the CSV template, then import again.',
  resource:
    'This workbook exceeds the import limits. Your current library was kept. Remove unused sheets or use the CSV template, then import again.',
  parser:
    'Could not read this workbook. Your current library was kept. Save a new copy in Excel or use the CSV template, then import again.'
} as const
export type LibraryImportCode = keyof typeof LIBRARY_IMPORT_MESSAGES
export const MAX_WORKER_MESSAGE_CHARS = 20_000_000
export interface CostLibraryItem {
  code: string
  description: string
  category: string
  unit: string
  material: number
  labor: number
}
export interface CostLibrarySnapshot {
  formatVersion: 1
  sourceFilename: string
  importedAt: string
  items: CostLibraryItem[]
}
export interface LibraryIssue {
  row: number
  column: string
  message: string
}
export type LibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; issues?: LibraryIssue[]; code?: LibraryImportCode }
export interface LibraryPreview {
  token: string
  library: CostLibrarySnapshot
}
export interface CostLibraryApi {
  load: () => Promise<LibraryResult<CostLibrarySnapshot | null>>
  preview: () => Promise<LibraryResult<LibraryPreview | null>>
  commit: (token: string) => Promise<LibraryResult<CostLibrarySnapshot>>
  cancel: (token: string) => Promise<void>
  downloadTemplate: () => Promise<LibraryResult<boolean>>
}
export function normalizeLibraryUnit(value: string): string | null {
  const unit = value.trim().toLowerCase().replace(/\^?2$/, '²')
  if (['pcs', 'pc', 'piece', 'pieces', 'each', 'no', 'nos'].includes(unit)) return 'ea'
  if (unit === 'sqm') return 'm²'
  if (unit === 'sqft') return 'ft²'
  return (COST_LIBRARY_UNITS as readonly string[]).includes(unit) ? unit : null
}
function plainText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return value == null ? '' : null
}
function rateValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null
  const n = Number(value.trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}
/** Never evaluate formulas or guess spreadsheet layouts. */
export function validateLibraryRows(rows: unknown[][]): LibraryResult<CostLibraryItem[]> {
  const header = rows[0] ?? []
  if (
    COST_LIBRARY_HEADERS.some((name, i) => plainText(header[i])?.replace(/^\uFEFF/, '') !== name) ||
    header.slice(6).some((v) => v != null && v !== '')
  ) {
    return {
      ok: false,
      reason: 'Use the app template with the six original column headings in order.',
      issues: [{ row: 1, column: 'Headers', message: COST_LIBRARY_HEADERS.join(', ') }]
    }
  }
  if (rows.length > MAX_LIBRARY_ITEMS + 1)
    return { ok: false, reason: `Use at most ${MAX_LIBRARY_ITEMS.toLocaleString()} item rows.` }
  const items: CostLibraryItem[] = []
  const issues: LibraryIssue[] = []
  const codes = new Set<string>()
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i]
    if (values.every((v) => v == null || (typeof v === 'string' && v.trim() === ''))) continue
    const row = i + 1
    const text = values.slice(0, 4).map(plainText)
    for (let c = 0; c < 4; c++) {
      if (!text[c] || text[c]!.length > 500)
        issues.push({
          row,
          column: COST_LIBRARY_HEADERS[c],
          message: 'Enter a plain value of 1–500 characters; formulas are not supported.'
        })
    }
    const [code, description, category, rawUnit] = text
    if (code) {
      if (codes.has(code.toLowerCase()))
        issues.push({ row, column: 'Item Code', message: `Duplicate item code: ${code}.` })
      codes.add(code.toLowerCase())
    }
    const unit = rawUnit ? normalizeLibraryUnit(rawUnit) : null
    if (rawUnit && !unit)
      issues.push({
        row,
        column: 'Unit',
        message: `Use ${COST_LIBRARY_UNITS.join(', ')} (pcs is also accepted).`
      })
    const material = rateValue(values[4])
    const labor = rateValue(values[5])
    for (const [c, n] of [
      [4, material],
      [5, labor]
    ] as const) {
      if (n === null)
        issues.push({
          row,
          column: COST_LIBRARY_HEADERS[c],
          message:
            'Enter a number of zero or more, without formulas, currency symbols or thousands separators.'
        })
    }
    if (values.slice(6).some((v) => v != null && v !== ''))
      issues.push({
        row,
        column: 'Extra columns',
        message: 'Keep data within the six template columns.'
      })
    if (code && description && category && unit && material !== null && labor !== null)
      items.push({ code, description, category, unit, material, labor })
    if (issues.length >= 100) break
  }
  if (issues.length)
    return {
      ok: false,
      reason: 'Fix the listed rows in your master file, then import again. Nothing was replaced.',
      issues
    }
  if (!items.length)
    return {
      ok: false,
      reason: 'The library has no items. Fill in at least one item below the headings.'
    }
  return { ok: true, value: items }
}
export function validateLibrarySnapshot(value: unknown): LibraryResult<CostLibrarySnapshot> {
  if (!value || typeof value !== 'object')
    return { ok: false, reason: 'Invalid saved cost library.' }
  const v = value as Partial<CostLibrarySnapshot>
  if (
    v.formatVersion !== 1 ||
    typeof v.sourceFilename !== 'string' ||
    !v.sourceFilename ||
    typeof v.importedAt !== 'string' ||
    !Number.isFinite(Date.parse(v.importedAt)) ||
    !Array.isArray(v.items)
  ) {
    return { ok: false, reason: 'Invalid saved cost library. Import your master file again.' }
  }
  const result = validateLibraryRows([
    Array.from(COST_LIBRARY_HEADERS),
    ...v.items.map((item: unknown) => {
      const it = (item ?? {}) as Partial<CostLibraryItem>
      return [it.code, it.description, it.category, it.unit, it.material, it.labor]
    })
  ])
  if (!result.ok) return result
  return {
    ok: true,
    value: {
      formatVersion: 1,
      sourceFilename: v.sourceFilename,
      importedAt: v.importedAt,
      items: result.value
    }
  }
}
