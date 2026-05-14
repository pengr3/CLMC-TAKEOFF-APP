# Phase 8: Markup Workflow Acceleration and Wall Measurement Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 08-markup-workflow-and-wall-tool
**Areas discussed:** Chain markup mode design, Wall tool design, Show/hide visibility toggle, Crosshair cursor styling

---

## Chain Markup Mode

### Q1: How should chain mode end (trigger a fresh name/category prompt)?

| Option | Description | Selected |
|--------|-------------|----------|
| Esc key only | Pressing Esc once breaks the chain; tool stays selected but next click re-opens the naming popup. Tool switch also implicitly breaks. Simple, one verb. | |
| Esc OR clicking the active tool button again | Either Esc, or clicking the same toolbar button while it's active (currently this toggles back to 'select'). Reuses an affordance the user already knows. Tool-switch to a different tool still implicitly breaks. | ✓ |
| New 'New Item' chain-break button in toolbar | Adds an explicit chain-break IconButton next to the markup tools that re-opens the naming popup on next click. Most discoverable; adds toolbar real estate. | |
| Right-click on canvas while armed | Right-click anywhere on the empty canvas while in chain mode opens the naming popup at the cursor for the next item. Conflicts with MarkupContextMenu. | |

**User's choice:** Esc OR clicking the active tool button again.
**Notes:** Reuses the existing toolbar toggle affordance; tool-switch to a different markup tool implicitly breaks the chain.

### Q2: How should the user see that chain mode is active and what's currently armed?

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar button stays highlighted + badge with armed name | Active toolbar button keeps existing 'active' style, plus a small text chip near/below showing the armed name and color. | ✓ |
| Toolbar button only — use existing active style | No new badge. Rely solely on existing active highlight. Minimal; user can't tell at a glance which name/color is armed. | |
| Status-bar / canvas-header text | CanvasHeaderBar shows a chip with armed name + category + color swatch. Persistent and visible without crowding toolbar. | |
| Cursor-attached label near crosshair | Small label trailing the crosshair cursor showing the armed name. Most contextual but tied to mouse; could feel noisy on dense plans. | |

**User's choice:** Toolbar button stays highlighted + badge with armed name.

### Q3: If the user is armed (e.g., chaining 'Outlet') and switches PDF page, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Chain persists across pages | Same name/category/color stays armed when navigating to another page — useful for placing the same item across multiple floor-plan pages. | ✓ |
| Chain breaks on page change | Switching pages clears armed state; next click re-opens the naming popup. Safer default — each page tends to be a different drawing. | |
| Chain persists, but show a confirmation toast on page change | Compromise — power-user behavior with a guardrail against forgetting. | |

**User's choice:** Chain persists across pages.

---

## Wall Tool Design

### Q1: Should the Wall tool be a new markup type or a Linear markup with a height field?

| Option | Description | Selected |
|--------|-------------|----------|
| New 'wall' MarkupType (separate shape) | Adds 'wall' to MarkupType union; new WallMarkup interface with points + wallHeight. Cleanest separation. | ✓ |
| LinearMarkup with optional wallHeight field | Reuses existing linear primitive; same toolbar tool serves two semantics. Less new code. | |
| New 'wall' MarkupType that internally extends LinearMarkup geometry | Type-level separation, code reuse via existing helpers. Best of both. | |

**User's choice:** New 'wall' MarkupType (separate shape).

### Q2: How should ceiling height be set and reused for walls?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-wall input on commit; chain inherits the previous wall's height | Popup prompts for height; chained walls reuse silently. Simplest mental model, fits chain pattern. | ✓ |
| Per-page default height + per-wall override | Each PDF page stores a default ceiling height. Good for one-floor-per-page projects. Adds page-state surface. | |
| Project-wide default height + per-wall override | One default for the whole project. Simplest data; weakest fit when projects mix single-storey + double-height. | |
| Per-wall input always; no default, no inheritance | Every wall asks. Maximum control, slowest workflow — contradicts chain-mode goal. | |

**User's choice:** Per-wall input on commit; chain inherits the previous wall's height.

### Q3: How should walls appear in the BOQ totals/export?

| Option | Description | Selected |
|--------|-------------|----------|
| Single row per name in m² — matches Area markups | One totals row per wall name with quantity = sum(length × height) m². Estimator-friendly, matches how walls are billed. | ✓ |
| Two rows per name — length (m) AND area (m²) | More info, more clutter; double-row pattern is unfamiliar in current TotalsPanel. | |
| Single row in m² plus per-row tooltip with breakdown | Compact main view; details on demand. New tooltip affordance. | |

**User's choice:** Single row per name in m² — matches Area markups.

### Q4: How should the wall popup work, and what's the default for the very first wall?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse MarkupNamePopup with added height row; first wall default = 2400mm | Same popup with one new row. Default 2400 (typical residential). Chain inherits last entered. Minimum new UI. | ✓ |
| Reuse MarkupNamePopup; first wall default = empty (forces user to type) | Save disabled until height entered. Slightly safer; slightly slower. | |
| Reuse MarkupNamePopup; first wall default = scale-inferred typical-room-height | Adds inference logic; arguably overkill given chain inheritance covers 95% of cases. | |

**User's choice:** Reuse MarkupNamePopup with added height row; first wall default = 2400mm.

---

## Show/Hide Visibility Toggle

### Q1: Where should per-item visibility state live?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project file (inside .clmc) | Hidden-item names stored in project file; survives across machines and restart. Adds hiddenItemNames: string[] to schema (additive bump). | ✓ |
| Per-workstation (localStorage clmc.ui) | Hidden names per workstation, scoped by project path or SHA. Mirrors collapsedCategories. No project-schema change. | |
| Per-session only (in-memory) | Always reset when project re-opens. Simplest by far. | |

**User's choice:** Per-project file (inside .clmc).
**Notes:** Visibility is "part of the takeoff state" — the estimator's intentional working view, not a workstation preference.

### Q2: Where should the show/hide icon sit in the TotalsRow, and what icon?

| Option | Description | Selected |
|--------|-------------|----------|
| Eye / EyeOff icon at the right end of the row (after UoM) | 24px slot after UoM. Greyed-out row when hidden. Widens row by ~28px. | |
| Eye / EyeOff icon replacing the cycle-dot 6px slot when hovered | Compact, no row width change; slot already does double-duty for cycle navigation. | |
| Eye / EyeOff icon to the left of the color chip | Fixed leading element before color chip. Always visible. Widens row by ~16px on the left. | ✓ |

**User's choice:** Option 3 (left of color chip, always visible) but with **Lightbulb / LightbulbOff icon** instead of Eye/EyeOff.
**Notes:** User explicit preference — lightbulb metaphor reads as "turn off the light over this item", closer to the decluttering intent.

### Q3: What happens to a hidden item's behavior in the rest of the app?

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas hidden; row stays interactive; totals & BOQ export unchanged | Hidden = canvas markups don't render; row stays clickable/hoverable; BOQ unchanged. Pure visual decluttering. | ✓ |
| Canvas hidden; row dimmed; totals unchanged; BOQ export INCLUDES hidden | Same plus 50% opacity row dim so hidden state is visible at a glance. | |
| Canvas hidden; row dimmed; totals unchanged; BOQ export EXCLUDES hidden | Visibility doubles as export filter. More powerful; higher risk of incomplete export. | |

**User's choice:** Canvas hidden; row stays interactive; totals & BOQ export unchanged.

---

## Crosshair Cursor Styling

### Q1: What should the in-app crosshair look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Fine cross (1px lines, ~16px arms) + small center dot, white with thin black outline | Industry-standard CAD crosshair; dot pinpoints click position. | |
| Fine cross only, no center dot, white with black outline | Same fine lines, no dot. Intersection IS the click location. | |
| Crosshair with circular gap in the middle (1–2px ring of negative space at center) | Crossed lines with a ~3px gap at dead center, no dot. Empty center reveals the underlying pixel exactly. | ✓ |
| Heavy cross (2px lines, ~24px arms) + center dot, theme accent color | More visible on busy plans. Less effective on accent-colored backgrounds. | |

**User's choice:** Crosshair with circular gap in the middle (rifle-scope style).
**Notes:** Precision-instrument idiom; the empty center is what makes it pinpoint-accurate.

### Q2: Which tools should show the crosshair, and how should it be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| All canvas-interaction tools (markups + Set Scale + Verify Scale); CSS cursor (SVG data-URL) | Crosshair shown for all canvas-interaction tools. CSS cursor with data-URL — zero render cost, no Konva node, OS handles hide/restore. | ✓ |
| Markup tools only (count/linear/area/perimeter/wall); CSS cursor | Crosshair active only for markup tools — Set Scale & Verify use the existing default crosshair. | |
| All canvas-interaction tools; Konva-rendered crosshair that follows pointer | Render as a Konva Shape on a transient overlay layer. More flexible (could pulse/animate); higher render cost. | |

**User's choice:** All canvas-interaction tools (markups + Set Scale + Verify Scale); CSS cursor (SVG data-URL).

---

## Claude's Discretion

- Wall renderer affordance (subtle visual treatment to distinguish from a plain linear) — researcher to propose.
- Wall toolbar icon (Lucide library lacks a perfect wall glyph) — pick from Construction / RectangleVertical / Columns2.
- EditMarkupCommand wall-height extension — add optional `oldHeight/newHeight` fields to existing `'edit-markup'` branch, OR sibling `'edit-wall'` branch. Pick smaller diff that keeps MarkupCommand exhaustive.
- Chain-active chip badge exact placement — inline next to active tool button vs below toolbar row; whichever doesn't crowd the existing Set Scale chevron.
- Wall height units in popup — display in mm (matches canonical pixelsPerMm storage); switch to unit-aware later if needed.
- Schema version bump path — bump formatVersion for the additive `hiddenItemNames` field, or rely on per-field defaulting; researcher to choose per existing migration policy.

## Deferred Ideas

- BOQ export filter by hidden items
- Per-page wall-height defaults
- Per-row tooltip with wall length + height + count breakdown
- Cursor-attached label trailing the crosshair
- Right-click on canvas as chain-break trigger
- Heavier crosshair in theme accent color (as user preference)
- Group/bulk visibility toggle (per-category aggregate)
- Wall thickness rendering (parallel-offset polygon with miter math)
