---
phase: 16-estimating-workspace
verified: 2026-07-01T16:15:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Estimate grid live-edit feel"
    expected: "In the Estimate view, type a Material and Labor rate + a Markup on a row → Cost/Price/Margin update live; category subtotal + grand total update; interacting with a cell does not arm a tool or switch pages"
    why_human: "GUI interaction feel — automated tests confirm the setPrice dispatch + stopPropagation contract at the unit/render level (estimate-row-edit.test.ts, 9/9 green), but the live visual update cadence and absence of tool-arm/page-switch side effects during real typing needs a human eye"
  - test: "Plan ⟷ Estimate view switch"
    expected: "Toggle `Plan | Estimate` in the Estimating tab → center swaps cleanly; returning to Plan shows the PDF + all markups intact with no re-rasterization flicker"
    why_human: "Canvas render behavior — automated tests confirm the CSS display mount-preserving contract (estimate-view-switch.test.ts, green) via a self-contained harness that does not mount the real Konva/PDF.js stack; actual re-rasterization flicker (or its absence) can only be observed by running the app"
---

# Phase 16: Estimating Workspace Verification Report

**Phase Goal:** Turn the single-rate priced BOQ into a full internal-costing + client-pricing estimate in a dedicated workspace. Pricing moves off the measurement surfaces (the Plan canvas and the right-side totals panel become quantity-only) into a full-width Estimate sheet opened from the `Estimating` tab. Each estimate line carries a material unit rate and a labor unit rate (× quantity = material cost + labor cost = internal cost), plus a markup percent (default 30%, editable per line) that yields the client price (cost × (1 + markup)) and the margin (price − cost); category subtotals, a grand total, and the .xlsx/.csv export all report Cost / Price / Margin in ₱.

**Verified:** 2026-07-01T16:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria SC-1..SC-6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Pricing appears only in the Estimate workspace; Plan canvas + totals panel are quantity-only; Phase-15 inline rate field removed | ✓ VERIFIED | `RibbonToolbar.tsx:580-607` renders the `[Plan\|Estimate]` `role="radiogroup"` toggle (`data-testid="view-mode-toggle"`) in the Estimating tab, dispatching `setViewMode`. `App.tsx:326-474` mounts the canvas subtree and `<EstimatePanel/>` as always-mounted siblings gated by CSS `display` (never a conditional-unmount ternary); `Splitter`+`TotalsPanel` gated `viewMode === 'plan'` (`App.tsx:478-503`). `TotalsRow.tsx`/`TotalsCategoryBlock.tsx`/`TotalsPanel.tsx` read in full — zero `CURRENCY_SYMBOL`, `rate`, `cost`, `setPrice`, or `rates[` references remain (grep-verified, exit 1 = no match on all four gates). `git ls-files src/tests/totals-row-rate-edit.test.ts` returns empty (file deleted). |
| SC-2 | Editable Material/Labor unit rates; Material cost = material×qty, Labor cost = labor×qty, Cost = sum; live recompute | ✓ VERIFIED | `boq-aggregator.ts:227-235`: `materialCost = material * acc.quantity; laborCost = labor * acc.quantity; cost = materialCost + laborCost`. `EstimateRow.tsx:88-97` commits `setPrice(priceKey, {material})`/`{labor}` via uncontrolled native-listener cells (`estimate-row-material-input`/`estimate-row-labor-input`). `useBoqLive.ts:43,59` includes `rates` as both a top-level selector and a `useMemo` dependency, so an edit recomputes cost live. `estimate-row-edit.test.ts` (9/9) + `use-boq-live.test.ts` GREEN (fresh run confirmed, not SUMMARY-trusted). |
| SC-3 | Editable Markup % defaulting to 30%; Price = Cost×(1+markup), Margin = Price−Cost, shown per row | ✓ VERIFIED | `boq-aggregator.ts:230,234-235`: `markup = entry?.markup ?? DEFAULT_MARKUP_PCT; price = cost * (1 + markup/100); margin = price - cost` — absent entry defaults to 30 via `estimate-defaults.ts:15` (`DEFAULT_MARKUP_PCT = 30`); an explicit `markup:0` is honored (`??` only fires on `undefined`). `EstimateRow.tsx:100-108,313-324` renders the editable markup cell + read-only Price/Margin cells straight from `item.price`/`item.margin` (no UI arithmetic — grep-verified zero `* qty`/`* quantity` matches in EstimateRow.tsx). |
| SC-4 | Estimate groups rows by category with per-category subtotals + grand total, each reporting Cost/Price/Margin in ₱ | ✓ VERIFIED | `boq-aggregator.ts:261-291`: per-category `catCost`/`catPrice`/`catMargin` accumulators → `costSubtotal`/`priceSubtotal`/`marginSubtotal`; `grandCost`/`grandPrice`/`grandMargin` → `grandTotalCost`/`grandTotalPrice`/`grandTotalMargin` (structure-level). `EstimateCategoryBlock.tsx:89-128` renders the three per-category subtotal cells; `EstimatePanel.tsx:160-199` renders the pinned grand-total bar reading `boq.grandTotalCost/Price/Margin`. |
| SC-5 | Pricing stored per `name\|type` as `{material,labor,markup}`, survives save/reload, shared across categories/pages, back-compat loads Phase-15 single-rate file (missing markup→30) | ✓ VERIFIED | `boq-types.ts:12-19` defines `PriceEntry`; `projectStore.ts:75,118-124` stores `rates: Record<string,PriceEntry>` keyed `name\|type` with a merging `setPrice` (seeds `{material:0,labor:0,markup:30}` on create, calls `markDirty()`). `project-serialize.ts:127-157`: hydrate coerces a legacy Phase-15 scalar `50` → `{material:50,labor:0,markup:30}`; per-field finite-≥0 guard; missing markup→30; non-number/non-object entries dropped; never throws. `project-schema.ts:99,104-131`: `rates?` widened, `validateV2` adds NO branch — rides `return raw as ProjectFileV2`, NO formatVersion bump (still `formatVersion: 2`). Legacy-scalar back-compat test read in full at `project-serialize.test.ts:218-227` and confirmed GREEN in a fresh test run. |
| SC-6 | .xlsx/.csv export the full 9-column set with category subtotals + grand total; ₱ cells stay SUM-safe native numbers; PROJECT.md + manual notes updated | ✓ VERIFIED | `boq-writers.ts:182-192` (9 xlsx columns Item·Quantity·UoM·Material·Labor·Cost·Markup·Price·Margin), `:261-294` (`appendItemRow` sets NATIVE-number cells via `setMoneyCell` with `NUMFMT_PESO` on money cols, `NUMFMT_PERCENT` on markup — never a pre-formatted string), `:247-252` (A:I heading merge), `:319-361` (combined Cost/Price/Margin subtotal + grand rows). CSV mirrors at `:389-445` with `csvMoney()` plain-numeric cells + BOM preserved (`:453`). `PROJECT.md:17,66` records Phase 16 as delivered with a Key-Decision row (read directly, not narrated). `16-MANUAL-NOTES.md` (188 lines, read in full) covers all four required sections (back-compat, Estimate workspace, ₱ constant + Settings scope honestly recorded as in-session-only, UAT checklist). |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/components/EstimateRow.tsx` | Editable material/labor/markup cells + read-only Cost/Price/Margin | ✓ VERIFIED | Exists, 328 lines, substantive (uncontrolled inputs + native listener effects per cell + stopPropagation), wired (imports `useProjectStore`, dispatches `setPrice` via `getState()`), data flows (reads `item.cost/.price/.margin` from the live aggregator row via `useBoqLive` upstream in `EstimatePanel`) |
| `src/renderer/src/components/EstimateCategoryBlock.tsx` | Category heading + collapse + 3 subtotal cells | ✓ VERIFIED | Exists, 134 lines; renders `estimate-category-{cost,price,margin}-subtotal` reading `category.costSubtotal/priceSubtotal/marginSubtotal` directly (no arithmetic) |
| `src/renderer/src/components/EstimatePanel.tsx` | Full-width sheet: header, empty states, categories, grand-total bar | ✓ VERIFIED | Exists, 203 lines; `useBoqLive()` at :38, grand-total bar at :160-199 reads `boq.grandTotalCost/Price/Margin` |
| `src/renderer/src/App.tsx` | Mount-preserving view swap; totals panel gated to Plan | ✓ VERIFIED | Lines 326-503 confirmed: both center subtrees always mounted, CSS `display` gate, `Splitter`+`TotalsPanel` conditionally rendered only in Plan mode |
| `src/renderer/src/components/RibbonToolbar.tsx` | Plan\|Estimate toggle + Settings default-markup control | ✓ VERIFIED | Toggle at :541-607; Settings tab at :623-678 (in-session-only, honestly scoped per D-05/D-09 and documented in manual notes — not a stub, a deliberately minimal v1 control per the phase's own locked decision) |
| `src/renderer/src/lib/boq-types.ts` | `PriceEntry` + widened `BoqItemRow`/`BoqCategoryGroup`/`BoqStructure` | ✓ VERIFIED | All fields present and JSDoc'd, matches the locked contract exactly |
| `src/renderer/src/lib/boq-aggregator.ts` | Six money fields + 3 subtotal + 3 grand-total kinds | ✓ VERIFIED | Lines 227-291, money math matches D-03/D-04/D-05 exactly (`toBeCloseTo`-level precision verified by a fresh green test run) |
| `src/renderer/src/lib/project-serialize.ts` | Snapshot + hydrate coercion with legacy back-compat | ✓ VERIFIED | Lines 115-157, per-field coercion helper `coerceField`, never throws |
| `src/renderer/src/lib/project-schema.ts` | `rates?` widened, no formatVersion bump | ✓ VERIFIED | `formatVersion: 2` unchanged; `validateV2` unchanged aside from JSDoc |
| `src/renderer/src/lib/estimate-defaults.ts` | `DEFAULT_MARKUP_PCT = 30` single seam | ✓ VERIFIED | 15-line file, exports exactly one constant |
| `src/renderer/src/stores/projectStore.ts` | `rates: Record<string,PriceEntry>` + merging `setPrice` | ✓ VERIFIED | Lines 24,118-124; merge semantics correct (`{...cur, ...patch}`), `markDirty()` called |
| `src/renderer/src/stores/viewerStore.ts` | `viewMode` transient, resets to 'plan' everywhere, never serialized | ✓ VERIFIED | Lines 19,37,93,114,149 — reset in `setFile`/`resetViewer`/`hydrate`; grep-confirmed absent from `project-serialize.ts` |
| `src/renderer/src/hooks/useBoqLive.ts` | `rates` selector + memo dep for live recompute | ✓ VERIFIED | Lines 43,59 |
| `src/main/boq-writers.ts` | 9-column writers, native ₱ + percent numFmt, A:I merge | ✓ VERIFIED | 455-line file read in full; 4-way type-lock mirror widened field-for-field |
| `src/preload/index.ts` + `index.d.ts` | Mirrored `BoqItemRow`/`BoqCategoryGroup`/`BoqStructure` | ✓ VERIFIED | Both read in full, field-for-field identical to `boq-types.ts` (minus `categoryId`, by design) |
| `.planning/phases/16-estimating-workspace/16-MANUAL-NOTES.md` | Back-compat + Estimate workspace + ₱/Settings scope + UAT checklist | ✓ VERIFIED | 188 lines, all 4 sections present, Settings scope recorded honestly |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EstimateRow.tsx` | `projectStore.setPrice` | native input/blur/Enter → `getState().setPrice(priceKey, patch)` | ✓ WIRED | Confirmed at lines 91,96,103,107; `estimate-row-edit.test.ts` green (fresh run) |
| `RibbonToolbar.tsx` | `viewerStore.viewMode`/`setViewMode` | segmented buttons read + dispatch | ✓ WIRED | Lines 142-143,554 |
| `App.tsx` | `CanvasViewport` (preserved) + `EstimatePanel` (sibling) | CSS `display` toggle, no conditional unmount | ✓ WIRED | Lines 338-347 (Plan) + 464-473 (Estimate) — both always in DOM |
| `boq-aggregator.ts` | `useProjectStore.getState().rates` | `opts.rates ?? useProjectStore.getState().rates`, lookup `${name}\|${type}` | ✓ WIRED | Line 96, 227 |
| `project-serialize.ts` | `projectStore.rates` | snapshot read (:63) + hydrate coercion (:153-157) | ✓ WIRED | Both directions confirmed |
| `useBoqLive.ts` | `aggregateBoq` rates option | selector threaded + memo dep | ✓ WIRED | Lines 43,49,59 |
| `boq-writers.ts appendItemRow` | `BoqItemRow.material/labor/cost/markup/price/margin` | native-number cells + NUMFMT_PESO/NUMFMT_PERCENT | ✓ WIRED | Lines 261-294 |
| `boq-writers.ts` subtotal/grand rows | `BoqCategoryGroup`/`BoqStructure` money fields | combined multi-value row per category/grand | ✓ WIRED | Lines 319-361 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `EstimateRow.tsx` | `item.cost`/`item.price`/`item.margin` | `boq-aggregator.ts` real money math (not static/hardcoded) | Yes | ✓ FLOWING |
| `EstimateCategoryBlock.tsx` | `category.costSubtotal`/`priceSubtotal`/`marginSubtotal` | `boq-aggregator.ts` Σ-over-rows accumulator | Yes | ✓ FLOWING |
| `EstimatePanel.tsx` | `boq.grandTotalCost`/`grandTotalPrice`/`grandTotalMargin` | `useBoqLive()` → `aggregateBoq()` Σ-over-categories | Yes | ✓ FLOWING |
| `TotalsRow.tsx`/`TotalsCategoryBlock.tsx`/`TotalsPanel.tsx` | quantity/UoM/label only | `useBoqLive()` (unchanged upstream) | Yes (pricing intentionally absent, not disconnected) | ✓ FLOWING (quantity-only by design) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 9 Phase-16 target test files pass | `npx vitest run src/tests/boq-aggregator.test.ts src/tests/project-serialize.test.ts src/tests/project-schema.test.ts src/tests/use-boq-live.test.ts src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts src/tests/estimate-row-edit.test.ts src/tests/totals-panel-quantity-only.test.ts src/tests/estimate-view-switch.test.ts` | 9 files / 80 tests passed | ✓ PASS |
| Full suite green | `npx vitest run` | 84 files / 642 tests passed | ✓ PASS |
| `totals-row-rate-edit.test.ts` deleted | `git ls-files src/tests/totals-row-rate-edit.test.ts` | empty output, exit 0 | ✓ PASS |
| Typecheck clean | `npm run typecheck` | node + web both exit clean, no errors printed | ✓ PASS |
| Production build succeeds | `npm run build` | main + preload + renderer all built, exit 0 (one pre-existing unrelated chunking info-warning) | ✓ PASS |
| No pricing nodes remain in totals components | `grep -n "totals-row-rate-input\|totals-row-cost\|totals-category-cost-subtotal\|totals-grand-total" TotalsRow.tsx TotalsCategoryBlock.tsx TotalsPanel.tsx` | exit 1 (no match) | ✓ PASS |
| No setPrice/rates read in totals components | `grep -n "setPrice\|s\.rates\[" ...` | exit 1 (no match) | ✓ PASS |
| No CURRENCY_SYMBOL in totals components | `grep -n "CURRENCY_SYMBOL" ...` | exit 1 (no match) | ✓ PASS |
| viewMode never serialized | `grep -n "viewMode" project-serialize.ts` | exit 1 (no match) | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in 18 Phase-16-touched files | `grep -nE "TBD\|FIXME\|XXX"` / `"TODO\|HACK\|PLACEHOLDER"` | exit 1 on all scans | ✓ PASS |
| All 14 commit hashes cited across the 5 SUMMARY files exist in git history | `git cat-file -e <hash>` × 14 | all 14 FOUND | ✓ PASS |
| No requirement traceability gap | `grep -n "Phase 16" .planning/REQUIREMENTS.md` | exit 1 (no match — expected, no new v1 requirement IDs per CONTEXT.md) | ✓ PASS |

### Probe Execution

Not applicable — this is a UI/data-model phase with a Vitest-based Nyquist validation contract, not a probe-script-based migration/CLI phase. No `scripts/*/tests/probe-*.sh` files are declared in the PLAN/SUMMARY/VALIDATION artifacts for this phase. Behavioral Spot-Checks (above) serve the equivalent verification role and were re-run fresh in this verification pass rather than trusted from SUMMARY narration.

### Requirements Coverage

Phase 16 introduces **no new v1/v2 REQUIREMENTS.md IDs** (confirmed: `grep -n "Phase 16" .planning/REQUIREMENTS.md` returns zero matches; REQUIREMENTS.md's own "Coverage" footer still reads "v1 requirements: 25 total / Mapped to phases: 25 / Unmapped: 0"). This is coherent with 16-CONTEXT.md's stated traceability ("Extends the v1.1 Estimating milestone opened by Phase 15; supersedes Phase 15 SC-2; no new v1 requirement IDs"). Phase 16 instead defines **phase-local** success criteria SC-1..SC-6 in ROADMAP.md (not global requirement IDs), each traced above with file:line evidence. All five plans (16-01..16-05) declare their `requirements:` frontmatter as a subset of {SC-1..SC-6}; the union across all five plans covers SC-1 through SC-6 with no gaps and no orphans. The **supersede relationship to Phase 15 SC-2** (inline totals-panel pricing) is coherent and honestly recorded: `PROJECT.md:17` explicitly states "Expanded and superseded in Phase 16" for the Phase-15 pricing entry, and the totals-panel pricing nodes are verifiably absent from the current source (grep-gated above), not merely narrated as removed.

### Anti-Patterns Found

None. Zero TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, zero "coming soon"/"not yet implemented" strings, and zero hardcoded-empty-render patterns found across all 18 files this phase created or modified. The one place a "Coming soon" pattern historically existed (`RibbonToolbar.tsx`'s Settings tab) has been replaced with a real, functional (if intentionally v1-minimal) control — and that minimalism is explicitly locked by the phase's own D-05/D-09 decisions and disclosed honestly in `16-MANUAL-NOTES.md` Section 3, not hidden. This is a documented scope decision, not a stub.

## Human Verification Required

Both items below are the phase's own two "Manual-Only Verifications" (16-VALIDATION.md) that this is inherently a UI/interaction phase and cannot be closed purely from static/unit evidence. Automated coverage for both is GREEN (fresh-run confirmed) at the contract level; only the live/visual experience needs a human pass.

### 1. Estimate grid live-edit feel

**Test:** In the Estimate view, type a Material rate, a Labor rate, and a Markup % on a row (commit each with Enter or by clicking away).
**Expected:** Cost/Price/Margin on that row update immediately; the category subtotal and the grand-total bar update; interacting with a cell does not flip the current PDF page or arm a markup drawing tool.
**Why human:** `estimate-row-edit.test.ts` (green) proves the `setPrice` dispatch + `stopPropagation` contract at the unit/render level using a jsdom harness with native event dispatch — it does not prove the felt responsiveness of typing in the real running app, nor does it exercise the full `App.tsx` render tree where a tool-arm or page-switch side effect could theoretically leak through a different code path than the one under test.

### 2. Plan ⟷ Estimate view switch

**Test:** Toggle `Plan | Estimate` in the Estimating ribbon tab several times.
**Expected:** The center area swaps cleanly between the PDF canvas and the estimate sheet; returning to Plan shows the PDF and all markups intact with no re-rasterization flicker; the totals panel is visible in Plan and hidden in Estimate.
**Why human:** `estimate-view-switch.test.ts` (green) proves the mount-preserving CSS-`display` contract via a **self-contained harness** that does not mount the real Konva Stage or PDF.js pipeline (documented in 16-01-SUMMARY.md key-decisions: "mounting App pulls the brittle Konva/PDF stack"). The actual absence of re-rasterization flicker when running the real app can only be observed visually.

## Gaps Summary

No gaps. All 6 ROADMAP success criteria (SC-1 through SC-6) are VERIFIED against the actual source code — not merely asserted by SUMMARY.md narration. Every artifact cited in the plan frontmatter `must_haves` was read in full and confirmed substantive (no stubs, no placeholders, no hardcoded-empty data) and wired (imports resolve, dispatches reach real store actions, data flows from the aggregator through to rendered ₱ values). The full Vitest suite (642/642, 84 files), typecheck (node+web clean), and production build were re-executed fresh in this verification pass and matched the SUMMARY claims exactly — no discrepancy found between what was claimed and what exists. The two items routed to human verification are the phase's own explicitly-declared Manual-Only Verifications (visual/interaction feel, out of automated scope per this phase's own validation contract and per the assignment's explicit instruction that "this is a UI phase — visual/interaction feel is out of automated scope").

---

*Verified: 2026-07-01T16:15:00Z*
*Verifier: Claude (gsd-verifier)*
