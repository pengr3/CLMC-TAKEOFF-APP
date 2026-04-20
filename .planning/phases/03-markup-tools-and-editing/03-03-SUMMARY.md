---
phase: 03-markup-tools-and-editing
plan: 03
subsystem: canvas
tags: [typescript, react, konva, zustand, markup, count, linear, state-machine, tdd]

requires:
  - phase: 03-markup-tools-and-editing
    plan: 01
    provides: useMarkupStore (placeMarkup, getOrCreateCategory, nextCountSequence), Markup types, markup-math helpers
  - phase: 03-markup-tools-and-editing
    plan: 02
    provides: MarkupNamePopup (count-pre/save-after modes), isMarkupTool type guard, ActiveTool union with markup tools

provides:
  - useMarkupTool hook: unified interaction state machine for count placing + linear drawing; area/perimeter stubbed for Plan 04
  - CountPinMarkup: Konva Group rendering colored circle + zoom-compensated '{name} {sequence}' label
  - LinearMarkup: Konva Line + midpoint label '{name} — {value} {unit}' with zoom-compensated stroke
  - CanvasViewport wired: click/dblclick/mousemove/Escape handlers for count and linear tools
  - Committed markups rendered from useMarkupStore.pageMarkups[currentPage]
  - In-progress linear preview: solid committed segments + dashed segment to cursor + vertex dots

affects:
  - 03-04-area-perimeter-markup-tool (finishPolygon stub ready; area/perimeter commitShape path pre-wired)
  - 03-05-markup-list-panel (pageMarkups rendered per-page; categories established by Plan 01)

tech-stack:
  added: []
  patterns:
    - useMarkupTool state machine mirrors useCalibrationMode pattern (INITIAL_STATE reset, screenToStagePoint utility)
    - DUPLICATE_POINT_EPSILON=2 guards against dblclick emitting two click events (Pitfall 1)
    - recordClick() calls useMarkupStore.getState() / useViewerStore.getState() inside setState updater — Zustand getState() is safe outside React render
    - commitCountName() transitions naming → placing without resetting name; subsequent clicks place pins silently (D-02)
    - finishLinear() drops trailing duplicate point before checking length, then transitions drawing → confirming
    - getCursor() extended: crosshair for both calibration mode and markup drawing/placing
    - Escape cancels markup state and reverts activeTool to 'select' via useViewerStore.getState().setActiveTool()
    - errorToast auto-dismissed after 3s via useEffect + setTimeout; useEffect guard: early return when null

key-files:
  created:
    - src/renderer/src/hooks/useMarkupTool.ts
    - src/renderer/src/components/markup/CountPinMarkup.tsx
    - src/renderer/src/components/markup/LinearMarkup.tsx
  modified:
    - src/renderer/src/components/CanvasViewport.tsx

key-decisions:
  - "useMarkupTool state machine uses useState+useCallback (not useReducer) to mirror useCalibrationMode pattern for consistency"
  - "recordClick places CountMarkup directly inside setState updater via Zustand getState() — avoids double-render from separate dispatch"
  - "Escape handler in CanvasViewport (not in useMarkupTool) because the hook is unaware of which Konva stage is focused; CanvasViewport owns the window event listener"
  - "LinearMarkup label shows only name when pageScale is null (uncalibrated page) — graceful degradation rather than '0 m' stub"

requirements-completed:
  - MARK-01
  - MARK-02
  - MARK-07

duration: 6min
completed: 2026-04-20
---

# Phase 3 Plan 03: Count and Linear Markup Tools Summary

**useMarkupTool state machine + CountPinMarkup/LinearMarkup Konva renderers wired into CanvasViewport — users can place count pins and draw labeled linear measurements on the canvas**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-20T14:26:29Z
- **Completed:** 2026-04-20T14:32:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 new, 1 modified)

## Accomplishments

- `useMarkupTool.ts` exports the full interaction state machine: `activate`, `cancel`, `recordClick`, `updatePreview`, `finishLinear`, `finishPolygon` (stub), `commitCountName`, `commitShape`, `dismissError` with correct count-placing and linear-drawing paths
- `CountPinMarkup.tsx` renders a colored circle pin (radius `6/zoom`) with label `"{name} {sequence}"` in zoom-compensated font (10px floor) per D-04/D-13
- `LinearMarkup.tsx` renders a polyline with midpoint label `"{name} — {value} {unit}"` (em dash U+2014) using `polylineLength + pixelLengthToReal`; degrades to name-only when uncalibrated
- `CanvasViewport.tsx` wired: `useMarkupTool` hook, `useMarkupStore` subscription, `handleStageClick` updated, `handleStageMouseMove` updated, `handleStageDblClick` added, `getCursor` updated, Escape handler, error toast auto-dismiss, committed markup rendering (count + linear), in-progress preview (solid + dashed + vertex dots), `MarkupNamePopup` for count-pre and save-after modes
- Full test suite: 143 tests green (no regressions)
- `npm run typecheck` clean (exit 0)

## Task Commits

1. **Task 1: useMarkupTool hook** — `892cb03` (feat)
2. **Task 2: CountPinMarkup + LinearMarkup components** — `9d748d8` (feat)
3. **Task 3: Wire CanvasViewport** — `3f5bfdf` (feat)

## Files Created/Modified

- `src/renderer/src/hooks/useMarkupTool.ts` — NEW: state machine, screenToStagePoint, DUPLICATE_POINT_EPSILON, full count+linear paths, area/perimeter stubs
- `src/renderer/src/components/markup/CountPinMarkup.tsx` — NEW: circle pin + zoom-compensated text label
- `src/renderer/src/components/markup/LinearMarkup.tsx` — NEW: polyline + midpoint label with em dash, graceful uncalibrated fallback
- `src/renderer/src/components/CanvasViewport.tsx` — MODIFIED: 7 new imports, markup hook wired, handlers updated, Layer 1 extended with markup rendering and in-progress preview, popups and error toast mounted

## Hook API as Exported

```typescript
export interface UseMarkupToolReturn {
  state: MarkupDrawState           // mode/toolType/points/previewPoint/popupScreenPos/pendingName/pendingCategoryName/pendingPage/errorToast
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter') => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  finishLinear: () => void           // called on Stage onDblClick for linear tool
  finishPolygon: () => void          // stub — Plan 04 implements
  commitCountName: (payload: { name: string; categoryName: string }) => void
  commitShape: (payload: { name: string; categoryName: string }) => void
  dismissError: () => void
}
```

## Manual Verification Checklist (defer to Plan 05 checkpoint)

These are deferred to the formal Plan 05 human-verify checkpoint:

- [ ] Count tool: click Count in toolbar → MarkupNamePopup opens immediately
- [ ] Enter name "Light Switch" → click Start Count → mode changes to placing
- [ ] Click on canvas → colored dot appears with label "Light Switch 1"
- [ ] Click again → "Light Switch 2" appears at new position
- [ ] Escape → pins remain, tool reverts to select
- [ ] Linear tool: click Linear → crosshair cursor
- [ ] Click two points on canvas → solid blue line segment visible
- [ ] Mouse move → dashed preview segment tracks cursor
- [ ] Double-click → MarkupNamePopup opens (Save Markup mode)
- [ ] Enter name → Save Markup → polyline committed with "{name} — {X.X m}" label
- [ ] Single-point double-click → "Add at least two points before ending" toast appears and auto-dismisses

## Known Limitations Carried to Plan 04

- `finishPolygon()` is a no-op stub — Plan 04 implements polygon close hit-detection for area/perimeter tools
- `commitShape()` has pre-wired area/perimeter paths (place AreaMarkup/PerimeterMarkup) but they are never reached until Plan 04 wires `finishPolygon`
- No visual rendering for committed AreaMarkup or PerimeterMarkup — Plan 04 will add AreaMarkup/PerimeterMarkup components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useEffect auto-dismiss not all code paths return a value**
- **Found during:** Task 3 verification (npm run typecheck)
- **Issue:** `useEffect(() => { if (errorToast) { ... return () => clearTimeout(id) } })` — TypeScript TS7030 error when only one branch returns the cleanup function
- **Fix:** Restructured to early return when `!markupState.errorToast`, ensuring the cleanup return is unconditional
- **Files modified:** `src/renderer/src/components/CanvasViewport.tsx`
- **Commit:** `3f5bfdf`

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript strict return path in useEffect)
**Impact on plan:** Single-pattern change; zero scope creep. typecheck gate clean.

## Known Stubs

- `finishPolygon()` in `useMarkupTool.ts`: returns `prev` unchanged — intentional stub for Plan 04 polygon close interaction. This does not block Plan 03's goal (Count + Linear tools working). Plan 04 will replace this stub.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04 can import `useMarkupTool` and extend `finishPolygon` for polygon-close hit detection
- Plan 04 can add `AreaMarkup` and `PerimeterMarkup` rendering components to `src/renderer/src/components/markup/`
- Plan 05 markup list panel can subscribe to `useMarkupStore.pageMarkups` and `useMarkupStore.getAllCategories()`

---
*Phase: 03-markup-tools-and-editing*
*Completed: 2026-04-20*
