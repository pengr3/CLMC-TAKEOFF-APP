---
phase: 12
plan: 3
subsystem: markup-geometry-editing
tags: [wave-3a, react-konva, vertex-edit, keyboard-handlers, canvas-viewport, additive-refs]
requires:
  - phase: 12-markup-geometry-editing
    provides: viewerStore-vertexEditMarkupId-state-machine, VertexHandleOverlay-component, markup-component-overridePoints-overridePoint-prop
provides:
  - canvasViewport-vertexEditMarkupId-subscription
  - canvasViewport-dragPreview-dual-ref-pattern
  - canvasViewport-markupBodyDownRef-stub-for-wave-3b
  - canvasViewport-vertexEditOriginalRef-snapshot
  - canvasViewport-handleMarkupClick-second-click-vertex-edit-activation
  - canvasViewport-commitVertexEdit-cleanup-only-callback
  - canvasViewport-cancelVertexEdit-cleanup-only-callback
  - canvasViewport-vertexHandleLayer-named-jsx-variable
  - canvasViewport-keyboard-vertex-edit-commit-cancel-branches
affects:
  - phase-12 wave 3b (12-04 body-drag translate)
  - phase-12 wave 3c (12-05 vertex drag + click-outside commit)
tech-stack:
  added: []
  patterns:
    - dual-state-and-ref-drag-preview-mirroring-rubberBand-pattern
    - named-jsx-variable-instead-of-inline-iife-for-future-edit-site-clarity
    - getState-read-of-vertexEditMarkupId-to-keep-keydown-effect-deps-narrow
    - cleanup-only-commit-cancel-callbacks-no-store-dispatch
    - second-click-on-already-selected-single-markup-as-mode-trigger
key-files:
  created: []
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
key-decisions:
  - "commitVertexEdit and cancelVertexEdit are byte-for-byte identical (setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null). The plan called for this twin shape because: (a) Enter and Escape both need to TEAR DOWN the session in this plan — there is no store dispatch to differentiate yet (that lands in 12-05); (b) keeping them as two separate-named callbacks documents intent at the keyboard handler call site (`Enter → commit` vs `Escape → cancel`); (c) Plan 12-05 will diverge them when the drag-release vertex dispatch lands in handleStageMouseUp. Inlining or deduplicating now would force a re-split in 12-05 with no benefit."
  - "vertexEditMarkupId read via useViewerStore.getState() inside the keyboard handleKeyDown function (NOT via the subscribed `vertexEditMarkupId` const). This keeps the keydown useEffect dep array free of vertexEditMarkupId — without it, every selection/vertex-edit-mode toggle would tear down and re-bind the window keydown listener. cancelVertexEdit / commitVertexEdit are stable refs (useCallback with [clearVertexEdit, setDragPreview] deps), so adding them to the dep array is cheap. Mirrors the existing pattern at lines 597 and 500 where `useViewerStore.getState().activeTool` is read inside the handler instead of subscribed in the effect deps."
  - "Drag-preview defined as a TypeScript discriminated union with two members ('vertex' and 'body') BOTH declared in this plan, even though plan 12-03 only wires the 'vertex' branch (and only at render time via vertexHandleLayer). The 'body' branch is dead in this plan and only consumed by 12-04. Declaring the full union here lets 12-04 and 12-05 add their respective wiring without touching the type. The dragPreviewRef.current type stays stable across the three Wave 3 plans."
  - "markupBodyDownRef declared but unread in this plan — flagged by ESLint as `assigned a value but never used`. This is the explicit Step D stub from the plan ('fully wired in 12-04'). The lint warning will resolve when 12-04 reads it in handleStageMouseDown. Same justification as Wave 1 / Wave 2 stubs (`onMarkupMouseDown`, `overridePoints`, `VertexHandleOverlay`): the prop/ref API is published one plan ahead of its first consumer so the next plan's diff is purely additive at the consumer site, not a multi-file refactor."
  - "vertexHandleLayer computed as a named const above the JSX return — not an inline IIFE inside the JSX. The plan explicitly directed this: '(named variable (rather than an inline IIFE in JSX) makes the `onHandleMouseDown` stub clearly visible and easy to replace in Plan 12-05)'. Plan 12-05's wiring is a single-site edit replacing `(vertexIndex) => { void vertexIndex }` with the real drag-initiation handler."
  - "handleMarkupClick branches: count pins ALWAYS take the first-click path (`if (markup.type !== 'count' && …)` short-circuits the vertex-edit branch). Count pins never enter vertex edit mode per D-09 (translate-only). The guard mirrors the structural assumption that VertexHandleOverlay returns null for count markups — same rule expressed at two layers (event entry vs render output) gives a defense-in-depth guarantee."
  - "Page-change and activeTool-change effects both call `setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null` — the exact same trio as commitVertexEdit/cancelVertexEdit. Three independent cleanup callsites (page change, tool change, Enter/Escape) is intentional: each is the natural lifecycle point for a different exit. Centralizing into a single helper would not save lines (three calls of `cleanupVertexEdit()` vs three calls of three setters) and would hide which exit ran."
patterns-established:
  - "Dual state-and-ref pattern for drag preview (mirrors rubberBand): `[dragPreview, setDragPreviewState] = useState(null)` plus `dragPreviewRef = useRef(null)` plus a `setDragPreview(val)` callback that writes both. State drives renders; ref gives stable reads inside event handlers without forcing useCallback dep churn. Wave 3b/c will read via the ref inside handleStageMouseDown/Move/Up so their callbacks do not need dragPreview in their deps."
  - "Foundation-plus-stub Wave 3 layering: plan 12-03 declares ALL refs/state/effects needed by plans 12-04 and 12-05. Specifically, markupBodyDownRef and the 'body' branch of DragPreview ship in this plan but are read only by 12-04. Future Wave 3 sub-plans then ONLY add event handler wiring against already-declared state — no new state types, no new refs. Keeps each sub-plan's diff focused on event flow, not type/ref scaffolding."
  - "Cleanup callbacks declared in pairs (commit/cancel) even when identical mid-phase: the two callsites express *intent* at the keyboard handler (Enter→commit, Escape→cancel) and the bodies diverge naturally in 12-05. Declaring as one shared function now would force a name change later."
requirements-completed: []
duration: 11min
completed: 2026-05-21
---

# Phase 12 Plan 3: Wave 3a — CanvasViewport Foundation: Refs, Vertex-Edit Activation, Keyboard Handlers Summary

**CanvasViewport now subscribes to `vertexEditMarkupId`, activates vertex-edit mode on second-click-on-already-selected non-count markup (D-04), mounts VertexHandleOverlay above Layer 1b with listening=true, and handles Enter/Escape for cleanup-only commit/cancel — Waves 3b and 3c can wire body-drag and vertex-drag events against the now-published refs, state, and handle layer without any further scaffolding changes.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-21T09:42Z (right after Wave 2 baseline tsc/vitest pass)
- **Completed:** 2026-05-21T09:53Z
- **Tasks:** 3
- **Files created:** 0
- **Files modified:** 1

## Accomplishments

- **`vertexEditMarkupId` is now subscribed and drives `VertexHandleOverlay` mount/unmount.** When the store field is `null` the layer is `null`; when set to an id, a `<Layer listening={true}>` containing the overlay mounts above Layer 1b so handles intercept pointer events before the markup body beneath.
- **Second-click vertex-edit activation works (D-04).** First click selects, second click on the same already-selected single non-count markup enters vertex edit. Count pins short-circuit to plain selection (D-09 translate-only). The original points are snapshotted into `vertexEditOriginalRef` BEFORE entering vertex edit, ready for Escape-restore in 12-05's drag flow.
- **Enter and Escape both commit (cleanup-only) vertex edit.** Enter runs `commitVertexEdit()` (drops drag preview, clears vertex edit mode, clears original snapshot). Escape runs `cancelVertexEdit()` (same body — they diverge in 12-05 when drag-release dispatches the vertex moves). The vertex-edit branch is placed BEFORE the existing Enter/Escape branches so vertex-edit mode wins over any other in-progress flow.
- **`commitVertexEdit` is strictly cleanup-only** — no per-vertex `moveVertex` forEach. The blocking anti-pattern from `.continue-here.md` is respected. Plan 12-05 will land the drag-release vertex dispatch inside `handleStageMouseUp` (where the per-drag-session move is a single command, not N).
- **Foundation refs published for Wave 3b/3c.** `markupBodyDownRef`, `dragPreviewRef`, the `DragPreview` discriminated type, and `vertexEditOriginalRef` all exist now so 12-04 (body drag) and 12-05 (vertex drag) only need to add event handler wiring — no further state/ref scaffolding.

## Task Commits

Each task was committed atomically per the execute-plan.md per-task commit protocol:

1. **Task 1: foundation refs and store subscriptions** — `d66b974` (feat)
2. **Task 2: second-click vertex-edit activation in handleMarkupClick** — `a3ae495` (feat)
3. **Task 3: keyboard handlers + cleanup callbacks + handle layer mount** — `1132dd9` (feat)

_Note: Plan executed as three atomic commits. Per execute-plan.md per-task commit protocol — the plan's suggested combined message `feat(12-03): CanvasViewport vertex-edit activation, keyboard handlers, handle layer mount` was not adopted because the per-task protocol takes precedence. Same approach as Wave 1's three-commit and Wave 2's two-commit decompositions. Aggregate diff is identical; per-task granularity preserves bisect-ability should one task regress independently._

## Files Created/Modified

### Created
None.

### Modified

- `src/renderer/src/components/CanvasViewport.tsx` — +154 / -2 net:
  - **Imports:** `VertexHandleOverlay` (from `./markup/VertexHandleOverlay`), `StagePoint` type (from `../hooks/useCalibrationMode`).
  - **Store subscriptions (T1):** `vertexEditMarkupId`, `setVertexEditMarkupId`, `clearVertexEdit` next to the existing `selectedMarkupIds` block.
  - **State + refs (T1):** `DragPreview` discriminated type local to the component; `[dragPreview, setDragPreviewState]` paired with `dragPreviewRef` and a `setDragPreview(val)` callback that writes both (same dual-ref pattern as `rubberBand`). `markupBodyDownRef = useRef<string | null>(null)` (stub for 12-04). `vertexEditOriginalRef = useRef<StagePoint[] | null>(null)`.
  - **Lifecycle effects (T1):** Existing page-change effect extended with `clearVertexEdit() + setDragPreview(null) + vertexEditOriginalRef.current = null`. New separate effect: `useEffect(...)` clearing vertex-edit when `activeTool !== 'select'`.
  - **handleMarkupClick (T2):** Extended with D-04 branch — second click on already-selected single non-count markup enters vertex edit, snapshots original points first; otherwise (first click or different markup) clears vertex edit, resets snapshot, selects.
  - **commitVertexEdit / cancelVertexEdit (T3):** Two new `useCallback` callbacks, both cleanup-only (drops drag preview, clears vertex edit, clears snapshot). NO store dispatch — anti-pattern guarded.
  - **Keyboard handleKeyDown (T3):** Escape branch — vertex-edit check inserted BEFORE the existing `mode === 'drawing'` cascade; Enter branch — vertex-edit check inserted BEFORE the existing `if (markupState.mode !== 'drawing') return` guard. Both read `vertexEditMarkupId` via `useViewerStore.getState()` so the effect's dep array stays narrow (`cancelVertexEdit` + `commitVertexEdit` added; nothing else).
  - **vertexHandleLayer named variable + JSX mount (T3):** Computed above the `return (` as a named const (not an inline IIFE) so Plan 12-05's wiring is a one-site edit. JSX reference placed immediately after the rubber-band layer (above Layer 1b's listening events).

## Decisions Made

See frontmatter `key-decisions` for the full rationale list. Seven decisions captured:
1. commit/cancel are identical now and diverge in 12-05 — intentional twin shape.
2. `vertexEditMarkupId` read via `getState()` inside the keydown handler to keep effect deps narrow.
3. Full `DragPreview` union (vertex + body) declared in this plan; 'body' dead until 12-04.
4. `markupBodyDownRef` is an intentional stub for 12-04 (ESLint warning expected; matches Wave 1/2 stub pattern).
5. `vertexHandleLayer` as a named const above JSX, not an inline IIFE — for Plan 12-05 edit-site clarity.
6. Count pins short-circuit handleMarkupClick to first-click selection (D-09 defense-in-depth at event + render layers).
7. Three independent cleanup callsites (page change, tool change, Enter/Escape) intentionally not centralized.

## Deviations from Plan

**None of consequence.** No Rule 1/2/3 auto-fixes triggered, no Rule 4 architectural decisions needed, no authentication gates.

The execution followed each task's step-by-step instructions verbatim. The only stylistic divergence from the plan-suggested wording was at one location: Step C said to import `StagePoint` from `'../hooks/useCalibrationMode'` "if not already imported (check the top of the file — it is likely not imported directly in CanvasViewport, but is available via types)." It was not imported. The plan said "check the actual file before editing" — confirmed, and added the import as a separate `import type { StagePoint }` line right next to the existing `useCalibrationMode` import. Matches the project pattern at line 36 (`import type { Markup, ... }`).

Per execute-plan.md per-task commit protocol, three atomic per-task commits were created instead of the plan-suggested single combined commit message `feat(12-03): CanvasViewport vertex-edit activation, keyboard handlers, handle layer mount`. Same pattern as Wave 1 and Wave 2.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Plan executed exactly as written.

## Issues Encountered

None. All three task edits flowed through cleanly — the existing CanvasViewport.tsx structure has clear insertion points (rubberBand block for state, handleMarkupClick for the click extension, handleKeyDown for the keyboard extension), and each was extended additively without touching adjacent code paths. The pre-existing `useViewerStore.getState()` pattern at lines 500 and 597 gave a copy-paste model for the keydown handler's vertex-edit reads.

One ESLint warning is expected and intentional: `markupBodyDownRef` is declared but unread in this plan — flagged as `'markupBodyDownRef' is assigned a value but never used`. This is the explicit Step D stub from the plan ("fully wired in 12-04"). Will resolve in 12-04 when `handleStageMouseDown` reads it. Same justification as `onMarkupMouseDown` / `overridePoints` / `VertexHandleOverlay` from Wave 2 — published one plan ahead of its first consumer so the next plan's diff is the event wiring, not the scaffolding.

## User Setup Required

None. Pure renderer-process React/Konva component-internal work; no IPC, no filesystem, no network, no env vars, no dependencies changed.

## Known Stubs

One intentional stub (foundation-plus-stub Wave 3 layering, plan-mandated):

- **`markupBodyDownRef = useRef<string | null>(null)`** at `src/renderer/src/components/CanvasViewport.tsx:369`. Declared and writable via the (not-yet-wired) `onMarkupMouseDown` prop on every markup component (Wave 2). Read site lands in Plan 12-04 inside `handleStageMouseDown` — that plan's diff is a single read + branch.

This is NOT a stub in the project-skill sense (no hardcoded empty data flowing to UI, no "coming soon" string, no placeholder rendering). It is a foundation API published one plan ahead of its consumer, which is the explicit and documented Wave 3 sub-plan structure: 12-03 builds the refs/state/handle layer; 12-04 wires body-drag against them; 12-05 wires vertex-drag against them.

The stub `onHandleMouseDown={(vertexIndex) => { void vertexIndex }}` inside `vertexHandleLayer` is also intentional — Plan 12-05 replaces this one-liner with the real drag-initiation handler. Named-const placement (not inline IIFE) makes the replacement a single-site edit.

## Threat Flags

None. No new network endpoints, no auth paths, no file/IO surface, no schema changes at trust boundaries. All changes are renderer-process React/Konva component-internal — same security envelope as every other CanvasViewport edit since Phase 1.

## Self-Check: PASSED

- `src/renderer/src/components/CanvasViewport.tsx` — FOUND, modified (+154 / -2 net)
- Commit `d66b974` (T1 — foundation refs and store subscriptions) — FOUND in git log
- Commit `a3ae495` (T2 — second-click vertex-edit activation) — FOUND in git log
- Commit `1132dd9` (T3 — keyboard handlers + handle layer mount) — FOUND in git log
- `npx tsc --noEmit` — exit 0, no errors (verified after every task)
- `npx vitest run` — 71 files, 511 tests, 0 failures (same count as Wave 2 baseline — no regressions, no new tests added by this event-wiring foundation plan)
- `npx vitest run src/tests/vertex-edit-mode.test.ts` — 7 tests passing (Wave 1 GREEN suite still green)
- Anti-pattern guard: `commitVertexEdit` body is exactly `setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef.current = null` — NO `forEach` over points, NO `moveVertex` dispatch (verified in source)

## Next Phase Readiness

**Wave 3b (Plan 12-04 — body-drag translate) can now consume:**

1. **`markupBodyDownRef = useRef<string | null>(null)`** — already declared. 12-04 wires the markup component `onMarkupMouseDown` prop (from Wave 2) to write the markup id into this ref; `handleStageMouseDown` reads it (before the rubber-band branch) to detect body-drag intent and clears immediately (consume-on-read).
2. **`dragPreviewRef` / `setDragPreview` with 'body' branch** — `{ type: 'body'; deltas: Record<string, { x: number; y: number }> }` is already in the DragPreview type. 12-04 calls `setDragPreview({ type: 'body', deltas })` on mouse move during body drag; render path will pass deltas down to the affected markups via `overridePoints` (computed from `markup.points` + delta) or `overridePoint` (for count pins) per Wave 2's drag-preview prop convention.
3. **No new lifecycle work needed** — page-change and activeTool-change effects already clear the drag preview, so any in-progress body drag is cleaned up if the user navigates away mid-drag.

**Wave 3c (Plan 12-05 — vertex drag + click-outside commit) can now consume:**

1. **`vertexHandleLayer` named variable** — the `onHandleMouseDown` callback inside it is currently the stub `(vertexIndex) => { void vertexIndex }`. 12-05 replaces this single line with the real drag-initiation handler that captures `vertexIndex` and writes a `vertexDragRef` (still to be added in 12-05) for the move/up flow.
2. **`vertexEditOriginalRef`** — set at session start by `handleMarkupClick`. 12-05 uses this in the drag move handler if needed (likely just for cancel-restore — the points-array can also be reconstructed from `dragPreview.points` since no store mutation happens mid-drag).
3. **`commitVertexEdit` body** — currently cleanup-only. 12-05 adds the drag-release vertex-position dispatch inside `handleStageMouseUp`, NOT inside `commitVertexEdit`. The keyboard Enter handler will continue to call `commitVertexEdit` (cleanup-only) because the keyboard path commits the LAST drag-release that already happened — the per-drag-session dispatch is the natural unit of undo, not the per-keystroke commit. **This is the locked anti-pattern from `.continue-here.md`** — re-affirmed here for the 12-05 executor.
4. **Click-outside-to-commit** — also lands in 12-05's stage handlers (likely `handleStageClick` reading `useViewerStore.getState().vertexEditMarkupId`).

No blockers, no concerns. Wave 3b and Wave 3c have a clean foundation to wire against. All three commits are atomic and bisect-friendly.

---
*Phase: 12-markup-geometry-editing*
*Completed: 2026-05-21*
