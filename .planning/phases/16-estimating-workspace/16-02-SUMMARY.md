---
phase: 16-estimating-workspace
plan: 02
subsystem: database
tags: [zustand, price-entry, boq-aggregator, project-serialize, project-schema, back-compat, typescript, ipc-type-lock]

# Dependency graph
requires:
  - phase: 16-01
    provides: "Wave-0 Nyquist RED test surface — the {material,labor,markup} PriceEntry money-math contract (boq-aggregator.test.ts), PriceEntry persistence round-trip + legacy-scalar/missing-markup/per-field coercion (project-serialize.test.ts), additive-tolerance validateV2 (project-schema.test.ts), and the live cost/price/margin recompute case (use-boq-live.test.ts)"
  - phase: 15-boq-pricing-perimeter
    provides: "the scalar rates model + aggregator cost math + the additive-no-formatVersion-bump rates precedent + the finite-≥0 hydrate guard + the 4-way BoqItemRow/BoqStructure type lock"
provides:
  - "PriceEntry {material,labor,markup} type (markup a PERCENT) in boq-types.ts — the canonical widened stored value shape"
  - "DEFAULT_MARKUP_PCT = 30 single seam in NEW src/renderer/src/lib/estimate-defaults.ts (consumed by setPrice seed + aggregator absent-markup read + hydrate missing-markup default)"
  - "projectStore.rates: Record<string,PriceEntry> + merging setPrice(key, Partial<PriceEntry>) with markDirty (replaces scalar setRate); reset/initial still {}"
  - "aggregator per-row material/labor/markup/materialCost/laborCost/cost/price/margin + per-category costSubtotal/priceSubtotal/marginSubtotal + per-structure grandTotalCost/grandTotalPrice/grandTotalMargin"
  - "hydrate coercion: legacy Phase-15 scalar → {material:n,labor:0,markup:30}; per-field finite-≥0 guard; missing markup → 30; non-number/non-object dropped; never throws (T-16-02-01 mitigation)"
  - "the widened BoqItemRow/BoqCategoryGroup/BoqStructure/AggregateOptions mirrored across boq-types.ts + preload/index.ts + preload/index.d.ts (3 of the 4 mirrors; boq-writers.ts left for Wave 3)"
  - "useBoqLive stays live for the PriceEntry map (selector + memo dep unchanged; docstring reworded)"
affects: [16-03, 16-04, 16-05, 16-06, wave-2-estimate-workspace, wave-2b-totals-revert, wave-3-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PriceEntry declared in boq-types.ts (Task 1, ahead of its full Boq* widening in Task 2) so projectStore/schema/serialize can import it with no circular dependency and a clean per-commit type surface — boq-types imports only ../types/*, projectStore imports the store trio, so no cycle"
    - "Absent-entry vs explicit-zero markup distinction via `entry?.markup ?? DEFAULT_MARKUP_PCT` (?? fires only on undefined, so a stored markup:0 is honored) — Pitfall 5"
    - "Per-field hydrate coercion via a shared coerceField(v, fallback) helper: legacy scalar branch (number → material, labor 0, markup 30) + object branch (per-field finite-≥0 else fallback); neither-number-nor-object entries dropped"

key-files:
  created:
    - "src/renderer/src/lib/estimate-defaults.ts"
  modified:
    - "src/renderer/src/lib/boq-types.ts"
    - "src/renderer/src/stores/projectStore.ts"
    - "src/renderer/src/lib/project-schema.ts"
    - "src/renderer/src/lib/project-serialize.ts"
    - "src/renderer/src/lib/boq-aggregator.ts"
    - "src/renderer/src/hooks/useBoqLive.ts"
    - "src/preload/index.ts"
    - "src/preload/index.d.ts"
    - "src/renderer/src/components/TotalsRow.tsx"

key-decisions:
  - "PriceEntry interface added to boq-types.ts in Task 1 (not Task 2) — the plan permits declaring it in boq-types then importing; doing so in Task 1 keeps projectStore/schema/serialize self-contained with clean per-commit types and avoids the temporary-inline-widen hack the plan flagged as a fallback."
  - "markup is stored as a PERCENT (30 = 30%); price = cost × (1 + markup/100). Absent ENTRY → markup 30 (DEFAULT_MARKUP_PCT); an entry with an explicit markup 0 is honored as 0 (never overwritten). Absent material/labor → 0."
  - "Legacy Phase-15 scalar rates map coerces on hydrate to {material:n, labor:0, markup:30}; additive on ProjectFileV2, NO formatVersion bump, NO validateV2 branch (rides `return raw as ProjectFileV2`)."
  - "setPrice MERGES a Partial<PriceEntry> into the existing entry (spread), seeding {material:0,labor:0,markup:30} only on create, then calls get().markDirty() (load-bearing for Save)."
  - "TotalsRow compile-fixed (Rule 3) to the widened API by reading/writing the material field only via setPrice — the full totals-panel pricing-UI removal is Wave 2b's scope; this plan only unbroke the compile the rename+widen caused."
  - "boq-writers.ts (the 4th BoqItemRow/BoqStructure mirror) left untouched — it carries its own self-consistent old-shape inline types + reads item.rate/item.cost/cat.costSubtotal against them, so it compiles independently; the boq-export-ipc structural lock uses an empty STUB_STRUCT so runtime divergence does not fail."

patterns-established:
  - "Wave-1 data-model spine turns the Wave-0 RED aggregator/serialize/schema/use-boq-live assertions GREEN without touching UI render components or the boq-writers (Waves 2/3 own those) — the widening rides the same seams Phase-15 established."
  - "Three money accumulators (Cost/Price/Margin) are added PARALLEL to the existing per-UoM quantity subtotals in the aggregator, not as a replacement — the perimeter length path, uomFor, typeWord, collision/label logic, and grandByUom are byte-untouched (Phase-14/15 no-regression)."

requirements-completed: [SC-2, SC-3, SC-4, SC-5, SC-6]

# Metrics
duration: ~10min
completed: 2026-07-01
---

# Phase 16 Plan 02: Wave 1 — Estimate Data-Model Spine Summary

**Widened the per-`name|type` stored value from a scalar ₱ rate to a `PriceEntry {material,labor,markup}` (markup a percent) end-to-end — new `DEFAULT_MARKUP_PCT=30` seam, merging `setPrice`, aggregator material/labor/cost/price/margin + three subtotal kinds + three grand totals, legacy-scalar hydrate coercion (no formatVersion bump), and the 3 in-scope BoqItemRow/BoqStructure mirrors — turning the Wave-0 aggregator/serialize/schema/use-boq-live RED tests GREEN with typecheck clean.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-01T15:02Z
- **Completed:** 2026-07-01T15:12Z
- **Tasks:** 3
- **Files modified:** 9 modified + 1 created = 10 files

## Accomplishments
- Widened `projectStore.rates` from `Record<string,number>` to `Record<string,PriceEntry>` and replaced the scalar `setRate` with a merging `setPrice(key, Partial<PriceEntry>)` that seeds `markup:30` on create and marks the project dirty; added the `PriceEntry` type + the new `DEFAULT_MARKUP_PCT=30` single seam.
- Threaded the full money math through `boq-aggregator`: per row `material/labor/markup/materialCost/laborCost/cost/price/margin` (absent entry → 0/0/30, explicit markup 0 honored, `price = cost × (1 + markup/100)`), per category `costSubtotal/priceSubtotal/marginSubtotal`, per structure `grandTotalCost/grandTotalPrice/grandTotalMargin` — leaving the perimeter length path + per-UoM quantity subtotals untouched.
- Hardened `hydrateStores` against a crafted/corrupt `.clmc`: legacy Phase-15 scalar `rates:{'X|count':50}` coerces to `{material:50,labor:0,markup:30}`; per-field finite-≥0 guard; missing markup → 30; non-number/non-object entries dropped; never throws (additive, no formatVersion bump).
- Mirrored the widened `BoqItemRow`/`BoqCategoryGroup`/`BoqStructure`/`AggregateOptions` across the 3 in-scope type-duplication files (`boq-types.ts` + both preload files) in lockstep; left `boq-writers.ts` (Wave 3) intact and compiling independently.

## Task Commits

Each task was committed atomically:

1. **Task 1: DEFAULT_MARKUP_PCT seam + widen rates to PriceEntry in projectStore + schema + serialize** - `5a47ca8` (feat)
2. **Task 2: PriceEntry-widened BoqItemRow/Category/Structure/AggregateOptions in boq-types + both preload mirrors** - `41d3f52` (feat)
3. **Task 3: Thread material/labor/cost/price/margin + 3 subtotals + 3 grand totals through boq-aggregator; useBoqLive liveness** - `dbee104` (feat)

_Not a TDD RED/GREEN plan — the RED tests were written in Wave 0 (16-01); this Wave-1 plan is pure GREEN source that turns them passing._

## Files Created/Modified
- `src/renderer/src/lib/estimate-defaults.ts` (created) - Exports `DEFAULT_MARKUP_PCT = 30` (percent seam) — the single place the project-wide default markup is defined; consumed by setPrice seed, aggregator absent-markup read, and hydrate missing-markup default.
- `src/renderer/src/lib/boq-types.ts` (modified) - Added `PriceEntry {material,labor,markup}`; replaced `rate`/`cost` on `BoqItemRow` with `material/labor/markup/materialCost/laborCost/cost/price/margin` (kept `categoryId?`); `BoqCategoryGroup` gained `priceSubtotal/marginSubtotal`; `BoqStructure` gained `grandTotalPrice/grandTotalMargin`; widened `AggregateOptions.rates` to the PriceEntry map.
- `src/renderer/src/stores/projectStore.ts` (modified) - Widened `rates` to `Record<string,PriceEntry>`; replaced `setRate` with merging `setPrice` (seeds `markup:30` on create, trailing `markDirty()`); reset/initial unchanged (`{}`).
- `src/renderer/src/lib/project-schema.ts` (modified) - Widened `ProjectFileV2.rates?` value type to `PriceEntry`; JSDoc notes the legacy-scalar back-compat; no `validateV2` branch, no formatVersion bump.
- `src/renderer/src/lib/project-serialize.ts` (modified) - Widened the `safeRates` hydrate coercion to accept both the legacy scalar and the PriceEntry object forms with a shared `coerceField` per-field guard; snapshot unchanged (wider value flows through).
- `src/renderer/src/lib/boq-aggregator.ts` (modified) - Replaced the per-row rate/cost block with the six-field money math; added `catPrice`/`catMargin` and `grandPrice`/`grandMargin` accumulators parallel to `catCost`/`grandCost`; extended the category push + return.
- `src/renderer/src/hooks/useBoqLive.ts` (modified) - Reworded the `rates` docstring paragraph to the PriceEntry shape; selector + memo dep already correct (no functional change).
- `src/preload/index.ts` (modified) - Mirrored the six-money `BoqItemRow` + the three subtotal/grand fields (categoryId omission preserved; no PriceEntry export).
- `src/preload/index.d.ts` (modified) - Same mirror as index.ts.
- `src/renderer/src/components/TotalsRow.tsx` (modified) - Rule-3 blocking compile-fix only: read `s.rates[rateKey]?.material` and commit via `setPrice(rateKey, {material})`; the panel pricing-UI removal is Wave 2b.

## Decisions Made
See `key-decisions` in the frontmatter. Headlines:
- `PriceEntry` was declared in `boq-types.ts` during Task 1 (the plan's permitted "declare in boq-types then import" ordering) so projectStore/schema/serialize import a real type with no circular dependency and a clean per-commit type surface, rather than the temporary inline-widen the plan flagged as a last resort.
- markup is a PERCENT; absent entry → 30, explicit `markup:0` honored; absent material/labor → 0; legacy scalar → `{material:n, labor:0, markup:30}`.
- `boq-writers.ts` (the 4th mirror) was deliberately left on its old self-consistent inline shape — it compiles independently and the structural lock uses an empty STUB_STRUCT, so no cross-file break; Wave 3 owns its widening.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TotalsRow.tsx compile-fix after the setRate→setPrice rename + rates widen**
- **Found during:** Task 1 (widening `projectStore.rates` + renaming `setRate`)
- **Issue:** Widening `rates` to `PriceEntry` and renaming `setRate`→`setPrice` broke `TotalsRow.tsx`'s compile — it read `s.rates[rateKey] ?? 0` as a scalar and called `setRate` (TS2345 `PriceEntry` not assignable to `number`; TS2339 `setRate` does not exist). The plan's own verification block requires `git grep "setRate" -- src/renderer/src` to return ZERO, so the rename is in-scope for this plan, but the full totals-panel pricing-UI removal is Wave 2b's scope.
- **Fix:** Minimal adaptation of TotalsRow's three pricing touchpoints to the widened API — read `s.rates[rateKey]?.material ?? 0` and commit via `setPrice(rateKey, {material: safe})`. Runtime behavior is preserved (the panel's single ₱ field maps to the material rate, the legacy scalar's home), so the KEPT totals-row tests (cycle/context-menu/hover/visibility) stay green and the `totals-panel-quantity-only` test stays RED-by-design (the pricing nodes are still rendered until Wave 2b removes them).
- **Files modified:** src/renderer/src/components/TotalsRow.tsx
- **Verification:** `npm run typecheck` clean (node + web, 0 errors); the four target files GREEN; the five later-wave files still RED (unchanged from Wave-0 intent); full suite shows no unexpected regression.
- **Committed in:** `5a47ca8` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The single deviation is a required compile-fix directly caused by this plan's own in-scope rename+widen; it does the minimum to unbreak the build without doing Wave 2b's visual revert (no scope creep). No other file needed adjustment.

## Issues Encountered
- **Full-suite parallelism flake in `snapping-engine.test.ts`.** On the first full-suite run a sixth file (`snapping-engine.test.ts`) reported failures alongside the five expected RED-by-design files. Isolated re-run passed 8/8 deterministically, and a second full-suite run showed only the five expected RED files (623 passed / 19 failed). The file imports only `snapping-engine.ts` + `useCalibrationMode` — neither touched by this plan (my 10 changed files are all in the pricing/BOQ/serialize path) — and its longest spatial-index test runs ~850ms, so this is a pre-existing timing flake under concurrent CPU load, not a regression. Out of scope per the scope-boundary rule; not fixed.

## Known Stubs
None. This plan is data-model/serialize/aggregator/types only — no UI render component with hardcoded empty/mock data was created. The Estimate grid components (`EstimateSheet`/`EstimateRow`), the `viewMode` toggle, and the totals-panel revert are Waves 2a/2b targets, not stubs left by this plan.

## Threat Flags
None. This plan widens exactly one existing untrusted surface — the `disk(.clmc) → renderer hydrate` boundary — and fully mitigates T-16-02-01 (malformed PriceEntry / legacy scalar) with the per-field finite-≥0 hydrate coercion the plan's threat register dispositioned as `mitigate`. No new network, auth, secret, or file-access surface is added; the type-mirror-divergence threat (T-16-02-02) is mitigated by widening all three in-scope mirrors in lockstep with a clean typecheck.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Wave 2a (Estimate workspace)** can build against the final shapes: `BoqItemRow` carries all six money fields + markup, `BoqCategoryGroup` carries the three subtotals, `BoqStructure` the three grand totals; the grid reads them via `useBoqLive` (already live for the PriceEntry map) and commits edits via `setPrice(name|type, {material|labor|markup})`; `DEFAULT_MARKUP_PCT` is importable for the markup-cell seed; `viewMode` toggle + mount-preserving switch remain to build.
- **Wave 2b (totals-panel quantity-only revert)** removes the inline ₱ input/cost/subtotal/grand-total nodes still rendered in TotalsRow/TotalsCategoryBlock/TotalsPanel (this plan only compile-adapted TotalsRow's material touchpoints; the render nodes remain, so `totals-panel-quantity-only.test.ts` is correctly still RED).
- **Wave 3 (9-column export)** widens `boq-writers.ts` (the 4th BoqItemRow/BoqStructure mirror, deliberately left on the old shape here) to the Material/Labor/Cost/Markup/Price/Margin layout + subtotals/grand, keeping it in lockstep with the three mirrors this plan widened.
- **Gate status:** `npm run typecheck` clean (node + web); the four target suites GREEN (44/44); the five later-wave suites RED-by-design (Waves 2a/2b/3); full suite 623/642 with the 19 failures being exactly those five files (plus one transient snapping-engine parallelism flake that passes in isolation). No STATE.md/ROADMAP.md edits (orchestrator-owned); UI components and boq-writers.ts left for later waves.

## Self-Check: PASSED

_(populated below after verification)_

---
*Phase: 16-estimating-workspace*
*Completed: 2026-07-01*
