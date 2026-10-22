import { open } from 'node:fs/promises'
import { extname } from 'node:path'
import { LIBRARY_IMPORT_MESSAGES, MAX_WORKER_MESSAGE_CHARS } from '../shared/cost-library'
import { admitWorkbook, WorkbookAdmissionError } from './workbook-admission'

const MAX_FILE_BYTES = 10 * 1024 * 1024
// Exactly one main-selected path, no renderer paths or messages are accepted here.
process.parentPort?.once('message', async ({ data }) => {
  const fail = (code: keyof typeof LIBRARY_IMPORT_MESSAGES): string =>
    JSON.stringify({ ok: false, code, reason: LIBRARY_IMPORT_MESSAGES[code] })
  let reply: string
  try {
    if (
      typeof data?.path !== 'string' ||
      !['.xlsx', '.csv'].includes(extname(data.path).toLowerCase())
    )
      throw new Error('Invalid input')
    const file = await open(data.path, 'r')
    let bytes: Buffer
    try {
      const info = await file.stat()
      if (!info.isFile() || info.size > MAX_FILE_BYTES) {
        process.parentPort?.postMessage(fail('resource'))
        return
      }
      // Reserve at most the compressed cap plus one; a growing file cannot escape it.
      const buffer = Buffer.alloc(Math.min(info.size + 1, MAX_FILE_BYTES + 1))
      let length = 0
      while (length < buffer.length) {
        const read = await file.read(buffer, length, buffer.length - length, null)
        if (!read.bytesRead) break
        length += read.bytesRead
      }
      if (length > info.size) {
        process.parentPort?.postMessage(fail('resource'))
        return
      }
      bytes = buffer.subarray(0, length)
    } finally {
      await file.close()
    }
    if (extname(data.path).toLowerCase() === '.xlsx') await admitWorkbook(bytes)
    // ExcelJS is deliberately loaded only after every ZIP entry passed admission.
    const { parseCostLibrary } = await import('./cost-library')
    const result = await parseCostLibrary(bytes, data.path)
    reply = JSON.stringify(result)
    if (reply.length > MAX_WORKER_MESSAGE_CHARS) reply = fail('resource')
  } catch (error) {
    reply = fail(error instanceof WorkbookAdmissionError ? error.code : 'parser')
  }
  process.parentPort?.postMessage(reply)
})
