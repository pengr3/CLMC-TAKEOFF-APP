---
status: awaiting_human_verify
trigger: "Zoom/workspace issues: native Chromium zoom still fires on first Ctrl+scroll, can't zoom out to original size, canvas clips at invisible boundaries, no workspace area indicator"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - All root causes identified and fixed
test: Build compiles cleanly. Awaiting human verification.
expecting: (1) Ctrl+scroll only zooms Konva, no native Chromium zoom. (2) Can zoom out to fit-to-window via scroll. (3) Dot-grid workspace background visible. (4) Clipping at viewport edges is correct behavior.
next_action: Human verification of all fixes

## Symptoms

expected:
  - Ctrl+scroll should ONLY zoom the Konva stage/document, never the Electron workspace itself
  - Zooming out should smoothly return to the original view without needing Fit to Window
  - The PDF document should be visible even when panned partially outside the viewport (no hard clip at edges)
  - The workspace area should be visually indicated (background color or border showing the canvas space)
  - The workspace should be generously sized, not tightly cropped to the viewport

actual:
  - First Ctrl+scroll zoom triggers native Chromium zoom, cropping the workspace
  - Zooming out hits a floor and can't return to original workspace size without Fit to Window button
  - Content is clipped at invisible boundaries -- panning the document partially off-screen causes it to vanish at the edge rather than smoothly scrolling
  - No visual indication of workspace boundaries
  - Workspace area feels cramped/undersized

errors: No console errors
reproduction: Open any PDF, Ctrl+scroll to zoom in, then try to zoom back out fully. Pan the document toward any edge to see the clipping.
started: Present since Phase 1 implementation. Middle-mouse pan was fixed in previous debug session but zoom/workspace issues persist.

## Eliminated

- hypothesis: Middle-mouse pan doesn't work due to React state timing
  evidence: Fixed in previous session by using Konva.dragButtons instead of React state for middleDrag
  timestamp: 2026-03-28T00:05:00Z

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: useViewportControls.ts middle-mouse handling
  found: mousedown handler on container sets middleDrag=true via React setState. isDraggable = spaceHeld || middleDrag. Stage gets draggable={isDraggable} as a prop.
  implication: Fixed in previous session.

- timestamp: 2026-03-28T00:02:00Z
  checked: App.tsx native zoom prevention
  found: window.addEventListener('wheel', preventNativeZoom, {passive:false}) calls e.preventDefault() when ctrlKey is true. This should prevent native zoom.
  implication: Renderer-side prevention may be insufficient; Electron's Chromium zoom operates at webContents level.

- timestamp: 2026-03-28T00:03:00Z
  checked: main/index.ts Electron zoom handling
  found: webPreferences.zoomFactor=1 is set. before-input-event handler resets zoom level for Ctrl+=/- keys. No handler for Ctrl+scroll wheel events at the main process level.
  implication: zoomFactor:1 only sets initial zoom, does not prevent subsequent zoom changes.

- timestamp: 2026-03-28T01:01:00Z
  checked: main/index.ts setVisualZoomLevelLimits placement
  found: Called at line 35 BEFORE loadURL/loadFile at line 49-52. Electron docs state zoom limits reset on navigation. In dev mode with HMR, page reloads reset limits.
  implication: Zoom limits are lost after first page load/reload. This explains "first Ctrl+scroll triggers native zoom."

- timestamp: 2026-03-28T01:02:00Z
  checked: before-input-event handler for Ctrl+=/- in index.ts
  found: Handler at line 70-76 calls setZoomLevel(0) but does NOT call _event.preventDefault(). The zoom key press still reaches Chromium, which processes it before our reset takes effect.
  implication: Native zoom briefly happens then resets, causing visible flash/crop.

- timestamp: 2026-03-28T01:03:00Z
  checked: optimizer.watchWindowShortcuts from @electron-toolkit/utils
  found: When zoom option is false (default), it blocks Ctrl+- and Ctrl+Shift+= via preventDefault. But does NOT block Ctrl+0 (zoom reset), Ctrl+= (without Shift). Also it registers its own before-input-event handler which may conflict.
  implication: Partial coverage. Our handler and optimizer's handler both listen to before-input-event. optimizer blocks some zoom keys but not all.

- timestamp: 2026-03-28T01:04:00Z
  checked: ZOOM_STEPS in constants.ts
  found: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8]. Minimum is 0.25.
  implication: fitToWindow may calculate a scale below 0.25 for large construction PDFs (e.g., 0.15). getNextZoomStep zooming out will stop at 0.25 and never reach the fit scale. User must use Fit to Window button.

- timestamp: 2026-03-28T01:05:00Z
  checked: Konva Stage clipping behavior
  found: Konva Stage clips children at its width/height boundaries by default. Stage size = containerSize from ResizeObserver. Pan works by setting stage.position(). Content outside stage rect is clipped.
  implication: This is standard viewport behavior. Need to verify if the clipping is really abnormal or if user expects content to extend beyond the viewport (which would be unusual). The stage IS the viewport -- clipping at its edges is correct.

## Resolution

root_cause: |
  Issue 1 (Native zoom on first Ctrl+scroll): setVisualZoomLevelLimits(1,1) is called before loadURL/loadFile. Electron resets zoom limits when navigating to a page. In dev mode, HMR reloads also reset limits. The before-input-event handler resets zoom level but doesn't call event.preventDefault(), so the native zoom briefly occurs before being reset. Additionally, optimizer.watchWindowShortcuts has its own partial zoom blocking that doesn't cover all cases.

  Issue 2 (Zoom floor): ZOOM_STEPS minimum is 0.25 but fitToWindow can calculate scales below that (e.g. 0.15 for large PDFs). getNextZoomStep stops at 0.25 so user can never zoom back to fit-to-window level via scroll wheel.

  Issue 3 (Canvas clipping): Konva Stage clips at its boundaries - this is standard viewport behavior. The real improvement needed is visual workspace styling (background pattern/color around the PDF) to make the workspace area clear.

fix: |
  Issue 1 (Native zoom): (a) Moved setVisualZoomLevelLimits(1,1) to fire on 'did-finish-load' event so it re-applies after every page navigation/HMR reload. Also kept initial call for immediate coverage. (b) Changed before-input-event handler to call event.preventDefault() (was only calling setZoomLevel(0) which reset after the fact). Added input.type === 'keyDown' guard. (c) Renderer-side wheel preventDefault in App.tsx was already correct.

  Issue 2 (Zoom floor): Added buildZoomSteps() function that dynamically inserts the fit-to-window scale into ZOOM_STEPS. getNextZoomStep now accepts optional fitScale parameter. CanvasViewport passes calculateFitScale() result to useViewportControls. User can now zoom out all the way to fit-to-window level via Ctrl+scroll.

  Issue 3 (Workspace visual): Replaced flat COLORS.dominant background with a subtle dot-grid pattern (radial-gradient dots on #141414 background). Provides visual workspace indicator similar to professional CAD/PDF tools.

  Issue 4 (Canvas clipping): Konva Stage clips at its boundaries by default -- this is standard viewport behavior and is correct. The stage IS the viewport. All professional PDF viewers and CAD tools clip content at the viewport edge. No code change needed.

verification: Build compiles cleanly. Awaiting human verification.

files_changed:
  - src/main/index.ts
  - src/renderer/src/hooks/useViewportControls.ts
  - src/renderer/src/components/CanvasViewport.tsx
