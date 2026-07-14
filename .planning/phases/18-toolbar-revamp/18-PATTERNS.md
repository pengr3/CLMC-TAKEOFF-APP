# Phase 18: Toolbar Revamp — Seamless One-Click Toolbar - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 8 (4 new · 3 modified · 2 retired)
**Analogs found:** 8 / 8 (every new surface has an in-repo analog — this is a re-home, not a greenfield)

> **Framing:** D-08 makes this a *behavior-parity re-home*. Nearly every handler, disabled-state derivation, badge, and control-seam call the new surfaces need **already exists** in `RibbonToolbar.tsx`. The dominant instruction to the planner: **lift the existing code verbatim onto the new layout; do not re-derive it.** Component names below (`ToolRail` / `TopActionBar` / `ContextBar` / consolidated status line) are proposals — the planner owns the final decomposition (Claude's Discretion, CONTEXT §34-38).

---

## File Classification

| New/Modified File (proposed) | Role | Data Flow | Closest Analog | Match Quality |
|------------------------------|------|-----------|----------------|---------------|
| `components/ToolRail.tsx` (NEW) | component (chrome) | request-response + state-reflecting | `components/RibbonToolbar.tsx` (renderToolsTab) | exact (same handlers) |
| `components/TopActionBar.tsx` (NEW) | component (chrome) | request-response | `RibbonToolbar.tsx` (Home/Page/View tabs) + `Toolbar.tsx` IconButton | exact / role-match |
| `components/ContextBar.tsx` (NEW) | component (chrome) | event-driven (morphs on `activeTool`/selection) | `RibbonToolbar` ChainBadge + `InlineRenameInput` + `MarkupContextMenu` | role-match (composite) |
| consolidated status line (NEW or fold into `StatusBar.tsx`) | component (chrome) | request-response (read-model) | `StatusBar.tsx` + `CanvasHeaderBar.tsx` | exact (merge two existing) |
| `components/RailButton.tsx` / shared tool button (NEW, optional) | component (utility) | request-response | `RibbonButton.tsx` + `Toolbar.tsx` IconButton | exact (styling tokens) |
| `App.tsx` (MODIFIED) | shell / layout | request-response | `App.tsx` (self — current mount + flex row) | exact |
| `components/CanvasHeaderBar.tsx` (MODIFIED) | component (chrome) | request-response (read-model) | self (preserve nudge branch) | exact |
| `components/StatusBar.tsx` (MODIFIED) | component (chrome) | request-response (read-model) | self (snap pill → reflect-only) | exact |
| `components/RibbonToolbar.tsx` (RETIRE) | component | — | — | replaced |
| `components/RibbonButton.tsx` (RETIRE, if `RailButton` supersedes) | component | — | — | replaced |

---

## Shared Patterns

These cross-cut every new surface. Apply them everywhere before per-file specifics.

### S-1. Control seam — module-level refs (NEVER props/store)
**Source:** `src/renderer/src/components/CanvasViewport.tsx:137-186`
**Apply to:** ToolRail (Set Scale), TopActionBar (zoom/fit), ContextBar, status line
The new toolbar calls the **same four module refs** the ribbon calls — do not reinvent the control path (CONTEXT §69-75, locked "Module-level ref pattern" decision).
```typescript
// CanvasViewport.tsx:137-186 — the exported seam
export function getCanvasControls() { return _canvasControls }          // { zoomIn, zoomOut, fitToWindow }
export function getCalibrationControls() { return _calibrationControls } // { activate, activateVerify, cancel }
export function getChainArmedItem(): { name: string; color: string } | null { return _chainArmedItem }
export function setChainArmedFromTotals(payload | null): void { … }      // resume-from-totals arm / disarm
```
Consumption is verbatim from `RibbonToolbar.tsx:187-207`:
```typescript
const handleZoomIn  = (): void => { getCanvasControls()?.zoomIn() }
const handleZoomOut = (): void => { getCanvasControls()?.zoomOut() }
const handleFit     = (): void => { getCanvasControls()?.fitToWindow() }
const handleSetScale = (): void => {
  const controls = getCalibrationControls()
  if (!controls) return
  if (isCalibrating) { controls.cancel() } else { controls.activate() }
}
```

### S-2. Colors + inline styles only — NO Tailwind in the chrome path
**Source:** `src/renderer/src/lib/constants.ts:10-30`
**Apply to:** every new surface (CONTEXT §89 — "COLORS tokens + inline styles only")
```typescript
export const COLORS = {
  dominant: '#1a1a1a', secondary: '#252526', accent: '#0078d4',
  accentHover: '#1a86db', accentActive: '#0067b8', border: '#3c3c3c',
  textPrimary: '#cccccc', textSecondary: '#808080', textOnAccent: '#ffffff',
  hoverSurface: '#2d2d30', activeSurface: '#37373d', titleBar: '#1e1e1e',
  warning: '#e8a838'
} as const
export const LAYOUT = { titleBarHeight: 32, toolbarHeight: 40 /* legacy, unconsumed */, statusBarHeight: 28 } as const
```
> Note: `LAYOUT.toolbarHeight` (line 28) is already flagged legacy/unconsumed — the ribbon governs its own height. The new rail/bar likewise set their own dimensions inline (mockup: rail 56px, top bar 46px, context bar 34px, status 28px). Planner may add rail/bar height tokens here or keep them inline like the ribbon did.

### S-3. Disabled-state derivations — lift verbatim
**Source:** `src/renderer/src/components/RibbonToolbar.tsx:176-183`
**Apply to:** ToolRail (Set Scale + markup tools), TopActionBar (Save/Replace/Export/zoom)
```typescript
const pageScale = totalPages > 0 ? getScale(currentPage) : null
const setScaleDisabled = totalPages === 0
const isCalibrating = calibMode !== 'idle'
const saveDisabled = totalPages === 0 || isSaving
const replaceDisabled = totalPages === 0 || isSaving
const exportDisabled = totalPages === 0 || isSaving || isExporting || !hasMarkups
const currentZoom = totalPages > 0 ? getViewport(currentPage).zoom : 1
// zoom-in disabled: totalPages===0 || currentZoom >= MAX_ZOOM (RibbonToolbar.tsx:509)
// zoom-out disabled: totalPages===0 || currentZoom <= MIN_ZOOM (RibbonToolbar.tsx:516)
```
Store selectors that feed these are the block at `RibbonToolbar.tsx:134-154` — copy that selector block into whichever surface owns the buttons (or a shared parent).

### S-4. Button chrome tokens — active / hover / disabled recipe
**Sources:** `RibbonButton.tsx:44-104` (72×80 column) · `Toolbar.tsx:29-96` (28px row `IconButton`)
**Apply to:** rail buttons use the *column* recipe; top-bar compact buttons use the *row* recipe.
Shared active/hover/disabled logic (identical in both):
```typescript
const baseBackground = active ? COLORS.activeSurface : 'transparent'
// borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent'   ← the active accent underline
// onMouseEnter: if (!disabled && !active) bg = COLORS.hoverSurface
// onMouseLeave: bg = baseBackground
// onMouseDown:  if (!disabled) bg = COLORS.activeSurface
// disabled: opacity 0.4, cursor 'not-allowed', pointerEvents 'none', tabIndex -1
```
Rail button geometry (mockup `.tbtn.railb` 48×46, icon 20, 9px label) vs ribbon's 72×80/icon 20/11px label (`RibbonButton.tsx:55-77`) — planner shrinks to the mockup's rail size but keeps the token recipe. Top-bar icon buttons: `Toolbar.tsx` `IconButton` at `29-96` (height 28, icon `size={16}`, `gap: label ? 4 : 0`) is the exact analog for Page ◀ ▶ / Zoom −/+ / Fit.

---

## Pattern Assignments

### `components/ToolRail.tsx` (component, request-response) — NEW

**Analog:** `src/renderer/src/components/RibbonToolbar.tsx` (renderToolsTab `401-501`)

Rail order (D-02): Select · Count · Linear · Area · Perimeter · Wall — divider — Set Scale — divider — Snap · Arc.

**Tool-arm handler (lift verbatim)** `RibbonToolbar.tsx:214-227`:
```typescript
const handleMarkupToolClick = (tool: 'count'|'linear'|'area'|'perimeter'|'wall'): void => {
  if (activeTool === tool) {
    setChainArmedFromTotals(null)   // ← disarm resume-from-totals when toggling back off (D-08)
    setActiveTool('select')
  } else {
    setActiveTool(tool)
  }
}
const handleSelectTool = (): void => { setActiveTool('select') }
```
Active-tool chrome: `active={activeTool === tool}` (`RibbonToolbar.tsx:406,413,425,…`). Every markup tool except Select carries `disabled={setScaleDisabled}` (`:414`).

**Chain badge — read module ref at render time (Pitfall 6)** `RibbonToolbar.tsx:87-127` + gating `:418-420`:
```typescript
// ChainBadge helper (RibbonToolbar.tsx:87-127) — accent-surface pill, color dot + name, absolute-positioned.
{activeTool === 'count' && getChainArmedItem() !== null && (
  <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
)}
```
Repeat per tool (count/linear/area/perimeter/wall). Reading `getChainArmedItem()` in render is correct — re-renders are driven by `activeTool` changes (CONTEXT §87).

**Set Scale on the rail** `RibbonToolbar.tsx:470-499` — keep `active={isCalibrating}`, `onClick={handleSetScale}`, `onContextMenu={handleContextMenu}`, and the `▾` scale-actions chevron (shown only when `pageScale !== null`). Chevron + right-click both open `ScaleContextMenu` — see S-5 below.

**Snap / Arc toggles** — see S-6 (Snap) and S-7 (Arc, integration risk).

---

### `components/TopActionBar.tsx` (component, request-response) — NEW

**Analog:** `RibbonToolbar.tsx` Home tab (`314-356`), Page tab (`358-399`), View tab (`503-548`), plus `Toolbar.tsx` `IconButton` (`29-96`) for compact icon buttons.

Layout (D-03): **Left** Open · Save · Save As · Replace PDF · Export — **Center** Page ◀ N/M ▶ · Zoom −/%/+ · Fit — **Right** Plan | Estimate · Totals · ⋯/gear.

**Open = accent-primary bespoke button** `RibbonToolbar.tsx:270-312` — Open keeps its distinct accent background (`COLORS.accent`, hover→`accentHover`, down→`accentActive`, text `COLORS.textOnAccent`). Copy `renderOpenButton` and re-shape to the top-bar row geometry. Its `aria-label="Open project or PDF (Ctrl+O)"` is asserted by `toolbar-open-prop.test.ts:68` — preserve it.

**File-ops handlers** `RibbonToolbar.tsx:317-354`: Save→`saveProject()`, Save As→`saveProjectAs()` (both from `useProject`, `:146`), Replace→`onReplaceClick` prop, Export→`onExportClick` prop, with `disabled={saveDisabled|replaceDisabled|exportDisabled}` (S-3). Props come from `App.tsx` (`onOpenClick`/`onReplaceClick`/`onExportClick`) — same prop contract as `RibbonToolbarProps` (`RibbonToolbar.tsx:62-66`).

**Page group** `RibbonToolbar.tsx:358-399`: `prevPage`/`nextPage` (from `useViewerStore`, `:135`), `disabled` at `currentPage === 1` / `currentPage === totalPages`, label `Page {currentPage} of {totalPages}` with `aria-live="polite"` (`:386`). Mockup renders this as `.ib` chevron buttons flanking a read-only label — use `Toolbar.tsx` `IconButton` (`29-96`).

**Zoom group** `RibbonToolbar.tsx:503-525`: `handleZoomIn/Out/Fit` (S-1), disabled via `currentZoom >= MAX_ZOOM` / `<= MIN_ZOOM` (`MIN_ZOOM`/`MAX_ZOOM` from `constants.ts:3-4`). Zoom % read-out: `Math.round(getViewport(currentPage).zoom * 100)` (mirror `StatusBar.tsx:29`).

**Plan | Estimate segmented toggle** `RibbonToolbar.tsx:555-616` — `renderViewModeSegment`. Keep the `role="radiogroup"` wrapper with `data-testid="view-mode-toggle"` and each button's `data-testid={`view-mode-${mode}`}` and `role="radio"` — these testids are asserted by `ribbon-leave-estimating-reveals-plan.test.ts:106,138,141`. Dispatches `setViewMode(mode)` (from `useViewerStore`, `:142`). ⚠ **The GAP-1 reset `useEffect` at `RibbonToolbar.tsx:170-174` must NOT be copied as-is — see Integration Risk R-1.**

**Totals toggle** `RibbonToolbar.tsx:260-262,526-532`: `handleToggleTotals = () => setTotalsOpen(!totals.open)`; `active={totals.open}`. From `useUiPanels()` (`:154`, hook at `hooks/useUiPanels.ts:83-84`).

**⋯/gear overflow button** (D-07) — no analog; reserved, no menu content this phase. Render a disabled-looking/no-op button shaped like the row `IconButton`. Listed under "No Analog Found."

> **Show All / Hide All** (View tab `RibbonToolbar.tsx:533-546`) are NOT in the D-03 top-bar spec. If the planner re-homes them, they **MUST** keep the explicit `markDirty()` calls (Pitfall 7) — see `handleShowAll`/`handleHideAll` at `RibbonToolbar.tsx:242-258`. If dropped, note the reachability loss for behavior-parity review.

---

### `components/ContextBar.tsx` (component, event-driven) — NEW

**Analog (composite):** morph shape from mockup `ctxBar()` (`mockup.html:327-349`); inline-name-edit from `InlineRenameInput.tsx`; recolor/delete from `MarkupContextMenu.tsx` + its callsite `CanvasViewport.tsx:2718-2723`; chain badge from `RibbonToolbar.tsx:87-127`.

Four morph states keyed on `activeTool` + selection (D-04, mockup `mockup.html:328-347`):
1. **Placing a markup tool** (`activeTool !== 'select' && activeTool !== 'scale'`) → item name (inline) + color swatch + Snap/Arc toggles + Chain indicator + "Enter to finish · Esc to cancel" hint.
2. **Set Scale active** (`activeTool === 'scale'` / `isCalibrating`) → calibration hint.
3. **Select + a markup selected** (`selectedMarkupIds.length > 0`) → name / category / Recolor / Delete.
4. **Idle** → short hint.

**Selection source** `viewerStore` — `selectedMarkupIds` (`stores/viewerStore.ts:116-118`: `setSelectedMarkupIds`, `clearSelection`); read in components exactly as `CanvasViewport.tsx:339` does: `const selectedMarkupIds = useViewerStore((s) => s.selectedMarkupIds)`.

**Inline name edit (state 1 & 3)** — reuse `InlineRenameInput.tsx` wholesale. It is an uncontrolled input with **native** blur/Enter/Esc listeners (React-19-safe), commits via `useMarkupStore.getState().renameGroup(currentName, trimmed)`, keeps open on collision (`InlineRenameInput.tsx:57-112`). This is the project's locked inline-edit-commit pattern (MEMORY: `feedback_inline_edit_commit_pattern`). Do NOT hand-roll a controlled input.

**Recolor / Delete (state 3)** — mirror the exact store calls from the right-click menu callsite `CanvasViewport.tsx:2718-2723`:
```typescript
onRecolor: (hex) => useMarkupStore.getState().recolorGroup(contextMarkup.name, hex)   // whole name-group flips (D-29)
onDelete:  ()    => useMarkupStore.getState().deleteMarkup(contextMarkup.page, contextMarkup.id)
```
Palette swatches for Recolor: `MARKUP_PALETTE` (`lib/markup-palette.ts`), rendered as in `MarkupContextMenu.tsx:116-141`. Category chip copy: read via `useMarkupStore.getState().getCategory(categoryId)` (see `CanvasViewport.tsx:2740`).

**Chain indicator (state 1)** — same `getChainArmedItem()` read as the rail (S-1 / RibbonToolbar ChainBadge). Context-bar Snap/Arc toggles mutate the **same** state as the rail toggles (D-04) — see S-6 / S-7.

Context-bar visual tokens (tags, `.cinput`, `.mini` pill toggles, `.cbtn`/`.cbtn.danger`) are specified in `mockup.html` CSS `76-95` — reference for spacing/colors; translate to inline `COLORS` styles.

---

### Consolidated status line (fold `StatusBar.tsx` + `CanvasHeaderBar.tsx`) — MODIFIED / NEW

**Analogs:** `StatusBar.tsx` (full) + `CanvasHeaderBar.tsx` (full). Page + scale are printed by BOTH today (D-06) — collapse to one line. Whether it sits top or bottom is a planner call (CONTEXT §36).

**Fields to carry (from `StatusBar.tsx:20-128`):** filename (`:78-87`, max-width 300 ellipsis), `Page {currentPage} of {totalPages}` (`:92-94`), `Zoom: {zoomPct}%` (`:99`, `zoomPct = Math.round(getViewport(currentPage).zoom * 100)` `:29`), and `Scale:` via `formatScaleRatio(pageScale.pixelsPerMm)` (`:58-60`, `lib/scale-math`). Em-dash fallbacks when `totalPages === 0`.

**Snap: reflect-only (D-05)** `StatusBar.tsx:32-47,110-128` — the three-branch snap read-out (OFF amber / held-off dimmed / ON textPrimary + accent dot) **stays as a status reflection**, but the interactive toggle role moves to the rail/context bar. Keep reading `snapEnabled`/`snapSuspended` from `viewerStore` (`:25-26`).

**PRESERVE the calibration nudge** `CanvasHeaderBar.tsx:53-80` (D-06, non-negotiable) — the three-branch right segment, specifically branch (c): uncalibrated + has non-count markups → amber "Page not calibrated." + underlined accent "Set Scale" link that calls `getCalibrationControls()?.activate()`:
```typescript
const hasNonCountMarkups = pageMarkups.some((m) => m.type !== 'count')   // CanvasHeaderBar.tsx:51
// branch (c): CanvasHeaderBar.tsx:64-79
<span style={{ color: COLORS.warning }}>Page not calibrated.{' '}
  <span onClick={() => getCalibrationControls()?.activate()}
        style={{ color: COLORS.accent, textDecoration: 'underline', cursor: 'pointer' }}>Set Scale</span>
</span>
```
Note the `EMPTY_MARKUPS` stable-reference guard (`CanvasHeaderBar.tsx:31,37`) — a fresh `[]` literal in a Zustand selector breaks `useSyncExternalStore` and infinite-loops. Carry it over if the merged line reads the per-page markup slice.

---

### `App.tsx` (shell / layout) — MODIFIED

**Analog:** self — current mount + flex shell (`App.tsx:310-508`).

Current structure to rework:
- **Mount point** `App.tsx:313-317` — `<RibbonToolbar onOpenClick onReplaceClick onExportClick />` between `<TitleBar/>` (`:312`) and `<main>` (`:318`). Replaced by `<TopActionBar/>` + `<ContextBar/>` (top bar + context sub-bar); the **rail becomes a new column inside the stage row**.
- **Stage row** `App.tsx:318-337` — `<main>` is `display:flex; flexDirection:row`. Add the `ToolRail` as the **first child** of this row (left of the center Plan/Estimate region), alongside the existing `TotalsPanel`/`Splitter` (`:481-506`). Keep `minWidth: 0` floors on the flex children (`:337,343-349`).
- **Status line** `<StatusBar />` at `App.tsx:508` — replace/consolidate per D-06.
- **Preserve all prop wiring** — `handleOpenClick`/`handleReplaceClick`/`handleExportClick` (`:189-260`) and the resume-from-totals `handleArmTool` (`:266-297`, `onArmTool={handleArmTool}` at `:503`). These are unchanged; only the components that receive them move.
- **Mount-preserving view swap** `App.tsx:329-477` — the Plan subtree and Estimate subtree are BOTH always mounted, gated by `display: viewMode === 'plan'/'estimate'` (Pitfall 1 — never conditionally unmount the Konva `CanvasViewport`). The rail must live **outside** this display-gated swap so it stays visible in both Plan and Estimate views (or the planner decides rail visibility per view — call it out).

---

## Integration Risks (call these out to the planner — CONTEXT §37, §91)

### R-1. GAP-1 `viewMode` reset effect loses its trigger (the trickiest parity item)
**Source of the coupling:** `RibbonToolbar.tsx:170-174`
```typescript
useEffect(() => {
  if (activeTab !== 'estimating' && viewMode === 'estimate') { setViewMode('plan') }
}, [activeTab, viewMode, setViewMode])
```
With tabs removed, `activeTab` no longer exists — this effect has nothing to key on. Estimate becomes a **standalone `viewMode` toggle** (Plan|Estimate on the top bar) with no tab to "leave." The planner must **delete or rework** this effect deliberately, and **migrate `ribbon-leave-estimating-reveals-plan.test.ts`** — its premise ("leaving the Estimating tab reveals Plan") is void; replace with tests asserting the standalone toggle flips `viewMode` both directions and Estimate no longer auto-resets. The four testids the test uses (`view-mode-toggle`, `view-mode-plan`, `view-mode-estimate`) should be preserved on the new segmented control so parity tests can re-point.

### R-2. Arc toggle has no readable on-state source
**Source:** `lib/markup-arc-ref.ts:15-32` + `hooks/useKeyboardShortcuts.ts:208-226`
Snap is clean: `viewerStore.snapEnabled`/`snapSuspended` are readable booleans with a `setSnapEnabled` setter (see S-6). **Arc is not.** The arc-mode flags (`arcHeld` one-off, `arcMode` sticky) live in `useMarkupTool`'s React state, exposed only through module-ref **handlers** — `getArcStickyToggleHandler()` (toggles) and `getArcHeldHandler()` (sets hold). There is **no getter** for the current arc-on boolean. A rail/context "Arc" toggle that must render its on-state (D-02/D-04) needs a **new readable source** (e.g. lift sticky-arc into `viewerStore`, or add a `getArcSticky()` module ref mirroring `getChainArmedItem`). Flag for research/planner; the Snap toggle can ship without this, Arc cannot show state without it.

---

## Established Patterns to Respect (do not regress)

| Pattern | Source | Note |
|---------|--------|------|
| Module-ref control seam | `CanvasViewport.tsx:137-186` | Call the same 4 refs — never props/store (CONTEXT §69-75) |
| Chain badge read at render | `RibbonToolbar.tsx:418-420` | `getChainArmedItem()` in render is correct (Pitfall 6) |
| `setHiddenItemNames` ≠ `markDirty` | `RibbonToolbar.tsx:242-258` | Show/Hide All handlers call `markDirty()` explicitly (Pitfall 7) |
| COLORS + inline styles, no Tailwind | `constants.ts` + all chrome | CONTEXT §89 |
| Snap flags runtime-only | `viewerStore.ts:22-26` | Never serialized to `.clmc` (Phase 14) |
| Uncontrolled inline-edit commit | `InlineRenameInput.tsx:57-112` | Native blur/Enter listeners; commit on blur/Enter not per-keystroke (MEMORY) |
| Stable EMPTY_MARKUPS selector ref | `CanvasHeaderBar.tsx:31` | Fresh `[]` in Zustand selector infinite-loops |

## S-5. Set Scale context menu wiring (rail)
**Sources:** `RibbonToolbar.tsx:209-239,734-748` + `ScaleContextMenu.tsx`
Keep on the rail Set Scale button (D-02). Open on `▾` chevron click (`handleChevronClick` `:235-239`) OR right-click (`handleContextMenu` `:229-233`), both guarded by `setScaleDisabled || pageScale === null` (`:209-212`). Menu callbacks call the calibration seam:
```typescript
onRecalibrate={() => getCalibrationControls()?.activate()}
onVerify={()   => getCalibrationControls()?.activateVerify()}
onClose={()    => setContextMenu(null)}
```
`ScaleContextMenu.tsx` itself is reusable as-is (fixed positioning, outside-click + Escape dismissal, Recalibrate / Verify items).

## S-6. Snap toggle wiring
**Source:** `useKeyboardShortcuts.ts:187-191` (F3 path) + `viewerStore.ts:124`
Clickable Snap toggle mirrors the F3 keybinding:
```typescript
const { snapEnabled, setSnapEnabled } = useViewerStore.getState()
setSnapEnabled(!snapEnabled)   // viewerStore.ts:124 — setSnapEnabled: (enabled) => set({ snapEnabled: enabled })
```
On-state for the toggle chrome: read `snapEnabled` (and optionally `snapSuspended` for a held-off visual) as `StatusBar.tsx:38-47` does. Shortcuts F3 / Alt (suspend) remain wired in `useKeyboardShortcuts.ts` — unchanged (D-05).

## S-7. Arc toggle wiring
**Source:** `markup-arc-ref.ts:26-32` + `useKeyboardShortcuts.ts:208-226`
Sticky-arc toggle click mirrors Shift+A: `getArcStickyToggleHandler()?.()`. **But see Integration Risk R-2** — no readable on-state exists yet; the toggle cannot render its active chrome until a readable source is added. A / Shift+A shortcuts remain wired — unchanged (D-05).

---

## No Analog Found

| File / element | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| ⋯/gear overflow button | control (chrome) | request-response | D-07 reserves it with NO content this phase — no menu/panel exists to model. Render an inert button shaped like `Toolbar.tsx` `IconButton` (`29-96`); wire nothing. |
| Arc toggle **on-state read** | state source | — | No readable arc-sticky boolean exists (R-2). Needs a new source (viewerStore field or module-ref getter) — no direct analog; `getChainArmedItem()` (`CanvasViewport.tsx:155-157`) is the closest shape to mirror for a new `getArcSticky()`. |

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/stores/`, `src/renderer/src/hooks/`, `src/renderer/src/lib/`, `src/tests/`
**Files scanned:** RibbonToolbar, RibbonButton, Toolbar (legacy IconButton), CanvasHeaderBar, StatusBar, ScaleContextMenu, MarkupContextMenu, InlineRenameInput, CanvasViewport (control seam + selection + recolor callsite), App.tsx, viewerStore, useUiPanels, markup-arc-ref, useKeyboardShortcuts, constants; tests: ribbon-leave-estimating-reveals-plan, toolbar-open-prop
**Pattern extraction date:** 2026-07-14
