---
phase: 17-markup-rename-and-reorder
plan: 02
subsystem: estimating
tags: [zustand, undo-command-stack, cross-store-atomic-undo, boq-rekey, react, group-ops]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder
    plan: 01
    provides: "categoryItemOrder Record<catKey,name|type[]> state + reorder-items command precedent; MarkupCommand-union + undo/redo-branch-before-fallthrough discipline; AggregateOptions.categoryItemOrder"
  - phase: 16-estimating-workspace
    provides: "projectStore.rates (name|type PriceEntry) + hiddenItemNames (composite name|categoryId) + setPrice/toggleHiddenItem mutate-then-markDirty templates; DEFAULT_MARKUP_PCT seam"
provides:
  - "renameGroup(oldName,newName): {ok} — one undoable cross-store command; flips .name on every markup (all pages) and atomically re-keys rates (name|type), hiddenItemNames (composite name|categoryId, per category), categoryItemOrder (name|type)"
  - "collision BLOCK (D-04): same-type group outside the rename set → {ok:false} with ZERO store writes (no merge)"
  - "cross-store atomic undo scaffold: undo()/redo() refactored to action bodies calling applyProjectUndo/applyProjectRedo BEFORE the markupStore set() — one Ctrl+Z reverts markupStore + projectStore together (React 19 batches)"
  - "lib/group-ops.ts pure helpers: autoUniqueName (first-free, base-strip), collisionExists (type-scoped/category-independent/group-exclusive), snapshotGroup (deep-clone, fresh ids + count sequences)"
  - "projectStore.reKeyRate / reKeyHidden / addBlankRate / removeRate (each markDirty)"
  - "MarkupCommand union + undo/redo branches for rename-group / move-group / copy-group / duplicate-group (move/copy/dup FORWARD actions deferred to 17-04)"
affects: [17-03, 17-04, inline-rename-ui, move-group, copy-group, duplicate-group]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-store atomic undo (Shared Pattern B): markupStore.undo()/redo() apply the projectStore side (reKeyRate/reKeyHidden/removeRate/setPrice) synchronously via applyProjectUndo/applyProjectRedo(cmd) immediately BEFORE the markupStore set(); one command = one Ctrl+Z reverts both stores"
    - "Deliberate deferred-only module cycle: markupStore imports useProjectStore and projectStore imports useMarkupStore — safe because every cross-store call lives in an action/closure resolved via getState() at call time, never at module init"
    - "Whole-group cross-store command: forward action resolves the projectStore re-keys BEFORE set() (like getOrCreateCategory), carries a self-describing payload (rateReKeys/hiddenReKeys/orderReKeys) for exact undo"
    - "Store-free pure helper module injected with allMarkups (group-ops.ts) — Node-testable in isolation, no store import"

key-files:
  created:
    - src/renderer/src/lib/group-ops.ts
    - src/tests/group-ops-autoname.test.ts
    - src/tests/rename-group-command.test.ts
    - src/tests/rename-group-collision.test.ts
    - src/tests/group-undo-atomic.test.ts
  modified:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/stores/projectStore.ts
    - src/renderer/src/stores/markupStore.ts

key-decisions:
  - "Rename re-keys hiddenItemNames by the COMPOSITE name|categoryId (Pitfall 1), per DISTINCT category the group touches (Pitfall 3) — NOT the SPEC's bare-name shorthand"
  - "Collision (D-04) is type-scoped, category-INDEPENDENT, group-exclusive (A1): block iff a markup outside the rename set has name===newName && type in the source group's types; ZERO writes when blocked"
  - "Cross-store atomicity via Option C (payload-on-command + markupStore orchestrates), NOT a projectStore snapshot or callback registry — matches recolor-group/delete-group discipline"
  - "Union variants + their markup-side undo/redo branches committed together (Task 1) so the exhaustive cmd.markup.page narrowing compiles — keeps every commit's typecheck green"
  - "renameGroup short-circuits {ok:true} on a same-name (trimmed===oldName) rename — no spurious undo entry"

patterns-established:
  - "applyProjectUndo/applyProjectRedo(cmd): the cross-store hook 17-04 reuses for copy/duplicate blank-rate add/remove"
  - "Three-structure name re-key: rates (name|type), hiddenItemNames (composite name|categoryId), categoryItemOrder (name|type) — two distinct key shapes, captured on the command for undo"

requirements-completed: [Req-1]

# Metrics
duration: ~20min
completed: 2026-07-10
---

# Phase 17 Plan 02: Rename Group + Cross-Store Atomic Undo Summary

**`renameGroup` relabels every markup in a group across all pages and atomically re-keys all three name-keyed structures (rates `name|type`, hidden `name|categoryId`, order `name|type`), blocks a same-type collision with zero store writes, and is reverted by ONE Ctrl+Z across markupStore + projectStore — establishing the `applyProjectUndo/Redo` cross-store scaffold the copy/duplicate commands (17-04) reuse.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10T00:46:00Z (approx, session start after Wave 1)
- **Completed:** 2026-07-10T01:06:00Z
- **Tasks:** 3
- **Files modified/created:** 8 (3 source modified, 5 test files created)

## Accomplishments
- **`renameGroup(oldName, newName)`** flips `.name` on every markup named `oldName` across all pages and atomically re-keys `rates` (`old|type`→`new|type` per type present), `hiddenItemNames` (the COMPOSITE `old|categoryId`→`new|categoryId` per category the group spans — Pitfall 1/3), and `categoryItemOrder` (`old|type`→`new|type`). Per-name color follows automatically.
- **Collision BLOCK (D-04):** a same-type group named `newName` outside the rename set returns `{ ok: false }` with **zero store writes** (proven by asserting names/rates/hidden unchanged AND `isDirty` still false). A same-name under a *different* type is allowed; blank/whitespace rejected.
- **Cross-store atomic undo (the phase's highest-risk logic):** `undo()`/`redo()` were refactored from `set((s)=>…)` reducers to action bodies that call `applyProjectUndo(cmd)`/`applyProjectRedo(cmd)` — which drive `reKeyRate`/`reKeyHidden` (rename) and `removeRate`/`setPrice` (copy/dup) — synchronously **before** the markupStore `set()`. One Ctrl+Z reverts both stores. Every pre-existing undo/redo branch is preserved byte-identical inside the `set()`.
- **`lib/group-ops.ts`** (store-free, Node-testable): `autoUniqueName` (first-free `{base} (n)` with trailing-`(n)` base-strip, A3), `collisionExists` (type-scoped/category-independent/group-exclusive, A1), `snapshotGroup` (fresh `crypto.randomUUID()` ids, deep-cloned `point`/`points`/`arcs`, fresh per-page count sequences — Pitfall 6).
- **`projectStore`** exposes `reKeyRate`, `reKeyHidden`, `addBlankRate`, `removeRate` (each `markDirty`).
- **`MarkupCommand` union** gained `rename-group` / `move-group` / `copy-group` / `duplicate-group`, all with undo/redo branches + `applyProject*` cases so the union stays compile-exhaustive; only the move/copy/duplicate **forward** actions are deferred to 17-04.
- Proven by 4 new test files (37 new cases); full suite green (742 tests / 96 files); typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: group-ops helpers + projectStore re-key/rate actions + 4 union variants (+ their markup-side undo/redo branches)** — `3e99056` (feat)
2. **Task 2: undo()/redo() cross-store refactor + renameGroup forward action** — `06590c5` (feat)
3. **Task 3: cross-store one-Ctrl+Z atomicity proof** — `9e40975` (test)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/lib/group-ops.ts` — (created) `autoUniqueName`, `collisionExists`, `snapshotGroup`; no store imports (injects `allMarkups`).
- `src/renderer/src/types/markup.ts` — `import type { PriceEntry }`; four new `MarkupCommand` variants (`rename-group` carries `rateReKeys`/`hiddenReKeys`/`orderReKeys`; `copy`/`duplicate` carry `newMarkups`/`rateKeys`/`orderAppends`; `move` carries category + order remove/append).
- `src/renderer/src/stores/projectStore.ts` — `reKeyRate` / `reKeyHidden` (composite key, Set rebuild) / `addBlankRate` / `removeRate` actions + interface signatures.
- `src/renderer/src/stores/markupStore.ts` — `applyProjectUndo`/`applyProjectRedo` module helpers; `undo()`/`redo()` refactored to action bodies calling them before `set()`; undo/redo `set()` branches for all four new commands (before the `cmd.markup.page` fallthrough); `renameGroup` forward action; deferred-only `useProjectStore` import (module cycle).
- `src/tests/group-ops-autoname.test.ts` — (created) autoUniqueName first-free/base-strip/type-scoped + collisionExists true/false + snapshotGroup id/sequence/deep-clone (15 cases).
- `src/tests/rename-group-command.test.ts` — (created) name flip + 3-key re-key + one-undo revert + redo, incl. multi-type (count+area) and multi-category groups + partial side-tables + trim (18 cases).
- `src/tests/rename-group-collision.test.ts` — (created) block + zero-writes (isDirty sentinel) + category-independence + different-type-allowed + blank-rejected + no-such-group (5 cases).
- `src/tests/group-undo-atomic.test.ts` — (created) deep-equal both-store revert on one undo(); exactly-one-stack-entry atomicity; redo re-apply; undo→redo→undo stability (4 cases).

## Decisions Made
- Followed RESEARCH Pattern 3 (Option C) verbatim: cross-store payload on the command + markupStore orchestrates; the projectStore re-key is resolved BEFORE `set()` (mirrors `getOrCreateCategory`).
- Used the **top-level static** `useProjectStore` import (the plan's primary path), not the lazy fallback — verified safe: typecheck clean AND the rename/atomic tests exercise the cross-store call at runtime with no ESM init-order error.
- `renameGroup` short-circuits `{ ok: true }` on a same-name rename (`trimmed === oldName`) to avoid pushing a no-op command from the future inline-rename UI (Enter with no change).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Union variants and their markup-side undo/redo branches committed together in Task 1 (not split Task 1 types / Task 2 branches)**
- **Found during:** Task 1 (`npm run typecheck` gate)
- **Issue:** Adding the four `MarkupCommand` variants to `types/markup.ts` alone makes the `cmd.markup.page` fallthrough in `markupStore.ts` (undo :668 / redo :826) non-exhaustive — the new variants lack a `markup` field — so `npm run typecheck` FAILS. Task 1's verify requires typecheck to exit 0 while its acceptance also requires the four variant strings to be present in `types/markup.ts`. Both cannot hold without the branches.
- **Fix:** Added the four undo/redo markup-side branches (the plan's Task 2 action step 3) to `markupStore.ts` in the **Task 1 commit**, alongside the union variants, so every commit is green. The plan's own interfaces NOTE already scopes these branches to 17-02 ("this plan … writes their undo/redo branches"); only the commit boundary shifted one task earlier.
- **Files modified:** `src/renderer/src/stores/markupStore.ts` (Task 1 commit `3e99056`)
- **Verification:** `npm run typecheck` exits 0 at the Task 1 boundary; full suite green.
- **Committed in:** `3e99056` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Same-name trivial no-op guard in renameGroup**
- **Found during:** Task 2 (renameGroup forward action)
- **Issue:** `renameGroup('A', 'A')` (or the inline-rename UI committing Enter with no change) would push a rename-group command whose re-keys are all identity — a spurious, confusing undo-stack entry.
- **Fix:** `if (trimmed === oldName) return { ok: true }` before any computation/write.
- **Files modified:** `src/renderer/src/stores/markupStore.ts` (Task 2 commit `06590c5`)
- **Verification:** Covered implicitly by the command tests (all use distinct names, still green); the guard is a pure short-circuit.
- **Committed in:** `06590c5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical)
**Impact on plan:** No scope creep — end-state is byte-identical to the plan's intended output. Deviation 1 only re-allocates already-in-plan branch code one commit earlier to preserve the "each commit typechecks" invariant; deviation 2 is a defensive correctness guard.

## Issues Encountered
- **Circular import risk (anticipated by the plan):** `markupStore` now imports `useProjectStore` while `projectStore` imports `useMarkupStore` (attachDirtyTracking). Verified safe with the top-level static import — both cross-store references are inside deferred action closures resolved via `getState()` at call time, so neither module dereferences the other during init. The documented lazy fallback was NOT needed (typecheck + runtime tests both clean).

## Known Stubs
None. The move/copy/duplicate **forward** actions (`moveGroup`/`copyGroup`/`duplicateGroup`) are intentionally NOT present — the plan defers them to 17-04 — but this is a planned wave boundary, not a stub: their undo/redo branches and `applyProjectUndo/Redo` cross-store cases are fully implemented and type-exhaustive, so 17-04 only adds the forward push. No placeholder/empty-data/TODO markers were introduced.

## Threat Flags
None. Rename is an in-memory store operation with no new IPC channel, network endpoint, file path, or `eval` (matches the plan's threat register — T-17-04/05/06 all "accept"). Re-keys use exact string-key assignment; the only regex (`autoUniqueName` trailing-`(n)` base-strip) is anchored and linear (no ReDoS). The renamed name still flows through the existing `safeText()` CSV guard unchanged.

## User Setup Required
None — fully offline desktop feature, no external service configuration.

## Next Phase Readiness
- **17-03 (inline rename UI)** can call `useMarkupStore.getState().renameGroup(oldName, newName)` and branch on `{ ok }`: `false` → keep the editor open and show the collision message; `true` → close. Blank/whitespace and same-name are handled inside the action.
- **17-04 (move/copy/duplicate)** inherits: the four command payload shapes + their undo/redo branches (already exhaustive), the `applyProjectUndo/applyProjectRedo` cross-store hook (extend the copy/dup cases' forward push), `group-ops.snapshotGroup`/`autoUniqueName`, and `projectStore.addBlankRate`/`removeRate`. Only the three forward actions remain.
- No blockers. Full suite (742 tests / 96 files) green; `npm run typecheck` clean (node + web).

## Self-Check: PASSED

- All 5 created files present on disk + SUMMARY.md present.
- All 3 task commits present in history (`3e99056`, `06590c5`, `9e40975`).
- Task verifies green: group-ops (15), rename-command (18 across 2 files), group-undo-atomic (4); `npm run typecheck` clean; full suite 742 passed.

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
