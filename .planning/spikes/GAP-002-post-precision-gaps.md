# GAP-002 — What's Lacking After the Precision Update

**Type:** Product gap re-audit (analysis spike)
**Date:** 2026-06-29
**Status:** Complete
**Supersedes the open items of:** `GAP-001-key-takeoff-app-gaps.md` (2026-05-19)
**Trigger:** "What are the things that are now lacking? We have incorporated new updates to our takeoff tool."

---

## What changed since GAP-001

GAP-001 (2026-05-19) found 14 gaps in 3 tiers and recommended a v1.1 sequence. Since then,
Phases 10–14 shipped and three feasibility spikes (001/002/003) resolved. The measurement /
markup engine is now genuinely strong. Here is what closed:

| GAP-001 / BACKLOG item | Status now | Shipped by |
|---|---|---|
| GAP-T1-01 Vertex editing | ✅ CLOSED | Phase 12 |
| GAP-T1-02 Markup translate / move | ✅ CLOSED | Phase 12 |
| GAP-T2-02 Step-level undo (in-progress) | ✅ CLOSED | Phase 10 |
| Post-commit step undo (re-open committed) | ✅ CLOSED | Phase 13 |
| GAP-T2-05 / MM-06 Snapping | ✅ CLOSED | Phase 14 (spike 002) |
| MM-05 Curved / arc segments + curved area | ✅ CLOSED | Phase 14 (spikes 003/003b) |
| GAP-T2-00 Scale-ratio (1:100) input | ⛔ SCRAPPED on purpose | Phase 11 — draw-line judged sufficient at UAT |

That's a real milestone: **the canvas now feels malleable and precise.** The remaining gaps
are no longer about *drawing* — they're about **distribution, pricing, delivery, and the
long tail of measurement types.** The center of gravity has moved.

---

## Current capability inventory (delta from GAP-001)

New since the last audit, on top of the GAP-001 inventory:

- **Edit committed geometry** — vertex drag (square handles), whole-shape translate, group move, all undoable.
- **Step-level undo everywhere** — Ctrl+Z pops the last point mid-draw; on a committed multi-point markup it re-opens the shape in drawing mode instead of deleting it.
- **Snapping** — endpoint / vertex / nearest-point-on-segment via grid-hash spatial index, screen-constant tolerance, □/△ glyphs, F3 toggle / Alt suspend, active during placement *and* editing.
- **True circular arcs** — any linear / perimeter / area / wall edge can be a 3-click arc with live preview, bulge-handle reshaping, endpoint re-solve. Arc length and circular-segment area measured exactly (outward + inward); self-intersecting boundaries blocked on commit; arcs round-trip through save/reload and BOQ export.

---

## What's now lacking — re-ranked

### Tier 0 — Distribution blocker (nothing else reaches a user without this)

#### GAP-02-DIST: No shipped installer, no live auto-update channel
**State (verified):** `electron-builder.yml` exists and is configured (NSIS Windows target,
desktop shortcut, `${name}-${version}-setup.exe` artifact) and `build:win` is wired. **But:**
- `electron-updater` is **not installed** (not in dependencies).
- `publish.url` is the placeholder `https://example.com/auto-updates`.
- No build has been produced or released; the app still only runs from the dev server.

**Why it's #1:** Every other gap is invisible to an estimator who cannot install the app.
This is mostly **infra/build-work**, but Electron Windows packaging has real feasibility
surprises (native-dep rebuild, PDF.js worker bundling into the asar, unsigned-binary
SmartScreen warnings, first real `electron-builder --win` run). A thin **smoke spike** —
"produce one installable .exe, run it on a clean Windows profile, confirm a PDF loads and a
markup persists" — de-risks the whole packaging phase before committing to it.

---

### Tier 1 — "Measuring tool → estimating tool" value gaps

#### GAP-02-PRICE: Still no pricing column (rate × qty = cost)
**State (verified):** no `rate`/`cost`/`price` field anywhere in the markup or project schema.
BOQ is still Item | Quantity | UoM only. This was GAP-001's headline insight and it has **not
moved**. Note a live **scope tension**: PROJECT.md still lists "Unit cost / pricing" as
*Out of Scope for v1*. So this is a **product decision** before it is build-work — decide
whether "key takeoff app" means pricing belongs in scope now.
**Spike value:** low-math, but the *inline rate-edit feel* in the totals panel is worth a quick **sketch** (not a full spike).

#### GAP-02-LIB: No persistent item library
**State:** unchanged from GAP-001 GAP-T1-05. Autocomplete still draws only from the current
project. Pure build-work (AppData JSON + IPC); **no spike needed.**

---

### Tier 2 — Delivery & QA gaps (feasibility-uncertain → spike candidates)

#### GAP-02-PDFOUT: No flattened PDF-with-markups export — *and arcs raise the bar*
**State (verified):** `pdf-lib` is **not installed**. There is still no way to hand a client
or colleague a PDF showing the takeoff. This was GAP-T1-04, deferred to v2 — but the Phase 14
arc work **increased its uncertainty**: a flattener must now redraw true circular arcs (not
just polylines) in PDF page-space, across multi-page, with the Konva→PDF coordinate transform.
**Strong spike candidate** — coordinate transform + arc rendering fidelity are exactly the
kind of "prove it on a feeling" question spikes exist for.

#### GAP-02-CUTOUT (MM-01): Deductions / cutouts — the signature takeoff feature, now collides with arc math
**State:** still absent. `polygonArea` handles a single ring; you cannot subtract a door,
column, or void from a floor/wall area. This is *the* feature estimators name first. The
**new wrinkle:** Phase 14 made area edges curve-capable, so an inner cutout ring may itself
contain arcs — the shoelace-±-circular-segment sign rules from spike 003b must compose with
multi-ring subtraction. **Spike candidate** (integration of MM-01 with the arc area engine).

---

### Tier 3 — Productivity long tail (known build-work, no spike)

From BACKLOG MM-series, still open and now mostly low-risk:
- **MM-02 Volume** (area × depth → m³) · **MM-03 Pitch/slope factor** (roof true area)
- **MM-04 Quick ruler** (throwaway measure) · **MM-07 Ortho/angle lock** (Shift → 0/45/90°)
- **MM-08 Live readout while drawing** (running length/area at cursor — must now be *arc-aware*)
- **MM-09 Per-segment length labels** · **MM-11 Duplicate / array / cross-page copy** · **MM-12 Markup rotation**
- GAP-T2-03 **Markup notes** · GAP-T2-04 **Cross-page item breakdown**

#### GAP-02-DOCS: The feature surface has outgrown its (absent) help
**State (verified):** Help and Settings ribbon tabs are still "Coming soon" stubs. Meanwhile
the app gained snapping (F3 / Alt), the 3-click arc gesture, bulge reshaping, vertex-edit
mode, and step-undo re-open — **none discoverable in-app.** This directly violates the
standing "how-to-manual" requirement (every tool/shortcut/gesture documented as built). Pure
build-work, but rising in priority precisely *because* the recent updates added hidden depth.

---

### Validated-but-not-productized

#### MM-10 Auto-count: feasibility proven, product not built
Spike 001 VALIDATED offline template-match at F1 89.7% in ~100ms. The real build (OpenCV.js
in a Worker, coarse-to-fine pyramid, multi-scale/rotation, sensitivity slider, review/confirm
UX) is **unbuilt** — `opencv`/`cv` is not a dependency. The remaining uncertainty is the
**productization UX** (how the estimator reviews/accepts detections), not the core algorithm.

---

## Recommended next sequence

1. **GAP-02-DIST** — smoke-spike the Windows installer, then a packaging phase. *Unblocks every demo.*
2. **GAP-02-PRICE** — make the scope decision first; if in, it's the highest-value feature.
3. **GAP-02-PDFOUT** — spike the arc-aware flattener (delivery/QA unlock).
4. **GAP-02-CUTOUT** — spike deductions × arc area (signature feature).
5. **GAP-02-DOCS** + Tier-3 build-work — fold into a polish phase.

## Feasibility-uncertain → worth an experiential spike
- **004-installer-smoke** — produce + run one real `.exe` on a clean profile.
- **005-pdf-flatten-arcs** — render committed markups (incl. true arcs) onto a multi-page PDF via pdf-lib.
- **006-area-cutouts** — multi-ring area subtraction composed with the arc area engine.

Everything else is known build-work → route to `/gsd-review-backlog` or `/gsd-plan-phase`.

---

## Documentation drift found (fix on the way past)

`.planning/BACKLOG.md` claims *"pricing+library = Phase 14."* **False** — Phase 14 was Markup
Geometry Precision (snapping + arcs). Pricing and item library have **not** shipped and remain
open (GAP-02-PRICE, GAP-02-LIB). The BACKLOG note should be corrected.

---

## Files / state verified for this audit
- `package.json` — no `electron-updater`, no `pdf-lib`, no `opencv`; `build:win` present
- `electron-builder.yml` — NSIS configured; `publish.url` is a placeholder
- `src/renderer/src/types/markup.ts` — no rate/cost/price field
- `src/renderer/src/components/RibbonToolbar.tsx` — Help/Settings still "Coming soon"
- `.planning/PROJECT.md` — Phase 14 complete; pricing/library listed Out of Scope
- `.planning/BACKLOG.md` — MM-01…MM-12; MM-05/MM-06 now shipped
