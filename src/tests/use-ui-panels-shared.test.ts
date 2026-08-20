/** @vitest-environment jsdom */
/**
 * RED (quick-260820-plx) — useUiPanels must be ONE shared store.
 *
 * FAILS today because useUiPanels is a per-component `useState` hook: every
 * caller holds an ISOLATED copy of UiState. App.tsx:56 owns the copy that
 * drives <TotalsPanel open={totals.open}>; TopActionBar.tsx:147 owns a
 * separate one, so the top bar's Totals button mutates a private copy and the
 * panel never moves. The same isolation makes collapsedCategories diverge
 * between TotalsCategoryBlock and EstimateCategoryBlock (each clobbers the
 * other's array in localStorage, visible after a reload).
 *
 * Turns GREEN when the hook reads a module-level store via
 * useSyncExternalStore. The `clmc.ui` storage contract (STORAGE_KEY,
 * DEFAULTS, defensive shape check, silent reset, one write per committed
 * change) must survive byte-identical — tests 3-6 lock that.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import {
  useUiPanels,
  __resetUiPanelsForTests,
  type UseUiPanelsApi
} from '@renderer/hooks/useUiPanels'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE_KEY = 'clmc.ui'

// jsdom 29 in this project ships an experimental persistent localStorage that
// requires `--localstorage-file` — without a valid path, getItem/setItem are
// undefined. Replace with an in-memory polyfill scoped to this test file.
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
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: ls
  })
}

interface TwoConsumers {
  a: () => UseUiPanelsApi
  b: () => UseUiPanelsApi
  cleanup: () => void
}

/**
 * Mounts TWO SEPARATE components in ONE tree, each calling useUiPanels().
 * This is the App.tsx-vs-TopActionBar.tsx isolation reduced to a harness.
 *
 * Holder values are written via useLayoutEffect (post-render commit) so the
 * assignment is not a render-time side effect — keeps eslint-plugin-
 * react-hooks v7 (react-hooks/immutability) quiet.
 */
async function mountTwoConsumers(): Promise<TwoConsumers> {
  const holderA: { value: UseUiPanelsApi | null } = { value: null }
  const holderB: { value: UseUiPanelsApi | null } = { value: null }

  function ConsumerA(): null {
    const v = useUiPanels()
    React.useLayoutEffect(() => {
      holderA.value = v
    })
    return null
  }

  function ConsumerB(): null {
    const v = useUiPanels()
    React.useLayoutEffect(() => {
      holderB.value = v
    })
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ConsumerA),
        React.createElement(ConsumerB)
      )
    )
    await new Promise<void>((res) => setTimeout(res, 0))
  })

  const read =
    (holder: { value: UseUiPanelsApi | null }, which: string) => (): UseUiPanelsApi => {
      if (!holder.value) throw new Error(`useUiPanels harness — no value captured for ${which}`)
      return holder.value
    }

  return {
    a: read(holderA, 'A'),
    b: read(holderB, 'B'),
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

describe('useUiPanels — single shared store (quick-260820-plx)', () => {
  beforeEach(() => {
    installLocalStoragePolyfill()
    __resetUiPanelsForTests()
  })

  it('two independent consumers stay in sync on setTotalsOpen (the inert Totals toggle)', async () => {
    const h = await mountTwoConsumers()
    try {
      expect(h.a().totals.open).toBe(true)
      expect(h.b().totals.open).toBe(true)

      await act(async () => {
        h.a().setTotalsOpen(false)
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(h.b().totals.open).toBe(false)

      await act(async () => {
        h.b().setTotalsOpen(true)
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(h.a().totals.open).toBe(true)
    } finally {
      h.cleanup()
    }
  })

  it('two consumers stay in sync on toggleCategoryCollapsed (Totals ↔ Estimate clobber)', async () => {
    const h = await mountTwoConsumers()
    try {
      await act(async () => {
        h.a().toggleCategoryCollapsed('Civil')
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(h.b().collapsedCategories).toEqual(['Civil'])
      expect(h.a().collapsedCategories).toEqual(['Civil'])
    } finally {
      h.cleanup()
    }
  })

  it('a fresh mount with empty storage reads DEFAULTS', async () => {
    const h = await mountTwoConsumers()
    try {
      expect(h.a().totals).toEqual({ open: true, width: 320 })
      expect(h.a().collapsedCategories).toEqual([])
      expect(h.b().totals).toEqual({ open: true, width: 320 })
      expect(h.b().collapsedCategories).toEqual([])
    } finally {
      h.cleanup()
    }
  })

  it('seeded clmc.ui is read on first subscribe', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totals: { open: false, width: 500 },
        collapsedCategories: ['Civil']
      })
    )

    const h = await mountTwoConsumers()
    try {
      expect(h.a().totals).toEqual({ open: false, width: 500 })
      expect(h.a().collapsedCategories).toEqual(['Civil'])
      expect(h.b().totals).toEqual({ open: false, width: 500 })
      expect(h.b().collapsedCategories).toEqual(['Civil'])
    } finally {
      h.cleanup()
    }
  })

  it('garbage JSON and shape mismatch both mount to DEFAULTS with no throw (T-06-01-01)', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    const garbage = await mountTwoConsumers()
    try {
      expect(garbage.a().totals).toEqual({ open: true, width: 320 })
      expect(garbage.b().collapsedCategories).toEqual([])
    } finally {
      garbage.cleanup()
    }

    __resetUiPanelsForTests()
    window.localStorage.setItem(
      STORAGE_KEY,
      '{"totals":{"open":"yes","width":"wide"},"collapsedCategories":"nope"}'
    )
    const mismatch = await mountTwoConsumers()
    try {
      expect(mismatch.a().totals).toEqual({ open: true, width: 320 })
      expect(mismatch.b().collapsedCategories).toEqual([])
    } finally {
      mismatch.cleanup()
    }
  })

  it('writes localStorage ONCE per committed change and never on mount alone (Splitter contract)', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem')

    const h = await mountTwoConsumers()
    try {
      // Mounting two consumers must not write anything — the Splitter relies on
      // exactly one write per committed change (pointerup), not per render.
      expect(setItem).toHaveBeenCalledTimes(0)

      await act(async () => {
        h.a().setTotalsWidth(420)
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      expect(setItem).toHaveBeenCalledTimes(1)
      expect(h.b().totals.width).toBe(420)
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
      expect(parsed.totals.width).toBe(420)
    } finally {
      h.cleanup()
      setItem.mockRestore()
    }
  })
})
