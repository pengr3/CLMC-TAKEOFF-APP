---
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
plan: "00"
subsystem: state
tags: [zustand, typescript, discriminated-union, undo-redo, selection-model, tdd]

requires:
  - phase: 03-markup-tools-and-editing
    provides: MarkupCommand discriminated union (place/delete/recolor-group/edit-markup) and pushCommand helper; deleteMarkup pattern that delete-group mirrors
  - phase: 01-pdf-viewer-canvas-foundation
    provides: ViewerState interface, viewerStore with page navigation actions
provides:
  - "ViewerState.selectedMarkupIds + setSelectedMarkupIds + clearSelection"
  - "viewerStore clears selectedMarkupIds on setPage/nextPage/prevPage/resetViewer/hydrate/setFile (D-01 page-scoped invariant)"
  - "MarkupCommand 'delete-group' variant carrying Markup[]"
  - "markupStore.deleteGroup(markups) with single-command undo/redo across pages"
affects: [09-01, 09-02, 09-03, 09-04, 09-05, 09-06]

tech-stack:
  added: []
  patterns:
    - "discriminated-union variant placement BEFORE shared property access in undo/redo switch (Pitfall 3 from 09-RESEARCH)"
    - "selection state lives in viewerStore not markupStore (avoids cross-store coupling — D-01)"
    - "delete-group as a single-command group operation (mirror of recolor-group pattern from Phase 03.1)"

key-files:
  created:
    - src/tests/viewer-store-selection.test.ts
    - src/tests/delete-group-command.test.ts
  modified:
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/types/markup.ts
    - src/renderer/src/stores/viewerStore.ts
    - src/renderer/src/stores/markupStore.ts

key-decisions:
  - "selectedMarkupIds initialised to [] in store object literal AND in setFile/resetViewer/hydrate set() payloads — every reset path explicitly clears so no zombie selection survives state transitions"
  - "delete-group variant placed THIRD in MarkupCommand union (after 'delete', before 'recolor-group') so the natural read order matches the undo/redo switch order — 'delete' / 'delete-group' read as a pair"
  - "delete-group branch placed AFTER 'edit-markup' branch and BEFORE the implicit place/delete branch that destructures cmd.markup.page — Pitfall 3 from 09-RESEARCH enforced via explicit code comment in both undo() and redo()"
  - "deleteGroup does NOT call viewerStore.clearSelection() — selection lifecycle is owned by the keyboard handler (Plan 09-02) to keep markupStore free of viewerStore imports"
  - "Empty-array deleteGroup is an early-return no-op with no command pushed (mirrors deleteMarkup's no-target defensive return); avoids polluting undoStack with empty entries"

patterns-established:
  - "Page-scoped UI selection: every store action that changes page or scope clears selectedMarkupIds; consumers can rely on selection being valid for the currently displayed page"
  - "Group operation undo entry: single MarkupCommand variant carrying the full set; undo restores by iterating, redo re-applies via id Set (O(n) over current page lists)"

requirements-completed: []

duration: 6min
completed: 2026-05-18
---

# Phase 09 Plan 00: Wave 0 Prerequisite — Types & Store Foundation Summary

**ViewerState gains page-scoped selectedMarkupIds with auto-clear on page change; MarkupCommand union extended with delete-group variant and markupStore.deleteGroup single-command group delete across pages — both with full undo/redo support.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-18T06:02:22Z
- **Completed:** 2026-05-18T06:08:30Z (approx)
- **Tasks:** 2 (both TDD: RED + GREEN = 4 commits)
- **Files modified:** 4 source + 2 new tests = 6 files

## Accomplishments

- `ViewerState.selectedMarkupIds: string[]` plus `setSelectedMarkupIds` / `clearSelection` actions; clearing wired into **every** state-transition path (setFile, setPage, nextPage, prevPage, resetViewer, hydrate)
- `MarkupCommand` union extended with `{ type: 'delete-group'; markups: Markup[] }` variant
- `markupStore.deleteGroup(markups)` action that filters by id-Set across **all pages**, pushes a single `delete-group` command, and clears the redoStack
- `undo()` and `redo()` switches updated with `delete-group` branches placed **before** `const page = cmd.markup.page` (Pitfall 3 — discriminated-union narrowing safety)
- 14 new tests (8 + 6) — all GREEN; full vitest suite 462 tests / 65 files pass; `npm run typecheck` exits 0

## Task Commits

Each TDD task was committed atomically (test → feat):

1. **Task 1 RED: failing tests for viewerStore selectedMarkupIds** — `e47b6b5` (test)
2. **Task 1 GREEN: viewerStore selectedMarkupIds + actions + clear-on-page-change** — `4ea3541` (feat)
3. **Task 2 RED: failing tests for markupStore deleteGroup** — `9b8b276` (test)
4. **Task 2 GREEN: delete-group variant + deleteGroup action + undo/redo branches** — `a151822` (feat)

## Files Created/Modified

**Created**
- `src/tests/viewer-store-selection.test.ts` — 8 tests covering init, set/clear, and the 5 clear-on-transition paths
- `src/tests/delete-group-command.test.ts` — 6 tests covering single-page delete, single-command-per-call invariant, undo re-insert, redo re-remove, cross-page delete, empty-array no-op

**Modified**
- `src/renderer/src/types/viewer.ts` — added `selectedMarkupIds`, `setSelectedMarkupIds`, `clearSelection` to ViewerState
- `src/renderer/src/types/markup.ts` — added `{ type: 'delete-group'; markups: Markup[] }` to MarkupCommand union
- `src/renderer/src/stores/viewerStore.ts` — initial state, setFile/setPage/nextPage/prevPage/resetViewer/hydrate clears, two new actions
- `src/renderer/src/stores/markupStore.ts` — interface gains deleteGroup signature; action body + undo/redo `delete-group` branches inserted in the canonical position (after edit-markup, before cmd.markup.page destructure)

## Decisions Made

- **Selection lives in viewerStore (D-01 confirmation).** The plan recommended viewerStore (transient UI state) and we took it; no cross-store coupling was introduced. `clearSelection()` after delete will be wired by the keyboard handler in Plan 09-02, not inside markupStore actions.
- **Comment markers around delete-group branches** in both undo() and redo() explicitly call out the placement constraint ("MUST come BEFORE the `cmd.markup.page` access below"). This makes any future regression that moves the branch a single-line visible diff — same defensive-comment discipline the project uses for the Pitfall-3 class of risks.
- **Empty-array deleteGroup is an explicit early return** before the set() body runs (matches the markups.length === 0 guard in plan action snippet). The undoStack-length-unchanged test asserts the absence of pollution.

## Deviations from Plan

None - plan executed exactly as written.

The only operational adjustment was using `npx vitest run` directly rather than `npm run test -- --run` (the plan's documented verify command). This project has no `test` script in `package.json` — only `typecheck`, `lint`, `build`, etc. — so the npm script the plan referenced does not exist. Running vitest via `npx` is the canonical project pattern (no source change, no plan deviation; just a tooling note for the next plan's verifier).

## Issues Encountered

None.

## Self-Check: PASSED

Verified after writing SUMMARY:
- `src/tests/viewer-store-selection.test.ts` exists
- `src/tests/delete-group-command.test.ts` exists
- `src/renderer/src/types/viewer.ts` contains `selectedMarkupIds: string[]` (line 59)
- `src/renderer/src/types/markup.ts` contains `'delete-group'` (line 55)
- `src/renderer/src/stores/markupStore.ts` contains `deleteGroup` (line 31, 135) and `delete-group` branches in both undo() (line 286) and redo() (line 360)
- Commits in git log: `e47b6b5`, `4ea3541`, `9b8b276`, `a151822`
- `npm run typecheck` exits 0; full vitest suite passes (462 tests across 65 files)

## Next Phase Readiness

Wave 1 (Plans 09-01 through 09-06) can begin in parallel with the type and store contracts in place. Specifically:
- Plan 09-01 (selection model & rubber-band) consumes `selectedMarkupIds`, `setSelectedMarkupIds`, `clearSelection`
- Plan 09-02 (Delete-key + Ctrl+A handler) consumes `deleteGroup` and is responsible for calling `clearSelection()` after every delete
- Plans 09-03/04/05/06 (modal drag, ribbon, Enter-commit) are independent of these types but unblocked by the typecheck-clean state this plan establishes

No blockers. No CLAUDE.md violations. Selection model invariant (page-scoped clear on every transition) is enforced at the store level, so Wave 1 consumers cannot accidentally show selection that belongs to a different page.

---
*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Completed: 2026-05-18*
