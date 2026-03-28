---
phase: 01-pdf-viewer-and-canvas-foundation
plan: 03
subsystem: ui
tags: [konva, zoom, pan, keyboard-shortcuts, zustand, react, typescript]

# Dependency graph
requires:
  - phase: 01-02
    provides: PDF.js rendering, Konva canvas viewport, page navigation, viewer store
provides:
  - Zoom-to-cursor keeping point fixed under cursor at all zoom levels (0.25x-8x)
  - Middle-mouse-button pan and spacebar+left-click pan modes
  - Keyboard shortcuts (Ctrl+O, arrows/PageUp/PageDown, Ctrl+=/-, Ctrl+0)
  - Live status bar showing filename, page number, and zoom percentage
  - Toolbar zoom controls with discrete zoom steps and fit-to-window
  - Drag-and-drop PDF loading on empty state
  - Module-level canvas control pattern for cross-component communication
affects: [02-scale-calibration, 03-markup-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [zoom-to-cursor-affine-transform, module-level-callback-ref, spacebar-pan-mode, middle-mouse-pan, discrete-zoom-steps]

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
  - "Module-level ref pattern for canvas controls instead of React context or Zustand function refs"
  - "Discrete zoom steps [0.25..8] with snapping rather than continuous zoom for predictable behavior"
  - "DOM event listeners for middle-mouse pan (not Konva events) to avoid drag conflicts"

patterns-established:
  - "Zoom-to-cursor: compute stage-space point under pointer, apply new scale, reposition stage so same point stays under pointer"
  - "Module-level callback ref: CanvasViewport populates _canvasControls, Toolbar reads via getCanvasControls()"
  - "Spacebar pan: toggle stage.draggable via keydown/keyup, update cursor style"

requirements-completed: [PDF-03, PDF-04, PDF-06]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 1 Plan 3: Zoom, Pan, Shortcuts, and Status Bar Summary

**Zoom-to-cursor with discrete steps, middle-mouse and spacebar pan, full keyboard shortcuts, and live status bar wiring completing all Phase 1 interaction contracts**

## Performance

- **Duration:** 3 min (code already committed from prior session; verification and docs only)
- **Started:** 2026-03-28T07:15:57Z
- **Completed:** 2026-03-28T07:20:00Z
- **Tasks:** 1 (Task 1 auto)
- **Files modified:** 8

## Accomplishments
- Zoom-to-cursor keeps the point under the cursor fixed at all zoom levels from 25% to 800%
- Middle-mouse drag and spacebar+left-click drag both pan the canvas with correct cursor feedback
- Full keyboard shortcut set: Ctrl+O (open), arrows/PageUp/PageDown (page nav), Ctrl+=/- (zoom), Ctrl+0 (fit)
- Status bar displays live filename (truncated with ellipsis), page counter, and zoom percentage
- Toolbar zoom buttons wired with disable states at min/max zoom and accent-colored zoom text when not at 100%
- Drag-and-drop PDF loading on the empty state card via FileReader
- 31 total tests passing across 5 test files (zoom math, stage transforms, viewer store, PDF loader, page nav)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement zoom-to-cursor, pan modes, keyboard shortcuts, and status bar wiring** - `ef4f5e1` (feat)

## Files Created/Modified
- `src/renderer/src/hooks/useViewportControls.ts` - Zoom-to-cursor math, wheel handler, spacebar/middle-mouse pan, zoomIn/zoomOut functions
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` - Global keyboard shortcut handler for Ctrl+O, arrows, zoom keys
- `src/renderer/src/components/CanvasViewport.tsx` - Integrated viewport controls hook, wheel handler, cursor states, module-level controls ref
- `src/renderer/src/components/Toolbar.tsx` - Wired zoom buttons to canvas controls, live zoom percentage display with accent color
- `src/renderer/src/components/StatusBar.tsx` - Live filename, page counter, zoom percentage from store
- `src/renderer/src/components/EmptyState.tsx` - Drag-and-drop handler reading file as ArrayBuffer via FileReader
- `src/tests/zoom.test.ts` - Zoom-to-cursor math tests and zoom step selection tests
- `src/tests/stage-transform.test.ts` - Fit-to-window calculation and pan persistence tests

## Decisions Made
- Used module-level ref pattern (`_canvasControls` / `getCanvasControls()`) instead of React context or Zustand for passing zoom/fit functions from CanvasViewport to Toolbar. Simpler than context, avoids storing function refs in Zustand.
- Middle-mouse pan uses DOM event listeners on the Konva container rather than Konva's own event system, avoiding conflicts with Konva's built-in drag behavior.
- Discrete zoom steps with 0.001 tolerance for float comparison rather than continuous zoom, giving predictable behavior matching CAD tool conventions.

## Deviations from Plan

None - plan executed exactly as written. All code was already committed in a prior session (`ef4f5e1`).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 code is complete: PDF rendering, page navigation, zoom/pan, keyboard shortcuts, status bar all working
- Task 2 (human-verify checkpoint) remains for visual verification of the complete Phase 1 viewer
- Phase 2 (Scale Calibration) can begin after visual verification passes
- The Konva Stage coordinate system and viewport controls provide the foundation for scale calibration line drawing

## Self-Check: PASSED

- All 8 created/modified files verified present on disk
- Task commit ef4f5e1 verified in git log
- All 31 tests passing across 5 test files

---
*Phase: 01-pdf-viewer-and-canvas-foundation*
*Completed: 2026-03-28*
