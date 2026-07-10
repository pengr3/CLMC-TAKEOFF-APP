/** @vitest-environment jsdom */
/**
 * InlineRenameInput — Phase 17 Wave 3 (17-05) render test.
 *
 * Models the estimate-row-edit.test.ts / totals-row-rate-edit.test.ts harness
 * VERBATIM (React.createElement + jsdom + in-memory localStorage polyfill + native
 * blur/keydown dispatch + IS_REACT_ACT_ENVIRONMENT = true at module scope — the
 * shared render-test pattern; vitest.config.ts include glob is *.test.ts only and
 * jsdom 29 needs the localStorage polyfill; parallel-executor-safe, no config change
 * per CLAUDE.md).
 *
 * Asserts the InlineRenameInput contract (UI-SPEC §2/§3, D-02/D-03/D-04):
 *   (a) Enter with a new name calls renameGroup(currentName, newName) once, then onDone.
 *   (b) Esc calls onDone WITHOUT calling renameGroup (cancel/revert).
 *   (c) A blank/whitespace commit calls onDone without renameGroup (silent cancel, D-03).
 *   (d) When renameGroup returns { ok:false } (collision), the input stays mounted and
 *       RenameCollisionMessage ("… already exists") renders — onDone is NOT called (D-04).
 *   (e) click/mousedown/keydown inside the editor do NOT bubble to a parent listener
 *       (the editor calls e.stopPropagation()).
 *
 * renameGroup is stubbed via useMarkupStore.setState (the store-mock convention used
 * by estimate-row-edit.test.ts for setPrice) so the editor's { ok } branch is driven
 * deterministically without touching the real cross-store command.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useMarkupStore } from '@renderer/stores/markupStore'
import { InlineRenameInput } from '@renderer/components/InlineRenameInput'

// React 19 emits "act environment not configured" unless this flag is set. Per-file
// flag at module scope mirrors the sibling render tests. Parallel-executor-safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>()
  const ls: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
}

const CURRENT_NAME = 'Slab'

// renameGroup stub — replaced per test to drive the { ok } branch. Default: success.
let renameSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  installLocalStoragePolyfill()
  renameSpy = vi.fn(() => ({ ok: true }))
  // Inject the stub onto the real store (getState().renameGroup resolves to it).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useMarkupStore as any).setState({ renameGroup: renameSpy })
  vi.clearAllMocks()
  // clearAllMocks resets the default implementation — re-arm it.
  renameSpy.mockImplementation(() => ({ ok: true }))
  document.body.innerHTML = ''
})

function findInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input') as HTMLInputElement | null
}

describe('InlineRenameInput (Phase 17, 17-05)', () => {
  it('(a) Enter with a new name calls renameGroup once, then onDone', () => {
    const onDone = vi.fn()
    const { container, unmount } = mount(
      React.createElement(InlineRenameInput, { currentName: CURRENT_NAME, onDone })
    )
    try {
      const input = findInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = 'Footing'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(renameSpy).toHaveBeenCalledTimes(1)
      expect(renameSpy).toHaveBeenCalledWith(CURRENT_NAME, 'Footing')
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      unmount()
    }
  })

  it('(b) Esc calls onDone WITHOUT calling renameGroup', () => {
    const onDone = vi.fn()
    const { container, unmount } = mount(
      React.createElement(InlineRenameInput, { currentName: CURRENT_NAME, onDone })
    )
    try {
      const input = findInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = 'Changed'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(renameSpy).not.toHaveBeenCalled()
      expect(onDone).toHaveBeenCalledTimes(1)
      // Field reverted to the original name.
      expect(input!.value).toBe(CURRENT_NAME)
    } finally {
      unmount()
    }
  })

  it('(c) a blank/whitespace commit calls onDone without renameGroup (D-03)', () => {
    const onDone = vi.fn()
    const { container, unmount } = mount(
      React.createElement(InlineRenameInput, { currentName: CURRENT_NAME, onDone })
    )
    try {
      const input = findInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '   '
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(renameSpy).not.toHaveBeenCalled()
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      unmount()
    }
  })

  it('(d) when renameGroup returns { ok:false }, the input stays mounted and the collision message renders (D-04)', () => {
    renameSpy.mockImplementation(() => ({ ok: false }))
    const onDone = vi.fn()
    const { container, unmount } = mount(
      React.createElement(InlineRenameInput, { currentName: CURRENT_NAME, onDone })
    )
    try {
      const input = findInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = 'Beam'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(renameSpy).toHaveBeenCalledTimes(1)
      // Editor stays open — onDone NOT called.
      expect(onDone).not.toHaveBeenCalled()
      // Input remains mounted, keeping the typed text.
      expect(findInput(container)).not.toBeNull()
      expect(findInput(container)!.value).toBe('Beam')
      // Collision message rendered (role=alert, "already exists").
      const alert = container.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert!.textContent).toContain('already exists')
      expect(alert!.textContent).toContain('Beam')
    } finally {
      unmount()
    }
  })

  it('(e) click/mousedown/keydown inside the editor do NOT bubble to a parent listener (stopPropagation)', () => {
    const onDone = vi.fn()
    const { container, unmount } = mount(
      React.createElement(InlineRenameInput, { currentName: CURRENT_NAME, onDone })
    )
    try {
      const parentClick = vi.fn()
      const parentMouseDown = vi.fn()
      const parentKey = vi.fn()
      container.addEventListener('click', parentClick)
      container.addEventListener('mousedown', parentMouseDown)
      container.addEventListener('keydown', parentKey)

      const input = findInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        input!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        // A non-commit key so we test propagation only (Enter/Esc would fire commit/cancel).
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
      })

      expect(parentClick).not.toHaveBeenCalled()
      expect(parentMouseDown).not.toHaveBeenCalled()
      expect(parentKey).not.toHaveBeenCalled()
      // A bare keystroke neither commits nor cancels.
      expect(renameSpy).not.toHaveBeenCalled()
      expect(onDone).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })
})
