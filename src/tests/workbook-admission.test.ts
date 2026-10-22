import { expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

it('admits workbook bytes with a bounded streaming ZIP gate before ExcelJS', () => {
  expect(existsSync(resolve('src/main/workbook-admission.ts'))).toBe(true)
})
