---
phase: 15-boq-pricing-perimeter-simplification
plan: 03
subsystem: ui
tags: [boq, pricing, peso, totals-panel, react, zustand, konva, perimeter, useBoqLive, inline-edit]

# Dependency graph
requires:
  - phase: 15-boq-pricing-perimeter-simplification (Plan 15-02)
    provides: "projectStore.rates + setRate; BoqItemRow.rate/cost, BoqCategoryGroup.costSubtotal, BoqStructure.grandTotalCost, AggregateOptions.rates?; BoqRowType 'perimeter' rename"
  - phase: 15-boq-pricing-perimeter-simplification (Plan 15-01)
    provides: "Wave 0 RED proofs this plan turns GREEN — totals-row-rate-edit.test.ts + use-boq-live.test.ts 'recomputes when rates change'"
  - phase: 14-markup-geometry-precision
    provides: "arc-aware polylineLength(closingPts, m.arcs) — the perimeter LENGTH path kept verbatim (no Phase 14 regression)"
provides:
  - "src/renderer/src/lib/currency.ts — the single renderer-side CURRENCY_SYMBOL='₱' seam"
  - "useBoqLive subscribes to rates (selector + useMemo deps) → inline rate edit recomputes cost live (proof b)"
  - "TotalsRow inline ₱ rate input keyed category-independently by `${name}|${type}`, dispatching setRate with stopPropagation; ₱ cost display read from item.cost"
  - "TotalsCategoryBlock per-category ₱ cost-subtotal render (data-testid=totals-category-cost-subtotal)"
  - "TotalsPanel pinned ₱ grand-total cost bar (data-testid=totals-grand-total)"
  - "PerimeterMarkup unfilled closed outline + length-only 'P: <len> <unit>' label; area imports/math removed"

affects: [15-04, boq-writers, TotalsRow, TotalsPanel, TotalsCategoryBlock, PerimeterMarkup, how-to-manual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single renderer-side currency seam (currency.ts) imported by every ₱ consumer; main-process writers keep their own copy (Wave 3)"
    - "Inline rate field is UNCONTROLLED + native event listeners (input/change/blur/keydown via a ref) — bypasses React's synthetic value-tracker suppression + the blur→focusout delegation gap so change+blur AND Enter both reliably commit"
    - "rateKey `${name}|${type}` is a DISTINCT string from the visibility itemKey `${name}|${categoryId}` — category-independent pricing vs category-scoped visibility"
    - "Defensive UI formatters (formatCost / costSubtotal / grandTotal) coerce non-finite → 0 so rows/categories render ₱0.00 instead of throwing on a not-yet-populated field"

key-files:
  created:
    - src/renderer/src/lib/currency.ts
  modified:
    - src/renderer/src/hooks/useBoqLive.ts
    - src/renderer/src/components/TotalsRow.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx

key-decisions:
  - "Inline rate input implemented UNCONTROLLED with native listeners (not React onChange/onBlur). React's synthetic onChange is suppressed by its value-tracker when a caller sets input.value then dispatches a native 'input' event, and React delegates blur as 'focusout' so a raw 'blur' event never reaches a synthetic onBlur. Native input/change/blur/keydown listeners fire on exactly the events emitted → all four rate-edit assertions (change+blur, Enter, stopPropagation×2) pass without touching the do-not-edit test."
  - "Defensive coercion in formatCost (and the costSubtotal/grandTotal renders): non-finite cost → ₱0.00. Required because the migrated do-not-edit fixtures (totals-row-cycle/context-menu) construct BoqItemRow objects without the 15-02 rate/cost fields, so item.cost is undefined at runtime; a crash there would regress green fixtures. Also correct production hardening (a row with no rate set shows ₱0.00, never throws — matches the locked 'no rate = 0' rule)."
  - "Grand-total bar rendered as a pinned bottom bar shown whenever totalPages > 0 (suppressed in the pure no-project state to avoid a stray ₱0.00). Chosen the TotalsPanel location (not the header rows[]) per the plan's 'pick ONE' instruction, matching the docstring's long-promised 'pinned grand-total bar'."
  - "Addressed the 15-02 deferred item routed here: removed the two stale perimeter-length/perimeter-area docstring comments in TotalsCategoryBlock.tsx (comment-only, zero logic change)."

patterns-established:
  - "₱ everywhere via one import: CURRENCY_SYMBOL from ../lib/currency"
  - "Native-listener escape hatch for inputs that must commit under programmatic/native event dispatch independent of React's synthetic system"

requirements-completed: [SC-1, SC-2, SC-4]

# Metrics
duration: 14min
completed: 2026-06-29
---

# Phase 15 Plan 03: Totals-Panel Pricing UI + Perimeter Render Simplification (Wave 2) Summary

**The user-facing half of pricing: an inline ₱ rate input on each TotalsRow (keyed category-independently by `${name}|${type}`, dispatching setRate with stopPropagation so it never steals the row-click cycle/arm-tool), `rates` wired into useBoqLive for live cost recompute, net-new per-category ₱ cost subtotals + a pinned ₱ grand-total bar, and a PerimeterMarkup simplified to an unfilled closed outline with a length-only label — turning the two Wave 0 RED proofs GREEN with typecheck clean and zero regression.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-29 (RED baseline captured: use-boq-live 1 fail + totals-row-rate-edit 4 fail = 5 reds across the two target files)
- **Completed:** 2026-06-29 (Task 3 commit + full verification)
- **Tasks:** 3
- **Files modified:** 6 (1 created: currency.ts; 5 source modified)

## Accomplishments
- **Live recompute (Task 1, proof b):** new `src/renderer/src/lib/currency.ts` exports the single renderer-side `CURRENCY_SYMBOL = '₱'` seam; `useBoqLive` gained a `rates` top-level primitive selector, threaded `rates` into the `aggregateBoq({...})` call, and added it to the `useMemo` deps — so an edited rate recomputes row/category/grand-total cost with no other store change. `use-boq-live.test.ts` "recomputes when rates change" is GREEN.
- **Inline ₱ rate input (Task 2, proof b):** `TotalsRow` renders `<input data-testid="totals-row-rate-input">` keyed by `rateKey = ${name}|${type}` (a DISTINCT string from the visibility `itemKey = ${name}|${categoryId}`), dispatching `setRate(rateKey, parseFloat||0)` on input/change/blur and Enter keydown, with `stopPropagation` on click/mousedown/keydown so the field never fires the row cycle-nav / `onArmTool`. A ₱ cost `<span>` reads `item.cost` directly (no `rate*quantity` in the UI). `totals-row-rate-edit.test.ts` is GREEN (4/4) and the migrated cycle + context-menu fixtures stay GREEN.
- **Cost subtotal + grand-total + perimeter render (Task 3, proof b totals + SC-4):** `TotalsCategoryBlock` renders the net-new per-category ₱ cost subtotal (`data-testid="totals-category-cost-subtotal"`) from `category.costSubtotal`; `TotalsPanel` renders a pinned ₱ grand-total bar (`data-testid="totals-grand-total"`) from `boq.grandTotalCost`; `PerimeterMarkup` is now an UNFILLED closed outline (removed the `<Line fill>`) with a length-only `P: <len> <unit>` label (stripped the `A:` half), `polygonArea`/`pixelAreaToReal` imports + math removed, and the arc-aware closing-augmented length path kept verbatim.
- **Verification:** the two Wave 0 target proofs GREEN; full Vitest suite **621 passed / 7 failed (628)** where all 7 reds are the `boq-writers` xlsx/csv "Phase 15 Rate/Cost columns" tests owned by sibling Plan 15-04 (`src/main/boq-writers.ts` untouched); `npm run typecheck` clean (node + web, exit 0); `git grep "polygonArea\|pixelAreaToReal"` over PerimeterMarkup returns ZERO and the `<Line>` carries no `fill`; no `rate*quantity` arithmetic in TotalsRow.

## Task Commits

Each task was committed atomically:

1. **Task 1: CURRENCY_SYMBOL seam + wire `rates` into useBoqLive** - `ffbd168` (feat)
2. **Task 2: Inline ₱ rate input + cost display in TotalsRow** - `1da21b0` (feat)
3. **Task 3: Cost subtotal + grand-total renders; perimeter length-only** - `380f762` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: Task 2 is a TDD task, but its RED phase shipped in Plan 15-01 (Wave 0 — `totals-row-rate-edit.test.ts`, which is do-not-edit). This plan is the GREEN phase, so Task 2 is a single `feat` commit, not a RED/GREEN pair._

## Files Created/Modified
- `src/renderer/src/lib/currency.ts` - NEW: the single renderer-side `CURRENCY_SYMBOL = '₱'` seam (imported by TotalsRow + TotalsCategoryBlock + TotalsPanel)
- `src/renderer/src/hooks/useBoqLive.ts` - `rates` top-level selector + threaded into `aggregateBoq` + added to `useMemo` deps; docstring eight→nine primitives
- `src/renderer/src/components/TotalsRow.tsx` - inline ₱ rate input (uncontrolled + native listeners, rateKey `${name}|${type}`, setRate dispatch, stopPropagation) + ₱ cost display (defensive formatCost)
- `src/renderer/src/components/TotalsCategoryBlock.tsx` - net-new per-category ₱ cost-subtotal render; removed two stale perimeter-length/perimeter-area docstring comments (15-02 deferred item)
- `src/renderer/src/components/TotalsPanel.tsx` - net-new pinned ₱ grand-total cost bar (shown when totalPages > 0)
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` - unfilled closed outline (removed Line fill); length-only label; removed `polygonArea`/`pixelAreaToReal` imports + math; kept arc-aware length; docstrings updated
- `.planning/phases/15-boq-pricing-perimeter-simplification/deferred-items.md` - marked the 15-03-owned stale-comments item RESOLVED (the boq-writers item stays open for 15-04)

## Decisions Made
- **Uncontrolled rate input + native listeners** (Claude's discretion on placement/commit-trigger, locked decisions §81). The plan's first sketch used React `onChange`/`onBlur`; a probe proved that under the do-not-edit test's event sequence (`input.value = '42'` → native `input` → native `change` → `FocusEvent('blur')`) React's synthetic `onChange` is suppressed by its value-tracker and the raw `blur` event never reaches a synthetic `onBlur` (React delegates blur as `focusout`). Switched the field to uncontrolled (`defaultValue`, ref) with native `input`/`change`/`blur`/`keydown` listeners that commit + `stopPropagation`. All four assertions (change+blur, Enter, no-arm, no-setPage) pass; the field re-seeds imperatively from the store via a ref effect (only when the DOM value differs, so mid-typing text is never clobbered). This is the canonical fix for "commit must fire under programmatic/native dispatch" and required no test change.
- **Defensive `₱` formatters** (Rule 1/2 hardening — see Deviations). `formatCost`, the category cost-subtotal, and the grand-total all coerce a non-finite value to 0. Needed because the migrated do-not-edit fixtures build `BoqItemRow` objects without the (required, 15-02) `rate`/`cost` fields, so `item.cost` is `undefined` at runtime — a bare `item.cost.toFixed(2)` threw and broke the previously-green cycle + context-menu fixtures. Coercion is also the correct production behavior (no rate set → ₱0.00, never a crash; matches the locked "no rate = 0" rule).
- **Grand-total bar placement:** chose the `TotalsPanel` pinned-bottom-bar seam over the `TotalsPanelHeader.rows[]` seam (the plan said "pick ONE, not both"), realizing the docstring's long-promised "pinned grand-total bar". Suppressed in the pure no-project state (`totalPages === 0`) to avoid a stray ₱0.00.
- **15-02 deferred item resolved:** removed the two stale perimeter-length/perimeter-area docstring comments in `TotalsCategoryBlock.tsx` (comment-only, Removal-Map row 13 = no logic). The other deferred item (`boq-writers.ts` old split) is explicitly Plan 15-04's, left untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Rule 2 - Missing Critical] Defensive ₱ cost formatting against a non-finite `cost`**
- **Found during:** Task 2 (inline rate input + cost display)
- **Issue:** `formatCost(item)` initially did `item.cost.toFixed(2)`. The migrated do-not-edit fixtures (`totals-row-cycle.test.ts`, `totals-row-context-menu.test.ts`) construct `BoqItemRow` objects without the `rate`/`cost` fields that became required in 15-02, so `item.cost` is `undefined` at runtime → `TypeError: Cannot read properties of undefined (reading 'toFixed')`. This crashed the whole row and turned two previously-GREEN fixtures RED (10/19 failing at the low point). Out of scope to edit those test files; the bug is in my new render code.
- **Fix:** `formatCost` coerces `Number.isFinite(item.cost) ? item.cost : 0` before `.toFixed(2)`; the category cost-subtotal and grand-total renders apply the same `Number.isFinite(...) ? ... : 0` guard; the rate-field seed shows an empty field for a non-positive/non-finite rate. This is also the correct production behavior (a row whose rate is unset renders ₱0.00 per the locked "no rate = 0" rule, never throwing).
- **Files modified:** src/renderer/src/components/TotalsRow.tsx (and the same guard pattern in TotalsCategoryBlock.tsx / TotalsPanel.tsx renders)
- **Verification:** all three totals-row files GREEN (19/19); full suite 621 passed with only the 15-04-owned writer reds.
- **Committed in:** `1da21b0` (Task 2) for TotalsRow; `380f762` (Task 3) for the subtotal/grand-total renders.

---

**Total deviations:** 1 auto-fixed (Rule 1/2 — defensive rendering; no scope creep).
**Impact on plan:** The single fix was mechanically required to keep the do-not-edit migrated fixtures green and is the correct production hardening for the locked "no rate set = ₱0.00" rule. No architectural change, no new dependency, no test edited. The uncontrolled-input + native-listener approach is an implementation choice within the plan's explicit "Claude's Discretion" over the inline field, documented under Decisions Made rather than as a deviation.

## Issues Encountered
- **React synthetic onChange/onBlur did not fire under the test's native event dispatch.** A throwaway probe (created, run, deleted — never committed) confirmed `setRate` calls were `[]` via the onChange/blur path while the Enter path worked. Root cause: React 19's input value-tracker suppresses synthetic `onChange` when `.value` is set then a native `input` event is dispatched, and React delegates blur as `focusout` so a raw `blur` event is never seen by a synthetic `onBlur`. Resolved by switching the input to uncontrolled + native listeners (see Decisions Made). Not a regression — a known React-testing characteristic; the fix is the standard escape hatch.
- **No snapping-engine flake observed** this run (the Phase-14 timing-budget smoke that flaked once in 15-02 passed cleanly here).

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Every ₱ value rendered is read from a real aggregator-computed field (`item.cost`, `category.costSubtotal`, `boq.grandTotalCost`) wired live through `useBoqLive`. The defensive `non-finite → 0` coercions are correctness guards (the locked "no rate set = ₱0.00" rule), not placeholder data sources. The only outstanding RED tests are the `boq-writers` xlsx/csv Rate/Cost-column proofs, which are sibling Plan 15-04's deliverable (boq-writers.ts intentionally untouched here).

## Threat Flags
None. This plan is renderer-only: it reads existing in-memory store state (`projectStore.rates`, the `BoqStructure`) and dispatches the already-defined `setRate` action. No new IPC, file I/O, network endpoint, auth path, or trust-boundary surface was introduced. The threat register's `mitigate` dispositions were honored — `parseFloat(text)||0` keeps a string from ever entering the `Record<string, number>` rate map (T-15-03-01), `stopPropagation` on the input's pointer+key events prevents event leakage to the row's cycle-nav/arm-tool (T-15-03-02, asserted by the render-test spies), and the distinct `rateKey = ${name}|${type}` prevents category-dependent mis-scoping (T-15-03-03, asserted by the render test).

## Next Phase Readiness
- **Wave 2 renderer half complete.** The priced totals panel (inline ₱ rate edit, live cost, per-category ₱ subtotals, pinned ₱ grand-total bar) and the unfilled length-only perimeter render are shipped and proven.
- **15-04 (writers half — sibling Wave 2, runs after this):** turn the 7 remaining `boq-writers` reds GREEN — align `src/main/boq-writers.ts` `BoqRowType` (drop the old `perimeter-length`/`perimeter-area` split — its own deferred item), add Item·Quantity·UoM·Rate·Cost columns with a ₱ numFmt (native-number cells), per-category cost-subtotal + grand-total-cost rows, and the A:E heading merge. Define the main-process `CURRENCY_SYMBOL = '₱'` as its OWN local copy (the renderer seam in `src/renderer/src/lib/currency.ts` is renderer-only by the codebase's duplication-with-test-lock convention).
- **How-To-Manual note (per project MEMORY):** the inline ₱ rate field is new user-facing functionality — document the gesture (click the rate cell, type a number, commit on blur or Enter; the cost, category subtotal, and grand total update live) and the perimeter behavior change (now length-only, unfilled outline; existing `.clmc` projects lose their perimeter AREA BOQ rows on reload — area was always computed live, never stored, so no data loss).
- No blockers. No package installs (existing React/Zustand/Konva + Vitest 4.1.x infra; threat register T-15-SC "accept").

## Self-Check: PASSED

- FOUND: `src/renderer/src/lib/currency.ts`
- FOUND: `src/renderer/src/hooks/useBoqLive.ts`
- FOUND: `src/renderer/src/components/TotalsRow.tsx`
- FOUND: `src/renderer/src/components/TotalsCategoryBlock.tsx`
- FOUND: `src/renderer/src/components/TotalsPanel.tsx`
- FOUND: `src/renderer/src/components/markup/PerimeterMarkup.tsx`
- FOUND: `.planning/phases/15-boq-pricing-perimeter-simplification/15-03-SUMMARY.md`
- FOUND commit: `ffbd168` (Task 1)
- FOUND commit: `1da21b0` (Task 2)
- FOUND commit: `380f762` (Task 3)

---
*Phase: 15-boq-pricing-perimeter-simplification*
*Completed: 2026-06-29*
