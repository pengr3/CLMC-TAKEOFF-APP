---
phase: 14-markup-geometry-precision
plan: 03
subsystem: markup
tags: [snapping, canvas-wiring, konva, zoom-compensated-overlay, keybindings, statusbar, react, typescript]

requires:
  - phase: 14-markup-geometry-precision (plan 02)
    provides: snapping-engine.ts (buildSnapIndex/resolveSnap) — grid-hash spatial index for vertex + nearest-on-segment snapping
provides:
  - "SnapIndicator.tsx — zoom-compensated □/△ snap glyph with two-pass contrasting halo, every shape listening=false (D-04)"
  - "Live snap wiring in CanvasViewport: index rebuild on geometry+zoom change, page-point override in placement/vertex-drag/body-drag + committed-click placement (D-05/D-07)"
  - "Snap controls: F3 persistent toggle + Alt momentary suspend (D-03); StatusBar ON/held-off/OFF pill"
  - "viewerStore runtime-only snapEnabled (default true) + snapSuspended flags, never serialized to .clmc (T-14-03-02)"
affects: [arc-mode-14-04, self-intersection-guard-14-05, MM-06]

tech-stack:
  added: []
  patterns:
    - "Spatial-index held in a useRef rebuilt by a useEffect keyed on page geometry + zoom — pointer callbacks read it via the ref so their dep lists stay narrow (mirrors vertexDragRef)"
    - "Snap-resolution funneled through one resolveSnapAt(pt, exclude) helper reading snapEnabled/snapSuspended via getState(); returns the overridden page-point and publishes the glyph state"
    - "Placement snap converts the snapped page-point back to SCREEN coords before feeding updateMarkupPreview/recordMarkupClick (which convert screen→page internally) — no useMarkupTool API change"

key-files:
  created:
    - src/renderer/src/components/markup/SnapIndicator.tsx
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/renderer/src/components/StatusBar.tsx
    - src/renderer/src/stores/viewerStore.ts
    - src/renderer/src/types/viewer.ts

key-decisions:
  - "snapEnabled/snapSuspended read via useViewerStore.getState() inside resolveSnapAt (not subscribed in CanvasViewport) — keeps the pointer callbacks' dep lists narrow and avoids a no-op subscription; StatusBar is the only subscriber"
  - "IN_PROGRESS_MARKUP_ID sentinel ('__in_progress__') passed as the placement exclude with allowVertexIndices=[0]; the in-progress markup is not in the committed index, so this documents the D-07 close-the-loop-only restriction without affecting committed-geometry snaps"
  - "Snap glyph also applied to the committed click (recordMarkupClick), not just the preview — so the placed vertex lands exactly where the □/△ glyph was drawn"
  - "Alt suspend adds a window blur safety net (Alt+Tab loses keyup) so snapping is never left stuck-off"
  - "Snap index built from committed pageMarkups only: count pins → single vertex; linear/wall → open polyline edges; area/perimeter → edges incl. the closing last→first edge"

patterns-established:
  - "resolveSnapAt(pt, exclude) is the single snap entry point — placement, vertex-drag, body-drag, and click-placement all route through it so the override + glyph-publish logic lives in one place"
  - "Snap glyph renders on its own transient listening=false Layer above committed markups, cleared to null when not placing/editing"

requirements-completed: [D-03, D-04, D-05, D-07]

duration: 13min
completed: 2026-06-29
---

# Phase 14 Plan 03: Snap Pointer-Pipeline Wiring & Controls Summary

**Wires the 14-02 grid-hash snap engine into the live Konva pointer pipeline — building the index on geometry/zoom change, overriding the cursor's page-point during placement and Phase-12 vertex/body-drag editing (honoring D-07), rendering the zoom-compensated □/△ glyph, and adding F3-toggle / Alt-suspend controls plus a StatusBar ON/held-off/OFF pill.**

## Performance

- **Duration:** ~13 min
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 1 (SnapIndicator.tsx)
- **Files modified:** 5 (CanvasViewport, useKeyboardShortcuts, StatusBar, viewerStore, viewer types)

## Accomplishments

- **SnapIndicator.tsx (Task 1):** A new transient glyph component. □ vertex glyph = axis-aligned `Rect` (12/zoom); △ segment glyph = `RegularPolygon sides={3}` point-up (14/zoom circum-diameter). Each glyph is drawn twice — a wider contrasting-halo pass (`getContrastingInk()` of the underlying markup color, 3.5/zoom) then the `COLORS.accent` foreground pass (2/zoom). Every shape `listening={false}`. The ✕ intersection glyph is RESERVED and not shipped (D-06). Renders nothing when the candidate is null.
- **viewerStore snap state (Task 1):** Added runtime-only `snapEnabled` (default `true`) + `snapSuspended` (default `false`) with setters. Neither field is in the serialize path (`project-serialize.ts` reads explicit fields only) — they never persist to `.clmc` (threat T-14-03-02).
- **Live snap wiring (Task 2):** A `useEffect` keyed on `[pageMarkups, currentZoom]` rebuilds the grid-hash index into `snapIndexRef` (count pins → single vertex; open polylines → n−1 edges; closed polygons → n edges incl. the closing edge); `cell = 12/currentZoom`. A single `resolveSnapAt(pt, exclude)` helper (gate-check → `resolveSnap` → publish glyph → return overridden point) is invoked from the placement, vertex-drag, and body-drag branches of `handleStageMouseMove`, plus the committed-click placement. `tol = 12/liveZoom`. D-07 exclusion: placement passes the in-progress sentinel + `allowVertexIndices=[0]`; vertex-drag passes `blockVertexIndex`; body-drag excludes the dragged markup. `<SnapIndicator>` mounts on a transient `listening={false}` layer above committed markups.
- **Controls + StatusBar (Task 3):** `F3` toggles `snapEnabled` persistently; `Alt` keydown suspends, keyup restores (symmetric listeners + a `blur` safety net for Alt+Tab). Both guarded by `isTextInputActive()`. No bare-'A' binding added (reserved for arc mode 14-04). StatusBar gains a `Snap:` segment after Scale — `ON` (`#cccccc` + accent `#0078d4` dot), `held off` (dimmed `#808080`), `OFF` (amber `#e8a838`), `aria-live="polite"`.

## Task Commits

1. **Task 1: SnapIndicator.tsx + viewerStore snap state** — `12263aa` (feat)
2. **Task 2: snap injection in pointer pipeline + index rebuild + glyph render** — `28ac865` (feat)
3. **Task 3: Alt/F3 keybindings + StatusBar Snap pill** — `f42bfec` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `src/renderer/src/components/markup/SnapIndicator.tsx` (created) — zoom-compensated □/△ glyph, two-pass halo, listening=false
- `src/renderer/src/components/CanvasViewport.tsx` — snap index rebuild effect, `resolveSnapAt` helper, override in 3 move branches + click placement, SnapIndicator layer, IN_PROGRESS_MARKUP_ID sentinel
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — F3 toggle, Alt keydown suspend, Alt keyup + blur restore
- `src/renderer/src/components/StatusBar.tsx` — Snap ON/held-off/OFF segment with accent dot
- `src/renderer/src/stores/viewerStore.ts` — snapEnabled/snapSuspended state + setters
- `src/renderer/src/types/viewer.ts` — snap flags + setter signatures on ViewerState

## Manual-Ready Captions (for the How-To Manual)

- **Vertex snap (□):** "A blue square means your cursor has locked onto an existing point — a corner or the end of a line. Click to place exactly on it."
- **Segment snap (△):** "A blue triangle means your cursor has locked onto the nearest point along an existing line (not a corner). Click to drop a point right on that line."
- **Close-the-loop (□ on the start vertex):** "When tracing an area or perimeter, a blue square on your very first point means you're about to close the shape. Click to finish the loop."
- **Snapping controls:** "Snapping is on by default — your cursor jumps to nearby points and lines and shows a blue marker. Hold `Alt` to ignore snapping for a single click, or press `F3` to switch snapping off entirely (the status bar shows OFF in amber). Press `F3` again to turn it back on."

## Decisions Made

- **Snap flags read via getState(), not subscribed in CanvasViewport:** subscribing produced unused-variable type errors and would needlessly widen pointer-callback deps. `resolveSnapAt` reads them with `useViewerStore.getState()`; the StatusBar is the only place that subscribes (it needs re-render on flag change). Matches the existing `liveZoom` getState idiom in `handleStageMouseUp`.
- **Placement snap applied to the committed click too:** the plan emphasized the preview override; applying the same `resolveSnapAt` to `recordMarkupClick` guarantees the placed vertex matches the glyph the estimator saw — otherwise the preview could snap while the actual placed point did not.
- **Alt blur safety net:** Alt+Tab steals the keyup, which would leave `snapSuspended=true` permanently. A `window blur` listener clears the flag, so snapping is never silently stuck off.

## Deviations from Plan

**None requiring user input — plan executed as written.** Two minor implementation-shaping adjustments, both within Rule 3 (blocking-issue auto-fix), documented here:

1. **[Rule 3 - Blocking] Removed the snapEnabled/snapSuspended subscriptions from CanvasViewport.** The plan's Task 1 mentioned them generally, but subscribing them in CanvasViewport (where they are only consumed inside `resolveSnapAt` via `getState()`) produced TS6133 "declared but never read" errors. Resolved by reading via `getState()` only — the documented narrow-dep pattern. Files: CanvasViewport.tsx. Commit: 28ac865.
2. **[Rule 2 - Missing critical functionality] Added the click-placement snap + Alt blur safety net.** Snapping the preview alone (per the literal acceptance text) would let the committed point diverge from the glyph; and Alt+Tab would strand the suspend flag. Both are correctness requirements for the feature to behave as specified. Files: CanvasViewport.tsx, useKeyboardShortcuts.ts. Commits: 28ac865, f42bfec.

## Issues Encountered

- `npm run build` halts at its `tsc` typecheck gate on the **5 pre-existing known errors** (1 dead `=== 'count'` comparison in CanvasViewport:394 that predates phase 14; 4 `reshape-arc` undo/redo wiring errors in markupStore.ts deferred to plan 14-05). These are explicitly out of this plan's scope (per the execution context's `<known_build_state>`). The renderer itself compiles and bundles cleanly — verified by running `npx electron-vite build` directly (`✓ built in 6.68s`), which uses esbuild and does not gate on TS type errors. The total typecheck error count is exactly 5 (no new errors introduced). Per the build-state contract, the type gate is PASS for this plan.

## Type / Test Gate

- `npx tsc --noEmit -p tsconfig.web.json`: exactly 5 errors, all pre-existing/known (0 from this plan's files except the pre-existing CanvasViewport:394 dead comparison).
- `npx electron-vite build`: renderer compiles + bundles successfully.
- `npx vitest run src/tests/highlight-overlay-listening.test.ts src/tests/markup-shortcuts.test.ts src/tests/snapping-engine.test.ts`: **27 passed** (no regressions).

## Next Phase Readiness

- Snapping is live in placement and Phase-12 editing. Plan 14-04 (arc mode) can reuse `resolveSnapAt` for arc clicks 1 and 3 (endpoints) and skip it for the on-arc shaping click (click 2) per UI-SPEC. The bare-'A' key is left free as required.
- Plan 14-05 (self-intersection commit guard) is unaffected; it consumes `findSelfIntersection` from 14-02 and will also resolve the 4 deferred `markupStore` reshape-arc type errors.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced. The `IN_PROGRESS_MARKUP_ID` sentinel is an intentional D-07 documentation device (the in-progress markup is genuinely absent from the committed snap index), not a stub.

## Self-Check: PASSED

- FOUND: src/renderer/src/components/markup/SnapIndicator.tsx
- FOUND commit: 12263aa (Task 1)
- FOUND commit: 28ac865 (Task 2)
- FOUND commit: f42bfec (Task 3)
- Tests: 27 passed (10 overlay-listening + 9 markup-shortcuts + 8 snapping-engine)

---
*Phase: 14-markup-geometry-precision*
*Completed: 2026-06-29*
