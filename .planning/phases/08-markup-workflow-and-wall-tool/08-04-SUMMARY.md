---
phase: "08-markup-workflow-and-wall-tool"
plan: "04"
subsystem: "renderer/components"
tags: [wall, renderer, popup, konva, markup-math]
dependency_graph:
  requires: ["08-00", "08-02"]
  provides: ["WallMarkup renderer", "wallAreaM2 math function", "MarkupNamePopup wall-height row"]
  affects:
    - src/renderer/src/components/WallMarkup.tsx
    - src/renderer/src/components/MarkupNamePopup.tsx
    - src/renderer/src/lib/markup-math.ts
tech_stack:
  added: []
  patterns:
    - "WallMarkup mirrors LinearMarkup structure verbatim with wall-specific visual constants"
    - "hiddenItemSet.has() O(1) skip-render at top of component body (from 08-02)"
    - "Zoom-compensated strokes: divide by currentZoom (Pitfall 2)"
    - "Parallel offset hairline via Konva offsetY (approximation for dense-plan affordance)"
    - "wallAreaM2 pure function with inline px->mm->m conversion (avoids ScaleUnit assumption)"
    - "MarkupNamePopup additive props: toolType? + initialWallHeight? with conditional row render"
    - "onMouseDown + e.stopPropagation() on wall input (established CategoryAutocomplete pattern)"
    - "Widened onConfirm payload with conditional wallHeight spread"
key_files:
  created:
    - src/renderer/src/components/WallMarkup.tsx
  modified:
    - src/renderer/src/lib/markup-math.ts
    - src/renderer/src/components/MarkupNamePopup.tsx
decisions:
  - "WallMarkup placed at src/renderer/src/components/WallMarkup.tsx (not inside markup/ subdirectory) per 08-CONTEXT.md file path declaration"
  - "wallAreaM2 added to markup-math.ts here (parallel wave 2 execution — 08-03 not yet merged); inline px/mm/m conversion avoids ScaleUnit assumption A1"
  - "hiddenItemSet.has() used instead of hiddenItemNames.includes() per must_haves O(1) requirement; 08-PATTERNS.md used .includes() but 08-02 added hiddenItemSet specifically for this"
  - "polylineLength not imported directly in WallMarkup.tsx since it is called internally by wallAreaM2 — clean import, no dead reference"
  - "MarkupNamePopup wallHeight state stored as string (not number) so controlled input does not require numeric coercion on every keystroke"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-15T04:34:21Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 04: Wall Renderer and Popup Extension Summary

**One-liner:** WallMarkup Konva component with 2.5x stroke + parallel hairline affordance, m2 area label at arc-length midpoint, O(1) hiddenItemSet skip-render; MarkupNamePopup extended with conditional wall-height numeric input row, positive-number validation, and widened onConfirm payload.

## What Was Built

### Task 1: WallMarkup.tsx + wallAreaM2 math function

**`src/renderer/src/lib/markup-math.ts`** — Added `wallAreaM2(points, wallHeightMm, pixelsPerMm): number`. Pure function: px to mm to m inline conversion (avoids ScaleUnit assumption). Throws on `pixelsPerMm <= 0` or `wallHeightMm <= 0`. Zero-length polyline returns 0 (polylineLength edge case). The `wall-math.test.ts` RED stubs from Wave 0 are now all GREEN (3/3).

**`src/renderer/src/components/WallMarkup.tsx`** — New file (156 lines). Structure mirrors `LinearMarkup.tsx` verbatim with these wall-specific substitutions:
- **Visual constants:** `WALL_STROKE_MULTIPLIER = 2.5`, `WALL_OFFSET_WORLD = 3`, `WALL_HAIRLINE_OPACITY = 0.7`
- **Two Konva Line nodes:** primary (2.5x stroke, interactive) + hairline (1x stroke at 70% opacity, `offsetY=WALL_OFFSET_WORLD`, `listening={false}`)
- **Zoom compensation (Pitfall 2):** `primaryStroke = (STROKE_BASE_PX * WALL_STROKE_MULTIPLIER) / currentZoom`, `hairlineStroke = STROKE_BASE_PX / currentZoom`
- **Hidden-item skip:** `const isHidden = useProjectStore((s) => s.hiddenItemSet.has(markup.name)); if (isHidden) return null` — first two lines of component body, O(1) Set lookup
- **Label:** `wallAreaM2(markup.points, markup.wallHeight, pageScale.pixelsPerMm).toFixed(2) m2` at `polylineMidpointByArcLength` position. Dark chip background (rgba(20,20,20,0.78)), white text, `listening={false}` on both Rect and Text.
- **Group event handlers:** verbatim copy from LinearMarkup (onMouseEnter/onMouseLeave/onContextMenu with stage.getPointerPosition())

### Task 2: MarkupNamePopup wall-height row

**`src/renderer/src/components/MarkupNamePopup.tsx`** — Five additive edits, non-wall modes unchanged:

1. **Props interface:** Added `toolType?: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'` and `initialWallHeight?: number`. Widened `onConfirm` to `(payload: { name, categoryName, color, wallHeight?: number }) => void`.

2. **Component destructure:** `toolType` and `initialWallHeight = 2400` added with default.

3. **Local state:** `wallHeight` (string, initialized to `String(initialWallHeight)`), `wallHeightError` (string | null).

4. **handleConfirm validation:** After name check, if `toolType === 'wall'` — `parseFloat(wallHeight)` → isNaN or <= 0 → set error and return. On confirm: conditional `wallHeight` spread in payload. Both `toolType` and `wallHeight` added to useCallback dependency array.

5. **JSX wall-height row:** Renders only when `toolType === 'wall'`. Contains label "Wall height (mm)", `type="number"` input with `min="1"`, `onMouseDown={e => e.stopPropagation()}` (established pattern from CategoryAutocomplete), onChange clears wallHeightError, conditional inline error div using `COLORS.warning`.

## Test Results

- `wall-math.test.ts` — **3/3 GREEN** (was RED stubs in Wave 0 — now pass after wallAreaM2 implementation)
- `markup-namepopup.test.ts` — **14/14 GREEN** (no regressions — additive props default to undefined and are silently ignored for non-wall modes)
- `npx tsc --noEmit` — exits 0

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (WallMarkup + wallAreaM2) | `dc30724` | feat(08-04): create WallMarkup.tsx with wallAreaM2 in markup-math |
| Task 2 (MarkupNamePopup extension) | `02a8aeb` | feat(08-04): extend MarkupNamePopup with wall-height row + widened payload |

## Deviations from Plan

### wallAreaM2 added in this plan (not 08-03)

**Found during:** Task 1 implementation
**Issue:** Plan 08-04 Task 1 states `wallAreaM2` should be importable from `markup-math.ts` (from 08-03 Task 1). Since this is parallel wave 2 execution and 08-03 has not merged yet, `wallAreaM2` was not present in `markup-math.ts` at execution start.
**Fix:** Added `wallAreaM2` to `markup-math.ts` in this plan (Rule 3 — blocking issue). Implementation matches the exact pattern specified in `08-PATTERNS.md` (same signature, same inline conversion). `wall-math.test.ts` RED stubs now pass GREEN, confirming the implementation is correct.
**Files modified:** `src/renderer/src/lib/markup-math.ts`
**Commit:** `dc30724`

### hiddenItemSet.has() used instead of hiddenItemNames.includes()

**Found during:** Task 1 implementation
**Issue:** `08-PATTERNS.md` documents `hiddenItemNames.includes()` as the pattern, but the plan's `must_haves` explicitly require `hiddenItemSet.has()` for O(1) lookup. The `08-02-SUMMARY.md` confirms `hiddenItemSet` was added precisely for this purpose.
**Fix:** Used `hiddenItemSet.has()` as specified in must_haves — this is the authoritative source, not the older PATTERNS.md text.
**Impact:** No functional change; O(1) lookup vs O(n) — a performance improvement.

## Known Stubs

None. The wall-height row renders fully for `toolType === 'wall'`. The m2 label gracefully degrades (no label) when `pageScale` is null — this is the documented uncalibrated-page behavior, matching LinearMarkup's pattern, not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All threat items from the plan's threat model are addressed:
- T-08-04-01 (wall height formula injection): `parseFloat(wallHeight)` + `isNaN(h) || h <= 0` check in `handleConfirm` rejects non-numeric and non-positive inputs. Save button blocked with inline error.
- T-08-04-02 (massive wall height DoS): `parseFloat` tolerates IEEE 754; display bounded by `.toFixed(2)` — accepted.
- T-08-04-03 (error message disclosure): Error message "Enter a positive height in mm" is generic — accepted.

## Self-Check: PASSED

- WallMarkup.tsx: FOUND at src/renderer/src/components/WallMarkup.tsx
- MarkupNamePopup.tsx: FOUND at src/renderer/src/components/MarkupNamePopup.tsx
- markup-math.ts: FOUND at src/renderer/src/lib/markup-math.ts
- Commit dc30724 (WallMarkup + wallAreaM2): FOUND
- Commit 02a8aeb (MarkupNamePopup extension): FOUND
- wall-math.test.ts: 3/3 GREEN
- markup-namepopup.test.ts: 14/14 GREEN
- npx tsc --noEmit: exits 0
