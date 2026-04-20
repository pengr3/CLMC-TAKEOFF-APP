---
status: partial
phase: 02-scale-calibration
source: [02-VERIFICATION.md]
started: 2026-04-20T11:15:00Z
updated: 2026-04-20T11:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Complete calibration workflow
expected: Clicking Set Scale activates crosshair cursor; two clicks place red circles with dashed connecting line; ScalePopup appears near midpoint; entering distance + unit and confirming updates StatusBar to "Scale: 1:N"
result: [pending]

### 2. Per-page scale independence
expected: After calibrating page 1, navigating to page 2 shows amber "Not Set"; returning to page 1 shows the original "1:N" scale — confirming per-page isolation
result: [pending]

### 3. Confirmation toast persistence (MEDIUM #3)
expected: Toast "Scale set to 1:N. Verify by measuring a second line?" appears after calibration and remains visible for 30+ seconds without auto-dismissing
result: [pending]

### 4. Verify flow read-only (no store mutation)
expected: Clicking Verify in the toast, drawing a second line shows "Measured: X.XX m" in a read-only popup; clicking Dismiss leaves StatusBar scale unchanged — scaleStore was not mutated
result: [pending]

### 5. Chevron hint + context menu (LOW #6)
expected: When page is calibrated, a small ▾ chevron appears next to "Set Scale" label; left-clicking the chevron AND right-clicking the button both open a menu with "Recalibrate" and "Verify scale" items; pressing Escape or clicking outside dismisses the menu
result: [pending]

### 6. Zoom-compensated calibration visuals
expected: Calibration circle endpoints and dashed line remain the same visual size (not growing/shrinking) when zooming from 0.25x through 8x
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
