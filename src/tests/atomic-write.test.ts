/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs/promises BEFORE importing the IPC handler module
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('stub')),
  access: vi.fn().mockResolvedValue(undefined)
}))

// Mock electron — registerIpcHandlers calls ipcMain.handle
const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = fn
    }
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn().mockReturnValue({}) }
}))

// Mock project-io's assembleClmcZip so we test only the wrapper
vi.mock('../main/project-io', async () => {
  const real = await vi.importActual('../main/project-io')
  return {
    ...real,
    assembleClmcZip: vi.fn().mockResolvedValue(Buffer.from([0x50, 0x4b, 0x03, 0x04])) // ZIP magic stub
  }
})

import * as fsP from 'fs/promises'
import { registerIpcHandlers } from '../main/ipc-handlers'

describe('file:writeProject — atomic write (MEDIUM review concern)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerIpcHandlers()
  })

  it('writes to a .tmp path first, then renames to the final path', async () => {
    const finalPath = 'C:/projects/myplan.clmc'
    const tmpPath = `${finalPath}.tmp`
    const fakeJson = '{"formatVersion":2}'
    const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46])

    await handlers['file:writeProject']({}, finalPath, fakeJson, fakePdf)

    // writeFile must be called with the .tmp path, NOT the final path directly
    expect(fsP.writeFile).toHaveBeenCalledWith(tmpPath, expect.any(Buffer))
    expect(fsP.writeFile).not.toHaveBeenCalledWith(finalPath, expect.any(Buffer))

    // rename must be called from .tmp → final
    expect(fsP.rename).toHaveBeenCalledWith(tmpPath, finalPath)

    // Order: writeFile first, rename second
    const writeOrder = (fsP.writeFile as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]
    const renameOrder = (fsP.rename as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]
    expect(writeOrder).toBeLessThan(renameOrder)
  })

  it('recovers from EPERM on rename by unlinking destination then retrying (OneDrive lock workaround)', async () => {
    const finalPath = 'C:/projects/locked.clmc'
    const tmpPath = `${finalPath}.tmp`
    // First rename rejects with EPERM (OneDrive holds the dest); second succeeds.
    const epermErr = Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' })
    ;(fsP.rename as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(epermErr)
      .mockResolvedValueOnce(undefined)

    await expect(
      handlers['file:writeProject']({}, finalPath, '{}', new Uint8Array())
    ).resolves.toEqual({ ok: true })

    // Recovery sequence: unlink(finalPath) then rename(tmpPath, finalPath)
    expect(fsP.unlink).toHaveBeenCalledWith(finalPath)
    expect((fsP.rename as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
    expect((fsP.rename as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual([tmpPath, finalPath])
  })

  it('cleans up .tmp file via unlink when rename fails persistently (locked destination)', async () => {
    const finalPath = 'C:/projects/myplan.clmc'
    const tmpPath = `${finalPath}.tmp`
    // atomicWriteFile retries rename with backoff (up to 3 attempts) on EPERM,
    // unlinking the destination between attempts. When EVERY attempt fails the
    // destination is genuinely held open — the .tmp must still be cleaned up.
    const renameErr = Object.assign(new Error('EPERM: rename failed'), { code: 'EPERM' })
    ;(fsP.rename as ReturnType<typeof vi.fn>).mockRejectedValue(renameErr)

    await expect(
      handlers['file:writeProject']({}, finalPath, '{}', new Uint8Array())
    ).rejects.toThrow()

    expect(fsP.unlink).toHaveBeenCalledWith(tmpPath)
  })
})

describe('atomicWriteFile — locked-destination resilience + friendly message (GAP-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(handlers)) delete handlers[k]
    registerIpcHandlers()
  })

  it('absorbs a TRANSIENT lock — first rename throws EPERM, retry succeeds → resolves', async () => {
    const finalPath = 'C:/projects/report.clmc'
    const tmpPath = `${finalPath}.tmp`
    const epermErr = Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' })
    // First rename fails (a brief OneDrive/AV lock), the retry succeeds.
    ;(fsP.rename as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(epermErr)
      .mockResolvedValueOnce(undefined)

    await expect(
      handlers['file:writeProject']({}, finalPath, '{}', new Uint8Array())
    ).resolves.toEqual({ ok: true })

    // Two rename attempts: the failed initial + the successful retry.
    expect((fsP.rename as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
    expect((fsP.rename as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual([tmpPath, finalPath])
  })

  it('PERSISTENT lock — rename + unlink both throw EPERM through all retries → friendly message + .tmp cleaned', async () => {
    const finalPath = 'C:/exports/BOQ.xlsx'
    const tmpPath = `${finalPath}.tmp`
    const epermErr = Object.assign(
      new Error("EPERM: operation not permitted, rename 'BOQ.xlsx.tmp' -> 'BOQ.xlsx'"),
      { code: 'EPERM' }
    )
    // The destination is held open by Excel: BOTH rename and the release-unlink
    // of the destination fail with EPERM on every attempt; only the .tmp cleanup
    // (a file we own) succeeds.
    ;(fsP.rename as ReturnType<typeof vi.fn>).mockRejectedValue(epermErr)
    ;(fsP.unlink as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) => {
      if (p === finalPath) throw epermErr // cannot release the locked destination
      return undefined // .tmp cleanup succeeds
    })

    // file:writeProject does not catch — atomicWriteFile throws the friendly Error.
    const err = await handlers['file:writeProject']({}, finalPath, '{}', new Uint8Array())
      .then(() => null)
      .catch((e: unknown) => e as Error)

    expect(err).toBeInstanceOf(Error)
    const msg = (err as Error).message
    // Friendly, actionable message — names the file + points at the open program.
    expect(msg).toContain('BOQ.xlsx')
    expect(msg).toMatch(/open in another program/i)
    expect(msg).toMatch(/Excel/i)
    // Must NOT lead with the raw rename EPERM text.
    expect(msg).not.toMatch(/^EPERM/)
    // The .tmp scratch file is still cleaned up.
    expect(fsP.unlink).toHaveBeenCalledWith(tmpPath)
  })
})
