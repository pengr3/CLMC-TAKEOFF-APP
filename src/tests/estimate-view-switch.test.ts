/** @vitest-environment jsdom */
/**
 * Plan | Estimate view switch — Phase 16 RED render test (proof g, D-01, Pitfall 1).
 *
 * Mirrors the sibling render-test harness (React.createElement + jsdom + in-memory
 * localStorage polyfill + IS_REACT_ACT_ENVIRONMENT = true at module scope;
 * vitest.config.ts include glob is *.test.ts only, and jsdom 29 needs the
 * localStorage polyfill; parallel-executor-safe, no config change per CLAUDE.md /
 * 16-RESEARCH Pitfall 6).
 *
 * D-01 swaps the center area between the Konva canvas ("Plan") and the Estimate
 * sheet ("Estimate") via a `viewMode: 'plan' | 'estimate'` field on viewerStore,
 * toggled with CSS `display` — BOTH subtrees stay mounted (mount-preserving) so
 * the Konva Stage is never unmounted/remounted (Pitfall 1: a conditional mount
 * would tear down the WebGL context, re-rasterize the PDF, and measure 0×0).
 *
 * This mounts a SELF-CONTAINED harness that models the App.tsx Pattern-2 layout:
 * two sibling containers (canvas-viewport + estimate-grid stand-ins) whose
 * visibility is driven by reading `viewMode` off useViewerStore. The harness does
 * NOT import App/CanvasViewport (mounting the full Konva/PDF stack is brittle in
 * jsdom); it asserts the CONTRACT the App-shell must honor:
 *   1. In BOTH modes, both containers are present in the DOM (mount-preserving).
 *   2. EXACTLY ONE of the two carries `display: none` at any time.
 *   3. Toggling estimate→plan keeps the SAME canvas DOM node instance (not
 *      remounted) — the canvas is preserved across the switch.
 *
 * RED because `viewMode` does not exist on ViewerState until Wave 2a (16-04): the
 * store selector returns `undefined`, so neither container resolves to the shown
 * state and the "exactly one display:none" / "canvas visible in plan mode"
 * invariants fail. Cast `viewMode`/`setViewMode` `as any` where the field/action
 * do not exist yet. GREEN once Wave 2a adds `viewMode` (default 'plan') +
 * setViewMode + the mount-preserving toggle. Do NOT "fix" the source to make this
 * green — Wave 1-3 does.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useViewerStore } from '@renderer/stores/viewerStore'

// React 19 emits "act environment not configured" unless this flag is set. Per-
// test-file flag at module scope mirrors the sibling render tests (STATE.md
// locked decision). Parallel-executor-safe — no vitest.config.ts change.
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

/**
 * Minimal App-shell center region modeling App.tsx Pattern 2: BOTH the canvas and
 * estimate containers are ALWAYS mounted; CSS `display` (driven by viewMode) picks
 * which is visible. Stand-ins carry the stable data-testids the real App-shell
 * containers will use so the mount-preserving invariant is testable without the
 * Konva/PDF stack.
 */
function ViewSwitchHarness(): React.JSX.Element {
  // Reads `viewMode` off viewerStore — undefined until Wave 2a adds the field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewMode = useViewerStore((s) => (s as any).viewMode)
  return React.createElement(
    'div',
    { 'data-testid': 'view-switch-center' },
    React.createElement('div', {
      'data-testid': 'canvas-viewport',
      style: { display: viewMode === 'plan' ? 'flex' : 'none' }
    }),
    React.createElement('div', {
      'data-testid': 'estimate-grid',
      style: { display: viewMode === 'estimate' ? 'flex' : 'none' }
    })
  )
}

function displayOf(container: HTMLElement, testid: string): string {
  const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null
  if (!el) throw new Error(`missing container: ${testid}`)
  return el.style.display
}

beforeEach(() => {
  installLocalStoragePolyfill()
  // Reset viewer store to a project-open baseline. `viewMode` intentionally NOT
  // set here — Wave 2a's store default ('plan') is what should drive the harness.
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 3,
    pageViewports: {},
    pageScales: {}
  })
  document.body.innerHTML = ''
})

describe('Plan | Estimate view switch (Phase 16, proof g, D-01)', () => {
  it('both canvas + estimate containers are mounted in the DOM (mount-preserving)', () => {
    const { container, unmount } = mount(React.createElement(ViewSwitchHarness))
    try {
      // Both subtrees present regardless of mode — the canvas is never conditionally
      // unmounted (Pitfall 1). This holds today (both are always rendered).
      expect(container.querySelector('[data-testid="canvas-viewport"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="estimate-grid"]')).not.toBeNull()
    } finally {
      unmount()
    }
  })

  it('exactly one container carries display:none at any time (default lands on Plan)', () => {
    const { container, unmount } = mount(React.createElement(ViewSwitchHarness))
    try {
      // RED — `viewMode` is undefined until Wave 2a, so BOTH resolve to
      // display:none (neither equals 'plan' or 'estimate'). Once Wave 2a defaults
      // viewMode='plan', the canvas is shown (display:flex) and the estimate is
      // hidden (display:none) — exactly one hidden.
      const canvasHidden = displayOf(container, 'canvas-viewport') === 'none'
      const estimateHidden = displayOf(container, 'estimate-grid') === 'none'
      // XOR — exactly one hidden.
      expect(canvasHidden !== estimateHidden).toBe(true)
      // Default view is Plan → the canvas is the VISIBLE one.
      expect(displayOf(container, 'canvas-viewport')).not.toBe('none')
      expect(displayOf(container, 'estimate-grid')).toBe('none')
    } finally {
      unmount()
    }
  })

  it('toggling estimate→plan keeps the SAME canvas DOM node (not remounted)', () => {
    const { container, unmount } = mount(React.createElement(ViewSwitchHarness))
    try {
      // Switch to Estimate.
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useViewerStore.setState as any)({ viewMode: 'estimate' })
      })
      const canvasNodeInEstimate = container.querySelector('[data-testid="canvas-viewport"]')
      // The canvas container must still be mounted while in Estimate mode.
      expect(canvasNodeInEstimate).not.toBeNull()
      // In Estimate mode the canvas is hidden, the estimate shown.
      expect(displayOf(container, 'canvas-viewport')).toBe('none')
      expect(displayOf(container, 'estimate-grid')).not.toBe('none')

      // Switch back to Plan.
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useViewerStore.setState as any)({ viewMode: 'plan' })
      })
      const canvasNodeInPlan = container.querySelector('[data-testid="canvas-viewport"]')
      // SAME node instance — the canvas was never unmounted/remounted.
      expect(canvasNodeInPlan).toBe(canvasNodeInEstimate)
      // Back on Plan the canvas is visible again.
      expect(displayOf(container, 'canvas-viewport')).not.toBe('none')
      expect(displayOf(container, 'estimate-grid')).toBe('none')
    } finally {
      unmount()
    }
  })
})
