---
phase: 02-scale-calibration
plan: 03
subsystem: ui
tags: [calibration, verify, scale, zustand, react, konva, toast, context-menu, status-bar, vitest]

# Dependency graph
requires:
  - phase: 02-scale-calibration/02-01
    provides: scale-math functions, ScaleState/ActiveTool types, viewerStore scale extensions
  - phase: 02-scale-calibration/02-02
    provides: useCalibration hook, CalibrationDialog, CanvasViewport calibration overlay, Toolbar buttons, StatusBar scale display

provides:
  - scaleStore (Zustand) with mm-based canonical scale (pixelsPerMm, displayUnit), calibMode reactive field
  - types/scale.ts with ScaleUnit, CalibMode, PageScale, MM_PER_UNIT, DEFAULT_UNIT
  - scale-math.ts extended: computePixelsPerMm, pixelLength, toMm, fromMm, new pixelsToRealWorld(3-arg), single-arg formatScaleRatio returning "1:N"
  - useCalibrationMode hook: isVerify flag, activateVerify(), setCalibMode writes on every transition
  - ScalePopup component: confirm mode (distance entry + live ratio) + verify mode (read-only measured distance)
  - ScaleContextMenu component: right-click Recalibrate/Verify scale menu with Escape+outside-click dismissal
  - ConfirmationToast component: persistent (no auto-dismiss) post-calibration toast with Verify/Dismiss actions
  - StatusBar fourth segment: "Scale: 1:N" calibrated / "Scale: Not Set" amber / "Scale: —" no PDF
  - Toolbar chevron U+25BE hint when page calibrated; opens ScaleContextMenu on left-click or right-click
  - CanvasViewport: migrated to useCalibrationMode + ScalePopup, getCalibrationControls() module ref, toast persistence effects
  - 6 new unit tests (status-bar-scale.test.ts) proving SCAL-03 selection logic

affects: [03-markup-tools, 04-project-persistence, 05-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mm-based canonical scale storage: pixelsPerMm in all stores; display unit kept separately for formatting only"
    - "Persistent toast via parent useEffect (not component timer): dismissal owned by CanvasViewport, not ConfirmationToast"
    - "Dual entry point for verify: toast Verify link OR Toolbar chevron/right-click context menu"
    - "Module-level ref pattern extended to getCalibrationControls() alongside getCanvasControls()"
    - "isVerify flag on CalibrationState propagates through confirming state so ScalePopup branches correctly"
    - "formatScaleRatio overloaded: single-arg (pixelsPerMm) returns '1:N', two-arg (ppu, unit) returns legacy string"

key-files:
  created:
    - src/renderer/src/types/scale.ts
    - src/renderer/src/stores/scaleStore.ts
    - src/renderer/src/hooks/useCalibrationMode.ts
    - src/renderer/src/components/ScalePopup.tsx
    - src/renderer/src/components/ScaleContextMenu.tsx
    - src/renderer/src/components/ConfirmationToast.tsx
    - src/tests/status-bar-scale.test.ts
  modified:
    - src/renderer/src/lib/constants.ts
    - src/renderer/src/lib/scale-math.ts
    - src/renderer/src/components/StatusBar.tsx
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/Toolbar.tsx

key-decisions:
  - "Canonical scale representation is pixelsPerMm (not pixelsPerUnit) — unit-independent storage enables unit-switching without recalibrating"
  - "ConfirmationToast has no setTimeout: pure presentational component, parent owns dismissal lifecycle (MEDIUM #3)"
  - "formatScaleRatio single-arg form returns '1:N' (integer round of mm/pixel), not 'Npx = X unit' — matches how estimators read drawing scales"
  - "useCalibration.ts and CalibrationDialog.tsx kept intact — CanvasViewport migrated to useCalibrationMode but old files preserved for reference"
  - "ScaleStore is separate from ViewerStore — keeps scale concerns orthogonal to viewport/PDF navigation concerns"

patterns-established:
  - "mm-based canonical scale: store pixelsPerMm once, convert to display unit at render time"
  - "Persistent toast: parent useEffect on page + mode changes, no component-level timer"
  - "Context menu via fixed positioning triggered from both left-click (chevron) and right-click (button)"

requirements-completed: [SCAL-03, SCAL-04]

# Metrics
duration: 7min
completed: 2026-04-17
---

# Phase 02 Plan 03: Scale Calibration Polish Summary

**Status bar Scale segment (SCAL-03), persistent verify toast, chevron context menu (SCAL-04), and mm-based scaleStore — closes Phase 2 scale calibration with all four SCAL requirements delivered.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-17T11:00:00Z
- **Completed:** 2026-04-17T11:07:00Z
- **Tasks:** 3 (+ Step 0 pre-work: 5 infrastructure files)
- **Files modified:** 12 (7 created, 5 modified)
- **Tests:** 6 new (status-bar-scale), 75 total green

## Accomplishments

- New `scaleStore` (Zustand) with mm-based `PageScale { pixelsPerMm, displayUnit }` canonical shape; `calibMode` reactive field subscribed by Toolbar
- `StatusBar` fourth segment reads `scaleStore.getScale(currentPage)` and renders three variants: `"Scale: 1:N"` (calibrated), `"Scale: Not Set"` in amber warning color (uncalibrated), `"Scale: —"` (no PDF) — SCAL-03 complete
- `ConfirmationToast` is a pure presentational component with NO auto-dismiss timer; parent `CanvasViewport` dismisses it on page change, new calibration start, or user action — MEDIUM #3 from review addressed
- `ScaleContextMenu` provides right-click `Recalibrate` + `Verify scale` with Escape/outside-click dismissal; `Toolbar` chevron `▾` (U+25BE) appears when page is calibrated, giving a visual hint that the context menu exists — LOW #6 from review addressed
- `ScalePopup` supports `mode='confirm'` (replaces CalibrationDialog for the new hook) and `mode='verify'` (read-only measured distance, no mutation) — SCAL-04 verify-mode complete
- `useCalibrationMode` hook with `isVerify` flag and `activateVerify()` function; every mode transition writes `scaleStore.setCalibMode()` so Toolbar can subscribe reactively without polling
- 6 unit tests in `status-bar-scale.test.ts` covering all three display states including unit-independence test

## Task Commits

1. **Step 0 + Task 1: Infrastructure + useCalibrationMode/ScalePopup/ScaleContextMenu/ConfirmationToast** — `2866863` (feat)
2. **Task 2: StatusBar Scale segment + status-bar-scale.test.ts** — `ace8e5d` (feat)
3. **Task 3: CanvasViewport verify flow + Toolbar chevron/context menu** — `dfbdc51` (feat)

## Files Created/Modified

- `src/renderer/src/types/scale.ts` — ScaleUnit, CalibMode, PageScale, MM_PER_UNIT, DEFAULT_UNIT
- `src/renderer/src/stores/scaleStore.ts` — pageScales/globalUnit/calibMode; setScale/getScale/clearScale/setCalibMode
- `src/renderer/src/hooks/useCalibrationMode.ts` — CalibrationState with isVerify flag; activate/activateVerify/cancel; setCalibMode writes on every transition
- `src/renderer/src/lib/scale-math.ts` — Extended: computePixelsPerMm, pixelLength, toMm, fromMm; overloaded pixelsToRealWorld (3-arg); overloaded formatScaleRatio (single-arg "1:N")
- `src/renderer/src/lib/constants.ts` — Added COLORS.warning: '#e8a838'
- `src/renderer/src/components/ScalePopup.tsx` — Inline popup: confirm mode (distance input + live ratio) and verify mode (read-only measured distance + Dismiss)
- `src/renderer/src/components/ScaleContextMenu.tsx` — Right-click menu: Recalibrate + Verify scale; Escape/outside-click dismissal
- `src/renderer/src/components/ConfirmationToast.tsx` — Persistent toast: "Scale set to 1:N. Verify by measuring a second line?" with Verify/Dismiss link buttons; NO auto-dismiss timer
- `src/renderer/src/components/StatusBar.tsx` — Migrated to scaleStore; fourth Scale segment with three display states; aria-live=polite
- `src/renderer/src/components/CanvasViewport.tsx` — Migrated to useCalibrationMode + ScalePopup; getCalibrationControls() ref; toast persistence useEffects
- `src/renderer/src/components/Toolbar.tsx` — Migrated calibMode to scaleStore; chevron U+25BE when calibrated; onContextMenu + handleChevronClick; ScaleContextMenu rendered
- `src/tests/status-bar-scale.test.ts` — 6 unit tests for StatusBar scale segment selection logic (SCAL-03)

## Decisions Made

- **mm-based canonical scale representation:** `pixelsPerMm` stored everywhere; `displayUnit` kept separately for rendering only. This decouples unit preference from scale accuracy — user can switch display unit without recalibrating.
- **`ConfirmationToast` pure presentational:** Parent owns the toast lifecycle. Avoids React cleanup race conditions with `setTimeout` inside components. Dismissal triggered by explicit `useEffect` watchers in `CanvasViewport`.
- **`formatScaleRatio` single-arg returns `"1:N"`:** Estimators think in drawing scale ratios (1:100, 1:50), not "1px = 0.01mm". Integer rounding keeps the display readable for typical construction scale ranges.
- **`useCalibration.ts` + `CalibrationDialog.tsx` preserved:** They are self-contained and not harmful to keep. Removing them now is unnecessary churn.
- **Separate `scaleStore` from `viewerStore`:** Keeps scale state orthogonal to viewport/PDF navigation; allows Phase 3 markup tools to import only what they need.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Step 0 infrastructure before plan tasks**
- **Found during:** Pre-execution analysis
- **Issue:** Plan 02-03 references `scaleStore.ts`, `types/scale.ts`, `useCalibrationMode.ts`, extended `scale-math.ts` — none existed in the codebase (the Wave 1/2 executed builds used the old `pixelsPerUnit`/`unit` API)
- **Fix:** Created all five infrastructure files as Step 0 before executing plan tasks; extended scale-math.ts with mm-based functions while preserving old API for backward compatibility
- **Files modified:** types/scale.ts (new), stores/scaleStore.ts (new), hooks/useCalibrationMode.ts (new), lib/scale-math.ts (extended), lib/constants.ts (COLORS.warning added)
- **Committed in:** `2866863` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical infrastructure)
**Impact on plan:** Infrastructure was a prerequisite, not new scope. All plan tasks executed exactly as specified once infrastructure was in place.

## Issues Encountered

- Pre-existing TypeScript error in `useViewportControls.ts` (line 14 — argument type mismatch on ZOOM_STEPS literal union). Not caused by this plan. Documented as pre-existing; no fix applied (out of scope per deviation rule SCOPE BOUNDARY).

## Known Stubs

None — all functionality is fully wired. Scale data flows end-to-end:
- User draws line → `useCalibrationMode` computes pixel length
- ScalePopup confirm → `computePixelsPerMm` → `scaleStore.setScale(page, pixelsPerMm, displayUnit)`
- `StatusBar` subscribes to `scaleStore.getScale(currentPage)` → renders `formatScaleRatio(pixelsPerMm)` → "1:N"
- `ConfirmationToast` "Verify" → `activateVerify()` → user draws second line → ScalePopup verify mode → `pixelsToRealWorld(length, pixelsPerMm, displayUnit)` → display only, no mutation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 2 Scale Calibration complete.** All four SCAL requirements (SCAL-01..04) delivered across Plans 01-03.
- Phase 3 markup tools can call `useScaleStore.getState().getScale(currentPage)` to retrieve `pixelsPerMm` for linear, area, and perimeter measurements
- The `formatScaleRatio(pixelsPerMm)` single-arg signature is the canonical display format going forward
- The `computePixelsPerMm` / `pixelsToRealWorld` (3-arg) functions are the canonical math API for Phase 3+
- No blockers.

## Self-Check: PASSED

- FOUND: src/renderer/src/types/scale.ts
- FOUND: src/renderer/src/stores/scaleStore.ts
- FOUND: src/renderer/src/hooks/useCalibrationMode.ts
- FOUND: src/renderer/src/components/ScalePopup.tsx
- FOUND: src/renderer/src/components/ScaleContextMenu.tsx
- FOUND: src/renderer/src/components/ConfirmationToast.tsx
- FOUND: src/renderer/src/components/StatusBar.tsx (modified)
- FOUND: src/renderer/src/components/CanvasViewport.tsx (modified)
- FOUND: src/renderer/src/components/Toolbar.tsx (modified)
- FOUND: src/tests/status-bar-scale.test.ts
- FOUND commit: 2866863 (Task 1)
- FOUND commit: ace8e5d (Task 2)
- FOUND commit: dfbdc51 (Task 3)
- All 75 tests passing, only pre-existing typecheck error (useViewportControls.ts)

---
*Phase: 02-scale-calibration*
*Completed: 2026-04-17*
