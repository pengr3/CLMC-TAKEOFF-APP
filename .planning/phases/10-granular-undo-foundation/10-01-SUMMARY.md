---
phase: "10"
plan: "01"
subsystem: "markup-tool"
tags: [tdd, undo-redo, in-progress-drawing, vitest, red-phase]
dependency_graph:
  requires: []
  provides: [src/tests/markup-tool-point-redo.test.ts]
  affects: [src/renderer/src/hooks/useMarkupTool.ts, src/renderer/src/lib/markup-undo-ref.ts]
tech_stack:
  added: []
  patterns: [HookHost/probe mount pattern, stateRef double-guard, dynamic import for module-level ref testing]
key_files:
  created:
    - src/tests/markup-tool-point-redo.test.ts
  modified: []
decisions:
  - "SC1 regression test expected to pass immediately (popLastPoint unchanged in Wave 0)"
  - "SC3 test fails with assertion error (mode: drawing not idle) not TypeError — confirms correct test structure"
  - "All repushLastPoint tests fail with TypeError: not a function — correct RED state"
  - "Redo-ref test fails with TypeError: getMarkupRedoHandler is not a function — correct RED state"
metrics:
  duration: "2min"
  completed: "2026-05-19T07:19:00Z"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 10 Plan 01: Granular Undo Foundation (Wave 0 RED Tests) Summary

RED test file for in-progress Ctrl+Y redo (repushLastPoint) and SC3 first-point auto-cancel — 12 test cases, all failing in Wave 0 as required by the TDD contract.

## What Was Built

Created `src/tests/markup-tool-point-redo.test.ts` with 12 test cases covering all five MARK-09 Success Criteria:

- **SC1 (regression):** `popLastPoint` still returns true and removes last vertex — 1 test, PASSES immediately (expected: popLastPoint unchanged in Wave 0)
- **SC2 (repushLastPoint):** 6 tests covering basic re-add, LIFO multi-pop/repush, redoPoints cleared on new click, returns false when empty, returns false when not in drawing mode — all FAIL RED
- **SC3 (first-point cancel):** 1 test asserting `mode === 'idle'` after popping the single in-progress point — FAILS RED (currently pops to length 0 but stays in drawing mode)
- **SC4 (committed markup isolation):** 1 test asserting repushLastPoint does not affect committed markups — FAILS RED
- **SC5 (tool-agnostic):** 3 tests for area, perimeter, wall tools — all FAIL RED
- **Redo-ref module:** 1 test for `setMarkupRedoHandler`/`getMarkupRedoHandler` via dynamic import — FAILS RED

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write RED tests for repushLastPoint (Wave 0) | b4e4759 | src/tests/markup-tool-point-redo.test.ts |

## RED State Verification

```
Test Files: 1 failed (1)
Tests:      11 failed | 1 passed (12)
```

Failures are:
- 10 tests: `TypeError: probe.current.repushLastPoint is not a function` — correct
- 1 test (SC3): `AssertionError: expected 'drawing' to be 'idle'` — correct (auto-cancel not yet implemented)
- 1 test (redo-ref): `TypeError: getMarkupRedoHandler is not a function` — correct

Existing `markup-tool-pop-last-point.test.ts` suite: 8/8 PASSED (no regression).

## Deviations from Plan

None — plan executed exactly as written.

The plan specified the SC1 regression test and SC4 committed-markup test "may show as passing (green)." In execution, only SC1 passed; SC4 failed because `repushLastPoint` is not yet a function (the test cannot even reach the assertion). This is consistent with RED state requirements.

## Known Stubs

None. This is a test-only file with no production stubs.

## Threat Flags

None. Test-only file; no new production surface.

## TDD Gate Compliance

- RED gate commit: b4e4759 (`test(10-01): add RED tests...`) — PRESENT
- GREEN gate commit: pending (Wave 1 implementation)
- REFACTOR gate: not yet applicable

## Self-Check: PASSED

- `src/tests/markup-tool-point-redo.test.ts` exists: FOUND
- Commit b4e4759 exists: FOUND
- Test count: 12 (11 in first describe + 1 in second describe): VERIFIED
- RED state confirmed: 11 failed, 1 passed
- No STATE.md or ROADMAP.md modifications: CONFIRMED
