# Phase 8: Markup Workflow Acceleration and Wall Measurement Tool — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 20 (1 new, 19 modified)
**Analogs found:** 20 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/renderer/src/components/WallMarkup.tsx` (NEW) | component | request-response | `src/renderer/src/components/markup/LinearMarkup.tsx` | exact |
| `src/renderer/src/types/markup.ts` | model | — | self (extend) | exact |
| `src/renderer/src/hooks/useMarkupTool.ts` | hook | event-driven | self (extend) | exact |
| `src/renderer/src/stores/markupStore.ts` | store | CRUD | self (extend) | exact |
| `src/renderer/src/stores/projectStore.ts` | store | CRUD | self (extend) | exact |
| `src/renderer/src/components/Toolbar.tsx` | component | event-driven | self (extend) | exact |
| `src/renderer/src/components/MarkupNamePopup.tsx` | component | request-response | self (extend) | exact |
| `src/renderer/src/components/TotalsRow.tsx` | component | event-driven | self (extend) | exact |
| `src/renderer/src/components/CanvasViewport.tsx` | component | event-driven | self (extend) | exact |
| `src/renderer/src/components/markup/CountPinMarkup.tsx` | component | request-response | `src/renderer/src/components/markup/LinearMarkup.tsx` | exact |
| `src/renderer/src/components/markup/LinearMarkup.tsx` | component | request-response | self (extend) | exact |
| `src/renderer/src/components/markup/AreaMarkup.tsx` | component | request-response | self (extend) | exact |
| `src/renderer/src/components/markup/PerimeterMarkup.tsx` | component | request-response | `src/renderer/src/components/markup/AreaMarkup.tsx` | exact |
| `src/renderer/src/components/HoverRing.tsx` | component | event-driven | self (extend) | exact |
| `src/renderer/src/components/PulseHighlight.tsx` | component | event-driven | self (extend) | exact |
| `src/renderer/src/lib/markup-math.ts` | utility | transform | self (extend) | exact |
| `src/renderer/src/lib/boq-types.ts` | model | — | self (extend) | exact |
| `src/renderer/src/lib/boq-aggregator.ts` | service | batch | self (extend) | exact |
| `src/main/boq-writers.ts` | service | batch | self (extend) | exact |
| `src/renderer/src/lib/project-schema.ts` | model | — | self (extend) | exact |

---

## Pattern Assignments

### `src/renderer/src/components/WallMarkup.tsx` (NEW — component, request-response)

**Analog:** `src/renderer/src/components/markup/LinearMarkup.tsx` (full file read)

**Imports pattern** (lines 1–8 of LinearMarkup.tsx):
```typescript
import { Line, Text, Rect, Group } from 'react-konva'
import type { LinearMarkup as LinearMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import {
  polylineLength,
  pixelLengthToReal,
  polylineMidpointByArcLength
} from '../../lib/markup-math'
```
WallMarkup copies this verbatim, substituting `WallMarkup as WallMarkupType` and adding `useProjectStore` for the hidden-item skip check.

**Props interface pattern** (lines 10–18 of LinearMarkup.tsx):
```typescript
export interface LinearMarkupProps {
  markup: LinearMarkupType
  category: Category   // legacy prop compat
  currentZoom: number  // legacy prop compat — not used; labels are world-anchored per D-34
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}
```
WallMarkup uses the same interface shape, substituting `WallMarkupType`.

**Visual constants pattern** (lines 24–33 of LinearMarkup.tsx):
```typescript
const LABEL_FONT_WORLD = 16
const LABEL_PAD_X_WORLD = 6
const LABEL_PAD_Y_WORLD = 3
const LABEL_CHIP_RADIUS_WORLD = 4
const CHAR_ADVANCE_RATIO = 0.58
// Stroke stays zoom-compensated so lines remain visible at fit zoom.
const STROKE_BASE_PX = 2
```
WallMarkup adds:
```typescript
const WALL_STROKE_MULTIPLIER = 2.5   // primary line is 2.5× base
const WALL_OFFSET_WORLD = 3          // parallel hairline offset in world-units
const WALL_HAIRLINE_OPACITY = 0.7    // hairline is same color at 70% opacity
```

**Zoom-compensated stroke pattern** (line 51 of LinearMarkup.tsx):
```typescript
const strokeWidth = STROKE_BASE_PX / currentZoom
```
WallMarkup applies:
```typescript
const primaryStroke = (STROKE_BASE_PX * WALL_STROKE_MULTIPLIER) / currentZoom
const hairlineStroke = STROKE_BASE_PX / currentZoom
```

**Label at arc-length midpoint pattern** (lines 55–69 of LinearMarkup.tsx):
```typescript
const midpoint = polylineMidpointByArcLength(markup.points)

let labelText = ''
if (pageScale && pageScale.pixelsPerMm > 0) {
  const pixelLen = polylineLength(markup.points)
  const realLen = pixelLengthToReal(pixelLen, pageScale.pixelsPerMm, pageScale.displayUnit)
  labelText = `${realLen.toFixed(1)} ${pageScale.displayUnit}`
}
```
WallMarkup replaces labelText computation with:
```typescript
let labelText = ''
if (pageScale && pageScale.pixelsPerMm > 0) {
  const areaM2 = wallAreaM2(markup.points, markup.wallHeight, pageScale.pixelsPerMm)
  labelText = `${areaM2.toFixed(2)} m²`
}
```

**Group event handler + Konva Line + label chip pattern** (lines 71–119 of LinearMarkup.tsx):
```typescript
return (
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
  >
    <Line
      points={flatPoints}
      stroke={markup.color}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
    />
    {labelText && (
      <>
        <Rect x={chipX} y={chipY} width={chipW} height={chipH}
          cornerRadius={LABEL_CHIP_RADIUS_WORLD}
          fill="rgba(20, 20, 20, 0.78)"
          listening={false}
        />
        <Text x={chipX} y={chipY + LABEL_PAD_Y_WORLD} width={chipW}
          text={labelText} fontSize={LABEL_FONT_WORLD}
          fontFamily="Inter, sans-serif" fontStyle="700"
          fill="#ffffff" align="center" listening={false}
        />
      </>
    )}
  </Group>
)
```
WallMarkup adds a second `<Line>` inside the Group for the parallel offset hairline:
```typescript
<Line
  points={flatPoints}          // same path — parallel offset approximation
  stroke={markup.color}
  strokeWidth={hairlineStroke}
  opacity={WALL_HAIRLINE_OPACITY}
  offsetY={WALL_OFFSET_WORLD}  // Konva offsetY shifts the line perpendicular to its axis (approximate for polylines)
  lineCap="round"
  lineJoin="round"
  listening={false}
/>
```

**Hidden-item skip-render pattern** (established pattern for this phase — add to every renderer):
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(markup.name))
if (isHidden) return null
```
This line goes BEFORE the `strokeWidth` computation (first lines of the function body).

---

### `src/renderer/src/types/markup.ts` (model)

**Analog:** self (extend)

**Current MarkupType union** (line 3):
```typescript
export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter'
```
Extend to:
```typescript
export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
```

**Existing discriminated interface pattern** (lines 21–34):
```typescript
export interface LinearMarkup extends BaseMarkup {
  type: 'linear'
  points: StagePoint[]
}

export interface AreaMarkup extends BaseMarkup {
  type: 'area'
  points: StagePoint[]
}
```
New WallMarkup interface copies this pattern:
```typescript
export interface WallMarkup extends BaseMarkup {
  type: 'wall'
  points: StagePoint[]
  wallHeight: number  // millimetres
}
```

**Current Markup union** (line 36):
```typescript
export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup
```
Extend to:
```typescript
export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup
```

**Current MarkupCommand union** (lines 45–66):
```typescript
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
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
      markupId: string
      page: number
      oldName: string
      oldCategoryName: string
      oldColor: string
      newName: string
      newCategoryName: string
      newColor: string
    }
```
Extend `'edit-markup'` branch with optional wall-height fields (additive, non-breaking for non-wall edits):
```typescript
  | {
      type: 'edit-markup'
      markupId: string
      page: number
      oldName: string
      oldCategoryName: string
      oldColor: string
      newName: string
      newCategoryName: string
      newColor: string
      // Optional — only present when editing a WallMarkup:
      oldWallHeight?: number
      newWallHeight?: number
    }
```
Because `Markup` now includes `WallMarkup`, `{ type: 'place'; markup: Markup }` and `{ type: 'delete'; markup: Markup }` already cover WallMarkup without change.

---

### `src/renderer/src/hooks/useMarkupTool.ts` (hook, event-driven)

**Analog:** self (extend)

**Current MarkupDrawState interface** (lines 13–24):
```typescript
export interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming' | 'placing'
  toolType: 'count' | 'linear' | 'area' | 'perimeter' | null
  points: StagePoint[]
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  pendingName: string
  pendingCategoryName: string
  pendingColor: string
  pendingPage: number | null
  errorToast: string | null
}
```
Extend to:
```typescript
export interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming' | 'placing'
  toolType: 'count' | 'linear' | 'area' | 'perimeter' | 'wall' | null
  points: StagePoint[]
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  pendingName: string
  pendingCategoryName: string
  pendingColor: string
  pendingPage: number | null
  errorToast: string | null
  chainArmed: boolean          // true after first commitShape; false after cancel()
  pendingWallHeight: number    // millimetres; default 2400; inherited across chain commits
}
```

**Current INITIAL_STATE** (lines 26–37):
```typescript
const INITIAL_STATE: MarkupDrawState = {
  mode: 'idle',
  toolType: null,
  points: [],
  previewPoint: null,
  popupScreenPos: null,
  pendingName: '',
  pendingCategoryName: '',
  pendingColor: MARKUP_PALETTE[0],
  pendingPage: null,
  errorToast: null
}
```
Extend to include new fields:
```typescript
const INITIAL_STATE: MarkupDrawState = {
  ...existing fields...
  chainArmed: false,
  pendingWallHeight: 2400
}
```

**Current UseMarkupToolReturn interface** (lines 55–72):
```typescript
export interface UseMarkupToolReturn {
  state: MarkupDrawState
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter') => void
  ...
  commitShape: (payload: { name: string; categoryName: string; color: string }) => void
  ...
}
```
Extend `activate` and `commitShape` signatures:
```typescript
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall') => void
  commitShape: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
```

**Chain mode prototype — count "stay armed" pattern** (lines 106–115):
```typescript
const commitCountName = useCallback((payload: { name: string; categoryName: string; color: string }) => {
  setState((s) => ({
    ...s,
    mode: 'placing',
    pendingName: payload.name,
    pendingCategoryName: payload.categoryName || UNCATEGORIZED,
    pendingColor: payload.color,
    popupScreenPos: null
  }))
}, [])
```
The chain generalization for `commitShape` replaces the current reset on line 324:
```typescript
// CURRENT (line 324):
setState(INITIAL_STATE)

// REPLACEMENT — chain-aware post-commit reset:
setState((prev) => {
  if (prev.chainArmed) {
    // Armed: preserve name/category/color/toolType/wallHeight; clear geometry only
    return {
      ...INITIAL_STATE,
      toolType: prev.toolType,
      mode: 'drawing',
      pendingName: prev.pendingName,
      pendingCategoryName: prev.pendingCategoryName,
      pendingColor: prev.pendingColor,
      pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
      chainArmed: true
    }
  }
  return INITIAL_STATE
})
```
On first commit (chainArmed was false), set chainArmed to true before the reset so the NEXT commit gets armed:
```typescript
// Inside commitShape, before the setState reset — read prev.chainArmed from stateRef:
const wasArmed = prev.chainArmed
// After store.placeMarkup dispatch:
setState((s) => {
  const nowArmed = true   // arm on first commit
  if (wasArmed || nowArmed) {
    return {
      ...INITIAL_STATE,
      toolType: prev.toolType,
      mode: 'drawing',
      pendingName: payload.name,
      pendingCategoryName: payload.categoryName,
      pendingColor: payload.color,
      pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
      chainArmed: true
    }
  }
  return INITIAL_STATE
})
```

**Wall branch inside commitShape** — follows the exact same structure as linear/area/perimeter branches (lines 286–322):
```typescript
if (prev.toolType === 'linear') {
  const m: LinearMarkup = {
    id, type: 'linear', page, name, categoryId: category.id,
    color, createdAt, points: prev.points
  }
  store.placeMarkup(m)
} else if (prev.toolType === 'area') {
  // ...same shape
}
```
Wall branch mirrors this:
```typescript
} else if (prev.toolType === 'wall') {
  const m: WallMarkup = {
    id, type: 'wall', page, name, categoryId: category.id,
    color, createdAt,
    points: prev.points,
    wallHeight: payload.wallHeight ?? prev.pendingWallHeight
  }
  store.placeMarkup(m)
}
```

**cancel() pattern** (lines 102–104):
```typescript
const cancel = useCallback(() => {
  setState(INITIAL_STATE)
}, [])
```
This already resets `chainArmed: false` via `INITIAL_STATE` — no change needed.

---

### `src/renderer/src/stores/markupStore.ts` (store, CRUD)

**Analog:** self (extend)

**placeMarkup pattern** (lines 101–109) — no change needed; accepts `Markup` union which now includes `WallMarkup`.

**deleteMarkup pattern** (lines 111–121) — no change needed; operates on page lists without type checks.

**editMarkup action** (lines 161–189):
```typescript
editMarkup: (markupId, page, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor) => {
  const newCat = get().getOrCreateCategory(newCategoryName)
  set((s) => {
    const pageList = s.pageMarkups[page] ?? []
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s

    const updated: Markup = { ...target, name: newName, categoryId: newCat.id, color: newColor }
    // ...
    const cmd: MarkupCommand = {
      type: 'edit-markup',
      markupId, page,
      oldName, oldCategoryName, oldColor,
      newName, newCategoryName, newColor
    }
    // ...
  })
}
```
Extend to accept and pass through optional wall-height fields:
```typescript
editMarkup: (markupId, page, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor, oldWallHeight?, newWallHeight?) => {
  const newCat = get().getOrCreateCategory(newCategoryName)
  set((s) => {
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s
    const updated: Markup = {
      ...target,
      name: newName,
      categoryId: newCat.id,
      color: newColor,
      ...(newWallHeight !== undefined ? { wallHeight: newWallHeight } : {})
    }
    const cmd: MarkupCommand = {
      type: 'edit-markup',
      markupId, page,
      oldName, oldCategoryName, oldColor,
      newName, newCategoryName, newColor,
      ...(oldWallHeight !== undefined ? { oldWallHeight, newWallHeight } : {})
    }
    // ...
  })
}
```

**undo/redo edit-markup branch** (lines 229–246):
```typescript
if (cmd.type === 'edit-markup') {
  const oldCat = get().getOrCreateCategory(cmd.oldCategoryName)
  const pageList = s.pageMarkups[cmd.page] ?? []
  const nextList = pageList.map((m) =>
    m.id === cmd.markupId
      ? ({ ...m, name: cmd.oldName, categoryId: oldCat.id, color: cmd.oldColor } as Markup)
      : m
  )
```
Extend to restore wallHeight on undo:
```typescript
  const nextList = pageList.map((m) =>
    m.id === cmd.markupId
      ? ({
          ...m,
          name: cmd.oldName,
          categoryId: oldCat.id,
          color: cmd.oldColor,
          ...(cmd.oldWallHeight !== undefined ? { wallHeight: cmd.oldWallHeight } : {})
        } as Markup)
      : m
  )
```
Similarly for redo (lines 283–295), restore `newWallHeight`.

---

### `src/renderer/src/stores/projectStore.ts` (store, CRUD)

**Analog:** self (extend)

**Current ProjectStoreState interface** (lines 6–19):
```typescript
interface ProjectStoreState {
  currentFilePath: string | null
  isDirty: boolean
  isSaving: boolean
  isExporting: boolean
  lastSavedAt: number | null

  setSaved: (filePath: string) => void
  setSaving: (v: boolean) => void
  setExporting: (v: boolean) => void
  setCurrentFilePath: (filePath: string | null) => void
  markDirty: () => void
  reset: () => void
}
```
Extend to add visibility state:
```typescript
interface ProjectStoreState {
  // ...existing fields...
  hiddenItemNames: string[]
  toggleHiddenItem: (name: string) => void
}
```

**markDirty pattern** (lines 53–57):
```typescript
markDirty: () => {
  if (_hydrating) return
  if (get().isDirty) return
  set({ isDirty: true })
},
```
`toggleHiddenItem` calls `get().markDirty()` last, following this established pattern:
```typescript
toggleHiddenItem: (name) => {
  set((s) => {
    const idx = s.hiddenItemNames.indexOf(name)
    const next = idx >= 0
      ? s.hiddenItemNames.filter((n) => n !== name)
      : [...s.hiddenItemNames, name]
    return { hiddenItemNames: next }
  })
  get().markDirty()
},
```

**reset pattern** (lines 59–66):
```typescript
reset: () => set({
  currentFilePath: null,
  isDirty: false,
  isSaving: false,
  isExporting: false,
  lastSavedAt: null
})
```
Extend to include `hiddenItemNames: []` in the reset object.

**hydrate path** — `projectStore` has no explicit `hydrate` action; `hiddenItemNames` is set at store creation and updated via a `set()` call in the `useProject` hook during project load. Add a `setHiddenItemNames: (names: string[]) => void` action or handle it via the existing direct `useProjectStore.setState({ hiddenItemNames: ... })` pattern used in `useProject.ts`.

---

### `src/renderer/src/components/Toolbar.tsx` (component, event-driven)

**Analog:** self (extend)

**Module-level ref pattern** (lines 43–61 of CanvasViewport.tsx):
```typescript
let _canvasControls: { zoomIn: () => void; zoomOut: () => void; fitToWindow: () => void } | null = null
export function getCanvasControls() { return _canvasControls }

let _calibrationControls: { activate: () => void; activateVerify: () => void; cancel: () => void } | null = null
export function getCalibrationControls() { return _calibrationControls }
```
The chain badge reads from an equivalent module-level ref added to CanvasViewport.tsx:
```typescript
// In CanvasViewport.tsx (module level):
let _chainArmedItem: { name: string; color: string } | null = null
export function getChainArmedItem() { return _chainArmedItem }
```
Toolbar reads this in render: `const chainArmed = getChainArmedItem()`

**handleMarkupToolClick pattern** (lines 189–195):
```typescript
const handleMarkupToolClick = (tool: 'count' | 'linear' | 'area' | 'perimeter'): void => {
  if (activeTool === tool) {
    setActiveTool('select')  // toggling off breaks chain via cancelMarkup() in CanvasViewport effect
  } else {
    setActiveTool(tool)
  }
}
```
Extend type signature to include `'wall'`:
```typescript
const handleMarkupToolClick = (tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'): void => {
```
No logic change needed — the existing `setActiveTool('select')` path triggers `cancelMarkup()` in CanvasViewport, which resets `chainArmed: false` via `INITIAL_STATE`.

**IconButton component** (lines 28–95) — used verbatim for the new BrickWall button:
```typescript
function IconButton({
  icon: Icon, label, onClick, disabled = false, active = false,
  title, ariaLabel, onContextMenu, children
}: { ... }): React.JSX.Element {
  // ...
  return (
    <button ... style={{ borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent', ... }}>
      <Icon size={16} color="currentColor" />
      {label && <span>{label}</span>}
      {children}
    </button>
  )
}
```

**Set Scale chevron child pattern** (lines 334–351) — chain badge chip uses same children mechanism:
```typescript
<IconButton icon={Ruler} label="Set Scale" active={isCalibrating} ...>
  {pageScale !== null && (
    <span role="button" onClick={handleChevronClick}
      style={{ display: 'inline-block', marginLeft: 6, fontSize: 10, opacity: 0.7, cursor: 'pointer' }}>
      {'▾'}
    </span>
  )}
</IconButton>
```
Chain badge chip renders as a child of the active tool's `IconButton`:
```typescript
<IconButton icon={BrickWall} label="Wall" active={activeTool === 'wall'} ...>
  {activeTool === 'wall' && getChainArmedItem() !== null && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      marginLeft: 6, fontSize: 11, fontWeight: 600,
      background: COLORS.activeSurface, borderRadius: 3,
      padding: '1px 4px', maxWidth: 80, overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap'
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: getChainArmedItem()!.color, flexShrink: 0
      }} />
      {getChainArmedItem()!.name}
    </span>
  )}
</IconButton>
```
Apply this same chip pattern to Count, Linear, Area, Perimeter tool buttons too (chain applies to all 5).

**Markup tools section** (lines 357–392) — add fifth BrickWall button immediately after Perimeter:
```typescript
{/* Markup tools: Count, Linear, Area, Perimeter */}
{totalPages > 0 && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <IconButton icon={MapPin} label="Count" active={activeTool === 'count'}
      disabled={setScaleDisabled} onClick={() => handleMarkupToolClick('count')}
      title="Count tool — place pins to tally items" />
    <IconButton icon={Minus} label="Linear" active={activeTool === 'linear'}
      disabled={setScaleDisabled} onClick={() => handleMarkupToolClick('linear')}
      title="Linear tool — draw polylines to measure lengths" />
    <IconButton icon={Square} label="Area" active={activeTool === 'area'}
      disabled={setScaleDisabled} onClick={() => handleMarkupToolClick('area')}
      title="Area tool — trace polygons to measure surface area" />
    <IconButton icon={Hexagon} label="Perimeter" active={activeTool === 'perimeter'}
      disabled={setScaleDisabled} onClick={() => handleMarkupToolClick('perimeter')}
      title="Perimeter tool — trace polygons for perimeter + area" />
    {/* ADD HERE: */}
    <IconButton icon={BrickWall} label="Wall" active={activeTool === 'wall'}
      disabled={setScaleDisabled} onClick={() => handleMarkupToolClick('wall')}
      title="Wall tool — measure wall area (length × height) in m²" />
  </div>
)}
```

---

### `src/renderer/src/components/MarkupNamePopup.tsx` (component, request-response)

**Analog:** self (extend)

**Props interface** (lines 10–27):
```typescript
export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after' | 'edit'
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  initialName?: string
  initialCategoryName?: string
  initialColor?: string
  measurementPreview?: string
  onConfirm: (payload: { name: string; categoryName: string; color: string }) => void
  onCancel: () => void
}
```
Extend to add wall-height props:
```typescript
export interface MarkupNamePopupProps {
  // ...existing props...
  toolType?: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'  // NEW
  initialWallHeight?: number   // mm, default 2400, NEW
  onConfirm: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
}
```

**Local state pattern** (lines 57–61):
```typescript
const [name, setName] = useState(initialName)
const [categoryName, setCategoryName] = useState(initialCategoryName)
const [showCategoryList, setShowCategoryList] = useState(false)
const [nameError, setNameError] = useState<string | null>(null)
```
Add wall-height state:
```typescript
const [wallHeight, setWallHeight] = useState<string>(String(initialWallHeight ?? 2400))
const [wallHeightError, setWallHeightError] = useState<string | null>(null)
```

**handleConfirm validation pattern** (lines 91–105):
```typescript
const handleConfirm = useCallback((): void => {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    setNameError('Enter an item name')
    return
  }
  const typed = categoryName.trim()
  const canonical = typed === '' ? '' : (findCategoryByName(typed)?.name ?? typed)
  onConfirm({ name: trimmedName, categoryName: canonical, color: selectedColor })
}, [name, categoryName, selectedColor, onConfirm, findCategoryByName])
```
Extend for wall validation:
```typescript
const handleConfirm = useCallback((): void => {
  const trimmedName = name.trim()
  if (trimmedName === '') { setNameError('Enter an item name'); return }
  if (toolType === 'wall') {
    const h = parseFloat(wallHeight)
    if (isNaN(h) || h <= 0) { setWallHeightError('Enter a positive height in mm'); return }
  }
  const typed = categoryName.trim()
  const canonical = typed === '' ? '' : (findCategoryByName(typed)?.name ?? typed)
  onConfirm({
    name: trimmedName,
    categoryName: canonical,
    color: selectedColor,
    ...(toolType === 'wall' ? { wallHeight: parseFloat(wallHeight) } : {})
  })
}, [name, categoryName, selectedColor, toolType, wallHeight, onConfirm, findCategoryByName])
```

**Color row section JSX pattern** (lines 234–269) — insert wall-height row AFTER color row and BEFORE measurementPreview:
```typescript
{toolType === 'wall' && (
  <div>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
      Wall height (mm)
    </label>
    <input
      type="number"
      min="1"
      value={wallHeight}
      onChange={(e) => { setWallHeight(e.target.value); if (wallHeightError) setWallHeightError(null) }}
      onMouseDown={(e) => e.stopPropagation()}  // D-pattern: prevent popup close on input click
      placeholder="2400"
      style={inputStyle}
    />
    {wallHeightError && (
      <div style={{ color: COLORS.warning, fontSize: 13, marginTop: 4 }}>
        {wallHeightError}
      </div>
    )}
  </div>
)}
```
The `onMouseDown + e.stopPropagation()` pattern matches `CategoryAutocomplete` usage in the same file (established in STATE.md).

---

### `src/renderer/src/components/TotalsRow.tsx` (component, event-driven)

**Analog:** self (extend)

**Current layout JSX comment** (line 9–11 of TotalsRow.tsx):
```typescript
// Layout:
//   [cycle-dot 6px slot][color chip 10x10][gap 4px][label flex:1][quantity right tabular-nums][gap 4px][uom 40px]
```
New layout inserts lightbulb BEFORE color chip:
```
[cycle-dot 6px slot][lightbulb 16px][color chip 10x10][gap 4px][label flex:1][quantity right][gap 4px][uom 40px]
```

**Hidden state reads pattern** (RESEARCH.md recommended):
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(itemName))
```
Read `itemName` from the existing `useMemo(() => labelToName(item.label), [item.label])` (line 101).

**handleContextMenu e.stopPropagation() pattern** (line 147):
```typescript
const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
  e.preventDefault()
  onContextMenu(e.clientX, e.clientY)
}
```
The lightbulb slot uses the same `e.stopPropagation()` pattern as the Set Scale chevron (Toolbar line 204):
```typescript
<div
  style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
  onClick={(e) => { e.stopPropagation(); useProjectStore.getState().toggleHiddenItem(itemName) }}
  title={isHidden ? 'Show on canvas' : 'Hide from canvas'}
>
  {isHidden
    ? <LightbulbOff size={12} color={COLORS.textSecondary} />
    : <Lightbulb size={12} color={COLORS.textSecondary} />
  }
</div>
```
Insert this `<div>` between the cycle-dot slot (lines 178–198) and the color chip (lines 200–212).

**labelToName helper** (lines 54–57) — extend to strip `(wall)` suffix if we ever emit one:
```typescript
function labelToName(label: string): string {
  return label.replace(/\s*\((count|linear|area|perimeter)\)\s*$/, '')
}
```
Extend to:
```typescript
return label.replace(/\s*\((count|linear|area|perimeter|wall)\)\s*$/, '')
```

**rowTypeToMarkupType helper** (lines 59–63) — extend to map `'wall'` to `'wall'`:
```typescript
function rowTypeToMarkupType(t: BoqRowType): MarkupType {
  if (t === 'perimeter-length' || t === 'perimeter-area') return 'perimeter'
  return t  // 'count' | 'linear' | 'area' — and now 'wall' passes through unchanged
}
```
No change needed if `BoqRowType` includes `'wall'` and `MarkupType` includes `'wall'` — TypeScript exhaustiveness will enforce correctness.

---

### `src/renderer/src/components/CanvasViewport.tsx` (component, event-driven)

**Analog:** self (extend)

**Module-level ref pattern for chain badge** (lines 43–61 — established pattern):
```typescript
let _canvasControls: { ... } | null = null
export function getCanvasControls() { return _canvasControls }

let _calibrationControls: { ... } | null = null
export function getCalibrationControls() { return _calibrationControls }
```
Add:
```typescript
let _chainArmedItem: { name: string; color: string } | null = null
export function getChainArmedItem() { return _chainArmedItem }
```
Populate via `useEffect` inside the component:
```typescript
useEffect(() => {
  _chainArmedItem = (markupState.chainArmed && markupState.pendingName)
    ? { name: markupState.pendingName, color: markupState.pendingColor }
    : null
}, [markupState.chainArmed, markupState.pendingName, markupState.pendingColor])
```

**activeTool → markup tool effect** (lines 193–199):
```typescript
useEffect(() => {
  if (isMarkupTool(activeTool) && markupState.toolType !== activeTool) {
    activateMarkup(activeTool)
  } else if (!isMarkupTool(activeTool) && markupState.mode !== 'idle') {
    cancelMarkup()
  }
}, [activeTool, markupState.toolType, markupState.mode, activateMarkup, cancelMarkup])
```
No change to this effect — it calls `activateMarkup(activeTool)` which now accepts `'wall'`. The `isMarkupTool` type guard in `types/viewer.ts` must include `'wall'`.

**getCursor() function** (lines 464–478):
```typescript
const getCursor = (): string => {
  if (spaceHeld) return 'grab'
  if (calibMode !== 'idle') return 'crosshair'
  if (...isOverStartPoint...) return 'pointer'
  if (markupState.mode === 'drawing') return 'crosshair'
  if (markupState.toolType === 'count' && markupState.mode === 'placing') return 'crosshair'
  return 'default'
}
```
Replace the `'crosshair'` string returns with the SVG data-URL constant, or simply replace the container `cursor: getCursor()` inline style with:
```typescript
const CROSSHAIR_CURSOR = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='black' stroke-width='3'/>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='white' stroke-width='1.5'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`
})()
```
Defined at module scope (outside the component) to compute once. Applied in `getCursor()` by replacing `return 'crosshair'` with `return CROSSHAIR_CURSOR`.

**Container div cursor pattern** (lines 539–552):
```typescript
<div
  ref={containerCallbackRef}
  style={{
    position: 'absolute',
    inset: 0,
    ...
    cursor: getCursor()
  }}
>
```
No change to the pattern — `getCursor()` now returns the CROSSHAIR_CURSOR string when appropriate.

**Layer 1b committed markup rendering pattern** (lines 663–734):
```typescript
{pageMarkups.filter((m) => m.type === 'linear').map((m) => {
  const category = getCategory(m.categoryId)
  if (!category) return null
  return (
    <LinearMarkup
      key={m.id}
      markup={m as LinearMarkupType}
      category={category}
      currentZoom={currentZoom}
      pageScale={pageScale}
      onHoverEnter={handleHoverEnter}
      onHoverLeave={handleHoverLeave}
      onContextMenu={handleContextMenu}
    />
  )
})}
```
Add wall markup rendering in Layer 1b after perimeter markups, using the same pattern:
```typescript
{pageMarkups.filter((m) => m.type === 'wall').map((m) => {
  const category = getCategory(m.categoryId)
  if (!category) return null
  return (
    <WallMarkup
      key={m.id}
      markup={m as WallMarkupType}
      category={category}
      currentZoom={currentZoom}
      pageScale={pageScale}
      onHoverEnter={handleHoverEnter}
      onHoverLeave={handleHoverLeave}
      onContextMenu={handleContextMenu}
    />
  )
})}
```

**MarkupNamePopup save-after wiring** (lines 861–872):
```typescript
{markupState.mode === 'confirming' && markupState.popupScreenPos && (
  <MarkupNamePopup
    mode="save-after"
    screenPos={markupState.popupScreenPos}
    containerSize={containerSize}
    onConfirm={commitShape}
    onCancel={() => {
      cancelMarkup()
      useViewerStore.getState().setActiveTool('select')
    }}
  />
)}
```
Extend to pass `toolType` and `initialWallHeight` for wall tool:
```typescript
<MarkupNamePopup
  mode="save-after"
  screenPos={markupState.popupScreenPos}
  containerSize={containerSize}
  toolType={markupState.toolType ?? undefined}
  initialWallHeight={markupState.toolType === 'wall' ? markupState.pendingWallHeight : undefined}
  onConfirm={commitShape}
  onCancel={...}
/>
```

**in-progress linear preview Layer 1a** (lines 616–659) — wall tool uses the same `'linear'` preview path since it is also a polyline drawn with dblclick to finish. Extend the `toolType === 'linear'` check to also cover `'wall'`:
```typescript
// Line 616:
{(markupState.toolType === 'linear' || markupState.toolType === 'wall') &&
  markupState.mode === 'drawing' && ...}
// Line 453:
if (markupState.toolType === 'linear' || markupState.toolType === 'wall') && markupState.mode === 'drawing') {
  finishLinear()
}
```

---

### `src/renderer/src/components/markup/CountPinMarkup.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/markup/LinearMarkup.tsx` (for hidden-item pattern)

**Hidden-item skip-render** — add at the top of the function body, before `const fill = markup.color`:
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(markup.name))
if (isHidden) return null
```
Requires adding `import { useProjectStore } from '../../stores/projectStore'`.

---

### `src/renderer/src/components/markup/LinearMarkup.tsx` (component, request-response)

**Analog:** self (extend)

**Hidden-item skip-render** — add at the top of the function body, before `const strokeWidth`:
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(markup.name))
if (isHidden) return null
```

---

### `src/renderer/src/components/markup/AreaMarkup.tsx` (component, request-response)

**Analog:** self (extend)

Same hidden-item skip-render pattern as LinearMarkup. Add before `const strokeWidth` computation (line 39).

---

### `src/renderer/src/components/markup/PerimeterMarkup.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/markup/AreaMarkup.tsx`

Same hidden-item skip-render pattern as AreaMarkup. Add before first computed value.

---

### `src/renderer/src/components/HoverRing.tsx` (component, event-driven)

**Analog:** self (review)

**Current markup type dispatch** (lines 50–98):
```typescript
{markups.map((m) => {
  if (m.type === 'count') { return <Circle ... /> }
  if (m.type === 'linear') { return <Line ... /> }
  // area + perimeter — closed polygon:
  const closing = [...m.points, m.points[0]]
  return <Line key={m.id} points={closing.flatMap(...)} ... />
})}
```
`WallMarkup` is a polyline (NOT closed) — add a `'wall'` branch that mirrors the `'linear'` case:
```typescript
if (m.type === 'wall') {
  return (
    <Line
      key={m.id}
      points={m.points.flatMap((p) => [p.x, p.y])}
      stroke={RING_COLOR}
      strokeWidth={stroke + offset * 2}
      opacity={RING_OPACITY}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  )
}
```
No hidden-item check needed here — hidden markup names produce no hover matches to begin with (if rendering is skipped at the layer level, `currentPageMatches` from TotalsRow will not include them in hover calls).

---

### `src/renderer/src/components/PulseHighlight.tsx` (component, event-driven)

**Analog:** self (review)

Same `'wall'` dispatch as HoverRing — add a `'wall'` branch mirroring `'linear'` (open polyline, not closed). Place after the `if (m.type === 'linear')` block and before the closing fallback (area/perimeter).

---

### `src/renderer/src/lib/markup-math.ts` (utility, transform)

**Analog:** self (extend)

**Existing function pattern** (lines 39–43):
```typescript
export function pixelLengthToReal(pixelLen: number, pixelsPerMm: number, unit: ScaleUnit): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  const mm = pixelLen / pixelsPerMm
  return fromMm(mm, unit)
}
```
New `wallAreaM2` function follows the same signature convention (pure, throws on invalid input):
```typescript
export function wallAreaM2(
  points: StagePoint[],
  wallHeightMm: number,
  pixelsPerMm: number
): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  if (wallHeightMm <= 0) throw new Error('wallHeightMm must be positive')
  const pixelLen = polylineLength(points)
  const lengthM = pixelLen / pixelsPerMm / 1000  // px → mm → m
  const heightM = wallHeightMm / 1000
  return lengthM * heightM
}
```
Note: uses inline conversion rather than `pixelLengthToReal(px, pixelsPerMm, 'm')` to avoid the assumption A1 risk about `'m'` being a valid `ScaleUnit`. Inline math is explicit and testable.

---

### `src/renderer/src/lib/boq-types.ts` (model)

**Analog:** self (extend)

**Current BoqRowType** (lines 19–24):
```typescript
export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter-length'
  | 'perimeter-area'
```
Extend to:
```typescript
export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter-length'
  | 'perimeter-area'
  | 'wall'
```

---

### `src/renderer/src/lib/boq-aggregator.ts` (service, batch)

**Analog:** self (extend)

**uomFor function** (lines 35–39):
```typescript
function uomFor(t: BoqRowType, globalUnit: string): string {
  if (t === 'count') return 'ea'
  if (t === 'linear' || t === 'perimeter-length') return globalUnit
  return globalUnit + '²'
}
```
Extend to handle `'wall'`:
```typescript
function uomFor(t: BoqRowType, globalUnit: string): string {
  if (t === 'count') return 'ea'
  if (t === 'linear' || t === 'perimeter-length') return globalUnit
  if (t === 'wall') return 'm²'   // wall is always m² — not globalUnit (D-12)
  return globalUnit + '²'
}
```

**findUncalibratedMarkupPages hasMeasurement check** (lines 66–69):
```typescript
const hasMeasurement = list.some(
  (m) => m.type === 'linear' || m.type === 'area' || m.type === 'perimeter'
)
```
Extend to include `'wall'`:
```typescript
const hasMeasurement = list.some(
  (m) => m.type === 'linear' || m.type === 'area' || m.type === 'perimeter' || m.type === 'wall'
)
```

**Per-type dispatch in aggregation loop** (lines 128–151) — wall branch goes after the perimeter branch:
```typescript
} else if (m.type === 'perimeter') {
  // ...existing perimeter logic...
} else if (m.type === 'wall') {
  // scale === null check already passed (line 125: if (scale === null) continue)
  const wallM = m as WallMarkup
  const pixelLen = polylineLength(wallM.points)
  const lengthM = pixelLen / scale.pixelsPerMm / 1000   // px → mm → m
  const heightM = wallM.wallHeight / 1000
  add(catId, m.name, 'wall', lengthM * heightM)
}
```
The `add()` helper (lines 106–112) is reused verbatim:
```typescript
function add(categoryId: string | null, name: string, type: BoqRowType, qty: number): void {
  const map = bucketFor(categoryId)
  const k = `${name}|${type}`
  const cur = map.get(k) ?? { quantity: 0, color: getColorForName(name) }
  cur.quantity += qty
  map.set(k, cur)
}
```

**D-02 collision-detection exclusion** (lines 166–177) — wall rows need the same treatment as `perimeter-length`/`perimeter-area` to avoid the disambiguation suffix. Add `'wall'` to the exclusion condition — or more precisely, wall names only produce one row type (no split), so they pass through the `nonPerimSet.size >= 2` check naturally (a wall name gets `'wall'` only). No code change needed unless a name is used as both `'wall'` and `'linear'` — in that case the disambiguation suffix `(wall)` / `(linear)` would appear. This is the intended behavior.

---

### `src/main/boq-writers.ts` (service, batch)

**Analog:** self (extend)

**Inline-duplicated BoqRowType** (line 18):
```typescript
export type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter-length' | 'perimeter-area'
```
Extend to:
```typescript
export type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter-length' | 'perimeter-area' | 'wall'
```

**numFmtForUom function** (lines 90–92):
```typescript
function numFmtForUom(uom: string): string {
  return uom === 'ea' ? NUMFMT_INTEGER : NUMFMT_DECIMAL
}
```
No change needed — wall rows have `uom = 'm²'` which is not `'ea'`, so they automatically get `NUMFMT_DECIMAL` (2dp). No special case required.

**appendItemRow function** (lines 164–177) — works unchanged; wall items arrive with correct `label`, `quantity`, `uom`, `color` from aggregator. No modification.

---

### `src/renderer/src/lib/project-schema.ts` (model)

**Analog:** self (extend)

**Current ProjectFileV2 interface** (lines 63–83):
```typescript
export interface ProjectFileV2 {
  formatVersion: 2
  createdAt: string
  updatedAt: string
  pdf: {
    originalFilename: string
    sha256: string
    totalPages: number
  }
  globalUnit: ScaleUnit
  categories: Record<string, { id: string; name: string; color: string; paletteIndex: number }>
  categoryOrder: string[]
  currentPage: number
  pages: Array<{
    pageIndex: number
    dimensions: { width: number; height: number }
    scale: PageScale | null
    viewport: ViewportState
    markups: Markup[]
  }>
}
```
Add additive optional field:
```typescript
export interface ProjectFileV2 {
  // ...existing fields unchanged...
  hiddenItemNames?: string[]   // additive — absent in pre-Phase 8 files; defaults to [] on load
}
```

**validateV2 function** (lines 87–113):
```typescript
export function validateV2(raw: unknown): ProjectFileV2 {
  // ...field checks...
  return raw as ProjectFileV2  // cast, not strict parse — line 113
}
```
No change to `validateV2` needed — the cast on line 113 accepts the new optional field automatically. The absence of `hiddenItemNames` in old files is handled at the deserialize call site (in `useProject.ts`):
```typescript
// In useProject.ts hydrate path — after validateV2(raw):
const hiddenItemNames: string[] = Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : []
useProjectStore.getState().setHiddenItemNames(hiddenItemNames)
```

**Project serialization** — in `useProject.ts` `buildProjectJson` (or equivalent serializer), include `hiddenItemNames` explicitly in the output object:
```typescript
const projectJson: ProjectFileV2 = {
  formatVersion: 2,
  // ...existing fields...
  hiddenItemNames: useProjectStore.getState().hiddenItemNames
}
```

---

## Shared Patterns

### Zoom-Compensated Stroke (Konva canvas layer)
**Source:** `src/renderer/src/components/markup/LinearMarkup.tsx` line 51
**Apply to:** `WallMarkup.tsx` (new), all stroke-width values in Konva shapes
```typescript
const strokeWidth = STROKE_BASE_PX / currentZoom
```

### Group + Event Handler Boilerplate (Konva interactive markup)
**Source:** `src/renderer/src/components/markup/LinearMarkup.tsx` lines 71–85
**Apply to:** `WallMarkup.tsx` verbatim
```typescript
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
>
```

### Dark Chip Label (world-anchored)
**Source:** `src/renderer/src/components/markup/LinearMarkup.tsx` lines 93–117
**Apply to:** `WallMarkup.tsx` verbatim (only `labelText` computation differs)
```typescript
{labelText && (
  <>
    <Rect x={chipX} y={chipY} width={chipW} height={chipH}
      cornerRadius={LABEL_CHIP_RADIUS_WORLD}
      fill="rgba(20, 20, 20, 0.78)"
      listening={false}
    />
    <Text x={chipX} y={chipY + LABEL_PAD_Y_WORLD} width={chipW}
      text={labelText} fontSize={LABEL_FONT_WORLD}
      fontFamily="Inter, sans-serif" fontStyle="700"
      fill="#ffffff" align="center" listening={false}
    />
  </>
)}
```

### Hidden-Item Skip-Render (renderer components)
**Source:** RESEARCH.md §Feature 3 (Markup Renderer Skip-Render Pattern)
**Apply to:** `CountPinMarkup.tsx`, `LinearMarkup.tsx`, `AreaMarkup.tsx`, `PerimeterMarkup.tsx`, `WallMarkup.tsx`
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(markup.name))
if (isHidden) return null
```
Place as the first two lines of the render function body, before any computed values.

### Module-Level Ref Cross-Component Channel
**Source:** `src/renderer/src/components/CanvasViewport.tsx` lines 43–62
**Apply to:** `_chainArmedItem` ref in CanvasViewport + `getChainArmedItem()` consumed by Toolbar
```typescript
let _chainArmedItem: { name: string; color: string } | null = null
export function getChainArmedItem() { return _chainArmedItem }
```
Exactly mirrors the `_canvasControls` / `_calibrationControls` pattern.

### Store Action with markDirty
**Source:** `src/renderer/src/stores/projectStore.ts` lines 53–57
**Apply to:** `toggleHiddenItem` action
```typescript
markDirty: () => {
  if (_hydrating) return
  if (get().isDirty) return
  set({ isDirty: true })
},
```
`toggleHiddenItem` must call `get().markDirty()` last so the `_hydrating` guard fires correctly.

### stateRef StrictMode Guard (useMarkupTool side effects)
**Source:** `src/renderer/src/hooks/useMarkupTool.ts` lines 80–85, 128–130, 275–276
**Apply to:** Wall dispatch inside `commitShape`
```typescript
// Read from stateRef (not state) to avoid double-dispatch under React StrictMode:
const prev = stateRef.current
// ... dispatch store.placeMarkup(m) outside setState updater ...
setState(...)  // setState after dispatch
```
The wall markup creation follows this pattern exactly — never dispatch `store.placeMarkup` inside a `setState` updater.

### e.stopPropagation on Nested Click Targets
**Source:** `src/renderer/src/components/Toolbar.tsx` line 204 (Set Scale chevron)
**Apply to:** TotalsRow lightbulb slot `onClick`
```typescript
onClick={(e) => { e.stopPropagation(); useProjectStore.getState().toggleHiddenItem(itemName) }}
```

### onMouseDown + e.stopPropagation on Popup Inputs
**Source:** Established pattern (STATE.md, used in CategoryAutocomplete)
**Apply to:** Wall height `<input>` in `MarkupNamePopup.tsx`
```typescript
onMouseDown={(e) => e.stopPropagation()}
```
Prevents the popup from registering the input focus as a "click outside" and self-closing.

---

## Types/viewer.ts — isMarkupTool Guard Extension

**Source:** `src/renderer/src/types/viewer.ts` lines 67–73
```typescript
export type ActiveTool = 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter'

export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter'] as const
export type MarkupToolType = typeof MARKUP_TOOLS[number]

export function isMarkupTool(tool: ActiveTool): tool is MarkupToolType {
  return (MARKUP_TOOLS as readonly string[]).includes(tool)
}
```
Must extend before all other work (Wave 0 — Pitfall 1 from RESEARCH.md):
```typescript
export type ActiveTool = 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter' | 'wall'

export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter', 'wall'] as const
```
No change to `isMarkupTool` body — it reads from `MARKUP_TOOLS`.

---

## No Analog Found

All files have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `src/renderer/src/`, `src/main/`
**Files scanned:** 20 source files read in full
**Pattern extraction date:** 2026-05-15
