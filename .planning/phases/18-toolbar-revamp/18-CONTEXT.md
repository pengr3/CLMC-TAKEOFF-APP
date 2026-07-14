# Phase 18: Toolbar Revamp — Seamless One-Click Toolbar - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Source:** Spike Express Path — `.planning/spikes/007-toolbar-revamp/` (Direction A, feel-tested WINNER). No `/gsd:discuss-phase` round; the design was validated experientially in the spike and the locked decisions below are transcribed from `007-toolbar-revamp/README.md`.

<domain>
## Phase Boundary

A **pure UI/chrome refactor** of the app's toolbar. Replace the 7-tab Office ribbon (`RibbonToolbar.tsx`) with a **tab-less, co-visible** layout so the markup inner loop (pick tool → place → zoom/pan → flip page → save) never costs a tab round-trip. Three surfaces: a **persistent left tool rail**, a **slim top action bar**, and a **morphing context sub-bar**. Snap/Arc (Phase-14 features, keyboard-only today) become clickable controls. The duplicated top/bottom page+scale chrome folds into one status line.

**This is layout only.** No new tools, no new measurement types, no new persisted data, no changes to markup math, the BOQ, pricing, or the `.clmc` format. Every existing capability must remain reachable and behavior-identical — the work is *re-homing* existing handlers onto a better layout, not changing what they do.

</domain>

<decisions>
## Implementation Decisions (locked in spike 007, Direction A + user "both a")

### Layout architecture
- **D-01 (kill the tabs):** Remove the 7-tab strip and the mode-gated single-panel ribbon entirely. The tool palette and canvas navigation are **co-visible at all times** — the north star is "everything one click away." Direction B (unified strip) and C (floating HUD) were prototyped and rejected in the spike.
- **D-02 (left tool rail — persistent):** A vertical rail on the left edge of the workspace holds, top-to-bottom: **Select · Count · Linear · Area · Perimeter · Wall** — divider — **Set Scale** — divider — **Snap · Arc** toggles. The active tool renders with the accent-filled active chrome; Snap/Arc show their on-state. Icon + small label (icons already come from `lucide-react`, an existing dep). **Set Scale lives on the rail as a tool** (user choice a — it's spatial, you draw a line) and keeps its existing right-click recalibrate/verify menu (`ScaleContextMenu`) and the `▾` scale-actions affordance.
- **D-03 (top action bar — persistent):** Left group = **Open · Save · Save As · Replace PDF · Export** (the current Home-tab file ops, Open keeps its accent-primary styling). Center = **Page ◀ N/M ▶** and **Zoom −/%/+ · Fit**. Right = **Plan | Estimate** segmented toggle · **Totals** toggle · a reserved **⋯/gear** overflow button (future Settings/Help home).
- **D-04 (context sub-bar — morphs with state):** A thin bar under the top action bar:
  - *placing a markup tool* → chain **item name** (inline) + **color** swatch + **Snap/Arc** toggles + **Chain** indicator + "Enter to finish · Esc to cancel" hint
  - *Select tool + a markup selected* → **name / category / Recolor / Delete**
  - *Set Scale active* → the calibration hint
  - *idle* → a short hint
  Snap/Arc toggles appear **both** on the rail and here (both mutate the same `viewerStore` state).
- **D-05 (Snap/Arc become controls):** Snap and Arc are **clickable toggles**, not keyboard-only. The existing shortcuts still work: **F3** (snap on/off), **Alt** (snap suspend-while-held), **A** (one-off arc), **Shift+A** (sticky arc). The bottom `StatusBar` read-only snap **pill** is retired in favor of the rail/context toggles; the consolidated status line still *reflects* snap state.
- **D-06 (chrome consolidation):** Page + scale are printed **twice** today — by `CanvasHeaderBar` (top 28px) and `StatusBar` (bottom 28px). Fold into **one** status line. **Preserve** `CanvasHeaderBar`'s "Page not calibrated → Set Scale" inline nudge (its uncalibrated-with-non-count-markups branch). Whether the surviving line sits top or bottom is a planner/research call.
- **D-07 (Settings/Help removal, choice a):** The two "Coming soon" stub tabs are removed with the tab strip; a reserved **⋯/gear** button on the top bar holds the future home. **No** Settings/Help content is built this phase.
- **D-08 (behavior parity — non-negotiable):** Every existing capability stays reachable and byte-identical in behavior — chain mode + chain badges, resume-from-totals arming (`setChainArmedFromTotals`), Set Scale calibration entry (`getCalibrationControls`), zoom/fit/pan (`getCanvasControls`), Plan|Estimate view switch (`viewMode`), Totals toggle (`useUiPanels`), and all disabled-state logic (no PDF / saving / exporting / no markups). All keyboard shortcuts unchanged.

### Claude's Discretion / for research + planner
- **Component decomposition** — does `RibbonToolbar.tsx` get replaced by new components (e.g. `ToolRail` / `TopActionBar` / `ContextBar`) or refactored in place; how `App.tsx`'s flex shell changes to add the left rail as a column in the stage row (alongside canvas + `TotalsPanel`); how/whether `RibbonButton.tsx` and the tab-strip code + their tests are retired.
- **Status-line home** — top (where eyes rest while drawing, per `CanvasHeaderBar`'s own rationale) vs bottom (`StatusBar`'s position). Eliminate the duplication either way.
- **The Phase-16 `viewMode` reset coupling** (see Established Patterns) — with tabs gone, the `useEffect` that resets `viewMode` to 'plan' when leaving the Estimating **tab** no longer has a tab to key on. The planner must rework what replaces it (Estimate becomes a standalone toggle with no tab to "leave"). **Integration risk — call it out.**
- **Rail width, icon choices, label show/hide, ⋯-button shape**, and the exact visual tokens (reuse `COLORS` + the spike mockup as the visual reference).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design contract (feel-tested)
- `.planning/spikes/007-toolbar-revamp/README.md` — Direction A spec, the diagnosis (mode-gating → tab round-trips), and the locked decisions. **MUST read.**
- `.planning/spikes/007-toolbar-revamp/mockup.html` — the interactive prototype the user drove and approved; the authoritative *visual + interaction* reference (rail contents, top-bar groups, context-bar morphing, one status line). Serves as this phase's de-facto UI-SPEC — no separate `/gsd:ui-phase` round is needed.

### Motivation
- `.planning/spikes/GAP-002-post-precision-gaps.md` §GAP-02-DOCS — the "hidden depth / undiscoverable Snap + Arc" problem this revamp fixes.

No external ADRs — the toolbar is defined entirely in renderer code (see Existing Code Insights).

</canonical_refs>

<code_context>
## Existing Code Insights

### The component being replaced
- **`src/renderer/src/components/RibbonToolbar.tsx`** — the 7-tab ribbon. Holds **every** current handler the revamp re-homes: `handleMarkupToolClick` (arm tool / toggle back to select + `setChainArmedFromTotals(null)`), `handleSelectTool`, `handleSetScale` (activate/cancel calibration), `handleZoomIn/Out`, `handleFit`, `handleShowAll`/`handleHideAll` (both **must** call `markDirty()` — Pitfall 7), `handleToggleTotals`, the `renderViewModeSegment` Plan|Estimate control, the `ChainBadge`, the `▾` scale-actions chevron + `ScaleContextMenu`, and all the disabled-state derivations (`setScaleDisabled`, `saveDisabled`, `replaceDisabled`, `exportDisabled`). Props are `{ onOpenClick, onReplaceClick, onExportClick }`.
- **`src/renderer/src/components/RibbonButton.tsx`** — the current 72×80 icon+label button; its styling tokens carry over into the rail/bar button variants.

### The chrome being consolidated
- **`src/renderer/src/components/CanvasHeaderBar.tsx`** — top 28px: page label (left) + scale status (right), with the three-branch scale segment including the **"Page not calibrated → Set Scale"** nudge (uncalibrated + has non-count markups). Preserve this nudge (D-06).
- **`src/renderer/src/components/StatusBar.tsx`** — bottom 28px: filename · page · zoom% · scale · **snap pill** (ON = accent dot / held-off = dimmed / OFF = amber). Snap pill → toggle (D-05); page+scale dedup with CanvasHeaderBar (D-06).

### The integration seam (module-ref pattern)
`CanvasViewport.tsx` exports module-level control refs the toolbar calls directly (NOT via props/store — locked "Module-level ref pattern for canvas controls" decision):
- **`getCanvasControls()`** → `zoomIn / zoomOut / fitToWindow`
- **`getCalibrationControls()`** → `activate / cancel / activateVerify` (Set Scale + its context menu)
- **`getChainArmedItem()`** → `{ name, color }` for chain badges (read during render — Pitfall 6)
- **`setChainArmedFromTotals(item|null)`** → resume-from-totals arming + disarm
The new toolbar must call these **same** refs — do not reinvent the control path.

### Stores / hooks the toolbar reads
- `viewerStore`: `activeTool` / `setActiveTool`, `viewMode` / `setViewMode`, `snapEnabled` / `snapSuspended`, `currentPage` / `totalPages` / `nextPage` / `prevPage`, `getViewport(page).zoom`.
- `scaleStore`: `getScale(page)`, `calibMode`.
- `projectStore`: `isSaving`, `isExporting`, `setHiddenItemNames`, `markDirty`.
- `markupStore`: `pageMarkups` (→ `hasMarkups`).
- `useUiPanels`: `totals.open` / `setTotalsOpen`. `useProject`: `saveProject` / `saveProjectAs`.
- `lib/constants.ts`: `COLORS` (dark palette — `secondary #252526`, `accent #0078d4`, `border #3c3c3c`, `textPrimary #cccccc`, `activeSurface`, `warning #e8a838`), `LAYOUT`, `MIN_ZOOM`/`MAX_ZOOM`.

### Established patterns (respect these)
- **Module-ref canvas controls** (above) — the toolbar's control path.
- **Chain badge** gated on `activeTool === tool && getChainArmedItem() !== null`, read at render time (Pitfall 6, 09-RESEARCH).
- **`setHiddenItemNames` does NOT `markDirty` internally** — Show All / Hide All handlers call `markDirty()` explicitly (Pitfall 7).
- **`COLORS` tokens + inline styles only — no Tailwind** in the chrome path.
- **Snap flags (`snapEnabled`/`snapSuspended`) are runtime-only** viewerStore state, never serialized to `.clmc` (Phase 14).
- **⚠ Phase-16 GAP-1 coupling:** `RibbonToolbar` has a `useEffect` that resets `viewMode` to `'plan'` when `activeTab !== 'estimating'` while `viewMode === 'estimate'` — so leaving the Estimating tab reveals the Plan canvas. **With tabs removed this coupling loses its trigger.** Estimate must become a standalone `viewMode` toggle (no tab to leave); the planner replaces/removes this effect deliberately. This is the single trickiest behavior-parity item.

### Integration points
- **`src/renderer/src/App.tsx`** — mounts `RibbonToolbar` + `CanvasHeaderBar` + `StatusBar` + canvas + `TotalsPanel`, and wires `onOpenClick`/`onReplaceClick`/`onExportClick` + the resume-from-totals `handleArmTool`. The left rail becomes a new column in the stage row; the top bar + context bar replace the ribbon; the status line consolidates. Preserve all prop wiring.
- **`ScaleContextMenu.tsx`** — the Set Scale `▾` recalibrate/verify menu; keep on the rail Set Scale button.
- **Tests** — the current ribbon/tab tests (tab switching, `view-mode-toggle`, chain badges, Show/Hide All markDirty, scale chevron) must be migrated or replaced; behavior-parity tests should assert the same handlers fire from the new surfaces.

</code_context>

<specifics>
## Specific Ideas

- User feel-tested Directions A and B in the spike and chose A ("A feels nice"). North star, verbatim: **"seamless means everything one click away."**
- "both a": **Set Scale = a rail tool**; **Settings/Help = dropped**, replaced by a reserved ⋯/gear button (no content this phase).
- Standing **how-to-manual** requirement: document the new tool/gesture access — the rail tools, the Snap/Arc toggles (+ their F3/Alt/A/Shift+A shortcuts), and where each old-tab action moved (a "what moved where" table).

</specifics>

<deferred>
## Deferred Ideas

- **Settings / Help content** (currency picker, item-library management, keyboard reference) — reserved behind the ⋯ button, not built this phase.
- **Direction B (unified strip)** and **Direction C (floating HUD)** — rejected in the spike.
- **Any new features** — the revamp is layout only; no new tools, measurement types, or persisted data.
- **GAP-002 spikes** — installer (004), PDF-flatten (005), area-cutouts (006) — explicitly backseated by the user for this UX pass.

</deferred>

---

*Phase: 18-toolbar-revamp*
*Context gathered: 2026-07-14 via Spike Express Path (spike 007, Direction A)*
