# Phase 2: Scale Calibration - Research

**Researched:** 2026-03-28
**Domain:** Interactive canvas measurement, coordinate transforms, per-page state management
**Confidence:** HIGH

## Summary

Scale calibration is mathematically simple (Euclidean distance + ratio) but requires careful integration with the existing Konva Stage zoom/pan transform system. The user clicks two points on the PDF, the app calculates the pixel distance between them, the user enters a real-world distance, and the app computes a `pixelsPerUnit` ratio stored per-page in the Zustand store. All future measurements on that page multiply pixel lengths by this ratio.

The critical technical challenge is converting mouse clicks on a zoomed/panned Stage into the correct coordinates in PDF-page space. Konva provides `layer.getRelativePointerPosition()` which inverts all parent transforms automatically -- this is the correct API to use, not manual math on `stage.getPointerPosition()`.

**Primary recommendation:** Add scale state per-page to the Zustand store, implement a "Set Scale" tool mode that draws a Konva Line on the markup layer, show a confirmation dialog with the computed ratio, and display calibration status in the StatusBar.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAL-01 | User can set scale by drawing a line between two known points on the plan and entering the real-world distance | Konva Line + click handler with `getRelativePointerPosition()` for coordinate conversion; modal dialog for distance input |
| SCAL-02 | Scale is stored per page -- each page can have a different scale ratio | Extend Zustand `viewerStore` with `pageScales: Record<number, ScaleState>` |
| SCAL-03 | User can see the current page's scale ratio displayed in the UI | Add scale indicator to StatusBar component; show "Not calibrated" or the ratio |
| SCAL-04 | User can verify scale accuracy by measuring a second known dimension and comparing against its expected value | "Verify Scale" tool mode: draw a second line, display computed real-world length for visual comparison |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| konva | 10.2.3 | Konva.Line for calibration line, Circle for endpoints | Installed |
| react-konva | 19.2.3 | React components: `<Line>`, `<Circle>`, `<Text>` | Installed |
| zustand | 5.0.12 | Per-page scale state storage | Installed |
| react | 19.2.1 | UI components, dialog | Installed |

### Supporting (already installed)
| Library | Version | Purpose |
|---------|---------|---------|
| lucide-react | 1.6.0 | Icons for Scale tool button and status indicators |

### No new dependencies required
This phase uses only existing libraries. The math is pure TypeScript (Euclidean distance, ratio calculation). No measurement or geometry library is needed.

## Architecture Patterns

### Existing Project Structure (relevant files)
```
src/renderer/src/
  stores/viewerStore.ts       # Add per-page scale state here
  types/viewer.ts             # Add ScaleState type here
  components/CanvasViewport.tsx  # Add calibration line layer + click handling
  components/StatusBar.tsx    # Add scale indicator
  components/Toolbar.tsx      # Add Scale tool button
  lib/constants.ts            # Add scale-related constants
```

### Pattern 1: Per-Page Scale State in Zustand Store

**What:** Extend the existing viewer store with per-page scale data alongside the existing `pageViewports` pattern.

**When to use:** This mirrors the existing `pageViewports: Record<number, ViewportState>` pattern already established in Phase 1.

**Example:**
```typescript
// types/viewer.ts
export type MeasurementUnit = 'm' | 'ft' | 'mm' | 'cm' | 'in'

export interface ScaleState {
  pixelsPerUnit: number      // PDF-page-space pixels per real-world unit
  unit: MeasurementUnit      // The unit the user entered
  realWorldDistance: number   // The distance the user typed (for display/re-calibration)
  linePoints: [number, number, number, number]  // [x1,y1,x2,y2] in page-space coords
}

// In ViewerState:
pageScales: Record<number, ScaleState>
setPageScale: (page: number, scale: ScaleState) => void
getPageScale: (page: number) => ScaleState | null
clearPageScale: (page: number) => void
```

### Pattern 2: Tool Mode State Machine

**What:** A simple active-tool state that determines how canvas clicks are interpreted. Phase 2 introduces the first tool modes; Phase 3 will add markup tools.

**When to use:** The app needs to distinguish between "pan/navigate mode" (default) and "set scale mode" (calibration).

**Example:**
```typescript
// types/viewer.ts
export type ActiveTool = 'select' | 'scale' | 'verify-scale'

// In ViewerState:
activeTool: ActiveTool
setActiveTool: (tool: ActiveTool) => void
```

**Key consideration:** When `activeTool === 'scale'`, left-click places calibration points instead of being consumed by pan. The existing `Konva.dragButtons` configuration in `useViewportControls.ts` already separates left-click (tool use) from middle-click (always-pan) and space+left-click (pan mode). When a tool is active, left-click drag should NOT pan -- only middle-click and space+left-click should pan.

### Pattern 3: Coordinate Conversion (click -> page space)

**What:** Convert screen click position to PDF-page-space coordinates, accounting for Stage zoom and pan.

**When to use:** Every time the user clicks to place a calibration point.

**Critical detail:** The existing `CanvasViewport` applies zoom/pan as a Stage transform. Konva's `layer.getRelativePointerPosition()` returns coordinates in the Layer's local space, which is the same as PDF-page space since the Layer has no transform of its own -- only the Stage is transformed.

**Example:**
```typescript
// Inside CanvasViewport click handler
const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
  if (activeTool !== 'scale') return

  // getRelativePointerPosition on the Layer gives page-space coords
  const layer = e.target.getStage()?.findOne('Layer')
  if (!layer) return
  const pos = layer.getRelativePointerPosition()
  if (!pos) return

  // pos.x, pos.y are now in PDF-page pixel space
  // Store as calibration point
}
```

**Alternative (also correct):** Use the stage's transform inversion manually:
```typescript
const stage = stageRef.current
const pointer = stage.getPointerPosition() // screen coords
const transform = stage.getAbsoluteTransform().copy().invert()
const pagePos = transform.point(pointer) // page-space coords
```

Both approaches yield the same result. The `getRelativePointerPosition()` method is cleaner.

### Pattern 4: Calibration Math

**What:** Pure function that converts pixel distance + user-entered real-world distance into a scale ratio.

**Example:**
```typescript
// lib/scale-math.ts
export function euclideanDistance(
  x1: number, y1: number, x2: number, y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function computeScale(
  pixelDistance: number,
  realWorldDistance: number,
  unit: MeasurementUnit
): ScaleState['pixelsPerUnit'] {
  return pixelDistance / realWorldDistance
}

export function pixelsToRealWorld(
  pixelLength: number,
  pixelsPerUnit: number
): number {
  return pixelLength / pixelsPerUnit
}
```

**This MUST be a pure function with unit tests.** It is the mathematical foundation that all markup measurements in Phase 3+ depend on.

### Pattern 5: Calibration Line Visual Feedback

**What:** While the user is in "set scale" mode, show visual feedback: crosshair cursor, placed endpoint circles, and a dashed line between points.

**Example:**
```typescript
// In the markup layer of CanvasViewport
{activeTool === 'scale' && calibrationPoints.length > 0 && (
  <>
    <Circle x={calibrationPoints[0].x} y={calibrationPoints[0].y}
      radius={6 / currentZoom} fill="#ff4444" />
    {calibrationPoints.length === 2 && (
      <>
        <Circle x={calibrationPoints[1].x} y={calibrationPoints[1].y}
          radius={6 / currentZoom} fill="#ff4444" />
        <Line
          points={[
            calibrationPoints[0].x, calibrationPoints[0].y,
            calibrationPoints[1].x, calibrationPoints[1].y
          ]}
          stroke="#ff4444"
          strokeWidth={2 / currentZoom}
          dash={[8 / currentZoom, 4 / currentZoom]}
        />
      </>
    )}
  </>
)}
```

**Critical:** The `radius`, `strokeWidth`, and `dash` values must be divided by `currentZoom` so they appear the same visual size regardless of zoom level. This is because the Stage transform scales everything -- without compensation, a 2px line at 8x zoom would appear 16px thick.

### Anti-Patterns to Avoid

- **Storing scale as a global value:** Each page MUST have its own independent scale. Construction PDF sets routinely mix A1 and A3 sheets, floor plans at 1:100, and details at 1:50.
- **Using `stage.getPointerPosition()` directly as page coordinates:** This returns screen-space coordinates. You MUST transform through the Stage's inverse transform to get page-space coordinates. This is the #1 source of calibration bugs.
- **Computing scale from screen-space pixel distance:** The drawn line's pixel distance must be measured in page-space, not screen-space. If the user is zoomed to 4x, the screen pixel distance is 4x the page pixel distance. Using screen distance would produce a scale ratio that changes with zoom.
- **Hardcoding units:** Support at least meters, feet, millimeters, centimeters, and inches from day one. Construction plans use all of these.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coordinate transform (screen -> page space) | Manual matrix math | `layer.getRelativePointerPosition()` or `stage.getAbsoluteTransform().copy().invert().point()` | Konva already maintains the transform chain; reimplementing it introduces float drift |
| Distance calculation | Nothing exotic | Standard Euclidean distance `Math.sqrt(dx*dx + dy*dy)` | Simple enough to implement, but extract as a tested pure function |
| Unit conversion | Full conversion library | Lookup table of multipliers between supported units | Only 5-6 units needed; a library is overkill |

## Common Pitfalls

### Pitfall 1: Screen-Space vs Page-Space Confusion
**What goes wrong:** Calibration line distance is computed from screen coordinates, producing a scale ratio that varies depending on the zoom level when calibration was performed.
**Why it happens:** `stage.getPointerPosition()` returns screen coordinates. Developer uses these directly.
**How to avoid:** Always use `layer.getRelativePointerPosition()` or the Stage transform inversion. Store points in page-space. Compute distance from page-space points only.
**Warning signs:** Scale values change when you recalibrate at a different zoom level on the same dimension.

### Pitfall 2: Visual Size at Different Zoom Levels
**What goes wrong:** Calibration line endpoints and the line itself become impossibly thin when zoomed out, or enormous when zoomed in.
**Why it happens:** The Stage transform scales all Konva shapes uniformly with the PDF.
**How to avoid:** Divide visual properties (strokeWidth, radius, dash lengths) by the current zoom factor.
**Warning signs:** Endpoints disappear when zoomed out to fit-to-window.

### Pitfall 3: Drag Conflicts During Calibration
**What goes wrong:** Left-clicking to place a calibration point also drags the stage.
**Why it happens:** The existing code sets `Konva.dragButtons = [0, 1]` when space is held, but `[1]` otherwise. However, Stage `draggable={true}` with button [0] might still interfere.
**How to avoid:** When `activeTool !== 'select'`, disable stage dragging for left-click entirely. Middle-click pan and space+left-click pan should still work.
**Warning signs:** Stage jumps when user tries to click a calibration point.

### Pitfall 4: Stale Scale After Re-Calibration
**What goes wrong:** User re-calibrates but old scale ratio is still used by measurement calculations.
**Why it happens:** Scale value is captured in a closure or derived state that doesn't re-compute.
**How to avoid:** Always read scale from the Zustand store getter (`getPageScale(currentPage)`) at measurement time, never cache it.
**Warning signs:** Measurements don't change after re-calibrating.

### Pitfall 5: Calibration Points Lost on Page Switch
**What goes wrong:** User places first calibration point, switches page to check something, switches back, and the partial calibration state is gone.
**Why it happens:** Temporary calibration state stored in component-level useState, which resets on unmount or page change.
**How to avoid:** Store in-progress calibration state (the partial points) in the Zustand store, keyed by page. Or simply: reset calibration on page change and require both clicks on the same page (simpler, and the correct UX -- you should not calibrate across pages).
**Warning signs:** User frustration when partial work disappears.

## Code Examples

### Scale Math (pure functions, must be unit-tested)
```typescript
// src/renderer/src/lib/scale-math.ts

export type MeasurementUnit = 'm' | 'ft' | 'mm' | 'cm' | 'in'

export const UNIT_LABELS: Record<MeasurementUnit, string> = {
  m: 'meters',
  ft: 'feet',
  mm: 'millimeters',
  cm: 'centimeters',
  in: 'inches'
}

export function euclideanDistance(
  x1: number, y1: number, x2: number, y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function computePixelsPerUnit(
  pixelDistance: number,
  realWorldDistance: number
): number {
  if (realWorldDistance <= 0) throw new Error('Real-world distance must be positive')
  if (pixelDistance <= 0) throw new Error('Pixel distance must be positive')
  return pixelDistance / realWorldDistance
}

export function pixelsToRealWorld(
  pixelLength: number,
  pixelsPerUnit: number
): number {
  if (pixelsPerUnit <= 0) throw new Error('pixelsPerUnit must be positive')
  return pixelLength / pixelsPerUnit
}

// Format for display: "1 : 100" style ratio
export function formatScaleRatio(
  pixelsPerUnit: number,
  unit: MeasurementUnit
): string {
  const realWorldPerPixel = 1 / pixelsPerUnit
  return `1px = ${realWorldPerPixel.toFixed(4)} ${unit}`
}
```

### Coordinate Conversion in Click Handler
```typescript
// Inside CanvasViewport or a custom hook
function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
  const activeTool = useViewerStore.getState().activeTool
  if (activeTool !== 'scale' && activeTool !== 'verify-scale') return

  const stage = e.target.getStage()
  if (!stage) return

  // Get position in page-space (Layer local coords)
  // The Layer sits directly under Stage, with no transform of its own
  const transform = stage.getAbsoluteTransform().copy().invert()
  const pointer = stage.getPointerPosition()
  if (!pointer) return
  const pagePos = transform.point(pointer)

  // pagePos.x, pagePos.y are in PDF-page pixel space
  // Use these for calibration point storage and distance calculation
}
```

### Calibration Confirmation Dialog (React component)
```typescript
// Pattern for the confirmation step before accepting calibration
interface CalibrationDialogProps {
  pixelDistance: number
  onConfirm: (distance: number, unit: MeasurementUnit) => void
  onCancel: () => void
}

function CalibrationDialog({ pixelDistance, onConfirm, onCancel }: CalibrationDialogProps) {
  const [distance, setDistance] = useState('')
  const [unit, setUnit] = useState<MeasurementUnit>('m')

  const handleSubmit = () => {
    const d = parseFloat(distance)
    if (isNaN(d) || d <= 0) return
    onConfirm(d, unit)
  }

  return (
    <div className="calibration-dialog">
      <p>Pixel distance: {pixelDistance.toFixed(1)} px</p>
      <input
        type="number"
        value={distance}
        onChange={(e) => setDistance(e.target.value)}
        placeholder="Enter real-world distance"
        autoFocus
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value as MeasurementUnit)}>
        <option value="m">meters</option>
        <option value="ft">feet</option>
        <option value="mm">millimeters</option>
        <option value="cm">centimeters</option>
        <option value="in">inches</option>
      </select>
      <p>Scale: 1 px = {(parseFloat(distance) || 0) > 0
        ? ((parseFloat(distance)) / pixelDistance).toFixed(6)
        : '---'} {unit}</p>
      <button onClick={handleSubmit}>Accept Scale</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store coordinates in screen pixels | Store in normalized/page-space coords | Established pattern in Phase 1 | All calibration points must follow this convention |
| Global scale for entire document | Per-page scale | Standard in all professional takeoff tools | Already a locked decision in STATE.md |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAL-01 | Scale computation from pixel distance + real-world distance | unit | `npx vitest run src/tests/scale-math.test.ts -x` | Wave 0 |
| SCAL-01 | Coordinate conversion (screen -> page space) | unit | `npx vitest run src/tests/scale-math.test.ts -x` | Wave 0 |
| SCAL-02 | Per-page scale storage independence | unit | `npx vitest run src/tests/scale-store.test.ts -x` | Wave 0 |
| SCAL-03 | Scale display string formatting | unit | `npx vitest run src/tests/scale-math.test.ts -x` | Wave 0 |
| SCAL-04 | Verify-scale measurement accuracy | unit | `npx vitest run src/tests/scale-math.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/scale-math.test.ts` -- covers SCAL-01, SCAL-03, SCAL-04 (pure math functions)
- [ ] `src/tests/scale-store.test.ts` -- covers SCAL-02 (per-page scale independence in Zustand)

## Open Questions

1. **Persistent calibration line visibility**
   - What we know: After calibration is accepted, the line data (endpoints) is stored in ScaleState
   - What's unclear: Should the calibration line remain visible on the canvas as a semi-transparent reference, or disappear after acceptance?
   - Recommendation: Show it as a faint dashed line that the user can toggle. Professional takeoff apps (Bluebeam, PlanSwift) show the scale line. Implement as visible-by-default; can toggle later.

2. **Re-calibration workflow**
   - What we know: Users need to recalibrate if they got it wrong
   - What's unclear: Should recalibration require confirmation ("Replace existing scale?") or just overwrite?
   - Recommendation: Overwrite silently with a confirmation dialog showing old vs new ratio. This is a single-user tool; no need for extra friction.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `viewerStore.ts`, `CanvasViewport.tsx`, `useViewportControls.ts` -- established patterns for per-page state and Stage transforms
- [Konva Relative Pointer Position](https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html) -- `getRelativePointerPosition()` API for coordinate conversion
- [Konva Line Simple Line](https://konvajs.org/docs/shapes/Line_-_Simple_Line.html) -- Line component API (points, stroke, dash)
- [Konva Stage API](https://konvajs.org/api/Konva.Stage.html) -- `getAbsoluteTransform()`, `getPointerPosition()`
- CLAUDE.md stack patterns -- "User activates Set Scale tool -> draws a line -> Konva returns pixel coordinates -> user types real-world distance -> store pixelsPerMeter"

### Secondary (MEDIUM confidence)
- [react-konva draw line issue #210](https://github.com/konvajs/react-konva/issues/210) -- community pattern for interactive line drawing
- [Konva Zooming Relative to Pointer](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html) -- confirms transform inversion approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing libraries
- Architecture: HIGH - extends established patterns from Phase 1 (per-page state, Konva layers)
- Scale math: HIGH - Euclidean distance and ratio arithmetic, well-understood
- Coordinate conversion: HIGH - Konva's transform API is well-documented and already used in the zoom code
- Pitfalls: HIGH - based on actual codebase analysis showing where conflicts will arise

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no fast-moving dependencies)
