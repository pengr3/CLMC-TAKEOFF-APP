/** @vitest-environment jsdom */
/**
 * Render tests for CanvasHeaderBar (plan 06-02) — D-20 conditional rendering
 * + Set Scale link contract.
 *
 * Mirrors status-bar-scale.test.ts (conditional rendering test pattern) and
 * markup-context-menu.test.ts (React.createElement render harness because
 * vitest.config.ts include glob is *.test.ts, not *.test.tsx).
 *
 * Key contracts asserted (from 06-02-PLAN.md acceptance criteria):
 *   1. totalPages === 0 → renders null (D-20 — bar hidden when no PDF)
 *   2. Calibrated page → shows formatScaleRatio "1:N" text, no Set Scale link
 *   3. Uncalibrated + only count markups → shows "Not Set", no Set Scale link
 *   4. Uncalibrated + has non-count markups → shows "Page not calibrated."
 *      followed by inline Set Scale link
 *   5. Set Scale click invokes getCalibrationControls()?.activate() — uses
 *      the existing module-level ref (D-20: NOT duplicate trigger code)
 *   6. Current page label shown left-aligned (resolved getPageLabels else "Page N")
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock pdf-setup so transitive imports through usePageLabels don't pull in the
// real PDF.js worker. Mirrors use-page-labels.test.ts pattern.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { CanvasHeaderBar } from '@renderer/components/CanvasHeaderBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { DEFAULT_UNIT } from '@renderer/types/scale'
import type { CountMarkup, LinearMarkup } from '@renderer/types/markup'
// Re-export bag from CanvasViewport — the activate() ref under test
import * as CanvasViewportModule from '@renderer/components/CanvasViewport'

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

function makeCountMarkup(page: number, name = 'Outlet'): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color: '#0078d4',
    sequence: 1,
    point: { x: 10, y: 20 },
    createdAt: Date.now()
  }
}

function makeLinearMarkup(page: number, name = 'Wall'): LinearMarkup {
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
  // Reset all three stores to a known empty baseline before each test.
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
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CanvasHeaderBar — D-20 conditional rendering', () => {
  it('renders null when totalPages === 0 (D-20 — bar hidden when no PDF)', () => {
    // totalPages defaults to 0 from beforeEach reset.
    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      // Returns null → no DOM children mounted.
      expect(container.firstChild).toBeNull()
    } finally {
      unmount()
    }
  })

  it('shows current page label left-aligned ("Page 1" fallback)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      // Page 1 fallback rendered (no pdfDocument → usePageLabels returns null
      // → falls back to "Page {N}").
      expect(container.textContent).toContain('Page 1')
    } finally {
      unmount()
    }
  })

  it('shows "Not Set" when uncalibrated AND no non-count markups exist', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    // Page has only count markups → no calibration nudge.
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCountMarkup(1)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      expect(container.textContent).toContain('Not Set')
      // Set Scale link must NOT render in this branch.
      expect(container.textContent).not.toContain('Set Scale')
      expect(container.textContent).not.toContain('Page not calibrated')
    } finally {
      unmount()
    }
  })

  it('shows "Page not calibrated." + Set Scale link when uncalibrated AND has non-count markups (D-20)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    // Linear markup on uncalibrated page → triggers the inline Set Scale nudge.
    useMarkupStore.setState({
      pageMarkups: { 1: [makeLinearMarkup(1)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      expect(container.textContent).toContain('Page not calibrated')
      expect(container.textContent).toContain('Set Scale')
    } finally {
      unmount()
    }
  })

  it('"Set Scale" click invokes getCalibrationControls().activate() — NOT duplicate code (D-20)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: { 1: [makeLinearMarkup(1)] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
    const activateSpy = vi.fn()
    const cancelSpy = vi.fn()
    const verifySpy = vi.fn()
    const fakeControls = {
      activate: activateSpy,
      activateVerify: verifySpy,
      cancel: cancelSpy
    }
    // Stub getCalibrationControls to return our fake — same pattern Toolbar
    // uses to consume calibration controls (Toolbar.tsx:173-181).
    const spy = vi
      .spyOn(CanvasViewportModule, 'getCalibrationControls')
      .mockReturnValue(fakeControls)

    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      // Find the Set Scale link element by text content.
      const link = Array.from(container.querySelectorAll('*')).find(
        (el) => el.textContent === 'Set Scale'
      ) as HTMLElement | undefined
      expect(link).toBeDefined()
      act(() => {
        link!.click()
      })
      expect(activateSpy).toHaveBeenCalledTimes(1)
      // No other control method should fire — we strictly call activate().
      expect(cancelSpy).not.toHaveBeenCalled()
      expect(verifySpy).not.toHaveBeenCalled()
    } finally {
      unmount()
      spy.mockRestore()
    }
  })

  it('shows 1:N ratio text when calibrated', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    // 1:90 drawing scale: pixelsPerMm = 1/90.
    useScaleStore.getState().setScale(1, 1 / 90, 'm')

    const { container, unmount } = mount(React.createElement(CanvasHeaderBar))
    try {
      expect(container.textContent).toContain('1:90')
      // Set Scale link must NOT render when calibrated.
      expect(container.textContent).not.toContain('Set Scale')
      expect(container.textContent).not.toContain('Page not calibrated')
      expect(container.textContent).not.toContain('Not Set')
    } finally {
      unmount()
    }
  })
})
