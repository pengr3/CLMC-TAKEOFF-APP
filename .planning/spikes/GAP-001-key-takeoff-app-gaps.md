# GAP-001 — What Lacks for a Key Takeoff App

**Type:** Product gap audit (analysis spike)
**Date:** 2026-05-19
**Status:** Complete

---

## Scope

Full audit of the current CLMC Takeoff App (v1.0-extended, 12 phases complete) against
industry-standard takeoff tools (Bluebeam Revu, PlanSwift, Countfire, Stack CT, ConEst,
Trimble WinEst). Goal: identify what would need to be built to make this a *key* tool
— one estimators reach for over alternatives.

---

## Current Capability Inventory

### Markup types
- Count (pin + sequence number)
- Linear (polyline → length in m/ft)
- Area (polygon → area in m²/ft²)
- Perimeter (polygon → perimeter length + area)
- Wall (polyline × wall height → m²)

### Core workflow
- PDF load (multi-page, zoom/pan, per-page scale calibration via drawn line)
- Chain mode — arms next placement with same name/category/color
- Resume from Totals panel — one-click arms markup tool from an existing BOQ row
- Click-to-select + rubber-band multi-select; Delete key deletion
- Right-click context menu: edit name/category/color, recolor group, delete
- Undo/redo (50-level command stack for place/delete/recolor/edit)
- Item show/hide visibility toggle (O(1) hiddenItemSet)
- Hover tooltip + pulse highlight on BOQ row hover
- Crosshair cursor during markup placement

### Data & persistence
- Per-page scale (pixelsPerMm); mm-canonical storage; display unit switching (m/ft)
- Project file: .clmc (JSON+zip, PDF embedded as pdfBytes)
- Replace PDF — preserves all markups at normalized page-space coordinates
- formatVersion field — schema migration path established

### BOQ & export
- Live totals panel — grouped by category, subtotals per UoM, grand totals
- Aggregates across all pages; skips uncalibrated pages with a warning
- Export to .xlsx (ExcelJS, colored category headers, frozen title row) or .csv
- BOQ structure: metadata block + Item | Quantity | UoM per row

### UI shell
- Office-style ribbon — 7 tabs: Home / Page / Tools / View / Estimating / Settings / Help
- Settings and Help are stubs ("Coming soon")
- Draggable modals, keyboard shortcuts (Ctrl+S/Z/Shift+E etc.)
- Window title shows dirty state

---

## Competitive Baseline

What the leading takeoff tools (PlanSwift, Bluebeam, Countfire, Stack CT) ship:

1. Item library / assembly database with saved item names and rates
2. Unit rates attached to items → cost column in BOQ (Item | Qty | UoM | Rate | Cost)
3. Post-commit geometric editing (vertex drag, markup translate/move)
4. PDF export with markups baked in (flattened for delivery/QA)
5. Drawing-scale-ratio input (type "1:100" instead of drawing a calibration line)
6. Snap assist — snap to drawn lines or repeated grid elements
7. Markup notes / comments attached to specific items
8. Cross-page item breakdown (item X on pages 3, 7, 12)
9. Revision / version tracking (compare estimate versions)
10. Branded export template (company logo, custom column layout)
11. Print BOQ in-app
12. Auto-update / installer delivery channel

---

## Gap Analysis

### Top 10 Gaps (ranked by impact/effort ratio)

### Tier 1 — Deal-Breaker Gaps (adoption blockers)

These are gaps where an estimator hits a wall and switches tools.

#### GAP-T1-01: No vertex editing / markup geometry editing

**What's missing:** After committing a markup, there is no way to drag a vertex, move
an endpoint, or reposition the shape. The only correction is delete + redraw.

**Impact:** Estimators trace complex polygons, make a small mistake on the last vertex,
and must redraw the entire shape. This is a primary complaint in all competitor reviews
when it's absent.

**Feasibility:** Konva Transformer + drag events on individual Line points. The main
challenge is keeping page-space coordinates consistent across zoom while dragging.
See STATE.md: "Stage inverse transform for page-space coords" — the canonical pattern
is already known. Medium complexity, ~2–3 plans.

**Recommended approach:** "Edit vertices" mode that enters when a committed markup is
selected — shows draggable handle circles at each vertex. Commit on Enter or click-off.

---

#### GAP-T1-02: No markup translate (move whole shape)

**What's missing:** Can't drag a committed markup to a new position. Combined with
GAP-T1-01 this means once placed, geometry is frozen.

**Impact:** If a user places a count pin in the wrong room, they delete it and re-pin.
For polygons this is costly.

**Feasibility:** Konva's built-in `draggable` prop on the shape layer. The challenge
is preventing accidental drag during click-to-select (the movement threshold pattern
from the rubber-band fix applies here). Low–medium complexity.

---

#### GAP-T1-03: Quantity-only export — no pricing column

**What's missing:** The BOQ exports Item | Quantity | UoM. There is no unit rate,
no cost per item, no total cost. Estimators must open Excel and add a rate column
manually.

**Impact:** The app helps with counting and measuring but not with pricing, which is
the *goal* of the takeoff. The step "speed up quantity takeoff" is achieved, but the
next step "get to a priced bid" still requires manual work.

**What's needed:** A unit rate ($/unit) attached to each item name. Rate × Qty = line
cost; sum = total cost. Rates should persist per item name in the project file.

**Feasibility:** Add a `rates: Record<string, number>` field to the project schema
(additive, no formatVersion bump needed). Rate input in the totals panel (inline edit
per row). BOQ aggregator passes rate through; boq-writers add a Rate and Cost column.
Medium complexity, ~3–4 plans.

---

#### GAP-T1-04: No PDF-with-markups export (flattened PDF)

**What's missing:** There is no way to deliver a copy of the plan showing the
estimator's markups. Bluebeam's "flatten" feature is the standard for QA review
and client presentations.

**Impact:** Clients and colleagues can't see what was counted/measured. Takeoff work
is invisible unless you also deliver the .clmc file.

**Feasibility:** PDF-lib can draw Konva shapes onto a PDFDocument. Konva shape data
is already normalized to page coordinates. High complexity (~5+ plans) due to
coordinate transform between Konva page-space and PDF page-space, plus handling
multi-page. Recommend deprioritizing until Tier 1 UX gaps are closed.

---

#### GAP-T1-05: No item library / no saved item names

**What's missing:** Every session the estimator types item names from scratch.
There is no persistent library of standard item names (e.g., "100mm concrete slab",
"2400 stud wall", "timber flooring"). CategoryAutocomplete shows *recently used*
names within the current project, not a persistent dictionary.

**Impact:** Inconsistent spelling across projects; slow initial setup for each new
estimate; no reusable rate data.

**What's needed:** A persistent item library (.json file in AppData) that stores
{name, category, defaultColor, defaultRate}. Autocomplete draws from both the
current project and the library. "Save to Library" button in the markup name popup.

**Feasibility:** Electron `app.getPath('userData')` + `fs.readFile/writeFile` via IPC.
Library file separate from project file. Medium complexity, ~2–3 plans.

---

### Tier 2 — Friction Gaps (reduce speed advantage)

These are gaps an experienced estimator works around but that slow them down.

#### GAP-T2-00: No drawing-scale-ratio input (1:100 mode) [#6 overall]

**What's missing:** The only calibration path is drawing a line between two known
points and typing the distance. Construction drawings always print a scale ratio
(1:50, 1:100, 1:200) in the title block. Typing "1:100" should auto-calculate
pixelsPerMm without drawing anything.

**Impact:** ~30 seconds per page for calibration vs. ~3 seconds if you can type the
ratio. For a 20-page plan set that's 9 minutes of calibration vs. 1 minute.

**Feasibility:** The scale math is `pixelsPerMm = pageWidthPx / (physicalWidthMm × ratio)`.
PDF.js provides the intrinsic page dimensions in user-space units. Low–medium complexity.
The CalibrationDialog already exists — add a "type ratio" mode.

---

#### GAP-T2-02: Step-level undo during in-progress drawing (Phase 10)

**Already planned.** Phase 10 in the roadmap: Ctrl+Z during multi-point drawing pops
the last placed point instead of cancelling the whole shape.

---

#### GAP-T2-03: No markup notes / comments

**What's missing:** No way to attach a free-text note to a markup (e.g., "check with
structural — this wall may be load bearing"). Notes would appear in the tooltip and
optionally in the BOQ.

**Feasibility:** Add `notes?: string` to BaseMarkup (additive, no formatVersion bump).
Right-click context menu "Add note" → MarkupNamePopup extended with a text area. Low
complexity.

---

#### GAP-T2-04: Cross-page item breakdown missing [#9 overall]

**What's missing:** The BOQ aggregates "Concrete Slab: 120.5 m²" but doesn't say
which pages contribute. Useful for checking against page-level drawings.

**Feasibility:** BOQ aggregator already walks per-page. Add a `pageBreakdown: {page, qty}[]`
array to BoqItemRow. Render a collapsible sub-list in the totals panel and add a
"By page" sub-sheet in the XLSX export. Medium complexity.

---

#### GAP-T2-05: No snap / click-assist on plan geometry [#7 overall]

**What's missing:** Every measurement point is free-click. On a construction drawing
the estimator needs to hit the exact corner of a room or the end of a wall. Without
snap, accumulated error across a 20-vertex polygon is significant. Competitors offer
"snap to drawn line" and some (Countfire) offer AI-assisted auto-detection of repeated
elements for count.

**Impact:** Measurement accuracy degrades on dense or small-scale plans. Estimators
zoom in very far to compensate — slowing down the workflow.

**Feasibility (basic snap):** On mousemove, scan existing committed markup vertices
within a snap radius (15–20px screen-space) and override the cursor position if close.
Uses the stage inverse transform pattern already in the codebase. Medium complexity,
~2 plans.

**Feasibility (AI count-assist):** Much higher complexity — requires a vision model
or template-matching algorithm. Out of scope for v1.1; target v2.0.

---

#### GAP-T2-06: No installer / auto-update delivery channel [#10 overall]

**What's missing:** `electron-builder` is configured in the project but no build has
been produced. There is no installer (.exe / NSIS), no code-signing, and no
`electron-updater` auto-update channel. The app runs only from the dev server.

**Impact:** Cannot be distributed to or installed by a client. Every "this is great"
demo ends with "but how do I install it?" The answer is currently "you can't."

**Feasibility:** `electron-builder` build config + GitHub Releases as the update
channel + `electron-updater` in the main process. Medium complexity (~2–3 plans) but
a pure ops/infra phase with no feature work. Blocking for any real-world use.

---

### Tier 3 — Professional Polish

These are gaps that affect whether the app feels "finished" to a paying customer.

| Gap | Effort | Notes |
|-----|--------|-------|
| Branded export template | Medium | Company name, logo, column customization in Settings tab |
| Print BOQ in-app | Low | `window.print()` + a print-only CSS stylesheet for the totals panel |
| Installer + auto-update | Medium | electron-builder configured; needs a release channel + `electron-updater` |
| Settings tab content | Low | Default unit, default scale ratio, item library management |
| Help tab content | Low | Keyboard shortcut reference, getting started guide |
| Revision tracking | High | Major data model change — defer to v2.0 |

---

## Recommended Build Sequence (v1.1 Milestone)

Top 10 gaps ordered by impact/effort ratio. Each item maps to roughly one GSD phase.

```
#1  — Phase A: Drawing-Scale Input (1:100 mode)              [GAP-T2-00]
      Highest ROI per effort. Every plan has a printed scale; 3× faster calibration.
      ~2 plans. No data model change. CalibrationDialog gets a "type ratio" tab.

#2  — Phase B: Markup Vertex Editing                         [GAP-T1-01]
      Biggest UX unlock. Committed markups feel malleable, not frozen.
      ~3 plans. Konva vertex handle circles + drag via stage inverse transform.

#3  — Phase C: Markup Translate (Move whole shape)           [GAP-T1-02]
      Ships naturally after vertex editing.
      ~1–2 plans. Konva draggable prop + movement threshold guard (re-use rubber-band pattern).

#4  — Phase D: Pricing Column in BOQ                         [GAP-T1-03]
      Turns the app from "a measuring tool" to "an estimating tool."
      ~3–4 plans. rates: Record<string,number> in project schema; rate × qty = cost;
      new Rate + Cost columns in .xlsx and .csv export.

#5  — Phase E: Item Library                                  [GAP-T1-05]
      Feeds naturally from pricing — persists item names + rates across projects.
      ~2–3 plans. AppData JSON library; IPC handlers; autocomplete draws from library.

#6  — Phase F: Step-Level Undo During Drawing                [GAP-T2-02, Phase 10]
      Already in the roadmap. Ctrl+Z pops last placed point; first-point Z cancels.
      Schedule after Phase C (vertex/move share similar selection state).

#7  — Phase G: Snap to Existing Geometry                     [GAP-T2-05]
      Accuracy improvement for dense plans. Snap radius scan on mousemove.
      ~2 plans. Stage inverse transform pattern already known.

#8  — Phase H: Markup Notes / Comments                       [GAP-T2-03]
      Low effort, high professionalism signal.
      ~1–2 plans. notes?: string on BaseMarkup; right-click "Add note"; tooltip shows note.

#9  — Phase I: Cross-Page Item Breakdown                     [GAP-T2-04]
      Shows which pages an item appears on — useful for QA.
      ~2 plans. pageBreakdown[] in BoqItemRow; collapsible sub-list + XLSX sub-sheet.

#10 — Phase J: Installer + Auto-Update Channel               [GAP-T2-06]
      Pure infra — no feature work. electron-builder NSIS + electron-updater + GitHub Releases.
      ~2–3 plans. Blocking for any real-world distribution.

Deferred — PDF-with-markups export                           [GAP-T1-04]
      High value but high complexity. Target v2.0 after core UX is solid.
```

---

## Key Insight

The app currently delivers **quantity takeoff** well. The gap that turns it from "useful"
to "key" is **pricing integration** (Tier 1, Gap 3) — because an estimator's goal is
not counts and lengths, it's a priced Bill of Quantities. Without rates and costs, the
tool saves time on measurement but still forces a manual step before the bid is done.

The fastest path to "key takeoff app" is:
1. Fix the UX friction first (scale input + vertex editing) so the tool feels
   professional and non-frustrating to demo.
2. Add pricing immediately after — this is what justifies paying for the tool over
   free alternatives.

---

## Files Audited

- `src/renderer/src/types/markup.ts` — markup types (count/linear/area/perimeter/wall)
- `src/renderer/src/components/RibbonToolbar.tsx` — feature surface
- `src/renderer/src/lib/boq-aggregator.ts` — BOQ structure
- `src/main/boq-writers.ts` — export format
- `.planning/STATE.md` — phase history and locked decisions
