---
spike: 008
name: live-readout
type: standard
validates: "Given a linear/area/perimeter draw in progress, when the cursor moves, then a running (arc-aware) length/area reads out at the cursor without lag or clutter"
verdict: "VALIDATED (math + perf) · PENDING human feel-test (placement)"
related: [003, 006]
tags: [markup, live-readout, mm-08, mm-09, feel, drawing-loop]
---

# Spike 008: Live Measurement Readout While Drawing (MM-08)

## What This Validates

**The biggest feel gap in the drawing loop (GAP-003 Tier 2).** Today `updatePreview` only sets
the rubber-band `previewPoint` — it computes **nothing**; length/area appears only after commit.
Every pro tool (Bluebeam, PlanSwift, On-Screen Takeoff) shows a running measurement at the
cursor as you draw. This spike proves (a) the numbers are correct and cheap enough to recompute
on every mousemove, and (b) resolves the real design question: **where does the readout live —
following the cursor, or a fixed HUD corner?**

**Given** an in-progress draw, **when** the cursor moves, **then** a running length (linear) or
area+perimeter (area/perimeter) reads out live, arc-aware, without lag or occluding the cursor.

## Research

MM-08 was tagged "low math" in the backlog — the risk was never the formulas (they're the same
`polylineLength` / `polygonArea` already shipped), it was **feel + cost**:
- **Cost:** recomputing area on *every* mousemove for a large polygon — is it a frame-budget risk?
- **Placement:** cursor-follow reads where your eyes are but can occlude the next point; a fixed
  HUD never occludes but splits attention. This is a genuine UX fork, not a fact — so the demo
  ships **both** (plus "both") and lets a human feel which wins.
- **Arc-awareness:** GAP-003 flagged the readout "must be arc-aware" — mid arc-gesture the
  running total has to reflect the true arc, not the chord.

The demo also renders **per-segment length labels** (MM-09, a free adjacent win) behind a toggle,
so this one spike de-risks MM-08 *and* MM-09.

## How to Run

**Math + perf (self-verifying):**
```
node .planning/spikes/008-live-readout/verify.cjs
```
**Interactive feel demo (open in a browser):**
```
.planning/spikes/008-live-readout/index.html
```
Pick Linear / Area / Perimeter → click to draw → the running measurement follows the cursor
(and/or the HUD). Toggle placement, per-segment labels, live angle, and "curve the in-flight
edge" (arc-aware total). The right panel live-benchmarks readout compute per mousemove.

## What to Expect

- Verifier: 6/6 math checks `ok`; perf table showing µs/readout at N=10…5000, all `<< 16ms`.
- Demo: a green pill by the cursor showing e.g. `12.480 m` + `∠ 45.0°`, updating smoothly;
  toggling to HUD moves it to the fixed top-left; per-segment `m` labels on each leg.

## Observability

The demo instruments the hot path: mousemove count, avg/p99 **readout compute (µs)**, and avg
move interval (ms), all live in the panel and in the exported JSON summary. This is what proves
"no lag" empirically rather than by assertion.

## Investigation Trail

1. **Separated the two risks.** Wrote `verify.cjs` for the numbers (analytic checks: 3-4-5 legs,
   200² square area/perimeter, semicircle + quarter arc length) so the *feel* demo doesn't have
   to also carry correctness proof.
2. **Benchmarked the hot path deliberately at scale.** Recompute cost isn't interesting at 4
   points — it's interesting at 1000+. Measured N=10/100/1000/5000.
3. **Made placement a first-class toggle** rather than picking one — the whole point of a feel
   spike is to let the human choose, so cursor / HUD / both are all live.
4. **Wired arc-awareness in** via a perpendicular-sagitta in-flight arc (ported `solveCircle` /
   `arcLength`) so the running total demonstrably tracks the arc, and quantified the error a
   chord-only readout would show.

## Results

**Math — VALIDATED:** 6/6 analytic checks exact (worst relErr 1.8e-16). Arc-aware total avoids a
**10.0%** under-read on a 90° quarter-arc leg (chord 282.84 vs arc 314.16 px).

**Perf — VALIDATED (the real finding):** recomputing `polygonArea` + perimeter per mousemove is
effectively free:

| polygon size | µs / readout | vs 16ms frame budget |
|---|---|---|
| 10 pts | 1.48 µs | ~10,000× under |
| 100 pts | 3.43 µs | ~4,600× under |
| 1,000 pts | 25.5 µs | ~625× under |
| 5,000 pts | 128.9 µs | ~124× under |

So the "does live recompute lag?" worry is **dead** — even a pathological 5k-vertex shape leaves
the frame 99%+ idle. The real build can recompute unconditionally on every `updatePreview`; no
throttling, no memoization needed.

**Feel — PENDING.** The placement decision (cursor-follow vs HUD vs both), label clutter on long
polylines, and smoothness are for a human to judge in `index.html` (in-app Browser was
unresponsive this session). My prior: **cursor-follow for the primary metric + a thin HUD echo**
— but this is exactly the call the user should feel, per the spike's purpose.

**Build signal:** MM-08 is pure win, no perf gate. Fold MM-09 (per-segment labels) in at the same
time — the render is already proven here. Wire it into `updatePreview` (compute) + a Konva label
node that follows the pointer (render).
