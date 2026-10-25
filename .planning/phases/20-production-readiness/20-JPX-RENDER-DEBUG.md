# Phase 20: JPEG2000 scan rendering investigation

Continuation of GSD 20-09-03 execution/debug, 26 October 2026 (Asia/Manila).
Francis authorized rebuilding fixes and continuing second-PC tests. This record
does not close Phase 20 or approve distribution.

## Reproduced failure in installed 1.1.1

On LAPTOP-5BAM24NM, the complete USDA farmhouse 7213 PDF opens but pages 3 and 4
remain white, including a further observation after 31.623 seconds. Navigation
and rendering promises complete without a visible error. Native captures
139–142 and the saved `usda-blank111.clmc` preserve this failure in
`.planning/tmp/20-completion-20261026/owner-display/`.

- Installer SHA256: `f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e`.
- ASAR SHA256: `b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98`.
- Four-page source PDF SHA256: `13788ecf41653481d2ee0884d5443c52ddec0281dc05e07283988db3a2bf2d78`.
- Pages 3 and 4 contain genuine 6582 × 5111 JPEG2000 images. Independent Poppler
  reference images show the elevations and floor plan.

The 1.1.1 installed evidence is frozen in `20-1.1.1-INSTALLED-EVIDENCE.json`:
5 passes, 1 first-release upgrade N/A, 1 failed large-scan case and 9 pending
cases. The old installer, manifest, smoke report, package/lock/notes and evidence
were copied and hash-verified under
`.planning/tmp/20-completion-20261026/frozen-1.1.1/` before rebuilding.

## Cause confirmed with unchanged packaged dependencies

PDF.js 5.5.207 decoder files already exist inside the ASAR. All three document
loading paths omit `wasmUrl`; the renderer has no configured local decoder base.
PDF.js reports an unconfigured WASM URL and an unresolved JavaScript fallback,
then silently omits the image. A resolved render promise is insufficient proof
that a scanned plan was drawn.

Independent Node A/B results using those exact packaged files are under
`owner-display/jpx-decoder-repro/`. A sandboxed Electron 44.9.3 browser/real-worker
A/B under `owner-display/jpx-debug/browser-results.json` confirms the second
necessary change:

| Unchanged packaged assets and USDA page 4 | Result |
| --- | --- |
| No decoder URL; original CSP | White canvas, 0 dark pixels, OpenJPEG warnings |
| Correct local decoder URL; original CSP | WASM CSP CompileError; 45-second probe deadline exceeded |
| Correct local URL; `script-src 'self' 'wasm-unsafe-eval'` | Floor plan rendered, 13,497 dark pixels, no decoder diagnostics, approximately 4.33 seconds |

The browser probe is isolated from production app/profile state. Its elapsed
times describe this probe, not an installed-app performance benchmark. Broad
JavaScript `unsafe-eval` permission is unnecessary.

## Fix and acceptance boundary

Implement one shared document option source for all PDF opens and project
rehydration, package PDF.js decoder files and their accompanying licenses at a
renderer-local URL, and permit only WASM evaluation in the renderer CSP.
Artifact inspection must reject missing or changed decoder/license assets and
broad JavaScript evaluation permission. Add a real JPEG2000 fixture and verify
visible pixels rather than successful promises alone.

The changed application will use a new candidate version, 1.1.2. Old installed
passes retain their original candidate identity. The USDA scan needs a new
installed-app retest before the defect can be marked resolved. Other pending
Phase 20 requirements remain pending until their own evidence is complete.

Original user state is safe: the test app and Settings were closed, and all
3,191 original profile files were restored and hash-verified at
2026-10-25T18:32:53.9252882Z. See `owner-display/profile-restored.json`.

## Rejected packaging attempt A

The first uninstalled 1.1.2 build was rejected by the actual archive inspector:
all ten decoder/fallback/license resources were missing at the configured flat
renderer URL. The installed copy plugin v4 preserves source directory structure
by default, so the output was under
`pdfjs/wasm/node_modules/pdfjs-dist/wasm/`. Packaging subsequently excluded that
nested dependency directory. This was a path-layout error, not a license-only
filter. A separate hidden renderer probe also reproduced blank pixels and empty
WASM/fallback loads from this rejected archive.

Attempt A installer SHA256:
`7b08ab07e365780cfe0f7111ce3f29cf141bfa3d81934e629532de3bdc8e9667`;
ASAR SHA256:
`56040d08567bd6b363f4c702db9d93b0a5f2378975416f16299b0b90a59bc97d`.
Those bytes, config, inspection log and probe failures are retained under
`candidate-1.1.2/packaging-attempt-A/` and `owner-display/jpx-debug/packaged-1.1.2/`.
It was never installed or approved. The same unreleased version is being rebuilt
with an explicit flat-copy option; final acceptance will bind only to the new
inspected hashes. No installer-builder exclusion or permission needs weakening.

Before attempt A packaging, the full source suite passed 1,257/1,257 tests across
159 files with four workers and `NODE_OPTIONS=--no-experimental-webstorage`.
The initial concurrent default-worker run had five release-inspection test
timeouts; both logs are retained. Assertions and test deadlines were unchanged
for the passing full run. A real copy-layout regression and new packaged/native
checks remain required after the path correction.

Status: packaging correction and regression verification in progress; release
remains unapproved.
