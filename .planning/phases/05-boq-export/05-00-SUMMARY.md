---
phase: 05-boq-export
plan: 00
subsystem: testing
tags: [vitest, exceljs, csv-stringify, boq-types, red-tests, tdd]

requires:
  - phase: 04.1-zip-embedded-clmc
    provides: atomicWriteFile pattern (.tmp + rename) reused by Phase 5 IPC handlers
provides:
  - exceljs@4.4.0 + csv-stringify@6.7.0 runtime deps
  - BoqStructure type tree (BoqMetadata, BoqRowType, BoqItemRow, BoqSubtotal, BoqCategoryGroup, BoqStructure, AggregateOptions, ExportResult)
  - projectStore.isExporting + setExporting (D-19 race guard)
  - 8 RED test files covering aggregator, writers, IPC, modal, hook, Toolbar button, keyboard shortcut
affects: 05-01, 05-02, 05-03, 05-04, 05-05

tech-stack:
  added: [exceljs@^4.4.0, csv-stringify@^6.7.0]
  patterns: [renderer-side BoqStructure type as single source of truth (Q4 — main duplicates inline), AggregateOptions inversion-of-control for test fixtures]

key-files:
  created:
    - src/renderer/src/lib/boq-types.ts
    - src/tests/boq-aggregator.test.ts
    - src/tests/boq-writers-xlsx.test.ts
    - src/tests/boq-writers-csv.test.ts
    - src/tests/boq-export-ipc.test.ts
    - src/tests/uncalibrated-export-warning-modal.test.ts
    - src/tests/toolbar-export-button.test.ts
    - src/tests/use-export-hook.test.ts
    - src/tests/use-keyboard-shortcuts-export.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/renderer/src/stores/projectStore.ts
    - src/tests/project-store.test.ts

key-decisions:
  - "Wave 0 installs runtime deps (not dev deps) so Wave 1 implementations resolve at runtime — D-22, D-23, RESEARCH §1"
  - "BoqStructure lives at src/renderer/src/lib/boq-types.ts with main duplicating inline in boq-writers.ts (Q4 — mirrors existing ReadProjectResult inline-duplication pattern at preload/index.ts:7-11)"
  - "isExporting joins isSaving as a separate race-guard field (D-19, RESEARCH §7) — symmetry with existing save flow"
  - "All 8 RED tests use deterministic in-memory fixtures (no PDF reads); 1mm = 1px scale to make pixelLengthToReal a pass-through and keep math trivial"

patterns-established:
  - "RED-test scaffold pattern: every test imports a not-yet-existing symbol so the failure mode is module-resolution / undefined-export, NOT runtime crash that kills the whole runner"
  - "Cross-file structural type lock: tests import BoqStructure from '@renderer/lib/boq-types' AND from '../main/boq-writers' wrappers — if main's inline duplicate drifts, TS compile fails (T-05-00-03 mitigation)"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~6min (orchestrator-applied recovery; original parallel agents partially executed before usage cap)
completed: 2026-05-02
---

# Plan 05-00: RED-test scaffold and shared-type setup — Summary

**Wave 0 lands the BoqStructure type tree, two new runtime deps (exceljs + csv-stringify), and 8 RED test files that drive Wave 1–3 implementation.**

## Performance

- **Duration:** ~6 min (orchestrator recovery after parallel-agent usage cap)
- **Tasks:** 3/3 (Task 1 GREEN: deps + types + isExporting; Task 2 RED: aggregator + writers + IPC tests; Task 3 RED: modal + Toolbar + hook + shortcut tests)
- **Files modified:** 13

## Accomplishments
- exceljs@4.4.0 and csv-stringify@6.7.0 installed (smoke-tested via `node -e require()`)
- 8 interfaces/types exported from `boq-types.ts` (single source of truth for the renderer; main duplicates inline)
- `projectStore.isExporting` + `setExporting()` wired and tested (3 GREEN tests in `project-store.test.ts`)
- 8 RED test files — 5 still RED awaiting Plans 05-03 / 05-04 / 05-05 (boq-export-ipc, uncalibrated-export-warning-modal, toolbar-export-button, use-export-hook, use-keyboard-shortcuts-export); 3 went GREEN immediately when Plans 05-01 + 05-02 landed in the same wave (boq-aggregator, boq-writers-xlsx, boq-writers-csv)

## Task Commits

1. **Task 1: deps + boq-types.ts + isExporting** — `abd3739` (feat)
2. **Task 2: RED tests for aggregator + writers + IPC** — `e209522` (test)
3. **Task 3: RED tests for modal + Toolbar + hook + shortcut** — `dcc346a` (test)

## Deviations from Plan

### Recovery from parallel-execution usage cap

The original three Wave 1 executor agents were terminated mid-execution by an Anthropic usage cap. Plan 05-00's first agent committed Task 1 only (1/3) and left Task 2's 4 test files uncommitted in its worktree; Task 3 was never started. The orchestrator recovered by:

1. Cherry-picking the existing Task 1 commit from the worktree (`bba0ddb` → `abd3739`)
2. Copying the 4 uncommitted Task 2 test files from the worktree into the main tree and committing them
3. Authoring the 4 missing Task 3 test files inline using the exact contents specified in the plan
4. Running `npm install` on the main tree to resolve the new deps (worktree had local node_modules that didn't carry over)

No content changes from plan-as-written. All RED tests fail with the expected import-resolution / undefined-symbol pattern. All GREEN tests pass.

## Verification

- `npm run typecheck` passes (after `c766e74` fix to writeBuffer cast in plan 05-02 for Buffer type compatibility)
- 51 GREEN tests pass across project-store, boq-aggregator, boq-writers-xlsx, boq-writers-csv, project-io
- 9 RED tests fail across boq-export-ipc, uncalibrated-export-warning-modal, toolbar-export-button, use-export-hook, use-keyboard-shortcuts-export — all import-resolution failures awaiting Wave 2-4 implementations
- `node -e "console.log(require('./node_modules/exceljs/package.json').version)"` → `4.4.0`
- `node -e "console.log(require('./node_modules/csv-stringify/package.json').version)"` → `6.7.0`

## Wave 0 → Wave 1 handoff

The aggregator (Plan 05-01) and writers (Plan 05-02) consume `BoqStructure` from `@renderer/lib/boq-types`. Both went GREEN against the RED scaffolds in this plan during the same wave.

Wave 2 (Plan 05-03 — IPC triad) will turn `boq-export-ipc.test.ts` GREEN. Wave 3 (Plan 05-04 — useExport + UncalibratedExportWarningModal) turns 3 more files GREEN. Wave 4 (Plan 05-05 — Toolbar Export button + Ctrl+Shift+E) turns the last 2 GREEN.
