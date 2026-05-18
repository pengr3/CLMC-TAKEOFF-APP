---
slug: fix-rubber-band-click-clears-selection
created: 2026-05-18
status: in-progress
phase: 09
---

# Fix: Rubber-band multi-select click-clears-selection bug

## Root Cause

Three bugs prevent rubber-band multi-select from working:

### Bug 1 (MAIN — functional): Click handler clears selection immediately
After `handleStageMouseUp` sets `selectedMarkupIds` from the rubber-band, Konva fires
a `click` event because `Konva._mouseListenClick=true` (only set to false when a Konva
drag is active — rubber-band is NOT a Konva drag). `handleStageClick` fires,
`e.target === stageRef.current` (pointer released on empty canvas), `clearSelection()`
is called, wiping the selection set 1 render earlier. Net result: rubber-band appears
to "not select anything."

### Bug 2 (visual): Rubber-band rect in wrong Konva layer
The rubber-band `<Rect>` is in Layer 1a which renders BELOW Layer 1b (markup shapes).
Markup shapes cover the rubber-band rectangle, making it invisible when dragging over
existing markups. Must move rubber-band to a layer above Layer 1b.

### Bug 3 (edge case): No window-level mouseup cleanup
If the user releases LMB outside the Stage canvas, `handleStageMouseUp` never fires.
The rubber-band rect stays rendered indefinitely. Need a window-level mouseup to clean up.

## Fix

File: `src/renderer/src/components/CanvasViewport.tsx`

1. Add `rubberBandDraggedRef = useRef(false)` near `rubberBandRef` (line ~292).
2. In `handleStageMouseUp`: only compute selection when mouse moved >4px; set
   `rubberBandDraggedRef.current = true` when a real drag occurred.
3. In `handleStageClick`: check `rubberBandDraggedRef.current`; if true reset it
   and return early (skip `clearSelection()`).
4. Move rubber-band `<Rect>` from Layer 1a to a new `<Layer listening={false}>` 
   inserted after Layer 1b (above markup shapes, below selection rings).
5. Add `useEffect` with window `mouseup` listener that calls `setRubberBand(null)`
   to clean up stuck rubber-band when released outside canvas.
