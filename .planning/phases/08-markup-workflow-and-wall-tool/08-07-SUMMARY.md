---
phase: "08-markup-workflow-and-wall-tool"
plan: "07"
subsystem: "uat/phase-closure"
tags: [uat, phase-closure, manual-verification, bug-fix]
dependency_graph:
  requires: ["08-05", "08-06"]
  provides: ["Phase 8 UAT sign-off", "ROADMAP.md Phase 8 complete", "STATE.md updated"]
  affects:
    - src/renderer/src/components/CanvasViewport.tsx
    - .planning/ROADMAP.md
    - .planning/STATE.md
key_files:
  created:
    - .planning/phases/08-markup-workflow-and-wall-tool/08-07-SUMMARY.md
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - .planning/ROADMAP.md
    - .planning/STATE.md
decisions:
  - "Edit popup wired to pass toolType + initialWallHeight for wall markups — missed during Plan 04 (popup extension) because edit path was not exercised in Wave 2"
metrics:
  duration: "UAT session"
  completed: "2026-05-15"
  tasks_completed: 3
  files_changed: 4
---

# Phase 8 Plan 07: Manual UAT + Phase Closure Summary

**One-liner:** All 10 UAT scenarios PASS (one bug found and fixed during session: edit popup missing wall-height row). Phase 8 closed. ROADMAP + STATE updated. 443/443 tests GREEN.

## Task 1: Full Automated Regression Suite

- `npx tsc --noEmit` — exits 0
- `npx vitest run --reporter=verbose` — **443/443 GREEN** (63 test files)
- All 6 Wave 0 RED test files are GREEN: `chain-mode`, `wall-math`, `boq-aggregator-wall`, `project-schema-hidden`, `totals-row-visibility`, `markup-visibility`

## Task 2: Manual UAT — 10 Scenarios

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Place a wall — happy path | **PASS** | Wall renders with 2.5× stroke + parallel hairline; m² label correct |
| 2 | Chain a second wall | **PASS** | No popup; commits with same name/height; own m² label |
| 3 | Break chain with Esc | **PASS** | Badge disappears; next placement re-prompts |
| 4 | Break chain by re-clicking tool | **PASS** | Tool deactivates; re-activate starts fresh |
| 5 | Chain persists across PDF pages | **PASS** | Badge visible on page 2; no popup; same name/height |
| 6 | Show/hide lightbulb toggle | **PASS** | Markups disappear/reappear; totals unchanged |
| 7 | Hidden state persists across save/reload | **PASS** | LightbulbOff state preserved in .clmc |
| 8 | BOQ export includes hidden items | **PASS** | Hidden item present in .xlsx with full quantity |
| 9 | Crosshair cursor hotspot alignment | **PASS** | Center gap aligns with clicked pixel |
| 10 | Wall edit + undo/redo | **PASS** (after fix) | See bug fix below |

### Bug Found and Fixed: Edit Popup Missing Wall-Height Row

**Scenario 10 initially FAILED** — right-click → Edit opened the popup but no wall-height row appeared, making wall-height editing impossible.

**Root cause:** `CanvasViewport.tsx` edit popup block was missing three props:
- `toolType` — not passed, so MarkupNamePopup never rendered the conditional wall-height row
- `initialWallHeight` — not passed, so popup couldn't pre-fill the current height
- `wallHeight` not destructured from `onConfirm` payload nor threaded to `editMarkup` `oldWallHeight`/`newWallHeight` params

**Fix:** `src/renderer/src/components/CanvasViewport.tsx` (commit `224f867`):
```tsx
toolType={target.type as 'count' | 'linear' | 'area' | 'perimeter' | 'wall'}
initialWallHeight={target.type === 'wall' ? (target as WallMarkupType).wallHeight : undefined}
onConfirm={({ name, categoryName, color, wallHeight }) => {
  ...editMarkup(..., oldWallHeight, wallHeight)
}}
```

`editMarkup` already had `oldWallHeight?`/`newWallHeight?` params from Plan 08-03 — the store was ready; only the call site was incomplete.

**Scenario 10 after fix:** PASS — wall-height row appears pre-filled; height change updates m² label; Ctrl+Z reverts; Ctrl+Y re-applies.

## Task 3: Phase Closure

- ROADMAP.md — Phase 8 marked `[x]` complete (2026-05-15), all 8 plans checked
- STATE.md — progress metrics updated: 11/11 phases, 64/64 plans; key decisions + roadmap evolution appended

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 2 bug fix | `224f867` | fix(08-07): pass toolType + wallHeight to edit popup for wall markups |
| Task 3 closure | *(this commit)* | docs(08-07): phase 8 closure — ROADMAP + STATE + summary |

## Deviations from Plan

### Edit popup missing wall-height props (Plan 04 scope gap)

**Found during:** Scenario 10 UAT  
**Issue:** Plan 04 Task 2 extended `MarkupNamePopup` to conditionally render the wall-height row but did not update the *edit* popup callsite in `CanvasViewport.tsx`. The save-after popup (line ~946) was correctly wired in Plan 05 (Toolbar wiring), but the edit popup at line ~1069 was only updated for the new `toolType` in the save-after path, not the edit path.  
**Fix:** Added 3 props + payload destructure to the edit popup block. TypeScript clean.  
**Impact:** None beyond the edit scenario — all other wall functionality unaffected.

## Self-Check: PASSED

- Full suite 443/443: GREEN
- npx tsc --noEmit: exits 0
- All 10 UAT scenarios: PASS
- ROADMAP.md Phase 8: marked complete
- STATE.md: 11/11 phases, 64/64 plans
