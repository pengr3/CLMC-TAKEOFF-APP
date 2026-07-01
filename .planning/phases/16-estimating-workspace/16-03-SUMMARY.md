---
phase: 16-estimating-workspace
plan: 03
subsystem: frontend
tags: [react-19, zustand, viewer-store, estimate-grid, uncontrolled-input, native-listeners, mount-preserving-toggle, konva, ribbon]

# Dependency graph
requires:
  - phase: 16-02
    provides: "the Wave-1 data-model spine — PriceEntry {material,labor,markup}, projectStore.setPrice (merging, markDirty), the widened BoqItemRow (six money fields + markup) / BoqCategoryGroup (three subtotals) / BoqStructure (three grand totals), DEFAULT_MARKUP_PCT=30, and useBoqLive live for the PriceEntry map"
  - phase: 16-01
    provides: "the Wave-0 RED render tests estimate-row-edit.test.ts (proof d) + estimate-view-switch.test.ts (proof g) this plan turns GREEN"
provides:
  - "viewMode:'plan'|'estimate' + setViewMode on viewerStore (transient session UI, NEVER serialized to .clmc, resets to 'plan' on setFile/resetViewer/hydrate); ViewMode type in types/viewer.ts"
  - "Plan|Estimate segmented toggle in the Estimating ribbon tab (RibbonToolbar.tsx) — store-driven (reads viewMode, dispatches setViewMode); Export button kept"
  - "EstimateRow — one grid row: uncontrolled material/labor/markup cells (native input/blur/keydown listeners + stopPropagation) keyed by the category-independent name|type price key → setPrice; read-only ₱ Cost/Price/Margin straight from the aggregator row (no arithmetic)"
  - "EstimateCategoryBlock — category heading + collapse (shared useUiPanels().collapsedCategories) + three per-category Cost/Price/Margin subtotals"
  - "EstimatePanel — full-width center-area Estimate sheet: grouped Internal/Client column header + empty-state tree + category blocks + pinned Cost/Price/Margin grand-total bar off useBoqLive"
  - "App.tsx mount-preserving CSS display view swap (canvas center-column + EstimatePanel always-mounted siblings; Konva Stage never conditionally unmounted); Splitter + TotalsPanel gated to Plan view"
affects: [16-04, 16-05, 16-06, wave-2b-totals-revert, wave-3-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-cell uncontrolled input + native input/blur/keydown listeners replicated PER editable field (material/labor/markup) — the exact TotalsRow.tsx:160-222 recipe tripled, each cell stopPropagation()-ing click/mousedown/keydown so the grid never bubbles to a row handler (React 19 value-tracker + focusout delegation, 16-RESEARCH Pitfall 3)"
    - "Commit functions read useProjectStore.getState().setPrice (getState, not the closed-over selector) so the render-test's injected setPrice spy is honored — mirrors TotalsRow.commitRate"
    - "Category-INDEPENDENT price key `${labelToName(item.label)}|${item.type}` reuses the exported labelToName to strip the (perimeter)/(count) suffix — same key the aggregator reads, DISTINCT from the visibility name|categoryId key (Pitfall 4)"
    - "Mount-preserving view switch: BOTH center subtrees stay in the DOM; a CSS `display:(viewMode==='plan'?…: 'none')` gate picks the visible one — never a {viewMode==='plan' ? <Canvas/> : <Estimate/>} ternary that would tear down the Konva Stage (D-01/Pitfall 1)"
    - "viewMode is a sibling transient field beside activeTool in viewerStore — auto-excluded from snapshotProject (reads explicit fields only), reset to 'plan' in every activeTool-reset site (setFile/resetViewer/hydrate)"

key-files:
  created:
    - "src/renderer/src/components/EstimateRow.tsx"
    - "src/renderer/src/components/EstimateCategoryBlock.tsx"
    - "src/renderer/src/components/EstimatePanel.tsx"
  modified:
    - "src/renderer/src/types/viewer.ts"
    - "src/renderer/src/stores/viewerStore.ts"
    - "src/renderer/src/components/RibbonToolbar.tsx"
    - "src/renderer/src/App.tsx"

key-decisions:
  - "viewMode lives in viewerStore beside activeTool (not a new uiStore, not localStorage) — transient session UI that resets to 'plan' per session so opening a project lands on the canvas; never serialized (A3/Pattern 1)."
  - "The Plan|Estimate toggle is a two-button segmented control (role='radio'/aria-checked) built from the ribbon tab-strip active chrome (dominant bg + accent bottom border) — no reusable segmented-control component exists; the Export RibbonButton is kept after it."
  - "EstimateRow does NO arithmetic — the read-only ₱ Cost/Price/Margin cells read item.cost/item.price/item.margin directly (aggregator is the single source of truth); markup blank/NaN commits DEFAULT_MARKUP_PCT (30, not 0), material/labor NaN/negative clamp to 0."
  - "App.tsx wraps the existing center column + a new EstimatePanel sibling in an outer flex row; both are always mounted and toggled by CSS display. The Splitter + TotalsPanel are gated to viewMode==='plan' so the Estimate grid is full-width (D-01/A4). The existing totalPages===0 ? EmptyState : CanvasViewport swap is left untouched inside the Plan subtree."
  - "estimate-view-switch.test.ts is a SELF-CONTAINED harness (its own ViewSwitchHarness reading viewMode off the store) — it does NOT import App.tsx, so it went fully GREEN from Task 1's store change alone; Task 3's App.tsx swap is the production wiring + manual-UAT surface for the same contract."

patterns-established:
  - "Wave 2a delivers the user-facing half of the Wave-1 estimate model without touching the aggregator/store-math/serialize/writers or the totals panel — it consumes setPrice + the widened Boq* shapes + useBoqLive and adds only viewMode + the grid components + the mount-preserving App.tsx swap."
  - "The editable-cell recipe from Phase 15's now-deleted totals-row-rate-edit relocates here, replicated three times (one per money field) with the markup-specific default-fallback branch."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

# Metrics
duration: ~13min
completed: 2026-07-01
---

# Phase 16 Plan 03: Wave 2a — Estimate Workspace UI Summary

**Built the user-facing Estimate workspace on the Wave-1 data model: a `viewMode:'plan'|'estimate'` field + `Plan | Estimate` ribbon toggle, a mount-preserving CSS `display` view swap in `App.tsx` (the Konva canvas is never unmounted), and the full-width Estimate grid (`EstimatePanel → EstimateCategoryBlock → EstimateRow`) with uncontrolled material/labor/markup cells that commit `setPrice(name|type, patch)` and read-only ₱ Cost/Price/Margin straight from `useBoqLive` — turning the Wave-0 RED estimate-row-edit (proof d) and estimate-view-switch (proof g) tests GREEN with typecheck clean and no green-test regressions.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-01T15:21Z
- **Completed:** 2026-07-01T15:34Z
- **Tasks:** 3
- **Files:** 3 created + 4 modified = 7 files

## Accomplishments
- Added `viewMode:'plan'|'estimate'` + `setViewMode` to `viewerStore` beside `activeTool` (the `ViewMode` type in `types/viewer.ts`), resetting to `'plan'` in `setFile`/`resetViewer`/`hydrate` and never entering the serialize path — verified `git grep viewMode -- project-serialize.ts` returns ZERO.
- Rewrote the Estimating ribbon tab (`RibbonToolbar.tsx`) to render a store-driven `[Plan | Estimate]` segmented control (two `role="radio"` buttons with the tab-strip active chrome, `data-testid` `view-mode-toggle`/`view-mode-plan`/`view-mode-estimate`) before the kept Export button.
- Built the three-component Estimate grid: `EstimateRow` (three uncontrolled money cells + native listeners + `stopPropagation`, keyed by the category-independent `name|type` key, dispatching `setPrice`; read-only ₱ Cost/Price/Margin from the aggregator row; markup blank→30, material/labor NaN/neg→0), `EstimateCategoryBlock` (heading + shared-collapse + three per-category subtotals), and `EstimatePanel` (grouped Internal/Client header + empty-state tree + category blocks + three grand totals off `useBoqLive`).
- Wired the mount-preserving view swap in `App.tsx`: the canvas center-column and `EstimatePanel` are always-mounted siblings toggled by CSS `display` on `viewMode` (the Konva Stage never conditionally unmounts — Pitfall 1), with the `Splitter` + `TotalsPanel` gated to Plan view and a stable `canvas-viewport-container` test-id on the canvas wrapper.

## Task Commits

Each task was committed atomically:

1. **Task 1: viewMode in viewerStore + Plan|Estimate ribbon toggle** — `e915e46` (feat)
2. **Task 2: Estimate grid (EstimateRow/EstimateCategoryBlock/EstimatePanel)** — `2e12c3a` (feat)
3. **Task 3: mount-preserving Plan|Estimate view swap in App.tsx** — `16e832f` (feat)

_Task 2 is a `tdd="true"` task, but its RED test (`estimate-row-edit.test.ts`) was authored in Wave 0 (16-01); like 16-02, this plan is pure GREEN source that turns the pre-existing RED test passing. The RED-gate commit lives in Wave-0 history; Task 2's single `feat` commit is the GREEN gate._

## Files Created/Modified
- `src/renderer/src/components/EstimateRow.tsx` (created) — One estimate grid row. Three uncontrolled editable cells (material/labor/markup) each with a ref, a seed effect (re-seeds the DOM only when it differs), and a native input/blur/keydown-listener effect that commits via `useProjectStore.getState().setPrice(priceKey, patch)` and `stopPropagation`s click/mousedown/keydown. Read-only ₱ Cost/Price/Margin cells read `item.cost`/`item.price`/`item.margin` (non-finite→₱0.00) — no arithmetic. Price key `${labelToName(item.label)}|${item.type}`.
- `src/renderer/src/components/EstimateCategoryBlock.tsx` (created) — Category heading + collapse (shared `useUiPanels().collapsedCategories`, keyed by category name) mapping `category.items` → `EstimateRow`, then three per-category subtotal cells (Cost/Price/Margin, `estimate-category-{cost,price,margin}-subtotal`) reading `category.costSubtotal`/`priceSubtotal`/`marginSubtotal`. Dropped the totals-panel navigator machinery (matchesForRow/onRowHover/onRowClick/onArmTool).
- `src/renderer/src/components/EstimatePanel.tsx` (created) — Full-width center-area Estimate sheet. `useBoqLive()` → a grouped two-tier Internal/Client column header + the empty-state decision tree + `boq.categories.map(EstimateCategoryBlock)` in a scrollable body + a pinned grand-total bar (`estimate-grand-total-{cost,price,margin}`) off `boq.grandTotalCost/Price/Margin`. Root `data-testid="estimate-panel"`.
- `src/renderer/src/types/viewer.ts` (modified) — Added `export type ViewMode = 'plan'|'estimate'`; `viewMode: ViewMode` + `setViewMode` on `ViewerState` (JSDoc notes it is transient, never serialized).
- `src/renderer/src/stores/viewerStore.ts` (modified) — Imported `ViewMode`; `viewMode:'plan'` initial state + in the `setFile`/`resetViewer`/`hydrate` reset objects; `setViewMode: (mode) => set({ viewMode: mode })`. Not added to any subscription or serialize path.
- `src/renderer/src/components/RibbonToolbar.tsx` (modified) — Read `viewMode`/`setViewMode` selectors; new `renderViewModeSegment` helper + rewritten `renderEstimatingTab()` rendering the `[Plan|Estimate]` `radiogroup` before the kept Export button. Imported the `ViewMode` type.
- `src/renderer/src/App.tsx` (modified) — Imported `EstimatePanel`; read `viewMode`; wrapped the center region so the Plan subtree (`display: viewMode==='plan'?…`) and a sibling `EstimatePanel` container (`display: viewMode==='estimate'?…`) are both always mounted; gated `Splitter` + `TotalsPanel` to `viewMode==='plan'`; added `canvas-viewport-container` test-id.

## Decisions Made
See `key-decisions` in the frontmatter. Headlines:
- `viewMode` is a transient `viewerStore` sibling of `activeTool`, reset to `'plan'` on file open/reset, never serialized.
- Editable cells are uncontrolled + native-listener (React 19 value-tracker workaround), commit `setPrice` via `getState()`, and `stopPropagation` so the spreadsheet never fires a row handler; markup blank→30, material/labor NaN/neg→0; the read-only money cells do no arithmetic.
- App.tsx uses a mount-preserving CSS `display` swap (both subtrees mounted) — the Konva Stage is never unmounted; the totals panel + splitter hide in Estimate view.

## Deviations from Plan

None — the plan executed exactly as written. Task 1/2/3 landed as specified; all named test-ids, the `name|type` key, the `setPrice` patch shape, the markup default-fallback, the mount-preserving swap, and the Plan-only totals-panel gate match the plan and the two RED contracts verbatim. No Rule 1-4 fixes were needed (the Wave-1 spine from 16-02 already exposed every shape this plan consumes).

## Issues Encountered
- **Known `snapping-engine.test.ts` full-suite parallelism flake (pre-existing).** On full-suite runs `snapping-engine.test.ts` intermittently reports failures under concurrent CPU load; it passes 8/8 deterministically in isolation (`npx vitest run src/tests/snapping-engine.test.ts`). This is the exact flake documented in the 16-02 SUMMARY — it imports only `snapping-engine.ts` + `useCalibrationMode`, neither touched by this plan (my 7 files are all in the estimate/viewer/ribbon path). Out of scope per the scope-boundary rule; not fixed. The deterministic RED-by-design set (below) is unaffected by it.

## Known Stubs
None. All three new components wire to live data — `EstimatePanel` reads `useBoqLive()`, `EstimateRow` reads `useProjectStore((s) => s.rates[priceKey])` and the aggregator-computed `item.*` money fields, `EstimateCategoryBlock` reads `category.*Subtotal`. The only `placeholder=` strings are legitimate HTML input placeholders ("0.00", the default markup). No hardcoded empty/mock data flows to rendering, and no "coming soon"/TODO markers were introduced.

## Threat Flags
None. This plan is renderer-only UI reading existing in-memory store state (`viewerStore.viewMode`, `projectStore.rates`, the `BoqStructure` from `useBoqLive`) and dispatching the already-defined `setViewMode`/`setPrice` actions — no new IPC, file I/O, network, auth, or schema surface crosses a trust boundary. The four registered threats are the plan's own and are mitigated: T-16-03-01 (cell parse — `parseFloat` clamp NaN/neg→0, markup blank→30, never writes a string), T-16-03-02 (event leak — `stopPropagation` per cell, asserted by the not-bubbled spy), T-16-03-03 (canvas teardown — mount-preserving CSS display, asserted by the not-remounted test), T-16-03-04 (wrong price key — category-independent `labelToName(label)|type`, asserted by the setPrice key spy).

## Verification Results
- **Two owned proofs GREEN:** `npx vitest run src/tests/estimate-row-edit.test.ts src/tests/estimate-view-switch.test.ts` → 2 files / 9 tests passed. (proof d: grid-cell `setPrice('Outlet|count', {material|labor|markup})` dispatch + `stopPropagation`; proof g: mount-preserving view switch — both subtrees present, one `display:none`, same canvas DOM node across the toggle.)
- **RED-by-design (unchanged, owned by other plans):** `totals-panel-quantity-only.test.ts` (16-04 / Wave 2b), `boq-writers-xlsx.test.ts` + `boq-writers-csv.test.ts` (16-05 / Wave 3) fail deterministically (3 files / 12 tests) — none of those files were touched (`git diff --name-only e915e46~1 HEAD` shows only the 7 declared files; TotalsRow/TotalsCategoryBlock/TotalsPanel/boq-writers untouched).
- **No green-test regressions:** deterministic full-suite state is 3 RED-by-design files + the known `snapping-engine` timing flake; every other test (including all existing totals-row tests — cycle/context-menu/hover/visibility) stays green.
- **typecheck clean:** `npm run typecheck` (node + web) exits 0.
- **Grep gates:** `viewMode` present in viewerStore (field + type + 3 resets + setViewMode) and RibbonToolbar (dispatch); ZERO in project-serialize; no `*quantity`/`*qty` arithmetic in EstimateRow; all three `estimate-row-*-input` test-ids present; `useBoqLive` in EstimatePanel; `viewMode === 'estimate'`/`viewMode === 'plan'` display + Plan-only gates + `EstimatePanel` sibling + `canvas-viewport-container` in App.tsx.
- **Manual UAT (deferred per 16-VALIDATION Manual-Only, SC-1..SC-4):** toggle Plan|Estimate → center swaps cleanly, returning to Plan shows the PDF + markups intact with no re-rasterization flicker, totals panel visible in Plan / hidden in Estimate; typing Material/Labor/Markup updates Cost/Price/Margin + subtotals + grand totals live; interacting with a cell does not arm a tool or switch pages.

## Self-Check: PASSED

- Created files exist: `EstimateRow.tsx`, `EstimateCategoryBlock.tsx`, `EstimatePanel.tsx` — all FOUND on disk.
- Commits exist: `e915e46`, `2e12c3a`, `16e832f` — all FOUND in `git log`.

## Next Phase Readiness
- **Wave 2b (16-04, totals-panel quantity-only revert)** runs next and disjoint: it removes the inline ₱ input/cost/subtotal/grand-total nodes still rendered in `TotalsRow`/`TotalsCategoryBlock`/`TotalsPanel` (this plan left them untouched, so `totals-panel-quantity-only.test.ts` is correctly still RED). No file this plan created/modified overlaps 16-04's set.
- **Wave 3 (16-05, 9-column export)** widens `boq-writers.ts` (the 4th BoqItemRow/BoqStructure mirror) to Material/Labor/Cost/Markup/Price/Margin — the two writer tests stay RED here by design; untouched by this plan.
- **Gate status:** the two owned proofs GREEN; typecheck clean; only the 7 declared files touched; STATE.md / ROADMAP.md / totals-panel / boq-writers left alone (orchestrator owns STATE/ROADMAP).

---
*Phase: 16-estimating-workspace*
*Completed: 2026-07-01*
