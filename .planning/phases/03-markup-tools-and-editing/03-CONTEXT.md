# Phase 3: Markup Tools and Editing - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

All four markup types (count, linear, area, perimeter) with freehand naming, category assignment, auto-colored categories, canvas labels showing measured values, and full undo/redo (20+ actions). This is the core quantity takeoff interaction — the output of this phase is a plan with placed, labeled, colored markups ready to be exported in Phase 5.

Out of scope for this phase: project file save/load (Phase 4), BOQ export (Phase 5), running totals sidebar (Phase 6), markup editing after placement (delete/rename by clicking — v2 requirement PROD-03).

</domain>

<decisions>
## Implementation Decisions

### Count Tool Workflow
- **D-01:** Activating the Count tool opens a name + category popup **before** any pin is placed. User types the item name and category first, then clicks "Start".
- **D-02:** Every subsequent canvas click places a pin for that active named item — no popup per click.
- **D-03:** To switch to a different item, user clicks the Count tool button again. A fresh name + category popup appears.
- **D-04:** Each placed pin is labeled: `● Item Name N` (colored dot + item name + sequential number within that item, e.g. "Light Switch 3"). Labels are zoom-compensated — always visible at all zoom levels.

### Linear / Area / Perimeter Tool Workflow
- **D-05:** User draws the shape first, names it after. The name + category popup appears near the shape endpoint **after** the shape is finished (double-click to end polyline; click first point to close polygon).
- **D-06:** Popup has: Name field, Category field (with auto-complete), Discard / Save buttons. Same inline popup pattern as ScalePopup.
- **D-07:** Escape mid-draw cancels the in-progress shape with no markup created.
- **D-08:** Double-click ends a polyline (linear markup). Single-click on the starting point closes an area or perimeter polygon.

### Category System
- **D-09:** Categories are type-to-create with auto-complete. If the typed name matches an existing category, it reuses that category's assigned color. If it's a new name, the next color in the palette is assigned automatically.
- **D-10:** No separate category manager UI in this phase. Categories are created inline during markup placement.
- **D-11:** Fixed palette of 8 visually distinct colors, auto-assigned in order of first use:
  1. `#0078d4` blue
  2. `#d13438` red
  3. `#107c10` green
  4. `#e8a838` orange (matches existing `COLORS.warning` — use a distinct amber shade, not the warning color)
  5. `#5c2d91` purple
  6. `#008272` teal
  7. `#e3008c` pink
  8. `#8e562e` brown
  - If more than 8 categories are created, cycle the palette.

### Canvas Labels
- **D-12:** All markup labels are **always visible** at all zoom levels. Font size and shape stroke widths are zoom-compensated (same pattern as calibration overlay — divide by `currentZoom`).
- **D-13:** Label content by type:
  - **Count:** `● Item Name N` (dot + name + sequential number)
  - **Linear:** `Item Name — 12.4 m` (centered on the polyline midpoint)
  - **Area:** `Item Name` + `38.2 m²` (two lines, centered inside the polygon)
  - **Perimeter:** `Item Name` + `P: 24.6 m  A: 38.2 m²` (perimeter + area, two lines, centered inside)

### Undo / Redo
- **D-14:** Command pattern — each markup action (place, delete) is a reversible command object pushed onto an undo stack. This must be introduced now, with the first markup, not retrofitted later (locked decision from STATE.md).
- **D-15:** Undo stack depth: 20+ actions minimum (requirement MARK-09).
- **D-16:** Undo/redo scope for this phase: place markup, delete markup. Rename and category change are v2 (PROD-03).
- **D-17:** Keyboard shortcuts: `Ctrl+Z` to undo, `Ctrl+Y` or `Ctrl+Shift+Z` to redo.

### Claude's Discretion
- Exact visual style of count pins (circle vs teardrop vs square dot), size before zoom compensation
- Label positioning algorithm when label would overlap the shape boundary
- Minimum canvas-pixel label font size floor (so labels don't become invisible at extreme zoom-out)
- Whether the in-progress polyline/polygon shows a preview segment following the cursor (recommend yes — matches calibration line pattern)
- Animation or visual feedback when a markup is placed (e.g. brief highlight)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — MARK-01 through MARK-10 are all in scope for this phase. Read each requirement before planning the corresponding feature.

### Existing Codebase Patterns
- `src/renderer/src/hooks/useCalibrationMode.ts` — interaction state machine pattern; markup tools follow the same click-state approach
- `src/renderer/src/components/ScalePopup.tsx` — inline popup pattern (position clamping, confirm/cancel, zoom-compensated positioning); markup name popup reuses this pattern
- `src/renderer/src/stores/scaleStore.ts` — Zustand per-concern store pattern; markupStore follows same shape
- `src/renderer/src/components/CanvasViewport.tsx` — Layer 0 (PDF), Layer 1 (markup overlay); all markup shapes render in Layer 1
- `src/renderer/src/lib/constants.ts` — COLORS constant; category palette extends (does not replace) existing colors

### State Decisions (locked, do not revisit)
- `STATE.md` §Key Decisions — "All markup coordinates stored in PDF page space (normalized 0.0–1.0)" — CRITICAL: never persist raw pixel or canvas-pixel coordinates
- `STATE.md` §Key Decisions — "Command pattern for undo/redo — must be introduced with first markup, not retrofitted"
- `STATE.md` §Key Decisions — "Stage inverse transform for page-space coords — `stage.getAbsoluteTransform().copy().invert().point(pointer)` is the canonical pattern"
- `STATE.md` §Key Decisions — "Zoom-compensated Konva overlay visuals — divide all stroke widths and radii by currentZoom"

### Research Flags from STATE.md
- `STATE.md` §Research Flags — "Review Konva polygon close interaction (double-click, ESC cancel), multi-segment polyline mid-point editing, and Konva Transformer widget before writing markup tools"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useCalibrationMode.ts` — full interaction state machine (idle → drawing → confirming); markup tool hooks mirror this structure
- `ScalePopup.tsx` — inline popup with screen-position clamping to container bounds; reuse or adapt for markup naming popup
- `CanvasViewport.tsx` Layer 1 Konva `<Layer>` — all markup shapes (Circle, Line, polygon) render here; calibration overlay is already in Layer 1
- `COLORS` constant — `COLORS.dominant`, `COLORS.secondary`, `COLORS.border`, `COLORS.textPrimary` all available for popup styling
- `viewerStore.ts` `activeTool` field — already set up with `setActiveTool`; extend `ActiveTool` type to include `'count' | 'linear' | 'area' | 'perimeter'`
- `useKeyboardShortcuts.ts` — existing keyboard handler; add Ctrl+Z/Ctrl+Y undo/redo here

### Established Patterns
- Inline styles only — no Tailwind or CSS modules on canvas-adjacent components (Phase 2 pattern)
- Zustand store per concern — new `markupStore.ts` in `src/renderer/src/stores/`
- Module-level ref for cross-component imperative access — `getCalibrationControls()` pattern; markup tool activation may follow same
- Per-page state keyed by page index — `pageScales: Record<number, PageScale>` pattern; `pageMarkups: Record<number, Markup[]>` follows same shape
- Zoom-compensated visuals: `const POINT_RADIUS = 6 / currentZoom` — all markup visual constants use this

### Integration Points
- `Toolbar.tsx` — add Count, Linear, Area, Perimeter tool buttons; active tool highlighted with `COLORS.accent`
- `CanvasViewport.tsx` — handle Stage click and mousemove for all four tool modes; render markup shapes and labels in Layer 1
- `viewerStore.ts` `ActiveTool` type — extend union
- New `markupStore.ts` — holds `pageMarkups: Record<number, Markup[]>`, `undoStack`, `redoStack`
- New `useMarkupTool.ts` hook (or per-tool hooks) — interaction state machine per tool type

</code_context>

<specifics>
## Specific Ideas

- Count pin label format confirmed: `● Item Name N` with sequential numbering per item
- Linear label: centered on the polyline midpoint, `Name — value unit`
- Area/perimeter label: two-line, centered inside the closed polygon
- Category auto-complete in the popup: same field handles both lookup and creation
- The orange palette color (#e8a838) conflicts with `COLORS.warning` — use a distinct amber/gold shade for the category palette entry (e.g. `#ca8a04`) to avoid confusion with warning states

</specifics>

<deferred>
## Deferred Ideas

- Markup editing after placement (rename, change category, delete by clicking) — v2 requirement PROD-03, Phase 3+ scope
- Toggle markup category visibility (show/hide layers) — v2 requirement PROD-02
- Keyboard shortcuts for switching tools — v2 requirement PROD-01
- Color override per category (user picks color instead of auto-assigned) — considered but deferred; fixed palette is sufficient for v1
- Mid-point editing of polylines — research flag, deferred unless Konva makes it trivial
- Thumbnail strip sidebar — Phase 6 (PDF-05)

</deferred>

---

*Phase: 03-markup-tools-and-editing*
*Context gathered: 2026-04-20*
