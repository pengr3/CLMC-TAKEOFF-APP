---
phase: 02-scale-calibration
plan: 01
subsystem: state
tags: [zustand, scale, calibration, math, tdd, vitest, typescript]

requires:
  - phase: 01-pdf-viewer-canvas-foundation
    provides: viewerStore with pageViewports + per-page state pattern
provides:
  - Pure scale math library (Euclidean distance, pixelsPerUnit ratio, real-world conversion, ratio formatting)
  - MeasurementUnit / ScaleState / ActiveTool / CalibrationPoint type definitions
  - Per-page scale storage in Zustand (independent per page, mirrors pageViewports pattern)
  - activeTool state machine (select | scale | verify-scale)
  - resetViewer + setFile clear scale state and reset tool
affects: [02-02-scale-ui, phase-03-markups, phase-05-export]

tech-stack:
  added: []
  patterns:
    - "Pure pure-function math library with throw-on-invalid-input contracts"
    - "Per-page state in Zustand using Record<number, T> mirroring pageViewports"
    - "Tool-mode state machine (activeTool) for click interpretation"
    - "TDD: failing test commit before implementation commit (test → feat pair)"

key-files:
  created:
    - src/renderer/src/lib/scale-math.ts
    - src/tests/scale-math.test.ts
    - src/tests/scale-store.test.ts
  modified:
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/stores/viewerStore.ts

key-decisions:
  - "Throw on non-positive inputs in computePixelsPerUnit and pixelsToRealWorld rather than returning NaN/0 — fail loudly on bad calibration"
  - "getPageScale returns null (not undefined) so callers can use truthy checks reliably"
  - "clearPageScale uses object destructuring to remove the key, not assigning undefined"
  - "setFile clears pageScales and activeTool — opening a new PDF must not inherit calibration from a previous one"
  - "MeasurementUnit type lives in types/viewer.ts (single source of truth) and is imported by scale-math.ts"

patterns-established:
  - "Pure scale math module: tested in isolation, no React/Konva dependencies"
  - "Per-page Record<number, ScaleState> mirroring the existing pageViewports pattern"
  - "TDD commit pair: test() commit (RED) followed by feat() commit (GREEN)"

requirements-completed: [SCAL-01, SCAL-02, SCAL-03, SCAL-04]

duration: 2min
completed: 2026-04-07
---

# Phase 02 Plan 01: Scale Calibration Foundation Summary

**Pure scale math library and per-page Zustand scale state with activeTool machine, all TDD-proven (38 new tests, 0 regressions).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T03:10:55Z
- **Completed:** 2026-04-07T03:12:57Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)
- **Tests:** 38 new (24 scale-math + 14 scale-store), 69 total green

## Accomplishments

- Pure `scale-math.ts` library with Euclidean distance, pixels-per-unit ratio, real-world conversion, and human-readable ratio formatting
- Strict input contracts: `computePixelsPerUnit` and `pixelsToRealWorld` throw on non-positive inputs, preventing silent calibration corruption
- `MeasurementUnit`, `ScaleState`, `ActiveTool`, `CalibrationPoint` types added without disturbing existing types
- Per-page scale storage in `viewerStore` (`pageScales: Record<number, ScaleState>`) — page 1 calibration is provably independent of page 2
- `activeTool` state machine — `'select' | 'scale' | 'verify-scale'`, defaulting to `'select'`
- Both `resetViewer` and `setFile` clear scale state and reset the active tool to prevent stale calibration leaking across files
- Zero regressions: all 41 existing Phase 1 tests still green

## Task Commits

1. **Task 1 RED: scale math tests** — `c323e25` (test)
2. **Task 1 GREEN: scale math + types** — `e529d2d` (feat)
3. **Task 2 RED: scale store tests** — `99d1afd` (test)
4. **Task 2 GREEN: pageScales + activeTool in store** — `b8a0e4d` (feat)

## Files Created/Modified

- `src/renderer/src/lib/scale-math.ts` — Pure math: euclideanDistance, computePixelsPerUnit, pixelsToRealWorld, formatScaleRatio, UNIT_LABELS
- `src/renderer/src/types/viewer.ts` — Added MeasurementUnit, ScaleState, ActiveTool, CalibrationPoint, extended ViewerState with pageScales/activeTool/4 actions
- `src/renderer/src/stores/viewerStore.ts` — pageScales/activeTool initial state, setPageScale/getPageScale/clearPageScale/setActiveTool actions, updated resetViewer + setFile
- `src/tests/scale-math.test.ts` — 24 unit tests covering happy paths, error contracts, round-trip math
- `src/tests/scale-store.test.ts` — 14 unit tests covering per-page independence, tool transitions, reset/setFile clearing

## Decisions Made

- **Throw on non-positive inputs in scale math:** A zero or negative pixel/real-world distance is meaningless; throwing surfaces calibration UI bugs immediately rather than producing NaN/Infinity that pollutes downstream measurements.
- **`getPageScale` returns `null` (not `undefined`):** Lets callers use `if (scale)` checks without TypeScript narrowing surprises and makes "uncalibrated" an explicit value rather than absence.
- **`clearPageScale` removes the key via destructuring:** Avoids leaving `undefined` values in the record that would still appear in `Object.keys()` iteration.
- **`setFile` and `resetViewer` both clear scale + activeTool:** Preventing stale calibration from a previous PDF leaking onto a new file is non-negotiable. Mirrors the existing `pageViewports` reset behavior.
- **`MeasurementUnit` type lives in `types/viewer.ts`, not `scale-math.ts`:** Single source of truth; the store needs the type and shouldn't pull in math.
- **TDD applied as commit pairs (test → feat), not squashed:** Provides a true RED commit in history so future contributors can verify the tests genuinely fail without the implementation.

## Deviations from Plan

None — plan executed exactly as written. RED → GREEN cycles produced expected failures, then expected passes. Test counts (24 + 14 = 38) exceeded the plan's minimums (15 + 10 = 25). Typecheck clean on first run.

## Issues Encountered

None.

## User Setup Required

None — pure code changes, no external services.

## Next Phase Readiness

- **Wave 2 (Plan 02-02 — Scale UI layer) is unblocked.** All math functions and store actions consumed by the UI exist with stable signatures.
- All four phase requirements (SCAL-01..04) have their math/state foundations in place. Plan 02-02 will wire these into the canvas, dialog, status bar, and toolbar.
- The `getRelativePointerPosition()` coordinate-conversion pattern documented in research is the next thing to apply in Plan 02-02; no Wave 1 code touched canvas click handling, so there is no risk of mismatch.
- No blockers.

## Self-Check: PASSED

- FOUND: src/renderer/src/lib/scale-math.ts
- FOUND: src/renderer/src/types/viewer.ts (extended)
- FOUND: src/renderer/src/stores/viewerStore.ts (extended)
- FOUND: src/tests/scale-math.test.ts
- FOUND: src/tests/scale-store.test.ts
- FOUND commit: c323e25 (test scale-math)
- FOUND commit: e529d2d (feat scale-math)
- FOUND commit: 99d1afd (test scale-store)
- FOUND commit: b8a0e4d (feat scale-store)
- All 69 tests passing, typecheck clean

---
*Phase: 02-scale-calibration*
*Completed: 2026-04-07*
