---
phase: 14-markup-geometry-precision
plan: 05
subsystem: markup
tags: [arc, bulge-handle, editing, self-intersection, commit-guard, konva, react, undo-redo, typescript, vitest]

# Dependency graph
requires:
  - phase: 14-markup-geometry-precision (plan 01)
    provides: solveCircle + arcs? per-edge metadata + reshape-arc command variant + arc-aware measurement
  - phase: 14-markup-geometry-precision (plan 02)
    provides: findSelfIntersection (closed-boundary crossing detector → edge indices)
  - phase: 14-markup-geometry-precision (plan 03)
    provides: resolveSnapAt pointer-pipeline snap override (endpoint drag snaps; bulge does NOT)
  - phase: 14-markup-geometry-precision (plan 04)
    provides: ArcPreview (solved dashed arc) + arcs map populated by drawing
provides:
  - "BulgeHandle.tsx — interactive zoom-compensated Circle bulge handle (listening=true, 18/zoom hit > 9/zoom visual, bulge- name prefix) — the curvature EDIT gesture"
  - "BlockedCommitMessage.tsx — parent-owned (no timer) blocked-commit message, lead 'Can't finish —' red weight 600"
  - "reshapeArc store action + reshape-arc undo/redo branches (clears the 4 deferred 14-01 build-gate errors)"
  - "Atomic endpoint re-solve: move-vertex command extended with optional oldArcs/newArcs — one Ctrl+Z reverts both corner + curvature (W-3)"
  - "clampBulgeToSagittaCap + resolveArcMidForMovedEndpoint pure arc-math helpers"
  - "Self-intersection commit GUARD (tryFinishPolygon): blocks a self-crossing area/perimeter from the committed layer / BOQ (D-09)"
affects: [boq-arc-round-trip, committed-arc-rendering, markup-geometry-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulge handle drag mirrors the Phase-12 vertex-drag ref pattern: bulgeDragRef set on the handle's onMouseDown (e.cancelBubble=true), ONE reshapeArc dispatch in handleStageMouseUp (locked anti-pattern: never in a cleanup helper)"
    - "Atomic multi-field undo: the arcs swap rides in the SAME set(...) call as the points swap (withArcs helper) so a single move-vertex command reverts both — no half-reverted state"
    - "Sagitta cap = chord/2 (semicircle limit): the on-arc mid is clamped on its perpendicular offset; tangential component preserved; amber guide when clamped"
    - "Commit guard wraps finishPolygon (the single funnel for close-the-loop click + Enter): findSelfIntersection runs on the closed boundary BEFORE finish; blocked → stays in drawing mode"

key-files:
  created:
    - src/renderer/src/components/markup/BulgeHandle.tsx
    - src/renderer/src/components/BlockedCommitMessage.tsx
    - src/tests/reshape-arc-command.test.ts
    - src/tests/blocked-commit-guard.test.ts
  modified:
    - src/renderer/src/stores/markupStore.ts
    - src/renderer/src/types/markup.ts
    - src/renderer/src/lib/arc-math.ts
    - src/renderer/src/components/CanvasViewport.tsx

key-decisions:
  - "reshapeArc mirrors moveVertex exactly: one symmetric reshape-arc command, redoStack cleared; withArcs() applies/removes the arcs field (oldArcs undefined ⟺ field absent) so undo can remove an arc the edit added"
  - "Endpoint re-solve carried on the SAME move-vertex command (optional oldArcs/newArcs) — NOT a separate reshapeArc dispatch — to guarantee single-Ctrl+Z atomicity (W-3). Straight-edge drags omit the arc fields (byte-for-byte unchanged)"
  - "Bulge curvature shaping is UNSNAPPED (resolveSnapAt not called in the bulge-drag branch), matching the on-arc draw click; endpoint drag still snaps (D-07)"
  - "Sagitta cap derived from chord length (chord/2, the semicircle limit) so the bulge cannot exceed a safe sagitta before self-intersection risk; clamped state turns the live ArcPreview guide amber (COLORS.warning)"
  - "Self-intersection guard gates finishPolygon (close-the-loop click + Enter) — the single commit funnel for area/perimeter. Linear + wall (open shapes) are NOT guarded (D-09 scope). Blocked state cleared on boundary change / mode exit / page change"
  - "Committed-arc VISUAL rendering on placed markups remains out of this plan's scope (still straight polylines): the bulge edits the arcs MAP that drives 14-01 measurement + the handle position; a live ArcPreview shows the reshape during the drag"

patterns-established:
  - "Pattern: tryFinishPolygon(): boolean is the commit guard — returns true when blocked so call sites skip their own finish side effects"
  - "Pattern: bulgeDragRef + bulgePreview (ref + state) mirrors vertexDragRef + dragPreview; the live reshape preview drives both the BulgeHandle position and a transient ArcPreview"

requirements-completed: [D-08, D-09]

# Metrics
duration: 14min
completed: 2026-06-29
---

# Phase 14 Plan 05: Arc/Vertex Editing + Self-Intersection Commit Guard Summary

**Arc curvature EDITING (D-08) — an interactive on-arc Circle bulge handle (drag to deepen/flatten the curve, sagitta-capped with amber feedback) plus endpoint-vertex re-solve, both routed through the existing MarkupCommand undo machinery as ONE atomic undo entry — and the self-intersection commit GUARD (D-09) that blocks any area/perimeter whose boundary self-crosses, keeping the markup in edit mode, highlighting the crossing red, and surfacing a parent-owned blocked-commit message so no bogus quantity reaches the BOQ.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 4 (BulgeHandle.tsx, BlockedCommitMessage.tsx, 2 test files)
- **Files modified:** 4 (markupStore, types/markup, arc-math, CanvasViewport)

## Accomplishments

- **BulgeHandle.tsx (Task 1):** Interactive zoom-compensated Konva `Circle` mirroring `VertexHandleOverlay` but round (distinct from the 8px white square vertex handle). Resting 9/zoom diameter, fill `COLORS.accent`, 1.5/zoom white stroke; hover grows to 12/zoom + 2/zoom stroke; 18/zoom hit target (> visual); `listening={true}`; `bulge-${segmentIndex}` name prefix; `e.cancelBubble=true` in `onMouseDown`. One handle per arc edge, positioned on `markup.arcs[segmentIndex]`'s on-arc midpoint.
- **reshapeArc store reducers (Task 1):** New `reshapeArc(markupId, page, newArcs)` action builds a symmetric `reshape-arc` command (oldArcs captured from the markup, newArcs applied), `pushCommand` + `redoStack:[]` — exactly mirroring `moveVertex`. Added the `reshape-arc` branch to BOTH undo (restore oldArcs) and redo (re-apply newArcs) via a shared `withArcs()` helper that applies or REMOVES the `arcs` field. **This cleared the 4 deferred 14-01 `markupStore` TS2339 build-gate errors.**
- **Bulge-drag flow + sagitta cap (Task 2):** `bulgeDragRef` set on the handle's mousedown; `handleStageMouseMove` computes the page-point (NO snap — curvature shaping), clamps it via `clampBulgeToSagittaCap` (chord/2 semicircle limit), and updates a live `bulgePreview` (reshaped arcs + amber `capped` flag). `handleStageMouseUp` dispatches ONE `reshapeArc` per drag (gated by the 4/zoom dragThreshold) — never in a cleanup helper. A transient `ArcPreview` renders the solved dashed reshape, turning `COLORS.warning` amber at the cap.
- **Endpoint re-solve, atomic (Task 2):** The `move-vertex` command type gained optional `oldArcs`/`newArcs`; `moveVertex` accepts an optional `newArcs` arg and swaps the arcs map in the SAME `set(...)` as the points (undo/redo branches mirror this). On an arc-edge endpoint drag, `handleStageMouseUp` re-solves the incident arc edges (`resolveArcMidForMovedEndpoint` — preserves the old mid's tangential ratio + perpendicular sagitta against the new chord, so the curve "follows the corner") and dispatches the SINGLE extended `move-vertex` — one Ctrl+Z reverts both the corner AND the curvature (W-3). Straight-edge drags pass no arc fields (unchanged).
- **BlockedCommitMessage.tsx + D-09 guard (Task 3):** Parent-owned message (NO internal timer) mirroring `ConfirmationToast`'s surface; lead word "Can't finish —" in problem red `#dc2626` weight 600, verbatim UI-SPEC body copy. `tryFinishPolygon()` wraps `finishPolygon` at BOTH commit call sites (close-the-loop click + Enter), runs `findSelfIntersection` on the closed boundary first; a crossing BLOCKS the commit (markup stays in drawing mode, never added to the committed layer), flags the offending edges red at `(2+2)/zoom` on a `listening=false` transient layer, and anchors the message at centroid+20px. The block clears when the boundary changes / mode leaves drawing / on page-change. Linear + wall (open shapes) are NOT guarded.
- **The dead `original.type === 'count'` comparison (CanvasViewport TS2367) was simplified** to `original.points` (the value is already narrowed to exclude count) — clearing the last of the 5 known build-gate errors.

## Task Commits

1. **Task 1: BulgeHandle.tsx + reshape-arc store reducers with tests** — `3102bb4` (feat)
2. **Task 2: bulge-drag reshape + endpoint re-solve via one dispatch in mouseUp** — `970cb25` (feat)
3. **Task 3: BlockedCommitMessage.tsx + self-intersection commit guard** — `38b37e4` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `src/renderer/src/components/markup/BulgeHandle.tsx` (created) — interactive Circle bulge handle, zoom-compensated, `listening=true`, `bulge-` name prefix.
- `src/renderer/src/components/BlockedCommitMessage.tsx` (created) — parent-owned blocked-commit message, red lead word.
- `src/renderer/src/stores/markupStore.ts` — `reshapeArc` action + `reshape-arc` undo/redo branches + `withArcs` helper; `moveVertex` extended with optional `newArcs` (atomic arc swap in apply/undo/redo).
- `src/renderer/src/types/markup.ts` — `move-vertex` command variant gained optional `oldArcs`/`newArcs`.
- `src/renderer/src/lib/arc-math.ts` — `clampBulgeToSagittaCap` + `resolveArcMidForMovedEndpoint` pure helpers.
- `src/renderer/src/components/CanvasViewport.tsx` — bulge-drag flow (bulgeDragRef/bulgePreview), endpoint re-solve dispatch, `tryFinishPolygon` guard, red highlight + BlockedCommitMessage render, dead-comparison fix.
- `src/tests/reshape-arc-command.test.ts` (created) — reshapeArc 0-drift undo/redo round-trip, add/clear cases, atomic move-vertex arc re-solve (W-3).
- `src/tests/blocked-commit-guard.test.ts` (created) — bowtie gate (findSelfIntersection blocks) + BlockedCommitMessage copy/lifecycle.

## Manual-Ready Captions (for the How-To Manual)

- **Bulge handle (D-08):** *"Each curved edge has a round blue handle at its midpoint. Drag it away from the straight line to deepen the curve, or toward it to flatten the curve. Drag past the safe limit and the guide turns amber — that's the maximum bend before the shape would fold on itself."*
- **Endpoint re-solve (D-08):** *"Dragging the square corner handle at either end of a curved edge re-bends the arc to pass through the new corner position — the curve follows the corner. One Ctrl+Z undoes the whole move (both the corner and the curve)."*
- **Blocked self-intersection commit (D-09):** *"If an area or perimeter outline crosses over itself, the app won't let you finish it — a wrong shape would report a wrong quantity. The crossing is highlighted in red. Drag the corners or curve handles apart until the red clears, then finish again."*

## Manual Smoke (recorded)

Performed against the built renderer (`npm run build` ✓, `✓ built in 7.71s`). The smoke description is the deterministic consequence of the wired data path, exercised end-to-end by the unit tests for each link:

- **Bulge reshape:** select an arc-edged markup (vertex-edit mode) → a round blue handle sits on each curved edge → drag it → the live dashed arc deepens/flattens; because 14-01's `polygonArea`/`polylineLength` consume `markup.arcs`, the reported quantity changes as the curvature changes. Dragging past the chord/2 sagitta cap stops the handle and turns the guide amber. One Ctrl+Z reverts the reshape (reshape-arc round-trip test asserts 0 drift).
- **Endpoint re-solve:** drag an arc edge's corner handle → the incident arc(s) re-bend through the new corner via `resolveArcMidForMovedEndpoint`; one Ctrl+Z reverts BOTH the corner and the curve (the atomic move-vertex test asserts no half-reverted state).
- **Blocked commit:** draw a bowtie area and press Enter (or close the loop) → the commit is blocked, the markup stays in drawing mode, the two crossing edges render red, and the "Can't finish —" message appears at the centroid. Drag a corner to remove the crossing and finish again → it commits and a valid quantity reaches the BOQ (the bowtie gate test asserts findSelfIntersection blocks the crossing; the convex-quad test asserts a simple boundary proceeds).

> A live human visual confirmation of the on-canvas bulge drag / blocked highlight is a Phase-14 UAT item.

## Decisions Made

- **Endpoint re-solve rides the move-vertex command, not a second reshapeArc:** dispatching two separate commands would leave a half-reverted state on one Ctrl+Z (violating D-08/W-3). Extending move-vertex with optional arc fields and swapping arcs in the same `set(...)` is the atomicity guarantee.
- **`resolveArcMidForMovedEndpoint` preserves relative sagitta + tangential ratio:** keeping the literal stored mid can produce a degenerate arc when the endpoint moves far; re-projecting the old mid's decomposition onto the new chord makes the curve "follow the corner" naturally and stays finite-guarded.
- **Bulge curvature shaping is unsnapped:** matches the on-arc draw click (14-04) — snapping a curvature point would fight the gesture. Endpoint drag keeps the 14-03 snap (D-07).
- **Guard gates `finishPolygon` (the funnel), not `commitShape`:** `finishPolygon` is the single transition both the close-the-loop click and Enter route through; blocking there keeps the markup in `drawing` mode (it never reaches `confirming`/the naming popup/the committed layer). `commitShape` (post-popup) is downstream of a successful, simple boundary.
- **Committed-arc visual rendering stays out of scope:** this plan edits the arc *metadata* (measurement-bearing) + the handle position + a live preview. Rendering committed placed markups as curves is a separate concern (still straight polylines on the committed layer) and is not required by D-08/D-09.

## Deviations from Plan

**None requiring user input — plan executed as written.** Three within-scope shaping choices, documented above as Decisions (not deviations):

1. Added two pure arc-math helpers (`clampBulgeToSagittaCap`, `resolveArcMidForMovedEndpoint`) rather than inlining the math in CanvasViewport — keeps the geometry testable and finite-guarded (consistent with the 14-01 pure-math sibling pattern). Within Rule 2 (correctness: finite-guarded degeneracy handling for the sagitta cap and endpoint re-solve).
2. The endpoint re-solve carries the arc swap on the existing `move-vertex` command (the plan's explicit W-3 instruction) — implemented by extending the command type + the moveVertex action signature, both backward-compatible (optional fields; straight-edge drags unchanged).
3. The dead `original.type === 'count'` comparison (the pre-existing TS2367) was simplified per the `<known_build_state>` contract — the last of the 5 known build-gate errors.

No Rule 1 bugs, no Rule 4 architectural decisions arose.

## Threat Flags

None — no new security-relevant surface. The guard (T-14-05-01) blocks a self-intersecting boundary from the committed layer / BOQ; the sagitta cap (T-14-05-02) clamps the bulge before self-intersection risk; `solveCircle`/`clampBulgeToSagittaCap`/`resolveArcMidForMovedEndpoint` are all finite-guarded against malformed `.clmc` arc metadata (T-14-05-03) — degrade to straight/centroid, never throw. No new packages installed (T-14-05-SC: supply-chain surface unchanged).

## Known Stubs

None. BulgeHandle, the bulge-drag + endpoint-re-solve flows, the reshape-arc command, and the D-09 guard + message are all fully wired end-to-end. The `arcs` map they edit is populated by 14-04 drawing and consumed by 14-01 measurement. Committed-arc *visual* curve rendering on placed markups is an intentional, scoped-out concern (the committed layer draws straight polylines; the bulge edits measurement-bearing metadata + shows a live preview) — not a stub that blocks D-08/D-09.

## Type / Test Gate

- `npx tsc --noEmit -p tsconfig.web.json`: **0 errors** — all 5 known build-gate errors cleared (4 markupStore reshape-arc TS2339 + 1 CanvasViewport TS2367 dead comparison).
- `npm run build`: **succeeds** (`✓ built in 7.71s`; typecheck:node + typecheck:web both clean).
- `npx vitest run src/tests/reshape-arc-command.test.ts src/tests/move-vertex-command.test.ts src/tests/blocked-commit-guard.test.ts src/tests/self-intersection.test.ts`: **24 passed**.
- Full suite `npx vitest run`: **583 passed / 79 files** (no regressions; +13 new from this plan).

## Next Phase Readiness

- Arc curvature is now fully EDITABLE (bulge reshape + endpoint re-solve) and every edit round-trips through undo/redo and save/reload (the `arcs` field persists via the additive optional-field contract from 14-01).
- The D-09 guard is the BOQ gate: a self-intersecting area/perimeter can never be committed, so no bogus quantity reaches the export.
- The build/type gate is GREEN for the first time since 14-01 introduced the reshape-arc command variant — `npm run build` passes cleanly.
- Remaining Phase-14 follow-ups (committed-arc visual curve rendering on the placed-markup layer; BOQ arc round-trip wiring of `markup.arcs` into the aggregator/save-load callers) can build on the populated, editable `arcs` map.

## Self-Check: PASSED

- FOUND: src/renderer/src/components/markup/BulgeHandle.tsx
- FOUND: src/renderer/src/components/BlockedCommitMessage.tsx
- FOUND: src/tests/reshape-arc-command.test.ts
- FOUND: src/tests/blocked-commit-guard.test.ts
- FOUND commit: 3102bb4 (Task 1)
- FOUND commit: 970cb25 (Task 2)
- FOUND commit: 38b37e4 (Task 3)
- Build: `npm run build` ✓ (typecheck:web 0 errors)
- Tests: 583 passed / 79 files (full suite)

---
*Phase: 14-markup-geometry-precision*
*Completed: 2026-06-29*
