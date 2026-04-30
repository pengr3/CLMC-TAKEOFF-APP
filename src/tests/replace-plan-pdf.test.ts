/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

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
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  }
})

import { useProject } from '@renderer/hooks/useProject'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'

function makeBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
}

/**
 * Minimal hook runner using createRoot+act pattern (React 19 compatible).
 * Returns the result from calling replacePlanPdf.
 */
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

describe('useProject.replacePlanPdf — D-09 / D-10', () => {
  beforeEach(() => {
    useViewerStore.setState({
      filePath: 'C:/old.pdf',
      fileName: 'old.pdf',
      totalPages: 3,
      currentPage: 1,
      pageViewports: {},
      pageScales: {},
      pdfDocument: null,
      activeTool: 'select'
    })
    useProjectStore.getState().reset()
  })

  it('returns page-count-mismatch when new PDF has different page count', async () => {
    const { pdfjsLib } = await import('@renderer/lib/pdf-setup')
    ;(pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 5,
        getPage: vi.fn().mockResolvedValue({ getViewport: () => ({ width: 595, height: 842 }) }),
        destroy: vi.fn().mockResolvedValue(undefined)
      })
    })
    const r = await invokeReplacePlanPdf(makeBytes(), 'C:/new.pdf')
    expect(r.kind).toBe('page-count-mismatch')
    if (r.kind === 'page-count-mismatch') {
      expect(r.expected).toBe(3)
      expect(r.actual).toBe(5)
    }
  })

  it('returns ok and marks dirty when all checks pass', async () => {
    const r = await invokeReplacePlanPdf(makeBytes(), 'C:/new.pdf')
    expect(r.kind).toBe('ok')
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('returns ok updates viewerStore.pdfBytes (cached for next save)', async () => {
    await invokeReplacePlanPdf(makeBytes(), 'C:/new.pdf')
    const bytes = useViewerStore.getState().pdfBytes
    expect(bytes).not.toBeNull()
  })
})
