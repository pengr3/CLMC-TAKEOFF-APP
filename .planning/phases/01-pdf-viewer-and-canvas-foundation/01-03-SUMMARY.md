---
phase: 01-pdf-viewer-and-canvas-foundation
plan: 03
subsystem: ui
tags: [konva, react-konva, zustand, zoom, pan, keyboard-shortcuts, pdf-viewer]

# Dependency graph
requires:
  - phase: 01-pdf-viewer-and-canvas-foundation
    plan: 02
    provides: CanvasViewport with Konva Stage, usePdfRenderer, viewerStore with getViewport/setViewport

provides:
  - useViewportControls hook: zoom-to-cursor (Ctrl+scroll), zoomIn, zoomOut, middle-mouse pan, spacebar pan
  - useKeyboardShortcuts hook: Ctrl+O, Ctrl+=/-, Ctrl+0, ArrowLeft/Right, PageUp/Down
  - Toolbar wired to live zoom percentage with accent color when != 100%
  - StatusBar reading live filename, page N of M, and Zoom: X% from store
  - EmptyState with drag-and-drop PDF loading via FileReader + loadPdf
  - Zoom/pan unit tests: 17 tests (zoom-to-cursor math, getNextZoomStep, fit-scale, pan persistence)
affects: [phase-02-markup-tools, phase-03-scale-calibration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level ref pattern (getCanvasControls) for cross-component function sharing without context pyramid"
    - "useEffect with stageRef.current as dependency for Konva native event listener attachment"
    - "Zoom-to-cursor: compute stage-space point under cursor before scale, reposition stage after scale to keep it fixed"
    - "getNextZoomStep: iterate ZOOM_STEPS array with 0.001 tolerance to avoid float equality issues"

key-files:
  created:
    - src/renderer/src/hooks/useViewportControls.ts
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/tests/zoom.test.ts
    - src/tests/stage-transform.test.ts
  modified:
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/Toolbar.tsx
    - src/renderer/src/components/StatusBar.tsx
    - src/renderer/src/components/EmptyState.tsx

key-decisions:
  - "Module-level ref (getCanvasControls) chosen over React context for exposing zoomIn/zoomOut/fitToWindow to Toolbar — avoids provider pyramid for a single-window app"
  - "Middle-mouse pan uses native DOM event listener on stage.container() rather than Konva events — Konva mouse events don't reliably capture button===1 for middle-click drag initiation"
  - "Spacebar pan toggles stage.draggable() true/false via useEffect watching spaceHeld state — simpler than synthetic pointer capture"
  - "ZOOM_STEPS discrete stepping with 0.001 tolerance prevents float equality failures at exact step boundaries"

patterns-established:
  - "Pattern 1: getCanvasControls() module-level singleton — CanvasViewport populates on mount, Toolbar reads on demand"
  - "Pattern 2: Zoom-to-cursor math — compute mousePointTo in stage space, reposition stage after scale change"
  - "Pattern 3: Keyboard shortcuts gated on totalPages > 0 — prevents accidental actions when no PDF loaded (Ctrl+O always works)"

requirements-completed: [PDF-03, PDF-04, PDF-06]

# Metrics
duration: 15min
completed: 2026-04-17
---

# Phase 01 Plan 03: Zoom, Pan, Keyboard Shortcuts and Status Bar Summary

**Zoom-to-cursor (Ctrl+scroll), middle-mouse and spacebar pan, keyboard shortcuts (Ctrl+O/=/- /0, arrows), and live status bar wired to Zustand store — completing all Phase 1 interaction contracts**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17
- **Completed:** 2026-04-17
- **Tasks:** 1 of 2 auto-completed (Task 2 is human-verify checkpoint)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `useViewportControls` hook: zoom-to-cursor on Ctrl+scroll, discrete ZOOM_STEPS stepping with float-safe tolerance, zoomIn/zoomOut from center, middle-mouse native event pan, spacebar toggle pan mode
- `useKeyboardShortcuts` hook: Ctrl+O (always), Ctrl+=/- (zoom), Ctrl+0 (fit), ArrowLeft/Right and PageUp/Down (navigation) — all gated on totalPages > 0 except Ctrl+O
- Toolbar wired: live zoom% from `getViewport(currentPage).zoom`, accent color `#0078d4` when zoom != 100%, ZoomIn/ZoomOut disabled at MIN/MAX bounds
- StatusBar wired: live `fileName`, `Page N of M`, `Zoom: X%` — all show `—` when no file loaded
- EmptyState drag-and-drop: FileReader reads file as ArrayBuffer, Electron `file.path` extracted for loadPdf call
- 17 new unit tests (zoom.test.ts: 8 tests; stage-transform.test.ts: 5 tests) — all 31 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Zoom-to-cursor, pan modes, keyboard shortcuts, and status bar wiring** - `ef4f5e1` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `src/renderer/src/hooks/useViewportControls.ts` - Zoom-to-cursor, zoomIn/zoomOut, middle-mouse pan, spacebar pan mode
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` - Global keyboard shortcut handler attached to window
- `src/renderer/src/components/CanvasViewport.tsx` - Integrates useViewportControls, exposes controls via getCanvasControls module ref
- `src/renderer/src/components/Toolbar.tsx` - Wired zoom buttons and live zoom% display via getCanvasControls
- `src/renderer/src/components/StatusBar.tsx` - Reads live fileName, page, and zoom from store
- `src/renderer/src/components/EmptyState.tsx` - Drag-and-drop PDF loading via FileReader + usePdfDocument
- `src/tests/zoom.test.ts` - 8 tests: zoom-to-cursor math, getNextZoomStep step selection
- `src/tests/stage-transform.test.ts` - 5 tests: fit-to-window scale calculation, pan persistence

## Decisions Made

- Module-level ref (`getCanvasControls`) chosen over React context for Toolbar access to canvas controls — avoids provider pyramid for single-window app
- Middle-mouse pan uses native DOM `mousedown`/`mouseup` on `stage.container()` — Konva mouse events don't reliably fire for middle-button drag initiation
- `stageRef.current` as `useEffect` dependency for Konva event listener attachment — necessary because stageRef.current is null until Stage mounts
- ZOOM_STEPS tolerance of 0.001 prevents float equality failures when current zoom is exactly at a step boundary

## Deviations from Plan

None - plan executed exactly as written. All files specified in the plan were created/modified with the exact content described. Implementation was pre-completed in commit `ef4f5e1` prior to this executor session.

## Issues Encountered

None — all tests pass, all acceptance criteria met.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 interaction contracts complete: zoom-to-cursor, pan, keyboard shortcuts, status bar, drag-and-drop
- All 31 Phase 1 unit tests passing (viewer-store, pdf-loader, page-nav, zoom, stage-transform)
- Task 2 (visual verification checkpoint) is pending human approval — `npm run dev` required to verify all interaction behaviors visually
- Phase 2 (markup tools) can begin after Task 2 visual verification is approved

---
*Phase: 01-pdf-viewer-and-canvas-foundation*
*Completed: 2026-04-17*
