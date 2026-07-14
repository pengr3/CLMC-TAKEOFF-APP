---
phase: 18-toolbar-revamp
plan: 01
subsystem: testing
tags: [vitest, jsdom, react-dom, useSyncExternalStore, tdd-red, toolrail, arc-seam]

requires:
  - phase: 18-toolbar-revamp
    provides: "18-RESEARCH Validation Architecture (Wave 0 RED list), testid/arc-seam contracts, 18-PATTERNS R-2 reactive-Arc risk"
provides:
  - "5 RED (intentionally-failing) test files pinning the ToolRail + reactive Arc seam behavior contract for SC-1/SC-2/SC-3"
  - "Executable contract for the getArcSticky/setArcStickyState/subscribeArcSticky seam (getSnapshot + notify-on-real-change), consumed via useSyncExternalStore"
  - "Executable contract for rail tool arm/disarm-on-retap, no role=tab, chain badge gate, Set Scale activate + ScaleContextMenu, aria-disabled at totalPages:0, Snap/Arc aria-pressed"
affects: [18-04 (Arc seam source), 18-07 (ToolRail source)]

tech-stack:
  added: []
  patterns:
    - "RED-first Wave 0: tests import not-yet-built modules; missing-module / undefined-export failures ARE the correct RED signal"
    - "Reactive external-store test: assert a Shift+A-equivalent setArcStickyState re-renders aria-pressed with NO click and NO manual re-render (guards against stale-chrome / non-reactive read)"
    - "jsdom render harness: createRoot + act() with CanvasViewport mocked to keep Konva out (mirrors ribbon-leave-estimating-reveals-plan.test.ts)"

key-files:
  created:
    - src/tests/arc-sticky-seam.test.ts
    - src/tests/toolrail-tools.test.ts
    - src/tests/toolrail-chain-badge.test.ts
    - src/tests/snap-toggle.test.ts
    - src/tests/arc-toggle.test.ts
  modified:
    - .planning/phases/18-toolbar-revamp/18-VALIDATION.md

key-decisions:
  - "arc-sticky-seam is a pure module test (node env, no jsdom); each behavioral assertion is guarded with typeof===function so RED surfaces as a clean assertion failure, not a beforeEach crash"
  - "arc-toggle uses the REAL markup-arc-ref module (only CanvasViewport is mocked) so the reactivity assertion genuinely fails a non-reactive implementation"
  - "Set Scale right-click test seeds scaleStore via setScale(1, 2, DEFAULT_UNIT) because the scale-actions menu is gated on pageScale !== null"

patterns-established:
  - "Wave 0 RED file: header comment states WHY it fails today and WHICH source plan turns it GREEN"
  - "Access mocked module spies (setChainArmedFromTotals, getCalibrationControls().activate) by importing from the mocked module and asserting on the stable spy instances"

requirements-completed: [SC-1, SC-2, SC-3]

duration: 7min
completed: 2026-07-14
---

# Phase 18 Plan 01: ToolRail + Reactive Arc Seam RED Tests Summary

**Five RED Vitest specs that lock the left-ToolRail behavior-parity contract (SC-1/SC-2/SC-3) and the new reactive Arc read seam before any source is written — the arc tests pin genuine `useSyncExternalStore` reactivity so a stale-Arc-chrome regression on Shift+A cannot slip through.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-14T07:23:35Z
- **Completed:** 2026-07-14T07:30:11Z
- **Tasks:** 3
- **Files created:** 5 tests (1 modified planning artifact)

## Accomplishments

- **Task 1** — `arc-sticky-seam.test.ts`: pure-module RED unit test for the `getArcSticky` / `setArcStickyState` / `subscribeArcSticky` seam (18-04 target). Asserts default `false`, set→read round-trip, a registered listener fires on a real change (reading the NEW snapshot when it fires), does NOT fire on a no-op set, and stops firing after unsubscribe. Collects cleanly and fails as 6 assertion failures (`undefined` is not a `function`).
- **Task 2** — `toolrail-tools.test.ts` + `toolrail-chain-badge.test.ts`: jsdom render RED tests for the rail. Pin `data-testid="tool-rail"` + 7 `rail-tool-*` buttons, NO `role="tab"` (SC-1), `aria-pressed` active chrome, disarm-on-retap calling `setChainArmedFromTotals(null)` (P2), `aria-disabled` on markup tools at `totalPages:0`, Set Scale → `getCalibrationControls().activate()`, right-click → `ScaleContextMenu` (`role="menu"`), and the chain badge gate `activeTool===tool && getChainArmedItem()!==null`.
- **Task 3** — `snap-toggle.test.ts` + `arc-toggle.test.ts`: rail Snap toggle asserts `setSnapEnabled` drive AND that an external `snapEnabled` change (the F3 path) flips `aria-pressed` (shared field). Arc toggle uses the REAL `markup-arc-ref` seam: click fires `getArcStickyToggleHandler`, and a Shift+A-equivalent `setArcStickyState(true)` flips `aria-pressed` to `"true"` with NO click and NO manual re-render — a non-reactive read would fail this.
- Updated `18-VALIDATION.md`: 18-01 rows marked File-Exists ✅ W0 / status ❌ red (expected); Wave 0 requirement checkboxes for the five files checked.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED unit test for reactive Arc read seam** — `7288124` (test)
2. **Task 2: RED render tests for rail tools + chain badge** — `918d7aa` (test)
3. **Task 3: RED render tests for rail Snap + Arc toggles** — `c9d2af5` (test)

**Plan metadata:** committed with this SUMMARY + `18-VALIDATION.md` (docs).

## Files Created/Modified

- `src/tests/arc-sticky-seam.test.ts` — RED unit test for the reactive Arc getSnapshot/subscribe seam (→ 18-04)
- `src/tests/toolrail-tools.test.ts` — RED render test: rail tools arm/disarm, active chrome, no role=tab, Set Scale + ScaleContextMenu (→ 18-07)
- `src/tests/toolrail-chain-badge.test.ts` — RED render test: chain badge gate (→ 18-07)
- `src/tests/snap-toggle.test.ts` — RED render test: rail Snap toggle ↔ setSnapEnabled / F3-shared field (→ 18-07)
- `src/tests/arc-toggle.test.ts` — RED render test: rail Arc toggle + REAL reactive seam via useSyncExternalStore (→ 18-04 + 18-07)
- `.planning/phases/18-toolbar-revamp/18-VALIDATION.md` — Per-Task Verification Map + Wave 0 checkboxes updated to reflect the created RED files

## Decisions Made

- **arc-sticky-seam runs in node env (no jsdom), guarded per test.** Each behavioral assertion begins with `expect(typeof <export>).toBe('function')`, so the RED state (missing export → `undefined`) surfaces as a clean, self-documenting assertion failure rather than a "not a function" throw deep in the test or a `beforeEach` crash. Reset in `beforeEach` is guarded the same way.
- **arc-toggle mocks ONLY CanvasViewport and uses the real `markup-arc-ref`.** This is required so the reactivity assertion is real: `act(() => setArcStickyState(true))` must re-render the toggle purely through `useSyncExternalStore(subscribeArcSticky, getArcSticky)`. A mock-and-manual-re-render would mask exactly the stale-chrome regression the checker flagged.
- **Right-click ScaleContextMenu test seeds `scaleStore.setScale(1, 2, DEFAULT_UNIT)`** because the scale-actions affordance / context menu is gated on `pageScale !== null` (parity with `RibbonToolbar` `openContextMenu`).

## Deviations from Plan

None - plan executed exactly as written.

The five files, testid/arc-seam contracts, and per-task verification commands match the plan verbatim. No bugs, missing-critical, or blocking issues were encountered (test-only plan; no packages installed — threat register T-18-01-NA "accept" holds).

## Issues Encountered

None. Each file was verified RED immediately after writing:
- The four render tests fail with `Failed to resolve import "@renderer/components/ToolRail"` — the intended missing-module RED (source lands in 18-07).
- `arc-sticky-seam` fails with 6 assertion failures (`expected 'undefined' to be 'function'`) — the `getArcSticky`/`setArcStickyState`/`subscribeArcSticky` exports land in 18-04.
- `arc-toggle` additionally depends on the same missing seam exports; the dominant collection failure is the missing ToolRail module.

All RED failures are for the intended reasons (missing not-yet-built modules / undefined exports), never syntax or config errors. Changes are purely additive (5 new files), so the existing suite baseline is untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 for plan 18-01 is complete: the ToolRail + reactive-Arc-seam contract is locked and red.
- **18-04** (Arc seam source) turns `arc-sticky-seam.test.ts` GREEN and is a prerequisite for the reactive half of `arc-toggle.test.ts`.
- **18-07** (ToolRail source) turns the four render tests GREEN; it must consume the Arc seam via `useSyncExternalStore(subscribeArcSticky, getArcSticky)` to satisfy `arc-toggle.test.ts`.
- No blockers. STATE.md / ROADMAP.md intentionally NOT modified (worktree mode — orchestrator owns them).

## Self-Check: PASSED

- Files: all 5 test files FOUND on disk (`src/tests/arc-sticky-seam.test.ts`, `toolrail-tools.test.ts`, `toolrail-chain-badge.test.ts`, `snap-toggle.test.ts`, `arc-toggle.test.ts`).
- Commits: `7288124`, `918d7aa`, `c9d2af5` all FOUND in git log.
- Verification: `npx vitest run` on all 5 files → 5 files failed (RED), for the intended reasons.

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
