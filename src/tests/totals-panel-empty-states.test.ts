/** @vitest-environment jsdom */
/**
 * Render tests for TotalsPanel empty-states (plan 06-04) — D-09 contract.
 *
 * Three contextual variants per UI-SPEC §"Empty States":
 *   1. totalPages === 0 → "Open a PDF to begin."
 *   2. totalPages > 0 AND zero markups → "Place markups to see totals."
 *   3. markups exist BUT all are non-count on uncalibrated pages →
 *      "Place markups on a calibrated page to see length and area totals."
 *
 * The metadata header ALWAYS renders (UI-SPEC line 320). Fields show "—" em-dash
 * when no project is open (state 1).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsPanel } from '@renderer/components/TotalsPanel'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { DEFAULT_UNIT } from '@renderer/types/scale'
import type { LinearMarkup } from '@renderer/types/markup'

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

function makeLinearMarkup(page: number, name: string): LinearMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'linear',
    page,
    name,
    categoryId: 'cat-1',
    color: '#d13438',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    createdAt: Date.now()
  }
}

beforeEach(() => {
  installLocalStoragePolyfill()
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null
  })
  useScaleStore.setState({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

const baseProps = {
  open: true,
  width: 320,
  onSetOpen: vi.fn()
}

describe('TotalsPanel — D-09 empty states', () => {
  it('shows "Open a PDF to begin." when totalPages === 0 (D-09)', () => {
    // beforeEach leaves totalPages = 0.
    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const empty = container.querySelector('[data-testid="totals-panel-empty-message"]')
      expect(empty).not.toBeNull()
      expect(empty!.textContent).toBe('Open a PDF to begin.')

      // Metadata header still renders (UI-SPEC line 320 — em-dash fallback).
      const header = container.querySelector('[data-testid="totals-panel-header"]')
      expect(header).not.toBeNull()
      expect(header!.textContent).toContain('—')
    } finally {
      unmount()
    }
  })

  it('shows "Place markups to see totals." when totalPages > 0 and zero markups (D-09)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    // beforeEach leaves markups empty.
    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const empty = container.querySelector('[data-testid="totals-panel-empty-message"]')
      expect(empty).not.toBeNull()
      expect(empty!.textContent).toBe('Place markups to see totals.')

      // Header shows real values: Plan name + Pages 5 + Markups 0.
      const header = container.querySelector('[data-testid="totals-panel-header"]')
      expect(header!.textContent).toContain('test')
      expect(header!.textContent).toContain('5')
      expect(header!.textContent).toContain('0')
    } finally {
      unmount()
    }
  })

  it('shows third empty state when only non-count markups exist on uncalibrated pages (D-09)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeLinearMarkup(1, 'Wall')]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Architectural', color: '#d13438', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })
    // pageScales empty → page 1 uncalibrated → aggregator excludes the linear
    // markup → zero categories → third empty-state copy fires.

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const empty = container.querySelector('[data-testid="totals-panel-empty-message"]')
      expect(empty).not.toBeNull()
      expect(empty!.textContent).toBe(
        'Place markups on a calibrated page to see length and area totals.'
      )

      // Header still shows real Markups: 1 (raw count, regardless of scale).
      const header = container.querySelector('[data-testid="totals-panel-header"]')
      expect(header!.textContent).toContain('1')
    } finally {
      unmount()
    }
  })

  it('does NOT show empty state when at least one count markup exists', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          {
            id: crypto.randomUUID(),
            type: 'count',
            page: 1,
            name: 'Outlet',
            categoryId: 'cat-1',
            color: '#0078d4',
            sequence: 1,
            point: { x: 5, y: 5 },
            createdAt: Date.now()
          }
        ]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const empty = container.querySelector('[data-testid="totals-panel-empty-message"]')
      expect(empty).toBeNull()
      const cats = container.querySelector('[data-testid="totals-panel-categories"]')
      expect(cats).not.toBeNull()
    } finally {
      unmount()
    }
  })
})
