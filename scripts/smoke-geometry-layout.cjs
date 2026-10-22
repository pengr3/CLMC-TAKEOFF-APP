/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Actual component/Chromium DOM geometry and keyboard regression. */
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
if (!process.versions.electron) {
  ;(async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'clmc-geometry-layout-'))
    try {
      const result = await require('esbuild').build({ entryPoints: ['src/tests/helpers/geometry-layout-entry.tsx'], bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@renderer': path.resolve('src/renderer/src') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.hot': 'undefined' } })
      await fs.writeFile(path.join(scratch, 'entry.js'), result.outputFiles[0].contents)
      const env = { ...process.env, CLMC_GEOMETRY_SMOKE_DIRECTORY: scratch, APPDATA: scratch }
      delete env.ELECTRON_RUN_AS_NODE
      await new Promise((resolve, reject) => {
        const child = require('node:child_process').spawn(require('electron'), [__filename], { env, windowsHide: true, stdio: 'inherit' })
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Geometry layout process exited ${code}`)))
      })
    } finally { await fs.rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) }
  })().catch(error => { console.error(error); process.exitCode = 1 })
} else {
  const { app, BrowserWindow } = require('electron')
  app.setPath('userData', process.env.CLMC_GEOMETRY_SMOKE_DIRECTORY)
  app.on('window-all-closed', () => {})
  app.whenReady().then(async () => {
    try {
      const bundle = await fs.readFile(path.join(process.env.CLMC_GEOMETRY_SMOKE_DIRECTORY, 'entry.js'), 'utf8')
      const html = path.join(process.env.CLMC_GEOMETRY_SMOKE_DIRECTORY, 'layout.html')
      await fs.writeFile(html, '<style>*{box-sizing:border-box}body{margin:0;overflow:hidden;font:13px Arial}</style><div id="root"></div>')
      const measurements = []
      for (const height of [600, 400]) {
        const window = new BrowserWindow({ width: 1024, height, useContentSize: true, frame: false, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
        const contents = window.webContents
        contents.setBackgroundThrottling(false)
        contents.on('console-message', event => { if (event.level === 'error') console.error(event.message) })
        await window.loadFile(html)
        await contents.executeJavaScript(bundle)
        await new Promise(resolve => setTimeout(resolve, 100))
        const initial = await contents.executeJavaScript(`(()=>{const b=document.querySelector('aside').getBoundingClientRect(),c=document.querySelector('[data-testid="layout-canvas"]').getBoundingClientRect();return {height:innerHeight,banner:b.height,canvas:c.height,buttons:document.querySelectorAll('aside button').length}})()`)
        assert.ok(initial.canvas >= 160, `Unusable plan viewport: ${JSON.stringify(initial)}`)
        assert.ok(initial.buttons <= 4, 'Page controls grow with flagged page count')
        await contents.executeJavaScript(`document.querySelector('[aria-label="Review page number"]').focus();document.querySelector('[aria-label="Review page number"]').select()`)
        await contents.insertText('150')
        await new Promise(resolve => setTimeout(resolve, 50))
        contents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); contents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' })
        await new Promise(resolve => setTimeout(resolve, 50))
        assert.equal(await contents.executeJavaScript(`document.activeElement.dataset.testid`), 'geometry-go')
        contents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); contents.sendInputEvent({ type: 'char', keyCode: '\r' }); contents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
        await new Promise(resolve => setTimeout(resolve, 50))
        assert.equal(await contents.executeJavaScript(`__layout.viewer.getState().currentPage`), 150,
          await contents.executeJavaScript(`JSON.stringify({input:document.querySelector('input').value,active:document.activeElement.outerHTML})`))
        const confirm = await contents.executeJavaScript(`(()=>{const b=document.querySelector('[data-testid="geometry-confirm"]');b.focus();const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,focused:document.activeElement===b,disabled:b.disabled}})()`)
        assert.ok(confirm.focused && !confirm.disabled && confirm.top >= 0 && confirm.bottom <= height, JSON.stringify(confirm))
        contents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); contents.sendInputEvent({ type: 'char', keyCode: '\r' }); contents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
        await new Promise(resolve => setTimeout(resolve, 50))
        assert.equal(await contents.executeJavaScript(`__layout.project.getState().geometryReviewPages.length`), 149)
        await contents.executeJavaScript(`document.querySelector('aside summary').click()`)
        const expanded = await contents.executeJavaScript(`({banner:document.querySelector('aside').getBoundingClientRect().height,canvas:document.querySelector('[data-testid="layout-canvas"]').getBoundingClientRect().height})`)
        assert.ok(expanded.canvas >= 128 && expanded.banner <= height * .25 + 1, JSON.stringify(expanded))
        const reachable = await contents.executeJavaScript(`(()=>{const a=document.querySelector('aside');a.scrollTop=a.scrollHeight;const b=document.querySelector('[data-testid="geometry-confirm"]');b.focus();const r=b.getBoundingClientRect(),p=a.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom&&r.bottom<=innerHeight})()`)
        assert.equal(reachable, true, 'Current-page confirmation is not reachable after expanding/scrolling instructions')
        measurements.push({ ...initial, expanded })
        window.destroy()
      }
      console.log(JSON.stringify({ status: 'pass', actualComponent: true, flaggedPages: 150, keyboardNavigationAndConfirmation: true, measurements }))
      app.exit(0)
    } catch (error) { console.error(error); app.exit(1) }
  })
}
