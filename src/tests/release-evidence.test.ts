import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const validate = (() => {
  try {
    return require('../../scripts/verify-release-evidence.cjs').validateEvidence
  } catch {
    return () => []
  }
})()
const hash = 'a'.repeat(64)
const manifest = {
  version: '1.1.0',
  installer: { sha256: hash },
  archive: { sha256: 'b'.repeat(64) }
}
const ids = [
  'fresh-install',
  'actual-predecessor-upgrade',
  'project-only-transfer',
  'recovery-saved',
  'recovery-never-saved',
  'failed-save-backup',
  'offline-workflow',
  'large-vector',
  'large-scan',
  'multipage-navigation',
  'scaling-100',
  'scaling-125',
  'scaling-150',
  'scaling-200',
  'monitor-transition',
  'ui-keyboard-overflow'
]
const completeFixture = {
  schemaVersion: 1,
  candidate: { version: '1.1.0', installerSha256: hash, archiveSha256: 'b'.repeat(64) },
  handoff: {
    approvedLocation: 'approved-share',
    releaseOwner: 'Release owner',
    signingPolicy: 'Reviewed unsigned internal candidate',
    signingOwner: 'Release owner'
  },
  edgeReviews: ['REL-01', 'REL-02', 'REL-04', 'REL-05'].map((requirement) => ({
    requirement,
    status: 'reviewed',
    reviewer: 'Independent reviewer',
    date: '2026-10-22',
    artifact: 'evidence/edge-review.json',
    disposition: 'Actual evidence reviewed'
  })),
  machines: [
    {
      id: 'target',
      classification: 'non-development',
      name: 'Approved test PC',
      windows: 'Windows 11 24H2',
      architecture: 'x64',
      ramGiB: 16,
      supportedScaling: [100, 125, 150, 200],
      monitorCount: 2
    }
  ],
  fixtures: [
    {
      id: 'plans',
      name: 'Approved construction fixtures',
      approvedBy: 'Estimator',
      sha256: 'c'.repeat(64),
      bytes: 120000000,
      pages: 40,
      kind: 'vector-and-scan',
      oracleSource: 'Independent estimator measurements'
    }
  ],
  predecessor: {
    kind: 'actual-installed',
    version: '1.0.0',
    installerSha256: 'd'.repeat(64),
    registration: 'Actual inventory identity',
    inventoryArtifact: 'evidence/predecessor.json'
  },
  cases: ids.map((id) => ({
    id,
    status: 'pass',
    machineId: 'target',
    fixtureIds: ['plans'],
    candidateSha256: hash,
    tester: 'Estimator',
    date: '2026-10-22T03:00:00Z',
    procedure: `Executed documented ${id} steps`,
    expected: 'Independent fixture oracle agrees',
    actual: 'Observed documented results agree',
    artifacts: [`evidence/${id}.json`],
    checks: [{ metric: 'known length in metres', expected: 10, actual: 10, tolerance: 0.0001 }]
  }))
}
function complete(): typeof completeFixture {
  return structuredClone(completeFixture)
}
type FirstReleaseRecord = Omit<typeof completeFixture, 'predecessor'> & {
  predecessor: {
    kind: string
    attestation: {
      source: string
      releaseOwner: string
      date: string
      noDeployedPredecessor: boolean
      statement: string
      artifact: string
    }
  }
}
function firstRelease(): FirstReleaseRecord {
  const record = complete()
  const artifact = 'evidence/first-release-attestation.json'
  const upgrade = record.cases.find((entry) => entry.id === 'actual-predecessor-upgrade')!
  Object.assign(upgrade, {
    status: 'not-applicable',
    tester: record.handoff.releaseOwner,
    procedure: 'Release owner attested to the deployment history for this candidate',
    expected: 'An upgrade is applicable only if a predecessor was deployed',
    actual: 'Release owner confirmed this is the first release; no predecessor was deployed',
    artifacts: [artifact],
    fixtureIds: [],
    checks: []
  })
  Reflect.deleteProperty(upgrade, 'machineId')
  return {
    ...record,
    predecessor: {
      kind: 'none-deployed',
      attestation: {
        source: 'human-release-owner',
        releaseOwner: record.handoff.releaseOwner,
        date: '2026-10-22',
        noDeployedPredecessor: true,
        statement: 'This is the first release. No predecessor has ever been deployed.',
        artifact
      }
    }
  }
}
describe('candidate-bound installed release evidence', () => {
  it('accepts complete required non-development provenance', () => {
    expect(validate(complete(), manifest)).toEqual([])
  })
  it('rejects blank and pending defaults', () => {
    expect(validate({}, manifest).length).toBeGreaterThan(0)
    const record = complete()
    record.cases[0].status = 'pending'
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
  it.each(['fail', 'blocked', 'unsupported'])(
    'rejects %s required cases without disposition',
    (status) => {
      const record = complete()
      record.cases[0].status = status
      expect(validate(record, manifest).length).toBeGreaterThan(0)
    }
  )
  it('rejects wrong candidate hashes and versions in record or case', () => {
    const record = complete()
    record.candidate.installerSha256 = 'e'.repeat(64)
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const other = complete()
    other.cases[0].candidateSha256 = 'e'.repeat(64)
    expect(validate(other, manifest).length).toBeGreaterThan(0)
    const wrongVersion = complete()
    wrongVersion.candidate.version = '1.2.0'
    expect(validate(wrongVersion, manifest).length).toBeGreaterThan(0)
  })
  it('rejects developer-host evidence as required non-development evidence', () => {
    const record = complete()
    record.machines[0].classification = 'development'
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
  it('rejects missing tester, dates, fixtures, results and artifacts', () => {
    for (const field of [
      'tester',
      'date',
      'expected',
      'actual',
      'artifacts',
      'fixtureIds',
      'checks'
    ]) {
      const record = complete()
      Reflect.deleteProperty(record.cases[0], field)
      expect(validate(record, manifest).length, field).toBeGreaterThan(0)
    }
  })
  it('rejects wrong independent numerical results and generated predecessor substitutes', () => {
    const record = complete()
    record.cases[0].checks[0].actual = 11
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const generated = complete()
    generated.predecessor.kind = 'generated-exercise'
    expect(validate(generated, manifest).length).toBeGreaterThan(0)
    const newer = complete()
    newer.predecessor.version = '1.2.0'
    expect(validate(newer, manifest).length).toBeGreaterThan(0)
  })
  it('accepts a first-release non-applicable upgrade only with human release-owner attestation', () => {
    expect(validate(firstRelease(), manifest)).toEqual([])
  })
  it('does not turn a first release into a passed upgrade or waive other cases', () => {
    const passed = firstRelease()
    passed.cases.find((entry) => entry.id === 'actual-predecessor-upgrade')!.status = 'pass'
    expect(validate(passed, manifest).length).toBeGreaterThan(0)
    const unrelated = firstRelease()
    unrelated.cases[0].status = 'not-applicable'
    expect(validate(unrelated, manifest).length).toBeGreaterThan(0)
    const pending = firstRelease()
    pending.cases[0].status = 'pending'
    expect(validate(pending, manifest).length).toBeGreaterThan(0)
  })
  it('retains candidate and case provenance requirements for a non-applicable upgrade', () => {
    for (const field of [
      'candidateSha256',
      'tester',
      'date',
      'procedure',
      'expected',
      'actual',
      'artifacts'
    ]) {
      const record = firstRelease()
      const upgrade = record.cases.find((entry) => entry.id === 'actual-predecessor-upgrade')!
      Reflect.deleteProperty(upgrade, field)
      expect(validate(record, manifest).length, field).toBeGreaterThan(0)
    }
  })
  it('rejects incomplete, non-human, mismatched or contradictory first-release attestations', () => {
    for (const field of [
      'source',
      'releaseOwner',
      'date',
      'noDeployedPredecessor',
      'statement',
      'artifact'
    ]) {
      const record = firstRelease()
      Reflect.deleteProperty(record.predecessor.attestation, field)
      expect(validate(record, manifest).length, field).toBeGreaterThan(0)
    }
    const variants = [
      { source: 'automated-exercise' },
      { releaseOwner: 'Someone other than the release owner' },
      { date: 'pending' },
      { noDeployedPredecessor: false },
      { noDeployedPredecessor: 'true' },
      { statement: 'pending' }
    ]
    for (const variant of variants) {
      const record = firstRelease()
      Object.assign(record.predecessor.attestation, variant)
      expect(validate(record, manifest).length, JSON.stringify(variant)).toBeGreaterThan(0)
    }
    for (const kind of ['actual-installed', 'generated-exercise']) {
      const record = firstRelease()
      record.predecessor.kind = kind
      expect(validate(record, manifest).length, kind).toBeGreaterThan(0)
    }
    for (const field of ['version', 'installerSha256', 'registration', 'inventoryArtifact']) {
      const record = firstRelease()
      Object.assign(record.predecessor, { [field]: 'Contradictory deployed inventory' })
      expect(validate(record, manifest).length, field).toBeGreaterThan(0)
    }
    const unlinked = firstRelease()
    unlinked.cases.find((entry) => entry.id === 'actual-predecessor-upgrade')!.artifacts = [
      'evidence/unrelated.json'
    ]
    expect(validate(unlinked, manifest).length).toBeGreaterThan(0)
    const otherTester = firstRelease()
    otherTester.cases.find((entry) => entry.id === 'actual-predecessor-upgrade')!.tester =
      'Automation'
    expect(validate(otherTester, manifest).length).toBeGreaterThan(0)
    const wrongCandidate = firstRelease()
    wrongCandidate.cases.find(
      (entry) => entry.id === 'actual-predecessor-upgrade'
    )!.candidateSha256 = 'e'.repeat(64)
    expect(validate(wrongCandidate, manifest).length).toBeGreaterThan(0)
  })
  it('requires the first-release attestation artifact to exist when invoked as the release gate', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'clmc-first-release-evidence-'))
    try {
      const record = firstRelease()
      const actualArtifact = path.join(directory, 'observations.json')
      writeFileSync(actualArtifact, '{}')
      record.edgeReviews.forEach((review) => (review.artifact = actualArtifact))
      record.cases.forEach((entry) => (entry.artifacts = [actualArtifact]))
      record.predecessor.attestation.artifact = actualArtifact
      const recordPath = path.join(directory, 'record.json')
      const manifestPath = path.join(directory, 'manifest.json')
      writeFileSync(manifestPath, JSON.stringify(manifest))
      const run = (): SpawnSyncReturns<string> => {
        writeFileSync(recordPath, JSON.stringify(record))
        return spawnSync(
          process.execPath,
          [path.resolve('scripts/verify-release-evidence.cjs'), recordPath, manifestPath],
          { encoding: 'utf8', cwd: process.cwd() }
        )
      }
      const accepted = run()
      expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0)
      const missingArtifact = path.join(directory, 'missing-attestation.json')
      record.predecessor.attestation.artifact = missingArtifact
      record.cases
        .find((entry) => entry.id === 'actual-predecessor-upgrade')!
        .artifacts.push(missingArtifact)
      const rejected = run()
      expect(rejected.status, rejected.stdout + rejected.stderr).toBe(1)
      expect(rejected.stdout).toContain('missing actual artifact')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it('rejects missing, duplicate cases and missing hardware/fixture provenance', () => {
    const record = complete()
    record.cases.pop()
    expect(validate(record, manifest).length).toBeGreaterThan(0)
    const duplicate = complete()
    duplicate.cases.push(duplicate.cases[0])
    expect(validate(duplicate, manifest).length).toBeGreaterThan(0)
    const badFixture = complete()
    badFixture.fixtures[0].sha256 = ''
    expect(validate(badFixture, manifest).length).toBeGreaterThan(0)
    const badMachine = complete()
    badMachine.machines[0].ramGiB = 0
    expect(validate(badMachine, manifest).length).toBeGreaterThan(0)
  })
  it('allows unavailable physical scaling only with explicit external review and hardware reason', () => {
    const record = complete()
    record.machines[0].supportedScaling = [100, 125, 150]
    const unavailable = record.cases.find((c) => c.id === 'scaling-200')!
    unavailable.status = 'unsupported'
    Object.assign(unavailable, {
      disposition: {
        reviewer: 'Release reviewer',
        date: '2026-10-22',
        reason: 'This target display supports only 100/125/150 percent',
        artifact: 'evidence/hardware-review.json'
      }
    })
    expect(validate(record, manifest)).toEqual([])
    record.machines[0].supportedScaling.push(200)
    expect(validate(record, manifest).length).toBeGreaterThan(0)
  })
})
