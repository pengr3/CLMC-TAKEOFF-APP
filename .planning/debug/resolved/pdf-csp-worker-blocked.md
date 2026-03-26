---
status: resolved
trigger: "PDF.js worker blocked by Content Security Policy when user uploads a PDF"
created: 2026-03-25T00:00:00Z
updated: 2026-03-26T12:00:00Z
---

## Current Focus

hypothesis: pdfjs-dist 5.5.207 calls Map.prototype.getOrInsertComputed (TC39 upsert proposal, landed in Chrome 136+) extensively in both pdf.mjs (renderer thread) and pdf.worker.mjs (worker thread). Electron 35 uses Chromium 134, which does NOT have this API. The method is called at page.render() time via PDFPageProxy.#methodPromises.getOrInsertComputed() — confirmed at pdf.mjs line 15511.
test: grep confirms 9 call sites in pdf.mjs, 6 in pdf.worker.mjs; Node.js v24 also lacks the method (returns undefined). pdfjs-dist 5.4.624 has zero occurrences — safe downgrade exists.
expecting: polyfilling Map.prototype.getOrInsertComputed in both renderer context (pdf-setup.ts) and worker blob wrapper will fix rendering without requiring a package downgrade
next_action: Add Map.prototype.getOrInsertComputed polyfill to pdf-setup.ts (renderer context) and to the polyfillScript string (worker context)

## Symptoms

expected: User selects a PDF file and it loads successfully for rendering
actual: PDF fails to load with error "Setting up fake worker failed: Failed to fetch dynamically imported module: blob:http://localhost:5174/..."
errors:
  - "Refused to create a worker from 'blob:http://localhost:5174/...' because it violates the following Content Security Policy directive: 'script-src self'. Note that 'worker-src' was not explicitly set, so 'script-src' is used as a fallback."
  - "Warning: Setting up fake worker."
  - "Refused to load the script 'blob:http://localhost:5174/...' because it violates the following Content Security Policy directive: 'script-src self'. Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback."
  - "Error: Setting up fake worker failed: Failed to fetch dynamically imported module: blob:http://localhost:5174/9e770358-3aec-4f7a-83b8-efa6f8626694"
reproduction: Open app in dev mode, click to open PDF, select any PDF file
started: Observed in current dev session

## Eliminated

- hypothesis: Worker file itself is missing or not served
  evidence: App logs confirm the real worker URL resolves correctly to http://localhost:5174/@fs/.../pdf.worker.mjs — the file is accessible. The problem is the blob: wrapper URL being blocked, not the underlying file.
  timestamp: 2026-03-25

- hypothesis: Moving polyfills to renderer context is sufficient (no blob wrapper needed)
  evidence: Worker calls Uint8Array.prototype.toHex at line 59575 and Uint8Array.fromBase64 at line 46916 of pdf.worker.mjs. Worker has its own JS global scope — renderer prototype extensions do not propagate to it. Error confirmed in checkpoint: hashOriginal.toHex is not a function in the worker.
  timestamp: 2026-03-25

## Evidence

- timestamp: 2026-03-25
  checked: src/renderer/src/lib/pdf-setup.ts lines 1-46
  found: |
    Line 2: imports pdf.worker.mjs with ?url Vite query — resolves to a direct file URL
    Line 5: makes that URL absolute — workerUrl is valid direct URL to the worker file
    Lines 11-39: builds a polyfillScript string that imports the real worker
    Line 41: wraps polyfillScript in a Blob
    Line 42: sets GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob) — a blob: URL
  implication: PDF.js is told to load a worker from a blob: URL. The CSP blocks this.

- timestamp: 2026-03-25
  checked: src/renderer/index.html lines 7-10
  found: |
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:">
    No worker-src directive. No blob: allowance in script-src.
  implication: |
    When worker-src is absent, the browser falls back to script-src as the governing directive.
    script-src 'self' allows only same-origin scripts — blob: URLs are not same-origin.
    Result: the worker creation is refused. PDF.js falls back to a "fake worker" (runs on main thread),
    which then also tries to import the blob: URL as a module, which is also refused.
    End result: PDF.js cannot initialize any worker, rendering fails entirely.

- timestamp: 2026-03-25
  checked: Uint8Array.prototype.toHex / toBase64 / fromBase64 availability
  found: |
    These polyfills were the reason for the blob wrapper — injecting them into the worker context
    before the real worker script runs. However, they can also be injected in the main renderer
    thread context (which they already need to be, for pdfjs-dist usage in the renderer itself).
    Electron 35 / Chromium 134 should have these natively (added in Chrome 129), but even if
    not, injecting them in the main thread is sufficient — PDF.js uses them in worker context
    only if the worker shares the same global, which it does not for a real Worker thread.
  implication: |
    This was incorrect — the worker does NOT share the renderer global. Worker threads have their
    own global scope. The polyfill MUST be injected into the worker context to work.

- timestamp: 2026-03-25
  checked: pdf.worker.mjs lines 59566-59575 and 56225-56289 and 46916
  found: |
    Line 56289: calculateMD5() returns `new Uint8Array([...16 bytes...])`
    Line 59575: hashOriginal.toHex() is called on that Uint8Array result
    Line 46916: Uint8Array.fromBase64(this[$content]) is also called (static method)
    Both Uint8Array.prototype.toHex and Uint8Array.fromBase64 are Chrome 129+ platform APIs.
    Electron 35.7.5 is installed (Chromium 134) but these APIs may not be available in worker context,
    or the worker global differs from renderer global. Either way, polyfills must run in worker context.
  implication: |
    The blob wrapper approach was architecturally correct. The error was that worker-src in the CSP
    had no blob: allowance. Fix: restore blob wrapper AND add blob: to worker-src CSP.

- timestamp: 2026-03-25
  checked: src/renderer/index.html current CSP
  found: |
    content="default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:"
    worker-src is now 'self' only — blob: is not included.
  implication: |
    Adding blob: to worker-src will allow the blob wrapper worker to load.

- timestamp: 2026-03-26
  checked: pdf.mjs and pdf.worker.mjs for getOrInsertComputed
  found: |
    pdf.mjs: 9 call sites (lines 7103, 9301, 11088, 13976, 14877, 14985, 15511, 15974, 19734)
    pdf.worker.mjs: 6 call sites (lines 1714, 40021, 42354, 42806, 52325, 59784)
    First hit during render: pdf.mjs line 15511 — PDFPageProxy.#methodPromises.getOrInsertComputed()
    Node.js v24 also returns `undefined` for new Map().getOrInsertComputed — confirms not in V8/Chromium 134
    pdfjs-dist 5.4.624 has 0 occurrences — safe downgrade exists but polyfill preferred
  implication: Must polyfill Map.prototype.getOrInsertComputed in both renderer and worker contexts.

- timestamp: 2026-03-26
  checked: pdfjs-dist types/src/display/api.d.ts RenderParameters type
  found: |
    In 5.5.x, `canvas: HTMLCanvasElement | null` is now required.
    `canvasContext` is now optional (backwards-compat).
    usePdfRenderer.ts was calling page.render({ canvasContext, viewport, transform }) — TypeScript error TS2345.
  implication: Must update render call to pass `canvas` instead of `canvasContext`.

## Resolution

root_cause: |
  Three-stage failure chain (all within pdfjs-dist 5.5.207 compatibility with Electron 35 / Chromium 134):
  Stage 1 (fixed in prior session): blob: worker URL blocked by CSP. Fixed by adding blob: to worker-src.
  Stage 2 (fixed in prior session): Worker thread lacks Uint8Array.prototype.toHex / fromBase64 (Chrome 129+
  APIs). Fixed by polyfilling these in the blob wrapper before importing pdf.worker.mjs.
  Stage 3 (current): pdfjs-dist 5.5.207 uses Map.prototype.getOrInsertComputed (TC39 upsert proposal,
  added in Chrome 136+) in 9 places in pdf.mjs (renderer thread) and 6 places in pdf.worker.mjs.
  Electron 35 uses Chromium 134 — this API does not exist. Error surfaces when page.render() is called
  because PDFPageProxy.#methodPromises.getOrInsertComputed() is the first hit (pdf.mjs line 15511).
  Additionally, pdfjs-dist 5.5.x changed RenderParameters: `canvas` (HTMLCanvasElement) is now required;
  `canvasContext` is deprecated. usePdfRenderer.ts was passing canvasContext only, which TypeScript also
  flagged as an error.

fix: |
  Two changes in this session:
  1. src/renderer/src/lib/pdf-setup.ts — added Map.prototype.getOrInsertComputed polyfill in both:
     a) the blob wrapper polyfillScript string (worker context)
     b) the renderer context block (before pdfjsLib operations run)
  2. src/renderer/src/hooks/usePdfRenderer.ts — updated page.render() call to pass `canvas` property
     instead of `canvasContext`, matching the new pdfjs-dist 5.5.x RenderParameters API.

verification: |
  - TypeScript compilation: zero errors in pdf-setup.ts and usePdfRenderer.ts after changes.
  - Map.prototype.getOrInsertComputed polyfill is semantically correct: checks has(), calls callbackFn(key),
    sets and returns the result — matching the TC39 upsert proposal spec.
  - Polyfill guards (if !('getOrInsertComputed' in Map.prototype)) ensure no-op if Chrome ever adds it natively.
  Awaiting human confirmation that PDF now renders on screen.
files_changed:
  - src/renderer/src/lib/pdf-setup.ts
  - src/renderer/index.html
  - src/renderer/src/hooks/usePdfRenderer.ts
