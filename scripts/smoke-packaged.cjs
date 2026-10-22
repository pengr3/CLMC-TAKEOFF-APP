/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Node owns disposable packaged-app smoke and CDP orchestration. */
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const net = require('node:net')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function makePdf() {
  const stream = '0.2 0.5 0.8 rg 20 20 200 100 re f\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(pdf)
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}
async function client(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  let next = 0
  const pending = new Map()
  const events = []
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.id) {
      const entry = pending.get(data.id)
      pending.delete(data.id)
      if (entry)
        data.error
          ? entry.reject(new Error(JSON.stringify(data.error)))
          : entry.resolve(data.result)
    } else events.push(data)
  }
  return {
    socket,
    events,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++next
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    }
  }
}
async function run() {
  const executable = path.resolve(process.argv[2] || 'dist/win-unpacked/clmc-takeoff.exe')
  const manifest = JSON.parse(await fs.readFile('dist/release-manifest.json', 'utf8'))
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'clmc-packaged-smoke-'))
  const pdf = makePdf()
  const pdfPath = path.join(scratch, 'packaged-plan.pdf'),
    savePath = path.join(scratch, 'packaged-project.clmc')
  const workbook = new (require('exceljs').Workbook)()
  const sheet = workbook.addWorksheet('Cost Library')
  sheet.addRow([
    'Item Code',
    'Description',
    'Category',
    'Unit',
    'Material Unit Rate',
    'Labor Unit Rate'
  ])
  sheet.addRow(['SMOKE', 'Paint', 'Finishes', 'm²', 100, 50])
  const libraryPath = path.join(scratch, 'library.xlsx')
  await fs.writeFile(pdfPath, pdf)
  await fs.writeFile(libraryPath, Buffer.from(await workbook.xlsx.writeBuffer()))
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  const env = { ...process.env, APPDATA: scratch }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  const child = spawn(executable, [`--inspect-brk=127.0.0.1:${port}`], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let log = '',
    inspector
  child.stdout.on('data', (chunk) => {
    log += chunk
  })
  child.stderr.on('data', (chunk) => {
    log += chunk
  })
  const timeout = setTimeout(() => child.kill(), 90000)
  try {
    let targets
    for (let n = 0; n < 100; n++) {
      targets = await fetch(`http://127.0.0.1:${port}/json/list`)
        .then((r) => r.json())
        .catch(() => null)
      if (targets?.length) break
      await delay(100)
    }
    assert.ok(targets?.length, log)
    inspector = await client(targets[0].webSocketDebuggerUrl)
    await inspector.send('Debugger.enable')
    await inspector.send('Runtime.runIfWaitingForDebugger')
    for (let n = 0; n < 100 && !inspector.events.some((e) => e.method === 'Debugger.paused'); n++)
      await delay(50)
    const paused = inspector.events.find((e) => e.method === 'Debugger.paused')
    assert.ok(paused, 'Packaged main must pause before window/data initialization')
    const prelude = `globalThis.__smoke = {electron: require('electron'), nextOpen:${JSON.stringify(pdfPath)}, savePath:${JSON.stringify(savePath)}, failures:[], workers:[], network:[], children:[]};
      __smoke.electron.app.setPath('appData',${JSON.stringify(scratch)});
      __smoke.electron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[__smoke.nextOpen]});
      __smoke.electron.dialog.showSaveDialog=async()=>({canceled:false,filePath:__smoke.savePath});
      __smoke.electron.app.on('child-process-gone',(_e,d)=>__smoke.failures.push(d.type));
      const originalFork=__smoke.electron.utilityProcess.fork;__smoke.electron.utilityProcess.fork=(...args)=>{__smoke.children.push(args[0]);return originalFork(...args)};
      __smoke.electron.app.on('browser-window-created',(_e,w)=>{__smoke.window=w;w.show=()=>{};w.maximize=()=>{};w.webContents.setBackgroundThrottling(false);
       w.webContents.on('preload-error',(_e,_p,error)=>__smoke.failures.push(String(error)));
       w.webContents.on('console-message',e=>{if(e.message?.includes('fake worker'))__smoke.failures.push(e.message)});
       w.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>{__smoke.network.push(d.url);cb({cancel:true})});
       w.webContents.debugger.attach('1.3');w.webContents.debugger.on('message',(_e,m,p)=>{if(m==='Target.attachedToTarget'&&p.targetInfo.type==='worker')__smoke.workers.push(p.targetInfo.url)});
       w.webContents.debugger.sendCommand('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
      });true`
    const setup = await inspector.send('Debugger.evaluateOnCallFrame', {
      callFrameId: paused.params.callFrames[0].callFrameId,
      expression: prelude,
      returnByValue: true
    })
    assert.ok(!setup.exceptionDetails, JSON.stringify(setup))
    await inspector.send('Debugger.resume')
    const main = async (expression) => {
      const result = await inspector.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    }
    const renderer = (expression) =>
      main(`__smoke.window.webContents.executeJavaScript(${JSON.stringify(expression)})`)
    const wait = async (expression) => {
      for (let n = 0; n < 200; n++) {
        if (await renderer(expression)) return
        await delay(100)
      }
      throw new Error(`Timed out: ${expression}`)
    }
    for (
      let n = 0;
      n < 100 &&
      !(await main(`!!globalThis.__smoke?.window && !__smoke.window.webContents.isLoading()`));
      n++
    )
      await delay(100)
    await wait(
      `typeof window.api?.getReleaseInfo==='function' && !!document.querySelector('button[title="Open project or PDF (Ctrl+O)"]')`
    )
    assert.equal(await renderer('typeof require'), 'undefined')
    const host = await main(
      `({packaged:__smoke.electron.app.isPackaged,appPath:__smoke.electron.app.getAppPath(),userData:__smoke.electron.app.getPath('userData'),preferences:__smoke.window.webContents.getLastWebPreferences(),visible:__smoke.window.isVisible(),electron:process.versions.electron,chrome:process.versions.chrome})`
    )
    assert.equal(host.packaged, true)
    assert.ok(host.appPath.endsWith('app.asar'))
    assert.equal(host.userData, path.join(scratch, 'clmc-takeoff'))
    assert.equal(host.preferences.sandbox, true)
    assert.equal(host.preferences.contextIsolation, true)
    assert.equal(host.preferences.nodeIntegration, false)
    assert.equal(host.visible, false)
    const notes = await renderer('window.api.getReleaseInfo()')
    assert.equal(notes.version, manifest.version)
    assert.equal(notes.notesStatus, 'available')
    await renderer(`document.querySelector('button[title="Open project or PDF (Ctrl+O)"]').click()`)
    await wait(
      `Array.from(document.querySelectorAll('canvas')).some(c=>{const x=c.getContext('2d');if(!x||!c.width||!c.height)return false;const p=x.getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=4)if(p[i]<100&&p[i+1]>100&&p[i+2]>150&&p[i+3]>0)return true;return false})`
    )
    await renderer(`document.querySelector('button[title="Save (Ctrl+S)"]').click()`)
    for (let n = 0; n < 100 && !(await fs.stat(savePath).catch(() => null)); n++) await delay(100)
    const saved = await renderer(`window.api.readProject(${JSON.stringify(savePath)})`)
    assert.equal(saved.kind, 'v2-zip')
    assert.equal(JSON.parse(saved.projectJson).formatVersion, 3)
    assert.equal(
      crypto
        .createHash('sha256')
        .update(Buffer.from(Object.values(saved.pdfBytes)))
        .digest('hex'),
      crypto.createHash('sha256').update(pdf).digest('hex')
    )
    await main(`__smoke.nextOpen=${JSON.stringify(savePath)}`)
    await renderer(`document.querySelector('button[title="Open project or PDF (Ctrl+O)"]').click()`)
    await wait(`document.body.textContent.includes('packaged-project')`)
    await main(`__smoke.nextOpen=${JSON.stringify(libraryPath)}`)
    const preview = await renderer('window.api.costLibrary.preview()')
    assert.equal(preview.ok, true, JSON.stringify(preview))
    assert.equal(preview.value.library.items[0].material, 100)
    assert.equal(
      (await renderer(`window.api.costLibrary.commit(${JSON.stringify(preview.value.token)})`)).ok,
      true
    )
    const structure = {
      metadata: {
        projectName: 'Packaged smoke',
        planFilename: 'packaged-plan.pdf',
        exportedDate: '2026-10-22',
        totalPages: 1,
        totalMarkups: 1
      },
      categories: [
        {
          name: 'Finishes',
          items: [
            {
              label: 'Paint',
              quantity: 2,
              uom: 'm²',
              material: 100,
              labor: 50,
              markup: 30,
              materialCost: 200,
              laborCost: 100,
              cost: 300,
              price: 390,
              margin: 90,
              color: null,
              type: 'area'
            }
          ],
          subtotals: [{ uom: 'm²', total: 2 }],
          costSubtotal: 300,
          priceSubtotal: 390,
          marginSubtotal: 90
        }
      ],
      grandTotals: [{ uom: 'm²', total: 2 }],
      grandTotalCost: 300,
      grandTotalPrice: 390,
      grandTotalMargin: 90
    }
    for (const format of ['Xlsx', 'Csv']) {
      const target = path.join(scratch, `internal.${format.toLowerCase()}`)
      assert.equal(
        (
          await renderer(
            `window.api.writeBoq${format}(${JSON.stringify(target)},${JSON.stringify(structure)})`
          )
        ).ok,
        true
      )
      assert.ok((await fs.stat(target)).size > 100)
      if (format === 'Xlsx') {
        const readback = new (require('exceljs').Workbook)()
        await readback.xlsx.readFile(target)
        assert.ok(JSON.stringify(readback.model).includes('390'))
      } else assert.ok((await fs.readFile(target, 'utf8')).includes('390'))
    }
    const detail = await main(
      `({failures:__smoke.failures,workers:__smoke.workers,network:__smoke.network,children:__smoke.children})`
    )
    assert.deepEqual(detail.failures, [])
    assert.deepEqual(detail.network, [])
    assert.ok(detail.workers.some((url) => url.startsWith('blob:')))
    assert.ok(
      detail.children.some(
        (file) => file.includes('app.asar') && file.endsWith('cost-library-worker.js')
      )
    )
    const evidence = {
      status: 'pass',
      scope: 'scripted-packaged-developer-host',
      date: new Date().toISOString(),
      machine: {
        classification: 'development',
        hostname: os.hostname(),
        windows: os.release(),
        architecture: os.arch(),
        ramBytes: os.totalmem()
      },
      candidate: {
        version: manifest.version,
        installerSha256: manifest.installer.sha256,
        archiveSha256: manifest.archive.sha256
      },
      actual: {
        electron: host.electron,
        chrome: host.chrome,
        packaged: true,
        sandbox: true,
        hidden: true,
        localNotes: true,
        pdfWorker: true,
        renderedPdf: true,
        format3SaveReadReopen: true,
        importUtilityChild: true,
        internalXlsxCsv: true,
        externalNetworkRequests: detail.network,
        disposableAppData: true
      },
      fixture: {
        name: 'generated vector PDF',
        bytes: pdf.length,
        pages: 1,
        sha256: crypto.createHash('sha256').update(pdf).digest('hex')
      },
      limitations: [
        'Dialog destinations scripted through inspector; physical UI and non-development-PC install/upgrade/scaling are pending.'
      ]
    }
    await fs.writeFile('dist/packaged-smoke.json', JSON.stringify(evidence, null, 2) + '\n')
    console.log(JSON.stringify(evidence, null, 2))
    inspector.socket.close()
    child.kill()
    await delay(500)
    await fs.rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (error) {
    console.error(log)
    console.error('Disposable scratch retained:', scratch)
    throw error
  } finally {
    clearTimeout(timeout)
    inspector?.socket.close()
    child.kill()
  }
}
run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
