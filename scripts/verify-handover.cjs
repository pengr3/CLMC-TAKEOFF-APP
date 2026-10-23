/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Read-only Node documentation tooling. */
// Importing the oracle never runs trial-kit preparation.
const fs = require('node:fs/promises')
const { realpathSync } = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { performance } = require('node:perf_hooks')
const { verifyExample } = require('./prepare-trial-kit.cjs')

async function verifyGuide(directory = path.join(__dirname, '..', 'docs', 'offline-guide')) {
  const { JSDOM } = await import('jsdom')
  // The JS realpath implementation also works in restricted Windows sessions.
  const root = realpathSync(path.resolve(directory))
  const documents = new Map()
  const checked = new Set()
  let references = 0
  let images = 0
  const contained = (target) => {
    const relative = path.relative(root, target)
    assert.ok(
      !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep),
      `Reference escapes guide root: ${target}`
    )
  }
  async function actualFile(target) {
    contained(target)
    const real = realpathSync(target)
    contained(real)
    assert.ok((await fs.stat(real)).isFile(), `Not a file: ${target}`)
    return real
  }
  async function documentAt(file) {
    if (!documents.has(file)) {
      documents.set(file, new JSDOM(await fs.readFile(file, 'utf8')).window.document)
    }
    return documents.get(file)
  }
  async function reference(raw, from) {
    references++
    assert.ok(raw.trim(), `Empty reference in ${from}`)
    // Decode before containment; URL resolution alone would normalize traversal away.
    const value = decodeURIComponent(raw.trim())
    assert.ok(
      !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('/') && !value.includes('\\'),
      `Absolute or network reference is not offline-local: ${raw}`
    )
    const hashIndex = value.indexOf('#')
    const fragment = hashIndex < 0 ? '' : value.slice(hashIndex + 1)
    const filePart = (hashIndex < 0 ? value : value.slice(0, hashIndex)).split('?')[0]
    const target = await actualFile(filePart ? path.resolve(path.dirname(from), filePart) : from)
    if (fragment) {
      assert.ok(/\.html?$/i.test(target), `Fragment on non-HTML target: ${raw}`)
      assert.ok(
        (await documentAt(target)).getElementById(fragment),
        `Missing anchor: ${raw} in ${from}`
      )
    }
    if (/\.(?:html?|css)$/i.test(target)) await inspect(target)
  }
  async function cssReferences(css, from) {
    // This guide uses plain CSS; reject escapes rather than misread obfuscated URLs.
    assert.ok(!css.includes('\\'), `Escaped CSS requires explicit review: ${from}`)
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi))
      await reference(match[2], from)
    for (const match of css.matchAll(/@import\s+(['"])(.*?)\1/gi)) await reference(match[2], from)
  }
  async function inspect(file) {
    if (checked.has(file)) return
    checked.add(file)
    if (/\.css$/i.test(file)) return cssReferences(await fs.readFile(file, 'utf8'), file)
    const document = await documentAt(file)
    assert.equal(
      document.querySelectorAll('base, script, iframe, object, embed, [srcdoc], [srcset]').length,
      0,
      `Unexpected active content, alternate resources or base URL in ${file}`
    )
    for (const meta of document.querySelectorAll('meta[http-equiv]')) {
      assert.notEqual(
        meta.getAttribute('http-equiv').toLowerCase(),
        'refresh',
        `Redirect in ${file}`
      )
    }
    for (const node of document.querySelectorAll('[href], [src]')) {
      for (const attribute of ['href', 'src']) {
        if (node.hasAttribute(attribute)) await reference(node.getAttribute(attribute), file)
      }
    }
    for (const node of document.querySelectorAll('img')) {
      assert.ok(node.getAttribute('alt')?.trim(), `Missing descriptive image alt in ${file}`)
      images++
    }
    for (const style of document.querySelectorAll('style'))
      await cssReferences(style.textContent, file)
    for (const node of document.querySelectorAll('[style]'))
      await cssReferences(node.getAttribute('style'), file)
  }
  try {
    const index = await actualFile(path.join(root, 'index.html'))
    await inspect(index)
    const example = await verifyExample(path.join(root, 'examples'))
    // Compare the displayed worked table to independent quantities and money too.
    const document = await documentAt(index)
    const rows = [...document.querySelectorAll('tbody tr')]
    const number = (text) => Number(text.trim().split(/\s+/)[0])
    const near = (actual, expected) =>
      assert.ok(
        Number.isFinite(actual) && Math.abs(actual - expected) < 1e-7,
        `Guide value ${actual} != independent value ${expected}`
      )
    let cost = 0
    for (const expected of example.rows) {
      const row = rows.find(
        (row) => row.cells[0]?.textContent.split('/')[0].trim() === expected.name
      )
      assert.ok(row && row.cells.length === 6, `Missing worked table row: ${expected.name}`)
      const cells = [...row.cells].map((cell) => cell.textContent)
      near(number(cells[1]), expected.quantity)
      const rowCost = expected.quantity * (number(cells[2]) + number(cells[3]))
      near(number(cells[4]), rowCost)
      near(rowCost * 1.3, expected.sellingTotal)
      near(number(cells[5]), expected.sellingTotal)
      cost += rowCost
    }
    near(cost, example.cost)
    const total = rows.find((row) => row.cells[0]?.textContent.trim() === 'Total')
    assert.ok(total, 'Missing worked table total')
    near(number(total.cells[2].textContent), example.cost)
    near(number(total.cells[3].textContent), example.selling)
    const margin = total.cells[1].textContent.match(/=\s*([\d.]+)\s*$/)
    assert.ok(margin, 'Missing worked table margin')
    near(Number(margin[1]), example.margin)
    return {
      status: 'pass',
      root,
      documents: checked.size,
      references,
      images,
      example,
      acceptance:
        'Structural/data checks only; visual walkthrough, ownership, Phase 20 and pilot acceptance remain pending.'
    }
  } finally {
    for (const document of documents.values()) document.defaultView.close()
  }
}

module.exports = { verifyGuide }
if (require.main === module) {
  const started = performance.now()
  if (process.argv.length > 3) {
    console.error('Usage: node scripts/verify-handover.cjs [copied-guide-directory]')
    process.exitCode = 1
  } else {
    verifyGuide(process.argv[2])
      .then((result) => {
        console.log(
          JSON.stringify(
            { ...result, durationMs: Math.round(performance.now() - started) },
            null,
            2
          )
        )
      })
      .catch((error) => {
        console.error(`FAIL: ${error.message}`)
        process.exitCode = 1
      })
  }
}
