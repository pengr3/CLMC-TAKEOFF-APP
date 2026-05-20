---
slug: fix-rubber-band-click-clears-selection
status: complete
completed: 2026-05-18
commit: c37dec0
---

# Summary

Fixed three bugs preventing rubber-band multi-select from working.

## Root cause (Bug 1 — main)
Konva always fires `click` after `mouseup` when `Konva._mouseListenClick=true`. This
flag is only set to `false` when a Konva drag is active — rubber-band is NOT a Konva
drag. So after `handleStageMouseUp` called `setSelectedMarkupIds(...)`, Konva fired
`click`, `handleStageClick` saw `e.target===Stage` (empty canvas), and called
`clearSelection()`, immediately wiping the selection.

## Fixes applied
1. **`rubberBandDraggedRef`** (useRef) — set `true` in `handleStageMouseUp` when drag
   moved >4px. `handleStageClick` checks and clears it, skipping `clearSelection()`.
2. **Layer ordering** — moved rubber-band `<Rect>` from Layer 1a (below markup shapes)
   to its own `<Layer>` inserted after Layer 1b (above markups, below selection rings).
3. **Window mouseup cleanup** — `useEffect` registers `window.addEventListener('mouseup')`
   to call `setRubberBand(null)` if the user releases LMB outside the Stage canvas.
