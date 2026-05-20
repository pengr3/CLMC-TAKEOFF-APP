---
slug: rrf-remove-ratio-feature
date: 2026-05-20
status: in-progress
---

# Remove "Type ratio 1:N" scale feature

Strip all ratio-related code and revert to draw-line only calibration.

## Tasks

- [ ] T1: Delete ScaleMethodDialog.tsx
- [ ] T2: Remove 'pre-choice' from CalibMode in types/scale.ts
- [ ] T3: Revert useCalibrationMode.ts — activate() sets 'drawing', remove startDrawing()
- [ ] T4: CanvasViewport.tsx — remove ScaleMethodDialog render block and pdfDocument selector
- [ ] T5: scale-math.ts — remove computePixelsPerMmFromRatio and isoSheetLabel
- [ ] T6: Delete src/tests/scale-ratio-math.test.ts
- [ ] T7: Verify ScalePopup.tsx is draw-line only (no changes needed)
- [ ] T8: tsc --noEmit + vitest run green
- [ ] T9: Commit and update STATE.md
