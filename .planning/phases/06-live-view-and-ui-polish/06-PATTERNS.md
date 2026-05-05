# Phase 6: Live View and UI Polish — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 26 (12 new components + 5 new hooks + 2 modified components + 15 new tests + 2 wave-0 cross-cutting)
**Analogs found:** 26 / 26 (every Phase 6 file maps to a concrete in-repo analog or a documented `Don't Hand-Roll` reuse target)

---

## File Classification

### NEW components

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/renderer/src/components/CanvasHeaderBar.tsx` | chrome (slim status strip) | request-response (reads viewer/scale, calls `getCalibrationControls()`) | `src/renderer/src/components/StatusBar.tsx` | exact (page-label + scale-status display) |
| `src/renderer/src/components/ThumbnailStrip.tsx` | chrome (collapsible side column) | request-response (renders Thumbnail children, owns Splitter) | `src/renderer/src/components/Toolbar.tsx` (chrome shell + IconButton row) + `src/renderer/src/App.tsx:212-219` (flex column wrap) | role-match (no existing side panel) |
| `src/renderer/src/components/Thumbnail.tsx` | chrome (one tile per page) | event-driven (IntersectionObserver) + transform (raw 2D Canvas) | `src/renderer/src/hooks/usePdfRenderer.ts:36-60` (per-page raster pipeline) + `src/renderer/src/components/CanvasViewport.tsx:537-541` (HTMLCanvasElement attached as Konva Image — but here we attach to a plain `<div>`) | partial (page-raster pipeline exact; tile shell new) |
| `src/renderer/src/components/TotalsPanel.tsx` | chrome (right side column) | request-response (consumes BoqStructure from `useBoqLive`) | `src/renderer/src/components/StatusBar.tsx` (inline-style + COLORS + flex layout) + `src/renderer/src/hooks/useExport.ts:79` (aggregator consumer) | role-match |
| `src/renderer/src/components/TotalsPanelHeader.tsx` | chrome (5-row metadata block) | request-response | `src/renderer/src/components/StatusBar.tsx` (label : value Divider pattern) | exact (label/value row with Divider analog) |
| `src/renderer/src/components/TotalsCategoryBlock.tsx` | chrome (collapsible category section) | request-response (consumes `BoqCategoryGroup`) | `src/renderer/src/components/Toolbar.tsx:322-353` (collapsible chevron toggle ▾) | partial |
| `src/renderer/src/components/TotalsRow.tsx` | chrome (one BOQ row) | event-driven (hover/click/right-click → setMatches/triggerPulse) | `src/renderer/src/components/markup/CountPinMarkup.tsx:46-58` (Group with onMouseEnter/Leave/ContextMenu) — but in HTML, not Konva | role-match |
| `src/renderer/src/components/TotalsRowContextMenu.tsx` | chrome (right-click menu) | event-driven (outside-click + Escape dismissal) | `src/renderer/src/components/MarkupContextMenu.tsx` | exact (1:1 mirror) |
| `src/renderer/src/components/PulseHighlight.tsx` | overlay (transient Konva) | streaming (rAF interpolation 0→1 over 1500ms) | `src/renderer/src/components/ConfirmationToast.tsx` (parent-owned-lifecycle for transient UI) + `src/renderer/src/components/markup/LinearMarkup.tsx:51` (zoom-compensated `STROKE_BASE_PX / currentZoom`) | partial (lifecycle pattern exact; rAF animation new) |
| `src/renderer/src/components/HoverRing.tsx` | overlay (transient Konva, non-animated) | request-response (steady ring while parent passes matches[]) | `src/renderer/src/components/MarkupTooltip.tsx` (pure presentational, parent-owned-lifecycle, `pointer-events: none` analog) + `src/renderer/src/components/CanvasViewport.tsx:546-580` (Layer 1a non-listening Circle/Line in canvas space) | exact (lifecycle + zoom-compensation patterns both pre-existing) |
| `src/renderer/src/components/Splitter.tsx` | chrome (4px drag handle) | event-driven (pointer-down + window-level pointermove/pointerup) | (no existing in-repo splitter — new pattern) — closest is `src/renderer/src/components/Toolbar.tsx` (inline-style + COLORS + onMouseDown/Up state changes) | none — see "No Analog Found" below |

### NEW hooks

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/renderer/src/hooks/useBoqLive.ts` | derive hook (memoized aggregator) | request-response (8 Zustand primitive slices → `BoqStructure`) | `src/renderer/src/hooks/useExport.ts:79` (already calls `aggregateBoq()` — but at click time, not reactively) + `src/renderer/src/components/CanvasViewport.tsx:84-94` (per-primitive Zustand slice subscription pattern) | role-match (aggregator consumer exists; reactive memoize is new) |
| `src/renderer/src/hooks/useUiPanels.ts` | state hook (localStorage-backed) | request-response (read once on mount → write on change) | (no existing localStorage hook in repo — new surface) — closest is `src/renderer/src/stores/projectStore.ts` `attachDirtyTracking` (subscribe-and-write pattern, but stores not localStorage) | none — see "No Analog Found" below |
| `src/renderer/src/hooks/useMarkupHighlight.ts` | state hook (transient lifecycle) | event-driven (TotalsRow → setHover/triggerPulse) | `src/renderer/src/components/CanvasViewport.tsx:184-217` (`hoverState` + `hoverTimerRef` + `tooltipShown` + `setHoverState` exact pattern; we lift the same shape into a hook) | exact (hook is just an extraction of the existing CanvasViewport hover/toast state) |
| `src/renderer/src/hooks/useThumbnailRender.ts` | derive hook (per-tile raster + overlay + debounce) | streaming (PDF.js render task) + event-driven (markupStore subscribe + 200ms debounce) | `src/renderer/src/hooks/usePdfRenderer.ts:62-194` (PDF.js page render + cancellation + cache pattern) | exact (this is the same flow at lower DPI) |
| `src/renderer/src/hooks/usePageLabels.ts` | derive hook (one-shot async derive) | request-response (`pdfDocument.getPageLabels() → string[] | null`) | `src/renderer/src/hooks/usePdfRenderer.ts:72-92` (effect that depends on `pdfDocument`, sets state, returns; cancellation flag) | role-match (smaller scope — single async call) |

### MODIFIED components

| Modified File | Role | Data Flow | Pattern To Apply |
|---------------|------|-----------|------------------|
| `src/renderer/src/App.tsx` | orchestrator | shell wrap | three-column flex row inside `<main>`; relocate toasts inside center-column wrapper; mount `<CanvasHeaderBar/>` above `<CanvasViewport/>` only when `totalPages > 0`; lift `useUiPanels()` and `useMarkupHighlight()` here per RESEARCH §3 Q1 |
| `src/renderer/src/components/CanvasViewport.tsx` | canvas owner | overlay mount points | add `<HoverRing/>` and `<PulseHighlight/>` inside the existing Stage as a **new Layer 2 transient block** (alongside the existing polygon-drawing Layer 2), both with `listening={false}` on every shape; consume `hoverMatches`/`pulse` props passed down from App.tsx; auto-dismiss on `currentPage` change via the existing effect at lines 228-236 |

### NEW tests (Wave 0)

All tests follow `src/tests/markup-context-menu.test.ts` pattern (jsdom env, `React.createElement`, `createRoot`+`act` mount helper). See "Shared Patterns → Test scaffold" below.

| Test File | Subject Under Test | Scaffold Analog |
|-----------|--------------------|-----------------|
| `src/tests/use-boq-live.test.ts` | `useBoqLive` returns BoqStructure matching `aggregateBoq()` snapshot | `src/tests/boq-aggregator.test.ts` (fixture builders) |
| `src/tests/totals-panel-render.test.ts` | TotalsPanel renders rows + colors from BoqStructure | `src/tests/markup-context-menu.test.ts` (mount + DOM assertions) |
| `src/tests/totals-row-cycle.test.ts` | row-click cycles N₁→N₂→N₃→wrap | `src/tests/markup-context-menu.test.ts` |
| `src/tests/totals-row-hover.test.ts` | hover triggers `setHoverMatches` only on current page | `src/tests/markup-context-menu.test.ts` |
| `src/tests/totals-row-context-menu.test.ts` | right-click → "Copy as text" → `navigator.clipboard.writeText` | `src/tests/markup-context-menu.test.ts` |
| `src/tests/totals-panel-category-collapse.test.ts` | heading click toggles + persists to `clmc.ui.collapsedCategories` | `src/tests/markup-context-menu.test.ts` + new localStorage stubbing |
| `src/tests/totals-panel-empty-states.test.ts` | three empty-state copy variants per condition | `src/tests/markup-context-menu.test.ts` |
| `src/tests/thumbnail-strip-click.test.ts` | tile click → `viewerStore.setPage(N)` | `src/tests/page-nav.test.ts` (setPage assertions) |
| `src/tests/thumbnail-lazy-mount.test.ts` | IntersectionObserver mocked → tile renders only when intersecting | `src/tests/markup-context-menu.test.ts` + IO mock |
| `src/tests/thumbnail-overlay-debounce.test.ts` | overlay refresh fires within 200ms±50ms after markup commit | uses `vi.useFakeTimers()` — see `src/tests/scale-store.test.ts` |
| `src/tests/use-page-labels.test.ts` | `getPageLabels()` resolved → indexed; null → fallback `Page N` | `src/tests/pdf-loader.test.ts` (PDFDocumentProxy mock pattern) |
| `src/tests/use-ui-panels.test.ts` | reads localStorage on mount; defaults on parse failure; writes on update | (new — vitest jsdom env + `window.localStorage` real API) |
| `src/tests/pulse-highlight-animation.test.ts` | rAF tick advances opacity 0.85→0 over 1500ms; cleanup cancels rAF | `vi.useFakeTimers()` + `vi.spyOn(window,'requestAnimationFrame')` |
| `src/tests/highlight-overlay-listening.test.ts` | every Konva shape inside HoverRing/PulseHighlight has `listening={false}` (regression guard) | (new — Konva node tree inspection) |
| `src/tests/canvas-header-bar.test.ts` | shows `Set Scale` link only when uncalibrated AND has non-count markups; click invokes `getCalibrationControls().activate()` | `src/tests/status-bar-scale.test.ts` (StatusBar conditional rendering) |

---

## Pattern Assignments

### `src/renderer/src/components/CanvasHeaderBar.tsx` (chrome, request-response)

**Analog:** `src/renderer/src/components/StatusBar.tsx` (entire file — 90 lines)
**Why:** UI-SPEC explicitly declares "matches StatusBar/Toolbar styling tokens" and the bar is "a slimmer cousin of this." Same height token (28px), same `COLORS.secondary` background, same `1px solid COLORS.border` divider line, same conditional `pageScale === null ? 'Not Set' : formatScaleRatio(...)` decision tree.

**Imports pattern** (StatusBar.tsx:1-4) — copy verbatim, add `useMarkupStore` + `getCalibrationControls`:
```typescript
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { formatScaleRatio } from '../lib/scale-math'
import { COLORS } from '../lib/constants'
// Phase 6 additions:
import { useMarkupStore } from '../stores/markupStore'
import { getCalibrationControls } from './CanvasViewport'
import { usePageLabels } from '../hooks/usePageLabels'
```

**Conditional scale-text pattern** (StatusBar.tsx:29-40) — copy structure exactly, swap the third branch to render the inline Set Scale link:
```typescript
let scaleText: string
let scaleColor: string
if (!hasFile) {
  scaleText = '—'
  scaleColor = COLORS.textPrimary
} else if (pageScale === null) {
  scaleText = 'Not Set'
  scaleColor = COLORS.warning
} else {
  scaleText = formatScaleRatio(pageScale.pixelsPerMm)
  scaleColor = COLORS.textPrimary
}
```
**For Phase 6:** add a fourth branch when `pageScale === null && hasNonCountMarkups`: render `<span style={{ color: COLORS.warning }}>Page not calibrated. <a onClick={...} style={{ color: COLORS.accent, textDecoration: 'underline', cursor: 'pointer' }}>Set Scale</a></span>` (RESEARCH §7).

**Outer container pattern** (StatusBar.tsx:42-56) — copy with these edits: change `borderTop` to **both** `borderTop` and `borderBottom` (UI-SPEC: "Border-bottom: 1px COLORS.border (matches StatusBar borderTop). Border-top: 1px COLORS.border"), keep `height: 28`, change `justifyContent: 'space-between'`:
```typescript
<div style={{
  height: 28,
  background: COLORS.secondary,
  borderTop: `1px solid ${COLORS.border}`,
  borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px',
  fontSize: 13, lineHeight: 1.4, fontWeight: 400,
  color: COLORS.textPrimary,
  flexShrink: 0
}}>
```

**Conditional return pattern** (`if (totalPages === 0) return null`) — UI-SPEC: "CanvasHeaderBar is **not rendered** when there is no PDF." StatusBar handles this via the `—` fallback; CanvasHeaderBar returns null entirely.

**Set Scale activation** (Toolbar.tsx:173-181) — call `getCalibrationControls()?.activate()`. **Do NOT duplicate trigger code** (UI-SPEC §"CanvasHeaderBar — interactions" line 298 + RESEARCH §"Don't Hand-Roll").

---

### `src/renderer/src/components/ThumbnailStrip.tsx` (chrome, request-response)

**Analog:** `src/renderer/src/components/Toolbar.tsx` (lines 209-292 — chrome shell + flex children) + `src/renderer/src/App.tsx` (the `<main>` wrapper at lines 212-219 will be edited to host this)
**Why:** No existing left-side column in repo. Toolbar's pattern of "outer dark-theme container + flex children + COLORS tokens + inline styles" is the closest established chrome pattern.

**Container pattern** (Toolbar.tsx:209-220) — adapt to vertical strip:
```typescript
// Toolbar.tsx:209-220 (horizontal):
<div style={{
  height: 40, background: '#252526', borderBottom: '1px solid #3c3c3c',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px', flexShrink: 0
}}>
```
**For ThumbnailStrip:** vertical scrollable column with `flexShrink: 0`, `width: thumbnails.width` (or `28` when collapsed), `borderRight: 1px solid COLORS.border`, `background: COLORS.dominant`, `display: 'flex' flexDirection: 'column'`, `overflow: 'auto'`, `padding: 8px 0`.

**Slim-rail collapsed state** (UI-SPEC + RESEARCH §6) — pattern for the `!thumbnails.open` branch quoted from RESEARCH §6:
```jsx
<aside style={{
  width: 28, flexShrink: 0,
  background: COLORS.dominant,
  borderRight: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8
}}>
  <button onClick={() => setThumbnailsOpen(true)} aria-label="Expand Thumbnails"
    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: COLORS.textSecondary, padding: 4 }}>
    <ChevronRight size={14} />
  </button>
</aside>
```

**Lazy-mount via IntersectionObserver** (RESEARCH §4 lines 678-705) — pattern is locked. No existing in-repo IntersectionObserver usage; this is new. **Don't introduce `react-virtuoso`** — Don't-Hand-Roll table line: "One-dimensional fixed-aspect list; library is overkill."

**Splitter on inner edge** — mount `<Splitter side="left" .../>` directly after the aside as a sibling in App.tsx's flex row.

**Nuance:** UI-SPEC declares `paddingTop: 8` and per-tile `thumbnailItemPadding: 8px`. Use these literal numbers (not Tailwind classes).

---

### `src/renderer/src/components/Thumbnail.tsx` (chrome + transform, event-driven)

**Analog A (PDF render flow):** `src/renderer/src/hooks/usePdfRenderer.ts:36-60` — the `renderPageToCanvas` helper is the exact pattern at full DPI; Thumbnail.tsx (or the new `useThumbnailRender` hook) reuses this flow at lower DPI.

**Analog B (canvas mount in JSX):** `src/renderer/src/components/CanvasViewport.tsx:537-541` — the existing pattern is `<KonvaImage image={displayCanvas} />` because it's behind a Konva Stage. **For Thumbnail we use a plain `<div>` ref-attach trick** (RESEARCH §4 lines 711-719):

```jsx
<div ref={(el) => {
  if (!el || !renderedCanvas) return
  if (el.firstChild !== renderedCanvas) {
    el.innerHTML = ''
    el.appendChild(renderedCanvas)
  }
}} />
```

**PDF render core (usePdfRenderer.ts:36-60) — copy this skeleton at lower DPI:**
```typescript
async function renderPageToCanvas(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<CachedPage> {
  const page = await pdfDocument.getPage(pageNumber)
  const renderScale = clampedRenderScale(page, PDF_BASE_SCALE)  // <-- Phase 6: use a low DPI scale instead
  const viewport = page.getViewport({ scale: renderScale })
  const dpr = window.devicePixelRatio || 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)

  const transform: [number, number, number, number, number, number] | undefined =
    dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

  const renderTask = page.render({ canvas, viewport, transform })
  await renderTask.promise

  return { canvas, width: Math.floor(viewport.width), height: Math.floor(viewport.height) }
}
```

**Cancellation pattern (usePdfRenderer.ts:91-95, 145-148, 185-191) — copy verbatim:**
```typescript
let cancelled = false
// ...
try {
  // ...
  const renderTask = page.render({ canvas, viewport, transform })
  renderTaskRef.current = renderTask
  await renderTask.promise
  if (cancelled) return
} catch (err: unknown) {
  if ((err as Error)?.name === 'RenderingCancelledException') return
  console.error('PDF render error:', err)
}
return () => {
  cancelled = true
  if (renderTaskRef.current) renderTaskRef.current.cancel()
}
```
This handles RESEARCH §9 Pitfalls 3 and 13 (PDF.js worker conflict and uncancelled render task on unmount).

**Two-canvas composite for overlay refresh** — RESEARCH §4 (lines 760-771) is locked: page raster on one canvas, markup overlay on a second canvas, both `position: absolute, inset: 0, pointer-events: none` (overlay only).

**Markup-coord scale conversion** — RESEARCH §4 lines 596-639 + Assumption A1: markup coords are in `PDF_BASE_SCALE` (=2.0) stage units; `scale = (THUMBNAIL_DPI / PDF_BASE_SCALE) * dpr`. **Verify visually on first task** (RESEARCH §11 Q2).

**Active-page outline** (UI-SPEC `2px COLORS.accent border` for active, `1px COLORS.border` for idle) — apply to the outer `<div>` wrapping the two canvases.

**Badges (UI-SPEC §"Per-thumbnail badges"):**
- Markup count chip — top-right, 4px inset, `COLORS.secondary` bg, `COLORS.border` border, `COLORS.textPrimary` 11/600 (note: 11px is OK per the scope of badge — this is one-off, not in the type-ramp budget; UI-SPEC declared "label only size" 12/600 elsewhere — consult UI-SPEC if the checker complains).
- Scale-status icon — top-left, 4px inset, 14×14px, `Ruler` (calibrated, `COLORS.textSecondary`) or `AlertTriangle` (uncalibrated, `COLORS.warning`). Icons from `lucide-react` (already imported in Toolbar.tsx:7-9).
- Page label — below image, `13/400`, `COLORS.textPrimary` for active, `COLORS.textSecondary` for idle.

---

### `src/renderer/src/components/TotalsPanel.tsx` (chrome, request-response)

**Analog:** `src/renderer/src/components/StatusBar.tsx` (chrome conventions) + `src/renderer/src/hooks/useExport.ts:79` (aggregator consumer)
**Why:** TotalsPanel is the renderer for `BoqStructure`. RESEARCH §2 + §"Don't Hand-Roll" line 1683: "Don't re-derive BOQ from `pageMarkups` inside TotalsPanel — Use `aggregateBoq()` via `useBoqLive()`."

**Aggregator consumption pattern** (useExport.ts:79 — single line):
```typescript
const structure = aggregateBoq()
```
**For Phase 6:** replace the imperative call with the reactive hook from RESEARCH §2 lines 184-218:
```typescript
const boq = useBoqLive()
// boq.metadata.totalMarkups, boq.categories, boq.grandTotals — render directly
```

**Outer container** — adapt StatusBar.tsx:42-56's pattern: `flexShrink: 0`, `width: totals.width`, `display: 'flex' flexDirection: 'column'`, `borderLeft: 1px solid COLORS.border`, `background: COLORS.dominant`, `overflow: 'auto'`.

**Empty-state pattern** — three contextual variants (CONTEXT D-09 / UI-SPEC §"Empty States"). Decision tree:
```typescript
if (totalPages === 0) return <EmptyMsg>Open a PDF to begin.</EmptyMsg>
if (boq.metadata.totalMarkups === 0) return <EmptyMsg>Place markups to see totals.</EmptyMsg>
if (boq.categories.length === 0)
  return <EmptyMsg>Place markups on a calibrated page to see length and area totals.</EmptyMsg>
```
**Empty message visual** — centered `13/400 COLORS.textSecondary` (UI-SPEC §"Empty States"). No analog component — inline.

**EMPTY-fallback selector discipline** — RESEARCH §2 line 240-243 explicitly states **TotalsPanel does NOT need EMPTY_MARKUPS** because it consumes the aggregator's output (`BoqStructure` is always fully formed). The rule applies inside `useBoqLive` and `useThumbnailRender` (per-page slice subscriptions), NOT here. **Document this in the task** so the implementer doesn't add a redundant fallback.

---

### `src/renderer/src/components/TotalsPanelHeader.tsx` (chrome, request-response)

**Analog:** `src/renderer/src/components/StatusBar.tsx:42-87` — the entire body is a sequence of `<span>` text + `<Divider/>` + `<span>` text rows.
**Why:** Both render label-value pairs. UI-SPEC §"Copywriting Contract" declares the labels: `Project:` / `Plan:` / `Pages:` / `Markups:` / `Page:`.

**Label/value row pattern** (StatusBar.tsx:84-86):
```typescript
<span aria-live="polite">
  Scale: <span style={{ color: scaleColor }}>{scaleText}</span>
</span>
```
**For Phase 6:** vertical-stacked rows, `12/600 COLORS.textSecondary` for the label, `13/400 COLORS.textPrimary` for the value. Em-dash fallback `—` when no value (StatusBar.tsx:32, 66, 73, 79 use this).

**Divider component** (StatusBar.tsx:6-18) — copy the inline `Divider()` definition into TotalsPanelHeader if any horizontal-divider treatment is needed between metadata rows; UI-SPEC suggests no dividers internally — single block with `gap: 8px` (sm token).

**Five fields** (CONTEXT D-08 mirror BOQ export D-09):
- `Project:` ← `boq.metadata.projectName`
- `Plan:` ← `boq.metadata.planFilename`
- `Pages:` ← `boq.metadata.totalPages`
- `Markups:` ← `boq.metadata.totalMarkups`
- `Page:` ← `viewerStore.currentPage` (NOT in BoqMetadata — read separately)

---

### `src/renderer/src/components/TotalsCategoryBlock.tsx` (chrome, event-driven)

**Analog:** `src/renderer/src/components/Toolbar.tsx:322-353` (the Set-Scale `IconButton` with chevron `▾` toggle)
**Why:** Category heading is a row with a chevron that toggles collapse/expand. Toolbar's chevron pattern is the closest in-repo example.

**Chevron toggle pattern** (Toolbar.tsx:333-352):
```typescript
{pageScale !== null && (
  <span
    role="button"
    aria-label="Scale actions menu"
    aria-haspopup="menu"
    onClick={handleChevronClick}
    style={{
      display: 'inline-block', marginLeft: 6,
      fontSize: 10, lineHeight: 1, opacity: 0.7, cursor: 'pointer'
    }}
  >
    {'▾'}
  </span>
)}
```
**For Phase 6:** swap glyph based on collapsed state — `▸` collapsed (UI-SPEC §"Click a category heading"), `▾` expanded. Heading row height: `categoryHeadingHeight: 32px` (UI-SPEC).

**Category heading row** — `13/600 COLORS.textPrimary`. **NO color chip on the heading** (D-06 / UI-SPEC §"Color" line 101: "NEVER on: category heading rows, subtotal rows, grand-total bar, full-row tints, thumbnail badges").

**Hover surface** (UI-SPEC §"Color"): `COLORS.hoverSurface` on heading hover (mouse-enter → background), matches Toolbar IconButton pattern (Toolbar.tsx:77-85).

**Persistence** — calls `useUiPanels().toggleCategoryCollapsed(name)` on click. Reads `collapsedCategories` from same hook.

---

### `src/renderer/src/components/TotalsRow.tsx` (chrome, event-driven)

**Analog:** `src/renderer/src/components/markup/CountPinMarkup.tsx:46-58` (Group with `onMouseEnter` / `onMouseLeave` / `onContextMenu` event wiring)
**Why:** The hover/click/right-click event triplet on a single visual row is the same shape, even though TotalsRow is HTML and CountPinMarkup is Konva.

**Event wiring pattern** (CountPinMarkup.tsx:46-58 — adapt to HTML):
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
**For TotalsRow (HTML):**
```typescript
<div
  onMouseEnter={() => onHover(matchingMarkupsOnCurrentPage)}
  onMouseLeave={() => onHover([])}
  onClick={() => onClick(item)}                            // cycle navigation + pulse
  onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
  style={{ height: 28 /* totalsRowHeight */, ... }}
>
```

**Color chip on Item-name cell only** (CONTEXT D-06 / UI-SPEC §"Color" line 101): `~10×10px` rounded square `background: item.color`, with `border: 1px solid COLORS.border` when `item.color === null`. Inline-flex layout: `[chip 10px][cycle-dot 4px when cycleIndex>0][gap 4px][item-name flex:1][quantity right-aligned tabular-nums][uom]`.

**Tabular-nums** (UI-SPEC §"Typography" + Pitfall 6): apply `fontVariantNumeric: 'tabular-nums'` to the quantity column ONLY. **Do NOT change font-family.**

**Quantity formatting** (UI-SPEC §"Right-click an item row"): `count → String(quantity)` (integer); `length/area → quantity.toFixed(2)`.

**Cycle-index dot** (UI-SPEC §"Click an item row" line 251): `4px round COLORS.accent` at the row's leading edge when `cycleIndex > 0`. Layout reflow note (RESEARCH §11 Q6): use a fixed-width slot so the row doesn't reflow when the dot appears/disappears.

**Hover surface** (UI-SPEC §"Color"): `COLORS.hoverSurface` on row mouse-enter; `COLORS.activeSurface` on mouse-down.

---

### `src/renderer/src/components/TotalsRowContextMenu.tsx` (chrome, event-driven)

**Analog:** `src/renderer/src/components/MarkupContextMenu.tsx` (entire file, 145 lines) — **exact 1:1 mirror** with simplified content.
**Why:** RESEARCH §8 line 1241: "Phase 6's `TotalsRowContextMenu` mirrors it." All structural concerns (positioning, dismissal, defer-listener-registration) carry over verbatim.

**Defer-listener-registration pattern** (MarkupContextMenu.tsx:30-52) — copy verbatim, **mandatory** to avoid same-click dismissal (Pitfall noted in MarkupContextMenu.tsx:42-43):
```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent): void => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose()
    }
  }
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }
  // Defer listener registration so the triggering right-click doesn't immediately close the menu
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
```

**Outer container styling** (MarkupContextMenu.tsx:54-76) — copy verbatim:
```typescript
<div ref={menuRef} role="menu" aria-label="Item actions"
  style={{
    position: 'fixed', left: screenPos.x, top: screenPos.y,
    minWidth: 160, padding: 8,
    background: COLORS.secondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 30,
    display: 'flex', flexDirection: 'column', gap: 6,
    fontSize: 13, color: COLORS.textPrimary
  }}>
```

**Section header** (MarkupContextMenu.tsx:77-79) — same 12/600 + COLORS.textSecondary, label `"Item"` instead of `"Recolor group"`.

**Action button** (MarkupContextMenu.tsx:113-141) — copy structure, change label `"Delete"` → `"Copy as text"`, swap onClick to call clipboard write.

**Clipboard write** (RESEARCH §8 lines 1326-1336):
```typescript
async function copyRowAsText(row: BoqItemRow): Promise<boolean> {
  const qty = row.type === 'count' ? String(row.quantity) : row.quantity.toFixed(2)
  const payload = `${row.label}\t${qty}\t${row.uom}`
  try {
    await navigator.clipboard.writeText(payload)
    return true
  } catch {
    return false
  }
}
```

**Success/failure toast** (UI-SPEC §"Right-click an item row" + §"Error States") — reuse the App.tsx `saveToast`/`exportToast` shell pattern (App.tsx:222-244, 246-268). On success: `Copied {label}`; on failure: `Copy failed.` (warning-tinted).

---

### `src/renderer/src/components/PulseHighlight.tsx` (overlay, streaming)

**Analog A (lifecycle):** `src/renderer/src/components/ConfirmationToast.tsx` — pure presentational; "NO setTimeout in component; persistence is owned by the parent" (ConfirmationToast.tsx:11-15). PulseHighlight is the same: parent owns state; the component runs the rAF loop and calls `onComplete` when done.
**Analog B (zoom-compensation):** `src/renderer/src/components/markup/LinearMarkup.tsx:51` — `const strokeWidth = STROKE_BASE_PX / currentZoom`.

**Lifecycle pattern from ConfirmationToast.tsx:9-15** (the comment is the contract):
```typescript
/**
 * Pure presentational component — NO auto-dismiss timer (setTimeout removed per MEDIUM #3 review).
 * Persistence is owned by the parent (CanvasViewport): dismissed on page change,
 * new calibration start, or explicit user action (Verify / Dismiss).
 */
```
**For PulseHighlight:** the component does run a rAF loop internally (because the animation is per-frame interpolation), but it does NOT decide WHEN to mount/unmount — the parent (CanvasViewport via `useMarkupHighlight`) controls that. PulseHighlight calls `onComplete()` when its 1500ms fade finishes; parent then sets `pulse = null`.

**Zoom-compensated stroke (LinearMarkup.tsx:33, 51)** — copy this discipline:
```typescript
// LinearMarkup.tsx:33
const STROKE_BASE_PX = 2
// LinearMarkup.tsx:51
const strokeWidth = STROKE_BASE_PX / currentZoom
```
**For PulseHighlight (RESEARCH §3 lines 367-409):** UI-SPEC-locked values:
- `STROKE_PEAK = 6` (peak), `STROKE_END = 2` (final)
- `strokePx = STROKE_PEAK + (STROKE_END - STROKE_PEAK) * progress` (linear 6→2)
- `stroke = strokePx / currentZoom`
- `OPACITY_PEAK = 0.85`, `easeOut = 1 - (1 - progress) ** 2`, `opacity = OPACITY_PEAK * (1 - easeOut)`
- `PULSE_DURATION_MS = 1500`

**rAF cleanup pattern** (the same `cancelled` flag idiom usePdfRenderer.ts:185-191 uses for render-tasks; here adapted for rAF — RESEARCH §3 lines 391-404):
```typescript
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
```
**Pitfall 8 (RESEARCH §9):** The `cancelAnimationFrame(raf)` in cleanup is **mandatory** to avoid React "state update on unmounted component" warnings on rapid page changes during pulse.

**Per-markup geometry** (RESEARCH §3 lines 412-456) — three cases:
- `count`: `<Circle radius={10 + ringOffset} ... />` (10 = `PIN_RADIUS_WORLD` from `CountPinMarkup.tsx:18`)
- `linear`: `<Line points={m.points.flatMap(p => [p.x, p.y])} ... />`
- `area` / `perimeter`: `<Line points={[...m.points, m.points[0]].flatMap(p => [p.x, p.y])} ... />` (closed polygon)

**`listening={false}` discipline** — Pitfalls 1 and 7 (RESEARCH §9). Every `<Circle>` and `<Line>` inside PulseHighlight MUST set `listening={false}` so the ring on top of a Count Pin Group doesn't steal hover events from the underlying markup. Add `src/tests/highlight-overlay-listening.test.ts` as a regression guard (already in scaffolding list).

**Color = per-name color** — `pulse.color` is passed in by `useMarkupHighlight().triggerPulse(matches, item.color ?? '#cccccc')` (RESEARCH §"Code Examples" lines 1738-1743). `item.color` comes pre-resolved from the aggregator output (`BoqItemRow.color`).

---

### `src/renderer/src/components/HoverRing.tsx` (overlay, request-response)

**Analog A (lifecycle):** `src/renderer/src/components/MarkupTooltip.tsx` — "Pure presentational — parent (CanvasViewport) handles the 200ms show delay and hide-on-mouseleave. Not interactive (`pointer-events: none`) so it never steals hover from the underlying markup Group" (MarkupTooltip.tsx:8-13).
**Analog B (Konva non-listening shapes in canvas space):** `src/renderer/src/components/CanvasViewport.tsx:546-580` (Layer 1a calibration overlay — `<Circle>` + `<Line>` with `listening={false}`).

**Pure presentational signature pattern** (MarkupTooltip.tsx — entire 40-line file is the model):
```typescript
import { COLORS } from '../lib/constants'

export interface MarkupTooltipProps {
  screenPos: { x: number; y: number }
  text: string
}

/**
 * HTML tooltip absolutely-positioned over the canvas (D-33).
 * Pure presentational — parent (CanvasViewport) handles the 200ms show delay
 * and hide-on-mouseleave. Not interactive (pointer-events: none) so it never
 * steals hover from the underlying markup Group.
 */
export function MarkupTooltip({ screenPos, text }: MarkupTooltipProps): React.JSX.Element { ... }
```
**For HoverRing** — Konva (not HTML), but same shape: takes `markups: Markup[]`, `currentZoom: number`; renders a non-listening ring per match; no internal state, no timers.

**Konva non-listening overlay pattern** (CanvasViewport.tsx:548-580):
```typescript
<Layer listening={false}>
  {calibState.startPoint && (
    <Circle
      x={calibState.startPoint.x}
      y={calibState.startPoint.y}
      radius={POINT_RADIUS}
      fill={COLORS.accent}
      stroke="#ffffff"
      strokeWidth={POINT_STROKE_WIDTH}
      listening={false}
    />
  )}
  {/* ...Line with listening={false}... */}
</Layer>
```
**For HoverRing** — render inside its own Layer (or share Layer 2 with PulseHighlight) with `listening={false}` on every shape.

**UI-SPEC-locked HoverRing visual params** (UI-SPEC §"Hover an item row"):
- `STROKE_BASE_PX = 2` → `stroke = 2 / currentZoom`
- `RING_OFFSET_PX = 4` → `offset = 4 / currentZoom`
- `RING_OPACITY = 0.4`
- Color: `#ffffff` (white — UI-SPEC line 240: "uniform white ... preferred for higher contrast over per-name colors")
- Geometry per markup type: see PulseHighlight (same three cases). For count pins, use `radius = 10 + offset` (10 = `PIN_RADIUS_WORLD`).
- **No animation** — appears instantly on enter, removes instantly on leave.

---

### `src/renderer/src/components/Splitter.tsx` (chrome, event-driven)

**Analog:** None close — this is a new primitive. Closest reference is `src/renderer/src/components/Toolbar.tsx`'s `IconButton` for "inline-style + COLORS + onMouseEnter/Leave/Down/Up state changes" (Toolbar.tsx:50-95).

**Pattern from RESEARCH §6 (lines 1018-1094) — locked design** (no in-repo analog; this is the canonical implementation):

```typescript
import { useState, useEffect, useCallback } from 'react'
import { COLORS } from '../lib/constants'

interface SplitterProps {
  side: 'left' | 'right'
  panelWidth: number
  containerWidth: number
  minWidth: number
  onDragWidth: (newWidth: number) => void
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

  const stripeColor = isDragging ? COLORS.accent : (isHovered ? COLORS.hoverSurface : COLORS.border)
  return (
    <div role="separator" aria-label={ariaLabel} aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 4, cursor: 'col-resize', background: 'transparent',
        position: 'relative', flexShrink: 0, userSelect: 'none'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: 1.5, width: 1,
        background: stripeColor, transition: 'background 100ms ease-out'
      }} />
    </div>
  )
}
```

**Critical** (Pitfall 11, RESEARCH §9): `pointermove` and `pointerup` MUST be registered on `window` (not on the splitter element) once dragging begins. The splitter element only gets `pointerDown`. This avoids drag stutter when the cursor leaves the 4px hit area.

**Drag-commit timing** (RESEARCH §5 lines 928-947): During drag, write to local state; commit to localStorage only on `pointerup` via `onCommit`.

---

### `src/renderer/src/hooks/useBoqLive.ts` (derive hook, request-response)

**Analog A (consumer):** `src/renderer/src/hooks/useExport.ts:79` — already calls `aggregateBoq()`.
**Analog B (subscription pattern):** `src/renderer/src/components/CanvasViewport.tsx:84-94` — per-primitive Zustand slice subscription with primitive-fallback discipline.

**Per-primitive subscription pattern** (CanvasViewport.tsx:84-94):
```typescript
const currentPage = useViewerStore((s) => s.currentPage)
const totalPages = useViewerStore((s) => s.totalPages)
const getViewport = useViewerStore((s) => s.getViewport)
const setViewport = useViewerStore((s) => s.setViewport)
// B4 fix: subscribe to the zoom primitive so changes trigger a re-render.
const currentZoom = useViewerStore((s) => s.pageViewports[currentPage]?.zoom ?? 1)

const pageScale = useScaleStore((s) => s.pageScales[currentPage] ?? null)
const setScale = useScaleStore((s) => s.setScale)
const calibMode = useScaleStore((s) => s.calibMode)
```
**For useBoqLive (RESEARCH §2 lines 184-218 — locked):** subscribe to 8 primitives across 4 stores, then `useMemo` over them. Pattern is already specified in the research; quote it verbatim into the hook task.

**Pitfall 2 (RESEARCH §9)** — too-broad subscription: do NOT use `useMarkupStore((s) => s)`. Use 8 specific primitive selectors so the panel doesn't rerender on every viewer state change (e.g., `previewPoint` updates during continuous drawing).

---

### `src/renderer/src/hooks/useUiPanels.ts` (state hook)

**Analog:** No existing localStorage hook. RESEARCH §"Don't Hand-Roll" line 1692: "Don't introduce `use-local-storage-state` package — `useState + useEffect + try/catch` (~40 LOC)."

**Pattern (RESEARCH §5 lines 828-918 — locked design):**
- `STORAGE_KEY = 'clmc.ui'` (single namespace).
- `readStorage()` — try/catch around `JSON.parse`; defensive shape check; fall back to `DEFAULTS` silently on parse failure (Pitfall 5).
- `writeStorage()` — try/catch around `localStorage.setItem`; ignore quota errors.
- Initial state: `useState<UiState>(readStorage)` — sync read on mount (Electron renderer has localStorage available immediately; no SSR concern).
- Persist on change: `useEffect(() => { writeStorage(state) }, [state])`.
- Setters wrapped in `useCallback` (RESEARCH §5 lines 901-916).

**Defensive parse (locked, RESEARCH §5 lines 845-864) — copy verbatim:**
```typescript
function readStorage(): UiState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
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
    return DEFAULTS
  }
}
```

**Drag-resize commit timing** (Splitter section above + RESEARCH §5 lines 928-947): Splitter writes to local component state during drag; commits to `setThumbnailsWidth(width)` only on `pointerup`. **Do NOT call setters on every pointermove** — that would write 60-120 times/sec.

---

### `src/renderer/src/hooks/useMarkupHighlight.ts` (state hook)

**Analog:** `src/renderer/src/components/CanvasViewport.tsx:184-217` — the existing hover/tooltip lifecycle (`hoverState`, `hoverTimerRef`, `tooltipShown`, `setHoverState`, `handleHoverEnter`, `handleHoverLeave`, `handleContextMenu`). The same shape lifted into a hook.

**Existing pattern (CanvasViewport.tsx:184-217) — verbatim:**
```typescript
// Hover + context-menu state for committed markups (plan 03.1-05)
const [hoverState, setHoverState] = useState<{ id: string; x: number; y: number } | null>(null)
const hoverTimerRef = useRef<number | null>(null)
const [tooltipShown, setTooltipShown] = useState(false)
const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

const handleHoverEnter = useCallback((id: string, x: number, y: number) => {
  setHoverState({ id, x, y })
  if (hoverTimerRef.current !== null) {
    window.clearTimeout(hoverTimerRef.current)
  }
  hoverTimerRef.current = window.setTimeout(() => {
    setTooltipShown(true)
  }, 200)
}, [])

const handleHoverLeave = useCallback(() => {
  if (hoverTimerRef.current !== null) {
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }
  setHoverState(null)
  setTooltipShown(false)
}, [])
```

**For useMarkupHighlight (RESEARCH §3 lines 467-495 — locked design):**
```typescript
interface MarkupHighlightApi {
  hoverMatches: Markup[]
  setHoverMatches: (matches: Markup[]) => void
  clearHover: () => void

  pulse: { matches: Markup[]; color: string } | null
  triggerPulse: (matches: Markup[], color: string) => void
  clearPulse: () => void
}
```
No 200ms delay (UI-SPEC §"Hover an item row" line 236: "**0ms delay** — instant"). PulseHighlight clears itself via `onComplete` (no parent timer needed).

**Page-change auto-dismiss** (CanvasViewport.tsx:228-236) — extend the existing effect to also call `clearHover()` and `clearPulse()`:
```typescript
useEffect(() => {
  setHoverState(null)
  setTooltipShown(false)
  setContextMenu(null)
  if (hoverTimerRef.current !== null) {
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }
  // Phase 6 additions:
  clearHover()
  clearPulse()
}, [currentPage])
```

**Hook ownership** — RESEARCH §3 Q1 (line 1527): **Option A (App.tsx-as-orchestrator)** is the recommendation. App.tsx calls `useMarkupHighlight()`, passes setters to TotalsPanel and `pulse`/`hoverMatches` as props to CanvasViewport. Mirrors the existing App.tsx pattern (App.tsx:101-202 routes useExport return values, modal state, toast state).

---

### `src/renderer/src/hooks/useThumbnailRender.ts` (derive hook)

**Analog:** `src/renderer/src/hooks/usePdfRenderer.ts` (entire file) — the per-page raster pipeline at full DPI. useThumbnailRender is the same pattern at lower DPI.

**Differences from usePdfRenderer:**
1. Render scale: `(TARGET_CSS_WIDTH * dpr) / page.getViewport({ scale: 1 }).width` instead of `clampedRenderScale(page, PDF_BASE_SCALE)` — RESEARCH §4 lines 663-669 ("cap canvas pixel dimensions" approach, not "fixed DPI").
2. Two-canvas composite (RESEARCH §4 lines 760-771): page raster on `pageCanvasRef`, markup overlay on `overlayCanvasRef`.
3. Markup overlay refresh: subscribe to `useMarkupStore.subscribe(s => s.pageMarkups[pageNumber] ?? EMPTY_MARKUPS, ...)` with 200ms debounce (RESEARCH §4 lines 723-748).
4. **Use `EMPTY_MARKUPS` stable fallback here** — this IS a per-page slice subscription where the rule applies. Define a module-level `const EMPTY_MARKUPS: Markup[] = []` exactly like CanvasViewport.tsx:38.
5. Read latest at fire time, not from subscription closure (Pitfall 10, RESEARCH §9 lines 1411-1424): `const latest = useMarkupStore.getState().pageMarkups[pageNumber] ?? EMPTY_MARKUPS`.

**Cancellation pattern** — usePdfRenderer.ts:91-95 + 145-148 (already extracted above for Thumbnail.tsx).

---

### `src/renderer/src/hooks/usePageLabels.ts` (derive hook)

**Analog:** `src/renderer/src/hooks/usePdfRenderer.ts:72-92` — the `useEffect` that depends on `pdfDocument`, sets state, returns; uses `cancelled` flag pattern.

**Pattern (RESEARCH §4 lines 786-799 — locked):**
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
Consumed by both Thumbnail (per-tile label) and CanvasHeaderBar (current-page label). One hook, one fetch per pdfDocument change.

---

### MODIFIED: `src/renderer/src/App.tsx`

**Pattern (RESEARCH §6 lines 974-1009 — locked three-column shell):**

Current (App.tsx:204-269):
```typescript
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

Phase 6:
```typescript
<main style={{
  flex: 1, overflow: 'hidden', position: 'relative', background: COLORS.dominant,
  display: 'flex', flexDirection: 'row'
}}>
  <ThumbnailStrip open={thumbnails.open} width={thumbnails.width} ... />
  <Splitter side="left" ... />
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    {totalPages > 0 && <CanvasHeaderBar />}
    <div style={{ flex: 1, position: 'relative' }}>
      {totalPages === 0 ? <EmptyState /> : <CanvasViewport hoverMatches={...} pulse={...} />}
      {saveToast && <toast />}        {/* relocated from <main> direct child */}
      {exportToast && <toast />}      {/* relocated */}
    </div>
  </div>
  <Splitter side="right" ... />
  <TotalsPanel open={totals.open} width={totals.width} ... />
</main>
```

**Critical (RESEARCH §6 line 1011):** Center column has `flex: 1, minWidth: 0`. Without `minWidth: 0`, the canvas's intrinsic content prevents shrinking when both panels expand.

**Toast relocation (RESEARCH §11 Q5):** Move `saveToast`/`exportToast` JSX from direct children of `<main>` to inside the center column's relative-positioned wrapper. Otherwise they'll bleed across the panels.

**New hooks lifted here:** `useUiPanels()` and `useMarkupHighlight()`. App.tsx already orchestrates `useExport`, `useProject`, `useKeyboardShortcuts` — same pattern.

---

### MODIFIED: `src/renderer/src/components/CanvasViewport.tsx`

**Pattern: add a new Layer 2 transient block alongside the existing polygon-drawing Layer 2 (CanvasViewport.tsx:707-763).** Mount `<HoverRing>` and `<PulseHighlight>` here, both with `listening={false}` on every shape.

**Mounting site (between line 705 `</Layer>` of Layer 1b and line 707 polygon drawing block):**
```jsx
{/* Phase 6: Layer 2 transient — panel-driven highlights */}
{(props.hoverMatches.length > 0 || props.pulse !== null) && (
  <Layer listening={false}>
    {props.hoverMatches.length > 0 && (
      <HoverRing markups={props.hoverMatches} currentZoom={currentZoom} />
    )}
    {props.pulse && (
      <PulseHighlight
        markups={props.pulse.matches}
        color={props.pulse.color}
        currentZoom={currentZoom}
        onComplete={props.onPulseComplete}
      />
    )}
  </Layer>
)}
```

**Page-change dismissal** — extend the existing effect at CanvasViewport.tsx:228-236 (covered above in `useMarkupHighlight` section). On `currentPage` change, call `clearHover()` + `clearPulse()`.

**Z-order verified** (UI-SPEC §"Transient overlay coexistence" + CanvasViewport.tsx:534-705 layer structure):
1. Layer 0 PDF Image
2. Layer 1a calibration + linear preview
3. Layer 1b committed markups (listening=true)
4. **NEW Layer 2 transient — HoverRing + PulseHighlight (listening=false)**
5. Existing Layer 2 transient — polygon drawing (mounted only while drawing)
6. HTML overlays — MarkupTooltip, MarkupContextMenu (zIndex 25-30)

---

## Shared Patterns

### Inline-style + COLORS tokens (no Tailwind in chrome path)

**Source:** `src/renderer/src/components/StatusBar.tsx`, `Toolbar.tsx`, `MarkupContextMenu.tsx`, `ConfirmationToast.tsx`, `MarkupTooltip.tsx`, `ScaleContextMenu.tsx` — every chrome component.
**Apply to:** All Phase 6 chrome components — `CanvasHeaderBar`, `ThumbnailStrip`, `Thumbnail`, `TotalsPanel`, `TotalsPanelHeader`, `TotalsCategoryBlock`, `TotalsRow`, `TotalsRowContextMenu`, `Splitter`.

**Excerpt (StatusBar.tsx:1-4 + 42-56):**
```typescript
import { COLORS } from '../lib/constants'

return (
  <div style={{
    height: 28,
    background: '#252526',                           // == COLORS.secondary
    borderTop: '1px solid #3c3c3c',                  // == COLORS.border
    display: 'flex', alignItems: 'center',
    padding: '0 16px',
    fontSize: 13, fontWeight: 400,
    color: '#cccccc',                                // == COLORS.textPrimary
    flexShrink: 0
  }}>
```

**`COLORS` constant (constants.ts:10-24):**
```typescript
export const COLORS = {
  dominant: '#1a1a1a', secondary: '#252526', accent: '#0078d4',
  accentHover: '#1a86db', accentActive: '#0067b8', border: '#3c3c3c',
  textPrimary: '#cccccc', textSecondary: '#808080', textOnAccent: '#ffffff',
  hoverSurface: '#2d2d30', activeSurface: '#37373d', titleBar: '#1e1e1e',
  warning: '#e8a838'
} as const
```
**Phase 6 introduces zero new color tokens** (UI-SPEC §"Color"). Reference `COLORS.*` identifiers, not hex literals — except where mirroring an existing file that uses literals (StatusBar uses `'#252526'` directly; Phase 6 components should prefer `COLORS.secondary` for consistency, but the literal is acceptable when copying a pattern).

---

### Parent-owned-lifecycle for transient UI

**Source:** `src/renderer/src/components/MarkupTooltip.tsx`, `ConfirmationToast.tsx`, `MarkupContextMenu.tsx`, `CanvasViewport.tsx:184-243`.
**Apply to:** `PulseHighlight`, `HoverRing`, `TotalsRowContextMenu`, the Phase 6 ConfirmationToast reuse for "Copied {label}".

**The contract (ConfirmationToast.tsx:9-15) — quoted comment is the law:**
```
/**
 * Pure presentational component — NO auto-dismiss timer (setTimeout removed per MEDIUM #3 review).
 * Persistence is owned by the parent (CanvasViewport): dismissed on page change,
 * new calibration start, or explicit user action (Verify / Dismiss).
 */
```

**Page-change dismissal (CanvasViewport.tsx:222-243):**
```typescript
useEffect(() => { setToast(null) }, [currentPage])
useEffect(() => {
  setHoverState(null); setTooltipShown(false); setContextMenu(null)
  if (hoverTimerRef.current !== null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
}, [currentPage])
useEffect(() => {
  if (calibState.mode === 'drawing') setToast(null)
}, [calibState.mode])
```
**For Phase 6:** extend this block to also clear `hoverMatches` and `pulse` on `currentPage` change.

---

### Defer-listener-registration for right-click menus

**Source:** `src/renderer/src/components/MarkupContextMenu.tsx:30-52`, `ScaleContextMenu.tsx:19-41`.
**Apply to:** `TotalsRowContextMenu` (D-14).

**Excerpt (MarkupContextMenu.tsx:30-52) — copy verbatim:**
```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent): void => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
  }
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }
  // Defer listener registration so the triggering right-click doesn't immediately close the menu
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
```

---

### Zoom-compensated stroke widths (canvas overlay visuals)

**Source:** `src/renderer/src/components/CanvasViewport.tsx:457-460` (`POINT_RADIUS = 6 / currentZoom; LINE_STROKE_WIDTH = 2 / currentZoom; LINE_DASH = [8 / currentZoom, 4 / currentZoom]`); `markup/LinearMarkup.tsx:33, 51` (`STROKE_BASE_PX = 2; const strokeWidth = STROKE_BASE_PX / currentZoom`).
**Apply to:** `PulseHighlight`, `HoverRing`.

**Excerpt (LinearMarkup.tsx:33-51):**
```typescript
const STROKE_BASE_PX = 2
// ...
const strokeWidth = STROKE_BASE_PX / currentZoom
```

**Phase 6 specific (UI-SPEC):**
- HoverRing: `2 / currentZoom` stroke; `4 / currentZoom` outward offset.
- PulseHighlight: stroke linearly interpolates `6 / currentZoom → 2 / currentZoom` over 1500ms.

**Exception** (CountPinMarkup.tsx:18-20): `PIN_RADIUS_WORLD = 10` is **world-anchored** (no `/zoom` division — pins are "stamps on the plan"). HoverRing/PulseHighlight rings around count pins use `radius = 10 + offset` where offset IS zoom-compensated. RESEARCH §11 Q3 calls out this asymmetry — accept it.

---

### Per-primitive Zustand selectors with stable fallbacks (EMPTY_MARKUPS rule)

**Source:** `src/renderer/src/components/CanvasViewport.tsx:38, 84-94, 180`.
**Apply to:** `useThumbnailRender` (per-page slice subscription), `useBoqLive` (does NOT need this — see RESEARCH §2 lines 240-243), `CanvasHeaderBar` (per-page markup slice for hasNonCount detection).

**Excerpt (CanvasViewport.tsx:35-38 + 180):**
```typescript
// Stable empty-array reference for the pageMarkups selector fallback.
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop.
const EMPTY_MARKUPS: Markup[] = []

// ...
const pageMarkups = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)
```

**Primitive-fallback variant (CanvasViewport.tsx:88-92):**
```typescript
// B4 fix: subscribe to the zoom primitive so changes trigger a re-render.
// Reading through getViewport(page).zoom inside render bypasses the subscription
// (getViewport is a stable function reference). The `?? 1` fallback is a primitive
// literal so Object.is equality works — same pattern as EMPTY_MARKUPS precedent.
const currentZoom = useViewerStore((s) => s.pageViewports[currentPage]?.zoom ?? 1)
```

**When to apply (RESEARCH §2 lines 240-243):**
- ✅ Per-page slice: `s.pageMarkups[N] ?? EMPTY_MARKUPS` (would freshly allocate `[]` every render otherwise).
- ❌ Whole-record slice: `s.pageMarkups` (always defined and stable — no fallback needed).

---

### Module-level imperative ref for cross-component canvas actions

**Source:** `src/renderer/src/components/CanvasViewport.tsx:51-60` (`getCalibrationControls`), `:41-49` (`getCanvasControls`).
**Apply to:** `CanvasHeaderBar` reuses `getCalibrationControls()?.activate()` for the inline Set Scale link (RESEARCH §"Don't Hand-Roll" + UI-SPEC §"CanvasHeaderBar" line 298: "must NOT duplicate the calibration trigger code").

**Excerpt (CanvasViewport.tsx:51-60):**
```typescript
let _calibrationControls: {
  activate: () => void
  activateVerify: () => void
  cancel: () => void
} | null = null

export function getCalibrationControls() {
  return _calibrationControls
}
```

**Caller pattern (Toolbar.tsx:173-181):**
```typescript
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
**For CanvasHeaderBar:** simpler — just `onClick={() => getCalibrationControls()?.activate()}` since the header bar's link only ever activates (never cancels — there's no "is calibrating" state on the link, the link only renders when uncalibrated).

**Do NOT introduce a new module-level ref for Phase 6.** UI-SPEC and RESEARCH §11 Q1 both prefer prop-flow for `useMarkupHighlight` (App.tsx orchestrator pattern).

---

### Test scaffold (vitest jsdom + React.createElement)

**Source:** `src/tests/markup-context-menu.test.ts:1-72`.
**Apply to:** All 15 Phase 6 component tests.

**Excerpt (markup-context-menu.test.ts:1-40):**
```typescript
/** @vitest-environment jsdom */
/**
 * Render tests use React.createElement (not JSX) because vitest.config.ts's
 * include glob captures only *.test.ts (not .tsx). Mirrors markup-namepopup.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MarkupContextMenu } from '@renderer/components/MarkupContextMenu'

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(element) })
  return {
    container, root,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    }
  }
}
```

**Store reset (markup-context-menu.test.ts:61-71):**
```typescript
beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {}, categories: {}, categoryOrder: [],
    undoStack: [], redoStack: []
  })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})
```

**Aggregator fixture builders (boq-aggregator.test.ts:7-37) — reuse for `use-boq-live.test.ts` and `totals-panel-render.test.ts`:**
```typescript
function countMarkup(opts: ...): CountMarkup { ... }
function linearMarkup(opts: ...): LinearMarkup { ... }
function areaMarkup(opts: ...): AreaMarkup { ... }
function perimeterMarkup(opts: ...): PerimeterMarkup { ... }
```

---

## No Analog Found

Files where the codebase has no close existing match — planner uses RESEARCH.md patterns directly:

| File | Role | Reason |
|------|------|--------|
| `src/renderer/src/components/Splitter.tsx` | chrome (drag handle) | No splitters currently in the app. Window-level pointermove pattern is well-known but not in repo. **Use RESEARCH §6 lines 1018-1094 verbatim.** |
| `src/renderer/src/hooks/useUiPanels.ts` | localStorage hook | No localStorage usage in repo currently (per CONTEXT line 167: "localStorage usage — currently very limited"). **Use RESEARCH §5 lines 828-918 verbatim.** |
| `src/tests/use-ui-panels.test.ts` | localStorage test | No existing test stubs `localStorage` — vitest jsdom env provides real `window.localStorage`; reset between tests via `localStorage.clear()` in `beforeEach`. |
| `src/tests/highlight-overlay-listening.test.ts` | Konva listening regression guard | No existing Konva-tree-shape test pattern; novel test type. Inspect the rendered react-konva tree's `listening` prop on every Circle/Line node. |

---

## Per-File Quick Reference (planner cheat sheet)

| File | Primary Analog | Key Pattern Aspect | Critical Nuance |
|------|----------------|--------------------|-----------------|
| CanvasHeaderBar.tsx | StatusBar.tsx | inline-style + COLORS + conditional scale-text branches | Return `null` when `totalPages === 0`; reuse `getCalibrationControls()?.activate()` |
| ThumbnailStrip.tsx | Toolbar.tsx (chrome) + RESEARCH §6 (slim rail) | flex column + IntersectionObserver lazy-mount children | No `react-virtuoso`; hand-rolled IO; rail `width: 28px` collapsed |
| Thumbnail.tsx | usePdfRenderer.ts:36-60 | PDF.js render + cancellation + 2D Canvas overlay | Two-canvas composite (page + overlay); cap canvas px-width via `(140 * dpr) / pageBaseWidth` |
| TotalsPanel.tsx | StatusBar.tsx + useExport.ts:79 | `useBoqLive()` consumer; three-variant empty-state | NO `EMPTY_MARKUPS` fallback here (aggregator already handles) |
| TotalsPanelHeader.tsx | StatusBar.tsx:42-87 | label/value rows with em-dash fallback | 5 fields per UI-SPEC; `Page:` reads `currentPage`, not aggregator |
| TotalsCategoryBlock.tsx | Toolbar.tsx:322-353 | chevron toggle ▸ ▾ | Heading height 32px; NO color chip on heading |
| TotalsRow.tsx | CountPinMarkup.tsx:46-58 (event triplet) | hover/click/right-click + color chip on item-name only | Tabular-nums on quantity; cycle-dot uses fixed-width slot |
| TotalsRowContextMenu.tsx | MarkupContextMenu.tsx (1:1) | defer-listener-registration; outside-click + Escape dismissal | `setTimeout(0)` defer is **mandatory** |
| PulseHighlight.tsx | ConfirmationToast.tsx (lifecycle) + LinearMarkup.tsx:51 (zoom comp.) | rAF interpolation 0.85→0 opacity, 6→2 stroke, 1500ms ease-out | **`listening={false}` on every shape**; cancelAnimationFrame in cleanup; `radius = 10 + offset` for count pins |
| HoverRing.tsx | MarkupTooltip.tsx (pure presentational) + CanvasViewport.tsx:546-580 (Konva non-listening) | white #ffffff @ 0.4 opacity, 2/zoom stroke, 4/zoom offset, no animation | **`listening={false}` on every shape**; per-markup geometry (3 cases) |
| Splitter.tsx | RESEARCH §6 (no in-repo analog) | window-level pointermove/pointerup; commit on pointerup only | **Pitfall 11**: pointermove on window, not splitter element |
| useBoqLive.ts | useExport.ts:79 + CanvasViewport.tsx:84-94 | 8 primitive Zustand selectors → `useMemo(aggregateBoq, [...])` | **Pitfall 2**: do NOT use `useStore((s) => s)` — use 8 specific slices |
| useUiPanels.ts | RESEARCH §5 (no in-repo analog) | `useState(readStorage) + useEffect writeStorage`; try/catch parse | **Pitfall 5**: silent fallback to defaults on parse failure; defensive shape check |
| useMarkupHighlight.ts | CanvasViewport.tsx:184-217 | useState + useCallback (mirrors existing hover lifecycle) | Lifted to App.tsx (Q1 Option A); page-change auto-clear |
| useThumbnailRender.ts | usePdfRenderer.ts (full file) | per-page raster + 2D overlay + 200ms debounce subscribe | **Pitfall 10**: read latest at fire time via `useMarkupStore.getState()`, not closure; `EMPTY_MARKUPS` fallback applies here |
| usePageLabels.ts | usePdfRenderer.ts:72-92 | one-shot async derive with `cancelled` flag | Single fetch per pdfDocument change; cache via state |
| App.tsx (modified) | RESEARCH §6 lines 974-1009 | three-column flex row; `minWidth: 0` on center column | Relocate toasts inside center column relative wrapper |
| CanvasViewport.tsx (modified) | self (existing Layer 2 polygon block at lines 707-763) | new Layer 2 transient block with HoverRing + PulseHighlight | Both must have `listening={false}` on every shape; consume props from App.tsx |

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/hooks/`, `src/renderer/src/stores/`, `src/renderer/src/lib/`, `src/renderer/src/types/`, `src/tests/`
**Files scanned:** 19 components, 10 hooks, 4 stores, 12 lib files, 45 test files (skimmed for patterns); read in detail: StatusBar, Toolbar, MarkupContextMenu, MarkupTooltip, ConfirmationToast, ScaleContextMenu, CanvasViewport, CountPinMarkup, LinearMarkup, AreaMarkup (head), App, EmptyState, useExport, usePdfRenderer, useKeyboardShortcuts (head), useMarkupTool (head), boq-aggregator (head), boq-types, constants, types/markup, viewerStore, scaleStore (head), markupStore (head), markup-context-menu.test, boq-aggregator.test (head)
**Pattern extraction date:** 2026-05-05
**Confidence:** HIGH — every Phase 6 file maps to a concrete in-repo analog (with file:line citation) or is documented as a `Don't Hand-Roll` reuse target; the only files without in-repo analog (Splitter, useUiPanels) have explicit locked design in RESEARCH §5/§6.
