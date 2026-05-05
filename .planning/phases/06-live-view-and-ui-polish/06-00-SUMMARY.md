---
phase: 06-live-view-and-ui-polish
plan: "00"
subsystem: testing
tags: [vitest, tdd, red-stubs, nyquist, scaffold]

requires:
  - phase: 05-boq-export
    provides: boq-aggregator + BoqStructure (the contract Wave 0's TotalsPanel stubs target)
provides:
  - "15 RED test files under src/tests/ — every Wave 0 future module has a failing-import vitest stub"
  - "Nyquist feedback loop: every behavior in 06-VALIDATION.md rows 1-18 has an executable verify command"
  - "Acceptance-criteria backbone for Plans 06-01 through 06-08 — implementation in those plans must turn RED stubs GREEN"
affects: [06-01, 06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08]

tech-stack:
  added: []
  patterns:
    - "Wave 0 RED-stub idiom: vitest file imports the future module (Cannot-find-module = genuine RED), it.todo entries enumerate behaviors verbatim from VALIDATION.md"
    - "Stub uses `void <Imported>` to keep TS strict-unused-import happy without writing assertions that could accidentally pass"

key-files:
  created:
    - "src/tests/use-boq-live.test.ts"
    - "src/tests/totals-panel-render.test.ts"
    - "src/tests/totals-row-cycle.test.ts"
    - "src/tests/totals-row-hover.test.ts"
    - "src/tests/totals-row-context-menu.test.ts"
    - "src/tests/totals-panel-category-collapse.test.ts"
    - "src/tests/totals-panel-empty-states.test.ts"
    - "src/tests/canvas-header-bar.test.ts"
    - "src/tests/thumbnail-strip-click.test.ts"
    - "src/tests/thumbnail-lazy-mount.test.ts"
    - "src/tests/thumbnail-overlay-debounce.test.ts"
    - "src/tests/use-page-labels.test.ts"
    - "src/tests/use-ui-panels.test.ts"
    - "src/tests/pulse-highlight-animation.test.ts"
    - "src/tests/highlight-overlay-listening.test.ts"
  modified: []

key-decisions:
  - "Stubs use relative `../renderer/src/...` imports (per plan), not the `@renderer` alias — both produce module-not-found, relative form keeps the failure source-of-truth visible at a glance"
  - "Each stub adds a `void <Symbol>` line to silence TS6133 (unused import) so vitest's transform stays parseable; the import error is the RED state, not a TS-side syntax error"
  - "it.todo entries map 1:1 to VALIDATION.md row text — preserves traceability when later plans flip todos to real assertions"

patterns-established:
  - "Wave 0 RED-stub file shape: `import { describe, it } from 'vitest'` + `import { Future } from '../renderer/src/<path>'` + `void Future` + `describe(...)` block of `it.todo(...)` entries"
  - "Acceptance check pattern: `npx vitest run -- <stub>.test.ts` exits non-zero with `Cannot find module '...'` — the stub is GREEN-ready when implementer can flip todos to real assertions and the import resolves"

requirements-completed: [VIEW-01, PDF-05]

duration: 6min
completed: 2026-05-05
---

# Phase 6 Plan 00: Wave 0 RED Stubs Summary

**15 vitest RED-stub files scaffolded — every Wave 0 future module (TotalsPanel, ThumbnailStrip, PulseHighlight, CanvasHeaderBar, useBoqLive, useUiPanels, etc.) now fails import resolution before implementation begins, establishing the Nyquist feedback loop for Phase 6 Waves 1-6.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T16:00:00Z
- **Completed:** 2026-05-05T16:06:00Z
- **Tasks:** 2 (atomic batch commits)
- **Files created:** 15
- **Files modified:** 0

## Accomplishments

- 15 RED test files created under `src/tests/` — each fails with `Cannot find module ...` against a future Wave 1+ module
- All 15 files map 1:1 to VALIDATION.md rows 1-18 (rows 13, 15, 18 are sub-tests inside their parent files, per the validation map)
- Pre-existing 344 tests still pass; only the 15 new stub files fail (genuine RED, not regression)
- VALIDATION.md `wave_0_complete` precondition is now satisfied — `nyquist_compliant: true` can be flipped after this plan's commits

## Task Commits

1. **Task 1: Wave 0 RED stubs (totals panel + canvas header, 8 files)** — `f59af5d` (test)
2. **Task 2: Wave 0 RED stubs (thumbnails + hooks + highlights, 7 files)** — `41c50b2` (test)

**Plan metadata:** _pending — created with this SUMMARY commit._

## Files Created

### Task 1 — Totals panel suite (8 files)

- `src/tests/use-boq-live.test.ts` — VIEW-01 aggregator subscription
- `src/tests/totals-panel-render.test.ts` — TotalsPanel renders BoqStructure
- `src/tests/totals-row-cycle.test.ts` — D-10 cycle navigation
- `src/tests/totals-row-hover.test.ts` — D-11 hover → HoverRing
- `src/tests/totals-row-context-menu.test.ts` — D-14 Copy as text
- `src/tests/totals-panel-category-collapse.test.ts` — D-13 collapse persistence
- `src/tests/totals-panel-empty-states.test.ts` — D-09 three variants
- `src/tests/canvas-header-bar.test.ts` — D-20 conditional Set Scale link

### Task 2 — Thumbnails + hooks + highlights (7 files)

- `src/tests/thumbnail-strip-click.test.ts` — PDF-05 click → setPage
- `src/tests/thumbnail-lazy-mount.test.ts` — D-17 IntersectionObserver gate
- `src/tests/thumbnail-overlay-debounce.test.ts` — D-19 200ms refresh
- `src/tests/use-page-labels.test.ts` — D-16 getPageLabels fallback
- `src/tests/use-ui-panels.test.ts` — D-03 localStorage parse / write / reset
- `src/tests/pulse-highlight-animation.test.ts` — D-12 1500ms fade + rAF cleanup
- `src/tests/highlight-overlay-listening.test.ts` — D-11/D-12 listening={false} regression guard

## Decisions Made

- **Relative imports over `@renderer` alias** — Plan specified `'../renderer/src/...'`; mirrors the future-module location explicitly, keeping the failure path visible without consulting `vitest.config.ts`
- **`void <Symbol>` after each import** — Suppresses TS6133 (declared-but-unused) so vitest's TypeScript transform doesn't flag a syntax-style error; the genuine RED is the import-resolution failure
- **`it.todo` entries verbatim from VALIDATION.md** — Preserves traceability so each todo flip in Waves 1-6 can be diff-checked against the validation contract

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Verification commands matched plan expectations exactly:
- Task 1 verify: `Cannot find module '../renderer/src/hooks/useBoqLive'` printed for `use-boq-live.test.ts` (and 7 sibling stubs)
- Task 2 verify: `Cannot find module 'CanvasHeaderBar' / 'HoverRing' / 'PulseHighlight' / 'Thumbnail' / 'useThumbnailRender'` etc., all matching grep `(FAIL|Cannot find module|Error)`
- Full-suite snapshot: `Test Files 15 failed | 45 passed (60), Tests 344 passed (344)` — exactly the expected RED/GREEN split (15 new stubs RED, all prior tests still passing)

## Verification Evidence

```
$ npx vitest run -- src/tests/use-boq-live.test.ts
...
Test Files  8 failed | 45 passed (53)
Tests       344 passed (344)

$ npx vitest run -- src/tests/thumbnail-strip-click.test.ts src/tests/use-ui-panels.test.ts src/tests/pulse-highlight-animation.test.ts
...
Test Files  15 failed | 45 passed (60)
Tests       344 passed (344)
```

The vitest CLI does not narrow execution via `--`-separated paths in this repo's setup (it runs the full include glob), but the relevant assertion holds: every new stub appears as a `FAIL <file> · Error: Cannot find module ...` and exit status is non-zero. This is exactly the genuine-RED state required by the plan.

## Self-Check: PASSED

- All 15 RED stub files exist on disk under `src/tests/`
- SUMMARY file exists at `.planning/phases/06-live-view-and-ui-polish/06-00-SUMMARY.md`
- Both task commits found in `git log --oneline --all`: `f59af5d`, `41c50b2`
- vitest run produces 15 new file failures with `Cannot find module ...` import errors (matches plan acceptance)

## Next Phase Readiness

- Wave 1 plans (06-01 thumbnail strip, 06-02 totals panel core, etc.) can now begin — every future module has a failing test waiting to be turned green
- VALIDATION.md frontmatter `wave_0_complete: false` should be flipped to `true` and `nyquist_compliant: true` set, then committed by the orchestrator (or in the same metadata commit if this executor owns it)
- No blockers; no architectural deviations

---
*Phase: 06-live-view-and-ui-polish*
*Plan: 00 (Wave 0 RED scaffold)*
*Completed: 2026-05-05*
