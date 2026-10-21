---
status: complete
phase: 19-cost-library
source: [19-01-SUMMARY.md]
started: 2026-10-21
updated: 2026-10-21
---

## Current Test

[testing complete]

## Test Setup

Use a test project and a copy of the template. Keep your original project and any existing master cost spreadsheet. Importing replaces this PC's current library only after explicit confirmation. Existing estimates should keep their saved rates.

Tests 1-8 record the user's observations. At the user's explicit request to drive their PC, Tests 9-10 and the completed parts of Test 11 were exercised through Windows Computer Use in the actual desktop app and Excel; these are labeled agent desktop checks, not user-reported passes or headless smoke. See 19-DESKTOP-UAT.md. Automated tests/build/Electron smoke remain separate evidence in 19-VERIFICATION.md. The real two-PC deployment pilot remains Phase 21.

## Tests

### 1. Fresh start and download the Excel template
expected: Save current work, fully close and relaunch the app (restart npm run dev if using development mode). In Estimate, open Cost Library without a PDF and download the Excel template. Excel opens a blank Cost Library worksheet with the six fixed headings and an Instructions worksheet; no startup/download/open error occurs.
result: pass
reported: "i started and tried to download template but nothing happened. no prompt where to save or whatever. the screen just jitters then nothing. Console also logged nothing"
clarification: "Panel stays open, no message"
related_report: "Import CSV / Excel also opens no file-selection dialog."
severity: major
retest_note: "Use the latest rebuilt desktop process. Download/Import now start in Downloads, show explicit cancellation or failure feedback, and log tagged cost-library diagnostics. User must confirm actual Save dialog presentation; automated tests simulate native selections."
retest_result: "okay now i can download and definitely can see the excel worksheet. Now let's go to next manual test"
resolution: "User confirms template download and Excel worksheet open successfully; native Import picker, preview and cancellation subsequently confirmed in Test 2."

### 2. Fill the template, preview an import, then cancel
expected: In the Cost Library worksheet add E001 | Test Outlet | Electrical | pcs | 100 | 80 and F001 | Test Wall Painting | Finishes | m² | 50 | 20. Save a test .xlsx. Import it: preview shows the correct two items/rates; nothing is replaced until confirmation. Cancel Import returns to the previous library or empty state unchanged.
result: pass
reported: "pass"

### 3. Confirm replacement and retain the library after restart
expected: Import the test .xlsx again and choose Replace Library. The current library shows its filename, import time and two items. Close/relaunch the app and reopen Cost Library: the same items and rates remain available without reopening the master spreadsheet.
result: pass
reported: "pass"

### 4. Apply count rates and preserve selling markup
expected: In a test PDF/project, place two count pins named Test Outlet. In Estimate set that row's markup to 30%, then choose its book button, select E001 and Apply Rates. Material becomes 100, labor 80 and markup remains 30%. Quantity 2 ea gives Cost 360, UNIT PRICE 234, TOTAL 468 and Margin 108. Item name/geometry are unchanged.
result: pass
reported: "pass"

### 5. Search and block incompatible units
expected: Open the Test Outlet row's library picker. Search by E001, Test Outlet and Electrical to find its entry. F001's m² rate cannot be selected/applied to this ea count row; its button explains the required unit. A compatible entry remains selectable. Selecting alone does not apply prices; Apply Rates is explicit.
result: pass
reported: "pass"

### 6. Manual override and revised library do not silently reprice
expected: Manually change Test Outlet's material rate to 125 and commit the edit. Change E001 in a copy of the master spreadsheet to material 200/labor 80, then import and confirm replacement. The existing Estimate still has material 125 and retains its markup. Only explicitly selecting E001 and applying again changes the row to material 200/labor 80; quantity and markup stay unchanged.
result: pass
reported: "pass"

### 7. Invalid imports leave the accepted library intact
expected: Use separate copies of the test spreadsheet to try a negative rate, duplicate item code and altered required heading. Each invalid import shows an actionable error (row/column for data errors), cannot replace the library, and leaves the previously accepted E001/F001 entries available. Correcting the file permits a normal import. Do not edit the only copy of your master.
result: pass
reported: "pass"

### 8. CSV import follows the same template
expected: Export just the valid Cost Library worksheet as UTF-8 comma-separated CSV. Import/preview/confirm shows the same codes, descriptions, categories, units and numeric rates. CSV import requires the same six headings and does not change existing project prices.
result: pass
reported: "pass"

### 9. Saved project retains applied prices independently
expected: Save As a test .clmc after applying rates; close/reopen it and verify material/labor/markup and totals match. Open that project with its master spreadsheet moved or unavailable, or from a folder containing only the .clmc: saved prices still load. No spreadsheet relink is required and markups remain editable. Cross-PC installed-app portability is additionally tested in Phase 20.
result: pass
source: agent desktop check authorized by user
observed: "Native Save As saved a separate test project. Copied only its .clmc into a new folder, closed Excel and Electron completely, relaunched npm run dev, and used native Open on the copy without reimport/relink. PDF and qty 2 ea loaded; material 200, labor 80, markup 30, cost 560, total 728, margin 168. Resumed the saved count group and verified editing/undo. After restoring/saving, archive comparison confirmed both original markup objects/coordinates and rates unchanged and the embedded PDF byte-identical."
evidence: 19-DESKTOP-UAT.md

### 10. Export includes the visible applied prices
expected: Export the test estimate to .xlsx and .csv. Open both and compare item quantities, material/labor rates, selling markup and totals with the current Estimate sheet. Values match, numeric Excel cells remain usable for calculations, and the existing export remains available. Internal costs/margins are still included; client-only export was not added.
result: pass
source: agent desktop check authorized by user
observed: "Used native Export BOQ Save dialogs for XLSX and CSV, then opened both in real Excel. Each contains Test Outlet, 2 ea, material 200, labor 80, cost 560, markup 30, unit price 364, total 728, margin 168. Excel selection D9:J9 reports Count 7 and Sum 2130, confirming numeric cells; CSV loaded using Excel's UTF-8 text-import wizard with Comma selected."
evidence: 19-DESKTOP-UAT.md

### 11. Keyboard, dismissal and normal estimating workflow
expected: Search/type in the library dialog and navigate controls with Tab/Shift+Tab. Keyboard actions stay inside the dialog; F3 does not change underlying plan snapping while the dialog is active. Escape or Close dismisses it and returns focus to the trigger. Reopen it, then return to Plan: normal markups, undo, zoom/pan and manual Estimate rate edits still behave normally.
result: pass
source: agent desktop checks authorized by user; final pan gesture confirmed by user
reported: "pass"
observed: "Dialog Tab and Shift+Tab wrap between Close and the compatible Select button; F3 leaves underlying Snap ON; typing E001 filters the library; Escape restores focus to the row book button and Space reopens it; Close dismisses it. Manual rate 201 produces cost 562/total 730.60, restored to 200 and cost 560/total 728. Plan zoom 18→19 works. Resuming Test Outlet, adding a third pin and Ctrl+Z returns quantity 3→2; Escape exits placement. Restored project saved; markup/rates/PDF preservation checked against the original test copy."
resolution: "User confirms the final Space+drag pan check passes; PDF and pins move together. All Test 11 criteria are resolved."
evidence: 19-DESKTOP-UAT.md

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Download Excel Template opens a native Save dialog and saves the workbook."
  status: resolved
  reason: "User reported no Save prompt, brief jitter, no console output; panel stays open with no message."
  severity: major
  test: 1
  root_cause: "Silent cancellation feedback was confirmed in code; added explicit feedback/diagnostics and Downloads defaults. Exact original native-dialog cause was not isolated. User confirms download works on retest."
  resolution: "Download/Excel worksheet confirmed in Test 1; native Import picker, preview and cancellation confirmed by user in Test 2."
  artifacts: [src/renderer/src/components/CostLibraryDialog.tsx, src/main/cost-library-ipc.ts]
  missing: []
  debug_session: .planning/debug/cost-template-save-dialog.md
