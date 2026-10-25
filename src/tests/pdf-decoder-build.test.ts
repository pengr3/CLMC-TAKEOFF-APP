import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { build, createServer, normalizePath } from 'vite'
import { resolveConfig as resolveElectronConfig } from 'electron-vite'

const scratch: string[] = []
const originalNodeEnv = process.env.NODE_ENV
afterEach(async () => {
  process.env.NODE_ENV = originalNodeEnv
  await Promise.all(
    scratch.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('actual renderer decoder copy configuration', () => {
  it('builds every decoder and accompanying license at the configured flat URL with exact bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clmc-decoder-build-'))
    scratch.push(directory)
    const entry = join(directory, 'probe-entry.js')
    await writeFile(entry, 'export const decoderCopyProbe = true\n')
    // Execute the real renderer plugin configuration against a disposable empty entry.
    // No application bundle, production output directory, Electron main or profile is used.
    const configured = await resolveElectronConfig(
      { configFile: resolve('electron.vite.config.ts'), logLevel: 'silent' },
      'build',
      'production'
    )
    const renderer = configured.config?.renderer
    await build({
      ...renderer,
      plugins: [
        ...(renderer?.plugins ?? []),
        {
          name: 'assert-real-renderer-root',
          configResolved(config) {
            expect(normalizePath(config.root)).toBe(normalizePath(resolve('src/renderer')))
          }
        }
      ],
      configFile: false,
      logLevel: 'silent',
      build: { outDir: join(directory, 'out'), rollupOptions: { input: entry }, minify: false }
    })
    const source = resolve('node_modules/pdfjs-dist/wasm')
    const destination = join(directory, 'out/pdfjs/wasm')
    const names = await readdir(source)
    expect(names).toHaveLength(10)
    expect((await readdir(destination)).sort()).toEqual(names.sort())
    for (const name of names)
      expect(await readFile(join(destination, name)), name).toEqual(
        await readFile(join(source, name))
      )
  }, 20_000) // This integration test starts a real Vite build, including its plugins.

  it('serves the exact known local decoder/license bytes at the same URLs in development', async () => {
    const configured = await resolveElectronConfig(
      { configFile: resolve('electron.vite.config.ts'), logLevel: 'silent' },
      'serve',
      'development'
    )
    const server = await createServer({
      ...configured.config?.renderer,
      configFile: false,
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, strictPort: true, open: false }
    })
    try {
      await server.listen()
      expect(normalizePath(server.config.root)).toBe(normalizePath(resolve('src/renderer')))
      const address = server.httpServer?.address()
      if (!address || typeof address === 'string') throw new Error('No test HTTP port')
      const base = `http://127.0.0.1:${address.port}`
      const source = resolve('node_modules/pdfjs-dist/wasm')
      const names = await readdir(source)
      expect(names).toHaveLength(10)
      for (const name of names) {
        const response = await fetch(`${base}/pdfjs/wasm/${name}?cache=probe`)
        expect(response.status, name).toBe(200)
        expect(response.headers.get('content-type'), name).toBe(
          name.endsWith('.wasm')
            ? 'application/wasm'
            : name.endsWith('.js')
              ? 'text/javascript'
              : 'text/plain; charset=utf-8'
        )
        expect(Buffer.from(await response.arrayBuffer()), name).toEqual(
          await readFile(join(source, name))
        )
      }
      const head = await fetch(`${base}/pdfjs/wasm/openjpeg.wasm`, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(head.headers.get('content-type')).toBe('application/wasm')
      expect(head.headers.get('content-length')).toBe(
        String((await readFile(join(source, 'openjpeg.wasm'))).byteLength)
      )
      expect((await head.arrayBuffer()).byteLength).toBe(0)
      const unknown = await fetch(`${base}/pdfjs/wasm/package.json`)
      expect(await unknown.text()).not.toBe(
        await readFile('node_modules/pdfjs-dist/package.json', 'utf8')
      )
    } finally {
      await server.close()
    }
  }, 20_000)
})
