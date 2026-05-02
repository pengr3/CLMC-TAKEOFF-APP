import { describe, it, expect } from 'vitest'
import { promises as fsP } from 'fs'
import { resolve } from 'path'
import JSZip from 'jszip'
import {
  sha256File,
  enforceClmcExtension,
  enforceXlsxExtension,
  enforceCsvExtension,
  sha256Buffer,
  verifySha256,
  detectClmcFormat,
  assembleClmcZip,
  extractClmcZip,
  type ClmcFormat
} from '../main/project-io'

const FIXTURE = resolve(__dirname, 'fixtures/sample-1page.pdf')

describe('project-io', () => {
  it('sha256 stream equals buffer (deterministic hash for fixture PDF)', async () => {
    const h1 = await sha256File(FIXTURE)
    const h2 = await sha256File(FIXTURE)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
    expect(h1).toBe(h2)
  })

  it('enforces .clmc extension — appends when missing', () => {
    expect(enforceClmcExtension('C:/proj/plans')).toBe('C:/proj/plans.clmc')
    expect(enforceClmcExtension('C:/proj/plans.clmc')).toBe('C:/proj/plans.clmc')
    expect(enforceClmcExtension('C:/proj/PLANS.CLMC')).toBe('C:/proj/PLANS.CLMC')
  })

  it('enforces .xlsx extension — appends when missing, idempotent, case-insensitive', () => {
    expect(enforceXlsxExtension('C:/proj/plans')).toBe('C:/proj/plans.xlsx')
    expect(enforceXlsxExtension('C:/proj/plans.xlsx')).toBe('C:/proj/plans.xlsx')
    expect(enforceXlsxExtension('C:/proj/PLANS.XLSX')).toBe('C:/proj/PLANS.XLSX')
  })

  it('enforces .csv extension — appends when missing, idempotent, case-insensitive', () => {
    expect(enforceCsvExtension('C:/proj/plans')).toBe('C:/proj/plans.csv')
    expect(enforceCsvExtension('C:/proj/plans.csv')).toBe('C:/proj/plans.csv')
    expect(enforceCsvExtension('C:/proj/PLANS.CSV')).toBe('C:/proj/PLANS.CSV')
  })
})

describe('project-io v2 — Buffer hashing', () => {
  it('sha256Buffer returns same hex hash as sha256File for identical bytes', async () => {
    const fileHash = await sha256File(FIXTURE)
    const buf = await fsP.readFile(FIXTURE)
    expect(sha256Buffer(buf)).toBe(fileHash)
  })

  it('sha256Buffer accepts Uint8Array (not just Node Buffer)', async () => {
    const buf = await fsP.readFile(FIXTURE)
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    const fileHash = await sha256File(FIXTURE)
    expect(sha256Buffer(u8)).toBe(fileHash)
  })

  it('sha256Buffer returns 64-char lowercase hex', () => {
    const hash = sha256Buffer(Buffer.from('hello'))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifySha256 returns true when buffer hash matches expected hex (review suggestion)', async () => {
    const buf = await fsP.readFile(FIXTURE)
    const fileHash = await sha256File(FIXTURE)
    expect(verifySha256(buf, fileHash)).toBe(true)
  })

  it('verifySha256 returns false when buffer hash does not match expected hex', async () => {
    const buf = await fsP.readFile(FIXTURE)
    const wrongHash = '0'.repeat(64)
    expect(verifySha256(buf, wrongHash)).toBe(false)
  })
})

describe('project-io v2 — format detection', () => {
  it('detectClmcFormat returns "v2-zip" for PK\\x03\\x04 prefix', () => {
    const zipPrefix = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    expect(detectClmcFormat(zipPrefix)).toBe('v2-zip')
  })

  it('detectClmcFormat returns "v1-json" for plain JSON starting with {', () => {
    expect(detectClmcFormat(Buffer.from('{"formatVersion":1}'))).toBe('v1-json')
  })

  it('detectClmcFormat returns "unknown" for empty buffer', () => {
    expect(detectClmcFormat(Buffer.from([]))).toBe('unknown')
  })

  it('detectClmcFormat returns "unknown" for 3-byte truncated input', () => {
    expect(detectClmcFormat(Buffer.from([0x50, 0x4b, 0x03]))).toBe('unknown')
  })
})

describe('project-io v2 — ZIP assemble/extract', () => {
  it('assemble + extract round-trip preserves project.json text and pdf bytes', async () => {
    const projectJson = '{"formatVersion":2,"hello":"world"}'
    const pdfBuf = await fsP.readFile(FIXTURE)
    const zipBuf = await assembleClmcZip(projectJson, pdfBuf)
    expect(detectClmcFormat(zipBuf)).toBe('v2-zip')
    const extracted = await extractClmcZip(zipBuf)
    expect(extracted.projectJson).toBe(projectJson)
    expect(Buffer.compare(extracted.pdfBytes, pdfBuf)).toBe(0)
  })

  it('assembleClmcZip uses STORE compression (output >= pdf size)', async () => {
    const projectJson = '{}'
    const pdfBuf = await fsP.readFile(FIXTURE)
    const zipBuf = await assembleClmcZip(projectJson, pdfBuf)
    expect(zipBuf.length).toBeGreaterThanOrEqual(pdfBuf.length)
  })

  it('extractClmcZip throws when project.json entry is missing', async () => {
    const zip = new JSZip()
    zip.file('plan.pdf', await fsP.readFile(FIXTURE), { compression: 'STORE' })
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
    await expect(extractClmcZip(zipBuf)).rejects.toThrow(/project\.json/)
  })

  it('extractClmcZip throws when plan.pdf entry is missing', async () => {
    const zip = new JSZip()
    zip.file('project.json', '{}', { compression: 'STORE' })
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
    await expect(extractClmcZip(zipBuf)).rejects.toThrow(/plan\.pdf/)
  })
})
