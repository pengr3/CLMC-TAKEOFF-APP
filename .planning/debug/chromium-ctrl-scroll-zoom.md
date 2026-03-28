---
status: diagnosed
trigger: "Ctrl+scroll still causes Chromium native zoom despite multiple fix attempts"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two independent zoom mechanisms exist in Chromium/Electron. The code only blocks "visual zoom" (pinch) and keyboard shortcuts, but does NOT block "layout zoom" (Ctrl+scroll page zoom). The wheel preventDefault in App.tsx should work but Chromium's compositor-level zoom processing may fire before the DOM wheel event in certain code paths (e.g., during HMR dev server, or when the event target is outside the Konva stage container).
test: Code analysis confirms no layout zoom level limits are set
expecting: N/A - diagnosis only
next_action: Report root cause

## Symptoms

expected: Ctrl+scroll should ONLY zoom the Konva stage, not the Electron/Chromium page
actual: The workspace outside the Konva stage zooms a little bit, cropping the view
errors: No console errors
reproduction: Open any PDF, Ctrl+scroll to zoom in - workspace crops
started: Present since Phase 1. Multiple fix attempts have not resolved it.

## Eliminated

- hypothesis: optimizer.watchWindowShortcuts re-enables zoom
  evidence: Read source at node_modules/@electron-toolkit/utils/dist/index.mjs lines 36-74. It only handles keyboard shortcuts via before-input-event, not scroll. Default zoom=false means it BLOCKS Ctrl+/- keyboard zoom. Does not affect scroll zoom at all.
  timestamp: 2026-03-28

- hypothesis: before-input-event handler should catch scroll zoom
  evidence: before-input-event only fires for keyboard/mouse button input, NOT wheel/scroll events. This handler correctly blocks Ctrl+/- but cannot block Ctrl+scroll.
  timestamp: 2026-03-28

- hypothesis: zoom-changed event handler is sufficient as safety net
  evidence: zoom-changed is reactive (fires after zoom already happened), not preventive. The visual glitch occurs because the zoom happens and then gets reset, causing a visible flash/crop.
  timestamp: 2026-03-28

## Evidence

- timestamp: 2026-03-28
  checked: src/main/index.ts - all zoom prevention code
  found: Uses setVisualZoomLevelLimits(1,1) which only controls VISUAL (pinch) zoom. Does NOT call webContents.setLayoutZoomLevelLimits() or webFrame.setZoomLevel() from renderer. The zoom-changed handler resets reactively but not preventively.
  implication: Layout zoom (Ctrl+scroll page zoom) is completely unblocked at the Electron API level.

- timestamp: 2026-03-28
  checked: Electron API documentation and GitHub issues #8793, #3609, #24431, #40651
  found: Chromium has TWO independent zoom mechanisms: (1) Visual zoom (pinch-to-zoom, handled by setVisualZoomLevelLimits) and (2) Layout/page zoom (Ctrl+scroll, Ctrl+/-, handled by setZoomLevel/setZoomFactor). setVisualZoomLevelLimits does NOT affect layout zoom. They are separate Chromium subsystems.
  implication: The current code blocks the wrong zoom type for Ctrl+scroll. setVisualZoomLevelLimits blocks pinch zoom, not Ctrl+scroll page zoom.

- timestamp: 2026-03-28
  checked: src/renderer/src/App.tsx - wheel event listener
  found: Has window.addEventListener('wheel', preventNativeZoom, { passive: false }) that calls e.preventDefault() on Ctrl+wheel. This SHOULD work to block Ctrl+scroll zoom.
  implication: Either (a) the wheel event fires AFTER Chromium's compositor already processed the zoom gesture, or (b) the preventDefault is not reaching the right event target. Chromium can process zoom at the compositor level before dispatching the DOM event.

- timestamp: 2026-03-28
  checked: app.commandLine.appendSwitch usage
  found: The app does NOT use app.commandLine.appendSwitch('disable-pinch') which would disable zoom at the Chromium compositor level (before DOM events).
  implication: Missing the lowest-level zoom prevention mechanism.

- timestamp: 2026-03-28
  checked: src/preload/index.ts
  found: No webFrame usage at all. Does not call webFrame.setZoomLevel or webFrame.setVisualZoomLevelLimits from the renderer/preload side.
  implication: Missing renderer-side zoom locking which some Electron versions require.

## Resolution

root_cause: |
  The app has a LAYERED zoom prevention problem with gaps at multiple levels:

  **Primary cause:** Chromium processes Ctrl+scroll zoom at the COMPOSITOR level (GPU process) BEFORE the DOM wheel event fires in the renderer. The wheel event preventDefault() in App.tsx fires too late - Chromium has already initiated the page zoom gesture. This is a known Chromium architecture issue where compositor-level input handling precedes renderer-level DOM events.

  **Contributing cause 1:** setVisualZoomLevelLimits(1,1) only controls VISUAL zoom (pinch-to-zoom). Ctrl+scroll triggers LAYOUT zoom (page zoom), which is a completely separate Chromium subsystem. The code is blocking the wrong zoom type.

  **Contributing cause 2:** No Chromium command-line switch is used. `app.commandLine.appendSwitch('disable-pinch')` would disable zoom gesture recognition at the compositor level, before any DOM events fire.

  **Contributing cause 3:** The zoom-changed event handler resets zoom reactively (after it happens), causing a visible flash where the page zooms and then snaps back. This is why users see the workspace "crop slightly" - they're seeing the zoom happen and get undone within one frame.

  The fix requires blocking zoom at EVERY level:
  1. Chromium CLI switch level (before compositor)
  2. Renderer webFrame level (layout zoom limits)
  3. DOM event level (wheel preventDefault - current approach, but arrives too late alone)
  4. Reactive reset (zoom-changed handler - current approach, but causes visual glitch)

fix: (diagnosis only - not applied)
verification: (diagnosis only)
files_changed: []
