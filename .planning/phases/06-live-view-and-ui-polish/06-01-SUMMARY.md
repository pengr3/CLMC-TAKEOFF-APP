---
phase: 06-live-view-and-ui-polish
plan: "01"
subsystem: hooks
tags: [react-hooks, zustand, localStorage, pdf-labels, tdd, wave-1]

requires:
  - phase: 05-boq-export
    provides: aggregateBoq + BoqStructure (the pure derive useBoqLive wraps)
  - phase: 06-00
    provides: 3 RED test stubs (use-boq-live, use-page-labels, use-ui-panels) that this plan flips to GREEN
provides:
  - "useBoqLive — memoized reactive BoqStructure derive over 8 Zustand primitives"
  - "usePageLabels — one-shot async page-label fetch per pdfDocument with cancel guard"
  - "useUiPanels — localStorage-backed UI panel state under clmc.ui with silent-reset on parse/shape failure"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07]

tech-stack:
  added: []
  patterns:
    - "TDD RED→GREEN cycle: failing-import test committed first (test:), implementation committed second (feat:)"
    - "Eight primitive Zustand selectors over a single useMemo to derive a complex computed value — never `(s) => s` (Pitfall 2 in 06-RESEARCH §2)"
    - "Cancelled-flag effect for one-shot async per dependency (cloned from usePdfRenderer.ts:85-95)"
    - "localStorage hook with defensive shape validation (try/catch + 5-field type check) → DEFAULTS on any failure (T-06-01-01 mitigation)"
    - "Test harness: render hook into a tiny Harness component, write captured value into a holder via useLayoutEffect (post-render commit) so the assignment is not a render-time side-effect — keeps eslint-plugin-react-hooks v7 strict purity rules quiet"
    - "In-memory localStorage polyfill installed in test beforeEach: jsdom 29 in this project ships an experimental persistent localStorage that requires --localstorage-file; without a valid path getItem/setItem are undefined, so tests provide their own Storage shim"

key-files:
  created:
    - "src/renderer/src/hooks/useBoqLive.ts"
    - "src/renderer/src/hooks/usePageLabels.ts"
    - "src/renderer/src/hooks/useUiPanels.ts"
  modified:
    - "src/tests/use-boq-live.test.ts (Wave 0 stub → real RED then GREEN)"
    - "src/tests/use-page-labels.test.ts (Wave 0 stub → real RED then GREEN)"
    - "src/tests/use-ui-panels.test.ts (Wave 0 stub → real RED then GREEN)"

key-decisions:
  - "Pass getColorForName explicitly into aggregateBoq (matching the RESEARCH §2 locked pattern) rather than relying on the aggregator's default fallback — keeps the dependency chain visible at the hook callsite"
  - "Use `categories as Record<string, { id: string; name: string }>` cast at the useMemo callsite — mirrors aggregateBoq's own internal cast (boq-aggregator.ts:86) so the two callsites share one widening point"
  - "Cast viewerStore.pdfDocument selector to `PDFDocumentProxy | null` inside usePageLabels — the store types this field as `unknown | null` to keep pdfjs types out of the store contract; usePdfRenderer.ts:68 establishes the cast pattern"
  - "Test harness writes captured hook value via useLayoutEffect rather than render-body reassignment — eslint-plugin-react-hooks v7 ships react-hooks/immutability and react-hooks/globals as errors that flag direct mutation of let-bindings during render; useLayoutEffect runs after the React render phase commits, satisfying the rule and the existing use-export-hook.test.ts effect-based assignment pattern"
  - "Test files install their own localStorage polyfill via Object.defineProperty rather than touching vitest.config.ts — keeps the parallel-executor safety contract from CLAUDE.md and avoids modifying test infra used by 14 other test files mid-wave"

requirements-completed: [VIEW-01, PDF-05]

duration: 18min
completed: 2026-05-05
---

# Phase 6 Plan 01: useBoqLive + usePageLabels + useUiPanels Summary

**Three pure-foundation hooks landed for Phase 6 Wave 1: useBoqLive memoizes the BoqStructure derive over eight Zustand primitives so TotalsPanel can subscribe to live aggregator output, usePageLabels resolves PDF.js page labels once per document with proper cancel-on-unmount semantics, and useUiPanels persists thumbnail/totals/collapsed-categories state under the `clmc.ui` localStorage namespace with a defensive shape check that silently resets to DEFAULTS on parse failure or schema drift.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-05T16:10:06Z
- **Completed:** 2026-05-05T16:28:00Z (approx)
- **Tasks:** 2 (both TDD: RED + GREEN paired commits)
- **Files created:** 3 (hooks)
- **Files modified:** 3 (Wave 0 RED stubs flipped to assertions)

## Accomplishments

- `useBoqLive` (47 lines) — eight primitive Zustand selectors feed a single useMemo wrapping `aggregateBoq()`; `getColorForName` captured via `useMarkupStore.getState()` inside the memo so the function identity doesn't trigger spurious recomputes
- `usePageLabels` (43 lines) — one-shot `pdfDocument.getPageLabels()` per document instance with `cancelled` flag in the effect cleanup; returns `null` while no document loaded or while resolving
- `useUiPanels` (118 lines) — `STORAGE_KEY = 'clmc.ui'`, `DEFAULTS` for thumbnails/totals/collapsedCategories; `readStorage()` validates all five type-bearing fields and silently resets on any failure; `useEffect` persists on every state change; five `useCallback`-wrapped setters; `toggleCategoryCollapsed` add-or-remove toggle
- Wave 0 stubs flipped: `use-boq-live.test.ts` (3 tests), `use-page-labels.test.ts` (3 tests), `use-ui-panels.test.ts` (8 tests) all GREEN
- Full test suite: **358/358 pass** (was 344 + 14 new = 358 — exact match, zero regressions); 12 Wave 0 RED stubs remain in fail state for plans 06-02 through 06-08 (intentional)
- TypeScript: clean (`tsconfig.web.json` and `tsconfig.node.json` both compile silently)
- ESLint on the six new/modified files: **0 errors**, 23 prettier-formatting warnings (parity with the rest of the test corpus — pre-existing project-wide pattern)

## Task Commits

1. **Task 1 RED — useBoqLive failing test** — `4fcbb03` (test)
2. **Task 1 GREEN — useBoqLive implementation** — `2db3f0c` (feat)
3. **Task 2 RED — usePageLabels + useUiPanels failing tests** — `1ce1c71` (test)
4. **Task 2 GREEN — usePageLabels + useUiPanels implementation** — `2c87c2c` (feat)
5. **Lint + typecheck cleanup** — `fdc35ce` (fix)

## Files Created

- `src/renderer/src/hooks/useBoqLive.ts` — exports `useBoqLive`
- `src/renderer/src/hooks/usePageLabels.ts` — exports `usePageLabels`
- `src/renderer/src/hooks/useUiPanels.ts` — exports `useUiPanels`, `UseUiPanelsApi`, `UiState`

## Files Modified

- `src/tests/use-boq-live.test.ts` — three real assertions replacing it.todo stubs
- `src/tests/use-page-labels.test.ts` — three real assertions replacing it.todo stubs
- `src/tests/use-ui-panels.test.ts` — eight real assertions replacing it.todo stubs

## Decisions Made

- **`getColorForName` passed explicitly into aggregateBoq** — matches the locked RESEARCH §2 pattern; keeps the dependency chain visible at the hook callsite even though the aggregator has a default fallback. Functionally identical, semantically clearer.
- **`categories` cast `as Record<string, { id: string; name: string }>`** — single widening point shared with `boq-aggregator.ts:86`. `Category` carries `color` and `paletteIndex` which the aggregator doesn't read; rather than ripple a narrower interface through the store, both callsites widen at the same boundary.
- **`pdfDocument` selector cast to `PDFDocumentProxy | null`** — the viewerStore intentionally types this field as `unknown | null` to keep pdfjs types out of the store contract (a Phase 1 decision). `usePdfRenderer.ts:68` established the per-callsite cast pattern; `usePageLabels` follows it.
- **Test harness uses `useLayoutEffect` for value capture** — eslint-plugin-react-hooks v7 enforces strict render purity (`react-hooks/immutability`, `react-hooks/globals`), making the obvious `captured = useMyHook()` pattern an error. Writing inside `useLayoutEffect` defers the assignment to React's commit phase, satisfying the rule. The existing `use-export-hook.test.ts` uses the same escape route via `React.useEffect`.
- **In-memory localStorage polyfill scoped to the test file** — jsdom 29's `--localstorage-file`-based persistent storage is inert in this project (`getItem`/`setItem` are undefined when no file path is configured). Rather than touch `vitest.config.ts` mid-wave (parallel-executor safety per CLAUDE.md), the `useUiPanels` test installs its own `Storage` shim in `beforeEach` via `Object.defineProperty(window, 'localStorage', …)`. Self-contained, no test infra changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] jsdom 29 in this project provides an inert localStorage**
- **Found during:** Task 2 GREEN run
- **Issue:** `window.localStorage` exists as a Storage-shaped object but its methods (`getItem`, `setItem`, `clear`) are `undefined`. jsdom 29 ships an experimental persistent localStorage that requires `--localstorage-file <path>`; without a valid path, the API is non-functional. Test failures: 8/8 `useUiPanels` cases failing on `window.localStorage.clear is not a function`.
- **Fix:** Installed an in-memory `Storage` polyfill via `Object.defineProperty(window, 'localStorage', { value: <shim> })` inside the `useUiPanels` test's `beforeEach`. Self-contained — no `vitest.config.ts` change, no other test affected.
- **Files modified:** `src/tests/use-ui-panels.test.ts`
- **Commit:** `2c87c2c`

**2. [Rule 1 — Type bug] usePageLabels TypeScript error: pdfDocument typed as `unknown | null`**
- **Found during:** Post-implementation `tsc --noEmit` typecheck
- **Issue:** `usePageLabels` called `pdfDocument.getPageLabels()`, but the viewerStore intentionally types `pdfDocument` as `unknown | null` to avoid bleeding pdfjs types into the store contract. `tsc` correctly rejected the call with `TS2339: Property 'getPageLabels' does not exist on type '{}'`.
- **Fix:** Cast at the selector site: `useViewerStore((s) => s.pdfDocument) as PDFDocumentProxy | null`. Mirrors the existing pattern in `usePdfRenderer.ts:68`.
- **Files modified:** `src/renderer/src/hooks/usePageLabels.ts`
- **Commit:** `fdc35ce`

**3. [Rule 1 — Lint bug] eslint-plugin-react-hooks v7 strict purity rules**
- **Found during:** Post-implementation `npx eslint` lint
- **Issue:** The naive harness pattern `let captured: T | null = null; function Harness() { captured = useMyHook() }` violates `react-hooks/globals` and `react-hooks/immutability` in v7 — both rules treat the render-time reassignment of an outer `let` as a forbidden side effect. All three new test files affected.
- **Fix:** Replaced direct render-body assignment with a holder object whose `.value` is written inside `React.useLayoutEffect` (post-render commit, allowed). Tests still GREEN; lint clean.
- **Files modified:** All three new test files
- **Commit:** `fdc35ce`

### Test harness pattern (new for the codebase)

This is the first plan in the project to render a hook into a transient component for assertion (rather than just calling a hook's underlying pure function). The `Harness + useLayoutEffect-into-holder` pattern landed here is a candidate for a shared helper if Wave 3+ TotalsPanel rendering tests need it — but for now it lives as duplicated `callHook()` helpers in each test file (three callsites). DRY-ing into `src/tests/helpers/render-hook.ts` is a defensible refactor for a future plan; intentionally deferred here to keep this plan's scope tight.

## Issues Encountered

None blocking. The three Rule 1/3 auto-fixes above were all caught and resolved before plan close — no human checkpoint needed.

## Verification Evidence

```
$ npx vitest run src/tests/use-boq-live.test.ts src/tests/use-page-labels.test.ts src/tests/use-ui-panels.test.ts
Test Files  3 passed (3)
     Tests  14 passed (14)

$ npx vitest run    # full suite
Test Files  12 failed | 48 passed (60)   # 12 failures are other Wave 0 RED stubs (06-02..06-08 scope)
     Tests  358 passed (358)              # 344 pre-existing + 14 new = 358 (no regression)

$ npx tsc --noEmit -p tsconfig.web.json --composite false
  # exit 0, no output

$ npx tsc --noEmit -p tsconfig.node.json --composite false
  # exit 0, no output

$ grep -c "useMarkupStore((s) => s)" src/renderer/src/hooks/useBoqLive.ts
  0     # confirms no broad selector — Pitfall 2 avoided

$ grep -c "clmc\.ui" src/renderer/src/hooks/useUiPanels.ts
  2     # STORAGE_KEY constant + doc comment

$ grep -c "DEFAULTS" src/renderer/src/hooks/useUiPanels.ts
  5     # constant decl, two readStorage references, two return-path references

$ grep -c "cancelled" src/renderer/src/hooks/usePageLabels.ts
  4     # set, check, cleanup setter, plus doc comment
```

## Self-Check: PASSED

- All three created hook files exist on disk:
  - `src/renderer/src/hooks/useBoqLive.ts` — FOUND
  - `src/renderer/src/hooks/usePageLabels.ts` — FOUND
  - `src/renderer/src/hooks/useUiPanels.ts` — FOUND
- All five task commits found in `git log --oneline`:
  - `4fcbb03` (Task 1 RED) — FOUND
  - `2db3f0c` (Task 1 GREEN) — FOUND
  - `1ce1c71` (Task 2 RED) — FOUND
  - `2c87c2c` (Task 2 GREEN) — FOUND
  - `fdc35ce` (lint+tsc fix) — FOUND
- All success criteria met:
  - Three target Wave 0 RED tests now GREEN: `use-boq-live` (3), `use-page-labels` (3), `use-ui-panels` (8) = 14 GREEN tests
  - Other Wave 0 RED tests still red (untouched): 12 file-level failures remain (06-02 through 06-08 scope)
  - All 344 pre-existing tests still pass (358 total = 344 + 14 new)

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`), but its two `type="auto" tdd="true"` tasks were each executed as paired RED → GREEN commits:
- Task 1: `test(06-01): RED — useBoqLive…` → `feat(06-01): GREEN — useBoqLive…`
- Task 2: `test(06-01): RED — usePageLabels + useUiPanels…` → `feat(06-01): GREEN — usePageLabels + useUiPanels…`

No REFACTOR commits were needed (the implementations matched the locked RESEARCH §2/§4/§5 patterns directly). One follow-up `fix(06-01)` commit landed lint + typecheck cleanups discovered post-GREEN.

## Next Phase Readiness

- **Wave 2 (06-03 PulseHighlight + HoverRing)** can begin — depends on Wave 1 hooks; this plan lands `useBoqLive` and `useUiPanels` (06-04 row hover/click → useMarkupHighlight wiring; this is plan 06-02's deliverable, not 06-01)
- **Wave 3 (06-04 TotalsPanel)** can wire `useBoqLive` directly
- **Wave 4 (06-06 thumbnails)** can wire `usePageLabels` for label badge rendering
- **Wave 5 (06-07 App.tsx shell)** can wire `useUiPanels` for thumbnail/totals/splitter persistence

No blockers. No architectural deviations. The Wave 1 sibling plan (06-02 — useMarkupHighlight + Splitter + CanvasHeaderBar) remains parallel-safe and untouched by this plan's commits.

---
*Phase: 06-live-view-and-ui-polish*
*Plan: 01 (Wave 1 — pure hook foundations)*
*Completed: 2026-05-05*
