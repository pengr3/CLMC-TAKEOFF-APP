# Phase 02: Scale Calibration - Research

**Researched:** 2026-04-17
**Domain:** Konva.js interactive line drawing, coordinate space conversion, Zustand per-concern store, inline popup positioning
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Calibration Line Interaction**
- Toolbar "Set Scale" button activates a dedicated calibration mode (not always-on)
- User draws the line by clicking start point, moving, then clicking end point (click-click, CAD-style)
- After line is drawn, a small inline popup appears near the line end with a text input and unit dropdown for the real-world distance
- Popup displays the computed scale ratio (e.g. "1:100") and presents Confirm / Cancel buttons before accepting the scale

**Unit System**
- Supported units: metric (mm, cm, m) and imperial (in, ft)
- Unit selection is a global app preference — one unit applies to all pages (construction projects don't mix units)
- The unit is chosen from the unit dropdown inside the Set Scale popup at calibration time
- Imperial uses decimal format only for v1 (1.5ft, 2.75in) — no fractional representation

**Scale Display and Status**
- Scale is shown in the existing status bar: "Scale: 1:100" when set
- When a page has no scale, status bar shows "Scale: Not Set" in amber/orange
- The "Set Scale" toolbar button is visually highlighted (accent color) on uncalibrated pages to draw attention
- Re-calibration: clicking "Set Scale" again lets user draw a new line, which replaces the existing scale — no separate delete needed

**Data Model and Persistence**
- New `scaleStore.ts` Zustand slice (separate from viewerStore) holds scale state
- Per-page data shape: `{ pixelsPerUnit: number, unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' }` keyed by page index
- The calibration line is a temporary decoration — removed after the user clicks Confirm (not persisted)
- A reset action is available to clear a page's scale back to "Not Set"

### Claude's Discretion
- Exact visual styling of the inline popup (size, shadow, position offset from line endpoint)
- Keyboard handling within the popup (Enter to confirm, Escape to cancel)
- How "Set Scale" mode is visually indicated on the canvas cursor (crosshair or ruler cursor)
- Whether the calibration line has a distinct color/style during drawing (e.g. dashed blue)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAL-01 | User can set scale by drawing a line between two known points on the plan and entering the real-world distance | Konva click-click line pattern, coordinate conversion, inline popup |
| SCAL-02 | Scale is stored per page — each page can have a different scale ratio | scaleStore.ts per-page Record pattern matching viewerStore |
| SCAL-03 | User can see the current page's scale ratio displayed in the UI | StatusBar subscription to scaleStore, amber "Not Set" state |
| SCAL-04 | User can verify scale accuracy by measuring a second known dimension and comparing against its expected value | Verify mode using pixelsPerUnit, distance calculation from click-click line |
</phase_requirements>

---

## Summary

Phase 2 adds the scale calibration math layer that all subsequent markup measurements depend on. The phase is entirely self-contained in the renderer process: it introduces `scaleStore.ts`, a calibration interaction mode in `CanvasViewport.tsx`, an inline popup overlay (an HTML `<div>` positioned over the canvas using stage-to-screen coordinate projection), and a verify mode that reuses the same click-click line drawing pattern.

The critical technical fact is that pointer coordinates from Konva events are in **screen space** (relative to the top-left of the Stage DOM element). When the stage is scaled and panned, these must be converted to **stage space** (the coordinate system of the PDF image) using `(screen.x - stage.x()) / stage.scaleX()`. All stored `pixelsPerUnit` values must be computed from stage-space line lengths so they remain correct across zoom changes.

The inline popup is a plain React `<div>` absolutely positioned over the canvas container, not a Konva node. This is the correct pattern because HTML form controls (inputs, dropdowns) cannot be rendered inside a Konva Layer. The popup position is computed by projecting the stage-space line endpoint back to screen space using the inverse formula: `screen.x = stage.x() + stagePoint.x * stage.scaleX()`.

**Primary recommendation:** Use a modal-state machine with four states (`idle → drawing → confirming → verifying`) managed in local component state inside `CanvasViewport.tsx`. The scaleStore holds only the committed, persisted scale data.

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Konva / react-konva | 10.2.3 / 19.2.3 | `<Line>` shape for calibration line; Stage click events; `getRelativePointerPosition` | Already in project; this phase is exactly the annotation-over-image pattern Konva is designed for |
| Zustand | 5.0.12 | `scaleStore.ts` — per-page scale state | Already in project; viewerStore is the direct pattern to mirror |
| React | 19.2.1 | Inline popup as a React `<div>` overlay, local state machine | Already in project |
| TypeScript | 5.x | Types for `ScaleState`, `PageScale`, unit union | Already in project; mandatory per CLAUDE.md |

### No New Dependencies

All functionality is achievable with the existing stack. Do NOT add floating-ui, popperjs, or any popup library. The inline popup has fixed positioning requirements (near line endpoint) that are most simply satisfied by computing `(left, top)` from stage coordinates and applying them to a `position: absolute` div inside the canvas container div. Adding a dependency for two CSS properties would be unnecessary overhead.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/renderer/src/
├── stores/
│   ├── viewerStore.ts          (existing)
│   └── scaleStore.ts           (NEW — per-page scale state)
├── components/
│   ├── CanvasViewport.tsx      (MODIFY — add calibration interaction + popup)
│   ├── StatusBar.tsx           (MODIFY — subscribe to scaleStore)
│   ├── Toolbar.tsx             (MODIFY — add Set Scale button)
│   └── ScalePopup.tsx          (NEW — inline confirm/verify popup overlay)
├── hooks/
│   └── useCalibrationMode.ts   (NEW — click-click line drawing state machine)
├── lib/
│   ├── constants.ts            (MODIFY — add CALIBRATION_LINE_COLOR)
│   └── scale-math.ts           (NEW — pure math: pixelsPerUnit, displayRatio, convertDistance)
└── types/
    ├── viewer.ts               (existing)
    └── scale.ts                (NEW — PageScale, ScaleState, CalibrationMode types)
```

### Pattern 1: Coordinate Space Conversion

**What:** Convert Konva click events (screen space) to stage space (PDF image space) and back.
**When to use:** Every time a click position is recorded during calibration or verify mode.

```typescript
// Source: https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html
// and viewerStore pattern in useViewportControls.ts

// Screen → Stage (use this to RECORD a click position)
function screenToStage(stage: Konva.Stage, screenPos: { x: number; y: number }) {
  return {
    x: (screenPos.x - stage.x()) / stage.scaleX(),
    y: (screenPos.y - stage.y()) / stage.scaleY()
  }
}

// Stage → Screen (use this to POSITION the popup div)
function stageToScreen(stage: Konva.Stage, stagePos: { x: number; y: number }) {
  return {
    x: stage.x() + stagePos.x * stage.scaleX(),
    y: stage.y() + stagePos.y * stage.scaleY()
  }
}

// Usage in click handler on Stage onClick:
const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
  const stage = e.target.getStage()!
  const screenPos = stage.getPointerPosition()!
  const stagePos = screenToStage(stage, screenPos)
  // stagePos is now in PDF image pixels — store this
}
```

**Why this matters:** `stage.getPointerPosition()` returns screen-space coordinates (does NOT account for stage pan/zoom). If you store screen-space coordinates, the line length changes when the user zooms before confirming, yielding a wrong `pixelsPerUnit`. Always convert to stage space before storing.

### Pattern 2: Calibration Line as a Konva `<Line>` in Layer 1

**What:** Render a temporary two-point line in Layer 1 (the markup overlay layer) using react-konva `<Line>`.
**When to use:** During `drawing` and `confirming` states.

```typescript
// Source: https://konvajs.org/docs/shapes/Line_-_Simple_Line.html
// Inside CanvasViewport.tsx Layer 1:
{calibMode !== 'idle' && points.length >= 2 && (
  <Line
    points={[points[0].x, points[0].y, points[1]?.x ?? points[0].x, points[1]?.y ?? points[0].y]}
    stroke="#3b9eff"
    strokeWidth={2 / stageScale}   // keep 2px visual width regardless of zoom
    dash={[8 / stageScale, 4 / stageScale]}
    lineCap="round"
  />
)}
```

Note: `strokeWidth` and `dash` must be divided by `stage.scaleX()` to appear constant-width on screen as the user zooms. This is the standard Konva trick for "screen-space constant" decorations.

### Pattern 3: Calibration Mode State Machine (local component state)

**What:** Four-state machine inside `useCalibrationMode.ts` hook.
**When to use:** Manages cursor, click handling, line rendering, popup visibility.

```typescript
// src/renderer/src/hooks/useCalibrationMode.ts
type CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying'

interface CalibState {
  mode: CalibMode
  startPoint: { x: number; y: number } | null   // stage-space
  endPoint:   { x: number; y: number } | null   // stage-space
  // Popup screen-space position (set from stageToScreen(endPoint))
  popupScreenPos: { x: number; y: number } | null
}
```

State transitions:
- `idle → drawing`: user clicks "Set Scale" button
- `drawing` (first click): record `startPoint`, stay in `drawing`
- `drawing` (second click): record `endPoint`, compute pixel length, transition to `confirming`
- `confirming` → Confirm: call `scaleStore.setScale(page, pixelsPerUnit, unit)`, → `idle`
- `confirming` → Cancel: clear state, → `idle`
- `idle → verifying`: user clicks "Verify Scale" button (SCAL-04)
- `verifying` (two clicks): compute real-world distance from pixel length, display result, → `idle`

### Pattern 4: Inline Popup as Absolute-Positioned HTML Overlay

**What:** A React `<div>` with `position: absolute` placed inside the canvas container div, positioned at the projected screen-space coordinates of the line endpoint.
**When to use:** `confirming` and `verifying` states.

```typescript
// Source: existing CanvasViewport.tsx container pattern (containerRef)
// ScalePopup.tsx receives screenPos from parent

interface ScalePopupProps {
  screenPos: { x: number; y: number }
  pixelLength: number
  onConfirm: (distance: number, unit: PageScale['unit']) => void
  onCancel: () => void
}

// In CanvasViewport.tsx wrapper div (position: relative):
<div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
  <Stage ... />
  {calibMode === 'confirming' && popupScreenPos && (
    <ScalePopup
      screenPos={popupScreenPos}
      pixelLength={pixelLength}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )}
</div>
```

The popup div uses `position: absolute; left: ${screenPos.x + 12}px; top: ${screenPos.y}px` with a small offset so it does not cover the endpoint dot.

### Pattern 5: scaleStore — Mirror of viewerStore Pattern

```typescript
// src/renderer/src/stores/scaleStore.ts
import { create } from 'zustand'
import { ScaleState } from '../types/scale'

export const useScaleStore = create<ScaleState>((set, get) => ({
  pageScales: {},   // Record<number, PageScale>
  globalUnit: 'm',

  setScale: (page, pixelsPerUnit, unit) =>
    set((s) => ({
      pageScales: { ...s.pageScales, [page]: { pixelsPerUnit, unit } },
      globalUnit: unit
    })),

  getScale: (page) => get().pageScales[page] ?? null,

  clearScale: (page) =>
    set((s) => {
      const next = { ...s.pageScales }
      delete next[page]
      return { pageScales: next }
    }),

  resetAll: () => set({ pageScales: {} })
}))
```

**Key:** `globalUnit` is updated whenever `setScale` is called so the unit selection persists across pages (locked decision: one unit for the whole project).

### Pattern 6: Pure Scale Math Functions

These are pure functions with no side effects — extractable to `scale-math.ts` for direct unit testing.

```typescript
// src/renderer/src/lib/scale-math.ts

/** Euclidean pixel length between two stage-space points */
export function pixelLength(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
}

/** Convert a pixel distance to real-world units */
export function pixelsToRealWorld(pixels: number, pixelsPerUnit: number): number {
  return pixels / pixelsPerUnit
}

/** Compute pixelsPerUnit from a drawn line and the user-entered real-world distance */
export function computePixelsPerUnit(
  linePixelLength: number,
  realWorldDistance: number
): number {
  if (realWorldDistance <= 0) throw new Error('Real world distance must be > 0')
  return linePixelLength / realWorldDistance
}

/** Format as display scale ratio string, e.g. "1:100" */
export function formatScaleRatio(pixelsPerUnit: number, unit: string): string {
  // pixelsPerUnit is PDF-pixel units per 1 real-world unit
  // Display ratio is approximate — round to nearest sensible ratio
  const ratio = Math.round(pixelsPerUnit)
  return ratio > 0 ? `1:${ratio}` : 'Unknown'
}
```

**Note on formatScaleRatio:** The "1:100" display is derived from `pixelsPerUnit`. At PDF_BASE_SCALE = 2.0, one PDF pixel is 1/(72*2) of an inch at the raster resolution. For display purposes, `1:N` where N = round(pixelsPerUnit / pdf_scale_factor_to_meters) is the conventional representation. The display ratio is purely informational — all math uses `pixelsPerUnit` directly. The display string format is at Claude's discretion.

### Anti-Patterns to Avoid

- **Storing screen-space coordinates:** Always convert click positions to stage-space immediately. Never store `stage.getPointerPosition()` directly.
- **Konva HTML input/textarea inside a Layer:** Konva does not support HTML form elements inside canvas. The popup MUST be a React div overlay.
- **Re-rendering the PDF page on calibration change:** Scale calibration changes only stored numbers. Never trigger a new `pdfjs` render on scale change.
- **Applying strokeWidth without zoom compensation:** Calibration line visual width will appear to scale with zoom unless divided by `stage.scaleX()`.
- **Blocking spacebar pan during calibration:** The existing spacebar pan mode can coexist with calibration mode. Users may need to pan between click 1 and click 2 for large plans.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line pixel length calculation | Custom trig | `Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))` | Standard Euclidean; no library needed — extract to `scale-math.ts` |
| Popup positioning | Floating UI / Popper.js | Inline `position: absolute` with computed `left`/`top` | The popup has exactly one anchor point (line endpoint); no flip/collision logic required for v1 |
| Stage coordinate conversion | Custom matrix math | Konva's existing `stage.x()`, `stage.y()`, `stage.scaleX()` | Already used in `useViewportControls.ts`; the formula is two lines |
| Unit conversion (mm/cm/m/in/ft) | Ad-hoc conversions inline | `scale-math.ts` conversion table | Centralised, testable; prevents copy-paste errors across markup phases |

**Key insight:** This phase is pure math and state management. The entire implementation is achievable with the project's existing stack without adding any new runtime dependencies.

---

## Common Pitfalls

### Pitfall 1: Screen-Space vs Stage-Space Click Coordinates

**What goes wrong:** `pixelsPerUnit` is computed from screen-pixel line length instead of stage-pixel line length. The reported scale changes every time the user zooms the view.
**Why it happens:** `stage.getPointerPosition()` returns screen coordinates. Developers often forget to account for the stage's own pan/zoom transform.
**How to avoid:** Always apply `screenToStage()` conversion immediately on click. Store only stage-space points. Compute `pixelLength()` from stage-space points.
**Warning signs:** Calibrating at 50% zoom gives a scale 2x larger than calibrating at 100% zoom on the same line.

### Pitfall 2: PDF Scale Ambiguity (pixelsPerUnit vs Display Ratio)

**What goes wrong:** The 1:100 display ratio is used in place of `pixelsPerUnit` for measurements.
**Why it happens:** The display ratio is a rounded approximation. Using it for measurements introduces rounding error.
**How to avoid:** Store the exact `pixelsPerUnit` float. Derive the display string from it using `formatScaleRatio()`. Never reconstruct `pixelsPerUnit` from the display string.
**Warning signs:** Measurement values are off by a few percent, and the error varies by zoom level.

### Pitfall 3: Popup Occluded by Canvas Bounds

**What goes wrong:** The popup appears outside the visible canvas area when the user draws a calibration line near the right or bottom edge.
**Why it happens:** `left = screenPos.x + 12` can push the popup off-screen.
**How to avoid:** Clamp the popup position: `left = Math.min(screenPos.x + 12, containerWidth - popupWidth - 8)` and similar for top. This is a Claude's Discretion item but should be implemented.
**Warning signs:** Popup appears partially or fully invisible on edge-of-canvas calibrations.

### Pitfall 4: Calibration Mode Activated on Empty Canvas (no PDF loaded)

**What goes wrong:** "Set Scale" button activates calibration mode when no PDF is open, and clicks on the empty stage throw errors.
**Why it happens:** Toolbar button is enabled before a file is loaded.
**How to avoid:** Disable the "Set Scale" button when `totalPages === 0` (same guard used by page navigation and zoom buttons in existing Toolbar.tsx).
**Warning signs:** Console errors on click when no PDF is loaded.

### Pitfall 5: Unit State Drift Between Pages

**What goes wrong:** User calibrates page 1 in metres, switches to page 2 (no scale set), opens Set Scale popup — unit dropdown shows "mm" instead of "m".
**Why it happens:** Popup initialises unit state from a local default rather than `scaleStore.globalUnit`.
**How to avoid:** Initialise the unit dropdown value from `useScaleStore((s) => s.globalUnit)`.
**Warning signs:** Unit selection resets to default on each new page calibration.

### Pitfall 6: Zero or Near-Zero Line Length

**What goes wrong:** User double-clicks the same spot (or clicks two nearly identical points), resulting in a division-by-zero or astronomically large `pixelsPerUnit`.
**Why it happens:** `computePixelsPerUnit` divides pixel length by user-entered distance. If pixel length is 0, result is 0. If pixel length is very small, `pixelsPerUnit` is huge.
**How to avoid:** Validate minimum pixel length before transitioning from `drawing` to `confirming`. Minimum threshold of ~10px (at current stage scale) is reasonable. Show an inline error message "Line too short — please draw again."
**Warning signs:** Scale display shows "1:0" or "1:99999".

---

## Code Examples

### Getting Click Position in Stage Space

```typescript
// Source: https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html
// Used in CanvasViewport.tsx onClick handler during calibration mode

const handleStageClick = useCallback(
  (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (calibMode === 'idle') return
    const stage = stageRef.current
    if (!stage) return
    const screenPos = stage.getPointerPosition()
    if (!screenPos) return
    // Convert to stage space (PDF image coordinates)
    const stagePos = {
      x: (screenPos.x - stage.x()) / stage.scaleX(),
      y: (screenPos.y - stage.y()) / stage.scaleY()
    }
    onCalibrationClick(stagePos)
  },
  [calibMode, stageRef, onCalibrationClick]
)
```

### Computing Popup Screen Position from Stage Point

```typescript
// Inverse transform: stage-space → screen-space for positioning popup div
function stageToScreenPos(stage: Konva.Stage, stagePoint: { x: number; y: number }) {
  return {
    x: Math.round(stage.x() + stagePoint.x * stage.scaleX()),
    y: Math.round(stage.y() + stagePoint.y * stage.scaleY())
  }
}
// Called after endPoint is recorded, to set popupScreenPos state
```

### Scale Computation

```typescript
// scale-math.ts — pure, testable

export function computePixelsPerUnit(linePixelLength: number, realWorldDistance: number): number {
  if (linePixelLength < 10) throw new Error('Line too short')
  if (realWorldDistance <= 0) throw new Error('Distance must be > 0')
  return linePixelLength / realWorldDistance
}

export function pixelsToRealWorld(pixels: number, pixelsPerUnit: number): number {
  return pixels / pixelsPerUnit
}

// Example: line is 450px in stage space, user enters 5 metres
// pixelsPerUnit = 450 / 5 = 90 (90 PDF pixels = 1 metre)
// Display: "1:90" ≈ approximation of the drawing scale
```

### scaleStore Shape

```typescript
// src/renderer/src/types/scale.ts
export type ScaleUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft'

export interface PageScale {
  pixelsPerUnit: number
  unit: ScaleUnit
}

export interface ScaleState {
  pageScales: Record<number, PageScale>
  globalUnit: ScaleUnit
  setScale: (page: number, pixelsPerUnit: number, unit: ScaleUnit) => void
  getScale: (page: number) => PageScale | null
  clearScale: (page: number) => void
  resetAll: () => void
}
```

### StatusBar Scale Display

```typescript
// StatusBar.tsx modification — subscribe to scaleStore
import { useScaleStore } from '../stores/scaleStore'

// Inside StatusBar():
const currentPage = useViewerStore((s) => s.currentPage)
const getScale = useScaleStore((s) => s.getScale)
const pageScale = getScale(currentPage)

const scaleLabel = pageScale
  ? formatScaleRatio(pageScale.pixelsPerUnit, pageScale.unit)
  : 'Not Set'
const scaleColor = pageScale ? COLORS.textPrimary : '#f0a500'   // amber when not set

// Render: <span style={{ color: scaleColor }}>Scale: {scaleLabel}</span>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Dedicated scale calibration window/modal | Inline popup near the line endpoint | Faster workflow — estimator does not lose context |
| Fixed project-wide scale (one value for all pages) | Per-page scale as `Record<number, PageScale>` | Mixed-scale PDFs (e.g. site plan + floor plan) handled correctly |
| Floating UI / Popper for popup anchoring | Computed absolute CSS position from projected stage coordinates | No extra dependency; simpler for a single-anchor popup |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/tests/scale*.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAL-01 | `computePixelsPerUnit` returns correct ratio | unit | `npx vitest run src/tests/scale-math.test.ts` | Wave 0 |
| SCAL-01 | Zero/near-zero line length throws | unit | `npx vitest run src/tests/scale-math.test.ts` | Wave 0 |
| SCAL-01 | Negative real-world distance throws | unit | `npx vitest run src/tests/scale-math.test.ts` | Wave 0 |
| SCAL-02 | `scaleStore.setScale` stores independently per page | unit | `npx vitest run src/tests/scale-store.test.ts` | Wave 0 |
| SCAL-02 | Setting page 2 scale does not affect page 1 | unit | `npx vitest run src/tests/scale-store.test.ts` | Wave 0 |
| SCAL-02 | `clearScale` removes only the target page | unit | `npx vitest run src/tests/scale-store.test.ts` | Wave 0 |
| SCAL-02 | `getScale` returns null for uncalibrated page | unit | `npx vitest run src/tests/scale-store.test.ts` | Wave 0 |
| SCAL-03 | `globalUnit` updated when any page is calibrated | unit | `npx vitest run src/tests/scale-store.test.ts` | Wave 0 |
| SCAL-04 | `pixelsToRealWorld` converts correctly given pixelsPerUnit | unit | `npx vitest run src/tests/scale-math.test.ts` | Wave 0 |
| SCAL-04 | Round-trip: calibrate, then measure same line → returns entered distance | unit | `npx vitest run src/tests/scale-math.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/tests/scale-math.test.ts src/tests/scale-store.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tests/scale-math.test.ts` — covers SCAL-01, SCAL-04 pure math functions
- [ ] `src/tests/scale-store.test.ts` — covers SCAL-02, SCAL-03 store actions

*(No framework installation needed — Vitest 4.1.1 already installed and configured)*

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is renderer-only code/state changes. All required tools (Node, npm, Electron, Vitest) were verified in Phase 1. No new external dependencies introduced.

---

## Open Questions

1. **Display ratio formatting precision**
   - What we know: `pixelsPerUnit` is a float computed from user input and line length
   - What's unclear: Should `formatScaleRatio` round to the nearest standard scale (1:50, 1:100, 1:200) or display the exact computed ratio? Industry tools typically show exact.
   - Recommendation: Display the exact rounded integer ratio (e.g. "1:93") — no snapping to standard values in v1. This is at Claude's discretion.

2. **Popup clamping edge cases**
   - What we know: Popup must not overflow the canvas container div
   - What's unclear: Should the popup flip to appear above/left of the endpoint when near the bottom/right edge?
   - Recommendation: Simple clamp to container bounds is sufficient for v1 (no flip logic needed).

---

## Sources

### Primary (HIGH confidence)
- Konva docs — `Line` shape, `points` array, `dash` property: https://konvajs.org/docs/shapes/Line_-_Simple_Line.html
- Konva docs — Relative pointer position / `getRelativePointerPosition`: https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html
- Konva API — `Konva.Stage` `getPointerPosition`, `x()`, `y()`, `scaleX()`: https://konvajs.org/api/Konva.Stage.html
- Konva GitHub issue — `getPointerPosition` and Scaling+Panning: https://github.com/konvajs/konva/issues/303
- Existing codebase — `useViewportControls.ts` `zoomToPoint` function (same formula): `src/renderer/src/hooks/useViewportControls.ts`
- Existing codebase — `viewerStore.ts` per-page state pattern to mirror: `src/renderer/src/stores/viewerStore.ts`

### Secondary (MEDIUM confidence)
- Zustand wiki — Splitting the store into separate slices: https://github.com/pmndrs/zustand/wiki/Splitting-the-store-into-separate-slices
- Construction takeoff industry UX — click-two-points calibration pattern confirmed across multiple tools: https://nedesestimating.com/the-ultimate-planswift-how-to-guide-for-accurate-construction/

### Tertiary (LOW confidence)
- None — all findings backed by official sources or existing codebase patterns.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project; no new installs
- Architecture: HIGH — coordinate conversion formula is verified against existing `useViewportControls.ts`; store pattern is a direct mirror of `viewerStore.ts`
- Pitfalls: HIGH — coordinate space confusion is documented in official Konva GitHub issues; remaining pitfalls derive from the locked decisions

**Research date:** 2026-04-17
**Valid until:** 2026-07-17 (stable Konva/Zustand APIs — no expected breaking changes)
