import { utilityProcess } from 'electron'
import { join } from 'node:path'
import {
  COST_LIBRARY_HEADERS,
  LIBRARY_IMPORT_MESSAGES,
  MAX_LIBRARY_ITEMS,
  MAX_WORKER_MESSAGE_CHARS,
  validateLibraryRows,
  type CostLibraryItem,
  type LibraryImportCode,
  type LibraryResult
} from '../shared/cost-library'

export const LIBRARY_IMPORT_DEADLINE_MS = 15_000
export function importFailure(code: LibraryImportCode): LibraryResult<never> {
  return { ok: false, code, reason: LIBRARY_IMPORT_MESSAGES[code] }
}

// Revalidate the child boundary before granting a main-owned commit candidate.
function decodeResult(message: unknown): LibraryResult<CostLibraryItem[]> {
  if (typeof message !== 'string' || message.length > MAX_WORKER_MESSAGE_CHARS)
    return importFailure('resource')
  try {
    const result = JSON.parse(message)
    if (result?.ok === true && Array.isArray(result.value)) {
      if (result.value.length > MAX_LIBRARY_ITEMS) return importFailure('resource')
      return validateLibraryRows([
        [...COST_LIBRARY_HEADERS],
        ...result.value.map((item: CostLibraryItem) => [
          item?.code,
          item?.description,
          item?.category,
          item?.unit,
          item?.material,
          item?.labor
        ])
      ])
    }
    if (result?.ok === false && typeof result.reason === 'string' && result.reason.length <= 2000) {
      if (result.code)
        return importFailure(
          Object.hasOwn(LIBRARY_IMPORT_MESSAGES, result.code) ? result.code : 'parser'
        )
      if (
        result.issues !== undefined &&
        (!Array.isArray(result.issues) ||
          result.issues.length > 100 ||
          result.issues.some(
            (issue: { row: number; column: string; message: string }) =>
              !Number.isInteger(issue.row) ||
              issue.row < 1 ||
              issue.row > MAX_LIBRARY_ITEMS + 1 ||
              typeof issue.column !== 'string' ||
              issue.column.length > 100 ||
              typeof issue.message !== 'string' ||
              issue.message.length > 1000
          ))
      )
        return importFailure('parser')
      return { ok: false, reason: result.reason, issues: result.issues }
    }
  } catch {
    /* Invalid or excessive worker data never creates a preview. */
  }
  return importFailure('parser')
}

/** Deadline includes spawn, bounded file read, admission, ExcelJS import and validation.
 * A result is published only after the child exits; late messages cannot win a timeout.
 */
export function parseInUtilityProcess(
  selectedPath: string,
  options: { signal?: AbortSignal; workerPath?: string; deadlineMs?: number } = {}
): Promise<LibraryResult<CostLibraryItem[]>> {
  if (options.signal?.aborted) return Promise.resolve(importFailure('parser'))
  return new Promise((resolve) => {
    const expiresAt = Date.now() + (options.deadlineMs ?? LIBRARY_IMPORT_DEADLINE_MS)
    const env = { ...process.env }
    delete env.NODE_OPTIONS
    delete env.ELECTRON_RUN_AS_NODE
    let child: Electron.UtilityProcess
    try {
      child = utilityProcess.fork(
        options.workerPath ?? join(__dirname, 'cost-library-worker.js'),
        [],
        {
          stdio: 'ignore',
          env,
          execArgv: ['--max-old-space-size=512'],
          serviceName: 'Cost Library Import'
        }
      )
    } catch {
      resolve(importFailure('parser'))
      return
    }
    let result: LibraryResult<CostLibraryItem[]> | undefined
    let exited = false
    let forceKill: ReturnType<typeof setTimeout> | undefined
    const stop = (next: LibraryResult<CostLibraryItem[]>): void => {
      if (result || exited) return
      result = next
      child.kill()
      forceKill = setTimeout(() => {
        if (child.pid) {
          try {
            process.kill(child.pid, 'SIGKILL')
          } catch {
            /* Exit may already be queued. */
          }
        }
      }, 1000)
    }
    const deadline = setTimeout(
      () => stop(importFailure('timeout')),
      options.deadlineMs ?? LIBRARY_IMPORT_DEADLINE_MS
    )
    const abort = (): void => stop(importFailure('parser'))
    options.signal?.addEventListener('abort', abort, { once: true })
    child.on('message', (message) => {
      if (result || exited) return
      const decoded = Date.now() >= expiresAt ? importFailure('timeout') : decodeResult(message)
      stop(Date.now() >= expiresAt ? importFailure('timeout') : decoded)
    })
    child.on('error', () => stop(importFailure('parser')))
    child.once('exit', () => {
      exited = true
      clearTimeout(deadline)
      clearTimeout(forceKill)
      options.signal?.removeEventListener('abort', abort)
      resolve(result ?? importFailure('parser'))
    })
    // A deadline can elapse before spawn: kill again when a PID becomes available.
    child.once('spawn', () => {
      if (result) child.kill()
      else child.postMessage({ path: selectedPath })
    })
  })
}
