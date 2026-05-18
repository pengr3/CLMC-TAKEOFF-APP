# Phase 9: Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Five independent UX improvements delivered together: (1) click-to-select a markup + Delete-key deletion, (2) rubber-band multi-select + group delete as one undoable action, (3) every modal centered on open and draggable by the user, (4) flat toolbar replaced by a ribbon-style tabbed toolbar (Home / Page / Tools / View / Estimating / Settings / Help), (5) Enter key commits an in-progress linear/area/perimeter/wall markup (double-click behavior unchanged from current).

</domain>

<decisions>
## Implementation Decisions

### Selection Model — State Storage
- **D-01:** Selection state storage deferred to implementer discretion — user said "you decide based on our codebase and goals." Recommendation: add `selectedMarkupIds: string[]` to **viewerStore** (transient UI state, already imported everywhere markup tools are wired, no new store surface). Single-select is a `[id]` array; multi-select is `[id1, id2, ...]`; nothing selected is `[]`. Using an array from day one avoids a refactor when multi-select arrives.

### Selection Model — Visual
- **D-02:** Selection ring style deferred to implementer discretion — user said "you decide based on our codebase and goals." Recommendation: reuse the existing `HoverRing` component with `opacity=1` and stroke color `#0078d4` (accent). Hover stays white/40%. This reuses existing Konva Layer 2 infrastructure with zero new component surface.

### Selection Model — Click Behavior
- **D-03:** Click behavior when a markup tool is active deferred to implementer discretion — user said "you decide based on our codebase and goals." Recommendation: option C — **placement always takes priority when a tool is active; pressing Escape exits the active markup tool and returns to `'select'` mode** (not the current idle). This is the clearest separation of intent and the most natural mouse-first UX pattern.

### Selection Model — Delete Key
- **D-04:** Delete-key path deferred to implementer discretion — user said "you decide based on our codebase and goals." Recommendation: option A — **both Delete-key and right-click context-menu Delete call the same `deleteMarkup` store action**. Key handler reads `selectedMarkupIds[0]` from store and calls `deleteMarkup`. DRY; consistent undo entry.

### Selection Model — Empty Space Click
- **D-05:** Clicking empty canvas while in `'select'` mode **deselects** (clears `selectedMarkupIds` to `[]`). Standard behavior.

### Rubber-Band Multi-Select
- **D-06:** In `'select'` mode, **LMB drag on empty canvas draws the rubber-band rectangle** (no modifier key required). Middle-mouse still pans as before.
- **D-07:** Selection containment rule — **full bounding box of the markup must be entirely inside the rubber-band rectangle** to be selected. Standard CAD "selection window" behavior.
- **D-08:** **Ctrl+A selects all markups on the current page** (guarded by existing `isTextInputActive()` check, same as all other Ctrl+ shortcuts).
- **D-09:** Group delete is stored as a **new `'delete-group'` MarkupCommand variant holding `Markup[]`**, producing a single Ctrl+Z undo step for the entire group. Requires extending the MarkupCommand discriminated union and the undo/redo switch in `markupStore`.

### Draggable Centered Modals
- **D-10:** **All true modals** (every component rendered with an overlay/backdrop) get centered+draggable treatment. This is a global rule: **any new modal introduced in this or future phases must also use the draggable pattern**. Current scope: CalibrationDialog, MarkupNamePopup, ScalePopup, SaveCloseModal, OpenErrorModal, UncalibratedExportWarningModal, ArchiveCorruptedModal, DimensionMismatchModal, PageCountAbortModal.
- **D-11:** Implementation via a **`useDraggable` hook** that each modal applies independently. The hook returns `{ position, onPointerDown }` — modal passes `onPointerDown` to its drag-handle element and applies `position` as a CSS offset. Implementer should choose the approach that best fits the existing codebase for efficiency and maintainability (user said "use the best application to our codebase effectivity and efficiency wise").
- **D-12:** **Drag anywhere on the modal that isn't an interactive control** (input, button, select, textarea). Maximum hit area; no dedicated header strip required. No visual drag affordance needed — discoverable through use.
- **D-13:** **Backdrop click keeps its current dismiss behavior** for modals that currently support it (CalibrationDialog, MarkupNamePopup, ScalePopup). Risk of accidental dismiss during drag is low since dragging works on the modal body, not the backdrop.
- **D-14:** **Position resets on every modal open** (re-centers). No position memory across open/close cycles.

### Ribbon Toolbar
- **D-15:** **Full replacement** — `Toolbar.tsx` is deleted and rebuilt as a ribbon component from scratch. No wrapping of the old bar.
- **D-16:** **Icon-above-label tall square buttons (~56–64px)** for the ribbon panel. New `RibbonButton` component required (distinct from the existing `IconButton`). Matches Microsoft Office ribbon conventions as specified in the phase goal.
- **D-17 — Home tab:** Keeps exactly what the current toolbar left section has — **Open, Save, Save As, Replace Plan PDF, Export**. No Undo/Redo added (user: "Gets to keep what we currently have").
- **D-18 — Page tab:** Page navigation controls — Previous Page, page indicator (Page N of M), Next Page. Implementer discretion on exact layout.
- **D-19 — Tools tab:** All markup and scale tools — **Select** (new), **Count**, **Linear**, **Area**, **Perimeter**, **Wall**, **Set Scale**. Chain-armed badge chips remain visible on the active tool button. Scale context menu chevron (▾) remains on Set Scale.
- **D-20 — View tab:** **Zoom In, Zoom Out, Fit to Window** (current zoom controls) + **Show/Hide Totals Panel** toggle + **Show All / Hide All markups** (currently only accessible via individual lightbulb icons in the panel).
- **D-21 — Estimating tab:** Implementer discretion — scope not specified. May duplicate Export or surface BOQ summary stats. Do not block planning on this; stub if content is unclear.
- **D-22 — Settings tab:** **Stubbed** — tab label present, panel shows "Coming soon".
- **D-23 — Help tab:** **Stubbed** — tab label present, panel shows "Coming soon".
- **D-24:** **Home tab is active by default** on app load.

### Markup Completion (Enter / Double-click)
- **D-25:** **Double-click behavior is unchanged from current** — user said "Just maintain the current function we have now." The existing area/perimeter start-vertex close detection remains as-is. No new double-click-at-last-point logic.
- **D-26:** **Enter key commits an in-progress markup** (Linear, Area, Perimeter, Wall) subject to a minimum-point guard: commit is **blocked if the shape would be degenerate** (< 2 points for linear/wall, < 3 points for area/perimeter). Silent ignore on blocked commit (no toast needed).
- **D-27:** The existing `isTextInputActive()` guard applies to the Enter key shortcut — commit only fires when no text input is focused.

### Claude's Discretion
- **Q-01/D-01:** Where `selectedMarkupIds` lives in the store — recommendation above, implementer may override if codebase context warrants.
- **Q-02/D-02:** Selection ring visual — recommendation above, implementer may choose a different approach if it integrates more cleanly with the existing Konva layer structure.
- **Q-03/D-03:** Click behavior when a tool is active — recommendation above.
- **Q-04/D-04:** Delete-key vs. context-menu code path — recommendation above.
- **Q-11/D-11:** Exact `useDraggable` hook API and whether a thin `DraggableModal` wrapper is also introduced — use whatever is most efficient given the codebase.
- **Q-21/D-24:** Page and Estimating tab contents not fully specified — implementer has discretion within the ribbon structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing store and type contracts
- `src/renderer/src/types/viewer.ts` — `ActiveTool` union (must add `'select'` if not already present), `isMarkupTool` type guard, `ViewerState` interface
- `src/renderer/src/stores/markupStore.ts` — `MarkupCommand` discriminated union (must extend with `'delete-group'`), `deleteMarkup`, `undo`/`redo` switch
- `src/renderer/src/stores/viewerStore.ts` — where `selectedMarkupIds` will be added
- `src/renderer/src/lib/constants.ts` — `COLORS` tokens (all new components use these, no new hex literals)

### Canvas and interaction patterns
- `src/renderer/src/components/CanvasViewport.tsx` — module-level ref pattern (`_canvasControls`, `_calibrationControls`, `_chainArmedItem`), `isOverStartPoint` hit-test pattern (reference for rubber-band and selection hit detection), Layer 1a/1b/2 structure
- `src/renderer/src/components/HoverRing.tsx` — existing selection ring Konva component to reuse/extend for selected state
- `src/renderer/src/hooks/useMarkupTool.ts` — chain mode state machine, `INITIAL_STATE` reset pattern, `stateRef` snapshot discipline

### Toolbar and modal patterns
- `src/renderer/src/components/Toolbar.tsx` — full replacement; read to understand all existing button props and callbacks passed from App.tsx before deleting
- `src/renderer/src/components/CalibrationDialog.tsx` — reference modal (overlay + inner div pattern, backdrop-dismiss, Enter/Escape handling)
- `src/renderer/src/components/MarkupNamePopup.tsx` — reference modal (screenPos + containerSize centering logic, wall-height conditional row)
- `src/renderer/src/App.tsx` — Toolbar prop interface (`onOpenClick`, `onReplaceClick`, `onExportClick`); ribbon must preserve this contract or App.tsx must be updated in the same plan

### Phase history (cross-cutting constraints)
- `.planning/STATE.md` §"Critical Pitfalls to Watch" and §"Key Decisions Locked" — zoom-compensated stroke widths, COLORS tokens, inline styles only (no Tailwind in canvas/panel path), `isTextInputActive()` guard on all global keyboard shortcuts
- `.planning/phases/08-markup-workflow-and-wall-tool/08-07-PLAN.md` — edit popup must pass `toolType + initialWallHeight` for wall markups (Pitfall from UAT bug 224f867)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HoverRing.tsx` — Konva Layer 2 component with zoom-compensated offset stroke; reuse for selected-state ring by passing different color/opacity props
- `PulseHighlight.tsx` — Layer 2 transient overlay; coexists with selection ring (offsets 4/zoom vs 8/zoom prevent overlap)
- `useMarkupStore.deleteMarkup(id)` — existing undoable delete via MarkupCommand; Delete-key handler calls this directly
- `isTextInputActive()` — existing guard in `useKeyboardShortcuts`; reuse for Enter-key and Delete-key handlers
- `isOverStartPoint(pointer, points, zoom)` — existing hit-radius check in CanvasViewport; reference pattern for rubber-band boundary detection
- `getCalibrationControls()` / `getCanvasControls()` / `getChainArmedItem()` — module-level ref pattern in CanvasViewport; new `getSelectionControls()` should follow the same shape if cross-component selection access is needed

### Established Patterns
- **Module-level refs for canvas controls** — `_canvasControls`, `_calibrationControls`, `_chainArmedItem` — new ribbon must wire to the same refs (do not duplicate trigger code)
- **Zoom-compensated Konva overlays** — `strokeWidth / currentZoom` on all Layer 2 shapes (HoverRing, PulseHighlight, rubber-band rectangle must follow this)
- **`COLORS.*` inline tokens** — no raw hex literals, no Tailwind in canvas/panel path
- **Discriminated union MarkupCommand** — `'add' | 'delete' | 'edit' | 'recolor'`; new `'delete-group'` extends this; undo/redo switch in markupStore must handle the new variant
- **`isTextInputActive()` guard** — mandatory on Delete key, Enter key, Ctrl+A
- **Toolbar → App.tsx prop contract** — `onOpenClick`, `onReplaceClick`, `onExportClick` are owned by App.tsx; ribbon must preserve or co-locate this routing

### Integration Points
- `App.tsx` — Toolbar is replaced; App must render the new Ribbon component with the same callback props
- `CanvasViewport.tsx` — rubber-band rectangle renders in a new Konva Layer (or Layer 1b); selection state consumed from viewerStore
- `useKeyboardShortcuts.ts` — add Delete-key handler (reads selectedMarkupIds), Enter-key handler (commits in-progress markup), Ctrl+A handler (select all on page)
- `markupStore.ts` — add `deleteGroup(markups: Markup[])` action with `'delete-group'` command; extend undo/redo switch

</code_context>

<specifics>
## Specific Ideas

- **Modal drag rule (D-10):** User explicitly said "all incoming thereafter" — this is a standing architectural rule, not just a one-time retrofit. Document it in CLAUDE.md conventions after this phase.
- **Home tab content (D-17):** "Gets to keep what we currently have" — the ribbon Home tab is a 1:1 migration of the current left-side toolbar group. No design changes to those buttons.
- **Double-click (D-25):** "Just maintain the current function we have now" — the existing area/perimeter polygon close (clicking the start vertex) is sufficient. The Enter key is the only new commit path.
- **useDraggable (D-11):** User asked for "best application to our codebase effectivity and efficiency wise" — if a thin `DraggableModal` wrapper turns out cleaner than a hook after reading the modal code, the implementer may use it; the decision is efficiency-first, not dogma.

</specifics>

<deferred>
## Deferred Ideas

- **Markup drag/move** — dragging a selected markup to reposition it. Not in this phase; would require coordinate recalculation in PDF page space and MarkupCommand support. Natural follow-on.
- **Resize handles / Konva Transformer** — corner handles for resizing area/perimeter polygons. Significant scope; own phase.
- **Settings tab content** — global display unit preference (m/ft/mm switching). Noted as a real gap but deferred; Settings tab is stubbed in this phase.
- **Help tab content** — keyboard shortcuts reference list. Stubbed in this phase.
- **Estimating tab content** — BOQ summary stats or export shortcuts beyond what's in Home. Not specified; may emerge as a natural place once ribbon is in place.

</deferred>

---

*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Context gathered: 2026-05-18*
