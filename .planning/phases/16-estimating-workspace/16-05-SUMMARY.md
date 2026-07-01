---
phase: 16-estimating-workspace
plan: 05
subsystem: api
tags: [exceljs, csv-stringify, boq-export, xlsx, csv, react, zustand, ribbon, typescript]

# Dependency graph
requires:
  - phase: 16-02
    provides: "Widened boq-types.ts (PriceEntry, material/labor/markup + materialCost/laborCost/cost/price/margin, three subtotal/grand kinds) + both preload BoqItemRow/BoqStructure mirrors; projectStore.setPrice + DEFAULT_MARKUP_PCT seed; aggregator emitting the six money fields + Cost/Price/Margin subtotals & grand totals"
  - phase: 16-03
    provides: "RibbonToolbar Estimating-tab Plan|Estimate segmented toggle (viewMode) — this plan adds the Settings tab additively without disturbing it"
provides:
  - "buildBoqXlsx 9-column estimate layout (Item·Quantity·UoM·Material·Labor·Cost·Markup·Price·Margin) — Material/Labor/Cost/Price/Margin native ₱ numbers (SUM-safe), Markup native with a percent numFmt, per-category Cost/Price/Margin subtotal + grand rows, A:I heading merge"
  - "buildBoqCsv 9-column layout — six money columns as plain numerics (integer-clean, trailing-zero-preserving 2dp), UTF-8 BOM on line 1 preserved"
  - "Completed the 4-way BoqItemRow/BoqCategoryGroup/BoqStructure type lock (writer inline mirror is the 4th copy, now reconciled with boq-types.ts + both preload mirrors)"
  - "Settings ribbon tab: an editable project-wide Default markup % control (in-session, seeded from DEFAULT_MARKUP_PCT) replacing the Coming-soon stub"
  - "PROJECT.md records the estimate model as delivered by Phase 16 (supersedes Phase-15 inline pricing); 16-MANUAL-NOTES.md — estimator-facing back-compat + ₱ constant + Settings scope + priced-export UAT"
affects: [estimating-workspace, boq-export, verification, uat, milestone-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Writer-local NUMFMT_PERCENT ('0\"%\"') sibling to NUMFMT_PESO — a display-only percent suffix (stored value is the plain percent number 30, NEVER Excel's '0%' which ×100); the main process keeps its own copy per the duplication-with-test-lock convention (cannot import the renderer currency seam)"
    - "csvMoney(): integer values emit as plain integer strings ('3','20'); fractional values emit at 2dp preserving the trailing zero ('32.10','24.69') — distinct from Number(x.toFixed(2)) which strips it (32.10→32.1). Satisfies both the whole-number Outlet row and the fractional Wire row in the same regex-asserting test"
    - "Single combined subtotal/grand ₱ row carries Cost→col6 / Price→col8 / Margin→col9 together (Markup col7 blank), padded to 9 cells — the writer test finds one row by (col1 includes 'Subtotal'/'Grand Total') AND col6===cost, then reads price/margin from cols 8/9 of that SAME row"

key-files:
  created:
    - ".planning/phases/16-estimating-workspace/16-MANUAL-NOTES.md"
  modified:
    - "src/main/boq-writers.ts"
    - "src/renderer/src/components/RibbonToolbar.tsx"
    - ".planning/PROJECT.md"

key-decisions:
  - "Emitted ONE combined subtotal ₱ row (Cost/Price/Margin in cols 6/8/9) and ONE combined grand row, not three separate rows — the Wave-0 xlsx test asserts price/margin on the SAME row it finds by col6===cost (three separate rows would fail priceCell.value)"
  - "CSV money uses csvMoney (integer-or-2dp-string), not Number(x.toFixed(2)) — the test requires whole numbers plain ('3') AND fractional trailing zeros preserved ('32.10'); Number() would collapse 32.10→32.1"
  - "Settings default-markup control shipped in-session-only (v1 minimum per D-05/D-09) — a persisted, aggregator-wired mutable default would require editing out-of-scope files (projectStore/project-serialize/boq-aggregator); the DEFAULT_MARKUP_PCT seam + the aggregator 'absent entry → markup 30' contract are left byte-identical so 30 stays the shipped default and the markup-default-30 tests stay green"

patterns-established:
  - "NUMFMT_PERCENT writer-local constant for percent display cells"
  - "csvMoney formatter for whole-vs-fractional numeric CSV cells"
  - "Combined multi-value subtotal/grand ₱ row (one row, values in matching group columns, padded to full width)"

requirements-completed: [SC-5, SC-6]

# Metrics
duration: 30min
completed: 2026-07-01
---

# Phase 16 Plan 05: Estimating Workspace — Writer Boundary + Settings Default-Markup + Docs Summary

**9-column priced xlsx/csv export (native ₱ Material/Labor/Cost/Price/Margin + percent Markup, Cost/Price/Margin subtotals & grand totals, A:I merge, BOM), the completed 4-way BoqItemRow type lock, an editable Settings default-markup control, and the PROJECT.md/manual-notes closure — the final source seam of Phase 16.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-01T15:51:00Z (Wave-0 RED baseline confirmed)
- **Completed:** 2026-07-01T16:01:00Z (full suite green + typecheck clean)
- **Tasks:** 3
- **Files modified:** 4 (2 source, 2 planning docs — exactly the declared set)

## Accomplishments
- **Both writers widened to the locked 9-column estimate layout** (Item · Quantity · UoM · Material · Labor · Cost · Markup · Price · Margin). xlsx: Material/Labor/Cost/Price/Margin are native ₱ numbers (SUM-safe), Markup is a native number with a percent numFmt (not ₱), per-category Cost/Price/Margin subtotal rows + grand-total Cost/Price/Margin rows render, and the category heading merge widened A:E → A:I. csv: the six money columns are plain numerics and the UTF-8 BOM still leads line 1.
- **4-way type lock completed** — the writer's inline `BoqItemRow`/`BoqCategoryGroup`/`BoqStructure` (the 4th mirror Wave 1 deliberately left on the old `rate`/`cost` shape) is now reconciled field-for-field with `boq-types.ts` + both preload copies. `npm run typecheck` (node + web) is clean and `boq-export-ipc.test.ts` (the structural lock) passes.
- **Settings ribbon tab gains an editable Default markup % control** (`data-testid=settings-default-markup-input`, seeded from `DEFAULT_MARKUP_PCT`=30, parseFloat NaN/negative→0), replacing the Coming-soon stub — without disturbing the 16-03 Plan|Estimate toggle. The `DEFAULT_MARKUP_PCT` seam and the aggregator's "absent entry → markup 30" contract are untouched, so 30 remains the shipped default and the markup-default-30 aggregator tests stay green.
- **Closure recorded** — PROJECT.md's Validated pricing entry now records the Phase-16 estimate model (internal cost + markup→price/margin, dedicated Estimate workspace, quantity-only totals panel, 9-column export) as delivered/superseding Phase-15 inline pricing, plus a Key-Decision row; the new `16-MANUAL-NOTES.md` documents (1) Phase-15→16 back-compat, (2) the Estimate workspace, (3) the hardcoded ₱ + Settings default-markup scope (recorded honestly as in-session-only), and (4) a numbered estimate + 9-column-export UAT checklist.
- **Full suite green: 642/642** (84 files, 0 failures) with typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen both writers to the 9-column layout + complete the 4-way type lock** — `581ecf1` (feat)
2. **Task 2: Add the editable default-markup % control to the Settings ribbon tab** — `da7b3aa` (feat)
3. **Task 3: Flip PROJECT.md to record the estimate model as delivered + write 16-MANUAL-NOTES.md** — `2e46f03` (docs)

_No plan-metadata commit is made by the executor for this plan — the orchestrator owns STATE.md/ROADMAP.md writes after this plan completes (per the sequential-executor instructions)._

## Files Created/Modified
- `src/main/boq-writers.ts` — Widened the inline BoqItemRow/BoqCategoryGroup/BoqStructure mirror (4-way lock); added `NUMFMT_PERCENT` + `COL_WIDTH_MONEY`; `buildBoqXlsx` now emits 9 columns with native ₱ money cells + percent Markup, combined Cost/Price/Margin subtotal & grand rows, A:I heading merge; `buildBoqCsv` mirrors the 9 columns via the new `csvMoney` formatter with the BOM preserved. New helpers: `setMoneyCell`, `appendMoneySubtotalRows`, `appendMoneyGrandRow`, `csvMoney` (replacing `appendCostSubtotalRow`).
- `src/renderer/src/components/RibbonToolbar.tsx` — Imported `DEFAULT_MARKUP_PCT`; added an in-session `defaultMarkup` state + a `renderSettingsTab()` render fn (labeled numeric input + `%` affordance + helper caption); rewired `case 'settings'` from `renderStubTab('Settings')` to `renderSettingsTab()`. The 16-03 Estimating-tab toggle is untouched.
- `.planning/PROJECT.md` — Extended the Phase-15 pricing Validated entry to record the Phase-16 estimate-model expansion (superseding Phase-15 inline pricing); added a Key-Decision estimating-workspace row. Currency picker + Item Library remain explicitly deferred.
- `.planning/phases/16-estimating-workspace/16-MANUAL-NOTES.md` — NEW. Estimator-facing manual notes: a glance table + 4 numbered sections (back-compat, Estimate workspace, ₱ constant + Settings scope, UAT checklist).

## Decisions Made
- **Combined subtotal/grand ₱ rows (one row each), not three.** The Wave-0 xlsx test finds a single subtotal row by `col1 includes 'Subtotal'` AND `col6 === 44.69`, then reads price from `getCell(8)` and margin from `getCell(9)` **of that same row**. Emitting three separate rows (each with one value) would leave cols 8/9 null on the Cost row and fail the price/margin assertions. So each of the subtotal and grand-total is a single row carrying Cost→6, Price→8, Margin→9 together (Markup col 7 blank), padded to 9 cells.
- **CSV money uses `csvMoney` (integer-or-2dp-string), not `Number(x.toFixed(2))`.** The csv test asserts `Outlet,5,ea,3,1,20,30,26,6` (whole numbers, no decimals) AND `Wire,12.35,m,2,0,24.69,30,32.10,7.41` (price `32.10` with trailing zero). `Number(32.097.toFixed(2))` = `32.1` (trailing zero stripped → fails Wire); `.toFixed(2)` string uniformly = `3.00` (→ fails Outlet). Only `Number.isInteger(v) ? String(v) : v.toFixed(2)` satisfies both. Verified empirically against `csv-stringify` before writing the source.
- **Settings control shipped in-session-only (plan-sanctioned v1 minimum).** Wiring a persisted, aggregator-read mutable default would require editing `projectStore.ts`, `project-serialize.ts`, and `boq-aggregator.ts` — all outside this plan's four declared files, and would touch the `?? DEFAULT_MARKUP_PCT` seam the critical-context mandates keeping intact. Per D-05/D-09 the acceptable v1 minimum is "the input present + functional against a renderer-held value"; the persistence deferral is recorded honestly in the manual notes (Section 3).

## Deviations from Plan

None — plan executed exactly as written.

The one point where I followed the **tests over the prose**: the plan's Task-1 action text (steps 5 and 6) described the per-category and grand-total money output as "THREE rows — Cost, Price, Margin". The authoritative Wave-0 xlsx assertions require those three values on a **single** row (found by col6===cost, with price/margin read from cols 8/9 of the same row). I implemented the single-combined-row form to match the tests exactly (the plan's own `<read_first>`/critical-context is explicit that the tests are the authority: "match every assertion exactly"). This is a faithful reading of the locked contract, not a scope deviation — no extra files touched, no behavior beyond the plan's stated 9-column/subtotal/grand goal.

## Issues Encountered
- **CSV trailing-zero vs. whole-number tension.** `Number(x.toFixed(2))` and a uniform `.toFixed(2)` string each pass one of the two csv item-row regexes and fail the other. Resolved by deriving a formatter (`csvMoney`) that branches on `Number.isInteger`, validated empirically with a throwaway `node -e` against `csv-stringify` before committing. No other issues.

## User Setup Required

None — no external service configuration required. No package installs occurred (existing exceljs / csv-stringify / React / Zustand only).

## Known Stubs

- **Settings "Default markup %" control is in-session-only.** The input is a real, functional editable field (seeded at 30, validated), but it does **not** yet persist across save/reload and does **not** re-wire the aggregator's default — unpriced rows still use `DEFAULT_MARKUP_PCT` (30). This is the plan's sanctioned v1 minimum (D-05/D-09) and is recorded honestly in `16-MANUAL-NOTES.md` §3. A persisted, aggregator-wired mutable default is a small follow-on (touches projectStore/project-serialize/boq-aggregator — out of scope for this plan). Not a blocker: the phase goal (a Settings control replacing the stub) is achieved; 30 remains the correct shipped default.

## Next Phase Readiness
- **Phase 16 is source-complete.** This was the last source seam — all Wave-0 RED tests are now GREEN (aggregator/serialize/schema/use-boq-live from 16-02, estimate-grid/view-switch from 16-03, totals-panel-quantity-only from 16-04, and both writer tests here). Full suite 642/642, typecheck clean.
- **Ready for `/gsd:verify-work` + human UAT.** The manual-only checks (estimate live-edit feel, Plan⟷Estimate switch, quantity-only totals panel, priced Excel/CSV export) are enumerated in `16-MANUAL-NOTES.md` §4 and `16-VALIDATION.md`.
- **Snapping-engine flake did not appear** in this run's full suite; no isolation re-run was needed. Every test passed deterministically.
- Orchestrator to update STATE.md / ROADMAP.md and mark requirements SC-5/SC-6 complete.

## Self-Check: PASSED

- Files verified present: `src/main/boq-writers.ts`, `src/renderer/src/components/RibbonToolbar.tsx`, `.planning/PROJECT.md`, `.planning/phases/16-estimating-workspace/16-MANUAL-NOTES.md`, `.planning/phases/16-estimating-workspace/16-05-SUMMARY.md`.
- Commits verified present: `581ecf1` (Task 1), `da7b3aa` (Task 2), `2e46f03` (Task 3).
- Gates: `npm run typecheck` clean (node + web); `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` 23/23 GREEN; full suite 642/642 (0 failures, snapping-engine flake did not appear); markup-default-30 aggregator tests green (DEFAULT_MARKUP_PCT seam intact).

---
*Phase: 16-estimating-workspace*
*Completed: 2026-07-01*
