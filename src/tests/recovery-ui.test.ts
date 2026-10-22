/** @vitest-environment jsdom */
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { RecoveryDialog } from '@renderer/components/RecoveryDialog'
import type { RecoveryCandidate } from '../shared/reliability'
const appActions = vi.hoisted(() => ({
  restoreRecovery: vi.fn(async () => ({ kind: 'ok' })),
  writeRecoverySnapshot: vi.fn(async () => false),
  discardRecovery: vi.fn(async () => true),
  saveProject: vi.fn(async () => 'ok'),
  saveProjectAs: vi.fn(async () => 'ok'),
  retrySaveProject: vi.fn(),
  openByExtension: vi.fn(async () => ({ kind: 'ok' })),
  replacePlanPdf: vi.fn(),
  applyReplacePlanPdf: vi.fn(),
  applyArchiveCorruptedProceed: vi.fn()
}))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => appActions,
  startRecoverySchedule: () => () => {}
}))
vi.mock('@renderer/hooks/usePdfDocument', () => ({
  usePdfDocument: () => ({ loadPdfFromPath: vi.fn(), loadPdfFromBytes: vi.fn() })
}))
vi.mock('@renderer/components/CanvasViewport', () => ({
  CanvasViewport: () => React.createElement('button', null, 'Canvas'),
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  setChainArmedFromTotals: vi.fn()
}))
vi.mock('@renderer/components/ContextBar', () => ({ ContextBar: () => null }))
vi.mock('@renderer/components/ToolRail', () => ({ ToolRail: () => null }))
vi.mock('@renderer/components/TotalsPanel', () => ({ TotalsPanel: () => null }))
vi.mock('@renderer/components/EstimatePanel', () => ({ EstimatePanel: () => null }))
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
let root: Root, host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})
const entry = (id: string, extra: Partial<RecoveryCandidate> = {}): RecoveryCandidate => ({
  id,
  session: id,
  revision: 4,
  filename: 'Unsaved plan.pdf',
  sourcePath: null,
  lastSavedAt: null,
  capturedAt: '2026-10-22T01:00:00Z',
  restorable: true,
  ...extra
})
function button(text: string): HTMLButtonElement {
  const b = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)
  expect(b, text).toBeDefined()
  return b!
}
function key(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}
function click(target: HTMLElement): void {
  act(() => target.click())
}
function render(candidates: RecoveryCandidate[], options: Record<string, unknown> = {}): void {
  act(() =>
    root.render(
      React.createElement(RecoveryDialog, {
        candidates,
        busy: false,
        error: null,
        onKeep: vi.fn(),
        onRecover: vi.fn(),
        onDiscard: vi.fn(async () => ({ ok: true })),
        onRetry: vi.fn(),
        ...options
      } as never)
    )
  )
}

it('requires a separate safe confirmation and never turns Enter or Escape into deletion', async () => {
  const remove = vi.fn(async () => ({ ok: true }))
  render([entry('one')], { onDiscard: remove })
  expect(document.activeElement).toBe(button('Recover Project'))
  click(button('Discard Recovery Copy'))
  expect(document.activeElement).toBe(button('Keep Recovery Copy'))
  key(button('Keep Recovery Copy'), 'Enter')
  expect(remove).not.toHaveBeenCalled()
  key(button('Keep Recovery Copy'), 'Escape')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Recover unsaved work?')
  click(button('Discard Recovery Copy'))
  await act(async () => {
    button('Delete Recovery Copy').click()
  })
  expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', revision: 4 }))
})

it('suppresses an empty prompt and shows single details directly', () => {
  render([])
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  render([entry('one')])
  expect(document.querySelector('[role="radiogroup"]')).toBeNull()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'Not yet saved as a project'
  )
})

it('sorts many candidates newest first and selects exactly one by keyboard in a scrolling list', async () => {
  const recover = vi.fn()
  render(
    [entry('old'), entry('new', { capturedAt: '2026-10-22T02:00:00Z', filename: 'Latest.pdf' })],
    { onRecover: recover }
  )
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
  expect(radios).toHaveLength(2)
  expect(radios[0].checked).toBe(true)
  expect(radios[0].closest('label')?.textContent).toContain('Latest.pdf')
  key(radios[0], 'ArrowDown')
  expect(radios[1].checked).toBe(true)
  await act(async () => button('Recover Project').click())
  expect(recover).toHaveBeenCalledWith('old')
  expect((document.querySelector('[data-recovery-list]') as HTMLElement).style.overflowY).toBe(
    'auto'
  )
})

it('keeps on Escape, contains keyboard and focus, ignores backdrop and restores opener focus', () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const keep = vi.fn()
  render([entry('one')], { onKeep: keep })
  const overlay = document.querySelector('[data-recovery-dialog]')!
  click(overlay as HTMLElement)
  expect(keep).not.toHaveBeenCalled()
  key(button('Recover Project'), 'Tab')
  expect(overlay.contains(document.activeElement)).toBe(true)
  key(button('Recover Project'), 'Escape')
  expect(keep).toHaveBeenCalledOnce()
  act(() => root.unmount())
  root = createRoot(host)
  expect(document.activeElement).toBe(opener)
  opener.remove()
})

it('reports busy state and blocks competing restore, retry, discard and keep actions', () => {
  const recover = vi.fn(),
    discard = vi.fn(),
    keep = vi.fn()
  render([entry('one')], { busy: true, onRecover: recover, onDiscard: discard, onKeep: keep })
  expect(document.querySelector('[role="status"]')?.textContent).toMatch(/Recovering|Checking/)
  for (const b of document.querySelectorAll<HTMLButtonElement>('button'))
    expect(b.disabled).toBe(true)
  key(document.querySelector('[role="dialog"]')!, 'Escape')
  expect(keep).not.toHaveBeenCalled()
  expect(recover).not.toHaveBeenCalled()
  expect(discard).not.toHaveBeenCalled()
})

it('retains corrupt or missing PDFs with specific safe actions and retry, without restore bypass', () => {
  render([entry('one', { restorable: false, problem: 'pdf' })])
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'The recovery PDF is missing or damaged.'
  )
  expect(button('Recover Project').disabled).toBe(true)
  expect(button('Keep for Later').disabled).toBe(false)
  expect(button('Discard Recovery Copy').disabled).toBe(false)
  expect(button('Try Again').disabled).toBe(false)
})

it('retains the selected candidate and explains a failed deletion', async () => {
  render([entry('one')], {
    onDiscard: vi.fn(async () => ({
      ok: false,
      stage: 'delete',
      message: 'Could not delete the recovery copy. It has been kept. Try again later.'
    }))
  })
  click(button('Discard Recovery Copy'))
  await act(async () => button('Delete Recovery Copy').click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('It has been kept')
  expect(document.querySelector('[role="alert"]')?.textContent).not.toContain('incomplete or unreadable')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Unsaved plan.pdf')
})

it('wraps long names and paths with viewport-bound scroll and always-visible actions', () => {
  render([
    entry('one', {
      filename: 'Plan'.repeat(200) + '.pdf',
      sourcePath: 'C:/' + 'long directory/'.repeat(200) + 'estimate.clmc',
      lastSavedAt: 1792630800000
    })
  ])
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  expect(dialog.style.maxHeight).toBe('calc(100dvh - 48px)')
  expect(dialog.style.overflowWrap).toBe('anywhere')
  expect(dialog.textContent).toContain('Last project save:')
  expect((document.querySelector('[data-recovery-actions]') as HTMLElement).style.flexShrink).toBe(
    '0'
  )
})

it('keeps a candidate through prompt unmount and presents it again after a simulated session restart', () => {
  const candidates = [entry('kept')]
  function Session(): React.JSX.Element {
    const [show, setShow] = useState(true)
    return React.createElement(
      'div',
      null,
      show &&
        React.createElement(RecoveryDialog, {
          candidates,
          busy: false,
          error: null,
          onKeep: () => setShow(false),
          onRecover: vi.fn(),
          onDiscard: vi.fn(),
          onRetry: vi.fn()
        } as never)
    )
  }
  act(() => root.render(React.createElement(Session)))
  click(button('Keep for Later'))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  act(() => root.unmount())
  root = createRoot(host)
  act(() => root.render(React.createElement(Session)))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Unsaved plan.pdf')
})

function appBridge(candidates: RecoveryCandidate[]): void {
  useProjectStore.getState().reset()
  useViewerStore.getState().resetViewer()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      listRecovery: vi.fn(async () => ({ ok: true, candidates })),
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      getReleaseInfo: vi.fn(async () => ({
        version: '1.0.0',
        notes: null,
        notesStatus: 'unavailable',
        releaseReady: false
      })),
      deleteRecovery: vi.fn(async () => ({ ok: true })),
      openProject: vi.fn(),
      confirmClose: vi.fn()
    }
  })
}
it('App suppresses zero candidates, keeps without repeating, and reopens retained work from More', async () => {
  appBridge([])
  await act(async () => root.render(React.createElement(App)))
  expect(document.querySelector('[data-recovery-dialog]')).toBeNull()
  act(() => root.unmount())
  root = createRoot(host)
  appBridge([entry('kept')])
  await act(async () => root.render(React.createElement(App)))
  click(button('Keep for Later'))
  expect(document.querySelector('[data-recovery-dialog]')).toBeNull()
  await act(async () => window.dispatchEvent(new Event('clmc:recovery-updated')))
  expect(document.querySelector('[data-recovery-dialog]')).toBeNull()
  click(document.querySelector('[data-testid="overflow-menu-button"]') as HTMLButtonElement)
  await act(async () => button('Recover Unsaved Work').click())
  expect(document.querySelector('[data-recovery-dialog]')).not.toBeNull()
  expect(window.api.deleteRecovery).not.toHaveBeenCalled()
})

it('App reports scanning, performs one restore and keeps its failure decision without changing candidates', async () => {
  appBridge([])
  let finish!: (result: unknown) => void
  window.api.listRecovery = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  ) as never
  await act(async () => root.render(React.createElement(App)))
  expect(document.body.textContent).toContain('Checking recovery copies…')
  expect(document.querySelector('[data-recovery-dialog]')).toBeNull()
  await act(async () => finish({ ok: true, candidates: [entry('one')] }))
  let restore!: (result: { kind: string; message?: string }) => void
  appActions.restoreRecovery.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve
      })
  )
  click(button('Recover Project'))
  expect(button('Recover Project').disabled).toBe(true)
  click(button('Recover Project'))
  await act(async () =>
    restore({
      kind: 'error',
      message: 'The recovery PDF is missing or damaged. This copy cannot be opened safely.'
    })
  )
  expect(document.querySelector('[data-recovery-dialog]')?.textContent).toContain(
    'The recovery PDF is missing or damaged.'
  )
  expect(window.api.deleteRecovery).not.toHaveBeenCalled()
})

it('App shows one persistent protection warning with a working Save Project action and clears it on success', async () => {
  appBridge([])
  await act(async () => root.render(React.createElement(App)))
  act(() =>
    useProjectStore.setState({
      recoveryWarning: 'Recovery copy could not be updated. Save your project now.'
    })
  )
  expect(document.body.textContent?.match(/Recovery copy could not be updated/g)).toHaveLength(1)
  await act(async () => button('Save Project').click())
  expect(appActions.saveProject).toHaveBeenCalled()
  act(() => useProjectStore.setState({ recoveryWarning: null }))
  expect(document.body.textContent).not.toContain('Recovery copy could not be updated')
})
