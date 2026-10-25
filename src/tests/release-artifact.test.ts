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
const decoderAssets = [
  'openjpeg.wasm',
  'openjpeg_nowasm_fallback.js',
  'jbig2.wasm',
  'qcms_bg.wasm',
  'LICENSE_OPENJPEG',
  'LICENSE_PDFJS_OPENJPEG',
  'LICENSE_JBIG2',
  'LICENSE_PDFJS_JBIG2',
  'LICENSE_QCMS',
  'LICENSE_PDFJS_QCMS'
]
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
      dependencies: { exceljs: '4.4.0', yauzl: '3.4.0', 'pdfjs-dist': '5.5.207' }
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
    'out/renderer/index.html':
      '<meta http-equiv="Content-Security-Policy" content="script-src \'self\' \'wasm-unsafe-eval\'">',
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
    'node_modules/yauzl/LICENSE': 'MIT',
    'node_modules/pdfjs-dist/package.json': JSON.stringify({
      name: 'pdfjs-dist',
      version: '5.5.207',
      main: 'build/pdf.mjs',
      license: 'Apache-2.0'
    }),
    'node_modules/pdfjs-dist/build/pdf.mjs': 'export const version="5.5.207"'
  }
  for (const name of decoderAssets) {
    const contents = name.endsWith('.wasm')
      ? '\0asm\u0001\0\0\0'
      : 'Exact supplied test decoder/license bytes'
    files[`out/renderer/pdfjs/wasm/${name}`] = contents
    files[`node_modules/pdfjs-dist/wasm/${name}`] = contents
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
  it.each(decoderAssets)('rejects missing offline decoder resource %s', async (name) => {
    const result = await inspector(
      await archive((files) => {
        delete files[`out/renderer/pdfjs/wasm/${name}`]
      }),
      { version: '1.1.0' }
    )
    expect(result.errors.some((error: string) => error.includes(name))).toBe(true)
  })
  it('rejects changed copied decoder bytes and missing narrow WASM CSP permission', async () => {
    const changed = await inspector(
      await archive((files) => {
        files['out/renderer/pdfjs/wasm/openjpeg.wasm'] += 'changed'
      }),
      { version: '1.1.0' }
    )
    expect(changed.errors.some((error: string) => error.includes('openjpeg.wasm'))).toBe(true)
    const policy = await inspector(
      await archive((files) => {
        files['out/renderer/index.html'] =
          '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'">'
      }),
      { version: '1.1.0' }
    )
    expect(policy.errors.some((error: string) => error.includes('WASM'))).toBe(true)
    const broad = await inspector(
      await archive((files) => {
        files['out/renderer/index.html'] =
          "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'\">"
      }),
      { version: '1.1.0' }
    )
    expect(broad.errors.some((error: string) => error.includes('unsafe-eval'))).toBe(true)
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
