---
phase: 03-markup-tools-and-editing
plan: 01
subsystem: testing
tags: [typescript, zustand, vitest, tdd, markup, undo-redo, command-pattern]

requires:
  - phase: 02-scale-calibration
    provides: scale-math (euclideanDistance, fromMm, MM_PER_UNIT), scaleStore pattern, StagePoint interface
provides:
  - Markup type union (CountMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup) in markup.ts
  - 8-color CATEGORY_PALETTE with amber #ca8a04 at index 3
  - UNDO_STACK_MAX=50, LABEL_FONT_FLOOR=10, LABEL_FONT_BASE=12 constants
  - polylineLength, polygonArea (shoelace), polygonCentroid, pixelLengthToReal, pixelAreaToReal, labelFontSize in markup-math.ts
  - useMarkupStore: getOrCreateCategory, placeMarkup, deleteMarkup, nextCountSequence, undo, redo, canUndo, canRedo
affects:
  - 03-02-count-markup-tool
  - 03-03-linear-markup-tool
  - 03-04-area-perimeter-markup-tool
  - 03-05-markup-list-panel

tech-stack:
  added: []
  patterns:
    - TDD (RED/GREEN) — write failing test, implement, verify green, commit
    - Zustand command pattern for undo/redo (MarkupCommand union type)
    - pushCommand helper that clamps stack to UNDO_STACK_MAX by slicing oldest entries
    - getOrCreateCategory with case-insensitive dedup and palette cycling via modulo

key-files:
  created:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/lib/markup-math.ts
    - src/renderer/src/stores/markupStore.ts
    - src/tests/markup-math.test.ts
    - src/tests/markup-store.test.ts
    - src/tests/markup-commands.test.ts
  modified:
    - src/renderer/src/hooks/useViewportControls.ts

key-decisions:
  - "MarkupCommand is a discriminated union { type: 'place' | 'delete'; markup: Markup } — each command stores the full markup object enabling no-lookup undo/redo"
  - "UNDO_STACK_MAX=50 chosen as 2.5x the MARK-09 minimum (20+) with room for dense editing sessions"
  - "Category palette uses #ca8a04 (amber) at index 3 per D-11 spec, distinct from warning orange #e8a838"
  - "nextCountSequence uses max(existing sequences)+1 so deleted markups leave permanent gaps (Pitfall 5: prevents duplicate sequence numbers)"
  - "pushCommand uses slice(length - MAX) rather than shift() to maintain array immutability in Zustand"

patterns-established:
  - "Markup stores: mirror scaleStore pattern — create<Interface>((set, get) => ({...}))"
  - "Test reset: useMarkupStore.setState({pageMarkups:{}, categories:{}, categoryOrder:[], undoStack:[], redoStack:[]})"
  - "Markup helper: makeCount(page, name, seq, categoryId) returns full CountMarkup with randomUUID"

requirements-completed:
  - MARK-01
  - MARK-02
  - MARK-03
  - MARK-04
  - MARK-05
  - MARK-06
  - MARK-08
  - MARK-09
  - MARK-10

duration: 7min
completed: 2026-04-20
---

# Phase 3 Plan 01: Markup Foundation Summary

**Zustand markup store with command-pattern undo/redo (depth 50), shoelace polygon math, and 8-color palette registry — fully TDD-verified in 66 tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-20T11:32:19Z
- **Completed:** 2026-04-20T11:39:00Z
- **Tasks:** 3
- **Files modified:** 7 (6 new, 1 modified)

## Accomplishments
- `markup.ts` exports the full Markup type union, CATEGORY_PALETTE (8 entries, amber at index 3 per D-11), UNDO_STACK_MAX=50, and font-size constants
- `markup-math.ts` exports six math helpers: polylineLength (Euclidean sum), polygonArea (shoelace), polygonCentroid (vertex average), pixelLengthToReal, pixelAreaToReal (quadratic ratio), labelFontSize (zoom-compensated with floor 10)
- `markupStore.ts` implements getOrCreateCategory (case-insensitive dedup, palette cycling), placeMarkup/deleteMarkup (emit MarkupCommand), nextCountSequence (gap-preserving), and undo/redo with 50-deep clamped stacks
- 66 new tests added (3 test files) across math helpers, store CRUD, and undo/redo round-trips; full suite 141 tests green

## Task Commits

1. **Task 1: Markup types and math library (TDD)** - `f8f36e3` (feat)
2. **Task 2: Markup store with categories, per-page markups, count sequencing (TDD)** - `b9e7c97` (feat)
3. **Task 3: Undo/redo stack 20+ round-trip integrity** - `cc52ae7` (test)

## Files Created/Modified
- `src/renderer/src/types/markup.ts` — MarkupType union, all Markup interfaces, Category, MarkupCommand, CATEGORY_PALETTE, constants
- `src/renderer/src/lib/markup-math.ts` — polylineLength, polygonArea, polygonCentroid, pixelLengthToReal, pixelAreaToReal, labelFontSize
- `src/renderer/src/stores/markupStore.ts` — useMarkupStore Zustand store with all mutators
- `src/tests/markup-math.test.ts` — 22 tests for all math helpers including Pitfall 2 area scaling
- `src/tests/markup-store.test.ts` — 22 tests for category registry, per-page CRUD, Pitfall 5 sequences, command generation
- `src/tests/markup-commands.test.ts` — 22 tests for undo/redo symmetry, 20+ round-trip (MARK-09), stack depth clamp, canUndo/canRedo, category persistence (Pitfall 4)
- `src/renderer/src/hooks/useViewportControls.ts` — fixed pre-existing typecheck bug (const steps typed as number[])

## Decisions Made
- MarkupCommand stores the full Markup object (not just ID) enabling undo/redo without any store lookup
- nextCountSequence computes max(existing)+1 so deleted items leave gaps — prevents duplicate sequence numbers as required by Pitfall 5
- pushCommand uses array slice (immutable pattern) rather than splice/shift

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in useViewportControls.ts**
- **Found during:** Task 1 verification (npm run typecheck)
- **Issue:** `buildZoomSteps` spread `ZOOM_STEPS as const` into `steps`, which TypeScript inferred as the literal tuple type — `steps.push(fitScale: number)` failed because `number` is not assignable to the literal union
- **Fix:** Added explicit type annotation `const steps: number[] = [...ZOOM_STEPS]`
- **Files modified:** `src/renderer/src/hooks/useViewportControls.ts`
- **Verification:** `npm run typecheck` exits 0
- **Committed in:** `f8f36e3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — pre-existing bug in adjacent file)
**Impact on plan:** Single-line fix; zero scope creep. typecheck gate now clean.

## Issues Encountered
None — store implementation matched plan specification exactly; all 66 new tests passed first run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 02-05 can now import `useMarkupStore`, `Markup`, `Category`, and all math helpers
- Key import paths: `@renderer/types/markup`, `@renderer/lib/markup-math`, `@renderer/stores/markupStore`
- Store test reset pattern established for all subsequent markup store tests

---
*Phase: 03-markup-tools-and-editing*
*Completed: 2026-04-20*
