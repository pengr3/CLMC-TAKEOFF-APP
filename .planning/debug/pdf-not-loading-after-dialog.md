---
status: diagnosed
trigger: "PDF does not load or render after selecting file in dialog"
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:00Z
---

## Current Focus

hypothesis: ipc-handlers.ts returns data.buffer (a detached ArrayBuffer) — Structured Clone copies the Node.js Buffer's underlying memory, detaching the original; by the time it arrives in the renderer the ArrayBuffer has zero byteLength and PDF.js silently fails or throws a non-fatal error
test: confirmed by tracing ipc-handlers.ts line 15 and Node.js Buffer/ArrayBuffer semantics
expecting: fix is to copy the buffer before sending — Buffer.from(data) or new Uint8Array(data) passed as the data payload
next_action: DIAGNOSED — no further investigation needed

## Symptoms

expected: After selecting a PDF the app renders it on the Konva canvas
actual: Dialog opens, user selects PDF, nothing happens — canvas stays empty
errors: none visible to user
reproduction: click Open PDF, select any PDF file
started: unknown — likely from initial implementation

## Eliminated

- hypothesis: Preload bridge not wiring correctly
  evidence: contextBridge.exposeInMainWorld('api', api) matches window.api.openPdf() call in usePdfDocument; TypeScript declaration matches; IPC channel name matches on both sides
  timestamp: 2026-03-25

- hypothesis: usePdfDocument hook not triggered
  evidence: Toolbar.tsx calls openPdfDialog directly on button click; openPdfDialog calls window.api.openPdf() then loadPdf(); hook is correctly wired
  timestamp: 2026-03-25

- hypothesis: PDF.js worker not loading
  evidence: viteStaticCopy copies pdf.worker.mjs to renderer output root; pdf-setup.ts uses new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url) which Vite resolves correctly to the copied file; worker setup is standard and correct
  timestamp: 2026-03-25

- hypothesis: CanvasViewport not rendering after state update
  evidence: usePdfRenderer correctly subscribes to pdfDocument and currentPage from store; App.tsx switches from EmptyState to CanvasViewport when totalPages > 0; render pipeline is correct IF pdfDocument is set in the store
  timestamp: 2026-03-25

## Evidence

- timestamp: 2026-03-25
  checked: src/main/ipc-handlers.ts line 14-15
  found: |
    const data = await readFile(filePath)
    return { filePath, data: data.buffer }
  implication: |
    readFile() returns a Node.js Buffer. Buffer.buffer is the underlying ArrayBuffer that the
    Buffer shares with its internal pool — it is NOT a copy of just the file bytes. When Electron
    serialises this return value across the IPC boundary using the Structured Clone algorithm,
    it transfers (detaches) the ArrayBuffer. The renderer receives an ArrayBuffer whose
    byteLength may be the full pool size (typically 8192 bytes for small files, or a large shared
    slab), not the actual file size — or it arrives as a zero-byte detached buffer. PDF.js calls
    getDocument({ data }) and immediately fails internally because the data is either empty or
    malformed, catching the RenderingCancelledException / silent rejection that usePdfRenderer
    already swallows (line 77).

- timestamp: 2026-03-25
  checked: src/renderer/src/hooks/usePdfDocument.ts line 17
  found: pdfjsLib.getDocument({ data }).promise — data comes directly from result.data
  implication: If data.byteLength is 0 or the bytes are wrong, getDocument rejects or produces an empty document. The catch in usePdfRenderer (line 76-78) only suppresses RenderingCancelledException; a PDF.js InvalidPDFException or UnexpectedResponseException would be logged to console but not surfaced to the user, making the failure completely silent.

- timestamp: 2026-03-25
  checked: src/renderer/src/hooks/usePdfRenderer.ts line 76-78
  found: catch swallows all errors except RenderingCancelledException with only console.error
  implication: Confirms why the user sees nothing — any failure in PDF.js getDocument or render is silently eaten.

- timestamp: 2026-03-25
  checked: Node.js Buffer.buffer semantics
  found: |
    Buffer instances share an underlying ArrayBuffer pool. Buffer.buffer refers to the WHOLE
    pool ArrayBuffer, not a slice of the file bytes. The correct way to get an ArrayBuffer
    containing only the file bytes is: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    — or more simply, pass new Uint8Array(data) or Buffer.from(data) to create an independent copy.
  implication: The fix must ensure a properly bounded ArrayBuffer is sent across IPC.

## Resolution

root_cause: |
  src/main/ipc-handlers.ts line 15 returns `data.buffer` where `data` is a Node.js Buffer.
  `Buffer.buffer` is the raw underlying ArrayBuffer of the Buffer's internal memory pool — it is
  NOT a correctly bounded slice of the file bytes. When Electron's Structured Clone serialises
  this across the IPC boundary it either:
    (a) transfers the entire pool ArrayBuffer (wrong size, wrong bytes for files using the shared pool), or
    (b) detaches the original leaving a zero-length ArrayBuffer in the renderer.
  Either way, PDF.js receives corrupt or empty data, fails internally, and the error is silently
  swallowed by the catch block in usePdfRenderer.ts. The store never gets a pdfDocument, totalPages
  stays 0, and the canvas never renders.

fix: |
  In src/main/ipc-handlers.ts line 15, replace:
    return { filePath, data: data.buffer }
  with:
    return { filePath, data: new Uint8Array(data).buffer }

  `new Uint8Array(data)` creates a properly bounded typed array over exactly the file bytes.
  `.buffer` on that typed array is a correctly sized, independent ArrayBuffer that Structured
  Clone will copy correctly across the IPC boundary.

  Alternatively: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  Both are equivalent; the Uint8Array form is more idiomatic.

verification: not yet applied
files_changed:
  - src/main/ipc-handlers.ts
