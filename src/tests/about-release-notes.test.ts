/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopActionBar } from '@renderer/components/TopActionBar'
vi.mock('@renderer/components/CanvasViewport', () => ({ getCanvasControls: () => null }))
vi.mock('@renderer/hooks/useProject', () => ({ useProject: () => ({ saveProject: vi.fn(), saveProjectAs: vi.fn() }) }))
let container: HTMLDivElement
let root: Root
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove() })
function key(el: Element, value: string): void { act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })) }) }
it('opens More by keyboard and invokes About with focus restored to More', () => {
  const about = vi.fn()
  act(() => root.render(React.createElement(TopActionBar, { onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn(), onAboutClick: about })))
  const more = container.querySelector('[data-testid="overflow-menu-button"]') as HTMLButtonElement
  more.focus()
  key(more, 'ArrowDown')
  expect(container.querySelector('[role="menuitem"]')?.textContent).toBe('About CLMC Takeoff')
  const item = container.querySelector('[role="menuitem"]')!
  expect(document.activeElement).toBe(item)
  key(item, 'Enter')
  expect(about).toHaveBeenCalledTimes(1)
  expect(document.activeElement).toBe(more)
  expect(container.querySelector('[role="menu"]')).toBeNull()
})
it('exposes recovery only from a supplied actual-candidate flag and handles arrows Space Escape', () => {
  const recover = vi.fn()
  const render = (available: boolean): void => { act(() => root.render(React.createElement(TopActionBar, { onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn(), recoveryAvailable: available, onRecoverClick: recover }))) }
  render(false)
  let more = container.querySelector('[data-testid="overflow-menu-button"]')!
  key(more, ' ')
  expect(container.textContent).not.toContain('Recover Unsaved Work')
  key(container.querySelector('[role="menuitem"]')!, 'Escape')
  render(true)
  more = container.querySelector('[data-testid="overflow-menu-button"]')!
  key(more, 'Enter')
  key(container.querySelector('[role="menuitem"]')!, 'ArrowDown')
  expect(document.activeElement?.textContent).toBe('Recover Unsaved Work')
  key(document.activeElement!, ' ')
  expect(recover).toHaveBeenCalledTimes(1)
})
