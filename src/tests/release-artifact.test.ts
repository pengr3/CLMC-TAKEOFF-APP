import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const asar = require('@electron/asar')
const inspector = (() => {
  try {
    return require('../../scripts/verify-release.cjs').inspectArchive
  } catch {
    return () => ({ errors: [], version: 'unimplemented' })
  }
})()
const scratch: string[] = []
afterEach(async () => {
  await Promise.all(scratch.splice(0).map((p) => rm(p, { recursive: true, force: true })))
})

async function archive(change?: (files: Record<string, string>) => void): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clmc-release-test-'))
  scratch.push(dir)
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'clmc-takeoff',
      version: '1.1.0',
      main: './out/main/index.js',
      dependencies: { exceljs: '4.4.0', yauzl: '3.4.0' }
    }),
    'resources/release-notes.json': JSON.stringify({
      version: '1.1.0',
      changes: ['Protected saves'],
      compatibility: 'Format 3'
    }),
    'resources/icon.png': 'icon',
    'out/main/index.js': 'const APP_ID="com.clmc.takeoff";const USER_DATA="clmc-takeoff";',
    'out/main/cost-library-worker.js': 'worker',
    'out/preload/index.js': 'preload',
    'out/renderer/index.html': '<html></html>',
    'out/renderer/pdf.worker.mjs': 'worker',
    'out/renderer/assets/inter-latin.woff2': 'font',
    'node_modules/exceljs/package.json': JSON.stringify({
      name: 'exceljs',
      version: '4.4.0',
      main: 'index.js',
      license: 'MIT'
    }),
    'node_modules/exceljs/index.js': 'module.exports={}',
    'node_modules/exceljs/LICENSE': 'MIT',
    'node_modules/yauzl/package.json': JSON.stringify({
      name: 'yauzl',
      version: '3.4.0',
      main: 'index.js',
      license: 'MIT'
    }),
    'node_modules/yauzl/index.js': 'module.exports={}',
    'node_modules/yauzl/LICENSE': 'MIT'
  }
  change?.(files)
  for (const [name, text] of Object.entries(files)) {
    const target = join(dir, 'payload', name)
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, text)
  }
  const target = join(dir, 'app.asar')
  await asar.createPackage(join(dir, 'payload'), target)
  return target
}

describe('actual release archive inspection', () => {
  it('accepts a known-clean actual ASAR control and records its version', async () => {
    const result = await inspector(await archive(), { version: '1.1.0' })
    expect(result.errors).toEqual([])
    expect(result.version).toBe('1.1.0')
  })
  it.each([
    '.planning/STATE.md',
    '.env',
    'resources/private.clmc',
    'out/renderer/scratch.pdf',
    'src/test.ts',
    'node_modules/vitest/package.json'
  ])('rejects actual copied payload contamination %s', async (name) => {
    expect(
      (
        await inspector(
          await archive((f) => {
            f[name] = 'private'
          }),
          { version: '1.1.0' }
        )
      ).errors.length
    ).toBeGreaterThan(0)
  })
  it.each([
    'out/main/cost-library-worker.js',
    'out/renderer/pdf.worker.mjs',
    'resources/release-notes.json',
    'node_modules/yauzl/index.js',
    'node_modules/exceljs/LICENSE',
    'out/renderer/assets/inter-latin.woff2'
  ])('rejects missing runtime resource %s', async (name) => {
    expect(
      (
        await inspector(
          await archive((f) => {
            delete f[name]
          }),
          { version: '1.1.0' }
        )
      ).errors.length
    ).toBeGreaterThan(0)
  })
  it('rejects mismatched notes and candidate versions', async () => {
    expect(
      (
        await inspector(
          await archive((f) => {
            f['resources/release-notes.json'] = '{"version":"1.0.0"}'
          }),
          { version: '1.1.0' }
        )
      ).errors.length
    ).toBeGreaterThan(0)
    expect((await inspector(await archive(), { version: '1.2.0' })).errors.length).toBeGreaterThan(
      0
    )
  })
  it('rejects missing transitive production dependencies and update endpoints', async () => {
    expect(
      (
        await inspector(
          await archive((f) => {
            f['node_modules/yauzl/package.json'] =
              '{"name":"yauzl","version":"3.4.0","main":"index.js","dependencies":{"pend":"1"}}'
          }),
          { version: '1.1.0' }
        )
      ).errors.length
    ).toBeGreaterThan(0)
    expect(
      (
        await inspector(
          await archive((f) => {
            f['app-update.yml'] = 'url: https://example.com'
          }),
          { version: '1.1.0' }
        )
      ).errors.length
    ).toBeGreaterThan(0)
  })
})
