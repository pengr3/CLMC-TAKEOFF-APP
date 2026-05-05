/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useUiPanels, type UseUiPanelsApi } from '@renderer/hooks/useUiPanels'

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

async function callHook(): Promise<{ current: () => UseUiPanelsApi; cleanup: () => void }> {
  // Mutable holder, written via useLayoutEffect (post-render commit) so the
  // assignment is not a render-time side effect — keeps eslint-plugin-
  // react-hooks v7 (react-hooks/immutability) quiet.
  const holder: { value: UseUiPanelsApi | null } = { value: null }

  function Harness(): null {
    const v = useUiPanels()
    React.useLayoutEffect(() => {
      holder.value = v
    })
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Harness))
    await new Promise<void>((res) => setTimeout(res, 0))
  })

  return {
    current: () => {
      if (!holder.value) throw new Error('useUiPanels harness — no value captured yet')
      return holder.value
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

describe('useUiPanels — D-03 localStorage clmc.ui', () => {
  beforeEach(() => {
    installLocalStoragePolyfill()
  })

  it('reads localStorage clmc.ui on mount; returns stored values (D-03)', async () => {
    const stored = {
      thumbnails: { open: false, width: 200 },
      totals: { open: false, width: 400 },
      collapsedCategories: ['Civil']
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const harness = await callHook()
    try {
      const api = harness.current()
      expect(api.thumbnails).toEqual({ open: false, width: 200 })
      expect(api.totals).toEqual({ open: false, width: 400 })
      expect(api.collapsedCategories).toEqual(['Civil'])
    } finally {
      harness.cleanup()
    }
  })

  it('returns DEFAULTS when localStorage has no entry (D-03)', async () => {
    const harness = await callHook()
    try {
      const api = harness.current()
      expect(api.thumbnails).toEqual({ open: true, width: 140 })
      expect(api.totals).toEqual({ open: true, width: 320 })
      expect(api.collapsedCategories).toEqual([])
    } finally {
      harness.cleanup()
    }
  })

  it('returns DEFAULTS silently when localStorage entry fails JSON.parse (D-03)', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{')

    const harness = await callHook()
    try {
      const api = harness.current()
      // No throw, no flash — DEFAULTS returned.
      expect(api.thumbnails.open).toBe(true)
      expect(api.thumbnails.width).toBe(140)
      expect(api.totals.open).toBe(true)
      expect(api.totals.width).toBe(320)
      expect(api.collapsedCategories).toEqual([])
    } finally {
      harness.cleanup()
    }
  })

  it('returns DEFAULTS silently when stored entry has the wrong shape', async () => {
    // Schema drift — old version with missing fields. Defensive shape check
    // must reset rather than crash.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ thumbnails: { open: 'yes' } }))

    const harness = await callHook()
    try {
      const api = harness.current()
      expect(api.thumbnails).toEqual({ open: true, width: 140 })
    } finally {
      harness.cleanup()
    }
  })

  it('writes localStorage when setThumbnailsOpen is called', async () => {
    const harness = await callHook()
    try {
      await act(async () => {
        harness.current().setThumbnailsOpen(false)
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(harness.current().thumbnails.open).toBe(false)
      const raw = window.localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.thumbnails.open).toBe(false)
    } finally {
      harness.cleanup()
    }
  })

  it('writes localStorage when setTotalsWidth is called', async () => {
    const harness = await callHook()
    try {
      await act(async () => {
        harness.current().setTotalsWidth(420)
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(harness.current().totals.width).toBe(420)
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(raw!)
      expect(parsed.totals.width).toBe(420)
    } finally {
      harness.cleanup()
    }
  })

  it('toggleCategoryCollapsed adds name when not present', async () => {
    const harness = await callHook()
    try {
      await act(async () => {
        harness.current().toggleCategoryCollapsed('Civil')
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(harness.current().collapsedCategories).toEqual(['Civil'])
    } finally {
      harness.cleanup()
    }
  })

  it('toggleCategoryCollapsed removes name when already present', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        thumbnails: { open: true, width: 140 },
        totals: { open: true, width: 320 },
        collapsedCategories: ['Civil', 'Electrical']
      })
    )

    const harness = await callHook()
    try {
      await act(async () => {
        harness.current().toggleCategoryCollapsed('Civil')
        await new Promise<void>((res) => setTimeout(res, 0))
      })
      expect(harness.current().collapsedCategories).toEqual(['Electrical'])
    } finally {
      harness.cleanup()
    }
  })
})
