/** @vitest-environment node */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
vi.mock('fs/promises', async (original) => {
  const real = await original<typeof import('fs/promises')>()
  return {
    ...real,
    open: vi.fn(real.open),
    readFile: vi.fn(real.readFile),
    rename: vi.fn(real.rename),
    unlink: vi.fn(real.unlink)
  }
})
interface HandlerResult {
  ok?: boolean
  stage?: string
  firstSave?: boolean
  kind?: string
  backupPath?: string
}
const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<HandlerResult>>
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, fn: (...args: unknown[]) => Promise<HandlerResult>) => {
      handlers[key] = fn
    }
  },
  dialog: {},
  BrowserWindow: {}
}))
import * as fs from 'fs/promises'
import { registerIpcHandlers } from '../main/ipc-handlers'
import { assembleClmcZip, extractClmcZip, sha256Buffer } from '../main/project-io'
const real = await vi.importActual<typeof import('fs/promises')>('fs/promises')
const pdf = new Uint8Array([37, 80, 68, 70, 45, 49])
const json = (revision: number): string =>
  JSON.stringify({
    formatVersion: 2,
    revision,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    pdf: { originalFilename: 'plan.pdf', totalPages: 1, sha256: sha256Buffer(pdf) },
    categories: {},
    categoryOrder: [],
    globalUnit: 'mm',
    currentPage: 1,
    pages: [
      {
        pageIndex: 1,
        dimensions: { width: 600, height: 800 },
        scale: null,
        viewport: { zoom: 1, panX: 0, panY: 0 },
        markups: []
      }
    ]
  })
let directory: string, path: string, original: Buffer, backup: Buffer
beforeEach(async () => {
  vi.mocked(fs.open).mockImplementation(real.open)
  vi.mocked(fs.readFile).mockImplementation(real.readFile)
  vi.mocked(fs.rename).mockImplementation(real.rename)
  vi.mocked(fs.unlink).mockImplementation(real.unlink)
  directory = await real.mkdtemp(join(tmpdir(), 'clmc-protected-'))
  path = join(directory, 'project.clmc')
  original = await assembleClmcZip(json(2), Buffer.from(pdf))
  backup = await assembleClmcZip(json(1), Buffer.from(pdf))
  await real.writeFile(path, original)
  await real.writeFile(path + '.bak', backup)
  registerIpcHandlers(() => {})
})
afterEach(async () => {
  await real.rm(directory, { recursive: true, force: true })
})
const fail = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

it.each(['write', 'sync', 'close', 'validate', 'backup-write', 'backup-rename', 'replace'])(
  'preserves recoverable originals through injected %s failure',
  async (point) => {
    if (['write', 'sync', 'close', 'backup-write'].includes(point)) {
      vi.mocked(fs.open).mockImplementation(async (...args) => {
        const handle = await real.open(...args)
        const isBackup = String(args[0]).endsWith('.bak.tmp')
        if ((point === 'backup-write') !== isBackup) return handle
        if (point === 'write' || point === 'backup-write')
          handle.writeFile = vi.fn().mockRejectedValue(fail('ENOSPC'))
        if (point === 'sync') handle.sync = vi.fn().mockRejectedValue(fail('EIO'))
        if (point === 'close') {
          const close = handle.close.bind(handle)
          handle.close = async () => {
            await close()
            throw fail('EIO')
          }
        }
        return handle
      })
    }
    if (point === 'validate')
      vi.mocked(fs.readFile).mockImplementation(async (...args) =>
        String(args[0]).endsWith('.tmp') ? Buffer.from('damaged') : real.readFile(...args)
      )
    if (point === 'backup-rename' || point === 'replace')
      vi.mocked(fs.rename).mockImplementation(async (from, to) => {
        if (String(to) === (point === 'replace' ? path : path + '.bak')) throw fail('EPERM')
        return real.rename(from, to)
      })
    const result = await handlers['file:writeProject']({}, path, json(3), pdf)
    expect(result.ok).toBe(false)
    expect(result.stage).toBe(
      point.startsWith('backup')
        ? 'backup'
        : point === 'replace'
          ? 'replace'
          : point === 'validate'
            ? 'validate'
            : 'write'
    )
    expect(await real.readFile(path)).toEqual(original)
    const keptBackup = await real.readFile(path + '.bak')
    expect([original, backup].some((bytes) => bytes.equals(keptBackup))).toBe(true)
    expect(JSON.parse((await extractClmcZip(keptBackup)).projectJson).pdf.sha256).toBe(
      sha256Buffer(pdf)
    )
    expect((await real.readdir(directory)).sort()).toEqual(['project.clmc', 'project.clmc.bak'])
  }
)

it('advertises only an integrity-validated adjacent backup after a damaged original', async () => {
  await real.writeFile(path, 'broken original')
  const result = await handlers['file:readProject']({}, path)
  expect(result).toMatchObject({ kind: 'unknown', backupPath: path + '.bak' })
  const bad = await assembleClmcZip(json(1), Buffer.from('wrong PDF'))
  await real.writeFile(path + '.bak', bad)
  expect((await handlers['file:readProject']({}, path)).backupPath).toBeUndefined()
})

it('does not replace a good backup with a corrupt original', async () => {
  await real.writeFile(path, 'corrupt')
  expect(await handlers['file:writeProject']({}, path, json(3), pdf)).toEqual({ ok: true })
  expect(await real.readFile(path + '.bak')).toEqual(backup)
})

it('reports a failed first save without inventing a backup', async () => {
  await real.unlink(path)
  await real.unlink(path + '.bak')
  vi.mocked(fs.open).mockRejectedValue(fail('EACCES'))
  expect(await handlers['file:writeProject']({}, path, json(3), pdf)).toMatchObject({
    ok: false,
    stage: 'write',
    firstSave: true
  })
  expect(await real.readdir(directory)).toEqual([])
})

it('ignores incomplete crash temps after restart and preserves them as unowned data', async () => {
  await real.writeFile(path, 'bad original')
  await real.writeFile(path + '.crashed.tmp', 'partial')
  expect(await handlers['file:readProject']({}, path)).toMatchObject({
    kind: 'unknown',
    backupPath: path + '.bak'
  })
  expect(await handlers['file:writeProject']({}, path, json(3), pdf)).toEqual({ ok: true })
  expect(await real.readFile(path + '.crashed.tmp', 'utf8')).toBe('partial')
})

it('allows independent destinations to progress while another writer is blocked', async () => {
  let release!: () => void, entered!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  vi.mocked(fs.open).mockImplementation(async (...args) => {
    if (String(args[0]).startsWith(path + '.')) {
      entered()
      await new Promise<void>((resolve) => {
        release = resolve
      })
    }
    return real.open(...args)
  })
  const first = handlers['file:writeProject']({}, path, json(3), pdf)
  await started
  // Only the first open is paused; the backup stage must be allowed later.
  vi.mocked(fs.open).mockImplementation(real.open)
  const otherPath = join(directory, 'independent.clmc')
  expect(await handlers['file:writeProject']({}, otherPath, json(4), pdf)).toEqual({ ok: true })
  release()
  expect(await first).toEqual({ ok: true })
})

it('refuses malformed project metadata even when the embedded PDF hash matches', async () => {
  const malformed = JSON.stringify({ formatVersion: 2, pdf: { sha256: sha256Buffer(pdf) } })
  expect(await handlers['file:writeProject']({}, path, malformed, pdf)).toMatchObject({
    ok: false,
    stage: 'validate'
  })
  expect(await real.readFile(path)).toEqual(original)
})

it.each(['missing', 'corrupt'] as const)(
  'preserves %s originals across write, validation and replacement faults',
  async (state) => {
    for (const point of ['write', 'sync', 'close', 'validate', 'replace']) {
      vi.mocked(fs.open).mockImplementation(real.open)
      vi.mocked(fs.readFile).mockImplementation(real.readFile)
      vi.mocked(fs.rename).mockImplementation(real.rename)
      if (state === 'missing') {
        await real.unlink(path).catch(() => {})
        await real.unlink(path + '.bak').catch(() => {})
      } else {
        await real.writeFile(path, 'corrupt')
        await real.writeFile(path + '.bak', backup)
      }
      if (['write', 'sync', 'close'].includes(point))
        vi.mocked(fs.open).mockImplementation(async (...args) => {
          const handle = await real.open(...args)
          if (point === 'write') handle.writeFile = vi.fn().mockRejectedValue(fail('ENOSPC'))
          if (point === 'sync') handle.sync = vi.fn().mockRejectedValue(fail('EIO'))
          if (point === 'close') {
            const close = handle.close.bind(handle)
            handle.close = async () => {
              await close()
              throw fail('EIO')
            }
          }
          return handle
        })
      if (point === 'validate')
        vi.mocked(fs.readFile).mockImplementation(async (...args) =>
          String(args[0]).endsWith('.tmp') ? Buffer.from('damaged') : real.readFile(...args)
        )
      if (point === 'replace') vi.mocked(fs.rename).mockRejectedValue(fail('EACCES'))
      expect(await handlers['file:writeProject']({}, path, json(3), pdf)).toMatchObject({
        ok: false,
        firstSave: state === 'missing'
      })
      if (state === 'missing') expect(await real.readdir(directory)).toEqual([])
      else {
        expect(await real.readFile(path, 'utf8')).toBe('corrupt')
        expect(await real.readFile(path + '.bak')).toEqual(backup)
      }
    }
  }
)

it('rejects corrupt staged backups and leaves the existing original and backup untouched', async () => {
  vi.mocked(fs.readFile).mockImplementation(async (...args) =>
    String(args[0]).endsWith('.bak.tmp') ? Buffer.from('damaged backup') : real.readFile(...args)
  )
  expect(await handlers['file:writeProject']({}, path, json(3), pdf)).toMatchObject({
    ok: false,
    stage: 'backup'
  })
  expect(await real.readFile(path)).toEqual(original)
  expect(await real.readFile(path + '.bak')).toEqual(backup)
})

it('offers a valid backup for a missing original and never offers an incomplete temp', async () => {
  await real.unlink(path)
  expect(await handlers['file:readProject']({}, path)).toMatchObject({
    kind: 'unknown',
    backupPath: path + '.bak'
  })
  await real.unlink(path + '.bak')
  await real.writeFile(path + '.crashed.tmp', original)
  expect((await handlers['file:readProject']({}, path)).backupPath).toBeUndefined()
})
