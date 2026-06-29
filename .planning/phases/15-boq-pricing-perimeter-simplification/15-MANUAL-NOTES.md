# Phase 15 — Manual Notes: BOQ Pricing & Perimeter Simplification

> Manual-ready reference for the net-new, user-facing capabilities shipped in Phase 15.
> Audience: the construction estimator using the CLMC Takeoff App. Written to drop
> straight into the How-To-Manual.
>
> **What changed in one line:** the BOQ now carries **money**, not just quantities —
> set a unit rate (₱) on any item and the app computes cost, category cost subtotals,
> and a grand-total cost live, and the Excel/CSV export gains **Rate** and **Cost**
> columns. The **Perimeter** tool is now **length-only**.

---

## New capabilities at a glance (How-To-Manual entries)

| Capability | Where | How to use |
|------------|-------|------------|
| **Inline ₱ rate input** | Totals panel — on each item row | Click the **Rate (₱)** field on a totals row, type a unit rate, press **Enter** or click away (blur) to commit. The row **Cost** updates instantly. |
| **Live row cost** | Totals panel — each item row | Read-only. Cost = Rate × Quantity, recomputed the moment a rate changes. A row with no rate shows **₱0.00**. |
| **Per-category cost subtotal** | Totals panel — bottom of each category block | Read-only. The sum of every row cost in that category (a single ₱ number — cost is unit-agnostic, unlike the per-unit quantity subtotals). |
| **Grand-total cost bar** | Totals panel — pinned bottom bar | Read-only. The sum of all category cost subtotals for the whole project. |
| **Rate / Cost in export** | Excel (.xlsx) and CSV export | Export as usual — the sheet now has five columns: **Item · Quantity · UoM · Rate · Cost**, with per-category cost subtotals and a grand-total cost row. |
| **Perimeter = length only** | Canvas + Totals panel | The Perimeter tool now reports **only length** (one BOQ row). It no longer reports enclosed area. The on-canvas outline is unfilled. |

**Rate keying (worth knowing):** a rate is remembered per **item name + measurement type** (e.g. `Outlet` + count, `Skirting` + perimeter), and is **category-independent** — the same name+type in two different categories shares **one** rate. Rates are saved inside the project `.clmc` file, so they persist across save/reload of that project.

---

## Section 1 — Old `.clmc` projects: perimeter back-compat (no data loss)

Projects you saved **before** Phase 15 that contain **perimeter** markups will behave
slightly differently on reload, by design:

- On reload, a perimeter markup **no longer shows a perimeter *area* BOQ row** — only
  the perimeter **length** row remains.
- **There is no data loss.** The perimeter area was **always computed live at render
  time from the polygon geometry — it was never stored** in the `.clmc` file. It only
  ever existed as a runtime row in the totals aggregator. Removing it changes the BOQ
  **output**, not your saved file.
- Your perimeter **geometry is untouched**: the traced points and any curved (arc)
  edges are preserved exactly, and the reported **length stays arc-aware** (a curved
  perimeter edge still measures along the true arc, not the straight chord — no
  Phase 14 regression).
- **No file-format change and no migration step is needed.** The project file version
  is **not** bumped. The new pricing data (rates) is an additive field that defaults to
  empty, and perimeter geometry is unchanged — only how its BOQ row is synthesized
  changed. An old file that has no `rates` key loads cleanly, with **every cost
  defaulting to ₱0.00** until you set rates.

In short: open any pre-Phase-15 project normally. Perimeters keep their shape and
length; the (previously live-only) perimeter-area line is simply gone.

---

## Section 2 — Currency is a hardcoded ₱ constant (Settings picker deferred)

- The currency symbol throughout the app and the export is **₱ (Philippine Peso)**.
  It is a **hardcoded constant in this phase** — **there is no Settings currency picker
  yet** (deferred to a later phase).
- For maintainers, the future picker has a **single, well-defined seam in two places**
  (the renderer/UI and the export writer keep separate copies because they run in
  different processes and cannot share a constant across that boundary):
  - **UI / totals panel:** the renderer-side currency constant —
    `CURRENCY_SYMBOL` in `src/renderer/src/lib/currency.ts`.
  - **Excel/CSV export:** the writer's own local format constant —
    `NUMFMT_PESO = '₱#,##0.00'` in `src/main/boq-writers.ts` (the main process keeps
    its own copy intentionally; it cannot import the renderer constant).
  - A future Settings currency picker updates **both** seams.
- **Related deferral:** a persistent, cross-project **Item Library** (item names and
  default rates remembered across *different* projects) is a **later phase**. This phase
  prices **per project only** — rates live in each project's `.clmc` file and are not
  yet shared between projects.

---

## Section 3 — Manual UAT checklist: priced BOQ + ₱ Excel rendering

Follow these steps to verify the priced BOQ end-to-end. Cross-references the phase
validation contract (`15-VALIDATION.md` → *Manual-Only Verifications*): the inline-field
feel (SC-2), the perimeter unfilled length-only render (SC-4), and the Excel ₱ render
(SC-1).

1. **Open and calibrate.** Launch the app, load a PDF floor plan, and **set scale** on a
   page (draw a line over a known distance, enter the real-world length).

2. **Place a few markups.** Add several **count** and **linear** markups. Give each a
   **name** and assign a **category** (e.g. Electrical, Plumbing).

3. **Set a rate inline and watch it go live.** On a totals row, click the **Rate (₱)**
   field and type a unit rate, then commit with **Enter** or by clicking away. Confirm:
   - the row **Cost** updates immediately (Cost = Rate × Quantity);
   - the **category cost subtotal** and the **grand-total cost bar** both update;
   - typing or clicking in the rate field does **not** flip the PDF page and does **not**
     re-arm the drawing tool (the field must not steal the row's normal click behavior);
   - a row with no rate set reads **₱0.00** (never blank-crashes).

4. **Check the perimeter behavior (SC-4).** Trace a **perimeter** markup. Confirm the
   outline is an **unfilled** closed shape (no translucent fill) and its label shows
   **length only** (e.g. `P: 24.6 m`) — no `A:` area half. In the totals panel it
   produces **one** length row.

5. **Export to Excel (.xlsx) and verify ₱ (SC-1).** Export to **xlsx** and open it in
   Excel. Confirm:
   - the columns read **Item · Quantity · UoM · Rate · Cost**;
   - **Rate** and **Cost** display with the **₱** symbol and **2 decimals**;
   - a `=SUM(...)` over the **Cost** column produces the correct total — this proves the
     cells are **native numbers**, not text (if ₱ were baked into the text, SUM would
     return 0);
   - a per-category **cost subtotal** row and a **grand-total cost** row are present.

6. **Export to CSV and verify the ₱ stays clean.** Export to **csv** and open it in
   Excel. Confirm the **Rate** and **Cost** columns are **plain numbers** (no ₱ glyph in
   the data cells — currency lives in display, not the raw CSV), and that any ₱ that does
   appear in text is **not mojibaked** (the file's UTF-8 byte-order mark keeps it
   rendering correctly on Windows, the same way it already protects `m²`).

---

*Phase: 15-boq-pricing-perimeter-simplification*
*Manual notes written 2026-06-29*
