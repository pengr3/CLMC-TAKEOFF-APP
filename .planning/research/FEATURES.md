# Feature Landscape

**Domain:** Windows desktop construction takeoff application
**Researched:** 2026-03-25
**Confidence:** HIGH (core categories), MEDIUM (complexity estimates)

---

## Table Stakes

Features users expect from any takeoff tool. Missing any of these and the product feels broken or incomplete — users will switch back to manual methods or competitors immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PDF load (multi-page) | Plans always come as PDFs; multi-page is universal | Medium | Must handle large, high-res construction PDFs — real-world files are 50–200 MB |
| Page navigation (prev/next, jump) | Plans have 10–100+ pages per set; estimators flip constantly | Low | Thumbnail strip or page list panel is the norm; at minimum prev/next buttons |
| Zoom and pan | Estimators zoom into detail 10–20x; must stay precise | Medium | Scroll-to-zoom + drag-to-pan; ALL markups must stay pinned to plan geometry on zoom |
| Scale calibration by drawn line | The industry-standard method: draw a line between two known points, type real-world distance | Medium | Per-page scale is critical — each drawing in a set may use a different scale |
| Count markup (point/pin) | Counting fixtures, columns, outlets is the single most common takeoff task | Low | Each pin needs a name/label; running count must be visible in the summary |
| Linear markup (polyline) | Wall runs, pipe lengths, conduit, cable — universally needed | Medium | Multi-segment polyline; shows length in real-world units; snap to corners helps greatly |
| Area markup (polygon) | Floors, ceilings, tiling, concrete slabs — produces square area | Medium | Closed polygon; calculates area in m² or ft²; auto-closes on double-click |
| Perimeter markup | Produces both perimeter length AND enclosed area from one trace | Medium | Same polygon draw gesture as area; shows two quantities; common for skirting, edging |
| Freehand markup naming | Users need to label what they measured ("100mm conduit", "1200x600 tile") | Low | Text input when placing or selecting a markup; inline editing preferred |
| Category / group assignment | Estimators organize by trade: Electrical, Plumbing, Civil, etc. | Low | Simple dropdown or tag; drives grouping in the BOQ export |
| Save / load project | Work is always resumed across sessions; losing a 4-hour takeoff is career-ending | Medium | Must persist: PDF file reference (path or embed), all markups, scale settings, names, categories |
| Export to Excel / CSV | The final deliverable — a structured BOQ for bid pricing | Medium | Columns: item name, quantity, unit, category; grouped by category; one row per markup |
| Undo / redo | Estimators misplace markups constantly; undo is non-negotiable | Medium | Minimum 20-action history; covers: place, delete, move, rename, reassign category |
| Markup delete / select / edit | Must be able to correct mistakes and update existing markups | Low | Click to select; delete key removes; double-click or context menu to rename |
| Unit system (metric or imperial) | Different markets use different units; must match the plan | Low | Set at project level; applies to all measurements; m/m²/mm or ft/ft²/in |

---

## Differentiators

Features not universally expected, but which create genuine competitive advantage and user delight. Worth building when table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Keyboard shortcuts for all tools | Estimators doing 200-item takeoffs live by hotkeys; dramatically improves speed | Low | V=select, H=pan, C=calibrate, L=line, A=area, K=count, Del=delete; standard in PlanSwift and EasyTakeoffs |
| Snap-to-content | Cursor locks to PDF lines/corners for precision without pixel-hunting | High | Requires PDF vector extraction; most valuable on CAD-generated PDFs; falls back silently on scans |
| Running totals panel | Live BOQ view — see total length/area/count per category as you measure | Medium | Sidebar or bottom panel; updates in real-time; reduces the need to export just to check a sub-total |
| Per-page scale display and indicator | Shows active scale in corner; warns when a page has no scale set | Low | Prevents the silent error of measuring at wrong scale; PlanSwift added this in v10.3 |
| Markup color coding by category | Visual separation of trades on the plan — electrical in red, plumbing in blue | Low | Auto-assign a color per category; override per-markup if needed |
| Markup visibility toggle per category | Show/hide a trade's markups to reduce visual clutter on complex plans | Low | Checkbox per category in the sidebar; doesn't delete, just hides |
| Export includes annotated PDF | A marked-up PDF alongside the CSV — useful for client review and QA | Medium | Renders markups as PDF annotations; allows visual verification of what was measured |
| Measurement edit in-place | Click a markup and change its label or category without re-drawing | Low | Saves time on corrections; reduces re-work errors |
| Scale calibration from preset list | Shortcut for common scales (1:100, 1:50, 1/4"=1'-0") without measuring | Low | Common in all major tools; good fallback when printed scale is readable |
| Recent projects list | One-click reopen for the last 5–10 projects; reduces friction | Low | Stored in local app config; trivial to implement |
| Page thumbnail strip | Visual page navigation instead of numbered list; helps identify pages by drawing content | Medium | Renders small previews; makes navigating 40-page plan sets significantly faster |

---

## Anti-Features

Features to deliberately NOT build in v1. Each one either adds disproportionate complexity, requires infrastructure the project explicitly avoids, or has no validated user need yet.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Unit cost / pricing calculations | Transforms the tool from a takeoff tool into an estimating tool — doubles scope; pricing workflows are external and complex | Export clean quantity BOQ; let user price in Excel or their estimating tool |
| Preset item library / assembly database | Catalog management is a product in itself (PlanSwift's drag-and-drop assemblies); v1 users type freehand names | Freehand naming per markup; consider saved categories list post-v1 |
| Cloud sync / cloud save | Requires server infrastructure, auth, and ongoing ops; explicitly out of scope | Local file save (.takeoff project file); user manages backups like any desktop app |
| Multi-user / real-time collaboration | Bluebeam Studio Sessions are an entire platform feature; single-user is the stated constraint | Not applicable for v1; defer indefinitely |
| AI / auto-detection of items from plans | Togal.ai, Kreo, and Beam AI are entire AI products; not viable as a v1 feature of a small tool | Manual markup is the validated workflow; AI is a v3+ consideration |
| CAD file support (DWG, DXF, RVT) | Massive additional library dependency (LibreDWG or similar); construction PDFs cover 95%+ of real-world use | PDF-only for v1; DWG import could be added post-validation |
| Custom Excel export template matching | Template management UI is significant scope; users adjust standard layout themselves | Standard column layout (name, qty, unit, category); let user reshape in Excel |
| Volume / 3D measurements | Requires Z-value inputs and vertical offset tracking; not relevant for 2D floor plan takeoff | 2D area × manually-entered depth if needed; not a common v1 need |
| Revision tracking / plan comparison | Overlaying old vs new plans for change tracking (On-Screen Takeoff "Overlays" feature) is complex; no stated need | User creates a new project for revised plans |
| Auto-scale detection from PDF metadata | Parsing printed scale text from title blocks reliably is non-trivial and brittle on scanned PDFs | Manual calibration by drawn line is more reliable and is the industry-standard method |
| Report designer / custom export templates | WYSIWYG report builder adds a UI sub-product; zero validated need | Standard export format; user formats output |
| Subcontractor / sharing workflow | No sharing, cloud, or role-based access needed for single-user | Not applicable |

---

## Feature Dependencies

```
PDF load (multi-page)
  └── Page navigation
        └── Per-page scale calibration
              └── Count markup           (scale needed for labeled point counts)
              └── Linear markup          (produces real-world length)
              └── Area markup            (produces real-world area in m²/ft²)
              └── Perimeter markup       (produces perimeter + area)

Markup placement (any type)
  └── Freehand naming
  └── Category assignment
        └── Export to Excel/CSV         (grouped by category)
        └── Markup color coding         (color per category)
        └── Markup visibility toggle    (toggle per category)

Zoom / pan
  └── Markup coordinate pinning         (markups must stay on-plan during zoom — critical)

Save / load project
  └── All of the above must be serialized and restored

Undo / redo
  └── All markup placement / deletion / edit actions must be tracked
```

---

## MVP Recommendation

Build these in strict dependency order. The user cannot validate anything until the PDF is on screen with a scale set and at least one measurement placed.

**Phase 1 — Core viewing and calibration:**
1. PDF load with multi-page support and page navigation
2. Zoom / pan with markup coordinate pinning
3. Scale calibration by drawn line

**Phase 2 — Markup placement:**
4. Count markup with freehand name
5. Linear markup with freehand name
6. Area markup with freehand name
7. Perimeter markup with freehand name
8. Category assignment per markup
9. Undo / redo (minimum 20 actions)

**Phase 3 — Persistence and output:**
10. Save / load project file (PDF reference + all markups)
11. Export to Excel / CSV (grouped by category)
12. Markup delete, select, edit in-place

**Defer to post-MVP:**
- Keyboard shortcuts (build after core works; easy add)
- Running totals panel (useful but not blocking)
- Markup color coding (cosmetic; not blocking)
- Per-page scale indicator (polish; not blocking)
- Page thumbnail strip (navigation quality of life; not blocking)

---

## Complexity Reference Key

- **Low** — Under 2 days for an experienced developer; no novel technical problems
- **Medium** — 3–7 days; involves non-trivial state management, coordinate transforms, or file I/O
- **High** — 1–3+ weeks; requires third-party library integration, novel algorithm, or significant architectural decision

---

## Sources

- PlanSwift features overview: https://www.planswift.com/planswift-features/
- Bluebeam Revu scale and measurement: https://novedge.com/blogs/design-news/bluebeam-tip-bluebeam-revu-scale-calibration-workflow-for-accurate-takeoffs
- Bluebeam takeoff workflow guide: https://university.bluebeam.com/how-to-quantity-takeoffs-in-revu
- EasyTakeoffs features (keyboard shortcuts, snap, undo): https://easytakeoffs.com/features
- PDF quantity takeoff workflow (6-step process): https://www.planmetry.com/blog/pdf-quantity-takeoff-workflow
- Permitflow construction takeoff software overview: https://www.permitflow.com/blog/construction-takeoff-software
- Construction takeoff comparison 2025: https://www.selecthub.com/c/takeoff-software/
- Taradigm Bluebeam takeoff guide: https://www.taradigm.com/5-ways-to-use-bluebeam-revu-for-quantity-takeoff-and-estimation/
- EasyPDFTakeoff (small contractor positioning): https://easypdftakeoff.com/
