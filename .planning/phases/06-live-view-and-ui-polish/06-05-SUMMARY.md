---
phase: 06-live-view-and-ui-polish
plan: "05"
subsystem: ui
tags: [react, totals-panel, boq, electron, jsdom, vitest, zustand, clipboard, cycle-navigation, context-menu]

# Dependency graph
requires:
  - phase: 06-live-view-and-ui-polish
    provides: TotalsPanel + TotalsRow render tree (06-04) — row shell this plan wires interactions into
  - phase: 06-live-view-and-ui-polish
    provides: useMarkupHighlight (06-02) — hover and pulse triggers driven by row interactions
  - phase: 06-live-view-and-ui-polish
    provides: HoverRing + PulseHighlight (06-03) — overlay components activated by onTriggerPulse
provides:
  - TotalsRowContextMenu — right-click "Copy as text" context menu (D-14) mirroring MarkupContextMenu structure
  - Cycle navigation wired into TotalsRow (D-10): click cycles through pages with matching markups, wrapping on last
  - Hover wired into TotalsRow (D-11): mouseEnter passes current-page-only matches to onHover; mouseLeave clears
  - Right-click wired into TotalsRow: fires onContextMenu(x, y) so parent mounts TotalsRowContextMenu at cursor
  - labelToName + matchMarkupsOnPage + findPagesWithMatches module-level helpers in TotalsRow
affects: [06-07-app-shell-integration, 06-08-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "defer-listener-registration: setTimeout(0) before adding mousedown/keydown listeners prevents same-click dismissal — mirrored verbatim from MarkupContextMenu.tsx"
    - "row-owns-cycle-state: TotalsRow holds internalCycleIndex in useState and calls viewerStore.setPage() directly — no parent orchestration needed for cycle advancement"
    - "perimeter-rowtype-collapse: both perimeter-length and perimeter-area BoqRowType values map to underlying Markup.type 'perimeter' for hover/cycle match resolution"
    - "void-async-handler: onClick fires void handleCopyAsText() so the button handler stays synchronous while the async clipboard write resolves independently"

key-files:
  created:
    - src/renderer/src/components/TotalsRowContextMenu.tsx
  modified:
    - src/renderer/src/components/TotalsRow.tsx
    - src/tests/totals-row-context-menu.test.ts
    - src/tests/totals-row-cycle.test.ts
    - src/tests/totals-row-hover.test.ts

key-decisions:
  - "TotalsRowContextMenu is a 1:1 structural mirror of MarkupContextMenu — same defer-listener-registration, same fixed-position container style, same outside-click/Escape dismissal"
  - "Clipboard payload format is type-discriminated: count → Math.round (integer, no decimal); all others → .toFixed(2) — locked by UI-SPEC"
  - "TotalsRow holds internal cycleIndex in useState, not in parent state — the row knows its own cycle position; mouse-leave resets it (D-10 'until row-leave')"
  - "onTriggerPulse is optional on TotalsRowProps — plans that don't wire the pulse (e.g. test scaffolds) can omit it without prop drilling errors"
  - "labelToName regex strips D-02 disambiguation suffix (count|linear|area|perimeter) before match resolution so underlying Markup.name comparisons work correctly"

patterns-established:
  - "Context menu lifecycle pattern: parent mounts context menu via onContextMenu(x,y) callback; menu self-dismisses via onClose; parent clears contextMarkup state — exact mirror of MarkupContextMenu integration in CanvasViewport"

requirements-completed: [VIEW-01]

# Metrics
duration: ~2 sessions (RED + GREEN split across billing cycle boundary)
completed: 2026-05-12
---

# Phase 06 Plan 05: TotalsRow Interaction Wiring Summary

**TotalsRowContextMenu component + cycle navigation + hover + right-click handlers wired into TotalsRow. Completes the D-10/D-11/D-14 interaction suite for the BOQ TotalsPanel (Wave 3b).**

## Performance

- **Duration:** 2 sessions (RED in session 1; GREEN written and verified in session 2 after billing cycle reset)
- **Completed:** 2026-05-12
- **Tasks:** 1 (combined: RED + GREEN for TotalsRowContextMenu + TotalsRow wiring)
- **Files created:** 1 (TotalsRowContextMenu.tsx)
- **Files modified:** 1 component (TotalsRow.tsx) + 3 test files
- **Tests flipped GREEN:** 3 (totals-row-context-menu, totals-row-cycle, totals-row-hover)
- **Tests passing:** 18/18

## Accomplishments

- TotalsRowContextMenu is a clean 1:1 structural mirror of MarkupContextMenu: deferred listener registration, outside-click/Escape dismissal, fixed-position container, `role="menu"`, aria-label
- Clipboard payload precisely follows the locked UI-SPEC contract: count rows produce integer-only strings (`Math.round`), all other types produce two-decimal strings (`.toFixed(2)`)
- `navigator.clipboard.writeText` failure path fires `onCopyError()` → caller can show 'Copy failed.' toast without the menu component owning the toast lifecycle
- Cycle navigation (D-10): TotalsRow owns `internalCycleIndex` in `useState`; each click advances to the next page in `pagesWithMatches` (ascending sorted), wraps on the last, resets on mouse-leave. No parent orchestration required
- Hover (D-11): `onMouseEnter` passes current-page-only matches resolved by `matchMarkupsOnPage`; `onMouseLeave` clears with `onHover([])`; no debounce (instant per UI-SPEC)
- Module-level helpers (`labelToName`, `rowTypeToMarkupType`, `matchMarkupsOnPage`, `findPagesWithMatches`) are not exported — internal to TotalsRow, not shared across files

## Task Commits

RED gate:
- **RED — TotalsRowContextMenu + cycle navigation + hover assertions** — `90ca3ab`

GREEN gate (WIP-committed in session 1, verified GREEN in session 2):
- **GREEN WIP — TotalsRowContextMenu + TotalsRow handler wiring** — `e8e7e67`
- **WIP pause commit** — `7f859c1` (STATE.md update at billing-limit pause)

Tests verified GREEN on resume (session 2, 2026-05-12):
- All 18 assertions pass; TypeScript compilation clean

## Files Created/Modified

- `src/renderer/src/components/TotalsRowContextMenu.tsx` *(new)* — right-click context menu for BOQ item rows. Props: `screenPos`, `item: BoqItemRow`, `onClose`, `onCopy`, `onCopyError`. Clipboard write builds tab-separated payload discriminated by `item.type`. Defer-listener-registration mirrors MarkupContextMenu verbatim
- `src/renderer/src/components/TotalsRow.tsx` *(modified)* — added `internalCycleIndex` state, `setPage` + `pageMarkupsAll` store reads, `pagesWithMatches` memo, `handleClick` cycle navigator, `handleMouseEnter/Leave` hover wiring, `handleContextMenu`. Also added module-level helpers: `labelToName`, `rowTypeToMarkupType`, `matchMarkupsOnPage`, `findPagesWithMatches`
- `src/tests/totals-row-context-menu.test.ts` — 9 assertions: right-click opens menu at cursor coords; "Copy as text" button present; count clipboard payload (integer); length/area payload (.toFixed(2)); success fires onCopy with label; failure fires onCopyError; Escape closes; outside-click closes; defer-listener pattern verified
- `src/tests/totals-row-cycle.test.ts` — 5 assertions: click → page 1; click → page 2; wrap on third click back to page 1; setPage called with correct target; no navigation when no matches
- `src/tests/totals-row-hover.test.ts` — 4 assertions: mouseEnter → onHover with current-page matches; mouseLeave → onHover([]); no cross-page matches in hover result; reset cycleIndex on leave

## Decisions Made

- **1:1 MarkupContextMenu mirror.** The plan specified structural equivalence for a reason: the dismiss pattern (defer-listener + outside-click + Escape) is battle-tested. Copying verbatim avoids divergence.
- **TotalsRow owns its own cycle state.** The parent (TotalsCategoryBlock / TotalsPanel) does not need to track `cycleIndexByKey` — the plan 06-04 `cycleIndex` prop is still accepted but the internal `internalCycleIndex` is the authoritative counter. This means the row is fully self-contained for cycle navigation and the prop is a no-op legacy hook.
- **`onTriggerPulse` is optional.** Callers that haven't wired the pulse (test scaffolds, plan 06-06's thumbnail strip) can pass nothing without TypeScript errors.

## Deviations from Plan

No deviations. The GREEN code (WIP-committed at `e8e7e67` before the billing limit) was already correct. Session 2 ran the three test files cold and all 18 passed without any iteration.

The plan stated 17 assertions; the executor wrote 9 in the context menu test file (one extra: defer-listener verification), producing 18 total. This is a positive deviation — added coverage without relaxing any existing assertions.

## Issues Encountered

- **Org API billing limit hit mid-execution.** The executor was about to run vitest when the usage limit fired. WIP code was committed (`e8e7e67`) and the worktree merged into master before cleanup. On resume the code passed immediately — no fixes required.

## TDD Gate Compliance

RED scaffold committed at `90ca3ab` (17 assertion stubs across 3 test files). GREEN implementation committed as WIP at `e8e7e67` and verified in session 2 — all 18 tests GREEN (executor added one assertion to the context menu suite, increasing coverage).

## User Setup Required

None — purely renderer code. No env vars, no IPC, no native dependencies.

## Threat Flags

- **T-06-05-01 (Tampering — clipboard write with user-controlled item names): accept.** The clipboard write is user-initiated (right-click → "Copy as text"); the user is copying their own markup names/quantities. No sanitization needed.
- **T-06-05-02 (DoS — context menu staying open after navigation): mitigate.** `cycleIndex` resets on `mouseLeave`; context menu closes on `outside-click`/`Escape`.
- **T-06-05-03 (EoP — defer-listener bypass): mitigate.** `setTimeout(0)` defers listener registration past the triggering event — exact mirror of MarkupContextMenu, already proven in production.

## Self-Check: PASSED

Verified:
- `src/renderer/src/components/TotalsRowContextMenu.tsx` exists ✓
- `src/renderer/src/components/TotalsRow.tsx` modified with cycle + hover + contextmenu handlers ✓
- defer-listener `}, 0)` appears once in TotalsRowContextMenu.tsx ✓
- `navigator.clipboard.writeText` present in TotalsRowContextMenu.tsx ✓
- Section header "Item" present in JSX (line 103) ✓
- All 18 plan-05 test assertions GREEN: `npx vitest run src/tests/totals-row-context-menu.test.ts src/tests/totals-row-cycle.test.ts src/tests/totals-row-hover.test.ts` exits 0 ✓
- TypeScript compilation clean (`npx tsc --noEmit` exits 0) ✓

## Next Phase Readiness

Plan 06-06 (Wave 4 — Thumbnail strip) is now unblocked:
- `useThumbnailRender` hook + `Thumbnail` component + `ThumbnailStrip` component
- Depends on 06-01 (useBoqLive) and 06-02 (useUiPanels) — both complete
- Independent of the TotalsPanel stack (no shared files)

Plan 06-07 (App.tsx three-column shell + CanvasViewport Layer 2 wiring) depends on 06-04, 06-05, and 06-06 — all will be complete after Wave 4.

No blockers.

---
*Phase: 06-live-view-and-ui-polish*
*Completed: 2026-05-12*
