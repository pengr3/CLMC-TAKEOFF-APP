import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runLibraryWorkerHarness } from './fixtures/run-library-worker'

describe('isolated library parser', () => {
  it('provides a separately packaged killable parser entry', () => {
    expect(existsSync(resolve('src/main/cost-library-worker.ts'))).toBe(true)
  })
  it('parses a real workbook, reaps a hung/crashed/aborted child, and keeps main responsive', async () => {
    const { output } = await runLibraryWorkerHarness()
    expect(output).toContain('LIBRARY_WORKER_RESULT')
    expect(output).toContain('MAXIMUM_MEASURE')
    console.info(output.match(/MAXIMUM_MEASURE .*/)?.[0])
  }, 45000)
})
