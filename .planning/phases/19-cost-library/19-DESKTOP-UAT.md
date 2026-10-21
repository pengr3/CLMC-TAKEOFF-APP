# Phase 19 actual desktop checks — 2026-10-21

User authorization: “drive this on my behalf use my PC now”, followed by “retry please”. Windows Computer Use became available on retry. These observations are agent-operated desktop evidence, not additional user-reported passes. No production source changed.

## Test 9 — PASS

- Starting app: existing development Electron session with unsaved `planA-3p.clmc`, Test Outlet 2 ea, material 200, labor 80, markup 30%, cost 560, unit price 364, total 728, margin 168.
- Used the real Save As dialog to create `out/phase19-desktop-uat/original/Phase19-Pricing-Test.clmc`, preserving the user's original project. Copied only that archive to the initially empty `copied` folder (2,917,375 bytes); no PDF or spreadsheet was copied.
- Closed the test Excel workbook and Electron using their actual windows; subsequent window inventory showed both absent. Restarted `npm run dev` (sandbox launch hit EPERM on resources/icon.png; the same launch with approved access succeeded). New Electron window opened empty, confirming a fresh session.
- Used native Open on the copied archive. Both PDF pages and saved count group loaded without library reimport or a spreadsheet/PDF relink request. Estimate retained all values listed above. Local imported CSV library also remained available.
- Resumed the saved count group in Totals during Test 11 to confirm it remains usable. Temporary edits were restored, then saved to the copied project. Read-only archive comparison with the first Save As confirms both complete markup objects (including IDs, points, page and sequence), rates and default markup unchanged. Embedded `plan.pdf` is byte-identical (2,915,527 bytes). No cross-PC installer claim is made.

## Test 10 — PASS

- Used actual Export BOQ Save dialogs: Excel Workbook to `out/phase19-desktop-uat/Phase19-Pricing-Test-BOQ.xlsx`, then CSV to `out/phase19-desktop-uat/copied/Phase19-Pricing-Test-BOQ.csv`. The copied folder contained only the .clmc at the time of Test 9; this CSV was created afterward.
- Opened both files in real Excel using its Open dialog. The XLSX displayed all ten columns, category, subtotals and grand totals; the row matched 2 ea / 200 / 80 / 560 / 30% / 364 / 728 / 168.
- Selected XLSX D9:J9: Excel status bar reported Count 7, Sum 2,130.00, Average 304.29. The seven numeric values are 200, 80, 560, 30, 364, 728, 168; the existing export displays numeric 30 with its literal percent format. No workbook values were edited.
- CSV opened through Excel's Text Import Wizard. UTF-8 and Comma delimiter produced the same ten columns and numeric row values. Record this opening route in the Phase 21 guide. XLSX remains the formatted option.

## Test 11 — PASS after final user confirmation

Actual checks passed:

- Opened row picker; Tab focused Close; Shift+Tab wrapped to compatible Select; Tab wrapped back to Close. Disabled incompatible Select and Apply were skipped.
- F3 while the dialog was active left the underlying Snap status ON.
- Clicked search and typed E001; only its matching entry remained. Escape dismissed the dialog and visibly focused the row's book button; Space reopened it. Close dismissed the reopened dialog.
- Manually committed material 201: cost 562, unit price 365.30, total 730.60, margin 168.60. Restored material 200: cost 560, total 728, margin 168. Returned to Plan.
- Toolbar Zoom In changed 18% to 19%; both PDF pages remained navigable.
- Resumed Test Outlet from Totals, placed one temporary count pin (2→3), then Ctrl+Z restored 2. Escape exited placement. Saved the restored test project and verified original geometry/rates/PDF against the first Save As.

Only the actual pan gesture remains unverified. The available Computer Use API supports left-button drag and key chords but exposes neither a held Space key across a drag nor a middle-button drag. Plain scrolling does not pan this app (its wheel handler intentionally requires Ctrl for zoom). This is a tool capability limit, not a reproduced application failure. Do not mark the entire test passed or advance Phase 19 until the user verifies Space+drag or middle-button pan.

**Follow-up:** The user replied “pass” to the final Space+drag checkpoint. The paragraph above records the earlier tool limitation; panning is now user-confirmed and Test 11 is complete.

## Preserved state and limits

The original `planA-3p.clmc` was not overwritten. Cost library was not replaced during these checks. The separate copied test project is saved with two original markups, material 200/labor 80/markup 30%, and the same embedded PDF. Excel exports are local test artifacts under ignored `out/`. No deployment, installer test or two-PC pilot occurred. Phase 20 remains unstarted.
