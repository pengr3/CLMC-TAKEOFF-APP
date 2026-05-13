---
phase: 07-canvas-workspace-ux-and-markup-fixes
plan: "01"
subsystem: canvas-ui
tags: [canvas, totals-panel, calibration-dialog, tdd-green, wave-1]
dependency_graph:
  requires:
    - "07-00"  # Wave 0 RED test baseline
  provides:
    - inset-0 canvas fill fix (CanvasViewport.tsx)
    - grand-total bar removed (TotalsPanel.tsx)
    - subtotal rows removed (TotalsCategoryBlock.tsx)
    - CalibrationDialog isolation:isolate stacking context
    - CalibrationDialog secondary button labeled 'Discard Scale'
    - Wave 0 totals RED tests turned GREEN
  affects:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/CalibrationDialog.tsx
tech_stack:
  added: []
  patterns:
    - "position:absolute + inset:0 fills positioned parent without percentage height propagation"
    - "isolation:isolate creates stacking context for native select dropdown z-ordering"
    - "Wave 0 RED/GREEN TDD — assertion inversions turned GREEN by implementation deletion"
key_files:
  created: []
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/CalibrationDialog.tsx
decisions:
  - "CanvasViewport root div uses position:absolute + inset:0 instead of width/height 100% — fills positioned parent (App.tsx center column with position:relative) without percentage height propagation dependency"
  - "Grand-total bar and subtotal rows deleted from render layer only — boq-aggregator.ts grandTotals/subtotals data retained for BOQ export pipeline"
  - "isolation:isolate chosen as Option A stacking-context fix for CalibrationDialog (per D-11 priority order) — creates new stacking context so native select dropdown draws above backdrop without changing z-index values"
metrics:
  duration: "8m"
  completed: "2026-05-13"
  tasks_completed: 3
  files_modified: 4
---

# Phase 07 Plan 01: Canvas Gutter Fix + Totals Cleanup + CalibrationDialog Fixes Summary

Three parallel-safe Wave 1 fixes: CanvasViewport uses `position:absolute; inset:0` to eliminate the 800x600 Stage lock gutter; TotalsPanel/TotalsCategoryBlock lose their surplus grand-total bar and subtotal rows; CalibrationDialog gains `isolation:isolate` on its overlay and renames its abandon button to 'Discard Scale'.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Canvas gutter fix (D-02) — CanvasViewport root div inset:0 | ec39197 | CanvasViewport.tsx |
| 2 | Totals panel cleanup (D-08, D-09) — remove grand-total bar and subtotal rows | 2b16cfc | TotalsPanel.tsx, TotalsCategoryBlock.tsx |
| 3 | CalibrationDialog dropdown overflow fix + 'Discard Scale' label (D-11, Landmine 8) | 301137d | CalibrationDialog.tsx |

## Verification Results

- `npx vitest run src/tests/totals-panel-render.test.ts` — exits 0 (6/6 pass, D-08 GREEN)
- `npx vitest run src/tests/totals-panel-category-collapse.test.ts` — exits 0 (5/5 pass, D-09 GREEN)
- Full `npx vitest run` — 411 passed / 13 failed (down from 16 RED; remaining 13 are Wave 0 EditMarkupCommand + MarkupNamePopup RED stubs for later waves)
- `npx tsc --noEmit` — exits 0 (no TypeScript errors)

## Must-Haves Verified

- [x] CanvasViewport root containerRef div uses `position: 'absolute'` with `inset: 0`
- [x] CanvasViewport root div does NOT contain `width: '100%'` or `height: '100%'` or `position: 'relative'`
- [x] TotalsPanel does NOT contain `data-testid="totals-panel-grand-total"` (0 grep matches)
- [x] TotalsCategoryBlock does NOT contain `data-testid="totals-subtotal-row"` (0 grep matches)
- [x] CalibrationDialog overlay div has `isolation: 'isolate'`
- [x] CalibrationDialog secondary button label is exactly 'Discard Scale' (not 'Cancel')
- [x] Vitest suite: Wave 0 totals RED tests now GREEN

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed without any unexpected issues.

## Known Stubs

None — all changes are complete removals or complete fixes. No placeholder values or TODO comments introduced.

## Threat Flags

None — changes are CSS presentation properties (position, inset, isolation) and render block deletions. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- src/renderer/src/components/CanvasViewport.tsx: FOUND (contains `position: 'absolute'` and `inset: 0`)
- src/renderer/src/components/TotalsPanel.tsx: FOUND (grand-total bar block deleted)
- src/renderer/src/components/TotalsCategoryBlock.tsx: FOUND (subtotals.map block deleted)
- src/renderer/src/components/CalibrationDialog.tsx: FOUND (isolation:isolate + Discard Scale)
- Commit ec39197: FOUND
- Commit 2b16cfc: FOUND
- Commit 301137d: FOUND
