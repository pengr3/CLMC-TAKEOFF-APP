import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
  buildCostLibraryTemplate,
  parseCostLibrary,
  MAX_LIBRARY_FILE_BYTES
} from '../main/cost-library'
import {
  COST_LIBRARY_HEADERS,
  normalizeLibraryUnit,
  validateLibraryRows,
  validateLibrarySnapshot
} from '../shared/cost-library'

const headers = Array.from(COST_LIBRARY_HEADERS)
const row = ['001', 'Wall painting', 'Finishes', 'm²', 100.25, 80]
const csv = (lines: unknown[][]): Buffer =>
  Buffer.from(
    lines
      .map((line) => line.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
  )

describe('cost library template and parser', () => {
  it('ships a blank standard workbook with instructions, formats and validation; filled template roundtrips', async () => {
    const template = await buildCostLibraryTemplate()
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(template as never)
    const sheet = book.getWorksheet('Cost Library')!
    expect(sheet.getRow(1).values).toEqual([undefined, ...headers])
    expect(sheet.getCell('A2').numFmt).toBe('@')
    expect(sheet.getCell('D2').dataValidation.type).toBe('list')
    expect(book.getWorksheet('Instructions')!.getCell('A1').text).toContain('CLMC')
    expect((await parseCostLibrary(template, 'blank.xlsx')).ok).toBe(false)
    sheet.getRow(2).values = row
    const result = await parseCostLibrary(Buffer.from(await book.xlsx.writeBuffer()), 'filled.XLSX')
    expect(result).toEqual({
      ok: true,
      value: [
        {
          code: '001',
          description: 'Wall painting',
          category: 'Finishes',
          unit: 'm²',
          material: 100.25,
          labor: 80
        }
      ]
    })
  })
  it('preserves quoted commas/newlines and leading zeros in UTF-8 CSV with BOM', async () => {
    const result = await parseCostLibrary(
      Buffer.concat([
        Buffer.from('\uFEFF'),
        csv([headers, ['0007', 'Paint, two coats\nWhite', 'Finishes', 'm2', '100.25', '0']])
      ]),
      'rates.csv'
    )
    expect(result.ok && result.value[0]).toEqual({
      code: '0007',
      description: 'Paint, two coats\nWhite',
      category: 'Finishes',
      unit: 'm²',
      material: 100.25,
      labor: 0
    })
  })
  it.each(['.xls', '.txt'])('rejects unsupported extension %s', async (extension) => {
    expect((await parseCostLibrary(csv([headers, row]), `file${extension}`)).ok).toBe(false)
  })
  it('rejects corrupt xlsx and malformed CSV without throwing', async () => {
    expect((await parseCostLibrary(Buffer.from('broken'), 'file.xlsx')).ok).toBe(false)
    expect((await parseCostLibrary(Buffer.from('"unclosed'), 'file.csv')).ok).toBe(false)
  })
  it('rejects oversized files before workbook parsing', async () => {
    expect((await parseCostLibrary(Buffer.alloc(MAX_LIBRARY_FILE_BYTES + 1), 'file.xlsx')).ok).toBe(
      false
    )
  })
  it('requires the named worksheet', async () => {
    const book = new ExcelJS.Workbook()
    book.addWorksheet('Other').addRows([headers, row])
    const result = await parseCostLibrary(Buffer.from(await book.xlsx.writeBuffer()), 'file.xlsx')
    expect(!result.ok && result.reason).toContain('Cost Library')
  })
  it('rejects formulas even when Excel provides a cached numeric result', async () => {
    const book = new ExcelJS.Workbook()
    const sheet = book.addWorksheet('Cost Library')
    sheet.addRows([headers, row])
    sheet.getCell('E2').value = { formula: '50+50', result: 100 }
    const result = await parseCostLibrary(Buffer.from(await book.xlsx.writeBuffer()), 'file.xlsx')
    expect(!result.ok && result.issues).toContainEqual(
      expect.objectContaining({ row: 2, column: 'Material Unit Rate' })
    )
  })
})

describe('standard schema', () => {
  it.each([
    headers.slice(0, 5),
    ['Code', ...headers.slice(1)],
    [...headers, 'Markup'],
    [...headers].reverse()
  ])('rejects altered headers %j', (bad) => {
    expect(validateLibraryRows([bad, row]).ok).toBe(false)
  })
  it('reports duplicate codes case-insensitively, with original row numbers', () => {
    const result = validateLibraryRows([
      headers,
      ['AbC', ...row.slice(1)],
      [],
      [' abc ', ...row.slice(1)]
    ])
    expect(!result.ok && result.issues).toContainEqual(
      expect.objectContaining({ row: 4, column: 'Item Code' })
    )
  })
  it.each([
    -1,
    NaN,
    Infinity,
    '',
    null,
    'abc',
    '1,000',
    '₱10',
    '=1+1',
    '0x10',
    true,
    { formula: '1', result: 1 }
  ])('rejects invalid rate %j', (rate) => {
    expect(validateLibraryRows([headers, [...row.slice(0, 4), rate, 0]]).ok).toBe(false)
  })
  it.each([0, '0', 123.45, '123.45'])('accepts finite nonnegative rate %j', (rate) => {
    expect(validateLibraryRows([headers, [...row.slice(0, 4), rate, 0]]).ok).toBe(true)
  })
  it('ignores empty rows, accepts unit aliases and rejects unsupported units/extra content', () => {
    expect(
      validateLibraryRows([headers, [], ['1', 'Outlet', 'Electrical', 'pcs', 0, 10], [null, null]])
    ).toMatchObject({ ok: true, value: [{ unit: 'ea' }] })
    expect(validateLibraryRows([headers, [...row.slice(0, 3), 'can', 1, 2]]).ok).toBe(false)
    expect(validateLibraryRows([headers, [...row, 'extra']]).ok).toBe(false)
    expect(validateLibraryRows([headers]).ok).toBe(false)
    expect(validateLibraryRows([headers, ['', ...row.slice(1)]]).ok).toBe(false)
  })
  it('caps row count and handles invalid saved-library shapes', () => {
    expect(validateLibraryRows([headers, ...Array.from({ length: 10001 }, () => row)]).ok).toBe(
      false
    )
    for (const value of [
      null,
      {},
      { formatVersion: 2 },
      { formatVersion: 1, sourceFilename: 'x', importedAt: 'bad', items: [] }
    ])
      expect(validateLibrarySnapshot(value).ok).toBe(false)
    expect(normalizeLibraryUnit('ft^2')).toBe('ft²')
  })
})
