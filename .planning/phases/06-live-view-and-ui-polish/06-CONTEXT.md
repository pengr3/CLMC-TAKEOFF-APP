# Phase 6: Live View and UI Polish - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a live running-totals sidebar panel that mirrors the BOQ export 1:1, a thumbnail-strip page navigator on the opposite sidebar, and a slim status indicator above the canvas — completing the day-to-day takeoff workflow so an estimator never has to export just to see quantities or hunt for the next page to work on.

**In scope:**
- Right-side **TotalsPanel** that reuses `boq-aggregator.ts` to render a live, structured BOQ view (project metadata header → categories → items → per-UoM subtotals → grand totals).
- Left-side **ThumbnailStrip** with virtualized/lazy rendering of each page as a small raster + live markup overlay, plus per-thumbnail badges (page label, markup count, scale-status icon, active-page outline).
- **CanvasHeaderBar** — a slim strip above the canvas showing the current page label, scale status, and an inline "Set Scale" link if uncalibrated (the existing bottom StatusBar is retained for redundancy).
- Click/hover/right-click interaction on TotalsPanel rows: click cycles through pages containing matches with a fading pulse-ring on the matched markups; hover faintly highlights matches on the current page; right-click → "Copy as text".
- Collapsible category headings inside TotalsPanel.
- Resize handles on each panel (drag inner edge), collapse buttons that fold each panel into a slim rail; widths + open/closed state persist to **localStorage** (not in the .clmc project file).

**Out of scope:**
- Toggle visibility of markup categories on/off ("show/hide layers") — v2 PROD-02.
- Sortable / filterable / searchable totals (e.g., search-as-you-type on item names).
- Custom-template export, item library, recent-files list, multi-window editing.
- Per-thumbnail right-click context menu (rename page, hide, etc.).
- Custom precision / rounding controls in the TotalsPanel.
- Any AI-assisted item recognition or auto-detection.

</domain>

<decisions>
## Implementation Decisions

### Layout & Screen Real Estate

- **D-01:** Three-column app shell: **ThumbnailStrip on the left, CanvasViewport in the center, TotalsPanel on the right.** Canvas owns the largest share of horizontal space at any panel state. Vertical order remains TitleBar → Toolbar → (Strip | Canvas | Totals) → StatusBar. The CanvasHeaderBar (D-19) sits inside the center column above CanvasViewport.
- **D-02:** Both panels are **open by default on every launch**, then their open/closed state is restored from localStorage on subsequent launches. First-time users see the value immediately; returning users get their preference back.
- **D-03:** Each panel has a **drag-to-resize inner edge** (vertical splitter between panel and canvas) and a **collapse button on its outer border** that folds the panel into a slim rail (~28–32px). The slim rail still shows the chevron to re-expand. Widths and open/closed state persist to localStorage under stable keys (e.g., `clmc.ui.thumbnails.{open,width}`, `clmc.ui.totals.{open,width}`). **Not** persisted into `.clmc` — UI state is per-machine, not per-project, to keep project files clean.

### Totals Panel — Content & Shape

- **D-04:** TotalsPanel **reuses the existing `boq-aggregator.ts` `BoqStructure`** verbatim — the panel becomes a live preview of what `Export` produces. There must be ONE aggregator, ONE shape, and ZERO divergence between the live view and the .xlsx/.csv output. Re-aggregate reactively on any change to `pageMarkups`, `categories`, `categoryOrder`, `pageScales`, or `globalUnit`.
- **D-05:** Panel layout mirrors BOQ export structure: project metadata header (D-08) → category heading row → item rows → per-UoM subtotal rows → grand total bar. Unit-of-measure formatting matches the export (count `ea`, length `globalUnit`, area `globalUnit²`).
- **D-06:** **Item-row coloring matches export D-13:** color is applied to the *Item name* cell only (a small fill chip behind the name) — not as a row tint, not on category headings. Color is read via `getColorForName(name)` from markupStore. Mirrors the BOQ Excel cell styling exactly so canvas → panel → spreadsheet are visually continuous.
- **D-07:** **Uncalibrated-page handling matches BOQ export D-06 exactly:** counts on uncalibrated pages contribute normally; linear/area/perimeter markups on uncalibrated pages are silently excluded from the live totals. The panel never shows phantom `0 m` or `NaN`. The CanvasHeaderBar (D-19) carries the user-facing nudge to calibrate; the panel itself is silent on this. Live view = export view, exactly.
- **D-08:** **Project metadata header** at the top of the panel mirrors BOQ export D-09 — Project name, source PDF filename, total pages, total markups, current page. Renders even when there are zero markups. Reinforces "this panel = your live BOQ."
- **D-09:** **Empty-state copy** is contextual:
  - No PDF open → "Open a PDF to begin."
  - PDF open, zero markups → "Place markups to see totals."
  - PDF open, markups exist but all on uncalibrated pages and all are non-count types → fall back to "Place markups on a calibrated page to see length and area totals."

### Totals Panel — Interactivity

- **D-10:** **Click an item row → jump to the first page containing matching markups, then cycle on subsequent clicks.** First click navigates to page N₁; second click on the same row navigates to N₂; wraps around. The cycle index is held in a transient hover/click state on the panel — does not persist across mounts. After a page change triggered by row-click, the matching markups on that page get the pulse highlight (D-12).
- **D-11:** **Hover an item row → faintly highlight every matching markup on the *currently visible page only*.** No navigation, no permanent state. Removes on mouse-leave. Visually distinct from the click-pulse (e.g., a steady, subtle outer ring vs the click's animated pulse) so the user can tell hover preview apart from "you just navigated here."
- **D-12:** **Click highlight visual is a pulsing ring/glow that fades out after ~1.5s.** Renders on the markup overlay layer in canvas-space; respects per-markup geometry (circle around count pins, polyline outline for linear, polygon outline for area/perimeter). Single fade — no persistent selection state to clear. Implementation: the pulse is a transient annotation owned by CanvasViewport (parent-owned-lifecycle pattern; mirrors `MarkupTooltip` and `ConfirmationToast`).
- **D-13:** **Category-heading click toggles collapse/expand** of that category's items + subtotal block. Heading remains visible (with a chevron). Collapsed-state persistence: Claude's discretion — recommend localStorage so a user who folds Plumbing on Monday opens to it folded on Tuesday.
- **D-14:** **Right-click an item row → context menu with "Copy as text"** that copies a tab-separated string `{itemName}\t{quantity}\t{uom}` to the clipboard. Mirrors `MarkupContextMenu` styling and dismissal behavior.

### Thumbnail Strip — Content & Polish

- **D-15:** Each thumbnail = **rasterized PDF page + live markup overlay**. The user sees a miniature of their actual marked-up plan. The overlay is rendered into the same offscreen canvas as the page raster (or composited over a cached page raster), keyed off the same Markup data the canvas uses — so what's on the thumbnail is always what's on the canvas at the same zoom-out.
- **D-16:** **Per-thumbnail badges** (all four):
  1. **Page label / number** — uses PDF page label if available, else `Page N`. Below the thumbnail.
  2. **Markup count chip** — small numeric chip (e.g., top-right corner) showing total markup count on that page.
  3. **Scale-status icon** — one of two small icons: a ruler (calibrated) vs a warning triangle (uncalibrated). Helps the estimator find unfinished pages at a glance.
  4. **Active-page outline** — the current page's thumbnail gets a thicker / accent-colored outline around the entire frame.
- **D-17:** **Lazy / virtualized rendering** via `IntersectionObserver`. Thumbnails generate when they enter the viewport; pages outside the visible area show a placeholder skeleton. Rationale: Phase 6 must not slow opening a 50+ page PDF. CLAUDE.md flags `react-virtuoso` as available; planner's call whether to use it or roll a hand-built IntersectionObserver-based lazy loader.
- **D-18:** **Thumbnail width: ~140px**, aspect-preserved per page. Wide enough to identify the plan at a glance and read the page label; narrow enough that several pages fit on a 1080p screen. The drag-resize handle on the strip can adjust this.
- **D-19:** **Thumbnail markup overlay refresh = on-commit, debounced ~200ms.** Hooks into markupStore subscription; any commit (place, delete, recolor, undo, redo) schedules a refresh of the affected page's thumbnail after a 200ms quiet window. Tracks reality during normal editing; doesn't thrash when the user holds a tool.
- **D-20:** **CanvasHeaderBar** — a slim strip above CanvasViewport showing the **current page label** (left) and **scale status** (right). When the current page is uncalibrated AND has any non-count markups, the scale-status segment renders an inline `Set Scale` action that activates the existing scale tool. Existing bottom StatusBar is retained unchanged — this is additive polish for the place the estimator's eyes actually rest. The header-bar height is small (~28px) and styled consistently with TitleBar / StatusBar tokens.

### Claude's Discretion

- **Pulse/glow visuals (D-12)** — final geometry, color, opacity curve, easing, and exact duration (~1.5s as a target). Must use zoom-compensated stroke widths (consistent with the project's existing pattern: divide by `currentZoom` so the visual size is constant across zoom levels). The ring should not persistently elevate hit-target z-order.
- **Hover highlight visual (D-11)** — must be visually distinct from the click pulse. Recommend a steady low-opacity outer ring at ~50% of the click-pulse intensity. Same zoom-compensated stroke discipline.
- **Slim-rail width (D-03)** — recommend 28–32px, just wide enough for an iconified expand button and a chevron.
- **Splitter handle styling (D-03)** — match the dark-theme dividers already used in StatusBar and Toolbar; ~4px hit area with hover affordance; mouse cursor changes to `col-resize` on hover.
- **localStorage key naming** — recommend a single namespaced object under `clmc.ui` (e.g., `{ thumbnails: { open, width }, totals: { open, width }, collapsedCategories: string[] }`) so future UI prefs slot in without sprawl. Survive corruption: any parse failure resets to defaults silently.
- **Aggregator subscription strategy** — recommend a memoized derive: subscribe to the primitive Zustand fields the aggregator depends on (with stable EMPTY fallbacks per the `0e1a8e0` pattern), recompute on any change. Profile if a 200+-markup project drops frames during rapid placing; if so, debounce the recompute.
- **Cycle-index state for D-10 row-click navigation** — local `useRef`/`useState` on the row component or panel; resets on category-collapse or row-leave. Not persisted.
- **Thumbnail page-label resolution** — try `pdfDocument.getPageLabels()` from PDF.js first (some construction PDFs carry "A1.01"-style labels); fall back to `Page N` when absent.
- **Empty-state copy (D-09)** — final wording is Claude's; the three contextual variants must be present.
- **Splitter / collapse animation** — short (~150ms) ease, or none. No big animations — this is a tool, not a marketing surface.
- **Right-click "Copy as text" payload format (D-14)** — `{name}\t{quantity}\t{uom}` is the recommended baseline; round quantity to 2dp for length/area, integer for count, matching the BOQ export display rules.
- **CanvasHeaderBar — "Set Scale" inline action wiring** — should call the same setActiveTool('scale') path the Toolbar uses, NOT duplicate the calibration trigger code.
- **Thumbnail rasterization DPI** — pick a low DPI (~36–60 dpi) so 50+ pages don't pressure GPU; profile against the Chromium canvas-size limit noted in STATE.md pitfalls.
- **Toggle keyboard shortcuts** — optional. If added, mirror existing `isTextInputActive()` guard pattern from `useKeyboardShortcuts.ts`. Recommend leaving keyboard panel toggles out of v1 unless trivially small to add.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — **VIEW-01** (live running totals panel) and **PDF-05** (thumbnail strip page navigation). Both must pass by end of phase.
- `.planning/ROADMAP.md` Phase 6 — Goal text and 3 success criteria (live totals panel updating immediately, thumbnail-strip navigation, totals panel doesn't obstruct canvas on 1080p).

### Live Totals = BOQ Export Single Source of Truth (DO NOT diverge)
- `.planning/phases/05-boq-export/05-CONTEXT.md` — **D-04 export unit, D-06 uncalibrated-page rule, D-08 metadata block, D-13 item-cell coloring, D-22 BoqStructure shape**. Phase 6 reuses these decisions verbatim. Any change to BOQ export must propagate to TotalsPanel (and vice versa) — they share the aggregator.
- `src/renderer/src/lib/boq-aggregator.ts` — pure function: `(markupStore, scaleStore, projectStore, viewerStore) → BoqStructure`. **Reuse — do not duplicate.** TotalsPanel mounts it as a memoized derive.
- `src/renderer/src/lib/boq-types.ts` — `BoqStructure`, `BoqCategory`, `BoqItem` types. The TotalsPanel renders this shape directly.

### Color Model (per-name-group, not per-category)
- `.planning/phases/03.1-markup-gap-closure-and-visual-redesign/03.1-CONTEXT.md` — **D-26 / D-27 / D-29:** color is per-name-group (`Markup.color`), not per-category. `getColorForName(name)` is the canonical lookup the panel must use. Category headings in the TotalsPanel must NOT carry color.
- `src/renderer/src/types/markup.ts` — `Markup.color`, `MARKUP_PALETTE`, contrast utilities. Item-cell fill in TotalsPanel reads `Markup.color`.

### Stores & Data Sources
- `src/renderer/src/stores/markupStore.ts` — `pageMarkups`, `categories`, `categoryOrder`, `getMarkups(page)`, `getColorForName(name)`. Aggregator iterates these; row-click navigation resolves "first page with matches" by scanning `pageMarkups`.
- `src/renderer/src/stores/scaleStore.ts` — `pageScales`, `globalUnit`. Aggregator depends on both for unit conversion and uncalibrated-page detection.
- `src/renderer/src/stores/viewerStore.ts` — `totalPages`, `currentPage`, `pageViewports[currentPage]?.zoom`, `setPage(n)`. Thumbnail strip writes via `setPage`; row-click navigation calls `setPage` then triggers the pulse.
- `src/renderer/src/stores/projectStore.ts` — `currentFilePath`, `isSaving`, `isExporting`. Metadata header (D-08) reads from here. UI panel state lives in **localStorage** — not in this store.

### Established Patterns to Follow
- `.planning/STATE.md` §Key Decisions — **Zoom-compensated Konva overlay visuals** (divide stroke widths and radii by `currentZoom`). The pulse and hover rings (D-11/D-12) MUST follow this rule.
- `.planning/STATE.md` §Key Decisions — **Module-level constants pattern (commit `0e1a8e0`, EMPTY_MARKUPS)** — TotalsPanel selectors must use stable empty fallbacks. Never invoke methods inside Zustand selectors.
- `.planning/STATE.md` §Key Decisions — **Parent-owned lifecycle for transient UI** (toast, popup, MarkupTooltip, ConfirmationToast). The pulse-highlight and hover ring follow this pattern: CanvasViewport owns the lifecycle, the visual component is presentational.
- `.planning/STATE.md` §Key Decisions — **Layer 1 split (1a non-listening, 1b listening=true)**. Panel-driven highlights render on transient overlay layers (Layer 2 territory) so they don't pollute markup hit-testing.
- `.planning/phases/03-markup-tools-and-editing/03-CONTEXT.md` — `useState + useCallback` pattern for tool-style hooks (instead of useReducer); used here if a `useTotalsPanel` or `useThumbnailStrip` hook emerges.
- `.planning/phases/04-project-persistence/04-CONTEXT.md` — `subscribeWithSelector` middleware on stores for fine-grained updates; the aggregator memo can subscribe to the slices it actually needs.

### UI Patterns to Mirror
- `src/renderer/src/components/StatusBar.tsx` — current page + scale display + COLORS tokens. CanvasHeaderBar (D-20) styling and divider pattern come from here.
- `src/renderer/src/components/MarkupContextMenu.tsx` — right-click menu pattern for D-14 "Copy as text".
- `src/renderer/src/components/MarkupTooltip.tsx` — parent-owned-lifecycle, debounced hover. Pattern for hover-highlight (D-11) coordination between panel and canvas.
- `src/renderer/src/components/ConfirmationToast.tsx` — parent-owned-lifecycle for transient UI; same pattern for the pulse-highlight (D-12).
- `src/renderer/src/components/ScalePopup.tsx` / `MarkupNamePopup.tsx` — inline-style modal styling reference if any sub-modal is needed (none planned for Phase 6).
- `src/renderer/src/components/Toolbar.tsx` — `IconButton` and the file-action cluster. Panel toggle buttons may live here (Claude's call whether on Toolbar vs on the panel-edge collapse button only).

### Hooks & Lib
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — `isTextInputActive()` guard pattern; reuse if any panel-toggle keyboard shortcut is added.
- `src/renderer/src/hooks/useExport.ts` — already wraps the aggregator for export; the TotalsPanel's memoized derive can mirror its data-source plumbing without going through IPC.
- `src/renderer/src/hooks/useViewportControls.ts` — owns zoom/pan transforms. Row-click navigation may need to invoke "frame-to-fit-page" logic; coordinate with this hook.
- `src/renderer/src/lib/markup-math.ts` — `polylineLength`, `polygonArea`, `pixelLengthToReal`, `pixelAreaToReal`. Aggregator already composes these — no new math required for Phase 6.
- `src/renderer/src/lib/scale-math.ts` — `MM_PER_UNIT`, `formatScaleRatio`. Used transitively.

### PDF.js Page Labels
- `pdfjs-dist 5.5.x` — `pdfDocument.getPageLabels(): Promise<string[] | null>`. Used by ThumbnailStrip per-thumbnail labels (D-16) when available.

### Constraints (still in effect from earlier phases)
- `CLAUDE.md` — Windows desktop, offline-first, markup-precision-on-zoom is critical. Phase 6 must not regress markup pinning at any zoom level.
- `CLAUDE.md` — react-virtuoso is noted as a deferrable optimization for large page lists; planner decides whether to introduce it now (D-17) or stay with raw IntersectionObserver.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`boq-aggregator.ts`** — already produces the `BoqStructure` the panel renders. No new aggregation code; TotalsPanel is a renderer over this output.
- **`getColorForName(name)`** in `markupStore` — direct fit for D-06 item-cell color.
- **`MarkupTooltip`** — its parent-owned-lifecycle pattern transfers directly to the hover-ring + click-pulse highlights (D-11/D-12).
- **`MarkupContextMenu`** — pattern + positioning logic to model the right-click "Copy as text" menu (D-14) on.
- **`StatusBar.tsx`** — page + scale display logic + dark-theme tokens; CanvasHeaderBar (D-20) is a slimmer cousin of this.
- **`ConfirmationToast`** — parent-owned-lifecycle for ephemeral UI; pulse-highlight follows the same shape (parent owns the timer + dismissal).
- **PDF rendering pipeline** (`usePdfRenderer`, `usePdfDocument`) — thumbnail rasterization can reuse the same PDF.js `getPage().render()` flow at lower DPI; no need to introduce a second PDF stack.
- **`subscribeWithSelector` middleware** — already on markupStore + projectStore. The aggregator memo can subscribe to specific slices.
- **`MARKUP_PALETTE` + auto-contrast utilities** — already give the right per-name-group color and matching contrast for any text rendered over a colored cell.

### Established Patterns
- **Inline-style chrome** — Toolbar, modals, popups, StatusBar all use inline styles backed by `COLORS` constants. TotalsPanel + ThumbnailStrip + CanvasHeaderBar follow this. No Tailwind in the chrome path.
- **Parent-owned-lifecycle for transient UI** — pulse, hover ring, context menu all follow this. Component is presentational; parent owns timers, mount/unmount, and dismissal.
- **Module-level stable fallbacks** — Zustand selectors must use them (e.g., `EMPTY_MARKUPS`). Same rule applies to TotalsPanel selectors and ThumbnailStrip's per-page markup lookup.
- **Zoom-compensated overlay visuals** — strokes/radii divide by `currentZoom` so visuals are constant size on screen. The hover ring + click pulse must follow.
- **Layer split** — markup overlays live on Layer 1 (1a non-listening + 1b listening); transient interactions on Layer 2. The pulse is a transient — Layer 2.
- **Debounced reactive update** (`isSaving`, `200ms` thumbnail refresh, hover-tooltip timing) — established cadence; Phase 6 fits in.
- **localStorage usage** — currently very limited; introducing a small `clmc.ui` namespace is a new surface but a clean one. Wrap in a try/catch helper to silently fall back to defaults on parse error.

### Integration Points
- **`App.tsx`** — three-column shell change. Wraps existing `<CanvasViewport>` and `<EmptyState>` in a flex row that brackets them between `<ThumbnailStrip>` (left) and `<TotalsPanel>` (right). The CanvasHeaderBar mounts above CanvasViewport inside the center column. Adds local UI state for panel widths + open/closed (or via a dedicated `useUiPanels()` hook backed by localStorage).
- **`CanvasViewport.tsx`** — adds two new transient overlay primitives: `PulseHighlight` (D-12) and `HoverRing` (D-11). Both are parent-owned and triggered by props/state coming down from App.tsx (or through a dedicated `useMarkupHighlight()` hook). Must coexist with existing MarkupTooltip + MarkupContextMenu without z-order conflicts.
- **`StatusBar.tsx`** — unchanged. (CanvasHeaderBar is additive.)
- **`Toolbar.tsx`** — possibly adds two toggle buttons for ThumbnailStrip and TotalsPanel visibility (Claude's discretion vs collapse-button-on-edge only).
- **New components:** `ThumbnailStrip.tsx`, `Thumbnail.tsx` (single page tile), `TotalsPanel.tsx`, `TotalsPanelHeader.tsx`, `TotalsCategoryBlock.tsx`, `TotalsRow.tsx`, `CanvasHeaderBar.tsx`, `PulseHighlight.tsx`, `HoverRing.tsx`. Plan-time decision on the right granularity.
- **New hooks:** `useUiPanels()` (localStorage-backed open/closed + widths), `useMarkupHighlight()` (encapsulates pulse + hover ring lifecycle), optionally `useThumbnailRender()` (per-page rasterization + debounced refresh).
- **Aggregator wiring:** TotalsPanel mounts a memoized derive that subscribes to `pageMarkups`, `categories`, `categoryOrder`, `pageScales`, `globalUnit`, `currentFilePath`, `totalPages`. EXPRT-01 already uses the aggregator via `useExport`; TotalsPanel adds a second consumer — same code path, no IPC.

</code_context>

<specifics>
## Specific Ideas

- **"This panel is your live BOQ"** — the success bar is not "shows running totals" but "the panel is exactly the export you would produce, kept live." Same structure, same colors, same uncalibrated rule, same rounding. Click Export and you should recognize the .xlsx as a 1:1 frozen snapshot of what was on screen.
- **"PlanSwift-feel layout"** — left thumbnail strip + right totals panel + center canvas is the canonical estimator layout. Familiar to anyone migrating from PlanSwift / Bluebeam.
- **"Where are my 24 light switches?"** — the row-click → cycle-pages → pulse-highlight workflow is the verification flow. The estimator looks at the live count, says "that doesn't look right," clicks the row, and the canvas takes them on a guided tour of every matching markup. This is the moment Phase 6 earns its keep.
- **Hover preview, click commit** — hover gives a passive peek (current page only); click is the action that commits to navigation + pulse. Standard cursor-feel interaction; no learning curve.
- **Colors travel** — the canvas, the panel, and the .xlsx all carry the same per-name-group color. "Light Switches are blue" everywhere they appear, by virtue of `getColorForName(name)`.
- **Scale status where the eyes are** — the new CanvasHeaderBar puts page label + scale state right above the drawing, where the estimator is already looking. The bottom StatusBar is redundancy + the place experienced users will go to glance at zoom %.
- **Thumbnails are honest** — the markup overlay on each thumbnail is real, kept fresh, and matches what the canvas shows. A blank thumbnail means a blank page; a busy thumbnail means a busy page. No fake placeholders for marked-up pages.
- **localStorage, not .clmc** — UI state is per-machine. A user opening their colleague's `.clmc` file inherits THE WORK, not the colleague's panel widths.

</specifics>

<deferred>
## Deferred Ideas

### To future phases (or v2)
- **Toggle visibility of markup categories** ("show/hide layers") — v2 PROD-02. Out of scope here; the panel is read-only on category visibility.
- **Search / filter / sort inside TotalsPanel** — search-as-you-type on item names, sort columns, filter to selected category. Useful at scale; out of v1 scope. Revisit when users handle 100+ unique item names per project.
- **Per-thumbnail right-click context menu** — rename page, hide page, lock page. Not needed for VIEW-01/PDF-05; revisit if estimators ask for it.
- **Custom precision / rounding controls** in TotalsPanel — out of scope; matches export D-22 / Claude's discretion default of 2dp / integer.
- **Drag-to-reorder thumbnails** — pages are PDF-defined; reordering is a v2+ capability.
- **Multi-window editing / floating panels** — explicitly rejected in the layout decision (D-01).
- **Keyboard shortcuts to toggle panels** — could be added later if users ask. Out of v1 unless trivially small.
- **Live "Open Export" button on the panel** — interesting follow-on (button on the grand-total bar that triggers the existing Export flow). Out of scope; the Toolbar Export button + Ctrl+Shift+E already cover this.
- **Pin-to-page / lock-to-page thumbnail behavior** — for users who want to keep one reference page always visible. v2.
- **Per-page subtotal breakdown** in the panel — Phase 5 explicitly rejected page-level breakdowns in BOQ export; Phase 6 mirrors that. Revisit if user feedback asks.
- **AI-assisted item recognition / auto-detection** — explicitly out of project scope per `PROJECT.md`.
- **CanvasHeaderBar additional info** (zoom %, undo state, dirty indicator) — kept slim in v1; the bottom StatusBar carries those. Revisit as polish if users ask.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 6 scope.

</deferred>

---

*Phase: 06-live-view-and-ui-polish*
*Context gathered: 2026-05-05*
