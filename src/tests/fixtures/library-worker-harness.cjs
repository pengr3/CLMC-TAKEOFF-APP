/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Executed directly by the actual Electron test host. */
const { app, utilityProcess } = require('electron')
const path = require('node:path')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const scratch = process.argv[2]
app.setPath('appData', scratch)
app.setPath('userData', path.join(scratch, 'user-data'))
app
  .whenReady()
  .then(async () => {
    const { parseInUtilityProcess } = require(path.join(scratch, 'supervisor.cjs'))
    const originalFork = utilityProcess.fork.bind(utilityProcess)
    const observed = []
    utilityProcess.fork = (...args) => {
      const child = originalFork(...args)
      const record = { exits: 0, kills: 0, pid: undefined }
      observed.push(record)
      const kill = child.kill.bind(child)
      child.kill = () => {
        record.kills++
        return kill()
      }
      child.on('spawn', () => {
        record.pid = child.pid
      })
      child.on('exit', () => {
        record.exits++
      })
      return child
    }
    const workerPath = path.join(scratch, 'worker.cjs')
    const success = await parseInUtilityProcess(path.join(scratch, 'valid.xlsx'), { workerPath })
    assert.equal(success.ok, true)
    assert.equal(success.value[0].code, 'REAL-001')
    assert.equal(observed[0].exits, 1)
    let beats = 0
    const heartbeat = setInterval(() => beats++, 10)
    const timed = await parseInUtilityProcess('main-selected.xlsx', {
      workerPath: path.resolve(__dirname, 'library-worker-hang.cjs'),
      deadlineMs: 1200
    })
    clearInterval(heartbeat)
    assert.equal(timed.code, 'timeout')
    assert.ok(beats > 20, 'main event loop stayed responsive while child hung')
    assert.equal(observed[1].exits, 1)
    assert.ok(observed[1].kills >= 1)
    assert.throws(() => process.kill(observed[1].pid, 0), 'hung child must no longer exist')
    const crash = await parseInUtilityProcess('main-selected.xlsx', {
      workerPath: path.resolve(__dirname, 'library-worker-crash.cjs')
    })
    assert.equal(crash.code, 'parser')
    assert.equal(observed[2].exits, 1)
    const controller = new AbortController()
    const aborted = parseInUtilityProcess('main-selected.xlsx', {
      workerPath: path.resolve(__dirname, 'library-worker-hang.cjs'),
      signal: controller.signal
    })
    setTimeout(() => controller.abort(), 300)
    assert.equal((await aborted).ok, false)
    assert.equal(observed[3].exits, 1)
    if (await fs.stat(path.join(scratch, 'maximum.xlsx')).catch(() => null)) {
      const started = performance.now()
      const max = await parseInUtilityProcess(path.join(scratch, 'maximum.xlsx'), { workerPath })
      assert.equal(max.ok, true)
      assert.equal(max.value.length, 10000)
      console.log(
        'MAXIMUM_MEASURE ' + JSON.stringify({ milliseconds: performance.now() - started })
      )
    }
    console.log(
      'LIBRARY_WORKER_RESULT ' + JSON.stringify({ success, timed, crash, observed, beats })
    )
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
