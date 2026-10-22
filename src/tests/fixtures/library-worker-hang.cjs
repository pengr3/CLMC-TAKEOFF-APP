// Deliberately block a real utility-process event loop, so promise races cannot pass this test.
process.parentPort.once('message', () => {
  while (true) {
    /* synchronous hang */
  }
})
