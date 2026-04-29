---
phase: 04-project-persistence
plan: 07
subsystem: ui
tags: [electron, react, typescript, project-persistence, modals, error-handling]

# Dependency graph
requires:
  - phase: 04-project-persistence
    provides: useProject hook with ProjectOpenResult type, App.tsx modal dispatch, all recovery modals (MissingPdfModal, HashMismatchModal, PageCountAbortModal, DimensionMismatchModal)

provides:
  - ENOENT guard in openClmcFromPath: hashPdf throwing converts to missing-pdf result instead of generic error
  - Diagnostic console.error logging in openClmcFromPath and finishOpen with explicit note that error surfaces via OpenErrorModal
  - OpenErrorModal.tsx: modal surfacing kind=error results to user (title, body, error detail, Close button)
  - routeOpenResult() pure helper exported from useProject.ts mapping ProjectOpenResult.kind to modal key
  - 6 contract tests in project-open-flow.test.ts locking all modal routing paths

affects: [04-project-persistence verification, phase-05-boq-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ENOENT-as-missing-pdf: file disappearing between resolvePdfPath and hashPdf treated as missing-pdf, not generic error"
    - "Pure routeOpenResult helper extracted from App.tsx dispatch table for testability"
    - "OpenErrorModal follows HashMismatchModal styling/focus pattern (auto-focus on mount, Escape closes)"

key-files:
  created:
    - src/renderer/src/components/OpenErrorModal.tsx
    - src/tests/project-open-flow.test.ts
  modified:
    - src/renderer/src/hooks/useProject.ts
    - src/renderer/src/App.tsx

key-decisions:
  - "routeOpenResult pure helper exported from useProject.ts (not App.tsx) so .test.ts files can test dispatch without mounting React"
  - "ENOENT guard uses dedicated inner try/catch around hashPdf only — outer catch stays for parse/IPC failures"
  - "OpenErrorModal uses single Close button (no recovery action for generic errors)"

patterns-established:
  - "Inner try/catch around IPC calls that can fail with ENOENT, converting to domain-specific result kinds"
  - "All ProjectOpenResult.kind values routed to named modal states — no silent console-only handling"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-04-29
---

# Phase 04 Plan 07: Gap Closure — F/G/H Modal Display Fix Summary

**ENOENT-as-missing-pdf guard + OpenErrorModal closes gap where F/G/H recovery modals were unreachable due to silent console-only error handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-29T07:32:46Z
- **Completed:** 2026-04-29T07:36:50Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- ENOENT guard: `hashPdf` throwing after `resolvePdfPath` succeeds now returns `{ kind: 'missing-pdf' }` instead of falling through to `{ kind: 'error' }` — MissingPdfModal will now appear as expected for F/G scenarios
- `OpenErrorModal.tsx` created and wired into `App.tsx`: generic open errors now show a user-visible dialog (title "Failed to open file", error detail in monospace block, single Close button) instead of being silently consumed by `console.error`
- `routeOpenResult` pure helper exported from `useProject.ts` + 6 contract tests in `project-open-flow.test.ts` locking all modal routing paths including the new `'open-error'` route

## Task Commits

Each task was committed atomically:

1. **Task 1: ENOENT-as-missing-pdf guard + diagnostic logging** - `4a2b650` (fix)
2. **Task 2: OpenErrorModal + App.tsx wiring** - `2841112` (feat)
3. **Task 3: routeOpenResult helper + 6 contract tests** - `5384b0c` (test)

## Files Created/Modified

- `src/renderer/src/hooks/useProject.ts` - Added ENOENT guard around hashPdf, improved diagnostic logging, exported `routeOpenResult` pure helper
- `src/renderer/src/components/OpenErrorModal.tsx` - New modal for `kind === 'error'` results; auto-focuses Close on mount, Escape closes
- `src/renderer/src/App.tsx` - Import OpenErrorModal, add `openError` state, wire `handleOpenResult` to set `openError` on `kind === 'error'`, render OpenErrorModal when state is non-null
- `src/tests/project-open-flow.test.ts` - 6 contract tests covering ok/canceled/null/missing-pdf/page-count-mismatch/hash-mismatch/error routing

## Decisions Made

- `routeOpenResult` extracted to `useProject.ts` (not `App.tsx`) so `.test.ts` files can import it without JSX/React mounting — mirrors the `routeOpenByExtension` pattern from plan 04-03
- Inner try/catch wraps only the `hashPdf` call (not the whole `openClmcFromPath` body) so file-not-found errors are caught at the right granularity without masking unrelated errors
- `OpenErrorModal` has a single Close button (no Browse/Retry) because generic errors have no safe recovery action the app can offer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## Next Phase Readiness

- All 6 modal routing paths are now locked by contract tests
- `kind === 'error'` now surfaces a user-visible dialog instead of silent console.error
- ENOENT guard prevents the F/G scenarios from falling through to the error path
- Ready for Phase 4 re-verification of F/G/H sections

---
*Phase: 04-project-persistence*
*Completed: 2026-04-29*

## Self-Check: PASSED

- FOUND: src/renderer/src/hooks/useProject.ts
- FOUND: src/renderer/src/components/OpenErrorModal.tsx
- FOUND: src/renderer/src/App.tsx
- FOUND: src/tests/project-open-flow.test.ts
- FOUND: .planning/phases/04-project-persistence/04-07-SUMMARY.md
- FOUND commit: 4a2b650 (Task 1 — fix)
- FOUND commit: 2841112 (Task 2 — feat)
- FOUND commit: 5384b0c (Task 3 — test)
- npm run typecheck: exits 0
- npx vitest run: 251 tests pass across 28 test files
