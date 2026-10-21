---
phase: "20"
slug: "production-readiness"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-21"
---

# Phase 20 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest 4.1.1; node default with per-file DOM environments |
| Config | vitest.config.ts; src/tests/**/*.test.ts |
| Quick command | `npx vitest run src/tests/project-io.test.ts src/tests/atomic-write.test.ts src/tests/cost-library-apply.test.ts --reporter=dot` |
| Full suite | `npx vitest run` |
| Types | `npm run typecheck` |
| Windows candidate | `npm run build:win` |
| Runtime | Measure during execution; research attempt failed before tests ran (EPERM realpath) |

## Sampling Rate

- After each implementation task, run its focused suites and relevant typecheck.
- After each wave, run full Vitest and `npm run typecheck`.
- After runtime, packaging or worker changes, build and inspect a Windows candidate.
- Target focused feedback under 30 seconds; measure first, split expensive suites if needed. No measured latency is claimed yet.
- Before verification, require green automated checks plus recorded installed-app checks; external evidence cannot be replaced by mocked tests.

## Per-Task Verification Map

Exact task ownership below. Every new test is created by the listed task before that task verifies it; reused suites depend on the earlier owning task/plan. All entries remain pending execution. Each task also has a concrete fails_when gate: nonzero, no-tests, unexecuted/infrastructure failure or violated behavioral invariant cannot pass.

| Task ID | Wave | Requirement | Behavior / threat | Automated verification (focused entry; full task commands in PLAN) | Status |
|---|---|---|---|---|---|
| 20-01-01 | 1 | REL-03, REL-04 | Real coherent save/reopen, writer serialization, captured revision | `npx vitest run src/tests/project-save-flow.test.ts` | Pending; creates suite |
| 20-01-02 | 1 | REL-04 | Failure stages preserve original/backup; validated backup discovery | `npx vitest run src/tests/atomic-write.test.ts src/tests/project-save-flow.test.ts src/tests/boq-export-ipc.test.ts` | Pending |
| 20-01-03 | 1 | REL-04 | UI-02 busy/error/long path/focus and close guards | `npx vitest run src/tests/save-protection-ui.test.ts src/tests/title-bar-dirty.test.ts src/tests/title-bar-saving.test.ts src/tests/project-shortcuts.test.ts` | Pending; creates suite |
| 20-02-01 | 2 | REL-05 | Measured Estimate→actual writers money invariant | `npx vitest run src/tests/rate-unit-invariance.test.ts src/tests/estimate-row-edit.test.ts src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` | Pending; creates invariant suite |
| 20-02-02 | 2 | REL-03, REL-05 | Explicit basis/application/legacy state roundtrip | `npx vitest run src/tests/rate-basis-roundtrip.test.ts src/tests/cost-library-apply.test.ts src/tests/project-serialize.test.ts src/tests/rates-proto-hydrate.test.ts` | Pending; creates roundtrip suite |
| 20-02-03 | 2 | REL-05 | All type/unit/operation and invalid basis cases | `npx vitest run src/tests/rate-unit-invariance.test.ts src/tests/rate-basis-operations.test.ts src/tests/rate-basis-roundtrip.test.ts src/tests/project-schema.test.ts` | Pending; creates operation suite |
| 20-04-01 | 2 | REL-01 | Authoritative bridge/title version, no guessed state | `npx vitest run src/tests/app-version.test.ts src/tests/title-bar-dirty.test.ts src/tests/title-bar-saving.test.ts` | Pending; creates version suite |
| 20-04-02 | 2 | REL-01, REL-04 | UI-01 notes/Menu/About keyboard/overflow | `npx vitest run src/tests/about-release-notes.test.ts src/tests/top-action-bar-nav.test.ts src/tests/app-version.test.ts` | Pending; creates About suite |
| 20-08-01 | 2 | REL-05 | Cache/DPR/clamping/canvas pointer tracer | `npx vitest run src/tests/pdf-cache-dpi.test.ts src/tests/stage-transform.test.ts src/tests/zoom.test.ts src/tests/pdf-loader-detached-buffer.test.ts` | Pending; creates cache suite |
| 20-08-02 | 2 | REL-05 | Navigation memory plateau, known coordinates, dialog reclamping | `npx vitest run src/tests/dialog-viewport.test.ts src/tests/coordinate-dpi-invariance.test.ts src/tests/pdf-cache-dpi.test.ts src/tests/use-draggable.test.ts` | Pending; creates viewport/coordinate suites |
| 20-05-01 | 3 | REL-01, REL-02 | Stable storage/identity and trusted sender | `npx vitest run src/tests/identity-storage.test.ts src/tests/cost-library-store.test.ts src/tests/project-save-flow.test.ts` | Pending; creates identity suite |
| 20-05-02 | 3 | REL-02 | Official package support/source/scripts before install | Evidence file existence check plus official registry/lifecycle review; conditional blocking-human gate if findings remain ASSUMED/SUS | Pending; DNS failure is unknown |
| 20-05-03 | 3 | REL-01, REL-02 | Reviewed runtime/sandbox/preload/navigation | `npx vitest run src/tests/host-security.test.ts src/tests/identity-storage.test.ts`; `npm run build`; actual Electron smoke | Pending; creates host suite |
| 20-03-01 | 4 | REL-03, REL-04 | Real never-saved PDF recovery across restart | `npx vitest run src/tests/recovery-flow.test.ts` | Pending; creates restart suite |
| 20-03-02 | 4 | REL-04 | Bounded completed candidates, corruption, deletion, interruption | `npx vitest run src/tests/recovery-repository.test.ts src/tests/recovery-flow.test.ts` | Pending; creates repository suite |
| 20-03-03 | 4 | REL-03, REL-04 | All UI-03 states, saved/never-saved/keep/discard | `npx vitest run src/tests/recovery-ui.test.ts src/tests/recovery-flow.test.ts src/tests/recovery-repository.test.ts` | Pending; creates UI suite |
| 20-06-01 | 4 | REL-02, REL-05 | Real child parse/kill/crash and explicit commit | `npx vitest run src/tests/cost-library-worker.test.ts src/tests/cost-library-ipc.test.ts` | Pending; creates process suite |
| 20-06-02 | 4 | REL-02, REL-05 | Actual streamed ZIP limits and measured valid max template | `npx vitest run src/tests/workbook-admission.test.ts src/tests/cost-library-worker.test.ts src/tests/cost-library.test.ts` | Pending; creates admission suite |
| 20-06-03 | 4 | REL-05 | All UI-05 import states/retry/library preservation | `npx vitest run src/tests/cost-library-resilience-ui.test.ts src/tests/cost-library-ui.test.ts src/tests/cost-library-apply.test.ts` | Pending; creates UI suite |
| 20-07-01 | 5 | REL-03, REL-04 | Real portable archive/schema/migration; active-state preservation | `npx vitest run src/tests/project-portability-integration.test.ts src/tests/project-io.test.ts src/tests/project-serialize.test.ts src/tests/project-order-roundtrip.test.ts src/tests/v1-migration-pdfbytes.test.ts` | Pending; creates integration suite |
| 20-07-02 | 5 | REL-05 | All UI-04 review states and every export/unit guard | `npx vitest run src/tests/legacy-rate-review.test.ts src/tests/use-export-hook.test.ts src/tests/use-keyboard-shortcuts-export.test.ts src/tests/scale-store.test.ts` | Pending; creates review suite |
| 20-07-03 | 5 | REL-03, REL-04 | Safe upgraded copy/backup/future format UX | `npx vitest run src/tests/project-compatibility-ui.test.ts src/tests/project-open-flow.test.ts src/tests/project-save-flow.test.ts src/tests/open-error-modal-copy.test.ts` | Pending; creates compatibility suite |
| 20-09-01 | 6 | REL-01, REL-02, REL-05 | Actual NSIS/asar payload/hash/worker inspection | `npx vitest run src/tests/release-artifact.test.ts`; `npm run build:win`; `node scripts/verify-release.cjs dist` | Pending; creates inspector/suite |
| 20-09-02 | 6 | REL-01..05 | Truthful pending evidence, rollback/manual-release matrix | `npx vitest run src/tests/release-evidence.test.ts` | Pending; creates validator/suite |
| 20-09-03 | 6 | REL-01..05 | Actual installed non-dev-PC required cases | `node scripts/verify-release-evidence.cjs .planning/phases/20-production-readiness/20-INSTALLED-EVIDENCE.json dist/release-manifest.json` plus actual installed evidence | Pending; blocking-human evidence gate |

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
- [ ] Every task has automated verification or an explicit human checkpoint; no three consecutive implementation tasks lack automated checks.
- [ ] New test paths have creation dependencies; no watch commands.
- [ ] Focused feedback latency measured.
- [ ] Automated suites and package checks green.
- [ ] Installed non-development-PC evidence complete.
- [ ] `nyquist_compliant: true` set only after validation, never inferred from planning.

**Approval:** pending execution evidence.
