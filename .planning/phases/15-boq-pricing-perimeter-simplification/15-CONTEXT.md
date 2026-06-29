# Phase 15: BOQ Pricing & Perimeter Simplification - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** User-locked decisions captured during the GAP-002 frontier session (`/gsd-spike`). NOT discuss-phase — the user confirmed every decision below directly. Do not re-litigate.

<domain>
## Phase Boundary

Convert the quantity-only BOQ into a **priced** BOQ, and narrow the **Perimeter** tool to a length-only measurement. The two changes ship together because they touch the same BOQ code (aggregator, types, writers, totals panel), and because making each markup map to exactly one `(name, type)` row is what makes per-`(name,type)` pricing clean.

**In scope:** pricing data model + cost math + inline rate-edit UI + export Rate/Cost columns; perimeter → length-only across aggregator / types / writers / totals UI / canvas / tests; PROJECT.md scope flip.

**Out of scope (deferred to a later phase):** the persistent cross-project **Item Library** (names + default rates in AppData JSON) — pricing lands first, the library remembers rates later; and a **Settings currency picker** — ₱ is a hardcoded constant this phase.
</domain>

<decisions>
## Implementation Decisions (LOCKED — user-confirmed)

### Pricing scope
- Pricing is now **IN SCOPE**. This reverses PROJECT.md, which lists "Unit cost / pricing calculations" under **Out of Scope** for v1. Part of this phase moves that line Out of Scope → Validated/Active in PROJECT.md.

### Rate identity & data model
- Rate is keyed by BOQ **row identity `(name, type)`** — a `rates: Record<string, number>` map keyed by the string `` `${name}|${type}` `` (e.g. `Outlet|count`, `Skirting|perimeter`).
- **ADDITIVE** schema change — **NO `formatVersion` bump**. Mirror the existing optional `hiddenItemNames?` field exactly (see `validateV2` in project-schema.ts). Add `rates?: Record<string, number>` to the project schema + serialize/deserialize.
- Rate is **category-independent**: the same `(name, type)` in two categories shares ONE rate.
- A row with no rate set behaves as rate = 0 / cost = 0 (blank, never an error).

### Cost math
- `cost = rate × quantity`, computed per BOQ row.
- Add `rate: number` and `cost: number` to `BoqItemRow` (boq-types.ts); populate in the aggregator (boq-aggregator.ts) by reading the rate from the project store's `rates` map via `` `${name}|${type}` ``.
- Per-category **cost subtotal** (sum of row costs) + a project **grand-total cost**. Quantity subtotals stay per-UoM; cost subtotals are a single ₱ number per category (cost is unit-agnostic).

### Currency
- Currency symbol = **₱** (Philippine Peso), a **hardcoded constant** this phase (no Settings picker — deferred).
- Define one shared constant (e.g. `CURRENCY_SYMBOL = '₱'`) consumed by the totals panel and both writers, so a future Settings picker has a single seam.

### Totals-panel UX
- **Inline editable rate field (₱) per row** in TotalsRow.tsx. Mirror the existing "resume group from totals row" interaction already in the totals panel.
- Editing a row's rate updates the `rates` map for that `` `${name}|${type}` `` and recomputes costs live (totals panel is already live via useBoqLive).
- Display the row Cost alongside the quantity; show the category cost subtotal and the grand-total cost.

### Export (xlsx + csv)
- Add **`Rate` and `Cost` columns** to BOTH writers (boq-writers.ts → buildBoqXlsx + buildBoqCsv). Column order: **Item · Quantity · UoM · Rate · Cost**.
- xlsx: Rate/Cost use a ₱ numFmt (2 decimals); include per-category cost subtotals and a grand-total cost row, consistent with the existing quantity-subtotal layout.
- csv: Rate/Cost as numeric columns, consistent with how the csv writer currently emits quantity.

### Perimeter → length only
- Remove the perimeter-area synthesis everywhere; a perimeter markup emits **ONE** BOQ row (length).
- boq-types.ts: drop `'perimeter-area'` from `BoqRowType`. **Optional (planner's discretion):** rename `'perimeter-length'` → `'perimeter'` for clarity — if renamed, update all references + `uomFor`/label logic.
- boq-aggregator.ts (~line 155): remove the `add(catId, m.name, 'perimeter-area', realA)` call and the perimeter `polygonArea`/`pixelAreaToReal` computation. **Keep** the perimeter LENGTH add (closing-augmented polyline length, **arc-aware** — do not regress Phase 14).
- Remove perimeter-area references in boq-writers.ts, TotalsRow.tsx, TotalsCategoryBlock.tsx.

### Perimeter BOQ label — consistent with the other tools
- Today perimeter is **excluded** from the aggregator's collision-detection (D-02) and always suffixed `(perimeter)`/`(area)`. Change: perimeter becomes a **first-class member** of the existing collision set used by count/linear/area.
- A perimeter row is labeled plainly `{name}`, gaining `{name} (perimeter)` **only** when the same name also has a count/linear/area row in that category (the same rule the other types already follow). The type-word helper (`nonPerimeterTypeWord` or its replacement) must handle the perimeter case.

### Perimeter canvas rendering (PerimeterMarkup.tsx)
- Render as an **UNFILLED closed outline** — remove `` fill={`${markup.color}33`} `` (keep the closed stroked Line).
- Change the label from `P: 24.6 m  A: 38.2 m²` → length only `P: 24.6 m`. Remove the `polygonArea` + `pixelAreaToReal` calls that fed the area half.

### Migration / back-compat
- Existing `.clmc` projects with perimeter markups lose their **area** BOQ rows on reload. Area was always computed **live, never stored** → **NO data loss**, only a BOQ output change. Intended. No `formatVersion` bump, no migration code (rates is additive; perimeter geometry is unchanged — only its BOQ synthesis changes). Note it in the phase summary / manual notes.

### Claude's Discretion
- Exact placement/styling of the inline rate field + cost display (follow existing TotalsRow patterns + ui-brand).
- Whether to rename `perimeter-length` → `perimeter`.
- Exact ₱ numFmt string + xlsx column widths.
- Rate-edit commit trigger (blur vs Enter) — follow existing inline-edit patterns.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### BOQ engine (pricing + perimeter)
- `src/renderer/src/lib/boq-types.ts` — BoqRowType, BoqItemRow, BoqStructure, subtotals
- `src/renderer/src/lib/boq-aggregator.ts` — aggregateBoq: bucketing by `(category, name|type)`, perimeter two-row synthesis (~lines 143–159), D-02 label/collision logic, subtotals
- `src/main/boq-writers.ts` — buildBoqXlsx + buildBoqCsv (columns + subtotals)
- `src/renderer/src/hooks/useBoqLive.ts` — live totals wiring

### Totals panel UI
- `src/renderer/src/components/TotalsRow.tsx` — per-row UI + the "resume group" interaction to mirror
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — category grouping + subtotals
- `src/renderer/src/components/TotalsPanel.tsx`, `TotalsPanelHeader.tsx` — panel shell + grand totals

### Project schema (rates persistence — mirror hiddenItemNames)
- `src/renderer/src/lib/project-schema.ts` — schema + `validateV2` (find `hiddenItemNames?` as the additive-field analog)
- `src/renderer/src/lib/project-serialize.ts` — serialize/deserialize
- `src/renderer/src/stores/projectStore.ts` — where `hiddenItemSet` lives; `rates` state belongs alongside

### Perimeter rendering
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — canvas render + label (remove fill + area half)

### Why this phase exists
- `.planning/spikes/GAP-002-post-precision-gaps.md` — Tier 1 gap (measuring tool → estimating tool)
</canonical_refs>

<specifics>
## Specific Ideas
- Rate map key string: `` `${name}|${type}` `` — identical join style to the aggregator's existing bucket key.
- Currency constant: `₱`.
- BOQ column order: Item · Quantity · UoM · Rate · Cost.
- Perimeter length stays **arc-aware** (`polylineLength` with `m.arcs` on closing-augmented points) — do NOT regress Phase 14 arc behavior.
- Test surface to update: boq-aggregator.test.ts, boq-aggregator-wall.test.ts (if perimeter-asserting), totals-row-cycle.test.ts, markup-visibility.test.ts, markup-post-commit-reopen.test.ts, highlight-overlay-listening.test.ts, boq-writers-xlsx.test.ts, boq-writers-csv.test.ts, project-schema.test.ts, project-serialize.test.ts.
</specifics>

<deferred>
## Deferred Ideas
- Persistent Item Library (cross-project names + default rates in AppData JSON) — next phase.
- Settings currency picker — ₱ hardcoded this phase.
- Per-page / per-category rate overrides — out of scope; rate is global per `(name, type)`.
</deferred>

---

*Phase: 15-boq-pricing-perimeter-simplification*
*Context captured 2026-06-29 from user-locked decisions (GAP-002 frontier session)*
