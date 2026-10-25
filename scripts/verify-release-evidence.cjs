/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Direct Node acceptance evidence validation. */
const fs = require('node:fs')
const path = require('node:path')
const REQUIRED_CASES = [
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
const text = (value) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !/^(pending|unknown|tbd|todo|not supplied)$/i.test(value.trim())
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const date = (value) => text(value) && Number.isFinite(Date.parse(value))
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
const list = (value) => (Array.isArray(value) ? value : [])
function validateEvidence(record, manifest) {
  const errors = []
  if (!record || typeof record !== 'object' || record.schemaVersion !== 1)
    return ['Missing/unsupported evidence schema']
  if (
    !hash(manifest?.installer?.sha256) ||
    !hash(manifest?.archive?.sha256) ||
    !text(manifest?.version)
  )
    return ['Invalid inspected candidate manifest']
  if (
    record.candidate?.version !== manifest.version ||
    record.candidate?.installerSha256 !== manifest.installer.sha256 ||
    record.candidate?.archiveSha256 !== manifest.archive.sha256
  )
    errors.push('Evidence does not identify the exact inspected candidate')
  const machines = list(record.machines),
    fixtures = list(record.fixtures),
    cases = list(record.cases)
  if (
    !['approvedLocation', 'releaseOwner', 'signingPolicy', 'signingOwner'].every((field) =>
      text(record.handoff?.[field])
    )
  )
    errors.push('Approved handoff location/owner/signing policy remains pending')
  for (const requirement of ['REL-01', 'REL-02', 'REL-04', 'REL-05']) {
    const reviews = list(record.edgeReviews).filter((review) => review?.requirement === requirement)
    const review = reviews[0]
    if (
      reviews.length !== 1 ||
      review?.status !== 'reviewed' ||
      !text(review?.reviewer) ||
      !date(review?.date) ||
      !text(review?.artifact) ||
      !text(review?.disposition)
    )
      errors.push(`${requirement}: unclassified edge assumption still requires explicit review`)
  }
  for (const id of REQUIRED_CASES) {
    const matches = cases.filter((entry) => entry?.id === id)
    if (matches.length !== 1) {
      errors.push(`${id}: missing or duplicate required case`)
      continue
    }
    const entry = matches[0]
    if (entry.candidateSha256 !== manifest.installer.sha256)
      errors.push(`${id}: wrong candidate hash`)
    if (
      !text(entry.tester) ||
      !date(entry.date) ||
      !text(entry.procedure) ||
      !text(entry.expected) ||
      !text(entry.actual) ||
      !list(entry.artifacts).length ||
      !entry.artifacts.every(text)
    )
      errors.push(`${id}: missing tester/date/procedure/expected/actual/artifact provenance`)
    if (entry.status === 'not-applicable') {
      const predecessor = record.predecessor
      const attestation = predecessor?.attestation
      const hasDeployedInventory = [
        'version',
        'installerSha256',
        'registration',
        'inventoryArtifact'
      ].some((field) => Object.hasOwn(predecessor || {}, field))
      if (
        id !== 'actual-predecessor-upgrade' ||
        predecessor?.kind !== 'none-deployed' ||
        hasDeployedInventory ||
        attestation?.source !== 'human-release-owner' ||
        !text(attestation?.releaseOwner) ||
        attestation.releaseOwner !== record.handoff?.releaseOwner ||
        entry.tester !== attestation.releaseOwner ||
        !date(attestation?.date) ||
        attestation?.noDeployedPredecessor !== true ||
        !text(attestation?.statement) ||
        !text(attestation?.artifact) ||
        !list(entry.artifacts).includes(attestation.artifact)
      )
        errors.push(
          `${id}: not-applicable is limited to first release with explicit human release-owner attestation that no predecessor was deployed`
        )
      // No upgrade was performed: do not invent hardware, fixtures or passing measurement checks.
      continue
    }
    const machineMatches = machines.filter((machine) => machine?.id === entry.machineId)
    const machine = machineMatches[0]
    if (
      machineMatches.length !== 1 ||
      machine?.classification !== 'non-development' ||
      !text(machine?.name) ||
      !text(machine?.windows) ||
      machine?.architecture !== 'x64' ||
      !positive(machine?.ramGiB) ||
      !Number.isSafeInteger(machine?.monitorCount) ||
      machine.monitorCount < 1 ||
      !list(machine?.supportedScaling).includes(100)
    )
      errors.push(`${id}: missing non-development Windows x64 hardware provenance`)
    if (!list(entry.fixtureIds).length) errors.push(`${id}: missing fixtures`)
    for (const fixtureId of list(entry.fixtureIds)) {
      const matches = fixtures.filter((fixture) => fixture?.id === fixtureId)
      const fixture = matches[0]
      if (
        matches.length !== 1 ||
        !text(fixture?.name) ||
        !text(fixture?.approvedBy) ||
        !text(fixture?.kind) ||
        !hash(fixture?.sha256) ||
        !positive(fixture?.bytes) ||
        !Number.isSafeInteger(fixture?.pages) ||
        fixture.pages < 1 ||
        !text(fixture?.oracleSource)
      )
        errors.push(`${id}: incomplete approved fixture provenance ${fixtureId}`)
    }
    if (entry.status === 'unsupported') {
      const scaling = Number(id.match(/^scaling-(125|150|200)$/)?.[1])
      const hardwareUnavailable =
        (scaling && !list(machine?.supportedScaling).includes(scaling)) ||
        (id === 'monitor-transition' && machine?.monitorCount === 1)
      const review = entry.disposition
      if (
        !hardwareUnavailable ||
        !text(review?.reviewer) ||
        !date(review?.date) ||
        !text(review?.reason) ||
        !text(review?.artifact)
      )
        errors.push(
          `${id}: unsupported requires actual hardware limitation and explicit external review`
        )
      continue
    }
    if (entry.status !== 'pass')
      errors.push(`${id}: status ${entry.status || 'missing'} is not accepted`)
    if (!list(entry.checks).length) errors.push(`${id}: missing independent expected/actual checks`)
    for (const check of list(entry.checks)) {
      const tolerance = check?.tolerance ?? 0
      const numeric = typeof check?.expected === 'number'
      const valid =
        text(check?.metric) &&
        typeof tolerance === 'number' &&
        Number.isFinite(tolerance) &&
        tolerance >= 0 &&
        (numeric
          ? Number.isFinite(check.expected) &&
            typeof check.actual === 'number' &&
            Number.isFinite(check.actual) &&
            tolerance <= Math.max(0.001, Math.abs(check.expected) * 0.001) &&
            Math.abs(check.expected - check.actual) <= tolerance
          : ['string', 'boolean'].includes(typeof check?.expected) &&
            check.actual === check.expected)
      if (!valid)
        errors.push(`${id}: independent check failed or invalid ${check?.metric || 'unnamed'}`)
    }
    if (id.startsWith('scaling-') && !list(machine?.supportedScaling).includes(Number(id.slice(8))))
      errors.push(`${id}: pass cannot claim unsupported physical scaling`)
    if (id === 'monitor-transition' && machine?.monitorCount < 2)
      errors.push(`${id}: pass requires an actual multi-monitor transition`)
    if (id === 'actual-predecessor-upgrade') {
      const predecessor = record.predecessor
      const previous = /^\d+\.\d+\.\d+$/.test(predecessor?.version || '')
        ? predecessor.version.split('.').map(Number)
        : []
      const current = manifest.version.split('.').map(Number)
      const firstDifference = previous.findIndex((part, index) => part !== current[index])
      const older =
        previous.length === 3 &&
        firstDifference >= 0 &&
        previous[firstDifference] < current[firstDifference]
      if (
        predecessor?.kind !== 'actual-installed' ||
        !text(predecessor?.version) ||
        !hash(predecessor?.installerSha256) ||
        !text(predecessor?.registration) ||
        !text(predecessor?.inventoryArtifact) ||
        !older
      )
        errors.push(
          `${id}: generated predecessor exercise cannot replace actual deployed-install inventory`
        )
    }
  }
  return errors
}
module.exports = { validateEvidence, REQUIRED_CASES }
if (require.main === module) {
  try {
    const record = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
    const manifest = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
    const errors = validateEvidence(record, manifest)
    for (const review of list(record.edgeReviews).filter((review) => review.status === 'reviewed'))
      if (!text(review.artifact) || !fs.existsSync(path.resolve(review.artifact)))
        errors.push(`${review.requirement}: missing actual review artifact`)
    for (const entry of list(record.cases).filter((entry) =>
      ['pass', 'unsupported', 'not-applicable'].includes(entry.status)
    )) {
      const artifacts = [...list(entry.artifacts), entry.disposition?.artifact].filter(text)
      if (entry.id === 'actual-predecessor-upgrade') {
        if (entry.status === 'not-applicable')
          artifacts.push(record.predecessor?.attestation?.artifact)
        else artifacts.push(record.predecessor?.inventoryArtifact)
      }
      for (const artifact of artifacts)
        if (!text(artifact) || !fs.existsSync(path.resolve(artifact)))
          errors.push(`${entry.id}: missing actual artifact ${artifact}`)
    }
    console.log(
      JSON.stringify(
        {
          status: errors.length ? 'awaiting-evidence' : 'accepted-evidence',
          requiredCases: REQUIRED_CASES.length,
          errors
        },
        null,
        2
      )
    )
    if (errors.length) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
