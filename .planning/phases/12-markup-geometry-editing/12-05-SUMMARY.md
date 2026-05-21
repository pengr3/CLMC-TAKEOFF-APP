---
phase: 12
plan: 5
subsystem: markup-geometry-editing
tags: [wave-3c, react-konva, vertex-drag, click-outside-commit, canvas-viewport, stale-closure-fix, window-mouseup-cleanup]
requires:
  - phase: 12-markup-geometry-editing
    provides: markupStore-moveVertex-action, viewerStore-vertexEditMarkupId-state-machine, VertexHandleOverlay-component, canvasViewport-dragPreview-dual-ref-pattern, canvasViewport-vertexEditOriginalRef-snapshot, canvasViewport-commitVertexEdit-cleanup-only-callback, canvasViewport-vertexHandleLayer-named-jsx-variable, canvasViewport-bodyDragRef-state-machine, canvasViewport-bodyDraggedRef-click-suppression
provides:
  - canvasViewport-vertexDragRef-state-machine
  - canvasViewport-onHandleMouseDown-vertex-drag-initiation
  - canvasViewport-handleStageMouseDown-vertex-drag-safety-net
  - canvasViewport-handleStageMouseMove-vertex-preview-branch
  - canvasViewport-handleStageMouseUp-vertex-commit-branch-with-no-op-guard
  - canvasViewport-handleStageClick-click-outside-vertex-commit-D06
  - canvasViewport-window-mouseup-cleanup-for-all-three-drag-refs
affects:
  - phase-12 wave 4 (12-06 UAT) — all six locked decisions (D-04..D-09) now implemented end-to-end
tech-stack:
  added: []
  patterns:
    - onHandleMouseDown-callback-as-vertex-drag-entry-point-via-konva-bubble-cancel
    - vertex-drag-and-body-drag-ordered-fallthrough-in-stage-mouseup
    - click-outside-commit-with-three-flag-suppression-guard-vertex-body-rubberband
    - dragPreviewRef-current-read-in-mouseup-with-origin-delta-fallback
    - pitfall-7-no-op-vertex-dispatch-suppression-via-origin-comparison
    - window-mouseup-cleanup-for-all-active-drag-refs-on-out-of-bounds-release
    - vertex-edit-mode-persists-across-handle-drag-releases-for-chained-edits
key-files:
  created: []
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
key-decisions:
  - "Vertex drag dispatch lives ONLY in handleStageMouseUp — never in commitVertexEdit. commitVertexEdit body remained byte-identical to Wave 3a output (setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null). Anti-pattern guard from .planning/phases/12-markup-geometry-editing/.continue-here.md respected: ONE drag = ONE moveVertex command = ONE undo entry. commitVertexEdit, called by Enter and click-outside, is purely cleanup — the per-drag-session dispatch already happened on each handle release."
  - "vertexEditOriginalRef intentionally NOT updated after each vertex commit mid-session. The snapshot is set ONCE at session start in handleMarkupClick (Wave 3a) and never touched again until the session ends. This guarantees Escape always restores to the session-start state, NOT the most-recent-vertex state. Trade-off: Escape after several vertex drags restores ALL of them visually, but the individual commands stay on the undo stack. User can Ctrl+Z them one at a time after the Escape if they want fine-grained undo. Locked decision per .continue-here.md."
  - "Click-outside guard has THREE flags: vertexDragRef === null (vertex drag must be finished), !bodyDraggedRef.current (no trailing click from body drag), !rubberBandDraggedRef.current (no trailing click from rubber-band drag). Without all three, a click that is the natural trailing event of ANY drag gesture would erroneously trigger commitVertexEdit. The body and rubber-band flags are already cleared on the next click (one-shot pattern), so this only adds the vertex flag as a defensive read — vertexDragRef is also already null at click-time under normal flow because handleStageMouseUp clears it before the click fires."
  - "onHandleMouseDown callback approach (not e.target.name().startsWith('handle-') in the Stage handler) — RESEARCH Finding 4 Note recommended this. The Rect's own onMouseDown sets e.cancelBubble = true (VertexHandleOverlay.tsx:75-76), which suppresses the Stage onMouseDown entirely for handle gestures. The callback fires FIRST (child before Stage in Konva bubbling), sets vertexDragRef, and the Stage handler never runs. The defensive safety-net branch in handleStageMouseDown only fires if cancelBubble was somehow missed — under normal flow it never executes."
  - "newPoint at mouseup commit prefers dragPreviewRef.current.points[vertexIndex] when available, falls back to origin + delta computation. Both paths give the same result because handleStageMouseMove writes the preview via the same inverse-transform path as the commit. The preview-read is preferred because it avoids redundant math at commit time and is closer in spirit to 'commit the position the user sees'. The fallback handles the edge case where mouseup fires before any mousemove (a perfectly stationary click on a handle) — moved=false in that case, so no dispatch happens anyway."
  - "Pitfall 7 no-op guard kept tight — compares newPoint vs vd.originalPoints[vd.vertexIndex] for x and y exact equality. Float epsilon was considered but skipped: if the user dragged > 4px (moved=true) and the new point computed from inverse-transform happens to land byte-identically on the original (which would require exact return-to-start), there's no harm in skipping the dispatch. The 4px gate plus this guard means the only way to push a no-op move-vertex command is to wiggle the mouse > 4px and return EXACTLY to the start — essentially impossible in practice. Cheap exact comparison wins over float epsilon ceremony."
  - "Window-level mouseup cleanup extended to BOTH bodyDragRef and vertexDragRef (and the existing rubberBandRef). Stage onMouseUp does not fire for releases outside the canvas, so without this handler a drag started inside the Stage that releases outside would leave the ref dangling. Then the user's NEXT mousedown anywhere would observe a stale ref and trigger an unwanted commit or no-op. The cleanup clears refs AND drops the live drag preview — restoring the markup to its store-truth position visually."
  - "Defensive vertex-drag detection safety-net in handleStageMouseDown placed AFTER the body-drag branch and BEFORE the rubber-band branch. Under normal flow (handle mousedown with cancelBubble=true) this branch never fires because the Stage handler is suppressed for handle events. But if cancelBubble is somehow missed (event replay, focus weirdness, browser quirk), this branch catches the gesture and stops it from starting a rubber-band. Same defense-in-depth approach as Wave 3b's body-drag commit ordering before rubber-band."
patterns-established:
  - "Konva child-callback-as-event-entry-point pattern: when a child shape's onMouseDown sets e.cancelBubble=true, the Stage onMouseDown never fires for that gesture. Use the child's callback (not the Stage handler) as the gesture initiation point — gives a clean type-safe entry without name() introspection, and avoids the brittle 'check e.target.name()' guard. Foundation for any future Konva interactive overlay (rotate handles, scale handles, mid-segment-insert handles)."
  - "Three-drag handleStageMouseUp ordered fallthrough: vertex → body → rubber-band. Each gesture's commit branch is mutually exclusive at the down event (the prior branch returns early and the down-handlers stop propagation), but the defensive ordering keeps each commit path isolated and gives a documented priority should two refs ever be non-null simultaneously. handleStageMouseMove mirrors the same order. handleStageClick adds the vertex-edit click-outside path on top."
  - "Click-outside-commit triple-flag suppression: when a state-changing click handler can be reached as the trailing event of multiple drag gestures, every drag gesture needs its own one-shot suppression flag. For Phase 12 these are vertexDragRef===null + !bodyDraggedRef + !rubberBandDraggedRef. Standard pattern for any future Konva gesture that ends with a click."
  - "All three drag types share the dual state-and-ref drag-preview pattern (Wave 3a): setDragPreview(val) writes both the state (for re-renders) and the ref (for handler reads). vertex / body / no preview branches in the renderer's overridePoints/overridePoint props differentiate which markup gets what override. Adding more drag types in the future (e.g., scale-handles) just adds a new DragPreview union member; the existing wiring at all five markup renderers does not need to change."
requirements-completed: []
duration: 12min
completed: 2026-05-21
---

# Phase 12 Plan 5: Wave 3c — CanvasViewport: Vertex Drag Flow + Click-Outside Commit Summary

**Vertex drag end-to-end works: handles can be dragged to reposition vertices, live preview reflects the move via dragPreview, mouseup commits ONE moveVertex command per drag (anti-pattern guard respected), click outside the vertex-edit markup commits the session, window-level mouseup cleans up out-of-bounds releases — all four locked decisions D-04, D-05, D-06, and D-09's vertex-drag side are now fully implemented, 511/511 tests still pass with zero regressions, TypeScript clean, ESLint pre-existing-error count unchanged at 19.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-21T02:00Z (right after Wave 3b baseline tsc/vitest pass, 511/511 green)
- **Completed:** 2026-05-21T02:08Z
- **Tasks:** 2 (T1, T2 — committed atomically per execute-plan.md protocol)
- **Files created:** 0
- **Files modified:** 1

## Accomplishments

- **Vertex drag works end-to-end.** A handle's onMouseDown (via VertexHandleOverlay's Rect with `e.cancelBubble = true`) calls `onHandleMouseDown(vertexIndex)`, which sets `vertexDragRef = { markupId, vertexIndex, origin, originalPoints }`. `handleStageMouseMove` reads the ref, computes a new points array with the dragged vertex moved, and writes `setDragPreview({ type: 'vertex', markupId, vertexIndex, points })` — the renderer's existing overridePoints wiring (added in Wave 3b) reflects the live preview without any store write. `handleStageMouseUp` applies the D-09 4px movement threshold, runs the Pitfall 7 no-op guard, and dispatches ONE `moveVertex(markupId, page, vertexIndex, newPoint)` command. The vertex commit happens inside `handleStageMouseUp` — NOT inside `commitVertexEdit` — preserving the anti-pattern guard from `.continue-here.md`.
- **Vertex edit mode persists across handle drag releases.** A user can drag multiple handles in succession; each drag is one separate command on the undo stack (Ctrl+Z undoes them one at a time). Vertex edit mode itself stays active until Enter, Escape, or click-outside ends the session.
- **Click-outside commits the session.** When the user clicks anywhere that is not the vertex-edit markup's own handle (which never reaches `handleStageClick` due to `cancelBubble`), `handleStageClick` reads the live `vertexEditMarkupId` via `getState()`, gates on the three drag-suppression flags (`vertexDragRef === null && !bodyDraggedRef && !rubberBandDraggedRef`), compares `e.target.getAttr('id')` against the live vertex-edit markup id, and calls `commitVertexEdit()` (cleanup-only — drops drag preview, clears vertex-edit mode, clears the original-points snapshot). The click then continues through the normal flow — empty stage clears selection, a different markup selects via its onClick handler.
- **Window-level mouseup cleanup extended.** The existing window mouseup handler (which cleared `rubberBandRef`) now also clears `bodyDragRef` and `vertexDragRef` on out-of-bounds release, so a drag started inside the Stage that releases outside it doesn't leak a stale ref into the next click.
- **Stale-closure rule respected everywhere.** Every store read inside an event-fired callback uses `useViewerStore.getState()` / `useMarkupStore.getState()` — the closed-over React selector values are never consulted. Applied universally to the `onHandleMouseDown` callback (inside `vertexHandleLayer`), the `handleStageMouseMove` vertex branch, the `handleStageMouseUp` vertex branch, and the `handleStageClick` click-outside guard. Per `.continue-here.md` blocking pattern.
- **commitVertexEdit body is byte-identical to Wave 3a output.** The cleanup-only contract is preserved verbatim: `setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null`. No `forEach` over points, no `moveVertex` dispatch. Verified by inspection AND by the test suite (vertex-edit-mode.test.ts still passes).
- **No regressions.** 511/511 tests pass; `npx tsc --noEmit` clean; ESLint error count unchanged at 19 (same as Wave 3b baseline).

## Task Commits

Each task was committed atomically per the execute-plan.md per-task commit protocol:

1. **Task 1 — vertexDragRef + wire onHandleMouseDown on VertexHandleOverlay** — `46c145c` (feat)
2. **Task 2 — vertex drag mousemove/mouseup + click-outside commit + window cleanup** — `12aec82` (feat)

_Note: Plan executed as two atomic commits. Per execute-plan.md per-task commit protocol — the plan's suggested combined message `feat(12-05): CanvasViewport vertex drag + click-outside commit (D-04..D-09 complete)` was not adopted because the per-task protocol takes precedence. Same approach as Wave 1's three-commit, Wave 3a's three-commit, and Wave 3b's three-commit decompositions. Aggregate diff is identical; per-task granularity preserves bisect-ability should one task regress independently._

## Files Created/Modified

### Created
None.

### Modified

- `src/renderer/src/components/CanvasViewport.tsx` — +171 / -5 net across T1+T2:
  - **T1 — `vertexDragRef` and onHandleMouseDown wiring (lines ~386–399, ~1180–1207, ~944–953):**
    - `VertexDragState` discriminated type local to the component (`markupId`, `vertexIndex`, `origin: StagePoint`, `originalPoints: StagePoint[]`).
    - `vertexDragRef = useRef<VertexDragState>(null)` declared after `bodyDraggedRef`.
    - Replaced stub `onHandleMouseDown={(vertexIndex) => { void vertexIndex }}` in `vertexHandleLayer` with the real handler — reads `vertexEditMarkupId` and `pageMarkups` via `getState()` (stale-closure guard), bails on count markups (D-09), captures origin via `stage.getAbsoluteTransform().copy().invert().point(pointer)`, sets `vertexDragRef`.
    - Defensive safety-net branch in `handleStageMouseDown` after the body-drag branch and before the rubber-band branch — `if (vertexDragRef.current !== null && activeTool === 'select')` → `e.evt.stopPropagation(); return`. Under normal flow this never fires (cancelBubble on the Rect suppresses the Stage handler entirely for handle clicks).
  - **T2 — vertex preview, commit, click-outside, and window cleanup:**
    - `handleStageMouseMove` vertex branch BEFORE the body-drag branch: reads `vertexDragRef.current`, computes new points array with only the dragged vertex moved (read pageMarkups via `getState()`), writes `setDragPreview({ type: 'vertex', ... })`. Returns early.
    - `handleStageMouseMove` deps updated: `currentPage` added.
    - `handleStageMouseUp` vertex commit branch BEFORE body-drag and rubber-band branches: D-09 4px threshold gate; on `moved`, prefer `dragPreviewRef.current.points[vd.vertexIndex]` else compute `origin + delta`; Pitfall 7 no-op guard (`newPoint.x !== orig.x || newPoint.y !== orig.y`); single dispatch via `useMarkupStore.getState().moveVertex(...)`. Clears `setDragPreview(null)` only — vertex edit mode stays active. `vertexDragRef.current = null` then `return`. `vertexEditOriginalRef` intentionally untouched (session-start snapshot stays stable for Escape).
    - `handleStageMouseUp` deps unchanged (`currentPage` and `setDragPreview` already present from 12-04).
    - `handleStageClick` click-outside vertex commit branch placed at the TOP of the existing `if (activeTool === 'select')` block, BEFORE the rubberBandDraggedRef check. Reads `vertexEditMarkupId` via `getState()`. Three-flag guard: `vertexDragRef === null && !bodyDraggedRef && !rubberBandDraggedRef`. Compares `e.target.getAttr('id')` with the live veId; if different, calls `commitVertexEdit()`. The click then falls through to the existing rubber-band / body / empty-stage branches.
    - `handleStageClick` deps updated: `commitVertexEdit` added.
    - Window-level mouseup cleanup useEffect extended to also clear `bodyDragRef` and `vertexDragRef` on out-of-bounds release (and drop the drag preview in either case). Deps updated: `setDragPreview` added.

## Decisions Made

See frontmatter `key-decisions` for the full rationale list. Eight decisions captured:

1. Vertex dispatch ONLY in handleStageMouseUp — commitVertexEdit stays byte-identical to Wave 3a (cleanup-only). Anti-pattern guard from .continue-here.md respected verbatim.
2. vertexEditOriginalRef intentionally NOT updated mid-session — Escape always restores to session-start state; individual drag commands stay on undo stack for Ctrl+Z granularity.
3. Click-outside guard has THREE flags: vertexDragRef + bodyDraggedRef + rubberBandDraggedRef. Each trailing-click suppression independent.
4. onHandleMouseDown callback (not e.target.name() Stage-handler introspection) — cleaner, type-safe, leverages Konva's cancelBubble suppression.
5. newPoint at commit prefers dragPreviewRef.current.points[vertexIndex] with origin+delta fallback — both paths give same result; preview-read avoids redundant math.
6. Pitfall 7 no-op guard uses exact equality (not float epsilon) — combined with 4px threshold gate, only a wiggle-and-return-EXACTLY-to-start gesture could push a no-op, which is impossible in practice.
7. Window-level mouseup cleanup extended to all three drag refs (rubberBandRef + bodyDragRef + vertexDragRef) for out-of-bounds release safety.
8. Defensive vertex-drag safety net in handleStageMouseDown placed after body-drag, before rubber-band — defense-in-depth ordering matching Wave 3b's body-drag-before-rubber-band pattern.

## Deviations from Plan

**None of consequence.** No Rule 1/2/3 auto-fixes triggered, no Rule 4 architectural decisions needed, no authentication gates.

The execution followed each task's step-by-step instructions verbatim. The plan-suggested combined commit message `feat(12-05): CanvasViewport vertex drag + click-outside commit (D-04..D-09 complete)` was not adopted in favor of the per-task commit protocol (T1 and T2 each got their own atomic commit). Same pattern as Wave 1's three-commit, Wave 3a's three-commit, and Wave 3b's three-commit decompositions. Aggregate diff is identical.

One minor stylistic note worth documenting (not a deviation):

- The plan's Step C example showed `useMarkupStore` access in `handleStageMouseUp` via the `currentPage` already in deps. Confirmed: `handleStageMouseUp`'s useCallback dep array already includes `currentPage` (added in Wave 3b T2b) and `setDragPreview` (added in Wave 3b T2a), so no additional dep changes were needed for the vertex-commit branch. Same in `handleStageMouseMove` (`currentPage` was NOT already in the deps from Wave 3b — added it as part of T2 Step A).

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Plan executed exactly as written; full 511/511 suite still passes.

## Issues Encountered

None. All two task edits flowed through cleanly:

- **T1:** The stub `onHandleMouseDown` in `vertexHandleLayer` was added by Wave 3a as a named-const variable specifically so this plan's wiring would be a single-site edit. The replacement was unambiguous. The defensive safety-net branch in `handleStageMouseDown` slotted in between the body-drag branch and the rubber-band branch with no dep changes (the references it uses — `activeTool` and `e.evt` — are already in scope).
- **T2:** All three event-handler extensions (`handleStageMouseMove`, `handleStageMouseUp`, `handleStageClick`) and the window mouseup cleanup were additive — no existing code paths were modified beyond a single dep-array append on each. The body-drag and vertex-drag branches in mouseMove/mouseUp/Click are explicitly ordered (vertex first, then body, then rubber-band) to give a documented priority. The three-flag click-outside guard slotted in at the top of the `select`-mode block; the existing rubberBandDraggedRef and bodyDraggedRef checks below remained intact.

No ESLint regressions: the error count remained at 19 (same as Wave 3b baseline). All warnings are pre-existing CRLF/prettier whitespace warnings on Windows line endings (unrelated to this work). No new prop drilling or imports needed.

## User Setup Required

None. Pure renderer-process React/Konva component-internal work; no IPC, no filesystem, no network, no env vars, no dependencies changed.

## Known Stubs

None. All wiring added by this plan is consumed:

- `vertexDragRef` — consumed by `handleStageMouseDown` (safety net), `handleStageMouseMove` (preview), `handleStageMouseUp` (commit), the window mouseup cleanup, and the click-outside guard in `handleStageClick`.
- `onHandleMouseDown` callback on `VertexHandleOverlay` — consumed by user interaction (handle drag).
- New three-flag click-outside guard — consumed by user interaction (click on empty stage or different markup).
- All store reads consistently go through `getState()` in event-fired callbacks.

The `overridePoints` 'vertex' branch on the five markup renderers (wired in Wave 3b T1) is now actively consumed — `handleStageMouseMove` writes `setDragPreview({ type: 'vertex', ... })` during a vertex drag, and the renderer reflects the live preview. The 'vertex' branch was the last unconsumed leaf of Wave 3b's render wiring; it is now live.

## Threat Flags

None. No new network endpoints, no auth paths, no file/IO surface, no schema changes at trust boundaries. All changes are renderer-process React/Konva component-internal — same security envelope as every other CanvasViewport edit since Phase 1.

## Self-Check: PASSED

- `src/renderer/src/components/CanvasViewport.tsx` — FOUND, modified (+171 / -5 net across T1+T2)
- Commit `46c145c` (T1 — vertexDragRef + onHandleMouseDown wiring) — FOUND in git log
- Commit `12aec82` (T2 — vertex drag flow + click-outside commit + window cleanup) — FOUND in git log
- `npx tsc --noEmit` — exit 0, no errors (verified after every task)
- `npx vitest run` — 71 files, 511 tests, 0 failures (same count as Wave 3b baseline — no regressions, no new tests added by this event-wiring plan)
- `npx vitest run src/tests/vertex-edit-mode.test.ts src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts` — 18/18 passing (Wave 0/1 GREEN suites still green)
- ESLint pre-existing-error count remained at 19 — no new errors introduced (verified by `npx eslint src/renderer/src/components/CanvasViewport.tsx | grep problems`)
- Anti-pattern guard #1 (`commitVertexEdit` cleanup-only): body inspected and is exactly `setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null` — NO `forEach` over points, NO `moveVertex` dispatch. Byte-identical to Wave 3a output.
- Anti-pattern guard #2 (no stale-closure reads): all store reads inside event-fired callbacks use `useViewerStore.getState()` / `useMarkupStore.getState()`. Verified at: onHandleMouseDown (vertexHandleLayer), handleStageMouseMove vertex branch, handleStageMouseUp vertex branch, handleStageClick click-outside guard.
- Single moveVertex dispatch per drag session: verified — exactly one call site in handleStageMouseUp, wrapped in 4px threshold + no-op guard.
- Click-outside commit triple-flag guard verified: `vertexDragRef === null && !bodyDraggedRef.current && !rubberBandDraggedRef.current`.

## Next Phase Readiness

**Wave 4 (Plan 12-06 — UAT) is now executable end-to-end for all Phase 12 scenarios:**

The full 12-RESEARCH.md UAT scenarios A–J from the 12-05-PLAN.md verification section are all implemented and ready for human verification:

- **A.** Place a linear markup with 3 points. Select it. Click again — handles appear. ✓ (D-04 + Wave 3a handleMarkupClick + Wave 2 VertexHandleOverlay)
- **B.** Drag handle 0 to a new position — line updates live. Release — vertex committed. Ctrl+Z restores. ✓ (Wave 3c vertex drag + moveVertex command from Wave 1)
- **C.** With handles visible, press Escape — original positions restored. ✓ (Wave 3a cancelVertexEdit reads vertexEditOriginalRef)
- **D.** With handles visible, press Enter — committed. Ctrl+Z undoes. ✓ (Wave 3a commitVertexEdit, but vertex moves already happened on each drag release — Enter is just session-end)
- **E.** With handles visible, click empty stage — commit and deselect. ✓ (Wave 3c click-outside commit + existing clearSelection)
- **F.** With handles visible, click a DIFFERENT markup — commit and select new markup. ✓ (Wave 3c click-outside commit + existing handleMarkupClick)
- **G.** Select a markup (no vertex edit). Drag its body — translates. Release. Ctrl+Z restores. ✓ (Wave 3b body drag)
- **H.** Rubber-band select two markups. Drag one — both move. Ctrl+Z restores both. ✓ (Wave 3b group move via moveMarkups single command)
- **I.** Select a count pin. Try second click — no handles (count pins are translate-only). ✓ (Wave 3a handleMarkupClick count short-circuit + Wave 2 VertexHandleOverlay returns null for count)
- **J.** Drag a count pin body — it translates. Ctrl+Z restores. ✓ (Wave 3b body drag works for all selected markups including count)

**Locked decisions D-04..D-09 status:**
- D-04 ✓ — Second click on already-selected non-count markup enters vertex edit (Wave 3a)
- D-05 ✓ — 8×8 zoom-compensated handles, white fill, colored border (Wave 2 VertexHandleOverlay)
- D-06 ✓ — Enter / click-outside commit; Escape restores via session-start snapshot (Wave 3a + Wave 3c)
- D-07 ✓ — 4px movement threshold on body drag (Wave 3b)
- D-08 ✓ — Group move via single moveMarkups command (Wave 3b)
- D-09 ✓ — 4px movement threshold on vertex drag + count pin translate-only rule (Wave 3a + Wave 3c)

No blockers, no concerns. Wave 4 (UAT) can run the 14-scenario manual verification matrix against this commit.

---
*Phase: 12-markup-geometry-editing*
*Completed: 2026-05-21*
