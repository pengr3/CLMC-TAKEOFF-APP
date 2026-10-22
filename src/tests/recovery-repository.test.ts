import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, readdir, stat, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
import { RecoveryRepository, registerRecoveryHandlers } from '../main/project-recovery'
import { sha256Buffer } from '../main/project-io'
import type { RecoveryWrite, RecoveryCandidate } from '../shared/reliability'
let dir: string, pdf: Uint8Array
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clmc-recovery-repository-'))
  pdf = new Uint8Array(await readFile('src/tests/fixtures/sample-1page.pdf'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})
function input(session = randomUUID(), revision = 1, bytes = pdf): RecoveryWrite {
  return {
    session,
    revision,
    sourcePath: null,
    lastSavedAt: null,
    pdfBytes: bytes,
    projectJson: JSON.stringify({
      formatVersion: 2,
      createdAt: '2026-10-22',
      updatedAt: '2026-10-22',
      pdf: { originalFilename: 'plan.pdf', totalPages: 1, sha256: sha256Buffer(bytes) },
      globalUnit: 'm',
      categories: {},
      categoryOrder: [],
      currentPage: 1,
      pages: [
        {
          pageIndex: 1,
          dimensions: { width: 612, height: 792 },
          scale: null,
          viewport: { zoom: 1, panX: 0, panY: 0 },
          markups: []
        }
      ]
    })
  }
}
async function entries(repo: RecoveryRepository): Promise<RecoveryCandidate[]> {
  const result = await repo.list()
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.candidates
}
it('reclaims abandoned blobs after repeated manifest failures before charging the next snapshot', async () => {
  let fail = true
  const repo = new RecoveryRepository(dir, { maxBytes: 3500, fault: stage => {
    if (fail && stage === 'manifest-rename') throw new Error('interrupted manifest')
  } })
  for (let attempt = 0; attempt < 3; attempt++) {
    const bytes = Buffer.alloc(1700, attempt + 1); bytes.set(Buffer.from('%PDF-1.4'))
    expect(await repo.write(input(randomUUID(), 1, bytes))).toMatchObject({ ok: false, stage: 'write' })
  }
  expect(await entries(repo)).toEqual([])
  fail = false
  const bytes = Buffer.alloc(1700, 7); bytes.set(Buffer.from('%PDF-1.4'))
  expect((await repo.write(input(randomUUID(), 1, bytes))).ok).toBe(true)
})

it('reconciles owned crash blobs/stages after restart before quota admission', async () => {
  const repo = new RecoveryRepository(dir, { maxBytes: 3500 })
  await repo.list()
  await writeFile(join(repo.root, `${'a'.repeat(64)}.pdf`), Buffer.alloc(1700))
  await writeFile(join(repo.root, `${randomUUID()}.stage`), Buffer.alloc(1700))
  const restarted = new RecoveryRepository(dir, { maxBytes: 3500 })
  const bytes = Buffer.alloc(1700, 9); bytes.set(Buffer.from('%PDF-1.4'))
  expect((await restarted.write(input(randomUUID(), 1, bytes))).ok).toBe(true)
  expect((await readdir(repo.root)).filter(f => f.endsWith('.stage'))).toEqual([])
})

it('preserves every blob if any completed manifest is unreadable', async () => {
  const repo = new RecoveryRepository(dir)
  const good = input()
  expect((await repo.write(good)).ok).toBe(true)
  const owned = `${'a'.repeat(64)}.pdf`
  await writeFile(join(repo.root, `${randomUUID()}.json`), '{unreadable')
  await writeFile(join(repo.root, owned), 'possibly referenced')
  await new RecoveryRepository(dir).list()
  expect(await readFile(join(repo.root, owned), 'utf8')).toBe('possibly referenced')
  expect((await repo.read(good.session)).ok).toBe(true)
})
it('does no disk writes for an unchanged or older revision and stores the PDF only once', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  expect((await repo.write(i)).ok).toBe(true)
  const manifest = join(repo.root, `${i.session}.json`),
    before = await stat(manifest)
  const result = await repo.write(i)
  expect(result.ok && result.unchanged).toBe(true)
  expect((await stat(manifest)).mtimeMs).toBe(before.mtimeMs)
  expect((await repo.write({ ...i, revision: 0 })).ok).toBe(true)
  expect((await entries(repo))[0].revision).toBe(1)
  await repo.write({ ...i, revision: 2 })
  expect((await readdir(repo.root)).filter((f) => f.endsWith('.pdf'))).toHaveLength(1)
})
it('refuses new candidates at the quota while keeping every existing candidate', async () => {
  const repo = new RecoveryRepository(dir, { maxCandidates: 2 }),
    a = input(),
    b = input(),
    c = input()
  await repo.write(a)
  await repo.write(b)
  expect(await repo.write(c)).toMatchObject({ ok: false, stage: 'quota' })
  expect((await entries(new RecoveryRepository(dir))).map((c) => c.id).sort()).toEqual(
    [a.session, b.session].sort()
  )
  expect((await repo.read(a.session)).ok).toBe(true)
})
it('counts staging plus existing bytes and admits a replacement only with full transaction headroom', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  await repo.write(i)
  const names = await readdir(repo.root)
  const used = (await Promise.all(names.map((f) => stat(join(repo.root, f))))).reduce(
    (n, s) => n + s.size,
    0
  )
  await writeFile(join(repo.root, `${randomUUID()}.stage`), Buffer.alloc(200))
  const bounded = new RecoveryRepository(dir, { maxBytes: used + 199 })
  expect(await bounded.write({ ...i, revision: 2 })).toMatchObject({ ok: false, stage: 'quota' })
  expect((await entries(repo))[0].revision).toBe(1)
})
for (const stage of [
  'blob-write',
  'blob-flush',
  'blob-close',
  'blob-rename',
  'manifest-write',
  'manifest-flush',
  'manifest-close',
  'manifest-validate',
  'manifest-rename'
]) {
  it(`preserves the last completed revision after ${stage} failure and restart`, async () => {
    const original = new RecoveryRepository(dir),
      i = input()
    await original.write(i)
    const replacementPdf = new Uint8Array(
      Buffer.concat([Buffer.from(pdf), Buffer.from('\n% next PDF revision')])
    )
    const next = input(i.session, 2, replacementPdf)
    const failing = new RecoveryRepository(dir, {
      fault: (point: string) => {
        if (point === stage) throw new Error(`injected ${stage}`)
      }
    })
    expect((await failing.write(next)).ok).toBe(false)
    const restarted = new RecoveryRepository(dir)
    expect((await entries(restarted))[0].revision).toBe(1)
    expect(await restarted.read(i.session)).toMatchObject({ ok: true, pdfBytes: pdf })
  })
}
it('ignores interrupted staging and retains corrupt metadata and missing or damaged PDF with specific reasons', async () => {
  const repo = new RecoveryRepository(dir),
    a = input(),
    b = input(),
    c = input(
      randomUUID(),
      1,
      new Uint8Array(Buffer.concat([Buffer.from(pdf), Buffer.from('\n% second')]))
    )
  await repo.write(a)
  await repo.write(b)
  await repo.write(c)
  await writeFile(join(repo.root, `${randomUUID()}.stage`), 'interrupted')
  await writeFile(join(repo.root, `${a.session}.json`), '{broken')
  await rm(join(repo.root, `${sha256Buffer(pdf)}.pdf`))
  await writeFile(join(repo.root, `${sha256Buffer(c.pdfBytes)}.pdf`), 'corrupt')
  const listed = await entries(new RecoveryRepository(dir))
  expect(listed).toHaveLength(3)
  expect(listed.find((c) => c.id === a.session)).toMatchObject({
    restorable: false,
    problem: 'metadata'
  })
  expect(listed.find((c) => c.id === b.session)).toMatchObject({
    restorable: false,
    problem: 'pdf',
    filename: 'plan.pdf'
  })
  expect(listed.find((entry) => entry.id === c.session)).toMatchObject({
    restorable: false,
    problem: 'pdf'
  })
  expect((await repo.read(c.session)).ok).toBe(false)
  expect(await readdir(repo.root)).toContain(`${a.session}.json`)
})
it('detects metadata tampering even when PDF hash still matches', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  await repo.write(i)
  const path = join(repo.root, `${i.session}.json`),
    raw = JSON.parse(await readFile(path, 'utf8'))
  const project = JSON.parse(raw.projectJson)
  project.defaultMarkupPct = 999
  raw.projectJson = JSON.stringify(project)
  await writeFile(path, JSON.stringify(raw))
  expect((await entries(repo))[0].restorable).toBe(false)
  expect((await repo.read(i.session)).ok).toBe(false)
})
it('serializes exact retirement against snapshots and protects newer and other candidates', async () => {
  const repo = new RecoveryRepository(dir),
    a = input(),
    b = input()
  await repo.write(a)
  await repo.write(b)
  await Promise.all([repo.write({ ...a, revision: 2 }), repo.retire(a.session, 1)])
  expect((await entries(repo)).find((c) => c.id === a.session)?.revision).toBe(2)
  await repo.retire(a.session, 2)
  expect((await entries(repo)).map((c) => c.id)).toEqual([b.session])
  expect((await repo.write(a)).ok).toBe(false) // An in-flight old snapshot cannot resurrect explicitly retired work.
})
it('retains entries on delete failure and denies unknown IDs and untrusted senders', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  await repo.write(i)
  const failure = new RecoveryRepository(dir, {
    fault: (stage: string) => {
      if (stage === 'delete') throw new Error('locked')
    }
  })
  expect((await failure.delete(i.session)).ok).toBe(false)
  expect(await entries(repo)).toHaveLength(1)
  expect((await repo.delete('../outside')).ok).toBe(false)
  expect((await repo.read('../outside')).ok).toBe(false)
  const { ipcMain } = await import('electron')
  vi.mocked(ipcMain.handle).mockClear()
  registerRecoveryHandlers(dir, () => {
    throw new Error('Untrusted application sender')
  })
  for (const [, handler] of vi.mocked(ipcMain.handle).mock.calls)
    expect(() => handler({} as never, i)).toThrow('Untrusted')
})
it('reports scan failures and never advertises incomplete entries as protected', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  await repo.write(i)
  const failing = new RecoveryRepository(dir, {
    fault: (stage: string) => {
      if (stage === 'scan') throw new Error('denied')
    }
  })
  expect(await failing.list()).toMatchObject({ ok: false, stage: 'scan' })
  expect(await entries(repo)).toHaveLength(1)
})

it('uses the 20 candidate / 4 GiB defaults and deduplicates a 16 MiB plan across revisions and sessions', async () => {
  const { RECOVERY_MAX_BYTES, RECOVERY_MAX_CANDIDATES } = await import('../main/project-recovery')
  expect(RECOVERY_MAX_BYTES).toBe(4 * 1024 ** 3)
  expect(RECOVERY_MAX_CANDIDATES).toBe(20)
  const large = new Uint8Array(Buffer.concat([Buffer.from(pdf), Buffer.alloc(16 * 1024 ** 2)]))
  const repo = new RecoveryRepository(dir),
    i = input(randomUUID(), 1, large)
  expect((await repo.write(i)).ok).toBe(true)
  expect((await repo.write({ ...i, revision: 2 })).ok).toBe(true)
  expect((await repo.write({ ...i, session: randomUUID() })).ok).toBe(true)
  const files = await readdir(repo.root)
  const bytes = (await Promise.all(files.map((f) => stat(join(repo.root, f))))).reduce(
    (n, s) => n + s.size,
    0
  )
  expect(files.filter((f) => f.endsWith('.pdf'))).toHaveLength(1)
  expect(bytes).toBeLessThan(large.byteLength + 10_000)
  expect(await entries(new RecoveryRepository(dir))).toHaveLength(2)
})

it('freezes queued PDF input and rejects malformed payloads before touching disk', async () => {
  const repo = new RecoveryRepository(dir),
    i = input(),
    expected = i.pdfBytes.slice()
  const writing = repo.write(i)
  i.pdfBytes[0] = 0
  expect((await writing).ok).toBe(true)
  expect(await repo.read(i.session)).toMatchObject({ ok: true, pdfBytes: expected })
  for (const invalid of [
    null,
    {},
    { ...i, session: '../bad' },
    { ...i, revision: NaN },
    { ...i, lastSavedAt: -1 },
    { ...i, sourcePath: '../bad\0' }
  ])
    expect((await repo.write(invalid)).ok).toBe(false)
  expect(await entries(repo)).toHaveLength(1)
})

it('keeps a newer selected revision on stale deletion and probes only an associated saved destination', async () => {
  const repo = new RecoveryRepository(dir),
    i = input()
  const source = join(dir, 'source.clmc')
  await writeFile(source, 'saved project')
  await repo.write({ ...i, sourcePath: source })
  expect(await repo.destinationWritable(i.session)).toBe(true)
  await chmod(source, 0o444)
  try {
    expect(await repo.destinationWritable(i.session)).toBe(false)
  } finally {
    await chmod(source, 0o666)
  }
  expect(await repo.destinationWritable(source)).toBe(false)
  expect(await repo.destinationWritable(randomUUID())).toBe(false)
  await repo.write({ ...i, revision: 2, sourcePath: source })
  expect((await repo.delete(i.session, 1)).ok).toBe(false)
  expect((await entries(repo))[0].revision).toBe(2)
  expect((await repo.delete(i.session, 2)).ok).toBe(true)
})
