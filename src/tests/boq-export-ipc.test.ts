/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('stub')),
  access: vi.fn().mockResolvedValue(undefined)
}))

// vi.mock factories run BEFORE top-level const initialization. Using vi.hoisted
// to share state between the factory and the test body.
const { handlers, mockShowSaveDialog } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  mockShowSaveDialog: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = fn
    }
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: mockShowSaveDialog },
  BrowserWindow: { fromWebContents: vi.fn().mockReturnValue({}) }
}))

vi.mock('../main/boq-writers', () => ({
  buildBoqXlsx: vi.fn().mockResolvedValue(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  buildBoqCsv: vi.fn().mockReturnValue('Project: T\r\n')
}))

import * as fsP from 'fs/promises'
import { registerIpcHandlers } from '../main/ipc-handlers'

const STUB_STRUCT = {
  metadata: { projectName: 'T', planFilename: 'plan.pdf', exportedDate: '2026-05-02', totalPages: 1, totalMarkups: 0 },
  categories: [],
  grandTotals: []
}

describe('Phase 5 IPC handlers — D-21 / D-24 / EXPRT-01 / EXPRT-02', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(handlers)) delete handlers[k]
    registerIpcHandlers()
  })

  it('dialog:saveExport returns { filePath, format: "xlsx" } when user chooses .xlsx and enforces extension', async () => {
    mockShowSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: 'C:/exports/myproject-BOQ' })
    const r = await handlers['dialog:saveExport']({ sender: {} }, 'C:/exports/myproject-BOQ.xlsx', 'xlsx')
    expect(r).toEqual({ filePath: 'C:/exports/myproject-BOQ.xlsx', format: 'xlsx' })
  })

  it('dialog:saveExport detects .csv from chosen path and returns format: "csv"', async () => {
    mockShowSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: 'C:/exports/myproject-BOQ.csv' })
    const r = await handlers['dialog:saveExport']({ sender: {} }, 'C:/exports/myproject-BOQ.xlsx', 'xlsx')
    expect(r).toEqual({ filePath: 'C:/exports/myproject-BOQ.csv', format: 'csv' })
  })

  it('dialog:saveExport returns null when canceled', async () => {
    mockShowSaveDialog.mockResolvedValueOnce({ canceled: true })
    const r = await handlers['dialog:saveExport']({ sender: {} }, 'C:/x.xlsx', 'xlsx')
    expect(r).toBeNull()
  })

  it('file:writeBoqXlsx writes to .tmp first then rename — atomic', async () => {
    const finalPath = 'C:/exports/myproject-BOQ.xlsx'
    const tmpPath = `${finalPath}.tmp`
    const r = await handlers['file:writeBoqXlsx']({}, finalPath, STUB_STRUCT)
    expect(r).toEqual({ ok: true })
    expect(fsP.writeFile).toHaveBeenCalledWith(tmpPath, expect.any(Buffer))
    expect(fsP.rename).toHaveBeenCalledWith(tmpPath, finalPath)
  })

  it('file:writeBoqXlsx returns { ok: false, reason } when writeFile throws', async () => {
    ;(fsP.writeFile as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(new Error('EACCES: permission denied'))
    const r = await handlers['file:writeBoqXlsx']({}, 'C:/exports/x.xlsx', STUB_STRUCT) as { ok: boolean; reason?: string }
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('EACCES')
  })

  it('file:writeBoqCsv writes UTF-8 buffer atomically and returns { ok: true }', async () => {
    const finalPath = 'C:/exports/myproject-BOQ.csv'
    const r = await handlers['file:writeBoqCsv']({}, finalPath, STUB_STRUCT)
    expect(r).toEqual({ ok: true })
    expect(fsP.writeFile).toHaveBeenCalledWith(`${finalPath}.tmp`, expect.any(Buffer))
    expect(fsP.rename).toHaveBeenCalledWith(`${finalPath}.tmp`, finalPath)
  })

  it('file:writeBoqCsv returns { ok: false, reason } on rename failure and cleans up .tmp', async () => {
    ;(fsP.rename as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(new Error('EBUSY'))
    const finalPath = 'C:/exports/x.csv'
    const r = await handlers['file:writeBoqCsv']({}, finalPath, STUB_STRUCT) as { ok: boolean; reason?: string }
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('EBUSY')
    // Pins the specific .tmp path that atomicWriteFile cleans up after a rename failure.
    // If atomicWriteFile's internal cleanup contract changes, this assertion correctly fails.
    expect(fsP.unlink).toHaveBeenCalledWith(`${finalPath}.tmp`)
  })
})
