# Spike 002 — snapping-engine
**Type:** standard
**Date:** 2026-06-16
**Status:** VALIDATED

## Question (Given/When/Then)
Given a page with MANY existing markup vertices (hundreds to tens of thousands of points), WHEN the cursor moves near an endpoint / vertex / line-segment / intersection, THEN the nearest snap candidate within a zoom-compensated screen-space tolerance is found in well under one frame budget (<~2ms, ideally microseconds) so snapping feels instant during continuous mousemove — and the result is CORRECT (matches brute-force nearest).

## Research
For mousemove-rate *point* queries against a static-ish set, a **uniform spatial grid hash** wins on simplicity and constant-factor speed: bucket by `floor(x/cell)`/`floor(y/cell)`, and a near-query touches only a fixed 3x3 neighbourhood when `cell >= tolerance`. A k-d tree gives O(log n) but with worse constants, pointer-chasing, and costly rebuilds when geometry edits frequently; an R-tree shines for variable-extent rectangles (good for *segments*) but is heavier to build and overkill for points. Brute force is O(n) per query — fine at N=1k, unacceptable at 50k during continuous mousemove. The grid's only weakness is non-uniform clustering (one hot bucket), which the cell-size sweep below shows we can tune away.

| Approach | Build | Point query | Notes |
|----------|-------|-------------|-------|
| Brute force | O(n) | O(n) | Correctness oracle; too slow at scale |
| Uniform grid hash | O(n) | O(1)* | *with cell ≈ tolerance; chosen for points + short segments |
| k-d tree | O(n log n) | O(log n) | Worse constants; rebuild cost on edits |
| R-tree | O(n log n) | O(log n + k) | Best for long/variable segments; heavier |

## Experiment
`experiment.cjs` (plain Node, zero deps, deterministic mulberry32 PRNG — no `Math.random`). It (1) generates N vertices over a 5000x4000 page-space extent; (2) builds a grid hash and reports build time + bucket stats; (3) runs 10,000 random cursor queries for nearest-vertex-within-tolerance and measures avg/p99; (4) verifies EVERY query against brute force (mismatch must be 0); (5) builds a **bbox-padded** segment index (each segment inserted into every cell its tol-padded bounding box overlaps, so a single-cell query is exhaustive) and times nearest-point-on-segment snapping with full brute-force correctness, plus a naive endpoint-only index to demonstrate its hit-misses; (6) sweeps cell size at 0.5x/1x/2x/4x tolerance (widening the scan ring to stay correct for small cells) to recommend a cell-size rule. Tolerance is zoom-compensated: `pageTol = 12px / zoom = 12` page units at zoom 1.

Run: `node experiment.cjs` (completes in well under a minute).

## Results
Real output from this machine (Windows, Node). Tolerance = 12 page units (12px screen / zoom 1).

**Vertex snapping** — grid cell = 1x tol, 3x3 neighbourhood scan:

| N | build (ms) | buckets | avg occ | max occ | avg query (us) | p99 (us) | hit rate | mismatch |
|---|-----------|---------|---------|---------|----------------|----------|----------|----------|
| 1,000 | 1.16 | 997 | 1.00 | 2 | 2.52 | 8.1 | 0.022 | **0** |
| 10,000 | 8.88 | 9,633 | 1.04 | 3 | 2.20 | 6.8 | 0.205 | **0** |
| 50,000 | 34.79 | 42,020 | 1.19 | 5 | 4.46 | 15.5 | 0.673 | **0** |

**Segment snapping** — nearest point ON segment, bbox-padded grid, cell = 2x tol, realistic short segments (20–120 units):

| N segs | build (ms) | dup factor | hit rate | avg query (us) | p99 (us) | mismatch | endpoint-only missed hits / 2000 |
|--------|-----------|-----------|----------|----------------|----------|----------|----------------------------------|
| 1,000 | 3.74 | 13.9x | 0.366 | 0.98 | 2.5 | **0** | 44 |
| 10,000 | 25.44 | 14.4x | 0.675 | 0.79 | 2.4 | **0** | 77 |
| 50,000 | 119.41 | 14.5x | 0.981 | 2.20 | 7.7 | **0** | 26 |

**Cell-size sweep** (N=50,000 vertices, scan ring widened to stay correct):

| cell factor | cell size | scan ring | cells scanned | buckets | avg (us) | p99 (us) | mismatch |
|-------------|-----------|-----------|---------------|---------|----------|----------|----------|
| 0.5x | 6.0 | 2 | 25 | 47,683 | 7.24 | 21.7 | **0** |
| 1x | 12.0 | 1 | 9 | 41,967 | 3.53 | 11.7 | **0** |
| 2x | 24.0 | 1 | 9 | 26,623 | 4.08 | 14.2 | **0** |
| 4x | 48.0 | 1 | 9 | 8,749 | 3.56 | 14.9 | **0** |

Key reads: every grid result matches brute force (mismatch = 0 across all tables). Worst-case vertex p99 at 50k is 15.5us — ~130x under the 2ms frame budget. Cells **smaller** than tolerance are the only loser (0.5x forces a 25-cell scan and doubles avg time); 1x–4x are all flat and fast. The naive endpoint-only segment index silently misses real hits (long segments crossing a cell with distant endpoints), which is why the build uses a bbox-padded index instead.

## Verdict
**VALIDATED.** Snapping at scale is comfortably feasible. A uniform grid hash finds the correct nearest vertex in ~2–4.5us avg / ≤15.5us p99 even at 50,000 points — three orders of magnitude under one frame — and the same grid handles nearest-point-on-segment at ~1–2us avg with full correctness, provided segments are indexed by their **tolerance-padded bounding box** (not just endpoints). **Recommended cell-size rule:** set `cell = zoom-compensated tolerance` (i.e. `cell = screenTolPx / zoom`, ~12 page units) and scan the 3x3 neighbourhood for vertices / the single cursor cell for bbox-indexed segments; never make cells smaller than the tolerance (it forces a wider, slower scan with no benefit), and 1x–2x is the sweet spot. The real build integrates at the stage mousemove handler: convert the raw pointer to a page-space point via the stage inverse transform, query the grid, and if a candidate is within tolerance, override the cursor's page-point with the snapped coordinate and render a visual snap indicator (e.g. a highlighted dot/cross). Rebuild or incrementally update the grid as markups are added/removed (build is <120ms even at 50k, so a full rebuild on geometry change is acceptable). **Intersection snapping** was discussed but not fully implemented: it is the costliest target because candidate intersections must be computed pairwise among segments sharing/adjacent to a cell (O(k^2) within the local bucket); it is tractable because the grid bounds k to a handful of nearby segments, but expect it to cost more per query than vertex/on-segment snapping and to require deduping computed intersection points — defer it to a later plan and validate separately if needed.

## Tags
#measurement #markup #snapping #spatial-index #performance #feasibility
