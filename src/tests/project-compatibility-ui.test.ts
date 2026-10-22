/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { mkdtemp, readFile, writeFile, rm, link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { handlers, nativeOpen } = vi.hoisted(() => ({ handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>, nativeOpen: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: (key: string, fn: (...args: unknown[]) => Promise<unknown>) => { handlers[key] = fn } }, dialog: { showOpenDialog: nativeOpen }, BrowserWindow: { fromWebContents: () => ({}) } }))
vi.mock('@renderer/hooks/usePdfDocument', () => ({ usePdfDocument: () => ({
  loadPdfFromPath: vi.fn(), loadPdfFromBytes: vi.fn(),
  stagePdfFromBytes: async () => ({ numPages: 1, getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }), destroy: async () => {} }),
  adoptStagedPdf: (doc: unknown, bytes: Uint8Array, name: string) => useViewerStore.setState({ pdfDocument: doc as never, pdfBytes: bytes, totalPages: 1, fileName: name })
}) }))
import { registerIpcHandlers } from '../main/ipc-handlers'
import { writeProtectedProject } from '../main/project-storage'
import { assembleClmcZip, sha256Buffer } from '../main/project-io'
import { useProject } from '@renderer/hooks/useProject'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { snapshotProject } from '@renderer/lib/project-serialize'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let dir: string, original: string, backup: string, pdf: Buffer, oldBytes: Buffer, root: Root, host: HTMLDivElement
let project: ReturnType<typeof useProject>
function Host() { const value = useProject(); useLayoutEffect(() => { project = value }); return null }
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clmc-upgrade-')); original = join(dir, 'old.clmc'); backup = `${original}.bak`
  useProjectStore.getState().reset(); useMarkupStore.getState().reset(); useScaleStore.getState().reset()
  useViewerStore.setState({ currentPage: 1, pageViewports: {} })
  pdf = await readFile(join(__dirname, 'fixtures/sample-1page.pdf'))
  const data = { ...snapshotProject({ pdfOriginalFilename: 'old.pdf', pdfSha256: sha256Buffer(pdf), pdfTotalPages: 1, perPageDimensions: { 1: { width: 595, height: 842 } } }), formatVersion: 2 }
  oldBytes = await assembleClmcZip(JSON.stringify(data), pdf)
  await writeFile(original, oldBytes); await writeFile(backup, oldBytes)
  registerIpcHandlers(() => {})
  Object.assign(window, { api: {
    readProject: (path: string) => handlers['file:readProject']({}, path),
    hashBuffer: async (bytes: Uint8Array) => sha256Buffer(bytes),
    writeProject: (...args: unknown[]) => handlers['file:writeProject']({}, ...args),
    saveProjectDialog: vi.fn(async () => join(dir, 'upgraded.clmc'))
  } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(React.createElement(Host)))
})
afterEach(async () => { act(() => root.unmount()); host.remove(); await rm(dir, { recursive: true, force: true }) })
describe('original-preserving upgrade and backup opens', () => {
  it('rejects original and hardlink aliases in main without changing either file', async () => {
    const alias = join(dir, 'alias.clmc'); await link(original, alias)
    for (const path of [original, alias]) {
      await expect(writeProtectedProject(path, JSON.stringify({ bad: true }), pdf, [original, backup])).rejects.toThrow(/original|copy|destination|preserv/i)
      expect(await readFile(original)).toEqual(oldBytes)
    }
  })
  it('requires upgrade confirmation and saves only a new copy, preserving original bytes', async () => {
    expect(await project.openByExtension(original, '.clmc')).toEqual({ kind: 'ok' })
    useProjectStore.getState().markDirty()
    expect(await project.saveProject()).toBe('canceled')
    expect(useProjectStore.getState()).toMatchObject({ upgradeRequested: true, isDirty: true })
    expect(await project.saveUpgradedCopy()).toBe('ok')
    expect(await readFile(original)).toEqual(oldBytes)
    expect(useProjectStore.getState().currentFilePath).toBe(join(dir, 'upgraded.clmc'))
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
  it('keeps work dirty through same-original selection and native cancellation', async () => {
    await project.openByExtension(original, '.clmc'); useProjectStore.getState().markDirty()
    vi.mocked(window.api.saveProjectDialog).mockResolvedValueOnce(original)
    expect(await project.saveUpgradedCopy()).toBe('error')
    expect(await readFile(original)).toEqual(oldBytes)
    expect(useProjectStore.getState().isDirty).toBe(true)
    vi.mocked(window.api.saveProjectDialog).mockResolvedValueOnce(null)
    expect(await project.saveUpgradedCopy()).toBe('canceled')
    expect(useProjectStore.getState().isDirty).toBe(true)
    expect(useProjectStore.getState().saveFailure).not.toBeNull()
  })
  it('opens a validated backup detached and saves to a new destination', async () => {
    expect(await project.openByExtension(backup, '.bak')).toEqual({ kind: 'ok' })
    expect(useProjectStore.getState()).toMatchObject({ currentFilePath: null, isDirty: true })
    expect(await project.saveProject()).toBe('ok')
    expect(await readFile(original)).toEqual(oldBytes); expect(await readFile(backup)).toEqual(oldBytes)
    expect(window.api.saveProjectDialog).toHaveBeenCalled()
  })
  it('exposes validated adjacent backup only on failed original open', async () => {
    await writeFile(original, 'broken')
    const result = await project.openByExtension(original, '.clmc')
    expect(result).toMatchObject({ kind: 'error', backupPath: backup })
  })
  it('accepts backup files in the actual native picker', async () => {
    nativeOpen.mockResolvedValueOnce({ canceled: false, filePaths: [backup] })
    await handlers['dialog:openProject']({ sender: {} })
    expect(nativeOpen.mock.calls.at(-1)![1].filters.some((f: { extensions: string[] }) => f.extensions.includes('bak'))).toBe(true)
  })
  it('rejects future archives before changing active state and refuses overwriting one as Save As', async () => {
    const future = join(dir, 'future.clmc')
    await writeFile(future, await assembleClmcZip(JSON.stringify({ formatVersion: 4 }), pdf))
    const before = await readFile(future)
    useProjectStore.setState({ currentFilePath: 'keep.clmc', isDirty: true })
    expect(await project.openByExtension(future, '.clmc')).toMatchObject({ kind: 'error' })
    expect(useProjectStore.getState()).toMatchObject({ currentFilePath: 'keep.clmc', isDirty: true })
    await expect(writeProtectedProject(future, '{}', pdf)).rejects.toThrow(/newer|future/i)
    expect(await readFile(future)).toEqual(before)
  })
})
