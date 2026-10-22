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
  return snapshotProject({ pdfOriginalFilename: 'portable.pdf', pdfSha256: 'a'.repeat(64), pdfTotalPages: 1,
    perPageDimensions: { 1: { width: 595, height: 842 } } })
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
      const pdf = await readFile(join(__dirname, 'fixtures/sample-1page.pdf'))
      const source = join(dir, 'source.pdf'), target = join(dir, 'copy.clmc')
      await writeFile(source, pdf)
      const base = { page: 1, name: 'Long wall', categoryId: 'c', color: '#abc', createdAt: 10 }
      useMarkupStore.setState({ categories: { c: { id: 'c', name: 'Walls', color: '#abc', paletteIndex: 0 } },
        categoryOrder: ['c'], categoryItemOrder: { c: ['Long wall|wall', 'Pin|count'] },
        pageMarkups: { 1: [{ ...base, id: 'w', type: 'wall', points: [{ x: -0.2, y: 0.1 }, { x: 1.2, y: 0.8 }],
          wallHeight: 2700, arcs: { 0: { midX: 0.6, midY: -0.5 } } },
          { ...base, id: 'p', type: 'count', name: 'Pin', point: { x: 0.5, y: 0.6 }, sequence: 1 }] } })
      useScaleStore.setState({ globalUnit: 'ft', pageScales: { 1: { pixelsPerMm: 2.3, displayUnit: 'ft' } } })
      useProjectStore.getState().setPrice('Long wall|wall', { material: 123.45, labor: 67.89, markup: 17, basis: 'm²', review: 'reviewed' })
      useProjectStore.getState().toggleHiddenItem('Pin|c')
      const data = { ...project(), pdf: { ...project().pdf, sha256: sha256Buffer(pdf) } }
      await writeFile(target, await assembleClmcZip(JSON.stringify(data), pdf))
      await unlink(source)
      useMarkupStore.getState().reset(); useProjectStore.getState().reset(); useScaleStore.getState().reset()
      const extracted = await extractClmcZip(await readFile(target))
      expect(extracted.pdfBytes).toEqual(pdf)
      const { data: restored } = migrate(JSON.parse(extracted.projectJson), 3)
      hydrateStores(restored)
      expect(useMarkupStore.getState().pageMarkups[1]).toEqual(data.pages[0].markups)
      expect(useMarkupStore.getState().categoryItemOrder).toEqual(data.categoryItemOrder)
      expect(useScaleStore.getState().pageScales[1]).toEqual(data.pages[0].scale)
      expect(useProjectStore.getState().rates).toEqual(data.rates)
      expect(useProjectStore.getState().hiddenItemNames).toEqual(data.hiddenItemNames)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it.each(['page count', 'dimension', 'point', 'arc', 'viewport', 'unit', 'rate'])('rejects invalid %s before hydration', (kind) => {
    const data = project()
    if (kind === 'page count') data.pdf.totalPages = 2
    if (kind === 'dimension') data.pages[0].dimensions.width = 0
    if (kind === 'viewport') data.pages[0].viewport.zoom = Infinity
    if (kind === 'unit') Object.assign(data, { globalUnit: 'furlong' })
    if (kind === 'point' || kind === 'arc') data.pages[0].markups = [{ id: 'a', name: 'a', type: 'linear', page: 1, categoryId: '', color: '#fff', createdAt: 1,
      points: [{ x: 0, y: 0 }, { x: kind === 'point' ? NaN : 1, y: 1 }], arcs: kind === 'arc' ? { 20: { midX: 0, midY: 0 } } : undefined }]
    if (kind === 'rate') Object.assign(data, { rates: { 'A|linear': { material: -1, labor: 0, markup: 0, basis: 'm', review: 'reviewed' } } })
    useProjectStore.setState({ currentFilePath: 'keep.clmc', isDirty: true })
    expect(() => hydrateStores(data)).toThrow()
    expect(useProjectStore.getState().currentFilePath).toBe('keep.clmc')
    expect(useProjectStore.getState().isDirty).toBe(true)
  })
  it('migrates supported old semantics, preserving saved units and legacy review', () => {
    const old = { ...project(), formatVersion: 2, rates: { 'Pipe|linear': 5 } }
    const { data, wasMigrated } = migrate(old, 2)
    expect(wasMigrated).toBe(true)
    hydrateStores(data)
    expect(useProjectStore.getState().rates['Pipe|linear']).toMatchObject({ material: 5, basis: 'm', review: 'legacy-unresolved' })
    expect(() => migrate({ ...old, formatVersion: 4 }, 4)).toThrow(/newer|Unsupported/)
  })
  it('rejects extra archive names and duplicate names before extraction', async () => {
    const zip = new JSZip().file('project.json', '{}').file('plan.pdf', 'pdf').file('extra.bin', 'bad')
    await expect(extractClmcZip(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow()
  })
})
