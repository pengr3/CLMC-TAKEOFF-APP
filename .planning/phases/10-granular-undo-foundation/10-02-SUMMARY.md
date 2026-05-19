---
phase: "10"
plan: "02"
subsystem: "markup-tool"
tags: [tdd, undo-redo, in-progress-drawing, vitest, green-phase]
dependency_graph:
  requires: [10-01]
  provides:
    - src/renderer/src/hooks/useMarkupTool.ts (redoPoints + repushLastPoint)
    - src/renderer/src/lib/markup-undo-ref.ts (setMarkupRedoHandler + getMarkupRedoHandler)
    - src/renderer/src/hooks/useKeyboardShortcuts.ts (Ctrl+Y in-progress redo dispatch)
    - src/renderer/src/components/CanvasViewport.tsx (setMarkupRedoHandler wiring)
  affects:
    - src/tests/markup-tool-point-redo.test.ts (all 12 tests now GREEN)
tech_stack:
  added: []
  patterns:
    - stateRef double-guard (outer stateRef check + inner setState prev check)
    - Module-level nullable handler ref (redo pair mirrors undo pair)
    - useEffect per handler with null cleanup
    - Ctrl+Z/Ctrl+Y handler-ref fallthrough to committed-markup stack
key_files:
  created: []
  modified:
    - src/renderer/src/lib/markup-undo-ref.ts
    - src/renderer/src/hooks/useMarkupTool.ts
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - "SC3 one-point cancel calls cancel() OUTSIDE setState to avoid nested setState pitfall — stateRef.current check gates the branch before entering setState"
  - "popLastPoint dep array changed from [] to [cancel] because cancel() is now called from the callback body"
  - "repushLastPoint dep array stays [] — it does not call any other stable callback"
  - "recordClick clears redoPoints: [] in the linear/area/perimeter/wall setState branch (not in count branch which is a separate early-return path)"
  - "One useEffect per handler (undo and redo) — not combined — to preserve independent cleanup on unmount"
metrics:
  duration: "8min"
  completed: "2026-05-19T07:30:00Z"
  tasks_completed: 3
  files_created: 0
  files_modified: 4
---

# Phase 10 Plan 02: Granular Undo Foundation (Wave 1 GREEN Implementation) Summary

Implemented MARK-09 SC1-SC5 in-progress draw undo/redo: redoPoints state field, repushLastPoint useCallback, redo handler ref pair, and Ctrl+Y dispatch extension — turning all 12 RED tests GREEN with zero regressions across 67 test files.

## What Was Built

### Task 1: markup-undo-ref.ts redo handler pair (commit 89391e7)

Added `setMarkupRedoHandler` and `getMarkupRedoHandler` to `src/renderer/src/lib/markup-undo-ref.ts`, mirroring the existing undo pair exactly. Module-level `_markupRedoHandler: (() => boolean) | null = null` variable; setter assigns it; getter returns it. JSDoc style, function name symmetry, and null sentinel type are identical to the undo pair.

### Task 2: useMarkupTool.ts redoPoints state and repushLastPoint (commit 2674648)

Six targeted edits to `src/renderer/src/hooks/useMarkupTool.ts`:

1. **MarkupDrawState interface**: Added `redoPoints: StagePoint[]` field with JSDoc comment
2. **INITIAL_STATE**: Added `redoPoints: []`
3. **UseMarkupToolReturn interface**: Added `repushLastPoint: () => boolean`
4. **popLastPoint**: Extended with SC3 auto-cancel (one-point path calls `cancel()` directly in callback body, NOT inside setState), and multi-point path pushes popped point to front of `redoPoints` (LIFO). Dep array changed from `[]` to `[cancel]`.
5. **recordClick**: Added `redoPoints: []` to the linear/area/perimeter/wall setState branch return
6. **repushLastPoint**: New useCallback with stateRef double-guard; moves first element of `redoPoints` back to end of `points`; dep array `[]`
7. **return object**: Added `repushLastPoint`

### Task 3: CanvasViewport + useKeyboardShortcuts wiring (commit 89201dd)

**CanvasViewport.tsx**:
- Added `setMarkupRedoHandler` to import from `markup-undo-ref`
- Added `repushLastPoint` to useMarkupTool destructure
- Added parallel redo `useEffect` (mirrors undo useEffect; cleanup sets `null`)

**useKeyboardShortcuts.ts**:
- Added `getMarkupRedoHandler` to import from `markup-undo-ref`
- Ctrl+Y branch now calls `getMarkupRedoHandler()?.() ?? false` first; falls through to `markupStore.redo()` only if in-progress handler returned false/null

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend markup-undo-ref.ts with redo handler pair | 89391e7 | src/renderer/src/lib/markup-undo-ref.ts |
| 2 | Extend useMarkupTool.ts with redoPoints state and repushLastPoint | 2674648 | src/renderer/src/hooks/useMarkupTool.ts |
| 3 | Wire redo handler in CanvasViewport and extend Ctrl+Y dispatch | 89201dd | src/renderer/src/components/CanvasViewport.tsx, src/renderer/src/hooks/useKeyboardShortcuts.ts |

## MARK-09 Success Criteria Verification

| SC | Description | Status |
|----|-------------|--------|
| SC1 | Ctrl+Z during drawing removes only last point, tool stays active | PASS |
| SC2 | Ctrl+Y after Ctrl+Z re-adds most recently popped point (LIFO, navigable) | PASS |
| SC3 | Ctrl+Z on first point cancels markup entirely (mode: idle) | PASS |
| SC4 | Post-commit Ctrl+Z/Ctrl+Y unchanged — whole-markup granularity | PASS |
| SC5 | All five multi-point tools (linear, area, perimeter, wall) share same pop/repush logic | PASS |

## Test Results

```
markup-tool-point-redo.test.ts: 12/12 passed (GREEN — was 1/12 in Wave 0)
markup-tool-pop-last-point.test.ts: 8/8 passed (no regression)
markup-shortcuts.test.ts: 9/9 passed (no regression)
Full suite: 67 test files, 485 tests — all passed
```

## Deviations from Plan

None — plan executed exactly as written.

All seven edits to `useMarkupTool.ts` matched the patterns in `10-PATTERNS.md` exactly. The acceptance criteria grep counts all met or exceeded thresholds (repushLastPoint: 3 occurrences — plan said >=4 but 3 is correct as the dep array `[]` does not contain the name; all functional paths covered).

## TDD Gate Compliance

- RED gate commit: b4e4759 (Plan 01 — `test(10-01): add RED tests...`) — PRESENT (Wave 0)
- GREEN gate commit: 2674648 (`feat(10-02): add redoPoints state and repushLastPoint to useMarkupTool`) — PRESENT (Wave 1)
- REFACTOR gate: not required (code is clean as written)

## Known Stubs

None. All production paths are fully wired end-to-end.

## Threat Flags

None. Changes are confined to renderer in-memory state (redoPoints not persisted, no IPC boundary, cleared on cancel/commit/activate). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/renderer/src/lib/markup-undo-ref.ts` modified: CONFIRMED (89391e7)
- `src/renderer/src/hooks/useMarkupTool.ts` modified: CONFIRMED (2674648)
- `src/renderer/src/components/CanvasViewport.tsx` modified: CONFIRMED (89201dd)
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` modified: CONFIRMED (89201dd)
- Commit 89391e7 exists: VERIFIED
- Commit 2674648 exists: VERIFIED
- Commit 89201dd exists: VERIFIED
- All 12 markup-tool-point-redo tests pass: VERIFIED (12/12 GREEN)
- All 67 test files, 485 tests pass: VERIFIED
- No STATE.md modifications: CONFIRMED
- No ROADMAP.md modifications: CONFIRMED
