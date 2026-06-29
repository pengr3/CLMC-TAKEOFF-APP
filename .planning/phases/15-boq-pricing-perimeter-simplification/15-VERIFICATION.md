---
phase: 15-boq-pricing-perimeter-simplification
verified: 2026-06-29T19:10:00Z
status: human_needed
score: 5/6
overrides_applied: 0
human_verification:
  - test: "Inline ₱ rate field — type a rate on a totals row, cost updates live, no accidental page-cycle or arm-tool"
    expected: "Cost span, category subtotal, and grand-total bar update as keys are pressed; clicking or pressing Enter in the field does NOT navigate pages or arm a markup tool"
    why_human: "UX feel + Konva/React event interplay (stopPropagation correctness on click/mousedown/keydown) are asserted by the render test but the live interaction with the real Electron canvas layer cannot be confirmed programmatically"
  - test: "Perimeter markup renders as unfilled closed outline with length-only label (e.g. 'P: 24.6 m') — no translucent fill, no 'A:' area value"
    expected: "Placing a perimeter markup shows a stroked polygon outline with no interior fill; the label chip shows only the length"
    why_human: "Canvas visual render — the code removes the fill prop and area path, but pixel-level appearance in the live Electron window requires human eyes"
  - test: "xlsx export opens in Excel with ₱ rendering correctly in Rate/Cost cells"
    expected: "Rate and Cost columns show values formatted as ₱1,234.00 (Philippine Peso glyph, comma-thousands, 2 decimals); SUM() on the Cost column returns the correct grand total"
    why_human: "Cross-app rendering of U+20B1 in Excel — numFmt encoding correct per code review but actual Excel display requires opening the file"
---

# Phase 15: BOQ Pricing & Perimeter Simplification — Verification Report

**Phase Goal:** Turn the quantity-only BOQ into a priced BOQ — every BOQ row carries a unit rate and a computed cost (rate × quantity), with per-category cost subtotals and a grand-total cost shown in the totals panel and in the .xlsx/.csv exports, denominated in ₱ — and narrow the Perimeter tool to a length-only measurement so each markup maps to exactly one priceable BOQ row.

**Verified:** 2026-06-29T19:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Test Suite & Typecheck Baseline

Run independently to verify SUMMARY.md claims before inspecting code:

| Check | Command | Result |
|-------|---------|--------|
| Full test suite | `npx vitest run` | 82 files / 628 passed / 0 failed |
| TypeScript (node) | `npm run typecheck:node` | 0 errors |
| TypeScript (web) | `npm run typecheck:web` | 0 errors |
| `perimeter-area` absent from src/ | `git grep perimeter-area -- src/` | zero matches |
| `perimeter-length` absent from src/ | `git grep perimeter-length -- src/` | zero matches |

---

## Goal Achievement

### Observable Truths

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | Each BOQ row (.xlsx, .csv, totals panel) shows Rate and Cost (rate × quantity); categories show cost subtotal; project shows grand-total cost, all in ₱ | VERIFIED | `boq-types.ts`: `BoqItemRow.rate`/`.cost`, `BoqCategoryGroup.costSubtotal`, `BoqStructure.grandTotalCost`; aggregator computes `cost = rate * acc.quantity` and accumulates `catCost`/`grandCost`; `boq-writers.ts`: `NUMFMT_PESO='₱#,##0.00'` on Rate/Cost cells (native numbers); `appendCostSubtotalRow` per category + grand-total-cost row; csv emits numeric Rate/Cost with cost-subtotal/grand-total rows; TotalsRow renders `formatCost(item)`; TotalsCategoryBlock renders `category.costSubtotal`; TotalsPanel renders `boq.grandTotalCost`; writer tests: 22/22 green |
| SC-2 | User can set/edit rate inline in the totals panel; rate stored in .clmc keyed by `name|type`, survives save/reload; same (name, type) shares one rate across categories/pages | VERIFIED | `TotalsRow.tsx`: `rateKey = "${itemName}|${item.type}"`, uncontrolled input with native listeners, `commitRate` clamps negatives (CR-02 fixed), `setRate(rateKey, safe)` dispatched; `projectStore.ts`: `rates: Record<string,number>`, `setRate` action with `markDirty()`; `project-schema.ts`: `rates?: Record<string,number>` additive on `ProjectFileV2` (no formatVersion bump); `project-serialize.ts`: `snapshotProject` emits `rates`, `hydrateStores` restores with finite-≥0 coercion guard; `useBoqLive.ts`: `rates` is a top-level selector + useMemo dep; serialize/schema tests 22/22 green; rate-edit render test 4/4 green |
| SC-3 | Perimeter tool emits exactly ONE BOQ row (length only); `perimeter-area` and `perimeter-length` types removed from aggregator, boq-types, preload mirrors, boq-writers, totals UI, tests | VERIFIED | `boq-types.ts`: `BoqRowType = 'count' \| 'linear' \| 'area' \| 'perimeter' \| 'wall'` (no split types); aggregator: `add(catId, m.name, 'perimeter', realL)` — single length add, perimeter-area arm deleted; `boq-writers.ts`: `BoqRowType` aligned to single `'perimeter'`; `preload/index.ts` and `preload/index.d.ts`: `BoqRowType` has single `'perimeter'`; `git grep perimeter-area -- src/` → zero; `git grep perimeter-length -- src/` → zero; aggregator tests 14/14 green |
| SC-4 | Perimeter renders as unfilled closed outline with length-only label (`P: 24.6 m`) — no area fill, no `A:` value | UNCERTAIN — HUMAN | Code: `PerimeterMarkup.tsx` Line element has no `fill` prop (only the dark chip Rect and white Text have `fill`, not the polygon Line); label is built as `P: ${realPerim.toFixed(1)} ${u}` with no `A:` path; `polygonArea`/`pixelAreaToReal` imports removed; `fill` on Line confirmed absent via grep. CANVAS VISUAL RENDER requires human verification. |
| SC-5 | Perimeter BOQ row labeled by plain item name; `(perimeter)` suffix only when same-named count/linear/area row exists in same category | VERIFIED | `boq-aggregator.ts`: `nameTypes` Set collects ALL types (including `'perimeter'`) per name; label assigned `name (typeWord(type))` only when `typeSet.size >= 2`; `typeWord('perimeter')` returns `'perimeter'`; lone perimeter → plain label, colliding perimeter → `${name} (perimeter)`; aggregator tests 14/14 green (perimeter collision case tested) |
| SC-6 | Existing .clmc projects with perimeter markups reload with length-only BOQ, no errors; test suite green; PROJECT.md reflects pricing as in-scope | VERIFIED | `project-schema.ts`: `rates?` is additive — `validateV2` passes objects without it unchanged; `hydrateStores`: defaults `safeRates = {}` when `data.rates` absent; perimeter area was computed live, never stored — reload produces one length row (geometry unchanged, area synthesis deleted); `PROJECT.md` Validated section: "Unit cost / pricing — per-(name,type) rates with live cost, category cost subtotals, grand-total cost, and ₱ Rate/Cost columns in xlsx/csv export — Validated in Phase 15"; Key Decisions table has pricing scope reversal row; full suite 628/628 green |

**Score:** 5/6 truths VERIFIED (SC-4 deferred to human; all others code-confirmed)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/currency.ts` | Single renderer-side CURRENCY_SYMBOL='₱' seam | VERIFIED | File exists; exports `CURRENCY_SYMBOL = '₱'`; imported by TotalsRow, TotalsCategoryBlock, TotalsPanel |
| `src/renderer/src/lib/boq-types.ts` | rate/cost on BoqItemRow, costSubtotal on BoqCategoryGroup, grandTotalCost on BoqStructure, single 'perimeter' BoqRowType | VERIFIED | All fields present, split types absent |
| `src/renderer/src/lib/boq-aggregator.ts` | Perimeter length-only; rate/cost/costSubtotal/grandTotalCost computed; collision membership for perimeter | VERIFIED | Single `add(..., 'perimeter', realL)` call; rate lookup `rates[name|type] ?? 0`; `catCost` accumulator; `grandTotalCost: grandCost` returned; perimeter in D-02 nameTypes set |
| `src/renderer/src/stores/projectStore.ts` | `rates: Record<string,number>`, `setRate` action with `markDirty()`, `reset: rates: {}` | VERIFIED | All present; setRate calls `get().markDirty()` |
| `src/renderer/src/lib/project-schema.ts` | `rates?: Record<string,number>` additive on ProjectFileV2, no formatVersion branch | VERIFIED | Field present; validateV2 unchanged (trailing cast) |
| `src/renderer/src/lib/project-serialize.ts` | snapshotProject emits rates; hydrateStores restores with finite-≥0 guard | VERIFIED | Both present; guard filters negative/NaN/Infinity |
| `src/renderer/src/hooks/useBoqLive.ts` | `rates` as top-level selector + in useMemo deps | VERIFIED | `const rates = useProjectStore((s) => s.rates)` + in deps array |
| `src/renderer/src/components/TotalsRow.tsx` | Inline rate input (data-testid, rateKey, setRate dispatch, stopPropagation, negative clamp) | VERIFIED | `data-testid="totals-row-rate-input"`, `rateKey="${itemName}|${item.type}"`, `commitRate` clamps negatives, `stopPropagation` on click/mousedown/keydown |
| `src/renderer/src/components/TotalsCategoryBlock.tsx` | Per-category cost subtotal render (data-testid="totals-category-cost-subtotal") | VERIFIED | Renders `category.costSubtotal` inside `{!isCollapsed && (...)}` |
| `src/renderer/src/components/TotalsPanel.tsx` | Pinned grand-total cost bar (data-testid="totals-grand-total", shown when totalPages > 0) | VERIFIED | Present; `{totalPages > 0 && (...)}` guard |
| `src/main/boq-writers.ts` | Rate/Cost columns + NUMFMT_PESO + cost-subtotal/grand-total rows + A:E heading merge + money() guard | VERIFIED | All present; BoqRowType aligned to single 'perimeter' |
| `src/preload/index.ts` | BoqRowType with 'wall' (CR-01 fix) + rate/cost/costSubtotal/grandTotalCost | VERIFIED | `BoqRowType = 'count' \| 'linear' \| 'area' \| 'perimeter' \| 'wall'`; rate/cost/costSubtotal/grandTotalCost all present |
| `src/preload/index.d.ts` | BoqRowType with 'wall' + rate/cost/costSubtotal/grandTotalCost | VERIFIED | Same; mirrors implementation |
| `src/renderer/src/components/markup/PerimeterMarkup.tsx` | Unfilled Line (no fill prop); length-only label ('P:'); no polygonArea/pixelAreaToReal | VERIFIED | Line has no `fill`; label is `P: ${realPerim.toFixed(1)} ${u}`; area math imports removed |
| `.planning/PROJECT.md` | Pricing listed under Validated with Phase 15 reference | VERIFIED | "Unit cost / pricing — Validated in Phase 15: BOQ Pricing & Perimeter Simplification" |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| TotalsRow inline input | projectStore.setRate | `rateKey="${name}|${type}"` → `useProjectStore.getState().setRate` | VERIFIED | Dispatch confirmed in TotalsRow.tsx:181 |
| projectStore.rates | useBoqLive | top-level selector + useMemo dep | VERIFIED | useBoqLive.ts:42 + dep array line 58 |
| useBoqLive | aggregateBoq | `rates` threaded as `opts.rates` | VERIFIED | aggregateBoq called with `rates` in useBoqLive.ts:55 |
| aggregateBoq | BoqItemRow.rate/cost | `rates[name|type] ?? 0` → `cost = rate * acc.quantity` | VERIFIED | aggregator.ts:219-222 |
| aggregateBoq | BoqCategoryGroup.costSubtotal | `catCost` accumulator | VERIFIED | aggregator.ts:243-244 |
| aggregateBoq | BoqStructure.grandTotalCost | `grandCost` accumulator | VERIFIED | aggregator.ts:245 + return at line 284 |
| TotalsRow | formatCost(item) | reads `item.cost` directly (no re-arithmetic) | VERIFIED | TotalsRow.tsx:69 |
| TotalsCategoryBlock | category.costSubtotal | direct read | VERIFIED | TotalsCategoryBlock.tsx:155 |
| TotalsPanel | boq.grandTotalCost | direct read from `useBoqLive()` | VERIFIED | TotalsPanel.tsx:291 |
| snapshotProject | ProjectFileV2.rates | `useProjectStore.getState().rates` | VERIFIED | project-serialize.ts:61 |
| hydrateStores | projectStore.rates | `useProjectStore.setState({ rates: safeRates })` | VERIFIED | project-serialize.ts:129-133 |
| buildBoqXlsx | Rate/Cost cells | `appendItemRow` sets `rateCell.value` / `costCell.value` + NUMFMT_PESO | VERIFIED | boq-writers.ts:227-232 |
| buildBoqCsv | Rate/Cost columns | `Number(money(item.rate).toFixed(2))` / `Number(money(item.cost).toFixed(2))` | VERIFIED | boq-writers.ts:306-307 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| TotalsRow | `item.cost` | aggregator `cost = rate * acc.quantity` → useBoqLive → TotalsPanel → TotalsCategoryBlock → TotalsRow | Yes — live aggregation from store | FLOWING |
| TotalsRow rate input | `rate` from `useProjectStore((s) => s.rates[rateKey] ?? 0)` | projectStore persisted rates map | Yes — real persisted value | FLOWING |
| TotalsCategoryBlock | `category.costSubtotal` | aggregator `catCost` accumulator → useBoqLive | Yes | FLOWING |
| TotalsPanel | `boq.grandTotalCost` | aggregator `grandCost` → useBoqLive | Yes | FLOWING |
| buildBoqXlsx Rate/Cost | `money(item.rate)` / `money(item.cost)` | real BoqStructure from aggregator | Yes — native numbers | FLOWING |
| buildBoqCsv Rate/Cost | `Number(money(item.rate).toFixed(2))` | real BoqStructure from aggregator | Yes | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite green (82 files / 628 tests) | `npx vitest run` | 628 passed / 0 failed | PASS |
| TypeScript clean (node) | `npm run typecheck:node` | 0 errors | PASS |
| TypeScript clean (web) | `npm run typecheck:web` | 0 errors | PASS |
| No `perimeter-area` in src/ | `git grep perimeter-area -- src/` | zero matches | PASS |
| No `perimeter-length` in src/ | `git grep perimeter-length -- src/` | zero matches | PASS |
| Aggregator tests (incl. one-row perimeter + collision) | `npx vitest run src/tests/boq-aggregator.test.ts` | 14/14 passed | PASS |
| Writer tests (Rate/Cost columns, ₱ numFmt, subtotals) | `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` | 22/22 passed | PASS |
| Serialize/schema round-trip (rates persist) | `npx vitest run src/tests/project-serialize.test.ts src/tests/project-schema.test.ts` | 22/22 passed | PASS |
| useBoqLive live rate recompute | `npx vitest run src/tests/use-boq-live.test.ts` | 4/4 passed | PASS |
| Inline rate-edit render (dispatch + stopPropagation) | `npx vitest run src/tests/totals-row-rate-edit.test.ts` | 4/4 passed | PASS |

---

## Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` exist; phase is a renderer/main-process change, not a CLI/migration tool. Behavioral spot-checks above provide equivalent coverage.

---

## Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| SC-1 | Phase 15 (internal) | rate/cost on every BOQ row; cost subtotals; grand-total cost; ₱ in exports | SATISFIED | Aggregator, writers, and UI all verified; tests green |
| SC-2 | Phase 15 (internal) | Inline rate edit; rates persisted keyed by name\|type; survives save/reload | SATISFIED | TotalsRow, projectStore, serialize/schema verified; rate-edit test green |
| SC-3 | Phase 15 (internal) | Perimeter → exactly one BOQ row (length); perimeter-area/perimeter-length removed everywhere | SATISFIED | Aggregator, boq-types, preload, writers, tests verified; grep confirms zero split-type tokens |
| SC-4 | Phase 15 (internal) | Perimeter canvas renders as unfilled closed outline with P: length-only label | NEEDS HUMAN | Code confirmed (no fill on Line, no A: label, area imports removed); visual render requires human |
| SC-5 | Phase 15 (internal) | Perimeter BOQ label plain `{name}`; `(perimeter)` suffix only on collision | SATISFIED | Aggregator typeWord + nameTypes collision logic verified; tests green |
| SC-6 | Phase 15 (internal) | Old .clmc reloads with length-only BOQ, no errors; tests green; PROJECT.md pricing in-scope | SATISFIED | hydrateStores backward-compatible; PROJECT.md updated; 628/628 green |
| REQUIREMENTS.md | n/a | Phase uses phase-internal SC-1..SC-6 IDs, not formal REQUIREMENTS.md IDs (per traceability note) | N/A | Confirmed: REQUIREMENTS.md does not map IDs to Phase 15; PROJECT.md Validated entry serves as scope record |

---

## Anti-Patterns Found

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `TotalsCategoryBlock.tsx:111` | `costSubtotal` display is inside `{!isCollapsed && (...)}` — hidden when category is collapsed (WR-04, deferred) | Advisory (deferred by design) | User cannot see category cost without expanding; grand-total bar at TotalsPanel bottom still shows project-wide sum |
| `PerimeterMarkup.tsx:14-15` | `category` prop declared and passed at call site but never used in the component body (IN-01, deferred) | Advisory (deferred by design) | Dead required prop; forces call sites to supply a value that is ignored |
| `TotalsRow.tsx:165` | `seedRateText` defined as arrow function inside the component body, called in one useEffect (IN-04, deferred) | Advisory (deferred by design) | Micro-perf: recreated per render; could be module-level |

No `TBD`, `FIXME`, or `XXX` markers found in Phase 15 source files (grep across src/ returned zero Phase-15-authored hits).

All three items above are **DEFERRED by design** — confirmed in 15-REVIEW.md as WR-04/IN-01/IN-04, intentionally not fixed, held for user decision. They are not blockers.

---

## Human Verification Required

### 1. Inline ₱ Rate Field — Live Interaction

**Test:** Open the app, load a PDF, set scale, place two markups with the same name in different categories. Click the ₱ rate input on one totals row and type a number.
**Expected:** The cost span on that row updates as you type; the category cost subtotal (below the items) and the grand-total bar (bottom of the panel) update live. Pressing Enter or clicking outside the field commits. Clicking elsewhere in the row after editing DOES NOT navigate pages or arm the markup tool.
**Why human:** The React/native event interplay and Konva stage event propagation cannot be reliably fully tested in jsdom — the render test confirms dispatch + stopPropagation but the real Electron canvas may behave differently.

### 2. Perimeter Renders as Unfilled Closed Outline with Length-Only Label

**Test:** Place a perimeter markup on a calibrated page. Observe the canvas rendering and the label chip.
**Expected:** The polygon outline is a stroked closed line (no translucent color fill inside the polygon). The label chip shows only `P: <value> <unit>` (e.g. `P: 24.6 m`). No `A:` area value appears.
**Why human:** Canvas visual output — code confirms the `Line` element carries no `fill` prop and the label omits area, but pixel-level appearance must be confirmed in the live Electron window.

### 3. xlsx Opens in Excel with ₱ Formatting

**Test:** Export the BOQ to xlsx. Open the file in Microsoft Excel on Windows.
**Expected:** The Rate and Cost columns display values as `₱1,234.00` (Philippine Peso glyph U+20B1, comma thousands separator, 2 decimal places). `SUM()` applied to a Cost column range returns the correct numeric total (not an error).
**Why human:** Cross-app rendering of U+20B1 in Excel — the `numFmt = '₱#,##0.00'` encoding is correct per ExcelJS documentation and code review, but actual display in Excel on the target Windows machine requires opening the file.

---

## Code Review Deferred Items (Advisory — Non-Blocking)

These three findings from 15-REVIEW.md were intentionally deferred and do NOT affect phase-goal status:

| Finding | Issue | Action |
|---------|-------|--------|
| WR-04 | `costSubtotal` is hidden when a category is collapsed — user cannot scan category costs without expanding each one | Awaiting user UX decision on whether to surface cost in the heading row |
| IN-01 | `category` prop in `PerimeterMarkupProps` is declared and passed but never used | Awaiting user decision — removing it requires touching the call site in `CanvasViewport.tsx` |
| IN-04 | `seedRateText` arrow function defined inside component body (micro-perf) | Non-critical; could be moved to module level |

---

## Gaps Summary

No gaps (all must-haves are VERIFIED or deferred to human verification per the phase plan). The three deferred review items are advisory and do not constitute goal failures.

The single human-verification item that prevents `status: passed` is SC-4 (perimeter canvas render visual confirmation) — this was anticipated in 15-VALIDATION.md as a Manual-Only Verification.

---

_Verified: 2026-06-29T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
