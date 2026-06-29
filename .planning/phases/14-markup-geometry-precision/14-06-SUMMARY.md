---
phase: 14-markup-geometry-precision
plan: 06
subsystem: integration
tags: [arc, boq, renderer, round-trip, save-reload, manual-notes, uat, konva, vitest, typescript]

# Dependency graph
requires:
  - phase: 14-markup-geometry-precision (plan 01)
    provides: arc-aware polylineLength/polygonArea (optional arcs arg) + solveCircle + arcs? per-edge metadata
  - phase: 14-markup-geometry-precision (plan 04)
    provides: arcs map populated by the 3-click drawing gesture
  - phase: 14-markup-geometry-precision (plan 05)
    provides: bulge-edit/endpoint-resolve writing the arcs map; committed-arc VISUAL rendering deferred to THIS plan
provides:
  - "Arc-aware BOQ aggregator: m.arcs threaded into linear/area/perimeter(length+area)/wall math (SC #4)"
  - "buildArcAwareFlatPoints (arc-math.ts) — pure flat-point sampler for arc edges (24 samples/edge, closed/open, finite-guarded)"
  - "Area/Perimeter/Linear/Wall renderers draw the true sampled arc curve (not the chord); labels read arc-aware math so on-canvas matches BOQ"
  - "arc-roundtrip test — arcs survive snapshot → JSON → validateV2 → hydrate (deep-equal) + aggregateBoq reports arc-aware quantity > chord (SC #5)"
  - "14-MANUAL-NOTES.md — shortcuts table + indicator legend + usage notes for every Phase-14 feature (project-howto-manual)"
affects: [phase-14-uat, end-user-manual-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE pure arc-sampler (buildArcAwareFlatPoints) shared by all four renderers — geometry stays in arc-math.ts, components stay declarative"
    - "Live drag preview (overridePoints) passes arcs=undefined → straight chords, because the stored arcs map no longer aligns with the moved points mid-drag"
    - "Arc-aware closing edge: closed=true samples edge n-1→0 keyed on n-1 (14-01 contract); Konva `closed` then draws a zero-length closer back to start[0]"

key-files:
  created:
    - src/tests/arc-roundtrip.test.ts
    - .planning/phases/14-markup-geometry-precision/14-MANUAL-NOTES.md
  modified:
    - src/renderer/src/lib/boq-aggregator.ts
    - src/renderer/src/lib/arc-math.ts
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
    - src/renderer/src/components/markup/LinearMarkup.tsx
    - src/renderer/src/components/WallMarkup.tsx

key-decisions:
  - "buildArcAwareFlatPoints lives in arc-math.ts (pure), not duplicated per renderer — single sampling path, finite-guarded, testable"
  - "Renderers pass arcs=undefined while overridePoints (live drag) is active — the stored arcs map keys on stored-point indices and would mis-sample against moved preview points"
  - "Perimeter closing-edge arc rides closingPts directly: in [...pts, pts[0]] the closing edge IS index n-1 (pts[n-1]→pts[n]=pts[0]), so m.arcs maps onto closingPts with no re-keying"
  - "WallMarkup label computes arc-aware m² inline (polylineLength(points, arcs)) instead of wallAreaM2 (which is straight-only) — keeps the label == the BOQ wall branch"
  - "14-MANUAL-NOTES uses the FINAL confirmed keys (hold-A one-off + Shift+A sticky from 14-04) over the UI-SPEC's generic 'Arc toggle' wording, but copies the glyph/handle captions verbatim"

requirements-completed: [D-01, D-04, D-08, D-09]

# Metrics
duration: ~10min (autonomous engineering; UAT pending human)
completed: 2026-06-29
---

# Phase 14 Plan 06: Arc-Aware BOQ + Renderers + Round-Trip + Manual Docs Summary

**Closes the curved-edge loop: the BOQ aggregator now threads each markup's `arcs` map into the linear/area/perimeter/wall measurement math (SC #4), the four on-canvas renderers draw the true sampled arc curve through a single pure `buildArcAwareFlatPoints` helper (so the drawn shape and the reported quantity both use the arc, not the chord), an arc-roundtrip test proves arc geometry survives save → validateV2 → reload deep-equal AND that `aggregateBoq` reports the arc-aware quantity over the straight chord (SC #5), and 14-MANUAL-NOTES.md captures every Phase-14 shortcut, glyph, handle, and gesture manual-ready. The end-of-phase human UAT (Task 3) is PREPARED and returned as a checkpoint — it requires the estimator's hands-on confirmation and cannot be self-run.**

## Performance

- **Duration:** ~10 min autonomous engineering (Tasks 1 + 2); Task 3 UAT is a pending human gate.
- **Tasks:** 2 autonomous (`type="auto"`) executed + committed; 1 checkpoint (`checkpoint:human-verify`) prepared and returned.
- **Files created:** 2 (arc-roundtrip.test.ts, 14-MANUAL-NOTES.md)
- **Files modified:** 6 (boq-aggregator, arc-math, AreaMarkup, PerimeterMarkup, LinearMarkup, WallMarkup)

## Accomplishments

- **Arc-aware BOQ (Task 1):** `boq-aggregator.ts` now passes `m.arcs` as the second arg to every measurement call — linear → `polylineLength(points, m.arcs)`; area → `polygonArea(points, m.arcs)`; perimeter → `polylineLength(closingPts, m.arcs)` (length) + `polygonArea(pts, m.arcs)` (area); wall → `polylineLength(wallM.points, m.arcs)`. Straight markups have no `arcs` field, so their quantities are byte-identical to before. (SC #4)
- **buildArcAwareFlatPoints (Task 1):** new pure helper in `arc-math.ts` (next to `solveCircle`) that builds the flat `[x0,y0,...]` Konva-`Line` point array, sampling 24 points along the solved arc for any edge with an `arcs[i]` entry (walking the way that passes through the on-arc mid — major/reflex arcs sampled the long way) and leaving non-arc edges as straight chords. Supports `closed` (area/perimeter, incl. the closing edge n-1→0) and open (linear/wall). Collinear / non-finite → straight 2-point fallback (never a NaN-radius arc).
- **Arc-drawing renderers (Task 1):** `AreaMarkup`, `PerimeterMarkup`, `LinearMarkup`, `WallMarkup` all build `flatPoints` via `buildArcAwareFlatPoints` and read the arc-aware `polygonArea`/`polylineLength` for their labels — so the drawn curve AND the label both match the arc-aware BOQ quantity. During a live drag preview (`overridePoints`) they pass `arcs=undefined` (straight chords) because the stored arcs map no longer aligns with the moved points.
- **arc-roundtrip test (Task 1):** 3 cases — (1) an arcs map on an area + a linear survives `snapshotProject` → `JSON.stringify` → `validateV2` → `hydrateStores` deep-equal (both the validated file and the hydrated store); (2) `aggregateBoq` reports the arc-aware area/length (matching the arc-aware math to 1e-6) and STRICTLY GREATER than the straight-chord value for the same OUTWARD-bulge shape; (3) an arc-less markup still loads (`arcs` undefined) and measures as the plain square. (SC #5)
- **14-MANUAL-NOTES.md (Task 2):** three sections — a SHORTCUTS TABLE (F3 snap toggle, Alt suspend, hold-A one-off, Shift+A sticky, 3-click arc gesture, bulge/corner reshape, all with the FINAL confirmed keys), an INDICATOR LEGEND (□ vertex snap, △ segment snap, round blue bulge handle, red self-crossing highlight, ✕ reserved-not-shipped), and USAGE NOTES for snapping, arc drawing, arc editing, and blocked-commit recovery — with the UI-SPEC manual-ready captions copied verbatim.

## Task Commits

1. **Task 1: arc-aware BOQ + renderers + round-trip test** — `9b45944` (feat)
2. **Task 2: 14-MANUAL-NOTES.md** — `e9d7edd` (docs)
3. **Task 3: human UAT** — PREPARED + returned as a `checkpoint:human-verify` (no commit; awaiting estimator confirmation)

**Plan metadata:** (this final docs commit)

## Files Created/Modified

- `src/renderer/src/lib/boq-aggregator.ts` — `m.arcs` threaded into linear/area/perimeter(length+area)/wall math.
- `src/renderer/src/lib/arc-math.ts` — `buildArcAwareFlatPoints` + private `sampleArcEdge` (pure, 24-sample, closed/open, finite-guarded).
- `src/renderer/src/components/markup/AreaMarkup.tsx` — arc-aware boundary + arc-aware area label (closed).
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — arc-aware boundary + arc-aware P/A label (closed, closing edge).
- `src/renderer/src/components/markup/LinearMarkup.tsx` — arc-aware path + arc-aware length label (open).
- `src/renderer/src/components/WallMarkup.tsx` — arc-aware primary+hairline path + inline arc-aware m² label (open).
- `src/tests/arc-roundtrip.test.ts` (NEW) — save/reload deep-equal + arc-aware-vs-chord BOQ + arc-less back-compat.
- `.planning/phases/14-markup-geometry-precision/14-MANUAL-NOTES.md` (NEW) — shortcuts table + indicator legend + usage notes (109 lines).

## Decisions Made

- **One pure sampler over four duplicated paths:** `buildArcAwareFlatPoints` keeps the arc-rendering geometry in `arc-math.ts` (the pure oracle), so the four renderers stay declarative and the sampling logic is unit-testable in isolation (consistent with the 14-01 pure-math sibling pattern).
- **`arcs=undefined` during live drag:** the stored `arcs` map keys on stored-point indices; while `overridePoints` (a vertex/body drag) is active those indices point at moved positions, so sampling the stored mids would mis-bend the preview. Straight chords during the drag, true arc on release, is the correct and least-surprising behavior (the curve re-solves via 14-05's endpoint re-solve on commit).
- **Perimeter closing-edge arc maps directly onto `closingPts`:** because `[...pts, pts[0]]` makes the closing edge index n-1 (pts[n-1]→pts[n]=pts[0]), `m.arcs` (keyed on n-1 for the closing edge per the 14-01 contract) needs no re-keying for the length call; `polygonArea(pts, m.arcs)` already keys the closing edge on n-1 internally.
- **Wall label inline, not `wallAreaM2`:** `wallAreaM2` is straight-only (`polylineLength(points)` with no arcs). The wall label now computes the arc-aware length inline so it equals the BOQ wall branch exactly.

## Deviations from Plan

**None requiring user input — autonomous engineering executed as written.** Two within-scope shaping choices, documented above as Decisions (not deviations):

1. Added the pure `buildArcAwareFlatPoints` helper to `arc-math.ts` rather than inlining a 24-point sampler in each of the four renderers — keeps the geometry testable and finite-guarded (Rule 2: correctness — consistent collinear/non-finite fallback in one place). The plan's `<action>` explicitly anticipated "use solveCircle + sample ~24 points … in each of the four markup renderers"; centralizing the identical math is the standard refactor, not a scope change.
2. WallMarkup's label switched from `wallAreaM2` (straight-only) to an inline arc-aware computation so the on-canvas label matches the arc-aware BOQ wall branch (Rule 1: otherwise the label would under-report a curved wall run while the export reported the true arc — a correctness mismatch).

No Rule 4 architectural decisions arose.

## Threat Flags

None — no new security-relevant surface. The arc-aware path is the inverse of the already-mitigated 14-01/14-05 surface: `buildArcAwareFlatPoints` / `sampleArcEdge` degrade to the straight chord on collinear / non-finite / degenerate input (never a NaN-radius arc), satisfying T-14-06-01 (hostile arcs → wrong BOQ or render crash). The additive `arcs` field rides the existing `Markup[]` cast through `validateV2` with no schema change, and the round-trip test asserts arc-less files still load + measure straight (T-14-06-02). No new packages (T-14-06-SC).

## Known Stubs

None. The arc-aware BOQ, the four arc-drawing renderers, and the round-trip test are all fully wired end-to-end against the `arcs` map populated by 14-04 drawing and edited by 14-05. The previously-deferred committed-arc VISUAL rendering (14-05's scoped-out item) is now SHIPPED here — placed area/perimeter/linear/wall markups draw the true arc.

## Type / Test Gate

- `npx tsc --noEmit -p tsconfig.web.json`: **0 errors**.
- `npm run build`: **succeeds** (`✓ built in 8.02s`).
- `npx vitest run src/tests/arc-roundtrip.test.ts src/tests/boq-aggregator.test.ts src/tests/boq-aggregator-wall.test.ts src/tests/project-serialize.test.ts`: **19 passed**.
- Full suite `npx vitest run`: **586 passed / 80 files** (was 583/79 — +3 arc-roundtrip cases, no regressions).

## UAT Status (Task 3 — pending human)

The end-of-phase human UAT is PREPARED and returned to the orchestrator as a `checkpoint:human-verify`. It maps the eight hands-on verification steps to the five ROADMAP Phase-14 success criteria (snapping + indicator; instant-at-scale; 3-click arc coexisting with straight; true arc length + signed area; self-intersection blocked + arc round-trips save/reload + BOQ). It cannot be self-run — it requires the estimator to open a calibrated plan, draw/edit on canvas, and visually confirm. On approval, the ROADMAP Phase 14 checkbox + STATE.md milestone are marked complete; failing scenarios become gap-closure plans via `/gsd:plan-phase 14 --gaps`.

## Next Phase Readiness

- Phase 14's curved-edge measurement is now end-to-end: draw (14-04) → edit (14-05) → render + measure + export + round-trip (14-06). The only remaining gate is the human UAT.
- `buildArcAwareFlatPoints` is reusable by any future feature that needs to render an arc-edged path (e.g. arc-aware thumbnails, PDF-stamp export).

## Self-Check: PASSED

- FOUND: src/tests/arc-roundtrip.test.ts
- FOUND: .planning/phases/14-markup-geometry-precision/14-MANUAL-NOTES.md
- FOUND commit: 9b45944 (Task 1)
- FOUND commit: e9d7edd (Task 2)
- Build: `npm run build` ✓ (typecheck:web 0 errors)
- Tests: 586 passed / 80 files (full suite); 19 passed (targeted arc-roundtrip + boq + serialize)

---
*Phase: 14-markup-geometry-precision*
*Completed (autonomous engineering): 2026-06-29 — human UAT pending*
