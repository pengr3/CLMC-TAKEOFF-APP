---
phase: 08-markup-workflow-and-wall-tool
plan: "05"
subsystem: toolbar-canvas-integration
tags: [toolbar, canvas, wall, chain-badge, crosshair, module-ref]
dependency_graph:
  requires: ["08-00", "08-01", "08-02", "08-03", "08-04"]
  provides: ["wall-toolbar-button", "chain-badge-chips", "crosshair-cursor", "wall-canvas-mount", "getChainArmedItem"]
  affects: ["src/renderer/src/components/Toolbar.tsx", "src/renderer/src/components/CanvasViewport.tsx"]
tech_stack:
  added: []
  patterns:
    - "Module-level ref cross-component channel (_chainArmedItem / getChainArmedItem)"
    - "SVG data-URL CSS cursor with encodeURIComponent (Pitfall 8 satisfied)"
    - "Chain badge chip via IconButton children prop (mirrors Set Scale chevron)"
    - "Wall linear-preview reuse (wall and linear are both open polylines)"
key_files:
  created: []
  modified:
    - src/renderer/src/components/Toolbar.tsx
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - "Chain badge chip inlined per-button (5 separate conditionals) — readable diff, no local component extraction needed"
  - "Wall preview reuses linear Layer 1a preview path — no new component; both are open polylines drawn with dblclick finish"
  - "CROSSHAIR_CURSOR IIFE at module scope — computed once, never per-render"
  - "Worktree was reset to 73b377a (current master) before execution — prerequisite files (WallMarkup.tsx etc.) were absent at worktree creation time"
metrics:
  duration: "15min"
  completed: "2026-05-15"
  tasks: 2
  files: 2
---

# Phase 8 Plan 05: Toolbar + CanvasViewport Integration Summary

Wave 3A integration: wall toolbar button with chain badge chips on all 5 markup tools, crosshair SVG cursor, WallMarkup Layer 1b mount, and popup toolType/wallHeight wiring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Toolbar wall button + handleMarkupToolClick + chain badge chips | 9804419 | Toolbar.tsx |
| 2 | CanvasViewport getChainArmedItem + CROSSHAIR_CURSOR + WallMarkup + popup wiring | 46747e9 | CanvasViewport.tsx |

## What Was Built

**Toolbar.tsx:**
- Added `BrickWall` icon import from lucide-react
- Added `getChainArmedItem` import from CanvasViewport (module-level getter)
- Extended `handleMarkupToolClick` signature to include `'wall'`
- Added 5th markup `IconButton` (Wall / BrickWall icon) after Perimeter
- Added chain badge chip inside all 5 markup IconButtons — renders a colored dot + truncated item name when the tool is active AND chain is armed (`getChainArmedItem() !== null`)

**CanvasViewport.tsx:**
- Added `_chainArmedItem` module-level ref + `getChainArmedItem()` export (mirrors `_canvasControls` / `_calibrationControls` pattern)
- Added `useEffect` to populate `_chainArmedItem` from `markupState.chainArmed + pendingName + pendingColor`
- Added `CROSSHAIR_CURSOR` module-scope constant — SVG data-URL with 8 line elements (4 black outline + 4 white foreground, 4px center gap per D-17), `encodeURIComponent` applied (Pitfall 8), hotspot `12 12`
- Replaced all `return 'crosshair'` string literals in `getCursor()` with `return CROSSHAIR_CURSOR` (3 callsites)
- Extended `handleStageDblClick` to cover `toolType === 'wall'` (walls finish on dblclick, same as linear)
- Extended Layer 1a linear preview condition to `(toolType === 'linear' || toolType === 'wall')`
- Added `WallMarkup` mount in Layer 1b after perimeter markups (identical prop shape to LinearMarkup)
- Extended MarkupNamePopup save-after to pass `toolType` and `initialWallHeight` props

## Deviations from Plan

### Execution Context Deviation

**Worktree reset required:** The worktree was spawned from commit `d27fed3` (pre-plan-phase base), which predated plans 08-00 through 08-04. `WallMarkup.tsx`, `chainArmed` state fields, `pendingWallHeight`, and `WallMarkup` type were all absent. The worktree branch was reset to `73b377a` (current master — post-plan-04 merge) before execution. This is a worktree lifecycle deviation, not a code deviation.

**All plan code implemented exactly as specified — no functional deviations.**

## Verification

- `npx tsc --noEmit` exits 0 — TypeScript clean
- 7 pre-existing RED test stubs (markup-visibility + totals-row-visibility) remain failing — these are Wave 0 RED stubs for plans 06/07, not regressions from plan 05
- All source assertions from plan acceptance criteria pass

## Known Stubs

None. All wiring is functional: `getChainArmedItem()` is populated by the useEffect; `WallMarkup` is imported and mounted; `CROSSHAIR_CURSOR` is a real computed SVG cursor; popup props pass through to the already-implemented `MarkupNamePopup` wall-height row (plan 04).

## Self-Check

PASSED
- `src/renderer/src/components/Toolbar.tsx` — present, modified ✓
- `src/renderer/src/components/CanvasViewport.tsx` — present, modified ✓
- Commit 9804419 exists ✓
- Commit 46747e9 exists ✓
