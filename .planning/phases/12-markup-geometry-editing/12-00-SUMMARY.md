---
phase: 12
plan: 0
subsystem: markup-geometry-editing
tags: [tdd, red-stubs, wave-0, vitest]
requires: []
provides:
  - move-vertex-command-contract
  - move-markups-command-contract
  - vertex-edit-mode-state-contract
affects:
  - src/tests/move-vertex-command.test.ts
  - src/tests/move-markups-command.test.ts
  - src/tests/vertex-edit-mode.test.ts
tech_stack_added: []
patterns:
  - beforeEach-zustand-reset
  - per-action-no-op-guard-assertion
  - undo-redo-roundtrip-assertion
  - page-lifecycle-clear-assertion
key_files_created:
  - src/tests/move-vertex-command.test.ts
  - src/tests/move-markups-command.test.ts
  - src/tests/vertex-edit-mode.test.ts
key_files_modified: []
decisions:
  - "Each test file gets its own atomic commit instead of one combined commit; the per-task atomic commit protocol takes precedence over the plan's suggested single commit message — three RED stubs are three independent units of work, and atomic commits give Wave 1 finer-grained bisect granularity if a GREEN attempt regresses one contract"
  - "The single trivially-passing test (vertex-edit-mode 'initialises with vertexEditMarkupId equal to null') is intentional: the plan-mandated beforeEach setState({ vertexEditMarkupId: null }) writes the field directly, so reading it back returns null. This locks the default-value contract without requiring the production initial state today; Wave 1 will satisfy it naturally by adding the field to the store's initial state"
metrics:
  duration_minutes: 4
  task_count: 3
  file_count: 3
  test_count: 18
  red_count: 17
  passed_count: 1
completed: 2026-05-21
---

# Phase 12 Plan 0: Wave 0 — RED Test Stubs Summary

Three failing Vitest files lock the contracts for Phase 12's two new markupStore actions (`moveVertex`, `moveMarkups`) and the new `viewerStore.vertexEditMarkupId` state machine before any implementation lands. 17 of 18 tests fail with `is not a function` errors; the one trivially-passing test is satisfied by the plan-mandated beforeEach scaffolding and locks the default-null contract.

## What Was Built

- **`src/tests/move-vertex-command.test.ts`** — 5 tests for the `moveVertex(markupId, page, vertexIndex, newPoint)` store action. Covers single-vertex move + `move-vertex` command push, undo restoration, redo re-application, unknown-id no-op, and redoStack clearing on new mutation.
- **`src/tests/move-markups-command.test.ts`** — 6 tests for the `moveMarkups(moves[])` store action. Covers solo linear translate, count pin translate (uses `point` not `points`), group move as a single batched command (`undoStack.length === 3` — 2 places + 1 move-markups), undo restoration of all batched markups, redo re-application, and empty-array no-op.
- **`src/tests/vertex-edit-mode.test.ts`** — 7 tests for the `viewerStore.vertexEditMarkupId` field plus `setVertexEditMarkupId` / `clearVertexEdit` actions. Covers initial-null contract, set/clear roundtrip, and page-lifecycle auto-clear (`setPage`, `nextPage`, `prevPage`, `resetViewer` all reset to null — mirrors the existing `selectedMarkupIds` lifecycle pattern verified in `viewer-store-selection.test.ts`).

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `debb2bf` | T1 — move-vertex RED stub | `src/tests/move-vertex-command.test.ts` |
| `603091c` | T2 — move-markups RED stub | `src/tests/move-markups-command.test.ts` |
| `316ab07` | T3 — vertex-edit-mode RED stub | `src/tests/vertex-edit-mode.test.ts` |

## Test Outcomes (RED Verification)

Combined run: `npx vitest run src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts src/tests/vertex-edit-mode.test.ts`

- **Test Files:** 3 failed
- **Tests:** 17 failed, 1 passed (18 total)
- **Failure mode:** All failures are `TypeError: ... is not a function` on `moveVertex`, `moveMarkups`, `setVertexEditMarkupId`, or `clearVertexEdit` — exactly the RED contract the plan asked for. No logic errors, no parse errors.

### The One Passing Test (Expected)

The test `'viewerStore — vertexEditMarkupId > initialises with vertexEditMarkupId equal to null'` passes trivially because the plan-mandated `beforeEach` calls `useViewerStore.setState({ ..., vertexEditMarkupId: null })`, writing the field through Zustand's untyped setState path. Reading it back returns `null`. This is intentional scaffolding per the plan's Test 1 wording — it locks the default-value contract. Once Wave 1 adds `vertexEditMarkupId: null` to the actual store initial state, the test will continue to pass without the manual setState scaffolding being load-bearing. No investigation was warranted because:

1. Grep-verified that no source file under `src/renderer/src/` mentions `vertexEditMarkupId` — the actions/field do not exist yet.
2. All 6 other tests in the same file fail with `setVertexEditMarkupId is not a function` and `clearVertexEdit is not a function`, confirming the implementation is genuinely absent.
3. The passing test is the trivial default-value check, not a behavior assertion that could mask a missing feature.

## Wave 1 GREEN Targets

These RED stubs become GREEN when Wave 1 (Plan 12-01) adds:

1. **`markupStore.moveVertex(markupId, page, vertexIndex, newPoint)`** — mutate `markup.points[vertexIndex]`, push `{ type: 'move-vertex', markupId, page, vertexIndex, oldPoint, newPoint }` onto `undoStack`, clear `redoStack`, defensive no-op on unknown id. Undo/redo branches in markupStore.ts must come BEFORE the `cmd.markup.page` fallthrough (delete-group pattern).
2. **`markupStore.moveMarkups(moves[])`** — iterate moves, replace `points` / `point` per markup type, push a single `{ type: 'move-markups', moves }` command, clear `redoStack`, no-op on empty array.
3. **`MarkupCommand` union extension** in `src/renderer/src/types/markup.ts` — add `move-vertex` and `move-markups` variants. Additive only.
4. **`viewerStore.vertexEditMarkupId: string | null`** field plus `setVertexEditMarkupId(id)` and `clearVertexEdit()` actions. Add `vertexEditMarkupId: null` to the reset object in `setFile`, `setPage`, `nextPage`, `prevPage`, and `resetViewer` (mirrors how those actions already clear `selectedMarkupIds`).

## Deviations from Plan

**One intentional deviation — commit granularity:**

The plan suggested a single combined commit `test(12-00): Wave 0 RED stubs — move-vertex, move-markups, vertex-edit-mode`. Instead, three atomic commits were made (one per task), per the execute-plan.md per-task commit protocol which takes precedence. Each commit's message uses the `test(12-00):` scope and describes the specific contract being locked. The aggregate diff is identical to the proposed combined commit. Atomic commits give Wave 1 finer-grained bisect granularity if a single GREEN attempt regresses one of the three contracts independently.

No other deviations. No auto-fixes triggered. No authentication gates encountered. No architectural decisions required.

## Verification Performed

- `npx vitest run src/tests/move-vertex-command.test.ts` → 5 failed (expected RED)
- `npx vitest run src/tests/move-markups-command.test.ts` → 6 failed (expected RED)
- `npx vitest run src/tests/vertex-edit-mode.test.ts` → 6 failed, 1 trivially-passed (expected RED, see explanation above)
- Combined run across all three → 17 failed, 1 passed (matches per-file results)
- `git log --oneline -3` → three `test(12-00):` commits in expected order

## Self-Check: PASSED

- `src/tests/move-vertex-command.test.ts` — FOUND
- `src/tests/move-markups-command.test.ts` — FOUND
- `src/tests/vertex-edit-mode.test.ts` — FOUND
- Commit `debb2bf` — FOUND
- Commit `603091c` — FOUND
- Commit `316ab07` — FOUND
