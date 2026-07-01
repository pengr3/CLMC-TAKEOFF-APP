import { describe, it, expect } from 'vitest'
import { migrate, validateV1, validateV2, type ProjectFileV1, type ProjectFileV2 } from '@renderer/lib/project-schema'

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

  it('migrate v1 returns wasMigrated=true with upgraded v2 data', () => {
    const result = migrate(VALID_V1, 1)
    expect(result.wasMigrated).toBe(true)
    expect(result.data.formatVersion).toBe(2)
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

const VALID_V2: ProjectFileV2 = {
  formatVersion: 2,
  createdAt: '2026-04-30T00:00:00.000Z',
  updatedAt: '2026-04-30T00:00:00.000Z',
  pdf: { originalFilename: 'plans.pdf', sha256: 'abc', totalPages: 1 },
  globalUnit: 'm',
  categories: {},
  categoryOrder: [],
  currentPage: 1,
  pages: []
}

describe('project-schema v2', () => {
  it('validateV2 accepts a valid ProjectFileV2', () => {
    expect(() => validateV2(VALID_V2)).not.toThrow()
    expect(validateV2(VALID_V2)).toEqual(VALID_V2)
  })

  it('validateV2 rejects formatVersion !== 2', () => {
    const bad = { ...VALID_V2, formatVersion: 1 as unknown as 2 }
    expect(() => validateV2(bad)).toThrow(/formatVersion 2/)
  })

  it('validateV2 rejects missing pdf.originalFilename', () => {
    const bad = { ...VALID_V2, pdf: { sha256: 'abc', totalPages: 1 } as unknown as ProjectFileV2['pdf'] }
    expect(() => validateV2(bad)).toThrow(/originalFilename/)
  })

  it('migrate(v1, 1) returns { data: v2, wasMigrated: true } with originalFilename derived from absolutePath', () => {
    const result = migrate(VALID_V1, 1)
    expect(result.wasMigrated).toBe(true)
    expect(result.data.formatVersion).toBe(2)
    expect(result.data.pdf.originalFilename).toBe('plans.pdf')   // basename of 'C:/plans.pdf'
    expect(result.data.pdf.sha256).toBe(VALID_V1.pdf.sha256)
    expect(result.data.pdf.totalPages).toBe(VALID_V1.pdf.totalPages)
    expect((result.data.pdf as Record<string, unknown>).absolutePath).toBeUndefined()
    expect((result.data.pdf as Record<string, unknown>).relativePath).toBeUndefined()
  })

  it('migrate(v2, 2) returns { data: v2, wasMigrated: false }', () => {
    const result = migrate(VALID_V2, 2)
    expect(result.wasMigrated).toBe(false)
    expect(result.data).toEqual(VALID_V2)
  })

  it('migrate(_, 999) throws Unsupported formatVersion', () => {
    expect(() => migrate(VALID_V2, 999)).toThrow(/Unsupported formatVersion: 999/)
  })

  // ===========================================================================
  // Phase 16 — `rates` remains an ADDITIVE optional field (NO formatVersion
  // bump), now carrying the widened PriceEntry ({material,labor,markup}) map.
  // validateV2 stays throw-free for additive fields (locked decision); coercion
  // of a legacy scalar / malformed map is tested via hydrate, NOT here. These
  // assert that validateV2 ACCEPTS a PriceEntry-map-bearing object and tolerates
  // absence. Unlike the RED tests in this plan, these PASS today (validateV2
  // does not inspect `rates` — it rides the trailing `return raw as
  // ProjectFileV2` cast) and MUST STAY passing after the element type widens.
  // ===========================================================================

  it('validateV2 ACCEPTS a ProjectFileV2 carrying a PriceEntry rates field (additive, no throw)', () => {
    const withRates = {
      ...VALID_V2,
      rates: {
        'Outlet|count': { material: 5, labor: 3, markup: 30 },
        'Skirting|perimeter': { material: 12, labor: 4, markup: 25 }
      }
    }
    // MUST NOT throw — rates is additive and validateV2 stays throw-free for it.
    expect(() => validateV2(withRates as unknown as ProjectFileV2)).not.toThrow()
    // And the field survives validation (round-trips through the validator).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((validateV2(withRates as unknown as ProjectFileV2) as any).rates).toEqual({
      'Outlet|count': { material: 5, labor: 3, markup: 30 },
      'Skirting|perimeter': { material: 12, labor: 4, markup: 25 }
    })
  })

  it('validateV2 passes a fixture LACKING rates (legacy tolerance)', () => {
    // VALID_V2 has no `rates` key — a pre-Phase-16 file must still validate.
    expect(() => validateV2(VALID_V2)).not.toThrow()
  })
})
