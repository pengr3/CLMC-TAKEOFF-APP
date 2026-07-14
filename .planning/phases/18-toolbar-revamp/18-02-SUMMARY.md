---
phase: 18-toolbar-revamp
plan: 02
subsystem: testing
tags: [vitest, jsdom, react, red-tests, toolbar, top-action-bar, tdd-red]

# Dependency graph
requires:
  - phase: 18-01
    provides: Wave 0 RED-test harness conventions (createRoot/act, CanvasViewport mock, testid contract)
provides:
  - Four RED test files encoding the TopActionBar SC-5/SC-6 behavior-parity contract (file ops, page/zoom/totals nav, standalone Plan|Estimate toggle with no reset, Show/Hide All markDirty)
  - Retirement of five obsolete tests whose premises this phase voids (legacy Toolbar.tsx importers + the tab-leave reset test, R-1)
affects: [18-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED test via unresolved import of a not-yet-built component (@renderer/components/TopActionBar) — fails at module resolution, turns GREEN when 18-05 lands"
    - "aria-label/title dual selector so a RED test matches whichever attribute the GREEN source uses"
    - "markDirty() spy via vi.spyOn(useProjectStore.getState(), 'markDirty') to lock Pitfall 7"

key-files:
  created:
    - src/tests/top-action-bar-file-ops.test.ts
    - src/tests/top-action-bar-nav.test.ts
    - src/tests/view-mode-toggle.test.ts
    - src/tests/visibility-markdirty.test.ts
  modified:
    - .planning/phases/18-toolbar-revamp/18-VALIDATION.md
  deleted:
    - src/tests/ribbon-leave-estimating-reveals-plan.test.ts
    - src/tests/toolbar-open-prop.test.ts
    - src/tests/toolbar-export-button.test.ts
    - src/tests/toolbar-replace-pdf.test.ts
    - src/tests/toolbar-saving-disabled.test.ts

key-decisions:
  - "Retire the tab-leave reset test (R-1) rather than migrate it: with the 7-tab ribbon gone there is no tab-leave event, so the standalone toggle needs no reset effect"
  - "Query Save/Save As/Totals by a combined [aria-label], [title] selector so the RED test binds to whichever attribute 18-05 emits (contract says 'aria-label/title')"

patterns-established:
  - "Pattern: standalone-toggle no-reset assertion — after selecting Estimate, re-render the bar and assert viewMode stays 'estimate' (would fail if a ported reset useEffect existed)"

requirements-completed: []  # SC-5/SC-6 are RED here; they complete when 18-05 turns these tests GREEN

# Metrics
duration: 7 min
completed: 2026-07-14
---

# Phase 18 Plan 02: TopActionBar RED Test Surface Summary

**Four RED Vitest files pin the slim TopActionBar's SC-5/SC-6 behavior-parity contract (file ops + disabled derivations, page/zoom/totals nav, standalone Plan|Estimate toggle with no reset, Show/Hide All markDirty), and five obsolete Toolbar/ribbon-reset tests are retired — all four new files fail RED on the missing `@renderer/components/TopActionBar` module until 18-05.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-14T07:38:58Z
- **Completed:** 2026-07-14T07:46:08Z
- **Tasks:** 3
- **Files touched:** 10 (4 created, 5 deleted, 1 modified)

## Accomplishments
- `top-action-bar-file-ops.test.ts` — Open aria-label + `onOpenClick` firing (migrated from `toolbar-open-prop`), Save/Save As/Replace/Export disabled derivations against the exact contract predicates, Replace/Export prop firing.
- `top-action-bar-nav.test.ts` — page prev/next bounds + `currentPage` advance, zoom in/out/Fit dispatch through `getCanvasControls()` spies with disable at MIN_ZOOM/MAX_ZOOM/no-PDF, Totals toggle `setTotalsOpen` negation + `aria-pressed`.
- `view-mode-toggle.test.ts` — radiogroup + `view-mode-plan`/`view-mode-estimate` radios, both-direction toggle, `aria-checked` flip, and the crux explicit **no-reset** assertion (R-1).
- `visibility-markdirty.test.ts` — Show All AND Hide All both call `markDirty()` (Pitfall 7), Hide All builds `name|categoryId` keys, Hide All disabled at no-markups.
- Retired five tests whose premises this phase voids and updated `18-VALIDATION.md` (map rows + Wave 0 checklist).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED file-ops + disabled derivations** - `2073931` (test)
2. **Task 2: RED page/zoom/totals nav** - `721a7a1` (test)
3. **Task 3: standalone view-mode + visibility RED tests; retire 5 obsolete tests** - `8afeea0` (test)

**Plan metadata:** committed separately with this SUMMARY (docs).

## Files Created/Modified
- `src/tests/top-action-bar-file-ops.test.ts` — RED: Open prop + file-ops disabled derivations
- `src/tests/top-action-bar-nav.test.ts` — RED: page/zoom (getCanvasControls) + Totals nav
- `src/tests/view-mode-toggle.test.ts` — RED: standalone Plan|Estimate toggle, no reset (R-1)
- `src/tests/visibility-markdirty.test.ts` — RED: Show/Hide All markDirty (Pitfall 7)
- `.planning/phases/18-toolbar-revamp/18-VALIDATION.md` — flipped 18-02 map rows to ✅ W0 and checked the Wave 0 boxes
- **Deleted** (retired): `ribbon-leave-estimating-reveals-plan.test.ts`, `toolbar-open-prop.test.ts`, `toolbar-export-button.test.ts`, `toolbar-replace-pdf.test.ts`, `toolbar-saving-disabled.test.ts`

## Decisions Made
- **Combined `[aria-label], [title]` selector** for Save / Save As / Totals: the 18-02 contract states "aria-label/title", so the RED test binds to whichever attribute 18-05's `BarButton` emits — keeping the test robust while still fully specifying the identifier string.
- **Delete, not migrate, the tab-leave reset test:** R-1 removes the reset `useEffect` entirely (no tab → no trigger); the standalone-toggle no-reset assertion in `view-mode-toggle.test.ts` is the replacement contract.
- **Spy `markDirty` directly** (`vi.spyOn(useProjectStore.getState(), 'markDirty')`) rather than only inferring via `isDirty`, matching the Pitfall-7 intent that BOTH visibility handlers explicitly call it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All four new files fail RED for the intended reason — `Failed to resolve import "@renderer/components/TopActionBar"` (missing not-yet-built component), confirmed both per-file and in the full-suite run. The five `git rm` deletions caused no dangling-import failures; the remaining suite collects cleanly (full run: 9 failing files = the 5 Wave-0 RED files from 18-01 + these 4, 786 tests passing).

## Known Stubs
None — this is a test-only plan; no production stubs introduced.

## Threat Flags
None — test-only plan (matches the plan's `T-18-02-NA` accept disposition; no new runtime, IPC, or persisted surface).

## Next Phase Readiness
- The RED contract for `TopActionBar` is fully encoded and addressable by the exact selectors 18-05's `testid_contract` promises to satisfy. When 18-05 lands `src/renderer/src/components/TopActionBar.tsx`, these four files turn GREEN with no test edits.
- Worktree mode: STATE.md / ROADMAP.md intentionally NOT modified (orchestrator owns those). SC-5/SC-6 remain incomplete (RED) — they complete at 18-05.

## Self-Check: PASSED
- `top-action-bar-file-ops.test.ts` FOUND, `top-action-bar-nav.test.ts` FOUND, `view-mode-toggle.test.ts` FOUND, `visibility-markdirty.test.ts` FOUND
- 5 retired files confirmed deleted (git status shows D, staged in `8afeea0`)
- Commits `2073931`, `721a7a1`, `8afeea0` all present in `git log`
- All 4 new files RED for the intended missing-module reason

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
