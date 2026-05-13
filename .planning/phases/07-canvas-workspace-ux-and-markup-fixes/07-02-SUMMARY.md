---
phase: 07-canvas-workspace-ux-and-markup-fixes
plan: "02"
subsystem: canvas-ui
tags: [category-autocomplete, markup-namepopup, keyboard-nav, tdd-green, wave-2, d-12, d-13]
dependency_graph:
  requires:
    - "07-01"  # Wave 1 canvas/totals/calibration fixes
  provides:
    - CategoryAutocomplete keyboard navigation with controlled highlightedIndex prop pair
    - MarkupNamePopup mode='edit' variant with correct labels and aria
    - D-13 canonical category name substitution in handleConfirm
    - D-12 keyboard wiring via handleCategoryKeyDown with Landmine 2 stopPropagation guard
    - Wave 0 markup-namepopup.test.ts RED tests turned GREEN
  affects:
    - src/renderer/src/components/CategoryAutocomplete.tsx
    - src/renderer/src/components/MarkupNamePopup.tsx
tech_stack:
  added: []
  patterns:
    - "controlled highlightedIndex prop pair — parent drives keyboard state, child renders highlight + auto-scroll"
    - "scrollIntoView({ block: 'nearest', behavior: 'auto' }) via useEffect watching clampedIndex"
    - "Landmine 2 fix: e.stopPropagation() in handleCategoryKeyDown Enter branch prevents double-fire (autocomplete Enter + popup submit Enter)"
    - "D-13 canonical substitution: findCategoryByName(typed)?.name ?? typed before onConfirm call"
    - "DOM-based option count: document.querySelector('[role=listbox]').querySelectorAll('[role=option]').length for wrap-around arithmetic"
key_files:
  created: []
  modified:
    - src/renderer/src/components/CategoryAutocomplete.tsx
    - src/renderer/src/components/MarkupNamePopup.tsx
decisions:
  - "highlightedIndex controlled via props (not internal state in CategoryAutocomplete) — parent (MarkupNamePopup) owns keyboard state; CategoryAutocomplete is purely presentational for highlight rendering and scroll"
  - "clampedIndex computed inside CategoryAutocomplete — guards against out-of-bounds index from parent; uses optionCount = filtered.length + (showCreateOption ? 1 : 0)"
  - "DOM query for option count in handleCategoryKeyDown — avoids lifting filtered list state to MarkupNamePopup; matches the data-highlighted DOM query pattern for text extraction"
  - "textContent + 'Create new: ' prefix stripping for Enter selection — avoids additional ref or callback prop"
  - "D-13 substitution in handleConfirm dep array — findCategoryByName is a stable store reference; adding to deps is correct and does not cause churn"
metrics:
  duration: "7m"
  completed: "2026-05-13"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 02: CategoryAutocomplete Keyboard Nav + MarkupNamePopup Edit Mode Summary

CategoryAutocomplete gains controlled keyboard highlight state via `highlightedIndex`/`onHighlightChange` props with auto-scroll; MarkupNamePopup gains mode='edit' with correct labels/aria, D-12 keyboard forwarding with Landmine 2 stopPropagation guard, and D-13 canonical category name substitution in handleConfirm — turning all four Wave 0 RED tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add keyboard navigation props to CategoryAutocomplete (D-12) | 6367c79 | CategoryAutocomplete.tsx |
| 2 | Add mode='edit' + D-12 keyboard nav + D-13 canonical substitution to MarkupNamePopup | f93b51b | MarkupNamePopup.tsx |

## Verification Results

- `npx vitest run src/tests/markup-namepopup.test.ts` — exits 0 (14/14 pass; 4 previously-RED tests are GREEN)
- `npx vitest run` — 9 failed / 415 passed (down from 13 failed / 411 passed; 4 improvements; remaining 9 are Wave 0 EditMarkupCommand RED stubs in markup-commands.test.ts and markup-context-menu.test.ts — not yet implemented)
- `npx tsc --noEmit` — exits 0 (no TypeScript errors)

## Must-Haves Verified

- [x] CategoryAutocomplete.tsx CategoryAutocompleteProps includes `highlightedIndex?: number` and `onHighlightChange?: (i: number) => void`
- [x] CategoryAutocomplete.tsx row divs include `data-highlighted` attribute set conditionally on clampedIndex === idx
- [x] CategoryAutocomplete.tsx row divs include `borderLeft` style set to `2px solid COLORS.accent` when highlighted
- [x] CategoryAutocomplete.tsx has a useEffect watching clampedIndex that calls scrollIntoView with `{ block: 'nearest', behavior: 'auto' }`
- [x] CategoryAutocomplete.tsx has a useEffect watching query that calls `onHighlightChange?.(-1)`
- [x] MarkupNamePopup.tsx MarkupNamePopupProps.mode includes 'edit' in the union
- [x] MarkupNamePopup.tsx primaryCta is 'Save Changes' when mode='edit' (three-way ternary)
- [x] MarkupNamePopup.tsx cancelLabel is 'Discard Changes' when mode='edit'
- [x] MarkupNamePopup.tsx aria-label renders 'Edit markup' when mode='edit'
- [x] MarkupNamePopup.tsx handleConfirm body includes `findCategoryByName(typed)?.name ?? typed` canonical substitution
- [x] MarkupNamePopup.tsx handleConfirm useCallback dep array includes `findCategoryByName`
- [x] MarkupNamePopup.tsx category input has `onKeyDown={handleCategoryKeyDown}`
- [x] MarkupNamePopup.tsx CategoryAutocomplete receives `highlightedIndex` and `onHighlightChange` props
- [x] markup-namepopup.test.ts exits 0 — all mode='edit' label tests GREEN, D-13 canonical substitution tests GREEN

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed without any unexpected issues.

## Known Stubs

None — all changes are complete feature implementations with no placeholder values or TODO comments.

## Threat Flags

None — changes are UI component extensions (new props, label ternaries, keyboard event handlers, canonical substitution logic). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- src/renderer/src/components/CategoryAutocomplete.tsx: FOUND (contains `highlightedIndex`, `data-highlighted`, `scrollIntoView`)
- src/renderer/src/components/MarkupNamePopup.tsx: FOUND (contains `mode === 'edit'`, `Save Changes`, `Discard Changes`, `findCategoryByName`, `handleCategoryKeyDown`)
- Commit 6367c79: FOUND (Task 1 — CategoryAutocomplete keyboard nav)
- Commit f93b51b: FOUND (Task 2 — MarkupNamePopup edit mode + D-12 + D-13)
