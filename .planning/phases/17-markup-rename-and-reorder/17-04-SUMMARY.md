---
phase: 17-markup-rename-and-reorder
plan: 04
subsystem: estimating
tags: [zustand, undo-command-stack, cross-store-atomic-undo, group-ops, move-copy-duplicate, boq]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder
    plan: 01
    provides: "categoryItemOrder Record<catKey, name|type[]> state + reorderItems; catKey = categoryId | '__uncat__'"
  - phase: 17-markup-rename-and-reorder
    plan: 02
    provides: "MarkupCommand move/copy/duplicate variants + their undo/redo branches + applyProjectUndo/Redo cross-store cases; group-ops.autoUniqueName/snapshotGroup/collisionExists; projectStore.addBlankRate/removeRate; the applyProject* cross-store scaffold"
provides:
  - "markupStore.moveGroup(name, targetCategoryName): reassigns categoryId on every markup in a group to the resolved target; leaves the source category's manual order and APPENDS to the target's; name/quantity/color/rate unchanged; ONE Ctrl+Z reverts categoryId + order (single-store)"
  - "markupStore.copyGroup(name, targetCategoryName): INDEPENDENT snapshot (fresh ids, deep-cloned geometry, fresh count sequences) under an auto-unique name in the chosen category, with a fresh blank rate {0,0,DEFAULT_MARKUP_PCT} at a distinct name|type key; ONE Ctrl+Z removes markups + rate (cross-store)"
  - "markupStore.duplicateGroup(name): same as copyGroup but in the SOURCE category, no dialog; distinct auto-name → distinct bucket (never merges into the source)"
  - "shared pure helper buildSnapshotPayload + snapshotForwardReducer (copy/duplicate build identically; differ only in target category + command discriminant); orderCatKey (categoryId | '__uncat__')"
affects: [17-05, group-context-menu, group-category-dialog, move-group-ui, copy-group-ui, duplicate-group-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy/Duplicate share one pure payload builder (buildSnapshotPayload: autoUniqueName + snapshotGroup + fresh blank rate) and one markupStore reducer (snapshotForwardReducer); the two actions differ ONLY in target category + command discriminant"
    - "Forward cross-store apply seeds the projectStore blank rate (addBlankRate) BEFORE set() — mirrors renameGroup's reKey-before-set and getOrCreateCategory-before-set; the forward path never flows through applyProjectRedo, so there is no double-add (redoStack is cleared)"
    - "Move captures orderRemove with the item's ORIGINAL source index (ascending-sorted) so the locked 17-02 undo branch splices the source array back exactly; forward order edit mirrors the redo branch (filter source, append target)"

key-files:
  created:
    - src/tests/move-group-command.test.ts
    - src/tests/copy-duplicate-group.test.ts
  modified:
    - src/renderer/src/stores/markupStore.ts
    - src/tests/group-undo-atomic.test.ts

key-decisions:
  - "Matched the ACTUAL 17-02 command payloads (copy/duplicate carry rateKeys: Array<{key,entry}> + orderAppends: Array; move carries a single oldCategoryId + orderRemove/orderAppend) rather than the RESEARCH Pattern-3 sketch's singular rateKey — the locked undo/redo/applyProject* branches consume the plural arrays"
  - "moveGroup keeps the single oldCategoryId field (locked 17-02 shape): a well-formed single-category group round-trips exactly; a group spanning categories COLLAPSES onto the target on move and undo restores all to the captured id — the exercised path is single-category; extending to per-id would require editing the locked undo branch (out of scope)"
  - "moveGroup does NOT re-key hiddenItemNames — the move-group command has no hiddenReKeys field (only rename-group does). Move preserves name/quantity/color/rate per D-06; visibility is not in scope for this plan and the locked command shape does not carry it"
  - "duplicateGroup collapses a multi-category group onto its first source category (buildSnapshotPayload takes one targetCategoryId) — consistent with moveGroup's single-target collapse and copy's single target"
  - "Copy/duplicate blank rate is seeded via addBlankRate ({material:0,labor:0,markup:DEFAULT_MARKUP_PCT=30}); the command's rateKeys[].entry carries the identical value so applyProjectRedo's setPrice re-seeds byte-identically on redo"

patterns-established:
  - "orderCatKey(categoryId) → categoryId | '__uncat__' (mirrors boq-aggregator's private convention) so move/copy/duplicate order keys line up with the buckets the aggregator ranks"
  - "Atomicity fixtures append into a PRE-ORDERED target category so undo leaves no phantom empty order key (deep-equal snapshot round-trips)"

requirements-completed: [Req-3, Req-4, Req-5]

# Metrics
duration: ~12min
completed: 2026-07-10
---

# Phase 17 Plan 04: Move / Copy / Duplicate Forward Actions Summary

**`moveGroup` reassigns a whole group's category (unchanged name/quantity/color/rate, appending to the target's manual order), while `copyGroup`/`duplicateGroup` build independent, auto-named, blank-rated snapshots that never merge into the source — each reverted by a single Ctrl+Z (move single-store; copy/duplicate cross-store, removing both the new markups and their rate) — completing the store-level command surface for all five Phase-17 group operations.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified/created:** 4 (1 source modified, 2 test files created, 1 test file extended)

## Accomplishments
- **`moveGroup(name, targetCategoryName)`** — resolves the target via `getOrCreateCategory` BEFORE `set()`, reassigns `categoryId` on every markup named `name` across all pages, captures `orderRemove` (with each item's original source index, ascending-sorted) + `orderAppend` (target `name|type` keys), and pushes a `move-group` command. Name, quantity, color and the category-independent `name|type` rate are untouched; one Ctrl+Z restores both `categoryId` and the source/target order via the locked 17-02 undo branch.
- **`copyGroup(name, targetCategoryName)`** and **`duplicateGroup(name)`** — share a pure `buildSnapshotPayload` (auto-unique `"{base} (n)"` name via `autoUniqueName`, `snapshotGroup` deep-clone with fresh ids + fresh per-page count sequences, and a fresh blank rate `{0,0,30}` at a distinct `name|type` key) and a `snapshotForwardReducer` (add snapshots, append order, push the `copy-group`/`duplicate-group` command). Copy resolves the destination category; Duplicate uses the source category with no dialog. Both seed the blank rate in projectStore BEFORE `set()`; one Ctrl+Z removes BOTH the new markups AND their rate (cross-store, via the 17-02 `applyProjectUndo`/copy-group branch).
- **Independence proven** — editing the source geometry (a `moveVertex` on the source) never changes a copy (deep-cloned points); copied count markups get fresh 1..k per-page sequences, never the cloned source sequence (Pitfall 6); the distinct auto-name guarantees a distinct bucket so duplicate never doubles the source quantity.
- **Cross-store atomicity extended** — `group-undo-atomic.test.ts` now proves all four cross-store-touching operations (rename + move + copy + duplicate) revert BOTH stores with a single undo(), each consuming exactly one undo-stack entry; copy also proves redo() re-adds markups + rate.
- Proven by 2 new test files (18 cases) + 5 new atomicity cases; full suite green (769 tests / 99 files); typecheck clean.

## Task Commits

Each task committed atomically:

1. **Task 1: moveGroup forward action** — `de11686` (feat)
2. **Task 2: copyGroup + duplicateGroup forward actions** — `c103e34` (feat)
3. **Task 3: extend cross-store one-Ctrl+Z proof for move/copy/duplicate** — `0109c28` (test)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/stores/markupStore.ts` — (modified) added `orderCatKey` (+ `UNCAT_ORDER_KEY`), the pure `buildSnapshotPayload` + `snapshotForwardReducer` helpers, the `SnapshotPayload` type, and the `moveGroup`/`copyGroup`/`duplicateGroup` forward actions + their interface signatures; imports `autoUniqueName`/`snapshotGroup` from group-ops and `DEFAULT_MARKUP_PCT`. No change to the 17-02 undo/redo branches or `applyProjectUndo/Redo`.
- `src/tests/move-group-command.test.ts` — (created) 8 cases: reassign categoryId all pages, geometry + rate unchanged, target-append + source-removal, one `move-group` command, one-Ctrl+Z restore, redo, resolve-a-new-target-category, no-op on unknown group.
- `src/tests/copy-duplicate-group.test.ts` — (created) 10 cases: auto-name under target, same-geometry/independent-identity snapshot, blank rate + distinct key, target-order append + one command, `moveVertex`-independence, one-Ctrl+Z cross-store removal (copy); same-category no-doubling, fresh count sequences (Pitfall 6), blank rate + source-order append, one-Ctrl+Z revert (duplicate).
- `src/tests/group-undo-atomic.test.ts` — (extended, not rewritten) +5 cases across 3 new describe blocks: move (single-store restore + rates-untouched + one-entry), copy (cross-store deep-equal revert + redo re-add + one-entry), duplicate (no source doubling + both-store revert).

## Decisions Made
- Followed the plan's "be consistent with how 17-02 wrote the copy/dup redo case" directive: the forward actions push the ACTUAL locked payload shapes (`rateKeys`/`orderAppends` plural arrays; move's single `oldCategoryId` + `orderRemove`/`orderAppend`), so the existing undo/redo/`applyProject*` branches consume them without modification.
- Kept the shared payload builder pure (injects `allMarkups`, no store reads) and the projectStore blank-rate seed as a one-line `addBlankRate` loop in each action (before `set()`), matching `renameGroup`'s resolve-before-set discipline; the forward path never runs `applyProjectRedo`, so there is no double-add.
- Move captures `orderRemove` indices from the ORIGINAL source arrays and sorts them ascending so the locked undo branch's in-order splices reconstruct the source order exactly.

## Deviations from Plan
None — the plan executed as written. Two design points were resolved within the plan's explicit guidance (not deviations):
- **Single `oldCategoryId` on move-group** — the plan's Task 1 parenthetical allowed a per-id capture "if a single field is insufficient." The locked 17-02 undo branch reads a single `cmd.oldCategoryId`; the exercised (single-category) path round-trips exactly, and per-id capture would require editing the locked branch (explicitly out of scope — "you add the FORWARD actions"). Kept the single field; documented the multi-category collapse.
- **Move does not re-key `hiddenItemNames`** — the `move-group` command carries no `hiddenReKeys` (only `rename-group` does). Move preserves name/quantity/color/rate per D-06; the locked shape does not carry visibility, so a moved group's composite `name|categoryId` hide key is not migrated. Flagged below for the UI wave.

## Known Behaviors / Next Phase Readiness
- **Not a stub:** the three commands are complete and fully tested; only UI wiring remains (17-05 — GroupContextMenu Move…/Copy…/Duplicate + GroupCategoryDialog). This is a planned wave boundary, mirroring how 17-02 deferred these forward actions.
- **Move + visibility (for the UI wave):** moving a *hidden* group effectively un-hides it because its visibility key `name|categoryId` no longer matches after the categoryId changes (move does not re-key hidden). If the UX requires hide-state to follow a move, that is a future decision requiring a `hiddenReKeys` extension to the `move-group` command (and its undo branch) — out of scope here.
- **Append-into-unordered-category (aggregator-level):** appending a moved/copied key to a category that had NO prior manual order creates a single-key order array; because the aggregator ranks only listed keys (others sort after by placement order), the appended row would surface at the TOP of an otherwise-unordered category rather than the bottom. All acceptance paths use pre-ordered or fresh-empty targets; a UI wave that wants strict "append to bottom" can seed the full placement order on first move/copy. The command shape already supports it.
- No blockers. Full suite (769 tests / 99 files) green; `npm run typecheck` clean (node + web).

## Threat Flags
None. Move/copy/duplicate are in-memory store operations with no new IPC channel, network endpoint, file path, or `eval`. The plan's threat register is satisfied: **T-17-09** (auto-name collision → merged bucket) is mitigated by `autoUniqueName`'s first-free distinct name — proven by the "no source doubling" and "distinct rate key" tests; **T-17-10** (no new surface) holds — the new markups + blank rate ride the existing serialize path.

## Self-Check: PASSED

- All 2 created files (`move-group-command.test.ts`, `copy-duplicate-group.test.ts`) + the extended `group-undo-atomic.test.ts` + SUMMARY.md present on disk.
- All 3 task commits present in history (`de11686`, `c103e34`, `0109c28`).
- `markupStore.ts` contains `moveGroup`/`copyGroup`/`duplicateGroup` (interface + implementation).
- Task verifies green: move-group-command (8), copy-duplicate-group (10), group-undo-atomic (9 incl. +5 move/copy/duplicate); `npm run typecheck` clean (node + web); full suite 769 passed / 99 files.

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
