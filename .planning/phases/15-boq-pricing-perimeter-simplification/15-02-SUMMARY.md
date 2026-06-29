---
phase: 15-boq-pricing-perimeter-simplification
plan: 02
subsystem: api
tags: [boq, pricing, perimeter, aggregator, zustand, project-schema, serialize, rates, peso]

# Dependency graph
requires:
  - phase: 15-boq-pricing-perimeter-simplification (Plan 15-01)
    provides: "Wave 0 Nyquist RED surface — the aggregator/serialize/schema assertions this plan turns GREEN (rate/cost/costSubtotal/grandTotalCost field shapes + one-row perimeter contract)"
  - phase: 14-markup-geometry-precision
    provides: "arc-aware polylineLength(closingPts, m.arcs) — the perimeter LENGTH path preserved verbatim (WR-07 300+π·R guard holds)"
provides:
  - "projectStore.rates Record<string,number> state + setRate(key,rate) action (mirrors toggleHiddenItem incl. markDirty); reset to {}"
  - "ProjectFileV2.rates? additive optional field (NO formatVersion bump); validateV2 stays throw-free"
  - "snapshotProject emits rates; hydrateStores restores rates with a finite-≥0 coercion guard (T-15-02-01 mitigation)"
  - "BoqItemRow.rate/cost, BoqCategoryGroup.costSubtotal, BoqStructure.grandTotalCost, AggregateOptions.rates? on the canonical boq-types + both preload mirrors"
  - "BoqRowType perimeter-length→perimeter rename + perimeter-area delete across boq-types + preload (3-of-4 type-duplication files; boq-writers.ts left to Wave 2)"
  - "aggregator: per-row rate=rates[name|type]??0 + cost=rate×qty; per-category costSubtotal; project grandTotalCost; perimeter length-only as a first-class D-02 collision member with unified typeWord suffix"
affects: [15-03, 15-04, boq-writers, useBoqLive, TotalsRow, TotalsCategoryBlock, TotalsPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rates plumbed as a carbon copy of hiddenItemNames end-to-end (store + schema + serialize), minus the derived Set (the rate map IS the O(1) lookup)"
    - "Untrusted-input hardening: hydrate coerces each rates entry to a finite number ≥0 (Record analog of the Array.isArray guard) — malformed values never reach cost math or ₱ cells"
    - "Type-first split across waves: canonical boq-types + preload mirrors land here; the consuming aggregator wiring lands in the same plan's Task 3 to keep the full typecheck green"

key-files:
  created:
    - .planning/phases/15-boq-pricing-perimeter-simplification/deferred-items.md
  modified:
    - src/renderer/src/stores/projectStore.ts
    - src/renderer/src/lib/project-schema.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/renderer/src/lib/boq-types.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/lib/boq-aggregator.ts
    - src/renderer/src/components/TotalsRow.tsx

key-decisions:
  - "Chose the perimeter-length→perimeter RENAME (planner discretion): the markup type is already 'perimeter', so the BOQ row type now equals the markup type; rate key for a perimeter is `${name}|perimeter`"
  - "rates hydrate coercion implemented even though Wave 0 shipped no crafted-input test — it is the locked T-15-02-01 threat mitigation and the plan's explicit Task-1 action; finite-≥0 filter drops negative/NaN/Infinity/non-number/non-object"
  - "rowTypeToMarkupType collapsed to identity (Rule 3 blocking fix) — the BoqRowType rename removed the literals it compared against; with MarkupType now == BoqRowType the mapping is an identity, kept as a named seam"
  - "boq-writers.ts (main-process BoqRowType duplicate) left untouched per plan scope (Wave 2 owns it); it compiles independently so the structural lock + full typecheck stay green"

patterns-established:
  - "Per-(name|type) ₱ rate map is category-INDEPENDENT — same key shape as the aggregator bucket key `${name}|${type}`; one map entry feeds rows in every category"
  - "Cost is unit-agnostic: a single ₱ costSubtotal per category + one grandTotalCost, parallel to (not bucketed by) the per-UoM quantity subtotals"

requirements-completed: [SC-1, SC-2, SC-3, SC-5]

# Metrics
duration: 11min
completed: 2026-06-29
---

# Phase 15 Plan 02: BOQ Data-Model + Aggregator Spine (Wave 1) Summary

**Plumbed a category-independent `rates` map end-to-end (store + schema + serialize, mirroring hiddenItemNames with a finite-≥0 hydrate guard), threaded `rate`/`cost`/`costSubtotal`/`grandTotalCost` through `boq-types` + both preload mirrors + the aggregator, and collapsed the perimeter tool to a single arc-aware length row that is now a first-class D-02 collision member — turning the 15-01 aggregator/serialize/schema RED tests GREEN with `npm run typecheck` clean.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-29T17:52:00Z (RED baseline captured: 10 target assertions failing)
- **Completed:** 2026-06-29T18:03:21Z (Task 3 commit + full verification)
- **Tasks:** 3
- **Files modified:** 8 (1 created: deferred-items.md; 7 source modified — 1 of which, TotalsRow.tsx, is a Rule-3 blocking fix)

## Accomplishments
- **rates persistence spine (Task 1):** `projectStore` gains `rates: Record<string,number>` + `setRate(key,rate)` (mirrors `toggleHiddenItem` including the load-bearing trailing `get().markDirty()`) + reset-to-`{}`; `ProjectFileV2.rates?` is additive with NO formatVersion bump and no `validateV2` branch; `snapshotProject` emits `rates` and `hydrateStores` restores it inside the dirty-suspend bracket with a per-value finite-≥0 coercion guard (drops negative / NaN / Infinity / non-number; non-object → `{}`).
- **Pricing + perimeter type contract (Task 2):** `BoqItemRow += rate/cost`, `BoqCategoryGroup += costSubtotal`, `BoqStructure += grandTotalCost`, `AggregateOptions += rates?`; `BoqRowType` renamed `'perimeter-length'`→`'perimeter'` and dropped `'perimeter-area'` — applied in lockstep across the 3 in-scope type-duplication files (`boq-types.ts`, `preload/index.ts`, `preload/index.d.ts`), preserving the deliberate `categoryId` omission and the pre-existing `'wall'` drift in `preload/index.ts`.
- **Aggregator wiring + perimeter collapse (Task 3):** reads `opts.rates ?? useProjectStore.getState().rates`; computes `rate = rates[`${name}|${type}`] ?? 0` and `cost = rate × quantity` per row; accumulates a single ₱ `costSubtotal` per category and a project `grandTotalCost`; **deletes** the perimeter-area synthesis (the `polygonArea`/`pixelAreaToReal` arm) while keeping the **arc-aware** perimeter LENGTH add verbatim; folds perimeter into the D-02 collision set (`nameNonPerimTypes`→`nameTypes`, skip removed) under a unified suffix rule (`nonPerimeterTypeWord`→`typeWord` with a `'perimeter'` case).
- **Verification:** `boq-aggregator.test.ts` (14/14), `project-serialize.test.ts` + `project-schema.test.ts` (22/22) GREEN; full `npm run typecheck` clean (node + web, exit 0); `git grep perimeter-area|perimeter-length -- src/renderer/src/lib src/preload` returns ZERO; WR-07 arc-length guard (`300 + π·50`) intact — no Phase-14 regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rates to projectStore + project-schema + project-serialize** - `ac1c97f` (feat)
2. **Task 2: rate/cost/costSubtotal/grandTotalCost + perimeter rename in boq-types + preload mirrors** - `c9a5d79` (feat)
3. **Task 3: Thread cost fields through aggregator + perimeter length-only + collision membership** - `85b1ade` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: this is a TDD plan, but the RED phase was Plan 15-01 (Wave 0). This plan is the GREEN phase — minimal source to turn the pre-existing failing assertions green — so each task is a single `feat` commit, not a RED/GREEN pair._

## Files Created/Modified
- `src/renderer/src/stores/projectStore.ts` - `rates` state + `setRate` action (with `markDirty`) + reset-to-`{}`
- `src/renderer/src/lib/project-schema.ts` - additive `rates?` on `ProjectFileV2`, no `validateV2` branch, no formatVersion bump
- `src/renderer/src/lib/project-serialize.ts` - snapshot emits `rates`; hydrate restores with finite-≥0 coercion guard (T-15-02-01)
- `src/renderer/src/lib/boq-types.ts` - `rate`/`cost` on `BoqItemRow`, `costSubtotal` on `BoqCategoryGroup`, `grandTotalCost` on `BoqStructure`, `rates?` on `AggregateOptions`; `BoqRowType` perimeter rename + `perimeter-area` delete
- `src/preload/index.ts` - mirror: perimeter rename/delete + `rate`/`cost` + `costSubtotal`/`grandTotalCost` (no `categoryId`, no new `'wall'`)
- `src/preload/index.d.ts` - mirror: perimeter rename/delete + `rate`/`cost` + `costSubtotal`/`grandTotalCost` (no `categoryId`; existing `'wall'` kept)
- `src/renderer/src/lib/boq-aggregator.ts` - `opts.rates` default-from-store; per-row rate/cost; per-category `costSubtotal`; `grandTotalCost`; perimeter length-only + first-class collision membership; `typeWord` emits `'perimeter'`
- `src/renderer/src/components/TotalsRow.tsx` - `rowTypeToMarkupType` collapsed to identity (Rule 3 blocking fix — see Deviations)
- `.planning/phases/15-boq-pricing-perimeter-simplification/deferred-items.md` - logged 2 out-of-scope discoveries for Waves 2/3

## Decisions Made
- **Perimeter rename chosen** (`perimeter-length`→`perimeter`, planner discretion in CONTEXT/RESEARCH Open-Q1): the markup type is already `'perimeter'`, so after dropping the area row the BOQ row type now equals the markup type. This fixes the perimeter rate-key shape to `${name}|perimeter` before any rate-key code is written downstream, avoiding a stored-key mismatch.
- **Hydrate coercion implemented despite no Wave-0 crafted-input test.** The 15-01 serialize suite asserts the round-trip + legacy-`{}` default but not the malformed-map drop. The coercion guard is nonetheless the locked T-15-02-01 mitigation and the plan's explicit Task-1 action (values into cost math + ₱ cells are an untrusted-disk surface), so it ships now; the round-trip/legacy tests still pass with it in place. No new test was added (Wave-0 owns the RED surface; out of scope to add assertions here).
- **`boq-writers.ts` left untouched** — its `BoqRowType` duplicate still carries the old split, which the plan mandates (Wave 2 scope). It is a main-process file not imported by any file edited here, so it compiles independently and the cross-process `boq-export-ipc` structural lock + full typecheck remain green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Collapsed `rowTypeToMarkupType` in TotalsRow.tsx to an identity mapping**
- **Found during:** Task 2 (BoqRowType perimeter rename)
- **Issue:** Renaming `BoqRowType` (`'perimeter-length'`/`'perimeter-area'` → `'perimeter'`) made `TotalsRow.tsx:70` (`if (t === 'perimeter-length' || t === 'perimeter-area')`) a compile error (TS2367: no overlap), breaking `npm run typecheck` — a hard success criterion for this plan. `TotalsRow.tsx` is not in this plan's `files_modified` (its UI is Wave 3), but the type change directly broke its compilation.
- **Fix:** Applied the exact, minimal change the 15-RESEARCH Removal-Map row 11 prescribes — collapsed the two-literal perimeter check. Since `MarkupType` is now identical to `BoqRowType` after the rename, the function is an identity (`return t`), kept as a named seam with updated JSDoc. No behavior change.
- **Files modified:** src/renderer/src/components/TotalsRow.tsx
- **Verification:** `npm run typecheck` exit 0; all non-aggregator web errors cleared (confirmed by grep); existing TotalsRow tests unaffected.
- **Committed in:** `c9a5d79` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** The single fix was mechanically required by this plan's own type rename and is the precisely-scoped change the research Removal-Map already specified for it. No scope creep — the broader TotalsRow UI (inline rate input) remains Wave 3's deliverable.

## Issues Encountered
- **Partial-green is the correct end state (by design).** The full suite ends at 12 sanctioned RED failures across later-wave files: `boq-writers-xlsx.test.ts` (5) + `boq-writers-csv.test.ts` (2) → Plan 15-04 (writers); `totals-row-rate-edit.test.ts` (4) → Plan 15-03 (TotalsRow input); `use-boq-live.test.ts` "recomputes when rates change" (1) → Plan 15-03/04 (useBoqLive selector). These are explicitly out of 15-02 scope per the plan's `<partial_green_expectation>` and were left untouched.
- **`snapping-engine.test.ts > performance smoke` flaked once** in the full-suite run (a timing-budget assertion under concurrent load across 628 tests). Re-run in isolation: **8/8 PASS**. Pre-existing Phase-14 flake, unrelated to 15-02 (no snapping code touched) — out of scope, not a regression.

## Out-of-Scope Discoveries (deferred)
Logged to `deferred-items.md`:
- Stale comments in `TotalsCategoryBlock.tsx:26,45` still reference the `perimeter-length`/`perimeter-area` split (comment-only, Removal-Map row 13 = no logic). Owner: Plan 15-03.
- `src/main/boq-writers.ts:18` still carries the old `BoqRowType` split. Owner: Plan 15-04 (writers).

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. This plan defines data-model contracts and wires the aggregator; no UI data sources, placeholders, or hardcoded empty values were introduced. The downstream consumers that read these fields (writers Rate/Cost columns, the inline ₱ input, the live recompute) are intentional Wave 2/3 deliverables, already covered by the sanctioned RED tests above.

## Next Phase Readiness
- **Contracts are locked for downstream waves.** Plan 15-03/04 build against: `BoqItemRow.rate/cost`, `BoqCategoryGroup.costSubtotal`, `BoqStructure.grandTotalCost`, `AggregateOptions.rates?`, and `projectStore.{rates,setRate}`.
- **15-03 (TotalsRow UI + useBoqLive):** add the inline `data-testid="totals-row-rate-input"` with `e.stopPropagation()` committing via `setRate(`${name}|${type}`, n)` on change+blur and Enter; add `rates` to `useBoqLive`'s selector + `useMemo` deps so cost recomputes live; tidy the `TotalsCategoryBlock.tsx` comments.
- **15-04 (writers):** align `src/main/boq-writers.ts` `BoqRowType` (drop the split), add Item·Quantity·UoM·Rate·Cost columns + ₱ numFmt (native-number cells) + cost-subtotal/grand-total rows + A:E heading merge; define the shared `CURRENCY_SYMBOL = '₱'` seam.
- No blockers. No package installs were needed (existing Vitest 4.1.x infra; threat register T-15-SC "accept").

## Self-Check: PASSED

---
*Phase: 15-boq-pricing-perimeter-simplification*
*Completed: 2026-06-29*
