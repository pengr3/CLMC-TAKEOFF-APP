---
status: complete
phase: 17-markup-rename-and-reorder
source: [17-VERIFICATION.md]
started: 2026-07-10T02:51:07Z
updated: 2026-07-13T07:41:50Z
---

## Current Test

[testing complete]

## Tests

### 1. Grip-drag reorder feel (both surfaces)
expected: On both the totals panel and the Estimate sheet, hovering a row reveals a grip handle on the leading edge; dragging from the grip lifts the row and shows a thin accent insertion line at the drop position; releasing reorders the rows. The new order persists after save + reload and is identical on both surfaces.
result: pass

### 2. Rename collision message readability
expected: Renaming a group onto an existing same-type name shows a readable inline "A group named '{name}' already exists" message (problem-red), the editor stays open, and no data changes; picking a unique name commits and re-labels the row + migrates its price/color/hidden-state. Blank name cancels.
result: pass

### 3. Exported-file cross-surface order parity
expected: After reordering rows in a category, saving, and exporting, the xlsx and csv list that category's rows in the same manual order shown in the totals panel and the Estimate sheet.
result: pass

### 4. Totals single-click stays instant with double-click rename
expected: On the totals panel, a single click still cycles/arms the row instantly (no perceptible delay), while a double-click on the name opens inline rename. (An automated regression test guards the `e.detail===2` logic; this confirms the perceived feel.)
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
