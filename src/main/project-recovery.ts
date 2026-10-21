import { mkdir, readFile, readdir, rename, open, unlink, stat, access, constants } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { trustedIpcHandle, type TrustedSender } from './app-identity'
import { parseProjectMetadata } from './project-storage'
import { sha256Buffer } from './project-io'
import type { RecoveryCandidate, RecoveryWrite, RecoveryListResult, RecoveryReadResult, RecoveryWriteResult, RecoveryDeleteResult } from '../shared/reliability'
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
interface Manifest { version: 1; session: string; revision: number; sourcePath: string | null; lastSavedAt: number | null; capturedAt: string; projectJson: string; pdfHash: string }
function validId(id: unknown): asserts id is string { if (typeof id !== 'string' || !ID.test(id)) throw new Error('Unknown recovery copy.') }
function candidate(m: Manifest): RecoveryCandidate {
  const data = JSON.parse(m.projectJson)
  return { id: m.session, session: m.session, revision: m.revision, filename: data.pdf.originalFilename,
    sourcePath: m.sourcePath, lastSavedAt: m.lastSavedAt, capturedAt: m.capturedAt, restorable: true }
}
/** App-owned completed manifests; a new instance reopens the same durable repository. */
export class RecoveryRepository {
  readonly root: string
  private queue: Promise<unknown> = Promise.resolve()
  constructor(userData: string) { this.root = join(userData, 'recovery') }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => {}).then(operation); this.queue = result; return result
  }
  private async durable(path: string, bytes: Uint8Array): Promise<void> {
    const file = await open(path, 'wx')
    try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
  }
  private async manifest(id: string): Promise<Manifest> {
    validId(id)
    const m = JSON.parse(await readFile(join(this.root, `${id}.json`), 'utf8')) as Manifest
    if (m.version !== 1 || m.session !== id || !Number.isSafeInteger(m.revision) || m.revision < 0 || !/^[a-f0-9]{64}$/.test(m.pdfHash)) throw new Error('Damaged recovery metadata.')
    if (parseProjectMetadata(m.projectJson).pdf.sha256 !== m.pdfHash) throw new Error('Damaged recovery metadata.')
    return m
  }
  private async bytes(m: Manifest): Promise<Buffer> {
    const bytes = await readFile(join(this.root, `${m.pdfHash}.pdf`))
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || sha256Buffer(bytes) !== m.pdfHash) throw new Error('The recovery PDF is missing or damaged. This copy cannot be opened safely.')
    return bytes
  }
  list(): Promise<RecoveryListResult> { return this.serial(async () => {
    try {
      await mkdir(this.root, { recursive: true })
      const candidates: RecoveryCandidate[] = []
      for (const file of await readdir(this.root)) {
        if (!file.endsWith('.json') || !ID.test(file.slice(0, -5))) continue
        const id = file.slice(0, -5)
        try { const m = await this.manifest(id); await this.bytes(m); candidates.push(candidate(m)) }
        catch { candidates.push({ id, session: id, revision: -1, filename: 'Unsaved project', sourcePath: null, lastSavedAt: null, capturedAt: (await stat(join(this.root, file))).mtime.toISOString(), restorable: false, problem: 'metadata' }) }
      }
      return { ok: true, candidates: candidates.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)) }
    } catch { return { ok: false, stage: 'scan', message: 'Recovery copies could not be checked. Try again later.' } }
  }) }
  write(input: unknown): Promise<RecoveryWriteResult> { return this.serial(async () => {
    let temp: string | undefined
    try {
      const i = input as RecoveryWrite
      validId(i?.session)
      if (!Number.isSafeInteger(i.revision) || i.revision < 0 || !(i.pdfBytes instanceof Uint8Array) || typeof i.projectJson !== 'string' || (i.sourcePath !== null && typeof i.sourcePath !== 'string')) throw new Error('Invalid recovery snapshot.')
      const data = parseProjectMetadata(i.projectJson), pdfHash = sha256Buffer(i.pdfBytes)
      if (data.pdf.sha256 !== pdfHash || Buffer.from(i.pdfBytes.subarray(0, 5)).toString() !== '%PDF-') throw new Error('Recovery PDF integrity validation failed.')
      await mkdir(this.root, { recursive: true })
      const m: Manifest = { version: 1, session: i.session, revision: i.revision, sourcePath: i.sourcePath, lastSavedAt: i.lastSavedAt, capturedAt: new Date().toISOString(), projectJson: i.projectJson, pdfHash }
      const blob = join(this.root, `${pdfHash}.pdf`)
      try { await access(blob) } catch {
        temp = join(this.root, `${randomUUID()}.stage`); await this.durable(temp, i.pdfBytes); await rename(temp, blob); temp = undefined
      }
      await this.bytes(m)
      temp = join(this.root, `${randomUUID()}.stage`)
      await this.durable(temp, Buffer.from(JSON.stringify(m)))
      await rename(temp, join(this.root, `${i.session}.json`)); temp = undefined
      return { ok: true, candidate: candidate(m), unchanged: false }
    } catch (error) { return { ok: false, stage: 'write', message: error instanceof Error ? error.message : String(error) } }
    finally { if (temp) await unlink(temp).catch(() => {}) }
  }) }
  read(id: string): Promise<RecoveryReadResult> { return this.serial(async () => {
    try { const m = await this.manifest(id); return { ok: true, candidate: candidate(m), projectJson: m.projectJson, pdfBytes: new Uint8Array(await this.bytes(m)) } }
    catch (error) { return { ok: false, stage: 'read', message: error instanceof Error ? error.message : String(error) } }
  }) }
  delete(id: string): Promise<RecoveryDeleteResult> { return this.serial(async () => {
    try { validId(id); await unlink(join(this.root, `${id}.json`)); return { ok: true } }
    catch { return { ok: false, stage: 'delete', message: 'Could not delete the recovery copy. It has been kept. Try again later.' } }
  }) }
  retire(session: string, revision: number): Promise<RecoveryDeleteResult> { return this.serial(async () => {
    try { const m = await this.manifest(session); if (m.revision === revision) await unlink(join(this.root, `${session}.json`)); return { ok: true } }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true }; return { ok: false, stage: 'delete', message: 'Recovery copy has been kept.' } }
  }) }
}
export function registerRecoveryHandlers(userData: string, assertTrusted: TrustedSender): void {
  const repository = new RecoveryRepository(userData), handle = trustedIpcHandle(ipcMain, assertTrusted)
  handle('recovery:list', () => repository.list())
  handle('recovery:write', (_event, input) => repository.write(input))
  handle('recovery:read', (_event, id) => repository.read(id))
  handle('recovery:delete', (_event, id) => repository.delete(id))
  handle('recovery:retire', (_event, session, revision) => repository.retire(session, revision))
  handle('recovery:destinationWritable', async (_event, path) => {
    if (typeof path !== 'string' || !path || path.includes('\0')) return false
    try { await access(path, constants.W_OK); await access(dirname(path), constants.W_OK); return true } catch { return false }
  })
}
