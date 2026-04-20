---
phase: 02-scale-calibration
plan: 02
subsystem: ui
tags: [calibration, konva, react, zustand, scale, toolbar, statusbar]

# Dependency graph
requires:
  - phase: 02-scale-calibration/02-01
    provides: scale-math functions (euclideanDistance, computePixelsPerUnit, pixelsToRealWorld, formatScaleRatio), ScaleState/ActiveTool/CalibrationPoint types, viewerStore scale extensions (setPageScale, getPageScale, clearPageScale, setActiveTool, pageScales)
provides:
  - useCalibration hook: two-click calibration state machine with page-space coordinate conversion via Stage inverse transform
  - CalibrationDialog component: modal for real-world distance entry with live scale preview
  - CanvasViewport calibration overlay: zoom-compensated circles, dashed line, persistent reference line, not-calibrated badge
  - Toolbar Set Scale and Verify Scale buttons with active state highlighting
  - StatusBar scale ratio display (calibrated) or "Not calibrated" warning (yellow, uncalibrated)
affects: [03-markup-tools, 04-project-persistence, 05-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage inverse transform for page-space conversion: stage.getAbsoluteTransform().copy().invert().point(pointer)"
    - "Zoom-compensated Konva visuals: radius={6 / currentZoom}, strokeWidth={1 / currentZoom}"
    - "Named visual constants at render time: const POINT_RADIUS = 6 / currentZoom"
    - "Module-level ref for cross-component canvas controls (established Phase 1, confirmed here)"
    - "Tool active state in IconButton: active prop drives background + bottom border accent"

key-files:
  created:
    - src/renderer/src/hooks/useCalibration.ts
    - src/renderer/src/components/CalibrationDialog.tsx
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/Toolbar.tsx
    - src/renderer/src/components/StatusBar.tsx

key-decisions:
  - "Zoom-compensated visual sizes computed as named constants at render time (not inline) for readability"
  - "CalibrationDialog cancel keeps activeTool as scale so user can immediately retry without re-clicking the toolbar"
  - "Not-calibrated badge appears only in select mode (not while actively calibrating) to avoid overlay clutter"
  - "useEffect resets calibrationPoints on both currentPage AND activeTool change — prevents partial calibrations leaking across page navigation"

patterns-established:
  - "Stage inverse transform pattern: the canonical way to convert screen-space Konva pointer coordinates to PDF page-space"
  - "Zoom-compensated Konva overlay: all visual sizes divided by currentZoom so they appear constant size at all zoom levels"
  - "Tool button active state: IconButton active prop sets COLORS.activeSurface background + 2px accent bottom border"

requirements-completed: [SCAL-01, SCAL-02, SCAL-03, SCAL-04]

# Metrics
duration: 8min
completed: 2026-04-20
---

# Phase 02 Plan 02: Scale Calibration UI Summary

**Interactive calibration workflow wired end-to-end: Set Scale toolbar button -> two-click canvas line drawing (zoom-compensated) -> CalibrationDialog (distance + unit + live preview) -> per-page ScaleState stored in viewerStore -> StatusBar ratio display or yellow "Not calibrated" warning**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-20T02:34:30Z
- **Completed:** 2026-04-20T02:42:00Z
- **Tasks:** 2 auto + 1 checkpoint (Task 3 human verification: PASSED — all 13 steps approved 2026-04-17)
- **Files modified:** 5

## Accomplishments

- `useCalibration` hook: full two-click calibration state machine with correct page-space coordinate conversion (Stage inverse absolute transform), per-page scale storage, verify-scale mode, Escape key cancel, and reset on page/tool change
- `CalibrationDialog` component: modal overlay with pixel distance display, real-world distance input (autoFocus), unit dropdown with UNIT_LABELS, live scale preview updating as user types, Enter key submit, disabled Accept until valid input
- `CanvasViewport` calibration overlay: zoom-compensated `<Circle>` endpoints (radius=6/zoom) and dashed `<Line>` during active calibration; faint persistent reference line (opacity 0.3) after calibration; "Scale not set" badge with "Set Scale" button when uncalibrated in select mode; `CalibrationDialog` rendered after Stage; verify-scale result overlay with measured real-world length and "Done" button
- `Toolbar` Set Scale and Verify Scale buttons with `active` prop highlighting (activeSurface background + accent bottom border); Verify button disabled when page has no scale
- `StatusBar` shows `Scale: {formatScaleRatio(...)}` when calibrated or orange "Not calibrated" (`#e8a838`, fontWeight 600) when not

## Task Commits

Tasks 1 and 2 implementation was committed in the remote history and merged at:

1. **Task 1: Calibration hook, dialog, and canvas integration** - `d54f136` (merge: sync local planning docs with remote implementation history)
2. **Task 2: Toolbar buttons and StatusBar scale display** - `d54f136` (merge: sync local planning docs with remote implementation history)
3. **Task 3: Visual verification** - APPROVED 2026-04-17 — all 13 verification steps passed

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/renderer/src/hooks/useCalibration.ts` — Calibration state machine hook: two-click handler, dialog trigger, verify-scale mode, coordinate conversion, Escape key listener
- `src/renderer/src/components/CalibrationDialog.tsx` — Modal dialog for real-world distance entry with UNIT_LABELS dropdown and live scale preview
- `src/renderer/src/components/CanvasViewport.tsx` — Added calibration overlay layer (circles, dashed line, reference line, not-calibrated badge, dialog and result overlays), crosshair cursor for active tools
- `src/renderer/src/components/Toolbar.tsx` — Added Set Scale (Ruler icon) and Verify (CheckCircle icon) buttons with active state, disabled Verify when no page scale
- `src/renderer/src/components/StatusBar.tsx` — Added scale section: calibrated scale ratio or yellow "Not calibrated" warning

## Decisions Made

- **CalibrationDialog cancel keeps activeTool as 'scale'** — user can immediately retry the line draw without clicking the toolbar button again
- **Not-calibrated badge only in select mode** — avoids overlapping with active calibration UI (circles, dashed line)
- **POINT_RADIUS and LINE constants defined at render** — computes `6 / currentZoom` as named constants rather than inline in JSX props for readability
- **useEffect resets on both currentPage and activeTool** — ensures partial calibrations never survive page navigation (research pitfall #5 from 02-RESEARCH.md)

## Deviations from Plan

None — plan executed exactly as written. Implementation existed in repository prior to this execution session (committed in remote history merge `d54f136`). Both tasks verified against all acceptance criteria — all criteria pass. 69 unit tests passing, `npx tsc --noEmit` exits with code 0.

## Issues Encountered

None.

## Known Stubs

None — all calibration functionality is fully wired. Scale data flows from user interaction through hook -> store -> StatusBar display.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scale calibration complete. Phase 03 markup tools can use `getPageScale(currentPage)` to retrieve `pixelsPerUnit` for linear, area, and perimeter measurements
- The `useCalibration` hook pattern (stage inverse transform for page-space coordinates) is the canonical approach for Phase 03 markup placement
- Per-page scale independence confirmed via 6 dedicated store tests
- Human visual verification (Task 3 checkpoint) COMPLETE — all 13 steps passed 2026-04-17. Plan 02-02 fully closed.

---
*Phase: 02-scale-calibration*
*Completed: 2026-04-20*
