---
phase: 18-toolbar-revamp
plan: 06
subsystem: ui
tags: [react, zustand, status-bar, calibration, scale]

# Dependency graph
requires:
  - phase: 18-03
    provides: "RED contract src/tests/status-line.test.ts (folded scale-nudge behavior)"
  - phase: 06 (CanvasHeaderBar)
    provides: "3-branch scale segment + Set Scale nudge reused verbatim"
provides:
  - "StatusBar is the single consolidated status line: filename · page · zoom% · scale (3-branch nudge) · snap (reflect-only)"
  - "Folded 'Page not calibrated → Set Scale' nudge (D-06) reusing getCalibrationControls().activate()"
affects: ["18-09 (deletes CanvasHeaderBar + unmounts from App)", "18 rail/context-bar plans (own the interactive Snap toggle, D-05)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope stable EMPTY_MARKUPS ref for per-page Zustand markup slice (Pitfall 6)"
    - "Reused calibration trigger via getCalibrationControls().activate() — single ref call, no duplicated path (Pitfall 5)"

key-files:
  created: []
  modified:
    - src/renderer/src/components/StatusBar.tsx

key-decisions:
  - "Kept the existing getScale(currentPage) read for the ratio (unchanged) and layered the 3-branch nudge on top rather than switching to a pageScales selector — minimal diff, no behavior change to the calibrated path."
  - "Branch-b 'Not Set' uses COLORS.textSecondary (matching CanvasHeaderBar's silent styling), superseding the old StatusBar warning color for that state."

patterns-established:
  - "Consolidated status line owns page + scale; top CanvasHeaderBar copy is now redundant (removed in 18-09)."

requirements-completed: [SC-3, SC-5]

# Metrics
duration: 6 min
completed: 2026-07-14
---

# Phase 18 Plan 06: Fold Scale Nudge into StatusBar Summary

**StatusBar became the single consolidated status line by folding CanvasHeaderBar's 3-branch scale segment — including the D-06 "Page not calibrated → Set Scale" nudge — reusing the existing `getCalibrationControls().activate()` trigger, with the snap pill kept reflect-only.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-14T16:32:00Z
- **Completed:** 2026-07-14T16:37:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Folded the 3-branch scale segment into `StatusBar.tsx`'s scale slot: calibrated `1:N` ratio / silent "Not Set" / "Page not calibrated." + inline **Set Scale** nudge.
- The Set Scale link carries `data-testid="status-set-scale-link"` and reuses `getCalibrationControls()?.activate()` (single ref call, no duplicated calibration path — Pitfall 5).
- Added module-scope `EMPTY_MARKUPS` stable ref + per-page markup selector so the nudge fires only when the uncalibrated page carries a non-count markup — without a `useSyncExternalStore` snapshot-churn loop (Pitfall 6).
- Snap indicator left exactly reflect-only (ON accent dot / held-off dimmed / OFF amber, no `onClick`) — the interactive toggle moves to the rail/context bar (D-05).
- Turned `src/tests/status-line.test.ts` fully GREEN (branch-c nudge assertion) with no regression to `status-bar-scale.test.ts` or `canvas-header-bar.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fold the 3-branch scale nudge into StatusBar's scale slot** - `dfcfccb` (feat)

_The RED contract (`status-line.test.ts`) was authored and committed earlier in Phase 18 Wave 0 (18-03), so this plan contributes only the GREEN feat commit._

## Files Created/Modified
- `src/renderer/src/components/StatusBar.tsx` - Added `EMPTY_MARKUPS` stable ref, `useMarkupStore`/`getCalibrationControls`/`Markup` imports, per-page markup selector + `hasNonCountMarkups`, and replaced the 2-branch scale slot with the 3-branch nudge segment (rendered via `scaleSegment`).

## Decisions Made
- Retained the existing `getScale(currentPage)` read for the calibrated ratio and layered the nudge branches on top, rather than migrating to a `pageScales` selector — smallest possible diff, calibrated path behavior unchanged.
- Branch-b "Not Set" now renders in `COLORS.textSecondary` (matching CanvasHeaderBar's silent styling) instead of the old StatusBar warning color; the component-level pure selector test (`status-bar-scale.test.ts`) tests a local helper, not the component, so this styling change is not a regression.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification

- `npx vitest run src/tests/status-line.test.ts src/tests/status-bar-scale.test.ts src/tests/canvas-header-bar.test.ts` → **16 passed** (status-line branch-c now GREEN; guard tests unchanged).
- `npm run typecheck` (node + web) → **clean**.
- Full suite `npx vitest run` → **818 tests passed**. 6 test *files* fail to load with unresolved imports of `@renderer/components/ToolRail` and `@renderer/components/ContextBar` — RED scaffolding for other Phase 18 plans (18-01/02/…) whose components do not exist yet. These are pre-existing, unrelated to `StatusBar.tsx`, and out of scope for this plan (working tree shows `StatusBar.tsx` as the only modified file).

## Acceptance Criteria
- [x] `status-line.test.ts` GREEN (calibrated ratio; branch-c click calls `activate()`; branch-b "Not Set" with no link)
- [x] `status-bar-scale.test.ts` still GREEN
- [x] `getCalibrationControls()?.activate` matches exactly once in StatusBar.tsx (line 87)
- [x] `const EMPTY_MARKUPS` present in StatusBar.tsx (line 13)
- [x] Snap indicator has no `onClick` (reflect-only)
- [x] `npx tsc --noEmit` / `npm run typecheck` clean

## Next Phase Readiness
- StatusBar is now the single consolidated line; `CanvasHeaderBar.tsx` still exists and `canvas-header-bar.test.ts` still passes (deletion + App unmount deferred to 18-09 per plan).
- No blockers.

## Self-Check: PASSED
- `src/renderer/src/components/StatusBar.tsx` exists on disk (modified).
- Commit `dfcfccb` present in `git log`.

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
