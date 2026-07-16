---
phase: 18-toolbar-revamp
plan: 09
subsystem: ui
tags: [react, konva, zustand, toolbar, keyboard-shortcuts, electron]

# Dependency graph
requires:
  - phase: 18-05
    provides: TopActionBar surface
  - phase: 18-06
    provides: consolidated StatusBar (absorbs old CanvasHeaderBar page/scale + nudge)
  - phase: 18-07
    provides: ContextBar morph states
  - phase: 18-08
    provides: ToolRail + reactive Snap/Arc toggles
provides:
  - Rewired App shell: TopActionBar + ContextBar + ToolRail + single StatusBar; 7-tab ribbon and top CanvasHeaderBar removed
  - Retired components deleted (RibbonToolbar, RibbonButton, legacy Toolbar, CanvasHeaderBar) + orphaned test
  - 18-MANUAL-NOTES.md "what moved where" how-to-manual reference
  - Single-owner keyboard-shortcut invariant (App.tsx is the sole useKeyboardShortcuts caller)
affects: [help-manual, future-toolbar-work, keyboard-shortcuts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyboard shortcuts have exactly ONE owner (App.tsx, always-mounted). Components must never call useKeyboardShortcuts a second time — it registers a duplicate window listener."
    - "ToolRail is a sibling column prepended to the <main> stage row, never a wrapper around the mount-preserving Konva subtree (Pitfall 4)."

key-files:
  created:
    - .planning/phases/18-toolbar-revamp/18-MANUAL-NOTES.md
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/renderer/src/components/ContextBar.tsx
    - src/renderer/src/components/ToolRail.tsx
    - src/renderer/src/stores/viewerStore.ts

key-decisions:
  - "App.tsx is the single keyboard-shortcut owner; the duplicate call in CanvasViewport was the true root cause of the F3 snap-toggle bug and was removed."
  - "ToolRail prepended as first stage-row column (sibling), preserving the Konva Stage mount across Plan|Estimate swaps."
  - "Settings/Help fold into an inert ⋯ overflow; page+scale live only on the single bottom StatusBar."

patterns-established:
  - "Single-owner global listeners: register window keydown/keyup/blur in exactly one always-mounted component; a second caller silently double-fires every shortcut."

requirements-completed: [SC-1, SC-4, SC-5, SC-6]

# Metrics
duration: ~3 sessions (2026-07-14..2026-07-16; dominated by the F3 debug loop)
completed: 2026-07-16
---

# Phase 18 · Plan 09: Integration + Cleanup Summary

**Tab-less toolbar landed: App shell rewired to a persistent left ToolRail + slim TopActionBar + morphing ContextBar + single StatusBar; the 7-tab ribbon and duplicate top page/scale header are gone; four legacy components deleted; and the long-running F3 snap-toggle bug was root-caused to a duplicate keydown listener and fixed.**

## Performance

- **Duration:** ~3 sessions (2026-07-14 → 2026-07-16); most of the wall-clock was the F3 debug loop, not the integration itself
- **Started:** 2026-07-14T17:24:09+08:00 (`37821c7`)
- **Completed:** 2026-07-16T12:57:13+08:00 (`8f0cc54`)
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint) + a 6-item debug loop
- **Files modified:** 6 source + 4 deleted + 1 doc

## Accomplishments
- **SC-1:** App renders the co-visible layout — ToolRail (left column) + TopActionBar + ContextBar + single StatusBar — with NO ribbon and NO top CanvasHeaderBar. The Konva Stage is never conditionally unmounted (rail is a sibling column, not a wrapper).
- **SC-5:** Page + scale appear only on the consolidated bottom StatusBar; Settings/Help collapse to an inert ⋯ overflow.
- **SC-6:** Every prior capability verified working — keyboard shortcuts, chain markup, resume-from-totals arming, calibration, Plan|Estimate swap, Totals, file ops, Show/Hide All. How-to-manual `18-MANUAL-NOTES.md` written.
- Deleted `RibbonToolbar.tsx`, `RibbonButton.tsx`, legacy `Toolbar.tsx`, `CanvasHeaderBar.tsx`, and the orphaned `canvas-header-bar.test.ts`; zero dangling references.
- **Root-caused + fixed the F3 snap-toggle bug** — the last blocker of the human-verify checkpoint (see Issues Encountered).

## Task Commits

1. **Task 1: Rewire App shell (TopActionBar + ContextBar + ToolRail; drop ribbon + CanvasHeaderBar)** — `37821c7` (feat)
2. **Task 2: Delete retired components + orphaned test** — `ac76fc0` (chore)
3. **Task 3: Write 18-MANUAL-NOTES.md** — `529cb36` (docs)
4. **Task 4: Human-verify checkpoint** — APPROVED (user: "Works now as advertised") after the debug loop below

**Debug loop (surfaced during the Task 4 checkpoint):**
- Bug 1 — ContextBar selected-state stole keyboard focus (also unblocked Delete/Shift+A while selected) — `285f3d4`
- Bug 4 — Splitter drag lag/trail — `32e62be` (memoize CanvasViewport) + `935f420` (imperative drag)
- Bug 3 — Arc render desync — `2176405` (verified sound + regression test; was a downstream symptom of Bug 1)
- Declutter — remove armed-item name badge from rail tool buttons — `d967412`
- Bug 2 — F3 snap toggle — earlier attempts `c0cd9a3` (register-once + text-input-guard exemption) and `08be351` (dev-only HMR store singleton), then **true fix `8f0cc54`** (remove duplicate keydown listener)
- Debug records — `b6f5082`, `676ca71`, `4cb52fc`

## Files Created/Modified
- `src/renderer/src/App.tsx` — TopActionBar + ContextBar replace RibbonToolbar; ToolRail prepended as first stage-row column; CanvasHeaderBar mount removed
- `src/renderer/src/components/CanvasViewport.tsx` — removed the redundant `useKeyboardShortcuts` call (F3 fix) + dead `usePdfDocument`/`openPdfDialog`
- `src/renderer/src/components/ContextBar.tsx` — focus-steal fix
- `src/renderer/src/components/ToolRail.tsx` — armed-item badge declutter
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — register-once refactor + F3 exempt from text-input guard
- `src/renderer/src/stores/viewerStore.ts` — dev-only HMR store singleton guard (stripped in prod)
- `.planning/phases/18-toolbar-revamp/18-MANUAL-NOTES.md` — "what moved where" reference
- **Deleted:** `RibbonToolbar.tsx`, `RibbonButton.tsx`, `Toolbar.tsx`, `CanvasHeaderBar.tsx`, `src/tests/canvas-header-bar.test.ts`

## Decisions Made
- **App.tsx is the sole keyboard-shortcut owner.** The F3 bug's true cause was a *second* `useKeyboardShortcuts` call in CanvasViewport (a Plan-04-04 leftover): it registered a duplicate `window` keydown listener whenever a PDF was open, so F3 toggled snap twice per press → net no-op. Removed the redundant call; App already wires every binding.
- Kept `08be351` (dev HMR store singleton) even though it was NOT the F3 cause — it is harmless (stripped from the prod bundle) and legitimately prevents HMR store duplication during development. Orthogonal hardening, not reverted.

## Deviations from Plan
Plan 18-09's three auto-tasks executed as written. The deviation was scope, not code: the Task 4 human-verify checkpoint surfaced 4 bugs + 1 declutter ask that triggered a `/gsd-debug` loop before approval. All were resolved and user-approved.

## Issues Encountered
- **F3 snap toggle did not work when a project was open (the phase's final blocker; ~15+ debug rounds).** Symptom: F3 worked with no project but appeared dead once a PDF was open, and focus-highlighted toolbar buttons. Early theories (HMR store duplication, listener churn) produced partial fixes but never resolved it, because diagnostics-via-HMR masked the real behavior. A **clean-build console diagnostic** was decisive: `e.defaultPrevented` alternated `false`/`true` on handler entry — proving the same keydown event passed through **two** registered listeners. Traced to a duplicate `useKeyboardShortcuts` call in `CanvasViewport` (mounts only with a PDF open → matches the "only broken with a project" symptom). Two listeners double-toggled snap → net zero. Fixed by removing the redundant call (`8f0cc54`). User confirmed on a clean build: Snap toggles once per F3 and snapping engages/disengages. Full write-up in `.planning/debug/resolved/f3-snap-hmr-store-dup-and-rail-badge.md`.
- **Cross-machine test-environment gap (non-blocking):** 7 Phase-18 component test files (`context-bar-edit`, `context-bar-morph`, `status-line`, `top-action-bar-file-ops`, `top-action-bar-nav`, `view-mode-toggle`, `visibility-markdirty`) fail on this machine with `window.localStorage.clear is not a function` — they call `window.localStorage.clear()` instead of installing the in-memory localStorage polyfill the other test files use. Confirmed pre-existing (fails identically at HEAD without this plan's changes). All 817 other tests pass. Flagged as a follow-up.

## User Setup Required
None.

## Next Phase Readiness
- Phase 18 feature-complete: the toolbar revamp (Direction A, "everything one click away") is live and user-approved.
- v1.0 milestone audit (`/gsd-audit-milestone`) remains available — Phase 18 was the last defined phase.
- Follow-up: harden the 7 localStorage-dependent test files so the suite is green cross-machine.

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-16*
