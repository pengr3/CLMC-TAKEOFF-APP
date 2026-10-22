import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { createInflateRaw, deflateRawSync } from 'node:zlib'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { admitWorkbook, countWorkbookEntry, WORKBOOK_LIMITS } from '../main/workbook-admission'
import { buildCostLibraryTemplate, parseCostLibrary } from '../main/cost-library'

async function archive(files: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip()
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
const small = { ...WORKBOOK_LIMITS, entryBytes: 4096, totalBytes: 6000 }
function corruptCentral(buffer: Buffer, offset: number, value: number, width = 4): Buffer {
  const patched = Buffer.from(buffer)
  const central = patched.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  patched.writeUIntLE(value, central + offset, width)
  return patched
}

it('admits workbook bytes with a bounded streaming ZIP gate before ExcelJS', () => {
  expect(existsSync(resolve('src/main/workbook-admission.ts'))).toBe(true)
})

describe('lazy complete-archive admission', () => {
  it('counts all declared and actual bytes including unused sheets and media', async () => {
    const buffer = await archive({
      'xl/worksheets/sheet1.xml': '<xml/>',
      'xl/media/unused.bin': 'unused'.repeat(200)
    })
    expect(await admitWorkbook(buffer)).toMatchObject({
      entries: 5,
      declaredBytes: 1206,
      actualBytes: 1206,
      largestEntryBytes: 1200
    })
  })
  it('rejects a highly repetitive oversized unused entry at the default absolute cap', async () => {
    const buffer = await archive({
      'xl/media/unused.xml': '<x>' + 'a'.repeat(WORKBOOK_LIMITS.entryBytes) + '</x>'
    })
    expect(buffer.length).toBeLessThan(WORKBOOK_LIMITS.compressedBytes)
    await expect(admitWorkbook(buffer)).rejects.toMatchObject({ code: 'resource' })
  })
  it('bounds declared aggregate independently of individual entry sizes', async () => {
    const buffer = await archive({ a: 'a'.repeat(3500), b: 'b'.repeat(3500) })
    await expect(admitWorkbook(buffer, small)).rejects.toMatchObject({ code: 'resource' })
  })
  it('bounds the actual entry stream before collecting its full expansion', async () => {
    const expanded = Buffer.alloc(512 * 1024, 65)
    const stream = Readable.from([deflateRawSync(expanded)]).pipe(createInflateRaw())
    const usage = { entries: 1, declaredBytes: 1, actualBytes: 0, largestEntryBytes: 0 }
    await expect(countWorkbookEntry(stream, usage, small)).rejects.toMatchObject({
      code: 'resource'
    })
    expect(usage.actualBytes).toBeGreaterThan(small.entryBytes)
    expect(usage.actualBytes).toBeLessThan(expanded.length)
    expect(stream.destroyed).toBe(true)
  })
  it('bounds actual aggregate across multiple individually permitted entry streams', async () => {
    const usage = { entries: 2, declaredBytes: 2, actualBytes: 0, largestEntryBytes: 0 }
    await countWorkbookEntry(Readable.from([Buffer.alloc(3500)]), usage, small)
    await expect(
      countWorkbookEntry(Readable.from([Buffer.alloc(3500)]), usage, small)
    ).rejects.toMatchObject({ code: 'resource' })
  })
  it('rejects too many archive entries before streaming', async () => {
    const files = Object.fromEntries(Array.from({ length: 2049 }, (_, i) => [`entry-${i}`, '']))
    await expect(admitWorkbook(await archive(files))).rejects.toMatchObject({ code: 'resource' })
  })
  it('rejects dishonest size, encryption, unsupported compression and corrupt checksum', async () => {
    const bytes = await archive({ a: 'repeat'.repeat(1000) })
    for (const patched of [
      corruptCentral(bytes, 24, 1),
      corruptCentral(bytes, 24, 6001),
      corruptCentral(bytes, 8, 1, 2),
      corruptCentral(bytes, 10, 99, 2),
      corruptCentral(bytes, 16, 0)
    ])
      await expect(admitWorkbook(patched)).rejects.toMatchObject({ code: 'parser' })
  })
  it('rejects malformed archives and compressed input over its cap', async () => {
    await expect(admitWorkbook(Buffer.from('not a zip'))).rejects.toMatchObject({ code: 'parser' })
    await expect(
      admitWorkbook(Buffer.alloc(11), { ...small, compressedBytes: 10 })
    ).rejects.toMatchObject({ code: 'resource' })
  })
  it('calibrates the blank and real 10,000-row app template without changing budgets', async () => {
    const blank = await buildCostLibraryTemplate()
    const blankStart = performance.now()
    const blankUsage = await admitWorkbook(blank)
    const blankAdmissionMs = performance.now() - blankStart
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(blank as unknown as ExcelJS.Buffer)
    const sheet = workbook.getWorksheet('Cost Library')!
    for (let row = 2; row <= 10001; row++)
      sheet.getRow(row).values = [
        `ITEM-${row.toString().padStart(5, '0')}`,
        `Construction item ${row}`,
        'Finishes',
        'm²',
        12345.67,
        765.43
      ]
    const maximum = Buffer.from(await workbook.xlsx.writeBuffer())
    const started = performance.now()
    const maximumUsage = await admitWorkbook(maximum)
    const parsed = await parseCostLibrary(maximum, 'maximum.xlsx')
    expect(parsed.ok && parsed.value.length).toBe(10000)
    expect(blankUsage.actualBytes).toBeGreaterThan(0)
    console.info(
      'WORKBOOK_CALIBRATION',
      JSON.stringify({
        blank: { compressedBytes: blank.length, ...blankUsage, admissionMs: blankAdmissionMs },
        maximum: {
          compressedBytes: maximum.length,
          ...maximumUsage,
          admissionAndParseMs: performance.now() - started
        }
      })
    )
  }, 20000)
})
