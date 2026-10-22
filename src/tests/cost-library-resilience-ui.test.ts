/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CostLibraryDialog, CostLibraryButton } from '@renderer/components/CostLibraryDialog'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'
import { LIBRARY_IMPORT_MESSAGES } from '../shared/cost-library'
import { runLibraryWorkerHarness } from './fixtures/run-library-worker'
import type {
  CostLibraryApi,
  CostLibrarySnapshot,
  LibraryPreview,
  LibraryResult
} from '../shared/cost-library'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const library: CostLibrarySnapshot = {
  formatVersion: 1,
  sourceFilename: 'existing.xlsx',
  importedAt: '2026-10-22T00:00:00Z',
  items: [
    {
      code: 'ONE',
      description: 'Paint',
      category: 'Finishes',
      unit: 'm²',
      material: 100,
      labor: 50
    }
  ]
}
let root: Root
let host: HTMLDivElement
let api: CostLibraryApi
const target: BoqItemRow = {
  label: 'Paint',
  type: 'area',
  uom: 'm²',
  quantity: 1,
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
const button = (name: string): HTMLButtonElement =>
  Array.from(document.querySelectorAll('button')).find((element) => element.textContent === name)!
const click = async (element: HTMLElement): Promise<void> => {
  await act(async () => element.click())
}
const mount = async (): Promise<void> => {
  await act(async () => root.render(React.createElement(CostLibraryDialog, { onClose: vi.fn() })))
}
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  api = {
    load: vi.fn().mockResolvedValue({ ok: true, value: library }),
    preview: vi.fn(),
    commit: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    downloadTemplate: vi.fn()
  }
  Object.defineProperty(window, 'api', { value: { costLibrary: api }, configurable: true })
  useProjectStore.getState().reset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
it.each(['timeout', 'resource', 'parser'] as const)(
  'UI-05/error %s retains library/rates and allows retry and close',
  async (code) => {
    useProjectStore.getState().setPrice('Paint|area', { material: 777, labor: 123, markup: 42 })
    const rates = useProjectStore.getState().rates
    vi.mocked(api.preview).mockResolvedValue({ ok: false, code, reason: 'backend category' })
    await mount()
    await click(button('Import CSV / Excel'))
    expect(document.body.textContent).toContain(LIBRARY_IMPORT_MESSAGES[code])
    expect(document.body.textContent).toContain('Current library: existing.xlsx')
    expect(button('Replace Library')).toBeUndefined()
    expect(button('Import CSV / Excel').disabled).toBe(false)
    expect(button('Close').disabled).toBe(false)
    expect(useProjectStore.getState().rates).toBe(rates)
    expect(api.commit).not.toHaveBeenCalled()
  }
)
it('UI-05/error retries after a real supervisor termination and explicitly replaces a real parsed preview', async () => {
  const actual = await runLibraryWorkerHarness()
  expect(actual.success.ok).toBe(true)
  const parsed = actual.success.ok
    ? { ...library, sourceFilename: 'valid.xlsx', items: actual.success.value }
    : library
  vi.mocked(api.preview)
    .mockResolvedValueOnce(actual.timed as LibraryResult<LibraryPreview | null>)
    .mockResolvedValueOnce({ ok: true, value: { token: 'real-child-preview', library: parsed } })
  vi.mocked(api.commit).mockResolvedValue({ ok: true, value: parsed })
  const rates = useProjectStore.getState().rates
  await mount()
  await click(button('Import CSV / Excel'))
  expect(document.body.textContent).toContain(LIBRARY_IMPORT_MESSAGES.timeout)
  expect(button('Replace Library')).toBeUndefined()
  button('Import CSV / Excel').focus()
  await click(button('Import CSV / Excel'))
  expect(document.body.textContent).toContain('REAL-001')
  expect(api.commit).not.toHaveBeenCalled()
  await click(button('Replace Library'))
  expect(api.commit).toHaveBeenCalledExactlyOnceWith('real-child-preview')
  expect(useProjectStore.getState().rates).toBe(rates)
}, 45000)
it('UI-05/empty distinguishes an absent library from an empty search', async () => {
  vi.mocked(api.load).mockResolvedValue({ ok: true, value: null })
  await mount()
  expect(document.body.textContent).toContain(
    'No cost library on this PC. Download the template, fill your rates, then import it.'
  )
  expect(document.body.textContent).not.toContain('No matching items')
  vi.mocked(api.preview).mockResolvedValue({ ok: true, value: { token: 'valid', library } })
  await click(button('Import CSV / Excel'))
  const search = document.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      search,
      'no such code'
    )
    search.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(document.body.textContent).toContain('No matching items. Try another search.')
  expect(document.body.textContent).toContain('Showing 0 of 0 matching items')
})
it('UI-05/populated and zero-one-many preserve real counts and the preview display cap', async () => {
  const many = {
    ...library,
    items: Array.from({ length: 10000 }, (_, index) => ({
      ...library.items[0],
      code: `ITEM-${index}`
    }))
  }
  vi.mocked(api.preview).mockResolvedValue({ ok: true, value: { token: 'many', library: many } })
  await mount()
  expect(document.body.textContent).toContain('Showing 1 of 1 matching items')
  await click(button('Import CSV / Excel'))
  expect(document.body.textContent).toContain('10,000 items')
  expect(document.body.textContent).toContain('Showing 20 of 10,000 matching items')
  expect(document.querySelectorAll('tbody tr')).toHaveLength(20)
  for (const heading of ['Item', 'Category', 'Unit', 'Material / unit', 'Labor / unit'])
    expect(document.body.textContent).toContain(heading)
  expect(button('Replace Library')).toBeDefined()
  expect(
    document
      .querySelector('[data-testid="cost-library-content"]')
      ?.contains(button('Replace Library'))
  ).toBe(false)
  expect(
    document.querySelector<HTMLElement>('[data-testid="cost-library-preview-footer"]')!.style
      .flexShrink
  ).toBe('0')
})
it('UI-05/partial and row-limit keep all row errors visible without partial replacement', async () => {
  vi.mocked(api.preview)
    .mockResolvedValueOnce({
      ok: false,
      reason: 'Fix the listed rows. Nothing was replaced.',
      issues: [
        { row: 3, column: 'Unit', message: 'Unsupported unit.' },
        { row: 9, column: 'Labor Unit Rate', message: 'Use a finite positive number.' }
      ]
    })
    .mockResolvedValueOnce({ ok: false, reason: 'Use at most 10,000 item rows.' })
  await mount()
  await click(button('Import CSV / Excel'))
  expect(document.querySelector('[aria-label="Import errors"]')?.textContent).toContain(
    'Row 3, Unit: Unsupported unit.'
  )
  expect(document.body.textContent).toContain('Row 9, Labor Unit Rate')
  expect(button('Replace Library')).toBeUndefined()
  await click(button('Import CSV / Excel'))
  expect(document.body.textContent).toContain('Use at most 10,000 item rows.')
  expect(api.commit).not.toHaveBeenCalled()
})
it('UI-05/loading announces replacing and blocks competing actions', async () => {
  vi.mocked(api.preview).mockResolvedValue({ ok: true, value: { token: 'one', library } })
  let complete!: (result: LibraryResult<CostLibrarySnapshot>) => void
  vi.mocked(api.commit).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  await mount()
  await click(button('Import CSV / Excel'))
  await click(button('Replace Library'))
  expect(document.body.textContent).toContain('Replacing library…')
  for (const name of [
    'Close',
    'Import CSV / Excel',
    'Download Excel Template',
    'Replace Library',
    'Cancel Import'
  ])
    expect(button(name).disabled).toBe(true)
  await act(async () => complete({ ok: true, value: library }))
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('false')
})
it('UI-05/overflow and long-text retain independent scroll, wrapping and tabular money', async () => {
  vi.mocked(api.load).mockResolvedValue({
    ok: true,
    value: {
      ...library,
      sourceFilename: 'long-file-'.repeat(50) + '.xlsx',
      items: [
        {
          ...library.items[0],
          code: 'LONG-CODE-'.repeat(45),
          description: 'Construction specification '.repeat(15)
        }
      ]
    }
  })
  await act(async () =>
    root.render(React.createElement(CostLibraryDialog, { target, onClose: vi.fn() }))
  )
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  const scroll = document.querySelector<HTMLElement>('[data-testid="cost-library-table-scroll"]')!
  expect(dialog.style.maxHeight).toBe('calc(100vh - 48px)')
  expect(dialog.style.overflowWrap).toBe('anywhere')
  expect(scroll.style.overflow).toBe('auto')
  expect(scroll.contains(button('Close'))).toBe(false)
  expect(scroll.contains(button('Apply Rates'))).toBe(false)
  expect(document.querySelector<HTMLElement>('thead')!.style.position).toBe('sticky')
  const material = document.querySelectorAll<HTMLElement>('tbody td')[3]
  expect(material.style.textAlign).toBe('right')
  expect(material.style.fontVariantNumeric).toBe('tabular-nums')
  expect(document.body.textContent).toContain('LONG-CODE-'.repeat(45))
})
it('contains shortcuts, traps focus in both directions and restores the 28px row control', async () => {
  await act(async () => root.render(React.createElement(CostLibraryButton, { target })))
  const trigger = document.querySelector<HTMLButtonElement>('button')!
  expect(trigger.style.minWidth).toBe('28px')
  expect(trigger.style.minHeight).toBe('28px')
  trigger.focus()
  await click(trigger)
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  const outside = vi.fn()
  window.addEventListener('keydown', outside)
  const actions = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
    )
  )
  actions.at(-1)!.focus()
  await act(async () =>
    actions
      .at(-1)!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  )
  expect(document.activeElement).toBe(actions[0])
  await act(async () =>
    actions[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    )
  )
  expect(document.activeElement).toBe(actions.at(-1))
  await act(async () =>
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  )
  expect(outside).not.toHaveBeenCalled()
  await click(button('Close'))
  expect(document.activeElement).toBe(trigger)
  window.removeEventListener('keydown', outside)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})
it('UI-05/loading announces checking and disables competing actions until completion', async () => {
  let complete!: (result: LibraryResult<LibraryPreview | null>) => void
  vi.mocked(api.preview).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  await mount()
  await click(button('Import CSV / Excel'))
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('true')
  expect(document.body.textContent).toContain(
    'Checking workbook… Your current library is unchanged.'
  )
  expect(button('Download Excel Template').disabled).toBe(true)
  expect(button('Close').disabled).toBe(true)
  await act(async () => complete({ ok: true, value: null }))
  expect(button('Close').disabled).toBe(false)
})
