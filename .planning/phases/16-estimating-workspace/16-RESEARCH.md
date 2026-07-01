# Phase 16: Estimating Workspace - Research

**Researched:** 2026-07-01
**Domain:** In-app cost/estimate model + dedicated workspace view-switch (Electron / React 19 / TypeScript / Zustand 5 / Konva 10)
**Confidence:** HIGH — grounded entirely in the actual codebase (every file below was read; installed versions verified via `require('<pkg>/package.json').version`).

## Summary

Phase 16 is an **extend + revert + view-add** phase against fully-shipped Phase 15 code. Phase 15 already built the entire "per-`name|type` ₱ value → aggregator cost → priced xlsx/csv" spine. Phase 16 (a) widens the stored scalar `rates: Record<string, number>` into `Record<string, { material, labor, markup }>`, (b) extends the aggregator to compute material/labor/cost/price/margin + subtotals, (c) **removes** Phase 15's inline pricing UI from the right totals panel (returning it to quantity-only), (d) builds a brand-new full-width Estimate sheet reachable from a `Plan | Estimate` toggle in the `Estimating` ribbon tab, and (e) widens the export to nine columns. Nothing here needs a new package — the stack is already installed and correct (React 19.2.4, Zustand 5.0.12, react-konva 19.2.3, exceljs 4.4.0). **No package installs → no Package Legitimacy Audit needed.**

The single highest-risk decision is **D-01: how to switch the center area between the Konva canvas ("Plan") and the Estimate sheet without breaking the canvas.** The critical finding: `CanvasViewport` sizes its Konva `Stage` from a `ResizeObserver` on its container (`CanvasViewport.tsx:257-271`), and viewer/markup/scale state lives entirely in Zustand stores (not component state) — so **markup coordinates survive an unmount** regardless. The real hazard is not data loss but a **`ResizeObserver` measuring 0×0 while hidden** and the cost of re-rasterizing the PDF on every toggle. Therefore the recommended pattern is **keep both subtrees mounted and toggle with CSS `display` (mount-preserving), driven by a `viewMode` field added to `viewerStore`** — not conditional `{mode === 'plan' ? <Canvas/> : <Estimate/>}` (which unmounts the Stage and forces a full PDF re-render + refit on every switch).

**Primary recommendation:** Add `viewMode: 'plan' | 'estimate'` to `viewerStore`; in `App.tsx` render BOTH the canvas center-column and a new `EstimateSheet` as siblings, toggling visibility via `display: none` (never conditional-mount); drive the toggle from a segmented control in `RibbonToolbar`'s Estimating tab. Widen `rates` to `Record<string, PriceEntry>` as an **additive, no-formatVersion-bump** change exactly mirroring the Phase-15 `rates` precedent, with a legacy-scalar coercion (`number → { material: n, labor: 0, markup: 30 }`) in `hydrateStores`. Extend `boq-aggregator` to compute the five money fields + three subtotal kinds. Build the Estimate grid reusing `useBoqLive` + the uncontrolled-input-with-native-listeners commit pattern proven in `TotalsRow`. Extend `boq-writers` to the nine-column layout keeping native-number ₱ cells + BOM.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `Plan \| Estimate` view state | Renderer store (`viewerStore`) | RibbonToolbar (control) | View mode is transient session UI, like `activeTool` — it belongs beside `activeTool` in `viewerStore`, NOT persisted to `.clmc` |
| Price data (`{material,labor,markup}` per `name\|type`) | Renderer store (`projectStore`) | project-serialize (persist) | Same home as Phase-15 `rates` — it IS user work, persisted to `.clmc` |
| Cost/price/margin math | Renderer pure lib (`boq-aggregator`) | — | Single source of truth feeding grid + writers (D-22 precedent) |
| Estimate grid render + inline edit | Renderer component (new `EstimateSheet`) | `useBoqLive` (data), `projectStore.setPrice` (commit) | New full-width center-area view; reuses the live aggregator hook |
| Totals-panel quantity-only revert | Renderer components (`TotalsRow`/`TotalsPanel`/`TotalsCategoryBlock`) | — | Remove Phase-15 pricing render only; keep qty/visibility/cycle |
| Nine-column export | Main process (`boq-writers.ts`) | preload mirrors (type lock) | Runs in main; xlsx numFmt + BOM stay main-side |
| Markup % default (30%) | Renderer (constant + optional project setting) | Settings tab (minimal UI) | Project-wide default with per-row override |

## Standard Stack

**No new dependencies.** Every capability is served by already-installed, already-verified packages. Versions confirmed in the live `node_modules` on 2026-07-01:

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| react | 19.2.4 | Estimate grid + segmented toggle | Already the app framework `[VERIFIED: node_modules]` |
| zustand | 5.0.12 | `viewMode` + widened `rates` state | Established store pattern `[VERIFIED: node_modules]` |
| react-konva | 19.2.3 | Plan canvas (unchanged — must not break) | The canvas being preserved across the toggle `[VERIFIED: node_modules]` |
| exceljs | 4.4.0 | Nine-column xlsx | Already the writer `[VERIFIED: node_modules]` |
| csv-stringify | 6.7.0 (declared) | Nine-column csv | Already the writer `[CITED: package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.6.0 | Ribbon icons (a `Table`/`Sheet`/`Coins` glyph for the Estimate view) | Icon for the segmented toggle button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `display` mount-preserving toggle | Conditional render `{mode==='plan' ? … : …}` | Conditional unmounts the Konva Stage → full PDF re-rasterize + refit on every toggle, and a 0×0 ResizeObserver window; **rejected** (see Pitfall 1) |
| `viewMode` in `viewerStore` | New `uiStore` | A dedicated store is cleaner in isolation but adds a fourth store + a new dirty-tracking consideration; `viewMode` is transient like `activeTool` which already lives in `viewerStore` — **prefer `viewerStore`** (do NOT add it to the serialize path) |
| `viewMode` in `viewerStore` | `useUiPanels` (localStorage) | localStorage persistence is appropriate for panel widths, but the Plan/Estimate mode should reset to `plan` per session (opening a project should land on the canvas); a store field defaulting to `'plan'` is simpler. If per-workstation persistence is later desired, promote to `useUiPanels`. |
| Reuse `useBoqLive` for the grid | New estimate-specific selector | The aggregator is already the single source of truth (D-22) and `useBoqLive` already subscribes to `rates`; a parallel selector would duplicate the nine-primitive subscription. **Reuse `useBoqLive`** (see Q4). |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — Phase 16 installs no external packages.** All libraries are already present in `package.json` and resolvable in `node_modules` (verified 2026-07-01). No `npm install` occurs in this phase.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
   USER EDITS       │  RibbonToolbar (Estimating tab)             │
   material/labor   │   [ Plan | Estimate ]  ← segmented toggle   │
   /markup rates    │        │ sets viewerStore.viewMode          │
        │           └────────┼────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│ projectStore     │   │  App.tsx <main> (center area)            │
│  .rates:         │   │  BOTH mounted; CSS display toggles which │
│  Record<key,     │   │  is visible (mount-preserving):          │
│  {material,      │   │                                          │
│   labor,         │   │  ┌─ display: (mode==='plan')────────┐    │
│   markup}>       │   │  │  CanvasViewport (Konva Stage)    │    │
│  .setPrice(k,p)  │   │  │  — markups live in Zustand; the  │    │
│  → markDirty()   │   │  │    Stage is preserved, not       │    │
└───────┬──────────┘   │  │    remounted                     │    │
        │              │  └──────────────────────────────────┘    │
        │              │  ┌─ display: (mode==='estimate')────┐    │
        │              │  │  EstimateSheet (NEW)             │    │
        ▼              │  │  grid: Item·Qty·UoM |            │    │
┌──────────────────┐   │  │   Material·Labor·Cost |          │    │
│ boq-aggregator   │──▶│  │   Markup·Price·Margin            │    │
│ per row:         │   │  │  editable cells commit setPrice  │    │
│  materialCost =  │   │  └──────────────────────────────────┘    │
│   material×qty   │   └──────────────────────────────────────────┘
│  laborCost =     │                    │
│   labor×qty      │   ┌────────────────▼─────────────────────────┐
│  cost = mat+lab  │   │  TotalsPanel (right)  — QUANTITY ONLY     │
│  price =         │   │  (Phase-15 ₱ input/cost/subtotal/grand   │
│   cost×(1+mkup)  │   │   REMOVED; qty + visibility + cycle kept) │
│  margin=price−cost│  └──────────────────────────────────────────┘
│ per category:    │
│  cost/price/     │   ┌──────────────────────────────────────────┐
│  margin subtotals│──▶│  useExport → IPC → boq-writers (main)     │
│ grand totals:    │   │  xlsx/csv: 9 cols + subtotals + grand     │
│  cost/price/     │   │  ₱ native-number cells (SUM-safe) + BOM   │
│  margin          │   └──────────────────────────────────────────┘
└──────────────────┘
```

Trace the primary use case: user opens the Estimating tab → clicks `Estimate` → `viewerStore.viewMode='estimate'` → `App.tsx` flips the CSS `display` so the `EstimateSheet` shows and the canvas hides (both stay mounted) → user types a material rate in a grid cell → `setPrice('Outlet|count', {material:...})` → `markDirty()` → `useBoqLive` recomputes → grid re-renders cost/price/margin live → Export emits the nine-column sheet.

### Recommended Project Structure (files touched/created)
```
src/renderer/src/
├── stores/
│   ├── viewerStore.ts        # + viewMode:'plan'|'estimate' + setViewMode  (transient, NOT serialized)
│   └── projectStore.ts       # rates:Record<…,number> → Record<…,PriceEntry>; setRate → setPrice
├── lib/
│   ├── boq-types.ts          # PriceEntry type; BoqItemRow += materialCost/laborCost/price/margin (+ material/labor/markup); BoqCategoryGroup += price/marginSubtotal; BoqStructure += grandTotalPrice/grandTotalMargin; AggregateOptions.rates → prices
│   ├── boq-aggregator.ts     # compute the 5 money fields + 3 subtotal kinds + 3 grand totals
│   ├── project-serialize.ts  # snapshot emits prices; hydrate coerces legacy scalar → PriceEntry
│   ├── estimate-defaults.ts  # NEW (optional): DEFAULT_MARKUP_PCT = 30 constant seam
│   └── currency.ts           # unchanged (CURRENCY_SYMBOL = '₱')
├── hooks/
│   └── useBoqLive.ts         # selector: rates → prices (one-line rename; deps unchanged)
├── components/
│   ├── RibbonToolbar.tsx     # Estimating tab: add [Plan|Estimate] segmented toggle
│   ├── EstimateSheet.tsx     # NEW — full-width grid
│   ├── EstimateRow.tsx       # NEW — one row, 3 editable cells (material/labor/markup)
│   ├── EstimateCategoryBlock.tsx  # NEW — category heading + rows + subtotal
│   ├── TotalsRow.tsx         # REMOVE inline ₱ rate input + cost span
│   ├── TotalsCategoryBlock.tsx    # REMOVE per-category cost subtotal
│   └── TotalsPanel.tsx       # REMOVE grand-total ₱ bar
└── App.tsx                   # render EstimateSheet sibling; CSS display toggle
src/main/
└── boq-writers.ts            # 9-column xlsx + csv
src/preload/
├── index.ts                  # BoqItemRow/BoqCategoryGroup/BoqStructure mirror widen
└── index.d.ts                # same mirror widen
```

### Pattern 1: `viewMode` in `viewerStore` (transient, not serialized)
**What:** Add a session-only `viewMode` field beside `activeTool`.
**When to use:** For the Plan/Estimate toggle.
**Why here:** `activeTool` (`viewerStore.ts:15`) is already a transient UI field in this store; `snapshotProject` (`project-serialize.ts:46-63`) reads ONLY explicit fields (`currentPage`, per-page viewport/scale/markups) — it never touches `activeTool`, so a sibling `viewMode` is automatically excluded from `.clmc` with zero serialize changes. `hydrate` (`viewerStore.ts:136-143`) also resets `activeTool: 'select'` — mirror that by resetting `viewMode: 'plan'` on load.
```typescript
// viewerStore.ts — additive
// state:
viewMode: 'plan' as ViewMode,          // beside activeTool: 'select'
// action:
setViewMode: (mode) => set({ viewMode: mode }),
// in setFile / resetViewer / hydrate: add  viewMode: 'plan'  (land on the canvas)
```
Guard `ViewMode` in `types/viewer.ts` next to `ActiveTool`.

### Pattern 2: Mount-preserving CSS `display` view-switch in `App.tsx`
**What:** Both center subtrees mounted; visibility toggled by CSS.
**When to use:** THE D-01 pattern.
**Why:** Avoids unmounting the Konva `Stage` (see Pitfall 1). The Estimate sheet is cheap DOM; keeping it mounted while hidden costs nothing meaningful.
```tsx
// App.tsx — inside <main>, the existing center column stays but is wrapped:
const viewMode = useViewerStore((s) => s.viewMode)
// ...
<div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
  {/* PLAN — existing CanvasHeaderBar + CanvasViewport, wrapped so we can hide it */}
  <div style={{ display: viewMode === 'plan' ? 'flex' : 'none', flexDirection:'column', flex:1, minHeight:0 }}>
    {totalPages > 0 && <CanvasHeaderBar />}
    <div style={{ flex:1, position:'relative', minHeight:0 }}>
      {totalPages === 0 ? <EmptyState /> : <CanvasViewport … />}
      {/* toasts stay here */}
    </div>
  </div>
  {/* ESTIMATE — new, mounted always, shown only in estimate mode */}
  <div style={{ display: viewMode === 'estimate' ? 'flex' : 'none', flex:1, minHeight:0 }}>
    <EstimateSheet />
  </div>
</div>
```
Note: the right `TotalsPanel` and `Splitter` remain **outside** this toggle — they show in both modes (D-02 keeps the quantity panel visible on the Plan; whether it also shows on the Estimate view is Claude's discretion — recommend keeping it, harmless and consistent).

### Pattern 3: Segmented toggle in the Estimating ribbon tab
**What:** Replace the current `renderEstimatingTab()` "Quick Export" content (`RibbonToolbar.tsx:529-555`) with a `[Plan | Estimate]` segmented control (keep the Export button too).
**How the ribbon drives it:** the tab is pure store-driven — read `viewMode` via `useViewerStore((s) => s.viewMode)` and dispatch `useViewerStore.getState().setViewMode(...)` (or the subscribed setter). This is a store toggle, NOT the module-ref pattern — module-refs (`getCanvasControls`/`getCalibrationControls`) are only for imperative canvas commands that have no React state; `viewMode` IS React state, so a store selector is correct (same reasoning STATE.md gives for `activeTool` in `viewerStore`).
```tsx
const viewMode = useViewerStore((s) => s.viewMode)
const setViewMode = useViewerStore((s) => s.setViewMode)
// two buttons with active={viewMode==='plan'} / active={viewMode==='estimate'}
```

### Pattern 4: Widened price map — additive, no formatVersion bump
**What:** `PriceEntry = { material: number; labor: number; markup: number }`; `rates: Record<string, PriceEntry>`.
**Why additive works:** `validateV2` (`project-schema.ts:100-127`) does NOT inspect `rates` — it rides the trailing `return raw as ProjectFileV2` cast. `ProjectFileV2.rates?` is already optional (`project-schema.ts:95`). Changing its element type from `number` to `PriceEntry` is a compile-time-only change to the interface; the on-disk contract stays "an optional object under `rates`". **No formatVersion bump** (mirrors the locked Phase-15 additive decision, STATE.md lines 161/189). This is D-06's preferred path.

### Anti-Patterns to Avoid
- **Conditional-rendering the canvas** (`{mode==='plan' ? <Canvas/> : <Estimate/>}`) — unmounts the Stage. See Pitfall 1.
- **Persisting `viewMode` to `.clmc`** — it is transient session UI; adding it to `snapshotProject` would dirty the project on a mode switch and reopen into the wrong view.
- **Recomputing cost/price/margin in the grid or writer UI** — the aggregator is the single source of truth (D-22). The grid reads `item.cost/price/margin`; the writer reads the same. No `material*qty` arithmetic outside `boq-aggregator.ts` (mirrors the "no `rate*quantity` in TotalsRow" rule from 15-03).
- **A second currency constant** — reuse `CURRENCY_SYMBOL` (`lib/currency.ts`) in the renderer and the writer-local `NUMFMT_PESO` in main; do not introduce a third seam.
- **Diverging the 4 BoqRowType/BoqItemRow mirrors** — see Pitfall 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Editable spreadsheet cell that commits reliably under React 19 | A controlled `<input value={…} onChange>` | The **uncontrolled + native-listener** pattern from `TotalsRow.tsx:160-216` | 15-03 proved React 19's value-tracker suppresses synthetic `onChange` under programmatic `.value` set + native `input` dispatch, and delegates `blur` as `focusout`. The native-listener escape hatch is the ONLY approach that passes the render tests. Copy it verbatim per cell. |
| Live cost recompute on rate edit | A manual subscription / `useEffect` recompute | `useBoqLive()` | Already subscribes to `rates` (`useBoqLive.ts:42,58`) and memoizes the aggregator; renaming `rates`→`prices` keeps it live automatically. |
| ₱ formatting | A local formatter | `CURRENCY_SYMBOL` + `.toFixed(2)` (renderer), `NUMFMT_PESO='₱#,##0.00'` (writer) | Existing seams; `formatCost` non-finite→0 guard (`TotalsRow.tsx:68-71`) is the template for every money cell. |
| SUM-safe money in Excel | Pre-formatted `'₱123.45'` strings | Native number + `cell.numFmt = NUMFMT_PESO` | 15-04 locked this (`boq-writers.ts:224-232`); a string breaks `SUM()`. |
| Category grouping / collision suffix | New grouping logic | The aggregator's existing bucket + `name\|type` keying + `typeWord` suffix | Already correct; the money fields ride the same rows. |

**Key insight:** Phase 15 already solved every hard sub-problem (persistence coercion, live recompute, SUM-safe ₱, uncontrolled-input commit, single-source-of-truth aggregator). Phase 16 is almost entirely **widening existing seams**, not inventing new mechanisms. The one genuinely new artifact is the `EstimateSheet` component tree — and even it reuses `useBoqLive` + the `TotalsRow` inline-edit pattern.

## Runtime State Inventory

> This phase has a **data-shape migration** (Phase-15 scalar `rate` → `{material,labor,markup}`) but the renamed thing is a stored map VALUE shape, not a string identifier used as a key/collection name. The audit below confirms nothing outside the code + `.clmc` file holds the old shape.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **`.clmc` project files** carry `rates: Record<string, number>` (Phase-15 scalar). On reload these must coerce to `PriceEntry`. No external DB/datastore — the app persists only to `.clmc` (JSON inside a ZIP; verified: `snapshotProject`/`hydrateStores` are the only persistence path, no SQLite/Chroma/etc.). | **Data migration on load** — `hydrateStores` maps `number → { material: n, labor: 0, markup: 30 }`. Additive, no formatVersion bump. |
| Live service config | **None.** Fully offline desktop app — no n8n/Datadog/Cloudflare/external service holds any project string (verified: `CLAUDE.md` "Must work fully offline"; only IPC is local file dialogs + writers). | None. |
| OS-registered state | **None.** No Task Scheduler/pm2/launchd/systemd entries embed a rate or view name (verified: `package.json` scripts are build/dev only; no service registration). | None. |
| Secrets/env vars | **None.** No SOPS/.env/CI var references pricing shape (verified: no secrets tooling in repo; grep of package.json shows no env injection). | None. |
| Build artifacts / installed packages | **`localStorage` key `clmc.ui`** (`useUiPanels`) holds panel width + collapsed categories only — NOT rates, NOT viewMode. Safe. `out/` build artifacts regenerate from source. | None (do NOT store `viewMode` or prices in `clmc.ui`). |

**The canonical question — after every file is updated, what runtime state still holds the old scalar `rate`?** Only **on-disk `.clmc` files saved by Phase 15**. They are handled by the load-time coercion; no data is lost (a legacy `rate` becomes `material`, labor starts at 0, markup defaults to 30). This is the ONLY migration surface.

## Common Pitfalls

### Pitfall 1: Konva Stage remount / 0×0 measurement on view switch (D-01 landmine)
**What goes wrong:** If `App.tsx` conditionally renders `{viewMode==='plan' ? <CanvasViewport/> : <EstimateSheet/>}`, switching to Estimate **unmounts** `CanvasViewport`. The Konva `Stage` is destroyed and its WebGL/canvas context torn down. Switching back re-mounts it: `usePdfRenderer` re-rasterizes the current PDF page, the `ResizeObserver` re-attaches, and the auto-fit guard refires — a visible flash + wasted work every toggle. On some Chromium builds a Stage mounted inside a `display:none` ancestor also measures `contentRect` as 0×0, leaving `containerSize` stuck and the canvas mis-fit.
**Why it happens:** `CanvasViewport` derives Stage size from `ResizeObserver` (`CanvasViewport.tsx:257-271`) and the PDF from `usePdfRenderer()` keyed on the current page. Unmount discards the rasterized canvas ref (`lastValidRef`, line 275) and the observer.
**How to avoid:** **Keep both subtrees mounted; toggle with CSS `display` (Pattern 2).** Markup coordinates are never at risk — they live in `markupStore`/`scaleStore`/`viewerStore` (Zustand), not in `CanvasViewport` state — but the *render pipeline* is, and mount-preserving avoids re-rasterization entirely. When hidden with `display:none` the Stage simply stops painting; on show, React re-runs the render with the preserved `lastValidRef` canvas so there is no re-rasterize.
**Warning signs:** PDF flashes/blanks when returning to Plan; canvas fit resets to default on toggle; `ResizeObserver` fires with width 0.
**Verification:** a render test that mounts `App` (or a minimal harness), flips `viewMode` estimate→plan, and asserts the `CanvasViewport` container node is the **same DOM node** (not remounted) — or, more simply, assert both `data-testid="canvas-viewport-*"` and the estimate grid exist in the DOM simultaneously with one `display:none`.

### Pitfall 2: The 4-way BoqRowType / BoqItemRow mirror drift
**What goes wrong:** `BoqItemRow` (and `BoqStructure`/`BoqCategoryGroup`) is **inline-duplicated in four files** with a compile-time cross-process lock: `boq-types.ts` (canonical, `:36-59`), `preload/index.ts` (`:24-45`), `preload/index.d.ts` (`:14-35`), and `boq-writers.ts` (`:19-40`). Adding `materialCost`/`laborCost`/`price`/`margin` (+ `material`/`labor`/`markup`) to only some of them either breaks `npm run typecheck` or — worse — silently drops fields across the IPC boundary so the exported xlsx is missing columns.
**Why it happens:** deliberate "no shared types dir" convention (`preload/index.ts:13-16`, `boq-writers.ts:4-10`); `boq-export-ipc.test.ts` imports both sides to enforce structural equality at compile time.
**How to avoid:** treat the four definitions as one atomic edit. When you widen `BoqItemRow`, widen all four in the same task. Run `npm run typecheck` (node + web) as the gate — it will surface any missed mirror. `boq-export-ipc.test.ts` is the structural lock.
**Warning signs:** typecheck error `Property 'price' is missing in type BoqItemRow`; or export succeeds but a column is blank.

### Pitfall 3: React 19 uncontrolled-input commit gotcha (per editable cell)
**What goes wrong:** A naive controlled `<input onChange>` in the Estimate grid will NOT commit under the render-test event sequence (`.value = '42'` → native `input` → native `change` → `FocusEvent('blur')`), because React 19's value-tracker suppresses synthetic `onChange` and delegates `blur` as `focusout` (documented at length in 15-03; STATE.md line 193).
**Why it happens:** React 19 input internals (proven by a throwaway probe in 15-03 — `setRate` calls were `[]` via the onChange path).
**How to avoid:** For EACH of the three editable cells (material, labor, markup) reuse the exact `TotalsRow.tsx:160-216` recipe: `useRef` on the input, `defaultValue` seeded from the store, `useEffect` to re-seed only when the DOM value differs, and native `input`/`blur`/`keydown` listeners that commit + `stopPropagation`. Parse with `parseFloat`; clamp NaN/negative→0 (mirrors `commitRate`, `TotalsRow.tsx:178-182`); markup parses the same but its **absent** default is 30, not 0 (see Pitfall 5).
**Warning signs:** grid edits don't persist; render test's `setPrice` spy sees `[]`.

### Pitfall 4: `name|type` key consistency across store / aggregator / grid / writers
**What goes wrong:** Phase 15's rate key is `${name}|${type}` (category-INDEPENDENT), DISTINCT from the visibility key `${name}|${categoryId}` (`TotalsRow.tsx:135-147`). If the new Estimate grid keys prices by anything else (e.g. label including a `(perimeter)` suffix, or including categoryId), the same item shows different prices in different categories and the writer reads a different key than the grid wrote.
**Why it happens:** the aggregator strips the collision suffix and keys by raw `name|type` (`boq-aggregator.ts:219`); the label may carry ` (perimeter)`. The grid must derive the key from `labelToName(item.label)` + `item.type`, exactly like `TotalsRow.tsx:144-147`.
**How to avoid:** centralize the key derivation — reuse `labelToName` (`TotalsRow.tsx:74-76`, exported) and build `${labelToName(label)}|${type}`. Assert in a test that a name appearing in two categories shares one `PriceEntry`.
**Warning signs:** same-named item priced twice; export total ≠ grid grand total.

### Pitfall 5: Markup default (30%) vs. stored `markup: 0`
**What goes wrong:** After migration, `material`/`labor` default to 0 (a genuinely-unpriced row costs ₱0), but `markup` must default to **30**, not 0 — a 0% markup would make price == cost and margin == 0, silently wrong for every legacy and every not-yet-touched row.
**Why it happens:** three different "absent" semantics: absent material/labor → 0 (no cost), absent markup → 30 (project default), and a legacy scalar `rate` → material.
**How to avoid:** define `DEFAULT_MARKUP_PCT = 30` once (recommend a `lib/estimate-defaults.ts` seam, parallel to `currency.ts`). Apply it in exactly two places: (a) the hydrate coercion when a `PriceEntry` lacks `markup`, and (b) the aggregator when reading `prices[key]?.markup ?? DEFAULT_MARKUP_PCT`. Distinguish "row has an explicit markup" (use it, even if 0) from "row has no entry" (use 30). Because a fresh `setPrice` for a material edit must NOT silently pin markup to 0, `setPrice` should merge into the existing entry (spread), seeding `markup: DEFAULT_MARKUP_PCT` only when creating a brand-new entry.
**Warning signs:** every price equals its cost; margins all ₱0.00; a legacy file shows 0% markup.

### Pitfall 6: Test-infra parallel-safety (CLAUDE.md / STATE.md rule)
**What goes wrong:** New render tests for `EstimateSheet`/`EstimateRow` that modify `vitest.config.ts`, or rely on jsdom's experimental persistent `localStorage`, break the parallel executor.
**Why it happens:** `vitest.config.ts` include glob is `src/tests/**/*.test.ts` (verified); jsdom 29 needs a `localStorage` polyfill (STATE.md line 146).
**How to avoid:** name new tests `*.test.ts` (not `.tsx`) using `React.createElement` + `/** @vitest-environment jsdom */` + the in-memory `installLocalStoragePolyfill()` from `totals-row-rate-edit.test.ts:68-85`, and set `(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true` at module scope. Do NOT touch `vitest.config.ts` mid-wave.
**Warning signs:** `getItem is not a function`; "act environment not configured" false positives; config diff in a wave PR.

## Code Examples

Verified patterns pulled from the actual codebase.

### PriceEntry type + widened map (boq-types.ts / projectStore.ts)
```typescript
// boq-types.ts — NEW
export interface PriceEntry {
  material: number   // ₱ per unit
  labor: number      // ₱ per unit
  markup: number     // percent, e.g. 30
}
// projectStore.ts — widen (was Record<string, number>)
rates: Record<string, PriceEntry>
// setRate → setPrice, merging so a material-only edit preserves labor/markup:
setPrice: (key, patch) => {
  set((s) => {
    const cur = s.rates[key] ?? { material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT }
    return { rates: { ...s.rates, [key]: { ...cur, ...patch } } }
  })
  get().markDirty()   // load-bearing — mirrors setRate (projectStore.ts:111-114)
}
```

### Legacy scalar → PriceEntry coercion (project-serialize.ts hydrate)
```typescript
// Extends the existing finite-≥0 guard at project-serialize.ts:119-124.
const safePrices: Record<string, PriceEntry> = {}
if (data.rates && typeof data.rates === 'object') {
  for (const [k, v] of Object.entries(data.rates)) {
    if (typeof v === 'number') {
      // Phase-15 legacy scalar → material; labor 0; markup default (D-06).
      if (Number.isFinite(v) && v >= 0) {
        safePrices[k] = { material: v, labor: 0, markup: DEFAULT_MARKUP_PCT }
      }
    } else if (v && typeof v === 'object') {
      const e = v as Partial<PriceEntry>
      const material = Number.isFinite(e.material) && (e.material as number) >= 0 ? e.material as number : 0
      const labor    = Number.isFinite(e.labor)    && (e.labor    as number) >= 0 ? e.labor    as number : 0
      const markup   = Number.isFinite(e.markup)   && (e.markup   as number) >= 0 ? e.markup   as number : DEFAULT_MARKUP_PCT
      safePrices[k] = { material, labor, markup }
    }
  }
}
```

### Aggregator money math (boq-aggregator.ts, replacing the rate/cost block at :217-231)
```typescript
const entry = prices[`${name}|${type}`]              // prices = opts.rates ?? store.rates
const material = entry?.material ?? 0
const labor    = entry?.labor ?? 0
const markup   = entry?.markup ?? DEFAULT_MARKUP_PCT  // absent entry → project default (D-05)
const materialCost = material * acc.quantity
const laborCost    = labor * acc.quantity
const cost  = materialCost + laborCost                // internal cost (D-03)
const price = cost * (1 + markup / 100)               // client price (D-05)
const margin = price - cost
items.push({ label, quantity: acc.quantity, uom: uomFor(type, globalUnit),
  material, labor, markup, materialCost, laborCost, cost, price, margin,
  color: acc.color, type, categoryId: groupCategoryId })
// per category (extend :240-245): catCost += cost; catPrice += price; catMargin += margin
// per structure (extend :245): grandCost/grandPrice/grandMargin
```

### Estimate grid editable cell (reuse TotalsRow.tsx:160-216 recipe)
```typescript
// One ref + native listeners per cell (material shown; labor/markup identical).
const materialRef = useRef<HTMLInputElement | null>(null)
useEffect(() => {                                   // re-seed only when DOM differs
  const el = materialRef.current; if (!el) return
  const next = seedText(item.material)
  if (el.value !== next) el.value = next
}, [priceKey, item.material])
useEffect(() => {
  const el = materialRef.current; if (!el) return
  const commit = () => setPrice(priceKey, { material: clampNonNeg(el.value) })
  const onKey = (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') commit() }
  const stop = (e: Event) => e.stopPropagation()
  el.addEventListener('input', commit); el.addEventListener('blur', commit)
  el.addEventListener('keydown', onKey); el.addEventListener('click', stop); el.addEventListener('mousedown', stop)
  return () => { el.removeEventListener('input', commit); el.removeEventListener('blur', commit)
    el.removeEventListener('keydown', onKey); el.removeEventListener('click', stop); el.removeEventListener('mousedown', stop) }
}, [priceKey])   // priceKey = `${labelToName(item.label)}|${item.type}`
```

## Removal Map — Totals-panel revert to quantity-only (D-02)

Exactly what to delete (KEEP quantity display, lightbulb visibility toggle, color chip, cycle-nav/arm-tool, context menu):

| File | Remove | Keep | Line refs (current) |
|------|--------|------|---------------------|
| `TotalsRow.tsx` | `formatCost` fn; `rate` selector; `rateInputRef`; `seedRateText`; `commitRate`; both rate `useEffect`s (seed + native listeners); the inline ₱ input `<div>` block; the `totals-row-cost` `<span>`; the `CURRENCY_SYMBOL` import | `formatQuantity`; `labelToName`; `rowTypeToMarkupType`; lightbulb `toggleHiddenItem`; color chip; quantity span; cycle/arm handlers; `Plus` affordance | `:64-71`, `:140-216`, `:394-449`; import `:5` |
| `TotalsCategoryBlock.tsx` | the `totals-category-cost-subtotal` `<div>` block; the `CURRENCY_SYMBOL` import | heading; item rows; (the per-UoM quantity subtotals are NOT rendered here today — none to keep/remove) | `:131-157`; import `:4` |
| `TotalsPanel.tsx` | the pinned `totals-grand-total` ₱ bar block; the `CURRENCY_SYMBOL` import | metadata header; empty states; category list; rail; context menu | `:267-294`; import `:5` |

**Tests to update/remove/keep:**
- **DELETE** `src/tests/totals-row-rate-edit.test.ts` — asserts the inline ₱ input that D-02 removes. (It was a Phase-15 proof; its contract is gone.)
- **KEEP (must stay green)** `totals-row-cycle.test.ts`, `totals-row-context-menu.test.ts`, `totals-row-hover.test.ts`, `totals-row-visibility.test.ts`, `totals-panel-render.test.ts`, `totals-panel-empty-states.test.ts`, `totals-panel-category-collapse.test.ts` — these assert quantity/visibility/cycle behavior that survives. Verify none of them assert on `totals-row-cost`/`totals-row-rate-input`/`totals-category-cost-subtotal`/`totals-grand-total`; if any do, that specific assertion is a Phase-16 update (the render still works, only the ₱ nodes are gone).
- **UPDATE** `use-boq-live.test.ts` — the "recomputes when rates change" test now drives `prices`/`setPrice` and asserts cost/price/margin recompute (the hook stays live; the field name changes rate→price entry).

## State of the Art

| Old Approach (Phase 15) | Current Approach (Phase 16) | When Changed | Impact |
|--------------------------|------------------------------|--------------|--------|
| Single ₱ `rate` per `name\|type` | `{ material, labor, markup }` per `name\|type` | this phase (D-03/05/06) | Widen store + serialize + aggregator + writers |
| Pricing inline on the totals panel | Pricing in a dedicated Estimate workspace | this phase (D-01/02) | Remove totals-panel ₱ UI; build `EstimateSheet`; add view toggle |
| Export: Item·Qty·UoM·Rate·Cost (5 col) | Item·Qty·UoM·Material·Labor·Cost·Markup·Price·Margin (9 col) | this phase (D-08) | Widen both writers + preload mirrors |
| Cost only (subtotal + grand) | Cost + Price + Margin (subtotals + grand) | this phase (D-03/05/07) | Aggregator emits three subtotal kinds + three grand totals |

**Deprecated/outdated:** Phase-15's `TotalsRow` inline ₱ rate input + `data-testid="totals-row-cost"`/`totals-category-cost-subtotal`/`totals-grand-total` render nodes are superseded (D-02). The scalar `rates: Record<string, number>` type is superseded by `Record<string, PriceEntry>` (D-06), with a load-time coercion preserving old files.

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement** — all edits go through a GSD command; no direct repo edits outside a workflow.
- **Windows desktop, fully offline** — no internet dependency; no external service may hold project state (drives the "no live service config" Runtime State finding).
- **Markup precision on zoom is critical** — do NOT disturb the Konva Stage/markup pipeline (reinforces Pitfall 1: mount-preserving view switch).
- **Stack is locked** — Electron 35 / React 19 / TS / electron-vite / pdfjs-dist / Konva+react-konva / Zustand / ExcelJS / csv-stringify; **do NOT introduce new libraries** (Phase 16 needs none).
- **Project files are JSON in a ZIP `.clmc`** — no SQLite; persistence is `snapshotProject`/`hydrateStores` only.
- **How-To-Manual (project MEMORY)** — document the new Estimate workspace + toggle + editable cells manual-ready as they ship.
- **STATE.md format** — edit `STATE.md` directly; `gsd-sdk state.update-progress/add-decision` fail on this file's format (project MEMORY note).
- **Konva click-after-drag (project MEMORY)** — Konva fires `click` after `mouseup`; use a ref guard for custom drag gestures (relevant only if the grid gains drag interactions — it should not for v1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `markup` is stored as a **percent number** (e.g. `30` = 30%), so `price = cost × (1 + markup/100)`. CONTEXT D-05 says "defaults to 30%" and "Cost × (1 + markup)". If the intent is a fraction (`0.30`), the formula drops the `/100`. | Aggregator, defaults | Prices 100× off; must confirm the stored unit. **Recommend percent** (matches "30%" UX and the `Markup %` column header D-07). |
| A2 | Legacy scalar `rate` maps to **material** (labor 0), per CONTEXT D-06's own proposal. | Migration | If it should map to `cost`/`labor`, migrated files show wrong material vs labor split (total cost unchanged either way). CONTEXT explicitly proposes material — low risk. |
| A3 | `viewMode` lives in `viewerStore` and **resets to `'plan'` per session** (not persisted). | View switch | If users expect the app to reopen into Estimate, promote to `useUiPanels`/localStorage. Low risk — landing on the canvas is the natural default. |
| A4 | The right `TotalsPanel` **remains visible in both Plan and Estimate views** (quantity-only). | View switch | CONTEXT D-01/D-02 describe the toggle swapping the CENTER area and the totals panel being quantity-only, but don't explicitly say whether the panel hides in Estimate mode. Keeping it is harmless; confirm in discuss-phase. |
| A5 | A Settings UI for the 30% default is **minimal / optional for v1** (a constant seam `DEFAULT_MARKUP_PCT` is sufficient; a Settings-tab control can come later). | Markup default | CONTEXT D-05 says "surface a Settings control to change it later" — implies later is acceptable. If a working Settings control is required this phase, scope grows. |

**None of A1–A5 are blockers** — each has a CONTEXT-supported default; they are flagged so discuss-phase/planner can lock them.

## Open Questions

1. **Markup unit (percent vs fraction)** — see A1. *Recommendation:* store percent (`30`); aggregator uses `markup/100`. Lock before Wave 1.
2. **Does the Estimate view hide the right totals panel?** — see A4. *Recommendation:* keep it visible (quantity-only) in both modes; trivially changed if not wanted.
3. **Settings UI depth for the 30% default** — see A5. *Recommendation:* ship the `DEFAULT_MARKUP_PCT` constant seam + per-row override this phase; a Settings-tab input is a small follow-on (the `Settings` ribbon tab is currently a "Coming soon" stub, `RibbonToolbar.tsx:583-584` — an easy home if wanted now).
4. **Grid column for a client-facing unit price** — D-09 defers a "separate client-facing unit-price column"; the v1 grid shows extended amounts (Material ₱, Labor ₱, etc.), not per-unit client price. Confirm no per-unit price column is expected in v1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React | grid + toggle | ✓ | 19.2.4 | — |
| Zustand | state | ✓ | 5.0.12 | — |
| react-konva | preserved canvas | ✓ | 19.2.3 | — |
| ExcelJS | 9-col xlsx | ✓ | 4.4.0 | — |
| csv-stringify | 9-col csv | ✓ | 6.7.0 (declared) | — |
| Vitest | tests | ✓ | 4.1.x | — |
| TypeScript | typecheck gate | ✓ | 5.9.3 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. Phase is code-only against the installed stack.

## Validation Architecture

> Nyquist validation is **enabled** (`.planning/config.json` → `workflow.nyquist_validation: true`). This section is consumed to build `16-VALIDATION.md`, mirroring how `15-VALIDATION.md` derived proofs a–d.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `vitest.config.ts` (include glob `src/tests/**/*.test.ts`; `environment: 'node'`, per-file `@vitest-environment jsdom` for render tests) |
| Quick run command | `npx vitest run src/tests/<file>.test.ts` |
| Full suite command | `npx vitest run` |
| Notes | No `test` script in package.json — invoke `npx vitest run`. Render tests use `React.createElement` + in-memory localStorage polyfill + `IS_REACT_ACT_ENVIRONMENT=true` (parallel-safe, no config edit). |

### Phase Requirements → Test Map
Proof letters (a–f) are consumed by `16-VALIDATION.md`. SC-1..SC-6 = the six ROADMAP success criteria.

| Proof | SC | Behavior to prove | Test Type | Automated Command | File |
|-------|----|-------------------|-----------|-------------------|------|
| **a** (model math) | SC-2, SC-3 | Per row: `materialCost=material×qty`, `laborCost=labor×qty`, `cost=materialCost+laborCost`, `price=cost×(1+markup/100)`, `margin=price−cost`; absent entry → material/labor 0, markup 30 | unit | `npx vitest run src/tests/boq-aggregator.test.ts` | extend existing |
| **a** (subtotals/grand) | SC-4 | Per-category Cost/Price/Margin subtotals = Σ rows; grand Cost/Price/Margin = Σ categories | unit | `npx vitest run src/tests/boq-aggregator.test.ts` | extend existing |
| **b** (persistence round-trip) | SC-5 | `{material,labor,markup}` survives snapshot→validateV2→hydrate deep-equal; keyed by `name\|type`; one entry shared across categories | unit | `npx vitest run src/tests/project-serialize.test.ts src/tests/project-schema.test.ts` | extend existing |
| **b** (back-compat coercion) | SC-5 | A Phase-15 scalar `rates:{'X\|count':50}` loads without error → `{material:50,labor:0,markup:30}`; malformed values dropped/defaulted; missing markup → 30 | unit | `npx vitest run src/tests/project-serialize.test.ts` | extend existing |
| **c** (live recompute) | SC-2, SC-3 | Editing a price via `setPrice` recomputes cost/price/margin live through `useBoqLive` (selector + memo dep) | unit (jsdom) | `npx vitest run src/tests/use-boq-live.test.ts` | update existing |
| **d** (estimate-grid edit dispatch) | SC-2, SC-3 | Typing into the material/labor/markup cells (native `input`+`blur`, and Enter) dispatches `setPrice('<name>\|<type>', {…})`; interacting does NOT bubble to any row handler (stopPropagation); grid re-renders new cost/price/margin | unit (jsdom) | `npx vitest run src/tests/estimate-row-edit.test.ts` | **NEW** (model on `totals-row-rate-edit.test.ts`) |
| **e** (totals-panel now quantity-only) | SC-1 | `TotalsRow`/`TotalsCategoryBlock`/`TotalsPanel` render **no** `totals-row-rate-input`, `totals-row-cost`, `totals-category-cost-subtotal`, or `totals-grand-total` nodes; quantity + lightbulb + color chip + cycle still present | unit (jsdom) | `npx vitest run src/tests/totals-panel-quantity-only.test.ts` | **NEW** |
| **f** (export 9 columns) | SC-6 | xlsx title row = `Item,Qty,UoM,Material,Labor,Cost,Markup,Price,Margin`; Material/Labor/Cost/Price/Margin cells are **native numbers** with `NUMFMT_PESO`; per-category + grand Cost/Price/Margin rows present; csv mirrors columns numerically with UTF-8 BOM on line 1 | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` | extend existing |
| **g** (view-switch preserves canvas) | SC-1 | Toggling `viewMode` estimate↔plan keeps the `CanvasViewport` container mounted (same DOM node / both subtrees present with one `display:none`) — canvas is not remounted | unit (jsdom) | `npx vitest run src/tests/estimate-view-switch.test.ts` | **NEW** |
| **h** (type-lock) | SC-6 | The 4-way `BoqItemRow`/`BoqStructure` mirrors stay structurally equal across canonical + preload + writer | compile | `npm run typecheck` + `npx vitest run src/tests/boq-export-ipc.test.ts` | existing lock |
| **i** (no dead pricing tokens) | SC-1 | No `totals-row-rate-input` / `formatCost` remains in totals components | grep | `! git grep -n "totals-row-rate-input\|totals-row-cost" -- src/renderer/src/components` | — |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (< ~5s each).
- **Per wave merge:** `npx vitest run` (full suite, ~60s) + `npm run typecheck`.
- **Phase gate:** full suite green + `npm run typecheck` clean + `npm run build`, then `/gsd:verify-work`. Max feedback latency ~60s.

### Wave 0 Gaps
Tests that must exist RED before Wave-1 source (new files) or be extended (existing):
- [ ] `src/tests/estimate-row-edit.test.ts` — **NEW**; covers proof **d** (grid cell edit → `setPrice` + stopPropagation). Model verbatim on `totals-row-rate-edit.test.ts` (jsdom + `React.createElement` + localStorage polyfill + native event dispatch).
- [ ] `src/tests/totals-panel-quantity-only.test.ts` — **NEW**; covers proof **e** (assert pricing nodes ABSENT, quantity/visibility present).
- [ ] `src/tests/estimate-view-switch.test.ts` — **NEW**; covers proof **g** (toggle `viewMode`, assert canvas subtree not remounted).
- [ ] `src/tests/boq-aggregator.test.ts` — **EXTEND**; proofs **a** (five money fields + three subtotal/grand kinds; markup default 30).
- [ ] `src/tests/project-serialize.test.ts` + `project-schema.test.ts` — **EXTEND**; proof **b** (PriceEntry round-trip + legacy-scalar coercion + missing-markup→30).
- [ ] `src/tests/use-boq-live.test.ts` — **UPDATE**; proof **c** (rates→prices; cost/price/margin recompute).
- [ ] `src/tests/boq-writers-xlsx.test.ts` + `boq-writers-csv.test.ts` — **EXTEND**; proof **f** (9 columns, native-number ₱, subtotals/grand, BOM).
- [ ] `src/tests/totals-row-rate-edit.test.ts` — **DELETE** (its contract is removed by D-02).
- [ ] Framework install: **none** — existing Vitest infra covers all proofs.

*No new conftest/fixtures framework — follow the existing `src/tests/` fixture style. No `vitest.config.ts` change (parallel-executor-safe per CLAUDE.md).*

## Sources

### Primary (HIGH confidence — read directly)
- `src/renderer/src/App.tsx` — center-area layout, toast stacking, panel wiring (the D-01 host)
- `src/renderer/src/components/CanvasViewport.tsx` (`:130-186` module refs; `:245-320` Stage/ResizeObserver/PDF render) — the canvas-preservation evidence for Pitfall 1
- `src/renderer/src/components/RibbonToolbar.tsx` — 7-tab ribbon, Estimating tab (`:529-555`), module-ref usage
- `src/renderer/src/stores/viewerStore.ts` — transient `activeTool`/`hydrate` pattern (home for `viewMode`)
- `src/renderer/src/stores/projectStore.ts` (`:20,111-114`) — `rates` + `setRate` + `markDirty` twin pattern
- `src/renderer/src/lib/project-schema.ts` (`:63-127`) — `ProjectFileV2.rates?` additive, no-bump validateV2
- `src/renderer/src/lib/project-serialize.ts` (`:46-140`) — snapshot/hydrate + finite-≥0 coercion guard
- `src/renderer/src/lib/boq-types.ts` — canonical `BoqItemRow`/`BoqStructure`/`AggregateOptions`
- `src/renderer/src/lib/boq-aggregator.ts` (`:83-285`) — bucket keying, rate/cost math to extend
- `src/renderer/src/lib/currency.ts` — `CURRENCY_SYMBOL` seam
- `src/renderer/src/hooks/useBoqLive.ts` — nine-primitive live subscription (reuse for grid)
- `src/renderer/src/components/TotalsRow.tsx` (`:64-216,394-449`) — inline-edit recipe + Removal Map
- `src/renderer/src/components/TotalsCategoryBlock.tsx` (`:131-157`) + `TotalsPanel.tsx` (`:267-294`) — Removal Map
- `src/main/boq-writers.ts` — xlsx/csv builders, `NUMFMT_PESO`, `money()`, BOM
- `src/preload/index.ts` + `index.d.ts` — the 2 preload BoqRowType/BoqItemRow mirrors
- `src/tests/totals-row-rate-edit.test.ts` — the render-test harness to model proofs d/e/g
- `vitest.config.ts`, `package.json` — test infra + declared versions
- `.planning/phases/16-estimating-workspace/16-CONTEXT.md` — locked D-01..D-09
- `.planning/phases/15-*/15-02/03/04-SUMMARY.md`, `15-VALIDATION.md` — prior-art contracts
- `.planning/STATE.md` (Key Decisions Locked) — additive-field/module-ref/₱-seam decisions
- `.planning/ROADMAP.md` (`:606-622`) — Phase 16 goal + SC-1..SC-6
- `CLAUDE.md` — stack lock + offline/precision constraints
- Installed versions verified via `require('<pkg>/package.json').version` on 2026-07-01

### Secondary (MEDIUM)
- None required — all findings are first-party codebase reads.

### Tertiary (LOW)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified in `node_modules`; no new packages.
- Architecture (view-switch, store placement, aggregator/writer extension, removal map): HIGH — every claim cites a read file:line; the D-01 pattern is grounded in the actual ResizeObserver/Stage code.
- Migration/back-compat: HIGH for mechanism (additive-no-bump proven by Phase-15 precedent); the legacy-scalar→material mapping is CONTEXT-proposed (A2).
- Markup unit (percent vs fraction): MEDIUM — A1 flagged; percent recommended, needs a one-line confirmation.
- Pitfalls: HIGH — each is a codebase-grounded, Phase-15-precedented hazard.

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (stable stack; internal codebase — invalidated only by further edits to the cited files, not by external ecosystem drift)
