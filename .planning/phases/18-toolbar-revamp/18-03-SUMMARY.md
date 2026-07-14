---
phase: 18-toolbar-revamp
plan: 03
subsystem: testing
tags: [vitest, jsdom, react, contextbar, statusbar, red-tests, tdd, toolbar-revamp]

# Dependency graph
requires:
  - phase: 18-toolbar-revamp (18-01)
    provides: Wave-0 RED render-test harness (createRoot/act + CanvasViewport mock + reactive Arc seam shape)
  - phase: 18-toolbar-revamp (18-02)
    provides: Wave-0 TopActionBar RED tests + retirement of the 5 obsolete Toolbar/ribbon tests
provides:
  - "RED test surface for the morphing ContextBar (SC-4): four mutually-exclusive morph states + selected-markup edit ops"
  - "RED test surface for the consolidated status line (SC-5): folded calibration nudge migrated onto StatusBar"
  - "Fixed testid/aria contract for 18-06 (StatusBar nudge) and 18-08 (ContextBar) to satisfy"
affects: [18-06 status-line GREEN, 18-08 ContextBar GREEN, 18-09 integration + canvas-header-bar deletion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() holder shared with a hoisted vi.mock factory to flip mocked module-ref reads (getChainArmedItem / getArcSticky / getCalibrationControls) between renders"
    - "Migration RED: import the REAL component (StatusBar) and assert a missing BEHAVIOR (nudge testid) so the file is RED without a missing module"

key-files:
  created:
    - src/tests/context-bar-morph.test.ts
    - src/tests/context-bar-edit.test.ts
    - src/tests/status-line.test.ts
  modified:
    - .planning/phases/18-toolbar-revamp/18-VALIDATION.md

key-decisions:
  - "status-line.test.ts imports the REAL StatusBar (not a missing module): 3 assertions are forward-GREEN today (page+scale dedup, branch-b 'Not Set', snap reflect) and the branch-c nudge assertion is the single RED driver — exactly the missing behavior 18-06 folds in."
  - "Mocked markup-arc-ref wholesale (incl. getArcSticky/subscribeArcSticky added in 18-04) so ContextBar's Arc on-state read resolves under jsdom without useMarkupTool/react-konva."
  - "Edit-op assertions spy renameGroup/recolorGroup/deleteMarkup by injecting vi.fn()s onto the real markupStore via setState, while getCategory stays real — pins exact (old,new)/(name,hex)/(page,id) arguments and the category-chip copy."

patterns-established:
  - "ContextBar morph roots: data-testid=context-bar-{placing|scale|selected|idle}, mutually exclusive"
  - "Status-line calibration nudge: data-testid=status-set-scale-link → getCalibrationControls().activate() (reuse the ref, Pitfall 5)"

requirements-completed: [SC-4, SC-5]

# Metrics
duration: 26 min
completed: 2026-07-14
---

# Phase 18 Plan 03: ContextBar + Status-Line RED Test Surface Summary

**Three Wave-0 RED render tests pin the SC-4 morphing ContextBar (placing/scale/selected/idle + inline rename/recolor/delete) and the SC-5 consolidated status line's folded "Page not calibrated → Set Scale" nudge, against a fixed testid/aria contract for 18-06 and 18-08 to satisfy.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-14T15:52Z
- **Completed:** 2026-07-14T15:59Z
- **Tasks:** 3
- **Files created:** 3 (+1 doc updated)

## Accomplishments

- **`context-bar-morph.test.ts`** — asserts the four `context-bar-{placing|scale|selected|idle}` morph roots are mutually exclusive (exactly one present per state), keyed on `activeTool` + `selectedMarkupIds`. Placing additionally asserts `context-snap-toggle` + `context-arc-toggle`, the "Enter to finish · Esc to cancel" hint, and the chain item name when `getChainArmedItem()` is armed.
- **`context-bar-edit.test.ts`** — asserts the selected-markup panel: inline rename via the **native Enter** path → `renameGroup('Skirting','Trunking')`; display-only category chip ("Electrical"); Recolor opens the `MARKUP_PALETTE` swatch row (`Color ${hex}` aria-label) → `recolorGroup('Skirting', hex)`; Delete → `deleteMarkup(1,'m1')`.
- **`status-line.test.ts`** — imports the real `StatusBar`; asserts one line carries `Page 1 of 3` + the calibrated ratio (`1:100`), the branch-c nudge (`status-set-scale-link` → `getCalibrationControls().activate()`), branch-b "Not Set" with **no** link (count-only), and snap reflect-only.
- Updated `18-VALIDATION.md`: 18-03 map rows flipped to `✅ W0`, Wave-0 checkboxes ticked, `wave_0_complete: true` (Wave 0 = plans 01–03 now complete).

## Task Commits

1. **Task 1: RED ContextBar morph states** — `d492e2a` (test)
2. **Task 2: RED ContextBar selected-markup edit ops** — `89f084f` (test)
3. **Task 3: RED consolidated status-line nudge** — `6be0c07` (test)

**Plan metadata (this commit):** SUMMARY + `18-VALIDATION.md` (docs)

## Files Created/Modified

- `src/tests/context-bar-morph.test.ts` — RED: ContextBar four morph states + exclusivity (missing `@renderer/components/ContextBar`)
- `src/tests/context-bar-edit.test.ts` — RED: ContextBar rename/recolor/delete + category chip (missing `@renderer/components/ContextBar`)
- `src/tests/status-line.test.ts` — RED: consolidated status line's folded nudge (missing StatusBar behavior)
- `.planning/phases/18-toolbar-revamp/18-VALIDATION.md` — 18-03 rows/checkboxes marked created; `wave_0_complete: true`

## RED Verification (fails for the intended reason)

`npx vitest run` on all three files → **3 test files failed**:
- `context-bar-morph.test.ts` — `Failed to resolve import "@renderer/components/ContextBar"` (missing MODULE → 18-08).
- `context-bar-edit.test.ts` — same missing `ContextBar` module (→ 18-08).
- `status-line.test.ts` — **4 tests, 1 failed / 3 passed**: branch-c fails `AssertionError: expected null not to be null` (no `status-set-scale-link` yet — missing BEHAVIOR → 18-06). The other three assertions are forward-GREEN (StatusBar already shows page+scale, "Not Set", snap reflect).

None are syntax/config errors. `canvas-header-bar.test.ts` and `status-bar-scale.test.ts` left untouched (deletion/extension happens in 18-09/18-06).

## Decisions Made

- **Status-line test imports the real StatusBar, not a stub** — the RED signal is the missing nudge branch (branch-c), matching the plan's "migrate the nudge assertions onto the consolidated bottom line". The page/scale/snap assertions passing today is expected and encodes the SC-5 dedup + reflect contract for 18-06.
- **Whole-module mock of `markup-arc-ref`** (including `getArcSticky`/`subscribeArcSticky`, which the real module gains only in 18-04) — a `vi.mock` factory replaces the module regardless of current real exports, keeping the ContextBar Arc-toggle read resolvable under jsdom and forward-compatible for the 18-08 GREEN.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 18-06** (status line GREEN): fold `CanvasHeaderBar.tsx:53-80`'s 3-branch scale segment into `StatusBar`'s Scale slot with `data-testid="status-set-scale-link"` calling `getCalibrationControls()?.activate()`; keep `status-bar-scale.test.ts` green.
- **Ready for 18-08** (ContextBar GREEN): implement `@renderer/components/ContextBar` with the four morph roots, `context-snap-toggle`/`context-arc-toggle`, chain indicator, and the selected panel (InlineRenameInput `Rename ${name}`, category chip, `Recolor`/`Delete markup` labels, `Color ${hex}` swatches).
- Wave 0 (plans 01–03) is complete: 12 RED test files now encode the SC-1..SC-6 contract.

## Self-Check: PASSED

- Created files exist on disk: `context-bar-morph.test.ts`, `context-bar-edit.test.ts`, `status-line.test.ts` — all FOUND.
- Task commits exist: `d492e2a`, `89f084f`, `6be0c07` — all FOUND in `git log`.
- RED reconfirmed: 3 test files failed for the intended reasons (2 missing-module, 1 missing-behavior).
- No changes to `.planning/STATE.md` or `.planning/ROADMAP.md` (worktree mode — orchestrator owns those).
- `canvas-header-bar.test.ts` left in place (not deleted).

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
