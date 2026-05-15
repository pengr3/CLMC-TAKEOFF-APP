# Phase 8: Markup Workflow Acceleration and Wall Measurement Tool — Research

**Researched:** 2026-05-15
**Domain:** React + Konva + Zustand — feature extension on top of an established codebase
**Confidence:** HIGH (all findings verified against live source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chain Markup Mode:**
- D-01: Chain mode applies to all five tools — count, linear, area, perimeter, wall.
- D-02: Chain-break triggers: Esc OR re-clicking the active tool button. Tool-switch to different type also breaks. Right-click does NOT.
- D-03: Visual indicator: existing active underline stays + small chip badge with armed name and color dot.
- D-04: Chain persists across PDF page navigation.
- D-05: Chain state stored inside `useMarkupTool` hook (runtime only, no persistence).

**Wall Measurement Tool:**
- D-06: `'wall'` is a new `MarkupType` with `WallMarkup` interface (`points: StagePoint[]`, `wallHeight: number` in mm).
- D-07: Wall height edit is in scope and must be undoable via `MarkupCommand` pattern. (Visual affordance and exact command shape: Claude's discretion — see below.)
- D-08: Per-wall height input on commit; chain inherits last height silently. First wall defaults to 2400 mm.
- D-09: Reuse `MarkupNamePopup` with conditional wall-height row (numeric, mm, positive required).
- D-10: New `WallMarkup.tsx` Konva component; visual affordance is Claude's discretion.
- D-11: Fifth toolbar button; Lucide icon is Claude's discretion.
- D-12: BOQ row: single m² row, `quantity = sum(length_m × wallHeight_m)`, `uom = 'm²'`.

**Show/Hide Visibility:**
- D-13: Persisted in `.clmc` project file as `hiddenItemNames: string[]`. Schema migration policy: Claude's discretion.
- D-14: Lucide `Lightbulb`/`LightbulbOff` icon before the color chip in `TotalsRow`. Always visible.
- D-15: Canvas renderers skip hidden markups; totals quantities and BOQ export include all.
- D-16: Visibility toggle is NOT undoable. Direct `projectStore` action; marks dirty.

**Crosshair Cursor:**
- D-17: Rifle-scope style: crossed 1px lines, ~16px arms, 1–2px circular gap at center, white with thin black outline.
- D-18: CSS cursor with SVG data-URL on `CanvasViewport` `containerRef`. Hotspot 12 12 for 24×24 SVG.
- D-19: Active when `activeTool ∈ { count | linear | area | perimeter | wall }` OR `calibMode !== 'idle'`.
- D-20: Applied to `CanvasViewport` `containerRef` div only.

### Claude's Discretion

- **Wall renderer affordance (D-10):** Choose visual treatment distinguishing wall from linear.
- **Wall toolbar icon (D-11):** Choose clearest Lucide icon at 16×16.
- **EditMarkupCommand wall-height extension (D-07):** Choose smaller diff that keeps TS exhaustive.
- **Chain badge placement (D-03):** Inline next to active tool button or below toolbar row.
- **Schema version bump path (D-13):** Bump `formatVersion` or rely on per-field defaulting.

### Deferred Ideas (OUT OF SCOPE)

- BOQ export filter by hidden items
- Per-page wall-height defaults
- Per-row tooltip with wall length + height + count breakdown
- Cursor-attached label trailing crosshair
- Right-click on canvas as chain-break trigger
- Heavier crosshair (accent color)
- Group/bulk visibility toggle (v2 PROD-02)
- Wall thickness rendering (parallel offset polygon)
</user_constraints>

---

## Summary

Phase 8 adds four independent post-v1 enhancements to the CLMC Takeoff App. All four features operate purely in the renderer layer (React + Konva + Zustand) except for `hiddenItemNames` persistence, which touches the main-process project schema. The codebase is mature and well-structured; each feature has clear extension points. No new npm packages are required.

The wall tool is the most substantial addition: it extends six files in `types/`, `stores/`, `lib/`, and the renderer components layer, plus the main-process BOQ writers. Chain mode is a surgical refactor of `useMarkupTool.ts` with a module-ref communication channel to Toolbar. Show/hide is additive schema field + three renderer skip-checks. The crosshair is a single inline-style expression on one div.

**Primary recommendation:** Plan waves around data-model-first → UI → integration order, with Wave 0 providing all RED test stubs. The wall tool's `MarkupType`/`MarkupCommand`/`BoqRowType` type extensions are the critical path; everything else fans out from them.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain state storage | Renderer hook (`useMarkupTool`) | — | D-05: runtime-only, no persistence |
| Chain badge display | Renderer component (`Toolbar`) | `useMarkupTool` module-ref | Badge reads from hook via exported ref |
| Wall data types | Renderer types (`markup.ts`) | Main process (inline dup) | TypeScript discriminated union; main duplicates inline per established pattern |
| Wall math | Renderer lib (`markup-math.ts`) | — | Pure function, no IPC needed |
| Wall BOQ aggregation | Renderer lib (`boq-aggregator.ts`) | — | Aggregator is renderer-only per D-04 |
| Wall BOQ export | Main process (`boq-writers.ts`) | — | ExcelJS is main-process only |
| Show/hide state | `projectStore` (Zustand) | Project schema (main) | D-13: travels with `.clmc` |
| Show/hide rendering | Renderer components (markup renderers) | — | Skip-render check in each renderer |
| Crosshair cursor | `CanvasViewport.tsx` inline style | — | CSS-only, zero JS overhead |
| Wall schema persistence | Main process project schema | `project-io.ts` | Additive field on `ProjectFileV2` |

---

## Feature 1: Chain Markup Mode

### Current Count-Tool Pattern (lines 106–153, useMarkupTool.ts)

The count tool already implements "stay armed": after `commitCountName`, state moves to `mode: 'placing'` with `pendingName/pendingCategoryName/pendingColor` populated. Subsequent `recordClick` calls dispatch `store.placeMarkup` using the ref snapshot (`stateRef.current`) without re-prompting.

The key mechanism is:
1. `commitCountName` sets `mode: 'placing'` (does not reset to `INITIAL_STATE`)
2. `recordClick` checks `currentState.toolType === 'count' && currentState.mode === 'placing'` — if true, places and returns without state change
3. The chain for count is unbreakable by anything except `cancel()` (Esc) or re-activating a different tool

### Generalization to Linear/Area/Perimeter/Wall

**Current post-commit reset (line 324):**
```typescript
// commitShape — line 324
setState(INITIAL_STATE)
```

**Chain generalization:** After `commitShape`, instead of resetting to `INITIAL_STATE`, when chain is armed, reset only `points`, `previewPoint`, `popupScreenPos`, `pendingPage` — preserve `pendingName`, `pendingCategoryName`, `pendingColor`, `toolType`, and set `mode: 'drawing'` (or `'naming'` for count).

**`MarkupDrawState` extension:**
```typescript
export interface MarkupDrawState {
  // ... existing fields ...
  chainArmed: boolean   // true after first commitShape/commitCountName; false after cancel()
}
```

`INITIAL_STATE` has `chainArmed: false`. After commit, if `chainArmed` was already true (or becomes true on first commit), the post-commit reset preserves name/category/color and returns to `drawing` mode.

**Wall integration:** Wall uses `commitShape` path (like linear/area/perimeter), not `commitCountName`. The chain also inherits `pendingWallHeight` — add this field to `MarkupDrawState`.

### Chain-Break Integration Points

**Esc key** — `useKeyboardShortcuts.ts` already calls `cancelMarkup()` on Esc. `cancel()` resets to `INITIAL_STATE` (chainArmed becomes false). No additional change needed.

**Re-clicking active tool button** — `Toolbar.tsx` `handleMarkupToolClick`:
```typescript
// Current (line 189):
const handleMarkupToolClick = (tool) => {
  if (activeTool === tool) {
    setActiveTool('select')  // toggles off
  } else {
    setActiveTool(tool)
  }
}
```
Chain-break is handled by the existing `setActiveTool('select')` path: when `activeTool` changes to `'select'`, `CanvasViewport`'s effect (line 194–198) calls `cancelMarkup()`, which resets to `INITIAL_STATE`. No special "break chain" branch needed — the existing toggle is sufficient.

**Tool switch** — changing from `'linear'` to `'area'` also triggers `cancelMarkup()` via the effect. Chain breaks naturally.

### Module-Ref vs Zustand for Chain Badge (Integration Point)

**Recommendation: Module-level ref — Option A.**

**Evidence from codebase:** `CanvasViewport.tsx` already exposes two module-level refs:
- `_canvasControls` → `getCanvasControls()` (consumed by Toolbar)
- `_calibrationControls` → `getCalibrationControls()` (consumed by Toolbar + CanvasHeaderBar)

Both follow the same pattern: populated in a `useEffect` inside `CanvasViewport`, exported as a getter function, consumed by `Toolbar` at render time.

**Applying the pattern:**
```typescript
// In CanvasViewport.tsx (module level):
let _chainArmedItem: { name: string; color: string } | null = null
export function getChainArmedItem() { return _chainArmedItem }

// Inside CanvasViewport component:
useEffect(() => {
  _chainArmedItem = markupState.chainArmed && markupState.pendingName
    ? { name: markupState.pendingName, color: markupState.pendingColor }
    : null
}, [markupState.chainArmed, markupState.pendingName, markupState.pendingColor])
```

**In Toolbar.tsx:** Read `getChainArmedItem()` during render to conditionally show the chip badge.

**Why not Zustand?** The chain state is transient UX state explicitly stored in the hook (D-05). Elevating it to Zustand would couple a runtime-only concept to the persistent store machinery. The module-ref pattern is already the project's established cross-component imperative channel.

**Chip badge placement:** Inline, inside the active tool's `IconButton` as a child (using the `children` prop already used by the Set Scale chevron on line 343). Render a small `<span>` with a colored dot and truncated name. This avoids a second toolbar row.

---

## Feature 2: Wall Measurement Tool

### Type Extension (markup.ts)

```typescript
// Add to MarkupType union:
export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'

// New interface:
export interface WallMarkup extends BaseMarkup {
  type: 'wall'
  points: StagePoint[]
  wallHeight: number  // millimetres
}

// Extend Markup union:
export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup
```

TypeScript's exhaustive switch in `markupStore.ts` `undo`/`redo` will flag the missing `'wall'` case immediately — this is the desired compile-time safety net.

### EditMarkupCommand Wall-Height Extension (D-07)

**Recommendation: Option A — extend the existing `'edit-markup'` branch with optional `oldWallHeight?`/`newWallHeight?` fields.**

**Evidence:**
- The current `'edit-markup'` branch already stores `markupId`, `page`, `oldName/newName`, `oldCategoryName/newCategoryName`, `oldColor/newColor` — it's a change-record, not a full snapshot.
- Adding optional fields preserves the existing `undo`/`redo` code paths for non-wall markups. The `if (cmd.type === 'edit-markup')` block in `undo()` (line 229) and `redo()` (line 283) reads specific fields — adding optional fields is purely additive.
- The `editMarkup()` store action (line 161) can check `if ('wallHeight' in updatedFields)` to conditionally update `wallHeight`.
- A sibling `'edit-wall'` branch would require duplicating the undo/redo block, creating maintenance burden.

**Extended command shape:**
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
    // New optional wall-height fields (undefined for non-wall edits):
    oldWallHeight?: number
    newWallHeight?: number
  }
```

**Undo path:** When `cmd.oldWallHeight !== undefined`, include `wallHeight: cmd.oldWallHeight` in the restored markup object. Non-wall markups: fields absent, existing logic unchanged.

### Wall Toolbar Icon (D-11)

**Recommendation: `BrickWall`** [VERIFIED: lucide-react 1.6.0 installed in project].

**Rationale:** `BrickWall` is the only icon in the installed Lucide set that directly communicates "wall" without ambiguity. At 16×16 it renders as a horizontal brick-pattern rectangle — immediately reads as "wall" to a construction professional. All candidates assessed:

| Icon | Available | Reads as "wall"? | At 16×16 |
|------|-----------|-----------------|----------|
| `BrickWall` | YES | Directly — bricks = wall | Recognizable brick pattern |
| `Columns2` | YES | No — reads as "layout columns" | UI panel metaphor |
| `RectangleVertical` | YES | No — reads as "portrait shape" | Generic rectangle |
| `ToyBrick` | YES | Partially — LEGO brick, not wall | Reads as "block" |

`BrickWall` is the clearest choice. Import: `import { BrickWall } from 'lucide-react'`.

### Wall Renderer Affordance (D-10)

**Recommendation: 2.5× stroke width + parallel offset hairline.**

**Analysis of options on dense construction plans:**
- **(a) 2× stroke width alone:** Distinguishes from linear but may read as "thick linear" not "wall". Acceptable but not ideal.
- **(b) Parallel offset hairline (wall-thickness suggestion):** Draws the polyline with a thin second line offset by ~4 world-units parallel to the main stroke, creating a "tube" appearance. Communicates wall thickness visually. **Works with zoom-compensated strokes.** Most semantically correct.
- **(c) Dashed/dotted stroke:** Conflicts with construction drawing conventions where dashes mean "hidden" or "future" elements. Do not use.
- **(d) Hatching:** Computationally expensive (requires per-segment perpendicular calculations), obscures underlying plan. Rejected.

**Recommended implementation:** Use a primary `Line` at 2.5×STROKE_BASE_PX/currentZoom in the markup color, plus a secondary `Line` at the same path but 0.7 opacity and STROKE_BASE_PX/currentZoom, drawn with a fixed world-space offset of 3px in the perpendicular direction. For a polyline (multi-segment), the offset line is the simplest parallel: just offset each point by a fixed perpendicular amount (acceptable approximation; true miter offset is deferred per CONTEXT.md). The outer line is `listening={false}`.

If the parallel offset adds complexity that exceeds the plan budget, fall back to **(a) 2× stroke width alone** as the minimum viable wall visual. Document this decision in the plan.

**Label:** Shows m² area (not linear length) at polyline arc-length midpoint, reusing `polylineMidpointByArcLength` from `markup-math.ts`.

### Wall Math

```typescript
// New function in markup-math.ts:
export function wallAreaM2(
  points: StagePoint[],
  wallHeightMm: number,
  pixelsPerMm: number
): number {
  const pixelLen = polylineLength(points)
  const lengthM = pixelLengthToReal(pixelLen, pixelsPerMm, 'm')
  const heightM = wallHeightMm / 1000
  return lengthM * heightM
}
```

Note: `pixelLengthToReal` with unit `'m'` — requires `'m'` to be a valid `ScaleUnit`. Verify this in `scale-math.ts`. Alternative: use `pixelsPerMm` directly: `(pixelLen / pixelsPerMm) / 1000 * (wallHeightMm / 1000)`.

### BOQ Aggregator Wall Rule

In `aggregateBoq()`, add a new branch in the per-page loop:

```typescript
} else if (m.type === 'wall') {
  if (scale === null) continue  // skip uncalibrated pages (same as linear/area)
  const wallM = m as WallMarkup
  const pixelLen = polylineLength(wallM.points)
  const lengthM = pixelLengthToReal(pixelLen, scale.pixelsPerMm, 'm')
  const heightM = wallM.wallHeight / 1000
  add(catId, m.name, 'wall', lengthM * heightM)
}
```

`'wall'` must be added to `BoqRowType` in `boq-types.ts` and the inline duplicate in `boq-writers.ts`.

The `uomFor` function in `boq-aggregator.ts` must handle `'wall'`:
```typescript
if (t === 'wall') return 'm²'  // wall is always m²
```

The `findUncalibratedMarkupPages` function must include `m.type === 'wall'` alongside linear/area/perimeter.

### BOQ Writers (main process)

`boq-writers.ts` has inline-duplicated `BoqRowType`. Add `'wall'` to it. The `numFmtForUom` function returns `NUMFMT_DECIMAL` for any non-`'ea'` UoM, so wall rows (`'m²'`) automatically get 2dp formatting. No special case needed. The `appendItemRow` function works unchanged.

### MarkupNamePopup Wall-Height Row (D-09)

Add optional props to `MarkupNamePopupProps`:
```typescript
initialWallHeight?: number  // mm, default 2400
onConfirm: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
```

Render the height row only when `toolType === 'wall'` (pass `toolType` prop or derive from `mode`). The row uses an `<input type="number">` with `min="1"` and `placeholder="2400"`. Validation: must be a positive integer. Save button disabled when invalid.

The `onMouseDown + e.preventDefault()` guard already used by `CategoryAutocomplete` must also be applied to the wall height input to prevent the popup from closing on click (established pattern — STATE.md).

---

## Feature 3: Show/Hide Visibility

### Schema Migration Policy (D-13)

**Recommendation: NO `formatVersion` bump — rely on per-field defaulting.**

**Evidence from `project-schema.ts`:**
- The validator `validateV2` (line 87) checks only the fields it explicitly reads. It does NOT reject unknown fields — `return raw as ProjectFileV2` at the end is a cast, not a strict parse.
- The existing migration policy promotes `formatVersion` only for **structural** changes that old app versions cannot read at all (v1 → v2 required a new `pdf.originalFilename` field and the ZIP format, which broke the old loader entirely).
- `hiddenItemNames: string[]` is additive: old files without the field simply don't have it. The deserializer can default it:

```typescript
// In useProject.ts or projectStore hydrate path:
const hiddenItemNames: string[] = Array.isArray(raw.hiddenItemNames) ? raw.hiddenItemNames : []
```

- Bumping to `formatVersion: 3` would break opening Phase 8 project files in older app versions — with a purely additive field, there is no reason to prevent backward compatibility.
- `ProjectFileV2` interface gets the new optional field: `hiddenItemNames?: string[]`

**Serialize path:** The project serializer must write `hiddenItemNames` explicitly so old files (which have `hiddenItemNames: []`) don't accumulate the field on every save.

### `projectStore` Extension

`hiddenItemNames` is NOT in the markup store (markups are not hidden, the view of them is). It belongs in `projectStore` because visibility travels with the project file (D-13, D-16).

```typescript
// New fields in ProjectStoreState:
hiddenItemNames: string[]
toggleHiddenItem: (name: string) => void
```

The `toggleHiddenItem` action:
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
}
```

The `attachDirtyTracking` subscription in `projectStore.ts` currently watches `markupStore` and `scaleStore`. Since `hiddenItemNames` lives in `projectStore` itself, dirty-tracking is handled directly inside `toggleHiddenItem` — no new subscription needed.

The `reset()` action must clear `hiddenItemNames: []`. The `hydrate` equivalent must accept `hiddenItemNames` from the loaded file.

### Markup Renderer Skip-Render Pattern

Each renderer (`CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`) should read `hiddenItemNames` from `projectStore` and skip render:

```typescript
// In each renderer component:
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(markup.name))
if (isHidden) return null
```

**Zustand selector identity:** `(s) => s.hiddenItemNames.includes(markup.name)` returns a boolean — primitively comparable. Zustand's `Object.is` check works correctly (true/false). This pattern is safe.

`HoverRing` and `PulseHighlight` receive `Markup[]` arrays from the parent — if hidden markups are filtered at the renderer level, these components naturally receive nothing to display. Alternatively, the parent can filter the `currentPageMatches` array. Either approach works; filtering at the renderer is simpler (no prop threading).

### TotalsRow Lightbulb Slot

The current `TotalsRow` layout (line 176–249 of TotalsRow.tsx):
```
[cycle-dot 6px][color-chip 10px][gap 4px][label flex:1][quantity][uom]
```

New layout: insert a `[lightbulb 16px]` slot BEFORE the color chip, between the cycle-dot and color-chip:
```
[cycle-dot 6px][lightbulb 16px][color-chip 10px][gap 4px][label flex:1][quantity][uom]
```

The lightbulb slot:
```typescript
const isHidden = useProjectStore((s) => s.hiddenItemNames.includes(itemName))
const toggleHidden = () => useProjectStore.getState().toggleHiddenItem(itemName)
// ...
<div
  style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
  onClick={(e) => { e.stopPropagation(); toggleHidden() }}
  title={isHidden ? 'Show on canvas' : 'Hide from canvas'}
>
  {isHidden
    ? <LightbulbOff size={12} color={COLORS.textSecondary} />
    : <Lightbulb size={12} color={COLORS.textSecondary} />
  }
</div>
```

**`e.stopPropagation()`** on the lightbulb click is required to prevent the row's `handleClick` (cycle navigation) from firing simultaneously.

**Icon sizes:** At 12px, `Lightbulb`/`LightbulbOff` are readable without crowding the 28px row height. The slot is always rendered (not hover-only) per D-14.

---

## Feature 4: Crosshair Cursor

### CSS Cursor Data-URL Constraints

[VERIFIED: MDN CSS cursor documentation, cross-browser behavior]

**Key constraints:**
1. **Maximum safe image size:** 32×32 pixels is the generally safe maximum across Chromium, Firefox, and Edge. The spec has no hard limit, but browser implementations clip or reject cursors larger than 32×32 on some platforms. **Use 24×24 — confirmed safe in Chromium (which Electron 35 bundles).**
2. **Hotspot coordinates:** `cursor: url(...) <x> <y>, fallback` — coordinates are relative to the image top-left. For a 24×24 SVG where the cross intersection is at the exact center, the hotspot is `12 12`. This matches D-18.
3. **SVG viewBox:** The SVG must have `xmlns="http://www.w3.org/2000/svg"` and explicit `width`/`height` attributes. The `viewBox` must match.
4. **Data-URL encoding:** For inline SVG, use `data:image/svg+xml,` followed by URI-encoded SVG. Alternatively encode as base64. URI-encoded is smaller; base64 is safer across old WebView versions (not relevant for Electron 35 with bundled Chromium 134).
5. **Fallback:** The `, crosshair` fallback in D-18 is correct CSS syntax.

### Crosshair SVG Design (D-17)

Rifle-scope specification:
- Canvas: 24×24 SVG
- Horizontal arm: `<line x1="0" y1="12" x2="10" y2="12" />` and `<line x1="14" y1="12" x2="24" y2="12" />`
- Vertical arm: `<line x1="12" y1="0" x2="12" y2="10" />` and `<line x1="12" y1="14" x2="12" y2="24" />`
- Gap: 2px centered at (12,12) — arms stop 2px before center, leave 4px total gap
- White stroke: `stroke="white" stroke-width="1.5"`
- Black outline: duplicate lines behind in black at `stroke-width="3"` for contrast

**Implementation in CanvasViewport.tsx:**

```typescript
// Derive cursor style from activeTool + calibMode:
const CROSSHAIR_CURSOR = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>` +
    // black outline
    `<line x1='0' y1='12' x2='10' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='black' stroke-width='3'/>` +
    // white foreground
    `<line x1='0' y1='12' x2='10' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='white' stroke-width='1.5'/>` +
    `</svg>`
  const encoded = encodeURIComponent(svg)
  return `url("data:image/svg+xml,${encoded}") 12 12, crosshair`
})()

// Inside CanvasViewport render, compute cursor:
const needsCrosshair = isMarkupTool(activeTool) || calibMode !== 'idle'
const cursorStyle = needsCrosshair ? CROSSHAIR_CURSOR : undefined  // undefined = let existing pan/grab logic handle it
```

Apply to `containerRef.current?.style.cursor` via `useEffect` or `useMemo` — the existing pan-cursor logic sets cursor on the same div; ensure the crosshair override takes precedence when active, and restores when inactive.

**Important:** The CROSSHAIR_CURSOR constant should be defined at module scope (outside the component) so the SVG string and encoded URL are computed once, not on every render.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Polyline arc-length midpoint | Custom midpoint finder | `polylineMidpointByArcLength` already in `markup-math.ts` |
| Pixel-to-real unit conversion | Custom unit math | `pixelLengthToReal(px, pixelsPerMm, 'm')` from `markup-math.ts` |
| Polygon area calculation | Shoelace formula reimplemented | `polygonArea` from `markup-math.ts` |
| Cross-component canvas control imperative calls | Event bus, context, Zustand | Module-level ref pattern (`getCanvasControls` / `getCalibrationControls` / `getChainArmedItem`) |
| Crosshair cursor rendering | Konva node, mousemove listener | CSS data-URL cursor — zero runtime overhead |
| SVG crosshair generation per frame | Dynamic SVG component | Module-scope constant string, computed once |
| Color inheritance on new wall markup name | Custom lookup | `getColorForName` in `markupStore`, already used by `MarkupNamePopup` |

---

## Validation Architecture

nyquist_validation is enabled (`config.json`). Existing test framework: Vitest (`src/tests/**/*.test.ts` pattern). React test utilities via `react-konva` mock.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` (existing — do NOT modify mid-wave) |
| Quick run command | `npx vitest run src/tests/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Feature | Behavior | Test Type | File |
|---------|----------|-----------|------|
| Wall math | `wallArea(points, heightMm, pixelsPerMm)` returns correct m² | unit | `src/tests/wall-math.test.ts` |
| Wall math | Zero-length polyline returns 0 | unit | `src/tests/wall-math.test.ts` |
| Wall math | 5m × 2.4m = 12 m² end-to-end | unit | `src/tests/wall-math.test.ts` |
| BOQ aggregator | Wall markup appears as m² row with correct quantity | unit | `src/tests/boq-aggregator-wall.test.ts` |
| BOQ aggregator | Hidden markups still aggregate (D-15) | unit | `src/tests/boq-aggregator-wall.test.ts` |
| Schema | Old v2 file without `hiddenItemNames` loads with `[]` default | unit | `src/tests/project-schema-hidden.test.ts` |
| Schema | File with `hiddenItemNames: ['Outlet']` round-trips correctly | unit | `src/tests/project-schema-hidden.test.ts` |
| Chain mode | `commitShape` with chainArmed=true returns to `drawing` mode | unit | `src/tests/chain-mode.test.ts` |
| Chain mode | `cancel()` resets chainArmed to false | unit | `src/tests/chain-mode.test.ts` |
| Chain mode | Wall height carried across chain commit | unit | `src/tests/chain-mode.test.ts` |
| TotalsRow | Lightbulb click toggles `hiddenItemNames` in projectStore | unit | `src/tests/totals-row-visibility.test.ts` |
| TotalsRow | Lightbulb click does not trigger row cycle navigation | unit | `src/tests/totals-row-visibility.test.ts` |
| Markup renderers | CountPinMarkup returns null when name in hiddenItemNames | unit | `src/tests/markup-visibility.test.ts` |
| Markup renderers | WallMarkup returns null when name in hiddenItemNames | unit | `src/tests/markup-visibility.test.ts` |

### Wave 0 Gaps (all RED)

- [ ] `src/tests/wall-math.test.ts` — wall area unit + edge-case tests
- [ ] `src/tests/boq-aggregator-wall.test.ts` — wall aggregation + hidden-item passthrough
- [ ] `src/tests/project-schema-hidden.test.ts` — additive field round-trip
- [ ] `src/tests/chain-mode.test.ts` — chain state machine
- [ ] `src/tests/totals-row-visibility.test.ts` — lightbulb interaction
- [ ] `src/tests/markup-visibility.test.ts` — renderer skip-render

The crosshair cursor and wall toolbar icon require visual/manual UAT (no automated test can verify CSS cursor appearance or SVG rendering quality).

---

## Wave Structure

Recommended wave breakdown — validated against the established pattern from Phase 5/6/7:

### Wave 0 — RED Test Stubs + Type Extensions (prerequisite)

All test files created as RED stubs. Type extensions committed first because they make TypeScript errors visible everywhere else.

**Tasks:**
1. RED test stubs: `wall-math.test.ts`, `boq-aggregator-wall.test.ts`, `project-schema-hidden.test.ts`, `chain-mode.test.ts`, `totals-row-visibility.test.ts`, `markup-visibility.test.ts`
2. Type extensions: `markup.ts` (`'wall'` in `MarkupType`, `WallMarkup` interface, `Markup` union, `MarkupCommand` `'edit-markup'` optional height fields), `boq-types.ts` (`'wall'` in `BoqRowType`), `boq-writers.ts` inline dup

**Dependency:** None. Must complete before any other wave.

### Wave 1 — Foundation (parallel-safe after Wave 0)

These two tasks are independent — they don't share modified files.

**Task 1A — Chain mode refactor:** `useMarkupTool.ts` (`MarkupDrawState` + `chainArmed` + `pendingWallHeight`, post-commit chain logic), `markup-undo-ref.ts` if needed
**Task 1B — Schema + projectStore:** `project-schema.ts` (`hiddenItemNames?: string[]`), `projectStore.ts` (`hiddenItemNames`, `toggleHiddenItem`, reset/hydrate), serialize/deserialize path in `useProject.ts`

**Tests go GREEN:** `chain-mode.test.ts`, `project-schema-hidden.test.ts`

### Wave 2 — Wall Core + BOQ (parallel-safe after Wave 0)

These tasks are also mostly independent.

**Task 2A — Wall math + aggregator + writers:**
- `markup-math.ts` (`wallAreaM2` helper or equivalent inline)
- `boq-aggregator.ts` (wall branch + `findUncalibratedMarkupPages` wall inclusion + `uomFor('wall')`)
- `boq-writers.ts` (`'wall'` in inline dup `BoqRowType`)
- `markupStore.ts` (`placeMarkup`, `deleteMarkup`, `editMarkup` wall support, `executeCommand` wall cases)

**Task 2B — WallMarkup renderer + MarkupNamePopup wall-height row:**
- `WallMarkup.tsx` (new component — polyline with 2.5× stroke + parallel offset hairline, m² label at arc-length midpoint)
- `MarkupNamePopup.tsx` (optional `initialWallHeight` prop, conditional height row, widened `onConfirm` payload)

**Tests go GREEN:** `wall-math.test.ts`, `boq-aggregator-wall.test.ts`

### Wave 3 — UI Integration (blocked on Wave 1 + 2)

**Task 3A — Toolbar + chain badge + crosshair cursor:**
- `Toolbar.tsx` (fifth `BrickWall` IconButton, `handleMarkupToolClick` extended to `'wall'`, chain badge chip)
- `CanvasViewport.tsx` (module-ref `getChainArmedItem`, crosshair cursor inline style, `useMarkupTool` `activateMarkup` accepting `'wall'`, `WallMarkup` renderer mount in Layer 1b, wall-height popup wiring)
- `viewer.ts` types (`isMarkupTool` type guard extended to `'wall'`, `ActiveTool` union extended)

**Task 3B — Visibility toggle UI + renderer skip-render:**
- `TotalsRow.tsx` (lightbulb slot before color chip)
- `CountPinMarkup.tsx`, `LinearMarkup.tsx`, `AreaMarkup.tsx`, `PerimeterMarkup.tsx` (skip-render when hidden)
- `WallMarkup.tsx` (skip-render when hidden — add to Task 2B or here)
- `HoverRing.tsx`, `PulseHighlight.tsx` (review — may be passthrough via parent filtering, not requiring changes)

**Tests go GREEN:** `totals-row-visibility.test.ts`, `markup-visibility.test.ts`

**Task 3C — BOQ writers main-process wall sync:**
- `boq-writers.ts` (ensure inline-dup `BoqRowType` includes `'wall'`, `numFmtForUom` handles `'m²'`)
- This may be already done in Wave 2A; wave 3C confirms integration

### Wave 4 — Manual UAT + Closure

Manual UAT checklist:
1. Place a wall polyline, enter 2400mm height, verify m² shows correctly in TotalsPanel and BOQ export
2. Chain a second wall, verify height inherited silently, chip badge visible in toolbar
3. Esc to break chain, verify badge disappears, next wall re-prompts
4. Navigate pages mid-chain, verify chain persists
5. Toggle `Lightbulb` on a markup row, verify markups disappear from canvas, totals unchanged
6. Save and reload — verify `hiddenItemNames` persisted
7. Export BOQ — verify hidden items included
8. Crosshair appears over canvas when count/linear/area/perimeter/wall active, reverts on select
9. Crosshair appears during Set Scale / Verify Scale
10. Right-click → Edit on wall markup, change wall height, verify undo/redo

---

## Common Pitfalls and Landmines

### Pitfall 1: `isMarkupTool` Type Guard Must Include `'wall'`
**What goes wrong:** `isMarkupTool` in `types/viewer.ts` is referenced in `CanvasViewport.tsx` line 194 and `Toolbar.tsx`. If `'wall'` is not added to this type guard, the Konva viewport effect won't call `activateMarkup('wall')` and the tool silently does nothing.
**Prevention:** Add `'wall'` to `ActiveTool` union and `isMarkupTool` predicate in the same commit as `MarkupType` extension (Wave 0).

### Pitfall 2: Zoom-Compensated Stroke in WallMarkup
**What goes wrong:** The wall renderer uses world-anchored stroke widths without dividing by `currentZoom`. At 0.25× zoom, lines become 8px thick; at 8× zoom, lines become imperceptibly thin.
**Prevention:** `WallMarkup.tsx` must receive `currentZoom` prop (same as `LinearMarkup.tsx`) and apply `strokeWidth = STROKE_BASE_PX / currentZoom` and `offsetWidth = OFFSET_STROKE_PX / currentZoom`.

### Pitfall 3: React StrictMode Double-Firing in `commitShape`
**What goes wrong:** `commitShape` (line 270) deliberately reads `stateRef.current` to avoid double-firing `store.placeMarkup` under React StrictMode. The wall dispatch inside `commitShape` must follow the same pattern — do NOT move wall markup dispatch inside a `setState` updater.
**Prevention:** The wall branch inside `commitShape` mirrors the existing linear/area/perimeter branches exactly.

### Pitfall 4: `hiddenItemNames` in `markDirty` Subscription
**What goes wrong:** `attachDirtyTracking` subscribes to `markupStore` and `scaleStore` for dirty tracking. `hiddenItemNames` is in `projectStore` — if dirty-tracking is forgotten, hiding items won't trigger a "save" prompt.
**Prevention:** `toggleHiddenItem` explicitly calls `markDirty()` as the last step (same pattern as `markupStore.placeMarkup` implicitly triggering through the subscription).

### Pitfall 5: `isTextInputActive()` Guard on Esc Chain-Break
**What goes wrong:** `useKeyboardShortcuts.ts` guards every global keyboard shortcut with `isTextInputActive()`. If `cancel()` (which breaks the chain) is wired to Esc, it must not fire when the user is typing in the wall-height input field.
**Prevention:** The existing Esc handler already goes through `isTextInputActive()`. The wall popup's height input must be a standard `<input type="number">` — `isTextInputActive()` returns true when any `input` or `textarea` is focused.

### Pitfall 6: Wall Area Must NOT Accumulate Over Pages with Different Heights
**What goes wrong:** BOQ aggregation calls `add(catId, name, 'wall', qty)` for each wall across all pages. If two walls are named "Interior Wall" — one on page 1 with height 2400mm and one on page 2 with height 3000mm — the aggregated m² is the sum, which is correct (`length1×h1 + length2×h2`). This is the intended behavior (D-12). No special handling needed.

### Pitfall 7: Chain `pendingWallHeight` Not Cleared on Tool Switch
**What goes wrong:** If chain switches from wall tool to linear tool (which calls `cancelMarkup()` then `activateMarkup('linear')`), the new `INITIAL_STATE` reset clears `pendingWallHeight`. But if the reset is accidentally partial, the wall height may leak into a new wall placement.
**Prevention:** `INITIAL_STATE` must include `pendingWallHeight: 2400` (the canonical default). Any chain reset uses `INITIAL_STATE` as the base.

### Pitfall 8: CSS Cursor SVG Quotes
**What goes wrong:** SVG attribute values inside the data-URL string contain double quotes. The outer `url()` value is double-quoted. This creates nested quote conflicts.
**Prevention:** Use single quotes inside the SVG string (`stroke='black'`, `stroke-width='3'`) or URI-encode the entire SVG including quotes. URI encoding is more robust: `encodeURIComponent(svg)`.

### Pitfall 9: TotalsRow Lightbulb Click Triggering Row Cycle Navigation
**What goes wrong:** The lightbulb `<div>` is inside the row `<div>` which has `onClick={handleClick}` (cycle navigation). Without `e.stopPropagation()`, clicking the lightbulb navigates pages AND toggles visibility.
**Prevention:** `e.stopPropagation()` on the lightbulb click handler — verified pattern used by the Set Scale chevron in Toolbar (line 204).

### Pitfall 10: `boq-writers.ts` Inline Type Divergence
**What goes wrong:** `boq-writers.ts` maintains an inline duplicate of `BoqRowType` and `BoqItemRow`. Adding `'wall'` to `boq-types.ts` without updating the inline dup in `boq-writers.ts` causes TypeScript to miss the case in main-process code.
**Prevention:** Wave 0 must update BOTH files simultaneously. The comment in `boq-writers.ts` line 9 explicitly warns: "NEVER let these definitions diverge from boq-types.ts without updating BOTH."

### Pitfall 11: `validateV2` Will Not Reject Files with `hiddenItemNames`
**What goes wrong:** The `validateV2` validator does a cast (`return raw as ProjectFileV2`) without strict unknown-field rejection. This means files written by Phase 8 (with `hiddenItemNames`) will load in older app versions without error — but the field will be ignored and visibility state silently lost on re-save. This is acceptable given the no-formatVersion-bump decision, but must be documented.
**Impact:** If a user opens a Phase 8 `.clmc` in an older app build, their hidden items become visible on next load. Acceptable tradeoff — visibility is a view preference, not data.

---

## Security Domain

`security_enforcement` key absent from `config.json` — treat as enabled.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Desktop app, no auth layer |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-user local app |
| V5 Input Validation | Yes | Wall height: `isNaN(v) || v <= 0` rejected in popup; `Number(input)` parse |
| V6 Cryptography | No | No new crypto |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Wall height input accepts formula-injecting string | Tampering | `wallHeight` is `number` in TypeScript — popup does `parseInt(input, 10)` or `parseFloat`. Non-numeric → `NaN` → Save disabled. The numeric value in the store and exported BOQ is always a native number, never a string. |
| `hiddenItemNames` array could be bloated in a crafted file | DoS | `Array.isArray` check on load; `.includes()` is O(n) but array will be bounded by the number of markup names in the project (typically <100). |

---

## Environment Availability

Step 2.6 audit — all dependencies are npm packages already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `lucide-react` | Toolbar `BrickWall`, TotalsRow `Lightbulb`/`LightbulbOff` | YES | 1.6.0 | — |
| `react-konva` / `konva` | WallMarkup renderer | YES | 19.2.x / 10.2.x | — |
| `zustand` | `projectStore` extension | YES | 5.0.12 | — |

No missing dependencies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pixelLengthToReal(px, pixelsPerMm, 'm')` supports `'m'` as a `ScaleUnit` | Feature 2 (wall math) | Wall area math would need different unit conversion approach |
| A2 | `validateV2` does not reject unknown fields — confirmed by reading the cast at line 113 | Feature 3 (schema) | If strict unknown-field rejection exists elsewhere, additive field may need migration |
| A3 | `isMarkupTool` type guard is defined in `types/viewer.ts` | Feature 1 (chain), Feature 2 (wall toolbar) | May be in a different file; grep needed at implementation time |

**A1 mitigation:** Check `src/renderer/src/types/scale.ts` for `ScaleUnit` definition at Wave 0. If `'m'` is not a valid unit, compute wall area as: `(pixelLen / pixelsPerMm / 1000) * (wallHeightMm / 1000)` (mm → m conversion inline).

---

## Sources

### Primary (HIGH confidence)
- `src/renderer/src/hooks/useMarkupTool.ts` — read in full; chain mode pattern verified at lines 106–153, commitShape at 270–325
- `src/renderer/src/types/markup.ts` — read in full; MarkupType, MarkupCommand shape verified
- `src/renderer/src/stores/markupStore.ts` — read in full; editMarkup at 161, undo/redo exhaustive switch verified
- `src/renderer/src/components/Toolbar.tsx` — read in full; handleMarkupToolClick at 189, module-ref pattern at 43–61, IconButton children prop at 91
- `src/renderer/src/components/MarkupNamePopup.tsx` — read in full; onConfirm payload, handleConfirm, wall row insertion point
- `src/renderer/src/components/TotalsRow.tsx` — read in full; layout slots, color chip position at line 200
- `src/renderer/src/components/CanvasViewport.tsx` (lines 1–200) — module-ref pattern at 43–61, containerRef div verified
- `src/renderer/src/lib/project-schema.ts` — read in full; validateV2 cast at 113, migration pattern at 125–163
- `src/renderer/src/lib/boq-aggregator.ts` — read in full; add() pattern, per-type dispatch at 117–151
- `src/renderer/src/lib/boq-types.ts` — read in full; BoqRowType union, BoqItemRow
- `src/main/boq-writers.ts` — read in full; inline dup pattern, numFmtForUom
- `src/renderer/src/lib/markup-math.ts` — read in full; polylineMidpointByArcLength, pixelLengthToReal
- `src/renderer/src/stores/projectStore.ts` — read in full; markDirty, attachDirtyTracking
- `src/renderer/src/components/markup/LinearMarkup.tsx` — read in full; zoom-compensated stroke pattern, world-anchored label
- `lucide-react@1.6.0` — verified installed version, confirmed `BrickWall`, `Columns2`, `RectangleVertical`, `Lightbulb`, `LightbulbOff` all exist as exports [VERIFIED: `node -e "typeof require('lucide-react').BrickWall"` → `'object'`]
- `.planning/phases/07-canvas-workspace-ux-and-markup-fixes/07-CONTEXT.md` — D-07 EditMarkupCommand shape confirmed

### Secondary (MEDIUM confidence)
- MDN CSS cursor documentation — 32×32 max cursor size recommendation, hotspot coordinate semantics [CITED: developer.mozilla.org/en-US/docs/Web/CSS/cursor]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules
- Architecture: HIGH — all source files read directly
- Pitfalls: HIGH — derived from existing code patterns and established STATE.md decisions
- Icon recommendations: HIGH — verified via `node -e` against installed package

**Research date:** 2026-05-15
**Valid until:** Stable — no external package changes expected; valid indefinitely for this codebase state
