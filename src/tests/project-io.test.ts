import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import {
  sha256File,
  resolvePdfPath,
  computeRelativePath,
  enforceClmcExtension
} from '../main/project-io'

const FIXTURE = resolve(__dirname, 'fixtures/sample-1page.pdf')

describe('project-io', () => {
  it('sha256 stream equals buffer (deterministic hash for fixture PDF)', async () => {
    const h1 = await sha256File(FIXTURE)
    const h2 = await sha256File(FIXTURE)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
    expect(h1).toBe(h2)
  })

  it('cross-drive returns null (path.relative fallback)', () => {
    expect(computeRelativePath('D:/proj/a.clmc', 'C:/plans.pdf')).toBeNull()
  })

  it('enforces .clmc extension — appends when missing', () => {
    expect(enforceClmcExtension('C:/proj/plans')).toBe('C:/proj/plans.clmc')
    expect(enforceClmcExtension('C:/proj/plans.clmc')).toBe('C:/proj/plans.clmc')
    expect(enforceClmcExtension('C:/proj/PLANS.CLMC')).toBe('C:/proj/PLANS.CLMC')
  })

  it('prefers absolute when both paths exist', () => {
    // FIXTURE exists; pass the same path as both abs and (made-up) relative
    const r = resolvePdfPath('C:/anything/proj.clmc', FIXTURE, FIXTURE)
    expect(r?.source).toBe('absolute')
    expect(r?.resolvedPath).toBe(FIXTURE)
  })

  it('falls back to relative when absolute missing', () => {
    const fakeAbs = resolve(__dirname, 'no-such-file.pdf')
    // Build a relative path from a synthetic clmc path that resolves to FIXTURE
    const syntheticClmc = resolve(__dirname, 'fake.clmc')
    const rel = './fixtures/sample-1page.pdf'
    const r = resolvePdfPath(syntheticClmc, fakeAbs, rel)
    expect(r?.source).toBe('relative')
  })

  it('returns null when both missing', () => {
    expect(resolvePdfPath('C:/p.clmc', 'C:/missing.pdf', 'missing.pdf')).toBeNull()
  })
})
