import { describe, it, expect, vi } from 'vitest'

// Mock pdf-setup to prevent pdfjs-dist DOMMatrix errors in node/jsdom environment.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { routeOpenResult } from '@renderer/hooks/useProject'
import type { ProjectOpenResult } from '@renderer/hooks/useProject'

/**
 * Minimal ProjectFileV1 stub for tests that need a data payload.
 * Only the shape matters — these tests do not invoke project loading logic.
 */
const stubData = {
  formatVersion: 1,
  createdAt: new Date().toISOString(),
  savedAt: new Date().toISOString(),
  pdf: {
    absolutePath: 'C:/plans/planA.pdf',
    relativePath: null,
    sha256: 'abc123',
    totalPages: 3
  },
  pages: []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

describe('project-open-flow — modal routing contract', () => {
  it('kind ok routes to no modal', () => {
    const result: ProjectOpenResult = { kind: 'ok' }
    expect(routeOpenResult(result)).toBe('none')
  })

  it('kind canceled routes to no modal', () => {
    const result: ProjectOpenResult = { kind: 'canceled' }
    expect(routeOpenResult(result)).toBe('none')
  })

  it('null result routes to no modal', () => {
    expect(routeOpenResult(null)).toBe('none')
  })

  it('kind missing-pdf routes to missing-pdf modal (F — MissingPdfModal)', () => {
    const result: ProjectOpenResult = {
      kind: 'missing-pdf',
      expectedPath: 'C:/plans/planA.pdf',
      expectedName: 'planA.pdf',
      data: stubData,
      clmcPath: 'C:/plans/planA.clmc'
    }
    expect(routeOpenResult(result)).toBe('missing-pdf')
  })

  it('kind page-count-mismatch routes to page-count-mismatch modal (G — PageCountAbortModal)', () => {
    const result: ProjectOpenResult = {
      kind: 'page-count-mismatch',
      expected: 3,
      actual: 5,
      data: stubData,
      clmcPath: 'C:/plans/planA.clmc'
    }
    expect(routeOpenResult(result)).toBe('page-count-mismatch')
  })

  it('kind hash-mismatch routes to hash-mismatch modal (H — HashMismatchModal)', () => {
    const result: ProjectOpenResult = {
      kind: 'hash-mismatch',
      resolvedPdfPath: 'C:/plans/planA.pdf',
      data: stubData,
      clmcPath: 'C:/plans/planA.clmc'
    }
    expect(routeOpenResult(result)).toBe('hash-mismatch')
  })

  it('kind error routes to open-error modal (OpenErrorModal — previously console-only)', () => {
    const result: ProjectOpenResult = {
      kind: 'error',
      message: 'ENOENT: no such file or directory'
    }
    expect(routeOpenResult(result)).toBe('open-error')
  })
})
