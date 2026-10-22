import { expect, it, vi } from 'vitest'
const host = vi.hoisted(() => ({ ready: vi.fn(() => Promise.resolve()), exit: vi.fn(), lock: vi.fn(() => false), windows: vi.fn(), register: vi.fn(), order: [] as string[] }))
vi.mock('electron', () => ({ app: {
  getPath: () => process.cwd(), setPath: () => host.order.push('identity'),
  requestSingleInstanceLock: () => { host.order.push('lock'); return host.lock() },
  exit: host.exit, whenReady: host.ready, on: vi.fn(), commandLine: { appendSwitch: vi.fn() }
}, BrowserWindow: host.windows, ipcMain: { handle: host.register, on: vi.fn() } }))
vi.mock('@electron-toolkit/utils', () => ({ electronApp: { setAppUserModelId: vi.fn() }, optimizer: {}, is: { dev: false } }))
vi.mock('../main/ipc-handlers', () => ({ registerIpcHandlers: host.register }))
vi.mock('../main/cost-library-ipc', () => ({ registerCostLibraryHandlers: host.register }))
vi.mock('../main/project-recovery', () => ({ registerRecoveryHandlers: host.register }))
it('pins the shared identity then exits a contender before ready/window/storage/IPC initialization', async () => {
  await import('../main/index')
  expect(host.order).toEqual(['identity', 'lock'])
  expect(host.exit).toHaveBeenCalledWith(0)
  expect(host.ready).not.toHaveBeenCalled()
  expect(host.windows).not.toHaveBeenCalled()
  expect(host.register).not.toHaveBeenCalled()
})
