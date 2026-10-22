import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CostLibraryRepository } from '../main/cost-library'

const host = vi.hoisted(() => {
  const frame = { url: '' }
  const contents = {
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
    mainFrame: frame,
    on: vi.fn(),
    send: vi.fn(),
    setVisualZoomLevelLimits: vi.fn(),
    setZoomLevel: vi.fn(),
    setWindowOpenHandler: vi.fn()
  }
  return {
    root: '',
    paths: {} as Record<string, string>,
    order: [] as string[],
    frame,
    contents,
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    model: vi.fn()
  }
})
vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: vi.fn(() => true),
    exit: vi.fn(),
    getPath: (name: string) => host.paths[name] ?? host.root,
    setPath: (name: string, value: string) => {
      host.paths[name] = value
      host.order.push(`path:${name}`)
    },
    commandLine: { appendSwitch: vi.fn() },
    whenReady: (): Promise<void> => {
      host.order.push('ready')
      return Promise.resolve()
    },
    on: vi.fn(),
    getVersion: () => '1.0.0',
    getAppPath: () => process.cwd()
  },
  BrowserWindow: class {
    webContents = host.contents
    on = vi.fn()
    loadFile = (path: string): void => {
      host.frame.url = pathToFileURL(path).href
    }
    loadURL = vi.fn()
  },
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => host.handlers.set(name, fn),
    on: vi.fn()
  },
  dialog: {},
  shell: {}
}))
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: host.model },
  optimizer: {},
  is: { dev: false }
}))
let directory: string
const library = {
  formatVersion: 1 as const,
  sourceFilename: 'existing.csv',
  importedAt: '2026-10-21T00:00:00.000Z',
  items: [
    {
      code: 'A',
      description: 'Paint',
      category: 'Finishes',
      unit: 'm²' as const,
      material: 100,
      labor: 50
    }
  ]
}
const preferences =
  '{"clmc.ui":{"totals":{"open":false,"width":390},"collapsedCategories":["Finishes"]}}'
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'clmc-identity-'))
  host.root = directory
  const legacy = join(directory, 'clmc-takeoff')
  await mkdir(legacy)
  await new CostLibraryRepository(legacy).replace(library)
  await writeFile(join(legacy, 'Preferences'), preferences)
  await import('../main/index')
  await Promise.resolve()
})
afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('stable installed identity and preserved workstation storage', () => {
  it('pins existing userData before ready and loads the unchanged seeded library and preferences', async () => {
    expect(host.paths.userData).toBe(join(directory, 'clmc-takeoff'))
    expect(host.order.indexOf('path:userData')).toBeLessThan(host.order.indexOf('ready'))
    const event = { sender: host.contents, senderFrame: host.frame }
    expect(await host.handlers.get('costLibrary:load')!(event)).toEqual({
      ok: true,
      value: library
    })
    expect(await readFile(join(host.paths.userData, 'Preferences'), 'utf8')).toBe(preferences)
    expect(host.model).toHaveBeenCalledWith('com.clmc.takeoff')
    const builder = await readFile('electron-builder.yml', 'utf8')
    expect(builder).toContain('appId: com.clmc.takeoff')
    expect(builder).toContain('productName: CLMC Takeoff')
    expect(builder).toContain('perMachine: false')
    expect(builder).toContain('deleteAppDataOnUninstall: false')
    expect(builder).not.toContain('example.com')
  })
  it('rejects foreign windows, child frames, absent frames and a navigated main frame before every privileged handler', async () => {
    const privileged = [...host.handlers].filter(([key]) =>
      /^(file:|dialog:|costLibrary:)/.test(key)
    )
    expect(privileged.length).toBeGreaterThan(10)
    const url = host.frame.url
    for (const [, fn] of privileged) {
      for (const event of [
        { sender: {}, senderFrame: host.frame },
        { sender: host.contents, senderFrame: { url } },
        { sender: host.contents, senderFrame: null }
      ])
        await expect(Promise.resolve().then(() => fn(event))).rejects.toThrow('Untrusted')
      host.frame.url = `${url}#unexpected`
      await expect(
        Promise.resolve().then(() => fn({ sender: host.contents, senderFrame: host.frame }))
      ).rejects.toThrow('Untrusted')
      host.frame.url = url
    }
  })
})
