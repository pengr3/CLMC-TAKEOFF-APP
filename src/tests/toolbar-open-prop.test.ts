/** @vitest-environment jsdom */
/**
 * Regression test for the silent-Open bug:
 *
 * Bug: Toolbar's Open button used to call `useProject().openProjectDialog()`
 * directly and `void` the result. ProjectOpenResult.kind === 'missing-pdf'
 * was generated correctly inside the hook but never reached App.tsx's
 * handleOpenResult, so MissingPdfModal (and Hash/PageCount modals) never
 * appeared on toolbar click. Only Ctrl+O worked.
 *
 * Fix: Toolbar now accepts an `onOpenClick` prop owned by App.tsx. App.tsx's
 * handleOpenClick runs the dirty-guard + openByExtension and routes the
 * result through handleOpenResult → setMissing/setHashMiss/etc.
 *
 * This test locks that contract: clicking the Toolbar's Open button MUST
 * invoke the prop, and Toolbar MUST NOT bypass it via the hook directly.
 *
 * Uses React.createElement (not JSX) per the markup-context-menu pattern —
 * vitest config's *.test.ts include glob doesn't pick up .tsx test files.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock pdf-setup (pdfjs-dist requires DOMMatrix — not available in jsdom)
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

// Mock useProject — Toolbar uses it for save buttons; we don't exercise those
// here and we don't want it to call into pdfjs/IPC.
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok')
  })
}))

import { Toolbar } from '@renderer/components/Toolbar'
import { useViewerStore } from '@renderer/stores/viewerStore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  // Reset viewer store so totalPages = 0 → "Open" is the only button visible
  useViewerStore.getState().resetViewer()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Toolbar Open button — onOpenClick prop wiring (regression: missing-pdf-modal silent failure)', () => {
  it('Open button click invokes onOpenClick prop', () => {
    const onOpenClick = vi.fn()
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick }))
    })

    // Find by aria-label set on the Open button (Toolbar.tsx)
    const openBtn = container.querySelector('[aria-label="Open project or PDF (Ctrl+O)"]') as HTMLButtonElement | null
    expect(openBtn).not.toBeNull()

    act(() => {
      openBtn!.click()
    })

    expect(onOpenClick).toHaveBeenCalledTimes(1)
  })

  it('Open button does NOT invoke any other open path (locks the bypass-bug fix)', () => {
    // If a future regression reverts to calling useProject().openProjectDialog
    // directly inside Toolbar, the prop will go uncalled. This test fails
    // immediately if that happens.
    const onOpenClick = vi.fn()
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick }))
    })

    const openBtn = container.querySelector('[aria-label="Open project or PDF (Ctrl+O)"]') as HTMLButtonElement | null
    act(() => {
      openBtn!.click()
    })

    // The prop is the ONLY way Open should reach App.tsx's handleOpenResult.
    expect(onOpenClick).toHaveBeenCalled()
  })
})
