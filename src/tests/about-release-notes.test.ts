/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopActionBar } from '@renderer/components/TopActionBar'
import { AboutDialog, NOTES_UNAVAILABLE } from '@renderer/components/AboutDialog'
import { readReleaseInfo } from '../main/release-info'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReleaseInfo } from '../shared/release-info'
vi.mock('@renderer/components/CanvasViewport', () => ({ getCanvasControls: () => null }))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({ saveProject: vi.fn(), saveProjectAs: vi.fn() })
}))
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
function key(el: Element, value: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  })
}
it('opens More by keyboard and invokes About with focus restored to More', () => {
  const about = vi.fn()
  act(() =>
    root.render(
      React.createElement(TopActionBar, {
        onOpenClick: vi.fn(),
        onReplaceClick: vi.fn(),
        onExportClick: vi.fn(),
        onAboutClick: about
      })
    )
  )
  const more = container.querySelector('[data-testid="overflow-menu-button"]') as HTMLButtonElement
  more.focus()
  key(more, 'ArrowDown')
  expect(document.querySelector('[role="menuitem"]')?.textContent).toBe('About CLMC Takeoff')
  const item = document.querySelector('[role="menuitem"]')!
  expect(document.activeElement).toBe(item)
  key(item, 'Enter')
  expect(about).toHaveBeenCalledTimes(1)
  expect(document.activeElement).toBe(more)
  expect(document.querySelector('[role="menu"]')).toBeNull()
})
it('exposes recovery only from a supplied actual-candidate flag and handles arrows Space Escape', () => {
  const recover = vi.fn()
  const render = (available: boolean): void => {
    act(() =>
      root.render(
        React.createElement(TopActionBar, {
          onOpenClick: vi.fn(),
          onReplaceClick: vi.fn(),
          onExportClick: vi.fn(),
          recoveryAvailable: available,
          onRecoverClick: recover
        })
      )
    )
  }
  render(false)
  let more = container.querySelector('[data-testid="overflow-menu-button"]')!
  key(more, ' ')
  expect(document.body.textContent).not.toContain('Recover Unsaved Work')
  key(document.querySelector('[role="menuitem"]')!, 'Escape')
  render(true)
  more = container.querySelector('[data-testid="overflow-menu-button"]')!
  key(more, 'Enter')
  key(document.querySelector('[role="menuitem"]')!, 'ArrowDown')
  expect(document.activeElement?.textContent).toBe('Recover Unsaved Work')
  key(document.activeElement!, ' ')
  expect(recover).toHaveBeenCalledTimes(1)
})

const available: ReleaseInfo = {
  version: '1.0.0',
  notes: {
    version: '1.0.0',
    changes: ['Offline note <script>literal text</script>', 'Long note '.repeat(1000)],
    compatibility: 'Keep a pre-upgrade copy.'
  },
  notesStatus: 'available',
  releaseReady: true
}
it('keeps About usable pending and after transport failure without inventing version or notes', async () => {
  window.api = { getReleaseInfo: () => new Promise(() => {}) } as Window['api']
  const onClose = vi.fn()
  await act(async () =>
    root.render(React.createElement(AboutDialog, { onClose, projectPath: null }))
  )
  expect(document.body.textContent).toContain('Loading version…')
  expect(document.body.textContent).not.toContain('Version 1.0.0')
  const close = document.querySelector('[role="dialog"] button')!
  act(() => (close as HTMLButtonElement).click())
  expect(onClose).toHaveBeenCalledTimes(1)
  act(() => root.render(null))
  window.api.getReleaseInfo = vi.fn().mockRejectedValue(new Error('unavailable'))
  await act(async () =>
    root.render(React.createElement(AboutDialog, { onClose, projectPath: null }))
  )
  expect(document.body.textContent).toContain('Version unavailable')
  expect(document.body.textContent).toContain(NOTES_UNAVAILABLE)
  expect(document.querySelector('[role="dialog"]')?.getAttribute('data-release-ready')).toBe(
    'false'
  )
})
it('contains focus and keyboard, restores the invoker, wraps paths and keeps Close outside the internal scroll', async () => {
  const invoker = document.createElement('button')
  document.body.append(invoker)
  invoker.focus()
  const onClose = vi.fn(() => {
    root.render(null)
  })
  const path = 'C:/' + 'Long project '.repeat(100) + '.clmc'
  window.api = { getReleaseInfo: vi.fn().mockResolvedValue(available) } as unknown as Window['api']
  const leaked = vi.fn()
  window.addEventListener('keydown', leaked)
  await act(async () =>
    root.render(React.createElement(AboutDialog, { onClose, projectPath: path }))
  )
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  const close = dialog.querySelector('button')!
  const scroll = dialog.querySelector('[data-testid="about-scroll-content"]') as HTMLElement
  expect(document.activeElement).toBe(close)
  key(close, 'Tab')
  expect(document.activeElement).toBe(scroll)
  key(scroll, 'Tab')
  expect(document.activeElement).toBe(close)
  act(() =>
    close.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    )
  )
  expect(document.activeElement).toBe(scroll)
  key(scroll, 'Enter')
  expect(onClose).not.toHaveBeenCalled()
  key(close, 'Tab')
  key(scroll, 'Delete')
  key(scroll, 's')
  expect(leaked).not.toHaveBeenCalled()
  expect(scroll.contains(close)).toBe(false)
  expect(scroll.style.overflowY).toBe('auto')
  expect(dialog.style.maxHeight).toBe('calc(100dvh - 48px)')
  expect(dialog.style.overflowWrap).toBe('anywhere')
  expect(scroll.textContent).toContain(path + '.bak')
  expect(scroll.querySelector('script')).toBeNull()
  expect(scroll.textContent).toContain(
    'Updates are installed manually. Ask your internal maintainer for the approved installer.'
  )
  expect(scroll.textContent).toContain('first save does not create')
  act(() => dialog.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(onClose).not.toHaveBeenCalled()
  key(close, 'Escape')
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(document.activeElement).toBe(invoker)
  window.removeEventListener('keydown', leaked)
  invoker.remove()
})
it('fails release acceptance for missing malformed or mismatched notes and accepts the matching bundled version', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'clmc-release-'))
  try {
    const path = join(folder, 'notes.json')
    expect((await readReleaseInfo('1.0.0', path)).releaseReady).toBe(false)
    await writeFile(path, '{bad')
    expect((await readReleaseInfo('1.0.0', path)).notesStatus).toBe('unavailable')
    await writeFile(path, JSON.stringify(available.notes))
    expect(await readReleaseInfo('2.0.0', path)).toMatchObject({
      version: '2.0.0',
      notes: null,
      notesStatus: 'version-mismatch',
      releaseReady: false
    })
    expect((await readReleaseInfo('1.0.0', path)).releaseReady).toBe(true)
    const version = JSON.parse(
      await (await import('node:fs/promises')).readFile('package.json', 'utf8')
    ).version
    expect(await readReleaseInfo(version, 'resources/release-notes.json')).toMatchObject({
      version,
      notesStatus: 'available',
      releaseReady: true
    })
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
