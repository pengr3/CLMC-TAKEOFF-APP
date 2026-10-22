import { expect, it } from 'vitest'
import JSZip from 'jszip'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeProtectedProject } from '../main/project-storage'
import { snapshotProject } from '@renderer/lib/project-serialize'
import { sha256Buffer } from '../main/project-io'

it.each(['extra-member', 'changed-layout', 'ambiguous-layout', 'unknown-current-layout'])('preserves an existing %s archive byte for byte', async kind => {
  const dir = await mkdtemp(join(tmpdir(), 'clmc-future-preserve-'))
  try {
    const zip = new JSZip()
    zip.file(kind === 'changed-layout' ? 'metadata/project.json' : 'project.json', JSON.stringify({ formatVersion: kind.includes('layout') && kind !== 'changed-layout' ? 3 : 4, minimumReaderVersion: kind === 'unknown-current-layout' ? 3 : 4 }))
    zip.file('plan.pdf', '%PDF-1.4')
    zip.file('future-metadata.json', '{}')
    const original = await zip.generateAsync({ type: 'nodebuffer' })
    const path = join(dir, 'future.clmc')
    await writeFile(path, original)
    const pdf = Buffer.from('%PDF-1.4')
    const valid = snapshotProject({ pdfOriginalFilename: 'valid.pdf', pdfSha256: sha256Buffer(pdf), pdfTotalPages: 1, perPageDimensions: { 1: { width: 595, height: 842 } } })
    await expect(writeProtectedProject(path, JSON.stringify(valid), pdf)).rejects.toThrow(/newer|classif|unchanged|changed/i)
    expect(await readFile(path)).toEqual(original)
    await expect(readFile(path + '.bak')).rejects.toMatchObject({ code: 'ENOENT' })
  } finally { await rm(dir, { recursive: true, force: true }) }
})
