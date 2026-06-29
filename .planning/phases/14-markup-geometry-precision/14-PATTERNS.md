# Phase 14: Markup Geometry Precision - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 11 (new + modified)
**Analogs found:** 10 / 11 (1 NEW with no analog — the spatial index)

> Scope reminder: this phase is **on-canvas Konva vector graphics** (transient overlay glyphs + an interactive bulge handle) plus two tiny HTML chrome surfaces, NOT a new screen. The load-bearing reuse rules are: **zoom-compensate every stroke/radius (`÷ currentZoom`)**, **transient overlays `listening={false}` / interactive handles `listening={true}` with a larger hit area**, **always convert pointer → page-space via `stage.getAbsoluteTransform().copy().invert().point(pointer)`**, and **route every edit through the existing `MarkupCommand` undo machinery**. Concrete analogs and excerpts below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/components/markup/SnapIndicator.tsx` (NEW) | component (Konva overlay) | event-driven (per-mousemove transient) | `src/renderer/src/components/HoverRing.tsx` + `markup/VertexHandleOverlay.tsx` | exact (role + zoom-compensation idiom) |
| `src/renderer/src/components/markup/BulgeHandle.tsx` (NEW) | component (Konva interactive handle) | event-driven (drag) | `src/renderer/src/components/markup/VertexHandleOverlay.tsx` | exact (interactive handle, hit>visual) |
| `src/renderer/src/components/markup/ArcPreview.tsx` (NEW) | component (Konva overlay) | event-driven (per-mousemove preview) | `CanvasViewport.tsx` Layer 1a dashed preview (lines 1556–1596) | role-match |
| `src/renderer/src/lib/snapping-engine.ts` (NEW) | utility (spatial index) | transform (point query) | **NONE** — see § No Analog Found | none |
| `src/renderer/src/lib/arc-math.ts` (NEW) | utility | transform (geometry solve) | `src/renderer/src/lib/markup-math.ts` | role-match (sibling pure-math module) |
| `src/renderer/src/lib/self-intersection.ts` (NEW) | utility | transform (geometry guard) | `src/renderer/src/lib/markup-math.ts` (`polygonArea` shoelace loop) | role-match |
| `src/renderer/src/lib/markup-math.ts` (MODIFIED) | utility | transform | itself (`polylineLength`/`polygonArea`) | exact (in-place extension) |
| `src/renderer/src/types/markup.ts` (MODIFIED) | model | — | itself (discriminated union + `MarkupCommand`) | exact (additive field + new commands) |
| `src/renderer/src/components/CanvasViewport.tsx` (MODIFIED) | component (controller) | event-driven (pointer pipeline) | itself (`handleStageMouseMove` ~1125, `handleStageMouseUp` ~1196) | exact (integration point) |
| `src/renderer/src/components/StatusBar.tsx` (MODIFIED) | component (HTML chrome) | request-response (store read) | itself (Scale segment + `Divider`) | exact (append a segment) |
| `src/renderer/src/components/BlockedCommitMessage.tsx` (NEW) | component (HTML chrome) | event-driven (parent-owned lifecycle) | `src/renderer/src/components/ConfirmationToast.tsx` | exact (parent-owned, no setTimeout) |

---

## Pattern Assignments

### `SnapIndicator.tsx` — snap glyph □/△ (component, transient overlay)

**Analogs:** `HoverRing.tsx` (zoom-compensation + `listening={false}`), `markup/VertexHandleOverlay.tsx` (Konva primitive + screen-px constants).

**Zoom-compensation idiom** — copy verbatim (`HoverRing.tsx` lines 13, 61–62):
```typescript
const STROKE_BASE_PX = 2 // → 2 / currentZoom on screen
// ...
const stroke = STROKE_BASE_PX / currentZoom
const offset = RING_OFFSET_PX / currentZoom
```
Glyph sizes per UI-SPEC: square 12px (`12/zoom`), triangle 14px circum-diameter (`14/zoom`), stroke `2/zoom`, halo stroke `3.5/zoom`.

**`listening={false}` rule** — every transient overlay shape is non-listening so it never steals pointer events (`HoverRing.tsx` lines 41–54 doc + every `<Circle>/<Line listening={false}>`). The snap glyph is pure presentation; mirror this exactly. Regression-guarded by `highlight-overlay-listening.test.ts`.

**Konva primitive + screen-px constant pattern** (`VertexHandleOverlay.tsx` lines 27–50): declare screen-px constants at module top, divide by `currentZoom` at the top of the component body, then render. For the □ use `Rect`, for △ use `RegularPolygon sides={3}`.

**Two-pass halo** — draw each glyph twice (wider halo copy first, accent copy on top). The technique is the crosshair cursor's "black outline + white foreground" double-stroke (`CanvasViewport.tsx` `CROSSHAIR_CURSOR`, lines 170–183 — eight black-then-white line pairs). Halo color comes from `getContrastingInk()` (see Shared Patterns → Contrast).

---

### `BulgeHandle.tsx` — arc reshape handle (component, interactive)

**Analog:** `markup/VertexHandleOverlay.tsx` — this is the ONLY interactive (`listening={true}`) handle pattern in the codebase. Copy it and change the shape to `Circle`.

**Interactive-handle contract** (`VertexHandleOverlay.tsx` lines 60–81):
```typescript
<Rect
  name={`handle-${i}`}                 // → name the bulge handle so handleStageMouseDown can disambiguate
  x={p.x - handleSize / 2}
  ...
  hitWidth={hitSize}                   // hit area LARGER than visual (16px hit / 8px visual)
  hitHeight={hitSize}
  // CRITICAL: handles MUST be listening=true — unlike HoverRing/PulseHighlight
  listening={true}
  onMouseDown={(e) => {
    e.cancelBubble = true               // stop Stage onMouseDown also firing (rubber-band/body drag)
    onHandleMouseDown?.(i)
  }}
/>
```
Load-bearing rules to carry over: (1) `listening={true}`; (2) `hitWidth/hitHeight` larger than visual (UI-SPEC: 18px hit for a 9px visual); (3) `e.cancelBubble = true` in `onMouseDown` so the Stage handler does not start a body/rubber-band drag; (4) a `name` prefix (`handle-` analog → e.g. `bulge-`) so `handleStageMouseDown` in CanvasViewport reads `e.target.name()?.startsWith(...)` to route the drag. Resting fill accent `#0078d4`, stroke `1.5/zoom` white (matches `VertexHandleOverlay` 1.5px stroke convention).

---

### `ArcPreview.tsx` — live solved-arc dashed preview (component, transient)

**Analog:** in-progress dashed segment preview in `CanvasViewport.tsx` Layer 1a (lines 1556–1596).

**Dashed preview convention** (`CanvasViewport.tsx` lines 1367–1370 + 1556–1596):
```typescript
const LINE_STROKE_WIDTH = 2 / currentZoom
const LINE_DASH = [8 / currentZoom, 4 / currentZoom]
// ... rendered on Layer 1a (listening={false}) in the markup's pending color
```
Render the solved arc as a Konva `Arc` (or `Line` sampled along the circle), dashed, `listening={false}`, in the markup's pending color (`COLORS.accent` during draw). Re-solve every mousemove via the spike-003 `solveCircle` (in the new `arc-math.ts`).

---

### `arc-math.ts` — 3-point circle solver + arc length (utility)

**Analog:** `src/renderer/src/lib/markup-math.ts` — sibling pure-function math module: takes `StagePoint[]` in page-space, returns numbers, no React/Konva imports, validates with `throw new Error(...)` (`markup-math.ts` lines 39–43).

**Reference design (NOT a codebase analog — implement from spike):** `.planning/spikes/003-arc-segment-measure/README.md` (`solveCircle` via perpendicular-bisector determinant `d = 2·signedArea(p1,p2,p3)`; collinear fallback to chord when `d→0`; CCW-sweep major/minor disambiguation; length `R·sweep`; accurate ~1e-10). Keep page-space pixels exactly like `polylineLength` so mm conversion is unchanged.

**Data-model note:** the solver consumes the on-arc midpoint that the new optional arc field carries (see `types/markup.ts` below).

---

### `self-intersection.ts` — commit guard (utility)

**Analog:** `markup-math.ts` `polygonArea` shoelace loop (lines 16–26) — same "loop the closed point ring, pairwise edge work" shape.

**Reference design:** spike-003b note (`.planning/spikes/003b-curved-polygon-area/README.md` lines 100–103) — "a huge INWARD bulge can dip past the opposite edge and self-intersect, which breaks the simple-polygon assumption … add a validation guard at markup time." Implement classic O(n²) segment-pair crossing test over the closed boundary; return the offending segment indices so D-09 can highlight them red. Pure function over `StagePoint[]`, no React.

---

### `markup-math.ts` (MODIFIED) — make `polylineLength` / `polygonArea` arc-aware

**Analog:** the file itself.

**Existing straight-only `polygonArea`** (lines 16–26) — the loop the arc correction hooks into:
```typescript
export function polygonArea(points: StagePoint[]): number {
  if (points.length < 3) return 0
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}
```
**Arc correction (spike-003b, load-bearing sign rule):** accumulate doubled signed shoelace `2·S`, then per arc edge subtract `sign(cross)·2·segMag` where `cross = (to−from)×(mid−from)`, `segMag = (R²/2)·(θ − sinθ)`; take `abs` at the very end → winding-independent. **OUTWARD ⟺ sign(cross) ≠ sign(2·S)**. `polylineLength` (lines 7–14) similarly adds `arcLength(from, mid, to)` per arc edge instead of the straight chord. Both fall back to the existing straight math when an edge has no arc midpoint.

> NOTE: do NOT break the existing pure-shoelace signature — keep `polygonArea(points)` working for straight markups; thread the optional per-edge arc metadata as a second optional arg so save-load and the BOQ aggregator that call it today keep compiling.

---

### `types/markup.ts` (MODIFIED) — arc metadata + edit commands (model)

**Analog:** the file itself — the `Markup` discriminated union (lines 5–43) and the `MarkupCommand` union (lines 52–112).

**Additive field pattern** (mirror `WallMarkup.wallHeight` lines 36–41 and the Phase-8 `hiddenItemNames?` additive precedent in `project-schema.ts` line 87): add an **optional** per-segment arc map to `LinearMarkup`/`AreaMarkup`/`PerimeterMarkup`/`WallMarkup`, e.g.
```typescript
/** Optional per-edge arc metadata, keyed by segment start-vertex index.
 *  Absent → straight edge. Additive: pre-Phase-14 files omit it and load as all-straight. */
arcs?: Record<number, { midX: number; midY: number }>
```
Because it is optional, `formatVersion` stays at 2 and `validateV2` / `migrate` (`project-schema.ts` lines 92–119, 155–168) need no version bump — old `.clmc` files load as all-straight (same strategy `hiddenItemNames?` used).

**New `MarkupCommand` variants** — extend the union (lines 52–112) following the existing `move-vertex` shape (lines 79–87): add e.g. `reshape-arc` (oldArcs/newArcs) and reuse `move-vertex` for endpoint re-solve where possible. Every variant carries enough old+new state for a symmetric undo/redo.

---

### `CanvasViewport.tsx` (MODIFIED) — pointer pipeline integration (controller)

**Analog:** the file itself. Three precise hook points:

**1. Snap injection — `handleStageMouseMove`** (lines 1125–1188). Every branch already converts pointer → page-space identically:
```typescript
const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
```
Insert snapping here: take `pt`, query the spatial index, and if a candidate is within tolerance override `pt` with the snapped page-point before it flows into `updateMarkupPreview` / `setDragPreview`. The same override applies in the vertex-drag branch (lines 1138–1155) and body-drag branch (lines 1159–1170) per D-07 (edit-time snapping). Tolerance is zoom-compensated: `pageTol = 12 / currentZoom` (spike-002).

**2. Commit-time self-intersection guard — `handleStageMouseUp`** (lines 1196–1318) and the polygon finish path (`finishPolygon`, wired at lines 775/969). Before committing an area/perimeter, run `self-intersection.ts`; if it crosses, **block the commit, keep edit mode, surface `BlockedCommitMessage`** (D-09). Mirror the existing no-op / threshold guards already in this handler.

**3. Click-vs-drag threshold (reuse, do not reinvent)** (lines 1212–1214):
```typescript
const liveZoom = useViewerStore.getState().pageViewports[currentPage]?.zoom ?? 1
const dragThreshold = 4 / liveZoom   // page-space 4px threshold
```
The bulge-handle drag must use this same `4/zoom` page-space threshold for click-vs-drag, and read `currentZoom` via `getState()` to keep the callback dep list narrow (the established anti-stale-closure pattern).

**4. Arc-mode + snap keybindings** — extend `useKeyboardShortcuts.ts` (the central `keydown` switch, lines 56–233). **[OPEN]** keys (`A` arc hold, `Alt` snap-suspend, `F3` snap-toggle) MUST be reconciled against the existing bindings here to avoid collision. Confirmed in-use already: `Ctrl+O/S/Z/Y/A`, `Delete`, `Ctrl+=/-/0`, arrows/PageUp/PageDown. **`A` (bare) and `F3` are currently free**; `Ctrl+A` is taken (select-all) — a bare-`A` arc hold-key does not collide. Guard new keys with `isTextInputActive()` (lines 27–42) exactly as every existing shortcut does.

**5. Arc-mode cursor** — extend `getCursor()` (lines 1344–1356) and the two-pass `CROSSHAIR_CURSOR` SVG (lines 170–183) with an arc-tick variant. Acceptable degradation (UI-SPEC Open Q2): pill chip only.

---

### `StatusBar.tsx` (MODIFIED) — snap/arc status pill (HTML chrome)

**Analog:** the file itself — the Scale segment (lines 83–86) and `Divider` (lines 6–18).

**Append-a-segment pattern** (lines 69–87): add a new `<Divider />` then a `<span aria-live="polite">` after the Scale segment. Reuse the existing chrome verbatim: 13px/400, `#cccccc` text, `#3c3c3c` divider, `0 16px` padding, `aria-live="polite"`. State colors come from `COLORS` (`constants.ts` lines 10–24): ON dot `COLORS.accent`, OFF text `COLORS.warning` (`#e8a838` — the same amber the Scale "Not Set" state uses, lines 35–36), held-off `COLORS.textSecondary`. Arc chip: `COLORS.accent` background, `#ffffff` text.

---

### `BlockedCommitMessage.tsx` (NEW) — self-intersection block message (HTML chrome)

**Analog:** `src/renderer/src/components/ConfirmationToast.tsx` — exact pattern match (parent-owned lifecycle, no internal timer).

**Parent-owned-lifecycle contract** (`ConfirmationToast.tsx` lines 9–15, 31–53):
```typescript
// Pure presentational component — NO auto-dismiss timer (setTimeout removed).
// Persistence is owned by the parent (CanvasViewport): dismissed on ... explicit user action.
<div role="status" aria-live="polite" style={{ position: 'absolute', ...
  background: COLORS.secondary, border: `1px solid ${COLORS.border}`,
  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontSize: 13, fontWeight: 400 }}>
```
Copy from UI-SPEC: lead word **"Can't finish —"** (red `#dc2626`, weight 600) + body. NO `setTimeout` — CanvasViewport clears it when the crossing is resolved and the user re-commits, or on cancel. Anchor near the offending markup centroid (UI-SPEC; mirrors `finishPolygon` centroid+20px popup positioning).

---

## Shared Patterns

### Zoom compensation (every glyph/handle)
**Source:** `HoverRing.tsx` lines 13/61–62, `VertexHandleOverlay.tsx` lines 27–50, `CanvasViewport.tsx` lines 1367–1370.
**Apply to:** SnapIndicator, BulgeHandle, ArcPreview, and every new Konva node.
```typescript
const SOME_PX = 12               // declare as a screen-pixel constant
const value = SOME_PX / currentZoom   // divide at render so on-screen size is constant at any zoom
```

### Listening discipline
**Source:** `HoverRing.tsx` lines 41–54 (`listening={false}`); `VertexHandleOverlay.tsx` lines 72–78 (`listening={true}` + larger hit + `e.cancelBubble`).
**Apply to:** transient overlays (snap glyph, arc preview, crossing highlight) → `listening={false}`. Interactive bulge handle → `listening={true}` with `hitWidth/hitHeight` > visual and `e.cancelBubble = true`.

### Pointer → page-space conversion
**Source:** `CanvasViewport.tsx` (every handler, e.g. lines 1079, 1114, 1139, 1161, 1174, 1220, 1269).
**Apply to:** all snapping math, arc solving, self-intersection. NEVER use raw pointer coords.
```typescript
const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
```

### Contrast / halo color
**Source:** `src/renderer/src/lib/color-utils.ts` `getContrastingInk()` (lines 40–42), threshold `CONTRAST_LUMINANCE_THRESHOLD = 0.179` (line 10).
**Apply to:** snap-glyph halo color (per-frame against the underlying markup color). Do NOT invent a second contrast function.
```typescript
export function getContrastingInk(fillHex: string): '#000000' | '#ffffff' {
  return relativeLuminance(fillHex) > CONTRAST_LUMINANCE_THRESHOLD ? '#000000' : '#ffffff'
}
```

### Palette / accent colors (no new hexes)
**Source:** `constants.ts COLORS` (lines 10–24), `markup-palette.ts MARKUP_PALETTE` (lines 13–24).
**Apply to:** accent glyph/handle `COLORS.accent #0078d4`; problem red `MARKUP_PALETTE[0] #dc2626`; warning amber `COLORS.warning #e8a838`. Introduce no new hexes (UI-SPEC Reuse Checklist).

### Command-pattern undo dispatch
**Source:** `markupStore.ts` `moveVertex` (lines 265–298), `pushCommand` cap (lines 100–103), and the symmetric undo/redo branches (`move-vertex` at lines 441, 571). `MarkupCommand` union in `types/markup.ts` lines 52–112.
**Apply to:** all arc/vertex edits (D-08). Build a `MarkupCommand`, apply it via `set(...)`, `pushCommand(s.undoStack, cmd)`, `redoStack: []`. The ONE dispatch happens once per drag session in `handleStageMouseUp` (not inside cleanup helpers) — mirror the `move-vertex` discipline. Never bypass the store / undo stack.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/renderer/src/lib/snapping-engine.ts` | utility (spatial index) | transform (point query) | No spatial-index or grid-hash exists anywhere in the codebase. **Implement from the validated spike design, not a forced analog:** `.planning/spikes/002-snapping-engine/README.md` — uniform grid-hash, `cell = zoom-compensated tolerance` (`screenTolPx/zoom`, ~12 page units), scan the 3×3 vertex neighbourhood / single cell for bbox-padded segments, full rebuild on geometry change (<120ms at 50k). Vertex query 2–15µs at N=1k–50k. Intersection snap is DEFERRED (O(k²), spike flagged). Its pure-math sibling (no React/Konva) places it next to `markup-math.ts`. |

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/components/markup/`, `src/renderer/src/lib/`, `src/renderer/src/types/`, `src/renderer/src/stores/`, `src/renderer/src/hooks/`, `.planning/spikes/002`, `/003`, `/003b`.
**Files scanned:** ~18 read in full or targeted-range; ~6 component/lib globs enumerated.
**Pattern extraction date:** 2026-06-29
