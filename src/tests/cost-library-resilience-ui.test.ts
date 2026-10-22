/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CostLibraryDialog } from '@renderer/components/CostLibraryDialog'
import type { CostLibraryApi, CostLibrarySnapshot, LibraryPreview, LibraryResult } from '../shared/cost-library'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const library: CostLibrarySnapshot = { formatVersion: 1, sourceFilename: 'existing.xlsx', importedAt: '2026-10-22T00:00:00Z', items: [{ code: 'ONE', description: 'Paint', category: 'Finishes', unit: 'm²', material: 100, labor: 50 }] }
let root: Root
let host: HTMLDivElement
let api: CostLibraryApi
const button = (name: string): HTMLButtonElement => Array.from(document.querySelectorAll('button')).find((element) => element.textContent === name)!
const click = async (element: HTMLElement): Promise<void> => { await act(async () => element.click()) }
const mount = async (): Promise<void> => { await act(async () => root.render(React.createElement(CostLibraryDialog, { onClose: vi.fn() }))) }
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  api = { load: vi.fn().mockResolvedValue({ ok: true, value: library }), preview: vi.fn(), commit: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined), downloadTemplate: vi.fn() }
  Object.defineProperty(window, 'api', { value: { costLibrary: api }, configurable: true })
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
it('UI-05/loading announces checking and disables competing actions until completion', async () => {
  let complete!: (result: LibraryResult<LibraryPreview | null>) => void
  vi.mocked(api.preview).mockImplementation(() => new Promise((resolve) => { complete = resolve }))
  await mount()
  await click(button('Import CSV / Excel'))
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('true')
  expect(document.body.textContent).toContain('Checking workbook… Your current library is unchanged.')
  expect(button('Download Excel Template').disabled).toBe(true)
  expect(button('Close').disabled).toBe(true)
  await act(async () => complete({ ok: true, value: null }))
  expect(button('Close').disabled).toBe(false)
})
