/** @vitest-environment jsdom */
import { act } from 'react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { TitleBar } from '@renderer/components/TitleBar'
import { useProjectStore } from '@renderer/stores/projectStore'

const transport = vi.hoisted(() => {
  const frame = { url: 'file:///app/out/renderer/index.html' }
  const contents = { mainFrame: frame, on: vi.fn(), send: vi.fn(), setVisualZoomLevelLimits: vi.fn(), setZoomLevel: vi.fn(), setWindowOpenHandler: vi.fn() }
  return { handlers: new Map<string, (...args: any[]) => any>(), api: {} as any, frame, contents }
})
vi.mock('electron', () => ({
  app: { commandLine: { appendSwitch: vi.fn() }, whenReady: () => Promise.resolve(), on: vi.fn(), getVersion: () => '1.0.0' },
  BrowserWindow: class { webContents = transport.contents; on = vi.fn(); loadFile = vi.fn(); loadURL = vi.fn() },
  ipcMain: { handle: (channel: string, handler: (...args: any[]) => any) => transport.handlers.set(channel, handler), on: vi.fn() },
  ipcRenderer: { invoke: (channel: string) => transport.handlers.get(channel)?.({ sender: transport.contents, senderFrame: transport.frame }), on: vi.fn() },
  contextBridge: { exposeInMainWorld: (_name: string, api: unknown) => { transport.api = api } },
  webFrame: { setVisualZoomLevelLimits: vi.fn() }, shell: {}
}))
vi.mock('@electron-toolkit/utils', () => ({ electronApp: { setAppUserModelId: vi.fn() }, optimizer: {}, is: { dev: false } }))
vi.mock('../main/ipc-handlers', () => ({ registerIpcHandlers: vi.fn() }))
vi.mock('../main/cost-library-ipc', () => ({ registerCostLibraryHandlers: vi.fn() }))
beforeAll(async () => {
  await import('../main/index')
  await import('../preload/index')
})

describe('trusted installed version', () => {
  it('passes the main version through the named bridge into the visible fixed app segment', async () => {
    expect(transport.api.getReleaseInfo).toBeTypeOf('function')
    window.api = transport.api
    useProjectStore.setState({ currentFilePath: 'C:/' + 'long-project-'.repeat(70) + '.clmc', isDirty: true, isSaving: true })
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => { root.render(React.createElement(TitleBar)) })
    expect(container.textContent).toContain('CLMC Takeoff 1.0.0')
    expect(container.textContent).toContain('Saving…')
    expect(container.textContent).toContain('*')
    const app = container.querySelector('[data-testid="app-version"]') as HTMLElement
    expect(app.style.flexShrink).toBe('0')
    expect(container.querySelector('[data-testid="project-title"]')?.getAttribute('title')).toContain('long-project-')
    act(() => root.unmount())
  })
  it('rejects foreign windows, subframes and navigated frames', async () => {
    const handler = transport.handlers.get('app:getReleaseInfo')
    expect(handler).toBeTypeOf('function')
    for (const event of [
      { sender: {}, senderFrame: transport.frame },
      { sender: transport.contents, senderFrame: { url: transport.frame.url } },
      { sender: transport.contents, senderFrame: null }
    ]) await expect(handler!(event)).rejects.toThrow('Untrusted')
    const url = transport.frame.url
    transport.frame.url = 'https://untrusted.example/'
    await expect(handler!({ sender: transport.contents, senderFrame: transport.frame })).rejects.toThrow('Untrusted')
    transport.frame.url = url
  })
  it('never invents a version while pending or after transport failure', async () => {
    window.api = { ...transport.api, getReleaseInfo: () => new Promise(() => {}) }
    const container = document.createElement('div')
    let root = createRoot(container)
    await act(async () => { root.render(React.createElement(TitleBar)) })
    expect(container.querySelector('[data-testid="app-version"]')?.textContent).toBe('CLMC Takeoff')
    act(() => root.unmount())
    window.api.getReleaseInfo = vi.fn().mockRejectedValue(new Error('offline transport failure'))
    root = createRoot(container)
    await act(async () => { root.render(React.createElement(TitleBar)) })
    expect(container.querySelector('[data-testid="app-version"]')?.textContent).toBe('CLMC Takeoff — Version unavailable')
    act(() => root.unmount())
  })
})
