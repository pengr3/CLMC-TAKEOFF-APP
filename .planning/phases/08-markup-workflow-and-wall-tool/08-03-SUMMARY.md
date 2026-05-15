---
phase: 08-markup-workflow-and-wall-tool
plan: "03"
subsystem: wall-math-boq-store
tags: [wall, math, boq, markup-store, tdd]
dependency_graph:
  requires:
    - 08-00 (WallMarkup type, BoqRowType wall, RED test stubs)
    - 08-01 (useMarkupTool wall branch + chain mode)
    - 08-02 (hiddenItemNames persistence in projectStore)
  provides:
    - wallAreaM2 pure function in markup-math.ts
    - wall branch in boq-aggregator (uomFor + findUncalibrated + dispatch)
    - editMarkup optional wallHeight undo/redo in markupStore
  affects:
    - src/renderer/src/lib/markup-math.ts
    - src/renderer/src/lib/boq-aggregator.ts
    - src/renderer/src/stores/markupStore.ts
tech_stack:
  added: []
  patterns:
    - Inline mm-to-m conversion (avoids ScaleUnit 'm' Assumption A1 risk)
    - Conditional spread for optional field extension (zero behavior change for non-wall edits)
    - Defensive wallHeight <= 0 guard in aggregator (defense-in-depth against crafted .clmc)
    - Additive extension to existing discriminated union handler (no new branch)
key_files:
  created: []
  modified:
    - src/renderer/src/lib/markup-math.ts
    - src/renderer/src/lib/boq-aggregator.ts
    - src/renderer/src/stores/markupStore.ts
decisions:
  - "wallAreaM2 uses inline mm→m conversion (not pixelLengthToReal with 'm') to avoid Assumption A1 ScaleUnit risk"
  - "boq-aggregator wall branch uses same inline math as linear/area branches (no wallAreaM2 wrapper) for consistency"
  - "editMarkup extended with optional positional params (Option A from D-07) — smaller diff than a new branch"
  - "Conditional spread pattern { ...(x !== undefined ? { y: x } : {}) } is zero-cost for undefined args"
metrics:
  duration_min: 3
  completed_date: "2026-05-15"
  tasks_completed: 3
  files_modified: 3
---

# Phase 08 Plan 03: Wall Measurement Pipeline (Math + Aggregator + Store) Summary

**One-liner:** `wallAreaM2` pure function + BOQ aggregator wall branch producing m² rows with defensive guard + `editMarkup` extended with optional `oldWallHeight`/`newWallHeight` for undo/redo restoration.

## What Was Built

Wave 2A completes the wall measurement pipeline end-to-end (below the UI layer). A `WallMarkup` placed via `store.placeMarkup` now appears correctly in `BoqStructure` as a single m² row, and `editMarkup` supports wall-height changes with full undo/redo restoration.

### Task 1: wallAreaM2 in markup-math.ts

Added `export function wallAreaM2(points, wallHeightMm, pixelsPerMm): number` at line 56 of `markup-math.ts`.

- Inline `px → mm → m` conversion: `pixelLen / pixelsPerMm / 1000` for length, `wallHeightMm / 1000` for height. Returns `lengthM * heightM`.
- Throws `'pixelsPerMm must be positive'` and `'wallHeightMm must be positive'` on non-positive inputs (mirrors `pixelLengthToReal` validation style).
- JSDoc documents the D-12 guarantee (always m² regardless of globalUnit) and the Assumption A1 rationale for inline conversion.
- Placed between `pixelAreaToReal` and `polylineMidpointByArcLength` for logical grouping with unit-conversion helpers.

### Task 2: BOQ aggregator wall branch

Three additive edits to `boq-aggregator.ts`:

1. **Import**: `import type { ... WallMarkup } from '../types/markup'`
2. **`uomFor`**: Added `if (t === 'wall') return 'm²'` before the `globalUnit + '²'` fallback — D-12 enforcement.
3. **`findUncalibratedMarkupPages`**: Extended `hasMeasurement` predicate to include `|| m.type === 'wall'` — uncalibrated pages with walls surface the calibration warning.
4. **`aggregateBoq` dispatch**: Added `} else if (m.type === 'wall') {` branch after the perimeter branch:
   - Casts to `WallMarkup` for typed `wallHeight` access
   - `wallHeight <= 0` continue guard (defense-in-depth for crafted .clmc files — T-08-03-01 mitigation)
   - Inline `px → mm → m` math consistent with linear/area/perimeter branches
   - Calls existing `add()` helper with type `'wall'`

### Task 3: markupStore editMarkup wallHeight extension

Four additive changes to `markupStore.ts`:

1. **Interface**: `editMarkup` signature extended with `oldWallHeight?: number, newWallHeight?: number` optional positional params.
2. **Implementation body**: `updated: Markup` receives conditional spread `...(newWallHeight !== undefined ? { wallHeight: newWallHeight } : {})`. `cmd: MarkupCommand` receives `...(oldWallHeight !== undefined ? { oldWallHeight, newWallHeight } : {})`.
3. **Undo branch**: `edit-markup` case maps spread `...(cmd.oldWallHeight !== undefined ? { wallHeight: cmd.oldWallHeight } : {})` — restores pre-edit wall height.
4. **Redo branch**: Symmetric with `cmd.newWallHeight` — re-applies edited wall height.

Non-wall edits pass `undefined` for both optional params; the conditional spreads produce nothing — zero behavior change for existing markup types.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | wallAreaM2 pure function | 9156ecd | markup-math.ts |
| 2 | BOQ aggregator wall branch | 8eb3de6 | boq-aggregator.ts |
| 3 | markupStore editMarkup wallHeight | 31be2f5 | markupStore.ts |

## Verification Results

- `npx vitest run src/tests/wall-math.test.ts` — 3/3 GREEN
- `npx vitest run src/tests/boq-aggregator-wall.test.ts` — 2/2 GREEN
- `npx vitest run src/tests/markup-commands.test.ts` — 29/29 GREEN (Phase 7 regression check)
- `npx vitest run src/tests/markup-math.test.ts` — 28/28 GREEN (existing math regression)
- `npx vitest run src/tests/boq-aggregator.test.ts` — 8/8 GREEN (existing aggregator regression)
- `npx vitest run src/tests/markup-store.test.ts` — 22/22 GREEN (existing store regression)
- `npx tsc --noEmit` — exits 0 after each task

## Deviations from Plan

None — plan executed exactly as written.

All three tasks followed their exact prescribed patterns:
- Task 1: inline conversion exactly as specified in PATTERNS.md
- Task 2: three exact edit points with no behavior change to existing branches
- Task 3: conditional spread pattern `...(x !== undefined ? { y: x } : {})` exactly as specified

## Known Stubs

None. All pipeline stages are fully implemented:
- `wallAreaM2` computes real math (not a stub)
- aggregator produces real m² rows with real quantities
- `editMarkup` actually stores and restores `wallHeight` via the undo/redo stack

## Threat Flags

No new trust boundaries introduced. The three files modified are:
- `markup-math.ts` — pure utility, no external access
- `boq-aggregator.ts` — pure function consuming store state
- `markupStore.ts` — in-process Zustand store

T-08-03-01 (negative/zero wallHeight in store) — **mitigated**: `wallAreaM2` throws on `wallHeightMm <= 0`; aggregator has a separate `wallHeight <= 0` continue guard for the crafted-.clmc defense-in-depth path.

T-08-03-02 (wall name collides with linear name) — **accepted**: disambiguation suffix `(wall)` / `(linear)` appears per existing D-02 collision logic. No new threat surface.

## Self-Check: PASSED
