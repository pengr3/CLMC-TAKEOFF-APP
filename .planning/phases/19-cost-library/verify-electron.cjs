/* Reproducible automated smoke against the built renderer, production preload and IPC.
 * Run after npm run build: node .planning/phases/19-cost-library/verify-electron.cjs
 * Only uses scratch data below out/phase19-smoke; native dialogs return test paths.
 */
const path = require('path')
const fs = require('fs')
const root = path.resolve(__dirname, '../../..')
const qa = path.join(root, 'out/phase19-smoke')
if (!process.versions.electron) {
  const { spawnSync } = require('child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], {
    cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 90000
  })
  if (result.error) console.error(result.error.message)
  process.exit(result.status ?? 1)
}

const { app, BrowserWindow, dialog } = require('electron')
const { pathToFileURL } = require('url')
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
const { createHash } = require('crypto')
const assert = require('assert/strict')
fs.mkdirSync(path.join(qa, 'user-data'), { recursive: true })
app.setPath('userData', path.join(qa, 'user-data'))
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
app.on('child-process-gone', (_event, details) => console.error('Child process gone:', details))

const result = require('esbuild').buildSync({
  stdin: { contents: "export { registerIpcHandlers } from './src/main/ipc-handlers.ts'; export { registerCostLibraryHandlers } from './src/main/cost-library-ipc.ts'", resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false
})
const Module = require('module')
const helpers = new Module(path.join(root, 'phase19-smoke-helpers.cjs'), module)
helpers.paths = Module._nodeModulePaths(root)
helpers._compile(result.outputFiles[0].text, path.join(root, 'phase19-smoke-helpers.cjs'))

let selectedFile = ''
const templatePath = path.join(qa, 'template.xlsx')
const projectPath = path.join(qa, 'portable-project.clmc')
const exportPath = path.join(qa, 'estimate.csv')
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedFile] })
dialog.showSaveDialog = async (_win, options) => ({ canceled: false, filePath: options.title === 'Save Cost Library Template' ? templatePath : options.title === 'Save Project' ? projectPath : exportPath })
let win
const checks = []
const errors = []
const run = (code) => win.webContents.executeJavaScript(code, true)
async function waitFor(code, name) {
  const limit = Date.now() + 12000
  while (Date.now() < limit) {
    if (await run(code)) return
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
  throw new Error(`Timed out: ${name}`)
}
async function click(selector) {
  assert(await run(`!!document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`), `Missing/hidden control: ${selector}`)
  await run(`document.querySelector(${JSON.stringify(selector)}).click()`)
}
async function clickText(text) {
  assert(await run(`Array.from(document.querySelectorAll('button')).some(b => b.textContent === ${JSON.stringify(text)} && !b.disabled)`), `Missing/enabled button: ${text}`)
  await run(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(text)} && !b.disabled).click()`)
}
async function openWindow() {
  win = new BrowserWindow({ show: false, width: 1360, height: 900, webPreferences: { preload: path.join(root, 'out/preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  win.webContents.on('console-message', (event) => { if (event.level === 'error' || event.level === 3) errors.push(event.message) })
  win.webContents.on('did-fail-load', (_event, code, reason, url) => console.error('Load failed:', code, reason, url))
  win.webContents.on('render-process-gone', (_event, details) => console.error('Renderer gone:', details))
  await win.loadURL(pathToFileURL(path.join(root, 'out/renderer/index.html')).href)
  await waitFor(`!!document.querySelector('[data-testid="view-mode-estimate"]')`, 'app shell')
}
async function manage() {
  await click('[data-testid="view-mode-estimate"]')
  await clickText('Cost Library')
  await waitFor(`!!document.querySelector('[role="dialog"]') && !Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Close')?.disabled`, 'library load')
}
async function importAndReplace(file) {
  selectedFile = file
  await clickText('Import CSV / Excel')
  await waitFor(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Replace Library' && !b.disabled)`, 'import preview')
  await clickText('Replace Library')
  await waitFor(`document.body.textContent.includes('Library replaced on this PC')`, 'library commit')
}
async function capture(name) {
  await new Promise((resolve) => setTimeout(resolve, 180))
  fs.writeFileSync(path.join(qa, name), (await win.webContents.capturePage()).toPNG())
}

app.whenReady().then(async () => {
  try {
    helpers.exports.registerIpcHandlers()
    helpers.exports.registerCostLibraryHandlers()
    await openWindow()
    await manage()
    await clickText('Download Excel Template')
    await waitFor(`document.body.textContent.includes('Template saved')`, 'template write')
    assert(fs.existsSync(templatePath))
    checks.push('Template downloaded through production renderer/preload/IPC/native-dialog path')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)
    workbook.getWorksheet('Cost Library').getRow(2).values = ['E1', 'Power outlet', 'Electrical', 'pcs', 150.5, 75.25]
    workbook.getWorksheet('Cost Library').getRow(3).values = ['F1', 'Wall painting', 'Finishes', 'm²', 100, 80]
    const master = path.join(qa, 'master.xlsx')
    await workbook.xlsx.writeFile(master)
    await importAndReplace(master)
    checks.push('Filled app template previewed and persisted through production IPC')
    await capture('library-management.png')
    await clickText('Close')

    const pdf = fs.readFileSync(path.join(root, 'src/tests/fixtures/sample-1page.pdf'))
    const now = new Date().toISOString()
    const project = {
      formatVersion: 2, createdAt: now, updatedAt: now,
      pdf: { originalFilename: 'sample-1page.pdf', sha256: createHash('sha256').update(pdf).digest('hex'), totalPages: 1 },
      globalUnit: 'm', categories: { c1: { id: 'c1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } }, categoryOrder: ['c1'], currentPage: 1, defaultMarkupPct: 12,
      pages: [{ pageIndex: 1, dimensions: { width: 200, height: 200 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [1, 2].map((n) => ({ id: `m${n}`, type: 'count', page: 1, name: 'Outlet', categoryId: 'c1', color: '#0078d4', createdAt: n, sequence: n, point: { x: 20 * n, y: 20 } })) }]
    }
    const archive = new JSZip().file('project.json', JSON.stringify(project)).file('plan.pdf', pdf)
    fs.writeFileSync(projectPath, await archive.generateAsync({ type: 'nodebuffer', compression: 'STORE' }))
    selectedFile = projectPath
    await click('[aria-label="Open project or PDF (Ctrl+O)"]')
    await waitFor(`!!document.querySelector('[aria-label="Choose library rates for Outlet"]')`, 'open project / estimate row')
    await click('[data-testid="view-mode-estimate"]')
    await waitFor(`!!document.querySelector('[aria-label="Choose library rates for Outlet"]')?.getClientRects().length`, 'visible Estimate row')
    await click('[aria-label="Choose library rates for Outlet"]')
    await waitFor(`!!document.querySelector('[aria-label="Select E1"]')`, 'row picker')
    assert.equal(await run(`document.querySelector('[aria-label="Select F1"]').disabled`), true)
    await click('[aria-label="Select E1"]')
    await capture('library-picker.png')
    await clickText('Apply Rates')
    await waitFor(`document.querySelector('[data-testid="estimate-row-material-input"]')?.value === '150.5'`, 'applied rate')
    assert.equal(await run(`document.querySelector('[data-testid="estimate-row-labor-input"]').value`), '75.25')
    assert.equal(await run(`document.querySelector('[data-testid="estimate-row-markup-input"]').value`), '12')
    checks.push('Real Estimate row applies material/labor, preserves 12% project markup and computes totals')
    await capture('estimate-applied.png')
    await click('[aria-label="Save (Ctrl+S)"]')
    await waitFor(`!document.body.textContent.includes('Saving...')`, 'save completed')
    await new Promise((resolve) => setTimeout(resolve, 200))
    const saved = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(projectPath))).file('project.json').async('string'))
    assert.deepEqual(saved.rates['Outlet|count'], { material: 150.5, labor: 75.25, markup: 12 })
    checks.push('Applied rate snapshot saved inside portable .clmc')

    workbook.getWorksheet('Cost Library').getCell('E2').value = 999
    const revision = path.join(qa, 'revision.xlsx')
    await workbook.xlsx.writeFile(revision)
    await manage(); await importAndReplace(revision); await clickText('Close')
    assert.equal(await run(`document.querySelector('[data-testid="estimate-row-material-input"]').value`), '150.5')
    checks.push('Importing a revision leaves existing Estimate prices unchanged')
    const loaded = await run('window.api.costLibrary.load()')
    assert.equal(loaded.value.items[0].material, 999)

    win.destroy()
    await openWindow()
    assert.equal((await run('window.api.costLibrary.load()')).value.items[0].material, 999)
    checks.push('Accepted local library survives renderer/window recreation')
    const localFile = path.join(qa, 'user-data/cost-library-v1.json')
    fs.renameSync(localFile, `${localFile}.offline-test`)
    selectedFile = projectPath
    await click('[aria-label="Open project or PDF (Ctrl+O)"]')
    await waitFor(`document.querySelector('[data-testid="estimate-row-material-input"]')?.value === '150.5'`, 'project without library')
    await click('[data-testid="view-mode-estimate"]')
    assert.equal((await run('window.api.costLibrary.load()')).value, null)
    checks.push('Saved project reopens with applied prices when local library is absent')
    await click('[aria-label="Export"]')
    await new Promise((resolve) => setTimeout(resolve, 350))
    if (fs.existsSync(exportPath)) {
      assert(fs.readFileSync(exportPath, 'utf8').includes('150.5'))
      checks.push('Production export writes applied rates to CSV')
    } else throw new Error('Export file was not written')
    fs.writeFileSync(path.join(qa, 'result.json'), JSON.stringify({ ok: true, checks, rendererErrors: errors }, null, 2))
    console.log(JSON.stringify({ ok: true, checks, rendererErrors: errors, artifacts: qa }, null, 2))
    app.exit(0)
  } catch (error) {
    console.error(error.stack)
    fs.writeFileSync(path.join(qa, 'result.json'), JSON.stringify({ ok: false, checks, reason: String(error), rendererErrors: errors }, null, 2))
    if (win && !win.isDestroyed()) await capture('failure.png').catch(() => {})
    app.exit(1)
  }
})
