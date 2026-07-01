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

[view-switch gap GAP-1 closed in code — user re-test of the live app pending]

## Tests

### 1. Estimate-grid live-edit feel — incl. decimal rate entry (SC-2 / SC-3)
expected: Open the `Estimating` tab, switch to **Estimate**. For a takeoff item, type into the **Material**, **Labor**, and **Markup %** cells. Editing feels responsive; the value you type stays put while typing. **Specifically confirm the CR-01 fix:** you can type decimal / leading-zero rates such as `0.5`, `0.75`, `12.30` without the field blanking or resetting mid-keystroke. The row's **Cost**, **Price**, and **Margin** update on commit (blur or Enter), and Markup defaults to **30%** when never set. Cost = material×qty + labor×qty; Price = Cost×(1+markup/100); Margin = Price−Cost.
result: **PASS** — user approved (2026-07-01). Live-edit feel + decimal/leading-zero rate entry confirmed; Cost/Price/Margin update on commit; 30% default holds.

### 2. Plan ⟷ Estimate view switch — no flicker, canvas preserved (SC-1)
expected: With a PDF open and markups placed, toggle **Plan | Estimate** in the Estimating tab several times. The switch is instant with **no flicker/flash**; returning to **Plan** shows the PDF + all markups exactly as before (the Konva canvas is **not** remounted — no reload, no lost zoom/pan, no re-render flash). The right-side totals panel shows **quantities only** — no rate field, no cost, no ₱ anywhere.
result: **ISSUE → RESOLVED (GAP-1, commit 2b4db86).** User reported: leaving the Estimating tab while the **Estimate** sheet was showing (e.g. clicking **Home**) changed the tab but did **not** reveal the Plan workspace — the center area stayed on the Estimate grid, forcing a manual return to Estimating + toggle back to Plan. Root cause: `activeTab` is local ribbon state while `viewMode` lives in `viewerStore`, with nothing tying them together. Fixed in `RibbonToolbar` (a `useEffect` that resets `viewMode` to `'plan'` when the active tab leaves Estimating while in the Estimate view). The in-tab Plan|Estimate toggle + mount-preserving/no-flicker behavior are unchanged. **Needs a user re-test of the live app** to confirm the reveal-on-leave behavior end-to-end.

## Recommended additional hands-on checks (non-blocking, but worth a pass)

- **Category subtotals + grand total:** Estimate groups rows by category with per-category **Cost / Price / Margin** subtotals and a pinned grand-total bar; numbers foot correctly in ₱.
- **Persistence + legacy back-compat:** Save, reload — material/labor/markup survive. Open a **Phase-15 `.clmc`** (single-rate) — it loads with no error; the old rate appears as **Material** with **Labor 0** and **Markup 30%**.
- **9-column export:** Export **.xlsx** and **.csv**. Columns are Item · Qty · UoM · Material · Labor · Cost · Markup · Price · Margin. In xlsx, money cells are real numbers (SUM works) with ₱ format; Markup shows as a percent. CSV money columns are plain numbers; the file still opens cleanly (UTF-8 BOM).

## Open product decision (not a UAT pass/fail — needs your call)

- **WR-01 (Medium):** the Settings **"Default markup %"** control is currently **inert** — it looks editable but is wired to nothing (the 30% default is hardcoded in the aggregator). Decide: **(a)** wire it project-wide so editing it changes the default for unpriced rows and persists, **(b)** disable it for v1 with a "per-row markup only in v1" hint, or **(c)** accept it as a visible v1 stub. (D-05 always intended full default-markup control to land "later," so any of these is defensible.)

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

note: Test 1 PASS (user approved). Test 2 raised a view-switch gap (GAP-1) now
RESOLVED in code (commit 2b4db86) — counted as an issue pending a user re-test of
the live app. A separate export locked-file gap (GAP-2) was found + fixed in code
(commit d7200b1); it needs a user re-test of a real export with the target file
CLOSED. Phase stays `status: partial` until both live re-tests confirm.

## Gaps

### GAP-1 — Leaving the Estimating tab did not reveal the Plan workspace — RESOLVED (commit 2b4db86)
- **Reported (Test 2):** On the Estimating tab with the Estimate sheet showing
  (`viewMode==='estimate'`), clicking another ribbon tab (e.g. Home) switched the
  tab but the center area kept showing the Estimate grid — the Plan canvas was not
  revealed. The user had to return to Estimating and toggle back to Plan manually.
- **Root cause:** `activeTab` is local `useState` in `RibbonToolbar`;
  `viewMode`/`setViewMode` live in `viewerStore`. Nothing reset `viewMode` when the
  active tab changed. The Estimate view is conceptually part of the Estimating tab
  only.
- **Fix:** `RibbonToolbar` `useEffect` watching `activeTab` — when it changes to any
  tab OTHER than Estimating while `viewMode==='estimate'`, it calls
  `setViewMode('plan')`, revealing the Plan workspace. Returning to Estimating does
  NOT auto-restore Estimate (user reopens via the toggle); the in-tab Plan|Estimate
  toggle behavior is unchanged. Covered by
  `src/tests/ribbon-leave-estimating-reveals-plan.test.ts` (real component + real
  store).
- **Re-test (user, live app):** With a PDF open, go to Estimating → Estimate, then
  click Home (or any other tab). The Plan canvas + markups should appear
  immediately. Returning to Estimating should land on Plan (not the sheet).

### GAP-2 — Export to a locked .xlsx showed a cryptic error in the wrong dialog — RESOLVED in code (commit d7200b1), user re-test required
- **Reported:** Exporting a BOQ to an `.xlsx` that is currently **open in Excel**
  failed with a raw `EPERM: operation not permitted, rename '<path>.xlsx.tmp' ->
  '<path>.xlsx'`, shown inside the **file-open** error modal ("Failed to open
  file… The file may be corrupted or inaccessible") — misleading for an export.
- **Root cause:** (a) `atomicWriteFile` (main) writes `.tmp` then renames; on a
  destination held open by another process BOTH the rename and the unlink fail with
  EPERM, so it rethrew the raw error. Overwriting a file another process holds open
  is an OS constraint — the fix is a clear message + transient-lock resilience, not
  forcing the impossible overwrite. (b) The renderer surfaced export errors through
  `OpenErrorModal` (open-file copy), not an export-appropriate dialog.
- **Fix:** (main) bounded rename retry with short backoff (up to 3 attempts,
  120ms/250ms) to absorb transient OneDrive/Dropbox/AV locks; on a persistent
  locked destination, throw a friendly, actionable Error that names the file and
  says it looks open in another program (e.g. Excel) — "Close it and export again"
  (raw code appended for diagnostics); the `.tmp` is always cleaned up and the
  normal unlocked path is unchanged. (renderer) `OpenErrorModal` parameterized with
  optional `title`/`body` (defaulting to the open-file copy so existing open-error
  callers are unchanged); the export error path now shows **"Export failed" / "The
  BOQ couldn't be exported."** with the friendly reason as the detail line. Covered
  by `src/tests/atomic-write.test.ts`, `src/tests/boq-export-ipc.test.ts`, and
  `src/tests/open-error-modal-copy.test.ts`.
- **Re-test (user, live app):** (1) Export a BOQ to `foo.xlsx`, leave it OPEN in
  Excel, export again to the same path → expect the friendly "file is open in
  another program (for example Excel)" message in an **Export failed** dialog (not
  "Failed to open file"). (2) **Close** the file in Excel and export again → expect
  it to succeed. Because overwriting a genuinely open file is impossible at the OS
  level, the success path requires the file to be CLOSED.
