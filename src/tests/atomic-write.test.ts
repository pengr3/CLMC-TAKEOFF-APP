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

  it('cleans up .tmp file via unlink when rename fails (both initial + recovery)', async () => {
    const finalPath = 'C:/projects/myplan.clmc'
    const tmpPath = `${finalPath}.tmp`
    // atomicWriteFile retries rename once after unlinking the destination on EPERM.
    // Both attempts must fail to surface the underlying error.
    const renameErr = Object.assign(new Error('EPERM: rename failed'), { code: 'EPERM' })
    ;(fsP.rename as ReturnType<typeof vi.fn>).mockRejectedValue(renameErr)

    await expect(
      handlers['file:writeProject']({}, finalPath, '{}', new Uint8Array())
    ).rejects.toThrow(/rename failed/)

    expect(fsP.unlink).toHaveBeenCalledWith(tmpPath)
  })
})
