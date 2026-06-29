# Phase 15 — Deferred Items (out-of-scope discoveries)

Logged by the executor during plan execution. NOT fixed in the originating plan
(scope boundary). Each item names the owning wave/plan that should resolve it.

## From Plan 15-02 (Wave 1 — data-model/aggregator spine)

- ~~**Stale comments in `src/renderer/src/components/TotalsCategoryBlock.tsx` (lines 26, 45)**
  reference the removed `perimeter-length`/`perimeter-area` split.~~ **RESOLVED by
  Plan 15-03 (commit `380f762`).** The match-resolution docstring was reworded to
  "the perimeter row type equals the underlying 'perimeter' markup type — one row",
  and the orphaned `rowTypeToMarkupType` doc block (which described the deleted
  split mapping) was deleted. `git grep "perimeter-length\|perimeter-area"` over
  `TotalsCategoryBlock.tsx` now returns zero matches.

- **`src/main/boq-writers.ts:18` still carries the old `BoqRowType` split**
  (`'perimeter-length' | 'perimeter-area'`). This is the **main-process** type
  duplicate, explicitly flagged OUT OF SCOPE for 15-02 ("Wave 2 owns it; do NOT
  touch it"). It compiles independently (not imported by 15-02's files), so the
  `boq-export-ipc` structural lock + full typecheck stay green. **Owner: Plan 15-04
  (writers).** Must be aligned (drop the split, add Rate/Cost columns) when the
  writers gain the ₱ columns.
