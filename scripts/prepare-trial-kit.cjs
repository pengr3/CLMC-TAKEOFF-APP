// Prepare a self-contained trial handoff without rebuilding or approving the app.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const Zip = require('jszip')
const Excel = require('exceljs')
const root = path.resolve(__dirname, '..')
const destination = path.join(root, 'dist', 'trial-kit')
const manual = path.join(root, '.planning', 'tmp', '20-manual-run')
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const installerHash = 'd3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180'
const archiveHash = 'cf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45'
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const oracle = [
  ['Grid length', 'linear', 10, 195],
  ['Grid area', 'area', 100, 390],
  ['Retest area', 'area', 100, 0],
  ['Grid perimeter', 'perimeter', 40, 52],
  ['Grid wall', 'wall', 30, 195],
  ['Grid count', 'count', 1, 130]
]

async function verifyExample(directory) {
  const bytes = await fs.readFile(path.join(directory, 'worked-example.clmc'))
  assert.equal(hash(bytes), 'c8a466c0886ad40fb792771646b7d64f8dd7af6da26909a665ffdfa291d156cb')
  const zip = await Zip.loadAsync(bytes, { checkCRC32: true })
  assert.deepEqual(Object.keys(zip.files).sort(), ['plan.pdf', 'project.json'])
  const project = JSON.parse(await zip.file('project.json').async('string'))
  const pdf = await zip.file('plan.pdf').async('nodebuffer')
  assert.equal(hash(pdf), hash(await fs.readFile(path.join(directory, 'training-grid.pdf'))))
  assert.equal(hash(pdf), '9c0bc7b6f133905fc62b7dff8abec2e78c0beb078f3ddcdddb57c157ed025e10')
  assert.equal(project.formatVersion, 3)
  assert.equal(project.minimumReaderVersion, 3)
  assert.equal(project.pages.length, 1)
  const page = project.pages[0]
  assert.equal(page.coordinateBasis, 'pdf-base-scale-2')
  assert.equal(page.markups.length, 6)
  let cost = 0, selling = 0
  for (const [name, type, expectedQuantity, expectedSelling] of oracle) {
    const markup = page.markups.find(item => item.name === name && item.type === type)
    assert.ok(markup, `${name} missing`)
    let quantity = 1
    if (type !== 'count') {
      let length = 0, area = 0
      for (let i = 0; i < markup.points.length; i++) {
        const a = markup.points[i], b = markup.points[(i + 1) % markup.points.length]
        area += a.x * b.y - b.x * a.y
        if (i < markup.points.length - 1 || type === 'perimeter') length += Math.hypot(b.x - a.x, b.y - a.y)
      }
      quantity = type === 'area' ? Math.abs(area) / 2 / page.scale.pixelsPerMm ** 2 / 1e6
        : type === 'wall' ? length / page.scale.pixelsPerMm * markup.wallHeight / 1e6
          : length / page.scale.pixelsPerMm / 1000
    }
    near(quantity, expectedQuantity)
    const rate = project.rates[`${name}|${type}`]
    if (expectedSelling === 0 && !rate) continue
    assert.equal(rate.review, 'reviewed')
    assert.equal(rate.basis, type === 'count' ? 'ea' : ['area', 'wall'].includes(type) ? 'm²' : 'm')
    const rowCost = quantity * (rate.material + rate.labor)
    const rowSelling = rowCost * (1 + rate.markup / 100)
    near(rowSelling, expectedSelling)
    cost += rowCost; selling += rowSelling
  }
  near(cost, 740); near(selling, 962); near(selling - cost, 222)
  const book = new Excel.Workbook()
  await book.xlsx.readFile(path.join(directory, 'worked-example-BOQ.xlsx'))
  const rows = []
  book.getWorksheet('BOQ').eachRow(row => rows.push(row.values.slice(1)))
  // Fixed synthetic names contain no comma/quote/newline. This is not a general CSV parser.
  const csv = (await fs.readFile(path.join(directory, 'worked-example-BOQ.csv'), 'utf8'))
    .replace(/^\uFEFF/, '').split(/\r?\n/).map(row => row.split(','))
  for (const values of [rows, csv]) {
    for (const [name, , quantity, total] of oracle) {
      const row = values.find(row => row[0] === name)
      assert.ok(row, name); near(Number(row[1]), quantity); near(Number(row[8]), total)
    }
    const grand = values.find(row => row[0] === 'Grand Total (cost)')
    near(Number(grand[5]), 740); near(Number(grand[8]), 962); near(Number(grand[9]), 222)
  }
  return { status: 'pass', method: 'Independent Euclidean length, shoelace area, wall-height and price arithmetic; ZIP CRC/PDF hash; separate XLSX and CSV readback. No application aggregation imported.', rows: oracle.map(([name, type, quantity, total]) => ({ name, type, quantity, sellingTotal: total })), cost, selling, margin: selling - cost }
}

async function copyFixtures() {
  const guide = path.join(root, 'docs', 'offline-guide')
  await fs.mkdir(path.join(guide, 'examples'), { recursive: true })
  await fs.mkdir(path.join(guide, 'images'), { recursive: true })
  for (const [source, target] of [
    ['manual-grid.pdf', 'examples/training-grid.pdf'],
    ['final-native-checked.clmc', 'examples/worked-example.clmc'],
    ['manual-final-BOQ.xlsx', 'examples/worked-example-BOQ.xlsx'],
    ['manual-final-BOQ.csv', 'examples/worked-example-BOQ.csv'],
    ['final-estimate-962.png', 'images/estimate.png'],
    ['installed-recovery-offer.png', 'images/recovery.png']
  ]) {
    // Retained tracked fixtures allow future kit preparation without developer scratch files.
    const existing = await fs.readFile(path.join(guide, target)).catch(() => null)
    if (!existing) await fs.copyFile(path.join(manual, source), path.join(guide, target))
  }
  return verifyExample(path.join(guide, 'examples'))
}

async function listFiles(directory, prefix = '') {
  const files = []
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name
    if (item.isDirectory()) files.push(...await listFiles(path.join(directory, item.name), relative + '/'))
    else if (item.isFile() && !['KIT-MANIFEST.json', 'TEST-RESULTS.md'].includes(relative)) {
      const bytes = await fs.readFile(path.join(directory, item.name))
      files.push({ file: relative, bytes: bytes.length, sha256: hash(bytes) })
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file, 'en'))
}

async function writeReadingPages(directory) {
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  for (const name of ['second-pc-test', 'maintainer-handover', 'release-validation', 'release-compatibility']) {
    const text = await fs.readFile(path.join(directory, name + '.md'), 'utf8')
    await fs.writeFile(path.join(directory, name + '.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CLMC ${name}</title><style>body{font:17px/1.6 system-ui;max-width:1000px;margin:30px auto;padding:0 20px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}</style><p><a href="START-HERE.html">Trial kit home</a> · <a href="guide/index.html">Offline user guide</a></p><pre>${escape(text)}</pre></html>`)
  }
}

async function run() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'dist', 'release-manifest.json'), 'utf8'))
  const installer = path.join(root, 'dist', 'clmc-takeoff-1.1.0-x64-setup.exe')
  assert.equal(manifest.installer.sha256, installerHash)
  assert.equal(manifest.archive.sha256, archiveHash)
  const installerBytes = await fs.readFile(installer)
  assert.equal(hash(installerBytes), installerHash); assert.equal(installerBytes.length, 136810369)
  // Never overwrite an existing kit, which might contain returned target-PC evidence.
  try { await fs.mkdir(destination) } catch (error) {
    if (error.code === 'EEXIST') throw new Error('dist/trial-kit already exists; preserve its evidence and choose a fresh handoff before regenerating.')
    throw error
  }
  const readback = await copyFixtures()
  await fs.cp(path.join(root, 'docs', 'offline-guide'), path.join(destination, 'guide'), {
    recursive: true,
    filter: source => path.basename(source) !== '.gitattributes'
  })
  await fs.mkdir(path.join(destination, 'installer'))
  await fs.copyFile(installer, path.join(destination, 'installer', path.basename(installer)))
  await fs.copyFile(path.join(root, 'dist', 'release-manifest.json'), path.join(destination, 'installer', 'release-manifest.json'))
  for (const name of ['maintainer-handover.md', 'second-pc-test.md', 'release-validation.md', 'release-compatibility.md']) {
    await fs.copyFile(path.join(root, 'docs', name), path.join(destination, name))
  }
  await writeReadingPages(destination)
  await fs.writeFile(path.join(destination, 'EXAMPLE-CHECK.json'), JSON.stringify(readback, null, 2) + '\n')
  await fs.writeFile(path.join(destination, 'Check-Kit.ps1'), `# Read-only integrity check. Does not install the app or record acceptance.
$ErrorActionPreference = 'Stop'
$trialRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$trialManifest = Get-Content -LiteralPath (Join-Path $trialRoot 'KIT-MANIFEST.json') -Raw | ConvertFrom-Json
if ($trialManifest.candidateInstallerSha256 -ne '${installerHash}') { throw 'Unexpected candidate' }
foreach ($trialEntry in $trialManifest.files) {
  $trialPath = [IO.Path]::GetFullPath((Join-Path $trialRoot $trialEntry.file))
  if (-not $trialPath.StartsWith($trialRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe manifest path' }
  if ((Get-Item -LiteralPath $trialPath).Length -ne $trialEntry.bytes) { throw ('Size mismatch: ' + $trialEntry.file) }
  if ((Get-FileHash -LiteralPath $trialPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $trialEntry.sha256) { throw ('Hash mismatch: ' + $trialEntry.file) }
}
Write-Output ('PASS: ' + $trialManifest.files.Count + ' kit files match. App acceptance remains pending. TEST-RESULTS.md is intentionally editable.')
`)
  const cases = ['fresh-install', 'actual-predecessor-upgrade', 'project-only-transfer', 'recovery-saved', 'recovery-never-saved', 'failed-save-backup', 'offline-workflow', 'large-vector', 'large-scan', 'multipage-navigation', 'scaling-100', 'scaling-125', 'scaling-150', 'scaling-200', 'monitor-transition', 'ui-keyboard-overflow']
  await fs.writeFile(path.join(destination, 'TEST-RESULTS.md'), `# Actual second-PC results — pending\n\nCandidate SHA-256: ${installerHash}\n\nTester: PENDING\nDate/time: PENDING\nMachine identifier/classification: PENDING\nWindows build/x64/RAM: PENDING\nMonitor count/resolutions/physical scaling: PENDING\nActual predecessor inventory and backups: PENDING\nApproved fixture hashes/bytes/pages/independent oracle: PENDING\n\nComplete each case with procedure, expected/actual values, tolerance, artifact paths/hashes and actual tester/date. Do not infer a pass from this worksheet.\n\n| Case | Status | Expected / actual / artifacts |\n|---|---|---|\n${cases.map(id => `| ${id} | pending | |`).join('\n')}\n\nNamed release/signing/dependency reviews and later pilot acceptance remain pending.\n`)
  await fs.writeFile(path.join(destination, 'START-HERE.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CLMC second-PC trial kit</title><style>body{font:18px/1.6 system-ui;max-width:850px;margin:40px auto;padding:0 20px}code{overflow-wrap:anywhere}a{color:#175a96}</style><h1>CLMC Takeoff 1.1.0 — trial kit</h1><p>Prepared for the deferred second-PC test. This candidate is unsigned; release acceptance and wider distribution remain pending.</p><ol><li>Run Check-Kit.ps1 under your normal PowerShell script policy. It only checks local files. Do not change security settings to run it.</li><li>Read <a href="second-pc-test.html">the second-PC checklist</a> and preserve existing work before installation.</li><li>Install the full offline candidate from the installer folder using your approved process.</li><li>Open the <a href="guide/index.html">offline user guide and worked example</a>.</li><li>Record actual observations in TEST-RESULTS.md and retain screenshots, projects and exports for review.</li></ol><p>If scripts are blocked, check the installer manually in PowerShell:</p><pre><code>Get-FileHash -Algorithm SHA256 -LiteralPath '.\\installer\\clmc-takeoff-1.1.0-x64-setup.exe'</code></pre><p>Expected SHA-256: <code>${installerHash}</code>. Compare other files against KIT-MANIFEST.json. Matching hashes establish integrity, not approval.</p><p><a href="maintainer-handover.html">Maintainer draft</a> · <a href="release-validation.html">Full validation matrix</a></p><p>No Node/npm or internet is needed to read the guide, verify files or run CLMC. Agent computer control requires a tool-enabled session on the actual test PC and may require internet independently of CLMC.</p></html>`)
  const files = await listFiles(destination)
  await fs.writeFile(path.join(destination, 'KIT-MANIFEST.json'), JSON.stringify({ schemaVersion: 1, status: 'trial-preparation-not-acceptance', generatedAt: new Date().toISOString(), candidateInstallerSha256: installerHash, archiveSha256: archiveHash, mutableEvidence: ['TEST-RESULTS.md'], files }, null, 2) + '\n')
  console.log(JSON.stringify({ status: 'prepared', destination, files: files.length, exampleReadback: readback, candidateInstallerSha256: installerHash, acceptance: 'pending' }, null, 2))
}
module.exports = { verifyExample, listFiles, writeReadingPages }
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1 })
