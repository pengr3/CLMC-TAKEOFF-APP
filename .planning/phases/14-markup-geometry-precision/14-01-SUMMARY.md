---
phase: 14-markup-geometry-precision
plan: 01
subsystem: geometry
tags: [arc, geometry, measurement, markup, vitest, typescript]

# Dependency graph
requires:
  - phase: 03-markup-tools-and-editing
    provides: Markup discriminated union, MarkupCommand undo/redo pattern, polylineLength/polygonArea straight-only math
  - phase: 08-markup-workflow-acceleration
    provides: hiddenItemNames? additive-optional-field precedent (no formatVersion bump)
provides:
  - Optional per-edge arc metadata (arcs?) on Linear/Area/Perimeter/Wall markups
  - reshape-arc MarkupCommand variant (symmetric old/new for reversible undo/redo)
  - arc-math.ts pure module — 3-point circle solver, true arc length, circular-segment magnitude
  - Arc-aware polylineLength + polygonArea (optional arcs arg, winding-independent sign rule)
affects: [arc-drawing, bulge-handle, arc-editing, boq-round-trip, self-intersection-guard, snapping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-math sibling module (arc-math.ts next to markup-math.ts): StagePoint in, number out, no React/Konva"
    - "Finite-guarded geometry: NaN/Infinity inputs fall back to straight-chord/zero, never throw (T-14-01-01)"
    - "Additive optional field rides the existing validateV2 cast — no formatVersion bump (mirrors hiddenItemNames?)"
    - "Doubled-signed-shoelace accumulation (no pre-abs) so the winding sign drives the arc correction"

key-files:
  created:
    - src/renderer/src/lib/arc-math.ts
    - src/tests/arc-math.test.ts
    - src/tests/markup-math-arc.test.ts
  modified:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/lib/markup-math.ts

key-decisions:
  - "arcs?: Record<number,{midX,midY}> keyed by segment start-vertex index; absent → straight edge; additive, no formatVersion bump"
  - "Arc length = R·sweep with CCW major/minor disambiguation through the on-arc mid; collinear → straight chord"
  - "polygonArea sign rule: subtract sign(cross)·2·segMag from doubled signed shoelace, abs at end (OUTWARD ⟺ sign(cross) ≠ sign(2·S))"
  - "Both arc-aware fns keep their single-arg signature so boq-aggregator + save/load callers compile unchanged"
  - "circularSegmentMagnitude returns 0 on collinear/degenerate; all public fns finite-guarded against hostile .clmc arc metadata"

patterns-established:
  - "Pattern: arc-math.ts is the pure 3-point arc geometry oracle; markup-math.ts is the only consumer that folds it into length/area"
  - "Pattern: per-edge arc metadata keyed by start-vertex index; closing edge of a closed polygon keys on n-1"

requirements-completed: [D-01, D-08]

# Metrics
duration: 6min
completed: 2026-06-29
---

# Phase 14 Plan 01: Markup Geometry Precision — Curved-Edge Measurement Foundation Summary

**Additive per-edge arc metadata on all four multi-point markups plus a validated 3-point arc-math module that makes polylineLength/polygonArea measure curved edges by true arc length (R·sweep) and the winding-independent circular-segment area correction — closing the ~10% under-measurement on a 90° arc.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-29T03:32:37Z
- **Completed:** 2026-06-29T03:38:00Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 5 (2 created lib/types, 2 test files, 1 modified math)

## Accomplishments
- Optional `arcs?: Record<number,{midX,midY}>` added to LinearMarkup/AreaMarkup/PerimeterMarkup/WallMarkup (CountMarkup intentionally excluded — single point, no edges); no formatVersion bump, no project-schema.ts validator change.
- `reshape-arc` MarkupCommand variant (symmetric `oldArcs`/`newArcs`) added for reversible arc undo/redo.
- New `arc-math.ts` pure module: `solveCircle` (perpendicular-bisector determinant, scale-aware collinear fallback, CCW major/minor sweep disambiguation), `arcLength` (R·sweep, chord fallback), `circularSegmentMagnitude` ((R²/2)(θ−sinθ)). Matches spike-003/003b oracles to ≤1e-6.
- `polylineLength`/`polygonArea` made arc-aware via an optional second `arcs` arg; the load-bearing sign rule (subtract `sign(cross)·2·segMag` from the doubled signed shoelace, abs at end) is correct for both OUTWARD and INWARD bulges and winding-independent.
- All inputs finite-guarded (T-14-01-01/02) — hostile/malformed `.clmc` arc metadata falls back to straight/zero, never throws.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Add additive arc metadata + reshape-arc command** — `1af9b15` (feat)
2. **Task 2: Implement arc-math.ts** — `8f6223a` (test, RED) → `b4fab28` (feat, GREEN)
3. **Task 3: Make polylineLength + polygonArea arc-aware** — `d0a5003` (test, RED) → `8974564` (feat, GREEN)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/renderer/src/types/markup.ts` — added optional `arcs?` field to 4 multi-point markup types + `ArcMap` alias + `reshape-arc` MarkupCommand variant.
- `src/renderer/src/lib/arc-math.ts` (NEW) — 3-point circle solver, arc length, circular-segment magnitude; pure, finite-guarded.
- `src/renderer/src/lib/markup-math.ts` — `polylineLength`/`polygonArea` accept optional `arcs` arg and apply arc-length + signed-segment correction.
- `src/tests/arc-math.test.ts` (NEW) — 12 oracle-pinned assertions (semicircle, quarter-circle R=2000, major/reflex 593.41, collinear fallback, segment magnitude, finite-guard).
- `src/tests/markup-math-arc.test.ts` (NEW) — 8 assertions (square+OUTWARD 13926.99, square+INWARD 6073.01, stadium 21026.55, winding-independence, arc-aware polyline).

## Decisions Made
- **arcs keyed by start-vertex index:** edge i→i+1 keys on i; closing edge of a closed polygon keys on n-1. Matches spike-003 data-model proposal and the loop structure of polygonArea.
- **Inlined `Record<number,{midX,midY}>` on each markup field** (rather than referencing the `ArcMap` alias) so the additive field is grep-verifiable per the plan's acceptance criteria; `ArcMap` alias is exported for downstream callers (markup-math uses a local alias of the same shape).
- **Doubled-signed shoelace, no pre-abs:** the polygon winding sign is load-bearing for the OUTWARD/INWARD arc decision, so the abs is deferred to the very end.
- **Finite fallback over throw:** matches the threat model's mitigate disposition — malformed save-file coordinates must degrade gracefully in a single-user offline desktop app, not crash the renderer.
- **Confirmed (no edit):** `project-schema.ts` `validateV2` accepts the new `arcs` field silently via the existing `Markup[]` cast — exactly as `wallHeight`/`hiddenItemNames?` do. No validator branch added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] arcLength finite-fallback returned NaN for non-finite endpoint coordinates**
- **Found during:** Task 2 (arc-math GREEN)
- **Issue:** When `from`/`to` carried a NaN/Infinity coordinate, `solveCircle` correctly returned collinear, but the chord fallback `euclideanDistance(from,to)` was itself non-finite — so `arcLength` returned NaN, violating the T-14-01-01 finite guarantee the threat model requires.
- **Fix:** Compute the chord once, substitute 0 when it is non-finite, and use that safe value for every fallback branch.
- **Files modified:** src/renderer/src/lib/arc-math.ts
- **Verification:** finite-guard test block (NaN/Infinity in every coordinate slot) asserts `Number.isFinite` on all outputs — all green.
- **Committed in:** b4fab28 (Task 2 GREEN commit)

**2. [Test correction] Quarter-circle under-measurement percentage assertion denominator**
- **Found during:** Task 2 (arc-math GREEN)
- **Issue:** The first draft of the quarter-circle test asserted `(arc−chord)/chord ≈ 9.97%`, but spike-003's "under-measures by 9.968%" is defined as `(arc−chord)/arc` (under-measurement relative to the true arc length, the correct denominator). The implementation value (11.07% over chord / 9.968% under arc) was correct; the test expectation was mis-stated.
- **Fix:** Corrected the test to assert the spike's actual definition `(arc−chord)/arc ≈ 0.09968` and added explicit `arc≈3141.593` / `chord≈2828.427` pins.
- **Files modified:** src/tests/arc-math.test.ts
- **Verification:** test green; implementation untouched.
- **Committed in:** b4fab28 (Task 2 GREEN commit)

---

**Total deviations:** 2 (1 Rule-1 bug fix in implementation, 1 test-expectation correction)
**Impact on plan:** Bug fix was required to satisfy the threat-model finite guarantee; test correction aligned the assertion with the spike oracle's stated definition. No scope creep, no architectural change.

## Threat Flags

None — no new security-relevant surface introduced. The plan's threat register (T-14-01-01 DoS, T-14-01-02 tampering) is fully mitigated by the finite-guard + collinear-zero fallbacks, asserted in arc-math.test.ts. No new packages installed (supply-chain surface unchanged).

## Known Stubs

None — all delivered functions are fully wired and oracle-verified. Arc metadata is a data-model + math foundation; the UI to *author* arcs (bulge handle, arc-draw mode) is intentionally deferred to later Phase 14 plans, as scoped in the plan objective.

## Issues Encountered
- Vitest transpiles TS leniently, so the RED phase of Task 3 ran (ignoring the not-yet-added second arg) and failed on values rather than on a compile error — the failing values still constituted a valid RED gate before the GREEN implementation.

## User Setup Required
None - pure TypeScript geometry + tests, no external service configuration.

## Next Phase Readiness
- Data model + math foundation complete and oracle-verified; downstream Phase 14 plans (arc drawing, BulgeHandle, ArcPreview, self-intersection guard, BOQ round-trip) can build on `arc-math.ts` + the `arcs` field + `reshape-arc` command directly.
- `polylineLength`/`polygonArea` are now ready to receive `markup.arcs` from the BOQ aggregator and save/load layers when those callers are updated in a later plan.

## Self-Check: PASSED

- Files verified on disk: `src/renderer/src/lib/arc-math.ts`, `src/tests/arc-math.test.ts`, `src/tests/markup-math-arc.test.ts`, `14-01-SUMMARY.md` — all FOUND.
- Commits verified in git log: `1af9b15`, `8f6223a`, `b4fab28`, `d0a5003`, `8974564` — all FOUND.
- Verification suite: `npx vitest run arc-math.test.ts markup-math-arc.test.ts markup-math.test.ts` → 48/48 green; `npx tsc --noEmit` → clean.

---
*Phase: 14-markup-geometry-precision*
*Completed: 2026-06-29*
