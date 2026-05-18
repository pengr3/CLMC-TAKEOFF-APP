---
slug: k9x-fix-mmb-pan-and-rubber-band-select
created: 2026-05-18
status: in-progress
debug-report: .planning/debug/phase09-mmb-pan-lmb-rubber-band.md
---

# Fix: MMB pan broken + LMB rubber-band not selecting (phase 09 regressions)

## Task

Three targeted fixes for two bugs introduced during phase 09-03 implementation:

1. **Bug 1** — Middle-mouse button (scroll wheel click) no longer pans the workspace  
2. **Bug 2** — LMB drag in select mode does not draw rubber-band or select objects

## Changes

### Fix A — `src/renderer/src/hooks/useViewportControls.ts:173-177`

Revert `isDraggable` back to always-true. Konva MMB pan requires `draggable=true`; the b557a51 fix disabled ALL drag by returning false in select mode.

Remove incorrect comment ("Middle-mouse pan uses DOM listeners...") — no such listeners exist.

```diff
-  // In 'select' mode (no spacebar) disable Stage drag so Konva does not absorb
-  // pointermove events at the window level — that would prevent the rubber-band
-  // onMouseMove handler in CanvasViewport from receiving LMB drag events.
-  // Middle-mouse pan uses DOM listeners and is unaffected by isDraggable.
-  const isDraggable = spaceHeld || activeTool !== 'select'
+  // Stage is always draggable. Konva.dragButtons (above) controls which buttons
+  // are allowed to start a drag. MMB pan requires draggable=true.
+  const isDraggable = true
```

### Fix B — `src/renderer/src/components/CanvasViewport.tsx` (rubber-band ref pattern)

Add a `useRef` to track the live rubber-band value so event handlers don't need the stale closure. Keep `useState` for rendering. Extract a `setRubberBand` wrapper that updates both.

- Near line 290: add `rubberBandRef`, wrap the setter
- `handleStageMouseMove`: read `rubberBandRef.current`, remove `rubberBand` from deps
- `handleStageMouseUp`: read `rubberBandRef.current`, remove `rubberBand` from deps

### Fix C — `src/renderer/src/components/CanvasViewport.tsx:handleStageMouseDown`

Add `e.evt.stopPropagation()` when rubber-band conditions are met to prevent Konva DD from registering a window-level `pointermove` interceptor that would swallow events.

## Verification

- `npm run typecheck` must exit 0
- `npx vitest run` must pass all tests (baseline: 473 tests / 66 files)
- ESLint error count must not increase above baseline (21 errors in modified files)
