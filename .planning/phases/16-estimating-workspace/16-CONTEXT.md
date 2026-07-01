# Phase 16 — Estimating Workspace — Context

**Status:** locked (from conversational design + two reviewed mockups, 2026-07-01)
**Supersedes:** Phase 15 inline totals-panel pricing (Plan 15-03 / Phase-15 SC-2)
**Depends on:** Phase 15 (rates data model, aggregator cost math, priced export, perimeter simplification)

## Problem

Phase 15 shipped unit-rate pricing as an inline ₱ field on each row of the right-side totals panel. UAT feedback: pricing does not belong on the narrow measurement panel. Industry practice (PlanSwift's Estimating tab, STACK's estimate + cost database, Bluebeam's Quantity Link spreadsheet) separates takeoff (measuring quantities) from estimating (applying rates/costs) into a dedicated estimate worksheet. This phase moves pricing into its own workspace and expands the model from a single rate to internal cost (material + labor) plus client price and margin.

## Locked Decisions

- **D-01 — Dedicated Estimate workspace.** Pricing lives ONLY in the `Estimating` ribbon tab. A `Plan | Estimate` segmented toggle swaps the main area between the PDF canvas ("Plan") and a full-width estimate spreadsheet ("Estimate"). Chosen over a bottom-docked sheet or a separate window.
- **D-02 — Plan + totals panel are quantity-only.** No pricing on the Plan/canvas workspace. The right-side totals panel shows quantities only — no rate, no cost, no ₱ at all. Phase 15's inline `TotalsRow` ₱ rate field AND its per-row/subtotal/grand-total cost display are REMOVED (revert of Plan 15-03's totals-panel changes; keep the perimeter/PerimeterMarkup part of 15-03).
- **D-03 — Internal cost = material + labor.** Per `name|type`: a Material unit rate (₱/unit) and a Labor unit rate (₱/unit). Material cost = material rate × qty; Labor cost = labor rate × qty; Cost = Material cost + Labor cost (the internal/contractor cost).
- **D-04 — Entry = unit rate × quantity.** Cells accept a per-unit rate and display the extended ₱ amount; costs recompute when the rate OR the takeoff quantity changes. Not lump-sum entry.
- **D-05 — Client price via markup.** Per `name|type` a Markup % that defaults to 30% and is editable per row. Price = Cost × (1 + markup); Margin = Price − Cost. 30% is a project-wide default (surface a Settings control to change it later); a row with no explicit markup uses 30%.
- **D-06 — Storage shape.** Pricing stored per `name|type` as `{ material, labor, markup }` (Phase 15 stored a single number). Serialized in the .clmc; survives save/reload; shared across categories/pages by `name|type`. Back-compat: a Phase-15 single-rate `.clmc` loads without error; missing markup → 30%. RESEARCH must decide how a legacy single `rate` maps (proposed: → material, labor 0) and whether a formatVersion bump is warranted (Phase 15 avoided one via additive fields — prefer the same additive approach).
- **D-07 — Grid layout.** Columns grouped as: `Item · Qty · UoM` | Internal: `Material ₱ · Labor ₱ · Cost ₱` | Client: `Markup % · Price ₱ · Margin ₱`. Rows grouped by category with per-category subtotals (Cost/Price/Margin) and a pinned grand-total bar (Cost/Price/Margin). ₱ formatting `₱#,##0.00`. Editable cells: material rate, labor rate, markup %. Computed: material cost, labor cost, cost, price, margin.
- **D-08 — Export expansion.** xlsx + csv gain `Material / Labor / Cost / Markup / Price / Margin` columns, per-category subtotals, and a grand total; ₱ money cells stay SUM-safe native numbers (xlsx numFmt), csv numeric + UTF-8 BOM preserved (extends Plan 15-04).
- **D-09 — v1 scope.** Manual rates + markup only. Deferred (design columns/model so they can be added later): price-book / cost catalog, reusable items & assemblies, equipment cost, per-project overhead, a separate client-facing unit-price column.

## Reuse / Supersede map

- **KEEP:** Phase 15 perimeter length-only simplification; the aggregator + export plumbing; the ₱ currency seam (`src/renderer/src/lib/currency.ts` + writer-local `NUMFMT_PESO`).
- **SUPERSEDE:** Plan 15-03 inline `TotalsRow` rate field + cost display (remove; totals panel back to quantity-only).
- **EXTEND:** Plan 15-02 storage/aggregator (single rate → `{material,labor,markup}`; cost → cost/price/margin + subtotals/grand totals); Plan 15-04 export (Rate/Cost columns → the full six-column set).

## Mockups referenced

Two dark-theme (app VS Code palette) mockups reviewed and approved during design: (1) the Estimate workspace — ribbon `Plan | Estimate` toggle, grouped Internal/Client columns, category subtotals, grand-total bar; (2) totals-panel before/after showing the quantity-only revert. Conversational artifacts (not saved to the repo).

## Open items for RESEARCH / PLAN

- Legacy single-`rate` migration mapping (D-06) and formatVersion decision.
- Where the `Plan | Estimate` view-state lives (viewer store vs a new UI store) and how the main area switches without disturbing the Konva canvas mount.
- Markup default (30%) as a project-level setting: storage + Settings UI (may be minimal for v1).
- Whether the Estimate grid reuses the BOQ aggregator output or a new estimate-specific selector.
