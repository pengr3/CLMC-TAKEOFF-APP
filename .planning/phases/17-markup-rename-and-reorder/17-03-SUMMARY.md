---
phase: 17-markup-rename-and-reorder
plan: 03
subsystem: ui
tags: [react, zustand, pointer-events, drag-reorder, modal, category-autocomplete, konva-adjacent]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder (17-01)
    provides: "reorderItems(catKey, newOrder) single-store undoable command + categoryItemOrder state that the drag hook dispatches into"
  - phase: 16-estimating-workspace
    provides: "DefaultMarkupChangeModal modal chrome, CategoryAutocomplete, useDraggable, Splitter window-listener drag idiom, MarkupNamePopup arrow-nav guard — the recipes reused verbatim"
provides:
  - "GroupCategoryDialog — shared presentational Move/Copy category picker modal (mode 'move'|'copy', emits onConfirm(categoryName), copy-mode auto-name preview)"
  - "useRowReorder — pointer-events window-listener drag lifecycle hook that computes a drop index from live row midpoints and dispatches ONE reorderItems per drag"
  - "moveKey(order, itemKey, dropIndex) — pure drop-index → reordered-array helper (exported, unit-tested)"
  - "row-reorder-drag.test.ts — render-harness proof of the one-dispatch / grip-only / no-op-skip contract"
affects: [17-06, 17-07, drag-reorder-ui, move-group, copy-group, totals-panel, estimate-sheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared drag lifecycle as a hook: window pointermove/pointerup registered on grip pointerdown, removed atomically on pointerup (Splitter idiom), one guarded store dispatch on up"
    - "Presentational modal primitive: composes DefaultMarkupChangeModal chrome + CategoryAutocomplete + MarkupNamePopup Enter-guard; emits onConfirm(name), imports NO command actions"
    - "jsdom drag test harness: inject fixed row midpoints via a getRowRects param + inject a mock store action via setState (not vi.spyOn — avoids zustand's setState-spread spy leak)"

key-files:
  created:
    - src/renderer/src/components/GroupCategoryDialog.tsx
    - src/renderer/src/hooks/useRowReorder.ts
    - src/tests/row-reorder-drag.test.ts
  modified: []

key-decisions:
  - "GroupCategoryDialog uses its `categories` prop only to canonicalize the typed name on confirm (existing-or-new); the CategoryAutocomplete dropdown still reads the store internally — keeps the dialog presentational + testable while the acceptance 'no useMarkupStore command import' holds"
  - "getRowRects is a caller-supplied param (returns ALL rows in visual order), so the drop-index math lives in the hook and the DOM-rect read lives in the block — makes the hook jsdom-testable with deterministic midpoints"
  - "Auto-scroll uses an rAF loop that only starts when a scrollable ancestor exists, so it is completely inert in jsdom (no scroll parent) and cannot leak (cancelled on pointerup)"
  - "moveKey adjusts the insert index (dropIndex-1 when the item started above the drop point) so a drag back to the origin slot yields an identical array → the no-op guard skips the dispatch"

patterns-established:
  - "useRowReorder: grip-only pointer drag → live-midpoint drop index → ONE undoable reorderItems, window listeners removed atomically (T-17-07)"
  - "Test insight: mock a zustand action via setState({action: vi.fn()}) + restore the real one in beforeEach, because vi.spyOn(getState(), 'action') leaks across tests via setState's object spread"

requirements-completed: [Req-2, Req-3, Req-4]

# Metrics
duration: ~11min
completed: 2026-07-10
---

# Phase 17 Plan 03: Move/Copy Dialog + Row-Reorder Drag Hook Summary

**Two decoupled, command-agnostic UI primitives for Req 2/3/4: `GroupCategoryDialog` (one modal for both Move and Copy, reusing the app's modal + autocomplete recipes with a copy-mode auto-name preview) and `useRowReorder` (the window-listener pointer-drag lifecycle that computes a drop index from live row midpoints and dispatches exactly one undoable `reorderItems`), both ready for Wave 4 to mount on the totals panel and Estimate sheet.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-10T01:20:50Z
- **Completed:** 2026-07-10T01:32:00Z
- **Tasks:** 2
- **Files modified/created:** 3 created (1 component, 1 hook, 1 test)

## Accomplishments
- `GroupCategoryDialog` is one presentational modal with a `mode: 'move' | 'copy'` discriminator, reusing the `DefaultMarkupChangeModal` chrome verbatim (fixed backdrop zIndex 120, draggable 420px dialog, ESC=Cancel / Enter=Confirm, backdrop-mousedown=Cancel) with an auto-focused Category input + `CategoryAutocomplete` for existing-or-new selection. Copy mode shows the `Copy as '{autoName}' into…` preview so the result is never a surprise (D-07). Enter selects a highlighted autocomplete row (guarded via `stopPropagation`), else confirms (D-05). It emits `onConfirm(categoryName)` and imports **no** command actions — the panel wires it in Wave 4.
- `useRowReorder(catKey, orderedKeys)` returns `{ onGripPointerDown, liftedKey, insertionIndex }`. A grip pointerdown (drag ONLY from the grip — `preventDefault` + `stopPropagation`, D-09) registers `pointermove`/`pointerup` on `window`; each move recomputes the drop index from live row midpoints (Pitfall 5) and updates the lift/insertion state; pointerup removes **both** listeners atomically (T-17-07) and dispatches exactly **one** guarded `reorderItems(catKey, newOrder)` — a no-op drag dispatches nothing. rAF auto-scroll near scroll edges is inert when there is no scrollable ancestor.
- Proven by `row-reorder-drag.test.ts` (4 cases): one dispatch on a real reorder with the correct new order; **no** dispatch when pointerdown lands on a non-grip element; **no** dispatch on a drag that returns to the origin index; plus a `moveKey` unit check. Full suite green (746 tests / 97 files); typecheck clean (node + web).

## Task Commits

Each task was committed atomically:

1. **Task 1: GroupCategoryDialog (mode move|copy) modal** - `555b712` (feat)
2. **Task 2: useRowReorder pointer-drag hook + render test** - `c220e3d` (feat)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/components/GroupCategoryDialog.tsx` - (created) shared Move/Copy category picker modal; `mode` discriminator, `DefaultMarkupChangeModal` chrome + `useDraggable`, auto-focused Category input + `CategoryAutocomplete`, `handleCategoryKeyDown` arrow-nav + Enter `stopPropagation` guard, copy-mode `Copy as '{autoName}' into…` preview (autoName at fontWeight 600), verb+noun confirm labels "Move Group"/"Copy Group". Presentational — emits `onConfirm(categoryName)`, no command imports.
- `src/renderer/src/hooks/useRowReorder.ts` - (created) `useRowReorder` hook + exported pure helpers `moveKey` (drop-index → reordered array) and internal `computeDropIndex` / `ordersEqual` / `findScrollParent`. Window-listener drag lifecycle, atomic cleanup, single guarded `reorderItems` dispatch, rAF edge auto-scroll.
- `src/tests/row-reorder-drag.test.ts` - (created) jsdom render harness (rows + grips + injected getRowRects midpoints); asserts one dispatch on real reorder, none on non-grip pointerdown, none on no-op drag; `moveKey` unit.

## Decisions Made
- **`categories` prop drives confirm-time canonicalization only.** `CategoryAutocomplete` reads categories from the store internally (its established anti-infinite-loop design), so the dialog's `categories` prop is used to canonicalize the typed name on confirm (case-insensitive match → stored name, else new). This keeps the dialog presentational and satisfies the acceptance "does NOT import `useMarkupStore` command actions."
- **`getRowRects` is a caller-supplied param.** The hook owns the drop-index math; the block owns the live DOM-rect read. This makes the hook deterministically testable in jsdom (which has no layout) by injecting fixed midpoints.
- **Auto-scroll is opt-in via a found scroll parent.** The rAF loop only starts when `findScrollParent` returns a scrollable ancestor, so it never runs (and never leaks) in the test harness, and is cancelled atomically on pointerup.
- Followed the plan's `<interfaces>` recipes verbatim for both files; no structural divergence from the plan's `<action>` specs.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' source matched the plan's `<action>` specs and passed their `<automated>` verify (Task 1 `npm run typecheck`; Task 2 `npx vitest run src/tests/row-reorder-drag.test.ts && npm run typecheck`) and acceptance greps. No Rule 1-4 deviations triggered.

---

**Total deviations:** 0
**Impact on plan:** None - clean execution.

## Issues Encountered
- **Test authoring: a `vi.spyOn(useMarkupStore.getState(), 'reorderItems')` spy leaked across tests.** The first pass at `row-reorder-drag.test.ts` failed the "non-grip" and "no-op" cases with a phantom `reorderItems(['B|count','A|count','C|count'])` call. Instrumenting `window.addEventListener`/`removeEventListener` proved the hook's listener cleanup is correct (live listeners returned to 0 after every drag — **no** leak in `useRowReorder`). The real cause: zustand's `setState` **spreads the previous state object**, so a spy installed on one test's state (and its recorded call history) is copied forward onto the next test's state object, and `vi.restoreAllMocks()` restored the wrong (superseded) object. **Fix (test-only):** inject a fresh `vi.fn()` as `reorderItems` via `setState` per test and restore the real command in `beforeEach`. This is a reusable insight for future store-dispatch tests (captured in `patterns-established`). No production code changed.

## Known Stubs
None. Both artifacts are intentionally **decoupled, standalone primitives** (per the plan's contract) — `GroupCategoryDialog` emits `onConfirm(categoryName)` and `useRowReorder` dispatches `reorderItems`; neither is mounted anywhere yet. They are wired into the real rows/panels in Wave 4 (17-06/17-07). This is the planned architecture, not placeholder/empty-data stubbing — no hardcoded empty data flows to a rendered surface, and every prop/return is a real seam a caller supplies.

## Threat Flags
None. Both artifacts are renderer-only UI primitives — no new IPC channel, file path, network endpoint, or trust-boundary schema surface. The plan's threat register is satisfied: **T-17-07** (window pointer-listener leak on an interrupted drag) is mitigated — `useRowReorder` removes **both** `pointermove` and `pointerup` listeners atomically in the `pointerup` handler (Splitter T-06-02-02 precedent), with no retain path (rAF auto-scroll is cancelled in the same handler). **T-17-08** (no new IPC/file/network/eval) holds — commands are wired by the panels in a later wave.

## User Setup Required
None - no external service configuration required. Fully offline desktop feature.

## Next Phase Readiness
- **Wave 4 (17-06/17-07) can mount both primitives directly.** `GroupCategoryDialog`: render with `mode`, `groupName`, `autoName` (copy), `categories`, and wire `onConfirm(categoryName)` to `moveGroup`/`copyGroup` + `onCancel` to dismiss. `useRowReorder`: call `useRowReorder(item.categoryId ?? '__uncat__', orderedKeys)` in each category block, pass `onGripPointerDown` down to the grip handle, and render the lifted row (`liftedKey`) + 2px accent insertion line (`insertionIndex`). The block supplies `getRowRects()` reading each row's `getBoundingClientRect()` midpoint in visual order.
- The reorder dispatch contract is exactly 17-01's: `reorderItems(catKey, newOrder)` where `catKey = categoryId | '__uncat__'` and `newOrder` is the reordered `name|type` key list.
- Manual-only visual polish (insertion-line + lifted-row feel during drag) is deferred to phase UAT per the plan's VALIDATION § Manual-Only.
- No blockers. Full suite (746 tests) green; typecheck clean; runs in parallel with 17-02 (disjoint files — no overlap).

## Self-Check: PASSED

- All 3 created files present on disk (`GroupCategoryDialog.tsx`, `useRowReorder.ts`, `row-reorder-drag.test.ts`).
- Both task commits present in history (`555b712`, `c220e3d`).
- Task 1 verify (`npm run typecheck`) exits 0; Task 2 verify (`npx vitest run src/tests/row-reorder-drag.test.ts && npm run typecheck`) exits 0 (4 tests pass).
- Full suite green (746 tests / 97 files). No `.planning/STATE.md` or `.planning/ROADMAP.md` edits.

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
