---
quick_id: 260520-p2g
phase: quick
plan: 260520-p2g
subsystem: scale-calibration
tags: [scale, ux, pre-choice, dialog, phase11]
dependency_graph:
  requires: []
  provides: [pre-choice CalibMode gate, ScaleMethodDialog component]
  affects: [CanvasViewport, useCalibrationMode, ScalePopup]
tech_stack:
  added: []
  patterns: [overlay-dialog, pre-choice gate, view-toggle]
key_files:
  created:
    - src/renderer/src/components/ScaleMethodDialog.tsx
  modified:
    - src/renderer/src/types/scale.ts
    - src/renderer/src/hooks/useCalibrationMode.ts
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - pdfDocument sourced from viewerStore selector (not passed as prop through chain)
  - worktree ScalePopup was already reverted — no Phase 11 additions present
metrics:
  duration: ~15min
  completed: 2026-05-20
  tasks_completed: 3
  tasks_total: 3
---

# Quick 260520-p2g: Phase 11 Pre-Choice Gate Summary

**One-liner:** Pre-choice gate dialog inserted before scale calibration — CalibMode gains 'pre-choice' state, new ScaleMethodDialog replaces tab-switcher pattern with a proper choice-first UX.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add 'pre-choice' to CalibMode + startDrawing() | ad0ce12 | scale.ts, useCalibrationMode.ts |
| 2 | Create ScaleMethodDialog.tsx | 90bf34c | ScaleMethodDialog.tsx (new) |
| 3 | Update CanvasViewport + revert ScalePopup | c7bcc7c | CanvasViewport.tsx |

## What Was Built

- `CalibMode` union in `scale.ts` gains `'pre-choice'` between `'idle'` and `'drawing'`
- `activate()` in `useCalibrationMode` now sets `mode:'pre-choice'` (previously set `'drawing'`)
- New `startDrawing()` callback transitions pre-choice to drawing with a clean INITIAL_STATE
- `ScaleMethodDialog.tsx` — new component with two internal views:
  - View 1 (choice): "How do you want to set scale?" — Draw line (accent) + Type ratio 1:N (outline)
  - View 2 (ratio): denominator input, async page.view fetch, isoSheetLabel, Accept/Back buttons
  - Draggable via useDraggable, flex-centred overlay, Escape key cancels, Enter key accepts
- `CanvasViewport.tsx` updated to:
  - Import `ScaleMethodDialog`
  - Add `startDrawing` to useCalibrationMode destructure
  - Add `pdfDocument` from viewerStore selector
  - Render `ScaleMethodDialog` when `calibState.mode === 'pre-choice'`
  - Existing ScalePopup confirm block unchanged (already `'confirming' && popupScreenPos && !isVerify`)

## Deviations from Plan

### Observation: worktree ScalePopup already reverted

**Found during:** Task 3
**Issue:** The plan specified removing tab bar + ratio panel from ScalePopup. The worktree's ScalePopup (368 lines) was already the clean version — no `activeTab`, no ratio panel, no `pdfDocument`/`pageWidthPx`/`currentPage` props. The main repo's ScalePopup (529 lines) still had Phase 11 additions, but the worktree was already ahead.
**Action:** No ScalePopup changes were needed. Task 3 scope reduced to CanvasViewport only.

### Auto-add: pdfDocument from viewerStore

**Found during:** Task 3
**Issue:** Plan called for `pdfDocument={pdfDocument}` in ScaleMethodDialog, but `pdfDocument` was not declared in the worktree's CanvasViewport (unlike the main repo which had it for the old ScalePopup ratio tab).
**Fix:** Added `const pdfDocument = useViewerStore((s) => s.pdfDocument)` selector — viewerStore already had the field from Phase 09.
**Files modified:** CanvasViewport.tsx

## Verification

- `npx tsc --noEmit` — exits 0
- `npx vitest run` — 473 tests pass across 66 test files (scale-math, markup-math, all other suites)

## Known Stubs

None — ScaleMethodDialog fully wired. The ratio view's `canConfirmRatio` guard correctly disables Accept when pdfDocument/pageView are unavailable.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] ScaleMethodDialog.tsx exists at `src/renderer/src/components/ScaleMethodDialog.tsx`
- [x] Commits ad0ce12, 90bf34c, c7bcc7c exist
- [x] tsc --noEmit exits 0
- [x] vitest run: 473 passed
