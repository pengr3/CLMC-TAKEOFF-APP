---
phase: 20-production-readiness
plan: "01"
subsystem: persistence
tags: [electron, zustand, save, backup, accessibility, vitest]
requires:
  - phase: 04.1
    provides: Embedded-PDF ZIP project container
provides:
  - Coherent captured PDF and metadata revisions with session-aware save acknowledgement
  - Serialized protected replacement with one validated adjacent last-good backup
  - Persistent shared save outcomes, accessible retry dialog and safe close/open guards
affects: [20-03, 20-05, 20-07, 20-09]
tech-stack:
  added: []
  patterns: [CapturedProjectSnapshot, per-destination transaction queue, stage-coded IPC results, portal focus containment]
key-files:
  created:
    - src/main/project-storage.ts
    - src/renderer/src/components/SaveFailureDialog.tsx
    - src/tests/project-save-flow.test.ts
    - src/tests/save-protection-ui.test.ts
  modified:
    - src/main/ipc-handlers.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/hooks/useProject.ts
    - src/renderer/src/stores/projectStore.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/renderer/src/App.tsx
    - src/renderer/src/hooks/useCloseGuard.ts
    - src/renderer/src/components/SaveCloseModal.tsx
    - src/renderer/src/components/TopActionBar.tsx
    - src/renderer/src/components/TitleBar.tsx
    - src/tests/atomic-write.test.ts
    - src/tests/boq-export-ipc.test.ts
    - src/tests/title-bar-saving.test.ts
key-decisions:
  - Capture metadata and independent PDF bytes synchronously, then finalize hash and dimensions against those captured inputs.
  - A successful explicit save acknowledges only the captured document session and revision; recovery must never invoke that acknowledgement.
  - Try Again reuses the failed destination, including a failed first Save As; cancellation retains the persistent failure.
patterns-established:
  - Main owns archive validation, flushed unique temporary files, backup maintenance and serialized replacement.
  - Shared saveFailure and lastSaveOutcome state covers toolbar, keyboard and guard entry points.
requirements-completed: [REL-03, REL-04]
coverage:
  - id: D1
    description: One coherent Save-to-disk-to-Open revision, preserving newer edits and session identity
    requirement: REL-03
    verification:
      - kind: integration
        ref: src/tests/project-save-flow.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Original and validated last-good preservation through injected write, validation, backup and replacement failures
    requirement: REL-04
    verification:
      - kind: integration
        ref: src/tests/atomic-write.test.ts
        status: pass
      - kind: integration
        ref: src/tests/boq-export-ipc.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Shared persistent save failure, keyboard containment, retry and safe close/open decisions
    requirement: REL-04
    verification:
      - kind: automated_ui
        ref: src/tests/save-protection-ui.test.ts
        status: pass
    human_judgment: true
    rationale: DOM tests prove state and interaction contracts; actual reduced-viewport readability and Windows scaling remain installed-app validation in plan 20-09.
actuals:
  tokens: 24355
  tasks: 3
  commits: 7
plan_head_before: d0bcee94b826e2c5e60f8f96f046c0afa47652a0
duration: 21min
completed: 2026-10-21
status: complete
---

# Phase 20 Plan 01: Protected Explicit Save Summary

**Captured PDF/state revisions now save through serialized, validated replacement with a last-good backup and persistent accessible failure handling.**

## Performance

- Duration: approximately 21 minutes; context load began approximately 2026-10-21T15:11:00Z, implementation verification completed 2026-10-21T15:31:18Z.
- Tasks: 3/3.
- Realized implementation/test/evidence diff: 21 files, 24,355 chars/4 tokens. Commit count is measured from the persisted plan ledger before this summary commit; metadata commits are separate.

## Accomplishments

- The real renderer hook, Electron transport harness, real archive assembler/extractor and actual temporary directories prove Save, second-save backup and reopen. Captured metadata/PDF bytes cannot mix with edits during hashing or dimension reads. Later edits and changed document sessions cannot receive an obsolete clean acknowledgement.
- Main serializes complete transactions per resolved destination, writes unique same-directory files with exclusive creation, flushes/closes and validates before replacement. A validated previous original becomes the one adjacent `.bak`. Corrupt originals do not replace a valid backup, backup-stage failures stop replacement, and persistent rename failures never authorize unlinking the original. Independent destinations progress independently.
- Read failures advertise only an integrity-validated adjacent backup. Crash remnants are neither opened nor deleted as another transaction's owned data. Export rename retries also preserve the previous export, retaining the actionable locked-Excel error.
- Every save path publishes shared Saving/outcome/failure state. The portal failure dialog retains dirty work, contains keyboard/focus, restores focus, wraps/selects long paths and scrolls within the viewport. Close dismisses the error; Try Again retries the actual failed destination; canceled Save As retains the failure. Close/open guards continue only after all current work is saved.

## Task Commits

1. Task 1 RED: `4d44786`; corrected Vitest-to-Node TAP summary adapter: `20b1436`; GREEN tracer: `8f554e1`.
2. Task 2 RED: `10c87fd`; GREEN protected storage/failure matrix: `e0c8e6f`.
3. Task 3 RED: `3bb7ca7`; GREEN shared save UI and guards: `c1835c8`.

## Verification

- `npx vitest run src/tests/project-save-flow.test.ts`: 5/5 passed, including a fresh committed-tracer rerun before task 2 expansion.
- `npx vitest run src/tests/atomic-write.test.ts src/tests/project-save-flow.test.ts src/tests/boq-export-ipc.test.ts`: 29/29 passed after the expanded missing/corrupt-original matrix.
- Final combined focused command, `npx vitest run src/tests/save-protection-ui.test.ts src/tests/title-bar-dirty.test.ts src/tests/title-bar-saving.test.ts src/tests/project-shortcuts.test.ts src/tests/project-save-flow.test.ts src/tests/atomic-write.test.ts src/tests/boq-export-ipc.test.ts`: 47/47 passed across 7 files.
- `npm run typecheck`: node and renderer checks passed after the final production changes.
- Final committed implementation `npx vitest run`: **128 files / 969 tests passed**, duration 105.17s. Earlier full run also passed 128 files / 966 tests before the final three guard tests.
- Scoped ESLint remains nonzero only for two confirmed pre-existing hook-rule errors: App's page-navigation reopen-toast effect and useCloseGuard's render-time ref assignment. Both exist at baseline d0bcee9 and are recorded in `deferred-items.md` and the defect ledger. Extensive inherited Prettier/CRLF warnings remain; newly created and fully rewritten files were formatted. Lint is not claimed as passing.
- No tests were skipped, no verification command used a no-tests fallback, and no packages were installed.

## TDD Gate Compliance

All three behavior tasks have intentional named assertion failures followed by GREEN commits. Persisted records `20-01-01-red.json`, `20-01-02-red.json`, and `20-01-03-red.json` each returned `RED_EVIDENCE_OK` before implementation. The initial nested Vitest TAP lacked Node summary lines and returned INVALID_RED; the adapter records raw flat TAP plus transparently derived summary counts. The invalid record did not authorize implementation. Refactoring/formatting was included with task completion; no separate behavior-changing refactor followed GREEN.

## Decisions Made

Use exported `captureProjectSnapshot` / `finalizeProjectSnapshot` for the later recovery implementation, retaining the existing embedded archive format. Capture source identity and revision before any await. `acknowledgeSavedRevision` is reserved for explicit saves. Keep validation in main independent of renderer store/type dependencies. Preserve the established `'ok' | 'canceled' | 'error'` caller contract while exposing stable write-stage results across the named IPC bridge.

## Deviations from Plan

1. **[Rule 2 - Missing critical boundary contract]** Extended `src/preload/index.ts` and `index.d.ts` with the stable save-stage failure union and optional validated `backupPath`. The existing typed bridge needed to carry truthful error/backup information; no new channel or arbitrary filesystem API was added.
2. **[Rule 2 - Missing critical interaction protection]** Updated `TopActionBar.tsx` to disable Open while saving and `SaveCloseModal.tsx` to disable busy actions, contain focus/keyboard, use focused-control Enter and bound long content. These existing call sites were necessary to make the planned every-save-path behavior true.
3. **[Rule 3 - Verification environment]** Sandboxed Vitest initially failed before test discovery with Vite realpath EPERM. The exact command succeeded with approved escalation; all RED/GREEN and full-suite evidence comes from actual discovered tests. GSD SDK temporary-file writes similarly required escalation.

## Issues Encountered

The original implementation reproduced missing backups, metadata captured from the wrong revision, stale session acknowledgement and duplicate native Save As pickers. Task 2 additionally reproduced missing validated-backup discovery and acceptance of malformed metadata with a matching PDF hash. These are fixed. Directly importing the renderer schema into main traversed renderer hook types and broke node typecheck; node-owned boundary checks resolved that intermediate implementation issue.

## Known Stubs

None. Empty store defaults and test mocks are initialization/test fixtures, not unwired product data.

## User Setup Required

None.

## Next Phase Readiness

The leading save tracer is complete and verified. Plan 20-02 may proceed; plan 20-03 can reuse coherent capture without acknowledging recovery as an explicit save. Trusted sender policy remains plan 20-05; broader compatibility and Open Backup Copy UI remain plan 20-07. Installed Windows visual, offline and upgrade evidence remains plan 20-09. REL-03 and REL-04 are shared across unfinished sibling plans, so requirement readiness returned 0/2 and neither is marked complete globally. No deployment or non-development-PC acceptance is claimed.

## Self-Check: PASSED

All four new implementation/test artifacts, all three RED records and all seven recorded task/test commits were verified on disk/in Git before writing this summary. Final focused/full tests and typecheck pass. No unexpected tracked-file deletion occurred; replacing the obsolete atomic-write test retained the file.
