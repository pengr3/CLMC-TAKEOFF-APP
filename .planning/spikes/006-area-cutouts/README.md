---
spike: 006
name: area-cutouts
type: standard
validates: "Given a committed area with a door/column/void inside it, when the user draws an inner cutout ring, then NET area = outer − Σ holes and the composition holds even when the holes contain arcs"
verdict: "VALIDATED (math) · PENDING human feel-test (demo)"
related: [003b, 002]
tags: [markup, area, cutout, deduction, mm-01, arc-area, signature-feature]
---

# Spike 006: Area Cutouts / Deductions (MM-01)

## What This Validates

**The signature takeoff feature, still absent (GAP-003 Tier 1).** Today `AreaMarkup` is a
single `points[]` ring and `polygonArea` measures one ring — you cannot subtract a door,
column, opening, or void from a floor/wall area. Phase 14 added arcs, which raised the bar:
an inner cutout ring may itself be curved, so multi-ring subtraction must compose with the
spike-003b shoelace-±-circular-segment engine.

**Given** a committed area with a hole inside it, **when** the user draws an inner ring,
**then** NET area = `polygonArea(outer) − Σ polygonArea(hole_i)` — and that stays correct when
either the outer OR the holes contain arcs.

Two questions, answered separately: the **math** (does the subtraction compose, arcs and all?)
and the **feel** (how do you draw a hole, validate it's inside, render the punch-out, read the
live net?).

## Research

The insight to test: **no new area math is needed.** The shipped single-ring arc-aware
`polygonArea` (which returns an absolute, winding-independent area) can be called once per
ring; net = outer minus the holes. This is the standard even-odd / multi-ring approach used by
every CAD area engine. The alternative — a bespoke multi-ring signed-area integrator — is more
code and more failure modes for zero benefit if the simple composition is provably correct.

| Approach | Reuses shipped engine | Handles arc holes | Winding-independent | Verdict |
|----------|----------------------|-------------------|---------------------|---------|
| **outer − Σ holes** (per-ring `polygonArea`) | ✅ | ✅ (each ring is arc-aware) | ✅ (abs per ring) | **chosen** |
| bespoke multi-ring signed integrator | ❌ new code | needs re-derivation | must enforce winding | rejected |
| tessellate everything → one big shoelace | ❌ | lossy | ✅ | oracle only |

Data-model implication for the real build: `AreaMarkup` gains `holes?: Array<{ points; arcs? }>`
(additive, optional → no `formatVersion` bump, same strategy as `arcs?`). Konva renders the
punch-out with a `Shape` using `sceneFunc` + `fillRule: 'evenodd'` (or `globalCompositeOperation`).

## How to Run

**Math oracle (self-verifying):**
```
node .planning/spikes/006-area-cutouts/experiment.cjs
```
**Interactive feel demo (open in a browser):**
```
.planning/spikes/006-area-cutouts/index.html
```
Draw an area (click, Enter to close) → pick a Cutout mode → punch holes → watch NET update live.
Export button dumps a forensic JSON log (events + gross/holes/net summary).

## What to Expect

- Oracle: `[A straight] PASS`, `[B arc] PASS`, all six edge cases `ok`, plus the estimating-impact line.
- Demo: the hole renders as a real punched void (even-odd fill); the right panel shows
  Gross − each cutout = **NET m²**; a cutout drawn outside the area turns amber with a warning.

## Observability

The demo carries a forensic log layer: every vertex/close/mode-change/warning is timestamped
(`+Nms CAT msg`) in the right panel and exportable as JSON with a computed summary
(`gross_m2`, per-hole `area_m2` + `insideOuter`, `net_m2`).

## Investigation Trail

1. **Ported the shipped functions verbatim** (`solveCircle`, `circularSegmentMagnitude`,
   `polygonArea`) so the oracle tests the REAL engine, not a re-implementation.
2. **Two independent oracles, not one.** Straight rings checked against exact shoelace AND
   Monte-Carlo point-in-region (proves the very idea of "outer minus holes", not just the
   algebra). Arc rings checked against fine tessellation (K=4000) — the same trick spike-003
   used for arc *length*, here for *area*.
3. **Deliberately adversarial windings.** Test A wound holes OPPOSITE to the outer; edge case
   c4 wound a hole the SAME way as the outer. Both passed → the abs-per-ring composition is
   winding-independent, so the real build never has to enforce hole winding.
4. **Arcs on both sides.** Test B put circular (4-arc) holes inside a ±bulged rectangular outer;
   edge cases c5/c6 put an inward arc on the outer and an arc edge on a hole. All matched
   tessellation to ~1e-8 — consistent with spike-003b's own ~2.9e-8 arc-area error.
5. **Feel demo** built to surface the drawing UX the math can't answer: inner-ring start, the
   inside/outside validation decision (BLOCK vs CLIP — flagged amber, left for the build), and
   the even-odd punch-out render.

## Results

**Math — VALIDATED (self-verifying oracle):**

| Test | What | Worst relErr |
|------|------|--------------|
| A | straight multi-ring closed-form vs exact shoelace | **5.85e-16** (machine ε) |
| A | straight closed-form vs Monte-Carlo (40k) | 6.9e-2 (statistical, expected loose) |
| B | arc-aware multi-ring vs fine tessellation (K=4000) | **1.35e-8** |
| C | 6 named edge cases (square/circular/two/same-wind/inward-arc/arc-hole) | all `ok` (≤4.9e-9) |

**Key finding:** `netArea = polygonArea(outer) − Σ polygonArea(hole_i)` using the **already-shipped**
arc-aware engine is exact and winding-independent. **MM-01 needs no new area mathematics** — only
(1) a `holes?` field on `AreaMarkup`, (2) an inner-ring drawing gesture, (3) an even-odd render,
and (4) an inside/outside validation policy. A single-ring takeoff **over-counts a slab-with-void
by 12.5%** in the demo case — the deduction is material to every real estimate.

**Feel — PENDING.** The interactive demo is built and self-contained but the in-app Browser was
unresponsive in this session, so the drawing feel (inner-ring start, punch-out render, live net,
the BLOCK-vs-CLIP amber warning) needs a human open-and-try. Open `index.html` and confirm.

**Open build decisions surfaced (not blockers):** (a) cutout drawn partly outside the area →
BLOCK on commit vs CLIP to the outer (demo flags amber, recommends BLOCK to mirror the existing
self-intersection guard); (b) nested holes / hole-in-hole → out of scope for v1; (c) snapping a
hole vertex to the outer edge should reuse the shipped grid-hash index (spike 002) for free.
