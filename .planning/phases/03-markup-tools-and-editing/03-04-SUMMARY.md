---
phase: 03-markup-tools-and-editing
plan: 04
subsystem: canvas
tags: [typescript, react, konva, zustand, markup, area, perimeter, polygon, state-machine]

requires:
  - phase: 03-markup-tools-and-editing
    plan: 01
    provides: polygonArea, polygonCentroid, polylineLength, pixelAreaToReal, pixelLengthToReal, labelFontSize in markup-math.ts
  - phase: 03-markup-tools-and-editing
    plan: 03
    provides: useMarkupTool hook with finishPolygon stub, commitShape with area/perimeter paths pre-wired, CanvasViewport wired for count/linear

provides:
  - finishPolygon: full polygon close implementation with 3-vertex minimum validation and exact UI-SPEC error copy
  - AreaMarkup component: Konva closed Line with 20% alpha fill + two-line centroid label (name / value m2)
  - PerimeterMarkup component: Konva closed Line with 20% alpha fill + two-line centroid label (name / P: x  A: y)
  - CanvasViewport Layer 2: transient interactive polygon drawing layer with hitStrokeWidth start-vertex close detection
  - Committed area and perimeter markups rendered from markupStore per page
  - Polygon-closable cursor affordance (pointer) and start-vertex visual highlight

affects:
  - 03-05-markup-list-panel (area/perimeter markup types now fully committed to markupStore, visible in panel)

tech-stack:
  added: []
  patterns:
    - Transient Layer 2 pattern: separate interactive Konva Layer (listening=true) only mounted while polygon drawing in progress
    - hitStrokeWidth on start vertex Circle for enlarged hit area without visual change (canonical Konva polygon-close pattern)
    - isOverStartPoint local React state tracks hover over start vertex; drives finishPolygon intercept in handleStageClick
    - Polygon centroid via polygonCentroid (vertex average) used to anchor the Save Markup popup
    - Fill hex + '33' suffix (20% alpha) for polygon semi-transparent fill per UI-SPEC
    - Unicode U+00B2 for superscript-2 in area labels per UI-SPEC copywriting contract

key-files:
  created:
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
  modified:
    - src/renderer/src/hooks/useMarkupTool.ts
    - src/renderer/src/components/CanvasViewport.tsx

key-decisions:
  - "finishPolygon positions Save Markup popup at polygonCentroid + 20px y-offset (screen space) — centroid is the natural anchor for a polygon label"
  - "Layer 2 for polygon drawing is separate from Layer 1 (listening=false) to allow start-vertex hitStrokeWidth events without polluting the static markup layer"
  - "isOverStartPoint is local React state in CanvasViewport (not in useMarkupTool) because the hook is unaware of Konva Layer structure — CanvasViewport owns the interactive layer"
  - "PerimeterMarkup closedPoints = [...points, points[0]] appends first point to polylineLength input — ensures the closing segment is included in the perimeter calculation"

patterns-established:
  - "Polygon component pattern: Group(listening=false) with closed Line + two-line Text pair at centroid — mirrors LinearMarkup single-line pattern but with closed polygon and two text nodes"
  - "Start-vertex close detection: hitStrokeWidth on Circle in Layer 2 + isOverStartPoint state + handleStageClick intercept before recordMarkupClick"

requirements-completed:
  - MARK-03
  - MARK-04
  - MARK-08

duration: 5min
completed: 2026-04-20
---

# Phase 3 Plan 04: Area and Perimeter Markup Tools Summary

**Polygon close interaction via Konva hitStrokeWidth, AreaMarkup/PerimeterMarkup renderers with 20% alpha fill and Unicode area labels, and transient Layer 2 for start-vertex close detection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T14:35:12Z
- **Completed:** 2026-04-20T14:40:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- `finishPolygon` in `useMarkupTool.ts` replaced stub with full polygon close logic: 3-vertex minimum validation with exact UI-SPEC error string, centroid-anchored popup positioning, and transition to confirming state
- `AreaMarkup.tsx` and `PerimeterMarkup.tsx` created: closed Konva polygons with `${category.color}33` semi-transparent fill, two-line centroid labels per D-13 spec, and Unicode U+00B2 for area units
- `CanvasViewport.tsx` extended: transient Layer 2 with `hitStrokeWidth={12/zoom}` start-vertex Circle, `isOverStartPoint` state, polygon-close intercept in `handleStageClick`, committed area/perimeter rendering from markupStore, and pointer cursor affordance when polygon is closable
- Full test suite: 143 tests green (no regressions); `npm run typecheck` clean

## Task Commits

1. **Task 1: Implement finishPolygon with 3-vertex minimum validation** - `0106248` (feat)
2. **Task 2: Build AreaMarkup and PerimeterMarkup rendering components** - `3d5a370` (feat)
3. **Task 3: Wire polygon close and render committed area/perimeter markups** - `58a3ba2` (feat)

## Files Created/Modified

- `src/renderer/src/hooks/useMarkupTool.ts` — MODIFIED: finishPolygon stub replaced with full implementation; polygonCentroid import added
- `src/renderer/src/components/markup/AreaMarkup.tsx` — NEW: closed polygon with 20% alpha fill and two-line label (name / value m²)
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — NEW: closed polygon with 20% alpha fill and two-line label (name / P: x  A: y m²)
- `src/renderer/src/components/CanvasViewport.tsx` — MODIFIED: AreaMarkup/PerimeterMarkup imports, isOverStartPoint state, finishPolygon wired, Layer 2 transient polygon layer, committed markup rendering, cursor affordance

## Decisions Made

- `finishPolygon` positions the Save Markup popup at `polygonCentroid + 20px` (screen-space y-offset) — vertex average centroid is the natural anchor point for a polygon popup
- `Layer 2` is a separate Konva `<Layer>` (not added into Layer 1) to support interactive events (`hitStrokeWidth`) on the start vertex without requiring Layer 1 to have `listening=true`
- `isOverStartPoint` lives in `CanvasViewport` (not `useMarkupTool`) because the hook is isolated from Konva Layer structure — the viewport owns the event layer
- `PerimeterMarkup` appends `points[0]` to the points array before calling `polylineLength`, ensuring the closing segment is measured. Without this, the perimeter would be missing the last-to-first segment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all implementations matched plan specifications; typecheck and test suite clean on first attempt.

## Manual Verification Checklist (defer to Plan 05 checkpoint)

These are deferred to the formal Plan 05 human-verify checkpoint:

- [ ] Area tool: click Area in toolbar → crosshair cursor
- [ ] Click 3+ points on canvas → solid blue polygon segments accumulate
- [ ] Mouse move → dashed preview segment tracks cursor from last vertex
- [ ] Hover over start vertex after 3+ points → start vertex becomes white, cursor becomes pointer
- [ ] Click start vertex when hovered → MarkupNamePopup opens (Save Markup mode) centered on polygon
- [ ] Enter name → Save Markup → closed polygon appears with 20% alpha fill and "{name} / {area} m²" label
- [ ] Click start vertex with fewer than 3 points → "Add at least three points to close the shape" toast
- [ ] Perimeter tool: identical interaction flow; label shows "P: {perim} m  A: {area} m²"
- [ ] Escape during polygon draw → polygon cancelled, tool reverts to select

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 05 markup list panel can subscribe to `useMarkupStore.pageMarkups` and render all four markup types (count, linear, area, perimeter)
- All MARK-03, MARK-04, MARK-08 requirements closed — polygon tools fully operational
- Plan 05 formal human-verify checkpoint will confirm visual rendering matches UI-SPEC

---
*Phase: 03-markup-tools-and-editing*
*Completed: 2026-04-20*
