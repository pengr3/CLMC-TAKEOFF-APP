import { describe, it, expect } from 'vitest'
import { migrate, validateV1, type ProjectFileV1 } from '@renderer/lib/project-schema'

const VALID_V1: ProjectFileV1 = {
  formatVersion: 1,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
  pdf: { absolutePath: 'C:/plans.pdf', relativePath: null, totalPages: 1, sha256: 'abc' },
  globalUnit: 'm',
  categories: {},
  categoryOrder: [],
  currentPage: 1,
  pages: []
}

describe('project-schema', () => {
  it('round-trip preserves all D-02 top-level fields', () => {
    const json = JSON.stringify(VALID_V1)
    const parsed = JSON.parse(json) as unknown
    const validated = validateV1(parsed)
    expect(validated).toEqual(VALID_V1)
  })

  it('migrate v1 identity returns the same object shape', () => {
    expect(migrate(VALID_V1, 1)).toEqual(VALID_V1)
  })

  it('migrate unknown version throws descriptive error', () => {
    expect(() => migrate(VALID_V1, 999)).toThrow(/Unsupported formatVersion: 999/)
  })

  it('rejects missing formatVersion', () => {
    const bad = { ...VALID_V1, formatVersion: undefined as unknown as 1 }
    expect(() => validateV1(bad)).toThrow(/Expected formatVersion 1/)
  })

  it('accepts a valid ProjectFileV1 object', () => {
    expect(() => validateV1(VALID_V1)).not.toThrow()
  })
})
