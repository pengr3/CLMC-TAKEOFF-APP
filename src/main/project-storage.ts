import { readFile, rename, unlink, open, realpath, stat } from 'fs/promises'
import { resolve, dirname, basename } from 'path'
import { randomUUID } from 'crypto'
import { assembleClmcZip, extractClmcZip, sha256Buffer, detectClmcFormat } from './project-io'
import { validateProjectData } from '../shared/project-validation'
const RENAME_RETRY_DELAYS_MS = [120, 250]
function isLockedDestError(error: unknown): boolean {
  return ['EPERM', 'EEXIST', 'EBUSY'].includes((error as NodeJS.ErrnoException)?.code ?? '')
}
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
export type ProjectSaveStage = 'write' | 'validate' | 'backup' | 'replace'
export type WriteProjectResult =
  | { ok: true }
  | { ok: false; stage: ProjectSaveStage; message: string; firstSave: boolean }
export class ProjectSaveError extends Error {
  constructor(
    public stage: ProjectSaveStage,
    cause: unknown,
    public firstSave: boolean
  ) {
    super(cause instanceof Error ? cause.message : String(cause))
  }
}
const projectWrites = new Map<string, Promise<void>>()
/** Disk boundary check kept independent of renderer store/type dependencies. */
export function parseProjectMetadata(json: string): { pdf: { sha256: string } } {
  const data = JSON.parse(json)
  if (data?.formatVersion > 3 || data?.minimumReaderVersion > 3) throw new Error('Project needs a newer version')
  if (
    !data ||
    ![2, 3].includes(data.formatVersion) ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    typeof data.pdf?.originalFilename !== 'string' ||
    typeof data.pdf?.sha256 !== 'string' ||
    !Number.isInteger(data.pdf?.totalPages) ||
    data.pdf.totalPages < 1 ||
    typeof data.globalUnit !== 'string' ||
    !data.categories ||
    typeof data.categories !== 'object' ||
    Array.isArray(data.categories) ||
    !Array.isArray(data.categoryOrder) ||
    !Number.isInteger(data.currentPage) ||
    !Array.isArray(data.pages)
  ) {
    throw new Error('Invalid project metadata.')
  }
  validateProjectData(data)
  return data
}

/** Resolve existing files and parent directories; stat catches hard-link aliases too. */
export async function assertCopyDestination(destination: string, preservedPaths: readonly string[]): Promise<void> {
  const canonical = async (path: string): Promise<string> => {
    const absolute = resolve(path)
    const actual = await realpath(absolute).catch(async () => resolve(await realpath(dirname(absolute)).catch(() => dirname(absolute)), basename(absolute)))
    return process.platform === 'win32' ? actual.toLowerCase() : actual
  }
  const target = await canonical(destination), targetStat = await stat(destination).catch(() => null)
  for (const path of preservedPaths) {
    const sourceStat = await stat(path).catch(() => null)
    if (target === await canonical(path) || (targetStat && sourceStat && targetStat.dev === sourceStat.dev && targetStat.ino === sourceStat.ino))
      throw new Error('Choose a different destination for the project copy. The original project and backup must be preserved.')
  }
}
async function rejectFutureOriginal(bytes: Buffer): Promise<void> {
  let raw: unknown
  try {
    raw = JSON.parse(detectClmcFormat(bytes) === 'v2-zip' ? (await extractClmcZip(bytes)).projectJson : bytes.toString('utf8'))
  } catch { return } // A damaged destination can be repaired without replacing its last-good backup.
  if (raw && typeof raw === 'object' && ((raw as { formatVersion?: number }).formatVersion! > 3 || (raw as { minimumReaderVersion?: number }).minimumReaderVersion! > 3))
    throw new Error('Project needs a newer version. This file has not been changed.')
}
export async function validatedArchive(bytes: Buffer): Promise<void> {
  const { projectJson, pdfBytes } = await extractClmcZip(bytes)
  const data = parseProjectMetadata(projectJson)
  if (data.pdf.sha256 !== sha256Buffer(pdfBytes))
    throw new Error('Project archive integrity validation failed.')
}
async function durableTemp(path: string, bytes: Buffer): Promise<void> {
  const handle = await open(path, 'wx')
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
}
async function renameWithRetry(source: string, destination: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(source, destination)
      return
    } catch (error) {
      if (!isLockedDestError(error) || attempt >= RENAME_RETRY_DELAYS_MS.length) throw error
      await delay(RENAME_RETRY_DELAYS_MS[attempt])
    }
  }
}
/** A complete serialized transaction. A lock never authorizes deleting the destination. */
export function writeProtectedProject(
  destination: string,
  json: string,
  pdf: Uint8Array,
  preservedPaths: readonly string[] = []
): Promise<void> {
  const finalPath = resolve(destination),
    key = process.platform === 'win32' ? finalPath.toLowerCase() : finalPath
  const bytes = Buffer.from(pdf),
    previous = projectWrites.get(key) ?? Promise.resolve()
  const transaction = previous
    .catch(() => {})
    .then(async () => {
      const token = randomUUID(),
        temp = `${finalPath}.${token}.tmp`,
        backupTemp = `${finalPath}.${token}.bak.tmp`
      let stage: ProjectSaveStage = 'write',
        firstSave = false
      try {
        await assertCopyDestination(finalPath, preservedPaths)
        let original: Buffer | undefined
        try {
          original = await readFile(finalPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          firstSave = true
        }
        if (original) await rejectFutureOriginal(original)
        await durableTemp(temp, await assembleClmcZip(json, bytes))
        stage = 'validate'
        await validatedArchive(await readFile(temp))
        if (original) {
          let valid = false
          try {
            await validatedArchive(original)
            valid = true
          } catch {
            /* preserve existing good backup */
          }
          if (valid) {
            stage = 'backup'
            await durableTemp(backupTemp, original)
            await validatedArchive(await readFile(backupTemp))
            await renameWithRetry(backupTemp, `${finalPath}.bak`)
          }
        }
        stage = 'replace'
        await renameWithRetry(temp, finalPath)
      } catch (error) {
        throw new ProjectSaveError(stage, error, firstSave)
      } finally {
        await Promise.all([temp, backupTemp].map((path) => unlink(path).catch(() => {})))
      }
    })
  projectWrites.set(key, transaction)
  void transaction
    .finally(() => {
      if (projectWrites.get(key) === transaction) projectWrites.delete(key)
    })
    .catch(() => {})
  return transaction
}

/** Only a complete adjacent archive may be offered after an open failure. */
export async function validatedBackupPath(destination: string): Promise<string | undefined> {
  const path = `${destination}.bak`
  try {
    await validatedArchive(await readFile(path))
    return path
  } catch {
    return undefined
  }
}
