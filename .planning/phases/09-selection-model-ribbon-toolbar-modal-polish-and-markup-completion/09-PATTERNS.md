# Phase 9: Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 24 (9 new + 15 modified)
**Analogs found:** 24 / 24

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/hooks/useDraggable.ts` | hook | event-driven | `src/renderer/src/hooks/useMarkupHighlight.ts` + `useViewportControls.ts` | role-match (state + window event listener + cleanup) |
| `src/renderer/src/components/RibbonButton.tsx` | component | request-response | `src/renderer/src/components/Toolbar.tsx` `IconButton` (lines 29-96) | exact (same button shape, taller variant) |
| `src/renderer/src/components/RibbonToolbar.tsx` | component | request-response | `src/renderer/src/components/Toolbar.tsx` (lines 120-525) | exact (full replacement; same props, same store access) |
| `src/renderer/src/stores/viewerStore.ts` | store | CRUD | itself — extending `hiddenItemNames`/`hiddenItemSet` pattern in `projectStore.ts` | exact (same Zustand field-add pattern) |
| `src/renderer/src/types/viewer.ts` | type | — | itself — extending `ViewerState` with new fields | exact |
| `src/renderer/src/types/markup.ts` | type | — | itself — `MarkupCommand` discriminated union (lines 52-77) | exact |
| `src/renderer/src/stores/markupStore.ts` | store | CRUD | itself — `deleteMarkup` action (lines 113-123) + undo switch (lines 219-271) | exact |
| `src/renderer/src/components/CanvasViewport.tsx` | component | event-driven | itself — `handleStageClick` (line 459), Escape useEffect (line 312), Layer structure (line 627) | exact |
| `src/renderer/src/components/markup/CountPinMarkup.tsx` | component | event-driven | itself — `onContextMenu` handler pattern (lines 62-67) | exact (add onClick alongside) |
| `src/renderer/src/components/markup/LinearMarkup.tsx` | component | event-driven | itself — `onContextMenu` handler pattern (lines 88-93) | exact |
| `src/renderer/src/components/markup/AreaMarkup.tsx` | component | event-driven | `src/renderer/src/components/markup/LinearMarkup.tsx` | exact (same handler shape) |
| `src/renderer/src/components/markup/PerimeterMarkup.tsx` | component | event-driven | `src/renderer/src/components/markup/LinearMarkup.tsx` | exact |
| `src/renderer/src/components/WallMarkup.tsx` | component | event-driven | `src/renderer/src/components/markup/LinearMarkup.tsx` | exact |
| `src/renderer/src/components/HoverRing.tsx` | component | event-driven | itself — `HoverRingProps` interface (lines 23-28), render body (lines 44-115) | exact (add optional color/opacity props) |
| `src/renderer/src/components/CalibrationDialog.tsx` | modal | event-driven | itself — overlay + centered pattern (lines 51-66) | exact (add useDraggable hook) |
| `src/renderer/src/components/MarkupNamePopup.tsx` | modal | event-driven | `CalibrationDialog.tsx` (target centering pattern) | role-match (convert from screenPos to overlay-centered) |
| `src/renderer/src/components/ScalePopup.tsx` | modal | event-driven | `MarkupNamePopup.tsx` (same screenPos pattern lines 68-78) | exact (same conversion needed) |
| `src/renderer/src/components/SaveCloseModal.tsx` | modal | event-driven | itself — fixed overlay + flex center (lines 32-38) | exact (add useDraggable hook) |
| `src/renderer/src/components/OpenErrorModal.tsx` | modal | event-driven | `SaveCloseModal.tsx` | role-match |
| `src/renderer/src/components/UncalibratedExportWarningModal.tsx` | modal | event-driven | `SaveCloseModal.tsx` | role-match |
| `src/renderer/src/components/ArchiveCorruptedModal.tsx` | modal | event-driven | `SaveCloseModal.tsx` | role-match |
| `src/renderer/src/components/DimensionMismatchModal.tsx` | modal | event-driven | `SaveCloseModal.tsx` | role-match |
| `src/renderer/src/components/PageCountAbortModal.tsx` | modal | event-driven | `SaveCloseModal.tsx` | role-match |
| `src/renderer/src/hooks/useKeyboardShortcuts.ts` | hook | event-driven | itself — `Ctrl+Z` handler block (lines 92-100), `isTextInputActive` (lines 26-41) | exact |

---

## Pattern Assignments

### NEW: `src/renderer/src/hooks/useDraggable.ts` (hook, event-driven)

**Analog:** `src/renderer/src/hooks/useViewportControls.ts` (window event listener + cleanup pattern) AND `src/renderer/src/hooks/useMarkupHighlight.ts` (useState + useCallback shape)

**Imports pattern** — copy from `useMarkupHighlight.ts` lines 1-2 and `useViewportControls.ts` lines 1-6:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
```

**Core hook pattern** — window listener + cleanup from `useViewportControls.ts` lines 131-152:
```typescript
// Pattern: register on window, clean up in return callback
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent): void => { ... }
  const handleKeyUp = (e: KeyboardEvent): void => { ... }
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}, [])
```

**State shape** — copy from `useMarkupHighlight.ts` lines 44-58:
```typescript
// Pattern: useState + stable useCallback references returned as an object
export function useMarkupHighlight(): MarkupHighlightApi {
  const [hoverMatches, setHoverMatchesState] = useState<Markup[]>([])
  const [pulse, setPulse] = useState<{ matches: Markup[]; color: string } | null>(null)
  return {
    hoverMatches,
    setHoverMatches: setHoverMatchesState,
    clearHover: useCallback(() => setHoverMatchesState([]), []),
    ...
  }
}
```

**For useDraggable specifically** — combine the two: `useState<{ x: number; y: number } | null>(null)` for position, `useRef` for drag start, window pointermove/pointerup in useEffect with cleanup. The interactive-control guard (`['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)`) is unique to this hook and has no direct analog — write from the RESEARCH.md spec.

**Pointer capture** — use `e.currentTarget.setPointerCapture(e.pointerId)` in `onPointerDown`. This is the browser-native approach (noted in RESEARCH.md "Don't Hand-Roll" table).

---

### NEW: `src/renderer/src/components/RibbonButton.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/Toolbar.tsx` — `IconButton` function (lines 29-96)

**Imports pattern** (lines 1, 27-28):
```typescript
import { COLORS } from '../lib/constants'
// lucide-react icons imported at call site, passed as `icon` prop
```

**Core component pattern** — `IconButton` from `Toolbar.tsx` lines 29-96:
```typescript
function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title,
  ariaLabel,
  onContextMenu,
  children
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title: string
  ariaLabel?: string
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}): React.JSX.Element {
  const baseBackground = active ? COLORS.activeSurface : 'transparent'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onContextMenu={onContextMenu}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: label ? 4 : 0,
        height: 28,
        padding: label ? '4px 8px' : '6px',
        background: baseBackground,
        border: 'none',
        borderRadius: 4,
        borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        color: '#cccccc',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        lineHeight: 1.4
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.background = '#2d2d30'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBackground
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.background = '#37373d'
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.background = active ? COLORS.activeSurface : '#2d2d30'
      }}
    >
      <Icon size={16} color="currentColor" />
      {label && <span>{label}</span>}
      {children}
    </button>
  )
}
```

**RibbonButton differs from IconButton in:** `flexDirection: 'column'`, `width: 60, height: 60` (~56-64px square per D-16), `Icon size={20}` (larger), `fontSize: 11` for label, label always rendered (no conditional). Everything else (active border, disabled states, hover/mousedown inline style updates, children for badge chips) is identical.

---

### NEW: `src/renderer/src/components/RibbonToolbar.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/Toolbar.tsx` (full file — lines 1-525)

**Imports pattern** (lines 1-27) — copy verbatim except rename `Toolbar` → `RibbonToolbar` and add tab-switching icons:
```typescript
import { useState } from 'react'
import {
  FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize,
  Ruler, MapPin, Minus, Square, Hexagon, BrickWall, Save, SaveAll,
  Replace, Download,
  MousePointer  // NEW — Select tool icon (lucide-react)
} from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useProject } from '../hooks/useProject'
import { getCanvasControls, getCalibrationControls, getChainArmedItem } from './CanvasViewport'
import { ScaleContextMenu } from './ScaleContextMenu'
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'
```

**Props interface** — copy `ToolbarProps` from `Toolbar.tsx` lines 98-118 verbatim:
```typescript
export interface RibbonToolbarProps {
  onOpenClick: () => void | Promise<void>
  onReplaceClick: () => void | Promise<void>
  onExportClick: () => void | Promise<void>
}
```

**Store access inside component** — copy from `Toolbar.tsx` lines 121-149 verbatim (all same hooks). Add one line:
```typescript
const setSelectedMarkupIds = useViewerStore((s) => s.setSelectedMarkupIds)
```

**Tab switching state** — local to `RibbonToolbar`:
```typescript
const [activeTab, setActiveTab] = useState<string>('home')  // D-24
```

**handleMarkupToolClick pattern** — copy from `Toolbar.tsx` lines 190-196:
```typescript
const handleMarkupToolClick = (tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'): void => {
  if (activeTool === tool) {
    setActiveTool('select')
  } else {
    setActiveTool(tool)
  }
}
```

**Scale context menu chevron** — copy from `Toolbar.tsx` lines 334-353:
```typescript
{pageScale !== null && (
  <span
    role="button"
    aria-label="Scale actions menu"
    aria-haspopup="menu"
    onClick={handleChevronClick}
    style={{ display: 'inline-block', marginLeft: 6, fontSize: 10, lineHeight: 1, opacity: 0.7, cursor: 'pointer' }}
  >
    {'▾'}
  </span>
)}
```

**Chain badge chip** — copy from `Toolbar.tsx` lines 368-380 for each tool:
```typescript
{activeTool === 'count' && getChainArmedItem() !== null && (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 3,
    marginLeft: 6, fontSize: 11, fontWeight: 600,
    background: COLORS.activeSurface, borderRadius: 3,
    padding: '1px 4px', maxWidth: 80, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%',
      background: getChainArmedItem()!.color, flexShrink: 0 }} />
    {getChainArmedItem()!.name}
  </span>
)}
```

**Show All / Hide All handlers** (D-20) — based on `projectStore.ts` `setHiddenItemNames` (line 93) + `toggleHiddenItem` (lines 82-91) pattern:
```typescript
const handleShowAll = (): void => {
  useProjectStore.getState().setHiddenItemNames([])
  useProjectStore.getState().markDirty()  // required — setHiddenItemNames skips dirty (hydration design)
}
const handleHideAll = (): void => {
  const { pageMarkups } = useMarkupStore.getState()
  const allKeys = Array.from(new Set(
    Object.values(pageMarkups).flat().map((m) => `${m.name}|${m.categoryId}`)
  ))
  useProjectStore.getState().setHiddenItemNames(allKeys)
  useProjectStore.getState().markDirty()
}
```

**App.tsx wiring** — update `App.tsx` line 4 (import) and line 244-248 (usage):
- Old: `import { Toolbar } from './components/Toolbar'` + `<Toolbar onOpenClick=... />`
- New: `import { RibbonToolbar } from './components/RibbonToolbar'` + `<RibbonToolbar onOpenClick=... />`

---

### MODIFIED: `src/renderer/src/stores/viewerStore.ts` (store, CRUD)

**Analog:** `src/renderer/src/stores/projectStore.ts` — `hiddenItemNames: string[]` field pattern (lines 12-13, 55, 93-95)

**Adding a new string-array field** — copy this exact shape from `projectStore.ts` lines 12-13, 55:
```typescript
// In the store interface (mirrors projectStore.ts hiddenItemNames pattern)
hiddenItemNames: string[]        // projectStore analog
selectedMarkupIds: string[]      // new field — same shape

// In create() initial values
hiddenItemNames: [],             // projectStore.ts line 55
selectedMarkupIds: [],           // new initial value
```

**Adding new actions** — copy from `projectStore.ts` `setHiddenItemNames` (lines 93-95) and `reset` (lines 72-80):
```typescript
// projectStore.ts pattern:
setHiddenItemNames: (names) => {
  set({ hiddenItemNames: names, hiddenItemSet: new Set(names) })
},

// viewerStore equivalent (simpler — no derived Set needed):
setSelectedMarkupIds: (ids) => set({ selectedMarkupIds: ids }),
clearSelection: () => set({ selectedMarkupIds: [] }),
```

**Clearing on navigation** — extend existing `setPage` / `nextPage` / `prevPage` / `resetViewer` / `hydrate` in `viewerStore.ts`. Each already does a `set({...})`. Add `selectedMarkupIds: []` to each `set()` call:
```typescript
// Current nextPage (lines 35-38):
nextPage: () => {
  const { currentPage, totalPages } = get()
  if (currentPage < totalPages) set({ currentPage: currentPage + 1 })
},

// Modified nextPage:
nextPage: () => {
  const { currentPage, totalPages } = get()
  if (currentPage < totalPages) set({ currentPage: currentPage + 1, selectedMarkupIds: [] })
},
```

**ViewerState interface extension** — add to `src/renderer/src/types/viewer.ts` after line 51 (`setActiveTool` declaration):
```typescript
selectedMarkupIds: string[]
setSelectedMarkupIds: (ids: string[]) => void
clearSelection: () => void
```

---

### MODIFIED: `src/renderer/src/types/markup.ts` — add `'delete-group'` (type)

**Analog:** itself — existing `MarkupCommand` union (lines 52-77)

**Existing union** (lines 52-77) — insert new variant after line 54 (after `'delete'`):
```typescript
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'delete-group'; markups: Markup[] }   // NEW — D-09
  | {
      type: 'recolor-group'
      name: string
      newColor: string
      oldColors: Record<string, string>
      page?: number
      markupIdsAffected: string[]
    }
  | {
      type: 'edit-markup'
      ...
    }
```

---

### MODIFIED: `src/renderer/src/stores/markupStore.ts` — add `deleteGroup` + undo/redo branches

**Analog:** itself — `deleteMarkup` action (lines 113-123), `undo()` switch (lines 214-271)

**`deleteMarkup` pattern** (lines 113-123) — copy this shape for `deleteGroup`:
```typescript
deleteMarkup: (page, markupId) =>
  set((s) => {
    const pageList = s.pageMarkups[page] ?? []
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s
    return {
      pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markupId) },
      undoStack: pushCommand(s.undoStack, { type: 'delete', markup: target }),
      redoStack: []
    }
  }),
```

**`deleteGroup` new action** — same `set((s) => {...})` + `pushCommand` shape, iterates across pages:
```typescript
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

**`undo()` switch insertion point** — insert BEFORE line 259 (`const page = cmd.markup.page`). Pattern matches existing `recolor-group` branch (lines 219-236) — early return after handling:
```typescript
// EXISTING (lines 219-236):
if (cmd.type === 'recolor-group') {
  ...
  return { pageMarkups: nextPageMarkups, undoStack: s.undoStack.slice(0, -1), redoStack: [...s.redoStack, cmd] }
}

// NEW — insert after 'edit-markup' branch (after line 257), BEFORE line 259:
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
// Line 259: const page = cmd.markup.page  ← must come after new branch
```

**`redo()` switch insertion point** — same position pattern in `redo()`, before the `cmd.markup.page` fallthrough (line 319):
```typescript
if (cmd.type === 'delete-group') {
  const idSet = new Set(cmd.markups.map((m) => m.id))
  const nextPageMarkups = { ...s.pageMarkups }
  for (const p of Object.keys(nextPageMarkups).map(Number)) {
    nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
  }
  return {
    pageMarkups: nextPageMarkups,
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: s.redoStack.slice(0, -1)
  }
}
```

**Interface addition** — add `deleteGroup` to `MarkupStoreState` interface (after line 22 `deleteMarkup`):
```typescript
deleteGroup: (markups: Markup[]) => void
```

---

### MODIFIED: `src/renderer/src/components/CanvasViewport.tsx` (component, event-driven)

**Analog:** itself — multiple patterns within the file.

**Module-level ref pattern** (lines 44-70) — new `getSelectionControls` follows the exact same shape:
```typescript
// EXISTING pattern:
let _canvasControls: { zoomIn: () => void; zoomOut: () => void; fitToWindow: () => void } | null = null
export function getCanvasControls() { return _canvasControls }

// NEW — same shape:
let _selectionControls: { clearSelection: () => void; setSelectedIds: (ids: string[]) => void } | null = null
export function getSelectionControls() { return _selectionControls }
```

**Escape key useEffect** (lines 312-329) — Enter key extends this SAME useEffect (per RESEARCH.md Feature 4.2):
```typescript
// EXISTING (lines 312-329):
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (markupState.mode === 'drawing' || markupState.mode === 'confirming' || ...) {
        e.preventDefault()
        cancelMarkup()
        useViewerStore.getState().setActiveTool('select')
      }
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [markupState.mode, cancelMarkup])
```

**handleStageClick pattern** (lines 459-491) — the new select-mode paths are appended INSIDE this same `useCallback`. The existing guard pattern (`if (e.evt.button !== 0) return`) and the early return for calibration/markup paths are the model:
```typescript
// EXISTING structure to extend:
const handleStageClick = useCallback(
  (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    if (calibState.mode === 'drawing') { ... return }
    if (markupState.mode === 'drawing' || markupState.mode === 'placing') { ... return }

    // NEW: select-mode empty-space deselect (D-05)
    if (activeTool === 'select' && e.target === stage) {
      clearSelection()
    }
  },
  [calibState.mode, markupState.mode, ..., activeTool, clearSelection]
)
```

**Layer structure** (lines 626-633) — rubber-band rect goes in Layer 1a (already `listening={false}`); selection ring goes in a separate always-mounted Layer after Layer 2:
```typescript
// EXISTING Layer 0 (line 627):
<Layer listening={false}>
  <KonvaImage ... />
</Layer>

// EXISTING Layer 1a (line 635): calibration + in-progress preview — listening={false}
// EXISTING Layer 1b (line 725): committed markups — listening={true}
// EXISTING Layer 2 (conditional): HoverRing + PulseHighlight

// NEW Layer for rubber-band (inside Layer 1a, alongside calibration visuals):
{rubberBand && (
  <Rect
    x={Math.min(rubberBand.startX, rubberBand.endX)}
    y={Math.min(rubberBand.startY, rubberBand.endY)}
    width={Math.abs(rubberBand.endX - rubberBand.startX)}
    height={Math.abs(rubberBand.endY - rubberBand.startY)}
    stroke={COLORS.accent}
    strokeWidth={1 / currentZoom}  // zoom-compensated per STATE.md rule
    fill="rgba(0,120,212,0.1)"
    listening={false}
  />
)}

// NEW Layer for selection ring (always-mounted, after existing Layer 2):
<Layer listening={false}>
  {selectedMarkupIds.length > 0 && (
    <HoverRing
      markups={pageMarkups.filter((m) => selectedMarkupIds.includes(m.id))}
      currentZoom={currentZoom}
      color={COLORS.accent}
      opacity={1.0}
    />
  )}
</Layer>
```

**handleMarkupClick new handler** — mirrors `handleContextMenu` pattern (from CanvasViewport, passed as prop to each renderer):
```typescript
const handleMarkupClick = useCallback((id: string) => {
  if (activeTool !== 'select') return  // D-03: placement always takes priority
  setSelectedMarkupIds([id])
}, [activeTool, setSelectedMarkupIds])
```

**Passing onClick to markup renderers** (lines 727-741 for CountPinMarkup, 744+ for others):
```typescript
// EXISTING CountPinMarkup usage:
<CountPinMarkup
  key={m.id}
  markup={m as CountMarkup}
  category={category}
  currentZoom={currentZoom}
  onHoverEnter={handleHoverEnter}
  onHoverLeave={handleHoverLeave}
  onContextMenu={handleContextMenu}
/>

// MODIFIED — add onClick:
<CountPinMarkup
  key={m.id}
  markup={m as CountMarkup}
  category={category}
  currentZoom={currentZoom}
  onHoverEnter={handleHoverEnter}
  onHoverLeave={handleHoverLeave}
  onContextMenu={handleContextMenu}
  onClick={handleMarkupClick}   // NEW
/>
```

---

### MODIFIED: Markup Renderer Components (CountPinMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup, WallMarkup)

**Analog:** `src/renderer/src/components/markup/CountPinMarkup.tsx` lines 6-15 (props interface) and lines 55-67 (onContextMenu handler)

**Prop interface extension** — copy the `onContextMenu` pattern to add `onClick`:
```typescript
// EXISTING CountPinMarkupProps (lines 6-15):
export interface CountPinMarkupProps {
  markup: CountMarkup
  category: Category
  currentZoom: number
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

// MODIFIED — add onClick:
export interface CountPinMarkupProps {
  ...
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
  onClick?: (id: string) => void   // NEW — D-03 guard is in CanvasViewport, not here
}
```

**Handler wiring on the Group** — copy the `onContextMenu` Group handler pattern (CountPinMarkup lines 55-67):
```typescript
// EXISTING onContextMenu on <Group> (lines 62-67):
onContextMenu={(e) => {
  e.evt.preventDefault()
  const stage = e.target.getStage()
  const p = stage?.getPointerPosition()
  if (p && onContextMenu) onContextMenu(markup.id, p.x, p.y)
}}

// NEW onClick alongside it — no stage coordinates needed (id is enough):
onClick={() => onClick?.(markup.id)}
```

**LinearMarkup** — same pattern; `onContextMenu` is on lines 88-93, add `onClick` identically.

---

### MODIFIED: `src/renderer/src/components/HoverRing.tsx` (component, event-driven)

**Analog:** itself (lines 23-28 props interface, lines 44-45 zoom compensation)

**Props extension** — add optional `color` and `opacity` props with defaults matching current behavior:
```typescript
// EXISTING (lines 23-28):
export interface HoverRingProps {
  markups: Markup[]
  currentZoom: number
}

// MODIFIED:
export interface HoverRingProps {
  markups: Markup[]
  currentZoom: number
  color?: string    // default '#ffffff' (RING_COLOR)
  opacity?: number  // default 0.4 (RING_OPACITY)
}
```

**Usage in render** — the constants `RING_COLOR` and `RING_OPACITY` (lines 15-16) become fallback defaults. Inside the render body (lines 44-115), replace `stroke={RING_COLOR}` → `stroke={color ?? RING_COLOR}` and `opacity={RING_OPACITY}` → `opacity={opacity ?? RING_OPACITY}`.

---

### MODIFIED: Modal components — `useDraggable` integration

**Primary analog:** `src/renderer/src/components/CalibrationDialog.tsx` (overlay-centered pattern, lines 51-66)

**CalibrationDialog overlay structure** (lines 51-66) — this is the REFERENCE pattern for ALL modals:
```typescript
// Outer backdrop div:
<div
  style={{
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    isolation: 'isolate'
  }}
  onClick={(e) => {
    if (e.target === e.currentTarget) onCancel()  // backdrop-click dismiss
  }}
>
  {/* Inner content div — this receives useDraggable's onPointerDown */}
  <div
    style={{
      background: COLORS.secondary,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '20px 24px',
      ...
    }}
  >
```

**Applying useDraggable** — the inner content div is the drag handle. Add to CalibrationDialog:
```typescript
const { position, onPointerDown } = useDraggable()

// On the inner div, add:
onPointerDown={onPointerDown}
style={{
  ...existingStyles,
  // When position is set, override centering with transform offset:
  ...(position ? { transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` } : {}),
  // Switch from flex-centering to absolute 50%/50% positioning when dragged:
  ...(position ? { position: 'absolute', left: '50%', top: '50%' } : {})
}}
```

**MarkupNamePopup — conversion from screenPos to centered overlay** — the `screenPos`-based `popupStyle` (lines 95-99) is REPLACED by the CalibrationDialog overlay pattern. The `screenPos` and `containerSize` props become unused for positioning (may be removed from the interface):
```typescript
// EXISTING (lines 95-99 — to be removed):
const popupStyle = useMemo(() => {
  const left = Math.min(Math.max(screenPos.x, 0), containerSize.width - POPUP_MIN_WIDTH)
  const top = Math.min(Math.max(screenPos.y, 0), containerSize.height - 240)
  return { left, top }
}, [screenPos, containerSize])

// EXISTING containerStyle (lines 173-191) uses popupStyle.left/top — replace with CalibrationDialog overlay approach

// REPLACEMENT: wrap in overlay div (like CalibrationDialog) + add useDraggable
```

**ScalePopup** — same screenPos pattern (lines 68-78). Needs same conversion. ScalePopup's `containerStyle` (lines 93-108) uses `popupStyle.left/top` — replace with centered overlay.

**App.tsx-hosted modals** (SaveCloseModal, OpenErrorModal, etc.) — already use `position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'` (SaveCloseModal lines 32-38). These do NOT need overlay conversion — just add `useDraggable` to the inner `role="dialog"` div.

```typescript
// SaveCloseModal (lines 32-38) EXISTING outer — already centered:
<div style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120
}}>
  <div role="dialog" ...>  {/* ← add onPointerDown={onPointerDown} here */}
```

---

### MODIFIED: `src/renderer/src/hooks/useKeyboardShortcuts.ts` (hook, event-driven)

**Analog:** itself — existing handler blocks (lines 54-152)

**Handler block pattern** — copy the exact structure of any existing handler (e.g., `Ctrl+Z` block, lines 92-100):
```typescript
// EXISTING Ctrl+Z pattern (lines 92-100):
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return
  e.preventDefault()
  const handledByDraw = getMarkupUndoHandler()?.() ?? false
  if (!handledByDraw) {
    useMarkupStore.getState().undo()
  }
  return
}

// NEW Delete key handler — same shape:
if (e.key === 'Delete') {
  if (isTextInputActive()) return
  const selectedIds = useViewerStore.getState().selectedMarkupIds
  if (selectedIds.length === 0) return
  const currentPage = useViewerStore.getState().currentPage
  if (selectedIds.length === 1) {
    useMarkupStore.getState().deleteMarkup(currentPage, selectedIds[0])
  } else {
    const allMarkups = Object.values(useMarkupStore.getState().pageMarkups).flat()
    const toDelete = allMarkups.filter((m) => selectedIds.includes(m.id))
    useMarkupStore.getState().deleteGroup(toDelete)
  }
  useViewerStore.getState().clearSelection()
  return
}

// NEW Ctrl+A handler — same shape:
if (e.ctrlKey && e.key === 'a') {
  if (isTextInputActive()) return
  e.preventDefault()
  const activeTool = useViewerStore.getState().activeTool
  if (activeTool !== 'select' || totalPages === 0) return
  const currentPage = useViewerStore.getState().currentPage
  const allIds = useMarkupStore.getState().getMarkups(currentPage).map((m) => m.id)
  useViewerStore.getState().setSelectedMarkupIds(allIds)
  return
}
```

**Placement in the handler** — Delete key: insert BEFORE the `if (totalPages === 0) return` guard (line 111), since Delete should work even when no PDF is loaded (edge case: no markups = no-op anyway). Ctrl+A: insert after the `if (totalPages === 0) return` guard since it needs pages.

**useEffect deps array** (line 151) — `totalPages` is already there; no new dependencies needed for these handlers since they read store state imperatively via `.getState()`.

---

## Shared Patterns

### COLORS Token Usage
**Source:** `src/renderer/src/lib/constants.ts`
**Apply to:** All new/modified components — `COLORS.accent`, `COLORS.secondary`, `COLORS.border`, `COLORS.textPrimary`, `COLORS.textSecondary`, `COLORS.activeSurface`, `COLORS.hoverSurface`, `COLORS.textOnAccent`
**Rule:** No raw hex literals. No Tailwind. Inline styles only (STATE.md standing rule).
```typescript
// Pattern in Toolbar.tsx line 27:
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'
// Then use: COLORS.accent, COLORS.secondary, etc.
```

### Zoom-Compensated Konva Shapes
**Source:** `src/renderer/src/components/HoverRing.tsx` lines 13-16, 44-45; `src/renderer/src/components/CanvasViewport.tsx` lines 549-552
**Apply to:** Rubber-band Rect, selection ring shapes, any new Konva overlay in Layer 1a or Layer 2
```typescript
// HoverRing.tsx lines 44-45:
const stroke = STROKE_BASE_PX / currentZoom
const offset = RING_OFFSET_PX / currentZoom
// CanvasViewport.tsx line 550-552:
const POINT_STROKE_WIDTH = 1 / currentZoom
const LINE_STROKE_WIDTH = 2 / currentZoom
```

### `listening={false}` on Overlay Shapes
**Source:** `src/renderer/src/components/HoverRing.tsx` (every shape), `CanvasViewport.tsx` Layer 1a
**Apply to:** Rubber-band Rect, selection ring, all overlay Konva shapes
**Rule:** Every shape in Layer 1a and Layer 2 must have `listening={false}` to prevent stealing mouse events from Layer 1b markup renderers.

### isTextInputActive Guard
**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts` lines 26-41 (function definition), line 58-59 (usage pattern)
**Apply to:** Delete key, Ctrl+A, Enter key (in CanvasViewport)
```typescript
// Pattern (lines 57-60):
if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.openProject()
  return
}
```

### Store Access Pattern (imperative reads during event handlers)
**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts` lines 95-98
**Apply to:** Delete key handler, Ctrl+A handler
```typescript
// Pattern — read store imperatively in event handlers (not via hook selectors):
const handledByDraw = getMarkupUndoHandler()?.() ?? false
if (!handledByDraw) {
  useMarkupStore.getState().undo()   // ← .getState() not hook
}
```

### Zustand set() with State Extension
**Source:** `src/renderer/src/stores/viewerStore.ts` lines 35-38
**Apply to:** `setPage`, `nextPage`, `prevPage`, `resetViewer`, `hydrate` in viewerStore — add `selectedMarkupIds: []`
```typescript
// Pattern (lines 35-38):
nextPage: () => {
  const { currentPage, totalPages } = get()
  if (currentPage < totalPages) set({ currentPage: currentPage + 1 })
},
// Extend to:
if (currentPage < totalPages) set({ currentPage: currentPage + 1, selectedMarkupIds: [] })
```

### Window Event Listener Cleanup
**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts` lines 149-151; `useViewportControls.ts` lines 147-151
**Apply to:** `useDraggable` pointermove/pointerup listeners, Enter key useEffect in CanvasViewport
```typescript
// Pattern:
window.addEventListener('keydown', handleKeyDown)
return () => window.removeEventListener('keydown', handleKeyDown)
```

### pushCommand Pattern for New Store Actions
**Source:** `src/renderer/src/stores/markupStore.ts` lines 50-53 (helper), lines 103-111 (placeMarkup usage), lines 113-123 (deleteMarkup usage)
**Apply to:** `deleteGroup` new action
```typescript
// Helper (lines 50-53):
function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}
// Usage pattern (lines 108-109):
undoStack: pushCommand(s.undoStack, { type: 'place', markup }),
redoStack: []
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

However, these specific sub-patterns within new files are novel (no exact codebase precedent):

| Pattern | File | Reason | Reference |
|---------|------|---------|-----------|
| `setPointerCapture` drag | `useDraggable.ts` | No existing pointer-capture usage in codebase | RESEARCH.md Feature 2.2 spec |
| Rubber-band containment math | `CanvasViewport.tsx` | No existing AABB containment in codebase | RESEARCH.md Feature 1.6 spec |
| Ribbon tab strip UI | `RibbonToolbar.tsx` | No tabbed UI currently exists | RESEARCH.md Feature 3 spec |
| `transform: translate(-50% + Xpx)` drag offset | All draggable modals | Modal position-offset CSS pattern is new | RESEARCH.md Feature 2.2 CSS integration |

---

## Metadata

**Analog search scope:** `src/renderer/src/` — all components, hooks, stores, types
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-18
