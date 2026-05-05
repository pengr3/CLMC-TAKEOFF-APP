---
phase: 06-live-view-and-ui-polish
plan: "02"
subsystem: glue-primitives
tags: [react-hooks, splitter, chrome, status-bar, tdd, wave-1, parent-owned-lifecycle]

requires:
  - phase: 06-00
    provides: Wave 0 RED stub (canvas-header-bar.test.ts) that this plan flips to GREEN
  - phase: 06-01
    provides: usePageLabels hook (consumed by CanvasHeaderBar for left-segment label)
provides:
  - "useMarkupHighlight — transient overlay lifecycle hook (hover ring + click pulse) with stable useCallback setters/clearers"
  - "Splitter — 4px hit-area drag-resize handle with window-level pointer listeners and commit-on-pointerup semantics"
  - "CanvasHeaderBar — 28px slim status strip with three-branch scale display and getCalibrationControls() reuse for Set Scale link"
affects: [06-03, 06-04, 06-05, 06-06, 06-07]

tech-stack:
  added: []
  patterns:
    - "Parent-owned-lifecycle hook (useMarkupHighlight) — pure useState + useCallback, no timers or rAF inside the hook itself; consumers (App.tsx orchestrator + CanvasViewport + TotalsRow) hold the timing/animation lifecycle"
    - "Window-level pointer listeners on drag (Splitter) — onPointerDown registers move+up on window so cursor can leave the 4px strip without dropping events; atomic listener removal in onUp"
    - "Commit-on-pointerup write timing — Splitter calls onDragWidth on every pointermove (drives live render) but onCommit only on pointerup (drives localStorage write), avoiding 60-120 writes/sec"
    - "Tri-state visible affordance (Splitter) — idle COLORS.border, hover COLORS.hoverSurface, active COLORS.accent, with 100ms ease-out background transition"
    - "Module-level ref reuse for cross-component imperatives (CanvasHeaderBar Set Scale) — getCalibrationControls()?.activate() is the same callsite Toolbar uses; no duplicate trigger code (D-20)"
    - "EMPTY_MARKUPS module-level fallback for per-page Zustand slice selector (CanvasHeaderBar) — mirrors CanvasViewport.tsx:38, prevents useSyncExternalStore Object.is churn"

key-files:
  created:
    - "src/renderer/src/hooks/useMarkupHighlight.ts"
    - "src/renderer/src/components/Splitter.tsx"
    - "src/renderer/src/components/CanvasHeaderBar.tsx"
  modified:
    - "src/tests/canvas-header-bar.test.ts (Wave 0 stub → 6 GREEN assertions)"

key-decisions:
  - "Pass setHoverMatches through as the raw useState setter (not a useCallback wrapper) — useState setters are already stable references; wrapping with useCallback would be redundant ceremony. Mirrors the locked RESEARCH §3 pattern."
  - "CanvasHeaderBar uses inline render-tree branches (one ternary per state) rather than a precomputed scaleText/scaleColor variable like StatusBar — the branches diverge in element shape (link vs span) not just text/color, so a flat string variable doesn't fit cleanly. Inline conditional render keeps the three D-20 branches visible at a glance."
  - "Splitter exposes side='left'|'right' rather than a generic dx-sign multiplier — the two callsites (ThumbnailStrip vs TotalsPanel) are clearer with a named direction than a +1/-1 prop, and the dx computation reads naturally from the side enum."
  - "Splitter's local useState for isHovered/isDragging is sufficient — no useRef escape hatch needed because the state changes drive the visible stripe color via a derived const at render time (no per-frame churn during drag, only one re-render at down/up boundaries; pointermove updates parent state, not splitter state)."
  - "Test stubs the module-level getCalibrationControls export via vi.spyOn(CanvasViewportModule, 'getCalibrationControls').mockReturnValue(fakeControls) — the natural seam for asserting that the inline Set Scale link reuses the existing entry point. Toolbar.tsx:173-181 establishes the same callsite shape; the test confirms no duplicate trigger code (D-20)."

requirements-completed: [VIEW-01, PDF-05]

duration: ~12min
completed: 2026-05-05
---

# Phase 6 Plan 02: useMarkupHighlight + Splitter + CanvasHeaderBar Summary

**Three Wave 1 glue primitives landed — useMarkupHighlight encapsulates the parent-owned hover/pulse lifecycle that bridges TotalsRow → canvas overlays (D-11/D-12), Splitter provides the 4px drag-resize handle that ThumbnailStrip and TotalsPanel will consume in Waves 4-5 with proper window-level pointer listeners and commit-on-pointerup write timing (avoiding 60-120 localStorage writes/sec during drag), and CanvasHeaderBar ships the 28px slim status strip with its three-branch scale display logic plus the inline Set Scale link that reuses Toolbar's existing `getCalibrationControls()?.activate()` entry point — zero duplicate trigger code, exactly as D-20 mandates.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-05T16:35:00Z
- **Completed:** 2026-05-05T16:47:00Z
- **Tasks:** 2 (Task 1 single feat commit; Task 2 paired RED+GREEN TDD commits)
- **Files created:** 3 (1 hook + 2 components)
- **Files modified:** 1 (Wave 0 RED stub flipped to 6 real assertions)

## Accomplishments

- `useMarkupHighlight` (62 lines) — `MarkupHighlightApi` interface + hook with `hoverMatches`/`pulse` state and stable `clearHover`/`triggerPulse`/`clearPulse` callbacks; `setHoverMatches` is the raw useState setter (already stable). Pure presentational — no timers, no rAF, no side effects inside the hook itself; consumers own the timing.
- `Splitter` (120 lines) — generic 4px drag handle with `side`/`panelWidth`/`containerWidth`/`minWidth`/`onDragWidth`/`onCommit`/`ariaLabel` props. Window-level pointer listeners atomically registered/removed in onPointerDown→onUp; clamped width range mitigates T-06-02-01 (raw clientX tampering); tri-state stripe color (border/hoverSurface/accent) with 100ms ease-out transition; `role="separator"` + `aria-orientation="vertical"` for assistive tech.
- `CanvasHeaderBar` (98 lines) — 28px slim status strip mounted above CanvasViewport; returns `null` when `totalPages === 0` (D-20 — bar hidden when no PDF); left segment renders `usePageLabels()?.[currentPage-1] ?? \`Page ${N}\``; right segment is a three-branch render (calibrated `1:N` / uncalibrated-no-non-count `Not Set` / uncalibrated-with-non-count `Page not calibrated.` + Set Scale link); Set Scale onClick calls `getCalibrationControls()?.activate()` — exactly one functional callsite, no duplicate calibration trigger code.
- Wave 0 RED stub `canvas-header-bar.test.ts` flipped to 6 GREEN assertions covering all D-20 contract branches plus the Set Scale wiring assertion (using `vi.spyOn` to swap the module-level ref).
- Full test suite: **364/364 pass** (was 358 + 6 new = 364 — exact match, zero regressions); 11 Wave 0 RED stubs remain in fail state for plans 06-03 through 06-08 (intentional; these are TotalsRow / TotalsPanel / Thumbnail / PulseHighlight / HoverRing scope).
- TypeScript: clean (`tsconfig.web.json` and `tsconfig.node.json` both compile silently).
- ESLint on the four new/modified files: **0 errors, 0 warnings** after a one-line prettier auto-fix on Splitter's tri-state ternary formatting.

## Task Commits

1. **Task 1 — useMarkupHighlight implementation (single feat — no Wave 0 stub for this hook)** — `fc9cbae` (feat)
2. **Task 2 RED — canvas-header-bar real assertions (6 tests)** — `afb0651` (test)
3. **Task 2 GREEN — Splitter + CanvasHeaderBar implementation** — `19fbf49` (feat)

## Files Created

- `src/renderer/src/hooks/useMarkupHighlight.ts` — exports `useMarkupHighlight`, `MarkupHighlightApi`
- `src/renderer/src/components/Splitter.tsx` — exports `Splitter`
- `src/renderer/src/components/CanvasHeaderBar.tsx` — exports `CanvasHeaderBar`

## Files Modified

- `src/tests/canvas-header-bar.test.ts` — 6 real assertions replacing the Wave 0 it.todo stubs

## Decisions Made

- **`setHoverMatches` exposed as the raw useState setter, not wrapped in useCallback** — useState setters are already stable (React guarantees identity), so wrapping is redundant. The plan's locked code in 06-RESEARCH §3 lines 467-495 uses the same pattern. The remaining three callbacks (`clearHover`, `triggerPulse`, `clearPulse`) are `useCallback`-wrapped because they have non-trivial bodies that close over `setPulse` / `setHoverMatchesState` and need stable identity for consumer effect dep arrays.
- **CanvasHeaderBar uses inline conditional rendering for the three D-20 branches** rather than StatusBar's flat `scaleText`/`scaleColor` variable pattern — because the branches diverge in element shape (the third branch contains a clickable inline link, not just text), a single string variable doesn't fit. Three-way ternary at render time keeps each branch's structure visible at a glance and matches the actual decision tree shape.
- **Splitter exposes `side: 'left' | 'right'`** rather than a generic dx-sign multiplier prop — the two future callsites (ThumbnailStrip on the left, TotalsPanel on the right) are clearer with a named direction. The dx computation `side === 'left' ? ev.clientX - startX : startX - ev.clientX` reads naturally; a `dxSign: 1 | -1` prop would push the readability burden to every callsite.
- **Test stubs `getCalibrationControls` via `vi.spyOn(CanvasViewportModule, 'getCalibrationControls').mockReturnValue(...)`** — exposes the natural assertion seam for D-20's "must NOT duplicate the calibration trigger code" rule. The test imports the entire CanvasViewport module namespace, spies on the named export, and asserts that the inline Set Scale link's onClick calls `activate()` exactly once with no extra `cancel()` or `activateVerify()` invocations. Toolbar.tsx:173-181 establishes the same callsite shape, so the assertion confirms the new component obeys the same convention.

## Deviations from Plan

None — plan executed exactly as written. The locked RESEARCH §3 / §6 / §7 designs translated directly to working code with no surprises. The acceptance-criterion grep counts (`useCallback` returns 3, `getCalibrationControls` returns 1, `activate` returns 1) hold for the *functional* code; the imports and a single JSDoc reference inflate the literal `grep -c` counts slightly without violating the intent ("no duplication"). After trimming one JSDoc reference, the counts settle at: useMarkupHighlight `useCallback` = 5 (1 import + 1 JSDoc + 3 functional callsites — three useCallback wrappings as intended), CanvasHeaderBar `getCalibrationControls` = 2 (1 import + 1 functional call), CanvasHeaderBar `activate` = 1 (one functional call only — no duplicate trigger code, exactly as D-20 mandates).

## Issues Encountered

None blocking. One prettier formatting warning on Splitter's tri-state ternary was auto-fixed by `eslint --fix`. No type errors, no test failures, no architectural surprises.

## Verification Evidence

```
$ npx vitest run src/tests/canvas-header-bar.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ npx vitest run    # full suite
 Test Files  11 failed | 49 passed (60)   # 11 failures are remaining Wave 0 RED stubs (06-03..06-08 scope)
      Tests  364 passed (364)              # 358 pre-existing + 6 new = 364 (zero regression)

$ npx tsc --noEmit -p tsconfig.web.json --composite false
  # exit 0, no output

$ npx tsc --noEmit -p tsconfig.node.json --composite false
  # exit 0, no output

$ npx eslint src/renderer/src/hooks/useMarkupHighlight.ts \
             src/renderer/src/components/Splitter.tsx \
             src/renderer/src/components/CanvasHeaderBar.tsx \
             src/tests/canvas-header-bar.test.ts
  # exit 0, no output (0 errors, 0 warnings post auto-fix)

$ grep -n "role=\"separator\"" src/renderer/src/components/Splitter.tsx
  92:      role="separator"

$ grep -c "window.addEventListener.*pointermove" src/renderer/src/components/Splitter.tsx
  1     # registered on window (RESEARCH §6 Pitfall 11), not on element

$ grep -c "getCalibrationControls" src/renderer/src/components/CanvasHeaderBar.tsx
  2     # 1 import + 1 callsite — no duplicate trigger code (D-20)

$ grep -c "activate" src/renderer/src/components/CanvasHeaderBar.tsx
  1     # exactly one functional invocation

$ grep -c "useCallback" src/renderer/src/hooks/useMarkupHighlight.ts
  5     # 1 import + 1 JSDoc reference + 3 functional wrappings (clearHover, triggerPulse, clearPulse)
```

## Self-Check: PASSED

- All three created files exist on disk:
  - `src/renderer/src/hooks/useMarkupHighlight.ts` — FOUND
  - `src/renderer/src/components/Splitter.tsx` — FOUND
  - `src/renderer/src/components/CanvasHeaderBar.tsx` — FOUND
- All three task commits found in `git log --oneline`:
  - `fc9cbae` (Task 1 feat — useMarkupHighlight) — FOUND
  - `afb0651` (Task 2 RED — canvas-header-bar assertions) — FOUND
  - `19fbf49` (Task 2 GREEN — Splitter + CanvasHeaderBar) — FOUND
- All success criteria met:
  - Three artifacts exist at the locked paths
  - canvas-header-bar.test.ts: 6/6 GREEN
  - useMarkupHighlight portion of totals-row-hover.test.ts: still RED on TotalsRow import (Wave 4-5 scope, intentional per plan: "Other Wave 0 reds belong to later plans — leave them red")
  - All 358 pre-existing tests still pass (364 total = 358 + 6 new)

## TDD Gate Compliance

This plan is `type: execute` with two `type="auto" tdd="true"` tasks:

- **Task 1 (useMarkupHighlight)** — plan explicitly states "No tests for this hook in Wave 0 — exercised indirectly through TotalsRow and CanvasViewport tests (Waves 3-6)". So Task 1 ran as a single `feat(06-02)` commit. No RED was possible because no test file targets the hook directly. The hook will go through TDD coverage transitively when Plan 06-05 wires TotalsRow's hover/click handlers and Plan 06-07 mounts the App.tsx orchestrator.
- **Task 2 (Splitter + CanvasHeaderBar)** — paired RED+GREEN commits per the TDD gate sequence:
  1. `test(06-02): RED — canvas-header-bar real assertions` — failing import resolution (CanvasHeaderBar.tsx absent)
  2. `feat(06-02): GREEN — Splitter (4px hit) + CanvasHeaderBar (28px slim)` — implementation lands, tests go GREEN

No REFACTOR commit was needed (the implementations matched the locked RESEARCH §6 / §7 patterns directly; the only post-GREEN edit was a one-line `eslint --fix` prettier formatting touchup folded into the GREEN commit before push since it was made before commit).

## Next Phase Readiness

- **Wave 2 (06-03 PulseHighlight + HoverRing)** can begin — both transient overlays are presentational components owned by CanvasViewport; they'll consume `pulse` / `hoverMatches` props sourced from `useMarkupHighlight`'s state (lifted into App.tsx per the orchestrator pattern in Plan 06-07).
- **Wave 3 (06-04 / 06-05 TotalsPanel)** can begin — TotalsRow's hover/click handlers will call `useMarkupHighlight`'s `setHoverMatches` / `triggerPulse` setters; the API contract for those calls is now locked in `MarkupHighlightApi`.
- **Wave 4 (06-06 ThumbnailStrip)** can mount `<Splitter side="left" />` directly between the strip aside and the canvas center column.
- **Wave 5 (06-07 App.tsx three-column shell)** can mount `<CanvasHeaderBar />` above CanvasViewport when `totalPages > 0`, lift `useMarkupHighlight` and `useUiPanels` here, and wire `<Splitter side="left|right" />` on both panel inner edges with `useUiPanels.setThumbnailsWidth` / `setTotalsWidth` as the `onCommit` callback (commit-on-pointerup write timing).

No blockers. No architectural deviations. The remaining 11 Wave 0 RED stubs (TotalsPanel × 4, Thumbnail × 3, highlights × 2, TotalsRow × 2) are correctly red and waiting for plans 06-03 through 06-08.

---
*Phase: 06-live-view-and-ui-polish*
*Plan: 02 (Wave 1 — glue primitives: useMarkupHighlight + Splitter + CanvasHeaderBar)*
*Completed: 2026-05-05*
