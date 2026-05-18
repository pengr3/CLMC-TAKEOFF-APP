---
slug: phase09-mmb-pan-lmb-rubber-band
created: 2026-05-18
status: diagnosed
symptoms:
  - Middle-mouse button (scroll wheel click) no longer pans the workspace
  - LMB drag in select mode does not draw rubber-band or select objects
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
---

# Root Cause Report

## Bug 1: MMB pan broken

**Root cause: `isDraggable=false` in select mode disables ALL Konva Stage drag, including MMB.**

Commit `b557a51` changed `useViewportControls.ts:177` from:
```ts
const isDraggable = true
```
to:
```ts
const isDraggable = spaceHeld || activeTool !== 'select'
```

In select mode (`activeTool === 'select'`, `spaceHeld === false`):
- `isDraggable = false || false = false`
- `draggable={false}` on the Stage — Konva drag system completely disabled
- Even though `Konva.dragButtons = [1]` (line 84) is still set, it is irrelevant when `draggable=false` — no drag of any kind can start

**The comment on line 176 is incorrect:**
> "Middle-mouse pan uses DOM listeners and is unaffected by isDraggable."

There are **no DOM listeners for MMB pan** in the codebase. The only container DOM listener (lines 165-170) calls `e.preventDefault()` on MMB to suppress the browser auto-scroll cursor — it does NOT implement pan. Konva Stage drag (`draggable=true` + `dragButtons=[1]`) was the sole MMB pan mechanism.

---

## Bug 2: LMB rubber-band drag does not select

**Root cause: stale closure in `handleStageMouseMove` causes rubber-band state to be missed on every update, producing a zero-size band that selects nothing.**

### Mechanism

`handleStageMouseMove` in `CanvasViewport.tsx:651` has `rubberBand` in its `useCallback` deps:

```ts
const handleStageMouseMove = useCallback(
  (_e) => {
    if (rubberBand) {      // reads STALE closure value
      setRubberBand(...)
      return
    }
    // ...
  },
  [..., rubberBand]        // recreated on every rubberBand state change
)
```

Sequence on LMB drag in select mode:

1. `mousedown` fires on Stage
2. `handleStageMouseDown` runs → `setRubberBand({startX, startY, endX, endY})`
   (state scheduled; old callback still registered on Konva Stage)
3. `mousemove` fires immediately — OLD `handleStageMouseMove` (rubberBand=null) → falls through to preview path → **no rubber-band update**
4. React commits the state change → react-konva swaps `stage.off / stage.on` with the new callback (rubberBand non-null)
5. Subsequent `mousemove` events fire with the new handler

However, each time `setRubberBand` is called in step 5, it triggers ANOTHER `useCallback` recreation and ANOTHER listener swap (off/on). Between each swap there is a brief window where the Stage has no `mousemove` listener, causing missed events on fast drags. The net effect is the rubber-band start and end coordinates are rarely updated, leaving a near-zero-size band on `mouseup` that matches no markup bboxes.

### Why b557a51 did not fix it

`b557a51` correctly diagnosed that `isDraggable=true` caused Konva's DD module to register a window-level `pointermove` that interfered with the Stage's `onMouseMove`. Setting `isDraggable=false` removes that window-level capture. BUT the stale-closure recreation issue (above) is independent of `isDraggable` — it exists in both states. The rubber-band was broken for two reasons; b557a51 fixed one and introduced a new bug (MMB pan), while the stale-closure issue remained.

---

## Files

| File | Line | Issue |
|------|------|-------|
| `src/renderer/src/hooks/useViewportControls.ts` | 177 | `isDraggable=false` in select mode — disables MMB pan |
| `src/renderer/src/hooks/useViewportControls.ts` | 84 | `dragButtons=[1]` correct but irrelevant when `draggable=false` |
| `src/renderer/src/components/CanvasViewport.tsx` | 651-672 | `handleStageMouseMove` stale-closure `rubberBand` — causes miss/stutter on every state update |

---

## Fix Direction (diagnose-only run — not applied)

### Fix A: Restore MMB pan

Revert `isDraggable` back to always-true in `useViewportControls.ts:177`:

```ts
const isDraggable = true
```

MMB pan works via Konva's `dragButtons=[1]` + `draggable=true`. Do not gate `isDraggable` on `activeTool`.

### Fix B: Stable rubber-band via useRef

Track live rubber-band state in a ref that event handlers always read from, keeping `useState` only for rendering. This eliminates the stale-closure/listener-swap cycle:

```ts
// In CanvasViewport.tsx — near other rubberBand state
const rubberBandRef = useRef<RubberBandState>(null)
const [rubberBand, setRubberBandState] = useState<RubberBandState>(null)

const setRubberBand = useCallback((val: RubberBandState) => {
  rubberBandRef.current = val
  setRubberBandState(val)
}, [])
```

In `handleStageMouseMove`, read from `rubberBandRef.current` and REMOVE `rubberBand` from deps:

```ts
const handleStageMouseMove = useCallback(
  (_e) => {
    const rb = rubberBandRef.current   // always current, no stale closure
    if (rb) {
      const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
      setRubberBand({ ...rb, endX: pt.x, endY: pt.y })
      return
    }
    // ... existing preview path unchanged
  },
  // rubberBand removed from deps
  [calibState.mode, calibState.startPoint, markupState.mode, markupState.points.length,
   stageRef, updatePreview, updateMarkupPreview]
)
```

`handleStageMouseUp` should also read `rubberBandRef.current` directly.

### Fix C: Prevent Konva DD from capturing the LMB pointerdown (re: original b557a51 concern)

With Fix A (`isDraggable=true`), Konva DD will again register a window-level `pointermove` on LMB `pointerdown`. Prevent this by stopping propagation before Konva DD sees it:

```ts
const handleStageMouseDown = useCallback(
  (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    if (activeTool !== 'select') return
    if (spaceHeld) return
    e.evt.stopPropagation()   // prevent Konva DD from registering window pointermove
    // ... rest unchanged
  },
  [activeTool, spaceHeld, stageRef]
)
```

With `e.evt.stopPropagation()`, Konva DD's `_mousedown` handler (registered at a different level) does not see the `pointerdown`, so no window-level listener is added, and the Stage's `onMouseMove` fires unimpeded.

---

## Summary Table

| Bug | Root cause | Location | Fix |
|-----|-----------|----------|-----|
| MMB pan broken | `isDraggable=false` disables all Konva Stage drag; no DOM-level MMB pan exists | `useViewportControls.ts:177` | Revert to `const isDraggable = true` |
| LMB rubber-band not selecting | Stale `rubberBand` closure causes `handleStageMouseMove` to miss state on every update; compounded by listener re-swap on each `setRubberBand` call | `CanvasViewport.tsx:651-672` | Track rubber-band in `useRef` for event handlers; remove `rubberBand` from `useCallback` deps |
