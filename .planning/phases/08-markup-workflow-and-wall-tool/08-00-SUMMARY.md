---
phase: 08-markup-workflow-and-wall-tool
plan: "00"
subsystem: types-and-test-scaffolding
tags: [tdd, types, wall, chain-mode, visibility, red-stubs]
dependency_graph:
  requires: []
  provides:
    - WallMarkup type in markup.ts
    - wall in ActiveTool and MARKUP_TOOLS in viewer.ts
    - wall in BoqRowType (boq-types.ts + boq-writers.ts inline dup)
    - 6 RED test stubs defining contracts for all downstream waves
  affects:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/lib/boq-types.ts
    - src/main/boq-writers.ts
    - src/tests/ (6 new files)
tech_stack:
  added: []
  patterns:
    - Additive union extension (MarkupType, ActiveTool, BoqRowType, Markup)
    - RED-stub test pattern (namespace import + as-any cast for not-yet-exported symbols)
    - vi.mock('react-konva') div-stub pattern for jsdom-compatible Konva component tests
    - useLayoutEffect holder pattern for hook state capture in test harness
key_files:
  created:
    - src/tests/wall-math.test.ts
    - src/tests/boq-aggregator-wall.test.ts
    - src/tests/project-schema-hidden.test.ts
    - src/tests/chain-mode.test.ts
    - src/tests/totals-row-visibility.test.ts
    - src/tests/markup-visibility.test.ts
  modified:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/lib/boq-types.ts
    - src/main/boq-writers.ts
decisions:
  - Add 'wall' as a new MarkupType member (not a flag on 'linear') per D-06 in CONTEXT.md
  - Extend 'edit-markup' MarkupCommand branch with optional oldWallHeight/newWallHeight (not a new branch) — smaller diff per D-07 researcher recommendation
  - inline-dup BoqRowType in boq-writers.ts updated in same commit (Pitfall 10 / T-08-00-01 mitigation)
  - RED tests use namespace import + (module as any).symbol pattern to avoid compile errors on missing exports
metrics:
  duration_min: 12
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_modified: 10
---

# Phase 08 Plan 00: Type Extensions and RED Test Stubs Summary

Wave 0 prerequisite plan: extended four type files additively and created six RED test stubs defining the contracts for all downstream implementation waves.

## What Was Built

TypeScript type extensions in four files so that the 'wall' markup type is visible everywhere immediately, causing downstream compile errors to surface in the right places when implementations are incomplete. Six RED test files defining behavioral contracts that all downstream waves must make pass.

## Task 1: Type Extensions

Four files modified in a single coherent change:

**src/renderer/src/types/markup.ts:**
- `MarkupType` extended to include `'wall'`
- `WallMarkup` interface added (`type: 'wall'`, `points: StagePoint[]`, `wallHeight: number` in mm)
- `Markup` union extended to `CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup`
- `'edit-markup'` MarkupCommand branch extended with optional `oldWallHeight?` and `newWallHeight?` fields

**src/renderer/src/types/viewer.ts:**
- `ActiveTool` extended to include `'wall'`
- `MARKUP_TOOLS` constant extended to include `'wall'` (isMarkupTool type guard auto-derives)

**src/renderer/src/lib/boq-types.ts:**
- `BoqRowType` extended to include `'wall'`

**src/main/boq-writers.ts:**
- Inline-duplicated `BoqRowType` extended to include `'wall'` in lockstep (T-08-00-01 mitigation)

## Task 2: RED Test Stubs

Six files created, each defining behavioral contracts for downstream implementation waves:

| File | Tests | Contract Defined |
|------|-------|-----------------|
| wall-math.test.ts | 3 | `wallAreaM2(points, heightMm, pixelsPerMm)` function signature + math |
| boq-aggregator-wall.test.ts | 2 | wall aggregation produces m² row; hidden walls still aggregate |
| project-schema-hidden.test.ts | 3 | `hiddenItemNames` in snapshotProject/hydrateStores/projectStore |
| chain-mode.test.ts | 3 | `chainArmed: false` + `pendingWallHeight: 2400` in INITIAL_STATE |
| totals-row-visibility.test.ts | 3 | Lightbulb/LightbulbOff slot on TotalsRow with stopPropagation |
| markup-visibility.test.ts | 4 | Skip-render for CountPin/Linear/Area/Perimeter when name is hidden |

All 18 new tests fail at runtime (assertion failures or "is not a function"). `npx tsc --noEmit` exits 0. 57 pre-existing test files remain passing (425 tests pass, unchanged).

## Verification Results

- `npx tsc --noEmit` exits 0 after all 4 type extensions
- All 6 RED test files exist at `src/tests/*.test.ts`
- All 6 files fail when run individually (non-zero exit)
- All 18 new test failures are runtime failures, not compile errors
- Pre-existing test count unchanged: 57 files passing, 425 tests passing

## Deviations from Plan

None. Plan executed exactly as written.

- RED stub import technique: namespace import (`import * as markupMath from '...'`) + `(module as any).symbol` cast instead of a named import of a missing symbol. This is an established safe pattern for RED stubs without TypeScript compile errors.
- `vi.mock('react-konva')` div-stub pattern used in markup-visibility.test.ts mirrors the existing pattern from `highlight-overlay-listening.test.ts` — no deviation from established project patterns.

## Known Stubs

None. This is a pure types + test scaffolding plan; no UI stubs, no placeholder data.

## Threat Flags

T-08-00-01 (Tampering — BoqRowType inline dup divergence): **mitigated**. Both `boq-types.ts` (renderer) and `boq-writers.ts` (main) updated in a single commit `664a326`. The NEVER-LET-DIVERGE comment in boq-writers.ts line 9 is preserved.

## Self-Check: PASSED

- `src/renderer/src/types/markup.ts` — contains 'wall', WallMarkup, oldWallHeight, newWallHeight
- `src/renderer/src/types/viewer.ts` — contains 'wall' in ActiveTool and MARKUP_TOOLS
- `src/renderer/src/lib/boq-types.ts` — contains 'wall' in BoqRowType
- `src/main/boq-writers.ts` — contains 'wall' in inline-dup BoqRowType
- All 6 test files exist at src/tests/
- Commit 664a326: feat(08-00) type extensions
- Commit dab65bf: test(08-00) RED test stubs
