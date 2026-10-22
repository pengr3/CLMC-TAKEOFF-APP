---
phase: 20-production-readiness
plan: "06"
subsystem: cost-library-import
tags: [electron, utility-process, yauzl, exceljs, resource-budgets, accessibility, vitest]
requires:
  - phase: 20-05
    provides: Approved Electron 44.9.3, yauzl 3.4.0 and exact trusted top-frame IPC guard
  - phase: 19
    provides: Six-column library validation, sender-owned preview tokens and explicit replacement
provides:
  - A separately built, killable utility process for bounded file admission and workbook parsing
  - Declared and actual streaming ZIP budgets covering every entry before ExcelJS load
  - Recoverable import failure states and all eight UI-05 predicates
affects: [20-07, 20-09, cost-library]
tech-stack:
  added: []
  patterns: [lazy all-entry ZIP admission, absolute child deadline, publish-after-child-exit, main-owned preview token]
key-files:
  created:
    - src/main/cost-library-worker.ts
    - src/main/cost-library-import.ts
    - src/main/workbook-admission.ts
    - src/main/yauzl.d.ts
    - src/tests/cost-library-worker.test.ts
    - src/tests/workbook-admission.test.ts
    - src/tests/cost-library-resilience-ui.test.ts
    - src/tests/fixtures/library-worker-harness.cjs
    - src/tests/fixtures/run-library-worker.cjs
    - src/tests/fixtures/run-library-worker.ts
  modified:
    - electron.vite.config.ts
    - src/main/cost-library-ipc.ts
    - src/main/cost-library.ts
    - src/shared/cost-library.ts
    - src/renderer/src/components/CostLibraryDialog.tsx
    - src/tests/cost-library-ipc.test.ts
    - src/tests/cost-library-ui.test.ts
key-decisions:
  - Read the main-selected file inside the supervised child so the deadline covers file I/O as well as admission and parsing.
  - Publish exactly one result only after child exit; expire candidates before new requests and abort destroyed or stale owners.
  - Retain the proposed absolute ZIP budgets after measured blank and 10,000-row calibration passed without increasing limits.
  - Preserve explicit library replacement, existing CSV/export behavior and independent applied project rate snapshots.
requirements-completed: [REL-02, REL-05]
coverage:
  - id: D1
    description: Real utility child parses workbooks, terminates hangs/crashes/aborts and rejects duplicate or excessive replies
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/cost-library-worker.test.ts
        status: pass
      - kind: integration
        ref: src/tests/cost-library-ipc.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Every ZIP entry is admitted under declared and actual streaming budgets before ExcelJS; valid 10,000-row template passes
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/workbook-admission.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: UI-05 import states, explicit replacement, accurate counts, retained project rates, independent scroll and focus recovery
    requirement: REL-02
    verification:
      - kind: automated_ui
        ref: src/tests/cost-library-resilience-ui.test.ts
        status: pass
    human_judgment: true
    rationale: Installed Windows DPI/readability and actual fresh-install worker launch remain plan 20-09 acceptance.
actuals:
  tokens: 20273
  tasks: 3
  commits: 6
commits: 6
plan_head_before: 6692caec82c9c7bd79a72c078bd337728c9c7b06
duration: 96min
completed: 2026-10-22
status: complete
---

# Phase 20 Plan 06: Bounded Workbook Import Summary

**Library imports now read, admit and parse in a killable Electron utility process, with complete ZIP budgets and recoverable UI feedback before explicit replacement.**

## Performance

- Three tasks completed, 23 implementation/test/evidence files changed before this summary.
- Execution began approximately 2026-10-22 08:16 Asia/Manila; completed approximately 09:52.
- Actual tokens are chars/4 over the realized Git diff. Six commits are measured from the persisted plan ledger before this separate documentation commit.

## Accomplishments

- The main-selected path is read only inside the utility child, through a capped buffer and a bounded file handle. Growing files cannot bypass the compressed-byte cap. No renderer-selected path is accepted by the IPC operation. The supervisor's absolute deadline covers spawn, read, admission, lazy ExcelJS import, parsing and result validation.
- Admission uses reviewed yauzl 3.4.0 lazy-entry/read-stream APIs. It checks every entry, including unused worksheets/media and directories, for entry count, declared sizes, allowed compression methods and encryption. It drains one stream at a time while counting actual entry/aggregate output, verifies size and CRC, and destroys streams on rejection. No extraction or whole expanded-entry allocation occurs before counting. Malformed archives, dishonest sizes, corrupted checksums and unsupported/encrypted entries fail safely.
- The child has a 512 MiB V8 old-space ceiling. Timeout, abort and fatal error initiate actual child termination, with an OS kill fallback. Completion waits for exit. Late or duplicate messages cannot replace the first result, and an absolute-clock check also rejects a reply whose handling crosses the deadline. Replies are length-bounded and successful rows are revalidated in main before granting a candidate.
- All privileged library handlers continue through the existing app-identity trusted window/top-frame/exact-URL guard. Preview requests invalidate the owner's previous token; competing imports are rejected, owner destruction aborts pending work and stale responses create no candidate. Only an explicit token commit writes the repository. Current library and applied project rates remain unchanged on rejected imports.
- Stable timeout/resource/parser categories map to the approved exact messages. Checking/replacing announce distinct busy copy with aria-busy/live status and disabled competing actions. Failures clear checking state and stale selection, retain row errors and allow retry/Close. Cancellation and successful replacement retain their existing neutral copy.
- All eight UI-05 predicates have DOM cases: distinct empty/search instructions, loading, failures, populated preview, partial-invalid rows, overflow, zero/one/many counts and long text. The table and bounded content can scroll while the heading and explicit replacement/apply footer stay outside those scroll regions. Codes/errors/actions wrap, money is right-aligned with tabular numerals, focus is trapped/restored and the reused Estimate row library button has a minimum 28 by 28 CSS-pixel target.
- Existing six-column validation, 10,000-row/50-column limits, CSV numeric rules, template generation, repository semantics, internal exports and explicit rate application remain intact. No package was installed.

## Frozen Limits and Calibration

`WORKBOOK_LIMITS` is exported from src/main/workbook-admission.ts:

| Limit | Value |
|---|---:|
| Compressed input | 10 MiB / 10,485,760 bytes |
| ZIP entries, including directories | 2,048 |
| Expanded single entry | 32 MiB / 33,554,432 bytes |
| Expanded aggregate | 128 MiB / 134,217,728 bytes |
| Items / columns | Existing 10,000 / 50 |
| Worker reply | 20,000,000 UTF-16 code units, then row/issue validation |
| Absolute pipeline deadline | `LIBRARY_IMPORT_DEADLINE_MS = 15_000` in cost-library-import.ts |

Final full-suite calibration generated the real app template, then filled its Cost Library sheet with 10,000 valid rows:

| Fixture | Compressed | Entries | Declared = actual expanded | Largest entry | Measured time |
|---|---:|---:|---:|---:|---:|
| Blank app template | 17,183 B | 17 | 113,239 B | 94,085 B | 14.62 ms admission |
| Populated 10,000-row app template | 324,269 B | 17 | 3,311,899 B | 2,653,698 B | 1,062.51 ms admission plus parse |

The real-child harness separately generated a valid 10,000-row workbook and measured **2,211.52 ms** for its complete supervisor/child pipeline in the final full run. Earlier focused runs ranged roughly 1.61–2.87 seconds. ZIP timestamps can change compressed size by a byte; expanded counts are stable. These are local development-host fixture measurements, not a representative workbook or installed-PC benchmark. No budget correction was needed. Extreme unused content or unusually large text can still be rejected by absolute resource limits even below the row cap.

## Worker Build and Installed Acceptance Seam

- electron.vite.config.ts declares index and cost-library-worker as separate main Rollup inputs.
- Production build emitted **out/main/cost-library-worker.js** (4,696 bytes in this build). parseInUtilityProcess resolves `join(__dirname, 'cost-library-worker.js')`, so an installed main must retain the sibling entry and its generated `out/main/chunks` dependencies.
- Inspection of the emitted worker confirms `await admitWorkbook(bytes)` precedes the lazy require of the ExcelJS parser chunk. The shared validation chunk loads separately without loading ExcelJS.
- yauzl and ExcelJS remain production dependencies and must remain available in the packaged application. Plan 20-09 must inspect the actual installed artifact and launch the worker from its packaged location, including ASAR behavior. Source or development output existence does not substitute for that installed gate.
- Official API references consulted: [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process), [reviewed yauzl lazy-entry/read-stream documentation](https://github.com/thejoshwolfe/yauzl). No alternate package or dependency was introduced.

## Real Process Evidence

Vitest launches a Node-owned fixture/build harness, which launches the actual Electron 44.9.3 host and real utilityProcess. It uses disposable appData/userData and no visible BrowserWindow, then removes its owned scratch directory. It never reads or replaces the workstation library.

The harness verifies a real XLSX result, a synchronous infinite-loop child killed on deadline, continued main-process heartbeat, dead PID after timeout, a child exiting with code 7, owner abort before completion, maximum-row parsing and oversized unused-XML rejection. A real protocol child sends an inherited invalid code followed by a late success; the supervisor returns only parser failure. A 20,000,001-character reply returns resource rejection. Exit and completion counts are checked. These are process tests, not promise-race-only simulations.

The UI suite consumes the actual timed-out supervisor result, retries with actual parsed child rows and requires explicit Replace Library before its commit bridge is called. Repository/IPC ownership tests separately cover expired/foreign tokens, rejection after a prior preview, competing requests, owner destruction and saved-library preservation.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 20-06-01 Real isolated parser | a8ccb72 | 65df3c6 |
| 20-06-02 Streaming admission | 6fd6f5a | 651a128 |
| 20-06-03 Recoverable UI states | 3115d17 | 1a8a225 |

## Verification

- Final full regression: `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot` — **144 files, 1,099 tests passed**, exit 0, **244.17 seconds**.
- Admission/worker/library/IPC focused suites: **54 passed**.
- Final UI/application/worker focused suites: **33 passed**. The resilience UI file contributes 11 cases.
- npm run typecheck — node and renderer pass. npm run build — passes typechecks and production bundles, including the separate worker.
- Scoped ESLint over new/touched production files, new tests, fixtures and build config: **0 errors, 0 warnings**.
- git diff --check passes. No unexpected tracked-file deletions or product stubs. Existing suite React act warnings and the existing PDF static/dynamic import build advisory remain baseline debt; whole-repository lint cleanliness is not claimed.

## TDD Gate Compliance

All three RED records received canonical `RED_EVIDENCE_OK` before implementation. Task 01 and Task 02 intentionally asserted the required missing process/admission entry; their GREEN suites then exercised real process behavior and adversarial streams. Task 03 intentionally failed on absent aria-busy during checking. Each RED precedes its corresponding GREEN commit. The tracer's full real-process suite was rerun successfully before admission expansion.

The initial sandbox realpath EPERM was not treated as RED. A verbose evidence envelope initially lacked parser-recognizable totals; the actual failing run was recaptured as flat TAP and validated before GREEN. No tests were skipped and all final plan verification commands ran.

## Deviations from Plan

1. **[Rule 2 - Full-pipeline ownership]** Removed the old main-process pre-read/stat seam; child-owned bounded file reading ensures selected-file I/O falls inside the actual killable deadline instead of preceding it.
2. **[Rule 2 - Result boundary]** Added CRC checking, bounded reply decoding and main row revalidation. These strengthen the planned untrusted child boundary without changing library schemas or workflows.
3. **[Rule 3 - Harness integration]** Added narrow local yauzl declarations without installing a type package. Moved esbuild fixture setup into a Node subprocess because jsdom's typed-array realm violates esbuild's invariant; the actual child tests remain unchanged in purpose. An independent-scroll footer assertion caught and corrected a misplaced JSX block before final verification. The existing focus test now includes the intentionally keyboard-focusable table scroll region.
4. **Execution environment:** Used the established scoped escalation for Windows Vite realpath, real Electron spawning and Git metadata. No approval rejection or authentication gate occurred.
5. **Global state ownership:** Per orchestrator instruction, this leaf executor did not invoke legacy SDK STATE/ROADMAP/requirements writes, which corrupt historical counters. The parent owns those updates. Its dirty STATE and unrelated AGENTS/runtime/cache/lock files remain untouched and unstaged.

## Known Stubs

None. Empty dialog state, null selection and native input placeholder text are deliberate UI initialization, not unwired product data. No new unresolved defect, skipped test or unrun plan verification requires a WINDOWS ledger entry.

## Next Phase Readiness

Plan 20-09 retains actual installed worker/ASAR launch, Windows reduced-viewport/DPI readability and representative-workbook acceptance. Plan 20-07 owns compatibility/packaged-content work. No installed release, non-development-PC pilot or global REL completion is claimed by these local automated checks. Existing internal exports and project snapshots remain independent of library imports.

## Self-Check: PASSED

All listed new source/test/fixture/evidence files and all six recorded task commits exist. The production worker entry and generated chunks exist after the passing build. All task changes are committed; only parent-owned state and unrelated runtime files remain outside this summary commit. Final full regression passes 144 files / 1,099 tests.
