---
phase: 16-estimating-workspace
plan: 04
subsystem: ui
tags: [react, totals-panel, boq, revert, quantity-only, zustand]

# Dependency graph
requires:
  - phase: 15-boq-pricing-and-perimeter
    provides: "Plan 15-03 inline ₱ rate field + per-row cost + per-category cost-subtotal + grand-total bar on the totals panel (the render additions this plan reverts)"
  - phase: 16-estimating-workspace (16-02, Wave 1)
    provides: "projectStore.rates widened Record<string,number> → Record<string,PriceEntry>; setRate → setPrice — the widened pricing API the Wave-1 compile-fix adapted TotalsRow onto, now removed wholesale"
  - phase: 16-estimating-workspace (16-01, Wave 0)
    provides: "src/tests/totals-panel-quantity-only.test.ts RED contract (proof e / D-02) — the ABSENT/PRESENT assertions this plan turns GREEN"
provides:
  - "Quantity-only right-side totals panel — no ₱ rate field, no cost, no cost subtotal, no grand-total-cost bar (D-02)"
  - "TotalsRow reverted to cycle-dot + lightbulb + color-chip + label + quantity + UoM + Plus (quantity-only); no price read or write"
  - "TotalsCategoryBlock renders heading + item rows only; TotalsPanel renders header + categories + context menu only"
  - "proof e GREEN (totals-panel-quantity-only.test.ts): Phase-15 pricing render nodes absent, quantity/visibility/chip survivors present"
affects: [16-05, boq-writers, estimate-workspace, verify-work, UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Revert-to-quantity-only: strip Phase-15 pricing render nodes + their dead machinery/imports from a component while preserving the visibility/cycle/arm survivors (Removal Map, D-02)"

key-files:
  created:
    - .planning/phases/16-estimating-workspace/16-04-SUMMARY.md
  modified:
    - src/renderer/src/components/TotalsRow.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/TotalsPanel.tsx

key-decisions:
  - "Removed the whole rate machinery block from TotalsRow (rateKey memo, rate selector, rateInputRef + seed effect, commitRate + native-listener effect, formatCost) — not just the JSX — so no dead price read/write remains; setPrice/rates are no longer referenced by the panel"
  - "Trimmed useEffect + useRef from TotalsRow's React import (both effects removed; cycle state uses useState, memos use useMemo) — kept useProjectStore (still drives hiddenItemSet + toggleHiddenItem)"
  - "Removed CURRENCY_SYMBOL import from all three totals components but KEPT src/renderer/src/lib/currency.ts itself (Estimate workspace + main-process writers still consume it — SP-4)"
  - "Simplified TotalsCategoryBlock's expanded body from a fragment (items + cost-subtotal) to the bare items map now that the subtotal is gone — type-checks cleanly, one fewer wrapper node"

patterns-established:
  - "Revert / Remove (D-02): delete pricing render nodes + their supporting hooks/helpers/imports as one atomic per-file edit; grep gates (zero rate-input/cost/cost-subtotal/grand-total/CURRENCY_SYMBOL) + typecheck (no TS6133) + the KEEP-GREEN suites are the completeness proof"

requirements-completed: [SC-1]

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 16 Plan 04: Totals Panel Quantity-Only Revert Summary

**Reverted the right-side totals panel to quantity-only (D-02) — stripped Phase-15's inline ₱ rate input, per-row cost, per-category cost-subtotal, and pinned grand-total ₱ bar (plus all dead rate machinery + CURRENCY_SYMBOL imports) from TotalsRow / TotalsCategoryBlock / TotalsPanel, turning the Wave-0 `totals-panel-quantity-only` RED test GREEN while keeping quantity, visibility, color chip, and cycle-nav intact.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-01T07:40:00Z
- **Completed:** 2026-07-01T07:45:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Stripped the inline ₱ rate input (`totals-row-rate-input`) + row cost span (`totals-row-cost`) + all rate machinery (`rateKey` memo, `rate` selector, `rateInputRef` + seed effect, `commitRate` + native-listener effect, `formatCost` helper) from `TotalsRow` — the panel no longer reads or writes prices.
- Removed the per-category ₱ cost-subtotal (`totals-category-cost-subtotal`) from `TotalsCategoryBlock` and the pinned grand-total ₱ bar (`totals-grand-total`) from `TotalsPanel`; dropped the `CURRENCY_SYMBOL` import from all three components (the `currency.ts` module itself stays — Estimate + writers use it).
- Turned proof e GREEN: `totals-panel-quantity-only.test.ts` went 3-failing → 0-failing (all pricing-node ABSENT assertions pass; quantity + lightbulb + color-chip survivors still present).
- Zero regressions across the seven KEEP-GREEN totals suites (43 tests pass with the GREEN target); typecheck clean (node + web); writer tests remain RED by design (Wave 3).

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip the inline ₱ rate input + row cost span + rate machinery from TotalsRow (quantity-only)** — `3cce332` (refactor)
2. **Task 2: Remove the per-category ₱ cost-subtotal (TotalsCategoryBlock) and the grand-total ₱ bar (TotalsPanel)** — `ae164f6` (refactor)

_Note: no TDD split — this is a render-node revert against a pre-existing Wave-0 RED test; each task is a single refactor commit._

## Files Created/Modified
- `src/renderer/src/components/TotalsRow.tsx` — Removed the inline rate input JSX, the row cost span, `formatCost`, the `rateKey`/`rate`/`rateInputRef`/`commitRate` block + both rate `useEffect`s, the `CURRENCY_SYMBOL` import, and the now-unused `useEffect`/`useRef` React imports. Kept quantity, lightbulb (`toggleHiddenItem`), color chip, label, UoM, cycle-dot, cycle nav (`handleClick`/`setPage`/`onTriggerPulse`), arm-tool (`onArmTool`), Plus affordance, and the `labelToName`/`rowTypeToMarkupType`/`formatQuantity`/`itemKey`/`isHidden` seams (−152 / +1 lines).
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — Removed the `totals-category-cost-subtotal` block + the `CURRENCY_SYMBOL` import; simplified the expanded body from a fragment (items + subtotal) to the bare items map. Kept the heading, chevron/collapse (`useUiPanels`), and item rows.
- `src/renderer/src/components/TotalsPanel.tsx` — Removed the pinned `totals-grand-total` ₱ bar block + the `CURRENCY_SYMBOL` import; updated the component docstring. Kept the rail, header row, metadata header (`TotalsPanelHeader`), empty-state tree, category list, and context menu (`totalPages` still consumed by the empty-state branch, so no unused-var).

## Decisions Made
- Removed the entire rate read/write path from `TotalsRow`, not just the visible JSX — leaving `setPrice`/`rates` references would have been dead code and a lingering price-write seam on the measurement panel (D-02 says the panel is quantity-only and references neither). Grep-verified zero `setPrice`/`s.rates[` matches remain.
- Kept `src/renderer/src/lib/currency.ts` (SP-4): only the three totals components' imports were removed. The Estimate workspace (16-03) imports `CURRENCY_SYMBOL` and the main-process writers keep their own `NUMFMT_PESO`, so the module must stay.
- Collapsed `TotalsCategoryBlock`'s `<>…</>` fragment to the bare `category.items.map(...)` inside the `!isCollapsed &&` guard — React renders the array directly, one fewer wrapper, and it type-checks cleanly.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the Removal Map (16-RESEARCH) and the line-by-line strip tables (16-PATTERNS "Revert / Remove") exactly; no bugs, missing functionality, blocking issues, or architectural changes were encountered. No auth gates. No package installs.

## Issues Encountered
None. Baseline was captured before editing (proof-e target 3-failing / 1-passing as designed; 7 KEEP-GREEN suites all green; `totals-row-rate-edit.test.ts` already deleted in Wave 0), the two edits applied cleanly, and every gate passed on the first run.

## Known Stubs
None. This plan removes render nodes; it introduces no hardcoded/empty/placeholder data. The survivors (quantity, visibility, color chip, cycle) are fully wired via `useBoqLive` + `projectStore` exactly as before.

## Verification Results
- `npx vitest run src/tests/totals-panel-quantity-only.test.ts` → **GREEN** (4/4; the 3 ABSENT-assertion tests + the 1 survivor test all pass).
- `npx vitest run` the seven KEEP-GREEN suites (totals-row-cycle / -visibility / -context-menu / -hover, totals-panel-render / -empty-states / -category-collapse) with the GREEN target → **8 files / 43 tests pass** (no regressions).
- `npm run typecheck` (node + web) → **clean, 0 errors** (no TS6133 unused-import/var leftovers).
- `git grep` gate → **zero** `totals-row-rate-input` / `totals-row-cost` / `totals-category-cost-subtotal` / `totals-grand-total` / `CURRENCY_SYMBOL` / `setPrice` / `s.rates[` matches across the three files.
- `boq-writers-xlsx.test.ts` + `boq-writers-csv.test.ts` → **still RED** (2 files / 9 tests fail) — expected; Wave 3 owns them and `boq-writers.ts` was not touched.
- Scope boundary confirmed: my two commits touched only the three declared totals components; the 16-03 Estimate components + `boq-writers.ts` + STATE.md/ROADMAP.md were left untouched.

## Self-Check: PASSED
- `.planning/phases/16-estimating-workspace/16-04-SUMMARY.md` — FOUND (this file)
- `src/renderer/src/components/TotalsRow.tsx` — FOUND (modified, committed 3cce332)
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — FOUND (modified, committed ae164f6)
- `src/renderer/src/components/TotalsPanel.tsx` — FOUND (modified, committed ae164f6)
- Commit `3cce332` — FOUND in git log
- Commit `ae164f6` — FOUND in git log

## Next Phase Readiness
- The totals panel is now quantity-only, satisfying SC-1's totals-panel half. Phase 15's inline totals-panel pricing (15-HUMAN-UAT item 1) is retired.
- Ready for Wave 3 (16-05): the nine-column priced export + Settings default-markup + docs. The writer tests (`boq-writers-*`) are the remaining RED and are Wave 3's to turn GREEN.
- MANUAL UAT deferred (16-VALIDATION Manual-Only): confirm the right totals panel shows quantities only — no ₱ anywhere — when running the app.
- No blockers.

---
*Phase: 16-estimating-workspace*
*Completed: 2026-07-01*
