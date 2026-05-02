---
phase: 05-boq-export
plan: 01
subsystem: api
tags: [aggregation, pure-function, zustand, boq, markup-math]

requires:
  - phase: 05-boq-export
    provides: BoqStructure types from Plan 00; existing markup-math (polylineLength, polygonArea, pixelLengthToReal, pixelAreaToReal) from Phase 02
provides:
  - aggregateBoq(opts) — pure function from store state to BoqStructure
  - findUncalibratedMarkupPages(opts) — returns pages with linear/area/perimeter markups but no scale
affects: 05-04 (useExport calls aggregateBoq + findUncalibratedMarkupPages)

tech-stack:
  added: []
  patterns: [inversion-of-control via AggregateOptions — production callers pass nothing (defaults read from getState()); tests inject deterministic fixtures]

key-files:
  created:
    - src/renderer/src/lib/boq-aggregator.ts
  modified: []

key-decisions:
  - "Single pure function (aggregateBoq) used by both the export hook AND uncalibrated-page detection (findUncalibratedMarkupPages reuses the same input model) — D-22"
  - "Perimeter markups synthesize TWO virtual rows: '(perimeter)' for linear length and '(area)' for enclosed area (D-01) — keeps downstream UoM bookkeeping uniform"
  - "Name-collision suffix only applied when ≥2 NON-perimeter types share a name; perimeter's own '(perimeter)' / '(area)' suffix is the disambiguator (D-02)"
  - "Uncategorized bucket uses sentinel key '__uncat__' internally to keep TS-strict object access safe; rendered as '(Uncategorized)' (D-11)"
  - "Counts on uncalibrated pages still export — only linear/area/perimeter on uncalibrated pages are excluded (D-05, D-06)"

patterns-established:
  - "Store-default + override-via-opts pattern: production reads useMarkupStore/useScaleStore/useViewerStore/useProjectStore via getState(); tests pass a fully-formed AggregateOptions to bypass the stores entirely"
  - "Per-UoM subtotal split (D-12): each category emits one subtotal per distinct UoM in that group; grandTotals does the same project-wide"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~4min (orchestrator-applied; original parallel agent didn't commit before usage cap)
completed: 2026-05-02
---

# Plan 05-01: BOQ aggregator — Summary

**Pure-function transform from Zustand store state (or injected fixtures) to the normalized `BoqStructure` consumed by both XLSX and CSV writers.**

## Performance

- **Duration:** ~4 min (orchestrator recovery)
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments
- `aggregateBoq(opts)` — 251 lines, deterministic, no side effects
- `findUncalibratedMarkupPages(opts)` — Plan 04 (useExport) consumes this
- All 8 boq-aggregator RED tests went GREEN (empty project, count cross-page aggregation, perimeter→two rows, name collision suffix, uncalibrated exclusion, categoryOrder + empty-category exclusion, per-UoM subtotal split, getColorForName carryover)

## Task Commits

1. **Task 1: implement aggregateBoq + findUncalibratedMarkupPages** — `b7a5d36` (feat)

## Deviations from Plan

### Recovery from parallel-execution usage cap

The original Plan 05-01 executor agent did not produce any commits before the usage cap terminated it. However, it had completed the implementation file in its worktree (uncommitted). The orchestrator:

1. Discarded the agent's duplicate `boq-types.ts` (Plan 05-00 owns that file)
2. Discarded the agent's duplicate `boq-aggregator.test.ts` (Plan 05-00 owns the RED test scaffold)
3. Copied the worktree's `boq-aggregator.ts` (251 lines) to the main tree and committed atomically as Task 1

The implementation is functionally complete — all 8 RED tests defined by Plan 05-00 pass GREEN against it.

## Verification

- 8/8 boq-aggregator tests GREEN
- `npm run typecheck` passes
- Plan files_modified contract honored: only `src/renderer/src/lib/boq-aggregator.ts` was created
