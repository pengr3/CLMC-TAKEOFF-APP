---
phase: 14-markup-geometry-precision
plan: 02
subsystem: markup
tags: [snapping, spatial-index, grid-hash, self-intersection, geometry, typescript, vitest]

requires:
  - phase: 14-markup-geometry-precision (plan 01)
    provides: arc-math.ts pure-geometry module + StagePoint pure-math style (markup-math.ts sibling)
provides:
  - "snapping-engine.ts — uniform grid-hash spatial index (buildSnapIndex/resolveSnap) for vertex + nearest-point-on-segment snapping (D-05)"
  - "self-intersection.ts — closed-boundary self-crossing detector (findSelfIntersection) returning offending edge indices for D-09 red highlight"
affects: [snap-canvas-wiring, markup-commit-guard, MM-06, D-09]

tech-stack:
  added: []
  patterns:
    - "Grid-hash spatial index with bbox-padded segment cells (spike-002): cell = zoom-compensated tolerance; 3x3 vertex scan, single-cell segment scan"
    - "Brute-force linear scan as the in-test correctness oracle (0 mismatches at N=1k/10k)"
    - "Pure geometry primitive built/tested before canvas wiring — finite-guarded, no React/Konva"

key-files:
  created:
    - src/renderer/src/lib/snapping-engine.ts
    - src/renderer/src/lib/self-intersection.ts
    - src/tests/snapping-engine.test.ts
    - src/tests/self-intersection.test.ts
  modified: []

key-decisions:
  - "Segments inserted into every cell their cell-padded bbox overlaps (not endpoint-only) — a single-cell cursor query is then exhaustive for on-segment hits"
  - "resolveSnap excludes the whole in-progress markup from segment-snap; vertex-snap is gated by allowVertexIndices/blockVertexIndex (D-07)"
  - "Self-intersection counts collinear-overlap as a crossing; adjacent edges (shared vertex) are skipped via (i+1)%n / (j+1)%n adjacency test"
  - "Both modules short-circuit on non-finite input (skip on build / return null) — never throw (T-14-02-01/02)"

patterns-established:
  - "SnapCandidate carries kind ('vertex'|'segment') + provenance (markupId, vertexIndex/segmentIndex) so the caller applies D-07 exclusion and D-04 □/△ rendering"
  - "findSelfIntersection returns {i, j, point} — edge indices feed the D-09 red highlight directly"

requirements-completed: [D-05, D-06, D-07, D-09]

duration: 5min
completed: 2026-06-29
---

# Phase 14 Plan 02: Markup Snapping & Self-Intersection Primitives Summary

**Uniform grid-hash snap index (vertex + nearest-point-on-segment, brute-force-correct at N=10k) plus an O(n²) closed-boundary self-intersection detector returning offending edge indices for the D-09 red highlight.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-29T11:42:00Z
- **Completed:** 2026-06-29T11:44:30Z
- **Tasks:** 2 (both TDD RED→GREEN)
- **Files created:** 4 (2 modules, 2 test files)

## Accomplishments
- `snapping-engine.ts`: `buildSnapIndex` builds a uniform grid hash keyed by `floor(x/cell),floor(y/cell)`; vertices go in their single cell, segments into every cell their tolerance-padded bbox overlaps (spike-002's bbox-padded rule). `resolveSnap` scans the 3×3 vertex neighbourhood + the single cursor cell for segments, prefers vertices over segments (D-04 □ over △), and applies D-07 exclusion via `allowVertexIndices` / `blockVertexIndex`.
- Brute-force parity oracle proves 0 mismatches over 2000 cursor queries at both N=1000 and N=10000; performance smoke runs 10000 resolves at N=10000 in well under 100ms (per-frame budget).
- `self-intersection.ts`: `findSelfIntersection` treats the point list as a closed boundary (edge i→(i+1)%n incl. the closing edge), runs the classic sign-of-cross-products segment-pair test over non-adjacent pairs, counts collinear overlap as a crossing, and returns the first crossing's two edge indices + intersection point (or null).
- Both modules are finite-guarded (non-finite vertex skipped on build / boundary returns null), satisfying threat register T-14-02-01 and T-14-02-02.

## Task Commits

Each task was committed atomically (TDD RED+GREEN folded into one feat commit per task — test file and module created together, RED verified before GREEN):

1. **Task 1: snapping-engine.ts (grid-hash) + brute-force-oracle tests** - `ba5b903` (feat)
2. **Task 2: self-intersection.ts (closed-boundary detector) + tests** - `77bded6` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/renderer/src/lib/snapping-engine.ts` - Uniform grid-hash spatial index; `buildSnapIndex` + `resolveSnap`; `SnapCandidate`/`SnapIndex`/`SnapExclude` types
- `src/renderer/src/lib/self-intersection.ts` - `findSelfIntersection` closed-boundary crossing detector
- `src/tests/snapping-engine.test.ts` - 8 tests: brute-force parity (N=1k/10k), on-segment vs endpoint-only, vertex preference, D-07 exclusion, non-finite guard, perf smoke
- `src/tests/self-intersection.test.ts` - 6 tests: convex quad, bowtie analytic crossing, shared-vertex corner, collinear self-touch, non-finite guard, <4 points

## Decisions Made
- **bbox-padded segment cells (not endpoint-only):** a naive endpoint-only index silently misses long segments whose body crosses a cell with distant endpoints (spike-002 measured 44–77 missed hits / 2000). The on-segment parity test asserts the bbox-padded index finds a hit >1900 units from either endpoint.
- **Whole-markup segment exclusion under D-07:** the in-progress markup contributes no segment-snap at all; only its allowed vertices (e.g. start vertex `[0]`) can snap. Keeps the close-the-loop affordance while preventing self-snapping mid-draw.
- **Collinear overlap counts as a crossing** in `findSelfIntersection` per spike-003b — a vertex landing exactly on a non-adjacent edge is a real degeneracy that breaks the shoelace/segment-area assumption.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed TDD (RED verified failing, GREEN verified passing). No bugs, missing functionality, or blocking issues required auto-fixing.

## Issues Encountered

- `npx tsc --noEmit -p tsconfig.web.json` surfaced 7 pre-existing type errors in unrelated in-flight Phase 14 files (`CanvasViewport.tsx`, `TotalsCategoryBlock.tsx`, `markupStore.ts` reshape-arc command). These are out of scope for plan 14-02 (the two new modules + their tests compile clean — verified by filtering tsc output for my filenames: zero matches). Logged to `deferred-items.md`; not fixed per the executor SCOPE BOUNDARY rule. The default `npx tsc --noEmit` (root project) and the targeted vitest runs are both green.

## Next Phase Readiness
- Snap primitives are ready for the canvas-wiring wave (mousemove → stage inverse transform → `resolveSnap` → override cursor page-point + render snap indicator). The grid is cheap to rebuild on geometry change (<120ms at 50k per spike-002).
- `findSelfIntersection` is ready for the commit-guard wave (D-09): on area/perimeter commit, call it; if non-null, highlight edges `i` and `j` red.
- Intersection-snap and grid-snap remain deferred (D-06), as planned.

## Self-Check: PASSED

- FOUND: src/renderer/src/lib/snapping-engine.ts
- FOUND: src/renderer/src/lib/self-intersection.ts
- FOUND: src/tests/snapping-engine.test.ts
- FOUND: src/tests/self-intersection.test.ts
- FOUND commit: ba5b903 (Task 1)
- FOUND commit: 77bded6 (Task 2)
- Tests: 14 passed (8 snapping + 6 self-intersection)

---
*Phase: 14-markup-geometry-precision*
*Completed: 2026-06-29*
