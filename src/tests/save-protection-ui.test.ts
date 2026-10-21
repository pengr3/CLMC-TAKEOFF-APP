/** @vitest-environment jsdom */
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
vi.mock('@renderer/components/CanvasViewport', () => ({
  CanvasViewport: () => React.createElement('button', { id: 'canvas-control' }, 'Canvas'),
  getCanvasControls: () => null,
  setChainArmedFromTotals: vi.fn()
}))
vi.mock('@renderer/components/ContextBar', () => ({ ContextBar: () => null }))
vi.mock('@renderer/components/ToolRail', () => ({ ToolRail: () => null }))
vi.mock('@renderer/components/TotalsPanel', () => ({ TotalsPanel: () => null }))
vi.mock('@renderer/components/EstimatePanel', () => ({ EstimatePanel: () => null }))
vi.mock('@renderer/hooks/usePdfDocument', () => ({
  usePdfDocument: () => ({ loadPdfFromPath: vi.fn(), loadPdfFromBytes: vi.fn() })
}))
vi.mock('@renderer/hooks/useUiPanels', () => ({
  useUiPanels: () => ({
    totals: { open: false, width: 300 },
    setTotalsOpen: vi.fn(),
    setTotalsWidth: vi.fn()
  })
}))
vi.mock('@renderer/hooks/useExport', () => ({
  useExport: () => ({ exportBoq: vi.fn(), applyExportAfterConfirm: vi.fn() })
}))
import App from '@renderer/App'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement, closeRequest: () => void
const path = 'C:/projects/' + 'long-directory/'.repeat(50) + 'estimate.clmc'
beforeEach(() => {
  useProjectStore.getState().reset()
  useProjectStore.getState().setCurrentFilePath(path)
  useProjectStore.getState().markDirty()
  useViewerStore.getState().resetViewer()
  useViewerStore.setState({
    fileName: 'plan.pdf',
    totalPages: 1,
    pdfBytes: new Uint8Array([37, 80, 68, 70]),
    pdfDocument: {
      numPages: 1,
      getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) })
    }
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      hashBuffer: vi.fn(async () => 'hash'),
      readProject: vi.fn(async () => ({ kind: 'unknown' })),
      writeProject: vi.fn(async () => ({
        ok: false,
        stage: 'backup',
        message: 'EACCES ' + path,
        firstSave: false
      })),
      saveProjectDialog: vi.fn(async () => 'C:/elsewhere/copy.clmc'),
      openProject: vi.fn(async () => null),
      onCloseRequest: (fn: () => void) => {
        closeRequest = fn
      },
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container)
    root.render(React.createElement(App))
  })
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})
const button = (text: string): HTMLButtonElement =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
  })
}
function key(element: Element, key: string, extra: KeyboardEventInit = {}): void {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
    )
  })
}
async function failSave(): Promise<void> {
  const save = document.querySelector<HTMLButtonElement>('[title="Save (Ctrl+S)"]')!
  save.focus()
  await click(save)
}

it('shows a persistent shared save failure with truthful stage detail and all actions', async () => {
  vi.useFakeTimers()
  await failSave()
  const dialog = document.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="Could not save project"]'
  )
  expect(dialog).not.toBeNull()
  expect(dialog!.textContent).toContain(
    'Could not preserve the previous saved version. The save was stopped.'
  )
  expect(dialog!.textContent).toContain(path)
  for (const label of ['Close', 'Save As', 'Try Again']) expect(button(label)).toBeDefined()
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(window.api.confirmClose).not.toHaveBeenCalled()
  expect(dialog!.style.maxHeight).toContain('100')
  expect(dialog!.style.overflowY).toBe('auto')
  expect(dialog!.style.overflowWrap).toBe('anywhere')
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(document.querySelector('[aria-label="Could not save project"]')).toBe(dialog)
})

it('traps focus and global keys, uses focused-control Enter, and restores focus on Escape', async () => {
  const save = document.querySelector<HTMLButtonElement>('[title="Save (Ctrl+S)"]')!
  await failSave()
  expect(document.activeElement).toBe(button('Try Again'))
  key(button('Try Again'), 'Tab')
  expect(document.activeElement).toBe(button('Close'))
  key(button('Close'), 'Tab', { shiftKey: true })
  expect(document.activeElement).toBe(button('Try Again'))
  const bubbled = vi.fn()
  window.addEventListener('keydown', bubbled)
  key(button('Close'), 'Delete')
  key(button('Close'), 's', { ctrlKey: true })
  expect(bubbled).not.toHaveBeenCalled()
  const writes = vi.mocked(window.api.writeProject).mock.calls.length
  button('Close').focus()
  key(button('Close'), 'Enter')
  expect(vi.mocked(window.api.writeProject).mock.calls.length).toBe(writes)
  // jsdom does not synthesize native Enter clicks; the dialog must not reinterpret it.
  key(button('Close'), 'Escape')
  expect(document.querySelector('[aria-label="Could not save project"]')).toBeNull()
  expect(document.activeElement).toBe(save)
  expect(useProjectStore.getState().isDirty).toBe(true)
  window.removeEventListener('keydown', bubbled)
})

it('retries and offers Save As without closing the project or losing the failure on cancellation', async () => {
  await failSave()
  await click(button('Try Again'))
  expect(window.api.writeProject).toHaveBeenCalledTimes(2)
  window.api.saveProjectDialog = vi.fn(async () => null)
  await click(button('Save As'))
  expect(document.querySelector('[aria-label="Could not save project"]')).not.toBeNull()
  window.api.saveProjectDialog = vi.fn(async () => 'C:/elsewhere/copy.clmc')
  window.api.writeProject = vi.fn(async () => ({ ok: true }))
  await click(button('Save As'))
  expect(useProjectStore.getState().currentFilePath).toBe('C:/elsewhere/copy.clmc')
  expect(useProjectStore.getState().isDirty).toBe(false)
  expect(document.querySelector('[aria-label="Could not save project"]')).toBeNull()
})

it('keyboard save shares the failure modal and first-save copy never claims a backup', async () => {
  act(() => useProjectStore.getState().setCurrentFilePath(null))
  window.api.writeProject = vi.fn(async () => ({
    ok: false,
    stage: 'write',
    message: 'ENOSPC',
    firstSave: true
  }))
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
  })
  expect(document.querySelector('[aria-label="Could not save project"]')?.textContent).toContain(
    'No project file was saved.'
  )
  expect(
    document.querySelector('[aria-label="Could not save project"]')?.textContent
  ).not.toContain('backup')
  await click(button('Try Again'))
  expect(window.api.saveProjectDialog).toHaveBeenCalledTimes(1)
  expect(vi.mocked(window.api.writeProject).mock.calls.at(-1)?.[0]).toBe('C:/elsewhere/copy.clmc')
})

it('keeps newer work open after an older revision saves from the close guard', async () => {
  act(() => closeRequest())
  window.api.writeProject = vi.fn(async () => {
    useProjectStore.getState().markDirty()
    return { ok: true }
  })
  await click(button('Save'))
  expect(window.api.confirmClose).not.toHaveBeenCalled()
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(document.body.textContent).toContain(
    'Earlier changes saved. Newer changes are still unsaved.'
  )
  expect(document.querySelector('[aria-label="Save changes before closing"]')).not.toBeNull()
})

it('blocks repeated save, project switches and close while I/O is busy', async () => {
  let finish!: (value: { ok: true }) => void
  window.api.writeProject = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const save = document.querySelector<HTMLButtonElement>('[title="Save (Ctrl+S)"]')!
  await click(save)
  expect(document.body.textContent).toContain('Saving…')
  expect(save.getAttribute('aria-disabled')).toBe('true')
  await click(save)
  const open = button('Open')
  expect(open.disabled).toBe(true)
  act(() => closeRequest())
  expect(document.querySelector('[aria-label="Save changes before closing"]')).toBeNull()
  key(window.document.body, 's', { ctrlKey: true })
  key(window.document.body, 'o', { ctrlKey: true })
  expect(window.api.openProject).not.toHaveBeenCalled()
  expect(window.api.writeProject).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish({ ok: true })
  })
})

it('keeps only the failure decision after a close-save error, and Close preserves the open project', async () => {
  act(() => closeRequest())
  await click(button('Save'))
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(document.querySelector('[aria-label="Could not save project"]')).not.toBeNull()
  await click(button('Close'))
  expect(window.api.confirmClose).not.toHaveBeenCalled()
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(useProjectStore.getState().currentFilePath).toBe(path)
})

it('resumes a requested close only after a successful retry of all current work', async () => {
  act(() => closeRequest())
  await click(button('Save'))
  window.api.writeProject = vi.fn(async () => ({ ok: true }))
  await click(button('Try Again'))
  expect(window.api.confirmClose).toHaveBeenCalledTimes(1)
})

it('does not open another project when edits arrive during a guarded save', async () => {
  window.api.openProject = vi.fn(async () => ({ filePath: 'C:/other.clmc', extension: '.clmc', fileName: 'other.clmc' }))
  await click(button('Open'))
  window.api.writeProject = vi.fn(async () => { useProjectStore.getState().markDirty(); return { ok: true } })
  await click(button('Save'))
  expect(window.api.readProject).not.toHaveBeenCalledWith('C:/other.clmc')
  expect(useProjectStore.getState().currentFilePath).toBe(path)
  expect(useProjectStore.getState().isDirty).toBe(true)
})
