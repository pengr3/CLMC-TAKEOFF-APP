# CLMC Takeoff App

## What This Is

A Windows desktop takeoff application for construction estimators. Users upload PDF floor plans, set scale, and place markups (counts, linear measurements, areas, perimeters) directly on the plan to quantify materials and items. The output is a structured BOQ/BOM sheet exported to Excel or CSV for use in project bids and client quotations.

## Core Value

Speed up quantity takeoff — let the estimator focus on reading the plan, not doing math.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load a multi-page PDF floor plan and flip between pages
- [ ] Set scale by drawing a line between two known points and entering the real-world distance
- [ ] Zoom in/out with all markups staying pinned to the plan
- [ ] Place count markups (pins/dots) on individual items (fixtures, columns, outlets, etc.)
- [ ] Draw linear markups to measure wall runs, pipe lengths, conduit, etc.
- [ ] Trace area markups (polygon) for floors, ceilings, tiling regions, etc.
- [ ] Trace perimeter markups to capture both perimeter length and enclosed area
- [ ] Name each markup freehand when placing it
- [ ] Assign markups to a category (e.g., Electrical, Plumbing, Civil) for grouping
- [ ] Save project to a file (reopenable — PDF link + all markups preserved)
- [ ] Export takeoff sheet to Excel/CSV: item name, quantity, unit of measure, grouped by category
- [ ] Standard clean layout for export (no custom template required)

### Out of Scope

- Multi-user / team collaboration — single-user tool for now; adds significant complexity
- Cloud sync or web access — desktop-only; no server infrastructure needed for v1
- Unit cost / pricing calculations — BOQ quantity export only; pricing happens in separate tools
- Preset item library — freehand naming per markup is sufficient for v1
- Custom Excel template matching — standard layout export is sufficient; user adjusts as needed

## Context

- User works in construction estimation, producing BOQs and BOMs for project bids and client quotations
- Current workflow presumably involves manual measurement or tools like PlanSwift — this replaces that
- Single-user app; no sharing or collaboration requirements
- Plans come as multi-page PDFs; each page is a different drawing (floor plan, electrical, plumbing, etc.)
- Scale varies per plan and must be set explicitly per page or per project
- Markup names are typed freehand — no fixed item library to manage

## Constraints

- **Platform**: Windows desktop — must run as an installed application on Windows
- **Offline**: Must work fully offline — no internet dependency for core features
- **PDF rendering**: Must handle real-world construction PDFs (large files, high-res scans, multi-page)
- **Markup persistence**: All markups must stay precisely positioned when zooming — this is critical to usability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Desktop (Windows) over web app | Works offline, better performance for large PDFs | — Pending |
| Freehand markup naming (no library) | Simpler UX for v1; user can type item names directly | — Pending |
| Scale set by drawing a known distance | More accurate than typing a ratio; matches how estimators work on plans | — Pending |
| Export standard layout (not custom template) | Avoids template management complexity for v1 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after initialization*
