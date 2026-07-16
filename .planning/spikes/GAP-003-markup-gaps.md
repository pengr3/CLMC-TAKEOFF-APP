# GAP-003 — What's Lacking on Marking Up

**Type:** Product gap re-audit (analysis spike), scoped to the markup / drawing inner loop
**Date:** 2026-07-16
**Status:** Complete
**Supersedes the markup-relevant open items of:** `GAP-002-post-precision-gaps.md` (2026-06-29)
**Trigger:** "What are the things we lack on marking up?"

---

## Scope of this audit

The question is scoped to **marking up** — the act of placing, drawing, measuring, and
manipulating markups on a plan. So this re-audit re-centers on the drawing inner loop:
measurement types, precision aids, drawing feel, productivity, and discoverability of the
markup tools.

It deliberately **excludes** distribution / delivery gaps (installer, PDF-with-markups
export, item library) — those were GAP-002's Tier 0–2 and are not about *marking up*. They
remain open and tracked in GAP-002; they are noted at the bottom for continuity only.

---

## What changed since GAP-002 (five phases shipped)

GAP-002 said the center of gravity had moved off *drawing* onto pricing/delivery. Phases
15–18 then delivered most of the pricing/UX side. Verified against the code:

| GAP-002 item / gap | Status now | Shipped by |
|---|---|---|
| GAP-02-PRICE — no pricing column | ✅ CLOSED | Phase 15 → 16 (`PriceEntry` material/labor/markup %, Estimate workspace, ₱ totals + export) |
| Perimeter double-counting (length + area) | ✅ SIMPLIFIED to length-only | Phase 15 |
| MM-11 (partial) — duplicate / copy | ⚠ PARTIAL — duplicate-in-place + copy-to-category + move-category + rename + reorder | Phase 17 |
| Toolbar mode-gating (7-tab ribbon) | ✅ CLOSED — tab-less rail + morphing ContextBar, one-click loop | Phase 18 (spike 007) |
| GAP-02-DIST / PDFOUT / LIB / DOCS | ⛔ STILL OPEN (delivery/discoverability — out of scope here except DOCS) | — |

The markup **inner loop** is now genuinely fast: pick tool → place → snap → arc → zoom → flip
page → repeat, all one click, no tab round-trips. What's left on *marking up* is (1) a few
measurement types you still can't express, (2) precision/feel aids that pros expect, and
(3) a signature feature — deductions — that is still absent.

---

## Current markup capability inventory (verified, post-Phase-18)

- **Tools:** Select · Count · Linear · Area · Perimeter (length-only) · Wall (length × height → m²) · Set Scale, on a persistent left rail.
- **Arcs:** any linear/area/perimeter/wall edge can be a true 3-click circular arc (sticky or one-off), with bulge-handle reshaping and endpoint re-solve. Exact arc length + circular-segment area (outward + inward), verified to ~1e-8.
- **Snapping:** endpoint / vertex / nearest-point-on-segment via grid-hash index, screen-constant tolerance, F3 toggle / Alt suspend, active during placement *and* editing.
- **Editing:** vertex drag, whole-shape translate, group move; step-level undo (pops last point mid-draw; re-opens a committed shape); chain placement (repeat an item without re-naming).
- **Organization:** rename group (with price/color/visibility re-key), drag-reorder within category, recolor, move to another category, copy to a category, duplicate in place.

## What's now lacking on marking up — re-ranked

### Tier 1 — Missing measurement capability (you can't quantify the work)

#### GAP-03-CUTOUT (MM-01): Deductions / cutouts — still absent, and now collides with arc math
**State (verified):** `AreaMarkup` is a single `points[]` ring; `polygonArea` takes one ring.
There is no way to subtract a door, column, opening, or void from a floor/wall area. This is
**the** feature estimators name first, and it is the last big *drawing* gap. The wrinkle
Phase 14 added: an inner cutout ring may itself contain arcs, so multi-ring subtraction must
compose with the spike-003b shoelace-±-circular-segment sign rules. Both the **math**
(multi-ring signed area with arcs) and the **feel** (how you start/close an inner ring, how
snapping and the arc gesture behave inside a hole, how it renders and hit-tests) are
uncertain. **Strong experiential-spike candidate** — this is GAP-002's `006-area-cutouts`,
named but never built.

#### GAP-03-VOLUME (MM-02): Volume (area × depth → m³)
**State (verified):** no volume type. Wall does length × height → m²; nothing produces m³ for
slabs, footings, or excavation. **Known build-work** — a depth input on an area-style markup,
mirroring the existing `wallHeight` pattern. Low risk, no spike.

#### GAP-03-PITCH (MM-03): Pitch / slope factor
**State:** absent. Roof true area = plan area × pitch multiplier; roofing takeoff is impossible
without it. **Known build-work** — a multiplier field on an area markup. Trivial math, no spike.

### Tier 2 — Precision & feel gaps (drawing is imprecise or blind)

#### GAP-03-LIVEREADOUT (MM-08): No running measurement while drawing
**State (verified):** `updatePreview` only sets `previewPoint` for the rubber-band line — it
computes **nothing**. Length/area appears only *after* commit. Every pro tool (Bluebeam,
PlanSwift, On-Screen Takeoff) shows a live length/area that updates at the cursor as you draw.
This is the single biggest *feel* gap in the drawing loop. Low math, but the feel is genuinely
uncertain: where the label sits without occluding the cursor, whether it must be arc-aware
mid-arc-gesture, latency at mousemove rate, clutter on long polylines. **Sketch/spike candidate.**

#### GAP-03-ORTHO (MM-07): No ortho / angle lock
**State (verified):** `recordClick` stores the raw stage point; no Shift-constrain anywhere.
Rooms and walls are rectilinear, so freehand placement is both slow and slightly wrong on
every "straight" run. **Known build-work** — constrain the in-progress point to nearest
0/45/90° while Shift is held. Low risk.

#### GAP-03-SEGLABEL (MM-09): No per-segment length labels
**State:** a polyline shows one total at its arc-length midpoint; no length per leg. Estimators
often need the individual run lengths, not just the sum. **Known build-work** — toggleable
per-segment labels. Low risk.

### Tier 3 — Productivity long tail

#### GAP-03-RULER (MM-04): No quick ruler
Throwaway "how far / what angle is this?" without creating a persistent markup. **Build-work** —
a non-persistent overlay reusing the length math. Pairs naturally with LIVEREADOUT.

#### GAP-03-ARRAY (MM-11 remainder): No array/grid duplicate, no cross-page copy
Phase 17 delivered duplicate-in-place and copy-to-category, but there is still no **grid array**
(repeat a markup on an offset grid — e.g. columns) and no **copy to another page** (repeat a
takeoff on a similar sheet). **Build-work.**

#### GAP-03-ROTATE (MM-12): No markup rotation
Vertex handles exist; no rotate handle on `VertexHandleOverlay`. **Build-work**, medium.

### Validated-but-not-productized

#### GAP-03-AUTOCOUNT (MM-10): Auto-count — algorithm proven, product unbuilt
Spike 001 VALIDATED offline template-match (F1 89.7% in ~100ms). `opencv`/`cv` is still not a
dependency and nothing is built. The remaining uncertainty is **not** the algorithm — it's the
**review/accept UX**: how the estimator picks a template, sweeps a sensitivity slider, and
confirms/rejects the detected pins before they become real count markups. That UX is a *feel*
question. **Spike candidate (productization UX, not the core algorithm).**

### Discoverability

#### GAP-03-DOCS: The markup surface has outgrown its (absent) help
**State (verified):** the app now has snapping (F3/Alt), the 3-click arc gesture, bulge
reshaping, vertex-edit mode, step-undo re-open, chain placement, and rename/reorder — and
**none of it is discoverable in-app**. Help is still a stub (folded to the ⋯ button in Phase 18).
Every recent phase added hidden depth. **Build-work**, rising in priority precisely *because*
marking up got deeper.

---

## Feasibility / feel-uncertain → worth an experiential spike

These three are the only markup gaps where *building a throwaway to feel it* beats going
straight to a plan. Ordered by value-to-the-drawing-loop:

| # | Spike | Validates (Given/When/Then) | Why a spike (not just build-work) |
|---|-------|-----------------------------|-----------------------------------|
| 006 | area-cutouts | Given a committed area with a door/column inside it, when the user draws an inner ring, then the net area = outer − inner and the ring composes with arcs | Multi-ring signed area × arc engine × inner-ring drawing feel all unproven together |
| 008 | live-readout | Given a linear/area draw in progress, when the cursor moves, then a running length/area (arc-aware) reads out at the cursor without clutter or lag | Pure feel — label placement, arc-awareness mid-gesture, mousemove latency |
| 009 | autocount-review-ux | Given template-match detections on a sheet, when the user tunes sensitivity and reviews, then accepted detections become real count pins with a trustworthy accept/reject flow | Algorithm is proven; the review/accept *feel* is the open question |

Everything else in Tiers 1–3 (volume, pitch, ortho, per-segment labels, quick ruler, array,
rotation, in-app docs) is **known build-work** → route to `/gsd-review-backlog` or
`/gsd-plan-phase`.

---

## Out of scope here (continuity note — still open from GAP-002)

Not about *marking up*, so untouched by this audit but still open:
- **GAP-02-DIST** — no shipped Windows installer / auto-update channel (distribution blocker).
- **GAP-02-PDFOUT** — no flattened PDF-with-markups export (delivery), arc-aware — `pdf-lib` still not installed.
- **GAP-02-LIB** — no persistent cross-project item library.

---

## Documentation drift found (fix on the way past)

`.planning/BACKLOG.md` header still says *"pricing+library = Phase 14."* **Still false** — the
GAP-002 audit flagged this and it was never corrected. Pricing shipped in **Phases 15–16**; the
item library has **not** shipped. Also MM-05/MM-06 shipped (Phase 14) and MM-11 partially
shipped (Phase 17); those rows should carry status markers.

---

## Files / state verified for this audit
- `src/renderer/src/types/markup.ts` — `MarkupType` = count|linear|area|perimeter|wall; `AreaMarkup` is single-ring; arc maps optional; Phase-17 rename/move/copy/duplicate commands present
- `src/renderer/src/lib/markup-math.ts` — `polygonArea` single-ring; arc-aware length/area; no volume/pitch
- `src/renderer/src/hooks/useMarkupTool.ts` — `updatePreview` sets previewPoint only (no live readout); `recordClick` raw point (no ortho constrain)
- `src/renderer/src/components/ToolRail.tsx` — tools: select/count/linear/area/perimeter/wall + Set Scale + Snap + Arc
- `src/renderer/src/lib/boq-types.ts` — `PriceEntry` material/labor/markup% (pricing shipped)
- `.planning/ROADMAP.md` — Phases 15 (pricing) / 16 (Estimate workspace) / 17 (rename+reorder) / 18 (toolbar) all complete
