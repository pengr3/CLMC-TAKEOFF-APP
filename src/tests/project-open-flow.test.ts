import { describe, it, expect, vi } from 'vitest'

// Mock pdf-setup to prevent pdfjs-dist DOMMatrix errors in node/jsdom environment.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { routeOpenResult } from '@renderer/hooks/useProject'
import type { ProjectOpenResult } from '@renderer/hooks/useProject'

/**
 * Minimal ProjectFileV2 stub for tests that need a data payload.
 * Only the shape matters — these tests do not invoke project loading logic.
 */
const stubData = {
  formatVersion: 2,
  createdAt: '2026-04-30T00:00:00.000Z',
  updatedAt: '2026-04-30T00:00:00.000Z',
  pdf: { originalFilename: 'plans.pdf', sha256: 'abc', totalPages: 1 },
  globalUnit: 'm',
  categories: {},
  categoryOrder: [],
  currentPage: 1,
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

  // Wave 4 widens routeOpenResult return type to include 'archive-corrupted'
  it('kind archive-corrupted routes to archive-corrupted modal (D-07 — embedded PDF hash mismatch)', () => {
    const result: ProjectOpenResult = {
      kind: 'archive-corrupted',
      validated: stubData,
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),  // %PDF
      clmcPath: 'C:/plans/planA.clmc'
    }
    expect(routeOpenResult(result)).toBe('archive-corrupted')
  })

  it('kind error routes to open-error modal (OpenErrorModal — previously console-only)', () => {
    const result: ProjectOpenResult = {
      kind: 'error',
      message: 'ENOENT: no such file or directory'
    }
    expect(routeOpenResult(result)).toBe('open-error')
  })
})
