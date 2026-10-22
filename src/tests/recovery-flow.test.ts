/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256Buffer } from '../main/project-io'
const pdf = vi.hoisted(() => ({ fail: false }))
vi.mock('@renderer/lib/pdf-setup', () => ({
  cloneForPdfWorker: (bytes: Uint8Array) => bytes.slice(),
  pdfjsLib: { getDocument: () => ({ promise: pdf.fail ? Promise.reject(new Error('PDF decode failed')) : Promise.resolve({
    numPages: 1, destroy: vi.fn(async () => {}),
    getPage: async () => ({ getViewport: () => ({ width: 612, height: 792 }) })
  }) }) }
}))
import { useProject, startRecoverySchedule } from '@renderer/hooks/useProject'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let dir: string, root: Root, container: HTMLDivElement
let actions: ReturnType<typeof useProject>
function Harness(): null { actions = useProject(); return null }
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clmc-recovery-flow-'))
  pdf.fail = false
  useProjectStore.getState().reset(); useViewerStore.getState().resetViewer()
  useMarkupStore.getState().reset(); useScaleStore.getState().reset()
  const bytes = new Uint8Array(await readFile('src/tests/fixtures/sample-1page.pdf'))
  useViewerStore.setState({ fileName: 'Never saved plan.pdf', totalPages: 1, pdfBytes: bytes,
    pdfDocument: { numPages: 1, destroy: vi.fn(async () => {}), getPage: async () => ({ getViewport: () => ({ width: 612, height: 792 }) }) } })
  Object.defineProperty(window, 'api', { configurable: true, value: {
    hashBuffer: async (b: Uint8Array) => sha256Buffer(b), saveProjectDialog: vi.fn(async () => null)
  } })
  container = document.createElement('div'); document.body.appendChild(container)
  act(() => { root = createRoot(container); root.render(React.createElement(Harness)) })
})
afterEach(async () => { vi.useRealTimers(); act(() => root.unmount()); container.remove(); await rm(dir, { recursive: true, force: true }) })

async function bridge() {
  const modulePath = '../main/' + 'project-recovery'
  const { RecoveryRepository } = await import(/* @vite-ignore */ modulePath)
  const repo = new RecoveryRepository(dir)
  Object.assign(window.api, { writeRecovery: (i: unknown) => repo.write(i), readRecovery: (id: string) => repo.read(id),
    retireRecoveryRevision: vi.fn((s: string, r: number) => repo.retire(s, r)), recoveryDestinationWritable: vi.fn(async () => true),
    writeProject: vi.fn(async () => ({ ok: true })), readProject: vi.fn(async () => ({ kind: 'unknown' })) })
  return repo
}

it('recovers a completed never-saved PDF and matching project state from disk after restart as dirty', async () => {
  // Assertion is intentionally before loading the new repository, so RED is a missing behavior, not an import failure.
  expect(typeof (actions as unknown as { writeRecoverySnapshot?: unknown }).writeRecoverySnapshot).toBe('function')
  const recoveryModule = '../main/' + 'project-recovery'
  const { RecoveryRepository } = await import(/* @vite-ignore */ recoveryModule)
  let repository = new RecoveryRepository(dir)
  Object.assign(window.api, {
    writeRecovery: (input: unknown) => repository.write(input),
    readRecovery: (id: string) => repository.read(id),
    retireRecoveryRevision: (session: string, revision: number) => repository.retire(session, revision)
  })
  useProjectStore.getState().setPrice('Pipe|linear', { material: 120, labor: 20, markup: 30, basis: 'ft', review: 'reviewed' })
  useMarkupStore.setState({ categoryItemOrder: { __uncat__: ['Pipe|linear'] }, pageMarkups: { 1: [{ id: 'line', type: 'linear', name: 'Pipe', page: 1, color: '#ffffff', createdAt: 1, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], categoryId: '__uncat__' }] } })
  useScaleStore.setState({ globalUnit: 'ft', pageScales: { 1: { pixelsPerMm: 2, displayUnit: 'ft' } } })
  useViewerStore.setState({ pageViewports: { 1: { zoom: 2.5, panX: -41, panY: 12 } } })
  const expectedPdf = useViewerStore.getState().pdfBytes!.slice()
  expect(await actions.writeRecoverySnapshot()).toBe(true)
  repository = new RecoveryRepository(dir) // No original source PDF or in-memory repository is used on restart.
  const listed = await repository.list()
  expect(listed.ok && listed.candidates).toHaveLength(1)
  if (!listed.ok) throw new Error(listed.message)
  actions.newProject()
  expect(await actions.restoreRecovery(listed.candidates[0].id)).toEqual({ kind: 'ok' })
  expect(useViewerStore.getState().pdfBytes).toEqual(expectedPdf)
  expect(useMarkupStore.getState().pageMarkups[1][0].points).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }])
  expect(useViewerStore.getState().pageViewports[1]).toEqual({ zoom: 2.5, panX: -41, panY: 12 })
  expect(useMarkupStore.getState().categoryItemOrder).toEqual({ __uncat__: ['Pipe|linear'] })
  expect(useScaleStore.getState().pageScales[1].pixelsPerMm).toBe(2)
  expect(useProjectStore.getState().rates['Pipe|linear'].basis).toBe('ft')
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(useProjectStore.getState().lastSaveOutcome).toBeNull()
  expect(useProjectStore.getState().currentFilePath).toBeNull()
  expect(await actions.saveProject()).toBe('canceled')
  expect(window.api.saveProjectDialog).toHaveBeenCalledOnce()
  await expect(stat(join(dir, 'Never saved plan.pdf'))).rejects.toThrow()
})

it('restores a saved association without writing the source, then retires only after matching successful Save', async () => {
  const repo = await bridge(), path = join(dir, 'original.clmc')
  await writeFile(path, 'original bytes')
  useProjectStore.getState().setCurrentFilePath(path); useProjectStore.getState().markDirty()
  expect(await actions.writeRecoverySnapshot()).toBe(true)
  const session = useProjectStore.getState().documentSessionId
  actions.newProject()
  expect(await actions.restoreRecovery(session)).toEqual({ kind: 'ok' })
  expect(useProjectStore.getState().currentFilePath).toBe(path)
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(window.api.writeProject).not.toHaveBeenCalled()
  expect(await readFile(path, 'utf8')).toBe('original bytes')
  expect(await actions.saveProject()).toBe('ok')
  expect(window.api.writeProject).toHaveBeenCalledWith(path, expect.any(String), expect.any(Uint8Array))
  expect(await repo.list()).toMatchObject({ ok: true, candidates: [] })
})

it('routes unavailable or read-only restored destinations through native Save As and keeps recovery on cancellation or failed save', async () => {
  const repo = await bridge()
  useProjectStore.getState().setCurrentFilePath(join(dir, 'unavailable.clmc')); useProjectStore.getState().markDirty()
  await actions.writeRecoverySnapshot(); const session = useProjectStore.getState().documentSessionId
  actions.newProject(); await actions.restoreRecovery(session)
  window.api.recoveryDestinationWritable = vi.fn(async () => false)
  expect(await actions.saveProject()).toBe('canceled')
  expect(window.api.saveProjectDialog).toHaveBeenCalledOnce()
  expect(window.api.writeProject).not.toHaveBeenCalled()
  expect((await repo.read(session)).ok).toBe(true)
  window.api.recoveryDestinationWritable = vi.fn(async () => true)
  window.api.writeProject = vi.fn(async () => ({ ok: false, stage: 'replace', message: 'locked', firstSave: false }))
  expect(await actions.saveProject()).toBe('error')
  expect((await repo.read(session)).ok).toBe(true)
  expect(window.api.retireRecoveryRevision).not.toHaveBeenCalled()
})

it('preserves the active PDF, all stores and local library bytes on metadata, checksum, or PDF loading failure', async () => {
  const repo = await bridge(), library = join(dir, 'cost-library.json')
  await writeFile(library, 'independent local library')
  useProjectStore.getState().setDefaultMarkupPct(47); await actions.writeRecoverySnapshot()
  const session = useProjectStore.getState().documentSessionId
  actions.newProject()
  const activePdf = new Uint8Array([1, 2, 3]), activeDoc = { numPages: 1, destroy: vi.fn(async () => {}) }
  useViewerStore.setState({ pdfBytes: activePdf, pdfDocument: activeDoc, fileName: 'active.pdf', totalPages: 1 })
  useProjectStore.getState().setDefaultMarkupPct(88)
  const state = useProjectStore.getState(), viewer = useViewerStore.getState(), markup = useMarkupStore.getState(), scale = useScaleStore.getState()
  pdf.fail = true
  expect(await actions.restoreRecovery(session)).toMatchObject({ kind: 'error', message: 'PDF decode failed' })
  expect(useProjectStore.getState()).toBe(state); expect(useViewerStore.getState()).toBe(viewer)
  expect(useMarkupStore.getState()).toBe(markup); expect(useScaleStore.getState()).toBe(scale)
  expect(activeDoc.destroy).not.toHaveBeenCalled()
  expect(await readFile(library, 'utf8')).toBe('independent local library')
  expect((await repo.read(session)).ok).toBe(true)
  pdf.fail = false
  const actual = await repo.read(session); if (!actual.ok) throw new Error(actual.message)
  window.api.readRecovery = async () => ({ ...actual, projectJson: JSON.stringify({ ...JSON.parse(actual.projectJson), pages: [null] }) })
  expect(await actions.restoreRecovery(session)).toMatchObject({ kind: 'error' })
  expect(useProjectStore.getState()).toBe(state); expect(useViewerStore.getState()).toBe(viewer)
  window.api.readRecovery = async () => ({ ...actual, pdfBytes: new Uint8Array([0]) })
  expect(await actions.restoreRecovery(session)).toMatchObject({ kind: 'error' })
  expect(useProjectStore.getState()).toBe(state); expect(useViewerStore.getState()).toBe(viewer)
})

it('schedules dirty capture every 60 seconds, deduplicates revisions and retains one persistent warning until retry succeeds', async () => {
  await bridge(); vi.useFakeTimers()
  const write = vi.spyOn(window.api, 'writeRecovery')
  const stop = startRecoverySchedule(actions.writeRecoverySnapshot)
  await vi.advanceTimersByTimeAsync(60_000); expect(write).not.toHaveBeenCalled()
  useProjectStore.getState().markDirty()
  await vi.advanceTimersByTimeAsync(59_999); expect(write).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1); expect(write).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(60_000); expect(write).toHaveBeenCalledOnce()
  useProjectStore.getState().markDirty()
  write.mockResolvedValueOnce({ ok: false, stage: 'quota', message: 'full' })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(useProjectStore.getState().recoveryWarning).toBe('Recovery copy could not be updated. Save your project now.')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(useProjectStore.getState().recoveryWarning).toBeNull()
  expect(useProjectStore.getState().isDirty).toBe(true)
  stop()
})

it('explicit live discard retires the captured recovery revision and protects other sessions', async () => {
  const repo = await bridge()
  useProjectStore.getState().markDirty(); await actions.writeRecoverySnapshot()
  const session = useProjectStore.getState().documentSessionId
  useProjectStore.getState().markDirty()
  expect(await actions.discardRecovery()).toBe(true)
  expect((await repo.read(session)).ok).toBe(false)
})
