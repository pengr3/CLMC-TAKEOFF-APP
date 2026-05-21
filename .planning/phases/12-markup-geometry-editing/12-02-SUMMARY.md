---
phase: 12
plan: 2
subsystem: markup-geometry-editing
tags: [wave-2, react-konva, vertex-handles, drag-preview, additive-props, zoom-compensated]
requires:
  - phase: 12-markup-geometry-editing
    provides: markup-command-move-vertex-union-member, markup-command-move-markups-union-member, viewerStore-vertexEditMarkupId-state-machine
provides:
  - markup-component-drag-mousedown-prop
  - markup-component-overridePoints-overridePoint-prop
  - VertexHandleOverlay-component
  - zoom-compensated-named-handle-rect-pattern
affects:
  - src/renderer/src/components/CanvasViewport.tsx
  - phase-12 wave 3 (event wiring) and wave 4 (commit dispatch)
tech-stack:
  added: []
  patterns:
    - additive-optional-prop-extension-on-five-renderers
    - override-points-live-drag-preview-without-store-write
    - named-rect-hit-detection-via-konva-name
    - listening-true-overlay-counterpoint-to-hoverring
    - zoom-compensated-overlay-via-screen-px-divided-by-currentZoom
key-files:
  created:
    - src/renderer/src/components/markup/VertexHandleOverlay.tsx
  modified:
    - src/renderer/src/components/markup/LinearMarkup.tsx
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
    - src/renderer/src/components/WallMarkup.tsx
    - src/renderer/src/components/markup/CountPinMarkup.tsx
key-decisions:
  - "Effective-geometry indirection (`effectivePoints = overridePoints ?? markup.points`, and `effectivePoint = overridePoint ?? markup.point` for count) computed once at the top of each render body; ALL Konva geometry reads (Line points, Circle x/y, Text x/y, polylineMidpoint, polygonCentroid, polylineLength, polygonArea, wallAreaM2, etc.) go through the effective value, not `markup.points`. Metadata reads (`markup.id`, `markup.color`, `markup.name`, `markup.categoryId`, `markup.sequence`, `markup.wallHeight`) intentionally stay on the markup, so the drag preview is purely positional."
  - "Existing label-positioning side-effects on geometry inputs are routed through `effectivePoints` too — the LinearMarkup arc-length midpoint, the Area/Perimeter centroid, the Perimeter `closedPoints = [...points, points[0]]` array, the WallMarkup midpoint and wallAreaM2 inputs. Without this the live preview would render new geometry but show the label at the OLD midpoint/centroid — visually broken under drag."
  - "`onMouseDown` placed on every markup Group alongside the existing onClick / onMouseEnter / onMouseLeave / onContextMenu handlers, NOT replacing any of them. Wave 3 needs the prop to fire BEFORE the Stage-level handler via Konva's child-first bubbling order (RESEARCH Finding 4); leaving onClick intact preserves the existing first-click selection path from Plan 09-02."
  - "VertexHandleOverlay imports `Markup` from `../../types/markup` (the discriminated union) — not `LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup`. The narrower union would force Wave 3 callers to discriminate before passing, defeating the point of having one overlay component. Discrimination happens inside the overlay via `markup.type === 'count' ? [] : markup.points`, with an early `return null` when `points.length === 0` — clean handling of both the count branch and the (theoretical) empty-points branch."
  - "Hit area on each handle Rect set via `hitWidth` / `hitHeight` (16 / currentZoom) — separate from the visual width/height (8 / currentZoom). Konva supports per-shape hit dimensions distinct from the visual; this gives precision pointer targeting without enlarging the white square (RESEARCH Finding 3). NOT using `hitStrokeWidth` because the visible stroke is 1.5px — extending hit via stroke would conflate the two and look fragile."
  - "`e.cancelBubble = true` inside each handle's `onMouseDown` per the Konva event-stop API (the React-DOM `stopPropagation()` is NOT the right tool here — Konva's bubble model has its own flag). This prevents the Stage-level `handleStageMouseDown` from also firing, which would otherwise start a rubber-band or body-drag at the same time as the vertex drag (RESEARCH Pitfall — disambiguation). Wave 3 will rely on this guarantee."
patterns-established:
  - "Renderer-level drag-preview indirection: optional `overridePoints` (or singular `overridePoint` for count) lets the parent inject live-drag geometry without touching the store. Wave 3 holds a single `dragPreview` state object and passes it down to the one markup currently being dragged; every other markup gets undefined overrides and renders from `markup.points` unchanged. Adopt this pattern for any future transient geometry overlay (rotate handles, scale handles)."
  - "Named Konva Rect handles via `name={`handle-${i}`}`. Wave 3 reads `e.target.name()?.startsWith('handle-')` in `handleStageMouseDown` to disambiguate handle clicks from markup-body clicks; this is the Konva-idiomatic alternative to ref-passing or boolean flags. Future hit-detection-by-role overlays should reuse the same name-prefix convention."
  - "`listening={true}` on every Rect AND the parent Group of `VertexHandleOverlay`. This is the INVERSE of the HoverRing / PulseHighlight pattern, which uses `listening={false}` because they are purely decorative. Documented inline with a CRITICAL comment so the next person editing the file does not accidentally apply the cosmetic-overlay convention."
requirements-completed: []
duration: 14min
completed: 2026-05-21
---

# Phase 12 Plan 2: Wave 2 — Markup Component Drag Props + VertexHandleOverlay Summary

**Five markup components extended with optional `onMarkupMouseDown` + `overridePoints`/`overridePoint` drag props; new `VertexHandleOverlay` component renders zoom-compensated 8×8 named Rect handles with `listening={true}` and `e.cancelBubble` discipline — full 511-test suite holds, zero callsite changes required, Wave 3 can now wire body drag and vertex drag against a stable component API.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-21T09:39Z (approx, after baseline tsc/vitest pass)
- **Completed:** 2026-05-21T09:42Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 5

## Accomplishments

- **All five markup renderers are drag-aware without breaking a single existing call site.** Every prop addition (`onMarkupMouseDown`, `overridePoints` or `overridePoint`) is optional; CanvasViewport's existing renders pass nothing and observe identical behavior. TypeScript still compiles clean.
- **`VertexHandleOverlay` exists as a standalone, self-contained Konva component.** Takes `markup`, `currentZoom`, `onHandleMouseDown`; renders N handles for points-array markups and zero for count pins (D-09); enforces D-05 visual spec (8×8px white fill, markup.color border, 1.5px stroke) with the same `/ currentZoom` zoom-compensation pattern used everywhere else in the codebase.
- **Critical Wave 3 invariants are baked into the file:** `listening={true}` on every Rect (counterpoint to HoverRing/PulseHighlight — Pitfall 6 documented inline with a CRITICAL comment), `name={`handle-${i}`}` for the named-hit-detection pattern Wave 3 will rely on, and `e.cancelBubble = true` in every handle's onMouseDown so the Stage-level handler does not also fire.
- **No store coupling.** VertexHandleOverlay reads `markup.color` from props, NOT from `useViewerStore` or `useMarkupStore` — keeps the component testable in isolation and lets Wave 3 wire it into whatever layer ordering works best.

## Task Commits

1. **Task 1: Drag-aware props on all five markup components** — `34fe197` (feat)
2. **Task 2: VertexHandleOverlay component for vertex-edit mode** — `63d5d9c` (feat)

_Note: Plan executed as two atomic commits. Per execute-plan.md per-task commit protocol — the plan's suggested combined message `feat(12-02): markup drag props + VertexHandleOverlay component` was not adopted because the per-task protocol takes precedence; same approach as Wave 1's three-commit decomposition. Aggregate diff is identical; finer bisect granularity preserved._

## Files Created/Modified

### Created
- `src/renderer/src/components/markup/VertexHandleOverlay.tsx` — 83 lines. Renders zoom-compensated 8×8 Rect handles with named hit detection, listening=true, e.cancelBubble. Returns null for count markups. Module-level constants `HANDLE_SIZE_PX = 8`, `HANDLE_STROKE_PX = 1.5`, `HANDLE_HIT_PX = 16` all in screen pixels, divided by currentZoom at the call site.

### Modified
- `src/renderer/src/components/markup/LinearMarkup.tsx` — Added `onMarkupMouseDown?` + `overridePoints?`; `effectivePoints = overridePoints ?? markup.points` routed through `flatPoints`, `polylineMidpointByArcLength`, `polylineLength`; Group gains `onMouseDown` handler. `StagePoint` import added.
- `src/renderer/src/components/markup/AreaMarkup.tsx` — Same as Linear; `effectivePoints` routed through `flatPoints`, `polygonCentroid`, `polygonArea`. `StagePoint` import added.
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — Same; `effectivePoints` routed through `flatPoints`, `polygonCentroid`, `polygonArea`, AND `closedPoints = [...effectivePoints, effectivePoints[0]]` for the perimeter calculation (per-Plan B2 fix preserved — closing segment still included). `StagePoint` import added.
- `src/renderer/src/components/WallMarkup.tsx` — Same; `effectivePoints` routed through both the primary `<Line>` and the offset hairline `<Line>` (both get the new geometry), plus `polylineMidpointByArcLength` and `wallAreaM2(effectivePoints, markup.wallHeight, …)`. `markup.wallHeight` stays on markup — wall height is metadata, not draggable. `StagePoint` import added.
- `src/renderer/src/components/markup/CountPinMarkup.tsx` — Added `onMarkupMouseDown?` + `overridePoint?` (singular per CountMarkup's `point: StagePoint` shape, not `points: StagePoint[]`); `effectivePoint = overridePoint ?? markup.point` routed through Circle x/y and Text x/y; Group gains `onMouseDown` handler. `StagePoint` import added.

## Decisions Made

See frontmatter `key-decisions` for the full rationale list. Six decisions captured: (1) effective-geometry indirection scope (geometry yes, metadata no), (2) label-positioning inputs must use effective points, (3) onMouseDown additive to onClick, (4) VertexHandleOverlay accepts the full `Markup` union, (5) hitWidth/hitHeight separate from visual size, (6) `e.cancelBubble = true` discipline.

## Deviations from Plan

**None of consequence.** No Rule 1/2/3 auto-fixes were triggered, no Rule 4 architectural decisions needed, no authentication gates, no test infrastructure changes.

One minor stylistic note worth documenting (not a deviation, just transparency):

- The plan suggested a single combined commit `feat(12-02): markup drag props + VertexHandleOverlay component`. Per the execute-plan.md per-task commit protocol (which takes precedence over plan-suggested commit messages), two atomic per-task commits were created instead — `feat(12-02-T1)` and `feat(12-02-T2)`. This matches the Wave 1 commit pattern and gives finer bisect granularity. Aggregate diff is identical.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Plan executed exactly as written; full 511/511 suite still passes.

## Issues Encountered

None. All five markup component edits flowed through cleanly — the existing prop interfaces already established the optional-callback convention (`onClick?`, `onHoverEnter?`, etc.), so the new props slot in alongside without restructuring. The VertexHandleOverlay was a fresh file with no existing analog to harmonize with, so straightforward to write.

## User Setup Required

None. Pure renderer-process React/Konva component-layer work; no IPC, no filesystem, no network, no env vars, no installed dependencies changed.

## Known Stubs

None at the source-file level.

`VertexHandleOverlay` is intentionally not mounted anywhere yet — Wave 3 wires it into `CanvasViewport` against `vertexEditMarkupId`. This is NOT a stub in the project-skill sense (no hardcoded empty data flowing to UI, no "coming soon" strings, no placeholder text). It is a component-layer contract built ahead of its first call site, which is the explicit and documented plan structure: Wave 2 builds the contract, Wave 3 consumes it.

The five markup components' new `onMarkupMouseDown` / `overridePoints` / `overridePoint` props are similarly unconsumed in CanvasViewport today. Same story: the prop interface is the published contract; Wave 3 fills in the call sites. TypeScript will complain at the call site, not the renderer, if a future Wave 3 wiring is incomplete.

## Threat Flags

None. No new network endpoints, no auth paths, no file/IO surface, no schema changes at trust boundaries. All changes are renderer-process React rendering of in-memory Konva nodes — same security envelope as every other component in `src/renderer/src/components/markup/`.

## Self-Check: PASSED

- `src/renderer/src/components/markup/VertexHandleOverlay.tsx` — FOUND (created at correct path under `components/markup/`)
- `src/renderer/src/components/markup/LinearMarkup.tsx` — FOUND, modified
- `src/renderer/src/components/markup/AreaMarkup.tsx` — FOUND, modified
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — FOUND, modified
- `src/renderer/src/components/WallMarkup.tsx` — FOUND, modified (at the correct `components/` path — NOT `components/markup/`, per the plan's anti-pattern callout)
- `src/renderer/src/components/markup/CountPinMarkup.tsx` — FOUND, modified
- Commit `34fe197` (T1) — FOUND in git log
- Commit `63d5d9c` (T2) — FOUND in git log
- `npx tsc --noEmit` — exit 0, no errors
- `npx vitest run` — 71 files, 511 tests, 0 failures (same count as Wave 1 baseline — no regressions, no new tests added by this UI-layer plan)

## Next Phase Readiness

**Wave 3 (CanvasViewport event wiring) can now consume:**

1. **`onMarkupMouseDown?: (id: string) => void`** on every markup component — Wave 3 will pass a single callback that writes the current markup id into a `markupBodyDownRef = useRef<string | null>(null)`. Konva fires the child Group's onMouseDown BEFORE the Stage onMouseDown (bubbling order), so by the time `handleStageMouseDown` runs the ref already holds the markup id for the body-drag branch.
2. **`overridePoints?: StagePoint[]` / `overridePoint?: StagePoint`** — Wave 3 will hold a `dragPreview` state object (`{ markupId, points }` for vertex drag, or `{ deltas }` for body drag) and pass the appropriate override down to the one markup being dragged. All other markups receive `undefined` overrides and render from `markup.points` / `markup.point` unchanged. This is the no-store-write live-drag-preview pattern per RESEARCH Finding 6.
3. **`<VertexHandleOverlay markup={…} currentZoom={…} onHandleMouseDown={…} />`** — Wave 3 mounts this conditionally inside a new `<Layer listening={true}>` ABOVE Layer 1b (committed markups) when `vertexEditMarkupId !== null`. The new layer position is critical (RESEARCH Pitfall 5): below 1b, handle pointer events would be swallowed by the markup Group underneath. Above 1b, handles intercept clicks first as required.

No blockers, no concerns. Wave 3 has a clean component surface to wire against.

---
*Phase: 12-markup-geometry-editing*
*Completed: 2026-05-21*
