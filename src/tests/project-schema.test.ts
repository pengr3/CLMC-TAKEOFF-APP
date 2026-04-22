import { describe, it, expect } from 'vitest'
// Import path MUST be the real one so Wave 1 implementers see the linker error first:
// import { migrate, validateV1, type ProjectFileV1 } from '@renderer/lib/project-schema'

describe('project-schema', () => {
  it('round-trip preserves all D-02 top-level fields', () => {
    expect(true).toBe(false) // NOT IMPLEMENTED — Wave 1 task: project-schema.ts
  })

  it('migrate v1 identity returns the same object shape', () => {
    expect(true).toBe(false) // NOT IMPLEMENTED
  })

  it('migrate unknown version throws descriptive error', () => {
    expect(true).toBe(false) // NOT IMPLEMENTED
  })

  it('rejects missing formatVersion', () => {
    expect(true).toBe(false) // NOT IMPLEMENTED
  })

  it('accepts a valid ProjectFileV1 object', () => {
    expect(true).toBe(false) // NOT IMPLEMENTED
  })
})
