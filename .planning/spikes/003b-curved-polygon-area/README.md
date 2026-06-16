# Spike 003b — curved-polygon-area
**Type:** standard (follow-up to 003)
**Date:** 2026-06-16
**Status:** VALIDATED

## Question (Given/When/Then)
Given a closed area/perimeter markup where one or more boundary EDGES are circular
arcs (not straight, each carrying its on-arc midpoint), WHEN we compute the
enclosed area as `shoelace(vertices) ± Σ circular_segment_area`, THEN the result
matches a numerical oracle for BOTH outward-bulging and inward-bulging arcs, for
mixed shapes (some straight + some arc edges), and the SIGN (add vs subtract) is
chosen correctly AUTOMATICALLY — with no per-case branching on bulge direction or
polygon winding.

## Research
The enclosed area of a polygon whose edges are chords plus arcs equals the signed
shoelace area over the vertices (the "chord polygon") plus a per-arc correction:
the circular segment between each chord and its arc, `segMag = (R²/2)·(θ − sinθ)`,
where `θ` is the sweep angle from spike 003's 3-point solver (the formula holds for
major arcs `θ > π` too, giving the major segment). The add/subtract decision is
derived automatically from two signs: (a) which side of the directed chord the
on-arc midpoint lies on, via the cross product `(to−from)×(mid−from)`, and (b) the
polygon winding, via the sign of the signed shoelace `2·S`. Accumulating everything
as doubled signed area and taking `abs` at the very end makes the rule
winding-independent. The ground-truth oracle densifies the WHOLE boundary into many
tiny straight chords (each arc sampled along its true circle) and runs ordinary
shoelace over the dense point set — fully independent of the segment formula.

## Experiment
`experiment.cjs` is a zero-dependency Node script (reuses spike 003's
`solveCircle`/arc-sweep solver verbatim, deterministic LCG PRNG, no `Math.random`).
It (1) runs 1000 randomized closed shapes (3–7 vertices on a circle → simple
chord polygon; ~60% of edges turned into arcs with random signed bulge; winding
randomly reversed) comparing the closed form to a dense-boundary shoelace oracle,
reporting max relative error split by inward vs outward; (2) checks five named edge
cases against hand-computed expected values; (3) cross-checks perimeter
(`Σ straight + Σ arc-length`) against a dense-boundary length oracle; (4) quantifies
the error the old straight-only `polygonArea` incurs.

Run: `node .planning/spikes/003b-curved-polygon-area/experiment.cjs` (~3.6 s).

## Results

**Sign-rule discovery (load-bearing):** the first run used
`contribution = + sign(cross)·2·segMag` and produced the EXACT MIRROR of the truth
(outward semicircle gave the inward area and vice-versa: computed 6073 vs oracle
13927). Flipping to `contribution = − sign(cross)·2·segMag` made every case correct.
So in page-space `{x,y}` the verified rule is **OUTWARD ⟺ sign(cross) ≠ sign(2·S)**.

**[1] Randomized batch (1000 shapes, oracle = 20 000 samples/arc):**
- arc edges outward / inward: **1583 / 1416**; shapes with ≥1 inward arc: **800**
- MAX relative error (all): **2.908e-6**
- MAX relative error (shapes with inward arcs): **2.908e-6**
- MAX relative error (outward-only shapes): **3.617e-9**

The single worst case (a small K=3 shape, area ≈ 244) is an ORACLE-RESOLUTION
artifact, not a math error: a focused diagnostic re-ran that shape with a 200 000-
sample oracle and the closed form agreed to **2.9e-8** (vs 2.9e-4 at 2000 samples).
The closed form is correct to ~1e-8; the coarse oracle is the limiting factor.

**[2] Named edge cases (square side L=100, R=L/2=50):**

| Case | Expected | Computed | Oracle | relErr |
|------|---------:|---------:|-------:|-------:|
| square + OUTWARD semicircle (L²+½πR²) | 13926.9908 | 13926.9908 | 13926.9904 | 0.000e0 ✓ |
| square + INWARD semicircle (L²−½πR²) | 6073.0092 | 6073.0092 | 6073.0096 | 0.000e0 ✓ |
| full circle = 2 semicircle edges (πR², R=137) | 58964.5525 | 58964.5525 | 58964.5465 | 1.2e-16 ✓ |
| mixed: 2 straight + 2 arc (stadium W=200,H=80) | 21026.5482 | 21026.5482 | 21026.5477 | 0.000e0 ✓ |
| near-collinear arc → straight fallback | 10000.0000 | 10000.0000 | 10000.0000 | 0.000e0 ✓ |

All five pass within 1e-6 (computed matches hand-derived expected to printed
precision; oracle agrees to ~1e-6).

**[3] Perimeter check (reuses 003 arc-length math):**
- stadium: closed-form 651.3274 vs oracle 651.3274 — relErr **9.9e-9**
- full circle: closed-form 860.7964 vs oracle 860.7964 — relErr **2.6e-8**

**[4] Gap left by the OLD straight-only `polygonArea`:**
- Stadium (rectangle + 2 semicircle caps): true 21026.5 px² vs old 16000.0 px²
  (just the rectangle) → **under-measures by 23.9 %**.
- Square + one outward semicircle: true 13927.0 px² vs old 10000.0 px² →
  **under-measures by 28.2 %**.

(With inward bulges the old method instead OVER-measures, since it ignores the
sliver removed from the interior — the correction fixes both directions.)

## Verdict
**VALIDATED.** Curved-polygon AREA is feasible and correct to ~1e-8: closed-form
`area = |2·S − Σ sign(cross)·2·segMag| / 2` matches the dense-boundary oracle across
1000 randomized shapes for both bulge directions and both windings, and reproduces
all hand-computed edge cases exactly. The exact sign rule that works (page-space
`{x,y}`): with `cross = (to−from)×(mid−from)` and `S` = signed shoelace, the
segment contribution to the doubled signed area is `− sign(cross)·2·segMag`;
equivalently **OUTWARD bulge ⟺ sign(cross) ≠ sign(S)** (enlarge area), **INWARD
⟺ sign(cross) = sign(S)** (reduce area) — one rule, no branching. Data-model
implication: the per-segment arc metadata already proposed in spike 003 (each edge
optionally carries its on-arc midpoint) is exactly sufficient; the area calc loops
the edges, applies the segment correction when `mid` is present, and falls back to
zero correction when the 3-point solve is degenerate (near-collinear). Remaining
risk: a huge INWARD bulge can dip past the opposite edge and self-intersect, which
breaks the simple-polygon assumption of both shoelace and the segment formula —
out of scope here; add a validation guard at markup time (cap sagitta / detect
self-intersection) before shipping.

## Tags
#measurement #markup #area #arc #geometry #feasibility
