---
phase: 12
plan: 4
subsystem: markup-geometry-editing
tags: [wave-3b, react-konva, body-drag, translate, group-move, canvas-viewport, stale-closure-fix]
requires:
  - phase: 12-markup-geometry-editing
    provides: markup-component-drag-mousedown-prop, markup-component-overridePoints-overridePoint-prop, markupStore-moveMarkups-action, canvasViewport-dragPreview-dual-ref-pattern, canvasViewport-markupBodyDownRef-stub-for-wave-3b
provides:
  - canvasViewport-bodyDragRef-state-machine
  - canvasViewport-bodyDraggedRef-click-suppression
  - canvasViewport-handleStageMouseDown-body-drag-branch
  - canvasViewport-handleStageMouseMove-body-drag-preview-branch
  - canvasViewport-handleStageMouseUp-body-drag-commit-branch
  - canvasViewport-handleStageClick-bodyDraggedRef-suppression
  - canvasViewport-overridePoints-overridePoint-prop-wiring-on-all-5-renderers
affects:
  - phase-12 wave 3c (12-05 vertex drag + click-outside commit) — same handleStageMouseDown/Move/Up file, must coexist with body-drag branches
tech-stack:
  added: []
  patterns:
    - stale-closure-avoidance-via-useMarkupStore-getState-inside-mouse-handlers
    - body-drag-snapshot-pattern-mirroring-rubberBand-with-startPositions-record
    - per-markup-delta-render-via-overridePoints-overridePoint-without-store-write
    - bodyDraggedRef-post-drag-click-suppression-mirroring-rubberBandDraggedRef
    - single-moveMarkups-dispatch-for-both-single-translate-and-group-move-D08
    - 4px-movement-threshold-applied-uniformly-to-rubberBand-and-bodyDrag-D09
key-files:
  created: []
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
key-decisions:
  - "bodyDragRef.current.startPositions captured at mouseDown is NOT actually consumed by the mouseUp commit — the commit reads markup.point / markup.points fresh from the store snapshot and applies dx/dy to those values. The startPositions snapshot exists only to defend against a (theoretical) future scenario where the markup is mutated mid-drag by another command; the current commit path uses store-fresh data so any such mutation would already be reflected. Kept the snapshot capture exactly as the plan specified — removing it would diverge from the published interface and Wave 3c (12-05 vertex drag) may consume it for cancel-restore semantics if click-outside commits land that way."
  - "handleStageMouseUp body-drag branch placed BEFORE the rubber-band branch even though mouseDown's stopPropagation makes them mutually exclusive at the down event. Defensive ordering: if a future event flow allows both refs to be non-null at mouseup (e.g. focus loss, programmatic state), the body-drag commit wins. The `return` at the end of the body-drag block prevents fallthrough so the rubber-band cleanup never sees a phantom band."
  - "Group move (D-08) implemented via `ids: [...selectedMarkupIds]` at mouseDown — captures the selection IDs once at drag-start. If the selection changes mid-drag (which it cannot under the current event flow because mouseDown stops propagation and no selection-mutating UI is visible during drag), the drag uses the snapshot. moves[] is built by filtering currentPageMarkups for IDs in bd.ids — markups deleted mid-drag are silently skipped, matching the defensive `if (!markup) continue` pattern."
  - "Single dispatch policy for translate AND group move: `useMarkupStore.getState().moveMarkups(moves)` is called once with all moves[] entries — never N times in a loop. The store action pushes ONE `{ type: 'move-markups', moves }` command, so Ctrl+Z undoes the entire group move in one step. This matches the locked decision in 12-01-SUMMARY (D-08 — group move via single command)."
  - "Stale closure rule applied at BOTH mouseDown and mouseUp: `useMarkupStore.getState().pageMarkups[currentPage]` is read inside the handler body, NOT the closed-over `pageMarkups` React selector value. `pageMarkups` IS still in the mouseUp useCallback dep array (left untouched from the existing rubber-band code), but the body-drag branch explicitly does not use it — it reads from the store every time the handler fires. Defensive double-coverage: the dep ensures the callback is fresh enough for the rubber-band path; the getState() ensures the body-drag path always sees the live store regardless of when the callback was memoized. Per .planning/phases/12-markup-geometry-editing/.continue-here.md blocking anti-pattern."
  - "ESLint pre-existing-error count went from 20 to 19 (one error reduced) — the prior plan 12-03 left `markupBodyDownRef` flagged as 'assigned a value but never used' (foundation-stub for this plan). Reading it in handleStageMouseDown resolves that single warning as predicted in 12-03-SUMMARY. No new lint errors introduced; the remaining 19 errors are all unrelated pre-existing CanvasViewport issues (return-type annotations on getCanvasControls / getCalibrationControls / etc., react-refresh constraints) — out of scope per execute-plan.md scope boundary rule."
  - "Type annotation on the `moves` accumulator inside handleStageMouseUp uses the exact union member shape `Array<{ markupId: string; page: number; oldPoints: StagePoint[]; newPoints: StagePoint[] }>` rather than importing a named type. The plan specified this inline shape. moveMarkups' parameter type already constrains the call site, so the inline annotation is redundant but documents intent at the build-site. Refactoring to a named type would be a future cleanup, not a deviation."
patterns-established:
  - "Stale-closure defence for mouse handlers in CanvasViewport: any code reading store-derived collections (pageMarkups, selectedMarkupIds) from inside a useCallback that fires on mouseDown/Move/Up MUST use `useStore.getState()` for the actual mutation/dispatch step. The closed-over React selector value is a snapshot from memoization time — fine for declarative renders but unsafe for event handlers that may fire between renders. Applied universally to handleStageMouseDown and handleStageMouseUp body-drag branches in this plan; Wave 3c (12-05 vertex drag) must apply the same rule."
  - "Body-drag follows the rubber-band template byte-for-byte: bodyDragRef (state) + bodyDraggedRef (post-drag click suppression flag). The two flags are independent — bodyDragRef.current is mutated during the drag lifecycle (set on down, mutated on move via setDragPreview, cleared on up); bodyDraggedRef is a one-shot Boolean signal consumed at handleStageClick. This pattern is now the canonical template for any future Konva-on-Stage drag gesture (rotate handles, scale handles, marquee, etc.)."
  - "Single moveMarkups dispatch covers single translate AND group move with no code branching at the call site. The store reducer's match on `{ type: 'move-markups' }` walks the moves[] array and writes each markup independently. Future drag-related plans should follow the same pattern: one command per drag SESSION, never one command per markup in a group."
requirements-completed: []
duration: 9min
completed: 2026-05-21
---

# Phase 12 Plan 4: Wave 3b — CanvasViewport Body Drag (Translate + Group Move) Summary

**CanvasViewport now translates selected markup bodies (single or group) on mouse drag via a stale-closure-safe `bodyDragRef`/`bodyDraggedRef` pair that mirrors the existing rubber-band pattern; a 4px movement threshold gates click-vs-drag, the body-drag commit dispatches one `moveMarkups` command for both single translate and group move (D-08), and the post-drag Konva click is suppressed so selection survives the gesture — full 511-test suite holds at zero regressions, TypeScript clean, ESLint pre-existing-error count dropped by 1.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-21T09:55Z (baseline tsc/vitest pass, 511/511 green)
- **Completed:** 2026-05-21T10:04Z
- **Tasks:** 3 (T1, T2a, T2b — split per execute-plan.md per-task commit protocol)
- **Files created:** 0
- **Files modified:** 1

## Accomplishments

- **Body drag works end-to-end.** Mousedown on a selected markup snapshots start positions into `bodyDragRef` and stops Stage-event propagation so the rubber-band does not also start; mousemove writes per-markup deltas into `dragPreview` for live render; mouseup dispatches a single `moveMarkups` command and sets `bodyDraggedRef` to suppress the trailing Konva click. The post-drag selection ring survives the gesture (Pitfall 2 mitigated).
- **Group move (D-08) works automatically.** `bd.ids` is captured from `selectedMarkupIds` at mouseDown — when multiple markups are selected, every one moves by the same dx/dy and all moves land in one `moveMarkups` command. Ctrl+Z undoes the entire group move in one step.
- **4px threshold (D-07/D-09) applied uniformly.** Below 4px: no `moveMarkups` dispatch, no `bodyDraggedRef` set — the gesture degrades to a click that flows through the existing markup-onClick selection path. Above 4px: the drag commits and the click is suppressed. Matches the rubber-band rule exactly.
- **Stale-closure rule (.continue-here.md blocking pattern) respected at both mouseDown and mouseUp.** Every read of the `pageMarkups` collection inside the handlers goes through `useMarkupStore.getState().pageMarkups[currentPage]` — the React selector value is never consulted in the body-drag branches.
- **Count pins translate correctly.** `oldPoints: [markup.point]` / `newPoints: [translated]` normalization at the call site means the store's discriminating reducer writes `point` for count markups and `points` for everything else — same command shape, two write paths.
- **No regressions.** 511/511 tests pass; `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically per the execute-plan.md per-task commit protocol:

1. **Task 1 — `bodyDragRef`/`bodyDraggedRef` + wire `onMarkupMouseDown`/`overridePoints` on all 5 renderers** — `e296abb` (feat)
2. **Task 2a — `handleStageMouseDown` body-drag activation + `handleStageMouseMove` live preview** — `f7c39bb` (feat)
3. **Task 2b — `handleStageMouseUp` body-drag commit + `handleStageClick` `bodyDraggedRef` suppression** — `f54ef18` (feat)

_Note: Plan executed as three atomic commits. Per execute-plan.md per-task commit protocol — the plan's suggested combined message `feat(12-04): CanvasViewport body-drag translate + group move (D-07/D-08)` was not adopted because the per-task protocol takes precedence. Same approach as Wave 1's three-commit and Wave 3a's three-commit decompositions. Aggregate diff is identical; per-task granularity preserves bisect-ability should one task regress independently._

## Files Created/Modified

### Created
None.

### Modified

- `src/renderer/src/components/CanvasViewport.tsx` — +190 / -3 net:
  - **T1 — refs + render wiring (lines ~376–391 and Layer 1b prop additions):**
    - `BodyDragState` discriminated type local to the component (`ids: string[]`, `origin: StagePoint`, `startPositions: Record<string, StagePoint | StagePoint[]>` — count pins use a single point, points-array markups use an array).
    - `bodyDragRef = useRef<BodyDragState>(null)` — captures the drag-in-progress snapshot.
    - `bodyDraggedRef = useRef(false)` — one-shot suppression flag, mirrors `rubberBandDraggedRef`.
    - `onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}` added to all five markup renderers in Layer 1b (CountPin, Linear, Area, Perimeter, Wall). Konva bubbles the markup-Group's `onMouseDown` BEFORE the Stage-level `onMouseDown`, so by the time `handleStageMouseDown` runs the ref already holds the target id.
    - `overridePoints` / `overridePoint` props wired to the `dragPreview` state: when `dragPreview.type === 'body'` and a delta exists for this markup's id, points are computed as `m.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }))` (or `point` for count). When `dragPreview.type === 'vertex'` and `dragPreview.markupId === m.id`, the override is `dragPreview.points` (vertex-edit path, consumed in 12-05).
  - **T2a — `handleStageMouseDown` body-drag branch (after markup-mode capture, before `if (activeTool !== 'select') return`):**
    - Consume `markupBodyDownRef.current` immediately (read-and-clear pattern).
    - Guard: only proceed if the markup id is in `selectedMarkupIds`, we are in 'select' mode, and `!spaceHeld`.
    - `e.evt.stopPropagation()` to prevent the rubber-band block below from also firing.
    - Read `pageMarkups` via `useMarkupStore.getState().pageMarkups[currentPage]` — the closed-over `pageMarkups` is stale at click-time.
    - Build `startPositions: Record<string, StagePoint | StagePoint[]>` for every selected id (discriminate on `markup.type === 'count'`).
    - Set `bodyDragRef.current = { ids, origin, startPositions }` and `return` (suppress rubber-band).
    - Deps: added `selectedMarkupIds` and `currentPage` to the useCallback deps array (both used inside the branch).
  - **T2a — `handleStageMouseMove` body-drag preview branch (BEFORE rubber-band branch):**
    - `if (bodyDragRef.current)`: compute `dx`/`dy` via inverse-transform pointer, build `deltas: Record<string, { x, y }>` for every id in `bd.ids`, call `setDragPreview({ type: 'body', deltas })`, `return`.
    - Deps: added `setDragPreview` to the useCallback deps array.
  - **T2b — `handleStageMouseUp` body-drag commit (BEFORE rubber-band branch):**
    - `if (bodyDragRef.current)`: compute final `dx`/`dy`, apply D-09 4px threshold (`Math.abs(dx) > 4 || Math.abs(dy) > 4`).
    - When moved: read `useMarkupStore.getState().pageMarkups[currentPage]`, build `moves[]` with count-vs-points discriminant, call `useMarkupStore.getState().moveMarkups(moves)` ONCE for the whole group, set `bodyDraggedRef.current = true`.
    - In finally: `bodyDragRef.current = null`, `setDragPreview(null)`, `return` (don't fall through to rubber-band cleanup).
    - Deps: added `currentPage` and `setDragPreview` to the useCallback deps array.
  - **T2b — `handleStageClick` suppression branch (in the select-mode block, after `rubberBandDraggedRef` check):**
    - `if (bodyDraggedRef.current) { bodyDraggedRef.current = false; return }` — symmetric pattern to the existing rubber-band suppression. Without this, a body-drag that releases over empty stage area would route through `e.target === stage → clearSelection()` and wipe the freshly-translated selection.

## Decisions Made

See frontmatter `key-decisions` for the full rationale list. Seven decisions captured:

1. `bodyDragRef.current.startPositions` captured but unused by the current commit path (commit reads store-fresh data); kept for interface stability and possible 12-05 consumption.
2. Body-drag branch placed BEFORE rubber-band branch in `handleStageMouseUp` for defensive ordering even though they are mutually exclusive at mouseDown.
3. Group move (D-08) via `ids: [...selectedMarkupIds]` snapshot at mouseDown; markups deleted mid-drag are silently skipped via `if (!markup) continue`.
4. Single `moveMarkups` dispatch for both single translate and group move — never a loop dispatching per markup.
5. Stale-closure rule (.continue-here.md) applied at both mouseDown and mouseUp via `useMarkupStore.getState()`.
6. ESLint pre-existing-error count dropped from 20 to 19 — the prior plan's `markupBodyDownRef` stub warning is now resolved.
7. Inline type annotation on `moves` accumulator instead of importing a named type — matches the plan spec verbatim.

## Deviations from Plan

**None of consequence.** No Rule 1/2/3 auto-fixes were triggered, no Rule 4 architectural decisions needed, no authentication gates, no test infrastructure changes.

Two minor stylistic notes worth documenting (not deviations, just transparency):

- The plan's `T2a` and `T2b` were split as the executor's tasks 2 and 3 to honor the per-task commit protocol — each gets its own atomic commit. The plan-suggested combined commit message `feat(12-04): CanvasViewport body-drag translate + group move (D-07/D-08)` was not adopted. Same pattern as Wave 1's three-commit and Wave 3a's three-commit decompositions. Aggregate diff is identical.
- The `handleStageMouseUp` useCallback dep array still includes `pageMarkups` (left untouched from the existing rubber-band code's deps), but the body-drag branch uses `useMarkupStore.getState().pageMarkups[currentPage]` and does NOT consult the closed-over `pageMarkups`. The dep is kept because the rubber-band code path (still resident in the same callback) reads `pageMarkups` directly. No bug introduced — the rubber-band branch is correct with the closed value because it commits only at the end of one synchronous gesture, and `bodyDragRef`-gated body drags don't reach that branch.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Plan executed exactly as written; full 511/511 suite still passes.

## Issues Encountered

None. All three task edits flowed through cleanly:

- **T1:** The existing prop interfaces on the five markup renderers were established in Wave 2; the `onMarkupMouseDown` + `overridePoints`/`overridePoint` wiring slotted in alongside the existing `onClick` / `onHoverEnter` / `onHoverLeave` / `onContextMenu` props with no callsite changes elsewhere.
- **T2a:** The `handleStageMouseDown` and `handleStageMouseMove` insertion points were unambiguous — markup-mode capture block first (existing), body-drag branch second (new), rubber-band branch third (existing). The body-drag branch's `e.evt.stopPropagation()` plus `return` cleanly disables the downstream rubber-band start.
- **T2b:** The `handleStageMouseUp` body-drag branch reads the store via `getState()` so it does not need any new deps beyond `currentPage` and `setDragPreview`. The `handleStageClick` `bodyDraggedRef` suppression slotted in immediately after the existing `rubberBandDraggedRef` suppression — same control-flow shape, same one-shot Boolean semantics.

No ESLint regressions: the pre-existing error count went from 20 to 19 (the Wave 3a stub warning resolved as predicted in 12-03-SUMMARY's "Issues Encountered" section).

## User Setup Required

None. Pure renderer-process React/Konva component-internal work; no IPC, no filesystem, no network, no env vars, no dependencies changed.

## Known Stubs

None at the source-file level. All wiring added by this plan is consumed:

- `bodyDragRef` — consumed by handleStageMouseDown/Move/Up.
- `bodyDraggedRef` — consumed by handleStageClick.
- `onMarkupMouseDown` callbacks on the five renderers — consumed by handleStageMouseDown via `markupBodyDownRef` read.
- `overridePoints` / `overridePoint` body branch on the five renderers — consumed by the `setDragPreview({ type: 'body', deltas })` writes from handleStageMouseMove and rendered live during drag.

The `overridePoints` / `overridePoint` vertex branch (when `dragPreview.type === 'vertex'`) is still unconsumed — Plan 12-05 will write that branch from the vertex-drag flow. Same Wave 3 layering pattern as 12-03's pre-published refs.

## Threat Flags

None. No new network endpoints, no auth paths, no file/IO surface, no schema changes at trust boundaries. All changes are renderer-process React/Konva component-internal — same security envelope as every other CanvasViewport edit since Phase 1.

## Self-Check: PASSED

- `src/renderer/src/components/CanvasViewport.tsx` — FOUND, modified (+190 / -3 net across T1+T2a+T2b)
- Commit `e296abb` (T1 — refs + render wiring on 5 renderers) — FOUND in git log
- Commit `f7c39bb` (T2a — handleStageMouseDown body-drag + handleStageMouseMove preview) — FOUND in git log
- Commit `f54ef18` (T2b — handleStageMouseUp commit + handleStageClick suppression) — FOUND in git log
- `npx tsc --noEmit` — exit 0, no errors (verified after every task)
- `npx vitest run` — 71 files, 511 tests, 0 failures (same count as Wave 3a baseline — no regressions, no new tests added by this event-wiring plan)
- ESLint pre-existing-error count went from 20 to 19 (markupBodyDownRef no-longer-unused — predicted in 12-03-SUMMARY)
- Anti-pattern guard (stale closure): both `handleStageMouseDown` and `handleStageMouseUp` body-drag branches read `pageMarkups` via `useMarkupStore.getState().pageMarkups[currentPage]` — NEVER from the closed-over React selector (verified by grep)
- Anti-pattern guard (single dispatch): `useMarkupStore.getState().moveMarkups(moves)` called ONCE per drag session — never in a per-markup loop (verified in source)
- D-09 4px threshold present (`Math.abs(dx) > 4 || Math.abs(dy) > 4`) — verified in source
- bodyDraggedRef + rubberBandDraggedRef both suppress post-gesture click in handleStageClick — symmetric pattern verified

## Next Phase Readiness

**Wave 3c (Plan 12-05 — vertex drag + click-outside commit) can now consume:**

1. **`dragPreview` 'vertex' branch in renderer overridePoints wiring** — already wired in T1 alongside the 'body' branch. 12-05 writes `setDragPreview({ type: 'vertex', markupId, vertexIndex, points })` during vertex drag, and the affected markup's `overridePoints` will reflect the live preview without a store write.
2. **`bodyDraggedRef`-style suppression pattern** — 12-05 may need an analogous `vertexDraggedRef` to suppress click-outside-to-commit when the click is the trailing release of a vertex drag. The pattern is one-shot Boolean set on commit-with-real-movement, consumed at click. Three independent suppression flags (`rubberBandDraggedRef`, `bodyDraggedRef`, optional `vertexDraggedRef`) is intentional — each gates a distinct drag gesture.
3. **`handleStageMouseUp` body-drag branch returns before rubber-band check** — 12-05's vertex-drag branch should follow the same pattern: place vertex-drag commit BEFORE body-drag, BEFORE rubber-band. Mouse-down's stopPropagation discipline already prevents two drags from being active simultaneously, but the ordered fall-through gives defense-in-depth.
4. **vertexEditOriginalRef snapshot (set by handleMarkupClick in 12-03)** — 12-05 can use this for Escape-cancel and possibly for the click-outside-commit's "old points" computation. The snapshot is set once at vertex-edit-mode entry and never updated mid-session, so it's a stable reference.

**Wave 4 (Plan 12-06 — UAT)** is now executable end-to-end for the body-drag scenarios:

- Scenario A (single markup translate): place a linear, click to select, drag body — moves. Ctrl+Z undoes.
- Scenario B (group move): place two markups, rubber-band select both, drag either — both move. Ctrl+Z undoes the whole group as one step.
- Scenario C (count pin translate): place a count pin, click to select, drag — moves.
- Scenario D (4px threshold): click and tiny-jitter without crossing 4px — selection survives, no move dispatched.
- Scenario E (post-drag selection survives): drag, release — selection ring stays visible (`bodyDraggedRef` suppresses the click).

Vertex-drag scenarios (Scenarios F–I or similar in the UAT plan) remain pending Wave 3c.

No blockers, no concerns. Wave 3c (12-05) has a clean foundation to wire vertex drag against without any further scaffolding changes.

---
*Phase: 12-markup-geometry-editing*
*Completed: 2026-05-21*
