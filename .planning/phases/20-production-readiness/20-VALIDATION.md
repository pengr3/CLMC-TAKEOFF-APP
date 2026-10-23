---
phase: "20"
slug: "production-readiness"
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-21"
---

# Phase 20 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest 4.1.1; node default with per-file DOM environments |
| Config | vitest.config.ts; src/tests/**/*.test.ts |
| Quick command | `npx vitest run src/tests/project-io.test.ts src/tests/atomic-write.test.ts src/tests/cost-library-apply.test.ts --reporter=dot` |
| Full suite | `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot` |
| Types | `npm run typecheck` |
| Windows candidate | `npm run build:win` |
| Runtime | Final157 files/1228 tests passed420.92sec at e61ae4a; failed sandbox discovery excluded |

## Sampling Rate

- After each implementation task, run its focused suites and relevant typecheck.
- After each wave, run full Vitest and `npm run typecheck`.
- After runtime, packaging or worker changes, build and inspect a Windows candidate.
- Target focused feedback under 30 seconds; measure first, split expensive suites if needed. No measured latency is claimed yet.
- Before verification, require green automated checks plus recorded installed-app checks; external evidence cannot be replaced by mocked tests.

## Per-Task Verification Map

Exact task ownership below. Every new test is created by the listed task before that task verifies it; reused suites depend on the earlier owning task/plan. Automated entries below were audited against the completed implementation and final full suite at source e61ae4a; actual installed-PC acceptance remains pending. Each task also has a concrete fails_when gate: nonzero, no-tests, unexecuted/infrastructure failure or violated behavioral invariant cannot pass.

| Task ID | Wave | Requirement | Behavior / threat | Automated verification (focused entry; full task commands in PLAN) | Status |
|---|---|---|---|---|---|
| 20-01-01 | 1 | REL-03, REL-04 | Real coherent save/reopen, writer serialization, captured revision | `npx vitest run src/tests/project-save-flow.test.ts` | Passed — final full suite |
| 20-01-02 | 1 | REL-04 | Failure stages preserve original/backup; validated backup discovery | `npx vitest run src/tests/atomic-write.test.ts src/tests/project-save-flow.test.ts src/tests/boq-export-ipc.test.ts` | Passed — final full suite |
| 20-01-03 | 1 | REL-04 | UI-02 busy/error/long path/focus and close guards | `npx vitest run src/tests/save-protection-ui.test.ts src/tests/title-bar-dirty.test.ts src/tests/title-bar-saving.test.ts src/tests/project-shortcuts.test.ts` | Passed — final full suite |
| 20-02-01 | 2 | REL-05 | Measured Estimate→actual writers money invariant | `npx vitest run src/tests/rate-unit-invariance.test.ts src/tests/estimate-row-edit.test.ts src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` | Passed — final full suite |
| 20-02-02 | 2 | REL-03, REL-05 | Explicit basis/application/legacy state roundtrip | `npx vitest run src/tests/rate-basis-roundtrip.test.ts src/tests/cost-library-apply.test.ts src/tests/project-serialize.test.ts src/tests/rates-proto-hydrate.test.ts` | Passed — final full suite |
| 20-02-03 | 2 | REL-05 | All type/unit/operation and invalid basis cases | `npx vitest run src/tests/rate-unit-invariance.test.ts src/tests/rate-basis-operations.test.ts src/tests/rate-basis-roundtrip.test.ts src/tests/project-schema.test.ts` | Passed — final full suite |
| 20-04-01 | 2 | REL-01 | Authoritative bridge/title version, no guessed state | `npx vitest run src/tests/app-version.test.ts src/tests/title-bar-dirty.test.ts src/tests/title-bar-saving.test.ts` | Passed — final full suite |
| 20-04-02 | 2 | REL-01, REL-04 | UI-01 notes/Menu/About keyboard/overflow | `npx vitest run src/tests/about-release-notes.test.ts src/tests/top-action-bar-nav.test.ts src/tests/app-version.test.ts` | Passed — final full suite |
| 20-08-01 | 2 | REL-05 | Cache/DPR/clamping/canvas pointer tracer | `npx vitest run src/tests/pdf-cache-dpi.test.ts src/tests/stage-transform.test.ts src/tests/zoom.test.ts src/tests/pdf-loader-detached-buffer.test.ts` | Passed — final full suite |
| 20-08-02 | 2 | REL-05 | Navigation memory plateau, known coordinates, dialog reclamping | `npx vitest run src/tests/dialog-viewport.test.ts src/tests/coordinate-dpi-invariance.test.ts src/tests/pdf-cache-dpi.test.ts src/tests/use-draggable.test.ts` | Passed — final full suite |
| 20-05-01 | 3 | REL-01, REL-02 | Stable storage/identity and trusted sender | `npx vitest run src/tests/identity-storage.test.ts src/tests/cost-library-store.test.ts src/tests/project-save-flow.test.ts` | Passed — final full suite |
| 20-05-02 | 3 | REL-02 | Official package support/source/scripts before install | Evidence file existence check plus official registry/lifecycle review; conditional blocking-human gate if findings remain ASSUMED/SUS | Passed — exact44.9.3 approved D-05; official registry/lifecycle review recorded |
| 20-05-03 | 3 | REL-01, REL-02 | Reviewed runtime/sandbox/preload/navigation | `npx vitest run src/tests/host-security.test.ts src/tests/identity-storage.test.ts`; `npm run build`; actual Electron smoke | Passed — final full suite |
| 20-03-01 | 4 | REL-03, REL-04 | Real never-saved PDF recovery across restart | `npx vitest run src/tests/recovery-flow.test.ts` | Passed — final full suite |
| 20-03-02 | 4 | REL-04 | Bounded completed candidates, corruption, deletion, interruption | `npx vitest run src/tests/recovery-repository.test.ts src/tests/recovery-flow.test.ts` | Passed — final full suite |
| 20-03-03 | 4 | REL-03, REL-04 | All UI-03 states, saved/never-saved/keep/discard | `npx vitest run src/tests/recovery-ui.test.ts src/tests/recovery-flow.test.ts src/tests/recovery-repository.test.ts` | Passed — final full suite |
| 20-06-01 | 4 | REL-02, REL-05 | Real child parse/kill/crash and explicit commit | `npx vitest run src/tests/cost-library-worker.test.ts src/tests/cost-library-ipc.test.ts` | Passed — final full suite |
| 20-06-02 | 4 | REL-02, REL-05 | Actual streamed ZIP limits and measured valid max template | `npx vitest run src/tests/workbook-admission.test.ts src/tests/cost-library-worker.test.ts src/tests/cost-library.test.ts` | Passed — final full suite |
| 20-06-03 | 4 | REL-05 | All UI-05 import states/retry/library preservation | `npx vitest run src/tests/cost-library-resilience-ui.test.ts src/tests/cost-library-ui.test.ts src/tests/cost-library-apply.test.ts` | Passed — final full suite |
| 20-07-01 | 5 | REL-03, REL-04 | Real portable archive/schema/migration; active-state preservation | `npx vitest run src/tests/project-portability-integration.test.ts src/tests/project-io.test.ts src/tests/project-serialize.test.ts src/tests/project-order-roundtrip.test.ts src/tests/v1-migration-pdfbytes.test.ts` | Passed — final full suite |
| 20-07-02 | 5 | REL-05 | All UI-04 review states and every export/unit guard | `npx vitest run src/tests/legacy-rate-review.test.ts src/tests/use-export-hook.test.ts src/tests/use-keyboard-shortcuts-export.test.ts src/tests/scale-store.test.ts` | Passed — final full suite |
| 20-07-03 | 5 | REL-03, REL-04 | Safe upgraded copy/backup/future format UX | `npx vitest run src/tests/project-compatibility-ui.test.ts src/tests/project-open-flow.test.ts src/tests/project-save-flow.test.ts src/tests/open-error-modal-copy.test.ts` | Passed — final full suite |
| 20-09-01 | 6 | REL-01, REL-02, REL-05 | Actual NSIS/asar payload/hash/worker inspection | `npx vitest run src/tests/release-artifact.test.ts`; `npm run build:win`; `node scripts/verify-release.cjs dist` | Passed — final full suite |
| 20-09-02 | 6 | REL-01..05 | Truthful pending evidence, rollback/manual-release matrix | `npx vitest run src/tests/release-evidence.test.ts` | Passed — final full suite |
| 20-09-03 | 6 | REL-01..05 | Actual installed non-dev-PC required cases | `node scripts/verify-release-evidence.cjs .planning/phases/20-production-readiness/20-INSTALLED-EVIDENCE.json dist/release-manifest.json` plus actual installed evidence | Pending — external installed-PC evidence gate |

UI consideration mapping: UI-01's four criteria → 20-04-01/02; UI-02's four → 20-01-03; UI-03's eight → 20-03-01/02/03; UI-04's eight → 20-07-02/03; UI-05's eight → 20-06-03. All 32 are lifted verbatim with IDs into the relevant plan must_haves. Cross-cutting typography/color/spacing/focus/scroll/DPI is implemented in those tasks plus 20-08-02 and actually inspected in 20-09-03.

Edge review: REL-03 concurrency resolves through 20-01-01/02 and 20-03-01/02. REL-01/02/04/05 remain explicitly unclassified flagged manual-review assumptions in 20-09 must_haves. Three descriptor-less task-specific prohibitions remain flagged-unverified; routine canon security candidates were dropped to ASVS review. No automatic pass is claimed.

## Wave 0 Requirements

- Reuse existing Vitest; no extra test framework.
- Extend atomic-save tests with lock/permission/disk-full/interruption/backup and stale-revision cases.
- Add saved/never-saved recovery restart/restore/discard and corrupt or missing embedded-PDF cases.
- Add actual archive+store integration including rate basis, ordering, source-PDF absence and legacy migration.
- Add unit-basis invariants for linear/perimeter/area/wall/count across display-unit changes and reopen.
- Add bounded ZIP preflight, parser timeout/crash and unchanged-library integration fixtures.
- Add package-content/identity/version assertion tool and installed-evidence template.
- Planner assigns actual new files to their owning plan; no missing test path may be treated as a passing command.

## Manual-Only Verifications

| Behavior | Requirement | Evidence required |
|---|---|---|
| Fresh installation and predecessor-to-candidate upgrade | REL-01, REL-02 | Non-development PC; installer hash/version, Windows/architecture; standard-user launch; one app/shortcut; preserved projects/library |
| Copy only .clmc | REL-03 | Non-development PC without source PDF/local library; verify PDF, scales, geometry, prices and ordering |
| Saved/never-saved interruption recovery | REL-04 | Controlled throwaway fixtures; restart recovery; valid original/backup retained; restore/discard behavior |
| Offline full workflow | REL-05 | PDF → calibration → markup → Estimate → internal XLSX/CSV with expected/actual numeric values |
| Large/multipage PDFs and display scaling | REL-05 | Vector/scanned/multipage fixtures with file sizes/pages; memory/navigation observations; 100/125/150/200% where supported; known dimensions/area, pan/zoom/reopen and monitor transition |

Record candidate hash, tester/date, machine details, fixture identity, expected/actual results and pass/fail/pending for every case. Phase 21 owns the real-user two-PC pilot, acceptance, and remaining-ten distribution.

## Validation Sign-Off

- [x] Exact task map finalized by planner (25 tasks, nine plans, six waves).
- [x] Every task has automated verification or an explicit human checkpoint; no three consecutive implementation tasks lack automated checks.
- [x] New test paths have creation dependencies; no watch commands.
- [x] Focused feedback latency measured; security153tests30.48s and45tests58.81s; final full suite420.92s; focus35tests29.21s.
- [x] Automated suites and package checks green; final inspected candidate and measured smoke pass.
- [ ] Installed non-development-PC evidence complete.
- [ ] `nyquist_compliant: true` set only after validation, never inferred from planning.

**Approval:** automated coverage audited; external installed acceptance pending.

## Validation Audit 2026-10-22

| Metric | Result |
|---|---|
| Planned tasks |25|
| Referenced test paths |52, all exist|
| Missing automated targets |0|
| Final full regression |157files /1228tests passed,420.92sec,exit0 at e61ae4a|
| Independent security probes |20files /198tests passed|
| External checkpoint |20-09-03 remains pending;16 required installed cases|

Cross-checked plan commands, summaries, actual source/test imports and converged review regressions. No new test scaffolding is needed: failure/restart/financial/geometry/parser/identity/evidence negative cases now run in the full suite. Additional actual two-process and Chromium geometry/keyboard checks passed. The unchanged whole-suite run includes prior-phase suites; no source change followed its successful result, so redundant reruns are avoided. nyquist_compliant remainsfalse because declared installed evidence is incomplete. No missing test, failed sandbox discovery, pending physical case or inferred approval is counted as a pass.

Final candidate refresh e61ae4a: both typechecks/build, full offline NSIS, actual package inspection and measured packaged smoke passed. Installerd3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180; ASARcf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45. Raw final full regression .planning/tmp/20-library-focus-full-regression.log:157files/1228tests,420.92sec,exit0. Earlier independent source68803dd run156files/1193tests476.42sec remains historical support, superseded by this final full run.

Actual installed manual core walkthrough and both manual fixes passed; detailed per-run provenance remains in20-MANUAL-TEST.md/20-MANUAL-EVIDENCE.json. Final149installed payload files match; original source/backup/library bytes are preserved. The16non-development cases remain pending, and the evidence validator must continue to reject incomplete release acceptance. Remaining native edge/long-content/failure/never-saved cases are not inferred from automated tests. nyquist_compliant remainsfalse.

## Additional installed manual checks — 2026-10-23

See20-MANUAL-EDGES.md and20-MANUAL-EDGES.json for actual never-saved recovery with absent source PDF, backup-lock failure/cancel/retry and detached backup Save As, synthetic legacy safeguards/upgraded copy, invalid/corrupt/oversized/10001-row library rejection and the third manual-discovered focus fix9a0349f. New candidate installer fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544, 136810568bytes; ASAR 5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd. Build/types, inspection, measured packaged smoke,149installed payload hashes and native corrected preview-cancel/Escape/Save As passed. Earlier observations retain e61 candidate provenance.

Regression qualification: initial full157files/1229tests had4failures and1225passes (806.37sec). Four-file isolated recheck passed3files/37tests, parser still failed; parser-only rerun passed2tests17.85sec. Every file has a passing result across runs; no single clean full run or confirmed cause for the intermittent parser failure is claimed. No expectation/deadline was relaxed. This stability limitation remains visible for review. External hardware, representative/historical construction PDFs, named reviews and Phase21 pilot/distribution remain pending.
