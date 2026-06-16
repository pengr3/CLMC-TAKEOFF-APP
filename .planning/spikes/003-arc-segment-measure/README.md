# Spike 003 — arc-segment-measure
**Type:** standard
**Date:** 2026-06-16
**Status:** VALIDATED

## Question (Given/When/Then)
Given a curved wall/edge on a plan, WHEN the user defines an arc segment by 3 points (start, a point on the arc, end), THEN we compute the true ARC LENGTH accurately and fold it into linear/perimeter totals so curved geometry is no longer under-measured by straight-line approximation — and the math is robust to edge cases (near-collinear points, tiny arcs, full semicircles, major/reflex arcs, tiny radii). Addresses backlog item MM-05: today `polylineLength` is straight-segments only, so curved walls/radii under-measure.

## Research
A circle through 3 points is found by intersecting the perpendicular bisectors of two chords — implemented as a determinant solve where `d = 2 * signedArea(p1,p2,p3)`; when `d -> 0` the points are collinear and we fall back to the straight chord length (scale-aware tolerance so it works for tiny and huge arcs alike). The arc must pass through the middle point, so major-vs-minor (and reflex >180°) disambiguation is done by computing the CCW sweep from p1 to p2 and from p1 to p3: if p2 is reached first, the CCW arc p1->p3 contains p2; otherwise the arc goes CW and the sweep is the complement. Closed-form length is `R * sweep`; this is verified independently by walking the arc as N tiny straight chords (numerical integration) — a fully separate method that never uses `R*theta`. Coordinates stay in page-space pixels exactly like the existing `polylineLength`, so conversion to mm is identical.

## Experiment
`experiment.cjs` (plain Node, zero deps) implements the 3-point circle solve, sweep disambiguation, closed-form arc length, and a numerical-integration oracle. It then: (1) runs 2000 randomized arcs from a deterministic LCG PRNG covering minor and major arcs, comparing closed-form vs oracle vs the known construction length; (2) exercises six named edge cases; (3) measures the under-measurement a pure-straight takeoff would incur on a representative curve; (4) builds a mixed polyline (straight + arc + straight) and shows the arc-aware total.

Run:
```
node .planning/spikes/003-arc-segment-measure/experiment.cjs
```

## Results
**Closed-form vs numerical oracle (2000 randomized arcs, minor + major):**
- max relative error, closed-form vs numerical oracle: **1.622e-10**
- max relative error, closed-form vs known true length: **4.273e-12**
- worst case was a 356° near-full-circle (R=249.29) — still matched to 10 decimal places.

**Edge cases:**

| case | mode | length (px) | outcome |
|------|------|-------------|---------|
| near-collinear | chord | 200.000000 | degenerate detected, chord fallback, radius=Inf — correct |
| tiny arc | arc | 2.003332 | relErr 6.71e-13 vs oracle (R=10.025, 11.45°) |
| semicircle | arc | 157.079633 | exactly π·50, sweep=180.00° |
| major/reflex arc | arc | 593.411946 | sweep=340.00° (>180° correctly chosen), relErr 3.67e-11 |
| tiny radius | arc | 1.570796 | exactly π·0.5, R=0.5000, sweep=180.00° |
| exactly collinear | chord | 100.000000 | degenerate, chord fallback, radius=Inf — correct |

**Straight-line under-measurement (representative curve):**
- Quarter-circle, R=2000px, 90° sweep: true arc **3141.593 px** vs straight chord **2828.427 px** → straight-line takeoff under-measures by **9.968 %**.
- Gentle 30° bend, R=2000px: arc 1047.20 vs chord 1035.28 → under by 1.138 %.

**Mixed polyline (straight + arc + straight):**
- Arc-aware total = sum(straight) + arc length = **3224.951 px**.
- Pure-straight `polylineLength` would report **3000.000 px** — under by **6.975 %** on this single-arc shape.

## Verdict
**VALIDATED.** Arc measurement is feasible and highly accurate: the closed-form `R*sweep` matches a fully independent numerical-integration oracle to ~1e-10 relative error across 2000 randomized minor and major arcs, and all edge cases (near-collinear → chord fallback, tiny arc, semicircle, reflex >180° arc, tiny radius, exact collinear) behave correctly. The straight-line approximation genuinely under-measures curved geometry (≈10% on a quarter-circle bend, ≈7% on the mixed-polyline example), confirming MM-05 is a real accuracy gap worth closing. **Data model:** measurement stays per-segment in page-space pixels — keep `points[] : StagePoint[]` for vertices and add per-segment curve metadata so a segment from vertex i→i+1 can be flagged as an arc carrying its mid point (e.g. an `arcs` map keyed by segment index `{ midX, midY }`, or a parallel `segments[]` with an optional `arcMid`); total length = `sum(straight segments) + sum(arcLength(from, mid, to))`, converting to mm identically to today. **Main UX decision for the real build:** 3-click arc (place start, click a point on the curve, place end — maps directly to the solved p1/p2/p3 and is unambiguous) vs drag-to-bulge (drag the mid handle off the chord — more fluid but needs the bulge mapped back to a mid point); the 3-click model is the lower-risk first implementation since it matches the math 1:1 and the on-arc click naturally disambiguates major vs minor arcs.

## Tags
#measurement #markup #arc #geometry #feasibility
