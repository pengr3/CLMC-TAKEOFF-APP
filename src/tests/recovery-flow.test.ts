/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
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
import { useProject } from '@renderer/hooks/useProject'
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
afterEach(async () => { act(() => root.unmount()); container.remove(); await rm(dir, { recursive: true, force: true }) })

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
  useMarkupStore.setState({ categoryItemOrder: { __uncat__: ['Pipe|linear'] }, pageMarkups: { 1: [{ id: 'line', type: 'linear', name: 'Pipe', points: [10, 20, 30, 40], categoryId: null } as never] } })
  useScaleStore.setState({ globalUnit: 'ft', pageScales: { 1: { pixelsPerMm: 2, unit: 'ft' } as never } })
  const expectedPdf = useViewerStore.getState().pdfBytes!.slice()
  expect(await actions.writeRecoverySnapshot()).toBe(true)
  repository = new RecoveryRepository(dir) // No original source PDF or in-memory repository is used on restart.
  const listed = await repository.list()
  expect(listed.ok && listed.candidates).toHaveLength(1)
  if (!listed.ok) throw new Error(listed.message)
  actions.newProject()
  expect(await actions.restoreRecovery(listed.candidates[0].id)).toEqual({ kind: 'ok' })
  expect(useViewerStore.getState().pdfBytes).toEqual(expectedPdf)
  expect(useMarkupStore.getState().pageMarkups[1][0].points).toEqual([10, 20, 30, 40])
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
