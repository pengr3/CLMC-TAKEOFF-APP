import { describe, it, expect } from 'vitest'
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
