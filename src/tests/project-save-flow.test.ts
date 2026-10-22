/** @vitest-environment jsdom */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (key: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers[key] = fn
    }
  },
  dialog: {},
  BrowserWindow: {}
}))
vi.mock('@renderer/hooks/usePdfDocument', () => ({
  usePdfDocument: () => ({
    loadPdfFromPath: vi.fn(),
    loadPdfFromBytes: vi.fn(),
    stagePdfFromBytes: async () => ({ numPages: 1, getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }), destroy: async () => {} }),
    adoptStagedPdf: vi.fn()
  })
}))
import { registerIpcHandlers } from '../main/ipc-handlers'
import { extractClmcZip, sha256Buffer } from '../main/project-io'
import { useProject } from '@renderer/hooks/useProject'
import { attachDirtyTracking, useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let directory: string, root: Root, container: HTMLDivElement, unsubscribe: () => void
const hook: { current?: ReturnType<typeof useProject> } = {}
function Harness(): null {
  const value = useProject()
  useLayoutEffect(() => {
    hook.current = value
  })
  return null
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'clmc-save-flow-'))
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.getState().resetViewer()
  useViewerStore.setState({
    fileName: 'plan.pdf',
    totalPages: 1,
    pdfBytes: new Uint8Array([37, 80, 68, 70, 45, 49]),
    pdfDocument: {
      numPages: 1,
      getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) })
    }
  })
  registerIpcHandlers(() => {})
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      hashBuffer: async (bytes: Uint8Array) => sha256Buffer(bytes),
      writeProject: async (...args: unknown[]) => handlers['file:writeProject']({}, ...args),
      readProject: async (path: string) => handlers['file:readProject']({}, path),
      saveProjectDialog: vi.fn(async () => join(directory, 'project.clmc'))
    }
  })
  unsubscribe = attachDirtyTracking()
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness))
  })
})
afterEach(async () => {
  unsubscribe()
  act(() => root.unmount())
  container.remove()
  await rm(directory, { recursive: true, force: true })
})

it('saves a real archive and preserves the preceding validated revision as backup', async () => {
  useProjectStore.getState().setDefaultMarkupPct(41)
  expect(await hook.current!.saveProject()).toBe('ok')
  const path = join(directory, 'project.clmc')
  const first = await readFile(path)
  const archive = await extractClmcZip(first)
  expect(JSON.parse(archive.projectJson).defaultMarkupPct).toBe(41)
  expect(archive.pdfBytes).toEqual(Buffer.from(useViewerStore.getState().pdfBytes!))
  useProjectStore.getState().setDefaultMarkupPct(52)
  expect(await hook.current!.saveProject()).toBe('ok')
  expect(await readFile(path + '.bak')).toEqual(first)
  expect(await hook.current!.openByExtension(path, '.clmc')).toEqual({ kind: 'ok' })
  expect(useProjectStore.getState().defaultMarkupPct).toBe(52)
})

it('freezes metadata and PDF before hashing and keeps edits during I/O dirty', async () => {
  let release!: (value: string) => void
  const pdf = useViewerStore.getState().pdfBytes!.slice()
  window.api.hashBuffer = () =>
    new Promise((resolve) => {
      release = resolve
    })
  useProjectStore.getState().setDefaultMarkupPct(41)
  const saving = hook.current!.saveProject()
  // Save As dialog resolves asynchronously before snapshot capture.
  await Promise.resolve()
  await Promise.resolve()
  useProjectStore.getState().setDefaultMarkupPct(52)
  useViewerStore.getState().pdfBytes![0] = 0
  release(sha256Buffer(pdf))
  expect(await saving).toBe('ok')
  const archive = await extractClmcZip(await readFile(join(directory, 'project.clmc')))
  expect(JSON.parse(archive.projectJson).defaultMarkupPct).toBe(41)
  expect(archive.pdfBytes).toEqual(Buffer.from(pdf))
  expect(useProjectStore.getState().isDirty).toBe(true)
})

it('acquires busy before the native Save As picker and rejects duplicate saves and switches', async () => {
  let pick!: (path: string | null) => void
  window.api.saveProjectDialog = vi.fn(
    () =>
      new Promise((resolve) => {
        pick = resolve
      })
  )
  useProjectStore.getState().markDirty()
  const first = hook.current!.saveProjectAs()
  expect(useProjectStore.getState().isSaving).toBe(true)
  expect(await hook.current!.saveProjectAs()).toBe('canceled')
  hook.current!.newProject()
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(await hook.current!.openByExtension('other.pdf', '.pdf')).toEqual({ kind: 'canceled' })
  pick(null)
  expect(await first).toBe('canceled')
  expect(useProjectStore.getState().isSaving).toBe(false)
})

it('never acknowledges a completed save into a different document session', async () => {
  let finish!: () => void
  const write = window.api.writeProject
  window.api.writeProject = async (...args) => {
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    return write(...args)
  }
  useProjectStore.getState().setCurrentFilePath(join(directory, 'old.clmc'))
  const saving = hook.current!.saveProject()
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0))
  useProjectStore.getState().reset()
  useProjectStore.getState().markDirty()
  finish()
  expect(await saving).toBe('ok')
  expect(useProjectStore.getState().currentFilePath).toBeNull()
  expect(useProjectStore.getState().isDirty).toBe(true)
})

it('serializes same destination writes into complete archives with the preceding backup', async () => {
  const path = join(directory, 'queued.clmc'),
    pdf = new Uint8Array([37, 80, 68, 70])
  const json = (revision: number): string =>
    JSON.stringify({
      formatVersion: 2,
      revision,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      pdf: { originalFilename: 'plan.pdf', totalPages: 1, sha256: sha256Buffer(pdf) },
      categories: {},
      categoryOrder: [],
      globalUnit: 'mm',
      currentPage: 1,
      pages: [{ pageIndex: 1, dimensions: { width: 600, height: 800 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] }]
    })
  await Promise.all([
    handlers['file:writeProject']({}, path, json(1), pdf),
    handlers['file:writeProject']({}, path, json(2), pdf)
  ])
  expect(JSON.parse((await extractClmcZip(await readFile(path))).projectJson).revision).toBe(2)
  expect(
    JSON.parse((await extractClmcZip(await readFile(path + '.bak'))).projectJson).revision
  ).toBe(1)
})
