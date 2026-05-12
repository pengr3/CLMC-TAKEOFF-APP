# Phase 7: Canvas Workspace UX and Markup Editing Fixes - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix five live-use delinquencies discovered after v1 completion:
1. **Canvas blank gutters** — Konva Stage locks at 800×600 initial size; fix the ResizeObserver circular dependency so the canvas fills all available space
2. **Post-commit markup editing** — Add right-click → "Edit" to MarkupContextMenu so placed markups can have name/category/color changed after placement
3. **Totals panel cleanup** — Remove the pinned grand-total bar and per-category subtotal rows; keep item rows and category headings
4. **Set Scale modal dropdown overflow** — Native `<select>` unit dropdown gets clipped by an ancestor's overflow; fix the clip chain
5. **Category deduplication UX** — Add keyboard navigation to CategoryAutocomplete and auto-substitute the canonical name on confirm when a case-insensitive match exists

**In scope:** The five fixes above. No new markup types, no new export formats, no UI restructuring beyond what the fixes require.

**Out of scope:** Bulk/group markup rename, geometry editing of placed shapes (move points), markup visibility layers (v2 PROD-02), custom export templates.

</domain>

<decisions>
## Implementation Decisions

### Canvas Blank Gutters

- **D-01:** Root cause is a **ResizeObserver circular dependency** in `CanvasViewport.tsx`. The `containerRef` div uses `width: '100%', height: '100%'`, but its flex parent in `App.tsx` (`<div style={{ flex: 1, position: 'relative' }}>`) has no explicit height. The Stage therefore locks at its initial `containerSize` default of `{ width: 800, height: 600 }`. The PDF page is positioned centered within those 800×600 pixels — not centered in the actual available space — leaving large dark gutters to the right and below.
- **D-02:** Fix: replace `width: '100%', height: '100%'` with `position: absolute; inset: 0` on the `containerRef` div inside `CanvasViewport.tsx`. Since its parent already has `position: relative`, `inset: 0` fills the parent's layout-computed bounds without depending on percentage height propagation. The ResizeObserver then measures the actual available area on every layout change.
- **D-03:** Must verify that `fit-to-window` centering (calculated off `containerSize`) is correct after the fix — the centering math (`centerX = (containerSize.width - pageWidth * fitScale) / 2`) is sound; it just needs the right `containerSize` input. No math changes required.

### Post-commit Markup Editing

- **D-04:** Edit is triggered via **right-click → "Edit"** added to the existing `MarkupContextMenu` (alongside the current "Recolor Group" and "Delete" items). No conflict with the Count tool's left-click increment behavior.
- **D-05:** Edit scope is **per-markup only** (not group rename). The clicked markup's name, category, and color change independently. Other markups sharing the same name are not affected. (Claude's discretion — lower blast radius than group rename; user can repeat for each markup if a group rename is needed.)
- **D-06:** Edit popup shows **Name + Category + Color** — reuse `MarkupNamePopup` in a new `mode='edit'` variant (alongside existing `'count-pre'` and `'save-after'`). No measurement preview in edit mode (that was draw-time feedback only). The popup appears at the cursor position of the right-click.
- **D-07:** The edit action must be **undoable** via the command pattern. A new `EditMarkupCommand` is needed in `markupStore.ts` that stores `{ markupId, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor }` for undo/redo round-trip.

### Totals Panel Cleanup

- **D-08:** Remove the **pinned grand-total bar** from `TotalsPanel.tsx` — the `data-testid="totals-panel-grand-total"` conditional block is deleted entirely.
- **D-09:** Remove **per-category subtotal rows** from `TotalsCategoryBlock.tsx` — the `category.subtotals.map(...)` block (lines rendering `data-testid="totals-subtotal-row"`) is deleted. The `BoqStructure.subtotals` data itself can remain in the aggregator output; only the rendering is removed.
- **D-10:** Category headings (collapse/expand), individual item rows (`TotalsRow`), click-to-navigate, hover ring, and right-click context menu all remain **unchanged**.

### Set Scale Modal Dropdown Overflow

- **D-11:** The native `<select>` in `CalibrationDialog.tsx` gets clipped by an ancestor container with `overflow: hidden`. (Claude's discretion — researcher to trace the clip path: `CanvasViewport` mounts `CalibrationDialog` inside its `position: absolute; inset: 0` root div, and an intermediate container may have `overflow: hidden`.) Fix options in priority order: (a) add `overflow: visible` to the clipping ancestor, or (b) if the native select cannot escape the clip context, replace with a custom dropdown styled consistently with the existing inline-style dark-theme pattern.

### Category Deduplication UX

- **D-12:** Add **keyboard navigation** to `CategoryAutocomplete` — `ArrowDown`/`ArrowUp` move a highlighted index through the suggestion list; `Enter` selects the highlighted item. The keyboard events must be captured on the category `<input>` in `MarkupNamePopup` and forwarded to the autocomplete (or handled in the input's `onKeyDown` with a shared state index).
- **D-13:** On **confirm** in `MarkupNamePopup` (Start Count / Save Markup / Edit save), call `findCategoryByName(typedCategoryName)` before `getOrCreateCategory`. If a case-insensitive match exists, substitute the stored canonical name so the markup is assigned to the existing category — not a new one with a different capitalisation. `findCategoryByName` is already case-insensitive; this is a call-site discipline fix, not a store change.

### Claude's Discretion

- **Edit scope (D-05):** Per-markup recommended (not group rename) — lower blast radius.
- **Set Scale fix approach (D-11):** Prefer `overflow: visible` on clipping ancestor; fall back to custom dropdown only if needed.
- **Category keyboard highlight state (D-12):** Hold `highlightedIndex` as local state in `CategoryAutocomplete` (or in `MarkupNamePopup` and passed down) — reset on list close or query change.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and Requirements
- `.planning/ROADMAP.md` — Phase 7 goal text and 5 success criteria (the source of truth for what "done" looks like)
- `.planning/REQUIREMENTS.md` — MARK-03 (area markup), VIEW-01 (live totals) referenced as affected requirements; the fixes are quality-of-life, not new requirements

### Canvas Sizing — Root Cause Files
- `src/renderer/src/components/CanvasViewport.tsx` — `containerRef` (line 76), `containerSize` state (line 77 initial `{width: 800, height: 600}`), ResizeObserver effect (lines 109–125), Stage sizing (lines 540–543). The circular dependency lives here.
- `src/renderer/src/App.tsx` — The flex parent of CanvasViewport (`<div style={{ flex: 1, position: 'relative' }}>`, lines 265–348). This div has no explicit `height`, which is why `height: '100%'` on the child fails.

### Post-commit Editing — Files to Modify
- `src/renderer/src/components/MarkupContextMenu.tsx` — existing right-click menu; add "Edit" item here
- `src/renderer/src/components/MarkupNamePopup.tsx` — reuse in `mode='edit'`; currently supports `'count-pre'` and `'save-after'` only
- `src/renderer/src/stores/markupStore.ts` — `findCategoryByName` (case-insensitive, line 53–59), `getOrCreateCategory` (line 73); needs new `editMarkupCommand` action
- `.planning/STATE.md` §Key Decisions — **Command pattern for undo/redo** (`MarkupCommand` stores full `Markup` object; `EditMarkupCommand` should store old+new fields for reversibility)
- `.planning/phases/03.1-markup-gap-closure-and-visual-redesign/03.1-CONTEXT.md` — D-29 (recolorGroup command pattern), D-25 (color inheritance on name change). EditMarkupCommand mirrors the recolorGroup command shape.

### Totals Panel — Files to Modify
- `src/renderer/src/components/TotalsPanel.tsx` — grand-total bar block to remove (`data-testid="totals-panel-grand-total"`, lines 282–323)
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — subtotal rows to remove (`category.subtotals.map(...)` block, lines 142–188)
- `.planning/phases/06-live-view-and-ui-polish/06-CONTEXT.md` — D-04 (aggregator single source of truth), D-13 (collapse persistence). Removing rendering rows does NOT require changing `boq-aggregator.ts` output shape.

### Set Scale Modal
- `src/renderer/src/components/CalibrationDialog.tsx` — the `<select>` element (lines 125–144); its rendering context and ancestor overflow chain

### Category Deduplication
- `src/renderer/src/components/CategoryAutocomplete.tsx` — current suggestion list; add keyboard navigation here
- `src/renderer/src/components/MarkupNamePopup.tsx` — category input `onKeyDown` + confirm path where canonical-name substitution applies

### Established Patterns (MUST follow)
- `.planning/STATE.md` §Key Decisions — **MarkupCommand pattern** (stores full objects, not just IDs), **zoom-compensated Konva overlays** (unrelated to Phase 7 new code, but do not regress)
- `.planning/STATE.md` §Key Decisions — **Parent-owned-lifecycle for transient UI** — MarkupNamePopup in edit mode follows the same mount/unmount discipline as the placement popup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MarkupNamePopup`** (`src/renderer/src/components/MarkupNamePopup.tsx`) — accepts `initialName`, `initialCategoryName`, `initialColor`; already pre-fills from store inheritance. Adding `mode='edit'` only requires a new primary button label ("Save Changes") and passing the existing markup's values as initial props.
- **`MarkupContextMenu`** (`src/renderer/src/components/MarkupContextMenu.tsx`) — existing right-click menu with delete + recolor. Add "Edit" as the first item (most common post-commit action).
- **`findCategoryByName`** in `markupStore.ts` — already case-insensitive (`trim().toLowerCase()`). The canonical-name substitution (D-13) is a two-line call-site fix in `MarkupNamePopup.handleConfirm`.
- **`boq-aggregator.ts`** — the `subtotals` field on `BoqCategoryGroup` remains unchanged; only TotalsCategoryBlock's render of it is removed. No aggregator changes required.

### Established Patterns
- **Command pattern**: `MarkupCommand` interface in `markupStore.ts` — `EditMarkupCommand` should follow the same `{ execute(), undo() }` shape, storing `oldName/oldCategoryName/oldColor` + `newName/newCategoryName/newColor` and the markup's `id` and `page`.
- **Inline-style dark theme**: all existing components (MarkupContextMenu, MarkupNamePopup, CalibrationDialog) use `COLORS.*` constants from `src/renderer/src/lib/constants.ts`. Any new UI surfaces in Phase 7 follow the same pattern — no Tailwind in the canvas/panel path.
- **ResizeObserver pattern**: already used in `CanvasViewport` and `App.tsx` (container width for Splitter). The fix changes HOW the container fills its parent, not whether ResizeObserver is used.
- **`onMouseDown + e.preventDefault()`**: used in `CategoryAutocomplete` to prevent input blur before selection. Keyboard navigation must be careful not to break this — Enter on a highlighted item should call `onSelect` without triggering blur-close race.

### Integration Points
- **`CanvasViewport.tsx` root div**: changes from `width: '100%', height: '100%'` to `position: absolute; inset: 0`. All absolute-positioned children inside (CalibrationDialog, MarkupNamePopup, MarkupContextMenu, MarkupTooltip) already use `position: absolute` — no child changes needed for this fix.
- **`MarkupContextMenu.tsx`**: the "Edit" item click fires a new `onEdit` callback prop. `CanvasViewport.tsx` wires `onEdit` to mount `MarkupNamePopup` in `mode='edit'` at the right-click position, pre-filled with the target markup's current fields.
- **`markupStore.ts`**: `executeCommand(new EditMarkupCommand(...))` dispatches the edit and pushes to the undo stack. The `getOrCreateCategory` path runs as part of EditMarkupCommand.execute() — same as during placement.

</code_context>

<specifics>
## Specific Ideas

- **"The workspace just keeps cutting off"** — the screenshots showed the PDF page pinned to the top-left of a ~600px-wide Stage while the canvas area extended to ~1220px. The fix is structural (inset: 0), not cosmetic.
- **"I just want the experience to feel tighter"** (category dedup) — keyboard nav + canonical-name substitution on confirm are the right two levers. They make the happy path (use autocomplete) faster, and make the escape hatch (type your own) safe by normalising the name at save time.
- **Totals panel** — the user confirmed: remove grand-total bar + category subtotals. Item rows, category headings, click-to-navigate, hover ring all stay. This is a net subtraction — no new components needed.

</specifics>

<deferred>
## Deferred Ideas

- **Group/bulk rename** — editing all markups sharing a name in one operation. Useful but higher blast radius; worth its own phase if needed.
- **Geometry editing** — moving individual polygon vertices or polyline points of a placed markup. Significant Konva interaction work; v2 scope.
- **Markup visibility layers** — show/hide by category. v2 PROD-02, explicitly out of this phase.
- **Custom export templates** — v2, explicitly out of project scope for v1.

</deferred>

---

*Phase: 07-canvas-workspace-ux-and-markup-fixes*
*Context gathered: 2026-05-12*
