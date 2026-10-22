/** @vitest-environment jsdom */
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { reopenPredicate } = require('../../scripts/smoke-reopen.cjs')

it.each(['smoke-packaged.cjs', 'smoke-electron-host.cjs'])('requires %s to prove a renderer state transition', script => {
  expect(readFileSync(`scripts/${script}`, 'utf8')).toContain('verifyReopenTransition(')
})
it('rejects the pre-existing saved title, failed open, and wrong persisted scale/rate totals', () => {
  const predicate = reopenPredicate('saved-project.clmc', 'blue', true)
  document.body.innerHTML = '<span data-testid="project-title">saved-project.clmc</span>'
  const run = (): boolean => Function(`return ${predicate}`)()
  expect(run()).toBe(false) // Old title-only assertion was already true.
  document.body.innerHTML += '<div role="dialog">Open failed</div>'
  expect(run).toThrow(/error\/decision/)
  document.querySelector('[role="dialog"]')!.remove()
  const canvas = document.createElement('canvas')
  Object.assign(canvas, { getContext: () => ({ getImageData: () => ({ data: [40, 130, 200, 255] }) }) })
  document.body.append(canvas)
  document.body.innerHTML += '<div data-item-label="SMOKE-PERSISTED-SPAN"><input data-testid="estimate-row-material-input" value="137"><input data-testid="estimate-row-labor-input" value="23"><input data-testid="estimate-row-markup-input" value="17"><span data-testid="estimate-row-total">0.00</span></div>'
  // Reinsert our canvas stub because innerHTML recreated DOM nodes.
  document.querySelector('canvas')?.remove(); document.body.append(canvas)
  expect(run()).toBe(false)
  document.querySelector('[data-testid="estimate-row-total"]')!.textContent = '187.20'
  expect(run()).toBe(true)
})
