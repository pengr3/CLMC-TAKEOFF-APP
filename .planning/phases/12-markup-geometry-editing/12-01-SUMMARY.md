---
phase: 12
plan: 1
subsystem: markup-geometry-editing
tags: [wave-1, green, store-actions, command-pattern, undo-redo, vitest]
requires:
  - move-vertex-command-contract
  - move-markups-command-contract
  - vertex-edit-mode-state-contract
provides:
  - markup-command-move-vertex-union-member
  - markup-command-move-markups-union-member
  - markupStore-moveVertex-action
  - markupStore-moveMarkups-action
  - viewerStore-vertexEditMarkupId-state-machine
affects:
  - src/renderer/src/types/markup.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/types/viewer.ts
  - src/renderer/src/stores/viewerStore.ts
tech_stack_added: []
patterns:
  - additive-discriminated-union-extension
  - defensive-no-op-guard-on-store-actions
  - symmetric-undo-redo-branches-before-fallthrough
  - dual-mutation-shape-via-markup-discriminant
  - page-scoped-lifecycle-mirroring-selectedMarkupIds
key_files_created: []
key_files_modified:
  - src/renderer/src/types/markup.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/types/viewer.ts
  - src/renderer/src/stores/viewerStore.ts
decisions:
  - "moveVertex defensively bails when the target markup discriminates as 'count' rather than relying solely on caller discipline; rule 2 (auto-add critical correctness guard) — the contract documented in the JSDoc says 'caller is responsible for not calling on a count pin', but a TypeScript narrowing failure or accidental call should not corrupt store state. The bail is identical to the unknown-id no-op (return s) so no command is pushed."
  - "Undo/redo branches for both new commands inserted BEFORE the delete-group branch (and well before the cmd.markup.page fallthrough). The plan explicitly mandated this placement to avoid the 'cmd carries no .markup field' crash that delete-group already protects against."
  - "Wave 0 test contract uses a uniform { oldPoints, newPoints } shape for both count pins and points-array markups (normalised as length-1 arrays for count). The store action discriminates on markup.type at write time, not on the command shape. This keeps the MarkupCommand union narrow (no optional point-vs-points branching at the type level) and the undo reducer simple — same branch handles every markup type."
metrics:
  duration_minutes: 9
  task_count: 3
  file_count: 4
  test_count_targeted: 18
  test_count_passing_after: 511
  red_to_green_delta: 17
completed: 2026-05-21
---

# Phase 12 Plan 1: Wave 1 — Foundation: Types + Store Actions + viewerStore Extension Summary

`MarkupCommand` extended with `move-vertex` and `move-markups` union members; `markupStore` gained two new actions (`moveVertex`, `moveMarkups`) with symmetric undo/redo branches; `viewerStore` gained `vertexEditMarkupId` state with page-scoped auto-clear lifecycle — all three Wave 0 RED test files (18 tests) now GREEN, full project suite holds at 511/511 with zero regressions on the existing 493 tests.

## What Was Built

**T1 — `src/renderer/src/types/markup.ts`** (+23 lines, additive):
- Appended two new union members to `MarkupCommand` after `edit-markup`:
  - `{ type: 'move-vertex'; markupId; page; vertexIndex; oldPoint; newPoint }` for single-vertex moves of points-array markups
  - `{ type: 'move-markups'; moves: Array<{ markupId; page; oldPoints; newPoints }> }` for single-markup translate and group-move alike (moves.length === 1 vs N). Count pin moves use `oldPoints: [markup.point]` / `newPoints: [newPoint]`.
- No `formatVersion` bump (per STATE.md "additive schema fields" decision; commands are in-memory only).

**T2 — `src/renderer/src/stores/markupStore.ts`** (+180 lines, additive):
- Added `StagePoint` import from `useCalibrationMode`.
- Added `moveVertex(markupId, page, vertexIndex, newPoint)` and `moveMarkups(moves[])` signatures to `MarkupStoreState` with full JSDoc.
- Implemented `moveVertex`: enters `set((s) => …)`, finds the target on `pageMarkups[page]`, defensive no-op for unknown id or count discriminant, replaces `points[vertexIndex]` via slice/spread, pushes `{ type: 'move-vertex', … }`, clears `redoStack`. Mirrors the `editMarkup` action shape.
- Implemented `moveMarkups`: no-op on empty moves array, iterates moves and writes `point` for count discriminant or `points` otherwise, pushes a single `{ type: 'move-markups', moves: […] }` command, clears `redoStack`. Multi-page safe (each move carries its own page).
- Added symmetric undo branches in `undo()` reducer for both new command types, inserted BEFORE the `delete-group` branch (the existing comment "MUST come BEFORE the `cmd.markup.page` access below" applies to these too — neither command carries a `cmd.markup` field).
- Added matching redo branches in `redo()` reducer with `pushCommand`/`redoStack.slice(0, -1)`.

**T3 — `src/renderer/src/types/viewer.ts` + `src/renderer/src/stores/viewerStore.ts`** (+25 / -6 lines, additive):
- Extended `ViewerState` with `vertexEditMarkupId: string | null`, `setVertexEditMarkupId(id)`, `clearVertexEdit()` — JSDoc documents page-scoped lifecycle (mirrors `selectedMarkupIds`).
- Initial value `vertexEditMarkupId: null` in store creator.
- Added `vertexEditMarkupId: null` to every lifecycle/page-navigation reset: `setFile`, `setPage`, `nextPage`, `prevPage`, `resetViewer`, `hydrate`.
- Added `setVertexEditMarkupId(id) => set({ vertexEditMarkupId: id })` and `clearVertexEdit() => set({ vertexEditMarkupId: null })` action implementations next to `setSelectedMarkupIds`/`clearSelection`.

## Commits

| Commit | Task | Files | Summary |
|--------|------|-------|---------|
| `670203f` | T1 — MarkupCommand union extension | `src/renderer/src/types/markup.ts` | Additive `move-vertex` + `move-markups` variants |
| `9288db9` | T2 — moveVertex + moveMarkups actions | `src/renderer/src/stores/markupStore.ts` | Interface signatures, implementations, undo/redo branches |
| `2dfa568` | T3 — vertexEditMarkupId viewerStore state | `src/renderer/src/types/viewer.ts`, `src/renderer/src/stores/viewerStore.ts` | New field + actions + 6-site lifecycle clear |

## Test Outcomes (GREEN Verification)

**Targeted Wave 0 suite** — `npx vitest run src/tests/move-vertex-command.test.ts src/tests/move-markups-command.test.ts src/tests/vertex-edit-mode.test.ts`:

- **Test Files:** 3 passed
- **Tests:** 18 passed, 0 failed
- Pre-implementation baseline (recorded before any T1 edit): 17 failed / 1 passed
- Net RED → GREEN delta: 17 tests turned GREEN; the 1 previously-passing test (the trivially-passing `initialises with vertexEditMarkupId equal to null` from Wave 0) remains passing through real store state instead of beforeEach scaffolding

**Full project suite** — `npx vitest run`:

- **Test Files:** 71 passed
- **Tests:** 511 passed, 0 failed
- Plan constraint: "no regressions in the existing 493 tests" — confirmed (493 prior + 18 new Wave 0 = 511 exact match; no other counts changed)

**Type check** — `npx tsc --noEmit` after every task: clean exit, no errors.

## Deviations from Plan

**None of consequence.** No Rule 1/2/3 auto-fixes triggered, no Rule 4 architectural decisions needed, no authentication gates.

One minor defensive guard worth documenting (Rule 2 — auto-add critical correctness guard, but trivial enough not to count as a deviation):

- **`moveVertex` defensively returns `s` (no-op) when the target markup's discriminant is `'count'`.** The plan said "the caller is responsible" for not calling `moveVertex` on a count pin, but a TypeScript narrowing failure or accidental call would otherwise corrupt state. The bail is identical to the unknown-id no-op (returns `s`, no command pushed). Documented in the JSDoc and as a comment in the implementation. Zero impact on the Wave 0 test contract — the tests never call `moveVertex` on a count pin, so this branch is defensive-only.

The plan suggested a single combined commit `feat(12-01): add move-vertex + move-markups commands, vertexEditMarkupId store state`. Instead, three atomic commits per the execute-plan.md per-task commit protocol (which takes precedence over plan-suggested commit messages). Same pattern as Wave 0. Aggregate diff is identical; per-task commits give finer-grained bisect granularity should Wave 2 regress one foundation independently.

## Authentication Gates

None encountered. This plan is pure in-process TypeScript / store work — no IPC, no filesystem, no network.

## Known Stubs

None. All four modified files are fully wired:

- New `MarkupCommand` union members are referenced by the new store actions and their undo/redo branches.
- New `markupStore` actions are reachable from any consumer via `useMarkupStore.getState()` — same API surface as `editMarkup`, `deleteMarkup`, etc.
- New `viewerStore` field/actions are reachable via `useViewerStore.getState()` and the field is cleared on every lifecycle reset, so no leak path exists.

No placeholder UI, no "coming soon" strings, no unrouted data. The foundation is fully consumable by Wave 2 (UI overlay) and Wave 3 (event wiring).

## Threat Flags

None. No new network endpoints, no auth paths, no file/IO surface, no schema changes at trust boundaries. All changes are renderer-process in-memory state mutations.

## Self-Check: PASSED

- `src/renderer/src/types/markup.ts` — FOUND, modified
- `src/renderer/src/stores/markupStore.ts` — FOUND, modified
- `src/renderer/src/types/viewer.ts` — FOUND, modified
- `src/renderer/src/stores/viewerStore.ts` — FOUND, modified
- Commit `670203f` — FOUND (T1)
- Commit `9288db9` — FOUND (T2)
- Commit `2dfa568` — FOUND (T3)
- Wave 0 RED stubs (`move-vertex-command.test.ts`, `move-markups-command.test.ts`, `vertex-edit-mode.test.ts`) — FOUND, 18/18 GREEN
- Full vitest suite — 511/511 passing (no regression on the prior 493)
- `npx tsc --noEmit` — clean

## Wave 2 GREEN Targets

Wave 1 lands the data-model and state foundation. Subsequent waves can now consume:

1. **`markupStore.moveVertex(...)`** — Wave 3 (event wiring) will call this on `handleStageMouseUp` when a vertex-handle drag commits beyond the 4px threshold.
2. **`markupStore.moveMarkups([...])`** — Wave 3 will call this with `moves.length === 1` for single-markup translate and `moves.length === N` for group move (D-08). Count pins are normalised as `oldPoints: [m.point]` / `newPoints: [newPoint]` at call sites.
3. **`viewerStore.vertexEditMarkupId`** — Wave 2 (UI overlay) reads this to decide whether to mount the `VertexHandleOverlay` Layer; Wave 3 calls `setVertexEditMarkupId(id)` on the D-04 "second-click" detection in `handleMarkupClick` and `clearVertexEdit()` on click-outside / Enter / Escape / rubber-band start.
