---
status: passed
phase: 16-estimating-workspace
source: [16-VERIFICATION.md, 16-REVIEW.md, 16-VALIDATION.md]
started: 2026-07-01
updated: 2026-07-01
---

# Phase 16 — Estimating Workspace — Human UAT

All 6 automated Success Criteria verified against source (see `16-VERIFICATION.md`); full suite green, typecheck + production build clean. **Human UAT PASSED — user approved 2026-07-01** after live re-test of the running app.

## Current Test

[complete — all UAT items passed; Phase 16 approved 2026-07-01]

## Tests

### 1. Estimate-grid live-edit feel — incl. decimal rate entry (SC-2 / SC-3)
expected: In the Estimating tab → Estimate, type into Material / Labor / Markup % cells; decimals/leading-zeros (`0.5`, `12.30`) stay put while typing (CR-01 fix); Cost/Price/Margin update on commit; Markup defaults to 30%.
result: **PASS** — user approved (2026-07-01). Live-edit feel + decimal/leading-zero rate entry confirmed; Cost/Price/Margin update on commit; 30% default holds.

### 2. Plan ⟷ Estimate view switch — no flicker, canvas preserved (SC-1)
expected: Toggle Plan | Estimate; no flicker; returning to Plan preserves the PDF + markups (canvas not remounted); totals panel is quantity-only. Plus GAP-1: leaving the Estimating tab (e.g. Home) reveals the Plan canvas automatically.
result: **PASS** — GAP-1 fix (commit 2b4db86) re-tested live by the user (2026-07-01): leaving the Estimating tab now reveals the Plan canvas; no flicker; canvas preserved.

## Gaps (all resolved + re-tested)

### GAP-1 — Leaving the Estimating tab did not reveal the Plan workspace — RESOLVED (2b4db86), re-tested PASS
Reported (Test 2): on the Estimating tab with the Estimate sheet showing, clicking another tab (e.g. Home) switched tabs but kept showing the Estimate grid. Root cause: `activeTab` (local ribbon state) and `viewMode` (viewerStore) were not linked. Fix: `RibbonToolbar` resets `viewMode → 'plan'` when the active tab leaves Estimating. Re-tested live 2026-07-01 → PASS.

### GAP-2 — Export to a locked .xlsx showed a cryptic error in the wrong dialog — RESOLVED (d7200b1), re-tested PASS
Reported (item 3): exporting to an `.xlsx` open in Excel failed with a raw `EPERM … rename … .tmp -> …` shown in the file-OPEN error modal. Fix: main-process `atomicWriteFile` now retries transient locks (short backoff) and, on a persistent lock, throws a friendly "the file is open in another program (e.g. Excel) — close it and export again" message; the renderer shows it in an "Export failed" dialog (parameterized `OpenErrorModal`). Also improves the project-save path.
**Re-test note:** the fix required a full app restart to reload the Electron main process — the renderer had hot-reloaded (new dialog visible) but the main process was stale, so the raw EPERM persisted until restart. After restart, confirmed: file-open-in-Excel shows the friendly message; export to a closed file succeeds. Verified in source + `atomic-write.test.ts` (5/5) + the built `out/main/index.js` bundle. Re-tested live 2026-07-01 → PASS.

## Post-UAT change (user request 2026-07-01) — BOQ export column restructure
Inserted a **UNIT PRICE** column (per-unit client price = `(material+labor)×(1+markup/100)` = TOTAL ÷ qty) between Markup and the client total, and renamed **Price → TOTAL**. New 10-column layout: Item · Quantity · UoM · Material · Labor · Cost · Markup · UNIT PRICE · TOTAL · Margin. Applied to the xlsx + csv export (commit af9a260) AND the on-screen Estimate grid (commit 415ac2d). SUM-safe native numbers, A:J merge, CSV BOM preserved; grid aligned across header/rows/subtotals/grand-total. "Foundation for BOQ export" per the user.

## Open product decision (deferred — non-blocking, tracked)
- **WR-01 (Medium):** the Settings "Default markup %" control is inert (30% hardcoded in the aggregator). Options: (a) wire it project-wide, (b) disable-for-v1 with a hint, (c) accept as a v1 stub. Awaiting the user's choice; does not block Phase 16 completion.

## Deferred features (backseat — future Phase 17, user: "sooner or later")
- Rename already-plotted markups (totals panel + estimate line; must migrate the `{material,labor,markup}` price key; handle name collisions).
- Drag-and-drop reorder within a category (totals panel + estimate sheet; persisted per-category order shared by panel/sheet/export).
See the `deferred-item-rename-reorder` memory.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

note: Both UAT items PASS after live re-test. GAP-1 (view switch) + GAP-2 (export locked-file UX) were found during UAT, fixed, and re-tested PASS. Export restructured to 10 columns (UNIT PRICE + TOTAL) on both the export and the on-screen grid per user request. WR-01 (inert default-markup knob) deferred + non-blocking; rename/reorder deferred to Phase 17. **Phase 16 APPROVED 2026-07-01.**
