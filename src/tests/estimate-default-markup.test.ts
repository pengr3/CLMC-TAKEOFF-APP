/** @vitest-environment jsdom */
/**
 * EstimatePanel default-markup control — WR-01 + confirm-with-impact gate.
 *
 * WR-01: the Settings-tab "Default markup %" input was inert (a local useState wired
 * to nothing — not persisted, not read by the aggregator). The fix WIRES a real,
 * project-scoped default-markup control and places it in the ESTIMATE SHEET HEADER
 * (EstimatePanel.DefaultMarkupControl), removing the inert Settings control.
 *
 * CONFIRM GATE (this revision): changing the project default RE-PRICES every item that
 * has no explicit per-item markup — a project-wide change that used to commit as quietly
 * as a single rate cell. A CHANGED value is now GATED behind a confirm-with-impact
 * dialog (DefaultMarkupChangeModal): blur/Enter no longer writes setDefaultMarkupPct
 * directly — it opens the dialog with the pending value; the store is written ONLY on
 * confirm. Cancel reverts the input's DOM value to the stored default with no write. A
 * same-value / blur-without-edit commit is a silent no-op (no dialog, no write).
 *
 * Harness models estimate-row-decimal-entry.test.ts VERBATIM (React.createElement +
 * jsdom + in-memory localStorage polyfill + native input/blur/keydown dispatch +
 * IS_REACT_ACT_ENVIRONMENT = true at module scope; parallel-executor-safe, no
 * vitest.config.ts change). Like that file, beforeEach does NOT overwrite
 * setDefaultMarkupPct — the store's own create()'d action stays in place so the
 * seed-clobber path (the CR-01 core) is actually exercised against the true store.
 *
 * Contract asserted:
 *   1. The control renders the current projectStore.defaultMarkupPct value.
 *   2. Typing a decimal `27.5` into the focused control is NOT clobbered mid-typing
 *      when a store write lands (the activeElement seed guard) — CR-01 core.
 *   3. Commit is DEFERRED to blur/Enter (never per-keystroke 'input'), and a CHANGED
 *      value opens the confirm dialog WITHOUT writing setDefaultMarkupPct yet.
 *   4. Confirm ("Change markup") writes setDefaultMarkupPct(pending) exactly once.
 *   5. Cancel writes nothing and reverts the input to the stored default; dialog closes.
 *   6. Same-value (or blur-without-edit) commit → NO dialog, NO write.
 *   7. Interacting with the control does not bubble to a parent handler.
 *   8. The always-visible scope hint text is present on the control.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { EstimatePanel } from '@renderer/components/EstimatePanel'

// React 19 emits "act environment not configured" to stderr unless this flag is
// set. Per-test-file flag at module scope mirrors the sibling render tests.
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

beforeEach(() => {
  installLocalStoragePolyfill()
  // A PDF must be "open" (totalPages > 0) for EstimatePanel to render its body/header
  // richly, but the top label bar (which hosts the control) renders regardless.
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 5,
    fileName: 'demo.pdf',
    pageViewports: {},
    pageScales: {}
  })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  // Reset ONLY the projectStore data — deliberately DO NOT replace setDefaultMarkupPct
  // with a spy (that would hide the seed-clobber path). The real create()'d action +
  // markDirty stay in place. Seed a known default so assertion (1) is meaningful.
  useProjectStore.setState({ rates: {}, isDirty: false, defaultMarkupPct: 30 })
  document.body.innerHTML = ''
})

function findControl(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('[data-testid="estimate-default-markup-input"]') as HTMLInputElement | null
}

function findModal(): HTMLElement | null {
  return document.querySelector('[data-testid="default-markup-change-modal"]') as HTMLElement | null
}

function findConfirmBtn(): HTMLButtonElement | null {
  return document.querySelector('[data-testid="default-markup-change-confirm"]') as HTMLButtonElement | null
}

function findCancelBtn(): HTMLButtonElement | null {
  return document.querySelector('[data-testid="default-markup-change-cancel"]') as HTMLButtonElement | null
}

describe('EstimatePanel default-markup control — WR-01 + confirm gate (real setDefaultMarkupPct)', () => {
  it('renders the current projectStore.defaultMarkupPct value', () => {
    useProjectStore.setState({ defaultMarkupPct: 45 })
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()
      expect(input!.value).toBe('45')
    } finally {
      unmount()
    }
  })

  it('shows the always-visible scope hint on the control', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const hint = container.querySelector('[data-testid="estimate-default-markup-scope-hint"]')
      expect(hint).not.toBeNull()
      expect(hint!.textContent).toMatch(/item without its own markup/i)
    } finally {
      unmount()
    }
  })

  it('does NOT commit on the native input event; a CHANGED value on blur opens the confirm dialog WITHOUT writing the store', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      act(() => {
        input!.focus()
        input!.value = '42'
        // Per-keystroke 'input' must NOT commit or open the dialog.
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(findModal()).toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)

      // Blur commits — but only OPENS the dialog; the store is untouched until confirm.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).not.toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)
      // Impact copy names both the current and pending values.
      const body = document.querySelector('[data-testid="default-markup-change-modal-body"]')
      expect(body).not.toBeNull()
      expect(body!.textContent).toContain('30%')
      expect(body!.textContent).toContain('42%')
      expect(body!.textContent).toMatch(/item that doesn.t have its own markup/i)
    } finally {
      unmount()
    }
  })

  it('confirming ("Change markup") writes setDefaultMarkupPct(newValue) once and closes the dialog', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      act(() => {
        input!.focus()
        input!.value = '42'
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      const confirm = findConfirmBtn()
      expect(confirm).not.toBeNull()

      act(() => {
        confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Store now holds the confirmed value + dirty flipped; dialog closed.
      expect(useProjectStore.getState().defaultMarkupPct).toBe(42)
      expect(useProjectStore.getState().isDirty).toBe(true)
      expect(findModal()).toBeNull()
      // Field re-syncs to the NEW value.
      expect(findControl(container)!.value).toBe('42')
    } finally {
      unmount()
    }
  })

  it('cancelling writes nothing and reverts the input to the previous value; dialog closes', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      act(() => {
        input!.focus()
        input!.value = '42'
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      const cancel = findCancelBtn()
      expect(cancel).not.toBeNull()

      act(() => {
        cancel!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Store untouched; input reverted to the stored default; dialog closed.
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)
      expect(findModal()).toBeNull()
      expect(findControl(container)!.value).toBe('30')
    } finally {
      unmount()
    }
  })

  it('committing the SAME value (or blur without editing) shows NO dialog and does NOT write the store', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)

      // Blur without editing (value already '30').
      act(() => {
        input!.focus()
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)

      // Explicitly re-type the SAME value and blur → still no dialog, no write.
      act(() => {
        input!.focus()
        input!.value = '30'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)
    } finally {
      unmount()
    }
  })

  it('seed effect does NOT clobber the focused control when the store updates mid-typing (CR-01 core)', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      // User is mid-typing the interim value '27.' and the control is focused.
      act(() => {
        input!.focus()
        input!.value = '27.'
      })
      expect(document.activeElement).toBe(input)

      // A store write lands while the field is focused (e.g. some other action, or the
      // OLD per-keystroke behavior). The seed effect re-runs with a new value; the
      // activeElement guard must make it a no-op so the field keeps the user's text.
      act(() => {
        useProjectStore.getState().setDefaultMarkupPct(0)
      })

      expect(input!.value).toBe('27.')
    } finally {
      unmount()
    }
  })

  it('typing a decimal 27.5 survives mid-typing; blur opens the dialog and confirm commits setDefaultMarkupPct(27.5)', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      // Type the decimal one stage at a time against the REAL store.
      act(() => {
        input!.focus()
        input!.value = '27'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => {
        input!.value = '27.'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => {
        input!.value = '27.5'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })

      // (a) The focused field was NEVER clobbered — it still reads the full '27.5';
      // nothing committed yet (default still 30, no dialog).
      expect(input!.value).toBe('27.5')
      expect(findModal()).toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)

      // (b) Blur opens the dialog; confirm commits the parsed decimal through the store.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).not.toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)

      act(() => {
        findConfirmBtn()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(27.5)
    } finally {
      unmount()
    }
  })

  it('committing via Enter opens the dialog; confirm lands the decimal (33.75) in the real store', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      act(() => {
        input!.focus()
        input!.value = '33.75'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })

      expect(input!.value).toBe('33.75')
      expect(findModal()).not.toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)

      act(() => {
        findConfirmBtn()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(33.75)
    } finally {
      unmount()
    }
  })

  it('a blank / negative commit clamps to 0 (parseFloat NaN/negative -> 0) through the confirm gate', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      // Blank -> 0. 0 !== current(30) → dialog opens; confirm writes 0.
      act(() => {
        input!.focus()
        input!.value = ''
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).not.toBeNull()
      act(() => {
        findConfirmBtn()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(0)

      // Negative -> 0. Now current is already 0, so a '-5' commit parses to 0 === 0 →
      // NO dialog (silent no-op), store stays 0.
      act(() => {
        input!.focus()
        input!.value = '-5'
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(findModal()).toBeNull()
      expect(useProjectStore.getState().defaultMarkupPct).toBe(0)
    } finally {
      unmount()
    }
  })

  it('interacting with the control does not bubble to a parent handler (stopPropagation)', () => {
    let parentClicks = 0
    let parentKeys = 0
    const Wrapper = (): React.JSX.Element =>
      React.createElement(
        'div',
        {
          onClick: () => {
            parentClicks += 1
          },
          onKeyDown: () => {
            parentKeys += 1
          }
        },
        React.createElement(EstimatePanel)
      )

    const { container, unmount } = mount(React.createElement(Wrapper))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      act(() => {
        input!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        input!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
      })

      // The cell stopPropagation()s — none of these reach the parent handlers.
      expect(parentClicks).toBe(0)
      expect(parentKeys).toBe(0)
    } finally {
      unmount()
    }
  })
})
