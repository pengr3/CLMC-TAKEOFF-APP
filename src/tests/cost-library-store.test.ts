import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { CostLibraryRepository } from '../main/cost-library'
import type { CostLibrarySnapshot } from '../shared/cost-library'

let directory: string
const snapshot: CostLibrarySnapshot = {
  formatVersion: 1,
  sourceFilename: 'master.xlsx',
  importedAt: '2026-10-21T00:00:00.000Z',
  items: [
    { code: 'A1', description: 'Paint', category: 'Finishes', unit: 'm²', material: 100, labor: 80 }
  ]
}
beforeEach(async () => {
  directory = await fs.mkdtemp(join(tmpdir(), 'clmc-library-test-'))
})
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

describe('offline library repository', () => {
  it('starts empty and survives repository recreation without a source spreadsheet', async () => {
    const repository = new CostLibraryRepository(directory)
    expect(await repository.load()).toEqual({ ok: true, value: null })
    expect(await repository.replace(snapshot)).toEqual({ ok: true, value: snapshot })
    expect(await new CostLibraryRepository(directory).load()).toEqual({ ok: true, value: snapshot })
    expect(await fs.readdir(directory)).toEqual(['cost-library-v1.json'])
  })
  it('fully replaces accepted data, without merging stale entries', async () => {
    const repository = new CostLibraryRepository(directory)
    await repository.replace(snapshot)
    const next = {
      ...snapshot,
      sourceFilename: 'revision.csv',
      items: [{ ...snapshot.items[0], code: 'B2', material: 200 }]
    }
    await repository.replace(next)
    expect(await repository.load()).toEqual({ ok: true, value: next })
  })
  it('rejects invalid replacement and preserves old bytes', async () => {
    const repository = new CostLibraryRepository(directory)
    await repository.replace(snapshot)
    expect(
      (await repository.replace({ ...snapshot, items: [{ ...snapshot.items[0], material: -1 }] }))
        .ok
    ).toBe(false)
    expect(await repository.load()).toEqual({ ok: true, value: snapshot })
  })
  it('retains previous data after a failed rename and cleans the temporary file', async () => {
    await new CostLibraryRepository(directory).replace(snapshot)
    const io = { ...fs, rename: vi.fn().mockRejectedValue(new Error('locked')) }
    const failing = new CostLibraryRepository(directory, io)
    expect((await failing.replace({ ...snapshot, sourceFilename: 'new.xlsx' })).ok).toBe(false)
    expect(await failing.load()).toEqual({ ok: true, value: snapshot })
    expect(await fs.readdir(directory)).toEqual(['cost-library-v1.json'])
  })
  it('retains previous data after a failed temporary write', async () => {
    await new CostLibraryRepository(directory).replace(snapshot)
    const io = { ...fs, writeFile: vi.fn().mockRejectedValue(new Error('full')) }
    expect((await new CostLibraryRepository(directory, io).replace(snapshot)).ok).toBe(false)
    expect(await new CostLibraryRepository(directory).load()).toEqual({ ok: true, value: snapshot })
  })
  it('preserves corrupt files and allows explicit reimport to recover', async () => {
    const path = join(directory, 'cost-library-v1.json')
    await fs.writeFile(path, 'not-json')
    const repository = new CostLibraryRepository(directory)
    expect((await repository.load()).ok).toBe(false)
    expect(await fs.readFile(path, 'utf8')).toBe('not-json')
    await repository.replace(snapshot)
    expect(await repository.load()).toEqual({ ok: true, value: snapshot })
  })
})
