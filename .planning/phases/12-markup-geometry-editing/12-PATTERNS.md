# Phase 12: Markup Geometry Editing — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/renderer/src/types/markup.ts` | model | — | self (additive) | exact — add two new `MarkupCommand` union members |
| `src/renderer/src/stores/markupStore.ts` | store | CRUD | self (additive) | exact — add `moveVertex`, `moveMarkups` actions + undo/redo branches |
| `src/renderer/src/components/CanvasViewport.tsx` | component | event-driven | self (additive) | exact — add vertex-edit layer, drag-translate handlers, new pointer refs |
| `src/renderer/src/components/markup/LinearMarkup.tsx` | component | event-driven | self (additive) | exact — add `onVertexDragStart/Move/End`, `onBodyDragStart/Move/End` props |
| `src/renderer/src/components/markup/AreaMarkup.tsx` | component | event-driven | `LinearMarkup.tsx` | exact match — identical prop + handler shape |
| `src/renderer/src/components/markup/PerimeterMarkup.tsx` | component | event-driven | `LinearMarkup.tsx` | exact match — identical prop + handler shape |
| `src/renderer/src/components/markup/WallMarkup.tsx` | component | event-driven | `LinearMarkup.tsx` | exact match — identical prop + handler shape (open polyline) |
| `src/renderer/src/components/markup/CountPinMarkup.tsx` | component | event-driven | self (additive) | exact — add `onBodyDragStart/Move/End` (no vertices; just translate) |
| `src/renderer/src/lib/markup-undo-ref.ts` | utility | — | self (additive) | exact — add `moveVertexUndoRef` / `moveMarkupsUndoRef` if mid-drag undo is needed |

---

## Pattern Assignments

---

### `src/renderer/src/types/markup.ts` (model, additive)

**Analog:** `src/renderer/src/types/markup.ts` lines 52–78 (existing `MarkupCommand` union)

**What to copy:** The existing discriminated-union pattern. Append two new command variants to the `MarkupCommand` type. Do NOT change the existing variants — additive schema rule (STATE.md §"Key Decisions Locked").

**New command shape to add** (lines 52–78, after `edit-markup`):

```typescript
// Copy the existing union structure exactly; append these two members:
| {
    type: 'move-vertex'
    markupId: string
    page: number
    vertexIndex: number          // 0-based index into markup.points[]
    oldPoint: StagePoint
    newPoint: StagePoint
  }
| {
    type: 'move-markups'
    moves: Array<{
      markupId: string
      page: number
      markupType: MarkupType     // needed so undo can find the markup without a store round-trip
      oldPoints: StagePoint[]    // full points array before move (or [point] for count)
      newPoints: StagePoint[]    // full points array after move (or [point] for count)
    }>
  }
```

**Note on `StagePoint`:** Already defined in `useCalibrationMode.ts` and imported into `markup.ts` line 1. Keep the existing import — do not redefine.

---

### `src/renderer/src/stores/markupStore.ts` (store, CRUD)

**Analog:** `src/renderer/src/stores/markupStore.ts` — the `editMarkup` action (lines 188–223) and `undo`/`redo` branches (lines 239–386).

**What to copy:**

**Action pattern** (copy structure from `editMarkup`, lines 188–223):

```typescript
// editMarkup resolves category BEFORE entering set() — avoids nested set() calls.
// moveVertex and moveMarkups do NOT need category resolution; enter set() directly.

editMarkup: (markupId, page, ...) => {
  const newCat = get().getOrCreateCategory(newCategoryName)  // resolve outside set()
  set((s) => {
    const pageList = s.pageMarkups[page] ?? []
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s   // ← defensive no-op guard — copy to every new action

    const updated: Markup = { ...target, ...changes }
    const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))
    const cmd: MarkupCommand = { type: 'edit-markup', ... }
    return {
      pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
      undoStack: pushCommand(s.undoStack, cmd),
      redoStack: []          // ← always clear redo on any new action
    }
  })
},
```

**New `moveVertex` action** — copy the `editMarkup` pattern above with these differences:
- Mutate `markup.points[vertexIndex]` (for non-count) or `markup.point` (for count) via spread
- Push a `'move-vertex'` command
- `page` is passed in; no category resolution needed

**New `moveMarkups` action** — copy the `deleteGroup` multi-page iteration pattern (lines 135–148) with these differences:
- Iterate `moves[]` to apply `newPoints` to each markup on its page
- Push a `'move-markups'` command carrying both old and new positions (needed for undo)
- Use `idSet`-style lookup to avoid O(n²) scan per markup

**Undo branch pattern** (copy from the `edit-markup` branch, lines 263–279, and the `delete-group` branch, lines 286–296):

```typescript
// edit-markup undo branch — copy structure for move-vertex:
if (cmd.type === 'edit-markup') {
  const oldCat = get().getOrCreateCategory(cmd.oldCategoryName)
  const pageList = s.pageMarkups[cmd.page] ?? []
  const nextList = pageList.map((m) =>
    m.id === cmd.markupId
      ? ({ ...m, name: cmd.oldName, categoryId: oldCat.id, color: cmd.oldColor } as Markup)
      : m
  )
  return {
    pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]   // ← always push onto redo stack
  }
}

// delete-group undo branch — copy multi-page iteration for move-markups:
if (cmd.type === 'delete-group') {
  const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
  for (const m of cmd.markups) {
    nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
  }
  return { pageMarkups: nextPageMarkups, undoStack: s.undoStack.slice(0, -1), redoStack: [...s.redoStack, cmd] }
}
```

**Important:** The `'delete-group'` branch in both `undo` and `redo` has a comment "MUST come BEFORE the `cmd.markup.page` access below". The new `move-vertex` and `move-markups` branches must also be placed before the fallthrough that reads `cmd.markup.page` (lines 298–310 in undo, lines 373–386 in redo).

---

### `src/renderer/src/components/CanvasViewport.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/CanvasViewport.tsx` — multiple sections.

**Pattern 1 — Module-level ref for new editing controls** (lines 102–157):

```typescript
// Copy the _canvasControls / _calibrationControls / _chainArmedItem module-level ref pattern.
// For vertex-edit mode, expose a cancel-edit ref so Escape can exit vertex-edit
// without reaching into component state.

let _canvasControls: { ... } | null = null
export function getCanvasControls() { return _canvasControls }

let _calibrationControls: { ... } | null = null
export function getCalibrationControls() { return _calibrationControls }

// Phase 12: new module-level ref for vertex-edit cancel (mirrors _calibrationControls.cancel)
let _vertexEditControls: { cancel: () => void } | null = null
export function getVertexEditControls() { return _vertexEditControls }
```

**Pattern 2 — rubberBandDraggedRef / rubberBandRef dual ref pattern** (lines 329–338):

```typescript
// useState drives re-render; useRef gives stable always-current value to event handlers.
// Copy this EXACT dual-ref pattern for vertex drag and body drag states:

const [rubberBand, setRubberBandState] = useState<RubberBandState>(null)
const rubberBandRef = useRef<RubberBandState>(null)
const setRubberBand = useCallback((val: RubberBandState) => {
  rubberBandRef.current = val
  setRubberBandState(val)
}, [])
const rubberBandDraggedRef = useRef(false)
// ↑ The dual-ref pattern: one ref for stable event-handler reads, one for render.
// Apply the same pattern to vertex-drag and body-drag tracking:
//   vertexDragRef.current — which vertex is being dragged (no re-render needed)
//   bodyDragRef.current   — which markup ids are being body-dragged
```

**Pattern 3 — Stage inverse transform for pointer-to-page-space conversion** (lines 769–770, 789–790):

```typescript
// CANONICAL PATTERN — copy verbatim for every pointer→stage coordinate conversion.
// Never use raw pointer.x/pointer.y for markup geometry.

// On mousedown (rubber-band start):
const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)

// On mousemove (rubber-band update):
const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)

// Phase 12: apply same transform in vertex onDragMove and body onDragMove handlers.
```

**Pattern 4 — Zoom-compensated visual constants** (lines 856–859):

```typescript
// Every stroke width, radius, and dash length divides by currentZoom.
// The vertex handle squares must follow this rule.
const POINT_RADIUS = 6 / currentZoom          // calibration dot — reuse size for vertex handles
const POINT_STROKE_WIDTH = 1 / currentZoom
const LINE_STROKE_WIDTH = 2 / currentZoom
// Phase 12: vertex handle squares
const VERTEX_HANDLE_SIZE = 8 / currentZoom    // 8px screen-constant square
const VERTEX_HANDLE_STROKE = 1 / currentZoom
```

**Pattern 5 — Rubber-band 4px movement threshold** (lines 816–819):

```typescript
// The 4px threshold is the project-wide disambiguation between click and drag.
// Copy for vertex-drag commit vs cancel AND for body-drag threshold:
const moved = Math.abs(rb.endX - rb.startX) > 4 || Math.abs(rb.endY - rb.startY) > 4
// Phase 12: use the SAME 4px threshold to suppress accidental micro-drags.
```

**Pattern 6 — Markup rendering in Layer 1b** (lines 1033–1128):

```typescript
// Committed markups are rendered in Layer 1b (listening={true}).
// Phase 12 vertex-edit handles go in a NEW layer ABOVE Layer 1b (same pattern
// as the rubber-band layer above Layer 1b, lines 1133–1146):

{rubberBand && (
  <Layer listening={false}>
    <Rect ... listening={false} />
  </Layer>
)}

// Vertex handles ARE interactive (listening={true} so onDragStart/Move/End fire).
// Body-drag hit area needs listening={true} on the markup Group itself.
// Copy the rubber-band layer mount pattern — only mount when in vertex-edit mode.
```

**Pattern 7 — Escape key handler** (lines 483–503):

```typescript
// Copy the Escape handler pattern to add vertex-edit cancel:
if (e.key === 'Escape') {
  if (markupState.mode === 'drawing' || ...) {
    e.preventDefault()
    cancelMarkup()
    useViewerStore.getState().setActiveTool('select')
    return
  }
  // No active markup flow: clear selection (existing behavior)
  if (useViewerStore.getState().activeTool === 'select') {
    clearSelection()
  }
}
// Phase 12: add vertex-edit check BEFORE the select-mode clearSelection:
//   if (vertexEditActive) { cancelVertexEdit(); return }
```

**Pattern 8 — markupMouseDownPosRef click-vs-drag guard** (lines 352–364):

```typescript
// Phase 12 body-drag: the same click-vs-drag guard (downPos captured on mousedown,
// compared at click time) must be applied to body-drag gestures so a small accidental
// move during a click does not trigger a translate.
// Copy the markupMouseDownPosRef pattern verbatim — only the condition that reads it
// changes (instead of isMarkupTool(activeTool), check isVertexEditActive).
const markupMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
```

---

### `src/renderer/src/components/markup/LinearMarkup.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/markup/LinearMarkup.tsx` — full file.

**What to copy — Props interface** (lines 11–21):

```typescript
export interface LinearMarkupProps {
  markup: LinearMarkupType
  category: Category
  currentZoom: number
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
  onClick?: (id: string) => void
  // Phase 12: add these new optional callbacks — existing callsites pass nothing,
  // so no call-site changes needed when vertex-edit is not active.
  onVertexDragStart?: (id: string, vertexIndex: number) => void
  onVertexDragMove?: (id: string, vertexIndex: number, stagePoint: { x: number; y: number }) => void
  onVertexDragEnd?: (id: string, vertexIndex: number, stagePoint: { x: number; y: number }) => void
  onBodyDragStart?: (id: string) => void
  onBodyDragMove?: (id: string, dx: number, dy: number) => void
  onBodyDragEnd?: (id: string, dx: number, dy: number) => void
  /** True when this markup is selected AND the canvas is in vertex-edit mode */
  vertexEditActive?: boolean
}
```

**What to copy — Group event handler pattern** (lines 83–98):

```typescript
// All event handlers follow the same shape — get stage pointer, forward id + coords.
// Copy for onBodyDragStart/Move/End on the Group:
<Group
  onMouseEnter={(e) => {
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (p && onHoverEnter) onHoverEnter(markup.id, p.x, p.y)
  }}
  onMouseLeave={() => onHoverLeave?.(markup.id)}
  onContextMenu={(e) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const p = stage?.getPointerPosition()
    if (p && onContextMenu) onContextMenu(markup.id, p.x, p.y)
  }}
  onClick={() => onClick?.(markup.id)}
  // Phase 12: add drag callbacks on the Group for body-translate:
  draggable={vertexEditActive}
  onDragStart={...}
  onDragMove={...}
  onDragEnd={...}
>
```

**What to copy — Vertex handles** (rendered when `vertexEditActive === true`):

The in-progress polygon drawing layer in CanvasViewport (lines 1230–1241) shows the interactive start-vertex Circle pattern. Copy that for the per-vertex Rect handles inside the markup Group:

```typescript
// From CanvasViewport lines 1230-1241 — interactive circle with hitStrokeWidth:
<Circle
  x={markupState.points[0].x}
  y={markupState.points[0].y}
  radius={(isOverStartPoint && markupState.points.length >= 3 ? 7 : 5) / currentZoom}
  hitStrokeWidth={12 / currentZoom}   // ← fat hit area, zoom-compensated
  onMouseEnter={() => setIsOverStartPoint(true)}
  onMouseLeave={() => setIsOverStartPoint(false)}
/>
// Phase 12: use Konva Rect instead of Circle for square handle affordance.
// draggable={true}, onDragStart/Move/End forward (markupId, vertexIndex, stagePoint).
// hitStrokeWidth / hitWidth: keep hit area larger than visual for touch/precision.
```

**What NOT to copy:** The `isHidden` guard (lines 59–61) and the label/chip rendering (lines 106–132) are unchanged. The `strokeWidth = STROKE_BASE_PX / currentZoom` line stays identical.

---

### `src/renderer/src/components/markup/AreaMarkup.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/markup/LinearMarkup.tsx` (identical structure — copy the Phase 12 props and handler additions from LinearMarkup verbatim).

**Key difference from LinearMarkup:** The Konva `<Line>` has `closed` prop (line 88). Vertex handles are still per-point; the closing segment renders automatically when `closed` is set.

---

### `src/renderer/src/components/markup/PerimeterMarkup.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/markup/AreaMarkup.tsx` (identical to AreaMarkup — also uses `closed` Line, same centroid label, same Group handler shape).

Copy Phase 12 additions from AreaMarkup verbatim.

---

### `src/renderer/src/components/markup/WallMarkup.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/markup/LinearMarkup.tsx` (open polyline, same handler shape).

**Key difference from LinearMarkup:** The Group contains TWO Lines — primary + hairline (lines 120–137). Vertex handles attach to the PRIMARY line geometry (`markup.points`). The hairline (`offsetY={WALL_OFFSET_WORLD}`) is `listening={false}` already and needs no change.

**What to copy:** Same new props interface as LinearMarkup. Vertex Rect handles are added once (on the primary points — not per hairline).

---

### `src/renderer/src/components/markup/CountPinMarkup.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/markup/CountPinMarkup.tsx` — full file.

**What to copy — Props addition** (lines 6–21):

```typescript
export interface CountPinMarkupProps {
  markup: CountMarkup
  category: Category
  currentZoom: number
  onHoverEnter?: ...
  onHoverLeave?: ...
  onContextMenu?: ...
  onClick?: ...
  // Phase 12: count pins have no vertices — only body-translate.
  onBodyDragStart?: (id: string) => void
  onBodyDragMove?: (id: string, dx: number, dy: number) => void
  onBodyDragEnd?: (id: string, dx: number, dy: number) => void
  /** True when this markup is selected AND canvas is in vertex-edit mode */
  vertexEditActive?: boolean
}
```

**What to copy — Group drag handlers** (lines 62–76, Group with existing event handlers):

```typescript
// Copy the existing Group event handler pattern. Add drag props conditionally:
<Group
  onMouseEnter={...}
  onMouseLeave={...}
  onContextMenu={...}
  onClick={() => onClick?.(markup.id)}
  // Phase 12:
  draggable={vertexEditActive}
  onDragStart={...}
  onDragMove={...}
  onDragEnd={...}
>
```

**Note:** CountMarkup uses `markup.point` (singular `StagePoint`), not `markup.points[]`. The `moveMarkups` command must handle both shapes:
- For `count` markups: `oldPoints = [markup.point]`, `newPoints = [newPoint]`
- Undo restores `markup.point = cmd.moves[i].oldPoints[0]`

---

## Shared Patterns

### Stage Inverse Transform (pointer → page space)
**Source:** `src/renderer/src/hooks/useCalibrationMode.ts` lines 48–55 and `CanvasViewport.tsx` lines 769–770, 789–790
**Apply to:** Every place a pointer position needs converting to a markup coordinate (vertex drag, body drag, rubber-band)

```typescript
// CANONICAL — copy verbatim, never deviate:
function screenToStagePoint(stage: Konva.Stage, sx: number, sy: number): StagePoint {
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x: sx, y: sy })
}
```

### Zoom-Compensated Visuals
**Source:** `CanvasViewport.tsx` lines 856–859; `HoverRing.tsx` lines 61–62; `LinearMarkup.tsx` line 63
**Apply to:** Vertex handle size, hit area, stroke — ALL visual geometry that should appear constant on screen

```typescript
// Every size that must not scale with zoom:
const visualSize = BASE_PX / currentZoom
// Phase 12 vertex handle:
const VERTEX_HANDLE_SIZE = 8 / currentZoom
const VERTEX_HANDLE_HIT = 16 / currentZoom   // larger hit area for precision
```

### Command + Undo/Redo Registration
**Source:** `markupStore.ts` lines 60–63 (`pushCommand` helper), lines 239–386 (`undo`/`redo`)
**Apply to:** `moveVertex` and `moveMarkups` store actions

```typescript
// pushCommand is the ONLY way to push onto undoStack — enforces UNDO_STACK_MAX=50.
function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}
// Always: undoStack: pushCommand(s.undoStack, cmd), redoStack: []
```

### Module-Level Ref Pattern
**Source:** `CanvasViewport.tsx` lines 102–157; `src/renderer/src/lib/markup-undo-ref.ts`
**Apply to:** Any new cross-component imperative API needed for vertex-edit mode

```typescript
// Pattern: module-level nullable var + getter function.
// Component registers in useEffect, unregisters on cleanup.
let _myControls: { cancel: () => void } | null = null
export function getMyControls() { return _myControls }

// Inside component:
useEffect(() => {
  _myControls = { cancel }
  return () => { _myControls = null }
}, [cancel])
```

### Defensive No-Op Guard on Store Actions
**Source:** `markupStore.ts` line 129, line 197
**Apply to:** `moveVertex` and `moveMarkups` actions

```typescript
// Every action that takes a markupId must guard against missing markup:
const target = pageList.find((m) => m.id === markupId)
if (!target) return s   // defensive no-op — mirrors deleteMarkup pattern
```

### Dual-Ref State Pattern (render + event handler stability)
**Source:** `CanvasViewport.tsx` lines 329–338 (rubberBand + rubberBandRef)
**Apply to:** Vertex drag state and body drag state in CanvasViewport

```typescript
// useState drives re-render; useRef gives event handlers a stable, always-current
// value without adding the state to useCallback deps (which would cause
// listener-swap on every state change and miss events).
const [state, setStateRaw] = useState<T>(null)
const stateRef = useRef<T>(null)
const setState = useCallback((val: T) => {
  stateRef.current = val
  setStateRaw(val)
}, [])
```

### isTextInputActive Guard on New Keyboard Shortcuts
**Source:** `useKeyboardShortcuts.ts` lines 26–41, applied at lines 58, 66, 74, 81, 92, 133
**Apply to:** Any new keyboard handler for vertex-edit mode (Enter to commit edit, Escape to cancel)

```typescript
// Always check before global keyboard actions:
if (isTextInputActive()) return
```

### StrictMode-Safe Side Effects (read stateRef, dispatch outside setState)
**Source:** `useMarkupTool.ts` lines 96–102, 179–203, 313–316
**Apply to:** Any drag-end handler that calls `markupStore.moveVertex` or `markupStore.moveMarkups`

```typescript
// Anti-pattern: store.placeMarkup() inside setState() updater → double-fires under StrictMode.
// Correct pattern: read state from stateRef.current, dispatch side effect ONCE, then setState.
const prev = stateRef.current
if (prev.mode !== 'dragging') return
store.moveVertex(...)         // dispatch OUTSIDE setState
setState(INITIAL_STATE)       // reset AFTER dispatch
```

---

## No Analog Found

All Phase 12 files have direct analogs in the codebase. No file requires purely research-based patterns.

---

## Metadata

**Analog search scope:** `src/renderer/src/` — components, hooks, stores, types, lib
**Files scanned:** 12
**Pattern extraction date:** 2026-05-20
