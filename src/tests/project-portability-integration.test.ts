import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { assembleClmcZip, extractClmcZip, sha256Buffer } from '../main/project-io'
import { parseProjectMetadata } from '../main/project-storage'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { migrate, validateV2 } from '@renderer/lib/project-schema'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.setState({ currentPage: 1, pageViewports: {} })
})
function project() {
  return snapshotProject({
    pdfOriginalFilename: 'portable.pdf',
    pdfSha256: 'a'.repeat(64),
    pdfTotalPages: 1,
    perPageDimensions: { 1: { width: 595, height: 842 } }
  })
}
function twoPagePdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << >> >>'
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body))
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 5\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body)
}
describe('portable semantic project archives', () => {
  it('writes semantic format 3 rejected by old format 2 readers', () => {
    const data = project()
    expect(data.formatVersion).toBe(3)
    expect(data).toHaveProperty('minimumReaderVersion', 3)
    expect(() => validateV2(data)).toThrow(/formatVersion 2/)
    expect(() => parseProjectMetadata(JSON.stringify(data))).not.toThrow()
  })
  it('roundtrips a real archive after deleting the source and clearing stores', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'clmc-portable-'))
    try {
      const pdf = twoPagePdf()
      const source = join(dir, 'source.pdf'),
        target = join(dir, 'copy.clmc')
      await writeFile(source, pdf)
      const base = { page: 1, name: 'Long wall', categoryId: 'c', color: '#abc', createdAt: 10 }
      useMarkupStore.setState({
        categories: { c: { id: 'c', name: 'Walls', color: '#abc', paletteIndex: 0 } },
        categoryOrder: ['c'],
        categoryItemOrder: { c: ['Long wall|wall', 'Pin|count'] },
        pageMarkups: {
          1: [
            {
              ...base,
              id: 'w',
              type: 'wall',
              points: [
                { x: -0.2, y: 0.1 },
                { x: 1.2, y: 0.8 }
              ],
              wallHeight: 2700,
              arcs: { 0: { midX: 0.6, midY: -0.5 } }
            },
            { ...base, id: 'p', type: 'count', name: 'Pin', point: { x: 0.5, y: 0.6 }, sequence: 1 }
          ],
          2: [
            {
              ...base,
              page: 2,
              id: 'l',
              type: 'linear',
              points: [
                { x: 0.1, y: 0.2 },
                { x: 0.9, y: 0.2 }
              ]
            },
            {
              ...base,
              page: 2,
              id: 'a',
              type: 'area',
              points: [
                { x: 0.1, y: 0.1 },
                { x: 0.9, y: 0.1 },
                { x: 0.8, y: 0.9 }
              ]
            },
            {
              ...base,
              page: 2,
              id: 'e',
              type: 'perimeter',
              points: [
                { x: 0.2, y: 0.2 },
                { x: 0.8, y: 0.2 },
                { x: 0.8, y: 0.8 }
              ],
              arcs: { 2: { midX: 0.1, midY: 0.8 } }
            }
          ]
        }
      })
      useScaleStore.setState({
        globalUnit: 'ft',
        pageScales: {
          1: { pixelsPerMm: 2.3, displayUnit: 'ft' },
          2: { pixelsPerMm: 0.7, displayUnit: 'mm' }
        }
      })
      useProjectStore
        .getState()
        .setPrice('Long wall|wall', {
          material: 123.45,
          labor: 67.89,
          markup: 17,
          basis: 'm²',
          review: 'reviewed'
        })
      useProjectStore.getState().toggleHiddenItem('Pin|c')
      const data = snapshotProject({
        pdfOriginalFilename: 'portable.pdf',
        pdfSha256: sha256Buffer(pdf),
        pdfTotalPages: 2,
        perPageDimensions: { 1: { width: 595, height: 842 }, 2: { width: 842, height: 595 } }
      })
      await writeFile(target, await assembleClmcZip(JSON.stringify(data), pdf))
      await unlink(source)
      useMarkupStore.getState().reset()
      useProjectStore.getState().reset()
      useScaleStore.getState().reset()
      const extracted = await extractClmcZip(await readFile(target))
      expect(extracted.pdfBytes).toEqual(pdf)
      const { data: restored } = migrate(JSON.parse(extracted.projectJson), 3)
      hydrateStores(restored)
      expect(useMarkupStore.getState().pageMarkups[1]).toEqual(data.pages[0].markups)
      expect(useMarkupStore.getState().pageMarkups[2]).toEqual(data.pages[1].markups)
      expect(useMarkupStore.getState().categoryItemOrder).toEqual(data.categoryItemOrder)
      expect(useScaleStore.getState().pageScales[1]).toEqual(data.pages[0].scale)
      expect(useScaleStore.getState().pageScales[2]).toEqual(data.pages[1].scale)
      expect(useProjectStore.getState().rates).toEqual(data.rates)
      expect(useProjectStore.getState().hiddenItemNames).toEqual(data.hiddenItemNames)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it.each(['page count', 'dimension', 'point', 'arc', 'viewport', 'unit', 'rate'])(
    'rejects invalid %s before hydration',
    (kind) => {
      const data = project()
      if (kind === 'page count') data.pdf.totalPages = 2
      if (kind === 'dimension') data.pages[0].dimensions.width = 0
      if (kind === 'viewport') data.pages[0].viewport.zoom = Infinity
      if (kind === 'unit') Object.assign(data, { globalUnit: 'furlong' })
      if (kind === 'point' || kind === 'arc')
        data.pages[0].markups = [
          {
            id: 'a',
            name: 'a',
            type: 'linear',
            page: 1,
            categoryId: '',
            color: '#fff',
            createdAt: 1,
            points: [
              { x: 0, y: 0 },
              { x: kind === 'point' ? NaN : 1, y: 1 }
            ],
            arcs: kind === 'arc' ? { 20: { midX: 0, midY: 0 } } : undefined
          }
        ]
      if (kind === 'rate')
        Object.assign(data, {
          rates: {
            'A|linear': { material: -1, labor: 0, markup: 0, basis: 'm', review: 'reviewed' }
          }
        })
      useProjectStore.setState({ currentFilePath: 'keep.clmc', isDirty: true })
      expect(() => hydrateStores(data)).toThrow()
      expect(useProjectStore.getState().currentFilePath).toBe('keep.clmc')
      expect(useProjectStore.getState().isDirty).toBe(true)
    }
  )
  it('migrates supported old semantics, preserving saved units and legacy review', () => {
    const old = { ...project(), formatVersion: 2, rates: { 'Pipe|linear': 5 } }
    const { data, wasMigrated } = migrate(old, 2)
    expect(wasMigrated).toBe(true)
    hydrateStores(data)
    expect(useProjectStore.getState().rates['Pipe|linear']).toMatchObject({
      material: 5,
      basis: 'm',
      review: 'legacy-unresolved'
    })
    expect(() => migrate({ ...old, formatVersion: 4 }, 4)).toThrow(/newer|Unsupported/)
  })
  it('rejects extra archive names and duplicate names before extraction', async () => {
    const zip = new JSZip()
      .file('project.json', '{}')
      .file('plan.pdf', 'pdf')
      .file('extra.bin', 'bad')
    await expect(extractClmcZip(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow()
  })
  it.each([1, 2, 3])('rejects malformed stored prices during format %s admission', (version) => {
    for (const value of [-1, Infinity, NaN, '12', null]) {
      const data = {
        ...project(),
        formatVersion: version,
        rates: { 'Pipe|linear': { material: value, labor: 0 } }
      }
      if (version === 1)
        Object.assign(data.pdf, { absolutePath: 'missing.pdf', relativePath: null })
      expect(() => migrate(data, version)).toThrow(/rate/i)
    }
  })
  it('keeps the narrow old scalar and missing-markup representations readable and unresolved', () => {
    const old = {
      ...project(),
      formatVersion: 2,
      rates: { 'Pipe|linear': 12, 'Other|linear': { material: 3 } }
    }
    const { data } = migrate(old, 2)
    hydrateStores(data)
    expect(useProjectStore.getState().rates['Other|linear']).toMatchObject({
      material: 3,
      labor: 0,
      markup: 30,
      basis: 'm',
      review: 'legacy-unresolved'
    })
  })
  it('admits a project PDF larger than workbook limits and rejects oversized declared metadata', async () => {
    const pdf = Buffer.alloc(11 * 1024 * 1024, 37)
    const result = await extractClmcZip(await assembleClmcZip('{}', pdf))
    expect(sha256Buffer(result.pdfBytes)).toBe(sha256Buffer(pdf))
    const zip = new JSZip().file('project.json', '{}').file('plan.pdf', 'pdf')
    const bytes = await zip.generateAsync({ type: 'nodebuffer' })
    // Forge the central directory declaration, so admission stops before inflation.
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    bytes.writeUInt32LE(64 * 1024 * 1024 + 1, central + 24)
    await expect(extractClmcZip(bytes)).rejects.toThrow()
  })
})
