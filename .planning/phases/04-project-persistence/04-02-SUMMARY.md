---
phase: 04-project-persistence
plan: 02
subsystem: state-management
tags: [zustand, subscribeWithSelector, dirty-tracking, project-store, typescript]

requires:
  - phase: 04-00
    provides: Wave 0 red test scaffolds (project-store.test.ts 6 failing tests)
  - phase: 04-01
    provides: project-serialize.ts hydrateStores (Wave 1 implementation using direct setState)

provides:
  - useProjectStore Zustand slice with currentFilePath, isDirty, lastSavedAt, setSaved, setCurrentFilePath, markDirty, reset
  - suspendDirtyTracking / resumeDirtyTracking / isHydrating module-level guard functions
  - attachDirtyTracking() subscription wire-up returning unsubscribe (call once from App.tsx)
  - markupStore / scaleStore / viewerStore wrapped in subscribeWithSelector with hydrate() + reset()
  - hydrateStores refactored to use store.hydrate() methods bracketed by suspend/resumeDirtyTracking

affects:
  - 04-03 (Wave 3 UI — title-bar asterisk, save/open actions need useProjectStore + attachDirtyTracking)
  - 04-04 (useProject hook, useCloseGuard will import useProjectStore)

tech-stack:
  added: []
  patterns:
    - subscribeWithSelector middleware on all 3 source-of-truth stores for selective subscription
    - Module-level _hydrating guard (suspend/resumeDirtyTracking) brackets hydrateStores to prevent Pitfall 1
    - Single setState per store in hydrate() (Pitfall 2 avoidance)
    - attachDirtyTracking() returns unsubscribe for test cleanup and hot-reload safety
    - beforeEach in tests: detach subscriptions BEFORE resetting stores to prevent spurious dirty events

key-files:
  created:
    - src/renderer/src/stores/projectStore.ts
  modified:
    - src/renderer/src/stores/markupStore.ts
    - src/renderer/src/stores/scaleStore.ts
    - src/renderer/src/stores/viewerStore.ts
    - src/renderer/src/types/viewer.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/tests/project-store.test.ts

key-decisions:
  - "Test beforeEach must detach subscriptions BEFORE resetting stores — otherwise reset() triggers subscriptions and sets isDirty=true before test starts"
  - "shallowEqualArr uses readonly unknown[] signature to satisfy TypeScript with subscribeWithSelector const tuples"
  - "markDirty() is idempotent (skips when isDirty already true) to prevent pointless setState storms"
  - "hydrateStores calls reset() before hydrate() on markupStore/scaleStore for clean-slate second-project-open guarantee"
  - "viewerStore.resetViewer kept as-is; hydrateStores does NOT call it (loadPdfFromPath owns filePath/fileName/totalPages)"

requirements-completed: [PERS-01, PERS-02]

duration: 8min
completed: 2026-04-22
---

# Phase 4 Plan 02: Dirty-Flag + Hydrate Plumbing Layer Summary

**Zustand projectStore with subscription-based dirty tracking via subscribeWithSelector, guarded by _hydrating flag so .clmc open never leaves isDirty=true; Wave 0 project-store scaffold flipped 0/6 → 6/6 green**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T02:15:00Z
- **Completed:** 2026-04-22T02:20:18Z
- **Tasks:** 2
- **Files modified:** 7 (4 stores + 1 lib + 1 type + 1 test)

## Accomplishments

- All three source-of-truth stores (markupStore, scaleStore, viewerStore) wrapped in `subscribeWithSelector` middleware with `hydrate()` and `reset()` single-setState methods
- `projectStore.ts` created: `currentFilePath`, `isDirty`, `lastSavedAt` + `setSaved`, `setCurrentFilePath`, `markDirty`, `reset` actions
- `attachDirtyTracking()` wires three subscription listeners watching only user-work fields (pageMarkups/categories/categoryOrder, pageScales/globalUnit, pageViewports/currentPage); returns unsubscribe for test cleanup
- `hydrateStores` refactored to call `store.hydrate()` methods bracketed by `suspendDirtyTracking()` / `resumeDirtyTracking()` + final `setState({ isDirty: false })` safety reset
- Wave 0 project-store scaffold: all 6 tests flipped from red to green

## Task Commits

1. **Task 1: Add hydrate() + reset() to stores with subscribeWithSelector** - `30729a9` (feat)
2. **Task 2: Create projectStore + dirty-tracking subscriptions + refactor hydrateStores** - `433e114` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/renderer/src/stores/projectStore.ts` — New store: currentFilePath/isDirty/lastSavedAt, suspendDirtyTracking/resumeDirtyTracking/isHydrating, attachDirtyTracking()
- `src/renderer/src/stores/markupStore.ts` — Added subscribeWithSelector wrapper, hydrate(pageMarkups,categories,categoryOrder), reset()
- `src/renderer/src/stores/scaleStore.ts` — Added subscribeWithSelector wrapper, hydrate(pageScales,globalUnit), reset()
- `src/renderer/src/stores/viewerStore.ts` — Added subscribeWithSelector wrapper, hydrate(currentPage,pageViewports)
- `src/renderer/src/types/viewer.ts` — Added hydrate method to ViewerState interface
- `src/renderer/src/lib/project-serialize.ts` — hydrateStores refactored: suspend/resume brackets, store.hydrate() + reset() calls
- `src/tests/project-store.test.ts` — Wave 0 red scaffold replaced with 6 real passing tests

## Decisions Made

- **Test beforeEach order**: `detach()` must be called before `reset()` calls on stores. If subscriptions are active during reset, the store state change fires `markDirty()` and the test starts with `isDirty=true`. Detaching first prevents this.
- **shallowEqualArr uses `readonly unknown[]`**: TypeScript's subscribeWithSelector returns `as const` tuples which are readonly. Using mutable `unknown[]` caused TS2352 conversion errors.
- **viewerStore.resetViewer preserved**: `hydrateStores` does not call `resetViewer` because `loadPdfFromPath` owns `filePath/fileName/totalPages/pdfDocument`. Only `hydrate()` is called for session-resumable fields.
- **idempotent markDirty**: Returns early if `isDirty` is already true to avoid pointless re-renders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed readonly tuple TypeScript error in shallowEqualArr**
- **Found during:** Task 2 (after npm run typecheck:web)
- **Issue:** TypeScript TS2352 errors — `subscribeWithSelector` returns `as const` readonly tuples, but `shallowEqualArr` accepted mutable `unknown[]`. Direct cast produced "neither type sufficiently overlaps" errors.
- **Fix:** Changed `shallowEqualArr` signature from `(a: unknown[], b: unknown[])` to `(a: readonly unknown[], b: readonly unknown[])` and passed it directly as `equalityFn` without cast.
- **Files modified:** `src/renderer/src/stores/projectStore.ts`
- **Verification:** `npm run typecheck:web` exits 0
- **Committed in:** `433e114` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed beforeEach subscription ordering in tests**
- **Found during:** Task 2 (first vitest run showed 2/6 failing — dirty on scale, dirty on viewport)
- **Issue:** Original `beforeEach` called `useProjectStore.reset()` first, then `useScaleStore.reset()` and `useViewerStore.setState()`. Since subscriptions were still attached from the previous test, the store resets fired `markDirty()`, leaving `isDirty=true` at test start.
- **Fix:** Reordered `beforeEach` to `detach()` first, then all store resets, then `useProjectStore.reset()`, then `attachDirtyTracking()`.
- **Files modified:** `src/tests/project-store.test.ts`
- **Verification:** All 6 project-store tests pass
- **Committed in:** `433e114` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs documented above.

## Next Phase Readiness

- Wave 3 (UI) can import `useProjectStore` and subscribe to `currentFilePath` + `isDirty` for title-bar asterisk and toolbar state
- Wave 3 save action can call `useProjectStore.getState().setSaved(path)` after a successful write to clear dirty
- Wave 3 open action can call `hydrateStores(data)` with zero extra bookkeeping and expect `isDirty=false` afterwards
- `attachDirtyTracking()` must be called once from App.tsx on mount to activate subscriptions
- No mutating action in the existing three stores needed modification — subscription covers ALL current and future writes

---
*Phase: 04-project-persistence*
*Completed: 2026-04-22*
