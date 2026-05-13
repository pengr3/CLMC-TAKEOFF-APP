---
phase: 07-canvas-workspace-ux-and-markup-fixes
plan: "00"
subsystem: test-suite
tags: [tdd, red-stubs, wave-0, markup-commands, totals-panel, markup-namepopup, markup-context-menu]
dependency_graph:
  requires: []
  provides:
    - RED test baseline for EditMarkupCommand (7 tests)
    - RED test baseline for MarkupContextMenu Edit item (2 tests)
    - RED test baseline for MarkupNamePopup mode='edit' and D-13 (5 tests)
    - RED assertion inversions for TotalsPanel grand-total bar (1 test)
    - RED assertion inversions for TotalsCategoryBlock subtotal rows (3 assertions in 2 tests)
  affects:
    - src/tests/markup-commands.test.ts
    - src/tests/markup-context-menu.test.ts
    - src/tests/markup-namepopup.test.ts
    - src/tests/totals-panel-render.test.ts
    - src/tests/totals-panel-category-collapse.test.ts
tech_stack:
  added: []
  patterns:
    - RED/GREEN/REFACTOR TDD — Wave 0 creates failing baseline; subsequent waves turn GREEN
    - React.createElement test harness (no JSX, .ts extension compatible with vitest glob)
    - Zustand store state reset in beforeEach for isolation
key_files:
  created: []
  modified:
    - src/tests/markup-commands.test.ts
    - src/tests/markup-context-menu.test.ts
    - src/tests/markup-namepopup.test.ts
    - src/tests/totals-panel-render.test.ts
    - src/tests/totals-panel-category-collapse.test.ts
decisions:
  - "Added onEdit: vi.fn() directly to baseProps const in markup-context-menu.test.ts so all existing tests receive it without breaking (MarkupContextMenu ignores unknown props at JS runtime)"
  - "Pre-fills test for mode='edit' unexpectedly PASSES (component accepts initialName regardless of mode) — documented as acceptable; the 4 mode-specific label tests correctly fail"
  - "D-13 verbatim pass-through test correctly PASSES immediately (existing behavior); only the canonical-substitution test is RED"
metrics:
  duration: "5m"
  completed: "2026-05-13"
  tasks_completed: 2
  files_modified: 5
---

# Phase 07 Plan 00: RED Test Baseline for Wave 0 Summary

Wave 0 RED test stubs and assertion inversions establishing the TDD baseline for all Phase 7 behavioral changes. Tests fail now because the code doesn't exist yet; they will pass after each implementation wave completes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED stubs for EditMarkupCommand and MarkupContextMenu Edit item | cbe8527 | markup-commands.test.ts, markup-context-menu.test.ts |
| 2 | RED stubs for MarkupNamePopup mode='edit' and assertion inversions for totals panel | 377e76e | markup-namepopup.test.ts, totals-panel-render.test.ts, totals-panel-category-collapse.test.ts |

## RED Test Inventory

### markup-commands.test.ts (7 new RED tests)

**describe: editMarkup/undo symmetry** (5 tests — all fail "editMarkup is not a function")
- editMarkup changes name/categoryId/color and pushes cmd to undoStack
- undo() reverts to oldName/oldCategory/oldColor; redoStack has one entry
- redo() re-applies newName/newCategory/newColor
- editMarkup clears redoStack
- editMarkup on nonexistent markupId is a no-op

**describe: editMarkup canonical category (D-13 store side)** (2 tests — all fail "editMarkup is not a function")
- edit to existing category name reuses the category (no duplicate created)
- edit to new category name creates the category

### markup-context-menu.test.ts (2 new RED tests)

**describe: MarkupContextMenu — Edit menuitem (D-06)**
- renders Edit button as first menuitem before Delete — FAILS (Delete is first, Edit not rendered)
- clicking Edit calls onEdit then onClose — FAILS (Edit button undefined, cannot click)

Added `onEdit: vi.fn()` to `baseProps` const; all 5 existing tests continue to PASS.

### markup-namepopup.test.ts (5 new tests, 4 RED + 1 GREEN)

**describe: MarkupNamePopup — mode='edit' labels (D-06)** (4 tests)
- renders 'Edit markup' aria-label in edit mode — FAILS (mode='edit' not in union type)
- primary button reads 'Save Changes' in edit mode — FAILS
- cancel button reads 'Discard Changes' in edit mode — FAILS
- pre-fills name/categoryName/color from initialName/initialCategoryName/initialColor props — PASSES (component accepts initialName regardless of mode)

**describe: MarkupNamePopup — D-13 canonical substitution** (2 tests, 1 RED + 1 GREEN)
- handleConfirm substitutes canonical name when findCategoryByName returns a match — FAILS (substitution not wired)
- handleConfirm uses typed name verbatim when no case-insensitive match exists — PASSES (existing behavior)

### totals-panel-render.test.ts (1 test flipped RED)

- 'grand-total bar is absent (D-08 cleanup)' — FAILS (bar still renders, toBeNull() vs actual element)

### totals-panel-category-collapse.test.ts (3 assertions flipped RED across 2 tests)

- 'renders heading + items + subtotal expanded by default': expect(subtotal).toBeNull() — FAILS
- 'heading click toggles collapsed state': two toBeNull() assertions (initially expanded, expanded again) — both FAIL

## Overall Verification

```
Tests: 16 failed | 46 passed (62 total)
```

- 16 new RED tests/assertions — all intentional, all caused by missing implementation
- 46 pre-existing tests PASS — zero regressions introduced
- vitest run exits non-zero (expected for Wave 0)

## Deviations from Plan

None — plan executed exactly as written. The one deviation in observable behavior (pre-fills test passing) is acceptable and documented in decisions above.

## Known Stubs

None — this plan only creates test stubs (RED failures), not implementation stubs.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/tests/markup-commands.test.ts: FOUND
- src/tests/markup-context-menu.test.ts: FOUND
- src/tests/markup-namepopup.test.ts: FOUND
- src/tests/totals-panel-render.test.ts: FOUND
- src/tests/totals-panel-category-collapse.test.ts: FOUND
- Commit cbe8527: FOUND
- Commit 377e76e: FOUND
