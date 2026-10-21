---
status: testing
phase: 19-cost-library
source: [19-01-SUMMARY.md]
started: 2026-10-21
updated: 2026-10-21
---

## Current Test

number: 1
name: Fresh start and download the Excel template
expected: |
  Save any current work, fully close the app, and relaunch it. If running the development app, stop and restart npm run dev so the new desktop handlers are loaded.
  Switch to Estimate, then choose Cost Library → Download Excel Template. You can do this without opening a PDF.
  Save the template and open it in Excel. It should contain a blank Cost Library worksheet with these six columns, in order:
  Item Code | Description | Category | Unit | Material Unit Rate | Labor Unit Rate.
  An Instructions worksheet should also be present, with no sample prices in the blank library.
  The app should start normally and the template should save and open without errors.
awaiting: user response

## Test Setup

Use a test project and a copy of the template. Keep your original project and any existing master cost spreadsheet. Importing replaces this PC's current library only after explicit confirmation. Existing estimates should keep their saved rates.

This session records human observations only. Automated tests/build/Electron smoke remain passing evidence in 19-VERIFICATION.md; none of these manual checks are auto-passed. The real two-PC deployment pilot remains Phase 21 and is separate from this Phase 19 acceptance walkthrough.

## Tests

### 1. Fresh start and download the Excel template
expected: Save current work, fully close and relaunch the app (restart npm run dev if using development mode). In Estimate, open Cost Library without a PDF and download the Excel template. Excel opens a blank Cost Library worksheet with the six fixed headings and an Instructions worksheet; no startup/download/open error occurs.
result: [pending]

### 2. Fill the template, preview an import, then cancel
expected: In the Cost Library worksheet add E001 | Test Outlet | Electrical | pcs | 100 | 80 and F001 | Test Wall Painting | Finishes | m² | 50 | 20. Save a test .xlsx. Import it: preview shows the correct two items/rates; nothing is replaced until confirmation. Cancel Import returns to the previous library or empty state unchanged.
result: [pending]

### 3. Confirm replacement and retain the library after restart
expected: Import the test .xlsx again and choose Replace Library. The current library shows its filename, import time and two items. Close/relaunch the app and reopen Cost Library: the same items and rates remain available without reopening the master spreadsheet.
result: [pending]

### 4. Apply count rates and preserve selling markup
expected: In a test PDF/project, place two count pins named Test Outlet. In Estimate set that row's markup to 30%, then choose its book button, select E001 and Apply Rates. Material becomes 100, labor 80 and markup remains 30%. Quantity 2 ea gives Cost 360, UNIT PRICE 234, TOTAL 468 and Margin 108. Item name/geometry are unchanged.
result: [pending]

### 5. Search and block incompatible units
expected: Open the Test Outlet row's library picker. Search by E001, Test Outlet and Electrical to find its entry. F001's m² rate cannot be selected/applied to this ea count row; its button explains the required unit. A compatible entry remains selectable. Selecting alone does not apply prices; Apply Rates is explicit.
result: [pending]

### 6. Manual override and revised library do not silently reprice
expected: Manually change Test Outlet's material rate to 125 and commit the edit. Change E001 in a copy of the master spreadsheet to material 200/labor 80, then import and confirm replacement. The existing Estimate still has material 125 and retains its markup. Only explicitly selecting E001 and applying again changes the row to material 200/labor 80; quantity and markup stay unchanged.
result: [pending]

### 7. Invalid imports leave the accepted library intact
expected: Use separate copies of the test spreadsheet to try a negative rate, duplicate item code and altered required heading. Each invalid import shows an actionable error (row/column for data errors), cannot replace the library, and leaves the previously accepted E001/F001 entries available. Correcting the file permits a normal import. Do not edit the only copy of your master.
result: [pending]

### 8. CSV import follows the same template
expected: Export just the valid Cost Library worksheet as UTF-8 comma-separated CSV. Import/preview/confirm shows the same codes, descriptions, categories, units and numeric rates. CSV import requires the same six headings and does not change existing project prices.
result: [pending]

### 9. Saved project retains applied prices independently
expected: Save As a test .clmc after applying rates; close/reopen it and verify material/labor/markup and totals match. Open that project with its master spreadsheet moved or unavailable, or from a folder containing only the .clmc: saved prices still load. No spreadsheet relink is required and markups remain editable. Cross-PC installed-app portability is additionally tested in Phase 20.
result: [pending]

### 10. Export includes the visible applied prices
expected: Export the test estimate to .xlsx and .csv. Open both and compare item quantities, material/labor rates, selling markup and totals with the current Estimate sheet. Values match, numeric Excel cells remain usable for calculations, and the existing export remains available. Internal costs/margins are still included; client-only export was not added.
result: [pending]

### 11. Keyboard, dismissal and normal estimating workflow
expected: Search/type in the library dialog and navigate controls with Tab/Shift+Tab. Keyboard actions stay inside the dialog; F3 does not change underlying plan snapping while the dialog is active. Escape or Close dismisses it and returns focus to the trigger. Reopen it, then return to Plan: normal markups, undo, zoom/pan and manual Estimate rate edits still behave normally.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

None reported yet. Awaiting the user's first result; no manual acceptance claimed.
