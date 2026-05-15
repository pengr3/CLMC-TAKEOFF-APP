---
phase: "08-markup-workflow-and-wall-tool"
plan: "02"
subsystem: "persistence/store/schema"
tags: [persistence, store, schema, visibility]
dependency_graph:
  requires: ["08-00"]
  provides: ["hiddenItemNames persistence", "toggleHiddenItem action", "hiddenItemSet derived state"]
  affects: ["project-schema.ts", "project-serialize.ts", "projectStore.ts"]
tech_stack:
  added: []
  patterns: ["Additive optional schema field with Array.isArray default guard", "Zustand setState with derived Set in sync", "markDirty() as final call in non-undo action (Pitfall 4)"]
key_files:
  created: []
  modified:
    - src/renderer/src/lib/project-schema.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/renderer/src/stores/projectStore.ts
decisions:
  - "No formatVersion bump — hiddenItemNames is additive optional field; pre-Phase 8 files load cleanly with [] default"
  - "hiddenItemSet is derived in-memory Set kept in sync with hiddenItemNames via atomic set() calls; NOT persisted in .clmc"
  - "toggleHiddenItem calls get().markDirty() as the last line (Pitfall 4 — attachDirtyTracking does not watch projectStore itself)"
  - "hydrateStores writes both hiddenItemNames and hiddenItemSet inside suspend/resume bracket to prevent dirty flag on load"
  - "Task 2 (projectStore) committed before Task 1 (serialize) due to type dependency — serialize references hiddenItemSet"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-15"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 02: Visibility State Persistence Summary

**One-liner:** Additive `hiddenItemNames?: string[]` field wired through ProjectFileV2 schema, snapshotProject, hydrateStores, and projectStore with derived `hiddenItemSet: Set<string>` and `toggleHiddenItem` action that calls `markDirty()` last.

## What Was Built

### Task 1: Schema additive field + serialize/hydrate wiring

**`project-schema.ts`** — Added optional `hiddenItemNames?: string[]` to `ProjectFileV2` interface after the `pages` array field. No `formatVersion` bump (still 2). `validateV2` cast at line 113 accepts the new field silently (Pitfall 11).

**`project-serialize.ts`** — Two changes:
1. `snapshotProject` return object now includes `hiddenItemNames: useProjectStore.getState().hiddenItemNames` — always emits the array (empty or populated) so re-saves don't drop the field.
2. `hydrateStores` try block (after the three existing hydrate calls, before the finally) now includes an atomic `useProjectStore.setState({ hiddenItemNames, hiddenItemSet })` call with `Array.isArray` guard that defaults to `[]` for pre-Phase 8 files. Runs inside the suspend/resume bracket so `markDirty` stays suppressed.

### Task 2: projectStore extension

**`projectStore.ts`** — Four additions:
1. `ProjectStoreState` interface: added `hiddenItemNames: string[]`, `hiddenItemSet: Set<string>`, `toggleHiddenItem(name)`, `setHiddenItemNames(names)`.
2. Initial state: `hiddenItemNames: []`, `hiddenItemSet: new Set<string>()`.
3. `toggleHiddenItem(name)`: single atomic `set()` updating both fields via index check (idx >= 0 → filter, else append), then `get().markDirty()` as the **last line** (Pitfall 4 — `attachDirtyTracking` watches markupStore/scaleStore/viewerStore but NOT projectStore itself, so the explicit markDirty call closes the dirty-tracking gap).
4. `setHiddenItemNames(names)`: atomic set of both fields, no markDirty (used by hydrateStores during load when dirty tracking is suspended).
5. `reset()`: extended to include `hiddenItemNames: []` and `hiddenItemSet: new Set()` to clear stale visibility state when opening a second project in the same session.

## Test Results

- `src/tests/project-schema-hidden.test.ts` — **3/3 GREEN**
  - `snapshotProject emits hiddenItemNames from projectStore`
  - `hydrateStores accepts hiddenItemNames and writes to projectStore`
  - `hydrateStores defaults to [] when hiddenItemNames absent`
- `npx tsc --noEmit` — exits 0
- `src/tests/project-serialize.test.ts` — **6/6 GREEN** (no regressions)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 2 (store) | `028c0a4` | feat(08-02): add hiddenItemNames + hiddenItemSet + toggleHiddenItem to projectStore |
| Task 1 (schema/serialize) | `5414729` | feat(08-02): wire hiddenItemNames through project schema and serialize/hydrate |

Note: Task 2 committed before Task 1 because `project-serialize.ts` references `hiddenItemSet` from the store interface — the dependency order required the store extension to land first.

## Deviations from Plan

### Rebase deviation (Rule 3 — blocking issue)

**Found during:** Pre-execution setup
**Issue:** The worktree branch `worktree-agent-a024d411bb54b10dd` was created from commit `d27fed3` (before Wave 0 work). The test file `project-schema-hidden.test.ts` and type extensions from Wave 0 were on `master` but not in the worktree, causing `npx vitest run src/tests/project-schema-hidden.test.ts` to report "No test files found" with exit code 1.
**Fix:** Stashed working changes, ran `git rebase master` to bring the worktree branch on top of Wave 0 commits (`664a326`, `dab65bf`, `8d77334`), then applied the stash back. Rebase was clean with no conflicts.
**Files modified:** None — rebase only; all working changes applied cleanly via stash pop.

### Commit order deviation

**Found during:** Pre-commit analysis
**Issue:** Plan suggests Task 1 (schema + serialize) commits before Task 2 (store), but `project-serialize.ts` references `hiddenItemSet` from the `ProjectStoreState` interface. Committing Task 1 first without Task 2 would produce a TypeScript error in the intermediate state.
**Fix:** Committed Task 2 (projectStore) first to establish the type foundation, then committed Task 1 (schema + serialize).

## Known Stubs

None — both fields are fully wired through the persistence path.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The `hiddenItemNames` field in `.clmc` is documented in the plan's threat model (T-08-02-01 through T-08-02-03) — all accepted risks with the `Array.isArray` guard as the single deserializer-level mitigation.

## Self-Check: PASSED

- SUMMARY.md exists at expected path: FOUND
- Commit 028c0a4 (projectStore): FOUND
- Commit 5414729 (schema/serialize): FOUND
- src/tests/project-schema-hidden.test.ts: 3/3 GREEN
- npx tsc --noEmit: exits 0
