# Phase 8: Markup Workflow Acceleration and Wall Measurement Tool - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Four independent post-v1 enhancements that together accelerate placement and decluttering of the live takeoff:

1. **Continuous (chain) markup mode** — After committing a markup with the linear/area/perimeter/count/wall tool, the tool stays "armed" with the same name + category + color so successive markups of the same item don't re-prompt.
2. **Wall measurement tool** — New markup type that computes wall area in m² as `linear length × wall height`. Reuses the chain pattern from item 1.
3. **Per-item show/hide visibility toggle** — Each TotalsRow gets a clickable visibility icon that hides matching markups from the canvas without affecting totals or BOQ export.
4. **In-app crosshair cursor** — Replace the OS cursor over the canvas with a custom rifle-scope crosshair whenever a markup or scale tool is active, so users can pinpoint exactly where they're clicking.

**In scope:** The four features above. Wall is a new markup type with its own toolbar button, renderer, popup variant, and BOQ row. Chain mode generalizes the existing count-tool "stay armed" pattern to all five markup tools. Show/hide is a per-project, per-item visibility filter. Crosshair is a CSS-cursor swap (no Konva node).

**Out of scope:** Per-category visibility toggle (v2 PROD-02 — superseded by finer-grained per-item toggle); BOQ export filtering by hidden items (deferred — see Deferred Ideas); per-page wall-height defaults (deferred); cursor-attached chain-name label (rejected); group/bulk edit; geometry editing; custom export templates (v2).

</domain>

<decisions>
## Implementation Decisions

### Chain Markup Mode (Item 1)

- **D-01:** Chain mode applies to **all five markup tools** — count, linear, area, perimeter, and the new wall tool. The count tool's existing "stay armed in placing mode" behavior (`useMarkupTool.ts`) is the prototype; the chain feature generalizes it to linear/area/perimeter/wall, which today reset to `INITIAL_STATE` after `commitShape`.

- **D-02:** Chain-break triggers — **(a) `Esc` key, OR (b) clicking the active markup-tool button again** (which today toggles back to `'select'`; that toggle continues to work and now also breaks the chain). **Tool-switch to a different markup tool implicitly breaks the chain** (and arms the new tool fresh — no name/category carried across tool types). Right-click on the canvas does NOT break the chain (reserved for `MarkupContextMenu`).

- **D-03:** Visual indicator — **the existing toolbar `active` style (accent underline) stays on, plus a small chip badge** near the active tool button showing the armed name and color, e.g., `● Outlet`. The chip uses the markup's color as a leading dot/swatch and the typed name as a single-line label (truncated with ellipsis if long). The chip disappears on chain-break.

- **D-04:** Cross-page behavior — **chain persists across PDF page navigation**. The user can place the same item across multiple pages without re-naming. Only `Esc` or re-clicking the active tool ends the chain.

- **D-05:** Chain state is **stored inside `useMarkupTool` (renderer hook)** — NOT inside the markup store, NOT inside `.clmc`, NOT inside `localStorage`. Chain is purely a runtime UX state; closing the project / restarting the app resets it. Extend `MarkupDrawState` with a `chainArmed: boolean` field (or repurpose `mode === 'placing'` for non-count tools); preserve `pendingName/pendingCategoryName/pendingColor` across the post-commit reset.

### Wall Measurement Tool (Item 2)

- **D-06:** Wall is a **new `'wall'` MarkupType** in the `MarkupType` discriminated union (`src/renderer/src/types/markup.ts`). Add a `WallMarkup` interface alongside `LinearMarkup` / `AreaMarkup` / `PerimeterMarkup`:
  ```ts
  export interface WallMarkup extends BaseMarkup {
    type: 'wall'
    points: StagePoint[]      // polyline path (same shape as linear)
    wallHeight: number        // millimetres
  }
  ```
  Update `Markup` union, `MarkupCommand` (place/delete branches need WallMarkup; `'edit-markup'` may need an `oldHeight/newHeight` field — see D-07 below), `boq-types.ts` (`BoqRowType` adds `'wall'`), `boq-aggregator.ts` (wall aggregation rule), `boq-writers.ts` (export row with m² UoM).

- **D-07:** Edit support for walls is **in scope** (not deferred). The Phase 7 `EditMarkupCommand` action must extend to cover `wallHeight` change. Either add `oldHeight?: number` / `newHeight?: number` to the existing `'edit-markup'` command branch, OR add a new `'edit-wall'` command branch — researcher to recommend per the smaller diff and the "store full Markup object" pattern in STATE.md §Key Decisions.

- **D-08:** Height strategy — **per-wall input on commit; chain inherits the previous wall's height silently**. The very first wall of the chain defaults to **2400 mm**. Subsequent chained walls reuse the last entered height (no popup re-prompt mid-chain). User can change the height by `Esc`-breaking the chain and starting fresh, OR by right-click → Edit on a placed wall and updating its `wallHeight` (Phase 7 EditMarkupCommand path).

- **D-09:** Wall popup — **reuse `MarkupNamePopup`** with an added `Wall height: [____] mm` numeric input row between the Color row and the Save button. The height row is conditional: visible only when `toolType === 'wall'`. Default value = 2400 (first wall) or the last-entered chain height (subsequent walls). Empty/0/non-numeric → Save disabled with inline validation message.

- **D-10:** Wall renderer — **new `WallMarkup` Konva component** (`src/renderer/src/components/WallMarkup.tsx` to be created) that renders the polyline path using the existing linear stroke style PLUS a visually distinct wall affordance (Claude's discretion — researcher to propose: thicker stroke, parallel offset hairline to suggest wall thickness, or hatching). Label shows the m² area at the polyline midpoint (reuse `polylineMidpointByArcLength` from Phase 03.1) — NOT the linear length. Color follows the per-name-group color model (D-29 from Phase 03.1).

- **D-11:** Wall toolbar button — add a fifth `IconButton` next to Count/Linear/Area/Perimeter in `Toolbar.tsx`. Lucide icon: Claude's discretion (candidates: `Construction`, `RectangleVertical`, `Columns2`). Title: "Wall tool — measure wall area (length × height) in m²". Same disabled-when-uncalibrated guard as the other markup tools.

- **D-12:** BOQ representation — **single row per wall name in m²**, mirroring how area markups appear today. The `BoqItemRow` for a wall name has `quantity = sum(length_m × wallHeight_m)` across all walls of that name on all pages, with `uom = 'm²'`. NO secondary length-only row, NO per-row tooltip with breakdown (deferred — see Deferred Ideas).

### Show/Hide Visibility Toggle (Item 3)

- **D-13:** Persistence scope — **per-project file (inside `.clmc`)**. Hidden item names are part of the takeoff state and travel with the project across machines. Add an additive field to the project schema:
  ```ts
  // project-schema additive field
  hiddenItemNames: string[]   // names of items currently hidden on canvas
  ```
  This is an **additive (non-breaking) v2 schema bump** — old files without the field load fine and default to `hiddenItemNames: []`. Increment the `formatVersion` if the existing schema-versioning convention requires it (researcher to confirm against `project-schema.ts`).

- **D-14:** Visibility icon — **lucide `Lightbulb` (visible) / `LightbulbOff` (hidden)**, placed in a fixed leading slot **before the color chip** in `TotalsRow`. Always visible (not hover-only). Slot width ~16px; icon ~14px; click target the full slot. The lightbulb metaphor was the user's explicit preference over `Eye` / `EyeOff`.

- **D-15:** Hidden behavior — **canvas markups don't render; the TotalsRow stays fully interactive; totals quantities and BOQ Excel/CSV export include hidden items**. Specifically:
  - Markup renderers (`CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, new `WallMarkup`) skip rendering when `markup.name ∈ hiddenItemNames`.
  - `HoverRing` and `PulseHighlight` skip rendering for hidden markups (no point hovering/pulsing what isn't drawn).
  - `TotalsRow` click navigation, hover, right-click context menu, cycle dot — all unchanged. Clicking a hidden row still sets the page; the pulse just produces nothing visible.
  - `boq-aggregator.ts` aggregates ALL markups (hidden or not). `useBoqLive` totals are unchanged. BOQ export (`boq-writers.ts`) includes all items.
  - The TotalsRow is NOT dimmed when hidden — only the lightbulb icon's state changes (Lightbulb → LightbulbOff). Pure visual decluttering of the canvas only.

- **D-16:** Visibility toggle is **NOT undoable** via the markup command pattern. Hiding/showing is a view preference, not a takeoff action. Toggling fires a direct `projectStore` action that flips the name in/out of `hiddenItemNames` and marks the project dirty (so Save persists it).

### Crosshair Cursor (Item 4)

- **D-17:** Visual style — **rifle-scope crosshair: two crossed 1px lines forming a `+`, ~16px arms, with a 1–2px circular gap of negative space at the dead center** (no dot, no overlap). White lines with a thin 1px black outline for contrast on both white plan paper and dark scans. The empty center reveals the underlying pixel exactly without obscuring it.

- **D-18:** Implementation — **CSS cursor with SVG data-URL**. Embed the crosshair SVG inline as a `data:image/svg+xml;base64,...` URL applied via `cursor: url(...) 12 12, crosshair` on the appropriate element (`12 12` = hotspot at the cross intersection for a 24×24 SVG). OS-level cursor swap; zero render cost; no Konva node; no `mousemove` listener overhead. The `, crosshair` fallback ensures the standard cursor appears if the data-URL fails.

- **D-19:** Scope — crosshair active when `activeTool` is `count | linear | area | perimeter | wall` **OR** when `calibMode !== 'idle'` (Set Scale or Verify Scale). Default arrow cursor restored over toolbar/sidebar/popups automatically since they're outside the canvas container that carries the cursor style.

- **D-20:** Cursor is applied to the **`CanvasViewport` `containerRef` div** (the `position: absolute; inset: 0` root from Phase 7 D-02), conditional on the active-tool / calibration state. When `activeTool === 'select'` and not calibrating, the cursor reverts to the existing pan/grab cursor logic (no change to existing pan-cursor behavior).

### Claude's Discretion

- **Wall renderer affordance (D-10):** Researcher to propose the visual treatment that best distinguishes a wall from a plain linear. Recommend something subtle (e.g., 2× stroke width, thin parallel offset hairline) over invasive (e.g., hatching) for legibility on dense plans.
- **Wall toolbar icon (D-11):** Lucide icon library has limited wall-specific glyphs. Pick the clearest from `Construction`, `RectangleVertical`, `Columns2`, or similar. Communicate with the user via the title tooltip.
- **EditMarkupCommand wall-height extension (D-07):** Either add optional `oldHeight/newHeight` fields to `'edit-markup'` OR add a sibling `'edit-wall'` branch. Pick the smaller diff that keeps `MarkupCommand` exhaustive in TypeScript.
- **Chain-active chip badge exact placement (D-03):** Inline next to the active tool button, OR below the toolbar row. Pick whichever doesn't crowd the existing Set Scale chevron / horizontal flow.
- **Wall height units in popup (D-09):** Display in mm (matches the canonical `pixelsPerMm` storage). If user studies show estimators prefer typing meters, switch to a unit-aware input later — out of scope for v1 of the wall tool.
- **Schema version bump path (D-13):** Either bump `formatVersion` for the additive field, or rely on per-field defaulting in the deserializer. Researcher to choose based on the existing migration pattern in `project-io.ts` / `project-schema.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and Requirements
- `.planning/ROADMAP.md` §"Phase 8" — full goal text and the four-feature scope
- `.planning/REQUIREMENTS.md` — note that Phase 8 item 1 (per-item show/hide) effectively delivers v2 PROD-02 ("toggle visibility of markup categories") at finer granularity. No new v1 requirements; UI/MARK quality-of-life enhancements

### Chain Markup Mode — Files to Modify
- `src/renderer/src/hooks/useMarkupTool.ts` — `MarkupDrawState` interface (line 13), `INITIAL_STATE` (line 26), `commitShape` reset to INITIAL_STATE (line 324), `commitCountName` "stay armed in placing mode" pattern (line 106) — the prototype for chain mode generalization
- `src/renderer/src/components/Toolbar.tsx` — `handleMarkupToolClick` (line 189) currently toggles tool to `'select'`; chain mode adds a "break the chain" branch when re-clicking an already-active tool
- `src/renderer/src/components/CanvasViewport.tsx` — wires `useMarkupTool` to Konva pointer events; chain badge UI may render as a sibling element here or inside Toolbar

### Wall Measurement Tool — Files to Modify
- `src/renderer/src/types/markup.ts` — `MarkupType` union (line 3), `Markup` discriminated union (line 36), `MarkupCommand` discriminated union (line 45) — all need `'wall'` added
- `src/renderer/src/stores/markupStore.ts` — `placeMarkup`, `deleteMarkup`, `editMarkupCommand` actions all need `WallMarkup` support; `executeCommand` exhaustive switch needs `'wall'` cases
- `src/renderer/src/components/MarkupNamePopup.tsx` — add conditional `Wall height: [____] mm` input row when `toolType === 'wall'`; Save validation: positive numeric required
- `src/renderer/src/components/Toolbar.tsx` — fifth markup IconButton next to Count/Linear/Area/Perimeter
- `src/renderer/src/components/WallMarkup.tsx` — NEW component; renders polyline path with wall-specific affordance; m² label at polyline midpoint
- `src/renderer/src/lib/markup-math.ts` — wall-area helper `wallArea(points, heightMm, pageScale): number` (m²); reuses `polylineLength`
- `src/renderer/src/lib/boq-types.ts` — extend `BoqRowType` with `'wall'`
- `src/renderer/src/lib/boq-aggregator.ts` — wall aggregation: `quantity = sum(length_m × wallHeight_m)`, `uom = 'm²'`
- `src/main/src/lib/boq-writers.ts` — Excel/CSV export row for wall items (numeric m² with `numFmt`, mirror Phase 5 area-markup pattern)

### Show/Hide Visibility — Files to Modify
- `src/renderer/src/components/TotalsRow.tsx` — leading 16px Lightbulb/LightbulbOff slot before the color chip (line 200); click handler toggles `projectStore.toggleHiddenItem(name)`
- `src/renderer/src/stores/projectStore.ts` — add `hiddenItemNames: string[]` slice + `toggleHiddenItem(name: string)` action; mark dirty on toggle so Save persists
- `src/renderer/src/components/CountPinMarkup.tsx`, `LinearMarkup.tsx`, `AreaMarkup.tsx`, `PerimeterMarkup.tsx`, new `WallMarkup.tsx` — skip render when `markup.name ∈ hiddenItemNames`
- `src/renderer/src/components/HoverRing.tsx`, `PulseHighlight.tsx` — skip render for hidden markups
- `src/main/src/lib/project-schema.ts` — additive `hiddenItemNames: string[]` field; deserializer defaults to `[]` for old files
- `src/main/src/lib/project-io.ts` — serialize `hiddenItemNames`; researcher to confirm whether a `formatVersion` bump is needed per existing migration policy

### Crosshair Cursor — Files to Modify
- `src/renderer/src/components/CanvasViewport.tsx` — `containerRef` div (the `position: absolute; inset: 0` root from Phase 7 D-02); compute `cursor` style from `activeTool` + `calibMode` and apply via inline style

### Established Patterns (MUST follow)
- `.planning/STATE.md` §Key Decisions:
  - **MarkupCommand stores full Markup object (not just ID)** — the new `'wall'` place/delete branches must follow this; EditMarkupCommand wall-height extension stores both old AND new height
  - **Per-page scale model (not per-project)** — wall area math reads `pageScale` per page exactly like linear/area today
  - **Command pattern for undo/redo** — wall placement/edit/delete must push to the undo stack; visibility toggle does NOT (D-16)
  - **`isTextInputActive()` guard on every global Ctrl+ shortcut** — if the wall popup adds new keyboard bindings (Enter to save, Tab between fields), the existing global Ctrl+Z guard must still work
  - **`localStorage clmc.ui` namespace, NEVER in `.clmc` files** — but visibility is the inverse case: it lives IN `.clmc` precisely because it's takeoff state, not workstation state
- `.planning/phases/03.1-markup-gap-closure-and-visual-redesign/03.1-CONTEXT.md` — D-29 (recolorGroup pattern), D-25 (color inheritance on name change), per-name-group color model — wall markups follow this exactly via `Markup.color` field
- `.planning/phases/04.1-zip-embedded-clmc/04.1-CONTEXT.md` — `.clmc` v2 ZIP-embedded archive; the additive `hiddenItemNames` field lives in the project JSON inside the archive
- `.planning/phases/06-live-view-and-ui-polish/06-CONTEXT.md` — D-04 (boq-aggregator single source of truth — wall must follow), TotalsRow color-chip-on-name-only convention, useUiPanels localStorage scope (workstation prefs only)
- `.planning/phases/07-canvas-workspace-ux-and-markup-fixes/07-CONTEXT.md` — D-07 EditMarkupCommand command shape (extend for wallHeight), D-04 right-click → Edit menu (also applies to walls), MarkupNamePopup mode='edit' (also handles wallHeight when editing a wall)

### External References
- [Lucide icon library](https://lucide.dev/) — Lightbulb, LightbulbOff, Construction, RectangleVertical, Columns2 (wall icon candidates)
- [MDN: CSS cursor: url() syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor) — data-URL cursor with hotspot coords; max image size constraints (32×32 generally safe across browsers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`useMarkupTool.ts` count-tool "stay armed in placing mode" pattern** (lines 106–153) — after `commitCountName`, `mode` becomes `'placing'` and rapid-fire `recordClick` calls keep dropping pins of the same name/category/color. This is the chain-mode prototype; generalize it to linear/area/perimeter/wall by NOT resetting to `INITIAL_STATE` after `commitShape` (line 324) when chain mode is "armed".
- **`MarkupNamePopup`** — already accepts `initialName/initialCategoryName/initialColor` and emits `{ name, categoryName, color }`. Add a single optional `wallHeight` field to its props and emit payload, conditional on `toolType === 'wall'`. Phase 7 already extended this popup with `mode='edit'`; the wall-height row is mode-orthogonal.
- **`useMarkupHighlight` (Phase 6)** — manages hover/pulse lifecycle. Adding the hidden-skip check at the renderer level (CountPinMarkup, LinearMarkup, etc.) is sufficient; HoverRing/PulseHighlight don't need their own hidden-state knowledge if they receive Markup objects that filter out hidden ones upstream.
- **`boq-aggregator.ts` `BoqStructure` builder** — wall aggregation slots in alongside count/linear/area/perimeter. Aggregator processes ALL markups (hidden or not — D-15); aggregator does NOT need to know about visibility.
- **`useUiPanels` localStorage `clmc.ui` pattern** — relevant for chain mode (chain state is RUNTIME-only; even simpler — not persisted at all per D-05). Visibility does the OPPOSITE: lives in `.clmc` per D-13.
- **Phase 7 EditMarkupCommand pattern** (`MarkupCommand` `'edit-markup'` branch) — wall edit must extend this branch (or sibling) to cover `wallHeight` change.
- **Toolbar `IconButton` component** (`Toolbar.tsx` line 28) — wall tool button reuses this; chain-active chip badge can be a child of `IconButton` (the `children` prop already supports the Set Scale chevron, line 343).

### Established Patterns

- **MarkupCommand discriminated union with exhaustive switch** — TypeScript ensures every `MarkupCommand` branch is handled in `executeCommand`. Adding `'wall'` to the place/delete payload union is automatically caught. Same for `BoqRowType` extension.
- **Inline-style + `COLORS.*` tokens** (no Tailwind in canvas/panel path) — wall toolbar icon, MarkupNamePopup wall-height row, TotalsRow lightbulb slot all follow this. New constants for wall stroke style go in `lib/constants.ts`.
- **Zoom-compensated Konva overlays** — wall renderer must divide stroke widths by `currentZoom` to keep visual sizes constant at all zoom levels (Phase 03.1 discipline).
- **Per-page coordinates in StagePoint** — wall `points: StagePoint[]` is page-space coordinates, exactly like linear/area/perimeter. Pan/zoom transforms apply via the Stage; no special wall transform needed.
- **`onMouseDown + e.preventDefault()` to avoid input blur close** — applies to the wall popup's height input the same way it applies to CategoryAutocomplete today.
- **CSS cursor on `containerRef` div** — the `position: absolute; inset: 0` div from Phase 7 D-02 is the natural anchor for the crosshair cursor swap. Children outside this div (Toolbar, TotalsPanel) keep their default cursor automatically.

### Integration Points

- **`useMarkupTool` ↔ Toolbar (chain badge)** — Toolbar reads chain state (e.g., via a new `getChainArmedItem(): { name, color } | null` exposed from `useMarkupTool` or its module-ref pattern, mirroring `getCanvasControls()` / `getCalibrationControls()`). Researcher to recommend whether a module-level ref or a Zustand-store-mediated channel is cleaner.
- **`useMarkupTool` ↔ Esc/tool-click chain-break** — `useKeyboardShortcuts.ts` already handles Esc for cancel; extend to call a new `breakChain()` method on `useMarkupTool` when chain is armed. Toolbar's `handleMarkupToolClick` (line 189) checks: if `activeTool === tool` AND chain is armed → call `breakChain()` instead of toggling to `'select'`.
- **`projectStore.hiddenItemNames` ↔ markup renderers** — renderers subscribe via a Zustand selector to `hiddenItemNames` and filter the markups they render. Selector is primitive (`(s) => s.hiddenItemNames`) so re-renders are bounded. Hidden state and dirty-flag updates flow through the existing `useProject` save path.
- **`projectStore.hiddenItemNames` ↔ TotalsRow** — TotalsRow reads `isHidden = useProjectStore((s) => s.hiddenItemNames.includes(itemName))` and toggles via `useProjectStore.getState().toggleHiddenItem(itemName)` on lightbulb click.
- **WallMarkup ↔ MarkupContextMenu** — wall right-click uses the existing context menu (Edit, Recolor Group, Delete) — no new menu items needed for v1; Edit dispatches the wall variant of EditMarkupCommand.
- **Crosshair CSS cursor ↔ `activeTool` + `calibMode`** — `CanvasViewport` computes a `cursorStyle` string from `activeTool` and `calibMode`, applies it inline on `containerRef.current?.style.cursor`. No state-tree changes; pure derived inline style.

</code_context>

<specifics>
## Specific Ideas

- **"Lightbulb on/off, not Eye"** — explicit user preference for the visibility icon. The lightbulb metaphor reads as "turn off the light over this item" — closer to the decluttering intent than "close your eyes to it."
- **Rifle-scope crosshair (gap in middle, no dot)** — explicit user preference over the more common dot-in-cross. The empty center reveals the underlying pixel exactly; it's the precision-instrument idiom from CAD/measurement tools.
- **Chain mode visual: tool stays highlighted + chip with armed name** — explicit pick. NOT a status-bar message (less spatial), NOT a cursor-attached label (too noisy on dense plans). The chip belongs near the tool button so the user's eye finds the affordance and the indicator together.
- **Wall data: new MarkupType, not a flag on linear** — explicit preference for clean separation. A wall is its own thing; sharing the MarkupType with linear-with-extras would clutter the discriminated union and make the BOQ aggregator branch on a field instead of a type.
- **Wall as single m² row in BOQ** — matches how an estimator bills walls (per m²). The user did not want a secondary length row or a tooltip breakdown; the totals row should look like an area row.
- **Chain persists across page navigation** — explicit pick over "breaks on page change". The user views chain mode as a pure productivity affordance — making the user re-name an item just because they switched pages would be friction.
- **Visibility lives in `.clmc`, not localStorage** — explicit pick. Hidden state is "part of the takeoff" (the estimator chose to hide these items intentionally as a working view), not a workstation preference like collapsedCategories.

</specifics>

<deferred>
## Deferred Ideas

- **BOQ export filter by hidden items** — the third option in the show/hide behavior question (visibility doubles as an export filter). Useful but higher risk of accidentally exporting an incomplete sheet; can be added later as an explicit "Include hidden" / "Exclude hidden" toggle in the Export dialog.
- **Per-page wall-height defaults** — option B in the wall height-strategy question. Useful for projects where each PDF page is a separate floor with a known ceiling height. Worth a small add-on phase if multi-storey projects become common.
- **Per-row tooltip with wall length + height + count breakdown** — option C in the wall BOQ question. Useful diagnostic affordance; can be added once the wall tool is in production use and patterns emerge.
- **Cursor-attached label trailing the crosshair** — option D in the chain visual indicator question. May surface again if the user finds the toolbar chip too far from the cursor on large monitors.
- **Right-click on canvas as chain-break trigger** — option D in the chain-trigger question. Conflicts with `MarkupContextMenu`; could be revived if a separate "right-click on empty canvas" channel is added later.
- **Heavier crosshair (theme accent color)** — option D in the crosshair-style question. Could be added as a user preference toggle if the rifle-scope style proves too subtle on busy plans.
- **Group/bulk visibility toggle (hide all markups in a category)** — explicitly the v2 PROD-02 scope; Phase 8 ships finer-grained per-item; per-category can be added later as an aggregate of per-item state.
- **Wall thickness rendering** — current scope renders a wall as a polyline with a wall-specific affordance (D-10). Drawing actual wall thickness (parallel offset polygon) is significantly more complex (involves miter math at corners) and is deferred.

</deferred>

---

*Phase: 08-markup-workflow-and-wall-tool*
*Context gathered: 2026-05-14*
