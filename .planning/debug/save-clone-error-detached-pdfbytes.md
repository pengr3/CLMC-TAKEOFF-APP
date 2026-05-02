---
status: resolved
trigger: "Ctrl+S during Phase 4.1 UAT Test 1 throws 'An object could not be cloned.' at writeSnapshotToPath (useProject.ts:113). Save fails on every v2 path."
created: 2026-05-02T10:36:00Z
updated: 2026-05-02T10:57:00Z
---

## Current Focus

hypothesis: CONFIRMED. `pdfjsLib.getDocument({ data: u8 })` in `src/renderer/src/hooks/usePdfDocument.ts:24` transfers ownership of the underlying ArrayBuffer to the PDF.js worker. After that call, `u8` is detached (byteLength=0). The same `u8` is then stored in `useViewerStore.pdfBytes` at line 27. On Ctrl+S, `useProject.ts:113` calls `await window.api.hashBuffer(pdfBytes)`; ipcRenderer.invoke runs the structured-clone algorithm on the detached buffer and throws "An object could not be cloned".
test: New regression test `src/tests/pdf-loader-detached-buffer.test.ts` mocks `pdfjsLib.getDocument` to detach the input buffer (mirroring real PDF.js worker transfer). Without the fix, the test reports `byteLength=0` (detached). With the defensive copy, `byteLength=8` (intact). Test was confirmed to fail without the fix and pass with it before commit.
expecting: Save flow now completes end-to-end on a real PDF. UAT Test 1 (and all other save-dependent tests 2-5) should proceed.
next_action: Resolved. User runs `npm run dev` and retries UAT Test 1.

## Symptoms

expected: Ctrl+S writes the .clmc file with embedded PDF bytes. No errors.
actual: Save fails. Console shows two stack traces — `[useProject] save failed: Error: An object could not be cloned.` originating at `writeSnapshotToPath (useProject.ts:113:42)` (the `await window.api.hashBuffer(pdfBytes)` call).
errors:
  - "Error: An object could not be cloned." (twice)
  - React warning (unrelated, pre-existing): "Cannot update a component (Toolbar) while rendering a different component (CanvasViewport)"
reproduction: Open any real PDF (~3 MB observed), set scale, place markups, Ctrl+S, choose path. Bug fires on every v2 save path because all three load paths funnel through `loadPdf`.
timeline: Introduced in Phase 4.1 — `setPdfBytes(u8)` cache was added in Wave 3 (`useViewerStore.pdfBytes` field) and consumed in Wave 4 (`writeSnapshotToPath`). Pre-Phase-4.1 saves did not need to send PDF bytes via IPC.

## Resolution

root_cause: |
  PDF.js's `getDocument({ data })` claims ownership of the input ArrayBuffer
  via worker `postMessage` transfer. Any later attempt to read or structured-
  clone the original Uint8Array throws because the underlying buffer is
  detached. The Phase 4.1 cache pattern (`setPdfBytes(u8)` *after* the
  getDocument call) stored the now-detached view, breaking save.

fix: |
  src/renderer/src/hooks/usePdfDocument.ts:24 — pass a throwaway copy to
  PDF.js so the original `u8` stays intact for the store cache:
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(u8) }).promise
  One-line change. The copy costs O(N) memory once per PDF load
  (~3 MB on the reported test PDF, ~50 MB on a large construction set —
  trivial on a desktop machine).

verification: |
  - New regression test src/tests/pdf-loader-detached-buffer.test.ts
    asserts viewerStore.pdfBytes.byteLength is non-zero after loadPdf,
    using a mocked getDocument that simulates worker transfer.
  - Test was confirmed to FAIL (byteLength=0) without the fix and PASS
    (byteLength=8) with it before this fix shipped.
  - Full vitest suite: 285/285 passing (was 284, now +1).
  - TypeScript: clean.

files_changed:
  - src/renderer/src/hooks/usePdfDocument.ts
  - src/tests/pdf-loader-detached-buffer.test.ts (new)

## Notes

A separate React warning was visible in the same console — `Cannot update a
component (Toolbar) while rendering a different component (CanvasViewport)`.
That is a setState-in-render in CanvasViewport (likely on tool/scale change)
and is independent of the save bug. Tracking separately if needed.
