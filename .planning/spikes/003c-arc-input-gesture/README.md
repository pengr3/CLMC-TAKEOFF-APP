# Spike 003c — arc-input-gesture (UX decision aid)

**Type:** sketch / decision-aid (interactive)
**Date:** 2026-06-26
**Status:** OPEN — feeds the Phase 14 `/gsd-discuss-phase` arc-gesture decision
**Companion to:** spike 003 (arc length math) and 003b (curved area math) — both VALIDATED.

## Why this exists

Spikes 003/003b proved the *math* for curved edges. They left ONE open UX question:
**how should the estimator actually draw an arc, and how do they switch between
straight and curved edges within a single markup?**

That is a feel decision, not a math decision — so this is an interactive demo, not a
number-crunching experiment. Open it, try each gesture, and pick.

## How to open

Just double-click `demo.html` (any browser; works fully offline — no build, no deps).
From a terminal: `start .planning/spikes/003c-arc-input-gesture/demo.html` (Windows).

## What's in it

The geometry is **ported verbatim from spike 003** (`solveCircle` + the major/minor arc
disambiguation), so the curve you draw is measured exactly the way the real feature will.

Three tabs to compare:

1. **3-click arc** — start / on-arc / end. The on-arc click is what lets you reach a
   **major arc (>180°)**, and it maps 1:1 to the solved `p1/p2/p3`. Spike 003's pick.
2. **Drag-to-bulge** — place a straight edge, drag its midpoint to bend it. Fluid for
   shallow curves but **cannot reach a major arc** by dragging; really an edit gesture.
3. **Mixed wall** — the real workflow: straight segments by default, toggle **Arc next**
   (or hold `A`) to make one edge curved. Watch the running total: *true (arc-aware)* vs
   *straight-only (what the app reports today)* and the under-measurement %.

## What to evaluate

- Which gesture feels right for a curved wall / bay window / radius?
- How should straight↔arc switching work — a hold-key, a sticky toggle, or a separate tool?
- Does drag-to-bulge's inability to make major arcs matter for your plans?

## Decision

_To be recorded in `14-CONTEXT.md` after the discussion._
