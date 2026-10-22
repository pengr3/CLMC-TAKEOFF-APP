import { expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

it('keeps the actual many-page review component and keyboard controls usable in Chromium at minimum/reduced heights', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/smoke-geometry-layout.cjs'], { windowsHide: true, timeout: 30000 })
  const proof = JSON.parse(stdout.trim())
  expect(proof.status).toBe('pass')
  expect(proof.keyboardNavigationAndConfirmation).toBe(true)
  expect(proof.measurements).toHaveLength(2)
  for (const result of proof.measurements) {
    expect(result.buttons).toBeLessThanOrEqual(4)
    expect(result.canvas).toBeGreaterThanOrEqual(160)
    expect(result.expanded.canvas).toBeGreaterThanOrEqual(128)
  }
}, 35000)
