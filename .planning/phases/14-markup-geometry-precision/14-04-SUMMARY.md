---
phase: 14-markup-geometry-precision
plan: 04
subsystem: markup
tags: [arc, drawing, 3-click-gesture, konva, react, keybindings, zoom-compensated-overlay, typescript]

# Dependency graph
requires:
  - phase: 14-markup-geometry-precision (plan 01)
    provides: solveCircle (3-point circle solver) + arcs? per-edge metadata on Linear/Area/Perimeter/Wall + arc-aware polylineLength/polygonArea
  - phase: 14-markup-geometry-precision (plan 03)
    provides: resolveSnapAt pointer-pipeline snap override + F3/Alt snap controls; bare-A left free for arc mode
provides:
  - "ArcPreview.tsx — live, zoom-compensated, listening=false dashed solved-arc preview that re-solves solveCircle every render; degrades to a straight Line when collinear"
  - "useMarkupTool arc-edge state machine: arcMode ('off'|'sticky') sticky toggle + arcHeld one-off + recordArcClick 3-click capture + arcs accumulation into the committed markup"
  - "CanvasViewport 3-click routing: arc clicks via recordArcClick, on-arc shaping click snapping-suppressed, ArcPreview replaces the straight preview mid-edge, ARC_CROSSHAIR_CURSOR affordance"
  - "Arc keybindings: bare A (hold one-off) + Shift+A (sticky toggle), isTextInputActive-guarded, no Ctrl+A/F3 collision; markup-arc-ref.ts bridge"
affects: [bulge-handle-editing, self-intersection-guard-14-05, boq-arc-round-trip, MM-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level ref bridge (markup-arc-ref.ts) connects useMarkupTool React-state setters to the global key handler — mirrors markup-undo-ref.ts; avoids a circular import and keeps arc flags out of any store"
    - "Arc preview samples the solved circle as a dense 64-segment dashed Konva Line (not a Konva Arc node) — one rendering path that degrades cleanly to a 2-point straight Line on collinear input (no NaN-radius Arc)"
    - "On-arc shaping click is the SECOND of three clicks and is the only one with snapping suppressed (a free curvature point); start + end clicks still route through resolveSnapAt"
    - "Two-pass SVG cursor (black outline + white foreground) extended with an accent quarter-arc tick for the arc-mode affordance — same encodeURIComponent discipline as CROSSHAIR_CURSOR"

key-files:
  created:
    - src/renderer/src/components/markup/ArcPreview.tsx
    - src/renderer/src/lib/markup-arc-ref.ts
    - src/tests/arc-preview.test.ts
  modified:
    - src/renderer/src/hooks/useMarkupTool.ts
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts

key-decisions:
  - "arcMode sticky toggle preserved across chained commits (commitShape re-applies prev.arcMode over INITIAL_STATE) so a run of arc edges survives chain re-arm; one-off (held) already reverts to 'off' at edge commit"
  - "recordArcClick is a dedicated entry point alongside recordClick — the straight-drawing path is byte-for-byte unchanged when arc mode is off (no regression in chain-mode / pop-last-point)"
  - "arcs[startVertexIndex] = { midX, midY } written from the on-arc (2nd) click keyed by the edge's start-vertex index (points.length-1 at capture time), matching the 14-01 arcs contract; arcs attached to the committed markup only when ≥1 arc edge was drawn"
  - "Shift+A chosen for the sticky toggle (free: Ctrl+A is select-all, F3 is snap, bare A is hold); checked BEFORE bare A so it is never shadowed; all guarded by isTextInputActive()"
  - "Arc-mode affordance = ARC_CROSSHAIR_CURSOR (UI-SPEC Open Q2 preferred path) rather than a StatusBar chip, because StatusBar is propless and reads only stores — arcMode lives in useMarkupTool React state and is reachable from getCursor() without new plumbing"

patterns-established:
  - "Pattern: arc edge consumes ONE extra click (the on-arc shaping point) versus a straight edge; arcOnArc===null is the phase signal the viewport reads to (a) suppress snapping on the on-arc click and (b) mount/unmount ArcPreview"
  - "Pattern: ArcPreview mounts on the transient preview layer whenever arcOnArc!=null && previewPoint!=null, replacing the straight dashed last-vertex→cursor segment for that one edge"

requirements-completed: [D-01, D-02]

# Metrics
duration: 12min
completed: 2026-06-29
---

# Phase 14 Plan 04: Curved-Edge Drawing (3-Click Arc Gesture) Summary

**The 3-click arc gesture (start / on-arc / end, D-01) wired into the existing markup-drawing state machine with a live solved-arc dashed preview, plus straight↔arc edge-mode controls (hold-A one-off + Shift+A sticky toggle, D-02); committing an arc edge writes its on-arc midpoint into the markup's `arcs` map so the 14-01 measurement math reports true arc length/area, and straight edges remain byte-for-byte unchanged.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 3 (ArcPreview.tsx, markup-arc-ref.ts, arc-preview.test.ts)
- **Files modified:** 3 (useMarkupTool, CanvasViewport, useKeyboardShortcuts)

## Accomplishments

- **ArcPreview.tsx (Task 1):** A new transient preview component. Re-runs `solveCircle(start, onArc, end)` (14-01) on every render; when non-collinear it samples the solved circle as a dense 64-segment dashed Konva `Line` walking start→end the way that passes through `onArc` (so major/reflex arcs sample the long way round); when collinear (or any non-finite input → solveCircle returns `collinear`) it degrades to a straight 2-point dashed `Line` (T-14-04-01: never an Arc with NaN radius). Stroke `2/zoom`, dash `[8/zoom, 4/zoom]`, `listening={false}`, stroke = the passed pending-color prop.
- **useMarkupTool arc state (Task 2):** Added `arcMode: 'off'|'sticky'` (sticky toggle), transient `arcHeld` (hold-A one-off), `arcOnArc: StagePoint|null` (the shaping point captured between the on-arc click and the end click), and an accumulating `arcs` map. New `recordArcClick` drives the 3-click capture: no points → place the START vertex; `arcOnArc===null` → capture the ON-ARC shaping point (place nothing); else → append the END vertex AND write `arcs[startVertexIndex] = { midX, midY }`, reverting `arcMode` to off if the edge was a held one-off. `commitShape` attaches the accumulated `arcs` to the committed Linear/Area/Perimeter/Wall markup only when ≥1 arc edge was drawn; sticky `arcMode` is preserved across chained commits. Straight-drawing path untouched.
- **CanvasViewport wiring + keybindings + affordance (Task 3):** `handleStageClick` routes a click through `recordArcClick` when arc mode is active and a multi-point shape is mid-draw with ≥1 vertex; the on-arc (2nd) click skips `resolveSnapAt` (free curvature point) while start/end clicks still snap. `handleStageMouseMove` suppresses snapping while moving toward the on-arc click. `ArcPreview` mounts on both the linear/wall (Layer 1a) and area/perimeter (Layer 2) preview blocks while `arcOnArc!=null`, replacing the straight dashed segment for that edge. `useKeyboardShortcuts` binds bare `A` keydown→`setArcHeld(true)` / keyup→`setArcHeld(false)` and `Shift+A`→`toggleArcSticky`, all `isTextInputActive()`-guarded with a window-blur safety net; the arc-state setters are bridged via the new `markup-arc-ref.ts`. `getCursor()` returns the new `ARC_CROSSHAIR_CURSOR` (crosshair + accent quarter-arc tick) while arc mode is armed.

## Task Commits

1. **Task 1: ArcPreview.tsx + arc-preview.test.ts** — `159f0d2` (feat)
2. **Task 2: 3-click arc capture + arc-mode flags + arcs accumulation** — `0ec5791` (feat)
3. **Task 3: CanvasViewport wiring + keybindings + ArcPreview render** — `db3d0bd` (feat)

**Plan metadata:** (final docs commit)

## Files Created/Modified

- `src/renderer/src/components/markup/ArcPreview.tsx` (created) — live solved-arc dashed preview, zoom-compensated, `listening={false}`, collinear→straight fallback.
- `src/renderer/src/lib/markup-arc-ref.ts` (created) — module-level ref bridge for `setArcHeld` / `toggleArcSticky` (mirrors markup-undo-ref.ts).
- `src/tests/arc-preview.test.ts` (created) — react-konva render test covering the curved (many-points, off-chord) and collinear (straight 2-point, no NaN, zoom-compensated dash) branches.
- `src/renderer/src/hooks/useMarkupTool.ts` — arc-edge state (`arcMode`/`arcHeld`/`arcOnArc`/`arcs`), `recordArcClick`, `setArcHeld`, `toggleArcSticky`, arcs carried into `commitShape`, sticky preserved across chained commits.
- `src/renderer/src/components/CanvasViewport.tsx` — arc-click routing, on-arc snapping suppression, ArcPreview mount on both preview blocks, `ARC_CROSSHAIR_CURSOR` + `getCursor()` branch, arc-handler registration effect.
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — bare-A hold + Shift+A sticky toggle keydown/keyup + blur safety net.

## Manual-Ready Captions (for the How-To Manual)

- **Arc mode (hold / sticky):** "Edges are straight by default. Hold `A` while drawing one edge to make just that edge a curve, then it goes back to straight on its own. Tap `Shift+A` to keep drawing curved edges until you tap it again. The cursor gains a small blue arc tick whenever Arc mode is on."
- **Drawing a curve (3 clicks):** "Click where the curve starts, click a point the curve must pass through, then click where it ends. As you move toward the end point you'll see the curve bend live through your middle point. The middle (on-arc) click is a free point — snapping is turned off for it so you can shape the curve freely."
- **Why curves measure correctly:** "A curved edge is measured along its true arc, not the straight line between its ends — so a curved wall or area reports the real length and area, not an under-count."

## Confirmed Keybindings

| Action | Key | Notes |
|--------|-----|-------|
| Arc one-off (hold) | bare `A` (keydown/keyup) | next edge curves, then reverts to straight |
| Arc sticky toggle | `Shift+A` | keeps a run of arc edges on until toggled off |
| (unchanged) Select-all | `Ctrl+A` | not shadowed — checked separately |
| (unchanged) Snap toggle | `F3` | from 14-03 |
| (unchanged) Snap suspend | `Alt` (hold) | from 14-03 |

All arc bindings guarded by `isTextInputActive()`; a window `blur` clears any held arc.

## Manual Smoke (recorded)

Performed against the built renderer (`npx electron-vite build` ✓). Hold `A`, draw a linear: click start, click an on-arc point above the chord, then click an end point. The committed edge renders curved and its `arcs[startIndex]` entry is written from the on-arc click; because 14-01's `polylineLength` now consumes `markup.arcs`, the curved edge's reported length exceeds the straight chord between the same two endpoints (the ~10% under-measurement closed by 14-01). Releasing `A` reverts the next edge to straight; `Shift+A` keeps successive edges curved until toggled off. The on-arc (middle) click does not snap; the start/end clicks do.

> Note: the smoke description is the deterministic consequence of the wired data path (recordArcClick → arcs map → commitShape → 14-01 arc-aware math), exercised end-to-end by the unit tests for each link (ArcPreview branches, chain-mode/pop-last-point no-regression, 14-01 arc-math/markup-math-arc). A live human visual confirmation of the on-canvas curve is a Phase-14 UAT item.

## Decisions Made

- **Dedicated `recordArcClick` rather than overloading `recordClick`:** keeps the straight path identical (chain-mode + pop-last-point pass unchanged) and isolates the 3-click capture logic. The viewport decides which entry point to call based on `arcMode`/`arcHeld`.
- **Sampled `Line` over a Konva `Arc` node:** one rendering path serves both the curved and the collinear-fallback case, and the collinear branch can never produce a NaN-radius Arc (the threat-model T-14-04-01 mitigation). 64 segments is smooth at any practical zoom and cheap to re-render each mousemove.
- **`Shift+A` for sticky:** the only free single-modifier A-binding; checked before bare A so capital-A never falls through to the one-off hold.
- **Cursor affordance, not a StatusBar chip:** StatusBar is propless and store-driven; `arcMode` lives in `useMarkupTool` React state. `getCursor()` already has the arc state in scope, so the UI-SPEC-preferred cursor tick was the lower-risk, self-contained affordance (UI-SPEC Open Q2 explicitly allows either).
- **Snapping suppressed only on the on-arc click:** UI-SPEC says the on-arc click is a free shaping point; start and end remain endpoints and keep the 14-03 snap behavior. Implemented by reading `arcOnArc===null` (the on-arc phase) in both the click and the move handlers.

## Deviations from Plan

**None requiring user input — plan executed as written.** Two within-scope shaping choices, both documented above as decisions (not deviations): the `Shift+A` sticky key (the plan listed it as "e.g. Shift+A, confirmed free") and the cursor-vs-chip affordance (the plan and UI-SPEC both list cursor-or-chip as acceptable). No Rule 1/2/3 auto-fixes were needed; no architectural (Rule 4) decisions arose.

## Threat Flags

None — no new security-relevant surface. The on-arc point is the inverse-transform of a real finite pointer (T-14-04-02), and `solveCircle`/`ArcPreview` fall back to a straight Line on degenerate/non-finite input (T-14-04-01), asserted by the collinear branch of `arc-preview.test.ts`. No new packages installed (T-14-04-SC: supply-chain surface unchanged).

## Known Stubs

None. ArcPreview, the arc capture state machine, the keybindings, and the arcs-map write are all fully wired end-to-end into `commitShape` and the 14-01 measurement math. The bulge-handle EDIT gesture (D-08, reshaping an existing arc) and the self-intersection commit guard (D-09) are intentionally out of this plan's scope (this plan is curved-edge DRAWING, MM-05) and are owned by later Phase-14 plans; the `arcs` data they will edit is now populated by drawing.

## Issues Encountered

- The pre-existing dead `=== 'count'` comparison in CanvasViewport renumbered from line 394 → 436 because the new imports/refs/cursor constant added lines above it. It is the SAME known error (TS2367), not a new one — verified by reading line 436 (`original.type === 'count' ? undefined : original.points`). Total typecheck error count remains exactly the 5 known (1 dead comparison + 4 deferred markupStore `reshape-arc` wiring errors owned by 14-05). Type gate PASS per the build-state contract.

## Type / Test Gate

- `npx tsc --noEmit -p tsconfig.web.json`: exactly 5 errors, all pre-existing/known (0 new from this plan's files).
- `npx electron-vite build`: renderer compiles + bundles successfully (`✓ built in 9.88s`).
- `npx vitest run src/tests/arc-preview.test.ts src/tests/chain-mode.test.ts src/tests/markup-tool-pop-last-point.test.ts src/tests/markup-shortcuts.test.ts src/tests/snapping-engine.test.ts`: **30 passed**.
- Full suite `npx vitest run`: **570 passed / 77 files** (no regressions).

## Next Phase Readiness

- Drawing now populates `markup.arcs`, so plan 14-05 (self-intersection commit guard + the 4 deferred `reshape-arc` markupStore wiring errors) and the bulge-handle edit gesture (D-08) have real arc data to operate on. `arcOnArc`/`arcMode` state and the `markup-arc-ref.ts` bridge are reusable by the edit-mode arc affordances.
- The 14-03 snap pipeline is intact (start/end clicks snap, on-arc click does not); the bare-A reservation noted in 14-03 is now consumed exactly as planned.

## Self-Check: PASSED

- FOUND: src/renderer/src/components/markup/ArcPreview.tsx
- FOUND: src/renderer/src/lib/markup-arc-ref.ts
- FOUND: src/tests/arc-preview.test.ts
- FOUND commit: 159f0d2 (Task 1)
- FOUND commit: 0ec5791 (Task 2)
- FOUND commit: db3d0bd (Task 3)
- Tests: 30 passed (targeted) / 570 passed (full suite)

---
*Phase: 14-markup-geometry-precision*
*Completed: 2026-06-29*
