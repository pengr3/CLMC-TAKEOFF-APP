import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('isolated library parser', () => {
  it('provides a separately packaged killable parser entry', () => {
    expect(existsSync(resolve('src/main/cost-library-worker.ts'))).toBe(true)
  })
})
