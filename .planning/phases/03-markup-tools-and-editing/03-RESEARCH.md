# Phase 3: Markup Tools and Editing — Research

**Researched:** 2026-04-20
**Domain:** Konva polygon/polyline drawing, per-shape labels, zoom-compensated canvas overlays, Zustand command-pattern undo/redo, polygon area/perimeter math
**Confidence:** HIGH (primary stack is already installed and used for calibration; all patterns verified in existing code)

---

## Summary

Phase 3 is a **pattern extension**, not a greenfield investigation. The app's calibration feature (Phase 2) already established every architectural primitive this phase needs: the Konva `Stage` click-state machine, zoom-compensated overlay visuals (`value / currentZoom`), screen-position-clamped inline popups, per-page Zustand stores, stage-inverse-transform for page-space coordinates, and module-level refs for cross-component imperative access. Phase 3 reuses these patterns four times (one per tool) with three variations (count = click-to-place, linear = polyline, area/perimeter = closed polygon) and adds two genuinely new systems: a **category registry with 8-color palette auto-assignment** and a **command-pattern undo/redo stack**.

The only real research questions were (a) whether Konva has a canonical polygon-close interaction (yes — `Line closed={true}` with first-point hit detection via `hitStrokeWidth` + hover flag), (b) whether to use a library for undo/redo (**no** — a hand-rolled command pattern is 40 lines and fits the locked `STATE.md` decision that command-pattern be introduced with the first markup; `zundo` temporal middleware is an alternative if the team later adds non-markup undo scope), and (c) how to compute polygon area correctly (shoelace formula — 6 lines, no dependency). All three questions have HIGH-confidence answers.

**Primary recommendation:** Reuse `useCalibrationMode.ts` as the skeleton for a single `useMarkupTool.ts` hook (or four per-tool hooks) parameterised by tool type. Reuse `ScalePopup.tsx` as the skeleton for `MarkupNamePopup.tsx`. Store markup geometry in page-space (normalized 0–1 of page dimensions, per `STATE.md` locked decision), measurements are computed on demand using the existing `pageScale.pixelsPerMm` and `pixelLength`/shoelace helpers. Build undo/redo as a plain command-object stack inside `markupStore.ts` — no middleware dependency.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Count Tool Workflow**
- **D-01:** Activating the Count tool opens a name + category popup **before** any pin is placed. User types the item name and category first, then clicks "Start".
- **D-02:** Every subsequent canvas click places a pin for that active named item — no popup per click.
- **D-03:** To switch to a different item, user clicks the Count tool button again. A fresh name + category popup appears.
- **D-04:** Each placed pin is labeled: `● Item Name N` (colored dot + item name + sequential number within that item, e.g. "Light Switch 3"). Labels are zoom-compensated — always visible at all zoom levels.

**Linear / Area / Perimeter Tool Workflow**
- **D-05:** User draws the shape first, names it after. The name + category popup appears near the shape endpoint **after** the shape is finished (double-click to end polyline; click first point to close polygon).
- **D-06:** Popup has: Name field, Category field (with auto-complete), Discard / Save buttons. Same inline popup pattern as ScalePopup.
- **D-07:** Escape mid-draw cancels the in-progress shape with no markup created.
- **D-08:** Double-click ends a polyline (linear markup). Single-click on the starting point closes an area or perimeter polygon.

**Category System**
- **D-09:** Categories are type-to-create with auto-complete. If the typed name matches an existing category, it reuses that category's assigned color. If it's a new name, the next color in the palette is assigned automatically.
- **D-10:** No separate category manager UI in this phase. Categories are created inline during markup placement.
- **D-11:** Fixed palette of 8 visually distinct colors, auto-assigned in order of first use:
  1. `#0078d4` blue
  2. `#d13438` red
  3. `#107c10` green
  4. `#ca8a04` amber (NOT `#e8a838` — distinct from `COLORS.warning`)
  5. `#5c2d91` purple
  6. `#008272` teal
  7. `#e3008c` pink
  8. `#8e562e` brown
  - If more than 8 categories are created, cycle the palette.

**Canvas Labels**
- **D-12:** All markup labels are **always visible** at all zoom levels. Font size and shape stroke widths are zoom-compensated (same pattern as calibration overlay — divide by `currentZoom`).
- **D-13:** Label content by type:
  - **Count:** `● Item Name N` (dot + name + sequential number)
  - **Linear:** `Item Name — 12.4 m` (centered on the polyline midpoint)
  - **Area:** `Item Name` + `38.2 m²` (two lines, centered inside the polygon)
  - **Perimeter:** `Item Name` + `P: 24.6 m  A: 38.2 m²` (perimeter + area, two lines, centered inside)

**Undo / Redo**
- **D-14:** Command pattern — each markup action (place, delete) is a reversible command object pushed onto an undo stack. Introduced now with first markup, not retrofitted.
- **D-15:** Undo stack depth: 20+ actions minimum (requirement MARK-09).
- **D-16:** Undo/redo scope for this phase: **place markup, delete markup**. Rename and category change are v2 (PROD-03).
- **D-17:** Keyboard shortcuts: `Ctrl+Z` to undo, `Ctrl+Y` or `Ctrl+Shift+Z` to redo.

### Claude's Discretion
- Exact visual style of count pins (circle vs teardrop vs square dot), size before zoom compensation
- Label positioning algorithm when label would overlap the shape boundary
- Minimum canvas-pixel label font size floor (so labels don't become invisible at extreme zoom-out)
- Whether the in-progress polyline/polygon shows a preview segment following the cursor (recommend yes — matches calibration line pattern)
- Animation or visual feedback when a markup is placed (e.g. brief highlight)

### Deferred Ideas (OUT OF SCOPE)
- Markup editing after placement (rename, change category, delete by clicking) — v2 requirement PROD-03
- Toggle markup category visibility (show/hide layers) — v2 requirement PROD-02
- Keyboard shortcuts for switching tools — v2 requirement PROD-01
- Color override per category (user picks color instead of auto-assigned) — considered but deferred; fixed palette is sufficient for v1
- Mid-point editing of polylines — research flag, deferred unless Konva makes it trivial
- Thumbnail strip sidebar — Phase 6 (PDF-05)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MARK-01 | Place count markups (pins/dots) to tally items | Konva `Circle` in Layer 1, zoom-compensated radius — pattern verified in `CanvasViewport.tsx` calibration overlay; click handler follows `useCalibrationMode.recordClick` shape |
| MARK-02 | Draw linear markups (polylines) for length | Konva `Line` (open) with multi-click point accumulation; `euclideanDistance` helper already exists in `scale-math.ts` — sum over consecutive segments for total length |
| MARK-03 | Trace area markups (closed polygons) for surface area | Konva `Line closed={true}`; area via **shoelace formula** (6 lines, no dependency) |
| MARK-04 | Trace perimeter markups returning perimeter + area | Same polygon geometry as MARK-03; reports both values from the same vertex list |
| MARK-05 | Assign freehand item name when placing | `MarkupNamePopup.tsx` — fork of `ScalePopup.tsx` with Name + Category inputs instead of Distance + Unit |
| MARK-06 | Assign markup to a named category | `CategoryAutocomplete.tsx` inside `MarkupNamePopup`; category registry in `markupStore` |
| MARK-07 | Display item name/label at all zoom levels | Konva `<Text>` in Layer 1, `fontSize: 12 / currentZoom`, **floor of 10px canvas-pixels** to prevent extreme zoom-out invisibility (D-12 + Claude's discretion floor) |
| MARK-08 | Distinct color per category | 8-color palette (D-11) auto-assigned in `markupStore.getOrCreateCategory(name)`; category color stored on category, not markup — changing a category's color updates all its markups (v2) |
| MARK-09 | Undo 20+ actions (place, delete) | Command-pattern stack in `markupStore`: `PlaceMarkupCommand`, `DeleteMarkupCommand`. Max stack depth 50 (comfortable margin over 20). `Ctrl+Z` binding added to `useKeyboardShortcuts.ts` |
| MARK-10 | Redo undone actions | Same stack; forward cursor. `Ctrl+Y` / `Ctrl+Shift+Z` bindings. Clearing redo stack on new action is the standard pattern (last write wins) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies in Phase 3 |
|-----------|--------------------|
| **Platform: Windows desktop, offline** | All markup logic is pure JS/TS in the renderer — already offline. No new network dependency. |
| **Markups must stay precisely positioned when zooming** | CRITICAL — enforced by storing geometry in page-space (PDF page coordinates), never in canvas-pixel coordinates. Locked decision from `STATE.md` ("All markup coordinates stored in PDF page space (normalized 0.0–1.0)"). Stage inverse transform is the canonical screen→page conversion (already used in `useCalibrationMode.screenToStagePoint`). |
| **Stack: Electron 35 + React 19 + TS + electron-vite** | No new deps introduced. Konva 10.2.3 + react-konva 19.2.3 already handle all shape rendering. |
| **Zustand 5 for state** | `markupStore.ts` follows `scaleStore.ts` shape exactly. No new state library. |
| **Inline styles only on canvas-adjacent components** | All new DOM components (`MarkupNamePopup`, `CategoryAutocomplete`, tool buttons) use inline styles + `COLORS`/`LAYOUT` tokens. No Tailwind/CSS modules. |
| **GSD Workflow: use Edit/Write only inside a GSD phase** | Research phase — no code edits. |
| **Command-pattern undo/redo introduced with first markup** | Locked in `STATE.md`; this phase implements it. |

---

## Standard Stack

All libraries below are **already installed and in use** from Phases 1–2. No new dependencies are required for Phase 3.

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| konva | 10.2.3 | Canvas shapes (`Circle`, `Line`, `Text`, `Group`, `Label`) | Every markup (pin, polyline, polygon, label) is a Konva node. Already the PDF-overlay layer library. |
| react-konva | 19.2.3 | Declarative Konva bindings | Already the Phase 2 pattern; consistent component model. |
| zustand | 5.0.12 | Markup state + undo/redo stack | Already `scaleStore` and `viewerStore`'s choice. |
| react | 19.2.1 | Component framework | Already installed. |
| typescript | 5.9.3 | Type safety for command objects and markup discriminated union | Already configured. |
| lucide-react | 1.6.0 | Tool button icons | Already used in `Toolbar.tsx` (`FileUp`, `Ruler`, `ChevronLeft`, `Maximize`). |

### Supporting (already installed)
| Library | Version | Purpose in Phase 3 |
|---------|---------|--------------------|
| vitest | 4.1.1 | Unit tests for measurement math (polyline length, polygon area), command stack, markup store |
| @fontsource/inter | 5.2.8 | Font for canvas `<Text>` labels — matches `COLORS`/`LAYOUT` font choice |

### No New Dependencies
The planner must **not** add any of the following:
- `zundo`, `zustand-travel`, or any undo middleware — command pattern is 40 lines, is already locked in `STATE.md`, and the scope (place/delete) is too small to justify a middleware
- `immer` — Zustand 5 reducer patterns used in `scaleStore.ts` are sufficient; all markup operations are shallow list mutations (push/splice/filter)
- Polygon libraries (`polygon-clipping`, `turf`) — shoelace area is 6 lines of pure math
- Any new UI library — inline styles + `COLORS` tokens only (per Phase 2 pattern)

### Version Verification
Versions taken from the project's `package.json` (2026-04-20). These are the active, bundled versions — no need to query the npm registry, the app is already building against them successfully.

---

## Architecture Patterns

### Recommended File Structure

```
src/renderer/src/
├── components/
│   ├── MarkupNamePopup.tsx          # Fork of ScalePopup — Name + Category inputs
│   ├── CategoryAutocomplete.tsx     # Inline dropdown list inside MarkupNamePopup
│   └── markup/                      # Per-markup-type rendering components
│       ├── CountPinMarkup.tsx       # Konva <Group>: Circle + Text label
│       ├── LinearMarkup.tsx         # Konva <Line> + <Text> at midpoint
│       ├── AreaMarkup.tsx           # Konva <Line closed> + <Text> at centroid
│       └── PerimeterMarkup.tsx      # Same as Area, different label format
├── hooks/
│   └── useMarkupTool.ts             # Unified interaction state machine for all four tools
├── stores/
│   └── markupStore.ts               # Per-page markups, categories, undo/redo stack
├── lib/
│   └── markup-math.ts               # polylineLength, polygonArea (shoelace), polygonCentroid
├── types/
│   └── markup.ts                    # Markup discriminated union, Category, Command types
└── tests/
    ├── markup-math.test.ts
    ├── markup-store.test.ts
    └── markup-commands.test.ts
```

### Pattern 1: Per-Tool Interaction State Machine

Model after `useCalibrationMode.ts`. Every tool has four states: `idle`, `naming` (count only, pre-placement), `drawing` (point accumulation), `confirming` (popup open, post-shape). The hook exposes: `activate()`, `cancel()`, `recordClick(screenPos)`, `updatePreview(screenPos)`, `finishShape()`, `recomputePopupPos()` — near-identical API to `useCalibrationMode`.

```typescript
// Source: extends pattern from src/renderer/src/hooks/useCalibrationMode.ts
interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming'
  toolType: 'count' | 'linear' | 'area' | 'perimeter'
  points: StagePoint[]                   // stage (page-space) coords
  previewPoint: StagePoint | null        // cursor position during draw
  popupScreenPos: { x: number; y: number } | null
  pendingName: string                    // for count tool: set at naming stage
  pendingCategoryName: string            // for count tool: set at naming stage
}

// Reused verbatim from useCalibrationMode:
function screenToStagePoint(stage, x, y) {
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x, y })
}
```

### Pattern 2: Konva Polyline (Linear tool)

```typescript
// Source: https://konvajs.org/docs/shapes/Line.html (verified)
<Line
  points={flatPointsPageSpace}                       // [x1,y1,x2,y2,...]
  stroke={category.color}
  strokeWidth={2 / currentZoom}
  lineCap="round"
  lineJoin="round"
  listening={false}                                   // Phase 3: no click-to-edit
/>
```

### Pattern 3: Konva Closed Polygon (Area/Perimeter tools)

```typescript
// Source: https://konvajs.org/docs/shapes/Line_-_Polygon.html (verified)
<Line
  points={flatPointsPageSpace}
  closed                                              // closes polygon visually + fills
  stroke={category.color}
  strokeWidth={2 / currentZoom}
  fill={category.color + '33'}                        // hex + 20% alpha — matches UI-SPEC
  lineJoin="round"
  listening={false}
/>
```

Konva's `Line` with `closed={true}` **is** the polygon primitive. There is no separate `Polygon` shape. `fill` applies to the closed region; `stroke` applies to the outline.

### Pattern 4: First-Point-Close Detection (polygon finish)

Do **not** hand-roll a proximity threshold. Konva's hit detection solves this: render the starting vertex as a `Circle` with `hitStrokeWidth={12 / currentZoom}` and `onMouseEnter` / `onMouseLeave` handlers that set an `isOverStartPoint` flag. The stage click handler then checks the flag:

```typescript
// Source: https://devmuscle.com/blog/react-konva-image-annotation
// (verified pattern — canonical for polygon annotation tools)

const handleStageClick = (e) => {
  if (toolType !== 'area' && toolType !== 'perimeter') { /* ... */ }
  if (isOverStartPoint && points.length >= 3) {
    finishShape()                     // close polygon, open popup
  } else {
    setPoints([...points, clickPagePos])
  }
}

// On the start-vertex Circle:
<Circle
  x={points[0].x}
  y={points[0].y}
  radius={6 / currentZoom}
  hitStrokeWidth={12 / currentZoom}   // enlarged invisible hit area
  onMouseEnter={() => setIsOverStartPoint(true)}
  onMouseLeave={() => setIsOverStartPoint(false)}
/>
```

### Pattern 5: Double-Click Polyline Finish (Linear tool)

Konva's `Stage` fires an `ondblclick` event natively. Bind it once; on fire, call `finishShape()`. The single-click handler accumulates points; the double-click handler terminates drawing. A single click that fires immediately before a dblclick will appear as a point addition — mitigate by not adding a point on a click that lands within ~8px of the previous click (or simpler: accept the duplicate point and ignore it in the length calculation because its segment length is zero).

```typescript
<Stage
  onClick={handleStageClick}
  onDblClick={handleStageDblClick}   // finishes polyline
  /* ... */
>
```

### Pattern 6: Zoom-Compensated Canvas Labels

Labels use Konva `<Text>` inside a `<Group>` that does NOT inherit stage scale compensation automatically — so the markup rendering components receive `currentZoom` as a prop and divide all label-related sizes by it. There is **no Konva built-in** "ignore parent scale" flag. Per-frame division is the working pattern already used in `CanvasViewport.tsx`:

```typescript
// Source: src/renderer/src/components/CanvasViewport.tsx:251-254 (existing pattern)
const LABEL_FONT_SIZE = Math.max(10 / currentZoom, 10)  // floor at 10 canvas-px
const LABEL_OFFSET_Y = 12 / currentZoom
const TEXT_SHADOW_BLUR = 2 / currentZoom

<Text
  x={midpointPageSpace.x}
  y={midpointPageSpace.y + LABEL_OFFSET_Y}
  text={`${name} — ${value.toFixed(1)} ${unit}`}
  fontSize={LABEL_FONT_SIZE}
  fontFamily="Inter, sans-serif"
  fontStyle="600"
  fill={COLORS.textPrimary}
  shadowColor="#ffffff"
  shadowBlur={TEXT_SHADOW_BLUR}
  shadowOpacity={0.9}
  listening={false}
  align="center"
  offsetX={textWidth / 2}                              // center-anchor
/>
```

**Font-size floor:** The UI-SPEC (D-12 + Claude's Discretion) calls for a minimum canvas-pixel floor of 10px so labels remain legible at extreme zoom-out. `Math.max(12 / currentZoom, 10)` achieves this: at zoom >= 1.2 the floor dominates; at zoom < 1.2 the zoom-compensation dominates.

### Pattern 7: Polygon Area via Shoelace Formula

```typescript
// Source: standard textbook formula (Gauss's shoelace)
// Verified against standard CS reference — no library needed.
export function polygonArea(points: StagePoint[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}

export function polygonCentroid(points: StagePoint[]): StagePoint {
  let cx = 0, cy = 0
  for (const p of points) { cx += p.x; cy += p.y }
  return { x: cx / points.length, y: cy / points.length }
  // Note: this is the vertex-average centroid, which is close enough for label
  // placement. The true area-weighted centroid uses a longer formula — not needed
  // for labels and costs more math.
}

export function polylineLength(points: StagePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += euclideanDistance(
      points[i - 1].x, points[i - 1].y,
      points[i].x, points[i].y
    )
  }
  return total
}
```

All three return **pixel lengths / pixel-squared areas** in PDF page space. Conversion to real-world units uses the existing `pageScale.pixelsPerMm` and `fromMm()` helpers from `scale-math.ts`:

```typescript
// Length in display units:
const realLength_displayUnit = fromMm(pixelLen / pageScale.pixelsPerMm, pageScale.displayUnit)

// Area in display units² (note: pixelsPerMm is linear — area needs squared ratio):
const realArea_mm2 = pixelArea / (pageScale.pixelsPerMm * pageScale.pixelsPerMm)
const mmPerUnit = MM_PER_UNIT[pageScale.displayUnit]
const realArea_displayUnit2 = realArea_mm2 / (mmPerUnit * mmPerUnit)
```

### Pattern 8: Page-Space Coordinate Storage (CRITICAL)

**Every markup stores vertex coordinates as page-space floats** — the inverse stage transform is already applied at click time (see `useCalibrationMode.screenToStagePoint`). When zoom changes, the store is untouched; only the `currentZoom` divisor on visual constants changes. When the PDF reloads at a different render scale, the stage's base Layer 0 image dimensions match the stored points 1:1 because page-space IS the Layer 0 canvas space (PDF.js always renders at `PDF_BASE_SCALE = 2.0` per `constants.ts`, making the image dimensions deterministic).

The `STATE.md` note about "normalized 0.0–1.0 of page dimensions" suggests divide-by-pageSize normalization, but **the existing `useCalibrationMode.recordClick` stores absolute page-space pixels (at the base 2x render scale), not normalized 0–1**. Confirm with the planner whether Phase 3 should:
  - **(A)** Store page-space pixels (consistent with existing Phase 2 code), OR
  - **(B)** Normalize to 0–1 by dividing by `pageSize.width` / `pageSize.height` (matches `STATE.md` wording)

Recommendation: **Option A** for consistency with Phase 2 code. Phase 4 (Project Persistence) can serialize with or without normalization; what matters is that the runtime uses a single representation. Flag this for explicit planner decision. See Open Questions #1.

### Pattern 9: Zustand Command-Pattern Undo/Redo

```typescript
// Source: pattern adapted from standard Gang-of-Four Command,
// implemented in plain Zustand (no middleware) to fit the locked STATE.md decision.

export type Command =
  | { type: 'place'; markup: Markup; page: number }
  | { type: 'delete'; markup: Markup; page: number }

interface MarkupStoreState {
  pageMarkups: Record<number, Markup[]>
  categories: Record<string /* id */, Category>
  undoStack: Command[]
  redoStack: Command[]
  // ...
  placeMarkup: (page: number, markup: Markup) => void
  deleteMarkup: (page: number, markupId: string) => void
  undo: () => void
  redo: () => void
}

const UNDO_STACK_MAX = 50   // comfortable margin over MARK-09's "20+"

// placeMarkup pushes a 'place' command; clears redoStack
// undo pops command, applies inverse to pageMarkups, pushes to redoStack
// redo pops from redoStack, applies forward, pushes back to undoStack
```

**Stack depth:** MARK-09 requires 20+. Hard-cap at 50 to prevent unbounded memory growth if a user places hundreds of markups in a session. Dropping the oldest command is the correct behaviour — it is irreversibly accepted.

**New-action-clears-redo:** This is the industry-standard pattern (Photoshop, VS Code, etc.). A new place/delete action invalidates the redo stack.

### Anti-Patterns to Avoid

| Anti-pattern | Why it's bad | What to do instead |
|--------------|-------------|--------------------|
| Storing pixel coordinates in screen space | Markups drift on zoom/pan — violates PDF-03 | Always convert via `stage.getAbsoluteTransform().copy().invert().point()` before storing |
| Re-rendering all markups on every cursor move | Performance death at 100+ markups | Memoize markup components on `{markup, currentZoom, category.color}`; only the in-progress shape re-renders on preview-point change |
| Using `Konva.Label` component | Visually scales with the stage — breaks zoom compensation | Use plain `<Text>` inside a `<Group>` with manual `/currentZoom` on fontSize |
| Per-click popup for count tool | D-01, D-02 explicitly specify name-first, then rapid-fire clicks | Popup opens on tool activation, closes on "Start Count", canvas clicks add pins silently until tool changes |
| Snapshotting entire state tree for undo | Memory-heavy, slow, loses intentionality of user action | Command pattern (D-14 locked) — each command stores only the minimal inverse data |
| `alert()` dialogs for errors | UI-SPEC forbids them | Inline error text in popup or `ConfirmationToast` bottom-center |
| Storing markup color on each markup | Changing a category color requires updating every markup | Store color on `Category`; markup holds `categoryId`; lookup at render time |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polygon area math | Custom triangulation / delaunay | **Shoelace formula (6 lines)** | It is already trivial. Libraries (turf, polygon-clipping) add 50KB+ for what is a closed-form calculation. |
| Polygon closed rendering | Custom shape with manual path close | Konva `<Line closed={true}>` | Official Konva primitive; handles fill + stroke ordering correctly. |
| First-point hit detection | Manual distance-threshold check | Konva `hitStrokeWidth` + `onMouseEnter`/`onMouseLeave` on vertex Circle | Konva's hit canvas does this natively and respects zoom. A manual threshold needs constant tuning. |
| Double-click detection | `click` event + timer | Konva `ondblclick` | Built-in, debounces correctly. |
| Screen-to-page-space transform | Manually subtract pan and divide by zoom | `stage.getAbsoluteTransform().copy().invert().point()` | Locked canonical pattern (`STATE.md`). Handles future rotation/flip without refactor. |
| Undo/redo middleware | `zundo`, `immer` patches | **Hand-rolled command objects** | `STATE.md` locks command pattern. Scope is 2 action types (place, delete). Middleware adds 700–4000 bytes and indirection for what is a 40-line reducer addition. |
| Category auto-complete dropdown | Third-party combobox | Plain `<div role="listbox">` with filter | `ScaleContextMenu.tsx` already establishes the dropdown pattern. `<datalist>` HTML element is a native alternative (simpler, but less styling control). |
| Screen-position-clamped popup | New clamping algorithm | **Reuse `ScalePopup`'s `popupStyle = useMemo(...)` clamp** | Already verified in Phase 2; copy the 10-line block verbatim into `MarkupNamePopup`. |
| Unique IDs for markups/categories | UUID library | `crypto.randomUUID()` (Electron's Chromium 134 has it) | Native, no dep, good enough uniqueness for single-user local app. |

**Key insight:** This phase has almost no legitimate "build something new" work. Every marquee piece of behaviour — polygon rendering, zoom compensation, popup positioning, keyboard shortcuts, stage transforms — is already a proven pattern either in Konva's API or in the existing Phase 1–2 code. The planner's job is mostly composition + per-tool specialization, not invention.

---

## Runtime State Inventory

> This phase adds new code and new Zustand state keys. It does NOT rename or migrate any existing identifier or persisted artifact.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — Phase 3 does not persist to disk (no `.clmc` save yet; that is Phase 4). Zustand stores are in-memory only. | None |
| Live service config | **None** — single-user desktop app; no external services. | None |
| OS-registered state | **None** — no Windows Task Scheduler, no pm2, no system services. | None |
| Secrets / env vars | **None** — no env vars introduced. | None |
| Build artifacts | **None** — new TS files compile cleanly into the existing electron-vite build pipeline. No `.egg-info`, no compiled binaries, no Docker tags. | None |

**Overall:** This is a greenfield code-addition phase, not a refactor/rename. The inventory is clean.

---

## Common Pitfalls

### Pitfall 1: Konva `Line` Zero-Length Segment From Dblclick
**What goes wrong:** When the user double-clicks to end a polyline, the first click of the double-click fires `onClick` and adds a point. Then the second click fires `onDblClick` and finishes. The result is a final segment of zero length (both clicks at the same coords).
**Why it happens:** Konva fires both `click` and `dblclick` for a double-click sequence (W3C DOM behaviour).
**How to avoid:** Filter consecutive duplicate points (within ~2 stage pixels) in `finishShape()`. Or: in `handleStageDblClick`, `setPoints(points.slice(0, -1))` to drop the extra click that preceded the dblclick.
**Warning signs:** A measured polyline length that is off by "the distance between the last two clicks."

### Pitfall 2: Forgetting to Square the Scale Ratio for Area
**What goes wrong:** Area comes out linearly scaled instead of quadratically. A 10m × 10m square reports as "10 m²" instead of "100 m²".
**Why it happens:** `pixelsPerMm` is a linear ratio. Converting pixel-squared to real-world-squared requires dividing by `pixelsPerMm²`, not `pixelsPerMm`.
**How to avoid:**
```typescript
const realArea_mm2 = pixelArea / (pageScale.pixelsPerMm ** 2)
```
**Warning signs:** Areas that look 100× too small (since typical `pixelsPerMm` is in the range 0.5–5). Write a unit test: "10 mm × 10 mm square at pixelsPerMm=10 reports 100 mm²".

### Pitfall 3: Canvas Label Flipping/Mirroring on Rotated Pages
**What goes wrong:** PDF pages with `/Rotate: 90` or 180 would display labels flipped or upside down if the label text were baked into the page-space transform.
**Why it happens:** The Stage transform includes any rotation applied at render time.
**How to avoid:** Phase 1's renderer produces a pre-rotated `HTMLCanvasElement` (PDF.js handles `/Rotate` internally — confirmed in Phase 1 research), so Layer 0 receives an upright image. Label `rotation={0}` is therefore correct by default. **Do not set a rotation on Text nodes** and the problem does not manifest.
**Warning signs:** Tester opens a rotated-page PDF; labels appear sideways. If this happens, PDF.js rotation handling is not where Phase 1 assumes — flag and investigate.

### Pitfall 4: Undo After Category-Color Re-Use
**What goes wrong:** User places 5 markups in category "Electrical" (auto-assigned blue #0078d4). Deletes them all. Undoes once. Which category does the re-placed markup belong to?
**Why it happens:** If categories are auto-created when a markup is placed AND auto-deleted when their last markup disappears, the category ID on the undo command becomes stale.
**How to avoid:** **Categories are never deleted.** Once created, they stay in the registry for the session (MARK-06 doesn't require deletion; v2 PROD-02 will add visibility toggles but not deletion). Undo restores markup by categoryId; the category is guaranteed to still exist.
**Warning signs:** After undo, markup color changes or a "category not found" error.

### Pitfall 5: Count-Pin Sequential Numbers on Undo
**What goes wrong:** User places "Light Switch 1" through "Light Switch 5". Deletes "Light Switch 3". Places a new one — should it be "Light Switch 6" (next unused) or "Light Switch 3" (reuse the gap)?
**Why it happens:** Sequential numbers are either a stored field on the markup OR a computed rank. If stored, deleting a middle pin leaves a gap; if computed, undo/redo stability breaks.
**How to avoid:** **Store the sequential number on the markup at placement time** (not computed). Use `max(existing sequence numbers for that item name) + 1`. After delete, gaps remain. After undo of a delete, the number is restored from the command. Simplest correct behaviour.
**Alternative:** Always renumber 1..N after every change — fights undo semantics; avoid.
**Warning signs:** Numbers renumber unexpectedly after delete/undo round-trips.

### Pitfall 6: Popup Open While User Switches Pages
**What goes wrong:** User is in the middle of the post-shape naming popup on page 1. They press `PageDown` (existing shortcut). The popup stays open, but the canvas underneath is now page 2. Saving commits the markup to page 2.
**Why it happens:** The popup's `currentPage` binding is read at save time, not at draw time.
**How to avoid:** Capture `page` at the time the shape is finished (when `handleStageDblClick` or polygon-close fires); store it in the draw state; use it when saving. OR: dismiss the popup + discard the shape when `currentPage` changes mid-edit. Recommend the former — matches existing `ScalePopup` behavior where the calibration is stored against the page it was drawn on.
**Warning signs:** A markup appears on the wrong page after rapid page-flipping.

### Pitfall 7: Leaking Keyboard Shortcut During Popup-Open
**What goes wrong:** User is typing the item name. They press `Ctrl+Z` to undo a typo. Instead, the global Ctrl+Z fires the markup-undo, deleting a previously-placed markup.
**Why it happens:** `useKeyboardShortcuts` binds to `window`; the popup's input doesn't stop propagation.
**How to avoid:** In the global Ctrl+Z / Ctrl+Y handler, check `document.activeElement`. If it's an `<input>` or `<textarea>`, do nothing — let the browser's native edit-undo handle it. Or: when a popup is open, disable global undo. The former is less friction.
**Warning signs:** Markups disappear while the user is typing.

---

## Code Examples

### Example 1: Markup Type Discriminated Union

```typescript
// src/renderer/src/types/markup.ts (new file)
import type { StagePoint } from '../hooks/useCalibrationMode'

export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter'

export interface BaseMarkup {
  id: string                     // crypto.randomUUID()
  type: MarkupType
  page: number                   // 1-indexed, matches currentPage
  name: string                   // user-entered item name
  categoryId: string             // FK to category registry
  createdAt: number              // epoch ms; for stable sort
}

export interface CountMarkup extends BaseMarkup {
  type: 'count'
  point: StagePoint
  sequence: number               // 1, 2, 3... within { name, page }
}

export interface LinearMarkup extends BaseMarkup {
  type: 'linear'
  points: StagePoint[]           // 2+ vertices, open polyline
}

export interface AreaMarkup extends BaseMarkup {
  type: 'area'
  points: StagePoint[]           // 3+ vertices, implicitly closed
}

export interface PerimeterMarkup extends BaseMarkup {
  type: 'perimeter'
  points: StagePoint[]           // 3+ vertices, implicitly closed
}

export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup

export interface Category {
  id: string                     // crypto.randomUUID()
  name: string                   // display name, case-insensitive unique
  color: string                  // one of the 8-palette hex strings
  paletteIndex: number           // 0..7; determines color
}

export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
```

### Example 2: Markup Store Skeleton (Zustand + Command Pattern)

```typescript
// src/renderer/src/stores/markupStore.ts (new file)
// Source: pattern adapted from src/renderer/src/stores/scaleStore.ts
import { create } from 'zustand'
import type { Markup, Category, MarkupCommand } from '../types/markup'

const CATEGORY_PALETTE = [
  '#0078d4', '#d13438', '#107c10', '#ca8a04',
  '#5c2d91', '#008272', '#e3008c', '#8e562e'
] as const

const UNDO_STACK_MAX = 50

interface MarkupStoreState {
  pageMarkups: Record<number, Markup[]>
  categories: Record<string, Category>           // keyed by id
  categoryOrder: string[]                        // ordered ids, determines palette index
  undoStack: MarkupCommand[]
  redoStack: MarkupCommand[]

  // Queries
  getMarkups: (page: number) => Markup[]
  findCategoryByName: (name: string) => Category | null
  getCategory: (id: string) => Category | null
  getAllCategories: () => Category[]
  nextCountSequence: (page: number, name: string) => number

  // Mutations (command-pattern internally)
  getOrCreateCategory: (name: string) => Category
  placeMarkup: (markup: Markup) => void
  deleteMarkup: (page: number, markupId: string) => void

  // Undo/redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}

export const useMarkupStore = create<MarkupStoreState>((set, get) => ({
  pageMarkups: {},
  categories: {},
  categoryOrder: [],
  undoStack: [],
  redoStack: [],

  getMarkups: (page) => get().pageMarkups[page] ?? [],

  findCategoryByName: (name) => {
    const norm = name.trim().toLowerCase()
    for (const cat of Object.values(get().categories)) {
      if (cat.name.trim().toLowerCase() === norm) return cat
    }
    return null
  },

  getCategory: (id) => get().categories[id] ?? null,
  getAllCategories: () =>
    get().categoryOrder.map((id) => get().categories[id]).filter(Boolean),

  nextCountSequence: (page, name) => {
    const existing = (get().pageMarkups[page] ?? [])
      .filter((m): m is import('../types/markup').CountMarkup => m.type === 'count' && m.name === name)
    return existing.length === 0 ? 1 : Math.max(...existing.map((m) => m.sequence)) + 1
  },

  getOrCreateCategory: (name) => {
    const existing = get().findCategoryByName(name)
    if (existing) return existing
    const paletteIndex = get().categoryOrder.length % CATEGORY_PALETTE.length
    const id = crypto.randomUUID()
    const cat: Category = { id, name: name.trim(), color: CATEGORY_PALETTE[paletteIndex], paletteIndex }
    set((s) => ({
      categories: { ...s.categories, [id]: cat },
      categoryOrder: [...s.categoryOrder, id]
    }))
    return cat
  },

  placeMarkup: (markup) =>
    set((s) => {
      const page = markup.page
      const pageList = [...(s.pageMarkups[page] ?? []), markup]
      return {
        pageMarkups: { ...s.pageMarkups, [page]: pageList },
        undoStack: pushCommand(s.undoStack, { type: 'place', markup }),
        redoStack: []                                       // new action clears redo
      }
    }),

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

  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s
    const cmd = s.undoStack[s.undoStack.length - 1]
    const page = cmd.markup.page
    const pageList = s.pageMarkups[page] ?? []
    let nextList: Markup[]
    if (cmd.type === 'place') {
      nextList = pageList.filter((m) => m.id !== cmd.markup.id)
    } else { /* delete inverse = restore */
      nextList = [...pageList, cmd.markup]
    }
    return {
      pageMarkups: { ...s.pageMarkups, [page]: nextList },
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, cmd]
    }
  }),

  redo: () => set((s) => {
    if (s.redoStack.length === 0) return s
    const cmd = s.redoStack[s.redoStack.length - 1]
    const page = cmd.markup.page
    const pageList = s.pageMarkups[page] ?? []
    let nextList: Markup[]
    if (cmd.type === 'place') {
      nextList = [...pageList, cmd.markup]
    } else {
      nextList = pageList.filter((m) => m.id !== cmd.markup.id)
    }
    return {
      pageMarkups: { ...s.pageMarkups, [page]: nextList },
      undoStack: pushCommand(s.undoStack, cmd),
      redoStack: s.redoStack.slice(0, -1)
    }
  }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0
}))
```

### Example 3: Keyboard Shortcut Integration

```typescript
// src/renderer/src/hooks/useKeyboardShortcuts.ts — add to existing handler
// Skip undo if focus is in a text input — let native browser undo win
function isTextInputActive(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

// Inside handleKeyDown:
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return                             // pitfall #7
  e.preventDefault()
  useMarkupStore.getState().undo()
  return
}
if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
  if (isTextInputActive()) return
  e.preventDefault()
  useMarkupStore.getState().redo()
  return
}
```

### Example 4: Count Pin Rendering

```typescript
// src/renderer/src/components/markup/CountPinMarkup.tsx (new file)
import { Circle, Text, Group } from 'react-konva'
import type { CountMarkup, Category } from '../../types/markup'
import { COLORS } from '../../lib/constants'

export function CountPinMarkup({
  markup, category, currentZoom
}: { markup: CountMarkup; category: Category; currentZoom: number }) {
  const PIN_RADIUS = 6 / currentZoom
  const STROKE_WIDTH = 1 / currentZoom
  const LABEL_FONT = Math.max(12 / currentZoom, 10)
  const LABEL_OFFSET_X = 10 / currentZoom

  return (
    <Group listening={false}>
      <Circle
        x={markup.point.x}
        y={markup.point.y}
        radius={PIN_RADIUS}
        fill={category.color}
        stroke="#ffffff"
        strokeWidth={STROKE_WIDTH}
      />
      <Text
        x={markup.point.x + LABEL_OFFSET_X}
        y={markup.point.y - LABEL_FONT / 2}
        text={`${markup.name} ${markup.sequence}`}
        fontSize={LABEL_FONT}
        fontFamily="Inter, sans-serif"
        fontStyle="600"
        fill={COLORS.textPrimary}
        shadowColor="#ffffff"
        shadowBlur={2 / currentZoom}
        shadowOpacity={0.9}
      />
    </Group>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Konva.Polygon as a separate shape | `Konva.Line` with `closed={true}` | Konva 4.x+ | `Polygon` was removed; `Line closed` is the only polygon primitive. Already the pattern in every 2025/2026 Konva example. |
| Immer-backed Zustand reducer for all updates | Plain Zustand reducers for shallow state, Immer only for deep nested updates | Zustand 5 (2024+) | Zustand 5 works fine without Immer for markup lists. Skip Immer; it adds bundle size for no benefit here. |
| Snapshot-based undo (Photoshop-style) | Command-pattern undo for fine-grained actions | Locked by `STATE.md` | Command pattern uses O(1) memory per action vs O(N) for snapshots. Correct choice for a markup canvas that may hold hundreds of items. |
| Canvas-pixel coordinate storage | **Page-space coordinate storage** | Locked by `STATE.md` from Phase 1 | All markup drift problems trace to violating this rule. Non-negotiable. |

**Deprecated / outdated to avoid:**
- `Konva.Polygon` class — does not exist in 10.x. Use `Line closed`.
- `react-konva` v17 or earlier — requires React 17 peer; project uses React 19 + react-konva 19.2.3.
- `zustand` v4 `combine` middleware — project uses `create<State>()` direct, consistent with Phase 1–2.

---

## Open Questions

### 1. Page-space coordinate representation: absolute pixels vs normalized 0–1?

- **What we know:** `STATE.md` says "normalized 0.0–1.0". Existing `useCalibrationMode.screenToStagePoint` returns **absolute stage (page-space) pixels** at the PDF's base 2x render scale. Calibration line coordinates are stored unnormalized.
- **What's unclear:** Whether Phase 3 should match existing Phase 2 behaviour (absolute pixels) or match `STATE.md` wording (normalize to 0–1). Phase 4 save/load format may prefer one or the other.
- **Recommendation:** Use absolute page-space pixels for Phase 3 runtime — matches `useCalibrationMode`, simpler, no rounding error accumulation. Phase 4 persistence layer can normalize on serialize if a future PDF-reload-at-different-resolution scenario requires it. **Flag explicitly in plan for human confirmation.**

### 2. Single unified `useMarkupTool` hook or four per-tool hooks?

- **What we know:** The four tools share 80% of state (mode, points, preview, popup). Count differs most (naming comes before drawing; draw = single click).
- **What's unclear:** Whether the branching is cleaner as one discriminated-union hook or four specialized hooks.
- **Recommendation:** One hook, `useMarkupTool(toolType)`, with a `toolType`-discriminated state machine. Easier to keep interaction semantics consistent (keyboard Escape, popup positioning, zoom compensation) across all four. Keep specialization to a minimum of four `switch`-branch handlers.

### 3. Layer 1 `listening={false}` — how do polygon vertices receive hover events during draw?

- **What we know:** Phase 2 sets Layer 1 `listening={false}` because calibration line is non-interactive. Phase 3 polygon-close requires the start-vertex Circle to receive mouseenter/mouseleave.
- **What's unclear:** Whether to flip Layer 1 to `listening={true}` globally, or introduce a Layer 2 for interactive-during-draw vertices.
- **Recommendation:** **Introduce a transient interactive layer** (Layer 2) that exists only while a polygon draw is in progress. When drawing ends (close or cancel), Layer 2 unmounts. Final committed markups live on Layer 1 with `listening={false}` (Phase 3 scope: no click-to-select). This preserves the Phase 2 performance benefit and localises the interactive concern.

### 4. Count tool: does "switch item" require user to click the Count button again (D-03)?

- **What we know:** D-03 says yes — clicking Count button opens fresh popup.
- **What's unclear:** Whether there should also be an on-canvas "switch item" affordance (e.g. Escape closes current count session and re-opens popup).
- **Recommendation:** Escape during count placement should return to `idle` (no tool active) — matches calibration pattern. Re-clicking Count button re-opens popup. Don't add a shortcut for "switch item within Count mode" in this phase. Deferred if users complain.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build / Vitest | ✓ | 22.x (bundled with Electron 35) | — |
| Chromium (Electron renderer) | `crypto.randomUUID`, Konva, React DOM | ✓ | 134 (bundled with Electron 35) | — |
| konva | Canvas shape rendering | ✓ | 10.2.3 | — |
| react-konva | React bindings | ✓ | 19.2.3 | — |
| zustand | Store | ✓ | 5.0.12 | — |
| vitest | Unit testing | ✓ | 4.1.1 | — |
| Inter font | Label typography | ✓ | 5.2.8 (@fontsource/inter) | system sans-serif via fontFamily fallback |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

This phase ships zero new runtime deps.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (Node environment per `vitest.config.ts`) |
| Config file | `vitest.config.ts` at project root — includes `src/tests/**/*.test.ts`, alias `@renderer` → `src/renderer/src` |
| Quick run command | `npx vitest run src/tests/markup-math.test.ts --reporter=basic` (single-file, fast) |
| Full suite command | `npx vitest run` |
| Typecheck | `npm run typecheck` (runs both `typecheck:node` and `typecheck:web`) |

The project already has 8 passing test files. New tests for Phase 3 follow the same file-name + location pattern (`src/tests/{topic}.test.ts`).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MARK-01 | Count pin stored at stage (page-space) coords; sequential numbering per name increments | unit | `npx vitest run src/tests/markup-store.test.ts -t "count"` | ❌ Wave 0 |
| MARK-02 | `polylineLength(points)` returns correct sum-of-segments length; real-world conversion via scaleStore | unit | `npx vitest run src/tests/markup-math.test.ts -t "polylineLength"` | ❌ Wave 0 |
| MARK-03 | `polygonArea(points)` returns correct shoelace area; area conversion squares the scale ratio | unit | `npx vitest run src/tests/markup-math.test.ts -t "polygonArea"` | ❌ Wave 0 |
| MARK-04 | Perimeter markup reports both perimeter AND area from same vertex list | unit | `npx vitest run src/tests/markup-math.test.ts -t "perimeter reports both"` | ❌ Wave 0 |
| MARK-05 | `placeMarkup` commits markup with user-supplied name | unit | `npx vitest run src/tests/markup-store.test.ts -t "name is stored"` | ❌ Wave 0 |
| MARK-06 | `getOrCreateCategory` reuses existing category by case-insensitive name match; creates new with next palette index | unit | `npx vitest run src/tests/markup-store.test.ts -t "category"` | ❌ Wave 0 |
| MARK-07 | Label rendering — **visual verification required**; unit test asserts `fontSize = max(12/zoom, 10)` formula | unit + manual | `npx vitest run src/tests/markup-math.test.ts -t "label font size floor"` + run dev build | ❌ Wave 0 |
| MARK-08 | Each category has a palette color; 9th category wraps to palette[0] | unit | `npx vitest run src/tests/markup-store.test.ts -t "palette cycles"` | ❌ Wave 0 |
| MARK-09 | `undo()` reverses `placeMarkup` / `deleteMarkup`; stack max depth clamps at 50 | unit | `npx vitest run src/tests/markup-commands.test.ts -t "undo"` | ❌ Wave 0 |
| MARK-10 | `redo()` reapplies undone action; new action clears redo stack | unit | `npx vitest run src/tests/markup-commands.test.ts -t "redo"` | ❌ Wave 0 |
| (success criterion 4) | Markup position stable across zoom round-trip | integration | scripted pan/zoom + position assertion in `stage-transform.test.ts`-style test | partial — extend existing `stage-transform.test.ts` |
| (success criterion 5) | 20+ undo/redo cycles preserve data integrity | unit | `npx vitest run src/tests/markup-commands.test.ts -t "round-trip"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/<file-touched>.test.ts` (sub-second feedback)
- **Per wave merge:** `npx vitest run && npm run typecheck`
- **Phase gate:** Full suite green (`npx vitest run` all 8 existing + new ≈12 files) + manual visual verification of labels at min/max zoom before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/markup-math.test.ts` — `polylineLength`, `polygonArea`, `polygonCentroid`, real-world-unit conversion (linear and areal)
- [ ] `src/tests/markup-store.test.ts` — categories (auto-create, case-insensitive dedupe, palette cycling), per-page markup lists, count sequence numbering
- [ ] `src/tests/markup-commands.test.ts` — place/delete commands, undo, redo, stack depth clamp, round-trip integrity
- [ ] (optional) extend `src/tests/stage-transform.test.ts` with a "markup position stable after zoom round-trip" case

No framework install needed (Vitest 4.1.1 already present). No shared fixtures file needed (tests are small, self-contained).

---

## Sources

### Primary (HIGH confidence)

- **Existing project code** (verified directly):
  - `src/renderer/src/hooks/useCalibrationMode.ts` — state-machine pattern, stage-inverse-transform
  - `src/renderer/src/components/CanvasViewport.tsx` — Layer composition, zoom compensation, popup positioning
  - `src/renderer/src/components/ScalePopup.tsx` — inline popup, clamp-to-container
  - `src/renderer/src/stores/scaleStore.ts` — Zustand store shape
  - `src/renderer/src/lib/scale-math.ts` — `euclideanDistance`, `computePixelsPerMm`, `pixelsToRealWorld`, `toMm`, `fromMm`
  - `src/renderer/src/types/scale.ts` — `MM_PER_UNIT`, `ScaleUnit`, `PageScale`
  - `src/renderer/src/lib/constants.ts` — `COLORS`, `LAYOUT`, `ZOOM_STEPS`
  - `src/renderer/src/components/Toolbar.tsx` — `IconButton` active-state pattern
  - `src/renderer/src/hooks/useKeyboardShortcuts.ts` — keyboard binding location
  - `src/tests/*.test.ts` — Vitest conventions (8 existing files)
  - `vitest.config.ts` — node environment, `@renderer` alias
  - `package.json` — pinned versions

- **Konva official docs:**
  - [Konva Line (polygon with closed)](https://konvajs.org/docs/shapes/Line_-_Polygon.html) — `closed`, `fill`, `stroke` semantics
  - [Konva Line basics](https://konvajs.org/docs/shapes/Line.html) — `lineCap`, `lineJoin`, points array
  - [Konva Custom Hit Region](https://konvajs.org/docs/events/Custom_Hit_Region.html) — `hitStrokeWidth`
  - [Konva Listening False](https://konvajs.org/docs/performance/Listening_False.html) — layer-level event disable
  - [Konva react-konva Shapes](https://konvajs.org/docs/react/Shapes.html) — declarative shape usage

- **Planning artifacts (read directly):**
  - `.planning/REQUIREMENTS.md` — MARK-01 through MARK-10 definitions
  - `.planning/STATE.md` — locked decisions (page-space storage, command pattern, zoom compensation, stage-inverse-transform)
  - `.planning/ROADMAP.md` — Phase 3 success criteria
  - `.planning/phases/03-markup-tools-and-editing/03-CONTEXT.md` — user decisions D-01 through D-17
  - `.planning/phases/03-markup-tools-and-editing/03-UI-SPEC.md` — visual contract (checker-approved)
  - `.planning/config.json` — `nyquist_validation: true`, `commit_docs: true`

### Secondary (MEDIUM confidence — web search cross-referenced with official docs)

- [DevMuscle — react-konva bounding polygon annotation tool](https://devmuscle.com/blog/react-konva-image-annotation) — canonical first-point-close pattern using `hitStrokeWidth` + hover state (verified against Konva official docs)
- [Zustand discussions: undo/redo middleware options (zundo, zustand-travel)](https://github.com/pmndrs/zustand/discussions/1611) — confirms command pattern is a valid hand-rolled alternative; middleware not required
- [Medium — Interactive Polygon Editor in React using React-Konva (Imam Rasheedat)](https://medium.com/@imamrasheedatahmad1993/how-to-build-an-interactive-polygon-editor-in-react-using-react-konva-1b085e0b04de) — semi-transparent fill pattern (`#RRGGBBAA` hex alpha)

### Tertiary (LOW — flagged for validation)

None flagged. Every architectural claim in this document traces to either verified project code or an official Konva documentation page.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries already installed, versioned, and working in Phase 1–2
- Architecture patterns: **HIGH** — every pattern is a direct extension of an existing verified file
- Don't-hand-roll list: **HIGH** — shoelace formula, Konva `Line closed`, `hitStrokeWidth`, `randomUUID` are all standard, documented, non-controversial choices
- Common pitfalls: **MEDIUM-HIGH** — pitfalls 1, 2, 4, 5, 6, 7 are domain-experience-driven (likely, but not empirically observed in this codebase yet); pitfall 3 is hypothetical (Phase 1 renderer behaviour not re-verified)
- Undo/redo command pattern: **HIGH** — locked in `STATE.md`, matches standard CS textbook
- Test architecture: **HIGH** — direct extension of existing `src/tests/*.test.ts` convention

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stack is stable; flag for re-research if Konva 11 or react-konva 20 ships in that window)
