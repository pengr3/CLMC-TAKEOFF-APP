import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { COST_LIBRARY_HEADERS } from '../shared/cost-library'

describe('isolated library parser', () => {
  it('provides a separately packaged killable parser entry', () => {
    expect(existsSync(resolve('src/main/cost-library-worker.ts'))).toBe(true)
  })
  it('parses a real workbook, reaps a hung/crashed/aborted child, and keeps main responsive', async () => {
    await mkdir('.planning/tmp', { recursive: true })
    const scratch = await mkdtemp(resolve('.planning/tmp/library-worker-'))
    try {
      await Promise.all([
        build({
          entryPoints: ['src/main/cost-library-worker.ts'],
          bundle: true,
          platform: 'node',
          format: 'cjs',
          packages: 'external',
          outfile: join(scratch, 'worker.cjs')
        }),
        build({
          entryPoints: ['src/main/cost-library-import.ts'],
          bundle: true,
          platform: 'node',
          format: 'cjs',
          packages: 'external',
          outfile: join(scratch, 'supervisor.cjs')
        })
      ])
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Cost Library')
      sheet.addRow([...COST_LIBRARY_HEADERS])
      sheet.addRow(['REAL-001', 'Real child import', 'Test', 'm²', 100, 50])
      await writeFile(join(scratch, 'valid.xlsx'), Buffer.from(await workbook.xlsx.writeBuffer()))
      for (let row = 3; row <= 10001; row++)
        sheet.addRow([`ITEM-${row}`, `Construction ${row}`, 'Finishes', 'm²', 100, 50])
      await writeFile(join(scratch, 'maximum.xlsx'), Buffer.from(await workbook.xlsx.writeBuffer()))
      const overBudget = new JSZip()
      overBudget.file('unused.xml', 'x'.repeat(32 * 1024 * 1024 + 1))
      await writeFile(
        join(scratch, 'resource.xlsx'),
        await overBudget.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      )
      const executable = createRequire(import.meta.url)('electron') as string
      const env = { ...process.env }
      delete env.ELECTRON_RUN_AS_NODE
      const output = await new Promise<string>((resolveOutput, reject) => {
        const child = spawn(
          executable,
          [resolve('src/tests/fixtures/library-worker-harness.cjs'), scratch],
          { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
        )
        let output = ''
        const timeout = setTimeout(() => {
          child.kill()
          reject(new Error('Electron harness timed out: ' + output))
        }, 35000)
        child.stdout.on('data', (chunk) => {
          output += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
          output += chunk.toString()
        })
        child.on('error', reject)
        child.on('exit', (code) => {
          clearTimeout(timeout)
          if (code === 0) resolveOutput(output)
          else reject(new Error(`Electron harness exit ${code}: ${output}`))
        })
      })
      expect(output).toContain('LIBRARY_WORKER_RESULT')
      expect(output).toContain('"timeout"')
      expect(output).toContain('MAXIMUM_MEASURE')
      console.info(output.match(/MAXIMUM_MEASURE .*/)?.[0])
    } finally {
      await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }, 45000)
})
