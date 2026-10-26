# Phase 20: JPEG2000 scan rendering investigation

<!-- current-1.1.5-start -->

## Current candidate — 1.1.5

Exact 1.1.5 has **2 complete cases passed, 12 pending, 0 failed, one first-release case not applicable and one reviewed hardware limitation (200%)**. Phase 20 remains VERIFYING; 20-09-03 and all four REL reviews remain open. Phase 21 and distribution remain gated.

Installed curved-outline, curved-line and wall tooltip calculations pass their targeted regressions. Physical 150% calculation and save/readback subsets also pass. Complete display, recovery, offline, public-plan and keyboard/overflow cases still require their remaining checks.

The PC session is safely closed. All 3191 original profile files and hashes are restored; the complete disposable profile is preserved separately. CLMC is closed. D1 remains at 125% and D2 is restored to 100%. No further hands-on action is requested from Francis for this session.

The 18-file UNAPPROVED review packet is copied and independently hash-verified in Francis's specified Releases/1.1.5 folder. Its new directories have the same local protection as 1.1.4. Cloud sharing permissions and final release approval remain unverified.

See [current retest](20-1.1.5-RETEST.md) and [canonical evidence](20-INSTALLED-EVIDENCE.json). Earlier sections retain dated historical candidate results.
<!-- current-1.1.5-end -->

<!-- current-1.1.4-start -->

## Historical 1.1.4 regression result

The full original USDA JPX pages 3/4 render positively in installed 1.1.4. Native 133–172 record calibration, registration at 25%/800%, navigation and actual save/reopen, with independent full-PDF/CRC/geometry readback. The complete scan case still requires independent second-distance accuracy and actual pan. See [current retest](20-1.1.4-RETEST.md). Earlier blank failures and repair stages below are retained history.

<!-- current-1.1.4-end -->

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

| Unchanged packaged assets and USDA page 4                 | Result                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| No decoder URL; original CSP                              | White canvas, 0 dark pixels, OpenJPEG warnings                                              |
| Correct local decoder URL; original CSP                   | WASM CSP CompileError; 45-second probe deadline exceeded                                    |
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

## Rejected packaging attempt B and corrected build coverage

Attempt B's `stripBase` copy option passed an initial integration test that used
the repository root. The real Electron renderer root is `src/renderer`; the
copy plugin strips leading parent segments for one path computation and counts
them for another, so the real build emitted the assets at the renderer root
instead of `pdfjs/wasm/`. Actual archive inspection again rejected all ten
required paths. Attempt B, its config and hashes are preserved separately under
`candidate-1.1.2/packaging-attempt-B/`; it was never installed.

The corrected regression resolves Electron Vite's actual presets and asserts
the real renderer root. It reproduced the absent target directory before the
fix. The decoder build step now uses Vite's asset emission with explicit output
filenames, avoiding the copy plugin's path calculations. Development serves
only ten fixed, preloaded resources at those same URLs, with exact bytes and
GET/HEAD handling; a URL never becomes a filesystem path. Both actual-root
build output and a real development server are checked against dependency
bytes. The runtime loader and CSP changes remain unchanged.

The new build integration case has an explicit 20-second deadline because it
starts Vite and its plugins (the first solo run already took 4.17 seconds).
A concurrent packaging/full-suite run exceeded the initial new test's default
5-second deadline; its log records 1,257 existing tests passing and this one
timeout. Existing test deadlines and pixel/path/byte assertions were unchanged.
The corrected tests passed 31/31 targeted checks; final production staging,
packaged rendering and installed retesting remain required.

## Final candidate C: source, package and isolated renderer verification

The final unsigned internal-use candidate is CLMC Takeoff 1.1.2, built from
source commit `cd9016f4df26e56a02e7f1a069c151aaa61c4b25`. Its identities are:

- Installer: `clmc-takeoff-1.1.2-x64-setup.exe`, 137,026,296 bytes, SHA256
  `b2d27d0e75d18d1f66df839a0552faf90b17cb14275d78330ac3766f0baadec6`.
- ASAR SHA256:
  `084f96aef0b4e27ad746712efd4fca793554b82c8b0e7642bccda2d93f119416`.
- Executable SHA256:
  `eef635f4a4d1c8f2b3e32d3656bc3ac2cabf3584159085b6d26e57ebe61b18ee`.

`candidate-1.1.2/source-verification.json` and
`full-tests-resolved-layout.log` record 1,259/1,259 passing tests across 160
files, with four workers and `NODE_OPTIONS=--no-experimental-webstorage`.
The two new real Vite build/server integration cases retain their explicit
20-second deadlines; existing deadlines and pixel/path/byte assertions remain
unchanged. Both TypeScript configurations pass. Targeted lint has zero errors
and the six existing `useProject` hook warnings; this is not a claim that the
whole repository is free of historical lint errors.

Actual `npm run build` output contains exactly the ten expected decoder,
fallback and accompanying license files at `out/renderer/pdfjs/wasm/`, with
byte identity to the supplied dependency. The inventory is
`owner-display/jpx-debug/prepack-emitted-inventory.json`.
`candidate-1.1.2/release-inspection-attempt-C.log` and `dist/release-manifest.json`
record a passing final installer/ASAR inspection, including the required local
resources, narrow CSP and 108 production dependencies. The rejected A/B hashes
and raw failures above remain historical evidence and were never installed.

The isolated final-ASAR browser/real-worker probe also passes all four actual
content controls, using the packaged renderer decoder URL and CSP:

| Control                                | Nonwhite pixels | Additional content evidence     |
| -------------------------------------- | --------------: | ------------------------------- |
| USDA page 3                            |         483,657 | 16,922 dark pixels              |
| USDA page 4                            |         483,657 | 13,497 dark pixels              |
| Original tiny JPX, WASM                |          16,384 | 4,096 red and 4,096 blue pixels |
| Original tiny JPX, JavaScript fallback |          16,384 | 4,096 red and 4,096 blue pixels |

All four diagnostic arrays are empty. All 19 recorded requests are file URLs,
with zero HTTP(S) attempts. Raw JSON, request logs and PNGs are preserved under
`owner-display/jpx-debug/packaged-attempt-C/`. This isolated renderer uses the
pure source URL helper separately and never loads production main/profile;
it is supplemented by the actual installed-app evidence below.

`candidate-1.1.2/packaged-smoke-final-C.json` separately passes the scripted
packaged host checks for Electron 44.9.3, sandboxing, local notes/worker,
vector-PDF rendering, format-3 save/read/adoption, import utility process and
internal XLSX/CSV output, with no external network requests. Its destinations
were scripted, so this smoke alone is not native dialog, physical display or
representative-plan acceptance.

## Installed 1.1.2 JPEG2000 regression and preservation witness

`candidate-1.1.2/fresh-install.json` records installer exit 0 and all 149
installed payload files matching the inspected candidate. The original profile
was preserved separately before this disposable fresh test installation; this
record does not claim an actual deployed-predecessor upgrade. Native capture
`004-about-notes-loaded` shows version 1.1.2 and the local scan-decoder notes.

The actual installed app now draws both previously blank USDA scan pages.
Capture `012-usda-page4-native-render` shows the floor plan; the parent recorded
an approximately 6,687 ms request-to-visible observation upper bound. This is
not instrumented first-paint timing: the post-request capture timestamps
`011` to `012` span 6,172 ms and start after the request action. Capture `013`
shows Fit at 69%; `014`/`015` show page 3 and its elevations; `016` returns to
page 4. These observations bind to the complete original four-page PDF, not an
extracted single-page substitute.

Native `022` places one Count named `Scan registration pin` at the short wall-end
vicinity above ENTRY. Capture `025` shows it at Fit; `033` shows it at 800%;
`038` has the clean first-save title. Actual reopen/adoption is capture `042`,
showing the same one pin and complete page at Fit 69%. Its title is dirty after
refitting and is not claimed as a clean reopen. Capture
`044-usda-saved-before-transfer` separately records the clean refit-save title.
These native artifacts are under `candidate-1.1.2/native/`.

The first native save was copied before later mutable saves into
`native/usda-first-save.clmc`: 23,507,320 bytes, SHA256
`ef1db9cc03dcc6a8a1be145bfb5a34cf5f7f716cb8b79ba4ed74f7289e1326f3`.
Independent `usda-first-save-readback.json` verifies both ZIP CRCs, the exact
original embedded PDF hash and all four actual pages, exactly one Count on
page 4, null calibration on all pages and empty rates. The original generated
blank wrapper remains SHA256
`51ced04dac0e0e3f9415a4b8627aec5cd9219e41a2ebc56a4418979a6ba4f64f`.

The saved point `(745.8309859154933, 584.2206572769956)` and viewport
`zoom=8, panX=-5542, panY=-4458`, with stage origin `(56,111)`, predict a screen
center `(480.64788732394663,326.7652582159644)`. The identical red-pixel bounds
in captures `033` and `038` center at `(480,327.5)`, within one screen pixel per
axis of that prediction. Fit captures `025` and `042` likewise have identical
pin bounds. An independently decoded, unannotated source-JPX crop shows the
same wall-end vicinity. This is registration/preservation evidence, not a
claim of precise landmark targeting or physical dimension accuracy. Details,
pixel bounds and scope are in `native/usda-first-save-readback.json` and
`native/usda-first-save-readback.md`.

Status: the specific JPEG2000 blank-render defect is resolved with an installed
1.1.2 regression verified. The complete large-scanned-plan acceptance case
remains pending: this witness does not establish calibrated metric accuracy,
interactive panning coverage, scan stress/cache bounds or human
representative/as-built approval. Phase 20 and release distribution remain
unapproved pending their separate requirements.
