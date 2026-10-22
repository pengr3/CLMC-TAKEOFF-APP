import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const harness = require('../../scripts/smoke-packaged.cjs')

it.each(['exe', 'asar', 'unpacked', 'installer', 'electron'])('rejects a mismatched launched candidate %s', async changed => {
  const dir = await mkdtemp(join(tmpdir(), 'clmc-smoke-identity-'))
  try {
    const app = join(dir, 'alternate-app')
    const contents: Record<string, string> = { 'clmc-takeoff.exe': 'exe', 'resources/app.asar': 'asar', 'resources/app.asar.unpacked/worker.js': 'worker' }
    const hash = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex')
    for (const [name, bytes] of Object.entries(contents)) { await mkdir(join(app, name, '..'), { recursive: true }); await writeFile(join(app, name), bytes) }
    await writeFile(join(dir, 'setup.exe'), 'installer')
    const manifest = { version: '1.1.0', runtime: { expectedElectron: '44.9.3' }, installer: { file: 'setup.exe', sha256: hash('installer'), bytes: 9 }, archive: { sha256: hash('asar') },
      unpacked: Object.entries(contents).map(([file, bytes]) => ({ file, bytes: bytes.length, sha256: hash(bytes) })) }
    const manifestPath = join(dir, 'release-manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest))
    expect(harness.verifyCandidate).toBeTypeOf('function')
    const identity = await harness.verifyCandidate(join(app, 'clmc-takeoff.exe'), manifestPath)
    expect(identity.archiveSha256).toBe(hash('asar'))
    if (changed === 'electron') {
      expect(() => harness.assertObservedCandidate(identity, { electron: '45.0.0', appPath: join(app, 'resources/app.asar'), executable: join(app, 'clmc-takeoff.exe') })).toThrow(/runtime|Electron/)
    } else {
      const target = changed === 'installer' ? join(dir, 'setup.exe') : join(app, changed === 'exe' ? 'clmc-takeoff.exe' : changed === 'asar' ? 'resources/app.asar' : 'resources/app.asar.unpacked/worker.js')
      // Keep size and the manifest version unchanged: only hashing can catch it.
      await writeFile(target, (await readFile(target)).map(byte => byte ^ 1))
      await expect(harness.verifyCandidate(join(app, 'clmc-takeoff.exe'), manifestPath)).rejects.toThrow(/identity|hash|size|candidate/i)
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})
