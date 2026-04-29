---
status: partial
phase: 04-project-persistence
source: [04-VERIFICATION.md]
started: 2026-04-29T07:55:00Z
updated: 2026-04-29T07:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Section F — Missing PDF Recovery
expected: Rename or move the PDF that a saved .clmc file points to. Reopen the .clmc. MissingPdfModal appears with "PDF not found" heading and a "Browse for PDF" button. Canvas stays blank, no crash.
result: [pending]

### 2. Section G — Page Count Abort
expected: After the "Browse for PDF" dialog from Section F, pick a PDF with a different page count than the original. PageCountAbortModal appears showing expected vs actual page count, with "Pick again" and "Cancel" buttons.
result: [pending]

### 3. Section H — Hash Mismatch
expected: Replace a linked PDF with different bytes at the exact same file path (same filename, different content). Reopen the .clmc. HashMismatchModal appears with "PDF may have changed" heading and "Open anyway" + "Cancel" buttons.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
