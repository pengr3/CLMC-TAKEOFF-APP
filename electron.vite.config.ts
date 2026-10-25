import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const pdfDecoderFiles = [
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
] as const

function pdfDecoderAssets(): Plugin[] {
  const source = resolve('node_modules/pdfjs-dist/wasm')
  const routes = new Map(
    pdfDecoderFiles.map((name) => [
      `/pdfjs/wasm/${name}`,
      { name, bytes: readFileSync(resolve(source, name)) }
    ])
  )
  return [
    {
      name: 'clmc-pdf-decoders:build',
      apply: 'build',
      buildStart() {
        for (const name of pdfDecoderFiles)
          this.emitFile({
            type: 'asset',
            fileName: `pdfjs/wasm/${name}`,
            source: readFileSync(resolve(source, name))
          })
      }
    },
    {
      name: 'clmc-pdf-decoders:serve',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const resource = routes.get(request.url?.split('?')[0] ?? '')
          if (!resource || (request.method !== 'GET' && request.method !== 'HEAD')) return next()
          // The URL selects a preloaded fixed resource; it never becomes a filesystem path.
          response.setHeader(
            'Content-Type',
            resource.name.endsWith('.wasm')
              ? 'application/wasm'
              : resource.name.endsWith('.js')
                ? 'text/javascript'
                : 'text/plain; charset=utf-8'
          )
          response.setHeader('Content-Length', resource.bytes.byteLength)
          response.end(request.method === 'HEAD' ? undefined : resource.bytes)
        })
      }
    }
  ]
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'cost-library-worker': resolve('src/main/cost-library-worker.ts')
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      externalizeDeps: false
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    plugins: [
      react(),
      tailwindcss(),
      pdfDecoderAssets(),
      viteStaticCopy({
        targets: [
          {
            src: resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs').replace(/\\/g, '/'),
            dest: '.'
          }
        ]
      })
    ]
  }
})
