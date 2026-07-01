---
phase: 16-estimating-workspace
plan: 01
subsystem: testing
tags: [vitest, nyquist, red-first, price-entry, boq-aggregator, exceljs, csv, react-19, jsdom, zustand]

# Dependency graph
requires:
  - phase: 15-boq-pricing-perimeter
    provides: "scalar rates model + aggregator cost math + priced 5-column xlsx/csv + the totals-panel inline ₱ rate field + the render-test harness (React.createElement + jsdom + localStorage polyfill + IS_REACT_ACT_ENVIRONMENT)"
provides:
  - "29 failing (RED) runtime assertions across 8 test files that pin every Wave 1-3 source task to a concrete proof (a-i)"
  - "The {material,labor,markup} PriceEntry money-math contract encoded in boq-aggregator.test.ts (proof a): materialCost/laborCost/cost/price=cost×(1+markup/100)/margin + Cost/Price/Margin subtotals+grand totals + markup-default-30 distinct from explicit-0"
  - "PriceEntry persistence round-trip + legacy-scalar→{material,labor:0,markup:30} coercion + missing-markup→30 + per-field coercion (proof b) in project-serialize.test.ts; validateV2 PriceEntry-map tolerance (still GREEN) in project-schema.test.ts"
  - "9-column export RED (proof f): xlsx Item·Quantity·UoM·Material·Labor·Cost·Markup·Price·Margin with native-number ₱ money cells + percent markup numFmt + Cost/Price/Margin subtotals+grand + A:I merge; csv numeric 9-col + UTF-8 BOM"
  - "NEW estimate-row-edit.test.ts (proof d): EstimateRow material/labor/markup cells → setPrice(name|type, patch) + stopPropagation"
  - "NEW totals-panel-quantity-only.test.ts (proof e): rate-input/cost/cost-subtotal/grand-total nodes asserted ABSENT; quantity/lightbulb/color-chip PRESENT"
  - "NEW estimate-view-switch.test.ts (proof g): mount-preserving viewMode toggle — canvas not remounted, exactly one display:none"
  - "use-boq-live.test.ts recompute case drives a PriceEntry map + asserts cost/price/margin (proof c)"
affects: [16-02, 16-03, 16-04, 16-05, 16-06, wave-1-data-model, wave-2-estimate-workspace, wave-2b-totals-revert, wave-3-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime dynamic import (loadEstimateRow via @vite-ignore + computed specifier) for a not-yet-existent component — the file COLLECTS and each test fails as a clean per-test RED instead of a file-transform crash; typecheck stays clean because src/tests is outside every tsconfig include"
    - "Self-contained App-shell view-switch harness (two sibling containers, CSS display driven by useViewerStore.viewMode) that asserts the mount-preserving contract WITHOUT mounting the Konva/PDF stack"
    - "as unknown as BoqStructure / as any casts absorb the widened PriceEntry + new BoqItemRow/Category/Structure money fields before the types land (mirrors project-schema-hidden.test.ts)"

key-files:
  created:
    - "src/tests/estimate-row-edit.test.ts"
    - "src/tests/totals-panel-quantity-only.test.ts"
    - "src/tests/estimate-view-switch.test.ts"
  modified:
    - "src/tests/boq-aggregator.test.ts"
    - "src/tests/project-serialize.test.ts"
    - "src/tests/project-schema.test.ts"
    - "src/tests/use-boq-live.test.ts"
    - "src/tests/boq-writers-xlsx.test.ts"
    - "src/tests/boq-writers-csv.test.ts"
  deleted:
    - "src/tests/totals-row-rate-edit.test.ts"

key-decisions:
  - "EstimateRow is loaded via a runtime dynamic import (@vite-ignore + array-join specifier), NOT a static import — a static import of a missing module fails the Vite transform and collects ZERO tests (brittle); the dynamic import lets the file collect and surfaces the missing component as a clean per-test 'Cannot find package' RED. Verified empirically with throwaway probes."
  - "src/tests/** is outside every tsconfig include (verified) — so the RED test files never enter `npm run typecheck`; the gate stays clean regardless of missing components/fields. RED = vitest runtime assertion failures only, never tsc errors."
  - "estimate-view-switch uses the plan's simpler 'both subtrees present, exactly one display:none' invariant via a self-contained harness (CanvasViewport has no data-testid and mounting App pulls the brittle Konva/PDF stack); the load-bearing RED is driven by viewerStore.viewMode being undefined until Wave 2a."
  - "totals-panel-quantity-only mounts the real TotalsRow + TotalsCategoryBlock + TotalsPanel (all exist today) and asserts the pricing nodes ABSENT — the render is clean; only the four Phase-15 pricing testids are the RED."
  - "project-schema PriceEntry-map tolerance tests assert ACCEPTANCE (no throw + round-trip), NOT a thrown error — validateV2 rides `return raw as ProjectFileV2` and does not inspect rates, so these PASS today and must stay passing after the element type widens (mirrors the 15-01 additive-tolerance decision)."

patterns-established:
  - "Nyquist RED-first Wave 0: every downstream source task maps 1:1 to a failing assertion (proofs a-i) written BEFORE any source — prevents test-after drift, makes the scalar→PriceEntry widening + totals-panel-revert + estimate-grid-add contracts explicit up front (mirrors Phase-15 15-01)."
  - "Money-math float assertions use toBeCloseTo (price/margin), exact toBe for integer costs — 24×1.3=31.2 etc."

requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5, SC-6]

# Metrics
duration: ~13min
completed: 2026-07-01
---

# Phase 16 Plan 01: Wave 0 — Nyquist RED Test Surface Summary

**29 failing (RED) runtime assertions across 8 test files that pin every Wave 1-3 source task to a concrete proof — encoding the scalar-rate → {material,labor,markup} PriceEntry widening, the totals-panel quantity-only revert, the estimate-grid edit + view-switch contracts, and the 9-column export — with `npm run typecheck` clean and `totals-row-rate-edit.test.ts` deleted.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-01T14:44Z
- **Completed:** 2026-07-01T14:56Z
- **Tasks:** 3
- **Files modified:** 6 modified + 3 created + 1 deleted = 10 files

## Accomplishments
- Widened the aggregator money-math test surface (proof a) to the full `{material, labor, markup}` PriceEntry contract: per-row `materialCost`/`laborCost`/`cost`/`price = cost × (1 + markup/100)`/`margin`, Cost/Price/Margin category subtotals + grand totals, markup-default-30 distinct from an explicit `markup: 0`, and category-independent PriceEntry keying.
- Widened persistence (proof b): PriceEntry snapshot/hydrate round-trip, Phase-15 legacy scalar `50` → `{material:50, labor:0, markup:30}`, missing-markup → 30, and per-field malformed → 0 coercion. Kept the `project-schema` PriceEntry-map tolerance tests GREEN (additive, no formatVersion bump).
- Widened both writers (proof f) to the locked 9-column layout with native-number ₱ money cells, a percent markup numFmt, Cost/Price/Margin subtotals + grand rows, A:I heading merge (xlsx), and numeric 9-column csv with the UTF-8 BOM preserved.
- Created 3 new RED render tests: estimate-grid cell edit → `setPrice` + stopPropagation (proof d), totals-panel pricing-nodes-absent (proof e), and mount-preserving view-switch (proof g). Updated `use-boq-live` to drive a PriceEntry map and assert live cost/price/margin (proof c). Deleted `totals-row-rate-edit.test.ts` (its inline-panel-rate contract is removed by D-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen aggregator money-math tests (proof a)** - `b4711ae` (test)
2. **Task 2: Widen PriceEntry round-trip + legacy coercion + writer 9-column (proofs b, f)** - `bc68044` (test)
3. **Task 3: New estimate-grid edit + panel quantity-only + view-switch; delete rate-edit (proofs c, d, e, g)** - `b7d2017` (test)

_All three are RED-first test commits (no `feat` GREEN pairs — this is a Wave-0 Nyquist plan by design; Waves 1-3 turn them green)._

## Files Created/Modified
- `src/tests/boq-aggregator.test.ts` (modified) - Replaced the Phase-15 scalar rate/cost RED cases with the PriceEntry money-math contract; perimeter one-row + WR-07 arc-length + collision keepers untouched and GREEN.
- `src/tests/project-serialize.test.ts` (modified) - PriceEntry snapshot/hydrate round-trip + legacy-scalar/missing-markup/per-field coercion RED cases.
- `src/tests/project-schema.test.ts` (modified) - Additive-tolerance tests widened to the PriceEntry map; assert acceptance (no throw) — stay GREEN.
- `src/tests/boq-writers-xlsx.test.ts` (modified) - 9-column title, native-number ₱ money cells, percent markup numFmt, Cost/Price/Margin subtotals+grand, A:I merge; widened `pricedStructure()` fixture.
- `src/tests/boq-writers-csv.test.ts` (modified) - 9-column header + numeric cells (no ₱ glyph) + UTF-8 BOM; migrated the top-block mirror-order title assertion to 9 columns.
- `src/tests/use-boq-live.test.ts` (modified) - "recomputes cost/price/margin when rates (PriceEntry) change"; VIEW-01 + pageMarkups + empty cases stay GREEN.
- `src/tests/estimate-row-edit.test.ts` (created) - RED render test for the estimate-grid material/labor/markup cell edit → `setPrice` + stopPropagation; EstimateRow via runtime dynamic import.
- `src/tests/totals-panel-quantity-only.test.ts` (created) - RED render test asserting `totals-row-rate-input`/`totals-row-cost`/`totals-category-cost-subtotal`/`totals-grand-total` ABSENT and quantity/lightbulb/color-chip PRESENT.
- `src/tests/estimate-view-switch.test.ts` (created) - RED render test: mount-preserving `viewMode` toggle keeps the canvas mounted (not remounted), exactly one container `display:none`.
- `src/tests/totals-row-rate-edit.test.ts` (deleted) - The inline-panel ₱ rate contract is removed by D-02; its behavior moves to `estimate-row-edit.test.ts`.

## Decisions Made
See `key-decisions` in the frontmatter. Headlines:
- Missing-component RED is delivered via a **runtime dynamic import** (`@vite-ignore` + computed specifier), not a static import, so the file collects and each test fails as a clean per-test RED — verified with throwaway probes. A static import produced a Vite transform crash with "no tests" collected (brittle).
- `src/tests/**` is **outside every tsconfig include** (confirmed via base config inspection), so the RED test files never enter `npm run typecheck` — the hard typecheck gate stays clean regardless of not-yet-existent components/fields.
- The view-switch RED uses the plan's simpler "both subtrees present, exactly one `display:none`" invariant in a self-contained harness (CanvasViewport has no `data-testid`, and mounting `App` drags in the brittle Konva/PDF stack) — the load-bearing RED is `viewerStore.viewMode` being `undefined` until Wave 2a.

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed their specified assertions; the RED/GREEN split matches the acceptance criteria for every proof (a-g); no production source under `src/renderer`, `src/main`, or `src/preload` was touched; `totals-row-rate-edit.test.ts` deleted.

## Issues Encountered
- **Static import of a missing module is a brittle RED.** A throwaway probe confirmed `import { EstimateRow } from '@renderer/components/EstimateRow'` fails the Vite transform and collects **zero** tests (reported as a file load error, not failing assertions). Resolved by loading `EstimateRow` through a runtime dynamic import (`await import(/* @vite-ignore */ spec)` with an array-join specifier) so the file collects and each `it` fails with a clean "Cannot find package" RED. A second probe confirmed the collect-clean / per-test-fail behavior.

## Known Stubs
None. This plan creates test files only; there are no production stubs. The three new tests intentionally reference not-yet-existent seams (`EstimateRow` component, `setPrice` action, `viewMode` field, PriceEntry aggregator fields) — these are the RED targets for Waves 1-3, not stubs.

## Threat Flags
None. This plan edits/creates/deletes test files only; no runtime trust boundary is added or crossed (matches the plan's threat model: T-16-01-01/02 mitigated by asserting the locked contract directly + no `vitest.config.ts` change; T-16-SC not applicable — no package installs).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Wave 1 (16-02/16-03)** can begin: every data-model/aggregator source task has a failing test pointing at it — the aggregator emits `material/labor/markup/materialCost/laborCost/cost/price/margin` per row + Cost/Price/Margin subtotals/grand totals; `projectStore.rates` widens to `Record<string, PriceEntry>` with `setPrice` + legacy-scalar hydrate coercion; `useBoqLive` stays subscribed to the widened `rates`.
- **Wave 2** targets are pinned: `EstimateRow` (proof d testids `estimate-row-{material,labor,markup}-input` + `setPrice` + stopPropagation), the `viewMode` mount-preserving toggle (proof g), and the totals-panel quantity-only revert (proof e — strip `totals-row-rate-input`/`totals-row-cost`/`totals-category-cost-subtotal`/`totals-grand-total`).
- **Wave 3** export is pinned by proof f (9-column xlsx/csv).
- **Gate status:** `npm run typecheck` clean; full suite 613 pass / 29 RED-by-design / 0 unexpected regressions; `totals-row-rate-edit.test.ts` deleted. RED is the intended deliverable — do NOT attempt to green the suite in this plan.

---
*Phase: 16-estimating-workspace*
*Completed: 2026-07-01*
