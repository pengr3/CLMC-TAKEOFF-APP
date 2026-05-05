/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock pdf-setup so the hook's transitive viewerStore type imports don't pull
// in the real PDF.js worker — keeps the test pure.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { usePageLabels } from '@renderer/hooks/usePageLabels'
import { useViewerStore } from '@renderer/stores/viewerStore'

// Minimal PDFDocumentProxy stand-in: only getPageLabels matters here.
function fakePdfDoc(labels: string[] | null): { getPageLabels: () => Promise<string[] | null> } {
  return { getPageLabels: () => Promise.resolve(labels) }
}

async function callHook(): Promise<{ current: () => string[] | null; cleanup: () => void }> {
  let captured: string[] | null = null

  function Harness(): null {
    captured = usePageLabels()
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Harness))
    // Give the useEffect + the awaited Promise.resolve() time to flush.
    await new Promise<void>((res) => setTimeout(res, 0))
    await new Promise<void>((res) => setTimeout(res, 0))
  })

  return {
    current: () => captured,
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

describe('usePageLabels — D-16 page label resolution', () => {
  beforeEach(() => {
    useViewerStore.setState({ pdfDocument: null })
  })

  it('returns resolved labels array when pdfDocument.getPageLabels() resolves (D-16)', async () => {
    const labels = ['A1.01', 'A1.02', 'S-101']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useViewerStore.setState({ pdfDocument: fakePdfDoc(labels) as any })

    const harness = await callHook()
    try {
      expect(harness.current()).toEqual(labels)
    } finally {
      harness.cleanup()
    }
  })

  it('returns null when getPageLabels() resolves null — callers use Page N fallback', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useViewerStore.setState({ pdfDocument: fakePdfDoc(null) as any })

    const harness = await callHook()
    try {
      expect(harness.current()).toBeNull()
    } finally {
      harness.cleanup()
    }
  })

  it('resets to null when pdfDocument changes to null', async () => {
    const labels = ['A1.01', 'A1.02']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useViewerStore.setState({ pdfDocument: fakePdfDoc(labels) as any })

    const harness = await callHook()
    try {
      expect(harness.current()).toEqual(labels)

      // Drop the document → effect re-runs, sets labels to null.
      await act(async () => {
        useViewerStore.setState({ pdfDocument: null })
        await new Promise<void>((res) => setTimeout(res, 0))
      })

      expect(harness.current()).toBeNull()
    } finally {
      harness.cleanup()
    }
  })
})
