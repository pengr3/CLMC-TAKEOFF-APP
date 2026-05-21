---
phase: 12
plan: 6
title: Wave 4 — UAT Checkpoint and Phase Closure
status: complete
completed: 2026-05-21
tasks: 2
commits: 4
---

# Plan 12-06 Summary — Wave 4 UAT and Phase Closure

## Outcome

All 14 UAT scenarios (A–N) PASS after three post-UAT fix commits. Phase 12 is functionally complete: vertex edit mode, drag-to-translate, group move, undo/redo round-trips, page-scope clearing, and Escape-restore all work end-to-end against a real PDF with linear, area, perimeter, wall, and count markups.

## Tasks

### T1 — Human UAT (14 scenarios)

Three issues surfaced during initial UAT that required substantive changes — including one revision to a locked decision (D-04). Each was diagnosed, fixed, committed atomically, and re-verified before moving on.

**Fix #1 — single-click vertex edit + halo only for pins/groups** (commit `000f9e3`)

D-04 originally specified "vertex edit = second click on an already-selected markup." UAT showed the Phase 9 selection halo (HoverRing reused with `COLORS.accent` at full opacity, stroke width `10/zoom`) was so visually dominant at low zoom that it engulfed the 8×8 vertex handles. The two-step "click to select, click again to vertex-edit" flow compounded the problem.

Revised D-04 (post-UAT): single click on a line markup (linear/area/perimeter/wall) enters vertex-edit mode immediately — the handles ARE the selection feedback. Count pins (no vertices) keep the halo as their indicator; rubber-band groups still show halos on every member. The selection ring Layer filters out single-selected line markups.

**Fix #2 — vertex handles appear on first click + follow body-drag** (commit `564f0cb`)

Two latent bugs surfaced once D-04 became "first click = vertex edit":

1. **Handles never visible.** `handleStageClick`'s click-outside-commit branch read `e.target.getAttr('id')` to identify the click target, but markup Groups never set an `id` Konva attr — `clickedId` was always `undefined`. Under the old D-04 the bug was masked because `vertexEditMarkupId` was null on first click. Under the new D-04, `handleMarkupClick` sets `vertexEditMarkupId` then `handleStageClick` (bubbles up next) reads `getState() = newId`, compares `undefined !== newId`, and immediately commits — handles render for one frame then unmount.

   Fix: `markupClickedRef` handoff. `handleMarkupClick` sets it to the clicked markup id (consume-on-read); `handleStageClick` reads it before checking the commit branch. Non-null = click landed on a markup, skip commit. Null = empty stage click, commit as before.

2. **Vertex handles left behind during body-drag.** `vertexHandleLayer` only honored `dragPreview.type === 'vertex'`, so during a body-drag the markup body moved via `overridePoints` while handles stayed pinned to stored positions. Fix: extend `vertexHandleLayer` to also handle `dragPreview.type === 'body'` — shift every vertex by the drag delta so handles travel with the markup.

**Fix #3 — zoom-compensate D-09 4px drag threshold** (commit `72094dc`)

The 4px movement threshold (D-09) was expressed in page-space units, but `dx/dy` come from `stage.getAbsoluteTransform().copy().invert().point(pointer)` — screen → page conversion. At 800% zoom, 4 page-units = 32 screen pixels, so small vertex nudges and minor body translates were silently ignored.

Fix: compute `dragThreshold = 4 / currentZoom` once at the top of `handleStageMouseUp` (live read via `getState()` so the callback's dep list stays narrow — no re-registration on every zoom step). Applied uniformly to all three drag-commit branches: vertex-drag (line ~1132), body-drag (line ~1180), rubber-band (line ~1230).

### T2 — Phase closure

- ROADMAP.md: Phase 12 entry checkbox flipped, plan list marked `[x]`, progress table row set to `7/7 Complete 2026-05-21`.
- STATE.md: decisions appended (see "Decisions added" below); current focus advanced; session continuity updated.
- SUMMARY.md committed.

## UAT Result

| ID | Scenario | Status |
|----|----------|--------|
| A | Vertex edit activation (revised D-04 — single click) | PASS |
| B | Handle zoom compensation (D-05) | PASS |
| C | Enter to commit (D-06) | PASS |
| D | Escape to restore (D-06) | PASS |
| E | Click-outside to commit (D-06) | PASS |
| F | Click markup B while editing A (commit A → B enters vertex edit) | PASS |
| G | Body translate (D-07) — handles ride along during drag | PASS |
| H | 4px screen-pixel movement threshold (D-09, post-fix at 100% and 800% zoom) | PASS |
| I | Group move (D-08) — halos on multi-select, single undo | PASS |
| J | Count pin: halo only, no vertex handles | PASS |
| K | Vertex edit on area / perimeter / wall (polygon closes) | PASS |
| L | Regression: rubber-band still works | PASS |
| M | Regression: in-progress Ctrl+Z pops last point only (Phase 10) | PASS |
| N | Vertex edit cleared on page navigation | PASS |

## Decisions added (for STATE.md "Key Decisions Locked")

| Decision | Rationale |
|----------|-----------|
| D-04 revised: single click on a line markup = vertex edit (post-UAT) | Original "second click" gating hid handles behind a flow most users didn't intuit. With handles serving as selection feedback for line markups, two-step activation is redundant. |
| Selection halo reserved for count pins and multi-select | Single-selected line markups show vertex handles as feedback; the accent-color halo (10/zoom stroke width) visually engulfs the 8px handles at low zoom. Pins still need the halo (no vertices); rubber-band groups need it on every member. |
| markupClickedRef handoff between handleMarkupClick and handleStageClick | Konva markup Groups don't set an `id` attr, so `e.target.getAttr('id')` returns undefined. The ref is the only reliable way to distinguish "click landed on a markup (transition already handled)" from "click landed on empty stage (commit vertex-edit)". |
| vertexHandleLayer follows BOTH vertex-drag and body-drag previews | Body-drag previously left handles behind because only `dragPreview.type === 'vertex'` was honored. Shifting every vertex by the body-drag delta keeps handles attached to the markup throughout the gesture. |
| D-09 threshold computed as `4 / currentZoom` page-space units | D-09's stated intent is "4 screen pixels" — distinguishing click from drag. dx/dy are page-space, so the threshold must be zoom-compensated. Applied uniformly to vertex-drag, body-drag, and rubber-band commits. |
| move-markups command normalises count pins to oldPoints/newPoints arrays | Uniform undo reducer — count pins become single-element arrays so the same redo/undo branch handles both point-bearing and points-bearing markup types. |
| VertexHandleOverlay in own Layer above 1b | Decoupled from markup components; handles are transient UI; layer ordering ensures handles intercept events before markup bodies (RESEARCH.md Pitfall 5). |
| bodyDraggedRef mirrors rubberBandDraggedRef | Prevents Konva post-mouseup click from wiping selection after body drag — same pattern as Phase 9 rubber-band fix (commit 4db36bb). |
| onHandleMouseDown callback preferred over e.target.name() in Stage handler | `e.cancelBubble = true` in the Rect's mousedown suppresses the Stage event entirely; callback-first pattern is more reliable than name-startsWith detection. |
| vertex-edit state in viewerStore (not local ref) | Render-driven — handles mount/unmount based on vertexEditMarkupId; useState-backed is superior to a bare ref when state drives React renders. |

## Verification

- `npx vitest run` — **71 files, 511 tests pass** (no regressions across post-UAT fixes)
- `npx tsc --noEmit` — clean
- Phase 12 blocking anti-patterns held throughout: `commitVertexEdit` byte-identical across Wave 3a→3c (cleanup-only, no per-vertex dispatch); all live store reads via `getState()` (no stale-closure reads in mouseDown/mouseUp handlers)

## Commits

| Commit | Description |
|--------|-------------|
| `000f9e3` | fix(12-06): single-click vertex edit + halo only for pins/groups |
| `564f0cb` | fix(12-06): vertex handles appear on first click + follow body-drag |
| `72094dc` | fix(12-06): zoom-compensate D-09 4px drag threshold |
| (this) | docs(12-06): complete Wave 4 UAT + phase closure |
