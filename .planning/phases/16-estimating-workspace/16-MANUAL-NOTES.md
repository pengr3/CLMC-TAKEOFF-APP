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
> item a live **Cost**, **UNIT PRICE**, **TOTAL**, and **Margin**. Both the on-screen
> **Estimate sheet** and the Excel/CSV export show **ten columns** — a per-unit **UNIT
> PRICE** column, and the line total is headed **TOTAL** (formerly "Price"). **Phase 16
> supersedes Phase 15's inline totals-panel pricing** — the right totals panel is back to
> **quantity-only**.

---

## New capabilities at a glance (How-To-Manual entries)

| Capability | Where | How to use |
|------------|-------|------------|
| **Plan \| Estimate toggle** | Ribbon → **Estimating** tab | Click **Plan** to see the PDF canvas; click **Estimate** to see the full-width estimate sheet. Switching is instant and does **not** disturb the PDF or your markups. |
| **Estimate sheet** | Center area (in **Estimate** view) | A spreadsheet grouped by category. Columns are grouped **Internal** (Material · Labor · Cost) and **Client** (Markup · **UNIT PRICE** · **TOTAL** · Margin) — ten columns total, matching the export. Per-category subtotals + a grand-total bar show Cost/TOTAL/Margin (UNIT PRICE blank on those rows). |
| **Edit Material rate** | Estimate sheet — Material cell | Click the **Material** cell on a row, type a ₱/unit rate, press **Enter** or click away to commit. Material cost = Material rate × Quantity. |
| **Edit Labor rate** | Estimate sheet — Labor cell | Click the **Labor** cell, type a ₱/unit rate, commit. Labor cost = Labor rate × Quantity. |
| **Edit Markup %** | Estimate sheet — Markup cell | Click the **Markup** cell, type a percent (e.g. `30`), commit. A blank markup uses the **30%** default. |
| **Live Cost / UNIT PRICE / TOTAL / Margin** | Estimate sheet — per row | Read-only. **Cost** = Material cost + Labor cost (internal). **UNIT PRICE** = per-unit client price = (Material + Labor) × (1 + Markup ÷ 100) = **TOTAL ÷ Quantity**. **TOTAL** = the client line total = Cost × (1 + Markup ÷ 100) (the value formerly headed "Price"). **Margin** = TOTAL − Cost. All recompute the instant you edit a rate, a markup, **or** the takeoff quantity. |
| **Default markup control** | **Estimate sheet header** (top-right of the Estimate sheet) | A **Default markup: [ 30 ] %** field with an always-visible scope hint ("Applies to every item without its own markup"). Sets the **project-wide** default markup applied to every row **without an explicit markup**. It is **project data** — it **persists in the `.clmc`** and follows the project, not the workstation. Editable (blur/Enter commits, decimals like `27.5` supported). Because a change **re-prices every un-priced item**, it is **not applied silently**: changing the value opens a **"Change default markup?" confirmation** first; the change applies **only when you confirm**, and **Cancel reverts** with no effect. Defaults to **30**. |
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
- **The estimate sheet** groups rows by category with these **ten columns** (Item ·
  Quantity · UoM, then the two grouped ₱ blocks — the same column set as the export):
  - **Internal:** **Material** (₱/unit, editable) · **Labor** (₱/unit, editable) ·
    **Cost** (computed = Material×Qty + Labor×Qty).
  - **Client:** **Markup %** (editable) · **UNIT PRICE** (computed = (Material + Labor) ×
    (1 + Markup ÷ 100) = **TOTAL ÷ Quantity**) · **TOTAL** (computed = Cost × (1 + Markup ÷
    100) — the line total, formerly headed "Price") · **Margin** (computed = TOTAL − Cost).
  - Each **category** shows **Cost / TOTAL / Margin subtotals**, and a pinned
    **grand-total bar** shows the project **Cost / TOTAL / Margin**. The **UNIT PRICE**
    column is **blank** on subtotal and grand-total rows — a subtotal has no single unit price.
- **Editable cells** are **Material**, **Labor**, and **Markup** only. Click a cell, type a
  value, and commit with **Enter** or by clicking away (blur). **Markup is a PERCENT**
  (type `30` for 30%, not `0.30`). Cost, UNIT PRICE, TOTAL, and Margin are **read-only /
  computed** and update live — including when the underlying takeoff **quantity** changes.
- **Switching views is mount-preserving.** Toggling `Plan ⟷ Estimate` keeps the PDF and
  all markups intact — the plan is **not** re-rendered and there is **no flicker**. You can
  flip back and forth freely while pricing.

---

## Section 3 — ₱ currency is a hardcoded constant + the project-wide default-markup control (Estimate header)

- **Currency:** the currency symbol throughout the app and the export is **₱ (Philippine
  Peso)**. It is a **hardcoded constant** — **there is no Settings currency picker yet**
  (deferred to a later phase). For maintainers, the future picker has a **single seam in
  two places** (renderer and export writer keep separate copies because they run in
  different processes and cannot share a constant across that boundary):
  - **UI / Estimate sheet:** `CURRENCY_SYMBOL` in `src/renderer/src/lib/currency.ts`.
  - **Excel/CSV export:** the writer's own `NUMFMT_PESO = '₱#,##0.00'` in
    `src/main/boq-writers.ts` (the main process keeps its own copy intentionally).
  - A future currency picker updates **both** seams.
- **Default markup control (WR-01 — now fully wired, in the Estimate sheet header):** the
  project-wide default markup (**30%**) is an **editable "Default markup: [ 30 ] %" control
  in the Estimate sheet header** (top-right of the Estimate sheet, above the column header).
  It replaces the earlier **inert Settings-tab field** (16-05), which looked editable but was
  wired to nothing — that control has been **removed** and the Settings tab is back to a
  "Coming soon" stub.
  - **Why the Estimate header, not Settings:** the default markup is **project data** — it
    must **follow the project, not the workstation** — so it belongs on the project's
    Estimate sheet, not in the generic per-workstation Settings tab.
  - **What it does:** it sets the markup applied to **every row with no explicit markup**.
    The aggregator resolves each row's markup as *explicit entry markup → this project
    default → 30* (`entry?.markup ?? defaultMarkup ?? DEFAULT_MARKUP_PCT`). So a row you
    price with its own markup is unaffected; an **un-priced** row (or one you leave without a
    markup) uses this default, and its **Cost / UNIT PRICE / TOTAL / Margin recompute live**
    the instant the change is applied.
  - **Confirmation before it applies (not a silent commit):** because changing the default
    **re-prices every un-priced item across the whole project**, the control does **not**
    commit as quietly as a single rate cell. When you change the value and press **Enter** or
    click away, a **"Change default markup?"** dialog appears first — it states the change
    (e.g. *"…from 30% to 27.5% and re-prices every item that doesn't have its own markup"*).
    - **Change markup** (confirm) applies the new default and re-prices live.
    - **Cancel** (also **Esc** or clicking the dark backdrop) discards the change and
      **reverts the field to the previous value** — nothing is written, so no rows re-price.
    - A **scope hint** under the field ("Applies to every item without its own markup") makes
      the control's project-wide reach clear even before you edit it.
    - Re-entering the **same** value (or clicking away **without editing**) does **nothing** —
      no dialog, no re-price.
  - **Persistence:** the value is **saved inside the `.clmc`** (an additive field — **no file
    format bump**), so it survives save/reload of that project. **Legacy / Phase-15 /
    early-Phase-16** projects that predate this control load with the **30%** default; a
    corrupt/negative/non-numeric stored value is sanitized to **30** on load.
  - **Editing:** click the field, type a value (decimals like `27.5` are fine), and commit
    with **Enter** or by clicking away (**blur**) — the same commit discipline as the
    Estimate rate cells. A blank or negative entry clamps to **0** (a legitimate "no default
    markup"; the aggregator honors a project default of 0).
  - **Maintainer seam:** the **30** fallback constant is still `DEFAULT_MARKUP_PCT` in
    `src/renderer/src/lib/estimate-defaults.ts`; the mutable project value is
    `projectStore.defaultMarkupPct` (set via `setDefaultMarkupPct`).
- **Deferred this phase (D-09), by design so they can be added later:** a **price-book /
  cost catalog**, **reusable items & assemblies**, **equipment cost**, and **per-project
  overhead**. (The **client-facing unit-price column** originally listed here as deferred
  was **added in the 2026-07-01 UAT refinement** — the **UNIT PRICE** column now ships in
  both the Estimate sheet and the export.) Also still deferred: a persistent, cross-project
  **Item Library** (names + default rates shared between
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
   Confirm the center area shows a **full-width grid** grouped by category, with the ten
   columns — grouped **Internal** (Material · Labor · Cost) and **Client** (Markup ·
   **UNIT PRICE** · **TOTAL** · Margin) — aligned across the header, the item rows, the
   per-category subtotals, and the grand-total bar.

3. **Edit rates and watch it go live.** On a row, type a **Material** rate and a **Labor**
   rate, and a **Markup** (e.g. `30`), committing each with **Enter** or by clicking away.
   Confirm:
   - the row **Cost** (Material×Qty + Labor×Qty), **UNIT PRICE** ((Material + Labor) ×
     (1 + Markup ÷ 100) = TOTAL ÷ Quantity), **TOTAL** (Cost × (1 + Markup ÷ 100)), and
     **Margin** (TOTAL − Cost) update immediately, and that **UNIT PRICE × Quantity = TOTAL**;
   - the **category subtotal** and the **grand-total bar** (Cost/TOTAL/Margin) update, with
     the **UNIT PRICE** column blank on those subtotal/grand rows;
   - a row you leave with a **blank markup** falls back to **30%**;
   - the **UNIT PRICE** and **TOTAL** cells are **read-only** (only Material/Labor/Markup edit);
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

7. **Check the default-markup control in the Estimate header (WR-01) + its confirmation.** On
   the **Estimate** sheet, find the **Default markup: [ 30 ] %** control in the header
   (top-right, above the column header), with the **"Applies to every item without its own
   markup"** scope hint beneath it. Confirm:
   - it reads **30** on a fresh project, and accepts a numeric value including a decimal like
     `27.5` (type it, then **Enter** or click away to commit; a blank or negative entry
     clamps to **0**);
   - changing the value opens a **"Change default markup?"** confirmation that names the old
     and new percentages and states it **re-prices every item that doesn't have its own
     markup** — the change is **not** applied silently;
   - clicking **Change markup** (confirm) applies the new default and **immediately** updates
     the **UNIT PRICE / TOTAL / Margin** of any **un-priced** row, while rows you gave their
     own markup are unaffected;
   - clicking **Cancel** (or pressing **Esc**, or clicking the dark backdrop) **reverts the
     field to the previous value** and changes **nothing** — no rows re-price;
   - re-entering the **same** value, or clicking away **without editing**, shows **no dialog**
     and re-prices nothing;
   - the value **persists**: **Save** the project, close and re-open it, and confirm the
     control still shows the value you confirmed (it is stored in the `.clmc`);
   - the **Settings** ribbon tab no longer has a default-markup field (it is back to a
     "Coming soon" stub) — the control lives on the Estimate sheet because the default markup
     is **project data** that follows the project, not the workstation.

---

*Phase: 16-estimating-workspace*
*Manual notes written 2026-07-01; export section refined to 10 columns (UNIT PRICE + TOTAL) 2026-07-01 per UAT; on-screen Estimate grid brought to the same 10 columns 2026-07-01 per UAT; default-markup control wired + moved to the Estimate sheet header (WR-01) 2026-07-01; default-markup change now gated behind a confirm-with-impact dialog + always-visible scope hint 2026-07-01 per UAT*
