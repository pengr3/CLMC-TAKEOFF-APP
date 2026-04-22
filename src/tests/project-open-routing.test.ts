import { describe, it, expect } from 'vitest'
// import { routeOpenByExtension } from '@renderer/hooks/useProject' // or similar

describe('project-open-routing', () => {
  it('.pdf extension routes to fresh-open path', () => {
    expect(true).toBe(false)
  })

  it('.clmc extension routes to hydrate path', () => {
    expect(true).toBe(false)
  })

  it('case-insensitive — .PDF and .CLMC both route correctly', () => {
    expect(true).toBe(false)
  })

  it('unknown extension rejects with descriptive error', () => {
    expect(true).toBe(false)
  })
})
