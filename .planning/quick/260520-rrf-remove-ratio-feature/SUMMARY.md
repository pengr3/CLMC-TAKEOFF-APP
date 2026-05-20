---
slug: rrf-remove-ratio-feature
date: 2026-05-20
status: complete
commit: 4156dee
---

# Summary: Remove ratio scale feature

Scrapped the "Type ratio 1:N" path per user decision — draw-line calibration is robust and the ratio path produced unreliable results.

## What was removed

- `ScaleMethodDialog.tsx` — deleted (pre-choice gate component)
- `src/tests/scale-ratio-math.test.ts` — deleted (14 ratio tests)
- `CalibMode 'pre-choice'` — removed from types/scale.ts
- `startDrawing()` — removed from useCalibrationMode; `activate()` reverted to go directly to `'drawing'`
- `ScaleMethodDialog` render block + `pdfDocument` selector — removed from CanvasViewport.tsx
- `computePixelsPerMmFromRatio` + `isoSheetLabel` + `ISO_SIZES` — removed from scale-math.ts
- `ScalePopup.tsx` — reverted to draw-line single-tab confirm (removed tab bar, ratio state, ratio props, ratio logic)

## Result

493 tests / 68 files — all green. Draw-line calibration flow unchanged.
