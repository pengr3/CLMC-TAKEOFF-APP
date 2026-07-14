---
phase: 18-toolbar-revamp
plan: 04
subsystem: ui
tags: [react, useSyncExternalStore, konva, markup, arc, reactive-seam]

# Dependency graph
requires:
  - phase: 18-01
    provides: "@renderer path alias + Phase-18 test harness (arc-sticky-seam.test.ts RED contract)"
  - phase: 14-toolbar
    provides: "markup-arc-ref.ts setter-handler pattern (setArcHeldHandler / setArcStickyToggleHandler); arc flags kept off any store (STATE.md:183)"
provides:
  - "Reactive readable Arc on-state seam: getArcSticky() (getSnapshot) + subscribeArcSticky() (subscribe/unsubscribe) + setArcStickyState() (writer that notifies AFTER commit, no-op on unchanged value)"
  - "CanvasViewport single publish point: useEffect keyed on markupState.arcMode publishes arcMode==='sticky' into the seam so Shift+A (no coincident store change) re-renders every useSyncExternalStore consumer"
affects: [18-07 ToolRail, 18-08 ContextBar, arc-toggle chrome, SC-2, SC-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore-shaped getSnapshot/subscribe seam in a module-ref file for state that lives in React (useMarkupTool) rather than a store"
    - "Writer notifies subscribers strictly AFTER committing the new value; no-op (unchanged value) does not notify"

key-files:
  created: []
  modified:
    - src/renderer/src/lib/markup-arc-ref.ts
    - src/renderer/src/components/CanvasViewport.tsx

key-decisions:
  - "Made the Arc read seam REACTIVE (subscribe/notify) rather than a bare module-var getter: Shift+A flips arcMode with NO coincident store change, so a non-observable read would leave ToolRail/ContextBar stale (Pitfall 1 / R-2)"
  - "Arc flags stay OFF any store — the seam is a runtime-only in-memory boolean + listener Set, never serialized, honoring locked Phase-14 decision (STATE.md:183)"
  - "Single publish point: one CanvasViewport useEffect keyed on markupState.arcMode; no cleanup reset (seam retains last value on unmount — harmless, chrome not visible without canvas)"

patterns-established:
  - "Reactive module-ref seam: getSnapshot (stable primitive) + subscribe/unsubscribe pair for cross-surface reads of React-owned state without store coupling"

requirements-completed: [SC-2, SC-3]

# Metrics
duration: 7 min
completed: 2026-07-14
---

# Phase 18 Plan 04: Reactive Arc On-State Seam Summary

**Reactive `getArcSticky` / `subscribeArcSticky` / `setArcStickyState` seam (useSyncExternalStore-shaped) in markup-arc-ref.ts, published from CanvasViewport, so the Arc on-state is readable and observable by ToolRail/ContextBar — including for keyboard-driven Shift+A toggles.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-14T08:05:00Z
- **Completed:** 2026-07-14T08:11:34Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added a reactive read seam to `markup-arc-ref.ts`: `getArcSticky()` (getSnapshot, stable primitive), `setArcStickyState(on)` (writer — early-returns on unchanged value, sets the flag, then notifies every listener), and `subscribeArcSticky(cb)` (registers a listener, returns an unsubscribe).
- Wired `CanvasViewport.tsx` to publish `markupState.arcMode === 'sticky'` into the seam via a single `useEffect` keyed on `markupState.arcMode`. Because `setArcStickyState` notifies, the `Shift+A` path (which flips arc mode with no coincident store change) re-renders every `useSyncExternalStore(subscribeArcSticky, getArcSticky)` consumer.
- Kept arc flags entirely off any store and off IPC — the seam is a runtime-only in-memory boolean + listener `Set`. Existing setter/getter exports (`setArcHeldHandler`, `setArcStickyToggleHandler`, etc.) are unchanged.
- Turned `src/tests/arc-sticky-seam.test.ts` fully GREEN (6/6), satisfying the RED contract exactly as written (no test edits).

## Task Commits

Each task was committed atomically:

1. **Task 1: reactive getArcSticky/subscribeArcSticky seam + publish arcMode from CanvasViewport** - `329b08e` (feat)

_The RED contract (`arc-sticky-seam.test.ts`) was already committed upstream; this plan provides the GREEN implementation, so Task 1 is a single feat commit._

## Files Created/Modified
- `src/renderer/src/lib/markup-arc-ref.ts` - Added `_arcSticky` boolean + `_arcListeners` Set, and the exported `getArcSticky()` / `setArcStickyState()` / `subscribeArcSticky()` reactive seam.
- `src/renderer/src/components/CanvasViewport.tsx` - Imported `setArcStickyState`; added a `useEffect` (adjacent to the existing arc-ref registration) that publishes `markupState.arcMode === 'sticky'` into the seam on every arc-mode change.

## Decisions Made
- **Reactive seam, not a bare getter.** `getChainArmedItem` stays current only because arming a chain coincides with a `setActiveTool()` store change; Arc has no such coincident change (Shift+A flips `useMarkupTool` local state only), so the seam carries its own subscribe/notify to avoid stale ToolRail/ContextBar chrome (Pitfall 1 / R-2).
- **No store coupling.** Arc flags remain runtime-only, honoring the locked Phase-14 decision (STATE.md:183).
- **No unmount reset.** The publish effect has no cleanup that would reset the seam to a wrong default; on unmount the seam retains its last value (harmless — the toggle chrome is not visible without the canvas).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification

- `npx vitest run src/tests/arc-sticky-seam.test.ts` → **6/6 GREEN** (getter/setter, listener-fires-with-new-value, no-op-does-not-notify, unsubscribe-stops-notifying).
- `npm run typecheck` (typecheck:node + typecheck:web) → **clean**.
- Acceptance greps all match: `export function getArcSticky`, `export function setArcStickyState`, `export function subscribeArcSticky` in `markup-arc-ref.ts`; `setArcStickyState(markupState.arcMode` in `CanvasViewport.tsx`; no store import in `markup-arc-ref.ts`.
- Full suite `npx vitest run` → **795 passed, 1 assertion fail** (`status-line.test.ts` "Set Scale nudge", a pre-existing RED for a different Phase-18 plan — SC-5 — which touches `StatusBar`, a file this plan never modified) plus 10 import-resolution failures for not-yet-landed Phase-18 components (`ToolRail`, `TopActionBar`, etc.). None are regressions from this plan; the change is purely additive (a new getter + subscribe/notify + a one-line publish effect).
- `arc-toggle.test.ts` still RED only on the missing `@renderer/components/ToolRail` import (lands in 18-07) — its `markup-arc-ref` import now resolves, exactly as the plan predicted.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The reactive seam is ready to be consumed by `ToolRail` (18-07) and `ContextBar` (18-08) via `useSyncExternalStore(subscribeArcSticky, getArcSticky)` to render the Arc on-state chrome (SC-2 "Snap/Arc on/off states always visible") — including for keyboard-driven Shift+A toggles (SC-3).
- No blockers.

## Self-Check: PASSED
- `src/renderer/src/lib/markup-arc-ref.ts` — FOUND
- `src/renderer/src/components/CanvasViewport.tsx` — FOUND
- Commit `329b08e` — FOUND in git log

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
