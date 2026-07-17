---
phase: quick-260717-fps
plan: 01
subsystem: spikes/006-area-cutouts (throwaway offline feel demo)
tags: [spike, markup, area, cutout, circle, solveCircle, mm-01, feel-demo]
requires: [.planning/spikes/008-live-readout/index.html (solveCircle source), .planning/spikes/006-area-cutouts/index.html]
provides: three circle-cutout input sub-modes (3-pt rim / 2-pt diameter / centre-radius) with live preview, inside-⌀ readout, forensic logging
affects: .planning/spikes/006-area-cutouts (demo + docs only — NO production src/ change)
tech-stack:
  added: none (single self-contained offline index.html — inline CSS+JS, plain Canvas 2D, no imports/CDNs/web-fonts)
  patterns: solveCircle ported VERBATIM via spike-008 (copied, never imported); candidateCircle(useCursor) re-solve per mousemove (008 proved free); data-cmode + setCircleMode toggler mirrors existing data-mode/setMode
key-files:
  created: []
  modified:
    - .planning/spikes/006-area-cutouts/index.html
    - .planning/spikes/006-area-cutouts/README.md
    - .planning/spikes/MANIFEST.md
decisions:
  - "3-point (rim) is the PRIMARY, default sub-mode — derives exact centre via ported solveCircle, dissolving the 'where is the exact centre?' problem"
  - "circleDraft (single {cx,cy}) fully generalised to circlePts[] + circleMode + circleMsg; every reference migrated, zero circleDraft remaining"
  - "circles commit on reaching reqCount (3 for 3-pt, 2 otherwise), NOT on Enter — Enter keeps its poly/area close-ring behaviour"
  - "3-pt near-collinear clicks rejected via solveCircle collinear flag: pop the 3rd point, surface a hint, do NOT commit"
  - "rim-point snapping documented as markup-to-markup (grid-hash), NOT raster edge-grab — documented in README, not built"
metrics:
  duration: ~6 min
  tasks: 3
  files_changed: 3
  commits: 2
  completed: 2026-07-17
---

# Quick 260717-fps: Spike-006 Cutouts Demo — Three Circle-Input Sub-Modes Summary

Generalised the spike-006 area-cutouts feel demo from a single centre-then-radius circle gesture into **three selectable circle-cutout input sub-modes** — 3-point (rim, PRIMARY), 2-point (diameter), and centre-radius — each with a live re-solved candidate preview, an inside-diameter (⌀ = 2·r) readout, and forensic per-point + derived-geometry logging. The `solveCircle` engine was copied verbatim from spike-008 (never imported from `src/`); the demo stays one self-contained offline `index.html`.

## What Changed

**Task 1 — three input sub-modes (state + selector + click/commit + keyboard)** — commit `fccabdc`
- Copied the `EPS` / `dist` / `solveCircle` block **verbatim** from `spike-008/index.html` (lines 80-95) into the demo's math section (never imported from `src/`).
- Replaced `circleDraft: null` with a general model: `circlePts: []`, `circleMode: '3pt'` (default), `circleMsg: ''`. Every prior `S.circleDraft` reference (draw, mousemove, click, keyboard, setMode, clear) migrated — **zero `circleDraft` remain**.
- Added a `data-cmode` sub-mode selector row (`3-pt (rim)` / `2-pt (⌀)` / `center-radius`) after the circle-tool button, plus `setCircleMode(m)` mirroring `setMode`. The row is shown only when `mode === 'holeCircle'` and defaults to `3pt` active.
- Added `candidateCircle(useCursor)`: 3-pt via `solveCircle(pts[0],pts[1],pts[2]||cursor)` (null on `<2` points or collinear); 2-pt midpoint + half-span; centre-radius from centre + radius point.
- Rewrote the `holeCircle` click branch: push each point (logged), commit `{type:'circle',cx,cy,r}` at `reqCount` via `candidateCircle(false)`, reject collinear 3-pt (pop + hint, no commit).
- Esc now clears `circlePts` too; Backspace undoes the last rim/centre point before falling back to draft-vertex undo.

**Task 2 — live preview, inside-⌀ readout, forensic logging** — commit `fccabdc` (same index.html commit)
- `draw()` circle preview now driven by `candidateCircle(true)` (placed points + hovering cursor): dashed candidate circle in the hole colour `#ff7a7d` + placed-point dots; when the candidate is null (e.g. 3-pt collinear cursor) only the dots draw, so the "nearly collinear" state reads visually.
- `mousemove` redraws whenever `circlePts.length` is non-zero (no throttle — 008 proved per-move re-solve is free).
- `updateHint()`/`circleHint()` names the active sub-mode and its click count, advances as points accumulate ("N of 3 rim points placed…"), and surfaces "points nearly collinear — no circle" on a rejected 3-pt commit.
- `recompute()` readout row for a circle cutout shows its inside diameter (`⌀ (2·r)/PX_PER_M m`) beside the area; the commit log records `…circle solved c=(cx,cy) r=…px ⌀=…m → …m²`.

**Task 3 — README + MANIFEST (feel stays PENDING)** — commit `839befd`
- README How to Run + What to Expect describe all three input methods; new "Circle input methods (feel) — PENDING" note keeps the verdict honest (`VALIDATED (math) · PENDING human feel-test (demo)` unchanged — feel is NOT claimed VALIDATED).
- Documented (not built) the rim-snapping caveat: snapping is markup-to-markup (grid-hash), not raster edge-grab of a scanned bore rim.
- MANIFEST 006 row extended to one-line note the three circle-input methods; math finding preserved.

## Verification

- Task 1 grep: `function solveCircle|data-cmode|S.circleMode|S.circlePts|candidateCircle` → 31 matches; `rg "circleDraft"` → **nothing**. OK.
- Task 2 grep: `candidateCircle\(true\)|⌀|circle solved|circlePts.length` → 10 matches. OK.
- Task 3 grep: README `3-point|3-pt` → 4; README `PENDING` present; MANIFEST `three circle-input|3-pt` → 1; snapping caveat present. OK.
- `node --check` on the extracted script block → SYNTAX-OK.
- Headless logic test of `solveCircle` + `candidateCircle`: 3-pt exact `c=(100,100) r=50`; 3-pt collinear → `null`; 3-pt preview w/cursor `c=(100,100) r=50`; 2-pt `c=(50,0) r=50`; centre-radius `c=(200,200) r=60`; 2-pt preview `c=(40,0) r=40`. All exact.
- Offline guards: no `import`, no `https?://`, no web-font / CDN `<script src>` in index.html. No `src/` file touched. No file deletions.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 both edit the single `index.html` and are tightly coupled (Task 2's preview/hint/readout depend on Task 1's new state model), so they landed in one logical `feat` commit (`fccabdc`); Task 3's docs landed in one `docs` commit (`839befd`) — within the "small number of logical commits" allowance in the task constraints.

## Human Feel-Test (PENDING)

Per spike verdict discipline the subjective feel is unverified. Open `.planning/spikes/006-area-cutouts/index.html`, draw an area, then for each sub-mode confirm: buttons appear/switch; 3-pt commits on the 3rd rim click (and rejects near-collinear); 2-pt commits on the 2nd click; centre-radius still works; the candidate previews live under the cursor; the readout shows ⌀; Esc cancels an in-progress circle; Backspace undoes the last point.

## Commits

- `fccabdc` — feat(spike-006): three circle-cutout input sub-modes + live preview + inside-⌀ readout (index.html)
- `839befd` — docs(spike-006): note the three circle-input methods (feel stays PENDING) (README.md, MANIFEST.md)
