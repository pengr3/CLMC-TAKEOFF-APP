---
status: passed
phase: 15-boq-pricing-perimeter-simplification
source: [15-VERIFICATION.md]
started: 2026-06-29T11:12:57Z
updated: 2026-07-09T00:00:00Z
approved: 2026-07-09
---

## Current Test

[complete — all 3 items approved by user 2026-07-09]

## Tests

### 1. Inline ₱ rate field — live edit, no row hijack, persistence (SC-1, SC-2)
expected: In the live totals panel, click into a row's ₱ Rate field and type a number (e.g. `150`). The row's **Cost** updates live to `rate × quantity`, the category **cost subtotal** and the **grand-total cost bar** update too — all shown in ₱. Clicking/typing in the field does **not** trigger the row's normal click behaviour (no page navigation, no tool arming). The same item `name|type` appearing in another category/page shows the **same** rate. Save the project, reload the `.clmc`, and the rate is still there. Typing a negative is treated as 0.
result: **PASS** — approved by user 2026-07-09. The single ₱ Rate field was superseded in Phase 16 by the Material/Labor/Markup price model; that successor (live cost recompute + `.clmc` persistence, negative→0 guard) was itself human-UAT-approved 2026-07-01. Closed on that basis.

### 2. Perimeter canvas render — unfilled outline, length-only label (SC-4)
expected: Draw a Perimeter markup (or load a project that has one). It renders on the canvas as an **unfilled closed outline** — no shaded area fill — with a **length-only** label of the form `P: 24.6 m`. There is **no** area value (no `A:` reading) anywhere on the markup, and the BOQ/totals panel shows exactly **one** row for it.
result: **PASS** — approved by user 2026-07-09. Perimeter renders as an unfilled closed outline with a length-only `P: <len>` label, no area reading, one BOQ row. Verified in source (`15-VERIFICATION.md`) and confirmed live by the user.

### 3. Priced export — Excel ₱ formatting + SUM-safe Cost, CSV numeric (SC-1, SC-6)
expected: Export the BOQ to **.xlsx** and open it in Excel. Column order is **Item · Quantity · UoM · Rate · Cost**; Rate and Cost cells show `₱#,##0.00` formatting and are **native numbers** (an Excel `SUM()` over the Cost column totals correctly — they are not text). Per-category **cost subtotal** rows and a **grand-total cost** row are present, and the category heading merge spans the full 5 columns. Export to **.csv** and confirm Rate/Cost are plain numeric columns (no `₱` prefix string) and the file opens cleanly (UTF-8 BOM intact).
result: **PASS** — approved by user 2026-07-09. The 5-column `Item · Quantity · UoM · Rate · Cost` layout was superseded in Phase 16 by the 10-column export (adds Material · Labor · Markup · UNIT PRICE · TOTAL · Margin); that successor — native SUM-safe money cells, ₱ number format, CSV numeric + BOM — was itself human-UAT-approved 2026-07-01. Closed on that basis.

## Note

Items 1 and 3 describe Phase 15's original single-Rate pricing and 5-column export, both **superseded** by Phase 16's Estimating Workspace (Material/Labor/Markup model + 10-column export), which passed its own human UAT on 2026-07-01. They are closed as PASS on that supersession basis rather than re-tested against the retired Phase 15 UI. Item 2 (perimeter simplification) was not changed by Phase 16 and was confirmed on its own merits.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.
