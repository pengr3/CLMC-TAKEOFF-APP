/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Simulate the real PDF.js getDocument behavior: it transfers the underlying
// ArrayBuffer to its worker, leaving the original Uint8Array DETACHED
// (byteLength = 0). Without a defensive copy in usePdfDocument.loadPdf, the
// bytes cached in viewerStore.pdfBytes would also be detached, and the next
// IPC call (hashBuffer / writeProject) would throw "An object could not be
// cloned" because structured clone cannot serialize a detached buffer.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: {
    getDocument: vi.fn().mockImplementation((opts: { data: Uint8Array }) => {
      // Force detach the input buffer to mirror real PDF.js worker transfer.
      // structuredClone with transfer detaches the source ArrayBuffer.
      try {
        structuredClone(opts.data.buffer, { transfer: [opts.data.buffer] })
      } catch {
        /* environment without structuredClone transfer — skip detach simulation */
      }
      return {
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getViewport: () => ({ width: 595, height: 842 })
          }),
          destroy: vi.fn().mockResolvedValue(undefined)
        })
      }
    })
  },
  cloneForPdfWorker: (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes),
  PDFDocumentProxy: class {}
}))

const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])

beforeEach(() => {
  ;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window = {
    api: {
      readPdfBytes: vi.fn().mockResolvedValue(FAKE_PDF_BYTES.buffer.slice(0)),
      openPdf: vi.fn(),
      readProject: vi.fn(),
      writeProject: vi.fn(),
      hashBuffer: vi.fn().mockResolvedValue('a'.repeat(64)),
      saveProjectDialog: vi.fn(),
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  }
})

import { usePdfDocument } from '@renderer/hooks/usePdfDocument'
import { useViewerStore } from '@renderer/stores/viewerStore'

async function callLoadPdfFromPath(path: string): Promise<void> {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  function TestComponent() {
    const { loadPdfFromPath } = usePdfDocument()
    React.useEffect(() => {
      void loadPdfFromPath(path)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
  }

  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  })

  if (root) act(() => (root as Root).unmount())
  if (container) (container as HTMLDivElement).remove()
}

describe('usePdfDocument — pdfBytes survives PDF.js worker transfer', () => {
  it('after loadPdf, viewerStore.pdfBytes has non-zero byteLength (not detached)', async () => {
    useViewerStore.setState({ pdfBytes: null, pdfDocument: null })
    await callLoadPdfFromPath('C:/test/file.pdf')

    const bytes = useViewerStore.getState().pdfBytes
    expect(bytes).not.toBeNull()
    expect(bytes).toBeInstanceOf(Uint8Array)

    // CRITICAL: a detached Uint8Array reports byteLength === 0. If loadPdf
    // forgot the defensive copy, this assertion fails — proving the save
    // path would throw "An object could not be cloned" on the next IPC call.
    expect(bytes!.byteLength).toBe(FAKE_PDF_BYTES.byteLength)
  })
})
