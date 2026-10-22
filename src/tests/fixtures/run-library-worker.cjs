/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Node owns build/fixture setup outside the jsdom realm. */
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { resolve, join } = require('node:path')
const { spawn } = require('node:child_process')
const { build } = require('esbuild')
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
async function run() {
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
    sheet.addRow([
      'Item Code',
      'Description',
      'Category',
      'Unit',
      'Material Unit Rate',
      'Labor Unit Rate'
    ])
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
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    await new Promise((resolveOutput, reject) => {
      const child = spawn(
        require('electron'),
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
      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (code === 0) {
          process.stdout.write(output)
          resolveOutput()
        } else reject(new Error(`Electron harness exit ${code}: ${output}`))
      })
    })
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
