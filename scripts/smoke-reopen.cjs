/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Shared real-renderer smoke orchestration. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const label = 'SMOKE-PERSISTED-SPAN'
function pdfPixelExpression(color) {
  const match = color === 'red' ? 'p[i]>150&&p[i+1]<100&&p[i+2]<100' : 'p[i]<100&&p[i+1]>100&&p[i+2]>150'
  return `Array.from(document.querySelectorAll('canvas')).some(c=>{const x=c.getContext('2d');if(!x||!c.width||!c.height)return false;const p=x.getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=4)if(${match}&&p[i+3]>0)return true;return false})`
}
function reopenPredicate(title, color, persisted) {
  return `(()=>{if(document.querySelector('[role="dialog"]'))throw new Error('Reopen encountered an error/decision dialog: '+document.querySelector('[role="dialog"]').textContent);const title=document.querySelector('[data-testid="project-title"]')?.textContent??'';const row=document.querySelector('[data-item-label="${label}"]');return title.includes(${JSON.stringify(title)})&&${pdfPixelExpression(color)}&&${persisted ? `!!row&&row.querySelector('[data-testid="estimate-row-material-input"]')?.value==='137'&&row.querySelector('[data-testid="estimate-row-labor-input"]')?.value==='23'&&row.querySelector('[data-testid="estimate-row-markup-input"]')?.value==='17'&&row.querySelector('[data-testid="estimate-row-total"]')?.textContent?.replace(/[^0-9.]/g,'')==='187.20'` : '!row'}})()`
}
async function verifyReopenTransition({ execute, waitFor, setOpen, setSave, savePath, alternatePath, saved, beforeReopen }) {
  const expected = JSON.parse(saved.projectJson)
  expected.globalUnit = 'm'
  expected.categories = { smoke: { id: 'smoke', name: 'Smoke persisted category', color: '#336699', paletteIndex: 0 } }
  expected.categoryOrder = ['smoke']
  expected.rates = { [`${label}|linear`]: { material: 137, labor: 23, markup: 17, basis: 'm', review: 'reviewed' } }
  expected.pages[0] = { ...expected.pages[0], coordinateBasis: 'pdf-base-scale-2', scale: { pixelsPerMm: 0.2, displayUnit: 'm' },
    markups: [{ id: 'smoke-span', type: 'linear', page: 1, name: label, categoryId: 'smoke', color: '#336699', createdAt: 1, points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] }] }
  const bytes = Object.values(saved.pdfBytes)
  assert.equal((await execute(`window.api.writeProject(${JSON.stringify(savePath)},${JSON.stringify(JSON.stringify(expected))},new Uint8Array(${JSON.stringify(bytes)}))`)).ok, true)
  const open = async target => {
    await setOpen(target)
    await execute(`document.querySelector('button[title="Open project or PDF (Ctrl+O)"]').click()`)
  }
  await open(alternatePath)
  await waitFor(reopenPredicate(path.basename(alternatePath), 'red', false))
  // Opening a bare PDF is an unsaved project. Save this disposable alternate
  // document so the subsequent Open exercises adoption without a close guard.
  await setSave(`${alternatePath}.clmc`)
  await execute(`document.querySelector('button[title="Save (Ctrl+S)"]').click()`)
  await waitFor(`(()=>{const t=document.querySelector('[data-testid="project-title"]')?.textContent??'';return t.includes(${JSON.stringify(path.basename(alternatePath) + '.clmc')})&&!t.includes('Saving')&&!t.includes('*')})()`)
  // Both title and rendered PDF differ now; the following assertions start false.
  assert.equal(await execute(reopenPredicate(path.basename(savePath), 'blue', true)), false)
  await beforeReopen?.()
  await open(savePath)
  await waitFor(reopenPredicate(path.basename(savePath), 'blue', true))
  // A new UI Save As captures the adopted renderer stores. Reading the original
  // archive again would only prove disk readback, not actual hydration.
  const proof = path.join(path.dirname(savePath), 'reopened-renderer-proof.clmc')
  await assert.rejects(fs.stat(proof), { code: 'ENOENT' })
  await setSave(proof)
  await execute(`document.querySelector('button[title="Save As (Ctrl+Shift+S)"]').click()`)
  await waitFor(`(()=>{if(document.querySelector('[role="dialog"]'))throw new Error('Reopen Save As failed');return document.querySelector('[data-testid="project-title"]')?.textContent?.includes('reopened-renderer-proof.clmc')&&!document.querySelector('[data-testid="project-title"]')?.textContent?.includes('Saving')})()`)
  const readback = await execute(`window.api.readProject(${JSON.stringify(proof)})`)
  assert.equal(readback.kind, 'v2-zip')
  const actual = JSON.parse(readback.projectJson)
  assert.deepEqual(Object.values(readback.pdfBytes), bytes)
  assert.deepEqual(actual.pages[0].markups, expected.pages[0].markups)
  assert.deepEqual(actual.pages[0].scale, expected.pages[0].scale)
  assert.deepEqual(actual.rates, expected.rates)
  assert.deepEqual(actual.categories, expected.categories)
  assert.deepEqual(actual.categoryOrder, expected.categoryOrder)
  return { differentDocumentObserved: true, savedPdfAndStateAdopted: true, rendererSnapshotReadback: true }
}
module.exports = { verifyReopenTransition, reopenPredicate }
