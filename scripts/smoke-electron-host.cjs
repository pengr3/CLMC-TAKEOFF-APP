/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Electron and Node execute this CommonJS smoke harness directly without TypeScript compilation. */
// Runs the production host invisibly with disposable appData and real IPC/worker I/O.
// Usage after npm run build: node scripts/smoke-electron-host.cjs
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { verifyReopenTransition } = require('./smoke-reopen.cjs')

if (!process.versions.electron) {
  const { spawn } = require('node:child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  env.CLMC_HOST_SMOKE_DIRECTORY = require('node:fs').mkdtempSync(
    path.join(os.tmpdir(), 'clmc-host-smoke-')
  )
  const child = spawn(require('electron'), [__filename], {
    env,
    stdio: 'inherit',
    windowsHide: true
  })
  child.on('error', (error) => {
    console.error(error)
    process.exitCode = 1
  })
  child.on('exit', async (code) => {
    process.exitCode = code ?? 1
    if (code === 0)
      await fs.rm(env.CLMC_HOST_SMOKE_DIRECTORY, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200
      })
  })
} else {
  run().catch((error) => {
    console.error(error)
    require('electron').app.exit(1)
  })
}

function makePdf(red = false) {
  const stream = `${red ? '0.8 0.2 0.2' : '0.2 0.5 0.8'} rg 20 20 200 100 re f\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

async function run() {
  const { app, dialog } = require('electron')
  const root = path.resolve(__dirname, '..')
  const scratch = process.env.CLMC_HOST_SMOKE_DIRECTORY
  assert.ok(scratch, 'Launch with node so the parent owns disposable data cleanup')
  const data = path.join(scratch, 'clmc-takeoff')
  await fs.mkdir(data)
  const library = {
    formatVersion: 1,
    sourceFilename: 'smoke.csv',
    importedAt: '2026-10-22T00:00:00.000Z',
    items: [
      {
        code: 'SMOKE',
        description: 'Paint',
        category: 'Finishes',
        unit: 'm²',
        material: 100,
        labor: 50
      }
    ]
  }
  const libraryPath = path.join(data, 'cost-library-v1.json')
  const libraryText = JSON.stringify(library)
  await fs.writeFile(libraryPath, libraryText)
  const pdfPath = path.join(scratch, 'sandbox-plan.pdf')
  const savePath = path.join(scratch, 'sandbox-project.clmc')
  const alternatePath = path.join(scratch, 'different-red-plan.pdf')
  const pdf = makePdf()
  await fs.writeFile(pdfPath, pdf)
  await fs.writeFile(alternatePath, makePdf(true))
  app.setPath('appData', scratch)
  app.setAppPath(root)
  let nextOpen = pdfPath
  let nextSave = savePath
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [nextOpen] })
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: nextSave })
  const failures = []
  const workers = []
  let resolveWindow
  const windowReady = new Promise((resolve) => {
    resolveWindow = resolve
  })
  app.on('browser-window-created', (_event, window) => {
    // Suppress only visibility in the test harness; production webPreferences stay intact.
    window.show = () => {}
    window.maximize = () => {}
    window.webContents.setBackgroundThrottling(false)
    window.webContents.on('preload-error', (_event, _file, error) => failures.push(String(error)))
    window.webContents.on('render-process-gone', (_event, detail) =>
      failures.push(JSON.stringify(detail))
    )
    window.webContents.on('console-message', (event) => {
      if (event.message?.includes('fake worker')) failures.push(event.message)
      if (event.level === 'error' || event.level === 3) console.error('Renderer:', event.message)
    })
    window.webContents.debugger.attach('1.3')
    window.webContents.debugger.on('message', (_event, method, params) => {
      if (method === 'Target.attachedToTarget' && params.targetInfo.type === 'worker')
        workers.push(params.targetInfo.url)
    })
    window.webContents.debugger
      .sendCommand('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true
      })
      .catch((error) => failures.push(String(error)))
    window.webContents.once('did-finish-load', () => resolveWindow(window))
  })
  const timeout = setTimeout(() => {
    console.error('Host smoke timed out')
    app.exit(1)
  }, 60000)
  try {
    require(path.join(root, 'out/main/index.js'))
    const window = await windowReady
    const contents = window.webContents
    const execute = async (source) => {
      try { return await contents.executeJavaScript(source) }
      catch (error) { throw new Error(`Renderer evaluation failed: ${source}`, { cause: error }) }
    }
    const waitFor = async (source) => {
      for (let attempt = 0; attempt < 150; attempt++) {
        const result = await execute(source)
        if (result) return result
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`Timed out: ${source}`)
    }
    const options = contents.getLastWebPreferences()
    assert.equal(options.sandbox, true)
    assert.equal(options.contextIsolation, true)
    assert.equal(options.nodeIntegration, false)
    assert.equal(window.isVisible(), false)
    assert.equal(app.getPath('userData'), data)
    await waitFor(
      `typeof window.api?.costLibrary?.load === 'function' && !!document.querySelector('button[title="Open project or PDF (Ctrl+O)"]')`
    )
    assert.equal(await execute(`typeof require`), 'undefined')
    assert.deepEqual(await execute(`window.api.costLibrary.load()`), { ok: true, value: library })
    await execute(`document.querySelector('button[title="Open project or PDF (Ctrl+O)"]').click()`)
    await waitFor(
      `!!document.querySelector('button[title="Save (Ctrl+S)"]:not(:disabled)') && document.querySelectorAll('canvas').length > 0`
    )
    // Require an actual blob worker, then non-white pixels from the real plan render.
    await waitFor(`Array.from(document.querySelectorAll('canvas')).some(canvas => {
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i+1] > 100 && pixels[i+2] > 150 && pixels[i+3] > 0) return true;
      return false;
    })`)
    assert.ok(
      workers.some((url) => url.startsWith('blob:')),
      `Expected real blob PDF worker, got ${JSON.stringify(workers)}`
    )
    await execute(`document.querySelector('button[title="Save (Ctrl+S)"]').click()`)
    for (let attempt = 0; attempt < 150; attempt++) {
      if (
        await fs.stat(savePath).then(
          () => true,
          () => false
        )
      )
        break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const result = await execute(`window.api.readProject(${JSON.stringify(savePath)})`)
    assert.equal(result.kind, 'v2-zip')
    assert.deepEqual(Buffer.from(result.pdfBytes), pdf)
    assert.equal(JSON.parse(result.projectJson).pdf.sha256, result.computedSha256)
    const reopen = await verifyReopenTransition({ execute, waitFor,
      setOpen: target => { nextOpen = target }, setSave: target => { nextSave = target },
      savePath, alternatePath, saved: result,
      beforeReopen: process.env.CLMC_SMOKE_FAIL_REOPEN === '1' ? () => {
        const { ipcMain } = require('electron')
        ipcMain.removeHandler('file:readProject')
        ipcMain.handle('file:readProject', () => { throw new Error('Injected renderer reopen failure') })
      } : undefined })
    assert.equal(await fs.readFile(libraryPath, 'utf8'), libraryText)
    assert.deepEqual(failures, [])
    console.log(
      JSON.stringify(
        {
          status: 'pass',
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          sandbox: options.sandbox,
          contextIsolation: options.contextIsolation,
          nodeIntegration: options.nodeIntegration,
          hidden: !window.isVisible(),
          preservedLibrary: true,
          pdfWorker: workers,
          renderedPlan: true,
          projectSaveReadReopen: true,
          reopen,
          pdfBytes: pdf.length,
          disposableAppData: true
        },
        null,
        2
      )
    )
    contents.debugger.detach()
    window.destroy()
    await new Promise((resolve) => setTimeout(resolve, 200))
    clearTimeout(timeout)
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    console.error('Smoke scratch retained for diagnosis:', scratch)
    throw error
  }
}
