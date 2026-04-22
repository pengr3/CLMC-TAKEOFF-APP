import { describe, it, expect, vi } from 'vitest'

// Mock pdf-setup to prevent pdfjs-dist DOMMatrix errors in node/jsdom environment.
// routeOpenByExtension is a pure string helper — it does not use PDF.js at all.
vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

import { routeOpenByExtension } from '@renderer/hooks/useProject'

describe('project-open-routing', () => {
  it('.pdf extension routes to fresh-open path', () => {
    expect(routeOpenByExtension('.pdf')).toBe('pdf')
  })

  it('.clmc extension routes to hydrate path', () => {
    expect(routeOpenByExtension('.clmc')).toBe('clmc')
  })

  it('case-insensitive — .PDF and .CLMC both route correctly', () => {
    expect(routeOpenByExtension('.PDF')).toBe('pdf')
    expect(routeOpenByExtension('.CLMC')).toBe('clmc')
    expect(routeOpenByExtension('.Pdf')).toBe('pdf')
  })

  it('unknown extension rejects with descriptive error', () => {
    expect(routeOpenByExtension('.txt')).toBe('unknown')
    expect(routeOpenByExtension('')).toBe('unknown')
    expect(routeOpenByExtension('.docx')).toBe('unknown')
  })
})
