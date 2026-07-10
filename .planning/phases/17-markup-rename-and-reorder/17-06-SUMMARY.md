---
phase: 17-markup-rename-and-reorder
plan: 06
subsystem: ui
tags: [react, zustand, pointer-events, drag-reorder, context-menu, inline-rename, modal, totals-panel]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder (17-03)
    provides: "useRowReorder(catKey, orderedKeys) grip-drag lifecycle + GroupCategoryDialog (mode move|copy, onConfirm(categoryName))"
  - phase: 17-markup-rename-and-reorder (17-04)
    provides: "moveGroup / copyGroup / duplicateGroup store commands"
  - phase: 17-markup-rename-and-reorder (17-05)
    provides: "shared TotalsRowContextMenu (onRename/onMove/onCopyTo/onDuplicate/showCopyAsText) + InlineRenameInput + RenameCollisionMessage"
  - phase: 17-markup-rename-and-reorder (17-01/17-02)
    provides: "reorderItems(catKey, newOrder) + renameGroup(old,new):{ok} + autoUniqueName (group-ops)"
provides:
  - "Totals panel fully wires all five group operations: rename (inline + menu), move, copy, duplicate, within-category drag reorder"
  - "TotalsRow grip handle + double-click rename with the load-bearing e.detail===2 single-click guard + inline editor mount"
  - "TotalsCategoryBlock drag-reorder wiring: useRowReorder + live-midpoint getRowRects + 2px accent insertion line + lifted row"
  - "TotalsPanel hosts the shared context menu (4 group actions) + GroupCategoryDialog + rename target state, routing each action to its command"
affects: [17-07, estimate-sheet-wiring, group-ops-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-owned operation state: dialogState + renamingKey local useState in TotalsPanel; the shared menu/dialog components stay presentational and the panel routes onRename/onMove/onCopyTo/onDuplicate to store commands"
    - "Block-owned drag lifecycle: TotalsCategoryBlock derives catKey (categoryId|'__uncat__') + name|type orderedKeys from the aggregator rows and supplies live row midpoints (getRowRects) so useRowReorder's drop-index math matches the aggregator rank sort exactly"
    - "Row keyed by the stable name|type bucket key (not item.label) so a reorder never flickers a neighbor's collision suffix"

key-files:
  created:
    - src/tests/totals-row-group-ops.test.ts
  modified:
    - src/renderer/src/components/TotalsRow.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/TotalsPanel.tsx

key-decisions:
  - "catKey is derived from category.items[0].categoryId ?? '__uncat__' (BoqCategoryGroup carries no id field); this is exactly the aggregator's order-map key so reorderItems writes the key the aggregator reads"
  - "The grabbed/lifted row treatment is applied via a wrapper div around each TotalsRow (activeSurface + opacity 0.9 + shadow + radius), keeping TotalsRow's public API unchanged while the block owns the drag visuals"
  - "The menu 'Rename' and a row double-click both set the SAME renamingKey (name|type), so one inline editor path serves both triggers"
  - "categories for the dialog are read from the existing stable useMarkupStore((s)=>s.categories) selector and converted to an array only at dialog mount — never a fresh selector identity (EMPTY_MARKUPS discipline)"

patterns-established:
  - "Double-click rename guard: handleClick early-returns on e.detail===2 so only the redundant second click is skipped; the first click still fires instantly (perceived-perf preserved) — proven by a two-rapid-clicks regression asserting the cycle/arm spy fires at most once"
  - "Test seam: seed a single count group + render the real TotalsPanel + dispatch a native contextmenu on the row to open the shared menu; inject store command spies via setState and restore the reals in beforeEach (row-reorder-drag.test.ts convention) so no spy leaks forward"

requirements-completed: [Req-1, Req-2, Req-3, Req-4, Req-5]

# Metrics
duration: ~8min
completed: 2026-07-10
---

# Phase 17 Plan 06: Totals-Panel Group-Operations Wiring Summary

**Wired all five group operations into the totals panel — a hover grip drives within-category drag reorder (useRowReorder + insertion line + lifted row), double-click / menu "Rename" opens the inline editor (guarded by e.detail===2 so the instant single-click cycle stays instant), and the shared context menu routes Move/Copy to GroupCategoryDialog and Duplicate straight to duplicateGroup — with a render test proving menu→command routing and the double-click guard.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-10T02:11:10Z
- **Completed:** 2026-07-10T02:19:21Z
- **Tasks:** 3
- **Files modified/created:** 3 modified (2 components + 1 container) + 1 test created

## Accomplishments
- **TotalsRow (D-02/D-09):** imports `GripVertical` + `InlineRenameInput`; new `onGripPointerDown` / `isRenaming` / `onStartRename` / `onEndRename` props; a hover-revealed grip absolutely positioned in the leading 16px gutter (does NOT reflow row content, same `bg !== 'transparent'` gate as the Plus); `handleClick` early-returns on `e.detail === 2` so the redundant second click of a double-click never cycles/arms — the first click still fires instantly; the name cell gains `onDoubleClick` and mounts `InlineRenameInput` in place when renaming (chip / quantity / uom stay put).
- **TotalsCategoryBlock (D-09/D-10/D-11):** wires `useRowReorder(catKey, orderedKeys)` where `catKey = categoryId | '__uncat__'` and `orderedKeys` are the `name|type` bucket keys (both matching the aggregator rank sort + `reorderItems` exactly); a `getRowRects` reads live row midpoints from the body DOM each move (Pitfall 5); a 2px accent insertion line renders at the drop boundary (inset 16px, no pointer events) and the grabbed row gets the `activeSurface` + opacity lifted treatment; rename target threaded down; rows keyed by the stable `name|type` bucket key.
- **TotalsPanel (D-01/D-05/D-07/D-08):** hosts the shared menu with the four group callbacks — `onRename` sets `renamingKey` (same inline editor as double-click), `onMove`/`onCopyTo` open `GroupCategoryDialog` (copy mode computes the `autoUniqueName` preview), `onDuplicate` dispatches `duplicateGroup` immediately with no dialog; the dialog is mounted on `dialogState` and confirm dispatches `moveGroup`/`copyGroup`; `categories` read from the existing stable selector.
- Proven by `totals-row-group-ops.test.ts` (6 cases): Duplicate→`duplicateGroup('Slab')` no dialog; Move opens the dialog (mode=move) + confirm→`moveGroup('Slab','Finishes')`; Copy opens the dialog (mode=copy) with a non-empty `'Slab (2)'` preview + confirm→`copyGroup('Slab','Finishes')`; Rename mounts the inline editor; and the D-02 two-rapid-clicks (detail 1 then detail 2) regression asserting the cycle/arm spies fire AT MOST ONCE.
- `npm run typecheck` clean (node + web); full suite green (**780 tests / 101 files**, +6 from the new file).

## Task Commits

Each task was committed atomically:

1. **Task 1: TotalsRow — grip handle, double-click rename (e.detail guard), inline editor mount** — `3bf011e` (feat)
2. **Task 2: TotalsCategoryBlock — drag reorder wiring + insertion line + lifted row** — `9e160b5` (feat)
3. **Task 3: TotalsPanel — host menu + dialog, route actions to commands (+ test)** — `e8d547b` (feat)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/components/TotalsRow.tsx` - (modified) grip handle in the leading gutter, `e.detail===2` single-click guard, double-click → inline rename, `InlineRenameInput` mount, four new drag/rename props.
- `src/renderer/src/components/TotalsCategoryBlock.tsx` - (modified) `useRowReorder` wiring, `getRowRects` live-midpoint reader, insertion-line + lifted-row rendering, rename-target threading, stable `name|type` row keys.
- `src/renderer/src/components/TotalsPanel.tsx` - (modified) hosts the shared context menu's four group actions + `GroupCategoryDialog` + `dialogState`/`renamingKey` state; routes to `renameGroup`(via editor)/`moveGroup`/`copyGroup`/`duplicateGroup`.
- `src/tests/totals-row-group-ops.test.ts` - (created) jsdom render test: menu→command routing (duplicate/move/copy/rename) over the real panel + the D-02 double-click-guard regression on a bare TotalsRow.

## Decisions Made
- **`catKey` derived from `category.items[0].categoryId ?? '__uncat__'`** — `BoqCategoryGroup` has no `id` field; the aggregator sets each row's `categoryId` and keys the order map by `categoryId | '__uncat__'`, so deriving from the item is the exact key `reorderItems` must write.
- **Lifted-row treatment via a wrapper div** around each `TotalsRow` — keeps `TotalsRow`'s public API free of drag-visual concerns while the block owns the pickup styling.
- **Single `renamingKey` shared by menu-Rename and double-click** — both set `${name}|${type}`, so one inline-editor code path serves both triggers.
- **Dialog `categories` from the stable selector** — `useMarkupStore((s)=>s.categories)` (the record reference), converted to an array only when the dialog mounts, honoring the `EMPTY_MARKUPS` no-fresh-identity rule.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' source matched the plan's `<action>` specs and passed their `<automated>` verify (Task 1/2 `npm run typecheck`; Task 3 `npx vitest run src/tests/totals-row-group-ops.test.ts && npm run typecheck`) and acceptance greps. No Rule 1-4 deviations triggered.

---

**Total deviations:** 0
**Impact on plan:** None - clean execution.

## Issues Encountered
None. The consumed 17-03/17-04/17-05 primitives dropped in against their documented interfaces without adaptation; the render test's `contextmenu`-on-row → shared-menu path and the store-spy-via-setState convention (restoring reals in `beforeEach`) drove every branch deterministically.

## Known Stubs
None. Every wired seam reaches a live command: the grip drives `reorderItems`, the menu drives `renameGroup`/`moveGroup`/`copyGroup`/`duplicateGroup`, and the inline editor + dialog are fully mounted. No hardcoded empty data flows to a rendered surface; no TODO/FIXME/placeholder markers introduced. (The parallel Estimate-sheet wiring is 17-07's scope — disjoint files, not a stub here.)

## Threat Flags
None. Renderer-only UI wiring — no new IPC channel, file path, network endpoint, or `eval`. Matches the plan's threat register: **T-17-13** (renamed/copied name reaching CSV/xlsx export) stays mitigated by the existing `safeText()` guard — this plan adds no new export path; **T-17-14** — the panel hosts presentational menu/dialog + dispatches existing 17-01/02/04 commands only. No new trust boundary.

## User Setup Required
None - fully offline Windows desktop feature, no external configuration.

## Next Phase Readiness
- **17-07 (Estimate-sheet wiring)** is unblocked and disjoint (EstimateRow / EstimateCategoryBlock / EstimatePanel): mirror this plan's seams with `showCopyAsText={false}` and no `e.detail` guard on the Item cell (it has no click handler).
- All five totals-panel operations are invokable (context menu + double-click + grip drag); the single-click cycle stays instant with rename armed.
- Manual-only visual polish (insertion-line + lifted-row feel during drag) is deferred to phase UAT per VALIDATION § Manual-Only.
- No blockers. Full suite (780 tests / 101 files) green; `npm run typecheck` clean (node + web).

## Self-Check: PASSED

- All modified files + the created test present on disk; SUMMARY.md present.
- All three task commits present in history (`3bf011e`, `9e160b5`, `e8d547b`).
- Task verifies green: Task 1/2 `npm run typecheck` exits 0; Task 3 `npx vitest run src/tests/totals-row-group-ops.test.ts && npm run typecheck` exits 0 (6 cases pass, incl. the double-click regression); full suite 780 passed.
- Acceptance greps satisfied: `TotalsRow.tsx` has `e.detail` + `GripVertical` + `InlineRenameInput`; `TotalsCategoryBlock.tsx` has `useRowReorder` + `onGripPointerDown` + `activeSurface` + `insertionIndex`; `TotalsPanel.tsx` imports `GroupCategoryDialog` + calls `moveGroup`/`copyGroup`/`duplicateGroup`.
- No `.planning/STATE.md` or `.planning/ROADMAP.md` edits (orchestrator-owned).

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
