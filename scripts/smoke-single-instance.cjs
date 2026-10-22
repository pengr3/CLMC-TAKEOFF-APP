/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Real two-process Electron storage ownership regression. */
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const scratch = process.env.CLMC_INSTANCE_SMOKE_DIRECTORY
async function until(predicate) {
  for (let i = 0; i < 300; i++) { if (await predicate()) return; await pause(50) }
  throw new Error('Instance smoke timed out')
}
if (!process.versions.electron) {
  ;(async () => {
    const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'clmc-instance-smoke-'))
    const children = []
    const launch = role => {
      const env = { ...process.env, CLMC_INSTANCE_SMOKE_DIRECTORY: directory }
      delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL
      const child = spawn(require('electron'), [__filename, role], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      children.push(child)
      let log = ''
      child.stdout.on('data', chunk => { log += chunk }); child.stderr.on('data', chunk => { log += chunk })
      return { child, exit: new Promise(resolve => child.on('exit', code => resolve({ code, log }))) }
    }
    try {
      const owner = launch('owner')
      await until(() => fs.existsSync(path.join(directory, 'stage-ready')))
      const contender = launch('contender')
      const result = await contender.exit
      assert.equal(result.code, 0, result.log)
      await fsp.writeFile(path.join(directory, 'release'), '')
      const finished = await owner.exit
      assert.equal(finished.code, 0, finished.log)
      assert.equal(fs.existsSync(path.join(directory, 'contender-initialized')), false, 'Contender initialized shared storage/window')
      assert.deepEqual(JSON.parse(await fsp.readFile(path.join(directory, 'contender-lock.json'), 'utf8')), { owned: false })
      const proof = JSON.parse(await fsp.readFile(path.join(directory, 'proof.json'), 'utf8'))
      assert.equal(proof.acknowledged, true); assert.equal(proof.readable, true)
      assert.ok(proof.activations > 0); assert.ok(proof.focuses > 0); assert.ok(proof.restores > 0)
      console.log(JSON.stringify({ status: 'pass', ...proof, contenderInitialized: false }))
    } finally {
      for (const child of children) child.kill()
      await pause(200)
      await fsp.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })().catch(error => { console.error(error); process.exitCode = 1 })
} else {
  const { app, ipcMain } = require('electron')
  const role = process.argv[2], root = path.resolve(__dirname, '..')
  app.setPath('appData', scratch); app.setAppPath(root)
  if (app.requestSingleInstanceLock) {
    const request = app.requestSingleInstanceLock.bind(app)
    app.requestSingleInstanceLock = (...args) => {
      const owned = request(...args)
      fs.writeFileSync(path.join(scratch, `${role}-lock.json`), JSON.stringify({ owned }))
      return owned
    }
  }
  const handlers = new Map(), handle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (name, listener) => { handlers.set(name, listener); return handle(name, listener) }
  let activations = 0, focuses = 0, restores = 0
  app.on('second-instance', () => { activations++ })
  app.on('browser-window-created', (_event, window) => {
    if (role === 'contender') fs.writeFileSync(path.join(scratch, 'contender-initialized'), '')
    window.show = () => {}; window.maximize = () => {}; window.focus = () => { focuses++ }
    window.isMinimized = () => true; window.restore = () => { restores++ }
    window.webContents.setBackgroundThrottling(false)
    window.webContents.once('did-finish-load', async () => {
      try {
        const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
        if (role === 'contender') {
          await handlers.get('recovery:list')(event)
          app.exit(0); return
        }
        const { randomUUID, createHash } = require('node:crypto')
        const pdfBytes = await fsp.readFile(path.join(root, 'src/tests/fixtures/sample-1page.pdf'))
        const session = randomUUID(), hash = createHash('sha256').update(pdfBytes).digest('hex')
        const projectJson = JSON.stringify({ formatVersion: 3, minimumReaderVersion: 3, createdAt: '2026-10-22', updatedAt: '2026-10-22', pdf: { originalFilename: 'owned.pdf', totalPages: 1, sha256: hash }, globalUnit: 'm', categories: {}, categoryOrder: [], currentPage: 1,
          pages: [{ pageIndex: 1, dimensions: { width: 595, height: 842 }, scale: null, viewport: { zoom: 1, panX: 0, panY: 0 }, markups: [] }] })
        const rename = fsp.rename
        fsp.rename = async (source, destination) => {
          if (destination.endsWith(`${session}.json`)) {
            await fsp.writeFile(path.join(scratch, 'stage-ready'), '')
            await until(() => fs.existsSync(path.join(scratch, 'release')))
          }
          return rename(source, destination)
        }
        const written = await handlers.get('recovery:write')(event, { session, revision: 1, sourcePath: null, lastSavedAt: null, projectJson, pdfBytes })
        const read = await handlers.get('recovery:read')(event, session)
        await fsp.writeFile(path.join(scratch, 'proof.json'), JSON.stringify({ acknowledged: written.ok, readable: read.ok, activations, focuses, restores }))
        app.exit(0)
      } catch (error) { console.error(error); app.exit(1) }
    })
  })
  setTimeout(() => app.exit(2), 25000)
  require(path.join(root, 'out/main/index.js'))
}
