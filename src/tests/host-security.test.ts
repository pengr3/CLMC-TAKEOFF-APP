import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const host = vi.hoisted(() => {
  const frame = { url: '' }
  const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
  return {
    frame,
    session,
    options: {} as Record<string, unknown>,
    contents: {
      mainFrame: frame,
      session,
      on: vi.fn(),
      send: vi.fn(),
      setVisualZoomLevelLimits: vi.fn(),
      setZoomLevel: vi.fn(),
      setWindowOpenHandler: vi.fn()
    },
    close: vi.fn(),
    external: vi.fn(),
    listeners: new Map<string, (...args: unknown[]) => void>(),
    appEvents: new Map<string, (...args: unknown[]) => void>(), windowEvents: new Map<string, (...args: unknown[]) => void>(),
    restore: vi.fn(), show: vi.fn(), focus: vi.fn()
  }
})
vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: vi.fn(() => true),
    exit: vi.fn(),
    getPath: () => process.cwd(),
    setPath: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    whenReady: () => Promise.resolve(),
    on: (name: string, fn: (...args: unknown[]) => void) => host.appEvents.set(name, fn)
  },
  BrowserWindow: class {
    constructor(options: Record<string, unknown>) {
      host.options = options
    }
    webContents = host.contents
    on = (name: string, fn: (...args: unknown[]) => void): void => { host.windowEvents.set(name, fn) }
    isDestroyed = (): boolean => false
    isMinimized = (): boolean => true
    restore = host.restore
    show = host.show
    focus = host.focus
    close = host.close
    loadFile = (path: string): void => {
      host.frame.url = pathToFileURL(path).href
    }
    loadURL = vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: (name: string, fn: (...args: unknown[]) => void) => host.listeners.set(name, fn)
  },
  shell: { openExternal: host.external }
}))
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: {},
  is: { dev: false }
}))
vi.mock('../main/ipc-handlers', () => ({ registerIpcHandlers: vi.fn() }))
vi.mock('../main/cost-library-ipc', () => ({ registerCostLibraryHandlers: vi.fn() }))

describe('offline Electron host policy', () => {
  it('enables the sandbox and bundles preload dependencies without relaxing isolation', async () => {
    await import('../main/index')
    await Promise.resolve()
    expect(host.options.webPreferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    })
    const config = await readFile('electron.vite.config.ts', 'utf8')
    expect(config).toMatch(/preload:\s*\{\s*build:\s*\{\s*externalizeDeps:\s*false/)
  })
  it('denies navigation, redirects, webviews, popups and permissions without opening external links', () => {
    for (const name of [
      'will-navigate',
      'will-frame-navigate',
      'will-redirect',
      'will-attach-webview'
    ]) {
      const callback = host.contents.on.mock.calls.find(([key]) => key === name)?.[1]
      expect(callback).toBeTypeOf('function')
      const preventDefault = vi.fn()
      callback({ preventDefault }, 'https://hostile.example/')
      expect(preventDefault).toHaveBeenCalled()
    }
    const open = host.contents.setWindowOpenHandler.mock.calls[0]?.[0]
    expect(open({ url: 'https://hostile.example/' })).toEqual({ action: 'deny' })
    expect(host.external).not.toHaveBeenCalled()
    const request = host.session.setPermissionRequestHandler.mock.calls[0]?.[0]
    const decide = vi.fn()
    expect(request).toBeTypeOf('function')
    request(host.contents, 'media', decide)
    expect(decide).toHaveBeenCalledWith(false)
    expect(host.session.setPermissionCheckHandler.mock.calls[0]?.[0]()).toBe(false)
  })
  it('activates the existing minimized window without closing it or bypassing unsaved-work protection', () => {
    host.appEvents.get('second-instance')!({}, ['another.clmc'])
    expect(host.restore).toHaveBeenCalledOnce()
    expect(host.show).toHaveBeenCalledOnce()
    expect(host.focus).toHaveBeenCalledOnce()
    expect(host.close).not.toHaveBeenCalled()
    const preventDefault = vi.fn()
    host.windowEvents.get('close')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(host.contents.send).toHaveBeenCalledWith('app:close-request')
  })
  it('ignores hostile confirm-close events and accepts only the trusted main frame', () => {
    const close = host.listeners.get('app:confirm-close')!
    for (const event of [
      { sender: {}, senderFrame: host.frame },
      { sender: host.contents, senderFrame: { url: host.frame.url } },
      { sender: host.contents, senderFrame: null }
    ])
      expect(() => close(event)).not.toThrow()
    expect(host.close).not.toHaveBeenCalled()
    close({ sender: host.contents, senderFrame: host.frame })
    expect(host.close).toHaveBeenCalledOnce()
  })
})
