import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import type { CostLibraryItem, LibraryResult } from '../../shared/cost-library'

export async function runLibraryWorkerHarness(): Promise<{
  output: string
  success: LibraryResult<CostLibraryItem[]>
  timed: LibraryResult<CostLibraryItem[]>
  crash: LibraryResult<CostLibraryItem[]>
}> {
  const output = await new Promise<string>((complete, reject) => {
    execFile(
      process.execPath,
      [resolve('src/tests/fixtures/run-library-worker.cjs')],
      {
        timeout: 42000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${error.message}: ${stdout} ${stderr}`))
        else complete(stdout)
      }
    )
  })
  const resultLine = output.match(/LIBRARY_WORKER_RESULT (.*)/)?.[1]
  if (!resultLine) throw new Error('No real process result: ' + output)
  return { output, ...JSON.parse(resultLine) }
}
