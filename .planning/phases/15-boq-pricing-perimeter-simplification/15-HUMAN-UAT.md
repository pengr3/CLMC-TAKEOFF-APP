---
status: partial
phase: 15-boq-pricing-perimeter-simplification
source: [15-VERIFICATION.md]
started: 2026-06-29T11:12:57Z
updated: 2026-06-29T11:12:57Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Inline ₱ rate field — live edit, no row hijack, persistence (SC-1, SC-2)
expected: In the live totals panel, click into a row's ₱ Rate field and type a number (e.g. `150`). The row's **Cost** updates live to `rate × quantity`, the category **cost subtotal** and the **grand-total cost bar** update too — all shown in ₱. Clicking/typing in the field does **not** trigger the row's normal click behaviour (no page navigation, no tool arming). The same item `name|type` appearing in another category/page shows the **same** rate. Save the project, reload the `.clmc`, and the rate is still there. Typing a negative is treated as 0.
result: [pending]

### 2. Perimeter canvas render — unfilled outline, length-only label (SC-4)
expected: Draw a Perimeter markup (or load a project that has one). It renders on the canvas as an **unfilled closed outline** — no shaded area fill — with a **length-only** label of the form `P: 24.6 m`. There is **no** area value (no `A:` reading) anywhere on the markup, and the BOQ/totals panel shows exactly **one** row for it.
result: [pending]

### 3. Priced export — Excel ₱ formatting + SUM-safe Cost, CSV numeric (SC-1, SC-6)
expected: Export the BOQ to **.xlsx** and open it in Excel. Column order is **Item · Quantity · UoM · Rate · Cost**; Rate and Cost cells show `₱#,##0.00` formatting and are **native numbers** (an Excel `SUM()` over the Cost column totals correctly — they are not text). Per-category **cost subtotal** rows and a **grand-total cost** row are present, and the category heading merge spans the full 5 columns. Export to **.csv** and confirm Rate/Cost are plain numeric columns (no `₱` prefix string) and the file opens cleanly (UTF-8 BOM intact).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
