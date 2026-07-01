# Phase 16 — Manual Notes: Estimating Workspace

> Manual-ready reference for the net-new, user-facing capabilities shipped in Phase 16.
> Audience: the construction estimator using the CLMC Takeoff App. Written to drop
> straight into the How-To-Manual.
>
> **What changed in one line:** pricing moved **off** the measurement surfaces into a
> dedicated **Estimate** worksheet — a `Plan | Estimate` toggle in the **Estimating**
> ribbon tab swaps the whole center area between the PDF plan and a full-width estimate
> sheet. The single unit rate from Phase 15 widened into **internal cost** (Material +
> Labor) plus a **client price** driven by a **Markup %** (default **30%**), giving each
> item a live **Cost**, **Price**, and **Margin**. The Excel/CSV export widened to
> **ten columns** (a per-unit **UNIT PRICE** column, and the line total is headed
> **TOTAL**). **Phase 16 supersedes Phase 15's inline totals-panel pricing** — the
> right totals panel is back to **quantity-only**.

---

## New capabilities at a glance (How-To-Manual entries)

| Capability | Where | How to use |
|------------|-------|------------|
| **Plan \| Estimate toggle** | Ribbon → **Estimating** tab | Click **Plan** to see the PDF canvas; click **Estimate** to see the full-width estimate sheet. Switching is instant and does **not** disturb the PDF or your markups. |
| **Estimate sheet** | Center area (in **Estimate** view) | A spreadsheet grouped by category. Columns are grouped **Internal** (Material · Labor · Cost) and **Client** (Markup · Price · Margin). Per-category subtotals + a grand-total bar show Cost/Price/Margin. |
| **Edit Material rate** | Estimate sheet — Material cell | Click the **Material** cell on a row, type a ₱/unit rate, press **Enter** or click away to commit. Material cost = Material rate × Quantity. |
| **Edit Labor rate** | Estimate sheet — Labor cell | Click the **Labor** cell, type a ₱/unit rate, commit. Labor cost = Labor rate × Quantity. |
| **Edit Markup %** | Estimate sheet — Markup cell | Click the **Markup** cell, type a percent (e.g. `30`), commit. A blank markup uses the **30%** default. |
| **Live Cost / Price / Margin** | Estimate sheet — per row | Read-only. **Cost** = Material cost + Labor cost (internal). **Price** = Cost × (1 + Markup ÷ 100) (client). **Margin** = Price − Cost. All recompute the instant you edit a rate, a markup, **or** the takeoff quantity. |
| **Default markup % control** | Ribbon → **Settings** tab | A **Default markup %** field seeded at **30**. Sets the project-wide default applied to rows with no explicit markup. (See Section 3 for its v1 scope.) |
| **Quantity-only totals panel** | Right-side totals panel | Now shows **quantities only** — no ₱ rate field, no cost, no cost subtotal, no grand-total-cost bar. All pricing lives in the Estimate sheet. |
| **10-column export** | Excel (.xlsx) and CSV export | Export as usual — the sheet now has ten columns: **Item · Quantity · UoM · Material · Labor · Cost · Markup · UNIT PRICE · TOTAL · Margin**, with per-category Cost/TOTAL/Margin subtotals and grand totals. **UNIT PRICE** is the per-unit client price (= TOTAL ÷ Quantity); **TOTAL** is the line total (the value formerly headed "Price"). |

**Pricing keying (worth knowing):** pricing is remembered per **item name + measurement
type** (e.g. `Outlet` + count, `Skirting` + perimeter), and is **category-independent** —
the same name+type in two different categories shares **one** `{ Material, Labor, Markup }`
entry. Pricing is saved inside the project `.clmc` file, so it persists across save/reload
of that project. **Markup is a PERCENT, not a fraction** (`30` means 30%).

---

## Section 1 — Phase-15 → Phase-16 pricing back-compat (no data loss)

A project you saved with **Phase 15** carries a **single rate** per item name+type
(internally, `rates: Record<string, number>` — one ₱ number per `name|type`). When you
open that project in **Phase 16**, each single rate is **coerced** into the new
`{ material, labor, markup }` shape as follows:

- The old single rate becomes the **Material** rate.
- **Labor** starts at **0**.
- **Markup** defaults to **30%**.

That is: `50` → `{ material: 50, labor: 0, markup: 30 }`. **No data is lost** — your prior
rate is preserved as the material rate; you simply gain a labor rate (starting at 0) and a
markup (starting at 30%) that you can now edit.

- **No file-format change and no migration step.** The project file version is **not**
  bumped. The widened pricing is an **additive** field that rides the existing load-time
  validation (the same additive, no-bump approach Phase 15 used) — a Phase-15 file loads
  **cleanly** with no prompt.
- **A file with no pricing at all** (older, pre-Phase-15) loads with **every Material and
  Labor rate 0** and **Markup 30%** — so every Cost/Price/Margin reads **₱0.00** until you
  set rates, and the markup default is already in place.
- **Malformed or negative stored values are dropped/defaulted** on load (a negative or
  non-numeric material/labor coerces to 0; a missing markup coerces to 30), so a
  hand-edited or corrupt file can never load a bad rate.

In short: open any pre-Phase-16 project normally. Your old rate is now the **Material**
rate, Labor is 0, and Markup is 30% — ready to edit in the Estimate sheet.

---

## Section 2 — The Estimate workspace + how pricing moved off the Plan

Pricing now lives **only** in the **Estimating** ribbon tab:

- The Estimating tab has a **`Plan | Estimate`** segmented toggle. **Plan** shows the PDF
  canvas (unchanged); **Estimate** shows a **full-width estimate sheet** in the same
  center area.
- The **Plan canvas and the right-side totals panel are quantity-only.** Phase 15's inline
  ₱ **Rate** field on each totals row — and its per-row cost, per-category cost subtotal,
  and grand-total-cost bar — have been **removed**. The totals panel shows quantities,
  the visibility (lightbulb) toggle, the color chip, and the click-to-arm cycle only.
- **The estimate sheet** groups rows by category with these columns:
  - **Internal:** **Material** (₱/unit, editable) · **Labor** (₱/unit, editable) ·
    **Cost** (computed = Material×Qty + Labor×Qty).
  - **Client:** **Markup %** (editable) · **Price** (computed = Cost × (1 + Markup ÷ 100)) ·
    **Margin** (computed = Price − Cost).
  - Each **category** shows **Cost / Price / Margin subtotals**, and a pinned
    **grand-total bar** shows the project **Cost / Price / Margin**.
- **Editable cells** are **Material**, **Labor**, and **Markup**. Click a cell, type a
  value, and commit with **Enter** or by clicking away (blur). **Markup is a PERCENT**
  (type `30` for 30%, not `0.30`). Cost, Price, and Margin are **computed** and update
  live — including when the underlying takeoff **quantity** changes.
- **Switching views is mount-preserving.** Toggling `Plan ⟷ Estimate` keeps the PDF and
  all markups intact — the plan is **not** re-rendered and there is **no flicker**. You can
  flip back and forth freely while pricing.

---

## Section 3 — ₱ currency is a hardcoded constant + the default-markup Settings control scope

- **Currency:** the currency symbol throughout the app and the export is **₱ (Philippine
  Peso)**. It is a **hardcoded constant** — **there is no Settings currency picker yet**
  (deferred to a later phase). For maintainers, the future picker has a **single seam in
  two places** (renderer and export writer keep separate copies because they run in
  different processes and cannot share a constant across that boundary):
  - **UI / Estimate sheet:** `CURRENCY_SYMBOL` in `src/renderer/src/lib/currency.ts`.
  - **Excel/CSV export:** the writer's own `NUMFMT_PESO = '₱#,##0.00'` in
    `src/main/boq-writers.ts` (the main process keeps its own copy intentionally).
  - A future currency picker updates **both** seams.
- **Default markup %:** the project-wide default markup (**30%**) lives in
  `src/renderer/src/lib/estimate-defaults.ts` as `DEFAULT_MARKUP_PCT`, and is now surfaced
  as an **editable "Default markup %" field in the Settings ribbon tab** (replacing the old
  "Coming soon" stub).
  - **v1 scope — recorded honestly:** the Settings field is a **minimal, in-session-only**
    control. It **displays and edits an in-session default** seeded from
    `DEFAULT_MARKUP_PCT` (30) and validates input (non-numeric or negative → 0). It does
    **not yet persist across save/reload**, and it does **not yet re-wire the aggregator's
    default** — the aggregator still applies **30%** to any row with no explicit markup (the
    `DEFAULT_MARKUP_PCT` seam is unchanged, so **30 remains the shipped default** for
    unpriced rows). A persisted, aggregator-wired mutable default is a small follow-on.
- **Deferred this phase (D-09), by design so they can be added later:** a **price-book /
  cost catalog**, **reusable items & assemblies**, **equipment cost**, **per-project
  overhead**, and a **separate client-facing unit-price column**. Also still deferred: a
  persistent, cross-project **Item Library** (names + default rates shared between
  *different* projects) — Phase 16 prices **per project only**.

---

## Section 4 — Manual UAT checklist: the estimate + 10-column export

Follow these steps to verify the estimate workspace and priced export end-to-end.
Cross-references the phase validation contract (`16-VALIDATION.md` →
*Manual-Only Verifications*): the estimate live-edit feel (SC-2/SC-3), the Plan⟷Estimate
switch (SC-1), the quantity-only totals panel (SC-1), and the priced Excel/CSV export (SC-6).

> **Refinement (2026-07-01, UAT):** the priced export was widened from **nine** to **ten**
> columns per user feedback — a per-unit **UNIT PRICE** column was inserted between Markup
> and the line total, and the line-total header was renamed from "Price" to **TOTAL**. This
> refines **SC-6** (the export contract); all other Phase-16 criteria are unchanged.

1. **Open, calibrate, and place markups.** Launch the app, load a PDF floor plan, and
   **set scale** on a page (draw a line over a known distance, enter the real-world
   length). Add several **count** and **linear** markups; give each a **name** and a
   **category** (e.g. Electrical, Plumbing).

2. **Open the estimate sheet.** Go to the **Estimating** ribbon tab and click **Estimate**.
   Confirm the center area shows a **full-width grid** grouped by category, with the
   grouped **Internal** (Material · Labor · Cost) and **Client** (Markup · Price · Margin)
   columns and a grand-total bar.

3. **Edit rates and watch it go live.** On a row, type a **Material** rate and a **Labor**
   rate, and a **Markup** (e.g. `30`), committing each with **Enter** or by clicking away.
   Confirm:
   - the row **Cost** (Material×Qty + Labor×Qty), **Price** (Cost × (1 + Markup ÷ 100)),
     and **Margin** (Price − Cost) update immediately;
   - the **category subtotal** and the **grand-total bar** (Cost/Price/Margin) update;
   - a row you leave with a **blank markup** falls back to **30%**;
   - editing a cell does **not** flip the PDF page or re-arm a drawing tool.

4. **Toggle back to Plan (SC-1).** Click **Plan**. Confirm the **PDF and all markups are
   intact with no flicker / no re-rasterization**, and that the right-side **totals panel
   is quantity-only** — no ₱ rate field, no cost, no cost subtotal, no grand-total-cost bar.

5. **Export to Excel (.xlsx) and verify (SC-6).** Export to **xlsx** and open it in Excel.
   Confirm:
   - the **ten** columns read **Item · Quantity · UoM · Material · Labor · Cost · Markup ·
     UNIT PRICE · TOTAL · Margin**;
   - **UNIT PRICE** is the **per-unit client price** and equals **TOTAL ÷ Quantity** (so
     UNIT PRICE × Quantity = TOTAL); **TOTAL** is the **line total** (the value that used to
     be headed "Price");
   - **Material / Labor / Cost / UNIT PRICE / TOTAL / Margin** display with the **₱** symbol
     and **2 decimals**, and **Markup** displays as a **percent** (e.g. `30%`) — **not** ₱;
   - a `=SUM(...)` over a **money** column (e.g. Cost or TOTAL) produces the correct total —
     this proves the cells are **native numbers**, not text (if ₱ were baked into the text,
     SUM would return 0);
   - per-category **Cost / TOTAL / Margin subtotal** rows and **grand-total Cost / TOTAL /
     Margin** rows are present (the **Markup** and **UNIT PRICE** columns are **blank** on
     those subtotal/grand rows — a subtotal has no single unit price or markup).

6. **Export to CSV and verify the ₱ stays clean.** Export to **csv** and open it in Excel.
   Confirm the money columns (**Material / Labor / Cost / Markup / UNIT PRICE / TOTAL /
   Margin**) are **plain numbers** (no ₱ glyph in the data cells — currency lives in display,
   not the raw CSV; **Markup** is the plain percent number like `30`), that **UNIT PRICE** =
   **TOTAL ÷ Quantity** on each item row, and that any ₱ that appears in display text is
   **not mojibaked** (the file's UTF-8 byte-order mark keeps it rendering correctly on
   Windows, the same way it protects `m²`).

7. **Check the default-markup Settings control (v1 scope).** Open the **Settings** ribbon
   tab. Confirm a **Default markup %** field seeded at **30** that accepts a numeric value
   (non-numeric or negative clamps to 0). Note (per Section 3) that this v1 control is
   **in-session only** and does not yet persist across save/reload or re-wire the
   aggregator default — unpriced rows still use **30%**.

---

*Phase: 16-estimating-workspace*
*Manual notes written 2026-07-01; export section refined to 10 columns (UNIT PRICE + TOTAL) 2026-07-01 per UAT*
