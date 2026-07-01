/** @vitest-environment jsdom */
/**
 * EstimatePanel default-markup control — WR-01.
 *
 * WR-01: the Settings-tab "Default markup %" input was inert (a local useState wired
 * to nothing — not persisted, not read by the aggregator). The fix WIRES a real,
 * project-scoped default-markup control and places it in the ESTIMATE SHEET HEADER
 * (EstimatePanel.DefaultMarkupControl), removing the inert Settings control. This
 * file proves the header control is a genuine, CR-01-safe editor over the REAL
 * projectStore.
 *
 * Harness models estimate-row-decimal-entry.test.ts VERBATIM (React.createElement +
 * jsdom + in-memory localStorage polyfill + native input/blur/keydown dispatch +
 * IS_REACT_ACT_ENVIRONMENT = true at module scope; parallel-executor-safe, no
 * vitest.config.ts change). Like that file, beforeEach does NOT overwrite
 * setDefaultMarkupPct — the store's own create()'d action stays in place so the
 * seed-clobber path (the CR-01 core) is actually exercised against the true store.
 *
 * Contract asserted (WR-01 + CR-01-safe reuse):
 *   1. The control renders the current projectStore.defaultMarkupPct value.
 *   2. Typing a decimal `27.5` into the focused control is NOT clobbered mid-typing
 *      when a store write lands (the activeElement seed guard).
 *   3. Commit is DEFERRED to blur/Enter (never per-keystroke 'input'): blur commits
 *      setDefaultMarkupPct(27.5) through the real store; Enter commits too.
 *   4. Interacting with the control does not bubble to a parent handler
 *      (stopPropagation on click/mousedown/keydown).
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

describe('EstimatePanel default-markup control — WR-01 (real setDefaultMarkupPct)', () => {
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

  it('does NOT commit on the native input event; blur commits setDefaultMarkupPct through the real store', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      act(() => {
        input!.focus()
        input!.value = '42'
        // Per-keystroke 'input' must NOT commit.
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })

      // Store untouched + project still clean until blur/Enter.
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)
      expect(useProjectStore.getState().isDirty).toBe(false)

      // Blur commits — the store updates and dirty flips.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(42)
      expect(useProjectStore.getState().isDirty).toBe(true)
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

  it('typing a decimal 27.5 survives mid-typing and blur commits setDefaultMarkupPct(27.5)', () => {
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
      // nothing committed yet (default still 30).
      expect(input!.value).toBe('27.5')
      expect(useProjectStore.getState().defaultMarkupPct).toBe(30)

      // (b) Blur commits the parsed decimal through the real store.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(27.5)
    } finally {
      unmount()
    }
  })

  it('committing via Enter also lands the decimal (33.75) in the real store', () => {
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
      expect(useProjectStore.getState().defaultMarkupPct).toBe(33.75)
    } finally {
      unmount()
    }
  })

  it('a blank / negative commit clamps to 0 (parseFloat NaN/negative -> 0)', () => {
    const { container, unmount } = mount(React.createElement(EstimatePanel))
    try {
      const input = findControl(container)
      expect(input).not.toBeNull()

      // Blank -> 0.
      act(() => {
        input!.focus()
        input!.value = ''
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(useProjectStore.getState().defaultMarkupPct).toBe(0)

      // Negative -> 0.
      act(() => {
        input!.focus()
        input!.value = '-5'
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
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
