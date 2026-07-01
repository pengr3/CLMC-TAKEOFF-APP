---
status: partial
phase: 16-estimating-workspace
source: [16-VERIFICATION.md, 16-REVIEW.md, 16-VALIDATION.md]
started: 2026-07-01
updated: 2026-07-01
---

# Phase 16 — Estimating Workspace — Human UAT

All 6 automated Success Criteria verified against source (see `16-VERIFICATION.md`); full suite 646/646, typecheck + production build clean. Verification returned **human_needed** for two pre-declared visual/interaction items that automated tests cannot judge (felt responsiveness + real-stack visual behavior). Reply **"approved"** once both pass, or report issues to route to gap closure.

## Current Test

[awaiting human testing]

## Tests

### 1. Estimate-grid live-edit feel — incl. decimal rate entry (SC-2 / SC-3)
expected: Open the `Estimating` tab, switch to **Estimate**. For a takeoff item, type into the **Material**, **Labor**, and **Markup %** cells. Editing feels responsive; the value you type stays put while typing. **Specifically confirm the CR-01 fix:** you can type decimal / leading-zero rates such as `0.5`, `0.75`, `12.30` without the field blanking or resetting mid-keystroke. The row's **Cost**, **Price**, and **Margin** update on commit (blur or Enter), and Markup defaults to **30%** when never set. Cost = material×qty + labor×qty; Price = Cost×(1+markup/100); Margin = Price−Cost.
result: [pending]

### 2. Plan ⟷ Estimate view switch — no flicker, canvas preserved (SC-1)
expected: With a PDF open and markups placed, toggle **Plan | Estimate** in the Estimating tab several times. The switch is instant with **no flicker/flash**; returning to **Plan** shows the PDF + all markups exactly as before (the Konva canvas is **not** remounted — no reload, no lost zoom/pan, no re-render flash). The right-side totals panel shows **quantities only** — no rate field, no cost, no ₱ anywhere.
result: [pending]

## Recommended additional hands-on checks (non-blocking, but worth a pass)

- **Category subtotals + grand total:** Estimate groups rows by category with per-category **Cost / Price / Margin** subtotals and a pinned grand-total bar; numbers foot correctly in ₱.
- **Persistence + legacy back-compat:** Save, reload — material/labor/markup survive. Open a **Phase-15 `.clmc`** (single-rate) — it loads with no error; the old rate appears as **Material** with **Labor 0** and **Markup 30%**.
- **9-column export:** Export **.xlsx** and **.csv**. Columns are Item · Qty · UoM · Material · Labor · Cost · Markup · Price · Margin. In xlsx, money cells are real numbers (SUM works) with ₱ format; Markup shows as a percent. CSV money columns are plain numbers; the file still opens cleanly (UTF-8 BOM).

## Open product decision (not a UAT pass/fail — needs your call)

- **WR-01 (Medium):** the Settings **"Default markup %"** control is currently **inert** — it looks editable but is wired to nothing (the 30% default is hardcoded in the aggregator). Decide: **(a)** wire it project-wide so editing it changes the default for unpriced rows and persists, **(b)** disable it for v1 with a "per-row markup only in v1" hint, or **(c)** accept it as a visible v1 stub. (D-05 always intended full default-markup control to land "later," so any of these is defensible.)

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

(none recorded yet — populate from UAT results)
