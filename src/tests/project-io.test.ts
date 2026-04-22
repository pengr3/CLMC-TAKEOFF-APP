import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
// import { sha256File, resolvePdfPath, computeRelativePath, enforceClmcExtension } from '../main/project-io'

const FIXTURE = resolve(__dirname, 'fixtures/sample-1page.pdf')

describe('project-io', () => {
  it('sha256 stream equals buffer (deterministic hash for fixture PDF)', () => {
    expect(true).toBe(false)
  })

  it('cross-drive returns null (path.relative fallback)', () => {
    expect(true).toBe(false)
  })

  it('enforces .clmc extension — appends when missing', () => {
    expect(true).toBe(false)
  })

  it('prefers absolute when both paths exist', () => {
    expect(true).toBe(false)
  })

  it('falls back to relative when absolute missing', () => {
    expect(true).toBe(false)
  })

  it('returns null when both missing', () => {
    expect(true).toBe(false)
  })
})
