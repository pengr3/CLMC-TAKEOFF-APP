---
phase: 13-post-commit-step-level-undo
plan: 01
subsystem: testing
tags: [tdd, undo, markup, reopen, types, type-guard, discriminated-union, red-tests]

# Dependency graph
requires:
  - phase: 10-granular-undo-foundation
    provides: "popLastPoint/repushLastPoint hook API; module-level ref pattern (markup-undo-ref) for Ctrl+Z dispatch handoff"
  - phase: 12-markup-geometry-editing
    provides: "vertexEditMarkupId state on viewerStore (D-17 condition 4 trigger guard)"
provides:
  - "MarkupCommand union extended with 'reopen-recommit' variant carrying oldMarkup + newMarkup (D-14, D-15, D-16)"
  - "isMultiPointMarkup(markup) type guard returning true for linear/area/perimeter/wall, false for count (D-12)"
  - "RED test file markup-post-commit-reopen.test.ts (23 it() cases) defining the full Phase 13 contract (SC1-SC5 + EDGE-1/3/4/5)"
  - "Dynamic-import scaffolding via REOPEN_REF_PATH + importReopenRef() helper so Vite's import-analysis pass tolerates a missing @renderer/lib/markup-reopen-ref module at Wave 0"
affects:
  - "Plan 13-02: store branches + commitReopen/removeForReopen/restoreFromReopen actions + markup-reopen-ref module"
  - "Plan 13-03: useMarkupTool activatePreset/commitShape extensions + useKeyboardShortcuts Ctrl+Z branch + CanvasViewport reopenHandler registration + Esc + page-nav cancel + App.tsx reopenToast slot"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union variant carrying full Markup objects (mirrors move-markups shape)"
    - "Type-guard predicate exported from types module (mirrors isMarkupTool in types/viewer.ts)"
    - "Dynamic-string import() with /* @vite-ignore */ to escape Vite's import-analysis pass on yet-to-be-created modules (enables RED-loads-but-fails-at-runtime tests)"

key-files:
  created:
    - "src/tests/markup-post-commit-reopen.test.ts — 893-line RED test file (23 it() cases)"
  modified:
    - "src/renderer/src/types/markup.ts — +24 lines: reopen-recommit variant + isMultiPointMarkup type guard"

key-decisions:
  - "Carry full oldMarkup + newMarkup objects on the reopen-recommit variant (NOT just IDs) — matches the existing STATE.md decision lock 'MarkupCommand stores full Markup object (not just ID)' and the move-markups precedent. Enables undo/redo round-trip without re-querying the store."
  - "Page is implicit (oldMarkup.page === newMarkup.page) — re-open never crosses pages per A4 / D-17 condition 5. JSDoc on the variant documents this; the runtime guard ships in Plan 13-03's reopen handler."
  - "isMultiPointMarkup(markup) uses inverted predicate 'markup.type !== \"count\"' — symmetrical to the count-vs-multi-point split that already exists across the codebase. Future single-point markup types would need explicit handling, but Phase 13's user constraints (D-12) name count as the only single-point category."
  - "Test file uses a dynamic-string import() helper (importReopenRef) instead of a static `await import('@renderer/lib/markup-reopen-ref')` — needed because Vite's import-analysis pass would otherwise fail the entire suite at collection time. The plan's <done> criterion explicitly required tests to fail at assertion level, not at collection. This is a TDD-discipline guardrail and Plan 13-02 will satisfy the missing module without any test-file edit."
  - "23 it() cases (plan minimum was 15) — covers SC1 (×6) + SC2 (×4) + SC3 (×3) + SC4 (×3) + SC5 (×3) + EDGE-1/3/4/5 (×4). The extra coverage accounts for tool-type variants (linear/area/perimeter/wall) and the round-trip stability cycles."

patterns-established:
  - "TDD Wave-0 'load but fail' pattern: dynamic-string import() inside a typed helper function lets test files reference yet-to-be-created modules without breaking Vite collection. Future TDD plans that depend on Wave-1 module creation can copy this pattern."
  - "Reopen-recommit command shape: one undoable command carries both oldMarkup (pre-edit) and newMarkup (post-edit) so undo() restores byte-for-byte and redo() re-applies the modified shape. Same shape as Phase 9's move-markups variant — symmetry across geometry-editing command types."

requirements-completed:
  - v1.1-PhaseC

# Metrics
duration: ~20min
completed: 2026-05-21
---

# Phase 13 Plan 01: TDD Tests and Types Summary

**RED test file (23 it() cases, 893 lines) plus reopen-recommit union variant + isMultiPointMarkup type guard — establishes the verifiable contract for Phase 13 before any production code lands.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-21T10:10Z
- **Completed:** 2026-05-21T10:30Z
- **Tasks:** 2 (both auto-tdd; no checkpoints)
- **Files modified:** 2 (1 modified, 1 new)

## Accomplishments

- **Type contract locked.** MarkupCommand union extended with `reopen-recommit` variant carrying full `oldMarkup: Markup` + `newMarkup: Markup` objects (D-14, D-15, D-16). Page is implicit per A4. `isMultiPointMarkup(markup)` type guard added — mirrors `isMarkupTool` shape in `types/viewer.ts`.
- **Behavioural contract defined and RED-verified.** `src/tests/markup-post-commit-reopen.test.ts` — 23 `it()` cases across 6 describe blocks covering SC1 (re-open mechanics ×6), SC2 (Phase 10 inheritance ×4 — pop/repush/Enter dispatch), SC3 (module-ref round-trip ×3), SC4 (Esc-restore ×3 including e2e keydown dispatch), SC5 (undo/redo round-trip ×3 — 4-cycle stability), and EDGE-1/3/4/5 (×4 non-eligibility paths).
- **Critical assertions present.** `chainArmed: false` on the re-open seed (Pitfall 2 — load-bearing, 6 occurrences); `wallHeight=3000 → 3000` preservation in EDGE-5 + SC2 wall variant (Pitfall 4); cross-page guard `top.markup.page !== currentPage` in EDGE-4 (A4 / D-17 condition 5); vertex-edit eligibility check in EDGE-3 (D-17 condition 4); StrictMode cleanup contract for module ref (Pitfall 9).
- **Regression-clean.** Phase 3 / 9 / 10 suites continue passing (29/29 tests across `markup-tool-point-redo.test.ts`, `markup-tool-pop-last-point.test.ts`, `markup-shortcuts.test.ts`). TypeScript compiles repo-wide (`npx tsc --noEmit -p .` exits 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend MarkupCommand union + add isMultiPointMarkup type guard** — `8a15577` (feat)
2. **Task 2: Write RED test file markup-post-commit-reopen.test.ts (SC1-SC5 + EDGE-1/3/4/5)** — `2b1ca34` (test)

_Note: This is a TDD plan (type: tdd). Both tasks are RED-only at this commit — Plans 13-02 and 13-03 will flip the 20 failing tests to GREEN without modifying this test file._

## Files Created/Modified

- `src/renderer/src/types/markup.ts` (+24 lines) — Appended `reopen-recommit` variant to the MarkupCommand union; appended `isMultiPointMarkup(markup)` type guard at end-of-file. No removals, no other content changed.
- `src/tests/markup-post-commit-reopen.test.ts` (893 lines, new) — Phase 13 Wave-0 RED test suite. Uses the HookHost / Probe / makeFakeStage scaffolding pattern from `markup-tool-point-redo.test.ts:32-80`. Dynamic-string import helper `importReopenRef()` defers `@renderer/lib/markup-reopen-ref` resolution to runtime so Vite's import-analysis pass does NOT fail the suite at collection time.

## Decisions Made

- **Carry full Markup objects on reopen-recommit (not IDs).** Matches the existing STATE.md decision lock (`MarkupCommand stores full Markup object (not just ID)`) and the `move-markups` variant precedent. Enables undo/redo round-trips without the reducer re-querying the store.
- **Page is implicit on the variant.** `oldMarkup.page === newMarkup.page`. Documented in JSDoc; enforced by the Plan 13-03 reopen handler's runtime guard (D-17 condition 5 / A4).
- **`isMultiPointMarkup` returns `markup.type !== 'count'`.** Inverted predicate is symmetrical to the count-vs-multi-point split that already exists across the codebase. A future single-point markup type would need explicit refactoring of this predicate, but Phase 13's locked scope (D-12) names count as the only such category.
- **Dynamic-string import for the missing markup-reopen-ref module.** Plan's `<done>` criterion required "tests FAIL at assertion level, not at collection level". A naive static `await import('@renderer/lib/markup-reopen-ref')` fails Vite's import-analysis pass and skips all 23 tests. The `importReopenRef()` helper + `REOPEN_REF_PATH = [...].join('/')` pattern escapes the analyzer; Plan 13-02 will create the module and these dynamic imports resolve at runtime to the real exports with NO test-file edits.
- **23 it() cases (above the 15 minimum).** Tool-type variants (linear/area/perimeter/wall) and 4-cycle round-trip stability justify the extra coverage. The plan's acceptance criterion was a floor, not a ceiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Switched `await import('@renderer/lib/markup-reopen-ref')` to a dynamic-string `importReopenRef()` helper**

- **Found during:** Task 2 (running `npx vitest run src/tests/markup-post-commit-reopen.test.ts`)
- **Issue:** A static `await import('@renderer/lib/markup-reopen-ref')` is detected by Vite's `vite:import-analysis` plugin at *collection time* and fails the entire suite with `Failed to resolve import "@renderer/lib/markup-reopen-ref"` — preventing any of the 23 tests from running. The plan's `<done>` criterion explicitly requires tests to fail at the assertion level, NOT at collection time: *"Test file exists and FAILS at the assertion level (not at collection/compile level — TypeScript suppressions allow the file to load)."*
- **Fix:** Introduced two file-scope helpers:
  - `REOPEN_REF_PATH = ['@renderer', 'lib', 'markup-reopen-ref'].join('/')` — module specifier assembled at runtime so the literal string never appears in a position Vite's analyzer scans.
  - `importReopenRef(): Promise<MarkupReopenRefModule>` — wraps `await import(/* @vite-ignore */ REOPEN_REF_PATH)` with a typed cast (also documents the Plan 13-02 dependency).
  Replaced all five `await import('@renderer/lib/markup-reopen-ref')` callsites (3 inside SC3/SC4 describe blocks + 2 inside SC4 inline helpers + 1 inside `simulateReopen`) with `importReopenRef()`.
- **Files modified:** `src/tests/markup-post-commit-reopen.test.ts`
- **Verification:** `npx vitest run src/tests/markup-post-commit-reopen.test.ts` now reports `20 failed | 3 passed (23)` — RED state with file LOADED, tests EXECUTED, assertions FAILED. The 3 passing tests are EDGE-1/3/4 which only test the type guard + runtime checks (no Plan 13-02/03 surface required).
- **Committed in:** `2b1ca34` (Task 2 commit)

**2. [Rule 3 — Blocking] Worktree base reset to expected commit**

- **Found during:** Task 1 (immediately after first commit attempt — git status reported "nothing to commit" despite Edit tool reporting success)
- **Issue:** The worktree was created at base `e1694f7` (pre-Phase 13). The orchestrator's `<worktree_branch_check>` block specified `git reset --hard 143fe502f52c83f8948f593eded0adbb4fb7990b` if the merge-base did not match. The HEAD-namespace assertion passed (so the reset was sanctioned), but I had not executed the reset before starting work — leading to Edit operations resolving against the main repo's filesystem path (`C:\Users\franc\dev\CLMC-TAKEOFF-APP\...`) instead of the worktree path. The worktree's checked-out file content was the OLD pre-Phase-13 version (no `move-vertex`, no Phase 12 work, no Phase 13 planning artifacts).
- **Fix:** Ran `git reset --hard 143fe502f52c83f8948f593eded0adbb4fb7990b` (the sanctioned worktree-base reset per the orchestrator's instructions). HEAD now at the expected Phase-13-plan-complete commit. Re-applied Edits using the WORKTREE absolute path (`C:\Users\franc\dev\CLMC-TAKEOFF-APP\.claude\worktrees\agent-a1a3505e6bb4a35ff\src\renderer\src\types\markup.ts`) so subsequent edits land on the actual worktree filesystem.
- **Files modified:** None (this was a workflow correction, no code change beyond what Task 1 already required)
- **Verification:** `git status` now shows expected modifications; `git diff --stat` reports the right files; `npx tsc --noEmit -p .` exits 0 against the corrected base.
- **Committed in:** N/A (workflow correction; no separate commit needed — the Task 1 commit `8a15577` was made AFTER the base correction)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking)
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's stated done criteria. Deviation 1 honours the Wave-0 RED contract (tests LOAD but FAIL at assertion). Deviation 2 corrects a workflow-state mismatch that would otherwise have produced commits with no effect. No scope creep — every test case and every type change in the SUMMARY matches the plan's `<action>` block byte-for-byte.

## Issues Encountered

- **Read tool / worktree path resolution.** Initially used the main-repo absolute path (`C:\Users\franc\dev\CLMC-TAKEOFF-APP\src\...`) for both Read and Edit calls. The Read tool returned the main-repo file content (which already had Phase 12/13 changes), but the worktree's tracked file was the pre-Phase-12 base — leading to in-memory edits that never reached the worktree filesystem. Resolved by (a) executing the orchestrator's sanctioned worktree-base reset and (b) consistently using the worktree absolute path for all subsequent Edit calls. Documented in Deviation 2 above.

## User Setup Required

None — Wave 0 produces test stubs + type extensions only; no environment, no secrets, no installer touchpoints, no IPC channels, no persistence path, no network surface.

## TDD Gate Compliance

This plan is a TDD plan (`type: tdd` in frontmatter) and follows the RED → GREEN → REFACTOR sequence across MULTIPLE plans:

- **RED gate (this plan, 13-01):** `test(13-01): add RED test file ...` — commit `2b1ca34`. ✅
- **GREEN gate (Plan 13-02 + 13-03):** Wave 1 implementation will land the production code that converts the 20 RED failures to GREEN. Pending.
- **REFACTOR gate (optional, Plan 13-03 if needed):** Cleanup commits if the integration glue benefits from de-duplication. Pending.

Plan-level TDD invariant: at this commit, the test file FAILS (RED). Plan 13-02 lands the store + ref module (5 failures → pass; SC3 module-ref + SC5 undo/redo branches). Plan 13-03 lands the hook + dispatch + viewport + toast (15 failures → pass; SC1 re-open, SC2 re-commit identity, SC4 keydown dispatch, EDGE-5 wallHeight seeding). The 3 currently-passing tests (EDGE-1/3/4) test only the type guard + runtime checks already shipped in this plan; they should remain GREEN through Plans 13-02/03.

## Threat Surface Scan

No new threat surface introduced by this plan. Reviewed: `src/renderer/src/types/markup.ts` (additive type-level change, no runtime behaviour), `src/tests/markup-post-commit-reopen.test.ts` (test-only, jsdom, no IPC / file-IO / network).

The plan's `<threat_model>` registered two threats (T-13-01-01 stale module ref leak under HMR/StrictMode; T-13-01-02 unbounded undo stack growth). Both have `mitigate` / `accept` dispositions handled in later plans:
- T-13-01-01: mitigated by Plan 13-03's `useEffect` cleanup `return () => setMarkupReopenHandler(null)`. This plan's RED tests assert the cleanup-sets-null contract in the SC3 describe block — catches any future regression.
- T-13-01-02: existing `UNDO_STACK_MAX = 50` cap covers `reopen-recommit` commands via `pushCommand` reuse in Plan 13-02. Not re-asserted here.

## Self-Check

Performed before finalising this SUMMARY.md.

**Files claimed exist:**
- `src/renderer/src/types/markup.ts` — FOUND (modified; +24 lines via commit `8a15577`)
- `src/tests/markup-post-commit-reopen.test.ts` — FOUND (893 lines via commit `2b1ca34`)

**Commits claimed exist (worktree branch `worktree-agent-a1a3505e6bb4a35ff`):**
- `8a15577` — FOUND (`feat(13-01): extend MarkupCommand union with reopen-recommit + add isMultiPointMarkup type guard`)
- `2b1ca34` — FOUND (`test(13-01): add RED test file markup-post-commit-reopen.test.ts (SC1-SC5 + EDGE-1/3/4/5)`)

**Verification commands run (all from the worktree root):**
- `npx tsc --noEmit -p .` → exit 0 ✅
- `npx vitest run src/tests/markup-post-commit-reopen.test.ts` → 20 failed / 3 passed / 23 total (RED as expected — file LOADS, tests EXECUTE, assertions FAIL) ✅
- `npx vitest run src/tests/markup-tool-point-redo.test.ts src/tests/markup-tool-pop-last-point.test.ts src/tests/markup-shortcuts.test.ts` → 29/29 passed ✅
- `git diff --stat HEAD~2 HEAD` → 2 files changed (markup.ts +24, markup-post-commit-reopen.test.ts +893) ✅

## Self-Check: PASSED

## Next Phase Readiness

- ✅ MarkupCommand union extended; Plan 13-02 can import the variant directly.
- ✅ `isMultiPointMarkup` type guard exported; Plan 13-03's reopen handler can use it.
- ✅ RED test file in place defining the full Phase 13 contract; Plans 13-02 + 13-03 have a precise GREEN target.
- ✅ Phase 3 / 9 / 10 regression suites unaffected; no risk to existing functionality.
- ✅ TypeScript compiles repo-wide; no type debt introduced.
- ⚠️ Wave 1 (Plans 13-02 + 13-03) must NOT modify `src/tests/markup-post-commit-reopen.test.ts` — the test file IS the contract. If Wave 1 needs to alter test expectations, escalate as a Rule 4 architectural change.

---

*Phase: 13-post-commit-step-level-undo*
*Plan: 01*
*Completed: 2026-05-21*
