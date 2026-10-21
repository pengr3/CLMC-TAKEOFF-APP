import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  open: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
  stat: vi.fn(),
  write: vi.fn(),
  replace: vi.fn(),
  load: vi.fn(),
  parse: vi.fn(),
  template: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getPath: () => 'user-data' },
  ipcMain: {
    handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler)
  },
  dialog: { showOpenDialog: mock.open, showSaveDialog: mock.save },
  BrowserWindow: { fromWebContents: () => ({}) }
}))
vi.mock('fs/promises', () => ({ readFile: mock.read, stat: mock.stat, writeFile: mock.write }))
vi.mock('../main/cost-library', () => ({
  MAX_LIBRARY_FILE_BYTES: 100,
  parseCostLibrary: mock.parse,
  buildCostLibraryTemplate: mock.template,
  CostLibraryRepository: class {
    load = mock.load
    replace = mock.replace
  }
}))
import { registerCostLibraryHandlers } from '../main/cost-library-ipc'
const event = { sender: { id: 1, once: vi.fn() } }
const call = (name: string, ...args: unknown[]): any =>
  mock.handlers.get(`costLibrary:${name}`)!(event, ...args)
const items = [
  { code: 'A', description: 'Paint', category: 'Finishes', unit: 'm²', material: 10, labor: 5 }
]
beforeEach(() => {
  vi.clearAllMocks()
  mock.handlers.clear()
  mock.open.mockResolvedValue({ canceled: false, filePaths: ['C:/master.csv'] })
  mock.stat.mockResolvedValue({ size: 10 })
  mock.read.mockResolvedValue(Buffer.from('csv'))
  mock.parse.mockResolvedValue({ ok: true, value: items })
  mock.replace.mockImplementation(async (library) => ({ ok: true, value: library }))
  mock.save.mockResolvedValue({ canceled: true })
  mock.template.mockResolvedValue(Buffer.from('xlsx'))
  mock.write.mockResolvedValue(undefined)
  registerCostLibraryHandlers()
})
describe('main-process library import protocol', () => {
  it('does not persist a preview; commits only the main-held candidate', async () => {
    const preview = await call('preview')
    expect(preview.ok).toBe(true)
    expect(mock.replace).not.toHaveBeenCalled()
    expect((await call('commit', preview.value.token)).ok).toBe(true)
    expect(mock.replace).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFilename: 'master.csv', items })
    )
    expect((await call('commit', preview.value.token)).ok).toBe(false)
  })
  it('rejects forged, cancelled, stale and cross-window tokens', async () => {
    expect((await call('commit', 'fake')).ok).toBe(false)
    const first = await call('preview')
    const second = await call('preview')
    expect((await call('commit', first.value.token)).ok).toBe(false)
    const foreign = await mock.handlers.get('costLibrary:commit')!(
      { sender: { id: 2 } },
      second.value.token
    )
    expect(foreign.ok).toBe(false)
    await call('cancel', second.value.token)
    expect((await call('commit', second.value.token)).ok).toBe(false)
    expect(mock.replace).not.toHaveBeenCalled()
    expect(event.sender.once).toHaveBeenCalledTimes(1)
  })
  it('preserves candidate for retry after disk failure', async () => {
    const preview = await call('preview')
    mock.replace.mockResolvedValueOnce({ ok: false, reason: 'Disk full' })
    expect((await call('commit', preview.value.token)).ok).toBe(false)
    expect((await call('commit', preview.value.token)).ok).toBe(true)
  })
  it('never stages invalid or cancelled imports', async () => {
    mock.parse.mockResolvedValueOnce({ ok: false, reason: 'Bad rows' })
    expect((await call('preview')).ok).toBe(false)
    mock.open.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await call('preview')).toEqual({ ok: true, value: null })
    expect(mock.replace).not.toHaveBeenCalled()
  })
  it('bounds input before reading and returns file-access errors', async () => {
    mock.stat.mockResolvedValueOnce({ size: 101 })
    expect((await call('preview')).ok).toBe(false)
    expect(mock.read).not.toHaveBeenCalled()
    mock.stat.mockRejectedValueOnce(new Error('denied'))
    expect((await call('preview')).ok).toBe(false)
  })
  it('saves templates through a native dialog and treats cancellation as no write', async () => {
    expect(await call('template')).toEqual({ ok: true, value: false })
    expect(mock.write).not.toHaveBeenCalled()
    mock.save.mockResolvedValueOnce({ canceled: false, filePath: 'C:/template' })
    expect(await call('template')).toEqual({ ok: true, value: true })
    expect(mock.write).toHaveBeenCalledWith('C:/template.xlsx', Buffer.from('xlsx'))
  })
})
