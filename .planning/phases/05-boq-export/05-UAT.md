---
status: partial
phase: 05-boq-export
source: [05-06-PLAN.md]
started: 2026-05-02
updated: 2026-05-02
---

# Phase 5 BOQ Export — User Acceptance Test

**Tested:** 2026-05-02 (in progress)
**Build:** 3fc9860
**Tester:** pengr3

## Setup (do this once before scenarios)

1. Run `npm run dev` to launch the app in dev mode.
2. Click "Open" → choose any multi-page construction PDF (or use the fixture at `src/tests/fixtures/sample-1page.pdf` — but for full coverage use a 2+ page PDF you have lying around).
3. Calibrate page 1 (click "Set Scale", draw a line, type real-world distance). Leave page 2 UNCALIBRATED for scenario 4.
4. Place markups:
   - Page 1: 2-3 count markups named "Outlet" (Electrical category), 1-2 linear markups named "Wire" (Electrical), 1 area markup named "Floor" (Civil category).
   - Page 2: 2 count markups named "Switch" (Electrical), 1 linear markup named "Conduit" (Electrical) — this one will be excluded from export when uncalibrated.
5. Save the project (Ctrl+S → choose a path → name it `phase5-uat.clmc`). This populates `currentFilePath` so the Default Save Path uses the .clmc basename.

## Scenario 1 — XLSX export full flow (EXPRT-01)

**Steps:**
1. Click the **Export** icon in the Toolbar (Download icon, after "Replace Plan PDF").
2. Save dialog opens with `phase5-uat-BOQ.xlsx` pre-filled, "Excel Workbook (.xlsx)" filter selected by default.
3. Confirm the save (use the proposed filename). The dialog closes.
4. A success toast appears at the bottom: `Exported: phase5-uat-BOQ.xlsx`.
5. Open the saved .xlsx in Microsoft Excel.

**Expected (all must pass):**
- [ ] Sheet name is `BOQ`.
- [ ] Rows 1-5 contain `Project: phase5-uat`, `Plan: {original-pdf-name}.pdf`, `Exported: 2026-MM-DD`, `Pages: N`, `Markups: M`.
- [ ] Row 6 is blank.
- [ ] Row 7 is bold: `Item | Quantity | UoM`.
- [ ] Row 7 stays visible when scrolling (frozen pane test).
- [ ] Bold category heading rows: `Electrical` (merged across A:C), then later `Civil` — no fill color on these rows.
- [ ] Under Electrical, rows for `Outlet`, `Wire` (and possibly `Switch`, `Conduit` from page 2 if calibrated). Item-cell fill color matches the canvas marker color.
- [ ] Quantity cells are RIGHT-aligned (Excel default for numbers — proves they're not strings).
- [ ] Type `=SUM(B8:B30)` in any empty cell. Result is a non-zero NUMBER (not #VALUE!).
- [ ] Subtotal rows: `Subtotal` in column A, total in column B, UoM in column C; light-gray fill (`#EFEFEF`) + bold.
- [ ] One Subtotal row per UoM in each category (e.g., Electrical has one for `ea` and one for the linear unit).
- [ ] Grand Total row(s) at the bottom, slightly darker gray fill (`#CCCCCC`) + bold.
- [ ] Column widths look readable — Item ~36 chars, Quantity ~12, UoM ~8.

**Outcome:** PASS / FAIL / GAP — _________
**Notes:** _____________________________________

## Scenario 2 — CSV export structural mirror (EXPRT-02)

**Steps:**
1. Click Export again.
2. In the Save dialog, switch the filter dropdown to "CSV (.csv)".
3. Confirm — observe the filename auto-changes to `phase5-uat-BOQ.csv`.
4. Save. Toast: `Exported: phase5-uat-BOQ.csv`.
5. Open the .csv in Microsoft Excel.

**Expected:**
- [ ] Same row structure as the .xlsx (metadata block → blank → title → categories → items → subtotals → grand totals).
- [ ] Quantity column imports as numbers (not text). `=SUM(B:B)` returns a non-zero number.
- [ ] Counts are integers (no `.00`); lengths/areas show 2 decimal places.
- [ ] Open the same .csv in Notepad — line endings are `\r\n` (no spurious blank lines), no UTF-8 BOM at the start (file should not start with `ï»¿`).

**Outcome:** PASS / FAIL / GAP — _________
**Notes:** _____________________________________

## Scenario 3 — Cross-tool CSV fidelity (Sheets / Numbers — EXPRT-02 stretch)

**Steps:**
1. Open the same .csv in Google Sheets (drag-drop into a new sheet) and/or macOS Numbers if available.

**Expected:**
- [ ] Rows align identically to Excel.
- [ ] Quantity columns import as numbers in each tool.
- [ ] Apostrophe-prefixed labels (none expected in this fixture, but if any item name happens to start with `=`, `+`, `-`, `@`, the leading apostrophe is invisible; the cell renders as text).

**Outcome:** PASS / FAIL / GAP / SKIPPED — _________ (skip if no Sheets/Numbers access)
**Notes:** _____________________________________

## Scenario 4 — D-06 uncalibrated-pages warning

**Steps:**
1. Confirm page 2 is UNCALIBRATED and has the linear markup `Conduit` from setup.
2. Click Export.

**Expected (BEFORE save dialog opens):**
- [ ] Modal appears with title "Pages without scale".
- [ ] Body text reads: "Page 2 have markups but no scale set..." (singular/plural may vary; "Page 2" matches.)
- [ ] Continue button is focused (visible focus ring or tab order starts there).
- [ ] Press Escape → modal closes; no save dialog opens; no toast.
- [ ] Click Export again → modal reappears.
- [ ] Click Cancel → modal closes; no save dialog; no toast.
- [ ] Click Export a third time → modal reappears.
- [ ] Click Continue → modal closes; save dialog opens.
- [ ] Confirm save → toast appears.
- [ ] Open the .xlsx — `Conduit` row is NOT in the BOQ (length excluded). `Switch` (count) IS in the BOQ (counts have no scale dependency).

**Outcome:** PASS / FAIL / GAP — _________
**Notes:** _____________________________________

## Scenario 5 — D-18 keyboard shortcut + isTextInputActive guard

**Steps:**
1. Click anywhere on the canvas (no input focused).
2. Press **Ctrl+Shift+E**.

**Expected:**
- [ ] Save dialog opens.
- [ ] Cancel the dialog.
- [ ] Click on the canvas to start placing a count markup → MarkupNamePopup appears with text input focused.
- [ ] Type the letter sequence "Test E" — the letter `E` types into the input normally.
- [ ] While typing, press **Ctrl+Shift+E**.

**Expected:**
- [ ] Save dialog does NOT open. The Ctrl+Shift+E is suppressed by `isTextInputActive`.

**Outcome:** PASS / FAIL / GAP — _________
**Notes:** _____________________________________

## Scenario 6 — D-21 error surface (file-lock)

**Steps:**
1. Open `phase5-uat-BOQ.xlsx` in Microsoft Excel and KEEP IT OPEN.
2. Back in the takeoff app, click Export.
3. Save dialog opens — choose the SAME filename `phase5-uat-BOQ.xlsx`. (Excel will hold a lock on it.)
4. Click Save (overwrite confirmation may appear; accept it).

**Expected:**
- [ ] App does NOT crash.
- [ ] An error modal appears with text starting "Export failed:" followed by the OS error reason (e.g., `EBUSY: resource busy or locked, rename ...` on Windows, or similar).
- [ ] Click Close on the modal — modal dismisses; toast does NOT appear.
- [ ] Close Excel (releasing the lock).
- [ ] Click Export → save → confirm overwrite.
- [ ] Toast appears: `Exported: phase5-uat-BOQ.xlsx`.

**Outcome:** PASS / FAIL / GAP — _________
**Notes:** _____________________________________

---

## Summary

| Scenario | Outcome |
|----------|---------|
| 1. XLSX full flow | _____ |
| 2. CSV structural mirror | _____ |
| 3. Cross-tool CSV fidelity | _____ |
| 4. D-06 uncalibrated warning | _____ |
| 5. D-18 keyboard + guard | _____ |
| 6. D-21 error surface | _____ |

**Phase 5 verdict:** PASS / GAP / FAIL — _________

If any scenario is GAP or FAIL, the phase is NOT closed. The next plan (e.g., `05-07-PLAN.md` gap-closure) addresses each failing case before REQUIREMENTS / ROADMAP / STATE are updated.
