import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const validate = (() => {
  try { return require('../../scripts/verify-release-evidence.cjs').validateEvidence }
  catch { return () => [] }
})()
const hash = 'a'.repeat(64)
const manifest = { version: '1.1.0', installer: { sha256: hash }, archive: { sha256: 'b'.repeat(64) } }
const ids = ['fresh-install', 'actual-predecessor-upgrade', 'project-only-transfer', 'recovery-saved', 'recovery-never-saved', 'failed-save-backup', 'offline-workflow', 'large-vector', 'large-scan', 'multipage-navigation', 'scaling-100', 'scaling-125', 'scaling-150', 'scaling-200', 'monitor-transition', 'ui-keyboard-overflow']
function complete() {
  return {
    schemaVersion: 1,
    candidate: { version: '1.1.0', installerSha256: hash, archiveSha256: 'b'.repeat(64) },
    machines: [{ id: 'target', classification: 'non-development', name: 'Approved test PC', windows: 'Windows 11 24H2', architecture: 'x64', ramGiB: 16, supportedScaling: [100, 125, 150, 200], monitorCount: 2 }],
    fixtures: [{ id: 'plans', name: 'Approved construction fixtures', approvedBy: 'Estimator', sha256: 'c'.repeat(64), bytes: 120000000, pages: 40, kind: 'vector-and-scan', oracleSource: 'Independent estimator measurements' }],
    predecessor: { kind: 'actual-installed', version: '1.0.0', installerSha256: 'd'.repeat(64), registration: 'Actual inventory identity', inventoryArtifact: 'evidence/predecessor.json' },
    cases: ids.map(id => ({ id, status: 'pass', machineId: 'target', fixtureIds: ['plans'], candidateSha256: hash, tester: 'Estimator', date: '2026-10-22T03:00:00Z', procedure: `Executed documented ${id} steps`, expected: 'Independent fixture oracle agrees', actual: 'Observed documented results agree', artifacts: [`evidence/${id}.json`], checks: [{ metric: 'known length in metres', expected: 10, actual: 10, tolerance: 0.0001 }] }))
  }
}
describe('candidate-bound installed release evidence', () => {
  it('accepts complete required non-development provenance', () => {
    expect(validate(complete(), manifest)).toEqual([])
  })
  it('rejects blank and pending defaults', () => {
    expect(validate({}, manifest).length).toBeGreaterThan(0)
    const record = complete(); record.cases[0].status = 'pending'
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
  it.each(['fail', 'blocked', 'unsupported'])('rejects %s required cases without disposition', status => {
    const record = complete(); record.cases[0].status = status
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
  it('rejects wrong candidate hashes and versions in record or case', () => {
    const record = complete(); record.candidate.installerSha256 = 'e'.repeat(64)
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const other = complete(); other.cases[0].candidateSha256 = 'e'.repeat(64)
    expect(validate(other, manifest).length).toBeGreaterThan(0)
    const wrongVersion = complete(); wrongVersion.candidate.version = '1.2.0'
    expect(validate(wrongVersion, manifest).length).toBeGreaterThan(0)
  })
  it('rejects developer-host evidence as required non-development evidence', () => {
    const record = complete(); record.machines[0].classification = 'development'
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
  it('rejects missing tester, dates, fixtures, results and artifacts', () => {
    for (const field of ['tester', 'date', 'expected', 'actual', 'artifacts', 'fixtureIds', 'checks']) {
      const record = complete(); Reflect.deleteProperty(record.cases[0], field)
      expect(validate(record, manifest).length, field).toBeGreaterThan(0)
    }
  })
  it('rejects wrong independent numerical results and generated predecessor substitutes', () => {
    const record = complete(); record.cases[0].checks[0].actual = 11
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const generated = complete(); generated.predecessor.kind = 'generated-exercise'
    expect(validate(generated, manifest).length).toBeGreaterThan(0)
  })
  it('rejects missing, duplicate cases and missing hardware/fixture provenance', () => {
    const record = complete(); record.cases.pop()
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const duplicate = complete(); duplicate.cases.push(duplicate.cases[0])
    expect(validate(duplicate, manifest).length).toBeGreaterThan(0)
    const badFixture = complete(); badFixture.fixtures[0].sha256 = ''
    expect(validate(badFixture, manifest).length).toBeGreaterThan(0)
    const badMachine = complete(); badMachine.machines[0].ramGiB = 0
    expect(validate(badMachine, manifest).length).toBeGreaterThan(0)
  })
  it('allows unavailable physical scaling only with explicit external review and hardware reason', () => {
    const record = complete()
    record.machines[0].supportedScaling = [100, 125, 150]
    const unavailable = record.cases.find(c => c.id === 'scaling-200')!
    unavailable.status = 'unsupported'
    Object.assign(unavailable, { disposition: { reviewer: 'Release reviewer', date: '2026-10-22', reason: 'This target display supports only 100/125/150 percent', artifact: 'evidence/hardware-review.json' } })
    expect(validate(record, manifest)).toEqual([])
    record.machines[0].supportedScaling.push(200)
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
})
