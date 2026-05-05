# Phase 6: Live View and UI Polish — Research

**Researched:** 2026-05-05
**Domain:** React 19 chrome (panels + splitters + transient Konva overlays + offscreen-canvas thumbnail rasterization) over an existing Electron 35 desktop shell
**Confidence:** HIGH (every load-bearing claim is `[VERIFIED: in-repo file]`; only the localStorage hook shape and a Konva-Tween-vs-rAF call are documented as `[ASSUMED]` with low risk)

---

## Summary

Phase 6 ships **three additive HTML chrome surfaces** (`TotalsPanel`, `ThumbnailStrip`, `CanvasHeaderBar`) in the existing inline-style + `COLORS`-token convention, plus **two transient Konva overlays** (`PulseHighlight`, `HoverRing`) on Layer 2, plus a small `useUiPanels()` localStorage-backed hook and a `Splitter` primitive. Every locked decision in `06-CONTEXT.md` and `06-UI-SPEC.md` is implementable with libraries already on disk — `lucide-react`, `react-konva`, `zustand`, `pdfjs-dist`. **Zero new dependencies are required.** [VERIFIED: package.json]

The `boq-aggregator.ts` function is a pure synchronous derive over four Zustand stores, parameterizable via `AggregateOptions` for tests. The TotalsPanel becomes a **second consumer** of this same function; the cleanest pattern is a thin `useBoqLive()` hook that subscribes to the eight primitives the aggregator depends on (via existing `subscribeWithSelector` middleware on `markupStore`, `scaleStore`, `viewerStore`, plus a single primitive on `projectStore`) and returns a memoized `BoqStructure`. **Live view = export view, exactly** — same function, same shape, no divergence. [VERIFIED: src/renderer/src/lib/boq-aggregator.ts:80-251, src/renderer/src/hooks/useExport.ts:79]

Thumbnail rasterization has a clean, low-risk path: reuse `pdfDocument.getPage(n).render()` at low DPI (~48 dpi baseline in CONTEXT-authorized 36-60 envelope), draw to a per-tile offscreen `<canvas>`, and overlay markup geometry using **the raw 2D Canvas API** (NOT a per-tile Konva Stage — heavyweight, creates layer hit-test trees per tile). Lazy loading via `IntersectionObserver` is sufficient for v1 (50+ pages); `react-virtuoso` is **not required** and CONTEXT correctly flags it as deferrable. [VERIFIED: src/renderer/src/hooks/usePdfRenderer.ts:36-60; CONTEXT D-17]

Transient Konva overlays mirror the existing `MarkupTooltip` / `ConfirmationToast` parent-owned-lifecycle pattern: `CanvasViewport` owns the timer/state; the visual components are pure presentational with `listening={false}` so they cannot steal hover events from the markup Group below. Konva's built-in `Tween` (`konvajs.org/api/Konva.Tween.html`) is well-suited for the 1500ms pulse fade-out, but a `requestAnimationFrame` loop driven from `useEffect` with `useState` is equally viable and follows the codebase's existing idiom for transient state — recommend `requestAnimationFrame` to keep ownership inside React. [VERIFIED: src/renderer/src/components/CanvasViewport.tsx:534-705 layer structure; CITED: konvajs.org/docs/react/Simple_Animations.html]

**Primary recommendation:** Build `useBoqLive()` (memoized `aggregateBoq()` over 8 primitive subscriptions) → render `TotalsPanel` directly from its return; build `useUiPanels()` (single `clmc.ui` localStorage object, try/catch parse, defaults on failure) → drive `App.tsx`'s new three-column flex shell; build `PulseHighlight` and `HoverRing` as pure presentational Konva components on Layer 2 with `listening={false}`, lifecycle owned by `CanvasViewport` via a `useMarkupHighlight()` hook; build `ThumbnailStrip` with raw 2D Canvas API for the markup overlay (NOT per-tile Konva Stage) and `IntersectionObserver` lazy mounting; reuse `getCalibrationControls()?.activate()` from the existing module-level ref for the CanvasHeaderBar Set Scale link.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live BOQ aggregation | Renderer (pure function) | — | `aggregateBoq()` is already a pure function over Zustand state; no IPC, no async [VERIFIED: boq-aggregator.ts:80] |
| Panel UI chrome (Totals, Thumbnails, HeaderBar) | Renderer (React HTML) | — | Established pattern: inline-style + COLORS [VERIFIED: StatusBar.tsx, Toolbar.tsx] |
| Transient canvas overlays (PulseHighlight, HoverRing) | Renderer (Konva Layer 2) | — | Mirrors existing transient-overlay pattern [VERIFIED: CanvasViewport.tsx:707-763] |
| Thumbnail page raster | Renderer (PDF.js worker → offscreen canvas) | — | PDF.js worker is already wired in renderer [VERIFIED: pdf-setup.ts] |
| Thumbnail markup overlay rendering | Renderer (raw 2D canvas API) | — | Per-tile Konva Stage would multiply hit-test trees; not needed since thumbnails have no Konva interaction |
| UI panel state persistence (widths, open/closed, collapsed categories) | Renderer (localStorage) | — | CONTEXT D-03 explicitly excludes per-machine UI state from `.clmc` |
| Page navigation (row-click / thumbnail-click → setPage) | Renderer (Zustand setPage) | — | Existing API [VERIFIED: viewerStore.ts:28] |
| Set Scale activation from CanvasHeaderBar | Renderer (module-level ref) | — | Mirrors Toolbar's `getCalibrationControls()?.activate()` path [VERIFIED: Toolbar.tsx:173-181, CanvasViewport.tsx:340-349] |
| Clipboard write ("Copy as text") | Renderer (`navigator.clipboard.writeText`) | — | Standard browser API, available in Electron renderer |

**Sanity check:** No Phase 6 capability requires the main process. No new IPC endpoints. No new Zustand stores. The phase is entirely a renderer-tier UI overlay on top of complete data infrastructure.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three-column shell — ThumbnailStrip (left), CanvasViewport (center), TotalsPanel (right). Vertical: TitleBar → Toolbar → (Strip | (CanvasHeaderBar + Canvas) | Totals) → StatusBar.
- **D-02:** Both panels open by default; restored from localStorage thereafter.
- **D-03:** Drag-resize inner edge + collapse-to-rail outer chevron; widths and open/closed state in localStorage `clmc.ui.*`, NOT in `.clmc` files.
- **D-04 / D-05:** TotalsPanel reuses `boq-aggregator.ts` `BoqStructure` verbatim — ONE aggregator, ONE shape, ZERO divergence between live view and export.
- **D-06:** Item color via `getColorForName(name)` on Item-name cell only — small ~10×10px chip. Never on category headings, subtotal rows, grand-total bar.
- **D-07:** Uncalibrated-page handling identical to BOQ export D-06 — counts contribute, length/area/perimeter silently excluded; CanvasHeaderBar carries the nudge, panel is silent.
- **D-08:** Project metadata header mirrors BOQ export D-09 (Project / Plan / Pages / Markups / current Page).
- **D-09:** Three contextual empty-state copy variants (no PDF / zero markups / non-count-only-on-uncalibrated).
- **D-10:** Click row → cycle through pages with matches; subsequent clicks advance, wrap. Cycle index transient (not persisted).
- **D-11:** Hover row → faint white HoverRing on current page only, ~40% opacity, 2/zoom stroke.
- **D-12:** Click pulse — PulseHighlight, ~1500ms fade, per-name color, 6/zoom → 2/zoom stroke deflate, ease-out 0.85 → 0 opacity.
- **D-13:** Category-heading click toggles collapse/expand; persisted to localStorage `collapsedCategories`.
- **D-14:** Right-click row → "Copy as text" → tab-separated `{label}\t{quantity}\t{uom}` with rounded values; ConfirmationToast on success.
- **D-15:** Each thumbnail = rasterized page + live markup overlay.
- **D-16:** Per-thumbnail badges: page label, markup count chip (top-right), scale-status icon (top-left, Ruler / AlertTriangle), 2px accent active-page outline.
- **D-17:** IntersectionObserver-based lazy/virtualized rendering. `react-virtuoso` optional, planner's call.
- **D-18:** ~140px default thumbnail width.
- **D-19:** 200ms debounced thumbnail overlay refresh on markup commit.
- **D-20:** CanvasHeaderBar — slim 28px strip above CanvasViewport. Page label (left), scale status (right), inline `Set Scale` link when uncalibrated-with-non-count.
- **Conventions (from UI-SPEC):** Inline-style + COLORS tokens; no Tailwind in chrome. Parent-owned-lifecycle for transient UI. Layer 2 (transient, `listening={false}`) for PulseHighlight + HoverRing. Zoom-compensated stroke widths (divide by `currentZoom`). 2 font weights total: 400 + 600. No new font sizes outside 12/13/16. Inter font, system fallback.

### Claude's Discretion

- Pulse final geometry, color, opacity curve, easing, exact duration target (~1.5s).
- Hover highlight visual (white + 40% opacity locked in UI-SPEC; remaining tuning is Claude's).
- Slim-rail width (UI-SPEC locked at 28px).
- Splitter handle styling (UI-SPEC locked at 4px hit area, 1px visible line, accent on press).
- localStorage key naming under `clmc.ui` namespace (UI-SPEC locked the schema shape).
- Aggregator subscription strategy — recommend memoized derive; profile only if 200+ markups drop frames.
- Cycle-index state for D-10 — local `useRef` / `useState`; resets on category-collapse or row-leave.
- Thumbnail page-label resolution — try `pdfDocument.getPageLabels()` first, fallback `Page N`.
- Empty-state copy final wording (UI-SPEC locked all three).
- Splitter / collapse animation duration (UI-SPEC locked 150ms ease-out).
- Right-click "Copy as text" payload format (UI-SPEC locked `{label}\t{quantity}\t{uom}`, integer for count, 2dp for length/area).
- CanvasHeaderBar Set Scale wiring — must call `getCalibrationControls()?.activate()`, NOT duplicate calibration trigger code.
- Thumbnail rasterization DPI — 36-60 envelope; recommend 48 dpi baseline.
- Toggle keyboard shortcuts — UI-SPEC locked **none** for v1.

### Deferred Ideas (OUT OF SCOPE)

- Toggle visibility of markup categories on/off (v2 PROD-02).
- Search / filter / sort inside TotalsPanel.
- Per-thumbnail right-click context menu (rename page, hide page, lock page).
- Custom precision / rounding controls in TotalsPanel.
- Drag-to-reorder thumbnails.
- Multi-window / floating panels.
- Keyboard shortcuts to toggle panels.
- Live "Open Export" button on the panel.
- Pin-to-page / lock-to-page thumbnail behavior.
- Per-page subtotal breakdown.
- AI-assisted item recognition.
- CanvasHeaderBar additional info (zoom %, undo state, dirty indicator).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | User can see a running totals panel that shows live quantities for all markups, grouped by category, updating as they work | §2 Aggregator Reuse — `useBoqLive()` memoized derive over `aggregateBoq()`; §6 Three-Column Shell wraps TotalsPanel in flex row right column |
| PDF-05 | User can navigate pages via a thumbnail strip sidebar | §4 Thumbnail Rasterization Pipeline — per-page offscreen canvas + IntersectionObserver lazy mount + raw 2D markup overlay + 200ms debounced refresh |

---

## 2. Aggregator Reuse & Subscription Strategy

### Function signature [VERIFIED: src/renderer/src/lib/boq-aggregator.ts:80]

```typescript
export function aggregateBoq(opts: AggregateOptions = {}): BoqStructure
```

`AggregateOptions` is a pure-function override interface — production callers pass nothing; defaults read from the four Zustand stores via `getState()`. Tests inject deterministic fixtures. This is the SAME function the BOQ export already uses (Phase 5, `useExport.ts:79`).

### Inputs the aggregator reads [VERIFIED: boq-aggregator.ts:81-89, 229-231]

| Input | Source | Phase 6 Subscription Slice |
|-------|--------|----------------------------|
| `pageMarkups` | `useMarkupStore` | `s.pageMarkups` (Record<number, Markup[]>) |
| `categoriesById` | `useMarkupStore` | `s.categories` |
| `categoryOrder` | `useMarkupStore` | `s.categoryOrder` (string[]) |
| `getColorForName` | `useMarkupStore` | the method itself (stable function ref) |
| `pageScales` | `useScaleStore` | `s.pageScales` |
| `globalUnit` | `useScaleStore` | `s.globalUnit` |
| `totalPages` | `useViewerStore` | `s.totalPages` |
| `currentFilePath` | `useProjectStore` | `s.currentFilePath` |
| `pdfOriginalFilename` | `useViewerStore` | `s.fileName` |

### Output shape [VERIFIED: src/renderer/src/lib/boq-types.ts:5-72]

```typescript
interface BoqStructure {
  metadata: {
    projectName: string         // basename(currentFilePath ?? fileName), ext stripped
    planFilename: string         // viewerStore.fileName ?? 'plan.pdf'
    exportedDate: string         // YYYY-MM-DD (recomputed every aggregator call)
    totalPages: number
    totalMarkups: number         // sum across all pageMarkups, all states
  }
  categories: Array<{
    name: string                 // '(Uncategorized)' for null categoryId
    items: Array<{
      label: string              // post-suffix per D-02 ('Outlet', 'Outlet (count)', 'Wall (perimeter)')
      quantity: number           // native number, full precision
      uom: string                // 'ea' | globalUnit | globalUnit + '²'
      color: string | null       // '#RRGGBB' or null — read from getColorForName(name)
      type: 'count'|'linear'|'area'|'perimeter-length'|'perimeter-area'
    }>
    subtotals: Array<{ uom: string; total: number }>   // one per distinct UoM in category
  }>
  grandTotals: Array<{ uom: string; total: number }>   // one per distinct UoM project-wide
}
```

**Critical rendering rules embedded in aggregator output:**

- Items are **already alphabetically sorted by post-suffix label** [VERIFIED: boq-aggregator.ts:204] — TotalsPanel does NOT re-sort.
- Empty categories are **already excluded** [VERIFIED: boq-aggregator.ts:155-158] — TotalsPanel renders every entry in `categories[]` unconditionally.
- Per-name color is **already resolved per item** via `item.color`, NOT looked up at render time [VERIFIED: boq-aggregator.ts:108-110]. TotalsRow's color chip reads `item.color`, not a fresh `getColorForName(name)` call. This is the load-bearing invariant: the aggregator's output is "ready to print," and TotalsRow is a dumb renderer.
- Perimeter markups synthesize TWO virtual rows per shape: `perimeter-length` and `perimeter-area` [VERIFIED: boq-aggregator.ts:140-149]. Both appear in `items[]` with the same `name` but different `label`, `uom`, and `type`. The row-click navigation matcher (D-10) must match by `(name, type)` where `type` is the underlying markup type — i.e., when the user clicks a row with `type: 'perimeter-length'` OR `type: 'perimeter-area'`, the matched markup type is `'perimeter'`. Document explicitly in Plan-time work.

### Current `useExport` consumer pattern [VERIFIED: src/renderer/src/hooks/useExport.ts:79]

`useExport` calls `aggregateBoq()` exactly once **inside** an event handler (Export click), captures the `BoqStructure` into a local variable, hands it to either the IPC writeBoqXlsx / writeBoqCsv, or stashes it in App-level state for the uncalibrated-confirmation modal flow. **No reactive subscription** — it's a one-shot snapshot at click time.

For Phase 6, TotalsPanel needs a **continuous reactive** subscription. The cleanest pattern, consistent with the codebase's idioms:

### Recommended subscription strategy

```typescript
// src/renderer/src/hooks/useBoqLive.ts (NEW)
import { useMemo } from 'react'
import { aggregateBoq } from '../lib/boq-aggregator'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import type { BoqStructure } from '../lib/boq-types'

export function useBoqLive(): BoqStructure {
  // Subscribe to the 8 primitives the aggregator reads. Each is a top-level
  // Zustand selector — Object.is equality already correct because none of
  // these ever mutates in place (markupStore returns new pageMarkups objects
  // on every set; scaleStore likewise). No EMPTY_MARKUPS-style fallback needed
  // because the aggregator handles `pageMarkups[p] ?? []` internally [VERIFIED: boq-aggregator.ts:115].
  const pageMarkups       = useMarkupStore((s) => s.pageMarkups)
  const categories        = useMarkupStore((s) => s.categories)
  const categoryOrder     = useMarkupStore((s) => s.categoryOrder)
  const pageScales        = useScaleStore((s)  => s.pageScales)
  const globalUnit        = useScaleStore((s)  => s.globalUnit)
  const totalPages        = useViewerStore((s) => s.totalPages)
  const fileName          = useViewerStore((s) => s.fileName)
  const currentFilePath   = useProjectStore((s) => s.currentFilePath)

  // Memoize the aggregator output. Recomputes only when one of the 8 inputs
  // changes. aggregateBoq is pure and synchronous — typical project (10-200
  // markups) runs in <2ms; profile if a 500+-markup project drops frames.
  return useMemo(
    () => aggregateBoq({
      markups: pageMarkups,
      pageScales,
      globalUnit,
      totalPages,
      categoriesById: categories as Record<string, { id: string; name: string }>,
      categoryOrder,
      pdfOriginalFilename: fileName ?? 'plan.pdf',
      currentFilePath,
      // getColorForName is implicitly captured via the default opts.getColorForName
      // path inside aggregateBoq — but for full purity we could pass it explicitly:
      getColorForName: (n) => useMarkupStore.getState().getColorForName(n)
    }),
    [pageMarkups, categories, categoryOrder, pageScales, globalUnit, totalPages, fileName, currentFilePath]
  )
}
```

**Why useMemo (not separate `useState` + effect):**
- `aggregateBoq` is pure, fast, synchronous. No async, no side effects.
- `useMemo` captures the derive at render time, not after-commit. No flash of stale data.
- Rerenders are driven by Zustand's existing `useSyncExternalStore` machinery — no manual subscription bookkeeping.

**Why NOT subscribeWithSelector explicitly:**
- The middleware exists on these stores already [VERIFIED: markupStore.ts:43, scaleStore.ts:21, viewerStore.ts:6] but is used for the **dirty-tracking effect** (`attachDirtyTracking` in projectStore.ts) — a non-React subscription. For React component subscriptions, the standard `useStore((s) => slice)` pattern uses `useSyncExternalStore` under the hood and gives the same fine-grained subscription with simpler ergonomics.

**`getColorForName` handling:**
The aggregator's default fallback for `getColorForName` is `(n) => useMarkupStore.getState().getColorForName(n)` [VERIFIED: boq-aggregator.ts:88-89]. This works fine when called inside the memoized aggregator because the aggregator captures it at call time (each `useMemo` recomputation re-binds). Passing it explicitly as shown above is slightly clearer about the dependency, but functionally identical. **Either is acceptable.**

### Decision: useBoqLive() as a new hook (recommended) vs. fold into useExport

**Recommend a new `useBoqLive()` hook** — keep `useExport` focused on the "click-time imperative export action" (it returns a `Promise<ExportResult>` discriminated union) and `useBoqLive` focused on the "continuous reactive live structure." Mixing these into one hook would muddy the contract — `useExport` callers don't want to subscribe to live updates, and `useBoqLive` callers don't want a discriminated-union return type.

A small refactor opportunity exists: `useExport`'s line 79 (`const structure = aggregateBoq()`) could be replaced with a `useBoqLive()` snapshot if `useExport` were converted to return that snapshot directly. But this is a **future refactor**, not Phase 6 work. Plan tasks should leave `useExport` untouched.

### Stable empty-fallback discipline

`aggregateBoq` already handles `pageMarkups[p] ?? []` internally [VERIFIED: boq-aggregator.ts:115]. The TotalsPanel itself does NOT need an `EMPTY_MARKUPS`-style fallback — it consumes the aggregator's output (always a fully-formed `BoqStructure` even when empty: `{ metadata, categories: [], grandTotals: [] }`).

The `EMPTY_MARKUPS` rule [VERIFIED: STATE.md, CanvasViewport.tsx:38] applies when a Zustand selector returns a possibly-undefined slice that an inline `?? []` would freshly allocate every render — it does NOT apply when the slice is the entire `Record<number, Markup[]>` (always defined and stable per-render).

### Performance envelope [HIGH confidence]

Aggregator is O(totalMarkups × pages). For typical takeoffs (10-200 markups, 10-50 pages) this is <2ms on commodity hardware. `useMemo` caches the result across renders triggered by other state. Profile only if a 500+ markup project drops frames during continuous tool use; if so, debounce the recompute to 50-100ms — but **do NOT premature-optimize** in v1 plans.

---

## 3. Transient Konva Overlays (PulseHighlight, HoverRing)

### Existing pattern [VERIFIED: CanvasViewport.tsx:507-865]

The codebase has a fully-formed parent-owned-lifecycle pattern for transient overlays:
- **`MarkupTooltip`** [VERIFIED: src/renderer/src/components/MarkupTooltip.tsx] — pure presentational HTML overlay with `pointer-events: none`. Parent (`CanvasViewport`) owns 200ms show-delay timer (`hoverTimerRef`), `tooltipShown` state, and dismissal on hover-leave / page-change / context-menu-open [VERIFIED: CanvasViewport.tsx:184-217, 228-236].
- **`ConfirmationToast`** [VERIFIED: src/renderer/src/components/ConfirmationToast.tsx] — pure presentational with NO `setTimeout` inside; comment explicitly states "Pure presentational component — NO auto-dismiss timer (setTimeout removed per MEDIUM #3 review). Persistence is owned by the parent." Parent (`CanvasViewport`) owns dismissal effects on page change and on new-calibration-start [VERIFIED: CanvasViewport.tsx:222-243].
- **`MarkupContextMenu`** [VERIFIED: src/renderer/src/components/MarkupContextMenu.tsx:30-52] — owns its own outside-click and Escape listeners (because they have to live close to the rendered DOM node), but the open/close state is owned by `CanvasViewport` (`contextMenu` state, `setContextMenu(null)` on dismissal).

### Layer structure [VERIFIED: CanvasViewport.tsx:534-705]

- **Layer 0** — PDF page image, `listening={false}`.
- **Layer 1a** — Non-interactive calibration + in-progress linear preview, `listening={false}`.
- **Layer 1b** — **Committed markups, `listening={true}`** — the only layer that hit-tests for hover and right-click events on markup Groups.
- **Layer 2 (transient, mounted only while drawing area/perimeter)** — In-progress polygon vertices, with the start vertex as `listening={true}` for close detection.

### Where PulseHighlight + HoverRing fit

UI-SPEC declares the z-order [VERIFIED: 06-UI-SPEC.md "Transient overlay coexistence"]:
1. PDF Image (Layer 0)
2. Calibration overlay + in-progress linear preview (Layer 1a, non-listening)
3. Committed markups (Layer 1b, listening=true)
4. **`<HoverRing>`** (Layer 2 transient, non-listening)
5. **`<PulseHighlight>`** (Layer 2 transient, non-listening)
6. Right-click menu / hover tooltip (HTML, zIndex 25-30)

**Critical:** Both `HoverRing` and `PulseHighlight` MUST set `listening={false}` on every Konva shape they render. If either is `listening={true}`, the ring on top of a Count Pin Group would steal the underlying Group's `onMouseEnter` / `onContextMenu` events — breaking the existing tooltip and recolor flows. This is the load-bearing rule in the UI-SPEC and is reinforced in the layer split decisions in STATE.md.

### Implementation: HoverRing (steady, non-animated)

```typescript
// src/renderer/src/components/HoverRing.tsx (NEW)
import { Circle, Line } from 'react-konva'
import type { Markup } from '../types/markup'

const STROKE_BASE_PX = 2     // 2/zoom — UI-SPEC locked
const RING_OFFSET_PX = 4     // 4/zoom outward — UI-SPEC locked
const RING_OPACITY = 0.4     // UI-SPEC locked

interface HoverRingProps {
  markups: Markup[]            // matched markups on current page
  currentZoom: number
}

// Pure presentational. Parent owns mount/unmount.
export function HoverRing({ markups, currentZoom }: HoverRingProps): React.JSX.Element {
  const stroke = STROKE_BASE_PX / currentZoom
  const offset = RING_OFFSET_PX / currentZoom

  return (
    <>
      {markups.map((m) => {
        if (m.type === 'count') {
          // CountPinMarkup uses PIN_RADIUS_WORLD = 10 (world-anchored, no /zoom).
          // Ring outside pin: radius = 10 + offset.
          return (
            <Circle
              key={m.id}
              x={m.point.x}
              y={m.point.y}
              radius={10 + offset}
              stroke="#ffffff"
              strokeWidth={stroke}
              opacity={RING_OPACITY}
              listening={false}
            />
          )
        }
        if (m.type === 'linear') {
          return (
            <Line
              key={m.id}
              points={m.points.flatMap((p) => [p.x, p.y])}
              stroke="#ffffff"
              strokeWidth={stroke + offset * 2}  // wider envelope around polyline
              opacity={RING_OPACITY}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )
        }
        // area + perimeter: outline the closed polygon
        const closing = [...m.points, m.points[0]]
        return (
          <Line
            key={m.id}
            points={closing.flatMap((p) => [p.x, p.y])}
            stroke="#ffffff"
            strokeWidth={stroke + offset * 2}
            opacity={RING_OPACITY}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )
      })}
    </>
  )
}
```

### Implementation: PulseHighlight (animated, 1500ms fade)

The animation is a **deflating ring + fading opacity** over 1500ms. UI-SPEC locks: opacity ease-out 0.85 → 0; stroke linear 6/zoom → 2/zoom.

**Two viable approaches:**

**(A) `requestAnimationFrame` + React state (RECOMMENDED for this codebase)** — a single `useEffect` in the parent (or in a `useMarkupHighlight()` hook) tracks `progress: 0 → 1` over 1500ms and renders the ring with interpolated values. Pros: same React-state idiom as the rest of the codebase; lifecycle is trivially React-cleanable; testable by mocking `requestAnimationFrame`. Cons: every frame triggers a React render (cheap — 90 frames over 1.5s on a 60Hz monitor; far from a perf concern).

**(B) `Konva.Tween` directly on the shape via `useRef`** — Konva's built-in tweening API [CITED: konvajs.org/api/Konva.Tween.html]. Pros: animation runs entirely in Konva, no React rerender per frame. Cons: bypasses React idioms; cleanup requires explicit `tween.destroy()` on unmount; the ref-based access to Konva nodes inside react-konva is a known awkwardness (see konvajs/react-konva#243, #425).

**Recommend (A)** — performance is not a real concern at 90 frames, and the React-state idiom keeps the component understandable in the same vocabulary as `MarkupTooltip` and `ConfirmationToast`.

```typescript
// src/renderer/src/components/PulseHighlight.tsx (NEW)
import { useEffect, useState } from 'react'
import { Circle, Line } from 'react-konva'
import type { Markup } from '../types/markup'

const PULSE_DURATION_MS = 1500     // UI-SPEC locked
const STROKE_PEAK = 6               // 6/zoom at t=0
const STROKE_END = 2                // 2/zoom at t=1
const OPACITY_PEAK = 0.85
// ease-out: 1 - (1 - t)^2  — quadratic ease-out, recognizably "deflating"

interface PulseHighlightProps {
  markups: Markup[]
  color: string                  // per-name-group color (Markup.color)
  currentZoom: number
  /** Called when fade completes — parent removes the component */
  onComplete: () => void
}

export function PulseHighlight({
  markups, color, currentZoom, onComplete
}: PulseHighlightProps): React.JSX.Element {
  // progress: 0 → 1 over PULSE_DURATION_MS
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (now: number): void => {
      const t = Math.min(1, (now - t0) / PULSE_DURATION_MS)
      setProgress(t)
      if (t < 1) {
        raf = requestAnimationFrame(loop)
      } else {
        onComplete()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onComplete])

  const easeOut = 1 - (1 - progress) ** 2
  const opacity = OPACITY_PEAK * (1 - easeOut)
  const strokePx = STROKE_PEAK + (STROKE_END - STROKE_PEAK) * progress  // linear 6 → 2
  const stroke = strokePx / currentZoom
  const ringOffset = 8 / currentZoom   // pulse sits slightly outside hover ring

  return (
    <>
      {markups.map((m) => {
        if (m.type === 'count') {
          return (
            <Circle
              key={m.id}
              x={m.point.x}
              y={m.point.y}
              radius={10 + ringOffset}     // PIN_RADIUS_WORLD + offset
              stroke={color}
              strokeWidth={stroke}
              opacity={opacity}
              listening={false}
            />
          )
        }
        if (m.type === 'linear') {
          return (
            <Line
              key={m.id}
              points={m.points.flatMap((p) => [p.x, p.y])}
              stroke={color}
              strokeWidth={stroke}
              opacity={opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )
        }
        const closing = [...m.points, m.points[0]]
        return (
          <Line
            key={m.id}
            points={closing.flatMap((p) => [p.x, p.y])}
            stroke={color}
            strokeWidth={stroke}
            opacity={opacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )
      })}
    </>
  )
}
```

### `useMarkupHighlight()` hook responsibility split (RECOMMENDED)

Encapsulate the lifecycle for both overlays in one hook owned by `CanvasViewport`:

```typescript
// src/renderer/src/hooks/useMarkupHighlight.ts (NEW)
import { useState, useCallback } from 'react'
import type { Markup } from '../types/markup'

interface MarkupHighlightApi {
  // Hover state — lives only while user hovers a TotalsRow
  hoverMatches: Markup[]
  setHoverMatches: (matches: Markup[]) => void
  clearHover: () => void

  // Pulse state — fires on row-click, auto-clears on PulseHighlight.onComplete
  pulse: { matches: Markup[]; color: string } | null
  triggerPulse: (matches: Markup[], color: string) => void
  clearPulse: () => void
}

export function useMarkupHighlight(): MarkupHighlightApi {
  const [hoverMatches, setHoverMatchesState] = useState<Markup[]>([])
  const [pulse, setPulse] = useState<{ matches: Markup[]; color: string } | null>(null)

  return {
    hoverMatches,
    setHoverMatches: setHoverMatchesState,
    clearHover: useCallback(() => setHoverMatchesState([]), []),
    pulse,
    triggerPulse: useCallback((matches, color) => setPulse({ matches, color }), []),
    clearPulse: useCallback(() => setPulse(null), [])
  }
}
```

### CanvasViewport vs hook ownership

| Concern | Owned By |
|---------|----------|
| `hoverMatches`, `pulse` state | `useMarkupHighlight()` (called from `CanvasViewport` or App.tsx — see below) |
| `<HoverRing>` and `<PulseHighlight>` mounting | `CanvasViewport` (must be inside the Stage) |
| Per-frame animation tick | `<PulseHighlight>` itself (via `useEffect` + `requestAnimationFrame`) |
| Page-change auto-dismiss | `CanvasViewport` (existing `useEffect` on `currentPage` already dismisses other transients) |
| Triggering hover / pulse from TotalsPanel | TotalsRow → calls hook setter → state propagates to CanvasViewport via prop or hook return |

**Key wiring question for the planner:** Where does `useMarkupHighlight()` get called?

**Option 1:** Lift to App.tsx, pass setters to TotalsPanel, pass `hoverMatches`/`pulse` as props to CanvasViewport. — Simple, explicit, follows the existing App.tsx-as-orchestrator pattern.

**Option 2:** Module-level ref pattern (mirrors `getCanvasControls`, `getCalibrationControls` in CanvasViewport) — lets TotalsPanel call `getMarkupHighlight()?.triggerPulse(matches, color)` without prop drilling.

**Recommend Option 1** — explicit prop flow; the module-level ref pattern is appropriate for "Toolbar imperative actions on the canvas" but Phase 6 has a richer state graph (cycle index, hover state) where prop-flow is clearer.

### Match resolution — TotalsRow → matched markups

Given a row `(itemName, type)` and a target page, find matching markups:

```typescript
function matchMarkupsOnPage(
  pageMarkups: Markup[],
  itemName: string,
  rowType: 'count'|'linear'|'area'|'perimeter-length'|'perimeter-area'
): Markup[] {
  // perimeter-length and perimeter-area both match underlying type 'perimeter'
  const underlyingType: Markup['type'] =
    rowType === 'perimeter-length' || rowType === 'perimeter-area' ? 'perimeter' :
    rowType  // 'count' | 'linear' | 'area'
  return pageMarkups.filter((m) => m.name === itemName && m.type === underlyingType)
}

function findPagesWithMatches(
  pageMarkupsAll: Record<number, Markup[]>,
  itemName: string,
  rowType: BoqRowType
): number[] {
  const out: number[] = []
  for (const [pageStr, list] of Object.entries(pageMarkupsAll)) {
    if (matchMarkupsOnPage(list, itemName, rowType).length > 0) {
      out.push(Number(pageStr))
    }
  }
  return out.sort((a, b) => a - b)
}
```

---

## 4. Thumbnail Rasterization Pipeline

### Existing PDF.js pipeline [VERIFIED: src/renderer/src/hooks/usePdfRenderer.ts:36-195]

`renderPageToCanvas(pdfDocument, pageNumber)` is already extracted as a helper. It:
1. Calls `pdfDocument.getPage(pageNumber)` — returns a `PDFPageProxy`.
2. Calls `clampedRenderScale(page, PDF_BASE_SCALE)` to compute a render scale that respects `MAX_CANVAS_DIM` (16384, the Chromium GPU texture cap).
3. Builds a `viewport = page.getViewport({ scale })`.
4. Allocates a fresh `<canvas>` at `viewport.width * dpr` × `viewport.height * dpr` (HiDPI-aware).
5. Calls `page.render({ canvas, viewport, transform })` — the `transform` is `[dpr, 0, 0, dpr, 0, 0]` to compensate for the DPR-scaled canvas.
6. `await renderTask.promise`.

**For thumbnails, we follow the SAME flow with a low-DPI scale factor:**

```typescript
// src/renderer/src/hooks/useThumbnailRender.ts (NEW)
const THUMBNAIL_DPI = 48 / 72   // 48 dpi target ÷ 72 dpi PDF default = 0.667
// (PDF.js scale=1 = 72 dpi. scale=2 = 144 dpi. scale=THUMBNAIL_DPI = 48 dpi.)

async function renderPageThumbnail(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdfDocument.getPage(pageNumber)
  const viewport = page.getViewport({ scale: THUMBNAIL_DPI })
  const dpr = window.devicePixelRatio || 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  // Display size via CSS — caller sets style.width/height in CSS pixels
  // canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`

  const transform: [number, number, number, number, number, number] | undefined =
    dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

  await page.render({ canvas, viewport, transform }).promise
  return { canvas, width: Math.floor(viewport.width), height: Math.floor(viewport.height) }
}
```

### Markup overlay: raw 2D Canvas API (RECOMMENDED) — NOT per-tile Konva Stage

**The decision is performance + simplicity.** A Konva Stage per thumbnail allocates: an outer `<div>`, a `<canvas>` per Layer, internal hit-test trees, and event listeners. With 50+ thumbnails, that's 50+ Stages, each with 2 canvases minimum, plus event-listener bookkeeping. The canvas is also write-only (no interactions on the markup overlay — clicking the thumbnail navigates to the page; no per-markup hover/click on a thumbnail tile in v1 [VERIFIED: 06-UI-SPEC.md "Right-click a thumbnail: no context menu in v1"]).

**Strategy:** Render the markups directly on the same offscreen canvas as the page raster, using the standard 2D Canvas API:

```typescript
function drawMarkupOverlay(
  ctx: CanvasRenderingContext2D,
  markups: Markup[],
  thumbnailScale: number,        // = THUMBNAIL_DPI (= 48/72)
  pdfBaseScale: number = 2.0     // PDF_BASE_SCALE — markup coords are in main-canvas stage units (PDF_BASE_SCALE)
): void {
  // Markup coordinates are stored in stage units (i.e. main-canvas coordinate
  // system, where 1 unit = 1 pixel at PDF_BASE_SCALE = 2.0 = 144 dpi).
  // To plot on the thumbnail (48 dpi = THUMBNAIL_DPI = 0.667), convert:
  //   thumbnail_x = markup_x * (THUMBNAIL_DPI / PDF_BASE_SCALE) * dpr
  //   thumbnail_y = markup_y * (THUMBNAIL_DPI / PDF_BASE_SCALE) * dpr
  const dpr = window.devicePixelRatio || 1
  const scale = (thumbnailScale / pdfBaseScale) * dpr

  for (const m of markups) {
    ctx.fillStyle = m.color
    ctx.strokeStyle = m.color
    ctx.lineWidth = 1.5 * dpr
    if (m.type === 'count') {
      ctx.beginPath()
      ctx.arc(m.point.x * scale, m.point.y * scale, 3 * dpr, 0, Math.PI * 2)
      ctx.fill()
    } else if (m.type === 'linear') {
      ctx.beginPath()
      m.points.forEach((p, i) => {
        const x = p.x * scale, y = p.y * scale
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else {
      // area + perimeter — closed polygon outline
      ctx.beginPath()
      m.points.forEach((p, i) => {
        const x = p.x * scale, y = p.y * scale
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.stroke()
    }
  }
}
```

### Coordinate-system caveat [VERIFIED: usePdfRenderer.ts uses PDF_BASE_SCALE=2.0]

The main canvas renders at `PDF_BASE_SCALE = 2.0` (144 dpi). Markups are committed in **stage units** at this scale. STATE.md notes: "All markup coordinates stored in PDF page space (normalized 0.0-1.0)" — but the actual stored representation is `StagePoint` objects whose pixel values are at the PDF_BASE_SCALE coordinate system [VERIFIED: types/markup.ts]. The thumbnail renders at `THUMBNAIL_DPI = 48/72 ≈ 0.667`, so the conversion factor is `THUMBNAIL_DPI / PDF_BASE_SCALE = 0.333` (then × dpr for the high-DPI canvas-pixel coordinates).

**Plan-time verification needed:** Confirm during implementation that the main canvas viewport's stage units match `PDF_BASE_SCALE` directly — the conversion math depends on this. If markup coords are stored in some other normalization (e.g., 0-1 normalized PDF page space per STATE.md's stated decision), the conversion is different. The aggregator's `polylineLength` / `polygonArea` work in stage-unit pixels and are then multiplied by `pixelsPerMm`, which is also in stage-unit pixels — so all the math is internally consistent. The thumbnail's only job is to draw markups at `48/144 = 1/3` the size; whatever the unit, the ratio is the same.

**[ASSUMED — A1]** Markup `point.x` / `points[].x` values are stored in PDF_BASE_SCALE pixel units (i.e., the same units the main canvas Stage uses). If they're stored in normalized 0-1 PDF page space, the conversion changes (`thumbnail_x = m.point.x * pageWidth_pdf_pts * THUMBNAIL_DPI * dpr`, where `pageWidth_pdf_pts` comes from `page.getViewport({ scale: 1 }).width`). **Risk if wrong: thumbnail markups offset to incorrect positions; visible immediately on first thumbnail render in dev. Mitigation: planner adds an explicit verification step in the first thumbnail task.**

### Per-tile cached canvas refs

Each `<Thumbnail>` component holds its own `useRef<HTMLCanvasElement | null>` for the rendered canvas. The thumbnail strip's outer container holds a `Map<pageNumber, HTMLCanvasElement>` so when a tile re-enters the viewport (after scrolling away and back), the cached canvas is reused without re-rendering.

**Memory budget:** Each thumbnail at 48 dpi for an A1 plan (594mm × 841mm = 23.4" × 33.1") is `(23.4 × 48) × (33.1 × 48) × 4 bytes (RGBA) = 1123 × 1589 × 4 ≈ 7.1 MB` per tile at base DPI. **For 50 pages this is 355 MB — too high.** With `dpr=2` it's 1.4 GB — completely untenable.

**Eviction strategy needed:**
- Cap the cache at e.g. 30 tiles (LRU).
- When a tile leaves the viewport AND the cache is full, evict the oldest cached canvas.
- Re-render on next intersection.

**Alternative — cap canvas pixel dimensions:** instead of computing canvas size from PDF page dimensions × DPI, **fix a maximum thumbnail width in pixels** (e.g., the `thumbnailDefaultWidth` of 140px CSS, × dpr = 280px in canvas pixels) and compute a render scale that fits. This bounds memory regardless of source page dimensions:

```typescript
const TARGET_CSS_WIDTH = 140
const dpr = window.devicePixelRatio || 1
const targetCanvasWidth = TARGET_CSS_WIDTH * dpr
const scale = targetCanvasWidth / page.getViewport({ scale: 1 }).width
const viewport = page.getViewport({ scale })
// canvas.width = viewport.width = targetCanvasWidth (independent of source page size)
```

**This is simpler and safer.** Recommend this approach over the "fixed DPI" approach. With 280px width × proportional height (~400px for a typical 1.4 aspect ratio) × 4 bytes ≈ 450 KB per tile × 50 tiles = 22.5 MB. **Well within budget.**

### IntersectionObserver-based lazy loading [HIGH confidence]

Standard pattern. No `react-virtuoso` needed — the strip is a one-dimensional vertical list of fixed-aspect tiles, and a custom IntersectionObserver implementation is ~30 lines. CONTEXT D-17 explicitly leaves this as the planner's call; **recommend the hand-rolled approach** for v1 to avoid a new dependency.

```typescript
// Inside <Thumbnail> component
const tileRef = useRef<HTMLDivElement>(null)
const [isVisible, setIsVisible] = useState(false)
const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null)

useEffect(() => {
  const el = tileRef.current
  if (!el) return
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) setIsVisible(true)
  }, { rootMargin: '200px' })  // start loading 200px before visible
  observer.observe(el)
  return () => observer.disconnect()
}, [])

useEffect(() => {
  if (!isVisible) return
  let cancelled = false
  renderPageThumbnail(pdfDocument, pageNumber).then(({ canvas }) => {
    if (cancelled) return
    drawMarkupOverlay(canvas.getContext('2d')!, markups, ...)
    setRenderedCanvas(canvas)
  })
  return () => { cancelled = true }
}, [isVisible, pageNumber, pdfDocument, markupsForPage])

// Render: skeleton if !renderedCanvas, else <canvas> mounted via ref-attach trick
```

**Mounting a ref'd HTMLCanvasElement into React JSX:** the canvas is created imperatively (`document.createElement('canvas')`), then attached to the DOM via `ref={(el) => el?.appendChild(renderedCanvas)}` on a wrapper `<div>`. This is the same trick as the main `usePdfRenderer` flow — the rendered `HTMLCanvasElement` is owned by the hook, then displayed by mounting it to a ref'd container. [VERIFIED: usePdfRenderer.ts returns `pageCanvas` as `HTMLCanvasElement`, and CanvasViewport mounts it as a Konva `<KonvaImage image={displayCanvas} />`.]

For thumbnails specifically (no Konva), the simplest path:

```jsx
<div ref={(el) => {
  if (!el || !renderedCanvas) return
  if (el.firstChild !== renderedCanvas) {
    el.innerHTML = ''
    el.appendChild(renderedCanvas)
  }
}} />
```

### Refresh on markup commit (D-19) — 200ms debounce

Subscribe to `markupStore.pageMarkups` via `subscribeWithSelector`:

```typescript
useEffect(() => {
  const unsub = useMarkupStore.subscribe(
    (s) => s.pageMarkups[pageNumber] ?? EMPTY_MARKUPS,
    (next, prev) => {
      if (next === prev) return
      // Debounce
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = window.setTimeout(() => {
        // Re-render the markup overlay (NOT the page raster — that's stable)
        if (renderedCanvas) {
          drawMarkupOverlay(renderedCanvas.getContext('2d')!, next, ...)
          // Force React to redraw via state increment
          setRefreshTick((t) => t + 1)
        }
      }, 200)  // CONTEXT D-19
    },
    { equalityFn: Object.is }
  )
  return unsub
}, [pageNumber, renderedCanvas])
```

**Critical optimization:** The page raster does NOT change when markups change. Only the overlay re-draws. This is fast (a single `drawMarkupOverlay` call on the existing canvas).

But the page raster is "underneath" the overlay on the same canvas. If we just call `drawMarkupOverlay` again, we'll layer fresh markups on top of OLD markups. Two solutions:

**(a) Two-canvas composite:** keep the page raster on one canvas, the overlay on a second canvas, position them with absolute CSS so the overlay is on top of the raster. On overlay refresh, clear+redraw only the overlay canvas. — Cleaner, no need to re-rasterize.

**(b) Single-canvas re-rasterize:** clear the canvas, re-rasterize the page (cheap if PDF.js page is cached), then draw the overlay. — Simpler component, but every overlay refresh costs a PDF.js render.

**Recommend (a) — two-canvas composite.** Keep the page raster pristine, only redraw the lightweight overlay layer.

```jsx
<div style={{ position: 'relative', width: cssWidth, height: cssHeight }}>
  <canvas
    ref={pageCanvasRef}
    style={{ position: 'absolute', inset: 0, width: cssWidth, height: cssHeight }}
  />
  <canvas
    ref={overlayCanvasRef}
    style={{ position: 'absolute', inset: 0, width: cssWidth, height: cssHeight, pointerEvents: 'none' }}
  />
</div>
```

### Page-label resolution [VERIFIED: pdfjs-dist 5.5.x docs]

```typescript
const labels: string[] | null = await pdfDocument.getPageLabels()
// labels is null when the PDF has no /PageLabels entry; otherwise an array
// indexed 0..numPages-1.
const label = labels?.[pageNumber - 1] ?? `Page ${pageNumber}`
```

`getPageLabels()` is a documented PDFDocumentProxy method on pdfjs-dist 5.5.x [CITED: mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html]. Returns a Promise resolving to a string array or null. Construction PDFs commonly carry labels like `"A1.01"`, `"S-101"`, `"M2.3"` rather than sequential numbers — the get-labels-once-per-document approach is correct.

**Where to fetch:** Once per `pdfDocument` change, cache in a ref or in viewerStore. Recommend a small helper hook:

```typescript
function usePageLabels(): (string[] | null) {
  const pdfDocument = useViewerStore((s) => s.pdfDocument)
  const [labels, setLabels] = useState<string[] | null>(null)
  useEffect(() => {
    if (!pdfDocument) { setLabels(null); return }
    let cancelled = false
    pdfDocument.getPageLabels().then((l) => {
      if (!cancelled) setLabels(l)
    })
    return () => { cancelled = true }
  }, [pdfDocument])
  return labels
}
```

The CanvasHeaderBar consumes the same hook for D-20's left-segment page label.

---

## 5. localStorage UI State (useUiPanels)

### Schema [LOCKED: 06-UI-SPEC.md]

```typescript
// stored at localStorage key 'clmc.ui'
interface UiState {
  thumbnails: { open: boolean; width: number }
  totals:     { open: boolean; width: number }
  collapsedCategories: string[]
}

const DEFAULTS: UiState = {
  thumbnails: { open: true, width: 140 },
  totals:     { open: true, width: 320 },
  collapsedCategories: []
}
```

### Implementation pattern (RECOMMENDED)

```typescript
// src/renderer/src/hooks/useUiPanels.ts (NEW)
import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'clmc.ui'

interface UiState {
  thumbnails: { open: boolean; width: number }
  totals:     { open: boolean; width: number }
  collapsedCategories: string[]
}

const DEFAULTS: UiState = {
  thumbnails: { open: true, width: 140 },
  totals:     { open: true, width: 320 },
  collapsedCategories: []
}

function readStorage(): UiState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    // Defensive shape check — corrupted entries (or schema drift) reset to defaults silently.
    if (
      typeof parsed?.thumbnails?.open === 'boolean' &&
      typeof parsed?.thumbnails?.width === 'number' &&
      typeof parsed?.totals?.open === 'boolean' &&
      typeof parsed?.totals?.width === 'number' &&
      Array.isArray(parsed?.collapsedCategories)
    ) {
      return parsed as UiState
    }
    return DEFAULTS
  } catch {
    return DEFAULTS  // parse error — silent reset
  }
}

function writeStorage(s: UiState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore — quota errors are non-fatal for UI state
  }
}

interface UseUiPanelsApi {
  thumbnails: { open: boolean; width: number }
  totals:     { open: boolean; width: number }
  collapsedCategories: string[]

  setThumbnailsOpen: (open: boolean) => void
  setThumbnailsWidth: (width: number) => void
  setTotalsOpen: (open: boolean) => void
  setTotalsWidth: (width: number) => void
  toggleCategoryCollapsed: (categoryName: string) => void
}

export function useUiPanels(): UseUiPanelsApi {
  // Initialize from storage exactly once (sync — Electron renderer has localStorage available immediately,
  // no SSR / hydration mismatch concern).
  const [state, setState] = useState<UiState>(readStorage)

  // Persist on state change. Note: this writes on EVERY change; for drag-resize
  // we recommend NOT calling setThumbnailsWidth on every pointer-move frame —
  // instead, hold the in-flight width in a local component state, only commit
  // via setThumbnailsWidth on pointer-up. (See §6 Splitter pattern.)
  useEffect(() => { writeStorage(state) }, [state])

  return {
    thumbnails: state.thumbnails,
    totals: state.totals,
    collapsedCategories: state.collapsedCategories,
    setThumbnailsOpen: useCallback((open) =>
      setState((s) => ({ ...s, thumbnails: { ...s.thumbnails, open } })), []),
    setThumbnailsWidth: useCallback((width) =>
      setState((s) => ({ ...s, thumbnails: { ...s.thumbnails, width } })), []),
    setTotalsOpen: useCallback((open) =>
      setState((s) => ({ ...s, totals: { ...s.totals, open } })), []),
    setTotalsWidth: useCallback((width) =>
      setState((s) => ({ ...s, totals: { ...s.totals, width } })), []),
    toggleCategoryCollapsed: useCallback((name) =>
      setState((s) => ({
        ...s,
        collapsedCategories: s.collapsedCategories.includes(name)
          ? s.collapsedCategories.filter((c) => c !== name)
          : [...s.collapsedCategories, name]
      })), [])
  }
}
```

### SSR / Electron-renderer concerns

**None.** The Electron renderer process has `localStorage` synchronously available from the first render. No `useSyncExternalStore`-style pattern is necessary because there's no risk of multi-source state tearing — there's only one source (this hook) and only one tab. The pattern would be over-engineered for the single-window v1 app.

If a future feature needs cross-tab/cross-window state sync (e.g., multiple Electron windows), `useSyncExternalStore` with the `storage` event would be the correct upgrade. For Phase 6, plain `useState + useEffect` is sufficient.

### Drag-resize commit timing

**Recommended:** During splitter drag, hold the in-flight width in **local component state** (e.g., `const [draggingWidth, setDraggingWidth] = useState<number | null>(null)`). On `pointermove`, update `draggingWidth`. On `pointerup`, call `setThumbnailsWidth(draggingWidth)` (which writes to localStorage via the hook). This avoids 60-120 localStorage writes per second during drag.

```typescript
// inside <Splitter>
const onPointerMove = (e: PointerEvent) => {
  if (!isDragging) return
  const newWidth = clamp(panelWidthAtDragStart + (e.clientX - dragStartX), MIN_WIDTH, MAX_WIDTH)
  setDraggingWidth(newWidth)  // local state — drives live rendering
}
const onPointerUp = () => {
  if (!isDragging) return
  setIsDragging(false)
  if (draggingWidth !== null) {
    setThumbnailsWidth(draggingWidth)  // commit to localStorage via useUiPanels
    setDraggingWidth(null)
  }
}
```

The actual rendered width is `draggingWidth ?? thumbnails.width` so the panel resizes live, but persistence happens once.

---

## 6. Three-Column Shell + Splitter

### App.tsx change [VERIFIED: src/renderer/src/App.tsx:204-269 current shell]

Current shell (simplified):

```jsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
  <TitleBar />
  <Toolbar ... />
  <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
    {totalPages === 0 ? <EmptyState /> : <CanvasViewport />}
    {saveToast && <toast />}
    {exportToast && <toast />}
  </main>
  <StatusBar />
  {modals...}
</div>
```

**Phase 6 shell** (new structure):

```jsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
  <TitleBar />
  <Toolbar ... />
  <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: COLORS.dominant, display: 'flex', flexDirection: 'row' }}>
    {/* Left: ThumbnailStrip */}
    <ThumbnailStrip
      open={thumbnails.open}
      width={thumbnails.width}
      onSetOpen={setThumbnailsOpen}
      onSetWidth={setThumbnailsWidth}
    />
    {/* Center: CanvasHeaderBar + Canvas */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {totalPages > 0 && <CanvasHeaderBar />}
      <div style={{ flex: 1, position: 'relative' }}>
        {totalPages === 0 ? <EmptyState /> : <CanvasViewport ... />}
        {saveToast && <toast />}
        {exportToast && <toast />}
      </div>
    </div>
    {/* Right: TotalsPanel */}
    <TotalsPanel
      open={totals.open}
      width={totals.width}
      onSetOpen={setTotalsOpen}
      onSetWidth={setTotalsWidth}
      collapsedCategories={collapsedCategories}
      onToggleCategoryCollapsed={toggleCategoryCollapsed}
      onRowHover={setHoverMatches}
      onRowClick={triggerPulseAndNavigate}
    />
  </main>
  <StatusBar />
  {modals...}
</div>
```

**Critical:** the center column has `flex: 1, minWidth: 0`. The `minWidth: 0` is **required** to allow the center column to shrink when both panels expand — without it, the flex container's intrinsic content size (the canvas) prevents shrinking. This is a known flex-layout pitfall.

**Toasts placement:** The existing `saveToast` and `exportToast` are positioned `bottom: 16` and `bottom: 60` of `<main>`. After the change, they should sit inside the **center column's relative-positioned canvas wrapper** (NOT inside `<main>`) so they overlay the canvas correctly without bleeding into the panels. Plan-time refactor: relocate the toast JSX from `<main>` direct children to inside the center column's relative div.

### Splitter component pattern

```typescript
// src/renderer/src/components/Splitter.tsx (NEW)
import { useState, useEffect, useCallback } from 'react'
import { COLORS } from '../lib/constants'

interface SplitterProps {
  /** 'left' = drag right shrinks the panel; 'right' = drag left shrinks */
  side: 'left' | 'right'
  /** Current committed panel width (from useUiPanels) */
  panelWidth: number
  /** Container width for max-clamping */
  containerWidth: number
  /** Min panel width (auto-collapse threshold) */
  minWidth: number
  /** Live drag callback — receives new candidate width */
  onDragWidth: (newWidth: number) => void
  /** Commit on pointer-up */
  onCommit: (finalWidth: number) => void
  ariaLabel: string
}

export function Splitter({ side, panelWidth, containerWidth, minWidth, onDragWidth, onCommit, ariaLabel }: SplitterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    setIsDragging(true)
    let lastWidth = startWidth

    const onMove = (ev: PointerEvent) => {
      const dx = side === 'left' ? (ev.clientX - startX) : (startX - ev.clientX)
      const next = Math.max(minWidth, Math.min(containerWidth * 0.5, startWidth + dx))
      lastWidth = next
      onDragWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setIsDragging(false)
      onCommit(lastWidth)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [side, panelWidth, containerWidth, minWidth, onDragWidth, onCommit])

  // Visible color: idle border, hover hoverSurface, active accent
  const stripeColor = isDragging ? COLORS.accent : (isHovered ? COLORS.hoverSurface : COLORS.border)

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 4,                        // splitterHitWidth — UI-SPEC locked
        cursor: 'col-resize',
        background: 'transparent',
        position: 'relative',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: 1.5, width: 1,            // 1px visible line, centered in 4px hit area
        background: stripeColor,
        transition: 'background 100ms ease-out'
      }} />
    </div>
  )
}
```

### Min/max width logic [VERIFIED: 06-UI-SPEC.md "Splitter behavior"]

- **Min:** `slimRailWidth = 28px` (auto-collapses to rail at this threshold). When the user drags the splitter to <28px, the panel auto-collapses (set `open=false` and reset `width` to its last expanded width — or alternatively, freeze at 28px and require the chevron to fully collapse).
- **Max:** 50% of window inner width — so neither panel can starve the canvas.

**Recommended behavior:** Drag freely between `slimRailWidth` and `containerWidth × 0.5`. **Do NOT auto-collapse on drag** — auto-collapse on drag is a usability surprise. The chevron button is the only collapse path. This matches the typical IDE/CAD-tool pattern (VSCode, Bluebeam).

### Slim rail (collapsed state)

```jsx
{!thumbnails.open ? (
  <aside style={{
    width: 28,                          // slimRailWidth — UI-SPEC locked
    flexShrink: 0,
    background: COLORS.dominant,
    borderRight: `1px solid ${COLORS.border}`,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8
  }}>
    <button
      onClick={() => setThumbnailsOpen(true)}
      aria-label="Expand Thumbnails"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: COLORS.textSecondary, padding: 4 }}
    >
      <ChevronRight size={14} />
    </button>
  </aside>
) : (
  <aside style={{ width: thumbnails.width, ... }}>...full strip...</aside>
)}
```

---

## 7. CanvasHeaderBar Wiring (Set Scale link)

### Existing Set Scale activation path [VERIFIED: src/renderer/src/components/Toolbar.tsx:173-181, src/renderer/src/components/CanvasViewport.tsx:340-349]

Toolbar's `Set Scale` button calls `getCalibrationControls()?.activate()`:

```typescript
// Toolbar.tsx:173-181
const handleSetScale = (): void => {
  const controls = getCalibrationControls()
  if (!controls) return
  if (isCalibrating) {
    controls.cancel()
  } else {
    controls.activate()
  }
}
```

The `getCalibrationControls()` is exported from `CanvasViewport.tsx`:

```typescript
// CanvasViewport.tsx:51-60
let _calibrationControls: {
  activate: () => void
  activateVerify: () => void
  cancel: () => void
} | null = null

export function getCalibrationControls() {
  return _calibrationControls
}
```

The ref is populated inside `CanvasViewport` from `useCalibrationMode(stageRef)`'s returned API [VERIFIED: CanvasViewport.tsx:340-349].

### CanvasHeaderBar implementation (RECOMMENDED)

```typescript
// src/renderer/src/components/CanvasHeaderBar.tsx (NEW)
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useMarkupStore } from '../stores/markupStore'
import { getCalibrationControls } from './CanvasViewport'
import { formatScaleRatio } from '../lib/scale-math'
import { COLORS } from '../lib/constants'

const HEADER_HEIGHT = 28  // canvasHeaderBarHeight — UI-SPEC locked

export function CanvasHeaderBar(): React.JSX.Element | null {
  const totalPages    = useViewerStore((s) => s.totalPages)
  const currentPage   = useViewerStore((s) => s.currentPage)
  const pageLabels    = usePageLabels()                   // §4
  const pageScale     = useScaleStore((s) => s.pageScales[currentPage] ?? null)
  const pageMarkups   = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)

  if (totalPages === 0) return null   // UI-SPEC: bar hidden when no PDF

  const pageLabel = pageLabels?.[currentPage - 1] ?? `Page ${currentPage}`
  const hasNonCount = pageMarkups.some((m) => m.type !== 'count')
  const isUncalibrated = pageScale === null

  let rightSegment: React.ReactNode
  if (!isUncalibrated) {
    rightSegment = <span style={{ color: COLORS.textPrimary }}>{formatScaleRatio(pageScale.pixelsPerMm)}</span>
  } else if (!hasNonCount) {
    rightSegment = <span style={{ color: COLORS.textSecondary }}>Not Set</span>
  } else {
    rightSegment = (
      <span style={{ color: COLORS.warning }}>
        Page not calibrated.{' '}
        <a
          role="button"
          onClick={() => getCalibrationControls()?.activate()}
          style={{
            color: COLORS.accent,
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >Set Scale</a>
      </span>
    )
  }

  return (
    <div style={{
      height: HEADER_HEIGHT,
      flexShrink: 0,
      background: COLORS.secondary,
      borderTop: `1px solid ${COLORS.border}`,
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      fontSize: 13, lineHeight: 1.4,
      color: COLORS.textPrimary
    }}>
      <span>{pageLabel}</span>
      {rightSegment}
    </div>
  )
}
```

**Critical:** The Set Scale link calls `getCalibrationControls()?.activate()` — the SAME function the Toolbar uses. This guarantees there's no duplicated calibration trigger logic and the calibration tool's internal state machine sees the same activation regardless of where it was triggered.

**Initial-mount-order caveat:** `_calibrationControls` is populated by a `useEffect` inside `CanvasViewport` [VERIFIED: CanvasViewport.tsx:340-349]. If `CanvasHeaderBar` mounts before `CanvasViewport` AND the user clicks the link before the next effect tick, `getCalibrationControls()` returns `null` and the click is silently ignored. **In practice this is fine** — a user can't physically click the link in <1ms of CanvasViewport's first effect commit. But document the dependency: the CanvasHeaderBar relies on CanvasViewport being mounted in the same render cycle. Since both are mounted as siblings of App.tsx's center column when `totalPages > 0`, and React commits all sibling effects before firing user events, the order is correct by construction. No defensive code needed.

---

## 8. TotalsRow Right-Click Context Menu

### Existing right-click pattern [VERIFIED: src/renderer/src/components/MarkupContextMenu.tsx]

`MarkupContextMenu` is the canonical right-click menu. Phase 6's `TotalsRowContextMenu` mirrors it:

| Concern | MarkupContextMenu | TotalsRowContextMenu (D-14) |
|---------|--------------------|------------------------------|
| Position | `position: fixed` at `screenPos` from right-click | Same |
| Background | `COLORS.secondary` | Same |
| Border | `1px solid COLORS.border` | Same |
| Box-shadow | `'0 4px 12px rgba(0,0,0,0.4)'` | Same |
| zIndex | 30 | Same |
| Section header | `12/600 COLORS.textSecondary "Recolor group"` | `12/600 COLORS.textSecondary "Item"` |
| Action item | "Delete" 13/400 button + hover surface | "Copy as text" 13/400 button + hover surface |
| Outside-click dismissal | `useEffect` with `mousedown` listener | Same |
| Escape dismissal | `useEffect` with `keydown` listener | Same |
| **Defer-listener-registration** | `setTimeout(0)` before `addEventListener` so the triggering right-click doesn't immediately close the menu | **MUST mirror exactly** [VERIFIED: MarkupContextMenu.tsx:43-46] |

### Implementation

```typescript
// src/renderer/src/components/TotalsRowContextMenu.tsx (NEW)
import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

interface TotalsRowContextMenuProps {
  screenPos: { x: number; y: number }
  onCopy: () => void
  onClose: () => void
}

export function TotalsRowContextMenu({ screenPos, onCopy, onClose }: TotalsRowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    // CRITICAL: defer registration so the triggering right-click doesn't close the menu.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div ref={menuRef} role="menu" aria-label="Item actions" style={{
      position: 'fixed', left: screenPos.x, top: screenPos.y,
      minWidth: 160, padding: 8,
      background: COLORS.secondary,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      zIndex: 30,
      display: 'flex', flexDirection: 'column', gap: 6,
      fontSize: 13, color: COLORS.textPrimary
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>Item</div>
      <button
        type="button" role="menuitem"
        onClick={() => { onCopy(); onClose() }}
        style={{
          width: '100%', height: 28, padding: '4px 8px',
          background: 'transparent', border: 'none', borderRadius: 4,
          color: COLORS.textPrimary, fontSize: 13, fontWeight: 400, textAlign: 'left',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        Copy as text
      </button>
    </div>
  )
}
```

### Clipboard write API [HIGH confidence]

```typescript
async function copyRowAsText(row: BoqItemRow): Promise<boolean> {
  const qty = row.type === 'count' ? String(row.quantity) : row.quantity.toFixed(2)
  const payload = `${row.label}\t${qty}\t${row.uom}`
  try {
    await navigator.clipboard.writeText(payload)
    return true
  } catch {
    return false   // Electron renderer should always succeed on user-initiated; fallback to error toast
  }
}
```

`navigator.clipboard.writeText` is fully supported in Electron's renderer (Chromium-based). Requires a "user gesture" context (click) — a right-click → menu-click → copy is a valid gesture chain.

**Fallback (if clipboard write throws):** Display the existing-style toast with copy `Copy failed.` per UI-SPEC. Use the same toast shell as `exportToast` / `saveToast`.

**Success path:** Display `Copied {label}` toast (e.g., `Copied Outlet`) — the same App.tsx-level toast pattern with 2000ms auto-dismiss [VERIFIED: App.tsx:87-91].

---

## 9. Pitfalls & Landmines

### Pitfall 1: `listening={true}` on PulseHighlight or HoverRing
**What goes wrong:** The transient ring on Layer 2 sits visually on top of the markup Group on Layer 1b. If listening=true, hover events register on the ring instead of the underlying markup, breaking the existing tooltip flow (and potentially the right-click recolor flow).
**Why it happens:** Easy to forget on a Konva shape — listening defaults to true.
**How to avoid:** Set `listening={false}` on every Konva shape inside both `PulseHighlight` and `HoverRing`.
**Warning signs:** MarkupTooltip stops showing on hover; right-click recolor menu stops appearing.

### Pitfall 2: Aggregator subscription too broad → panel rerenders on every Zustand update
**What goes wrong:** TotalsPanel rerenders 60+ times per second during a polyline draw (because `markupState.previewPoint` updates inside `useMarkupTool`, which lives in `viewerStore.activeTool`-driven state).
**Why it happens:** Subscribing to `useViewerStore((s) => s)` (full store) causes panel rerenders on every viewer state change.
**How to avoid:** Use the 8 specific primitive selectors in `useBoqLive()`. Each is its own `useStore((s) => s.field)` call; React batches them.
**Warning signs:** Panel selectors fire during continuous drawing; React DevTools shows TotalsPanel rerendering on `previewPoint` changes.

### Pitfall 3: Thumbnail offscreen canvas conflict with main viewer canvas (PDF.js worker)
**What goes wrong:** The PDF.js worker hands rendered ImageBitmap data back to the main thread. If multiple `getPage(n).render()` calls race against the same worker for the same page, the second call may get a `RenderingCancelledException` or — worse — a corrupted canvas.
**Why it happens:** The PDF.js worker is single-threaded internally; concurrent renders for the same page serialize. The main `usePdfRenderer` already cancels in-flight renders on page change [VERIFIED: usePdfRenderer.ts:91-95]. Thumbnail renders need to be aware of this.
**How to avoid:** Each thumbnail's render is independent (different `getPage(N)` calls). PDF.js can render multiple pages concurrently. **Do NOT share the offscreen canvas** with `usePdfRenderer` — each thumbnail allocates its own. **Use cancellation tokens (the `cancelled` flag pattern from usePdfRenderer):**
```typescript
let cancelled = false
renderTask = page.render({ canvas, viewport })
await renderTask.promise
if (cancelled) return
return () => { cancelled = true; renderTask?.cancel() }
```
**Warning signs:** Console errors about RenderingCancelledException (these are ignorable but should be filtered with `if ((err as Error)?.name === 'RenderingCancelledException') return` per the existing pattern).

### Pitfall 4: Detached buffer if thumbnail rendering uses `pdfBytes` directly
**What goes wrong:** [VERIFIED: STATE.md] Phase 4.1 had a UAT-blocking bug where `pdfjsLib.getDocument({ data: bytes })` detaches the source `Uint8Array`'s underlying ArrayBuffer.
**Why it happens:** PDF.js worker uses structured clone with transfer list; the source bytes' buffer is moved to the worker.
**How to avoid:** Phase 6 thumbnail rendering does NOT call `getDocument` — it uses the existing `pdfDocument` proxy from `viewerStore.pdfDocument` and calls `pdfDocument.getPage(n)`. **No new `getDocument` call sites.** The existing `cloneForPdfWorker(u8)` discipline applies only at `getDocument` callsites; thumbnails sidestep this entirely.
**Warning signs:** Save flow breaks after first thumbnail render (would indicate accidental `getDocument` call).

### Pitfall 5: localStorage parse failure crashes the app
**What goes wrong:** A future schema change leaves a stale `clmc.ui` entry that fails the shape check, OR a corrupted browser profile produces invalid JSON. If unhandled, the parse throw bubbles to React's render and crashes the app.
**Why it happens:** Default JSON.parse with no try/catch.
**How to avoid:** Wrap `JSON.parse` in try/catch; fall back to `DEFAULTS` silently. Validate the parsed object's shape with primitive type checks before treating as valid (see `readStorage` in §5).
**Warning signs:** App refuses to start after a localStorage corruption (would not happen with try/catch in place, but check by manually setting `localStorage.clmc.ui = "{garbage"` and verifying defaults restore).

### Pitfall 6: Tabular-nums via font-family change instead of font-variant-numeric
**What goes wrong:** Quantities don't align in the right column (e.g., `12.50` and `123.40` jitter their decimal points).
**Why it happens:** Using a non-monospaced font without `font-variant-numeric: tabular-nums`.
**How to avoid:** Apply `font-variant-numeric: tabular-nums` as inline CSS to the quantity column cells. **Do NOT change the font-family** to a monospaced one (Inter is the project font; only the numeric variant changes). [VERIFIED: 06-UI-SPEC.md "Numeric column rendering"]
**Warning signs:** Quantities visually jitter; non-aligned decimal points.

### Pitfall 7: PulseHighlight elevates hit-target z-order
**What goes wrong:** Click on the canvas during a pulse animation hits the PulseHighlight ring instead of the underlying markup Group → the user can't right-click to recolor a freshly-pulsed pin.
**Why it happens:** Solved by `listening={false}` (Pitfall 1). But re-state explicitly because the failure mode is subtle: only manifests if the user clicks during the 1500ms fade window.
**How to avoid:** `listening={false}` (per §3 + Pitfall 1).

### Pitfall 8: Memory leak from uncleared `requestAnimationFrame` on PulseHighlight unmount
**What goes wrong:** If PulseHighlight unmounts mid-animation (e.g., user navigates pages during a pulse), the `requestAnimationFrame` continues firing and updates state on an unmounted component → React warning + leaked frame ticks.
**Why it happens:** Missing `cancelAnimationFrame` in the useEffect cleanup.
**How to avoid:** The `useEffect` cleanup MUST call `cancelAnimationFrame(raf)` (shown in §3 PulseHighlight implementation). Verified in the example code.
**Warning signs:** React `Warning: Can't perform a React state update on an unmounted component` in console.

### Pitfall 9: Aggregator gives stale color when item is renamed mid-cycle
**What goes wrong:** User has a count pin "Outlet" placed; aggregator emits an item with `color: '#dc2626'` (red, from getColorForName('Outlet')). User uses MarkupContextMenu's recolorGroup to flip the name-group to blue. Aggregator re-emits, item's color is now '#2563eb'. Live panel updates to blue. ✓
**No actual pitfall here** — `useBoqLive`'s `useMemo` dependency on `pageMarkups` covers this. Documented for completeness because it's a logical edge case where naive caching could drift.

### Pitfall 10: Thumbnail markup overlay desyncs after undo/redo
**What goes wrong:** User places a markup; thumbnail refresh fires after 200ms. User immediately Ctrl+Z; markup reverts; if the prior overlay refresh's setTimeout is still in-flight, it draws the (now-stale) markup state on the thumbnail.
**Why it happens:** Debounced refresh's setTimeout closure captures `next` from the subscription callback; if a new subscription event fires before the timer fires, the OLDER timer still runs with the OLDER `next` value.
**How to avoid:** Always clear the prior timer before scheduling a new one (`window.clearTimeout(refreshTimerRef.current)` then schedule fresh — the standard debounce pattern shown in §4). Or, switch to a "schedule once, read latest state inside the timer callback" pattern:
```typescript
// Better debounce — always reads latest at fire time
useEffect(() => {
  const unsub = useMarkupStore.subscribe(s => s.pageMarkups[pageNumber] ?? EMPTY_MARKUPS, () => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = window.setTimeout(() => {
      // Read latest at fire time, not from subscription closure
      const latest = useMarkupStore.getState().pageMarkups[pageNumber] ?? EMPTY_MARKUPS
      drawMarkupOverlay(ctx, latest, ...)
    }, 200)
  })
  return () => { /* cleanup */ }
}, [pageNumber])
```
**Warning signs:** Thumbnail shows ghost markup after rapid undo.

### Pitfall 11: Splitter pointer events fail when cursor leaves the splitter element
**What goes wrong:** User starts dragging the splitter, moves cursor fast; cursor leaves the 4px hit area; pointermove stops firing → drag stutters.
**Why it happens:** `pointermove` registered on the element only fires when the cursor is over the element.
**How to avoid:** Register pointermove/pointerup on `window` (NOT on the splitter element) once dragging begins. Show in §6 Splitter implementation. Alternatively, use `setPointerCapture` to lock the cursor to the splitter element. Window-level listeners are simpler and battle-tested.
**Warning signs:** Resize stutters or stops mid-drag.

### Pitfall 12: Markup name-collision in row-click matcher
**What goes wrong:** User has `"Outlet"` as both a count and a linear markup. The aggregator emits TWO rows with `label: "Outlet (count)"` and `label: "Outlet (linear)"`. Row-click on `"Outlet (count)"` calls `matchMarkupsOnPage(...,  rowType: 'count')` which correctly filters by `m.type === 'count'`. But naively iterating to find the next page with matches by `name` only would incorrectly include linear-Outlet pages.
**Why it happens:** Forgetting that the row's `type` field is the actual filter, not just the suffix.
**How to avoid:** The matcher uses `(name, type)`, NEVER just name. Shown in §3.
**Warning signs:** Row-click cycles to pages where the named-but-different-type markups exist.

### Pitfall 13: Unmounting the strip during in-flight thumbnail render leaves a render task uncancelled
**What goes wrong:** User collapses the ThumbnailStrip while a thumbnail is rendering; the render task continues to completion in the worker but its result is dropped → wasted CPU.
**Why it happens:** Missing cancellation in unmount cleanup.
**How to avoid:** The `<Thumbnail>` component's unmount cleanup must call `renderTask.cancel()`. Same pattern as `usePdfRenderer.ts:91-95`.
**Warning signs:** Profile shows worker activity after strip collapse.

### Pitfall 14: Initial thumbnail renders block opening a 50+ page PDF (D-17 success criterion)
**What goes wrong:** If thumbnails eagerly render on PDF open, opening a 50-page PDF takes 50× the time of a single page render → opens are sluggish.
**Why it happens:** Missing IntersectionObserver gate; rendering on mount.
**How to avoid:** Each `<Thumbnail>` mounts a skeleton on first render; rasterization fires only when `isIntersecting` becomes true. Initial visible set is ~5-10 tiles depending on viewport height. Per CONTEXT D-17: "Phase 6 must not slow opening a 50+ page PDF." This is the critical perf invariant.
**Warning signs:** Open PDF time regresses from <1s to multi-seconds.

---

## 10. Validation Architecture (Nyquist)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` [VERIFIED] |
| Quick run command | `npx vitest run -- {testFile}` |
| Full suite command | `npx vitest run` |
| Test glob | `src/tests/**/*.test.ts` [VERIFIED: vitest.config.ts:7] |
| Environment | `node` (jsdom available via package.json devDependency) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEW-01 | `useBoqLive()` returns `BoqStructure` matching `aggregateBoq()` snapshot | unit | `npx vitest run -- use-boq-live.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsPanel renders from BoqStructure with correct row count + colors | component | `npx vitest run -- totals-panel-render.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsRow row-click cycles through pages with matches | component | `npx vitest run -- totals-row-cycle.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsRow row-hover triggers HoverRing on current page only | component | `npx vitest run -- totals-row-hover.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsRow right-click → "Copy as text" emits `navigator.clipboard.writeText` | component | `npx vitest run -- totals-row-context-menu.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsPanel category-heading click toggles + persists to localStorage | component | `npx vitest run -- totals-panel-category-collapse.test.ts` | ❌ Wave 0 |
| VIEW-01 | TotalsPanel renders all 3 empty-state variants per condition | component | `npx vitest run -- totals-panel-empty-states.test.ts` | ❌ Wave 0 |
| PDF-05 | ThumbnailStrip renders one tile per page; click → setPage(N) | component | `npx vitest run -- thumbnail-strip-click.test.ts` | ❌ Wave 0 |
| PDF-05 | Thumbnail tile lazy-mounts on IntersectionObserver intersection | component | `npx vitest run -- thumbnail-lazy-mount.test.ts` | ❌ Wave 0 |
| PDF-05 | Thumbnail markup overlay refreshes within 200ms±50ms after markup commit | component | `npx vitest run -- thumbnail-overlay-debounce.test.ts` | ❌ Wave 0 |
| PDF-05 | Thumbnail page-label resolves via `getPageLabels()`, fallback `Page N` | unit | `npx vitest run -- use-page-labels.test.ts` | ❌ Wave 0 |
| D-03 | useUiPanels reads localStorage on mount; defaults on parse failure | unit | `npx vitest run -- use-ui-panels.test.ts` | ❌ Wave 0 |
| D-03 | useUiPanels writes localStorage on width/open change | unit | included in `use-ui-panels.test.ts` | ❌ Wave 0 |
| D-12 | PulseHighlight fades from opacity 0.85 → ~0 over 1500ms±50ms | unit (with fake timers) | `npx vitest run -- pulse-highlight-animation.test.ts` | ❌ Wave 0 |
| D-12 | PulseHighlight cleanup cancels rAF on unmount (no React warning) | unit | included in `pulse-highlight-animation.test.ts` | ❌ Wave 0 |
| D-11/D-12 | HoverRing + PulseHighlight render with `listening={false}` (regression guard) | unit | `npx vitest run -- highlight-overlay-listening.test.ts` | ❌ Wave 0 |
| D-20 | CanvasHeaderBar shows `Set Scale` link only when uncalibrated AND has non-count markups | component | `npx vitest run -- canvas-header-bar.test.ts` | ❌ Wave 0 |
| D-20 | CanvasHeaderBar `Set Scale` link click invokes `getCalibrationControls().activate()` | component | included in `canvas-header-bar.test.ts` | ❌ Wave 0 |
| D-07 | Aggregator (and therefore TotalsPanel) silently excludes length/area/perimeter on uncalibrated pages — already covered | unit | `npx vitest run -- boq-aggregator.test.ts` | ✅ EXISTS [VERIFIED: src/tests/boq-aggregator.test.ts] |
| D-08 | Aggregator emits metadata block (project, plan, pages, markups) — already covered | unit | included in `boq-aggregator.test.ts` | ✅ EXISTS |

### Sampling Rate

- **Per task commit:** Run the test files added by that task (`npx vitest run -- {file1}.test.ts {file2}.test.ts`) — typically <2 seconds.
- **Per wave merge:** Run all Phase 6 test files (`npx vitest run -- "*panel*" "*thumbnail*" "*highlight*" "*splitter*" "*ui-panels*" "*header-bar*"`).
- **Phase gate:** Full suite green (`npx vitest run`) before `/gsd-verify-work`.

### Wave 0 Gaps (test files to scaffold before implementation)

- `src/tests/use-boq-live.test.ts` — covers VIEW-01 aggregator subscription
- `src/tests/totals-panel-render.test.ts` — TotalsPanel renders BoqStructure
- `src/tests/totals-row-cycle.test.ts` — D-10 cycle navigation
- `src/tests/totals-row-hover.test.ts` — D-11 hover → HoverRing
- `src/tests/totals-row-context-menu.test.ts` — D-14 Copy as text
- `src/tests/totals-panel-category-collapse.test.ts` — D-13 collapse/expand + persistence
- `src/tests/totals-panel-empty-states.test.ts` — D-09 three variants
- `src/tests/thumbnail-strip-click.test.ts` — PDF-05 click → setPage
- `src/tests/thumbnail-lazy-mount.test.ts` — D-17 IntersectionObserver gate
- `src/tests/thumbnail-overlay-debounce.test.ts` — D-19 200ms refresh
- `src/tests/use-page-labels.test.ts` — getPageLabels fallback
- `src/tests/use-ui-panels.test.ts` — D-03 localStorage parse/write/reset
- `src/tests/pulse-highlight-animation.test.ts` — D-12 1500ms fade + rAF cleanup
- `src/tests/highlight-overlay-listening.test.ts` — listening={false} regression guard
- `src/tests/canvas-header-bar.test.ts` — D-20 conditional render + Set Scale wiring
- (no shared fixture file needed — existing `src/tests/fixtures/` covers PDF + markup scaffolds)

**Visual regression / E2E (deferred to manual UAT in v1):**
- Konva PulseHighlight and HoverRing zoom-compensated visuals at 1x and 8x zoom — manual visual verify.
- Panel collapse/expand persists across reload — manual UAT.
- Pulse appears + fades within 1500ms after row-click — manual UAT.

The visual / zoom / 1500ms-timing tests can be unit-tested against the math (interpolation values, zoom-compensated stroke widths) but the actual rendered visual fidelity is best handled by the human UAT loop established in earlier phases.

---

## 11. Open Questions for Planner

### Q1. `useMarkupHighlight()` ownership location

**Options:**
- (A) Lift to `App.tsx` — pass setters to `TotalsPanel`, pass state as props to `CanvasViewport`.
- (B) Module-level ref pattern — `_markupHighlight` exported from CanvasViewport, called by TotalsPanel via `getMarkupHighlight()?.triggerPulse(...)`.

**Recommendation:** Option A. Follows the App.tsx-as-orchestrator pattern (which already routes Toolbar → handlers → state). Clearer prop flow than module-level refs, which the codebase reserves for the canvas's imperative-only API surface.

### Q2. Markup coordinate system for thumbnail overlay scaling

Markup `point.x` / `points[].x` values: are they in PDF_BASE_SCALE pixel units (i.e., the same units the main canvas Stage uses)? Or in normalized 0-1 PDF page space per STATE.md's stated decision?

**Recommendation:** Verify on the first thumbnail implementation task. Both possibilities are accommodated by the §4 conversion math; only one constant changes. Plan-time work item: add an explicit confirmation in the first thumbnail task ("verify markup → thumbnail coord scale visually correct on a multi-markup page").

### Q3. CountPin (world-anchored) vs other markups (zoom-compensated) hover-ring offset

Count pins are pure world-anchored (`PIN_RADIUS_WORLD = 10`, no `/zoom`). Linear/area/perimeter strokes are zoom-compensated. The §3 HoverRing implementation uses fixed offset for count pins (10 + offset units in world space) and stroke-width-based envelope for line/polygon outlines.

**Recommendation:** Accept this asymmetry — it matches the existing visual semantics. Document explicitly in the plan task so the implementer doesn't try to "normalize" the pattern.

### Q4. `react-virtuoso` dependency

CONTEXT D-17 leaves this as planner's call. **Recommendation:** Stay with hand-rolled IntersectionObserver. The thumbnail strip is a fixed-aspect single-column list; virtuoso's value (variable-height items, complex scroll restoration) is overkill. Fewer dependencies = cleaner Phase 6 close-out.

### Q5. Toast positioning after three-column shell change

Existing `saveToast` and `exportToast` are positioned absolute inside `<main>` (`bottom: 16` and `bottom: 60`). After the three-column shell, they'd land between panels visually if left in place.

**Recommendation:** Move toast JSX inside the center column's relative-positioned canvas wrapper. Trivial refactor; documented in §6.

### Q6. Sub-row indicator positioning

D-10 spec: "a 4px round COLORS.accent dot at the row's leading edge (between the color chip and the Item name)." Where exactly between? **Recommendation:** Inline-flex layout: `[color-chip 10px][cycle-dot 4px (visible only when cycleIndex > 0)][gap 4px][item-name][quantity right-aligned]`. The dot occupies the space when present; collapses (gap 0) when absent so the row layout doesn't reflow.

---

## Architecture Patterns

### System Architecture Diagram

```
                                  ┌─────────────────────┐
                                  │      App.tsx        │  (orchestrator)
                                  │ useUiPanels()       │
                                  │ useMarkupHighlight()│
                                  │ useExport()         │
                                  └──┬──────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────────┐
              │                      │                          │
              ▼                      ▼                          ▼
       ┌────────────┐        ┌──────────────┐          ┌──────────────┐
       │ Thumbnail  │        │CanvasViewport│          │ TotalsPanel  │
       │   Strip    │        │   (Konva)    │          │              │
       │            │        │              │          │ uses         │
       │ uses       │        │ Layer 0: PDF │          │ useBoqLive() │
       │ useThumbnail│       │ Layer 1a:    │          │              │
       │ Render()   │       │   in-progress│          │ ┌──────────┐ │
       │            │        │ Layer 1b:    │          │ │ metadata │ │
       │ Per-tile:  │        │   committed  │          │ ├──────────┤ │
       │  - PDF.js  │        │   markups    │          │ │ category │ │
       │   raster   │        │ Layer 2:     │          │ │  block   │ │
       │  - 2D ctx  │        │  Hover Ring  │          │ │  rows    │ │
       │   overlay  │        │  Pulse Highl │          │ │  subtotl │ │
       │            │        │              │          │ ├──────────┤ │
       │ Lazy via   │        │ HTML overlay:│          │ │ grand    │ │
       │ Intersection│       │  MarkupTool- │          │ │ totals   │ │
       │ Observer   │        │  tip,Context │          │ └──────────┘ │
       │            │        │  Menu        │          │              │
       │ Refresh    │        │              │          │ Right-click: │
       │ debounced  │        │ CanvasHeader-│          │ TotalsRowCtx │
       │ 200ms      │        │  Bar (above) │          │ Menu (Copy)  │
       └─────┬──────┘        └──────┬───────┘          └──────┬───────┘
             │                      │                         │
             │ click                │ activate()              │ click row
             │ tile                 │  (Set Scale)            │ → cycle pages
             ▼                      │                         │ → trigger pulse
       viewerStore.setPage(N)       │                         ▼
                                    │                  useMarkupHighlight()
                                    │                  → setHoverMatches /
                                    │                    triggerPulse
                                    │                         │
                                    └─────────────────────────┘
                                              ▼
                                       Konva Layer 2 visuals

       ┌─────────────────────────────────────────────────────┐
       │   Zustand Stores (existing, unchanged)              │
       │   markupStore | scaleStore | viewerStore | project- │
       │   subscribeWithSelector middleware on all 3 markup  │
       │   localStorage 'clmc.ui'  (NEW — useUiPanels)       │
       └─────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/renderer/src/
├── components/
│   ├── App.tsx                          # MODIFIED: 3-column shell
│   ├── CanvasViewport.tsx               # MODIFIED: mount PulseHighlight + HoverRing on Layer 2
│   ├── CanvasHeaderBar.tsx              # NEW
│   ├── ThumbnailStrip.tsx               # NEW
│   ├── Thumbnail.tsx                    # NEW
│   ├── TotalsPanel.tsx                  # NEW
│   ├── TotalsPanelHeader.tsx            # NEW (or inline in TotalsPanel)
│   ├── TotalsCategoryBlock.tsx          # NEW (or inline)
│   ├── TotalsRow.tsx                    # NEW
│   ├── TotalsRowContextMenu.tsx         # NEW
│   ├── PulseHighlight.tsx               # NEW (Konva)
│   ├── HoverRing.tsx                    # NEW (Konva)
│   ├── Splitter.tsx                     # NEW
│   └── (existing components unchanged: Toolbar, StatusBar, MarkupTooltip, MarkupContextMenu, ConfirmationToast, etc.)
├── hooks/
│   ├── useBoqLive.ts                    # NEW — memoized aggregator subscription
│   ├── useUiPanels.ts                   # NEW — localStorage-backed UI state
│   ├── useMarkupHighlight.ts            # NEW — pulse/hover lifecycle
│   ├── useThumbnailRender.ts            # NEW — per-page raster + overlay + debounce
│   ├── usePageLabels.ts                 # NEW — getPageLabels with cache
│   └── (existing hooks unchanged)
└── (existing lib/, types/, stores/ all unchanged)
```

### Pattern 1: Memoized Aggregator Subscription

**What:** A React hook that calls a pure aggregator function inside `useMemo`, with dependencies on the specific Zustand primitive slices the aggregator reads.
**When to use:** When a component needs to react to a derived value that combines fields from multiple stores.
**Example:** `useBoqLive()` in §2.

### Pattern 2: Parent-Owned-Lifecycle for Transient Konva Overlays

**What:** A pure presentational Konva component takes only render props. The parent (CanvasViewport or App.tsx) owns mount/unmount, timer state, and dismissal triggers.
**When to use:** Any visual that appears in response to a user action and self-dismisses after a timeout or other event.
**Example:** `MarkupTooltip` (existing), `ConfirmationToast` (existing), `PulseHighlight` and `HoverRing` (Phase 6).

### Pattern 3: Module-Level Imperative Ref for Cross-Component Canvas Actions

**What:** A module-level `let` exported via a `getX()` accessor, populated by a `useEffect` in the canvas-owning component. Other components call `getX()?.method()` to invoke imperative actions on the canvas.
**When to use:** When a sibling chrome component (Toolbar, CanvasHeaderBar) needs to invoke an action that lives in CanvasViewport's hook ecosystem.
**Example:** `getCalibrationControls()`, `getCanvasControls()` (existing). CanvasHeaderBar's Set Scale link reuses `getCalibrationControls()` — does NOT introduce a new ref.

### Anti-Patterns to Avoid

- **Tailwind in chrome:** UI-SPEC explicitly bans this; reserved for canvas overlays only (which Phase 6 doesn't introduce). Stick to inline-style + `COLORS` tokens.
- **Per-tile Konva Stage in ThumbnailStrip:** see §4 — overhead is unjustified.
- **Subscribing to a too-broad store slice in `useBoqLive`:** see Pitfall 2 — use 8 primitive selectors, not `useStore((s) => s)`.
- **Auto-collapse panel on splitter drag:** see §6 — usability surprise; chevron only.
- **Persisting UI state in `.clmc`:** see CONTEXT D-03 — UI state is per-machine; `clmc.ui` localStorage namespace only.
- **Retest aggregator behavior in TotalsPanel tests:** the aggregator is already exhaustively tested via `boq-aggregator.test.ts` — TotalsPanel tests should mock the hook return and focus on render correctness, not re-derive math.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregator | Don't re-derive BOQ from `pageMarkups` inside TotalsPanel | `aggregateBoq()` via `useBoqLive()` | Live view = export view, exactly. ONE aggregator (D-04). |
| Color-per-name resolution | Don't call `getColorForName()` inside TotalsRow | Read `item.color` from aggregator output | Aggregator already resolves; one source of truth. |
| Right-click menu primitives | Don't roll a fresh outside-click + Escape listener pattern | Mirror `MarkupContextMenu`'s `useEffect` pattern with `setTimeout(0)` defer | Existing pattern handles same-click dismissal; recreate would duplicate the bug fix. |
| Confirmation toast | Don't build a new toast component | Reuse the existing toast JSX shape from `App.tsx:222-244` (saveToast / exportToast) | Pattern locked. |
| Set Scale activation | Don't duplicate `useCalibrationMode().activate()` invocation | `getCalibrationControls()?.activate()` | UI-SPEC explicitly forbids duplicate trigger code. |
| PDF page rendering | Don't reimplement `pdfDocument.getPage(n).render()` | Reuse the existing pattern from `usePdfRenderer.ts:36-60` at lower DPI | Same PDF.js stack, same DPR handling. |
| Detached-buffer handling | Don't add new `pdfjsLib.getDocument({ data })` callsites | Use existing `viewerStore.pdfDocument` proxy and `getPage(n)` | The detached-buffer landmine (Phase 4.1 UAT Test 3) is the only known PDF.js footgun in this codebase; sidestep entirely by not calling `getDocument`. |
| Konva animations | Don't manually compute frame timing with `setInterval` | `requestAnimationFrame` (recommended) or `Konva.Tween` | Both are battle-tested; `setInterval` is wrong for animation. |
| Virtualization | Don't introduce `react-virtuoso` for v1 | Hand-rolled `IntersectionObserver` (~30 LOC) | One-dimensional fixed-aspect list; library is overkill. CONTEXT D-17 leaves this open. |
| localStorage abstraction | Don't introduce `use-local-storage-state` package | `useState + useEffect + try/catch` (~40 LOC) | One namespace, no SSR concerns, no cross-tab. Library is overkill. |
| Tabular numbers | Don't pick a monospace font-family | `font-variant-numeric: tabular-nums` CSS only | Inter (project font) supports the variant; no font swap. |

---

## Common Pitfalls

(See §9 for detailed pitfall-by-pitfall discussion.)

| # | Pitfall | Watch-For |
|---|---------|-----------|
| 1 | `listening={true}` on transient overlays | MarkupTooltip stops appearing |
| 2 | Aggregator subscription too broad | TotalsPanel rerenders on every viewer state change |
| 3 | PDF.js worker conflict | RenderingCancelledException spam in console |
| 4 | Detached buffer from new `getDocument` callsite | Save flow breaks after first thumbnail |
| 5 | localStorage parse failure crashes app | App refuses to start with corrupted `clmc.ui` |
| 6 | Tabular-nums via font-family change | Quantities visually jitter |
| 7 | Pulse elevates hit-target z-order | Right-click recolor stops working during pulse |
| 8 | rAF leak on PulseHighlight unmount | "state update on unmounted component" warning |
| 9 | Stale color when name-group recolors | Live panel doesn't update color (false alarm; useMemo covers it) |
| 10 | Thumbnail overlay desyncs after rapid undo | Ghost markup on thumbnail |
| 11 | Splitter pointer events fail when cursor leaves element | Resize stutters mid-drag |
| 12 | Row-click matcher uses name only (forgets type) | Cycles to wrong-type pages |
| 13 | Uncancelled thumbnail render task on unmount | Worker activity after strip collapse |
| 14 | Eager thumbnail rendering blocks PDF open | Open time regresses on 50-page PDFs |

---

## Code Examples

### Subscribing to live BOQ

```typescript
// src/renderer/src/components/TotalsPanel.tsx
import { useBoqLive } from '../hooks/useBoqLive'

export function TotalsPanel({ ... }: TotalsPanelProps) {
  const boq = useBoqLive()
  // boq.metadata.totalMarkups, boq.categories, boq.grandTotals — render directly
  ...
}
```

### Triggering a pulse

```typescript
// inside TotalsRow's onClick
const matches = matchMarkupsOnPage(pageMarkups[targetPage], item.label /* or row.name */, item.type)
viewerStore.setPage(targetPage)
// AFTER setPage commits, fire pulse — use a microtask to ensure setPage's render has flushed
queueMicrotask(() => {
  triggerPulse(matches, item.color ?? '#cccccc')
})
```

### Rendering a thumbnail with raw 2D overlay

```typescript
// src/renderer/src/components/Thumbnail.tsx
useEffect(() => {
  if (!isVisible) return
  let cancelled = false
  const ctx = pageCanvasRef.current?.getContext('2d')
  const overlayCtx = overlayCanvasRef.current?.getContext('2d')
  if (!ctx || !overlayCtx) return

  ;(async () => {
    const page = await pdfDocument.getPage(pageNumber)
    if (cancelled) return
    const targetCssWidth = strip.width - 2 * 8 /* paddingX */ - 2 /* border */
    const dpr = window.devicePixelRatio || 1
    const baseViewport = page.getViewport({ scale: 1 })
    const renderScale = (targetCssWidth * dpr) / baseViewport.width
    const viewport = page.getViewport({ scale: renderScale })
    pageCanvasRef.current!.width = Math.floor(viewport.width)
    pageCanvasRef.current!.height = Math.floor(viewport.height)
    overlayCanvasRef.current!.width = Math.floor(viewport.width)
    overlayCanvasRef.current!.height = Math.floor(viewport.height)
    const renderTask = page.render({ canvas: pageCanvasRef.current!, viewport })
    await renderTask.promise
    if (cancelled) return
    drawMarkupOverlay(overlayCtx, markups, renderScale, PDF_BASE_SCALE)
  })()
  return () => { cancelled = true }
}, [isVisible, pageNumber, pdfDocument])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-tree React stores (Redux + many providers) | Zustand 5 with `subscribeWithSelector` middleware | Project foundation 2026-03 | Phase 6 inherits — selectors per-primitive, no Provider tree |
| `setInterval` for animations | `requestAnimationFrame` or library tween | Foundational 2010s+ | Phase 6 PulseHighlight uses rAF; Konva.Tween is a viable alternative |
| `react-pdf` for full PDF document mount | `pdfjs-dist` raw + offscreen canvas + Konva overlay | Phase 1 | Phase 6 thumbnail rendering reuses the same pattern at lower DPI |
| Per-tile Konva Stage for thumbnails | Raw 2D Canvas API for thumbnail markup overlay | Phase 6 (NEW) | Avoids per-tile Stage hit-test trees |
| Page-label fallback to numeric | `pdfDocument.getPageLabels()` first, fallback `Page N` | Phase 6 (NEW) | Construction PDFs frequently carry "A1.01"-style labels |

---

## Sources

### Primary (HIGH confidence — `[VERIFIED: in-repo file]`)

- `src/renderer/src/lib/boq-aggregator.ts` — aggregator function signature, AggregateOptions, BoqStructure shape
- `src/renderer/src/lib/boq-types.ts` — full type definitions
- `src/renderer/src/hooks/useExport.ts` — current single-consumer pattern for the aggregator
- `src/renderer/src/hooks/usePdfRenderer.ts` — PDF.js render flow (DPR, MAX_CANVAS_DIM clamp, cancellation)
- `src/renderer/src/hooks/usePdfDocument.ts` — `cloneForPdfWorker` discipline at `getDocument` callsites
- `src/renderer/src/components/CanvasViewport.tsx` — Layer 0/1a/1b/2 structure, parent-owned-lifecycle pattern, `getCalibrationControls` ref
- `src/renderer/src/components/MarkupTooltip.tsx` — pure presentational HTML overlay pattern
- `src/renderer/src/components/MarkupContextMenu.tsx` — defer-listener-registration, outside-click + Escape dismissal
- `src/renderer/src/components/ConfirmationToast.tsx` — parent-owned-lifecycle (no setTimeout in component)
- `src/renderer/src/components/StatusBar.tsx` — inline-style + COLORS pattern, scale display logic
- `src/renderer/src/components/Toolbar.tsx` — Set Scale activation via `getCalibrationControls()?.activate()`
- `src/renderer/src/components/markup/CountPinMarkup.tsx` — world-anchored pin geometry (PIN_RADIUS_WORLD = 10)
- `src/renderer/src/components/markup/LinearMarkup.tsx` — zoom-compensated stroke width pattern
- `src/renderer/src/stores/markupStore.ts` — `getColorForName`, `recolorGroup`, command-pattern undo
- `src/renderer/src/stores/scaleStore.ts` — `pageScales`, `globalUnit`, subscribeWithSelector
- `src/renderer/src/stores/viewerStore.ts` — `setPage`, `pageViewports[currentPage]?.zoom`
- `src/renderer/src/stores/projectStore.ts` — `attachDirtyTracking`, current-file-path
- `src/renderer/src/lib/constants.ts` — COLORS palette, LAYOUT, MAX_CANVAS_DIM, PDF_BASE_SCALE
- `src/renderer/src/lib/scale-math.ts` — formatScaleRatio, pixelsPerMm conventions
- `src/renderer/src/lib/markup-palette.ts` — MARKUP_PALETTE 10 swatches
- `src/renderer/src/types/markup.ts` — Markup discriminated union, StagePoint
- `src/renderer/src/types/scale.ts` — PageScale, ScaleUnit
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — `isTextInputActive` guard pattern
- `src/tests/boq-aggregator.test.ts` — existing aggregator test scaffolding
- `vitest.config.ts` — test glob and aliases
- `package.json` — installed dependencies (no new ones needed)
- `.planning/phases/06-live-view-and-ui-polish/06-CONTEXT.md` — 20 locked decisions
- `.planning/phases/06-live-view-and-ui-polish/06-UI-SPEC.md` — approved design contract
- `.planning/STATE.md` — accumulated decisions and pitfalls
- `.planning/REQUIREMENTS.md` — VIEW-01, PDF-05
- `.planning/ROADMAP.md` — Phase 6 goal + success criteria

### Secondary (MEDIUM confidence — `[CITED: official docs]`)

- [PDF.js API: PDFDocumentProxy](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html) — `getPageLabels(): Promise<string[] | null>` confirmed
- [Konva.js — Simple Animations with React](https://konvajs.org/docs/react/Simple_Animations.html) — `requestAnimationFrame` + state pattern recommended
- [Konva.Tween API](https://konvajs.org/api/Konva.Tween.html) — alternative for the pulse fade
- [konvajs/react-konva Issue #243 — Konva.Animation usage](https://github.com/konvajs/react-konva/issues/243) — refs-with-Konva ergonomics
- [konvajs/react-konva Issue #425 — Animation patterns](https://github.com/konvajs/react-konva/issues/425) — rAF preferred over Konva.Animation in React
- [react.dev — useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) — pattern not needed for v1 single-window Electron renderer
- [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) — version 5.5.207 (already installed)

### Tertiary (verified by codebase patterns rather than citations)

- IntersectionObserver basics — Web Platform API, no version concern in Chromium 134

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Markup `point.x` / `points[].x` are stored in PDF_BASE_SCALE pixel units (i.e., main canvas Stage coordinate system) | §4 Thumbnail coord scaling | Thumbnail markup overlay shows offset/scaled-wrong markups; visible immediately on first thumbnail render. Mitigation: planner adds explicit verification step in the first thumbnail task; the conversion math accommodates both interpretations with a single constant change. |
| A2 | `requestAnimationFrame` is the right pulse-animation primitive for this codebase (vs Konva.Tween) | §3 PulseHighlight | Both work; rAF is recommended for React-idiom alignment. If profiling shows React rerender pressure during pulse, swap to Konva.Tween — drop-in replacement for the inner shape, no API change needed. |
| A3 | Single-tab single-window — no need for `useSyncExternalStore` cross-window sync of `clmc.ui` | §5 useUiPanels | If a future feature opens multiple Electron windows for the same app, panel widths could drift between windows until reload. Acceptable for v1 (single window). Mitigation documented for v2. |

**Risk summary:** A1 is the only assumption with non-trivial risk; the planner should call it out as a Wave 0 verification step. A2 and A3 are low-risk and easily reversible.

---

## Metadata

**Confidence breakdown:**
- Aggregator reuse: HIGH — every claim is `[VERIFIED]` against the existing source
- Konva transient overlay pattern: HIGH — three existing implementations (MarkupTooltip, ConfirmationToast, MarkupContextMenu) cover the same ground
- Thumbnail rasterization: HIGH except A1 (markup coord units) — math is straightforward; only the conversion constant is unverified
- localStorage hook: HIGH — Electron renderer has localStorage synchronously available; no SSR/hydration concerns
- Three-column shell: HIGH — flexbox is well-understood; the only nuance (`minWidth: 0` on center column) is documented
- CanvasHeaderBar: HIGH — reuses the existing module-level ref pattern verbatim
- Right-click context menu: HIGH — direct mirror of `MarkupContextMenu` with documented critical patterns
- Pitfalls: HIGH — every entry tied to a concrete file/line or a documented existing pattern

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days — stable phase scope, no fast-moving deps)
