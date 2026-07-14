---
phase: 18-toolbar-revamp
plan: 07
subsystem: ui
tags: [react, toolbar, tool-rail, useSyncExternalStore, snap, arc, konva-free]

# Dependency graph
requires:
  - phase: 18-01
    provides: RED tests + testid contract (rail-tool-*, rail-snap-toggle, rail-arc-toggle, no role=tab)
  - phase: 18-04
    provides: reactive Arc seam (getArcSticky / subscribeArcSticky / setArcStickyState) in markup-arc-ref.ts
provides:
  - "ToolRail.tsx — persistent vertical left tool rail (D-02) replacing the ribbon Tools tab"
  - "One-click Select · Count · Linear · Area · Perimeter · Wall · Set Scale rail buttons with chain badges"
  - "Clickable Snap + Arc toggles rendering their on-state; Arc reactive to Shift+A via useSyncExternalStore"
affects: [18-08-ContextBar, 18-09-App-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React.useSyncExternalStore(subscribeArcSticky, getArcSticky) to reactively render a non-store runtime flag flipped by a keyboard shortcut with no coincident store change"
    - "Local RailButton (48x46) variant of RibbonButton's active/hover/disabled recipe, with separate active (accent-fill) vs on (accent-text+border+dot) chrome"

key-files:
  created:
    - src/renderer/src/components/ToolRail.tsx
  modified: []

key-decisions:
  - "Arc on-state consumed via useSyncExternalStore(subscribeArcSticky, getArcSticky) — not a bare getArcSticky() read — because Shift+A flips arc mode with no store change; only the seam subscription keeps the chrome live"
  - "Snap toggle reads viewerStore.snapEnabled/snapSuspended via selectors so F3/Alt shortcut mutations flip aria-pressed for free (shared field)"
  - "Tool-arm/disarm, chain badges, Set Scale activate/cancel and ScaleContextMenu lifted verbatim from RibbonToolbar (D-08 behavior parity); no new calibration path"
  - "Two atomic commits (tools first, Snap+Arc second) matching the plan's task split"

patterns-established:
  - "Rail toggle chrome: active tool = accent fill + white text; toggle-on = accent text + accent border + accent dot; snap held-off = dimmed"
  - "No tab role anywhere in the rail (SC-1) — verified by grep + DOM assertion"

requirements-completed: [SC-1, SC-2, SC-3]

# Metrics
duration: 15 min
completed: 2026-07-14
---

# Phase 18 Plan 07: ToolRail Summary

**Persistent vertical left tool rail (ToolRail.tsx) that re-homes RibbonToolbar's Tools tab as one-click buttons — Select · Count · Linear · Area · Perimeter · Wall · Set Scale — plus clickable Snap/Arc toggles, with the Arc on-state driven reactively off the 18-04 seam so Shift+A updates the chrome instantly.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-14T08:48Z
- **Completed:** 2026-07-14T09:00Z
- **Tasks:** 2
- **Files created:** 1 (ToolRail.tsx, 435 lines)

## Accomplishments
- Built `ToolRail.tsx` — the tab-less left rail (D-02) with all 9 controls each one click away (SC-1).
- Lifted tool-arm/disarm-on-retap, chain badges, and Set Scale activate/cancel + its `▾`/right-click `ScaleContextMenu` **verbatim** from `RibbonToolbar.tsx` (D-08 behavior parity; no duplicated calibration path — reuses `getCalibrationControls()`).
- Made Snap and Arc clickable toggles that render their on/off state without opening anything (SC-2/SC-3). Snap reads the same `snapEnabled` field F3 mutates; Arc consumes the reactive seam via `useSyncExternalStore(subscribeArcSticky, getArcSticky)` so Shift+A flips the toggle with no other interaction.
- No `role="tab"` anywhere (SC-1); markup tools carry `aria-disabled` when no PDF is loaded.
- Keyboard shortcuts (`useKeyboardShortcuts.ts`) left completely untouched (D-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rail tools + Select + Set Scale (with context menu) + chain badges** — `cec3d2e` (feat)
2. **Task 2: Snap + Arc clickable toggles with reactive on-state chrome** — `40a90b1` (feat)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified
- `src/renderer/src/components/ToolRail.tsx` — new vertical tool rail component; exports `ToolRail`. Contains a local `RailButton` (48x46), a local `ChainBadge`, a `RailDivider`, and the lifted handlers.

## Decisions Made
- **Arc reactivity mechanism:** used `React.useSyncExternalStore(subscribeArcSticky, getArcSticky)` rather than a bare `getArcSticky()` render read (like `getChainArmedItem`). Shift+A flips sticky arc with no coincident store change, so a non-observable read would leave the chrome stale until an unrelated re-render — the seam subscription is the required fix (pinned by `arc-toggle.test.ts`).
- **Snap sync:** read `snapEnabled`/`snapSuspended` via viewerStore selectors so F3/Alt shortcut mutations flip `aria-pressed` with no extra wiring (shared field, proven by `snap-toggle.test.ts`).
- **Icons:** `Magnet` for Snap, `Spline` for Arc (both present in the installed lucide-react 1.6.0), matching the existing lucide icon convention.

## Deviations from Plan

None - plan executed exactly as written.

_Two minor in-task compile fixes were made while authoring the new file (not deviations from plan intent): annotating the `RailButton` `color` local as `string` so it can be reassigned across the `as const` COLORS literals, and rewording a JSDoc comment so the literal `role="tab"` string does not appear in the file (satisfying the SC-1 grep acceptance criterion). Both were part of writing Task 1's file, committed in `cec3d2e`._

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification

- `npx vitest run src/tests/toolrail-tools.test.ts src/tests/toolrail-chain-badge.test.ts src/tests/snap-toggle.test.ts src/tests/arc-toggle.test.ts` → **4 files / 14 tests GREEN**.
- `npm run typecheck` (node + web) → **clean**.
- Full `npx vitest run` → **832 tests passed**; the only 2 failing files are `context-bar-edit.test.ts` and `context-bar-morph.test.ts`, both failing solely because `@renderer/components/ContextBar` does not exist yet (that component lands in 18-08) — expected RED, not a regression.
- Acceptance greps confirmed: `useSyncExternalStore(subscribeArcSticky, getArcSticky)`, `setSnapEnabled(!snapEnabled)`, `getArcStickyToggleHandler()?.()`, `setChainArmedFromTotals(null)` all present; `role="tab"` absent.

## Next Phase Readiness
- ToolRail is standalone and ready for `App.tsx` mounting in **18-09**.
- ContextBar (18-08) will provide the second Snap/Arc surface (D-04) that mutates the same viewerStore field / arc seam — the reactive patterns established here carry over.
- RibbonToolbar is intentionally NOT deleted yet (retired during 18-09 integration).

## Self-Check: PASSED
- `src/renderer/src/components/ToolRail.tsx` — FOUND (435 lines, exceeds min_lines 200; exports `ToolRail`)
- Commit `cec3d2e` — FOUND
- Commit `40a90b1` — FOUND

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
