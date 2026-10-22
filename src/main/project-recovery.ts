import {
  mkdir,
  readFile,
  readdir,
  rename,
  open,
  unlink,
  lstat,
  access,
  constants
} from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { trustedIpcHandle, type TrustedSender } from './app-identity'
import { parseProjectMetadata } from './project-storage'
import { sha256Buffer } from './project-io'
import type {
  RecoveryCandidate,
  RecoveryWrite,
  RecoveryListResult,
  RecoveryReadResult,
  RecoveryWriteResult,
  RecoveryDeleteResult,
  RecoveryStage
} from '../shared/reliability'

export const RECOVERY_MAX_CANDIDATES = 20
export const RECOVERY_MAX_BYTES = 4 * 1024 ** 3
const MAX_MANIFEST_BYTES = 64 * 1024 ** 2
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const PDF_ERROR = 'The recovery PDF is missing or damaged. This copy cannot be opened safely.'
export type RecoveryFaultStage =
  | 'scan'
  | 'delete'
  | 'blob-write'
  | 'blob-flush'
  | 'blob-close'
  | 'blob-rename'
  | 'manifest-write'
  | 'manifest-flush'
  | 'manifest-close'
  | 'manifest-validate'
  | 'manifest-rename'
interface Options {
  maxCandidates?: number
  maxBytes?: number
  fault?: (stage: RecoveryFaultStage) => void | Promise<void>
}
interface Manifest {
  version: 1
  session: string
  revision: number
  sourcePath: string | null
  lastSavedAt: number | null
  capturedAt: string
  projectJson: string
  pdfHash: string
  checksum: string
}
function validId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Unknown recovery copy.')
}
function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
function checksum(m: Omit<Manifest, 'checksum'>): string {
  return sha256Buffer(Buffer.from(JSON.stringify(m)))
}
function candidate(m: Manifest): RecoveryCandidate {
  const data = JSON.parse(m.projectJson)
  return {
    id: m.session,
    session: m.session,
    revision: m.revision,
    filename: data.pdf.originalFilename,
    sourcePath: m.sourcePath,
    lastSavedAt: m.lastSavedAt,
    capturedAt: m.capturedAt,
    restorable: true
  }
}

/** All mutations and scans share one queue. Only completed manifests advertise protection. */
export class RecoveryRepository {
  readonly root: string
  private queue: Promise<unknown> = Promise.resolve()
  private retired = new Map<string, number>()
  private maxCandidates: number
  private maxBytes: number
  constructor(
    userData: string,
    private options: Options = {}
  ) {
    this.root = join(userData, 'recovery')
    this.maxCandidates = options.maxCandidates ?? RECOVERY_MAX_CANDIDATES
    this.maxBytes = options.maxBytes ?? RECOVERY_MAX_BYTES
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => {}).then(operation)
    this.queue = result
    return result
  }
  private async fault(stage: RecoveryFaultStage): Promise<void> {
    await this.options.fault?.(stage)
  }
  private async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    if (!(await lstat(this.root)).isDirectory())
      throw new Error('Invalid recovery storage directory.')
  }
  private async regular(path: string, max: number): Promise<number> {
    const info = await lstat(path)
    if (!info.isFile() || info.size > max) throw new Error('Invalid or oversized recovery file.')
    return info.size
  }
  private async durable(path: string, bytes: Uint8Array, kind: 'blob' | 'manifest'): Promise<void> {
    const file = await open(path, 'wx')
    try {
      await this.fault(`${kind}-write`)
      await file.writeFile(bytes)
      await this.fault(`${kind}-flush`)
      await file.sync()
      await this.fault(`${kind}-close`)
    } finally {
      await file.close()
    }
  }
  private async loadManifest(path: string, id: string): Promise<Manifest> {
    await this.regular(path, MAX_MANIFEST_BYTES)
    const m = JSON.parse(await readFile(path, 'utf8')) as Manifest
    if (
      !m ||
      m.version !== 1 ||
      m.session !== id ||
      !revision(m.revision) ||
      !HASH.test(m.pdfHash) ||
      typeof m.projectJson !== 'string' ||
      typeof m.capturedAt !== 'string' ||
      !Number.isFinite(Date.parse(m.capturedAt)) ||
      (m.sourcePath !== null &&
        (typeof m.sourcePath !== 'string' || !m.sourcePath || m.sourcePath.includes('\0'))) ||
      (m.lastSavedAt !== null && (!Number.isFinite(m.lastSavedAt) || m.lastSavedAt < 0))
    )
      throw new Error('Damaged recovery metadata.')
    const { checksum: stored, ...body } = m
    if (stored !== checksum(body) || parseProjectMetadata(m.projectJson).pdf.sha256 !== m.pdfHash)
      throw new Error('Damaged recovery metadata.')
    return m
  }
  private async manifest(id: string): Promise<Manifest> {
    validId(id)
    return this.loadManifest(join(this.root, `${id}.json`), id)
  }
  private async verifyBlob(m: Manifest): Promise<void> {
    try {
      const path = join(this.root, `${m.pdfHash}.pdf`)
      await this.regular(path, this.maxBytes)
      const hash = createHash('sha256')
      let first = true
      for await (const chunk of createReadStream(path)) {
        if (first && (chunk as Buffer).subarray(0, 5).toString() !== '%PDF-')
          throw new Error(PDF_ERROR)
        first = false
        hash.update(chunk)
      }
      if (first || hash.digest('hex') !== m.pdfHash) throw new Error(PDF_ERROR)
    } catch {
      throw new Error(PDF_ERROR)
    }
  }
  private async scan(): Promise<RecoveryCandidate[]> {
    await this.fault('scan')
    await this.initialize()
    const result: RecoveryCandidate[] = [],
      checked = new Map<string, boolean>()
    for (const file of await readdir(this.root)) {
      if (!file.endsWith('.json') || !ID.test(file.slice(0, -5))) continue
      const id = file.slice(0, -5)
      let entry: RecoveryCandidate
      try {
        const m = await this.manifest(id)
        entry = candidate(m)
        let valid = checked.get(m.pdfHash)
        if (valid === undefined) {
          try {
            await this.verifyBlob(m)
            valid = true
          } catch {
            valid = false
          }
          checked.set(m.pdfHash, valid)
        }
        if (!valid) entry = { ...entry, restorable: false, problem: 'pdf' }
      } catch {
        entry = {
          id,
          session: id,
          revision: -1,
          filename: 'Unsaved project',
          sourcePath: null,
          lastSavedAt: null,
          capturedAt: (await lstat(join(this.root, file))).mtime.toISOString(),
          restorable: false,
          problem: 'metadata'
        }
      }
      result.push(entry)
    }
    return result.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  }
  list(): Promise<RecoveryListResult> {
    return this.serial(async () => {
      try {
        await this.initialize()
        await this.prune()
        return { ok: true, candidates: await this.scan() }
      } catch {
        return {
          ok: false,
          stage: 'scan',
          message: 'Recovery copies could not be checked. Try again later.'
        }
      }
    })
  }
  private async usedBytes(directory = this.root): Promise<number> {
    let bytes = 0
    for (const file of await readdir(directory)) {
      const path = join(directory, file),
        info = await lstat(path)
      if (info.isSymbolicLink()) throw new Error('Invalid recovery storage link.')
      bytes += info.isDirectory() ? await this.usedBytes(path) : info.size
    }
    return bytes
  }
  /** Called only under the repository queue, with no active stage. An unreadable
   * completed manifest keeps every blob: its references cannot be disproved.
   */
  private async prune(): Promise<void> {
    try {
      const files = await readdir(this.root),
        referenced = new Set<string>()
      for (const file of files.filter((f) => f.endsWith('.json') && ID.test(f.slice(0, -5))))
        referenced.add((await this.manifest(file.slice(0, -5))).pdfHash)
      for (const file of files) {
        if (
          (file.endsWith('.pdf') &&
            HASH.test(file.slice(0, -4)) &&
            !referenced.has(file.slice(0, -4))) ||
          (file.endsWith('.stage') && ID.test(file.slice(0, -6)))
        ) {
          if ((await lstat(join(this.root, file))).isFile())
            await unlink(join(this.root, file)).catch(() => {})
        }
      }
    } catch {
      /* Cleanup failure never invalidates a completed candidate. */
    }
  }
  write(input: unknown): Promise<RecoveryWriteResult> {
    // Freeze IPC inputs before the transaction waits in the queue.
    let i: RecoveryWrite
    try {
      const value = input as RecoveryWrite
      validId(value?.session)
      if (
        !revision(value.revision) ||
        !(value.pdfBytes instanceof Uint8Array) ||
        typeof value.projectJson !== 'string' ||
        (value.sourcePath !== null &&
          (typeof value.sourcePath !== 'string' ||
            !value.sourcePath ||
            value.sourcePath.includes('\0'))) ||
        (value.lastSavedAt !== null &&
          (!Number.isFinite(value.lastSavedAt) || value.lastSavedAt < 0))
      )
        throw new Error('Invalid recovery snapshot.')
      if (
        value.pdfBytes.byteLength > this.maxBytes ||
        Buffer.byteLength(value.projectJson) > MAX_MANIFEST_BYTES / 2
      )
        throw new Error('Recovery snapshot exceeds storage limits.')
      i = { ...value, pdfBytes: value.pdfBytes.slice() }
    } catch (error) {
      return Promise.resolve({
        ok: false,
        stage: 'validate',
        message: error instanceof Error ? error.message : String(error)
      })
    }
    return this.serial(async () => {
      let temp: string | undefined,
        stage: RecoveryStage = 'validate'
      try {
        if ((this.retired.get(i.session) ?? -1) >= i.revision)
          throw new Error('This recovery revision was already saved or discarded.')
        const data = parseProjectMetadata(i.projectJson),
          pdfHash = sha256Buffer(i.pdfBytes)
        if (
          data.pdf.sha256 !== pdfHash ||
          Buffer.from(i.pdfBytes.subarray(0, 5)).toString() !== '%PDF-'
        )
          throw new Error('Recovery PDF integrity validation failed.')
        await this.initialize()
        // Reconcile crash remnants before quota charging, including on a fresh process.
        await this.prune()
        let previous: Manifest | undefined
        try {
          previous = await this.manifest(i.session)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        if (previous && previous.revision >= i.revision) {
          await this.verifyBlob(previous)
          return { ok: true, candidate: candidate(previous), unchanged: true }
        }
        const body = {
          version: 1 as const,
          session: i.session,
          revision: i.revision,
          sourcePath: i.sourcePath,
          lastSavedAt: i.lastSavedAt,
          capturedAt: new Date().toISOString(),
          projectJson: i.projectJson,
          pdfHash
        }
        const m: Manifest = { ...body, checksum: checksum(body) },
          serialized = Buffer.from(JSON.stringify(m))
        const files = await readdir(this.root),
          count = files.filter((f) => f.endsWith('.json') && ID.test(f.slice(0, -5))).length
        const blob = join(this.root, `${pdfHash}.pdf`)
        let blobExists = false
        try {
          await lstat(blob)
          blobExists = true
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        stage = 'quota'
        if (
          (!previous && count >= this.maxCandidates) ||
          (await this.usedBytes()) + serialized.length + (blobExists ? 0 : i.pdfBytes.byteLength) >
            this.maxBytes
        )
          throw new Error(
            'Recovery storage is full. Existing recovery copies have been kept. Save your project now.'
          )
        stage = 'write'
        if (!blobExists) {
          temp = join(this.root, `${randomUUID()}.stage`)
          await this.durable(temp, i.pdfBytes, 'blob')
          if (sha256Buffer(await readFile(temp)) !== pdfHash)
            throw new Error('Recovery PDF integrity validation failed.')
          await this.fault('blob-rename')
          await rename(temp, blob)
          temp = undefined
        }
        await this.verifyBlob(m)
        temp = join(this.root, `${randomUUID()}.stage`)
        await this.durable(temp, serialized, 'manifest')
        await this.fault('manifest-validate')
        await this.loadManifest(temp, i.session)
        await this.fault('manifest-rename')
        await rename(temp, join(this.root, `${i.session}.json`))
        temp = undefined
        await this.prune()
        return { ok: true, candidate: candidate(m), unchanged: false }
      } catch (error) {
        return { ok: false, stage, message: error instanceof Error ? error.message : String(error) }
      } finally {
        if (temp) await unlink(temp).catch(() => {})
        // A blob may have committed before manifest replacement failed.
        await this.prune()
      }
    })
  }
  read(id: string): Promise<RecoveryReadResult> {
    return this.serial(async () => {
      try {
        const m = await this.manifest(id)
        await this.verifyBlob(m)
        const pdfBytes = new Uint8Array(await readFile(join(this.root, `${m.pdfHash}.pdf`)))
        if (sha256Buffer(pdfBytes) !== m.pdfHash) throw new Error(PDF_ERROR)
        return { ok: true, candidate: candidate(m), projectJson: m.projectJson, pdfBytes }
      } catch (error) {
        return {
          ok: false,
          stage: 'read',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    })
  }
  destinationWritable(session: string): Promise<boolean> {
    return this.serial(async () => {
      try {
        const source = (await this.manifest(session)).sourcePath
        if (
          !source ||
          !(await lstat(source)).isFile() ||
          ((await lstat(source)).mode & 0o222) === 0
        )
          return false
        await access(source, constants.W_OK)
        await access(dirname(source), constants.W_OK)
        return true
      } catch {
        return false
      }
    })
  }
  delete(id: string, expectedRevision?: number): Promise<RecoveryDeleteResult> {
    return this.serial(async () => {
      try {
        validId(id)
        let last = -1
        try {
          last = (await this.manifest(id)).revision
        } catch {
          /* corrupt entries remain explicitly deletable */
        }
        if (expectedRevision !== undefined && expectedRevision !== last)
          throw new Error('Recovery changed. Check the list again before deleting.')
        await this.fault('delete')
        await unlink(join(this.root, `${id}.json`))
        this.retired.set(id, last)
        await this.prune()
        return { ok: true }
      } catch {
        return {
          ok: false,
          stage: 'delete',
          message: 'Could not delete the recovery copy. It has been kept. Try again later.'
        }
      }
    })
  }
  retire(session: string, capturedRevision: number): Promise<RecoveryDeleteResult> {
    return this.serial(async () => {
      try {
        validId(session)
        if (!revision(capturedRevision)) throw new Error('Invalid recovery revision.')
        let m: Manifest
        try {
          m = await this.manifest(session)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          this.retired.set(session, Math.max(this.retired.get(session) ?? -1, capturedRevision))
          return { ok: true }
        }
        if (m.revision === capturedRevision) {
          await this.fault('delete')
          await unlink(join(this.root, `${session}.json`))
          this.retired.set(session, Math.max(this.retired.get(session) ?? -1, capturedRevision))
          await this.prune()
        }
        return { ok: true }
      } catch {
        return { ok: false, stage: 'delete', message: 'Recovery copy has been kept.' }
      }
    })
  }
}
export function registerRecoveryHandlers(userData: string, assertTrusted: TrustedSender): void {
  const repository = new RecoveryRepository(userData),
    handle = trustedIpcHandle(ipcMain, assertTrusted)
  handle('recovery:list', () => repository.list())
  handle('recovery:write', (_event, input) => repository.write(input))
  handle('recovery:read', (_event, id) => repository.read(id))
  handle('recovery:delete', (_event, id, expectedRevision) => {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < -1)
      return { ok: false, stage: 'validate', message: 'Invalid recovery revision.' }
    return repository.delete(id, expectedRevision)
  })
  handle('recovery:retire', (_event, session, revision) => repository.retire(session, revision))
  handle('recovery:destinationWritable', (_event, session) =>
    repository.destinationWritable(session)
  )
}
