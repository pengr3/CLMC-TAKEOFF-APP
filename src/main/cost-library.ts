import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import * as fs from 'fs/promises'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import {
  COST_LIBRARY_HEADERS,
  COST_LIBRARY_UNITS,
  MAX_LIBRARY_ITEMS,
  validateLibraryRows,
  validateLibrarySnapshot,
  type CostLibraryItem,
  type CostLibrarySnapshot,
  type LibraryResult
} from '../shared/cost-library'

export const MAX_LIBRARY_FILE_BYTES = 10 * 1024 * 1024
export async function parseCostLibrary(
  data: Buffer,
  filename: string
): Promise<LibraryResult<CostLibraryItem[]>> {
  if (data.length > MAX_LIBRARY_FILE_BYTES)
    return { ok: false, reason: 'Choose a cost library smaller than 10 MB.' }
  try {
    const workbook = new ExcelJS.Workbook()
    const extension = extname(filename).toLowerCase()
    let sheet: ExcelJS.Worksheet | undefined
    if (extension === '.xlsx') {
      await workbook.xlsx.load(data as unknown as ExcelJS.Buffer)
      sheet = workbook.getWorksheet('Cost Library')
      if (!sheet)
        return {
          ok: false,
          reason: 'Keep the worksheet named “Cost Library”. Download the app template to start.'
        }
    } else if (extension === '.csv') {
      sheet = await workbook.csv.read(Readable.from([data]), { map: (value: string) => value })
    } else
      return {
        ok: false,
        reason: 'Choose a .xlsx or .csv file. Legacy .xls files are not supported.'
      }
    if (sheet.rowCount > MAX_LIBRARY_ITEMS + 1 || sheet.columnCount > 50)
      return {
        ok: false,
        reason: `Use the six-column template with at most ${MAX_LIBRARY_ITEMS.toLocaleString()} rows.`
      }
    const rows: unknown[][] = []
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const cells: unknown[] = []
      for (let c = 1; c <= Math.max(6, row.cellCount); c++) cells.push(row.getCell(c).value)
      rows.push(cells)
    }
    return validateLibraryRows(rows)
  } catch {
    return {
      ok: false,
      reason:
        'Could not read this spreadsheet. Save it as a valid .xlsx or UTF-8 comma-separated CSV using the app template.'
    }
  }
}
export async function buildCostLibraryTemplate(): Promise<Buffer> {
  const book = new ExcelJS.Workbook()
  book.creator = 'CLMC Takeoff'
  const sheet = book.addWorksheet('Cost Library', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.addRow(Array.from(COST_LIBRARY_HEADERS))
  sheet.columns.forEach((column, i) => {
    column.width = [20, 48, 24, 14, 24, 24][i]
  })
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0078D4' } }
  sheet.getRow(1).height = 28
  sheet.autoFilter = 'A1:F1'
  sheet.getColumn(1).numFmt = '@'
  sheet.getColumn(5).numFmt = '0.00'
  sheet.getColumn(6).numFmt = '0.00'
  for (let r = 2; r <= 1001; r++) {
    sheet.getCell(r, 4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${COST_LIBRARY_UNITS.join(',')}"`],
      showErrorMessage: true,
      error: 'Choose a supported measurement unit.'
    }
    for (const c of [5, 6])
      sheet.getCell(r, c).dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        error: 'Enter zero or a positive rate.'
      }
  }
  const help = book.addWorksheet('Instructions')
  help.getColumn(1).width = 110
  for (const line of [
    'CLMC Takeoff — Cost Library Template',
    'Fill the Cost Library worksheet below its six original headings. Leave this Instructions sheet separate.',
    'Each row is one ready-to-use work-item rate. The internal team owns pricing accuracy and revisions.',
    'Item Code: required and unique (case-insensitive). Format codes as text to preserve leading zeros.',
    'Description and Category: required plain text. Applying rates does not rename existing items.',
    `Unit: ${COST_LIBRARY_UNITS.join(', ')}. ea means each; pcs is also accepted.`,
    'Material Unit Rate and Labor Unit Rate: PHP per indicated unit, numeric values of zero or more. Use 0 if not applicable.',
    'Use values, not formulas. Paste calculated rates as values. No currency symbols or grouping commas in CSV rates.',
    'Selling markup stays in the project Estimate sheet and is not imported.',
    'Save as .xlsx, or export only Cost Library as UTF-8 comma-separated .csv. Maximum 10 MB / 10,000 items.',
    'Import separately on each PC. Preview, then Replace Library. This replaces that PC’s complete library.',
    'Existing estimates keep saved rates. Apply or reapply rates explicitly using the row library picker.',
    'Units must match the Estimate row. Rates are not automatically converted.',
    'Back up your master spreadsheet. This template intentionally contains no sample prices.'
  ])
    help.addRow([line])
  help.getRow(1).font = { bold: true, size: 16 }
  return Buffer.from(await book.xlsx.writeBuffer())
}
export class CostLibraryRepository {
  private readonly filePath: string
  constructor(
    private readonly directory: string,
    private readonly io: Pick<
      typeof fs,
      'readFile' | 'writeFile' | 'mkdir' | 'rename' | 'unlink'
    > = fs
  ) {
    this.filePath = join(directory, 'cost-library-v1.json')
  }
  async load(): Promise<LibraryResult<CostLibrarySnapshot | null>> {
    try {
      return validateLibrarySnapshot(JSON.parse(await this.io.readFile(this.filePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, value: null }
      return {
        ok: false,
        reason:
          'Could not load the saved cost library. Your file was kept. Import your master spreadsheet again.'
      }
    }
  }
  async replace(snapshot: CostLibrarySnapshot): Promise<LibraryResult<CostLibrarySnapshot>> {
    const validated = validateLibrarySnapshot(snapshot)
    if (!validated.ok) return validated
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    try {
      await this.io.mkdir(this.directory, { recursive: true })
      await this.io.writeFile(temporaryPath, JSON.stringify(validated.value), 'utf8')
      await this.io.rename(temporaryPath, this.filePath)
      return validated
    } catch {
      return {
        ok: false,
        reason:
          'Could not save the new library. The previous library was kept. Check disk space and folder access, then retry.'
      }
    } finally {
      await this.io.unlink(temporaryPath).catch(() => {})
    }
  }
}
