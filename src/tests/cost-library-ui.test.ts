/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CostLibraryButton, CostLibraryDialog } from '@renderer/components/CostLibraryDialog'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'
import type { CostLibrarySnapshot } from '../shared/cost-library'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const library: CostLibrarySnapshot = {
  formatVersion: 1,
  sourceFilename: 'master.xlsx',
  importedAt: '2026-10-21T01:00:00Z',
  items: [
    {
      code: 'E1',
      description: 'Power outlet',
      category: 'Electrical',
      unit: 'ea',
      material: 100,
      labor: 80
    },
    {
      code: 'F1',
      description: 'Wall paint',
      category: 'Finishes',
      unit: 'm²',
      material: 50,
      labor: 20
    }
  ]
}
const target: BoqItemRow = {
  label: 'Outlet',
  type: 'count',
  uom: 'ea',
  quantity: 2,
  material: 0,
  labor: 0,
  markup: 30,
  materialCost: 0,
  laborCost: 0,
  cost: 0,
  price: 0,
  margin: 0,
  color: null
}
let root: Root
let host: HTMLDivElement
let api: {
  load: ReturnType<typeof vi.fn>
  preview: ReturnType<typeof vi.fn>
  commit: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  downloadTemplate: ReturnType<typeof vi.fn>
}
let close: ReturnType<typeof vi.fn>
const buttons = (): HTMLButtonElement[] => Array.from(document.querySelectorAll('button'))
const button = (text: string): HTMLButtonElement => buttons().find((b) => b.textContent === text)!
async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
  })
}
async function mount(pick = false): Promise<void> {
  await act(async () => {
    root.render(
      React.createElement(CostLibraryDialog, { target: pick ? target : undefined, onClose: close })
    )
  })
}
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  close = vi.fn()
  api = {
    load: vi.fn().mockResolvedValue({ ok: true, value: library }),
    preview: vi.fn().mockResolvedValue({ ok: true, value: { token: 'preview', library } }),
    commit: vi.fn().mockResolvedValue({ ok: true, value: library }),
    cancel: vi.fn().mockResolvedValue(undefined),
    downloadTemplate: vi.fn().mockResolvedValue({ ok: true, value: true })
  }
  Object.defineProperty(window, 'api', { value: { costLibrary: api }, configurable: true })
  useProjectStore.getState().reset()
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

describe('cost library workflow UI', () => {
  it('opens management without a project and restores focus when closed', async () => {
    await act(async () => root.render(React.createElement(CostLibraryButton)))
    const trigger = button('Cost Library')
    trigger.focus()
    await click(trigger)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.textContent).toContain('master.xlsx')
    await click(button('Close'))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('previews without committing; Cancel Import preserves the current library', async () => {
    await mount()
    await click(button('Import CSV / Excel'))
    expect(button('Replace Library')).toBeDefined()
    expect(api.commit).not.toHaveBeenCalled()
    await click(button('Cancel Import'))
    expect(api.cancel).toHaveBeenCalledWith('preview')
    expect(document.querySelector('[data-testid="cost-library-metadata"]')!.textContent).toContain(
      'master.xlsx'
    )
    expect(api.commit).not.toHaveBeenCalled()
  })
  it('replaces only on explicit confirmation and never modifies project rates', async () => {
    useProjectStore.getState().setPrice('Outlet|count', { material: 777, labor: 1, markup: 20 })
    const rates = useProjectStore.getState().rates
    await mount()
    await click(button('Import CSV / Excel'))
    await click(button('Replace Library'))
    expect(api.commit).toHaveBeenCalledExactlyOnceWith('preview')
    expect(document.body.textContent).toContain('Existing project rates are unchanged')
    expect(useProjectStore.getState().rates).toBe(rates)
  })
  it('reports row errors while retaining the previous library', async () => {
    api.preview.mockResolvedValue({
      ok: false,
      reason: 'Fix the listed rows.',
      issues: [{ row: 3, column: 'Unit', message: 'Unsupported unit.' }]
    })
    await mount()
    await click(button('Import CSV / Excel'))
    expect(document.body.textContent).toContain('Row 3, Unit: Unsupported unit.')
    expect(document.body.textContent).toContain('master.xlsx')
    expect(api.commit).not.toHaveBeenCalled()
  })
  it('keeps preview available after a failed replacement', async () => {
    api.commit.mockResolvedValue({ ok: false, reason: 'Disk full. Previous library kept.' })
    await mount()
    await click(button('Import CSV / Excel'))
    await click(button('Replace Library'))
    expect(document.body.textContent).toContain('Previous library kept')
    expect(button('Replace Library')).toBeDefined()
    expect(document.body.textContent).toContain('Current library: master.xlsx')
  })
  it('handles a cancelled file dialog without replacing anything', async () => {
    api.preview.mockResolvedValue({ ok: true, value: null })
    await mount()
    await click(button('Import CSV / Excel'))
    expect(buttons().some((b) => b.textContent === 'Replace Library')).toBe(false)
    expect(api.commit).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(
      'Library import cancelled. Your current library is unchanged.'
    )
  })
  it('blocks mismatch and applies selected compatible rates only on Apply Rates', async () => {
    await mount(true)
    expect((document.querySelector('[aria-label="Select F1"]') as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(button('Apply Rates').disabled).toBe(true)
    await click(document.querySelector('[aria-label="Select E1"]')!)
    expect(useProjectStore.getState().rates).toEqual({})
    await click(button('Apply Rates'))
    expect(useProjectStore.getState().rates['Outlet|count']).toEqual({
      material: 100,
      labor: 80,
      markup: 30,
      basis: 'ea', review: 'reviewed'
    })
    expect(close).toHaveBeenCalledOnce()
  })
  it('filters by category with a controlled search input', async () => {
    await mount(true)
    const input = document.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'Finishes'
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.querySelector('[aria-label="Select E1"]')).toBeNull()
    expect(document.querySelector('[aria-label="Select F1"]')).not.toBeNull()
  })
  it('contains keyboard shortcuts and traps focus; Escape closes', async () => {
    const outside = vi.fn()
    window.addEventListener('keydown', outside)
    await mount()
    const dialog = document.querySelector('[role="dialog"]')!
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', bubbles: true }))
    })
    expect(outside).not.toHaveBeenCalled()
    const last = document.querySelector<HTMLElement>('[data-testid="cost-library-table-scroll"]')!
    last.focus()
    await act(async () => {
      last.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      )
    })
    expect(document.activeElement).toBe(button('Close'))
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(close).toHaveBeenCalledOnce()
    window.removeEventListener('keydown', outside)
  })
  it('downloads the template and handles unavailable local library with actionable feedback', async () => {
    api.load.mockResolvedValue({ ok: false, reason: 'Saved library invalid; import again.' })
    await mount()
    expect(document.body.textContent).toContain('import again')
    await click(button('Download Excel Template'))
    expect(api.downloadTemplate).toHaveBeenCalledOnce()
    expect(document.body.textContent).toContain('Template saved')
  })
  it('shows cancelled downloads explicitly instead of silently clearing the message', async () => {
    api.downloadTemplate.mockResolvedValue({ ok: true, value: false })
    await mount()
    await click(button('Download Excel Template'))
    expect(document.body.textContent).toContain('Template download cancelled. No file was saved.')
    expect(button('Download Excel Template').disabled).toBe(false)
  })
  it('keeps the dialog usable after a rejected desktop download request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.downloadTemplate.mockRejectedValue(new Error('IPC missing'))
    await mount()
    await click(button('Download Excel Template'))
    expect(document.body.textContent).toContain('Could not save the template')
    expect(button('Download Excel Template').disabled).toBe(false)
    expect(console.error).toHaveBeenCalledWith(
      '[cost-library] Template download request failed',
      expect.any(Error)
    )
  })
  it('cancels a staged candidate when the dialog unmounts', async () => {
    await mount()
    await click(button('Import CSV / Excel'))
    await act(async () => root.render(null))
    expect(api.cancel).toHaveBeenCalledWith('preview')
  })
})
