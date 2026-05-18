---
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
plan: "03"
subsystem: canvas-interaction
tags: [react-konva, rubber-band, multi-select, enter-key, keyboard-shortcuts, drag-buttons]

requires:
  - phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
    plan: "00"
    provides: "selectedMarkupIds + setSelectedMarkupIds in viewerStore; deleteGroup(markups) with 'delete-group' MarkupCommand"
  - phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
    plan: "02"
    provides: "Delete-key handler that routes to deleteMarkup (single) or deleteGroup (multi) and clears selection after; Escape useEffect in CanvasViewport that this plan extends with Enter"
provides:
  - "Rubber-band multi-select rectangle drawn on LMB drag in 'select' mode (D-06)"
  - "Full-AABB containment selection rule (D-07) — markups whose entire bbox lies inside the rubber-band become selectedMarkupIds on mouseup"
  - "Konva.dragButtons gated on activeTool — LMB pan suppressed in 'select' mode without spacebar; middle-mouse pan and spacebar+LMB pan unaffected"
  - "Enter-key markup commit (D-26 / D-27) — Linear/Wall ≥2 points via finishLinear; Area/Perimeter ≥3 points via finishPolygon; silent ignore on degenerate; isTextInputActive guard prevents firing while popup name input is focused"
affects: [09-04, 09-05]

tech-stack:
  added: []
  patterns:
    - "Konva.dragButtons gating: activeTool-aware pan suppression in 'select' mode (RESEARCH §Pitfall 2). Stage.draggable stays hardcoded true — pan is controlled exclusively by dragButtons, not the draggable prop"
    - "Rubber-band Rect lives in Layer 1a (listening=false) — same non-interactive layer as the calibration overlay and in-progress linear preview, so the rect never intercepts clicks meant for markup Groups in Layer 1b"
    - "Stage-space coordinate conversion via stage.getAbsoluteTransform().copy().invert().point(pointer) — the canonical pattern from STATE.md, identical to screenToStagePoint in useMarkupTool"
    - "Axis-aligned bbox for D-07 containment (count: ±PIN_RADIUS_WORLD; polyline shapes: min/max over points). Convex hull is NOT needed — the rubber-band uses 'full bbox inside band', not 'shape pixel overlap'"
    - "Enter-key commit uses markupState.points ONLY — the floating hover/preview point is NOT appended; no stage.getPointerPosition() read in the Enter path (review concern from the plan explicitly called out and enforced)"
    - "Single Escape useEffect extended with Enter branch — fewer keydown listeners, same lifecycle, deps array widened with markupState.toolType + markupState.points.length + finishLinear + finishPolygon"

key-files:
  created: []
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useViewportControls.ts

key-decisions:
  - "Konva.dragButtons formula `(spaceHeld || activeTool !== 'select') ? [0, 1] : [1]` lives in useViewportControls; isDraggable stays hardcoded true. Two consequences: (a) non-'select' modes keep pre-09 LMB pan behavior verbatim — no regression; (b) 'select' mode pan rights are MMB-only unless the user holds spacebar, which is the canonical CAD convention"
  - "Rubber-band useState (not useRef + direct attr mutation) — single Konva Rect updates at 60fps are within React 19's render budget (RESEARCH §Pitfall 9); useState keeps the rendering pipeline reactive and avoids manual node-attr mutation"
  - "getMarkupBBox and isFullyInside live at MODULE scope (not inside the component). Pure functions over Markup; no hook deps; same placement pattern as PIN_RADIUS_WORLD and RUBBER_BAND_FILL — easy to grep and easy to unit-test in isolation if Wave 4 wants to add coverage"
  - "PIN_RADIUS_WORLD is duplicated as a module-level constant in CanvasViewport.tsx (= 10) — mirrors the same constant in CountPinMarkup.tsx:25, HoverRing.tsx:21, and PulseHighlight.tsx:22. STATE.md key-decision 'Pin geometry constants lifted to module scope' establishes the duplication-with-grep-anchor pattern. A shared constant in lib/constants.ts would be cleaner but is a cross-Wave refactor; deferred to a future cleanup pass"
  - "handleStageMouseUp takes no parameter (not `(_e: KonvaEventObject<...>)`) — react-konva onMouseUp accepts callbacks with fewer parameters, and dropping the unused parameter avoids adding a new ESLint @typescript-eslint/no-unused-vars error (baseline file has 21 errors; my changes keep the count at 21). The pre-existing handleStageMouseMove and handleStageDblClick still carry `_e` for backwards compat and remain flagged in the baseline"
  - "Enter-key branch is inside the existing Escape useEffect, NOT a new effect — uses early `return` after each commit to keep the Enter logic isolated from the Escape logic. Deps array widened with markupState.toolType, markupState.points.length, finishLinear, finishPolygon; existing deps (markupState.mode, cancelMarkup, clearSelection) preserved for the Escape branch"
  - "Enter-key commit path is `markupState.points.length >= N` THEN `finishLinear()` / `finishPolygon()` — no array mutation, no pointer read between the guard and the finish call. Plan §PART C 'ENTER KEY FLOATING POINT RULE' enforced verbatim"

patterns-established:
  - "Stage drag-button gating (per-mode pan suppression) — the canonical extension pattern for any future tool mode that wants LMB-drag to do something other than pan. Add the tool to the `activeTool !== 'select'` clause, or generalize to a `panEnabledTools` Set"
  - "Rubber-band-style drag interactions on the Stage — pattern: useState for stage-space rect, onMouseDown captures start (with mode/button/spaceHeld guards), onMouseMove updates end, onMouseUp computes result and clears state. All three handlers use the inverse Stage transform. Reusable for future selection-box / marquee-like interactions (e.g. polygon lasso, group recolor box)"
  - "Enter-key commit pattern on multi-vertex draws — match (toolType, minPointCount) tuple, call the matching finishFn. Silent-ignore on degenerate. Compose with isTextInputActive guard"

requirements-completed: []

duration: 9min
completed: 2026-05-18
---

# Phase 09 Plan 03: Wave 2 — Rubber-band Multi-Select + Enter-to-Commit Summary

**LMB-drag on empty canvas in 'select' mode now draws a rubber-band rectangle and selects every markup whose full bounding box lies inside on release (single 'delete-group' undo step via Wave 1's Delete handler); pressing Enter while drawing Linear/Wall (≥2 points) or Area/Perimeter (≥3 points) commits the in-progress shape without double-clicking; middle-mouse pan, spacebar+LMB pan, and the floating preview-point boundary all remain untouched.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 1 (`type="auto"` — Part A + Part B + Part C combined per plan structure)
- **Commits:** 1 atomic commit (`1d3a458`)
- **Files modified:** 2 source files, 0 created, 0 deleted
- **Tests:** vitest 473 tests / 66 files all pass; `npm run typecheck` exits 0; lint baseline of 21 errors preserved (no new errors introduced)

## Accomplishments

- **`useViewportControls.ts`**:
  - Added reactive `activeTool` selector alongside `currentPage` / `setViewport`
  - Changed `Konva.dragButtons` formula from `spaceHeld ? [0,1] : [1]` to `spaceHeld || activeTool !== 'select' ? [0,1] : [1]`
  - Extended the useEffect deps array with `activeTool`
  - `isDraggable` remains hardcoded `true` (unchanged)
- **`CanvasViewport.tsx` — module-scope additions**:
  - Added `Rect` to the react-konva import
  - Added `isTextInputActive` to the useKeyboardShortcuts import
  - Added `RubberBandState` type alias
  - Added `RUBBER_BAND_FILL` rgba module constant (keeps raw rgba out of JSX)
  - Added `PIN_RADIUS_WORLD = 10` module constant
  - Added `getMarkupBBox(markup)` — returns axis-aligned bbox in stage-space (count → ±PIN_RADIUS_WORLD; polyline shapes → min/max over points)
  - Added `isFullyInside(markup, band)` — normalises band corners and returns the D-07 containment check
- **`CanvasViewport.tsx` — component additions**:
  - `useState<RubberBandState>(null)` near other local state
  - `handleStageMouseDown` — LMB-in-select-mode-without-spacebar starts rubber-band using the canonical stage inverse-transform
  - `handleStageMouseMove` extended — when `rubberBand` is non-null, updates the end-point; otherwise falls through to existing calibration / markup preview paths
  - `handleStageMouseUp` — filters `pageMarkups` via `isFullyInside`, calls `setSelectedMarkupIds(matched ids)`, clears rubberBand to null
  - Stage now binds `onMouseDown={handleStageMouseDown}` and `onMouseUp={handleStageMouseUp}`
  - Rubber-band `Rect` renders inside Layer 1a (`listening={false}`) with `COLORS.accent` stroke, `RUBBER_BAND_FILL` fill, and `1/currentZoom` strokeWidth
- **`CanvasViewport.tsx` — Enter-key extension to existing Escape useEffect**:
  - `if (e.key === 'Enter')` branch added after the Escape branch
  - `isTextInputActive()` guard fires first (D-27) — preserves popup form-submit Enter
  - `markupState.mode !== 'drawing'` early return (Enter only commits while drawing, not while naming/confirming/placing)
  - Linear/Wall: `markupState.points.length >= 2` → `e.preventDefault() + finishLinear()`; else silent ignore (D-26)
  - Area/Perimeter: `markupState.points.length >= 3` → `e.preventDefault() + finishPolygon()`; else silent ignore (D-26)
  - Deps array widened to `[markupState.mode, markupState.toolType, markupState.points.length, cancelMarkup, clearSelection, finishLinear, finishPolygon]`

## Task Commits

1. **Task 1 — Konva.dragButtons gate + rubber-band + Enter-to-commit** — `1d3a458` (feat)

## Files Modified

- `src/renderer/src/components/CanvasViewport.tsx` — module constants (`RUBBER_BAND_FILL`, `PIN_RADIUS_WORLD`, type `RubberBandState`), module helpers (`getMarkupBBox`, `isFullyInside`), Rect import, isTextInputActive import, `rubberBand` useState, three new Stage handlers (`handleStageMouseDown`, extension to `handleStageMouseMove`, `handleStageMouseUp`), Stage props (`onMouseDown` + `onMouseUp` bindings), rubber-band Rect JSX in Layer 1a, Enter-key branch in the Escape useEffect with widened deps
- `src/renderer/src/hooks/useViewportControls.ts` — `activeTool` selector, formula change `spaceHeld ? [0,1] : [1]` → `spaceHeld || activeTool !== 'select' ? [0,1] : [1]`, deps array widened

## Decisions Made

- **Rubber-band uses `useState` not `useRef`+direct-attr-mutation.** Single Konva Rect at 60fps is within React 19's budget per RESEARCH §Pitfall 9. Keeping the rendering pipeline reactive is the simpler path and matches every other transient Konva overlay in this codebase. No measured perf impact.
- **`isFullyInside` and `getMarkupBBox` at module scope, not inside the component.** Pure functions, no hook deps, mirror the `PIN_RADIUS_WORLD` and `RUBBER_BAND_FILL` placement. Easy to grep; future Wave 4 unit tests can import them without touching the component.
- **`PIN_RADIUS_WORLD` duplicated (not centralised into `lib/constants.ts`).** STATE.md key-decision "Pin geometry constants lifted to module scope" establishes the duplication-with-grep-anchor pattern. Already duplicated in CountPinMarkup, HoverRing, PulseHighlight, and now CanvasViewport. Centralising would be a cross-Wave refactor; deferred.
- **`handleStageMouseUp` parameter dropped** to avoid adding a new ESLint `no-unused-vars` error. react-konva's `onMouseUp` typing accepts narrower callbacks. Pre-existing `handleStageMouseMove` and `handleStageDblClick` still carry `_e` parameters and remain flagged by the baseline lint — leaving them alone keeps the diff minimal and matches the existing codebase pattern.
- **Enter inside the existing Escape useEffect, not a new effect.** Two reasons: (a) Both keys live in the same component-scoped subsystem (markup flow control); (b) Adding a second `addEventListener('keydown', ...)` would mean two listeners racing for the same event. Branch isolation via early `return` keeps the logic readable.
- **Enter commit reads markupState.points ONLY** — explicitly does NOT call `stage.getPointerPosition()` before the finish call. The plan's PART C "ENTER KEY FLOATING POINT RULE" guardrail enforced verbatim. Confirmed via grep: the only `getPointerPosition` calls in the file are in `handleStageClick`, `handleStageMouseDown`, and `handleStageMouseMove` — none of them are in the Enter handler path.

## Deviations from Plan

None - plan executed exactly as written.

The plan referenced `npm run test -- --run` as the verification command. The project has no `test` script in `package.json` (per Wave 0 SUMMARY's tooling note); the canonical invocation is `npx vitest run`. Used that throughout. No source deviation.

The `handleStageMouseUp` callback dropped its `_e` parameter to avoid adding a new lint error — this is a minor stylistic divergence from the plan's `<read_first>` hint (which suggested matching the existing `_e` pattern). The pre-existing handlers (`handleStageMouseMove`, `handleStageDblClick`) still carry `_e`; not retroactively changing them keeps this commit minimal and matches the worktree-path-safety / minimum-diff discipline.

## Issues Encountered

None on the source side.

One operational confirmation: ran `git stash; eslint; git stash pop` once to confirm the lint baseline (21 errors in the modified files) was preserved after my changes. The single lint error my initial `(_e: ...)` parameter introduced was caught at this step and fixed before commit. Net errors-after-changes = errors-before-changes (21 → 21).

## Self-Check: PASSED

Verified after writing SUMMARY (paths relative to worktree root):

- `src/renderer/src/components/CanvasViewport.tsx` contains:
  - `const RUBBER_BAND_FILL = 'rgba(0,120,212,0.1)'` (line 51) — module-level constant, no raw rgba in JSX
  - `function isFullyInside(` (line 89) — module-scope helper
  - `useState<RubberBandState>(null)` (line 290) — rubberBand local state
  - `onMouseDown={handleStageMouseDown}` and `onMouseUp={handleStageMouseUp}` on the Stage
  - `{rubberBand && (<Rect ...>)}` inside Layer 1a (line ~909)
  - `if (e.key === 'Enter')` in the keyboard useEffect (line 429)
  - Enter path does NOT reference `currentPointer` or `stage.getPointerPosition()` (grep verified — the three getPointerPosition calls in the file are in handleStageClick (594), handleStageMouseDown (641), handleStageMouseMove (655))
- `src/renderer/src/hooks/useViewportControls.ts` contains:
  - `const activeTool = useViewerStore((s) => s.activeTool)` (line 73)
  - `Konva.dragButtons = spaceHeld || activeTool !== 'select' ? [0, 1] : [1]` (line 84)
  - Deps array `[spaceHeld, activeTool]` (line 85)
  - `const isDraggable = true` (line 174) — unchanged
- Commit `1d3a458` exists on branch `worktree-agent-a6ca799644edf603f`; HEAD has no file deletions
- `npm run typecheck` exits 0
- `npx vitest run` reports `66 passed (66) / 473 passed (473)`
- ESLint error count on the two modified files remains at the baseline of 21 (no new errors introduced)

## Next Phase Readiness

This plan's contract is consumed by:

- **Plan 09-04 (draggable modals)** — fully independent; not affected by this plan
- **Plan 09-05 (ribbon toolbar)** — fully independent; not affected by this plan
- **Plan 09-06 (Wave 5 UAT)** — will exercise:
  - LMB drag in 'select' mode → rubber-band rect → release → all-fully-inside markups become selected
  - Delete after rubber-band → all selected markups deleted as ONE undo step (Ctrl+Z restores all)
  - Middle-mouse pan in 'select' mode (must still work)
  - Spacebar+LMB pan in 'select' mode (must still work — spacebar override)
  - Enter while drawing Linear (≥2 points) → MarkupNamePopup appears
  - Enter while drawing Linear (1 point) → silent ignore
  - Enter while typing in a popup name field → popup form submit only, NOT a second commit
  - Enter while drawing Area (≥3 points) → finishPolygon → popup at centroid
  - Enter commit does NOT include the floating preview point (visual: last vertex matches the last click, NOT where the cursor is)

No blockers. No CLAUDE.md violations. The `Konva.dragButtons` gating and the rubber-band-via-useState patterns are now available for any future selection-style interaction (e.g. Plan 09-04 might want a marquee-like gesture for batch modal-cancel, etc.).

---
*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Completed: 2026-05-18*
