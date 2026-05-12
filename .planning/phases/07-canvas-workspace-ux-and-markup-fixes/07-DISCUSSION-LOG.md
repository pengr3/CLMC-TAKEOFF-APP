# Phase 7: Canvas Workspace UX and Markup Editing Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 07-canvas-workspace-ux-and-markup-fixes
**Areas discussed:** Post-commit markup editing, Totals panel redesign, Category deduplication, Canvas blank gutters

---

## Post-commit Markup Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click → "Edit" menu item | Add "Edit" to MarkupContextMenu alongside Delete + Recolor Group. Zero conflict with count-increment. | ✓ |
| Double-click the markup | Distinct from single-click count-increment but requires teaching the gesture | |
| Single-click (edit mode only) | Conflicts with Count tool click-to-place behavior | |

**User's choice:** Right-click → "Edit"
**Notes:** Zero conflict with count-increment was the deciding factor. Consistent with Phase 03.1 right-click paradigm.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Edit only this one markup | Per-markup scope — lower blast radius | You decide |
| Edit all markups sharing same name | Group rename — same scope as Recolor Group | |

**User's choice:** Claude's discretion
**Notes:** Claude recommendation — per-markup scope. Lower blast radius; user can repeat for group rename if needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + Category + Color | Same three fields as placement; reuse MarkupNamePopup in 'edit' mode | ✓ |
| Name + Category only | Simpler popup; keep color change in Recolor Group flow | |

**User's choice:** Name + Category + Color
**Notes:** Reuses MarkupNamePopup without a new component. 'edit' mode = new primary button label only.

---

## Totals Panel Redesign

| Option | Description | Selected |
|--------|-------------|----------|
| One row per placed markup instance | 24 count pins = 24 rows of qty 1. Fully auditable but verbose | |
| Remove grand total bar only | Keep aggregated item rows; just drop the pinned footer | First selection → then expanded |
| Per-page breakdown rows | Sub-rows by page per named item | |

**User's choice:** Remove grand total bar AND per-category subtotal rows
**Notes:** Initial selection was "grand total bar only." Follow-up question revealed the user also wants category subtotal rows removed. Final: item rows + category headings stay; subtotals and grand total removed.

---

## Category Deduplication

| Option | Description | Selected |
|--------|-------------|----------|
| Partial typos slipping through | Fuzzy/starts-with match on confirm | |
| Keyboard navigation missing | Arrow+Enter to select from dropdown | |
| You decide — feel tighter | No specific scenario; make it more guided | ✓ |

**User's choice:** Claude's discretion
**Notes:** Claude recommendation — add keyboard navigation (arrow/Enter) to CategoryAutocomplete + canonical-name substitution on confirm when case-insensitive match exists. Low-risk, high-impact.

---

## Canvas Blank Gutters

| Option | Description | Selected |
|--------|-------------|----------|
| Only at fit-to-window zoom | Background showing around PDF within a correct-size Stage | |
| Even at high zoom — Stage undersized | Fixed pixel gap at all zoom levels | ✓ |

**User's choice:** Both right and bottom gaps
**Notes:** User provided three screenshots (75%, 25%, 18% zoom). Screenshots showed PDF page positioned in top-left of canvas area with large dark space to the right and below at all zoom levels. This confirmed the Stage is locked at its initial 800×600 size — not a padding issue. Root cause: ResizeObserver circular dependency (height: 100% on child with no explicit height on flex parent).

---

## Claude's Discretion

- **Edit scope:** Per-markup (not group rename) — lower blast radius
- **Set Scale dropdown fix:** `overflow: visible` on clipping ancestor preferred; custom dropdown as fallback only
- **Category keyboard nav state:** `highlightedIndex` as local state in CategoryAutocomplete; reset on list close or query change
- **Category canonical-name substitution:** Call `findCategoryByName` before `getOrCreateCategory` in MarkupNamePopup confirm path

## Deferred Ideas

- Group/bulk markup rename — all markups sharing a name changed at once; own phase if needed
- Geometry editing — move polygon/polyline vertices after placement; v2 scope
- Markup visibility layers (show/hide by category) — v2 PROD-02
- Custom export templates — v2, explicitly out of v1 scope
