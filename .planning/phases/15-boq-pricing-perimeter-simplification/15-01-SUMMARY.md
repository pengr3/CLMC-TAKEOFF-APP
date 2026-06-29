---
phase: 15-boq-pricing-perimeter-simplification
plan: 01
subsystem: testing
tags: [vitest, boq, pricing, perimeter, nyquist, red-tests, exceljs, csv, zustand]

# Dependency graph
requires:
  - phase: 14-markup-geometry-precision
    provides: arc-aware aggregator (polylineLength/polygonArea with m.arcs) — WR-07 length guard preserved
provides:
  - "Wave 0 Nyquist RED test surface for Phase 15 — every Wave 1-3 source task now has a failing test pointing at it"
  - "Perimeter two-row → one-row contract encoded as assertions (length-only, no area row)"
  - "rate/cost/costSubtotal/grandTotalCost row+structure assertions (aggregator + xlsx + csv)"
  - "rates Record<string,number> round-trip assertions (serialize snapshot/hydrate + schema tolerance)"
  - "useBoqLive live-rate-recompute assertion (proof b)"
  - "Inline ₱ rate input render test (setRate dispatch + stopPropagation) — new totals-row-rate-edit.test.ts"
  - "perimeter-area/perimeter-length test fixtures migrated to 'perimeter' (zero split-type tokens in src/tests)"
affects: [15-02, 15-03, 15-04, 15-05, 15-06, boq-aggregator, boq-writers, project-schema, project-serialize, projectStore, TotalsRow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nyquist test-first: write the RED proof before any source change; downstream task is 'turn this green'"
    - "`as any` / `as unknown as BoqStructure` casts to reference not-yet-existing fields while keeping tsc clean (mirrors project-schema-hidden.test.ts)"
    - "Category-independent rate key string `${name}|${type}` asserted directly in tests"

key-files:
  created:
    - src/tests/totals-row-rate-edit.test.ts
  modified:
    - src/tests/boq-aggregator.test.ts
    - src/tests/project-serialize.test.ts
    - src/tests/project-schema.test.ts
    - src/tests/use-boq-live.test.ts
    - src/tests/boq-writers-xlsx.test.ts
    - src/tests/boq-writers-csv.test.ts
    - src/tests/totals-row-cycle.test.ts
    - src/tests/totals-row-context-menu.test.ts

key-decisions:
  - "Perimeter one-row fixture relabeled to plain 'Wall' with uom 'm' (not 'Wall (area)'/'m²') — reflects the lone-perimeter collision rule and avoids a stray (area) perimeter label"
  - "project-schema rates tests assert ADDITIVE TOLERANCE (accept + tolerate absence), not a thrown error — validateV2 passes unknown fields through, so these are green guards, matching the hiddenItemNames analog and the locked throw-free decision"
  - "Set IS_REACT_ACT_ENVIRONMENT at module scope in the new render test (sibling render-test convention, 9 existing files) to silence the React 19 act() stderr false-positive"

patterns-established:
  - "RED proof maps 1:1 to a Wave 1-3 source task (15-VALIDATION proofs a/b/c)"
  - "Writer fixtures carry rate/cost/costSubtotal/grandTotalCost via cast so the column tests compile before boq-types.ts gains the fields"

requirements-completed: [SC-1, SC-2, SC-3, SC-5, SC-6]

# Metrics
duration: 13min
completed: 2026-06-29
---

# Phase 15 Plan 01: Nyquist RED Test Surface (Wave 0) Summary

**Test-only Wave 0 that encodes the BOQ pricing model (rate/cost/subtotals/grand-total) and the perimeter two-row→one-row contract as 22 failing assertions across 9 files — every Phase 15 source task now has a concrete RED proof, and tsc stays clean via `as any` casts.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-29T17:34:00Z (green baseline captured: boq-aggregator 9/9 pass)
- **Completed:** 2026-06-29T17:45:28Z (last task commit)
- **Tasks:** 3
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments
- Rewrote the two perimeter aggregator cases to the locked **one-row (length-only)** contract: a lone perimeter yields exactly ONE plainly-labelled row, no `(area)` row; the WR-07 arc-aware LENGTH guard (`300 + π·R`) survives as the Phase-14 regression guard.
- Added the full **pricing proof set** (proofs a/b/c) as RED assertions: `cost = rate × quantity`, per-category `costSubtotal`, project `grandTotalCost`, absent-rate → `rate 0/cost 0` (no throw), category-independent rate key, and the perimeter collision-suffix rule (`Skirting (linear)` + `Skirting (perimeter)`).
- Added **persistence + live + export** RED proofs: `rates` snapshot/hydrate round-trip + legacy `{}` default; `validateV2` additive tolerance; `useBoqLive` live cost recompute on rate edit; xlsx 5-column `Item/Quantity/UoM/Rate/Cost` with native-number ₱ cells + cost-subtotal/grand-total rows + `A:E` heading merge; csv `Rate`/`Cost` numeric columns + BOM preserved.
- Created **`totals-row-rate-edit.test.ts`**: the inline ₱ rate input render test asserting `setRate('Outlet|count', n)` dispatch on change+blur AND keydown Enter, plus `stopPropagation` (no `onArmTool`/`setPage` from input interaction).
- **Migrated** every `perimeter-area`/`perimeter-length` test fixture to `'perimeter'` — `git grep` across `src/tests` now returns zero split-type tokens; the migrated cycle + context-menu tests still PASS.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite aggregator perimeter cases + add rate/cost cases (proofs a, c)** - `b5a2751` (test)
2. **Task 2: Add rates round-trip + schema-default + live-recompute + writer-column tests (proofs a, b)** - `aff8301` (test)
3. **Task 3: New inline-rate render test + migrate perimeter-type fixtures (proofs b, c)** - `5e1bb96` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/tests/totals-row-rate-edit.test.ts` - NEW: inline ₱ rate input render test (setRate dispatch + stopPropagation), all RED
- `src/tests/boq-aggregator.test.ts` - Perimeter one-row rewrite (×2) + 5 RED rate/cost/collision/independence cases
- `src/tests/project-serialize.test.ts` - rates snapshot emit + hydrate round-trip + legacy `{}` default (RED)
- `src/tests/project-schema.test.ts` - validateV2 accepts rates + tolerates absence (additive-tolerance guards, green)
- `src/tests/use-boq-live.test.ts` - `recomputes when rates change` live-cost proof (RED)
- `src/tests/boq-writers-xlsx.test.ts` - 5-col title, native-number Rate/Cost cells w/ ₱ numFmt, cost-subtotal + grand-total-cost rows, A:E merge (RED)
- `src/tests/boq-writers-csv.test.ts` - title Rate/Cost, numeric rate/cost (no ₱ glyph in data), BOM preserved (RED)
- `src/tests/totals-row-cycle.test.ts` - perimeter-area fixture → 'perimeter' (label 'Wall', uom 'm'); navigation assertion kept (PASS)
- `src/tests/totals-row-context-menu.test.ts` - perimeter-length fixture → 'perimeter'; .toFixed(2) payload assertion kept (PASS)

## Decisions Made
- **Perimeter one-row fixture labels** changed from `'Wall (area)'`/`'m²'` to plain `'Wall'`/`'m'` — the migrated cycle fixture now reflects the lone-perimeter collision rule (no `(area)` split) while still asserting `rowTypeToMarkupType('perimeter') === 'perimeter'` navigation. The label is not a grep target token, but leaving a stray `(area)` perimeter label would contradict the one-row contract.
- **project-schema rates tests are tolerance guards, not RED.** `validateV2` returns `raw as ProjectFileV2` and does NOT strip unknown fields, so a `rates`-bearing object survives validation today. The plan explicitly says do NOT assert a thrown error for a malformed rates map at validateV2 (the locked decision keeps validateV2 throw-free for additive fields; coercion lives in hydrate). These two tests therefore PASS today and correctly mirror the pre-Phase-8 hiddenItemNames absent-field tolerance. The genuine persistence RED proofs (proof b) live in `project-serialize.test.ts` (snapshot/hydrate) and `use-boq-live.test.ts`.
- **`IS_REACT_ACT_ENVIRONMENT = true` at module scope** added to the new render test, following the documented sibling convention (9 existing files; STATE.md locked decision). Silences the React 19 "act environment not configured" stderr false-positive without touching vitest.config.ts (parallel-executor-safe).

## Deviations from Plan

None - plan executed exactly as written. (No bugs, no missing-critical functionality, no blocking issues, no architectural changes. The label/uom adjustment on the migrated perimeter fixture and the schema-tests-are-green nuance are both explicitly within the plan's stated discretion and its "do NOT assert a thrown error at validateV2" instruction — documented under Decisions Made, not as deviations.)

## Issues Encountered
- **React 19 `act()` stderr warning** appeared in the new render test and the `use-boq-live` rates test (a known harness characteristic shared by the existing totals-row/use-boq-live tests). Resolved in the new file by setting `IS_REACT_ACT_ENVIRONMENT` at module scope per the established project convention. The warning is stderr-only (not a test failure or compile error); the `use-boq-live` test's RED assertion is unaffected.

## RED Surface Verification (intended Wave 0 state)

Combined run of the 9 plan files: **22 failed / 59 passed (81 total)** — all 22 failures are runtime assertion failures for the right reasons (missing `rate`/`cost`/`costSubtotal`/`grandTotalCost`, two-row→one-row perimeter contract, perimeter excluded from collision today, no Rate/Cost writer columns, no `rates` in store/serialize, no inline rate input). The 59 passing include every untouched D-01..D-13 case, the migrated perimeter fixtures, and the schema additive-tolerance guards.

Hard requirements (all met):
- `npm run typecheck` (tsc --noEmit, node + web) — **0 errors**. RED assertions are runtime failures, NOT compile errors.
- `git grep -n "perimeter-area\|perimeter-length" src/tests` — **ZERO matches**.
- `git grep -n "Wall (area)\|perimeter-area\|Curved (area)" src/tests/boq-aggregator.test.ts` — **ZERO matches**.
- `boq-export-ipc.test.ts` (the cross-process structural lock — do-not-edit) — still compiles + passes 7/7.

## Known Stubs
None. This plan adds only test assertions; no UI data sources, placeholders, or hardcoded empty values were introduced. The "missing" production fields (rate/cost/rates/etc.) are intentionally absent — they are the Wave 1-3 deliverables these RED tests target, documented in 15-VALIDATION.md proofs a/b/c.

## Next Phase Readiness
- Wave 0 is complete: every Wave 1-3 source task has at least one failing test pointing at it. Suggested set `nyquist_compliant: true` in 15-VALIDATION.md once the planner confirms the map.
- **15-02/03 (aggregator + types):** turn green the 7 boq-aggregator RED cases — add `rate`/`cost` to `BoqItemRow`, `costSubtotal` to `BoqCategoryGroup`, `grandTotalCost` to `BoqStructure`, `rates?` to `AggregateOptions`; rename `BoqRowType` `'perimeter-length'`→`'perimeter'` + delete `'perimeter-area'`; drop the perimeter area synthesis; fold perimeter into the D-02 collision set.
- **15-04 (persistence + live):** add `rates` + `setRate` to projectStore (mirror toggleHiddenItem), thread through snapshotProject/hydrateStores + ProjectFileV2 (additive, no formatVersion bump), and add `rates` to useBoqLive's selector + memo deps.
- **15-05 (writers):** add Rate/Cost columns + ₱ numFmt + cost subtotal/grand-total rows + A:E merge to buildBoqXlsx/buildBoqCsv (define the shared `CURRENCY_SYMBOL = '₱'` constant — no such constant exists yet).
- **15-06 (TotalsRow UI):** add the inline `data-testid="totals-row-rate-input"` with `e.stopPropagation()` mirroring the lightbulb pattern; commit on change+blur and Enter via `setRate(`${name}|${type}`, n)`.
- No blockers. No package installs were needed (Wave 0 used the existing Vitest 4.1.x infra, per the threat register T-15-SC "accept").

## Self-Check: PASSED

- FOUND: `.planning/phases/15-boq-pricing-perimeter-simplification/15-01-SUMMARY.md`
- FOUND: `src/tests/totals-row-rate-edit.test.ts`
- FOUND: `src/tests/boq-aggregator.test.ts`
- FOUND commit: `b5a2751` (Task 1)
- FOUND commit: `aff8301` (Task 2)
- FOUND commit: `5e1bb96` (Task 3)

---
*Phase: 15-boq-pricing-perimeter-simplification*
*Completed: 2026-06-29*
