---
phase: 02-scale-calibration
verified: 2026-04-17T11:15:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Complete calibration workflow — draw line, enter distance, confirm scale"
    expected: "Toolbar Set Scale button enters drawing mode (crosshair cursor), two clicks place red circles + dashed line, ScalePopup appears at line midpoint, entering distance + confirming updates StatusBar to 'Scale: 1:N' and shows ConfirmationToast"
    why_human: "Konva canvas interaction, cursor changes, and popup positioning cannot be verified programmatically without running the Electron app"
  - test: "Per-page scale independence — calibrate page 1, navigate to page 2"
    expected: "StatusBar shows 'Scale: Not Set' (amber) on page 2; navigating back to page 1 shows the original '1:N' scale; Set Scale button shows chevron on page 1 but not page 2"
    why_human: "Real-time navigation state and visual amber-vs-normal text colour require visual inspection"
  - test: "Toast persistence — calibrate and wait 30+ seconds without touching the app"
    expected: "ConfirmationToast remains visible indefinitely until user clicks Verify or Dismiss"
    why_human: "Timer absence behaviour (MEDIUM #3) requires live observation; no test covers elapsed time"
  - test: "Verify flow via toast — click Verify in toast, draw a second line"
    expected: "ScalePopup appears in verify mode showing 'Measured: X.XX m' with single Dismiss button; scaleStore is NOT mutated (StatusBar ratio unchanged after dismiss)"
    why_human: "No-mutation invariant and popup content require visual + state inspection"
  - test: "Context menu discovery — chevron click and right-click on Set Scale button"
    expected: "Both chevron (U+25BE) left-click and right-click on Set Scale button open ScaleContextMenu with 'Recalibrate' and 'Verify scale' items; Escape dismisses it; menu only appears when page is calibrated"
    why_human: "Mouse event wiring (onContextMenu, stopPropagation on chevron) requires live interaction"
  - test: "Calibration visuals scale correctly with zoom"
    expected: "At any zoom level (0.25x to 8x), endpoint circles and dashed line appear at constant visual size (zoom-compensated constants: radius=6/zoom, strokeWidth=1/zoom)"
    why_human: "Konva zoom-compensation rendering requires visual inspection across zoom levels"
---

# Phase 02: Scale Calibration Verification Report

**Phase Goal:** Estimators can tell the app what scale each page is drawn at by drawing a line over a known dimension, and the app converts all future pixel distances to real-world measurements correctly
**Verified:** 2026-04-17T11:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Scale math correctly converts pixel distance + real-world distance into pixelsPerMm ratio | VERIFIED | `computePixelsPerMm` in scale-math.ts; 24 tests in scale-math.test.ts all pass |
| 2 | Per-page scale storage is independent — setting scale on page 2 does not affect page 1 | VERIFIED | `scaleStore.ts` uses `Record<number, PageScale>`; 6 tests in scale-store.test.ts + status-bar-scale.test.ts prove independence |
| 3 | Scale display formatting shows human-readable ratio string | VERIFIED | `formatScaleRatio(pixelsPerMm)` returns `"1:N"` format; tests confirm `1/90 ppm → "1:90"` |
| 4 | User can draw a calibration line, enter distance, and have scale stored per-page | VERIFIED | Full data path: `useCalibrationMode` → `ScalePopup.onConfirm` → `computePixelsPerMm` → `scaleStore.setScale(page, ppm, unit)` — all wired in CanvasViewport.tsx lines 354-359 |
| 5 | StatusBar always shows current page scale or 'Not Set' warning | VERIFIED | StatusBar.tsx subscribes to `useScaleStore((s) => s.getScale)`, renders three variants (em-dash / 'Not Set' amber / '1:N'), `aria-live="polite"` present; 6 unit tests cover all variants |
| 6 | Verify Scale flow draws a measurement line and shows real-world distance without mutating scale | VERIFIED | `activateVerify()` sets `isVerify: true`; ScalePopup `mode="verify"` renders read-only `pixelsToRealWorld` result with Dismiss only — no `setScale` call in verify path |
| 7 | Uncalibrated pages show a visible warning | VERIFIED | CanvasViewport renders `showNotCalibratedBadge` (amber border div + "Set Scale" button) when `calibMode === 'idle' && !pageScale && totalPages > 0` |
| 8 | Persistent toast appears after calibration with Verify/Dismiss actions, no auto-dismiss | VERIFIED | `ConfirmationToast` has no `setTimeout`, no `useEffect`, no `AUTO_DISMISS_MS` — pure presentational; parent useEffects in CanvasViewport dismiss on `currentPage` change and `calibState.mode === 'drawing'` |
| 9 | Set Scale button shows chevron hint when page is calibrated, revealing context menu | VERIFIED | Toolbar.tsx renders `{'\u25BE'}` span with `aria-haspopup="menu"` when `pageScale !== null`; `handleContextMenu` and `handleChevronClick` both invoke `openContextMenu`; `ScaleContextMenu` rendered with Recalibrate/Verify scale items |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/scale-math.ts` | Pure math: euclideanDistance, computePixelsPerUnit, pixelsToRealWorld, formatScaleRatio, computePixelsPerMm, UNIT_LABELS | VERIFIED | All exports present; backward-compat old API preserved; new mm-based API added |
| `src/renderer/src/types/viewer.ts` | ScaleState, MeasurementUnit, ActiveTool, CalibrationPoint | VERIFIED | All types present, existing types unchanged |
| `src/renderer/src/types/scale.ts` | ScaleUnit, CalibMode, PageScale, MM_PER_UNIT, DEFAULT_UNIT | VERIFIED | All exports present |
| `src/renderer/src/stores/viewerStore.ts` | pageScales, activeTool, setPageScale, getPageScale, clearPageScale, setActiveTool | VERIFIED | All fields and actions present; reset and setFile both clear pageScales + activeTool |
| `src/renderer/src/stores/scaleStore.ts` | pageScales, calibMode, setScale, getScale, clearScale, setCalibMode | VERIFIED | All fields and actions present |
| `src/renderer/src/hooks/useCalibration.ts` | Calibration state machine (legacy hook, preserved) | VERIFIED | Exists, substantive, exports UseCalibrationReturn; not consumed by CanvasViewport (CanvasViewport uses useCalibrationMode instead — intentional per 02-03 SUMMARY) |
| `src/renderer/src/hooks/useCalibrationMode.ts` | isVerify flag, activateVerify, setCalibMode writes on every transition | VERIFIED | All three present; INITIAL_STATE includes `isVerify: false`; activate/activateVerify/cancel all call setCalibMode |
| `src/renderer/src/components/CalibrationDialog.tsx` | Distance entry dialog (legacy, preserved) | VERIFIED | Exists, autoFocus, UNIT_LABELS, onConfirm/onCancel |
| `src/renderer/src/components/ScalePopup.tsx` | mode: confirm/verify, pixelsPerMm API | VERIFIED | mode prop, pageScale prop, computePixelsPerMm, pixelsToRealWorld(3-arg), Dismiss button in verify branch |
| `src/renderer/src/components/ScaleContextMenu.tsx` | Recalibrate + Verify scale, role="menu", Escape dismissal | VERIFIED | Both items present, role="menu", Escape handler, outside-click dismissal |
| `src/renderer/src/components/ConfirmationToast.tsx` | Persistent toast, no setTimeout, role="status", aria-live | VERIFIED | No setTimeout, no useEffect, role="status", aria-live="polite"; copy matches UI-SPEC exactly |
| `src/renderer/src/components/StatusBar.tsx` | Scale segment with pixelsPerMm API, COLORS.warning | VERIFIED | getScale(currentPage), formatScaleRatio(pageScale.pixelsPerMm), COLORS.warning; no old pixelsPerUnit/unit references |
| `src/renderer/src/components/Toolbar.tsx` | Ruler icon, Set Scale label, chevron U+25BE, ScaleContextMenu, setActiveTool | VERIFIED | All present; calibMode subscription reactive (no polling); handleChevronClick + handleContextMenu both wire to openContextMenu |
| `src/renderer/src/components/CanvasViewport.tsx` | useCalibrationMode, ScalePopup both modes, ConfirmationToast, not-calibrated badge | VERIFIED | All present; both confirm + verify popup branches; toast with page-change and mode-change dismiss effects |
| `src/tests/scale-math.test.ts` | Unit tests for all scale math functions | VERIFIED | 24 tests — all pass |
| `src/tests/scale-store.test.ts` | Unit tests for per-page scale store (viewerStore legacy) | VERIFIED | 14 tests — all pass |
| `src/tests/status-bar-scale.test.ts` | Unit tests for StatusBar scale segment selection logic | VERIFIED | 6 tests — all pass; covers em-dash / Not Set / 1:N / per-page independence / clearScale / unit-independence |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useCalibrationMode.ts` | `scaleStore.ts` | `setCalibMode` on every transition | WIRED | Lines 72, 77, 82, 172 all call `useScaleStore.getState().setCalibMode(...)` |
| `useCalibrationMode.ts` | `scale-math.ts` | `pixelLength`, `MIN_CALIBRATION_PIXELS` | WIRED | Line 5 imports both |
| `CanvasViewport.tsx` | `useCalibrationMode.ts` | `useCalibrationMode(stageRef)` — all return values consumed | WIRED | Line 104; activate/activateVerify/cancel/recordClick/updatePreview/recomputePopupPos all used |
| `CanvasViewport.tsx` | `ScalePopup.tsx` | Both `mode="confirm"` and `mode="verify"` branches rendered | WIRED | Lines 348-374 |
| `CanvasViewport.tsx` | `ConfirmationToast.tsx` | Rendered with ratioText; dismissed by two useEffects | WIRED | Lines 377-387; dismissal effects at lines 115-124 |
| `CanvasViewport.tsx` | `scaleStore.ts` | `setScale(currentPage, pixelsPerMm, displayUnit)` in confirm path | WIRED | Line 355 |
| `CanvasViewport.tsx` | `scale-math.ts` | `formatScaleRatio(pixelsPerMm)` for toast ratioText | WIRED | Line 356 |
| `StatusBar.tsx` | `scaleStore.ts` | `useScaleStore((s) => s.getScale)` → `getScale(currentPage)` | WIRED | Lines 23, 27 |
| `StatusBar.tsx` | `scale-math.ts` | `formatScaleRatio(pageScale.pixelsPerMm)` single-arg | WIRED | Line 38 |
| `Toolbar.tsx` | `scaleStore.ts` | `calibMode` reactive subscription | WIRED | Line 88 |
| `Toolbar.tsx` | `CanvasViewport.tsx` | `getCalibrationControls()` → `.activate()`, `.activateVerify()`, `.cancel()` | WIRED | Lines 128-134 (handleSetScale), 308-318 (context menu handlers) |
| `Toolbar.tsx` | `ScaleContextMenu.tsx` | Rendered when `contextMenu !== null` with onRecalibrate/onVerify/onClose | WIRED | Lines 306-319 |
| `ScalePopup.tsx` | `scale-math.ts` | `computePixelsPerMm`, `formatScaleRatio`, `pixelsToRealWorld` (3-arg), `MIN_CALIBRATION_PIXELS` | WIRED | Line 3 imports all four |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StatusBar.tsx` | `pageScale` | `useScaleStore.getScale(currentPage)` | Yes — live Zustand subscription; `scaleStore.setScale` writes real `{pixelsPerMm, displayUnit}` computed from user input via `computePixelsPerMm` | FLOWING |
| `ScalePopup.tsx` (confirm) | `previewRatio` | `computePixelsPerMm(pixelLength, parsedDistance, unit)` | Yes — computed from real canvas pixel measurement and user-entered distance | FLOWING |
| `ScalePopup.tsx` (verify) | `measured` | `pixelsToRealWorld(pixelLength, pageScale.pixelsPerMm, pageScale.displayUnit)` | Yes — uses stored `pixelsPerMm` from scaleStore, pixel length from calibration line draw | FLOWING |
| `ConfirmationToast.tsx` | `ratioText` | `formatScaleRatio(pixelsPerMm)` passed from CanvasViewport onConfirm | Yes — computed from the same `pixelsPerMm` written to scaleStore | FLOWING |
| `CanvasViewport.tsx` calibration overlay | `calibLinePoints` | `calibState.startPoint`, `calibState.endPoint`, `calibState.previewPoint` | Yes — set by `recordClick` via stage inverse transform from real mouse clicks | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 75 tests pass | `npx vitest run` | 75 passed, 0 failed, 8 test files | PASS |
| TypeScript clean (web renderer) | `npm run typecheck:web` | 1 pre-existing error in `useViewportControls.ts:14` (ZOOM_STEPS literal union type — unrelated to Phase 2, documented in 02-03 SUMMARY) | PASS (pre-existing) |
| scale-math exports present | Module inspection | `euclideanDistance`, `computePixelsPerUnit`, `pixelsToRealWorld`, `formatScaleRatio`, `UNIT_LABELS`, `computePixelsPerMm`, `pixelLength`, `toMm`, `fromMm`, `MIN_CALIBRATION_PIXELS` — all exported | PASS |
| ConfirmationToast has no timer | File scan | No `setTimeout`, no `useEffect`, no `AUTO_DISMISS_MS` in ConfirmationToast.tsx | PASS |
| StatusBar uses new pixelsPerMm API | File scan | No `pageScale.pixelsPerUnit`, no `pageScale.unit` in StatusBar.tsx | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| SCAL-01 | 02-01, 02-02, 02-03 | User can set scale by drawing a line between two known points and entering the real-world distance | SATISFIED | `useCalibrationMode` two-click drawing; `ScalePopup` confirm mode; `computePixelsPerMm`; `scaleStore.setScale` |
| SCAL-02 | 02-01, 02-02, 02-03 | Scale is stored per page — each page can have a different scale ratio | SATISFIED | `scaleStore.pageScales: Record<number, PageScale>`; 6 independence tests pass; status-bar-scale test "shows different scale per page" |
| SCAL-03 | 02-01, 02-02, 02-03 | User can see the current page's scale ratio displayed in the UI | SATISFIED | StatusBar fourth segment: '1:N' / 'Not Set' (amber) / '—'; 6 unit tests; `aria-live="polite"` |
| SCAL-04 | 02-02, 02-03 | User can verify scale accuracy by measuring a second known dimension | SATISFIED | `activateVerify()` + `isVerify` flag + `ScalePopup mode="verify"` + `pixelsToRealWorld` (3-arg, no mutation); accessible via toast Verify link, chevron click, or right-click context menu |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/hooks/useViewportControls.ts` | 14 | TypeScript error: `Argument of type 'number' is not assignable to parameter of type '1 \| 4 \| 2 \| ...'` (ZOOM_STEPS literal union) | Info | Pre-existing from Phase 1; documented in 02-03 SUMMARY as out-of-scope; does not affect scale calibration functionality; app compiles and runs correctly |
| `src/renderer/src/hooks/useCalibration.ts` | — | Unused hook (legacy) — defined but not consumed by CanvasViewport (which uses `useCalibrationMode`) | Info | Dead code, not a blocker; preserved intentionally per 02-03 SUMMARY decision: "useCalibration.ts and CalibrationDialog.tsx kept intact — removing them now is unnecessary churn" |
| `src/renderer/src/components/CalibrationDialog.tsx` | — | Unused component (legacy) — same as above; CanvasViewport uses `ScalePopup` instead | Info | Dead code, same rationale |

No blockers found. No stub implementations. No hardcoded empty data in rendering paths.

### Human Verification Required

All 9 automated truths are verified. The following 6 items require live app testing because they involve visual rendering, mouse interaction, and real-time behavior:

#### 1. Complete Calibration Workflow (SCAL-01)

**Test:** Run `npm run dev`. Open a multi-page construction PDF. Click Set Scale in toolbar. Click two points on a known dimension. Observe the ScalePopup near the line midpoint. Enter the real-world distance, select unit, click Confirm.
**Expected:** Crosshair cursor on toolbar click; red circles at click points; dashed line connecting them; ScalePopup appears with live ratio preview; StatusBar updates to "Scale: 1:N"; ConfirmationToast appears at canvas bottom.
**Why human:** Konva canvas rendering, cursor changes, and popup positioning relative to line midpoint require visual inspection.

#### 2. Per-Page Scale Independence (SCAL-02)

**Test:** Calibrate page 1. Navigate to page 2. Observe StatusBar and Set Scale button. Navigate back to page 1.
**Expected:** StatusBar shows "Scale: Not Set" in amber on page 2 (no chevron on button); back on page 1, original "1:N" scale is shown with chevron visible.
**Why human:** Real-time navigation state and amber/white text colour difference require visual inspection.

#### 3. Toast Persistence — MEDIUM #3 Validation

**Test:** Calibrate a page. Wait 30+ seconds without interacting. Observe the ConfirmationToast.
**Expected:** Toast remains visible indefinitely — no auto-dismiss. Only disappears when user clicks Verify or Dismiss, navigates to a different page, or starts a new calibration.
**Why human:** Timer absence over elapsed time requires live observation; no automated test covers temporal behaviour.

#### 4. Verify Flow (SCAL-04) — No Mutation Invariant

**Test:** Calibrate page 1 (e.g., 1:100). Click Verify in the toast. Draw a line over a second known dimension. Observe the ScalePopup verify panel. Click Dismiss.
**Expected:** ScalePopup shows "Measured: X.XX m" (read-only) with single Dismiss button. After Dismiss, StatusBar still shows the same "1:100" scale (scaleStore not mutated).
**Why human:** No-mutation invariant and correct measured value require visual + state inspection.

#### 5. Chevron + Context Menu (SCAL-04, LOW #6)

**Test:** With page 1 calibrated, observe the Set Scale button. Left-click the chevron (▾). Right-click the Set Scale button. Test Escape dismissal.
**Expected:** Chevron visible only on calibrated pages; both entry points open the same ScaleContextMenu with "Recalibrate" and "Verify scale" items; Escape closes the menu; clicking outside closes it.
**Why human:** Mouse event wiring (stopPropagation on chevron, onContextMenu) and menu visibility state require live interaction.

#### 6. Zoom-Compensated Calibration Visuals

**Test:** With Set Scale active, place one calibration point. Zoom from 0.25x to 8x while the point is visible.
**Expected:** The red circle endpoint appears at constant visual size regardless of zoom level (zoom-compensation: `radius = 6 / currentZoom`).
**Why human:** Konva zoom-compensation rendering requires visual inspection across zoom levels.

### Gaps Summary

No gaps. All 9 observable truths are verified against actual code. All artifacts exist, are substantive, and are wired to their consumers. Data flows end-to-end from user interaction through computation to display. The 6 human verification items are behavioral/visual checks that cannot be performed programmatically — they represent the final confirmation step, not missing functionality.

The one TypeScript error in `useViewportControls.ts` is pre-existing from Phase 1 and is unrelated to scale calibration. It is documented in the 02-03 SUMMARY and does not block the phase goal.

---

_Verified: 2026-04-17T11:15:00Z_
_Verifier: Claude (gsd-verifier)_
