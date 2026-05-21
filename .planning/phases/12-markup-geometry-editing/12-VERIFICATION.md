---
phase: 12-markup-geometry-editing
verified: 2026-05-21T16:50:00Z
status: human_needed
score: 5/5 success criteria verified (code evidence); 4/14 UAT scenarios need human re-verification on a live PDF
overrides_applied: 1
overrides:
  - must_have: "Clicking an already-selected markup enters vertex edit mode — square handles appear at each vertex"
    reason: "Post-UAT revision of D-04 — single click on line markups (linear/area/perimeter/wall) enters vertex edit immediately. Two-step 'select then click-again' flow was hiding handles behind a flow most users didn't intuit AND the Phase 9 selection halo (HoverRing with COLORS.accent @ 1.0 opacity, stroke 10/zoom) visually engulfed the 8px handles. Final behavior preserves the spirit of the success criterion (click + handles) collapsed into one click. Selection halo is reserved for count pins (no vertices) and rubber-band multi-select. Encoded in CanvasViewport.tsx:530-557 (handleMarkupClick) and CanvasViewport.tsx:1728-1745 (selection-ring Layer filter)."
    accepted_by: "user (Phase 12 task brief)"
    accepted_at: "2026-05-21T16:35:00Z"
human_verification:
  - test: "Single click on a placed linear / area / perimeter / wall markup enters vertex edit mode — 8x8px white handles with markup-colored border appear at each vertex (no two-step flow)"
    expected: "Handles visible on first click; the original selection halo (accent-color ring at 10/zoom) does NOT also render around the markup (it would engulf the handles)"
    why_human: "Visual confirmation that handles render and remain at zoom 4x and fit-to-window; halo absence is visible-only"
  - test: "Drag a vertex handle on a linear with 3 points by 10+ screen pixels; release"
    expected: "Line updates live during drag; on release the vertex stays at new position; Ctrl+Z restores exactly one vertex move; vertex edit mode stays active (handles still visible after release)"
    why_human: "Live preview rendering, drag gesture timing, and undo single-step granularity all require human perception"
  - test: "Enter vertex edit on an area polygon; press Escape after dragging a handle"
    expected: "Markup snaps back to ORIGINAL session-start vertex positions; no undo entry created (Ctrl+Z does not undo an Escape-restored markup)"
    why_human: "Confirming the snapshot restore vs undo-step behavior is observation-only"
  - test: "Rubber-band select two markups; drag either one by 10+ screen pixels"
    expected: "Both markups move by the same delta; halos remain visible on both during drag; Ctrl+Z restores BOTH in a single step"
    why_human: "Group move visual coherence and single-undo restoration require human observation"
---

# Phase 12: Markup Geometry Editing Verification Report

**Phase Goal:** Estimators can directly adjust placed markups without deleting and redrawing — vertex edit mode (click a selected markup again to enter handle-drag mode, reposition any vertex) and drag-to-translate (drag a selected markup to move its entire shape); group move works when multiple markups are selected; all edits are undoable via Ctrl+Z.

**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | Clicking an already-selected markup enters vertex edit mode — square handles appear at each vertex; dragging a handle repositions that vertex and the shape updates live | VERIFIED (override) | `CanvasViewport.tsx:530-557` (`handleMarkupClick` — line markups enter vertex edit on FIRST click per revised D-04; count pins keep halo). `VertexHandleOverlay.tsx:41-83` (8x8 handles with markup color border, zoom-compensated). `CanvasViewport.tsx:1043-1073` (`handleStageMouseMove` vertex branch writes `dragPreview.points` for live update). Override accepted: revised D-04 collapsed two-step into single click. |
| SC2 | Pressing Enter or clicking outside the markup commits the vertex changes; Escape restores original vertex positions | VERIFIED | Enter handler: `CanvasViewport.tsx:670-679` (reads vertexEditMarkupId via getState(); calls commitVertexEdit). Escape handler: `CanvasViewport.tsx:640-649` (calls cancelVertexEdit; markup.points were never mutated mid-session so visual reverts). Click-outside: `CanvasViewport.tsx:901-933` (three-flag suppression + markupClickedRef handoff; commit only when click landed on empty stage). |
| SC3 | Dragging a selected markup (not on a handle) translates the entire shape — 4px movement threshold prevents accidental moves on precise clicks | VERIFIED | Body-drag mouseDown: `CanvasViewport.tsx:983-1016` (markupBodyDownRef set by markup `onMarkupMouseDown`; bodyDragRef snapshot via store getState()). MouseMove preview: `CanvasViewport.tsx:1075-1088`. MouseUp commit: `CanvasViewport.tsx:1178-1236` with **zoom-compensated 4 / liveZoom threshold** (line 1132 — post-UAT fix 72094dc). |
| SC4 | When multiple markups are selected, dragging any one moves all selected shapes by the same delta (group move) | VERIFIED | `CanvasViewport.tsx:1010-1014` (bodyDragRef.ids captured from `[...selectedMarkupIds]` snapshot). MouseMove writes deltas for every id in bd.ids (line 1083). MouseUp builds `moves[]` array and dispatches ONE `moveMarkups(moves)` call (line 1227) — single command per D-08. |
| SC5 | All geometry edits (vertex move, single translate, group translate) are undoable with Ctrl+Z as a single action | VERIFIED | markupStore.moveVertex pushes ONE `move-vertex` command (markupStore.ts:276-288). moveMarkups pushes ONE `move-markups` command containing ALL moves (markupStore.ts:307-320). Undo branches: markupStore.ts:385-421 (both branches placed BEFORE `cmd.markup.page` fallthrough per blocking anti-pattern). Redo branches: markupStore.ts:500-536. 18 dedicated tests pass (`vitest run src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts src/tests/vertex-edit-mode.test.ts` → 18/18). |

**Score:** 5/5 success criteria verified in code (SC1 via override).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/renderer/src/types/markup.ts` | `MarkupCommand` union extended with `move-vertex` and `move-markups` variants | VERIFIED | Lines 79-101 — both union members present with full field set; StagePoint imported. |
| `src/renderer/src/stores/markupStore.ts` | `moveVertex` action + `moveMarkups` action + undo/redo branches | VERIFIED | moveVertex (256-289), moveMarkups (291-321), undo branches (385-421), redo branches (500-536). Defensive `if (target.type === 'count') return s` guard on moveVertex. |
| `src/renderer/src/types/viewer.ts` + `src/renderer/src/stores/viewerStore.ts` | `vertexEditMarkupId` field + `setVertexEditMarkupId` + `clearVertexEdit` + lifecycle clears | VERIFIED | viewerStore.ts lines 17, 29, 35, 42, 48, 84, 107, 109, 133 — initial value, setFile, setPage, nextPage, prevPage, resetViewer, set/clear actions, hydrate all include the field. |
| `src/renderer/src/components/markup/VertexHandleOverlay.tsx` | 8x8 zoom-compensated handle Rects with `name='handle-N'`, `listening=true`, e.cancelBubble | VERIFIED | 83-line component renders zero handles for count, N handles for points-array. White fill, markup.color stroke, 16/zoom hit area. Pitfall 6 comment present (line 72). |
| All 5 markup components have `onMarkupMouseDown?` + `overridePoints?`/`overridePoint?` | Additive optional props on Linear/Area/Perimeter/Wall/CountPin | VERIFIED | LinearMarkup.tsx (lines 24-26, 71-78, 109), CountPinMarkup.tsx (lines 24-26, 62, 87-99), confirmed via grep on AreaMarkup, PerimeterMarkup, WallMarkup. Effective-geometry indirection (`effectivePoints = overridePoints ?? markup.points`) routes through all geometry calls (flatPoints, centroid, arc-length midpoint). |
| `src/renderer/src/components/CanvasViewport.tsx` | All event wiring (handleMarkupClick revised D-04, handleStageMouseDown body-drag + vertex safety net, MouseMove/Up vertex+body branches, click-outside commit with 3-flag suppression, keyboard Enter/Escape, page-change/tool-change cleanup effects, selection-ring Layer filter) | VERIFIED | All sites grep-verified at exact lines documented in summaries. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `handleMarkupClick` (CanvasViewport) | `setVertexEditMarkupId` (viewerStore) | First-click on line markup branch | WIRED | Line 546; condition `markup.type !== 'count'` short-circuits count pins. |
| `VertexHandleOverlay` mount | `vertexHandleLayer` named-const | `if (vertexEditMarkupId === null) return null` | WIRED | Lines 1347-1395; renders inside `<Layer listening={true}>`; supports vertex AND body drag preview translation (post-UAT fix 564f0cb at lines 1352-1360). |
| `handleStageMouseUp` vertex branch | `markupStore.moveVertex` | `useMarkupStore.getState().moveVertex(...)` | WIRED | Line 1162-1164; behind 4-screen-pixel (zoom-compensated `4 / liveZoom`) threshold + Pitfall 7 no-op guard (line 1161). |
| `handleStageMouseUp` body-drag branch | `markupStore.moveMarkups` | `useMarkupStore.getState().moveMarkups(moves)` | WIRED | Line 1227; single dispatch for both single-translate and group-move. |
| `handleStageClick` click-outside | `commitVertexEdit` | Three-flag suppression + markupClickedRef handoff | WIRED | Lines 924-933; bodyDraggedRef, rubberBandDraggedRef, vertexDragRef === null all required; markupClickedRef !== null skips commit (handles already routed by handleMarkupClick). |
| `handleKeyDown` Enter | `commitVertexEdit` | `useViewerStore.getState().vertexEditMarkupId !== null` | WIRED | Lines 674-679; placed BEFORE existing drawing-mode Enter branch. |
| `handleKeyDown` Escape | `cancelVertexEdit` | `useViewerStore.getState().vertexEditMarkupId !== null` | WIRED | Lines 645-649; placed BEFORE existing drawing-mode Escape branch. |
| `setPage` / `nextPage` / `prevPage` / `setFile` / `resetViewer` / `hydrate` | `vertexEditMarkupId: null` | Lifecycle reset | WIRED | viewerStore.ts lines 29, 35, 42, 48, 84, 133 (all 6 sites include the field). Page-change effect in CanvasViewport (lines 605-609) also clears local drag preview and vertexEditOriginalRef. |
| Body-drag click suppression | `handleStageClick` | `bodyDraggedRef` one-shot flag | WIRED | Lines 945-948 mirror existing rubberBandDraggedRef pattern. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| VertexHandleOverlay rendered handles | `markup.points` (or `dragPreview.points` for live) | `vertexHandleLayer` named-const reads `pageMarkups.find(m => m.id === vertexEditMarkupId)` | Yes — live `pageMarkups` from useMarkupStore subscription | FLOWING |
| Live drag preview during vertex drag | `dragPreview.points` (DragPreview union, type='vertex') | `setDragPreview()` from handleStageMouseMove writes new points each frame | Yes — recomputed every mousemove via inverse-transform pointer | FLOWING |
| Live drag preview during body drag | `dragPreview.deltas[id]` (DragPreview union, type='body') | `setDragPreview()` from handleStageMouseMove writes per-id deltas | Yes — fresh dx/dy on every mousemove; each markup renderer adds delta to its stored points/point | FLOWING |
| moveVertex undo restoration | `cmd.oldPoint` from MarkupCommand | Captured at action time from `target.points[vertexIndex]` (markupStore.ts:267) | Yes — pre-mutation snapshot stored on command | FLOWING |
| moveMarkups undo restoration | `move.oldPoints[]` from MarkupCommand | Caller passes oldPoints (CanvasViewport snapshots from store.getState() at mouseDown) | Yes — pre-mutation snapshot | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Wave 0 RED test files now GREEN | `npx vitest run src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts src/tests/vertex-edit-mode.test.ts` | 3 files, 18/18 passing | PASS |
| Full project test suite | `npx vitest run` | 71 files, 511/511 passing | PASS |
| TypeScript compiles | `npx tsc --noEmit` | exit 0, no output | PASS |
| Commit chain matches summaries | `git log --oneline -25` | All 14 Phase 12 commits present (12-00 to 12-06 + 3 post-UAT fixes 000f9e3, 564f0cb, 72094dc + docs) | PASS |
| Single moveVertex dispatch per drag session | `grep -n "moveVertex(" CanvasViewport.tsx` | Exactly ONE call site at line 1164 inside handleStageMouseUp vertex branch | PASS |
| commitVertexEdit body is cleanup-only | Read CanvasViewport.tsx:565-569 | Body is exactly `setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null` — no forEach, no dispatch | PASS |
| Stale-closure rule held in mouseDown/Up | grep for `pageMarkups\[currentPage\]` in handleStageMouseDown/Up | All reads go through `useMarkupStore.getState().pageMarkups[currentPage]` (lines 999, 1059, 1197) | PASS |
| Zoom-compensated 4px threshold | grep for `dragThreshold = 4 /` | Computed once at line 1132 from `useViewerStore.getState().pageViewports[currentPage]?.zoom`; applied to vertex/body/rubber-band branches uniformly | PASS |

### Requirements Coverage

No v1 requirements claimed by Phase 12 — per task brief this is a v1.1 quality-of-life enhancement covering GAP-T1-01 + GAP-T1-02. Verified:
- All Phase 12 plan frontmatter `requirements-completed` fields are empty arrays (grep on `.planning/phases/12-markup-geometry-editing/*-SUMMARY.md` confirms `[]`).
- REQUIREMENTS.md has no Phase 12 mapping (grep returned no matches for "Phase 12" or "GAP-T1").
- The existing 25 v1 requirements remain mapped to their respective phases (REQUIREMENTS.md PDF-01..MARK-10..PERS-01..EXPRT-01..VIEW-01) — none of these were touched.

No requirements claimed that were not delivered. No orphaned requirements.

### Anti-Patterns Found

Scanned all Phase 12-modified files. Results:

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| CanvasViewport.tsx | 565-569 | `commitVertexEdit` body | Info | Verified to be byte-identical cleanup-only — matches `.continue-here.md` blocking anti-pattern requirement. |
| CanvasViewport.tsx | 988-1016, 1059, 1197 | `useMarkupStore.getState().pageMarkups[currentPage]` inside event handlers | Info | All three event-handler sites read via getState() per blocking anti-pattern. Defensive `pageMarkups` selector remains in useCallback deps for the rubber-band branch which uses the closed value (mouseup synchronous gesture commit). |
| CanvasViewport.tsx | 1132 | `dragThreshold = 4 / liveZoom` | Info | Post-UAT fix 72094dc — D-09 zoom-compensation. Applied uniformly to vertex, body, and rubber-band branches. |

No `TODO`, `FIXME`, `placeholder`, or `coming soon` strings in Phase 12 source files. No hardcoded empty arrays/objects flowing to UI. No `return null` / `return []` / `return {}` patterns that would indicate stubbed handlers.

### Human Verification Required

Code evidence verifies every success criterion in static analysis. Some visual/behavioral checks remain inherently human (gesture timing, visual halo presence, multi-frame live preview rendering). The 14-scenario UAT (12-06-SUMMARY.md) reports 14/14 PASS — re-verify the 4 highest-leverage scenarios listed in frontmatter `human_verification` to confirm post-UAT fixes hold.

### Gaps Summary

**No code-level gaps found.** All 5 ROADMAP success criteria are achieved in the codebase:
- All required types, store actions, hooks, components, and event wiring are present and correctly connected.
- 18/18 Wave 0 RED stub tests pass. Full 511-test suite passes with zero regressions.
- Both blocking anti-patterns from `.continue-here.md` held throughout: commitVertexEdit is cleanup-only (no per-vertex dispatch) and all live store reads in mouseDown/mouseUp handlers use `getState()` (no stale-closure reads).
- TypeScript compiles clean.
- STATE.md decisions properly reflect the revised D-04 and the three post-UAT fixes (000f9e3, 564f0cb, 72094dc).
- Override accepted for SC1: revised D-04 (single-click) preserves the spirit of "click + handles" — handles ARE the selection feedback for line markups (selection halo would visually engulf 8px handles), with selection halo reserved for count pins and rubber-band groups.

**Status is `human_needed`** rather than `passed` because the listed human_verification items confirm visual-only / multi-frame-gesture behaviors that static code analysis cannot fully validate. The phase claim is supported by code evidence; final acceptance awaits a brief re-walk of the four highest-leverage UAT scenarios on a live PDF.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
