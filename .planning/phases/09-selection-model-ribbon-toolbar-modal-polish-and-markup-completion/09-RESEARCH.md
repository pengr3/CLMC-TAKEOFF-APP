# Phase 9: Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion — Research

**Researched:** 2026-05-18
**Domain:** React/Konva interaction model, CSS drag UX, Zustand state extension, discriminated-union command pattern
**Confidence:** HIGH — all findings are verified against the actual codebase; no undiscovered API required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Selection Model — State Storage (D-01):** Add `selectedMarkupIds: string[]` to `viewerStore` (transient UI state). Single-select is `[id]`; multi-select is `[id1, id2, ...]`; nothing selected is `[]`.

**Selection Model — Visual (D-02):** Reuse `HoverRing` component with `opacity=1` and stroke color `#0078d4` (accent). Hover stays white/40%.

**Selection Model — Click Behavior (D-03):** Option C — placement always takes priority when a tool is active; pressing Escape exits the active markup tool and returns to `'select'` mode.

**Selection Model — Delete Key (D-04):** Both Delete-key and right-click context-menu Delete call the same `deleteMarkup` store action. Key handler reads `selectedMarkupIds[0]` from store and calls `deleteMarkup`.

**Selection Model — Empty Space Click (D-05):** Clicking empty canvas while in `'select'` mode deselects (clears `selectedMarkupIds` to `[]`).

**Rubber-Band Multi-Select (D-06):** In `'select'` mode, LMB drag on empty canvas draws the rubber-band rectangle. No modifier key required.

**Rubber-Band Containment (D-07):** Full bounding box of the markup must be entirely inside the rubber-band rectangle to be selected.

**Ctrl+A (D-08):** Selects all markups on the current page. Guarded by `isTextInputActive()`.

**Group Delete (D-09):** New `'delete-group'` MarkupCommand variant holding `Markup[]`. Single Ctrl+Z undo step.

**All Modals Centered + Draggable (D-10):** Global architectural rule — all current and future modals get centered+draggable treatment. Current scope: CalibrationDialog, MarkupNamePopup, ScalePopup, SaveCloseModal, OpenErrorModal, UncalibratedExportWarningModal, ArchiveCorruptedModal, DimensionMismatchModal, PageCountAbortModal.

**useDraggable Hook (D-11):** Hook returns `{ position, onPointerDown }`. Modal passes `onPointerDown` to its drag-handle element and applies `position` as a CSS offset.

**Drag Handle (D-12):** Drag anywhere on the modal that isn't an interactive control (input, button, select, textarea). No visual affordance.

**Backdrop Dismiss (D-13):** Backdrop click keeps current dismiss behavior for CalibrationDialog, MarkupNamePopup, ScalePopup.

**Position Reset on Open (D-14):** Position resets on every modal open (re-centers). No position memory.

**Ribbon — Full Replacement (D-15):** `Toolbar.tsx` is deleted and rebuilt from scratch.

**RibbonButton (D-16):** ~56–64px square, icon-above-label. New `RibbonButton` component distinct from `IconButton`.

**Home Tab (D-17):** Open, Save, Save As, Replace Plan PDF, Export — 1:1 migration of current left-side group.

**Page Tab (D-18):** Previous Page, Page N of M indicator, Next Page.

**Tools Tab (D-19):** Select (new), Count, Linear, Area, Perimeter, Wall, Set Scale. Chain badge chips remain on active tool. Scale context-menu chevron remains on Set Scale.

**View Tab (D-20):** Zoom In, Zoom Out, Fit to Window + Show/Hide Totals Panel toggle + Show All / Hide All markups.

**Estimating Tab (D-21):** Implementer discretion — may stub or surface Export.

**Settings Tab (D-22):** Stubbed — "Coming soon".

**Help Tab (D-23):** Stubbed — "Coming soon".

**Home Tab Default (D-24):** Home tab is active by default on app load.

**Double-Click Unchanged (D-25):** Double-click behavior unchanged — existing area/perimeter polygon close and linear/wall double-click commit remain as-is.

**Enter Key Commits (D-26):** Enter commits an in-progress Linear, Area, Perimeter, or Wall markup subject to minimum-point guard: silent ignore if < 2 points (linear/wall) or < 3 points (area/perimeter).

**isTextInputActive Guard (D-27):** The existing `isTextInputActive()` guard applies to the Enter key shortcut.

### Claude's Discretion

- Where `selectedMarkupIds` lives (recommendation: `viewerStore`) — may override if codebase warrants
- Selection ring visual approach — may vary if integrates more cleanly
- Exact `useDraggable` hook API — efficiency-first; may use thin `DraggableModal` wrapper instead
- Page tab and Estimating tab contents not fully specified — implementer has discretion within ribbon structure

### Deferred Ideas (OUT OF SCOPE)

- Markup drag/move (repositioning a selected markup)
- Resize handles / Konva Transformer
- Settings tab content (global unit preference)
- Help tab content (keyboard shortcut reference)
- Estimating tab detailed content (BOQ summary stats)
</user_constraints>

---

## Summary

Phase 9 bundles five independent UX improvements into a single delivery: selection model, rubber-band multi-select, draggable modals, ribbon toolbar, and Enter-key markup completion. The codebase is well-structured for this work — all five features compose cleanly on top of existing infrastructure without requiring new IPC channels, new packages, or new persistence concerns.

**Key finding:** `ActiveTool` already includes `'select'` in `viewer.ts:67` — no type extension needed for the tool union itself. `viewerStore` already sets `activeTool: 'select'` as its initial value. The `isMarkupTool` guard already correctly excludes `'select'`. This means Feature 1 (selection model) requires only store field additions, not type changes.

**Key finding:** `MarkupCommand` in `types/markup.ts` currently has four variants: `'place' | 'delete' | 'recolor-group' | 'edit-markup'`. Adding `'delete-group'` requires extending this union and adding a new `case` branch in the `undo()`/`redo()` switch in `markupStore.ts`. The switch currently falls through to `cmd.markup.page` for `'place'` and `'delete'` — the new branch must be added before that fallthrough.

**Key finding:** `HoverRing.tsx` already handles all five markup types (count/linear/area/perimeter/wall) and produces visually correct outlines at any zoom via zoom-compensated strokes. For selection display (D-02), passing `opacity=1` and stroke color `COLORS.accent` (`#0078d4`) with a dedicated `SelectionRing` wrapper (or extended props on `HoverRing`) will work without a new Konva component.

**Key finding:** `Toolbar.tsx` currently exports `ToolbarProps` with three callback props: `onOpenClick`, `onReplaceClick`, `onExportClick`. All three are owned by `App.tsx` and must be preserved in the new `RibbonToolbar` component's prop interface. The ribbon component replaces the import at `App.tsx:4` and the `<Toolbar .../>` usage at `App.tsx:244`.

**Primary recommendation:** Execute in five waves — Wave 0 (type extensions + store additions), Wave 1 (selection model + Enter-key), Wave 2 (draggable modals), Wave 3 (ribbon toolbar), Wave 4 (Show All/Hide All + UAT).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| selectedMarkupIds state | Frontend (Zustand viewerStore) | — | Transient UI state; already alongside activeTool in viewerStore |
| Click-to-select event routing | Frontend (CanvasViewport.tsx) | — | All Konva event handling lives here; onClick on Layer 1b markup renderers |
| Rubber-band rect rendering | Frontend (Konva Layer — new) | CanvasViewport state | Stage-space rect drawn during drag; containment math runs in CanvasViewport |
| Delete key handler | Frontend (useKeyboardShortcuts.ts) | markupStore | Reads selectedMarkupIds from viewerStore; dispatches deleteMarkup or deleteGroup |
| Group delete undo/redo | Frontend (markupStore.ts) | types/markup.ts | New 'delete-group' MarkupCommand variant; undo/redo switch extension |
| Modal drag positioning | Frontend (useDraggable hook) | Each modal component | Hook owns pointer capture; modal owns render position |
| Modal centering on open | Frontend (each modal component) | useDraggable hook | Reset via useEffect on visibility prop or key-based remount |
| Ribbon tab switching | Frontend (RibbonToolbar.tsx local state) | — | Tab is display-only UI state; no persistence needed |
| Show All / Hide All markups | Frontend (projectStore) | — | Calls setHiddenItemNames([])/setHiddenItemNames(allKeys); mirrors existing toggleHiddenItem |
| Enter-key markup commit | Frontend (CanvasViewport.tsx useEffect + useMarkupTool) | useKeyboardShortcuts | Commits via existing finishLinear/finishPolygon; guarded by isTextInputActive |

---

## Standard Stack

No new packages required. Phase 9 is renderer-only, using the existing stack.

| Library | Version | Purpose in Phase 9 |
|---------|---------|---------------------|
| react-konva / konva | 19.2.x / 10.2.x | Rubber-band rect shape (Konva `Rect`); click/drag events on Stage and Layer 1b shapes |
| zustand 5 | 5.0.12 | `viewerStore` extension for `selectedMarkupIds`; `projectStore.setHiddenItemNames` for Show/Hide All |
| lucide-react | existing | Icon source for ribbon buttons (MousePointer for Select, existing icons for all others) |

**Installation:** None required.

---

## Feature Research

### Feature 1: Selection Model (D-01 through D-09)

#### 1.1 ActiveTool and isMarkupTool

**Current state [VERIFIED: src/renderer/src/types/viewer.ts:67]:**
```typescript
export type ActiveTool = 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter', 'wall'] as const
export function isMarkupTool(tool: ActiveTool): tool is MarkupToolType {
  return (MARKUP_TOOLS as readonly string[]).includes(tool)
}
```

`'select'` is already in the union and already excluded from `MARKUP_TOOLS`. The type guard already works. **No changes to `viewer.ts` are required for the type system.**

**viewerStore initial state [VERIFIED: src/renderer/src/stores/viewerStore.ts:15]:**
```typescript
activeTool: 'select' as ActiveTool,
```

The store already defaults to `'select'`. The reset/hydrate paths also set `'select'`.

#### 1.2 Adding selectedMarkupIds to viewerStore

The `ViewerState` interface in `viewer.ts` must be extended with:
```typescript
selectedMarkupIds: string[]
setSelectedMarkupIds: (ids: string[]) => void
clearSelection: () => void
```

The `viewerStore.ts` implementation adds these fields to the Zustand store slice. Initial value `[]`.

**Key constraint:** `selectedMarkupIds` must be cleared:
- When `activeTool` changes to a markup tool (placement mode starts)
- On page navigation (`setPage`, `nextPage`, `prevPage`)
- On `resetViewer`

The cleanest approach is to clear selection inside `setActiveTool` when `isMarkupTool(tool)` is true, and inside `setPage`/`nextPage`/`prevPage`.

#### 1.3 Click-to-Select Event Flow

The selection event flow routes through `handleStageClick` in `CanvasViewport.tsx` at line 459. Current behavior:
1. Calibration path — returns early
2. Markup drawing/placing path — returns early
3. (Implicit) falls through to nothing if neither

For `'select'` mode, two new paths are needed:

**Path A: Click on a markup shape (onClick on Layer 1b renderers)**

Each markup renderer component (CountPinMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup, WallMarkup) needs an `onClick` prop. The event is routed from CanvasViewport which passes `onMarkupClick` (analogous to existing `onContextMenu`) to each renderer.

Event handler in CanvasViewport:
```typescript
const handleMarkupClick = useCallback((id: string) => {
  if (activeTool !== 'select') return // placement tools take priority (D-03)
  setSelectedMarkupIds([id])
}, [activeTool, setSelectedMarkupIds])
```

**Path B: Click on empty canvas (Stage onClick falls through when activeTool === 'select')**

Add to the end of `handleStageClick`:
```typescript
// 'select' mode: click on empty space deselects (D-05)
if (activeTool === 'select') {
  clearSelection()
}
```

Note: This fires only when the click did NOT hit a markup shape (because Konva propagates events from the shape upward to the stage, and the shape's `onClick` handler calling `e.cancelBubble = true` or checking `e.target` would stop propagation if needed). The safer pattern is to check `e.target === stage` or use a dedicated Layer 0 / Stage background click.

**Verified pattern from CanvasViewport.tsx:** The existing `handleStageClick` already checks `e.evt.button !== 0` to filter non-left-clicks (line 461). The new select-mode path should be appended at the end of this handler, guarded by `activeTool === 'select'` and `e.target === stageRef.current` (to confirm no markup shape was clicked, as shape onClick handlers do NOT currently call `e.cancelBubble`).

**Critical detail:** The markup renderers currently use `onMouseEnter`/`onMouseLeave`/`onContextMenu` on their Group/shape elements, but no `onClick`. Phase 9 adds `onClick` to all five renderers. The click must NOT fire when a markup tool is active (D-03) — filter in the handler in CanvasViewport, not in each renderer.

All five renderer files that need `onClick` prop added:
- `src/renderer/src/components/markup/CountPinMarkup.tsx`
- `src/renderer/src/components/markup/LinearMarkup.tsx`
- `src/renderer/src/components/markup/AreaMarkup.tsx`
- `src/renderer/src/components/markup/PerimeterMarkup.tsx`
- `src/renderer/src/components/WallMarkup.tsx` (note: different directory from others)

#### 1.4 Selection Ring Rendering

The selection ring reuses `HoverRing.tsx` patterns. A new `SelectionRing` component (or extended `HoverRing` props) renders in the same `Layer 2` transient territory in `CanvasViewport`.

**HoverRing implementation [VERIFIED: src/renderer/src/components/HoverRing.tsx]:**
- Handles all five markup types
- Zoom-compensated: `strokeWidth = STROKE_BASE_PX / currentZoom`, `offset = RING_OFFSET_PX / currentZoom`
- Outer ring sits `+4/currentZoom` OUTSIDE markup geometry
- `listening={false}` on all shapes

For selection display (D-02): `opacity=1.0` (vs hover's `0.4`), stroke color `COLORS.accent` (`#0078d4`).

The simplest approach is to add optional `opacity` and `color` props to `HoverRing` with defaults matching current behavior:
```typescript
export interface HoverRingProps {
  markups: Markup[]
  currentZoom: number
  opacity?: number    // default 0.4
  color?: string      // default '#ffffff'
}
```

This keeps a single Konva component and avoids new component surface.

The selection ring renders as a separate `<HoverRing>` call inside the existing `Layer 2` section in CanvasViewport, reading `selectedMarkupIds` from `viewerStore` and filtering `pageMarkups` to get the selected `Markup[]` objects.

**Layer ordering:** The existing Phase 6 overlay layer uses:
```typescript
{((props.hoverMatches?.length ?? 0) > 0 || (props.pulse != null)) && (
  <Layer listening={false}>...
```

The selection ring should be in a separate always-mounted `Layer listening={false}` that renders when `selectedMarkupIds.length > 0`. This avoids conditional layer mounting/unmounting issues.

#### 1.5 Rubber-Band Multi-Select (D-06, D-07)

The rubber-band rect is drawn during a `pointerdown → pointermove → pointerup` sequence on the Stage when `activeTool === 'select'`.

**Key distinction from pan:** Middle-mouse pans via DOM event listeners (locked decision from STATE.md). Left-mouse drag in `'select'` mode should draw rubber-band, not pan. The existing `useViewportControls` hook sets `isDraggable` on the Stage based on `spaceHeld` or middle-mouse. When `activeTool === 'select'` and no spacebar is held, `isDraggable` should be `false` (no pan on Stage left-drag).

**Implementation approach:**
- Local state in `CanvasViewport`: `rubberBand: { startX: number; startY: number; endX: number; endY: number } | null`
- `onMouseDown` on Stage: if `activeTool === 'select'`, capture the stage-space start point, set `rubberBand` state
- `onMouseMove` on Stage: update `rubberBand.endX/endY` while dragging
- `onMouseUp` on Stage: compute which markups are fully inside the rect, set `selectedMarkupIds`, clear `rubberBand`

The rubber-band rect is drawn in Konva `Layer 1a` (non-listening) as a `Rect` node with `stroke=COLORS.accent`, `strokeWidth=1/currentZoom`, `fill='rgba(0,120,212,0.1)'`, `listening={false}`.

**Stage-space coordinates:** Use `stage.getAbsoluteTransform().copy().invert().point(pointer)` — the established canonical pattern (STATE.md, also used in `screenToStagePoint` in `useMarkupTool.ts`).

#### 1.6 Bounding Box Computation for D-07 Containment

For each markup type, the bounding box in stage-space is:

| Markup Type | Bounding Box |
|-------------|-------------|
| CountMarkup | `{ minX: point.x - PIN_RADIUS_WORLD, maxX: point.x + PIN_RADIUS_WORLD, minY: point.y - PIN_RADIUS_WORLD, maxY: point.y + PIN_RADIUS_WORLD }` |
| LinearMarkup | `{ minX: min(points.x), maxX: max(points.x), minY: min(points.y), maxY: max(points.y) }` |
| AreaMarkup | Same as LinearMarkup (convex hull not needed; axis-aligned bbox is sufficient for D-07) |
| PerimeterMarkup | Same as LinearMarkup |
| WallMarkup | Same as LinearMarkup |

Note: `PIN_RADIUS_WORLD = 10` is defined at module scope in both `CountPinMarkup.tsx` and `HoverRing.tsx`. The rubber-band containment check should import or duplicate this constant. A shared constant in `src/renderer/src/lib/constants.ts` is cleaner.

**Containment test:**
```typescript
function isFullyInside(markup: Markup, band: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const { minX, maxX, minY, maxY } = getMarkupBBox(markup)
  const bx1 = Math.min(band.x1, band.x2)
  const bx2 = Math.max(band.x1, band.x2)
  const by1 = Math.min(band.y1, band.y2)
  const by2 = Math.max(band.y1, band.y2)
  return minX >= bx1 && maxX <= bx2 && minY >= by1 && maxY <= by2
}
```

#### 1.7 deleteGroup Action and MarkupCommand Extension

**Current MarkupCommand union [VERIFIED: src/renderer/src/types/markup.ts:52-77]:**
```typescript
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'recolor-group'; ... }
  | { type: 'edit-markup'; ... }
```

**New variant to add:**
```typescript
| { type: 'delete-group'; markups: Markup[] }
```

**MarkupStore extension needed:**
1. New action `deleteGroup(markups: Markup[]): void` — removes all markups from their respective pages, pushes one `'delete-group'` command.
2. `undo()` switch: add `if (cmd.type === 'delete-group')` branch — re-inserts all markups from `cmd.markups` back into their pages.
3. `redo()` switch: add `if (cmd.type === 'delete-group')` branch — removes all markups from `cmd.markups` by ID.

**Current undo switch structure [VERIFIED: src/renderer/src/stores/markupStore.ts:219-271]:**
```
if (cmd.type === 'recolor-group') { ... return }
if (cmd.type === 'edit-markup') { ... return }
const page = cmd.markup.page  // ← falls through to 'place'/'delete' handling
```

The new `'delete-group'` branch must be inserted BEFORE the `cmd.markup.page` fallthrough.

**Multi-page consideration:** Markups in a group delete may span multiple pages. The `undo` for `'delete-group'` must re-insert each markup into its correct `markup.page`.

#### 1.8 Ctrl+A Implementation

In `useKeyboardShortcuts.ts`, add:
```typescript
if (e.ctrlKey && e.key === 'a') {
  if (isTextInputActive()) return
  e.preventDefault()
  // Only when activeTool === 'select' and a PDF is loaded
  if (activeTool !== 'select' || totalPages === 0) return
  const currentPage = useViewerStore.getState().currentPage
  const allIds = useMarkupStore.getState().getMarkups(currentPage).map((m) => m.id)
  useViewerStore.getState().setSelectedMarkupIds(allIds)
  return
}
```

`isMarkupTool` guard is not strictly needed (Ctrl+A while drawing a linear is a no-op because `activeTool !== 'select'`), but the `isTextInputActive()` guard is mandatory per D-08.

#### 1.9 Delete Key Handler

```typescript
if (e.key === 'Delete') {
  if (isTextInputActive()) return
  const selectedIds = useViewerStore.getState().selectedMarkupIds
  if (selectedIds.length === 0) return
  const { pageMarkups } = useMarkupStore.getState()
  const currentPage = useViewerStore.getState().currentPage
  if (selectedIds.length === 1) {
    useMarkupStore.getState().deleteMarkup(currentPage, selectedIds[0])
  } else {
    // Collect Markup objects from all pages for group delete
    const allMarkups = Object.values(pageMarkups).flat()
    const toDelete = allMarkups.filter((m) => selectedIds.includes(m.id))
    useMarkupStore.getState().deleteGroup(toDelete)
  }
  useViewerStore.getState().clearSelection()
  return
}
```

**Important:** The Delete key handler must NOT conflict with text input Delete (character deletion). The `isTextInputActive()` guard handles this.

---

### Feature 2: Draggable Centered Modals (D-10 through D-14)

#### 2.1 Centering Strategy

**Current CalibrationDialog [VERIFIED: src/renderer/src/components/CalibrationDialog.tsx:51-66]:**
```typescript
<div style={{
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  ...backdrop
}}>
  <div style={{ ...modal content... }}>
```

CalibrationDialog already centers via CSS flexbox on the overlay. This is the correct pattern for all modals.

**Current MarkupNamePopup [VERIFIED: src/renderer/src/components/MarkupNamePopup.tsx:95-99]:**
```typescript
const popupStyle = useMemo(() => {
  const left = Math.min(Math.max(screenPos.x, 0), containerSize.width - POPUP_MIN_WIDTH)
  const top = Math.min(Math.max(screenPos.y, 0), containerSize.height - 240)
  return { left, top }
}, [screenPos, containerSize])
```

MarkupNamePopup uses `position: 'absolute'` with explicit `left/top` computed from `screenPos` — NOT centered. This component needs conversion to a centered overlay pattern (like CalibrationDialog) plus the `useDraggable` hook.

**Modals that already use the overlay + centered pattern:**
- CalibrationDialog — overlay div with `alignItems: center, justifyContent: center`
- SaveCloseModal, OpenErrorModal, UncalibratedExportWarningModal, ArchiveCorruptedModal, DimensionMismatchModal, PageCountAbortModal — these are in App.tsx; need to check their positioning

**Modals that need conversion from positioned to centered:**
- MarkupNamePopup (screenPos-based left/top positioning)
- ScalePopup (likely also screenPos-based — verify)

#### 2.2 useDraggable Hook

```typescript
interface DragPosition { x: number; y: number }
interface UseDraggableReturn {
  position: DragPosition | null  // null = use default centering (CSS handles it)
  onPointerDown: (e: React.PointerEvent) => void
}

function useDraggable(): UseDraggableReturn {
  const [position, setPosition] = useState<DragPosition | null>(null)
  const dragStart = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Skip if target is an interactive control (D-12)
    const tag = (e.target as HTMLElement).tagName
    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = position ?? { x: 0, y: 0 } // 0,0 means centered (transform: translate) offset
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y }
  }, [position])

  // pointermove and pointerup registered on window during drag
  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      setPosition({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy })
    }
    const onUp = (): void => { dragStart.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return { position, onPointerDown }
}
```

**Position reset on every open (D-14):** The hook is called inside each modal component. When the modal mounts, `useState(null)` initializes to `null` (centered). When the modal unmounts and remounts (closed → opened), the state resets automatically. This satisfies D-14 without any additional mechanism.

**CSS integration:** When `position === null`, the modal uses the natural centering from the flex overlay. When `position !== null`, the modal applies:
```typescript
transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
```
Combined with the overlay's `position: absolute; left: 50%; top: 50%;` positioning on the modal inner div (changing from the flex-center approach to explicit 50%/50% + transform).

#### 2.3 Modal Scope — Exact List

All modals in App.tsx that render over a backdrop [VERIFIED: src/renderer/src/App.tsx]:
1. `OpenErrorModal` — line 376
2. `UncalibratedExportWarningModal` — line 389
3. `ArchiveCorruptedModal` — line 416
4. `PageCountAbortModal` — line 429
5. `DimensionMismatchModal` — line 441
6. `SaveCloseModal` — line 452

Modals rendered inside CanvasViewport:
7. `ScalePopup` (CalibrationDialog is the inner content inside ScalePopup or separate?)
8. `MarkupNamePopup` (three call sites in CanvasViewport: count-pre, save-after, edit)
9. `CalibrationDialog` — need to verify current rendering location

Each of these must receive the `useDraggable` hook treatment.

**Drag handle rule (D-12):** The `onPointerDown` handler is attached to the modal's outermost content div (not the backdrop). Interactive children (input, button, select, textarea) naturally stop event propagation at the pointer capture step because the check is on `e.target.tagName`.

---

### Feature 3: Ribbon Toolbar (D-15 through D-24)

#### 3.1 Toolbar.tsx — Exact Props to Preserve

**ToolbarProps [VERIFIED: src/renderer/src/components/Toolbar.tsx:98-118]:**
```typescript
export interface ToolbarProps {
  onOpenClick: () => void | Promise<void>
  onReplaceClick: () => void | Promise<void>
  onExportClick: () => void | Promise<void>
}
```

The new `RibbonToolbar` component must accept the same three callback props. The import in `App.tsx:4` (`import { Toolbar }`) and usage at `App.tsx:244-248` are the only two callsites — update both atomically.

#### 3.2 Internal State and Store Access

All state the current Toolbar reads [VERIFIED: src/renderer/src/components/Toolbar.tsx:121-149]:

| State | Source |
|-------|--------|
| `totalPages`, `currentPage`, `nextPage`, `prevPage` | `useViewerStore()` |
| `getViewport` | `useViewerStore` selector |
| `activeTool`, `setActiveTool` | `useViewerStore` selectors |
| `getScale`, `calibMode` | `useScaleStore` |
| `saveProject`, `saveProjectAs` | `useProject()` |
| `isSaving` | `useProjectStore` selector |
| `isExporting` | `useProjectStore` selector |
| `hasMarkups` | `useMarkupStore` selector |
| `getCanvasControls`, `getCalibrationControls`, `getChainArmedItem` | module-level refs from `CanvasViewport` |

The ribbon component has access to all the same hooks and refs. No new wiring is needed.

**Tab switching state:** Local `useState<string>('home')` inside `RibbonToolbar`. Initialized to `'home'` (D-24). Tab state is ephemeral UI — no persistence, no store coupling.

#### 3.3 RibbonButton Component

```typescript
interface RibbonButtonProps {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children?: React.ReactNode  // for badge chips and chevron
}

function RibbonButton({ icon: Icon, label, onClick, active, disabled, children }: RibbonButtonProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        width: 60, height: 60,  // ~56–64px square per D-16
        gap: 4,
        background: active ? COLORS.activeSurface : 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        borderRadius: 4,
        color: disabled ? COLORS.textSecondary : COLORS.textPrimary,
        fontSize: 11, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative'  // for badge positioning
      }}
    >
      <Icon size={20} />
      <span>{label}</span>
      {children}
    </button>
  )
}
```

Distinct from existing `IconButton` (28px height, horizontal layout) — these are taller square buttons.

#### 3.4 Chain Badge Chips in Ribbon

The current chain badge chip is rendered inside `IconButton` in `Toolbar.tsx` as `children` when `activeTool === tool && getChainArmedItem() !== null`. In the ribbon, this moves to `RibbonButton`'s `children` prop, using the same `getChainArmedItem()` module-level ref (no prop drilling).

**Force re-render:** `getChainArmedItem()` is a module-level ref — not reactive. The existing Toolbar uses a polling/re-render-triggered pattern. The ribbon must use the same approach: read `getChainArmedItem()` during render (it's called inside the component render path, so it re-evaluates whenever the component re-renders due to `activeTool` changes).

#### 3.5 Scale Context-Menu Chevron in Ribbon

The Set Scale button in the Tools tab needs the chevron (▾) child element that opens `ScaleContextMenu` on click. This is exactly the pattern at `Toolbar.tsx:334-353`. The ribbon simply migrates this child element into the `RibbonButton` for Set Scale, using the same `handleChevronClick` and `openContextMenu` logic.

#### 3.6 Show All / Hide All (D-20 View Tab)

**Current visibility state [VERIFIED: src/renderer/src/stores/projectStore.ts:12-29]:**
- `hiddenItemNames: string[]` — persisted in .clmc
- `hiddenItemSet: Set<string>` — derived in-memory O(1) lookup
- `toggleHiddenItem(name: string)` — flips one item
- `setHiddenItemNames(names: string[])` — sets atomically (used by hydrate)

The composite key format is `"name|categoryId"` [VERIFIED: CountPinMarkup.tsx:42, WallMarkup.tsx implied].

**Show All:**
```typescript
useProjectStore.getState().setHiddenItemNames([])
useProjectStore.getState().markDirty()
```

**Hide All:** Must collect all unique `"name|categoryId"` keys from all markup items across all pages:
```typescript
const { pageMarkups } = useMarkupStore.getState()
const allKeys = Array.from(new Set(
  Object.values(pageMarkups).flat().map((m) => `${m.name}|${m.categoryId}`)
))
useProjectStore.getState().setHiddenItemNames(allKeys)
useProjectStore.getState().markDirty()
```

Note: `setHiddenItemNames` does NOT call `markDirty()` internally (it's designed for hydration). The ribbon handler must call `markDirty()` explicitly after.

#### 3.7 Ribbon Panel Height

The current toolbar height is 40px (`LAYOUT.toolbarHeight = 40` in constants.ts). The ribbon requires at minimum two rows: the tab strip + the ribbon panel. The tab strip is ~28-32px; the ribbon panel for the icon-above-label buttons at 60px height needs ~68-72px total panel height. The full ribbon block (tab strip + panel) is ~96-104px.

`LAYOUT.toolbarHeight` must be updated or the ribbon renders with its own height divorced from `LAYOUT.toolbarHeight`. The cleaner approach: give the Ribbon component its own height (not governed by the constant, since the constant is only used for `LAYOUT` reference calculations not layout itself). Check StatusBar and CanvasHeaderBar for any dependency on `LAYOUT.toolbarHeight` before deciding.

**StatusBar [VERIFIED: src/renderer/src/lib/constants.ts:29]:** `toolbarHeight: 40` is in the `LAYOUT` export but needs to be checked for actual consumers.

---

### Feature 4: Markup Completion via Enter Key (D-25 through D-27)

#### 4.1 Current Commit Mechanism

**finishLinear [VERIFIED: src/renderer/src/hooks/useMarkupTool.ts:208-249]:**
- Sets mode to `'confirming'`, clears preview, places popup
- Drops trailing duplicate click that preceded dblclick (Pitfall 1 guard)
- Guards: `toolType must be 'linear' or 'wall'`, `mode must be 'drawing'`, `points.length >= 2`

**finishPolygon [VERIFIED: src/renderer/src/hooks/useMarkupTool.ts:251-277]:**
- Sets mode to `'confirming'`, clears preview, places popup at centroid
- Guards: `toolType must be 'area' or 'perimeter'`, `mode must be 'drawing'`, `points.length >= 3`

**handleStageDblClick [VERIFIED: src/renderer/src/components/CanvasViewport.tsx:513-519]:**
```typescript
const handleStageDblClick = useCallback((_e) => {
  if ((markupState.toolType === 'linear' || markupState.toolType === 'wall') && markupState.mode === 'drawing') {
    finishLinear()
  }
}, [markupState.toolType, markupState.mode, finishLinear])
```

Note: `finishPolygon` for area/perimeter is triggered by clicking the start vertex (polygon close detection), not via dblclick. The `handleStageDblClick` only covers linear/wall.

#### 4.2 Enter Key Hook-Up

The Enter key commit for in-progress markup should be added in the existing `CanvasViewport.tsx` keyboard listener (the `Escape` key useEffect at line 312-329), NOT in `useKeyboardShortcuts.ts`. This is because:
1. The commit functions (`finishLinear`, `finishPolygon`) are local to `CanvasViewport` and not passed down.
2. The `markupState` is local to `CanvasViewport`.
3. `useKeyboardShortcuts.ts` is app-level and doesn't have access to these.

**Implementation in CanvasViewport.tsx — extend the existing Escape handler:**

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // ... existing code ...
    }
    // D-26: Enter key commits in-progress markup
    if (e.key === 'Enter') {
      if (isTextInputActive()) return  // D-27 guard
      if (markupState.mode !== 'drawing') return
      if (markupState.toolType === 'linear' || markupState.toolType === 'wall') {
        if (markupState.points.length >= 2) {
          e.preventDefault()
          finishLinear()
        }
        // else: silent ignore (D-26 minimum-point guard)
      } else if (markupState.toolType === 'area' || markupState.toolType === 'perimeter') {
        if (markupState.points.length >= 3) {
          e.preventDefault()
          finishPolygon()
        }
        // else: silent ignore
      }
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [markupState.mode, markupState.toolType, markupState.points.length, cancelMarkup, finishLinear, finishPolygon])
```

**Why not in useKeyboardShortcuts.ts:** The keyboard shortcuts hook doesn't have access to `markupState`, `finishLinear`, or `finishPolygon`. Adding them would require passing these via the `handlers` interface — a larger change than simply extending the existing CanvasViewport keydown handler.

**Chain mode interaction:** After `finishLinear`/`finishPolygon`, if `chainArmed` is true, `CanvasViewport.tsx` already handles the chain auto-commit via the useEffect at line 343-364. The Enter key path calls the same `finishLinear`/`finishPolygon` functions, so chain mode works identically.

**MarkupNamePopup Enter key (existing behavior must be preserved):** MarkupNamePopup already has its own `handleKeyDown` that confirms on Enter (line 126-134). The global Enter handler in CanvasViewport must NOT fire while the popup is open. The `isTextInputActive()` guard handles this because when the popup is open, the name input is focused (auto-focus via `useEffect` at line 93).

---

## Architecture Patterns

### System Architecture Diagram

```
User Input
│
├─ Click on markup shape (Layer 1b) ──► handleMarkupClick ──► setSelectedMarkupIds([id])
│
├─ Click on empty Stage ──────────────► handleStageClick → activeTool==='select' ──► clearSelection()
│
├─ LMB drag on Stage (select mode) ──► rubberBand state ──► containment check ──► setSelectedMarkupIds(ids)
│
├─ Delete key ────────────────────────► useKeyboardShortcuts ──► deleteMarkup OR deleteGroup
│
├─ Ctrl+A ────────────────────────────► useKeyboardShortcuts ──► setSelectedMarkupIds(allIds)
│
├─ Enter key (drawing mode) ──────────► CanvasViewport keydown ──► finishLinear/finishPolygon
│
├─ Modal drag (pointer events) ───────► useDraggable hook ──► position state ──► CSS transform
│
└─ Ribbon tab click ──────────────────► RibbonToolbar local state ──► activeTab ──► panel render
```

### Recommended Project Structure (Phase 9 additions)

```
src/renderer/src/
├── hooks/
│   ├── useDraggable.ts          # NEW — modal drag hook
│   └── useKeyboardShortcuts.ts  # MODIFY — add Delete, Enter (no, Enter stays in Canvas), Ctrl+A
├── components/
│   ├── Toolbar.tsx              # DELETE (replaced by RibbonToolbar)
│   ├── RibbonToolbar.tsx        # NEW — full ribbon component
│   ├── HoverRing.tsx            # MODIFY — add optional color/opacity props for selection ring
│   ├── CanvasViewport.tsx       # MODIFY — selection click, rubber-band, Enter key, selection ring render
│   ├── markup/
│   │   ├── CountPinMarkup.tsx   # MODIFY — add onClick prop
│   │   ├── LinearMarkup.tsx     # MODIFY — add onClick prop
│   │   ├── AreaMarkup.tsx       # MODIFY — add onClick prop
│   │   └── PerimeterMarkup.tsx  # MODIFY — add onClick prop
│   ├── WallMarkup.tsx           # MODIFY — add onClick prop
│   ├── CalibrationDialog.tsx    # MODIFY — add useDraggable
│   ├── MarkupNamePopup.tsx      # MODIFY — add centering + useDraggable
│   ├── ScalePopup.tsx           # MODIFY — add useDraggable
│   ├── SaveCloseModal.tsx       # MODIFY — add useDraggable
│   ├── OpenErrorModal.tsx       # MODIFY — add useDraggable
│   ├── UncalibratedExportWarningModal.tsx  # MODIFY — add useDraggable
│   ├── ArchiveCorruptedModal.tsx           # MODIFY — add useDraggable
│   ├── DimensionMismatchModal.tsx          # MODIFY — add useDraggable
│   └── PageCountAbortModal.tsx            # MODIFY — add useDraggable
├── stores/
│   └── viewerStore.ts           # MODIFY — add selectedMarkupIds, setSelectedMarkupIds, clearSelection
├── types/
│   ├── viewer.ts                # MODIFY — extend ViewerState with selectedMarkupIds fields
│   └── markup.ts                # MODIFY — add 'delete-group' to MarkupCommand union
└── App.tsx                      # MODIFY — import RibbonToolbar instead of Toolbar
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer capture for drag | Manual mouse tracking with mousedown/mousemove | `element.setPointerCapture(e.pointerId)` | Handles pointer leaving window, multi-pointer conflicts automatically |
| Rubber-band selection math | Custom intersection algorithm | Axis-aligned bounding box containment (simple min/max comparison) | D-07 requires full containment, not partial — AABB is sufficient and correct |
| Modal centering | Calculating viewport center manually | CSS `position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)` | Works at any container size without JavaScript |
| Bounding box for Konva shapes | Konva's built-in `getClientRect()` | Manual min/max over points array | `getClientRect()` requires a stage reference and returns CSS-pixel space, not stage-space — manual is simpler and stage-space aligned |

---

## Common Pitfalls

### Pitfall 1: Markup Renderer onClick Fires in Drawing Mode
**What goes wrong:** User clicks to place a linear vertex, but the click hits an existing markup and triggers selection instead of placement.
**Why it happens:** The `onClick` prop on markup renderers fires before Stage `onClick`, stopping propagation and selecting the markup instead of recording the vertex.
**How to avoid:** In `handleMarkupClick` in CanvasViewport, guard with `if (activeTool !== 'select') return` — placement tools always take priority (D-03). This ensures any click while a markup tool is active is ignored by the selection handler.
**Warning signs:** Click during linear drawing selects an old markup instead of adding a vertex.

### Pitfall 2: Rubber-Band Starts Pan Instead of Drawing Rectangle
**What goes wrong:** Left-click drag on Stage in `'select'` mode activates Konva's built-in Stage drag (pan behavior).
**Why it happens:** `isDraggable` is still `true` when activeTool is `'select'` and no spacebar is held.
**How to avoid:** In `useViewportControls`, the `isDraggable` calculation must return `false` when `activeTool === 'select'` (no spacebar). Currently it only accounts for `spaceHeld` and middle-mouse. Add a check: if activeTool is `'select'` and not spaceHeld, `isDraggable = false`.
**Warning signs:** Dragging on empty canvas pans instead of drawing a rubber-band rect.

### Pitfall 3: delete-group Undo Switch Fallthrough
**What goes wrong:** Undoing a group delete calls `cmd.markup.page` on a `'delete-group'` command that has `markups` (array) not `markup` (single).
**Why it happens:** The undo switch in markupStore falls through to `const page = cmd.markup.page` if the new branch is not added before the fallthrough line.
**How to avoid:** Add the `'delete-group'` branch BEFORE the `cmd.markup.page` line (currently at markupStore.ts:259).
**Warning signs:** TypeScript will catch `cmd.markup` on a `'delete-group'` command at compile time — the union type will error. If ignored, runtime crash on undo.

### Pitfall 4: MarkupNamePopup Centering Regression
**What goes wrong:** After converting MarkupNamePopup from `screenPos`-based to centered overlay, the popup appears behind the canvas instead of over it.
**Why it happens:** MarkupNamePopup currently uses `position: 'absolute'` with left/top computed from screenPos, within the CanvasViewport container. Converting to a full-overlay centered modal changes its stacking context.
**How to avoid:** The overlay div must have `zIndex: 10` (matching the existing `containerStyle.zIndex: 10`). The overlay replaces the screenPos-based positioning entirely — the `screenPos` and `containerSize` props become unnecessary for MarkupNamePopup once it centers via CSS.
**Warning signs:** Popup is invisible or appears in wrong location during markup placement.

### Pitfall 5: Enter Key Fires in MarkupNamePopup Inputs
**What goes wrong:** Pressing Enter while typing a markup name in the popup commits the in-progress markup drawing AND submits the popup form — double action.
**Why it happens:** The global Enter key handler in CanvasViewport fires alongside the popup's `handleKeyDown`.
**How to avoid:** `isTextInputActive()` guard prevents the global handler from firing when the popup's name input is focused. The popup's own `handleKeyDown` (onKeyDown on the dialog div) handles Enter for form submission. These two are independent and correctly gated.
**Warning signs:** Entering a name fires both the popup confirm AND attempts to commit the shape.

### Pitfall 6: Chain Badge Rendering Regression in Ribbon
**What goes wrong:** Chain badge chips appear on the wrong tool button or disappear entirely after ribbon replacement.
**Why it happens:** `getChainArmedItem()` is a module-level ref — it returns the currently armed item regardless of which tool is active. In the old Toolbar, the chip is shown only when `activeTool === tool && getChainArmedItem() !== null`. This guard must be replicated in the ribbon.
**How to avoid:** Each tool's `RibbonButton` in the Tools tab renders the badge chip conditioned on `activeTool === 'count'` (or respective tool name) AND `getChainArmedItem() !== null`.
**Warning signs:** Badge chip appears on all tool buttons simultaneously, or disappears.

### Pitfall 7: Show All / Hide All Does Not Mark Project Dirty
**What goes wrong:** Show All / Hide All changes markup visibility but the project is not marked as modified, so the change is lost on close without save.
**Why it happens:** `setHiddenItemNames` does not call `markDirty()` — it's designed for hydration (load-time). The ribbon handler must call `markDirty()` explicitly.
**How to avoid:** In the ribbon's Show All / Hide All handlers, call `useProjectStore.getState().markDirty()` after `setHiddenItemNames(...)`.
**Warning signs:** Visibility changes disappear on project reload even though user expected to see them saved.

### Pitfall 8: useDraggable pointermove Listener Leaking
**What goes wrong:** After a modal closes, pointermove events continue to fire and drag ghost position.
**Why it happens:** The `pointermove`/`pointerup` listeners registered in the `useDraggable` useEffect are not cleaned up on unmount.
**How to avoid:** Return cleanup function from useEffect: `return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }`. This is the same pattern as the Splitter component (STATE.md confirms "Splitter registers pointermove + pointerup on window... both listeners removed atomically in onUp").
**Warning signs:** Modals drift position after close/reopen cycles; window event listeners accumulate in dev tools.

### Pitfall 9: Rubber-Band Flickers During Rendering
**What goes wrong:** The rubber-band rectangle flickers or causes excessive re-renders because the drag state updates at mousemove frequency.
**Why it happens:** React re-renders on every `setRubberBand` call during drag, which fires at 60fps.
**How to avoid:** Use `useRef` for the rubber-band state during drag and only call `setState` (for the Konva `Rect`) when a frame is committed. Alternatively, use a `useRef` to track drag start and update a separate Konva `Rect` node directly via `rectRef.current?.setAttrs(...)` to avoid React re-renders during drag. The simpler approach for this codebase is to use `useState` — 60fps re-renders are acceptable for a single `Rect` shape.

---

## Code Examples

### MarkupCommand Extension

```typescript
// src/renderer/src/types/markup.ts — add to MarkupCommand union
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'delete-group'; markups: Markup[] }  // NEW (D-09)
  | { type: 'recolor-group'; ... }
  | { type: 'edit-markup'; ... }
```

### deleteGroup Store Action

```typescript
// src/renderer/src/stores/markupStore.ts
deleteGroup: (markups: Markup[]) =>
  set((s) => {
    const idSet = new Set(markups.map((m) => m.id))
    const nextPageMarkups = { ...s.pageMarkups }
    for (const p of Object.keys(nextPageMarkups).map(Number)) {
      nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
    }
    return {
      pageMarkups: nextPageMarkups,
      undoStack: pushCommand(s.undoStack, { type: 'delete-group', markups }),
      redoStack: []
    }
  }),
```

### undo Branch for delete-group

```typescript
// Insert BEFORE the `const page = cmd.markup.page` line in markupStore.ts undo()
if (cmd.type === 'delete-group') {
  const nextPageMarkups = { ...s.pageMarkups }
  for (const m of cmd.markups) {
    nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
  }
  return {
    pageMarkups: nextPageMarkups,
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}
```

### viewerStore Extension

```typescript
// src/renderer/src/types/viewer.ts — add to ViewerState
selectedMarkupIds: string[]
setSelectedMarkupIds: (ids: string[]) => void
clearSelection: () => void

// src/renderer/src/stores/viewerStore.ts — add to initial state and implementation
selectedMarkupIds: [],
setSelectedMarkupIds: (ids) => set({ selectedMarkupIds: ids }),
clearSelection: () => set({ selectedMarkupIds: [] }),
// Also clear in setPage, nextPage, prevPage, resetViewer, hydrate
```

### Selection Ring in CanvasViewport

```typescript
// Inside the Stage in CanvasViewport.tsx, after existing Layer 2:
{selectedMarkupIds.length > 0 && (
  <Layer listening={false}>
    <HoverRing
      markups={pageMarkups.filter((m) => selectedMarkupIds.includes(m.id))}
      currentZoom={currentZoom}
      color={COLORS.accent}
      opacity={1.0}
    />
  </Layer>
)}
```

---

## Wave Structure Recommendation

### Wave 0 — Foundation (prerequisite for all other waves)

Changes that unblock everything else. Must complete before any other wave.

1. **09-00-PLAN.md** — Type and store extensions:
   - `types/markup.ts`: Add `'delete-group'` to `MarkupCommand` union
   - `types/viewer.ts`: Add `selectedMarkupIds`, `setSelectedMarkupIds`, `clearSelection` to `ViewerState`
   - `stores/viewerStore.ts`: Implement the new fields; clear selection in `setPage`/`nextPage`/`prevPage`/`resetViewer`/`hydrate`
   - `stores/markupStore.ts`: Implement `deleteGroup` action; add `'delete-group'` branch to `undo`/`redo`
   - RED test stubs for the new store actions

### Wave 1 — Selection Model (parallel-safe; blocked on Wave 0)

2. **09-01-PLAN.md** — Click-to-select and selection ring:
   - Add `onClick` prop to all 5 markup renderers (CountPinMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup, WallMarkup)
   - Extend `HoverRing` with optional `color`/`opacity` props
   - `CanvasViewport.tsx`: add `handleMarkupClick`, route to `setSelectedMarkupIds`; add empty-space deselect in `handleStageClick`; render selection ring layer
   - `useKeyboardShortcuts.ts`: add Delete key and Ctrl+A handlers

3. **09-02-PLAN.md** — Rubber-band multi-select:
   - `CanvasViewport.tsx`: rubber-band state, `onMouseDown`/`onMouseMove`/`onMouseUp` on Stage, containment math, rubber-band Rect in Layer 1a
   - Update `useViewportControls` `isDraggable` logic for select mode
   - Verify group delete via Delete key fires `deleteGroup`

### Wave 2 — Enter Key Commit (parallel-safe with Wave 1; blocked on Wave 0)

4. **09-03-PLAN.md** — Enter key markup completion:
   - Extend the existing Escape key useEffect in `CanvasViewport.tsx` to also handle Enter
   - Add minimum-point guards per D-26
   - Verify `isTextInputActive()` guard
   - Manual smoke test: draw linear with 2+ points, press Enter → popup appears; draw with 1 point, press Enter → silent ignore

### Wave 3 — Draggable Modals (parallel-safe with Waves 1–2; blocked on Wave 0)

5. **09-04-PLAN.md** — `useDraggable` hook + modal retrofit:
   - Create `src/renderer/src/hooks/useDraggable.ts`
   - Apply to CanvasViewport-hosted modals: `CalibrationDialog`, `MarkupNamePopup` (all three modes), `ScalePopup`
   - Apply to App.tsx-hosted modals: `SaveCloseModal`, `OpenErrorModal`, `UncalibratedExportWarningModal`, `ArchiveCorruptedModal`, `DimensionMismatchModal`, `PageCountAbortModal`
   - Convert MarkupNamePopup from screenPos-based to overlay-centered pattern

### Wave 4 — Ribbon Toolbar (blocked on Wave 0; parallel-safe with Waves 1–3)

6. **09-05-PLAN.md** — Ribbon toolbar build:
   - Create `src/renderer/src/components/RibbonToolbar.tsx` with `RibbonButton` subcomponent
   - Implement all 7 tabs: Home, Page, Tools, View, Estimating (stub or Export), Settings (stub), Help (stub)
   - Migrate all existing toolbar functionality into correct tabs
   - Add Select tool button to Tools tab
   - Implement Show All / Hide All in View tab
   - Implement Show/Hide Totals Panel toggle in View tab
   - Update `App.tsx`: replace `Toolbar` import/usage with `RibbonToolbar`
   - Delete `Toolbar.tsx`

### Wave 5 — UAT and Closure (blocked on Waves 1–4)

7. **09-06-PLAN.md** — Manual UAT and phase closure

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test -- --run` |

### Phase 9 Test Coverage Plan

| Feature | Behavior | Test Type | Automated Command | Notes |
|---------|----------|-----------|-------------------|-------|
| deleteGroup action | Removes all markups from multiple pages, pushes one 'delete-group' command | unit | `npm run test -- markupStore` | Wave 0 RED stub |
| deleteGroup undo | Re-inserts all markups to correct pages | unit | `npm run test -- markupStore` | Wave 0 RED stub |
| deleteGroup redo | Re-removes all markups | unit | `npm run test -- markupStore` | Wave 0 RED stub |
| selectedMarkupIds init | viewerStore initializes to [] | unit | `npm run test -- viewerStore` | Wave 0 RED stub |
| clearSelection on page change | Navigating page clears selection | unit | `npm run test -- viewerStore` | Wave 0 RED stub |
| isTextInputActive guard | Delete key does nothing when input focused | unit | existing test pattern | Reuse spacebar-text-guard.test.ts pattern |
| Ctrl+A selects all on page | All markup IDs collected | unit | `npm run test -- shortcuts` | Wave 1 |
| useDraggable position reset | Hook resets to null on mount | unit | `npm run test -- useDraggable` | Wave 3 |
| useDraggable listener cleanup | No event listener leak on unmount | unit | `npm run test -- useDraggable` | Wave 3 |
| Enter key min-point guard | < 2 pts linear: silent ignore | unit | `npm run test -- useMarkupTool` or CanvasViewport | Wave 2 |
| Enter key min-point guard | < 3 pts area: silent ignore | unit | same | Wave 2 |

### Wave 0 Test Stubs Needed

- `src/tests/delete-group-command.test.ts` — covers deleteGroup action, undo, redo
- `src/tests/viewer-store-selection.test.ts` — covers selectedMarkupIds init, setSelectedMarkupIds, clearSelection, page-change clear
- `src/tests/use-draggable.test.ts` — covers useDraggable position init, pointer move, reset on mount, listener cleanup

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is renderer-only; no external tools, services, CLIs, or runtimes beyond the existing project stack are required.

---

## Security Domain

No new attack surface introduced — no new IPC channels, no new user inputs that reach main process, no new file system operations. Phase 9 is entirely renderer-layer interaction logic.

ASVS V5 Input Validation: The rubber-band containment math uses client-side coordinates already validated by Konva's Stage transform. The group delete operates on `Markup[]` objects already in the store (user cannot inject arbitrary IDs). No additional validation needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ScalePopup` uses screenPos-based positioning (like MarkupNamePopup) and needs conversion to centered overlay | Feature 2 | If ScalePopup already uses flexbox centering, no conversion needed — smaller change |
| A2 | App.tsx-hosted modals (SaveCloseModal, OpenErrorModal, etc.) are already fullscreen overlays with flexbox centering | Feature 2 | If they use fixed pixel positions, the useDraggable integration needs adjustment |
| A3 | `useViewportControls`'s `isDraggable` logic is the correct layer to gate rubber-band vs pan | Feature 1 | If isDraggable is computed elsewhere, the gating must move |
| A4 | `LAYOUT.toolbarHeight` in constants.ts is not used for layout calculations that would break if ribbon height changes | Feature 3 | If something depends on 40px toolbar height for layout math, the new ribbon height will cause layout issues |

---

## Open Questions

1. **ScalePopup centering** — Is ScalePopup a screenPos-based popup (like MarkupNamePopup) or a full-overlay modal (like CalibrationDialog)? The answer determines whether it needs full conversion or just the draggable hook. Read `ScalePopup.tsx` before planning D-10 scope.

2. **Estimating tab content** — D-21 leaves this to implementer discretion. Options: (a) duplicate Export button, (b) BOQ summary stats from `useBoqLive`, (c) empty with "More features coming soon". Stub is safest.

3. **LAYOUT.toolbarHeight consumers** — Verify no component reads `LAYOUT.toolbarHeight` to compute layout geometry. If `StatusBar` or `CanvasHeaderBar` depends on this constant, the ribbon height change requires updating those calculations.

---

## Sources

### Primary (HIGH confidence — verified in this session against actual codebase)

- `src/renderer/src/types/viewer.ts` — ActiveTool union (line 67), isMarkupTool guard (line 72-74), ViewerState interface
- `src/renderer/src/types/markup.ts` — MarkupCommand discriminated union (lines 52-77)
- `src/renderer/src/stores/markupStore.ts` — deleteMarkup (lines 113-123), undo switch structure (lines 214-271)
- `src/renderer/src/stores/viewerStore.ts` — activeTool initial value (line 15), setActiveTool (line 93)
- `src/renderer/src/stores/projectStore.ts` — toggleHiddenItem, setHiddenItemNames, hiddenItemSet (lines 82-95)
- `src/renderer/src/components/CanvasViewport.tsx` — full file; handleStageClick (line 459), handleStageDblClick (line 513), Layer structure, module-level refs
- `src/renderer/src/components/HoverRing.tsx` — full file; all five markup type branches
- `src/renderer/src/components/Toolbar.tsx` — ToolbarProps (line 98-118), all internal state/hook usage
- `src/renderer/src/components/CalibrationDialog.tsx` — overlay centering pattern (lines 51-66)
- `src/renderer/src/components/MarkupNamePopup.tsx` — screenPos-based positioning (lines 95-99)
- `src/renderer/src/hooks/useMarkupTool.ts` — finishLinear (208-249), finishPolygon (251-277), commitShape (279-360)
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — isTextInputActive (lines 26-41), existing handler structure
- `src/renderer/src/App.tsx` — Toolbar usage (line 244-248), all modal callsites
- `src/renderer/src/lib/constants.ts` — COLORS tokens, LAYOUT.toolbarHeight

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Key Decisions Locked, Critical Pitfalls, module-level ref pattern
- `.planning/phases/09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion/09-CONTEXT.md` — all 27 locked decisions

---

## Metadata

**Confidence breakdown:**
- Selection model: HIGH — all affected files read; event flow verified; type union verified
- Store extensions: HIGH — MarkupCommand union verified; undo/redo switch structure verified
- Draggable modals: HIGH — CalibrationDialog centering pattern verified; MarkupNamePopup positioning verified
- Ribbon toolbar: HIGH — ToolbarProps verified; all internal state sources verified; chain badge pattern verified
- Enter key: HIGH — finishLinear/finishPolygon call signatures verified; existing keyboard handler structure verified

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable stack — no fast-moving dependencies)
