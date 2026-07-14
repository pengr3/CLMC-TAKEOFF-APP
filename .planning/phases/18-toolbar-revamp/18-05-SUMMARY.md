---
phase: 18-toolbar-revamp
plan: 05
subsystem: ui
tags: [react, toolbar, zustand, view-mode, konva-isolation, top-action-bar]

# Dependency graph
requires:
  - phase: 18-toolbar-revamp (18-02)
    provides: RED test contracts + testid_contract for TopActionBar (file-ops, nav, view-mode, visibility)
  - phase: 09-toolbar-ribbon
    provides: RibbonToolbar handlers/derivations lifted verbatim (D-08 behavior parity)
provides:
  - TopActionBar.tsx — persistent slim 46px top action bar (D-03) re-homing every Home/Page/View/Estimating-tab action onto one strip
  - Compact 34px BarButton variant carrying RibbonButton's active/hover/disabled token recipe
  - Standalone Plan|Estimate segmented toggle with NO tab-leave reset (R-1)
affects: [18-09 (App wiring + ribbon deletion), 18-06 ToolRail, 18-07 ContextBar, 18-08 status-line]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compact BarButton (34px row) reusing RibbonButton token recipe (baseBackground active?activeSurface:transparent; hover hoverSurface; disabled opacity 0.4 + pointerEvents none + tabIndex -1)"
    - "Verbatim handler/derivation lift from RibbonToolbar for behavior parity (D-08); only layout/geometry changes"
    - "Standalone view-mode toggle with NO reset useEffect (R-1) — self-consistent once the 7-tab ribbon is gone"

key-files:
  created:
    - src/renderer/src/components/TopActionBar.tsx
  modified: []

key-decisions:
  - "Totals toggle rendered in Task 1 (not Task 2) because the nav test — Task 1's verify gate — asserts the Totals aria-pressed toggle; splitting it to Task 2 would leave Task 1's HARD GATE failing"
  - "Set-Scale-only derivations (pageScale/setScaleDisabled/isCalibrating) NOT copied — Set Scale lives on the rail/context bar (later plans), so copying them verbatim would fail noUnusedLocals (tsc gate)"
  - "aria-disabled/aria-pressed carried on BarButton exactly like RibbonButton so tests can read boolean-string attributes; disabled buttons get onClick=undefined + pointerEvents none"
  - "Inert overflow (⋯) rendered as a raw button with data-testid=overflow-menu-button and NO onClick (D-07/Q3 reserved home)"

patterns-established:
  - "BarButton: compact icon-only 34px action-bar cell; the row-layout counterpart to the 72×80 RibbonButton"
  - "View-mode segmented radiogroup preserved verbatim (role=radiogroup + role=radio + data-testid=view-mode-plan|estimate) minus the reset side effect"

requirements-completed: [SC-1, SC-5, SC-6]

# Metrics
duration: ~10 min
completed: 2026-07-14
---

# Phase 18 Plan 05: TopActionBar Summary

**Persistent slim 46px top action bar (D-03) that re-homes Open/Save/Save As/Replace/Export · Page ◀ N/M ▶ · Zoom −/%/+ · Fit · Plan|Estimate · Totals · Show/Hide All · inert ⋯ onto one always-visible strip, with every handler and disabled derivation lifted verbatim from RibbonToolbar for behavior parity.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-14T08:18:00Z (approx)
- **Completed:** 2026-07-14T08:28:52Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- New `TopActionBar.tsx` (481 lines, exceeds 200 min-lines) exporting `TopActionBar(props: TopActionBarProps)` with props identical to `RibbonToolbarProps` (zero-friction re-wire in 18-09)
- Left file-ops group: accent Open (keeps `aria-label="Open project or PDF (Ctrl+O)"`) + Save / Save As / Replace / Export with `saveDisabled`/`replaceDisabled`/`exportDisabled` predicates copied byte-for-byte from RibbonToolbar
- Center group: Page prev / `Page N of M` (aria-live=polite) / next + Zoom out / % / in + Fit, all zoom actions routed through `getCanvasControls()?.zoomIn/zoomOut/fitToWindow` module refs
- Right group: standalone Plan|Estimate radiogroup (no reset), Totals toggle (aria-pressed reflects totals.open), Show All / Hide All (both call `markDirty()` explicitly — Pitfall 7), inert ⋯ overflow
- All four target RED tests turned GREEN (22 tests); `TopActionBar` is standalone and NOT yet mounted (18-09 wires it in and deletes the ribbon)

## Task Commits

1. **Task 1: File-ops left group + center page/zoom group (+Totals)** - `cd9cef0` (feat)
2. **Task 2: Right group — Plan|Estimate (no reset) + Show/Hide All + inert ⋯** - `23684c4` (feat)

**Plan metadata:** _(this SUMMARY commit)_ (docs)

## Files Created/Modified
- `src/renderer/src/components/TopActionBar.tsx` - The slim top action bar (D-03). Module-scope compact `BarButton`, accent `renderOpenButton`, verbatim disabled derivations + zoom/Totals/Show/Hide-All/view-mode handlers, three-group flex layout with spacers.

## Decisions Made
- **Totals lives in Task 1's commit, not Task 2's** — the nav test (`top-action-bar-nav.test.ts`), which is Task 1's verify gate, asserts the Totals `aria-pressed` toggle. Deferring Totals to Task 2 would leave Task 1's HARD acceptance gate failing. Totals is a nav element in the test contract, so it belongs in the Task 1 commit even though the plan prose lists it under Task 2's group.
- **Dropped Set-Scale-only derivations** (`pageScale`, `setScaleDisabled`, `isCalibrating`) and the `useScaleStore` import — Set Scale is NOT on this bar (it moves to the rail/context bar in later plans). Copying them verbatim as the plan text suggested would introduce unused locals and fail the `noUnusedLocals: true` tsc gate (an explicit acceptance criterion). Only the derivations actually consumed by this bar were lifted verbatim.
- **No reset useEffect** — per R-1, the Phase-16 tab-leave reset (`RibbonToolbar.tsx:170-174`) is intentionally not ported; the standalone toggle is self-consistent. Verified: zero `useEffect(` hooks and zero `setViewMode('plan')` resets in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Omitted unused Set-Scale derivations to satisfy the tsc `noUnusedLocals` gate**
- **Found during:** Task 1 (selector/derivation lift)
- **Issue:** The plan instructed copying `pageScale`/`setScaleDisabled`/`isCalibrating` verbatim, but Set Scale is not a control on the TopActionBar (it lands on the rail/context bar in later plans). With `noUnusedLocals: true` in the shared tsconfig, these unused locals (and the `useScaleStore` import they require) would fail `tsc --noEmit`, which is a listed acceptance criterion.
- **Fix:** Copied only the derivations actually consumed by this bar (`saveDisabled`/`replaceDisabled`/`exportDisabled`/`currentZoom`) byte-for-byte; omitted the Set-Scale-only trio and the `useScaleStore` import.
- **Files modified:** src/renderer/src/components/TopActionBar.tsx
- **Verification:** `npm run typecheck` (node + web) exits 0; the four target tests pass GREEN.
- **Committed in:** cd9cef0 (Task 1 commit)

**2. [Rule 3 - Blocking] Placed Totals in the Task 1 commit rather than Task 2**
- **Found during:** Task 1 (verify gate)
- **Issue:** Task 1's verify runs `top-action-bar-nav.test.ts`, which asserts the Totals toggle (aria-pressed + setTotalsOpen). The plan prose lists Totals under Task 2's right group, which would make Task 1's HARD acceptance gate unsatisfiable without weakening the test.
- **Fix:** Rendered the Totals `BarButton` in the right group as part of Task 1; Task 2 then prepends Plan|Estimate and appends Show/Hide All + ⋯ around it. End-state layout is identical to the plan's contract.
- **Files modified:** src/renderer/src/components/TopActionBar.tsx
- **Verification:** `top-action-bar-nav.test.ts` GREEN after Task 1.
- **Committed in:** cd9cef0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact on plan:** Both are sequencing/dead-code adjustments to satisfy the plan's own tsc + test acceptance gates; the delivered component matches the testid_contract and success criteria byte-for-byte. No scope creep, no behavior change versus the ribbon.

## Issues Encountered
None — both tasks executed cleanly; the four target tests were RED (unresolved import) before and GREEN after.

## User Setup Required
None - no external service configuration required.

## Threat Flags
None — no new IPC surface introduced. Save/Save As/Export/Replace dispatch the same App-owned handlers via unchanged props (T-18-05-01: accept). Show/Hide All copy the verbatim `setHiddenItemNames` + explicit `markDirty()` handlers with no new persisted field (T-18-05-02: mitigated).

## Known Stubs
- **Inert ⋯ overflow button** (`TopActionBar.tsx`, right group) — intentional per D-07/Q3: reserved overflow home with no menu content and no onClick. Not a data stub; it is a deliberately-empty affordance whose menu is out of scope for Phase 18 (the plan explicitly requires it inert).

## Next Phase Readiness
- `TopActionBar` is complete, standalone, and unmounted. Ready for 18-09 to import it, wire the same three props (`onOpenClick`/`onReplaceClick`/`onExportClick`) App uses today for the ribbon, and delete `RibbonToolbar.tsx`.
- ToolRail (18-06), ContextBar (18-07), and status-line (18-08) RED tests remain RED as expected — they are separate later plans and are unaffected by this standalone component.

## Verification Results
- `npx vitest run src/tests/top-action-bar-file-ops.test.ts src/tests/top-action-bar-nav.test.ts src/tests/view-mode-toggle.test.ts src/tests/visibility-markdirty.test.ts` → **4 files / 22 tests GREEN**
- `npm run typecheck` (typecheck:node + typecheck:web) → **exit 0**
- Full `npx vitest run` → **817 passed, 1 failed**; the only failing test is `status-line.test.ts` (StatusBar nudge branch, a later-plan Wave-0 RED test) and 6 unresolved-import files (`ToolRail`/`ContextBar` — later plans 18-06/18-07). None reference `TopActionBar`; no regression introduced by this plan.

## Self-Check: PASSED
- `src/renderer/src/components/TopActionBar.tsx` exists on disk (481 lines).
- Commit `cd9cef0` (Task 1) and `23684c4` (Task 2) present in `git log`.
- Four target test files GREEN; typecheck clean.

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
