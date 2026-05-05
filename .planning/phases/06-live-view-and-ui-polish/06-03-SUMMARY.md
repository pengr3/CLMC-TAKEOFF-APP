---
phase: 06-live-view-and-ui-polish
plan: "03"
subsystem: transient-overlays
tags: [react-konva, raf-animation, parent-owned-lifecycle, listening-false, zoom-compensation, tdd, wave-2]

requires:
  - phase: 06-00
    provides: Wave 0 RED stubs (highlight-overlay-listening.test.ts, pulse-highlight-animation.test.ts) that this plan flips to GREEN
  - phase: 06-01
    provides: HoverMatch / PulseRequest type contracts (consumed via prop shape)
  - phase: 06-02
    provides: useMarkupHighlight hook whose pulse + hoverMatches state these components consume (wired in Wave 5/6)
provides:
  - "HoverRing — steady non-animated white 40%-opacity overlay ring with listening={false} on every Konva shape (D-11)"
  - "PulseHighlight — animated 1500ms rAF fade-out ring with stroke 6/zoom→2/zoom deflation, ease-out opacity 0.85→0, parent-owned-lifecycle onComplete callback (D-12)"
affects: [06-07]

tech-stack:
  added: []
  patterns:
    - "Parent-owned-lifecycle rAF animation (PulseHighlight) — useEffect runs the rAF loop; cancelAnimationFrame in cleanup prevents dangling setState on mid-fade unmount (RESEARCH §3 Pitfall 8)"
    - "Quadratic ease-out opacity + linear stroke deflation (PulseHighlight) — gives a recognizable shockwave feel without a separate scale animation"
    - "Per-name-group color travels through the cascade (D-12) — Markup.color → useMarkupHighlight.triggerPulse(color) → PulseHighlight color prop → Konva stroke; never hardcoded white"
    - "listening={false} on every Konva shape (HoverRing + PulseHighlight) — overlay rings must NOT steal hover events from underlying markups; regression-guarded by highlight-overlay-listening.test.ts"
    - "Zoom-compensated stroke widths (both components) — strokeWidth = N/currentZoom keeps visual width constant at any zoom; world-anchored radius (PIN_RADIUS_WORLD = 10) for Count rings per D-22"
    - "Stacked outer-offset budget — HoverRing uses 4/zoom, PulseHighlight uses 8/zoom — the two overlays can render simultaneously over the same markup without visual overlap"

key-files:
  created:
    - "src/renderer/src/components/HoverRing.tsx"
    - "src/renderer/src/components/PulseHighlight.tsx"
  modified:
    - "src/tests/highlight-overlay-listening.test.ts (Wave 0 stub → 8 GREEN assertions covering both components)"
    - "src/tests/pulse-highlight-animation.test.ts (Wave 0 stub → 8 GREEN assertions for the rAF fade contract)"

key-decisions:
  - "PulseHighlight uses useState(progress) driven by the rAF loop rather than directly mutating Konva node attrs via refs — keeps the component pure-React, easier to test, and the 90 ticks per fade @ 60fps are well within React 19's render budget for the small render tree (1-N rings, no children)."
  - "Quadratic ease-out (1 - (1-t)^2) on opacity, linear interpolation on stroke — the eye reads opacity ease-out as 'fading away' and linear stroke deflation as 'shockwave dissipating', mirroring how CAD tools render selection pulses. Cubic ease was tested but felt too slow on the tail; quadratic is the sweet spot."
  - "PulseHighlight calls onComplete() inside the rAF callback when t reaches 1 (not in a useEffect that watches progress) — the rAF loop already runs inside React.act in tests; placing the callback there guarantees parent unmount happens on the same render cycle as the t=1 frame, avoiding a stale-overlay flash."
  - "HoverRing renders an envelope-style polyline for linear/area/perimeter — strokeWidth = (2 + 8)/zoom = 10/zoom — rather than two separate inner+outer strokes. Single fat semi-transparent stroke is visually identical and halves the Konva node count; the underlying markup's normal stroke shows through the 40% alpha as the 'inner' ring appearance."
  - "Test file pulse-highlight-animation.test.ts sets globalThis.IS_REACT_ACT_ENVIRONMENT = true so the unmount-cleanup test's console.error spy doesn't catch React 19's 'act environment not configured' warning as a false positive. Mirrors the established pattern in markup-tool-pop-last-point.test.ts:66 and markup-tool-strictmode.test.ts:91 — per-test-file flag, no vitest.config.ts change (parallel-executor-safe per CLAUDE.md mid-wave rule)."

requirements-completed: [VIEW-01]

duration: ~spans-2-sessions
completed: 2026-05-05
---

# Phase 6 Plan 03: HoverRing + PulseHighlight Summary

**Two transient Konva overlay components landed — HoverRing renders a steady white 40%-opacity zoom-compensated ring (D-11) for the panel→canvas hover bridge, and PulseHighlight runs a self-contained 1500ms rAF fade with quadratic-ease opacity (0.85→0) and linear stroke deflation (6/zoom→2/zoom) for the click-pulse bridge (D-12). Every Konva shape on both components carries `listening={false}` — the load-bearing regression guard that keeps overlay rings from stealing hover events from underlying markups. Color is sourced from the per-name-group `Markup.color` so the D-12 cascade (canvas pin → BOQ row chip → pulse → spreadsheet cell) stays color-coherent end to end.**

## Performance

- **Duration:** Spans two sessions (RED+GREEN HoverRing + RED PulseHighlight in session 1; PulseHighlight GREEN + plan close-out in session 2 after a PC restart)
- **Started:** 2026-05-05 (HoverRing RED commit `88a9ab7`)
- **Completed:** 2026-05-05 (PulseHighlight GREEN commit `dfb3855`)
- **Tasks:** 2 (both `type="auto" tdd="true"` paired RED+GREEN)
- **Files created:** 2 (both Konva overlay components)
- **Files modified:** 2 (Wave 0 RED stubs flipped to 16 real assertions total)

## Accomplishments

- `HoverRing` (100 lines) — pure presentational; renders Circle for count markups (radius `PIN_RADIUS_WORLD + 4/zoom`), envelope-stroke Line for linear (`strokeWidth = (2 + 8)/zoom`), closed-loop Line for area/perimeter (closes the polygon by appending `points[0]`). Single white stroke at 40% opacity. **Every shape has `listening={false}`** so rings can render over interactive markups without consuming hover events.
- `PulseHighlight` (139 lines) — runs its own rAF loop in a single useEffect with `cancelAnimationFrame` cleanup. State: `progress` (0→1 over 1500ms via `performance.now()` deltas). Derived per-render: `opacity = 0.85 * (1 - easeOut)`, `stroke = (6 + (2-6)*progress) / zoom`, `ringOffset = 8/zoom`. Calls `onComplete()` exactly once at `t=1` so the parent (App.tsx orchestrator via `useMarkupHighlight.clearPulse`) can unmount on the next render. **Every shape has `listening={false}`** for the same reason.
- Wave 0 RED stub `highlight-overlay-listening.test.ts` flipped to 8 GREEN assertions: 6 for HoverRing (one per markup type × Circle/Line, plus 2 listening regression cases), 2 for PulseHighlight (Circle + Line with mid-fade listening checks).
- Wave 0 RED stub `pulse-highlight-animation.test.ts` flipped to 8 GREEN assertions: opacity peak at t=0, opacity ~0 at t=1, stroke linear interpolation at t=0/0.5/1, onComplete fires once at t=1, onComplete NOT fired before t=1, cancelAnimationFrame called on mid-fade unmount.
- Full test suite: **380/380 actual tests GREEN**; 9 Wave 0 RED stubs remain in fail state for plans 06-04 (TotalsPanel × 5) and 06-08 (Thumbnails × 3) plus 1 TotalsRow stub — all intentional, all in scope for later waves.
- TypeScript: `npx tsc --noEmit` runs clean (silent exit 0).

## Task Commits

1. **Task 1 RED — HoverRing listening={false} + zoom-compensated assertions** — `88a9ab7` (test)
2. **Task 1 GREEN — HoverRing transient white outer ring (D-11)** — `51ab85e` (feat)
3. **Task 2 RED — PulseHighlight 1500ms rAF fade + listening regression assertions** — `66c4217` (test)
4. **Task 2 GREEN — PulseHighlight 1500ms rAF fade (D-12)** — `dfb3855` (feat)

## Files Created

- `src/renderer/src/components/HoverRing.tsx` — exports `HoverRing`, `HoverRingProps`
- `src/renderer/src/components/PulseHighlight.tsx` — exports `PulseHighlight`, `PulseHighlightProps`

## Files Modified

- `src/tests/highlight-overlay-listening.test.ts` — 8 real assertions covering both overlays' listening regression + zoom-compensation contracts
- `src/tests/pulse-highlight-animation.test.ts` — 8 real assertions for the rAF fade lifecycle + per-test-file `IS_REACT_ACT_ENVIRONMENT = true` flag

## Decisions Made

- **PulseHighlight uses useState(progress) + rAF, not direct Konva node attr mutation via refs** — keeps the component pure-React and trivially testable through the existing react-konva mock pattern (Circle/Line stub renders as `<div data-opacity=...>` so jsdom can read live frame values). The ~90 ticks per 1500ms fade are within React 19's render budget for the small render tree.
- **Quadratic ease-out on opacity, linear on stroke** — `1 - (1-t)^2` reads as "fading away"; linear stroke deflation reads as "shockwave dissipating". Cubic was tested but felt too sluggish on the tail. Pattern matches CAD selection-pulse conventions.
- **`onComplete()` fires inside the rAF callback at t=1 (not in a useEffect watching progress)** — the rAF loop is already wrapped in `React.act` in tests, so placing the callback there guarantees the parent's unmount lands on the same render cycle as the t=1 frame. A useEffect path would have introduced a one-frame stale-overlay flash.
- **HoverRing uses an envelope-style single fat stroke for linear/area/perimeter** — `strokeWidth = (2 + 8)/zoom = 10/zoom` at 40% opacity reads visually identical to two stacked inner+outer strokes, and halves the Konva node count. The underlying markup's normal stroke shows through the 40% alpha as the implicit "inner" ring.
- **Test file pulse-highlight-animation.test.ts sets `globalThis.IS_REACT_ACT_ENVIRONMENT = true`** — without it, React 19 emits "The current testing environment is not configured to support act(...)" which the unmount-cleanup test's `console.error` spy catches as a false positive. Mirrors the per-test-file pattern in `markup-tool-pop-last-point.test.ts:66` and `markup-tool-strictmode.test.ts:91`. No `vitest.config.ts` change — parallel-executor-safe per the CLAUDE.md "no test infra changes mid-wave" rule.

## Deviations from Plan

None functional. The PulseHighlight GREEN commit was made in a second session after a PC restart that left the file untracked; the test-infra `IS_REACT_ACT_ENVIRONMENT` flag was added during the second session because the RED commit's unmount-cleanup test had a latent false-positive that only surfaced once the GREEN component existed (the spy catches the act-environment warning, not a real React state-on-unmounted warning). The flag was bundled into the GREEN commit since it's a test-infra correction, not new contract surface.

## Issues Encountered

- **PC restart between Task 1 GREEN and Task 2 GREEN** — left `src/renderer/src/components/PulseHighlight.tsx` untracked at session resume. STATE.md was slightly stale (claimed Wave 2 was "ready to start" but git showed three 06-03 commits already landed). Recovered cleanly: ran the targeted tests against the untracked component, found they passed except for the act-env warning false positive, fixed the test, ran full suite for regression check (380/380 actual tests GREEN), then committed the GREEN.
- **Stale HANDOFF.json from Phase 4.1 (2026-04-30)** — predated Phase 4.1 closure. Removed during this plan close-out since Phase 4.1 is fully done (all `04.1-*-SUMMARY.md` present).

## Verification Evidence

```
$ npx vitest run src/tests/pulse-highlight-animation.test.ts src/tests/highlight-overlay-listening.test.ts
 Test Files  2 passed (2)
      Tests  16 passed (16)

$ npx vitest run    # full suite
 Test Files  9 failed | 51 passed (60)    # 9 failures are remaining Wave 0 RED stubs (06-04, 06-08 scope)
      Tests  380 passed (380)              # zero regressions; +16 new GREEN over Plan 02's 364

$ npx tsc --noEmit
  # exit 0, no output

$ grep -c "listening={false}" src/renderer/src/components/HoverRing.tsx
  4    # 3 functional Konva shapes + 1 JSDoc reference

$ grep -c "listening={false}" src/renderer/src/components/PulseHighlight.tsx
  5    # 3 functional Konva shapes + 2 JSDoc references

$ grep -n "cancelAnimationFrame" src/renderer/src/components/PulseHighlight.tsx
  78:    return () => cancelAnimationFrame(raf)    # cleanup prevents dangling setState on unmount

$ grep -n "onComplete()" src/renderer/src/components/PulseHighlight.tsx
  74:        onComplete()    # exactly one callsite, fires at t=1
```

## Self-Check: PASSED

- Both created files exist on disk:
  - `src/renderer/src/components/HoverRing.tsx` — FOUND
  - `src/renderer/src/components/PulseHighlight.tsx` — FOUND
- All four task commits found in `git log --oneline`:
  - `88a9ab7` (Task 1 RED) — FOUND
  - `51ab85e` (Task 1 GREEN) — FOUND
  - `66c4217` (Task 2 RED) — FOUND
  - `dfb3855` (Task 2 GREEN) — FOUND
- All success criteria from `<done>` blocks met:
  - Task 1 done: "HoverRing implemented. All Konva shapes have listening={false}. highlight-overlay-listening.test.ts GREEN for HoverRing cases." — PASSED
  - Task 2 done: "PulseHighlight implemented. 1500ms rAF fade with cancelAnimationFrame cleanup. All shape props have listening={false}. Both animation and listening tests GREEN." — PASSED

## TDD Gate Compliance

Both Tasks ran the canonical RED → GREEN sequence:

- **Task 1:** `88a9ab7` (test RED — HoverRing component absent, import resolution fails) → `51ab85e` (feat GREEN — HoverRing.tsx lands, 6 assertions go GREEN)
- **Task 2:** `66c4217` (test RED — PulseHighlight component absent) → `dfb3855` (feat GREEN — PulseHighlight.tsx lands + test infra flag, 8 assertions go GREEN)

No REFACTOR commits were needed; both implementations matched the locked RESEARCH §3 patterns directly.

## Next Phase Readiness

- **Wave 3 (06-04 / 06-05 — TotalsPanel + TotalsRow)** can begin — TotalsRow's hover/click handlers will call `useMarkupHighlight.setHoverMatches` / `triggerPulse`, which will populate the props these overlays consume.
- **Wave 5 (06-07 — App.tsx three-column shell)** is the final integration point — it will mount `<HoverRing>` and `<PulseHighlight>` inside CanvasViewport's Layer 2, sourcing `markups` / `color` / `currentZoom` from the lifted `useMarkupHighlight` state and the existing `viewerStore.currentZoom`. The `onComplete` callback wires to `useMarkupHighlight.clearPulse`.
- **9 Wave 0 RED stubs remain** (TotalsPanel × 5, Thumbnails × 3, TotalsRow × 1) — correctly red, waiting for plans 06-04 through 06-08.

No blockers. No architectural deviations.

---
*Phase: 06-live-view-and-ui-polish*
*Plan: 03 (Wave 2 — transient Konva overlays: HoverRing + PulseHighlight)*
*Completed: 2026-05-05*
