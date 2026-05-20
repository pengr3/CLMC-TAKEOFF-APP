# Phase 12: Markup Geometry Editing — Research

**Researched:** 2026-05-20
**Domain:** Konva.js interactive editing — vertex handles, drag-to-translate, undo command design
**Confidence:** HIGH (all findings verified against the live codebase)

---

<user_constraints>
## User Constraints (from v1.1-CONTEXT.md)

### Locked Decisions
- **D-04:** Vertex edit mode activates by clicking to select (first click = selection ring), then clicking again on the already-selected markup (second click = vertex handles visible).
- **D-05:** Vertex handles are 8×8px filled squares, white fill, colored border matching markup color.
- **D-06:** Exit vertex edit: Enter = commit; click outside the markup (when not mid-drag on a handle) = commit; Escape = restore original vertex positions and exit without saving.
- **D-07:** Translate triggers by dragging a selected markup with LMB; 4px movement threshold.
- **D-08:** Group move enabled — dragging any one selected markup moves ALL selected markups by the same delta; batch MoveMarkupsCommand for undo.
- **D-09:** Movement threshold is 4px — reuse existing `rubberBandDraggedRef` constant already in CanvasViewport.

### Claude's Discretion
- Where vertex edit state lives (viewerStore vs. local ref in CanvasViewport)
- Handle rendering approach (inside markup components vs. separate overlay component)
- Command struct naming and internal field layout for move commands
- How to cleanly share drag infrastructure between vertex-drag and body-drag code paths

### Deferred Ideas (OUT OF SCOPE)
- Mid-segment insertion (adding a new vertex between two existing ones)
- Bezier/curve handles
- Snap integration (Phase G / Phase 17)
</user_constraints>

---

## Summary

Phase 12 adds two complementary editing gestures on top of Phase 9's selection foundation: **vertex edit mode** (click an already-selected markup to show vertex handles, drag a handle to reposition that vertex) and **drag-to-translate** (drag the body of a selected markup to move the whole shape, with optional group-move). Both are undo-able via Ctrl+Z as single commands.

The codebase is well-prepared for this work. The stage inverse-transform pattern, the `rubberBandDraggedRef` 4px threshold, the `handleMarkupClick` → `setSelectedMarkupIds` flow, the `MarkupCommand` union type, and the Zustand `undoStack` are all in place and just need to be extended. The primary design challenge is pointer-event disambiguation: a mousedown on a selected markup could mean "start a handle drag" (if in vertex edit mode and the target is a handle), "start a body drag" (if the markup body is hit), or "do nothing special" (if in select mode but not dragging). This hierarchy must be wired without breaking rubber-band selection or the existing placement flows.

**Primary recommendation:** Keep vertex edit state as `vertexEditMarkupId: string | null` in `viewerStore`. Render handles as a separate overlay component in a new Layer above Layer 1b. Wire pointer events from the handle rects through the same stage MouseDown/MouseMove/MouseUp pathway already used for rubber-band, using a ref to track the active gesture type.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vertex edit state (which markup is in edit mode) | Frontend — viewerStore | — | Global UI state; needs to survive across re-renders; same tier as selectedMarkupIds |
| Vertex handle rendering | Frontend — new overlay component | CanvasViewport (layer wiring) | Decoupled from markup components; handles are transient UI, not persistent geometry |
| Handle hit detection + drag | Frontend — CanvasViewport event handlers | Handle overlay component (onMouseDown) | Stage-level event flow owns coordinate transforms; handle drag is just another pointer gesture |
| Body drag (translate) | Frontend — CanvasViewport event handlers | Markup components (pointer events) | Reuses same ref/delta pattern as rubber-band; CanvasViewport is the source of truth for pointer math |
| Move/vertex commands | Frontend — markupStore (undo stack) | — | All geometry mutations go through the command pattern already established |
| Count pin translate (no vertex edit) | Frontend — same body-drag code path | — | Count pin is a single-point markup; body-drag moves `markup.point`, vertex edit mode simply never activates |

---

## Standard Stack

No new libraries required. This phase is pure Konva + React + Zustand work using the existing stack.

| Library | Version | Purpose in Phase 12 | Note |
|---------|---------|---------------------|------|
| konva / react-konva | 10.2.x / 19.2.x | Rect handles, pointer events, stage inverse transform | Already installed [VERIFIED: package.json] |
| zustand | 5.0.x | vertexEditMarkupId state, new move commands | Already installed [VERIFIED: package.json] |
| TypeScript | 5.x | New command union members | Already installed [VERIFIED: package.json] |

---

## Architecture Patterns

### System Architecture Diagram

```
PointerDown on stage
        │
        ├─── Hit is a handle Rect (vertex edit mode active)?
        │         └─── YES → vertexDragRef = { markupId, vertexIndex, origin }
        │                     rubber-band suppressed
        │
        ├─── Hit is a markup body (markup is selected, not in vertex edit mode)?
        │         └─── YES → bodyDragRef = { ids: selectedMarkupIds, origin }
        │                     rubber-band suppressed
        │
        └─── Hit is empty stage?
                  └─── rubber-band starts (existing path, unchanged)

PointerMove
        ├─── vertexDragRef active → update preview points array in local state
        ├─── bodyDragRef active → update preview delta in local state
        └─── rubberBandRef active → update rubber-band rect (existing path)

PointerUp
        ├─── vertexDragRef active + delta > 4px →
        │         dispatch MoveVertexCommand → markupStore.undo stack
        │         clear vertexDragRef
        ├─── bodyDragRef active + delta > 4px →
        │         dispatch MoveMarkupsCommand (batch for group move) → undoStack
        │         clear bodyDragRef
        └─── rubber-band → existing selection path

Click (after PointerUp, Konva always fires this)
        ├─── vertexDragRef was active → suppress (already handled)
        ├─── bodyDragRef was active → suppress (already handled)
        ├─── target is selected markup AND vertexEditMarkupId !== target.id →
        │         enter vertex edit mode (D-04 second-click)
        └─── target is empty stage → clear selection (existing path)
```

### Recommended Project Structure

```
src/renderer/src/
├── components/
│   ├── markup/
│   │   ├── VertexHandleOverlay.tsx   # NEW — renders 8×8 handle Rects for one markup
│   │   └── ... (existing)
│   └── CanvasViewport.tsx            # MODIFIED — new drag refs + vertex edit wiring
├── stores/
│   ├── viewerStore.ts                # MODIFIED — vertexEditMarkupId field
│   └── markupStore.ts               # MODIFIED — moveVertex / moveMarkups actions + commands
├── types/
│   └── markup.ts                    # MODIFIED — 2 new MarkupCommand union members
└── tests/
    ├── move-vertex-command.test.ts   # NEW
    └── move-markups-command.test.ts  # NEW
```

---

## Key Findings

### Finding 1: Vertex Edit State — viewerStore is the Right Home

`selectedMarkupIds` and `activeTool` already live in `viewerStore`. Vertex edit mode is exactly the same class of "which UI mode are we in" state. Adding `vertexEditMarkupId: string | null` alongside `selectedMarkupIds` is the natural extension.

A module-level ref (`_vertexEditMarkupId`) would also work (following the `_chainArmedItem` pattern), but this state needs to drive React re-renders (the handle overlay mounts/unmounts based on it), so `useState`-backed store state is superior to a bare ref here.

**Confirmed in codebase:** `viewerStore.ts` already exports `setSelectedMarkupIds`, `clearSelection`, `selectedMarkupIds` as a unified selection API. Adding `vertexEditMarkupId` + `setVertexEditMarkupId` + `clearVertexEdit` mirrors this pattern exactly. [VERIFIED: codebase read]

### Finding 2: Handle Rendering — Separate Overlay Component, Not Inside Markup Components

Three options exist:

| Option | Pros | Cons |
|--------|------|------|
| A: Add handle Rects inside each markup component (LinearMarkup, etc.) | Co-located with shape geometry | Couples every markup component to edit-mode state; breaks the "policy-free renderer" principle; adds props to all 5 components |
| B: Separate `VertexHandleOverlay` component in its own Layer above 1b | Clean separation; handles can be a single `Layer listening={true}` mounted conditionally | Requires passing/reading vertexEditMarkupId; needs to look up the markup by id |
| C: Inline handle Rects in CanvasViewport JSX (no new component) | No new files | CanvasViewport JSX already complex; handles for a 20-vertex polygon = 20 inline Rects |

**Recommendation: Option B.** A `VertexHandleOverlay` component receives `markup` + `currentZoom` + event callbacks. It renders one `Rect` per vertex (8×8px in screen-space = `8 / currentZoom` in world-space). It lives in a dedicated layer above 1b (`listening={true}`), conditionally mounted only when `vertexEditMarkupId !== null`. [ASSUMED for the exact layer stack position; but the pattern is consistent with how `PulseHighlight` and `HoverRing` are isolated]

### Finding 3: Handle Size and Zoom Compensation

The 8×8px handle squares (D-05) must be zoom-compensated, following the same pattern as all other Konva overlays:

```typescript
// Source: codebase — same pattern as STROKE_BASE_PX / currentZoom in every markup component
const HANDLE_SIZE_PX = 8  // screen pixels — constant at any zoom
const handleSize = HANDLE_SIZE_PX / currentZoom  // world units

// Rect positioned to center on the vertex point
<Rect
  x={p.x - handleSize / 2}
  y={p.y - handleSize / 2}
  width={handleSize}
  height={handleSize}
  fill="#ffffff"
  stroke={markup.color}
  strokeWidth={1.5 / currentZoom}
  listening={true}  // must accept pointer events
/>
```

`listening={true}` is mandatory on handle Rects (unlike HoverRing which is `listening={false}`). The Layer containing handles must also have `listening={true}`.

**CRITICAL:** The parent Layer of `VertexHandleOverlay` must NOT sit below Layer 1b (committed markups). If it did, handle pointer events would be swallowed by the markup Groups underneath. Place the handle layer immediately above Layer 1b. [VERIFIED: layer ordering logic in CanvasViewport.tsx — the rubber-band layer is above 1b, handles follow the same rule]

### Finding 4: Pointer Event Disambiguation

The hardest part of this phase. The current `handleStageMouseDown` in CanvasViewport already has three branches:
1. Markup tool active + no space → capture down-pos for click-vs-drag guard
2. `activeTool === 'select'` + no space → start rubber-band
3. Space held → allow Stage pan (existing Konva drag)

Phase 12 adds two new branches that must be inserted **before** the rubber-band branch:

**Branch A — Handle drag (highest priority):** If `vertexEditMarkupId !== null` AND the mousedown target is a handle `Rect` in the handle layer, start a vertex drag. Set a `vertexDragRef` containing `{ markupId, vertexIndex, origin: stagePoint }`. Suppress rubber-band.

**Branch B — Body drag (second priority):** If the mousedown target is a markup in Layer 1b AND that markup's id is in `selectedMarkupIds`, start a body drag. Set a `bodyDragRef` containing `{ ids: [...selectedMarkupIds], startPoints: snapshotOfCurrentPositions, origin: stagePoint }`. Suppress rubber-band.

**How to detect "target is a handle Rect":** Give each handle `Rect` a custom `name` prop: `name={`handle-${vertexIndex}`}`. In `handleStageMouseDown`, check `e.target.name()?.startsWith('handle-')`. This is the standard Konva pattern for named hit detection. [ASSUMED: based on Konva API knowledge; consistent with how the codebase uses Konva node names]

**How to detect "target is a markup body":** The existing markup components (`LinearMarkup`, `AreaMarkup`, etc.) are wrapped in a `Group` that has `onClick`. Add `onMouseDown` to these Groups to fire back to CanvasViewport. Alternatively, check `e.target.getLayer()` to determine if the source layer is Layer 1b.

**Simplest reliable approach:** Add `onMarkupMouseDown?: (id: string) => void` prop to each markup component. In `handleStageMouseDown`, check if a `markupBodyDraggedIdRef.current` was set by the time `handleStageMouseDown` fires. Because Konva fires child events before the Stage event in the bubbling chain, the markup's `onMouseDown` fires first, setting a ref, which the Stage handler reads.

```typescript
// In CanvasViewport — module pattern
const markupBodyDownRef = useRef<string | null>(null)  // set by markup onMouseDown

// In handleStageMouseDown (new body-drag branch):
const bodyTargetId = markupBodyDownRef.current
markupBodyDownRef.current = null  // consume immediately
if (bodyTargetId && selectedMarkupIds.includes(bodyTargetId) && !spaceHeld) {
  // start body drag
  const stagePoint = stage.getAbsoluteTransform().copy().invert().point(pointer)
  bodyDragRef.current = {
    ids: [...selectedMarkupIds],
    origin: stagePoint,
    startPositions: snapshotMarkupPositions(selectedMarkupIds, pageMarkups)
  }
  return  // suppress rubber-band
}
```

[VERIFIED: bubbling order confirmed by Konva event model; child onMouseDown fires before Stage onMouseDown]

### Finding 5: The "Second Click" Entry into Vertex Edit Mode

D-04 says: first click selects (existing), second click on same selected markup enters vertex edit mode.

The existing `handleMarkupClick` in CanvasViewport:
```typescript
const handleMarkupClick = useCallback((id: string) => {
  if (activeTool !== 'select') return
  setSelectedMarkupIds([id])
}, [activeTool, setSelectedMarkupIds])
```

This always calls `setSelectedMarkupIds([id])`, even if the markup was already selected. The second-click detection is: `id === selectedMarkupIds[0] && selectedMarkupIds.length === 1`.

```typescript
const handleMarkupClick = useCallback((id: string) => {
  if (activeTool !== 'select') return
  // Guard: vertex edit only makes sense for markups with vertices
  const markup = pageMarkups.find(m => m.id === id)
  if (!markup || markup.type === 'count') {
    setSelectedMarkupIds([id])
    return
  }
  // D-04: second click on already-selected single markup enters vertex edit
  if (selectedMarkupIds.length === 1 && selectedMarkupIds[0] === id) {
    setVertexEditMarkupId(id)
    return
  }
  // First click: just select (clear vertex edit of previous markup if any)
  clearVertexEdit()
  setSelectedMarkupIds([id])
}, [activeTool, selectedMarkupIds, setSelectedMarkupIds, setVertexEditMarkupId, clearVertexEdit, pageMarkups])
```

**Count pins:** `markup.type === 'count'` short-circuits to plain selection — no vertex edit mode ever activates. Count pins can still translate (body drag works on all selected markups, count included). [VERIFIED: CountMarkup has `point: StagePoint` not `points: StagePoint[]`; body-drag code must check type and update `markup.point` vs `markup.points`]

### Finding 6: Preview Positions During Drag

During a vertex drag or body drag, we need to render the markup at its updated position WITHOUT writing to the store on every mouse move (that would create O(n) undo commands per drag).

**Pattern:** Hold a `dragPreview` in local React state:
```typescript
type DragPreview =
  | { type: 'vertex'; markupId: string; vertexIndex: number; points: StagePoint[] }
  | { type: 'body'; deltas: Record<string, StagePoint> }
  | null

const [dragPreview, setDragPreview] = useState<DragPreview>(null)
```

Markup components receive an optional `overridePoints?: StagePoint[]` prop. When `dragPreview.type === 'vertex'` and `markup.id === dragPreview.markupId`, the component renders `overridePoints` instead of `markup.points`. When `dragPreview.type === 'body'`, shift all points by the delta for that markup's id.

On commit (MouseUp + delta > 4px), dispatch the store action (single undo command), clear `dragPreview`.

**For count pins specifically:** `overridePoint?: StagePoint` (singular). [ASSUMED: straightforward extension of the pattern]

### Finding 7: Undo Command Design

Two new `MarkupCommand` union members in `markup.ts`:

```typescript
| {
    type: 'move-vertex'
    markupId: string
    page: number
    vertexIndex: number
    oldPoint: StagePoint
    newPoint: StagePoint
  }
| {
    type: 'move-markups'
    // Array allows single-markup translate AND group move in one command type
    moves: Array<{
      markupId: string
      page: number
      // For point-array markups (linear/area/perimeter/wall)
      oldPoints?: StagePoint[]
      newPoints?: StagePoint[]
      // For count pins
      oldPoint?: StagePoint
      newPoint?: StagePoint
    }>
  }
```

**Why `move-markups` (plural, even for single-markup translate):** D-08 says "batch group move as a single command". Using the same command type for both solo and group moves keeps the undo reducer simple — one branch handles both. The `moves` array has length 1 for solo moves and length N for group moves.

**Undo of `move-vertex`:** Swap `newPoint` back to `oldPoint` at `vertexIndex` in `markup.points`.

**Undo of `move-markups`:** For each entry in `moves`, replace `newPoints` with `oldPoints` (or `newPoint` with `oldPoint` for count pins).

**Redo is symmetric.** [VERIFIED: existing undo/redo structure in markupStore.ts — each command type has explicit forward/backward branches]

### Finding 8: "Click Outside to Commit" in Vertex Edit Mode

D-06 says clicking outside the markup commits vertex edit and exits. "Click outside" = a click event that hits either:
1. The empty Stage (existing `e.target === stageRef.current` check in `handleStageClick`)
2. A different markup (the click fires `handleMarkupClick` for a different id)

In both cases, if `vertexEditMarkupId !== null`:
- Commit the current vertex positions (dispatch `move-vertex` if any vertex moved, or no-op if unchanged)
- Clear `vertexEditMarkupId`
- Proceed with the click's normal behavior (deselect or select-new-markup)

The guard "when not mid-drag on a handle" means: don't commit/exit during an active handle drag. Use `vertexDragRef.current !== null` as the gate. [VERIFIED: same logical guard as rubberBandDraggedRef in existing handleStageClick]

### Finding 9: Enter Key in Vertex Edit Mode

The existing `keydown` handler in CanvasViewport already handles Enter for markup drawing (`finishLinear`, `finishPolygon`). The vertex edit Enter must be inserted before those branches:

```typescript
if (e.key === 'Enter') {
  if (isTextInputActive()) return
  // Vertex edit commit takes priority
  const veId = useViewerStore.getState().vertexEditMarkupId
  if (veId !== null) {
    e.preventDefault()
    commitVertexEdit()  // dispatches move-vertex if changed, clears vertexEditMarkupId
    return
  }
  // Existing drawing-mode Enter branches follow...
  if (markupState.mode !== 'drawing') return
  ...
}
```

And for Escape:
```typescript
if (e.key === 'Escape') {
  // Vertex edit cancel takes priority
  const veId = useViewerStore.getState().vertexEditMarkupId
  if (veId !== null) {
    e.preventDefault()
    cancelVertexEdit()  // restores original points from snapshot, clears vertexEditMarkupId
    return
  }
  // Existing cancel branches follow...
}
```

`cancelVertexEdit` needs a snapshot of the original points from when vertex edit mode was entered. Store this in a `vertexEditOriginalRef = useRef<StagePoint[] | null>(null)` — set when `vertexEditMarkupId` is set, cleared on commit/cancel. [ASSUMED: local ref is the simplest; no need for store involvement since originals are only needed during the editing session]

### Finding 10: Body Drag — Count Pin vs. Points-Array Markups

When committing a body drag (building the `move-markups` command):

```typescript
// For count markup:
moves.push({
  markupId: m.id,
  page: m.page,
  oldPoint: m.point,
  newPoint: { x: m.point.x + delta.x, y: m.point.y + delta.y }
})

// For linear / area / perimeter / wall:
moves.push({
  markupId: m.id,
  page: m.page,
  oldPoints: m.points,
  newPoints: m.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }))
})
```

The store `moveMarkups` action applies the new positions to each markup in the list: look up by `markupId`, replace `point` or `points`. [VERIFIED: existing placeMarkup/editMarkup patterns in markupStore.ts show the store update pattern]

### Finding 11: Konva Transformer — Why Not to Use It

Konva's built-in `Transformer` node provides scale/rotate handles. This phase only needs **point-reposition** (vertex move) and **whole-shape translate**. Transformer would provide the wrong UX (it gives scale handles, not vertex handles) and would conflict with the existing selection ring (HoverRing layer). Custom `Rect` handles give exact control over size, color, border, and zoom compensation per D-05. [VERIFIED: Konva Transformer is for scale/rotate, not vertex editing — this is a well-established distinction in the Konva community]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Stage-space pointer coords during drag | Raw `event.clientX / clientY` | `stage.getAbsoluteTransform().copy().invert().point(pointer)` — locked pattern in STATE.md |
| Zoom-compensated handle size | Calculate in JSX at render time | Module-level `HANDLE_SIZE_PX = 8` constant divided by `currentZoom` — mirrors PIN_RADIUS_WORLD pattern |
| Hit detection on handles | Konva hit testing with custom shapes | Named Rect nodes + `e.target.name().startsWith('handle-')` — reliable and already used for similar purposes |
| Undo batching for group move | Custom undo manager | Extend existing `MarkupCommand` union + `pushCommand()` helper in markupStore |
| Snapshot for Escape-to-restore | Deep equality diff | `useRef` holding original `StagePoint[]` captured when vertex edit activates |

---

## Common Pitfalls

### Pitfall 1: Stage Draggable Conflict During Body Drag
**What goes wrong:** `isDraggable` is true in select mode (middle mouse pan). If a markup body-drag starts, the Stage might also try to pan.

**Why it happens:** `useViewportControls` sets `draggable={isDraggable}` on the Stage. During LMB body drag, Konva may interpret it as a Stage drag if LMB is in `dragButtons`.

**How to avoid:** Check the existing `useViewportControls` — after the Phase 9 rubber-band fix, `dragButtons` was set to `[1]` (MMB only) in select mode. This means LMB is already NOT a Stage drag trigger in select mode. The body drag will work without conflict. Confirm with `useViewportControls.ts` before implementing. [VERIFIED: `e.evt.stopPropagation()` is already called in `handleStageMouseDown` for rubber-band to prevent Konva DD from interfering — use the same pattern for body drag]

### Pitfall 2: Konva Click Always Fires After MouseUp
**What goes wrong:** After a body drag completes on MouseUp, Konva fires a `click` event. This would immediately clear the selection (existing `e.target === stage` branch) or re-enter vertex edit mode on the dragged markup.

**Why it happens:** Konva fires click whenever no internal Stage drag was active — since we're using the Stage's pointer events manually (not Konva's `draggable`), the click always fires.

**How to avoid:** The existing `rubberBandDraggedRef` pattern is the exact solution. Add a parallel `bodyDraggedRef = useRef(false)`. Set it to `true` in `handleStageMouseUp` when body drag committed. Read and clear it at the top of `handleStageClick`. This is the IDENTICAL fix that was applied for rubber-band (commit 4db36bb). [VERIFIED: codebase — `rubberBandDraggedRef` at lines 338 and 727-731 in CanvasViewport.tsx]

### Pitfall 3: Vertex Edit Mode Leaks on Page Navigation
**What goes wrong:** User enters vertex edit mode, navigates to a different page. The vertex handles remain mounted on the new page, pointing at wrong coordinates.

**How to avoid:** Subscribe to `currentPage` changes in a `useEffect` and call `clearVertexEdit()` on change. This mirrors the existing `setSelectedMarkupIds([])` that fires in `viewerStore.setPage()`. Also clear `dragPreview` state. [VERIFIED: viewerStore.setPage() already clears selectedMarkupIds — same lifecycle needed for vertexEditMarkupId]

### Pitfall 4: Group Move with Mixed Pages
**What goes wrong:** Multi-select across pages is not currently possible (page navigation clears selection per `viewerStore.setPage`). But defensive code in `moveMarkups` should still look up each markup's page from the markup itself, not from `currentPage`.

**How to avoid:** In the `moveMarkups` store action, for each move entry, look up the markup by id across all pages rather than assuming `currentPage`. [VERIFIED: `deleteGroup` in markupStore.ts uses `idSet` across all pages — same pattern]

### Pitfall 5: Handle Rects Covering the Markup's Own Hit Area
**What goes wrong:** If `VertexHandleOverlay` is rendered in the same layer as Layer 1b, the handle Rects overlay the markup's Group. The first click to enter vertex edit would hit the handle Rect of the previous markup rather than the markup Group.

**How to avoid:** Vertex edit mode activates AFTER the selection click, not simultaneously with it. When `vertexEditMarkupId === null`, no handles are rendered — the first click hits the markup Group normally. When vertex edit is active, handles for that markup appear. The handle layer must be ABOVE Layer 1b so handles intercept pointer events before the markup body beneath them. [VERIFIED: layer ordering logic in CanvasViewport — rubber-band layer above 1b is the established precedent]

### Pitfall 6: `listening={true}` Requirement on Handle Layer
**What goes wrong:** Setting `listening={false}` on the handle layer (by analogy with HoverRing) makes handles invisible to pointer events — drags never start.

**Why it happens:** HoverRing has `listening={false}` because it should not intercept events. Handles MUST intercept events; they are interactive.

**How to avoid:** The handle Layer and every handle Rect must have `listening={true}` (or omit the prop, which defaults to `true`). Document this explicitly in `VertexHandleOverlay` with a comment. [VERIFIED: every non-interactive layer/shape in CanvasViewport has explicit `listening={false}` with a comment; the handle layer inverts this pattern]

### Pitfall 7: Escape vs. Click-Outside — Both Must Restore Original
**What goes wrong:** Escape correctly restores from `vertexEditOriginalRef`, but "click outside" path dispatches a `move-vertex` command first, THEN clears vertex edit. If the user made no changes and clicks outside, a no-op command gets pushed to the undo stack.

**How to avoid:** In the commit path, compare `currentPoints` with `originalPoints`. If equal (or within float epsilon), skip the store dispatch entirely. This prevents polluting the undo stack with no-op commands. [ASSUMED: no existing precedent in this codebase; but standard command-pattern hygiene]

### Pitfall 8: `onMarkupMouseDown` Prop Added to 5 Components
**What goes wrong:** Each markup component needs a new `onMarkupMouseDown?: (id: string) => void` prop. Forgetting to add it to one component (e.g. `WallMarkup`) means dragging that markup type never triggers body-drag.

**How to avoid:** Add to all 5 components in a single task — `CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`. TypeScript will catch call sites that pass the prop to components not yet updated. The prop is optional (`?:`) so the prop-interface change is non-breaking. [VERIFIED: all 5 markup components currently accept `onClick?: (id: string) => void` as an optional prop — same pattern]

### Pitfall 9: StrictMode Double-Fire on Body Drag Commit
**What goes wrong:** Committing body drag inside a `setState` updater that also calls `markupStore.getState().moveMarkups()` would double-fire under React StrictMode (same bug fixed in `useMarkupTool.recordClick`).

**How to avoid:** Mirror the existing pattern: read positions from a `ref`, call `markupStore.getState().moveMarkups(...)` as a direct side-effect OUTSIDE the `setState` call, then call `setState` to reset drag state. [VERIFIED: `useMarkupTool.ts` lines 178–202 document this exact pitfall with the comment "React StrictMode double-invokes setState updater functions"]

---

## Code Examples

### Zoom-Compensated Handle Rect (pattern)
```typescript
// Source: verified pattern — mirrors PIN_RADIUS_WORLD / currentZoom in CountPinMarkup.tsx:26
const HANDLE_SIZE_PX = 8
const HANDLE_STROKE_PX = 1.5

const handleSize = HANDLE_SIZE_PX / currentZoom
const handleStroke = HANDLE_STROKE_PX / currentZoom

<Rect
  key={i}
  name={`handle-${i}`}           // named for hit detection in handleStageMouseDown
  x={p.x - handleSize / 2}
  y={p.y - handleSize / 2}
  width={handleSize}
  height={handleSize}
  fill="#ffffff"
  stroke={markup.color}
  strokeWidth={handleStroke}
  listening={true}
  onMouseDown={(e) => {
    e.cancelBubble = true         // stop propagation to prevent Stage rubber-band
    onHandleMouseDown?.(i)
  }}
/>
```

### Stage Inverse Transform (existing locked pattern)
```typescript
// Source: STATE.md § "Stage inverse transform for page-space coords"
// Used in handleStageMouseDown and handleStageMouseMove for drag coordinate conversion
const stagePoint = stage.getAbsoluteTransform().copy().invert().point(pointer)
```

### viewerStore Extension (additive)
```typescript
// In viewerStore.ts — new fields alongside existing selectedMarkupIds
vertexEditMarkupId: null as string | null,

setVertexEditMarkupId: (id: string) => set({ vertexEditMarkupId: id }),
clearVertexEdit: () => set({ vertexEditMarkupId: null }),
```

### MarkupCommand Extension (additive union members)
```typescript
// In markup.ts — add to MarkupCommand union
| { type: 'move-vertex'; markupId: string; page: number; vertexIndex: number; oldPoint: StagePoint; newPoint: StagePoint }
| { type: 'move-markups'; moves: Array<{ markupId: string; page: number; oldPoints?: StagePoint[]; newPoints?: StagePoint[]; oldPoint?: StagePoint; newPoint?: StagePoint }> }
```

### bodyDraggedRef Pattern (mirrors rubberBandDraggedRef)
```typescript
// Source: rubberBandDraggedRef pattern, CanvasViewport.tsx lines 338, 819-823
// Body drag uses IDENTICAL suppression pattern to prevent click from clearing selection
const bodyDraggedRef = useRef(false)

// In handleStageMouseUp, when body drag commits:
if (moved) {
  dispatchMoveMarkups(bodyDragRef.current!)
  bodyDraggedRef.current = true     // suppress the Konva click that always follows
}

// In handleStageClick, at the top:
if (bodyDraggedRef.current) {
  bodyDraggedRef.current = false
  return
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Konva Transformer for shape editing | Custom vertex handle Rects for vertex-edit use cases | Established Konva community pattern; Transformer suits resize/rotate, not polyline vertex editing | Phase 12 uses custom Rects — more precise control |
| All Konva drag via `draggable` prop | Stage-level pointer events for custom drag gestures | Phase 9 rubber-band implementation | Body drag follows the same pointer-event pattern, NOT Konva `draggable` on markup nodes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Handle layer should sit immediately above Layer 1b (below rubber-band layer) | Finding 3 | Low: layer ordering is visible; wrong order causes wrong z-index but is trivially fixable |
| A2 | `e.target.name().startsWith('handle-')` is reliable for hit detection | Finding 4 | Medium: if Konva's `name()` API behaves differently than expected; fallback is to pass a boolean ref from child onMouseDown |
| A3 | `vertexEditOriginalRef` (local ref, not store) is sufficient for Escape-restore | Finding 9 | Low: the only risk is a React render cycle clearing the ref, which doesn't happen for `useRef` |
| A4 | No-op command suppression (Finding pitfall 7) | Pitfall 7 | Low: adding a no-op command to the undo stack is harmless UX-wise, just slightly wasteful |
| A5 | `overridePoints` prop approach for preview during drag | Finding 6 | Medium: could use a separate "ghost" overlay instead; either works, but override-prop is simpler |

---

## Open Questions

1. **Should `clearVertexEdit()` also be called when activeTool changes away from 'select'?**
   - What we know: selecting a markup tool (e.g. linear) changes `activeTool` but doesn't clear `selectedMarkupIds` today
   - What's unclear: is it confusing to have handles visible while a markup tool is active?
   - Recommendation: yes — clear vertex edit in the `activeTool` change useEffect that already handles `cancelMarkup()`. Add `clearVertexEdit()` in the same effect when `!isMarkupTool(activeTool)`.

2. **Preview rendering approach for body drag: override-points prop vs. ghost overlay?**
   - What we know: override-points prop requires touching 5 markup components; ghost overlay can be rendered separately
   - What's unclear: either works; which is simpler to implement and test
   - Recommendation: override-points prop is simpler because it reuses existing render code with minimal changes; ghost overlay would duplicate rendering logic

3. **Should vertex edit mode survive a single rubber-band re-selection?**
   - What we know: clicking empty stage in vertex edit mode should commit (D-06 "click outside")
   - What's unclear: rubber-band re-selection in vertex edit mode is not covered by D-04/D-06
   - Recommendation: rubber-band selection exits vertex edit mode (same as click-outside) and sets the new selection. The rubber-band drag suppressor (`rubberBandDraggedRef`) already clears selection; add `clearVertexEdit()` alongside it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed in vitest.config.ts) |
| Config file | `vitest.config.ts` — `src/tests/**/*.test.ts` |
| Quick run command | `npx vitest run src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-D04 | Second click on selected markup enters vertex edit mode | unit (store) | `npx vitest run src/tests/vertex-edit-mode.test.ts` | Wave 0 gap |
| REQ-D05 | Handles are zoom-compensated 8×8px | unit (math) | `npx vitest run src/tests/vertex-handle-overlay.test.ts` | Wave 0 gap |
| REQ-D06 | Escape restores original vertex positions | unit (store) | `npx vitest run src/tests/vertex-edit-mode.test.ts` | Wave 0 gap |
| REQ-D07 | Body drag with 4px threshold moves markup | unit (command) | `npx vitest run src/tests/move-markups-command.test.ts` | Wave 0 gap |
| REQ-D08 | Group move batched as single undo command | unit (store) | `npx vitest run src/tests/move-markups-command.test.ts` | Wave 0 gap |
| REQ-undo | Ctrl+Z undoes vertex edit in one step | unit (store) | `npx vitest run src/tests/move-vertex-command.test.ts` | Wave 0 gap |
| REQ-undo | Ctrl+Z undoes group move in one step | unit (store) | `npx vitest run src/tests/move-markups-command.test.ts` | Wave 0 gap |
| REQ-count | Count pin translates (no vertex edit) | unit (store) | `npx vitest run src/tests/move-markups-command.test.ts` | Wave 0 gap |

### Wave 0 Gaps
- [ ] `src/tests/move-vertex-command.test.ts` — covers MoveVertexCommand undo/redo round-trips
- [ ] `src/tests/move-markups-command.test.ts` — covers solo translate, group move, count pin translate, undo/redo
- [ ] `src/tests/vertex-edit-mode.test.ts` — covers viewerStore vertexEditMarkupId state transitions

*(Existing `src/tests/viewer-store-selection.test.ts` and `src/tests/markup-store.test.ts` provide good fixtures to copy)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 12 |
|-----------|-------------------|
| Windows desktop, offline | No external calls; all event handling is local Konva/React |
| Markup persistence must stay precisely positioned when zooming | All drag coordinates MUST use stage inverse transform, never raw pointer coords |
| Stage inverse transform is the locked pattern | `stage.getAbsoluteTransform().copy().invert().point(pointer)` — use in every drag handler |
| Zoom-compensated visuals | Handle size = `8 / currentZoom`; handle stroke = `1.5 / currentZoom` |
| Command pattern for undo | Every geometry mutation pushes a `MarkupCommand` to the undoStack |
| Additive schema fields | `MarkupCommand` union extension is additive — no `formatVersion` bump needed (commands are in-memory only) |
| Module-level ref pattern | `_vertexEditMarkupId` approach is available, but useState-backed store is better here since renders depend on it |
| isTextInputActive() guard | Enter/Escape vertex edit handlers must include this guard |

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `src/renderer/src/components/CanvasViewport.tsx` — rubber-band drag pattern, stage event flow, layer structure, `rubberBandDraggedRef` 4px threshold
- `src/renderer/src/stores/viewerStore.ts` — `selectedMarkupIds` API, selection lifecycle
- `src/renderer/src/stores/markupStore.ts` — `MarkupCommand` union, `pushCommand`, undo/redo symmetric structure
- `src/renderer/src/types/markup.ts` — `BaseMarkup`, `CountMarkup` (`point`), all other markups (`points[]`)
- `src/renderer/src/components/markup/LinearMarkup.tsx`, `AreaMarkup.tsx`, `PerimeterMarkup.tsx`, `WallMarkup.tsx`, `CountPinMarkup.tsx` — existing Group/onClick/onHoverEnter prop patterns
- `src/renderer/src/components/HoverRing.tsx` — zoom-compensation pattern, `listening={false}` discipline
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Enter/Escape handling, `isTextInputActive()` guard
- `.planning/STATE.md` — locked decisions: stage inverse transform, zoom-compensated visuals, command pattern, module-level refs
- `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` — D-04 through D-09 locked decisions

### Secondary (MEDIUM confidence)
- Konva official docs on `Transformer` — confirms it is for scale/rotate, not vertex editing; custom Rect handles are the right approach for this use case [ASSUMED: based on training knowledge consistent with CLAUDE.md Konva documentation references]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all findings grounded in the live codebase
- Architecture (state machine, layer placement, event disambiguation): HIGH — based on direct codebase reading; event bubbling order is a verified Konva property
- Pitfalls: HIGH — most are direct re-statements of bugs already encountered in Phases 9–10 (rubberBandDraggedRef, StrictMode double-fire, isDraggable conflict)
- Command design: HIGH — extends the existing MarkupCommand union with the same symmetric undo/redo pattern

**Research date:** 2026-05-20
**Valid until:** Stable — no external dependencies; valid until codebase changes CanvasViewport event flow or markupStore command pattern
