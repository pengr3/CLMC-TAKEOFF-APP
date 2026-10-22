// A real child sends duplicate/invalid data to exercise the untrusted result boundary.
process.parentPort.once('message', ({ data }) => {
  if (data.path === 'oversized.xlsx') {
    process.parentPort.postMessage(' '.repeat(20_000_001))
  } else {
    process.parentPort.postMessage(
      JSON.stringify({ ok: false, code: 'toString', reason: 'invalid code' })
    )
    process.parentPort.postMessage(
      JSON.stringify({
        ok: true,
        value: [
          { code: 'LATE', description: 'Late', category: 'Test', unit: 'ea', material: 1, labor: 1 }
        ]
      })
    )
  }
})
