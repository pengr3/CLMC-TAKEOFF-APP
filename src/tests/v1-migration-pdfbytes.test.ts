/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// Mock pdf-setup BEFORE useProject import (vitest hoists vi.mock)
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: {
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 595, height: 842 })
        }),
        destroy: vi.fn().mockResolvedValue(undefined)
      })
    })
  },
  cloneForPdfWorker: (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes),
  PDFDocumentProxy: class {}
}))

// Construct a v1 plain-JSON file content for window.api.readProject to return
const V1_FILE_TEXT = JSON.stringify({
  formatVersion: 1,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
  pdf: {
    absolutePath: 'C:/path/to/legacy/plans.pdf',
    relativePath: null,
    totalPages: 3,
    sha256: 'a'.repeat(64)
  },
  globalUnit: 'm',
  categories: {},
  categoryOrder: [],
  currentPage: 1,
  pages: [
    { pageIndex: 1, dimensions: { width: 595, height: 842 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] },
    { pageIndex: 2, dimensions: { width: 595, height: 842 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] },
    { pageIndex: 3, dimensions: { width: 595, height: 842 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] }
  ]
})

const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])  // %PDF-1.7

beforeEach(() => {
  // Stub window.api on globalThis so useProject can call it
  ;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window = {
    api: {
      readProject: vi.fn().mockImplementation((_path: string) => {
        // v1 path: return { kind: 'v1-json', text }
        return Promise.resolve({ kind: 'v1-json', text: V1_FILE_TEXT })
      }),
      readPdfBytes: vi.fn().mockResolvedValue(FAKE_PDF_BYTES.buffer),
      openPdf: vi.fn(),
      writeProject: vi.fn().mockResolvedValue({ ok: true }),
      openProject: vi.fn(),
      saveProjectDialog: vi.fn(),
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  }
})

import { useProject } from '@renderer/hooks/useProject'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'

/**
 * Minimal hook runner — mounts a component that captures the hook return value
 * so we can call hook methods imperatively from tests.
 * Pattern follows existing createRoot + act pattern from title-bar-dirty.test.ts.
 */
async function invokeOpenByExtension(
  filePath: string,
  extension: string
): Promise<{ kind: string }> {
  let capturedResult: { kind: string } = { kind: 'pending' }
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  function TestComponent() {
    const project = useProject()
    React.useEffect(() => {
      project.openByExtension(filePath, extension).then((r) => {
        capturedResult = r as { kind: string }
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
    // Give async effects time to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  })

  if (root) act(() => (root as Root).unmount())
  if (container) (container as HTMLDivElement).remove()

  return capturedResult
}

describe('v1 silent migration — pdfBytes population (HIGH review concern)', () => {
  it('after openClmcFromPath on a v1 file, viewerStore.pdfBytes is non-null', async () => {
    const openResult = await invokeOpenByExtension('C:/legacy/v1.clmc', '.clmc')
    // Sanity: open should report ok
    expect(openResult.kind).toBe('ok')

    // CRITICAL ASSERTION: viewerStore.pdfBytes must be populated
    const bytes = useViewerStore.getState().pdfBytes
    expect(bytes).not.toBeNull()
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('after v1 silent migration, isDirty is true (D-06 — silent upgrade marks dirty)', async () => {
    await invokeOpenByExtension('C:/legacy/v1.clmc', '.clmc')
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('window.api.readPdfBytes was called with v1 absolutePath (proof bytes were loaded BEFORE migration discarded the path)', async () => {
    await invokeOpenByExtension('C:/legacy/v1.clmc', '.clmc')
    const readPdfBytesMock = (globalThis as unknown as { window: { api: { readPdfBytes: ReturnType<typeof vi.fn> } } }).window.api.readPdfBytes
    expect(readPdfBytesMock).toHaveBeenCalledWith('C:/path/to/legacy/plans.pdf')
  })
})
