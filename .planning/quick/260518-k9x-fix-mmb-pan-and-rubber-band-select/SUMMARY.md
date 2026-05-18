---
slug: k9x-fix-mmb-pan-and-rubber-band-select
status: complete
completed: 2026-05-18
commit: 0677d9d
duration: ~10min
files_modified: 2
---

# Summary: Fix MMB pan + LMB rubber-band select (phase 09 regressions)

## What changed

Two bugs introduced during phase 09-03 implementation, both fixed in a single atomic commit (`0677d9d`).

**Fix A — `useViewportControls.ts:173-177`**  
Reverted `isDraggable` back to `const isDraggable = true`. Commit `b557a51` had set it to `spaceHeld || activeTool !== 'select'`, which evaluates to `false` in select mode — disabling ALL Konva Stage drag including MMB pan. Removed the incorrect comment that claimed "DOM listeners" handle MMB pan (no such listeners existed).

**Fix B — `CanvasViewport.tsx` rubber-band ref pattern**  
Added `rubberBandRef = useRef<RubberBandState>(null)` alongside the existing `rubberBand` useState. Extracted a stable `setRubberBand` wrapper (useCallback, no deps) that updates both ref and state. Updated `handleStageMouseMove` and `handleStageMouseUp` to read `rubberBandRef.current` instead of the stale closure value, and removed `rubberBand` from both callbacks' useCallback deps. This eliminates the listener-swap cycle (stage.off/on on every state change) that caused move events to be consistently missed.

**Fix C — `CanvasViewport.tsx:handleStageMouseDown`**  
Added `e.evt.stopPropagation()` before `setRubberBand` when rubber-band conditions are met (LMB, select mode, no spacebar). Prevents Konva DD from registering a window-level `pointermove` interceptor now that `isDraggable=true` is restored.

## Verification

- `npm run typecheck` — exit 0
- `npx vitest run` — 473 tests / 66 files, all pass
- ESLint baseline unchanged (no new errors introduced)
