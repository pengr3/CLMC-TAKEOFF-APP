/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Simulate real PDF.js getDocument behavior: it transfers the underlying
// ArrayBuffer to its worker, leaving the original Uint8Array DETACHED
// (byteLength = 0). This test exists to lock in the fix for the Phase 4.1
// UAT Test 3 blocker — replacePlanPdf used to call getDocument({ data: newBytes })
// directly as a pre-validation probe, which detached newBytes before
// applyReplacePlanPdf could re-read it, throwing
// "Cannot perform Construct on a detached ArrayBuffer" inside loadPdf.
//
// The fix in src/renderer/src/lib/pdf-setup.ts adds cloneForPdfWorker(bytes)
// and replacePlanPdf wraps every getDocument input with it. This test feeds
// a getDocument mock that detaches its input — if replacePlanPdf forgot the
// wrap, the assertions on viewerStore.pdfBytes.byteLength / result.pendingBytes
// would fail (detached buffers report byteLength === 0).
//
// The mock also re-exports cloneForPdfWorker with its real one-liner
// implementation so the production code under test gets the helper it
// imports from pdf-setup.
let lastGetDocumentNumPages = 3
let lastGetDocumentDims = { width: 595, height: 842 }
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: {
    getDocument: vi.fn().mockImplementation((opts: { data: Uint8Array }) => {
      // Force-detach the input buffer to mirror real PDF.js worker transfer.
      try {
        structuredClone(opts.data.buffer, { transfer: [opts.data.buffer] })
      } catch {
        /* environment without structuredClone transfer — skip detach simulation */
      }
      return {
        promise: Promise.resolve({
          numPages: lastGetDocumentNumPages,
          getPage: vi.fn().mockResolvedValue({
            getViewport: () => ({ ...lastGetDocumentDims })
          }),
          destroy: vi.fn().mockResolvedValue(undefined)
        })
      }
    })
  },
  cloneForPdfWorker: (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes),
  PDFDocumentProxy: class {}
}))

beforeEach(() => {
  ;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window = {
    api: {
      openPdf: vi.fn(),
      readPdfBytes: vi.fn(),
      readProject: vi.fn(),
      writeProject: vi.fn(),
      openProject: vi.fn(),
      saveProjectDialog: vi.fn(),
      hashBuffer: vi.fn().mockResolvedValue('a'.repeat(64)),
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  }
  lastGetDocumentNumPages = 3
  lastGetDocumentDims = { width: 595, height: 842 }
})

import { useProject } from '@renderer/hooks/useProject'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'

function makeBytes(): Uint8Array {
  // Real-ish PDF magic header — exactly the failing UAT scenario uses ~2.9 MB,
  // but only the byteLength comparison matters here.
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x00, 0x00])
}

async function invokeReplacePlanPdf(
  newPdfBytes: Uint8Array,
  pickedPath: string
): Promise<{ kind: string; [key: string]: unknown }> {
  let capturedResult: { kind: string; [key: string]: unknown } = { kind: 'pending' }
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  function TestComponent() {
    const project = useProject()
    React.useEffect(() => {
      project.replacePlanPdf(newPdfBytes, pickedPath).then((r) => {
        capturedResult = r as { kind: string; [key: string]: unknown }
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
  }

  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  })

  if (root) act(() => (root as Root).unmount())
  if (container) (container as HTMLDivElement).remove()

  return capturedResult
}

describe('useProject.replacePlanPdf — survives PDF.js worker buffer transfer', () => {
  beforeEach(() => {
    useViewerStore.setState({
      filePath: 'C:/old.pdf',
      fileName: 'old.pdf',
      totalPages: 3,
      currentPage: 1,
      pageViewports: {},
      pageScales: {},
      pdfDocument: null,
      pdfBytes: null,
      activeTool: 'select'
    })
    useProjectStore.getState().reset()
  })

  it('returns ok and leaves viewerStore.pdfBytes live (regression for UAT Test 3 — 04.1-UAT.md)', async () => {
    // Same page count + same dims → happy path → applyReplacePlanPdf runs.
    lastGetDocumentNumPages = 3
    lastGetDocumentDims = { width: 595, height: 842 }

    const bytes = makeBytes()
    const expectedLen = bytes.byteLength

    const r = await invokeReplacePlanPdf(bytes, 'C:/new.pdf')

    // Without cloneForPdfWorker on the probe, this branch would have thrown
    // "Cannot perform Construct on a detached ArrayBuffer" inside loadPdf
    // and r.kind would be 'error'.
    expect(r.kind).toBe('ok')

    // CRITICAL: a detached Uint8Array reports byteLength === 0. If the
    // pre-validation probe forgot the defensive copy, the bytes cached in
    // viewerStore.pdfBytes would also be detached, and the next IPC save
    // (hashBuffer / writeProject) would throw "An object could not be cloned".
    const cached = useViewerStore.getState().pdfBytes
    expect(cached).not.toBeNull()
    expect(cached).toBeInstanceOf(Uint8Array)
    expect(cached!.byteLength).toBe(expectedLen)
  })

  it('returns dimension-mismatch with a live pendingBytes copy (latent symptom of same root cause)', async () => {
    // Same page count, DIFFERENT dimensions → dimension-mismatch branch.
    lastGetDocumentNumPages = 3
    lastGetDocumentDims = { width: 800, height: 1000 } // different from current doc dims

    // Set a current pdfDocument so perPageDimensions has something to compare.
    useViewerStore.setState({
      pdfDocument: {
        numPages: 3,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 595, height: 842 })
        })
      } as unknown as object
    })

    const bytes = makeBytes()
    const expectedLen = bytes.byteLength

    const r = await invokeReplacePlanPdf(bytes, 'C:/new.pdf')

    expect(r.kind).toBe('dimension-mismatch')
    if (r.kind === 'dimension-mismatch') {
      // Without cloneForPdfWorker on pendingBytes, this would be 0 (detached).
      expect(r.pendingBytes).toBeInstanceOf(Uint8Array)
      expect((r.pendingBytes as Uint8Array).byteLength).toBe(expectedLen)
    }
  })
})
