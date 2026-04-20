---
phase: 03-markup-tools-and-editing
plan: 02
subsystem: ui
tags: [react, typescript, zustand, konva, lucide-react, toolbar, popup, autocomplete]

requires:
  - phase: 03-markup-tools-and-editing
    provides: useMarkupStore with getAllCategories/findCategoryByName/getOrCreateCategory, Markup types, Category type

provides:
  - ActiveTool union extended: 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter'
  - MARKUP_TOOLS const array and isMarkupTool type guard in viewer.ts
  - Four markup tool buttons in Toolbar (Count/Linear/Area/Perimeter) with toggle behavior
  - MarkupNamePopup component with exact MarkupNamePopupProps contract (mode/screenPos/containerSize/onConfirm/onCancel)
  - CategoryAutocomplete component with listbox/create-new behavior using markupStore categories

affects:
  - 03-03-count-markup-tool
  - 03-04-linear-markup-tool
  - 03-04-area-perimeter-markup-tool
  - 03-05-markup-list-panel

tech-stack:
  added: []
  patterns:
    - Toggle pattern for markup tools — re-clicking active tool reverts activeTool to 'select'
    - Popup positioning clamp — Math.min(Math.max(pos, 0), containerSize - POPUP_MIN_WIDTH) copied from ScalePopup
    - CategoryAutocomplete uses onMouseDown + e.preventDefault() to avoid input blur race condition

key-files:
  created:
    - src/renderer/src/components/CategoryAutocomplete.tsx
    - src/renderer/src/components/MarkupNamePopup.tsx
  modified:
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/components/Toolbar.tsx
    - src/tests/viewer-store.test.ts

key-decisions:
  - "isMarkupTool type guard exported from viewer.ts — Plans 03/04 can discriminate activeTool without importing the string literal union"
  - "Re-clicking active markup tool reverts to 'select' — simple toggle prevents orphaned tool state"
  - "MarkupNamePopup emits raw categoryName string (possibly empty) — consumer (Plans 03/04) calls getOrCreateCategory, maps empty to 'Uncategorized'"
  - "CategoryAutocomplete onMouseDown + e.preventDefault() prevents the input onBlur from closing the list before the item selection fires"

patterns-established:
  - "Markup tool toggle: handleMarkupToolClick checks activeTool === tool and reverts to 'select' if re-clicked"
  - "MarkupNamePopup slots into any absolute-positioned container by accepting screenPos + containerSize props"
  - "categoryName emitted as raw string — store consumers decide how to resolve empty string"

requirements-completed:
  - MARK-05
  - MARK-06

duration: 3min
completed: 2026-04-20
---

# Phase 3 Plan 02: Toolbar Markup Tool Buttons and Popup Components Summary

**Four markup tool buttons (Count/Linear/Area/Perimeter using lucide-react icons) in Toolbar, plus MarkupNamePopup and CategoryAutocomplete DOM components ready for Plans 03/04 to consume**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-20T14:20:23Z
- **Completed:** 2026-04-20T14:23:30Z
- **Tasks:** 2
- **Files modified:** 5 (2 new, 3 modified)

## Accomplishments
- Extended `ActiveTool` union in `viewer.ts` to include `'count' | 'linear' | 'area' | 'perimeter'`, plus `MARKUP_TOOLS` const array and `isMarkupTool` type guard
- Added four `IconButton` instances to `Toolbar.tsx` between Set Scale and zoom controls: Count (MapPin), Linear (Minus), Area (Square), Perimeter (Hexagon) — toggling via `handleMarkupToolClick` which reverts to `'select'` on re-click
- Created `CategoryAutocomplete.tsx` with `role="listbox"`, color-swatch per category, and `Create new: {typed}` inline creation option; uses `useMarkupStore` for category data
- Created `MarkupNamePopup.tsx` with exact `MarkupNamePopupProps` contract, ScalePopup-derived clamp algorithm, locked copy strings (`Start Count`/`Save Markup`/`Discard`/`Enter an item name`), and Enter/Escape keyboard handling
- Full test suite: 143 tests green (2 new tests in viewer-store covering all four markup tool values and `isMarkupTool` discrimination)

## Task Commits

1. **Task 1: Extend ActiveTool union and add four markup tool buttons to Toolbar** - `bc03310` (feat)
2. **Task 2: Build CategoryAutocomplete + MarkupNamePopup components** - `ff0e0ae` (feat)

## Files Created/Modified
- `src/renderer/src/types/viewer.ts` — ActiveTool union extended, MARKUP_TOOLS const, isMarkupTool type guard
- `src/renderer/src/components/Toolbar.tsx` — MapPin/Minus/Square/Hexagon icons imported, activeTool/setActiveTool selectors, handleMarkupToolClick toggle helper, four IconButtons added
- `src/tests/viewer-store.test.ts` — 'ActiveTool markup extensions' describe block with 2 tests
- `src/renderer/src/components/CategoryAutocomplete.tsx` — NEW: listbox with color swatches and create-new option
- `src/renderer/src/components/MarkupNamePopup.tsx` — NEW: count-pre/save-after modes, clamp positioning, locked copy, keyboard handling

## Decisions Made
- `isMarkupTool` type guard exported from `viewer.ts` so Plans 03/04 can discriminate `activeTool` without string literal comparisons
- Empty `categoryName` emitted as-is from MarkupNamePopup — Plans 03/04 call `getOrCreateCategory` and resolve empty string to `'Uncategorized'`
- `CategoryAutocomplete` uses `onMouseDown + e.preventDefault()` on each option to prevent the input's `onBlur` handler from firing before item selection registers

## Toolbar Button Ordering

Left to right in the toolbar: Open PDF | Page Navigation | Set Scale | **Count | Linear | Area | Perimeter** | Zoom controls

Icon choices: MapPin (Count), Minus (Linear), Square (Area), Hexagon (Perimeter) — matches UI-SPEC D-11 guidance; no substitutions made.

## MarkupNamePopupProps Final Interface (for Plans 03 and 04)

```typescript
export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after'
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  initialName?: string
  initialCategoryName?: string
  measurementPreview?: string
  onConfirm: (payload: { name: string; categoryName: string }) => void
  onCancel: () => void
}
```

Import path: `@renderer/components/MarkupNamePopup`

## Deviations from Plan

None — plan executed exactly as written. `--reporter=basic` flag was invalid for this vitest version (Rule 3 non-issue: ran without flag, tests passed).

## Issues Encountered
- `--reporter=basic` flag passed in the plan's verify command was not recognized by Vitest v4.1.1 — removed the flag and ran without it; all tests passed.

## Known Stubs
None — both components are fully implemented with real store connections and correct props contracts.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 03/04 can import `MarkupNamePopup` from `@renderer/components/MarkupNamePopup` and `CategoryAutocomplete` from `@renderer/components/CategoryAutocomplete`
- `isMarkupTool` available from `@renderer/types/viewer` for activeTool discrimination in canvas handlers
- Store toggle behavior is live: clicking Count/Linear/Area/Perimeter sets `activeTool`; re-clicking reverts to `'select'`

---
*Phase: 03-markup-tools-and-editing*
*Completed: 2026-04-20*
