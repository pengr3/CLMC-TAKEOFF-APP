---
phase: 08-markup-workflow-and-wall-tool
plan: "01"
subsystem: useMarkupTool hook
tags: [chain-mode, wall-tool, state-machine, hook]
dependency_graph:
  requires:
    - 08-00 (WallMarkup type in markup.ts, 'wall' in ActiveTool, chain-mode.test.ts RED stubs)
  provides:
    - chainArmed state field on MarkupDrawState (runtime chain mode for all 5 tools)
    - pendingWallHeight state field on MarkupDrawState (wall height inheritance across chain)
    - wall branch in commitShape producing WallMarkup via store.placeMarkup
    - chain-aware post-commit reset preserving name/category/color and returning to drawing mode
  affects:
    - src/renderer/src/hooks/useMarkupTool.ts
tech_stack:
  added: []
  patterns:
    - stateRef StrictMode guard (store.placeMarkup OUTSIDE setState, Pitfall 3)
    - INITIAL_STATE as reset base (Pitfall 7 — always re-establishes chainArmed/pendingWallHeight)
    - Chain-aware post-commit reset (INITIAL_STATE spread + preserve pending fields)
key_files:
  created: []
  modified:
    - src/renderer/src/hooks/useMarkupTool.ts
decisions:
  - "Chain reset always arms on first commitShape (chainArmed: true unconditionally after commit)"
  - "commitShape chain reset uses INITIAL_STATE as spread base to guarantee no field omission"
  - "finishLinear extended to handle 'wall' toolType (wall is an open polyline, same finish path)"
  - "recordClick extended to handle 'wall' in drawing branch (same as linear)"
metrics:
  duration: "8min"
  completed: "2026-05-15"
  tasks: 2
  files: 1
---

# Phase 08 Plan 01: useMarkupTool Chain Mode + Wall Tool Support Summary

Wave 1A hook refactor: `useMarkupTool.ts` generalized to support chain markup mode for all five tools and wall tool placement.

## What Was Built

Extended `useMarkupTool.ts` with two additive fields on `MarkupDrawState` (`chainArmed: boolean`, `pendingWallHeight: number`), a wall branch in `commitShape` that produces `WallMarkup` objects, and a chain-aware post-commit reset that keeps name/category/color/toolType armed so the user can place successive markups without re-prompting.

Key behaviors:
- After any `commitShape` call, state resets to `{ ...INITIAL_STATE, toolType, mode: 'drawing', pendingName, pendingCategoryName, pendingColor, chainArmed: true }` — the user is immediately ready to draw the next markup of the same item.
- `cancel()` (Esc) calls `setState(INITIAL_STATE)` which includes `chainArmed: false` and `pendingWallHeight: 2400` — chain breaks cleanly.
- Wall branch in `commitShape` constructs `WallMarkup` with `payload.wallHeight ?? prev.pendingWallHeight`, then dispatches via `store.placeMarkup(m)` OUTSIDE any `setState` updater (Pitfall 3 StrictMode guard preserved).
- `finishLinear` and `recordClick` extended to also accept `'wall'` toolType since wall is an open polyline (same drawing path as linear).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend MarkupDrawState + INITIAL_STATE + activate signature | 86b8cfc | useMarkupTool.ts |
| 2 | Chain-aware post-commit reset + wall branch in commitShape | 9b52e4c | useMarkupTool.ts |

## Verification

- `npx vitest run src/tests/chain-mode.test.ts` — 3/3 GREEN
- `npx vitest run src/tests/markup-tool-strictmode.test.ts` — 2/2 GREEN (no StrictMode regression)
- `npx vitest run src/tests/markup-tool-pop-last-point.test.ts` — 8/8 GREEN
- `npx tsc --noEmit` — exits 0

## Deviations from Plan

### Auto-additions

**1. [Rule 2 - Missing critical functionality] Extended recordClick and finishLinear to handle 'wall' toolType**
- **Found during:** Task 2
- **Issue:** The plan focused on commitShape but 'wall' as a polyline tool also needs recordClick (adds points during drawing) and finishLinear (closes the polyline on double-click) to accept toolType='wall'. Without this, wall drawing would silently do nothing.
- **Fix:** Extended the `prev.toolType === 'linear' || ...` checks in both functions to also include `'wall'`.
- **Files modified:** src/renderer/src/hooks/useMarkupTool.ts (Task 2 commit)

**2. [Rule 1 - Merge] Worktree was behind main repo (Wave 0 commits absent)**
- **Found during:** Execution start
- **Issue:** The worktree branch diverged before Wave 0 commits landed on master. The plan files and test stubs were missing.
- **Fix:** `git merge master --no-edit` brought in all Wave 0 work before starting implementation.

## Known Stubs

None — all behavior implemented. Wall placement produces real WallMarkup objects via the store.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. Hook operates entirely within the renderer process; wall height comes from a typed `number` payload (TypeScript rejects strings at the callsite).

## Self-Check: PASSED

- [x] src/renderer/src/hooks/useMarkupTool.ts exists and modified
- [x] Commit 86b8cfc exists (Task 1)
- [x] Commit 9b52e4c exists (Task 2)
- [x] chain-mode.test.ts 3/3 GREEN
- [x] markup-tool-strictmode.test.ts 2/2 GREEN
- [x] npx tsc --noEmit exits 0
