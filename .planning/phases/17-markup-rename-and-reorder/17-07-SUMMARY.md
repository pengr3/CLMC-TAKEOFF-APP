---
phase: 17-markup-rename-and-reorder
plan: 07
subsystem: estimating
tags: [react, zustand, pointer-events, drag-reorder, context-menu, inline-rename, modal, estimate-sheet]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder (17-03)
    provides: "useRowReorder(catKey, orderedKeys) grip-drag lifecycle + GroupCategoryDialog (mode move|copy, onConfirm(categoryName))"
  - phase: 17-markup-rename-and-reorder (17-04)
    provides: "moveGroup / copyGroup / duplicateGroup store commands"
  - phase: 17-markup-rename-and-reorder (17-05)
    provides: "shared TotalsRowContextMenu (onRename/onMove/onCopyTo/onDuplicate/showCopyAsText) + InlineRenameInput"
  - phase: 17-markup-rename-and-reorder (17-01/17-02)
    provides: "reorderItems(catKey, newOrder) + renameGroup(old,new):{ok} + autoUniqueName (group-ops)"
  - phase: 17-markup-rename-and-reorder (17-06)
    provides: "the totals-panel wiring shape this plan mirrors onto the Estimate surface"
provides:
  - "Estimate sheet fully wires all five group operations: rename (inline + menu), move, copy, duplicate, within-category drag reorder"
  - "EstimateRow row-level onContextMenu + leading-gutter grip handle + double-click Item-cell rename (clean — no e.detail guard) + inline editor mount"
  - "EstimateCategoryBlock drag-reorder wiring: useRowReorder + live-midpoint getRowRects + 2px accent insertion line + lifted row on the dense 10-col grid"
  - "EstimatePanel hosts the shared context menu (four group actions, NO Copy as text) + GroupCategoryDialog + rename target state, routing each action to its command"
affects: [estimate-sheet-wiring, group-ops-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-owned operation state mirrored onto the Estimate surface: contextMenuState + dialogState + renamingKey local useState in EstimatePanel (which had NO context menu before); the shared menu/dialog components stay presentational and the panel routes onRename/onMove/onCopyTo/onDuplicate to store commands"
    - "Row-level onContextMenu on the grid root fires cleanly past the editable cells' click/mousedown/keydown stopPropagation because none of them stop contextmenu (D-01)"
    - "Item-cell double-click rename needs NO e.detail===2 guard (unlike the totals row) — the Item cell has no click handler, so the double-click never competes with a single-click cycle"

key-files:
  created:
    - src/tests/estimate-row-group-ops.test.ts
  modified:
    - src/renderer/src/components/EstimateRow.tsx
    - src/renderer/src/components/EstimateCategoryBlock.tsx
    - src/renderer/src/components/EstimatePanel.tsx

key-decisions:
  - "The grip is hover-gated by a plain `hover` boolean (onMouseEnter/onMouseLeave) rather than TotalsRow's `bg` background state — the Estimate row has no hover-background of its own, so a boolean is the minimal gate; the grip is absolutely positioned in the leading 16px gutter (position:relative on the grid root) so the dense 10-column grid never reflows"
  - "The menu 'Rename' and a row double-click both set the SAME renamingKey (name|type == priceKey), so one inline-editor path serves both triggers"
  - "TotalsRowContextMenu is rendered with showCopyAsText={false}; onCopy/onCopyError are still required props so they are passed as no-ops (they never fire while Copy-as-text is hidden)"
  - "categories for the dialog are read from the stable useMarkupStore((s)=>s.categories) selector and converted to an array only at dialog mount — the EMPTY_MARKUPS no-fresh-identity discipline"

patterns-established:
  - "When mirroring the totals render test onto EstimatePanel, the dialog's category input must be queried DIALOG-scoped ([data-testid=group-category-dialog] input) — the Estimate surface has the default-markup input and per-row rate inputs before the dialog, so a bare container.querySelector('input') grabs the wrong field (the totals panel has none, so its test could use the unscoped selector)"

requirements-completed: [Req-1, Req-2, Req-3, Req-4, Req-5]

# Metrics
duration: ~9min
completed: 2026-07-10
---

# Phase 17 Plan 07: Estimate-Sheet Group-Operations Wiring Summary

**Wired all five group operations into the Estimate sheet — the mirror of the totals panel (17-06) onto EstimateRow/EstimateCategoryBlock/EstimatePanel: a hover grip drives within-category drag reorder (useRowReorder + insertion line + lifted row on the dense 10-column grid), double-click the Item cell / menu "Rename" opens the inline editor (clean — no e.detail guard, the Item cell has no click handler), and the shared context menu (four group actions, NO "Copy as text") routes Move/Copy to GroupCategoryDialog and Duplicate straight to duplicateGroup — with a 6-case render test proving menu→command routing on the surface that previously had no context menu at all.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-10T02:22:26Z
- **Completed:** 2026-07-10T02:31:12Z
- **Tasks:** 3
- **Files modified/created:** 3 modified (2 components + 1 container) + 1 test created

## Accomplishments
- **EstimateRow (D-01/D-02/D-09):** imports `GripVertical` + `InlineRenameInput`; new `onContextMenu` / `onGripPointerDown` / `isRenaming` / `onStartRename` / `onEndRename` props; a row-level `onContextMenu` on the grid root that `preventDefault()`s and forwards `(item, clientX, clientY)` — it fires cleanly because the editable cells stopPropagation click/mousedown/keydown but NOT contextmenu (D-01); a hover-revealed grip absolutely positioned in the leading 16px gutter (grid root gains `position:relative` so the dense 10-column grid never reflows); the Item cell gains `onDoubleClick` → `onStartRename` and mounts `InlineRenameInput` in place when renaming (the numeric cells stay put), with NO `e.detail===2` guard needed because the Item cell has no click handler.
- **EstimateCategoryBlock (D-09/D-10/D-11):** wires `useRowReorder(catKey, orderedKeys)` where `catKey = category.items[0]?.categoryId | '__uncat__'` and `orderedKeys` are the `name|type` bucket keys (both matching the aggregator rank sort + `reorderItems` exactly); a `getRowRects` reads live row midpoints from a new `estimate-category-body` wrapper div each move (Pitfall 5, scoped past the subtotal row); a 2px accent insertion line renders at the drop boundary (inset 16px, no pointer events) and the grabbed row gets the `activeSurface` + opacity 0.9 lifted treatment; rename target + `onContextMenu` threaded down; rows keyed by the stable `name|type` bucket key.
- **EstimatePanel (D-01/D-05/D-07/D-08):** the panel had NO context menu before — added `contextMenuState` / `dialogState` / `renamingKey` local state (mirroring TotalsPanel), routed each block's `onContextMenu` to the shared `TotalsRowContextMenu` rendered with `showCopyAsText={false}` and the four group callbacks — `onRename` sets `renamingKey` (same inline editor as double-click), `onMove`/`onCopyTo` open `GroupCategoryDialog` (copy mode computes the `autoUniqueName` preview from live markups), `onDuplicate` dispatches `duplicateGroup` immediately with no dialog; the dialog is mounted on `dialogState` and confirm dispatches `moveGroup`/`copyGroup`; `categories` read from the existing stable selector.
- Proven by `estimate-row-group-ops.test.ts` (6 cases): right-click opens the shared menu with EXACTLY `['Rename','Move to…','Copy to…','Duplicate']` and NO "Copy as text"; Duplicate→`duplicateGroup('Slab')` no dialog; Move opens the dialog (mode=move) + confirm→`moveGroup('Slab','Finishes')`; Copy opens the dialog (mode=copy) with the `'Slab (2)'` preview + confirm→`copyGroup('Slab','Finishes')`; Rename mounts the inline editor (`aria-label="Rename Slab"`).
- `npm run typecheck` clean (node + web); `npm run build` clean; full suite green (**786 tests / 102 files**, +6 from the new file).

## Task Commits

Each task was committed atomically:

1. **Task 1: EstimateRow — row-level context menu, grip, Item-cell double-click rename** — `419637c` (feat)
2. **Task 2: EstimateCategoryBlock — drag reorder wiring + insertion line + lifted row** — `5405b92` (feat)
3. **Task 3: EstimatePanel — host menu + dialog, route actions to commands (+ test)** — `ce9ca43` (feat)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/components/EstimateRow.tsx` - (modified) row-level `onContextMenu` on the grid root, `position:relative` + hover-revealed grip in the leading gutter, double-click → inline rename on the Item cell (no e.detail guard), `InlineRenameInput` mount, five new context-menu/grip/rename props.
- `src/renderer/src/components/EstimateCategoryBlock.tsx` - (modified) `useRowReorder` wiring, `getRowRects` live-midpoint reader scoped to a new `estimate-category-body` div, insertion-line + lifted-row rendering, rename-target + onContextMenu threading, stable `name|type` row keys.
- `src/renderer/src/components/EstimatePanel.tsx` - (modified) hosts the shared context menu's four group actions (`showCopyAsText={false}`) + `GroupCategoryDialog` + `dialogState`/`renamingKey` state; routes to `renameGroup`(via editor)/`moveGroup`/`copyGroup`/`duplicateGroup`.
- `src/tests/estimate-row-group-ops.test.ts` - (created) jsdom render test: menu→command routing (menu-shape/no-Copy-as-text, duplicate, move, copy-preview, copy-confirm, rename) over the real EstimatePanel; store command spies injected via setState and restored in beforeEach.

## Decisions Made
- **Grip hover gate is a plain boolean** — the Estimate row has no hover-background state like TotalsRow's `bg`, so `hover` (onMouseEnter/onMouseLeave) is the minimal gate; the grip stays absolutely positioned in the leading gutter (grid root `position:relative`) so the dense grid never reflows.
- **Single `renamingKey` shared by menu-Rename and double-click** — both set `${labelToName(label)}|${type}` (== `priceKey`), so one inline-editor code path serves both triggers.
- **`showCopyAsText={false}` with no-op `onCopy`/`onCopyError`** — those two props stay required on the shared menu (to avoid churning the live totals wiring); the Estimate surface passes no-ops that never fire while the Copy-as-text item is hidden.
- **Dialog `categories` from the stable selector** — `useMarkupStore((s)=>s.categories)` (the record reference), converted to an array only when the dialog mounts, honoring the `EMPTY_MARKUPS` no-fresh-identity rule.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' source matched the plan's `<action>` specs and passed their `<automated>` verify (Task 1/2 `npm run typecheck`; Task 3 `npx vitest run src/tests/estimate-row-group-ops.test.ts && npm run typecheck`) and acceptance greps. No Rule 1-4 deviations triggered — every store write routes through the existing 17-01/02/04 commands.

---

**Total deviations:** 0
**Impact on plan:** None - clean execution.

## Issues Encountered
- **Test authoring (self-corrected before commit): the dialog's category input had to be queried DIALOG-scoped.** The first pass copied the totals test's bare `container.querySelector('input')`, which on the Estimate surface returns the FIRST input in the DOM — the `estimate-default-markup-input` (or a per-row rate input) — not the dialog's category field, so Move/Copy confirm dispatched with an empty category name. Fixed by scoping the query to `[data-testid="group-category-dialog"] input`. The totals panel has no inputs before its dialog, so its test's unscoped selector was fine; this is a harness difference inherent to mirroring onto a surface that also has editable rate cells (captured in `patterns-established`). No source change — the wiring was correct; only the test selector was adjusted, and both confirm cases passed after.

## Known Stubs
None. Every wired seam reaches a live command: the grip drives `reorderItems`, the menu drives `renameGroup`/`moveGroup`/`copyGroup`/`duplicateGroup`, and the inline editor + dialog are fully mounted. The shared aggregator (17-01) guarantees the reordered/renamed Estimate rows match the totals panel and the xlsx/csv export — this plan only adds the Estimate-side drag/menu triggers. No hardcoded empty data flows to a rendered surface; no TODO/FIXME/placeholder markers introduced.

## Threat Flags
None. Renderer-only UI wiring — no new IPC channel, file path, network endpoint, or `eval`. Matches the plan's threat register: **T-17-15** (renamed/copied name reaching CSV/xlsx export) stays mitigated by the existing `safeText()` guard (`boq-writers.ts:124-130`) — this plan adds no new export path; **T-17-16** — the panel hosts a presentational menu/dialog + dispatches existing commands only. No new trust boundary.

## User Setup Required
None - fully offline Windows desktop feature, no external configuration.

## Next Phase Readiness
- **Phase 17 group-operations UX is complete on BOTH estimating surfaces.** All five operations are invokable from the Estimate sheet (row context menu + Item-cell double-click + grip drag), matching the totals panel exactly.
- The Estimate reorder order is identical to the totals panel and the xlsx/csv export (single shared aggregator, 17-01).
- Manual-only visual polish (grip/insertion-line feel on the dense grid; reordered-order parity across surfaces + export) is deferred to phase UAT per VALIDATION § Manual-Only + Req 2 acceptance.
- No blockers. Full suite (786 tests / 102 files) green; `npm run typecheck` clean (node + web); `npm run build` clean.

## Self-Check: PASSED

- All modified files + the created test present on disk; SUMMARY.md present.
- All three task commits present in history (`419637c`, `5405b92`, `ce9ca43`).
- Task verifies green: Task 1/2 `npm run typecheck` exits 0; Task 3 `npx vitest run src/tests/estimate-row-group-ops.test.ts && npm run typecheck` exits 0 (6 cases pass); full suite 786 passed; `npm run build` clean.
- Acceptance greps satisfied: `EstimateRow.tsx` has `onContextMenu` + `GripVertical` + `InlineRenameInput` + Item-cell `onDoubleClick`; `EstimateCategoryBlock.tsx` has `useRowReorder` + `onGripPointerDown` + `activeSurface` + `insertionIndex`; `EstimatePanel.tsx` imports `GroupCategoryDialog` + renders the menu with `showCopyAsText={false}` + calls `moveGroup`/`copyGroup`/`duplicateGroup`.
- No `.planning/STATE.md` or `.planning/ROADMAP.md` edits (orchestrator-owned).

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
