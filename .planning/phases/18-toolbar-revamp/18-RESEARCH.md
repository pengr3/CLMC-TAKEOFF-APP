# Phase 18: Toolbar Revamp — Seamless One-Click Toolbar - Research

**Researched:** 2026-07-14
**Domain:** React/Electron renderer UI recomposition (chrome refactor) — no new domain tech
**Confidence:** HIGH (grounded entirely in the phase's own source, read at file:line)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (spike 007, Direction A + user "both a")
- **D-01 (kill the tabs):** Remove the 7-tab strip and the mode-gated single-panel ribbon entirely. Tool palette + canvas navigation co-visible at all times. Direction B (unified strip) and C (floating HUD) rejected.
- **D-02 (left tool rail — persistent):** Vertical rail on the left edge holds top-to-bottom: **Select · Count · Linear · Area · Perimeter · Wall** — divider — **Set Scale** — divider — **Snap · Arc** toggles. Active tool shows accent-filled active chrome; Snap/Arc show their on-state. Icon + small label (lucide-react). **Set Scale lives on the rail as a tool** and keeps its right-click recalibrate/verify menu (`ScaleContextMenu`) and the `▾` scale-actions affordance.
- **D-03 (top action bar — persistent):** Left group = **Open · Save · Save As · Replace PDF · Export** (Open keeps accent-primary styling). Center = **Page ◀ N/M ▶** and **Zoom −/%/+ · Fit**. Right = **Plan | Estimate** segmented toggle · **Totals** toggle · a reserved **⋯/gear** overflow button.
- **D-04 (context sub-bar — morphs with state):** thin bar under the top action bar:
  - *placing a markup tool* → chain **item name** (inline) + **color** swatch + **Snap/Arc** toggles + **Chain** indicator + "Enter to finish · Esc to cancel" hint
  - *Select tool + a markup selected* → **name / category / Recolor / Delete**
  - *Set Scale active* → the calibration hint
  - *idle* → a short hint
  Snap/Arc appear **both** on the rail and here (both mutate the same `viewerStore` state).
- **D-05 (Snap/Arc become controls):** clickable toggles, not keyboard-only. Existing shortcuts still work: **F3** (snap on/off), **Alt** (snap suspend-while-held), **A** (one-off arc), **Shift+A** (sticky arc). The bottom `StatusBar` read-only snap **pill** is retired in favor of rail/context toggles; the consolidated status line still *reflects* snap state.
- **D-06 (chrome consolidation):** Page + scale printed **twice** today (`CanvasHeaderBar` top 28px + `StatusBar` bottom 28px). Fold into **one** status line. **Preserve** `CanvasHeaderBar`'s "Page not calibrated → Set Scale" nudge. Top vs bottom is a planner/research call.
- **D-07 (Settings/Help removal, choice a):** Two "Coming soon" stub tabs removed with the tab strip; a reserved **⋯/gear** button reserves the future home. **No** Settings/Help content built this phase.
- **D-08 (behavior parity — non-negotiable):** Every existing capability stays reachable and byte-identical — chain mode + chain badges, resume-from-totals arming (`setChainArmedFromTotals`), Set Scale calibration entry (`getCalibrationControls`), zoom/fit/pan (`getCanvasControls`), Plan|Estimate view switch (`viewMode`), Totals toggle (`useUiPanels`), and all disabled-state logic (no PDF / saving / exporting / no markups). All keyboard shortcuts unchanged.

### Claude's Discretion / for research + planner
- **Component decomposition** — replace `RibbonToolbar.tsx` with new components vs refactor in place; how `App.tsx`'s flex shell adds the left rail as a stage-row column; how/whether `RibbonButton.tsx` + tab-strip code + tests are retired.
- **Status-line home** — top vs bottom. Eliminate the duplication either way.
- **The Phase-16 `viewMode` reset coupling** — with tabs gone, the `useEffect` resetting `viewMode` to 'plan' when leaving the Estimating **tab** loses its trigger. Rework what replaces it. **Integration risk — call it out.**
- **Rail width, icon choices, label show/hide, ⋯-button shape**, and the exact visual tokens (reuse `COLORS` + the spike mockup as the reference).

### Deferred Ideas (OUT OF SCOPE)
- **Settings / Help content** (currency picker, item-library management, keyboard reference) — reserved behind ⋯, not built this phase.
- **Direction B (unified strip)** and **Direction C (floating HUD)** — rejected.
- **Any new features** — layout only; no new tools, measurement types, or persisted data.
- **GAP-002 spikes** — installer (004), PDF-flatten (005), area-cutouts (006) — backseated.
</user_constraints>

<phase_requirements>
## Phase Requirements

No new v1 requirement IDs (UX / quality-of-life per ROADMAP.md:687). The acceptance bar is **behavior parity + the 6 Success Criteria** in ROADMAP.md Phase 18 (lines 690–698). Mapped to research support:

| SC | Behavior | Research Support |
|----|----------|------------------|
| SC-1 | 7-tab ribbon gone; tool palette + canvas nav co-visible, each one click | Component Decomposition §; ToolRail + TopActionBar replace `RibbonToolbar.tsx:660-732` |
| SC-2 | Persistent left rail: Select·Count·Linear·Area·Perimeter·Wall·Set Scale·Snap·Arc; active tool + Snap/Arc states always visible | ToolRail spec; Snap read seam (`viewerStore:25`), Arc read seam (NEW — Pitfall 1) |
| SC-3 | Snap/Arc clickable toggles; F3/Alt/A/Shift+A still work; bottom pill no longer read-only | Snap/Arc Control Wiring §; shortcuts live in `useKeyboardShortcuts.ts:183-307` (toolbar-independent) |
| SC-4 | Context sub-bar morphs (placing / selected / idle); chain + edit behaviors preserved | ContextBar spec; selection in `viewerStore.selectedMarkupIds`; edit via `markupStore.editMarkup/recolorGroup/deleteMarkup` |
| SC-5 | Page+scale chrome consolidated to one line preserving the calibration nudge; Plan|Estimate + Totals + file ops reachable; Settings/Help → ⋯ | Chrome Consolidation §; retain `StatusBar` position, fold `CanvasHeaderBar:57-80` nudge |
| SC-6 | Shortcuts, chain, resume-from-totals, calibration all work; suite passes; how-to-manual updated | Behavior-Parity Inventory §; Validation Architecture §; Manual Notes § |
</phase_requirements>

## Summary

This is a **pure recomposition** of the renderer's chrome. Nothing under the toolbar changes: markup math, the BOQ/pricing pipeline, the `.clmc` format, the Konva canvas, and every store are untouched. The work is **re-homing** the handlers that currently live in one file (`RibbonToolbar.tsx`, 751 lines) onto three new co-visible surfaces — a left **ToolRail**, a **TopActionBar**, and a morphing **ContextBar** — plus consolidating two duplicated 28px status strips into one.

The single most important architectural fact: **the toolbar talks to the canvas through module-level ref getters exported by `CanvasViewport.tsx`** (`getCanvasControls`, `getCalibrationControls`, `getChainArmedItem`, `setChainArmedFromTotals` — lines 137-186), not through props or a store. Every new surface must call these **same** getters. Re-inventing the control path is the one way this refactor can silently break.

Two genuine integration risks surfaced, both flagged inline:
1. **The Phase-16 `viewMode`-reset `useEffect`** (`RibbonToolbar.tsx:170-174`) keys on a tab that will no longer exist. The correct fix is to **delete it outright** — with a standalone Plan|Estimate toggle there is no "leaving a tab" event, so no reset is needed. The App shell already does the mount-preserving `display` swap on `viewMode` (`App.tsx:341-476`).
2. **The Arc toggle has no read seam.** Snap state is readable (`viewerStore.snapEnabled`), but Arc state (`arcMode`/`arcHeld`) lives inside `useMarkupTool`'s local React state and is only exposed as *setter* handlers via `markup-arc-ref.ts`. To render Arc's on-state (D-02/D-05), a **new read seam** must be published.

**Primary recommendation:** Create three new components (`ToolRail`, `TopActionBar`, `ContextBar`) + one consolidated status line (retain `StatusBar` at the bottom, delete `CanvasHeaderBar` and fold its nudge in). Delete `RibbonToolbar.tsx`, `RibbonButton.tsx`, and the dead legacy `Toolbar.tsx`. Reuse `COLORS` tokens + inline styles only; reuse `lucide-react` icons; call the existing `CanvasViewport` module refs verbatim. Add a single Arc read seam (`getArcSticky()` in `markup-arc-ref.ts`) mirroring the Snap pattern.

## Architectural Responsibility Map

Single-tier Electron **renderer** app (React). No API/DB/CDN tiers. Capabilities map to renderer sub-systems; persistence/export are the only capabilities that cross into the **main process** via IPC.

| Capability | Primary Owner | Secondary | Rationale |
|------------|---------------|-----------|-----------|
| Tool selection / arming | Renderer — `viewerStore.activeTool` / `setActiveTool` | `CanvasViewport.setChainArmedFromTotals` | Tool state is pure UI state; chain arming rides the module ref |
| Zoom / pan / fit | Renderer — `CanvasViewport` module ref `getCanvasControls()` | — | Konva Stage owns transform; toolbar only triggers |
| Scale calibration entry | Renderer — `getCalibrationControls()` | `ScaleContextMenu` | Spatial gesture on canvas; toolbar is a trigger surface only |
| Chain-armed badge read | Renderer — `getChainArmedItem()` (read at render) | — | Module ref read in render path (Pitfall 6) |
| Plan / Estimate view mode | Renderer — `viewerStore.viewMode` / `setViewMode` | `App.tsx` display swap | Store field IS React state; App reveals the matching subtree |
| Snap state | Renderer — `viewerStore.snapEnabled/snapSuspended` | `useKeyboardShortcuts` (F3/Alt) | Runtime-only, never serialized (`viewerStore:22-26`) |
| Arc state | Renderer — `useMarkupTool` local state (arcMode/arcHeld) | `markup-arc-ref.ts` handlers | **No read seam today** — Pitfall 1 |
| Totals panel visibility | Renderer — `useUiPanels.totals.open` / `setTotalsOpen` | localStorage `clmc.ui` | Workstation preference, not project data |
| Save / Save As / Export / Replace | Renderer→**Main** via `useProject` / `useExport` (`window.api`) | `App.tsx` handlers | Only capabilities that cross the IPC boundary |
| Show All / Hide All | Renderer — `projectStore.setHiddenItemNames` + `markDirty()` | — | Must call `markDirty()` explicitly (Pitfall 7) |

## Standard Stack

No new libraries. Everything needed already ships in the project.

### Core (already installed — reused, not added)
| Library | Version (in repo) | Purpose here | Why standard |
|---------|-------------------|--------------|--------------|
| React | 19.x | The three new surfaces are React components | Project framework |
| lucide-react | already a dep | Rail/bar/context icons (`FileUp`, `MapPin`, `Ruler`, `Magnet`, etc.) | Already imported by `RibbonToolbar.tsx:2-23`; no install needed |
| Zustand | 5.x | Reads `viewerStore`/`scaleStore`/`projectStore`/`markupStore` | Existing state layer |

### Supporting (project-internal modules — the real "stack" for this phase)
| Module | Location | Purpose |
|--------|----------|---------|
| `COLORS`, `MIN_ZOOM`, `MAX_ZOOM` | `lib/constants.ts:1-24` | The only styling tokens allowed (no Tailwind in chrome) |
| Module control refs | `CanvasViewport.tsx:137-186` | `getCanvasControls` / `getCalibrationControls` / `getChainArmedItem` / `setChainArmedFromTotals` |
| `ScaleContextMenu` | `components/ScaleContextMenu.tsx` | Recalibrate / Verify menu — reuse verbatim |
| `markup-arc-ref.ts` | `lib/markup-arc-ref.ts` | Arc setter handlers; **add a getter here** |
| `useUiPanels` | `hooks/useUiPanels.ts` | Totals open/close |
| `useProject` / `useExport` | `hooks/` | Save / Save As / Export IPC |

**Installation:** None. `lucide-react` is already resolved (imported at `RibbonToolbar.tsx:2`). No `npm install` step in any plan for this phase.

## Package Legitimacy Audit

**No external packages are installed in this phase.** Every dependency (`react`, `lucide-react`, `zustand`) is already present and battle-tested in the running app. The Package Legitimacy Gate is **N/A** — there is nothing to slopcheck. If the planner discovers a need for a new icon/util package, that is a scope violation (CONTEXT "no new npm packages") and must be rejected, not added.

## Architecture Patterns

### System Architecture Diagram (data/control flow, not files)

```
                         ┌────────────────────────────────────────────┐
  keyboard  ───F3/Alt───▶│  useKeyboardShortcuts (global window keydn) │
  (unchanged) A/Shift+A  │  Ctrl+O/S/Shift+S/Shift+E, arrows, Ctrl+0   │
                         └───────┬───────────────────┬────────────────┘
                                 │ setSnapEnabled     │ getCanvasControls()?.zoomIn()…
                                 ▼                    ▼
   ┌──────────┐   click    ┌─────────────┐    ┌──────────────────────────────┐
   │ ToolRail │──setActive─▶│ viewerStore │◀───│ CanvasViewport (Konva Stage) │
   │ (tools + │──Tool──────▶│ activeTool  │    │  MODULE REFS (the seam):     │
   │ Snap/Arc │             │ viewMode    │    │   getCanvasControls()        │
   │ Set Scale│──getCalib──▶│ snapEnabled │───▶│   getCalibrationControls()   │
   └────┬─────┘  Controls() └─────────────┘    │   getChainArmedItem()        │
        │                                       │   setChainArmedFromTotals()  │
        │ getArcSticky() (NEW read seam)        │   getArcSticky() (NEW)       │
        ▼                                       └──────────────┬───────────────┘
   ┌───────────┐  setViewMode / setTotalsOpen                  │ renders
   │TopActionBar│─────────────────────┐                        ▼
   │ file ops   │──props/hooks──▶ useProject / useExport ──IPC──▶ main process
   │ page/zoom  │──getCanvasControls / prevPage/nextPage        (save / export / replace)
   │ Plan|Est   │──setViewMode──┐
   │ Totals · ⋯ │               │
   └───────────┘               ▼
   ┌───────────┐        ┌──────────────┐   viewMode='plan'  → Plan subtree visible
   │ ContextBar│        │  App.tsx     │   viewMode='estimate' → Estimate subtree visible
   │ morphs on │◀───────│ display swap │   (BOTH always mounted — Stage never unmounts)
   │ tool/sel  │  reads  │ on viewMode  │
   └─────┬─────┘        └──────────────┘
         │ selected markup → editMarkup / recolorGroup / deleteMarkup
         ▼
   ┌─────────────┐
   │ markupStore │  (chain, rename, recolor, delete — all EXISTING operations)
   └─────────────┘

   ┌──────────────────────────── ONE consolidated status line (bottom) ───────────────┐
   │ filename · Page N/M · Zoom% · Scale (3-branch nudge) · Snap (reflect only)        │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/renderer/src/components/
├── ToolRail.tsx        # NEW — vertical rail: 6 tools + Set Scale + Snap/Arc toggles
├── TopActionBar.tsx    # NEW — file ops · page · zoom/fit · Plan|Estimate · Totals · ⋯
├── ContextBar.tsx      # NEW — morphing sub-bar (placing / selected / scale / idle)
├── StatusLine.tsx      # NEW or RENAMED StatusBar — the single consolidated line
├── ToolRailButton.tsx  # NEW (optional) — rail button variant (carries RibbonButton tokens)
├── ScaleContextMenu.tsx    # KEEP verbatim — reused by ToolRail Set Scale
├── RibbonToolbar.tsx   # DELETE
├── RibbonButton.tsx    # DELETE (tokens migrate into ToolRailButton / bar buttons)
├── CanvasHeaderBar.tsx # DELETE — nudge folds into StatusLine
└── Toolbar.tsx         # DELETE — dead legacy code (only tests import it)
```

### Pattern 1: Call the canvas through the existing module refs (do NOT reinvent)
**What:** All zoom/fit/calibration/chain actions dispatch through `CanvasViewport`'s module-level getters. This is a *locked* project decision ("Module-level ref pattern for canvas controls", STATE.md:104).
**When to use:** Every zoom, fit, Set Scale, and chain-badge read on the new surfaces.
**Example (verbatim from the code being re-homed):**
```typescript
// Source: RibbonToolbar.tsx:187-207 — carry these bodies UNCHANGED into the new surfaces
const handleZoomIn = (): void => { getCanvasControls()?.zoomIn() }
const handleFit   = (): void => { getCanvasControls()?.fitToWindow() }
const handleSetScale = (): void => {
  const controls = getCalibrationControls()
  if (!controls) return
  if (isCalibrating) controls.cancel()
  else controls.activate()
}
```

### Pattern 2: Chain badge read at render time (Pitfall 6)
**What:** The chain-armed chip is gated on `activeTool === tool && getChainArmedItem() !== null`, read *during render*. Re-renders are driven by `activeTool` changes, so reading the module ref in the render path is correct (`RibbonToolbar.tsx:51-59, 418-420`).
**Example:**
```typescript
// Source: RibbonToolbar.tsx:418-420 — same gate on the new rail button
{activeTool === 'count' && getChainArmedItem() !== null && (
  <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
)}
```

### Pattern 3: Standalone Plan|Estimate toggle (replaces the tab-coupled reset)
**What:** Two `role="radio"` buttons dispatching `setViewMode('plan'|'estimate')`. The App shell already swaps the visible subtree on `viewMode` via CSS `display` while keeping both mounted (`App.tsx:341-476`).
**When to use:** In the TopActionBar right group.
**Example:**
```typescript
// Source: RibbonToolbar.tsx:555-587 — carry the segment renderer over; keep the
// data-testid="view-mode-plan|estimate" hooks so tests remain addressable.
onClick={() => setViewMode(mode)}   // NO reset useEffect — see Pitfall 2
```

### Pattern 4: markDirty() after visibility mutation (Pitfall 7)
```typescript
// Source: RibbonToolbar.tsx:242-258 — setHiddenItemNames does NOT markDirty internally.
const handleShowAll = (): void => {
  useProjectStore.getState().setHiddenItemNames([])
  useProjectStore.getState().markDirty()          // ← MUST stay
}
```

### Anti-Patterns to Avoid
- **Reinventing the control path** — do not add props or a new store for zoom/calibration; use the module refs (STATE.md:104).
- **Conditionally unmounting the Konva Stage** — the ToolRail is a *sibling* column added to the `<main>` row; the center subtree (CanvasViewport) must not be restructured (`App.tsx:329-336` Pitfall 1 comment: a `{viewMode==='plan' ? … : …}` around the Stage tears it down and re-rasterizes).
- **Fresh `[]` inside a Zustand selector** — breaks `useSyncExternalStore` snapshot equality; use module-scope `EMPTY_MARKUPS` (`CanvasViewport.tsx:55-58`, `CanvasHeaderBar.tsx:31`).
- **Dropping `markDirty()`** on Show/Hide All (Pitfall 7).
- **Tailwind or raw hex in chrome** — `COLORS` tokens + inline styles only (STATE.md; CONTEXT D-06 note).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zoom / fit / pan | A new zoom API or store | `getCanvasControls()` (`CanvasViewport.tsx:137-139`) | The Stage transform lives in the canvas; the ref is the contract |
| Set Scale entry / cancel | New calibration trigger | `getCalibrationControls()` (`:148-150`) | Duplicating the trigger is exactly what `CanvasHeaderBar` was forbidden from doing (STATE.md:151) |
| Recalibrate / Verify menu | New popup | `ScaleContextMenu.tsx` verbatim | Already handles outside-click + Escape + positioning |
| Chain badge | New arming state | `getChainArmedItem()` read at render | Runtime chain state deliberately kept off the store (STATE.md:159) |
| Resume-from-totals arming | New wiring | `setChainArmedFromTotals()` (`:166-186`), called BEFORE `setActiveTool` (`App.tsx:288-296`) | Ordering is load-bearing (07.1 research) |
| Markup rename / recolor / delete (context bar) | New edit logic | `markupStore.editMarkup` (`:810`) / `recolorGroup` (`:513`) / `deleteMarkup` (`:486`); palette from `MARKUP_PALETTE` | All exist; `MarkupContextMenu.tsx` already renders the recolor swatch row |
| Inline rename input | Controlled per-keystroke input | Uncontrolled input, commit on blur/Enter, guard the seed effect with `document.activeElement` | Documented project landmine (MEMORY `feedback_inline_edit_commit_pattern`; Phase-16 CR-01) |
| Totals open/close | New toggle state | `useUiPanels.setTotalsOpen` (`RibbonToolbar.tsx:154,260-262`) | Persists to `clmc.ui` localStorage |
| Snap state | New snap flag | `viewerStore.snapEnabled` + `setSnapEnabled` (`viewerStore:25,124`) | Single source; StatusBar already reflects it |
| Keyboard shortcuts | Re-binding in the toolbar | Nothing — `useKeyboardShortcuts.ts` is toolbar-independent | Shortcuts survive the swap automatically (see Behavior-Parity §) |

**Key insight:** For this phase, "don't hand-roll" means "don't re-implement anything the ribbon already calls." The ribbon is a thin dispatch layer over stores + module refs; the new surfaces are a *different arrangement of the same dispatch calls*. Any new logic (beyond the Arc read seam and the ContextBar's selected-markup panel) is a red flag.

## Behavior-Parity Inventory (the core of this phase)

Every handler / derived state in `RibbonToolbar.tsx` and where it re-homes. Carry bodies **verbatim** unless noted.

| # | Behavior (source) | Current line(s) | New home | Notes |
|---|-------------------|-----------------|----------|-------|
| P1 | `handleSelectTool` → `setActiveTool('select')` | 225-227 | **ToolRail** — Select button | verbatim |
| P2 | `handleMarkupToolClick(tool)` → arm, or toggle back to select + `setChainArmedFromTotals(null)` | 214-223 | **ToolRail** — Count/Linear/Area/Perimeter/Wall | verbatim; keeps disarm-on-retap |
| P3 | Chain badge gate `activeTool===tool && getChainArmedItem()!==null` | 418-469 | **ToolRail** buttons (badge) + **ContextBar** chain indicator | read at render (Pitfall 6) |
| P4 | `handleSetScale` activate/cancel | 199-207 | **ToolRail** — Set Scale button (`active={isCalibrating}`) | via `getCalibrationControls()` |
| P5 | `handleContextMenu` (right-click) + `handleChevronClick` (▾) → open `ScaleContextMenu` | 209-239 | **ToolRail** — Set Scale button `onContextMenu` + a `▾` affordance | gated on `!setScaleDisabled && pageScale!==null` |
| P6 | `ScaleContextMenu` render + Recalibrate→`activate()` / Verify→`activateVerify()` | 734-748 | rendered by **ToolRail** (or a small `useScaleActionsMenu` hook) | verbatim callbacks |
| P7 | `handleZoomIn` / `handleZoomOut` / `handleFit` | 187-197 | **TopActionBar** — center zoom group | via `getCanvasControls()` |
| P8 | Zoom disabled derivations (`currentZoom>=MAX_ZOOM`, `<=MIN_ZOOM`, `totalPages===0`) | 509,516,523 | **TopActionBar** | reads `getViewport(currentPage).zoom` (`:183`) |
| P9 | Page prev/next + "Page N of M" | 358-399 | **TopActionBar** — center page group | `prevPage`/`nextPage` from `viewerStore`; disabled at bounds |
| P10 | Open (accent-primary), Save, Save As, Replace PDF, Export | 270-356 | **TopActionBar** — left file group | Open keeps accent styling (`COLORS.accent`); props `onOpenClick/onReplaceClick/onExportClick` still wired from App |
| P11 | Disabled derivations `saveDisabled` / `replaceDisabled` / `exportDisabled` / `setScaleDisabled` | 177-181 | **TopActionBar** (+ ToolRail for setScaleDisabled) | copy derivations verbatim; depend on `totalPages/isSaving/isExporting/hasMarkups` |
| P12 | `handleToggleTotals` → `setTotalsOpen(!totals.open)` | 260-262 | **TopActionBar** — Totals toggle | `active={totals.open}` |
| P13 | Plan\|Estimate segment (`renderViewModeSegment`) | 555-604 | **TopActionBar** — right segment | keep `data-testid="view-mode-plan|estimate"` + `view-mode-toggle` group |
| P14 | **viewMode reset `useEffect`** | 170-174 | **DELETE** (see Pitfall 2) | no tab → no trigger; standalone toggle is self-consistent |
| P15 | `handleShowAll` / `handleHideAll` (both call `markDirty()`) | 242-258 | **⋯ overflow menu** (recommended) OR TopActionBar secondary | **no home in the spike mockup** — see Open Questions; MUST retain `markDirty()` (Pitfall 7) |
| P16 | Settings / Help stub tabs | 618-630, 651-654 | **REMOVED**; reserved **⋯/gear** button (no content) | D-07 |
| P17 | Snap toggle (NEW control) | — (pill is read-only today, `StatusBar.tsx:110-128`) | **ToolRail** + **ContextBar** | reads `snapEnabled`; click → `setSnapEnabled(!snapEnabled)` |
| P18 | Arc toggle (NEW control) | — | **ToolRail** + **ContextBar** | click → `getArcSticky…toggle`; **needs NEW read seam** (Pitfall 1) |
| P19 | ContextBar "selected markup" panel: name / category / Recolor / Delete | — (canvas-only today) | **ContextBar** | reads `selectedMarkupIds` (`viewerStore:116`), dispatches existing `markupStore` ops; canvas edit popup + right-click menu REMAIN (additive) |
| P20 | Resume-from-totals arming (`handleArmTool`) | `App.tsx:266-297` | **unchanged** in App.tsx | not in the toolbar; keep wiring intact |
| P21 | Keyboard shortcuts (F3/Alt/A/Shift+A, Ctrl+O/S/Shift+S/Shift+E, arrows, Ctrl+0/±) | `useKeyboardShortcuts.ts` | **unchanged** | toolbar-independent; survive automatically |

### Chrome Consolidation detail (D-06)
Two components print page + scale today:
- **`CanvasHeaderBar.tsx`** (top, 28px, inside the Plan subtree): page label (left) + scale status (right) with the **3-branch** nudge (`:57-80`): (a) calibrated → `1:N`; (b) uncalibrated + only count markups → "Not Set" (silent); (c) uncalibrated + has non-count markups → "Page not calibrated. **Set Scale**" link calling `getCalibrationControls()?.activate()` (`:69`).
- **`StatusBar.tsx`** (bottom, 28px, full-width, always mounted): filename · page · zoom% · scale · **snap pill** (`:110-128`).

**Recommendation:** keep **one bottom line** (retain `StatusBar`'s position; rename to `StatusLine` if desired), because it is already full-width and mounted **outside** the `viewMode` swap (so it stays visible in Estimate mode), and it holds the superset of fields. Delete `CanvasHeaderBar` and **fold its 3-branch scale segment (including the "Page not calibrated → Set Scale" nudge) into the status line's scale slot** — reusing `getCalibrationControls()?.activate()` (do NOT duplicate the trigger, STATE.md:151). Retire the read-only snap pill; the line keeps a **reflect-only** snap indicator (D-05). The "eyes rest at the top while drawing" intent that motivated `CanvasHeaderBar` is now served by the always-visible **ContextBar** (top), which can also surface the calibration hint while a non-count tool is active.

*(Top-vs-bottom is explicitly the planner's call per D-06; bottom is the lower-risk consolidation and the recommendation of record.)*

## Snap / Arc Control Wiring (SC-2, SC-3 — the trickiest parity area after viewMode)

**Snap — straightforward (state is readable):**
- Read: `snapEnabled`, `snapSuspended` from `viewerStore` (`:25-26`, selectors like `StatusBar.tsx:25-26`).
- Toggle: `useViewerStore.getState().setSnapEnabled(!snapEnabled)` (`viewerStore:124`).
- On-state chrome: rail/context toggle shows accent when `snapEnabled`; dimmed when `snapSuspended` (held-off via Alt).
- F3/Alt keep working unchanged (`useKeyboardShortcuts.ts:187-303`); the toggle and F3 mutate the same field, so they stay in sync for free.

**Arc — needs a NEW read seam (state is NOT readable today):**
- Arc state (`arcMode: 'off'|'sticky'`, `arcHeld: boolean`) lives in `useMarkupTool`'s local React state (`useMarkupTool.ts:39-45,75-76`), registered into `markup-arc-ref.ts` as **setters only** (`setArcHeldHandler`, `setArcStickyToggleHandler`; `CanvasViewport.tsx:388-392`). There is **no getter** for the current arc mode — confirmed by grep (`getArcMode`/`getArcSticky` do not exist).
- **Toggle** is available: `getArcStickyToggleHandler()?.()` flips sticky arc (`markup-arc-ref.ts:30-31`; `useMarkupTool.ts:403-410`).
- **On-state display is the gap.** To render "Arc on", publish arc state where the rail/context can read it. **Two options:**
  1. **(Recommended) Add a read seam to `markup-arc-ref.ts`** — a `_arcSticky` boolean + `setArcStickyState(bool)` / `getArcSticky()`; `CanvasViewport` writes it whenever `markupState.arcMode` changes (a tiny `useEffect` on `arcMode`). Mirrors the existing setter-ref pattern; keeps arc state out of the persisted store; least churn. Read in the render path like `getChainArmedItem()`.
  2. Lift `arcMode` into `viewerStore` (like snap). Cleaner reactivity but a larger change to `useMarkupTool` state ownership and risks re-render coupling the Phase-14 author deliberately avoided (STATE.md:183: "arc flags are NOT in a store").
- **Recommendation:** Option 1 (module-ref getter). Flag to planner: without this seam the Arc button can *fire* the toggle but cannot *show* whether arc is on — which fails SC-2 ("Snap/Arc on/off states always visible"). This is the single new piece of plumbing this phase requires.

## The Phase-16 viewMode-Reset Integration Risk (highest-risk item — SC-4/SC-5)

**Today:** `RibbonToolbar.tsx:170-174`
```typescript
useEffect(() => {
  if (activeTab !== 'estimating' && viewMode === 'estimate') {
    setViewMode('plan')
  }
}, [activeTab, viewMode, setViewMode])
```
This existed to fix Phase-16 GAP-1: leaving the Estimating **tab** while the Estimate sheet showed left the center stuck on the grid, because `activeTab` (local ribbon state) and `viewMode` (store) were decoupled. The effect reveals Plan on tab-leave.

**With tabs removed there is no `activeTab`, so this effect has no trigger and must be reworked.**

**Correct resolution: DELETE the effect entirely. No replacement is needed.** Reasoning:
- Estimate view is now reachable **only** via the always-visible Plan|Estimate segmented toggle in the TopActionBar.
- The only way to be in `viewMode==='estimate'` is to have clicked **Estimate**; the only way back is to click **Plan**. There is no "leaving a tab" event to reset on.
- The App shell already reveals the correct subtree purely from `viewMode` (`App.tsx:343,469,481`), keeping both mounted (Stage never unmounts).
- Therefore the reset is not just unnecessary — keeping any tab-derived reset would be *wrong* (there is no tab).

**Confidence: HIGH.** This is the cleanest possible outcome: a coupling that existed only to paper over the tab/store split disappears when the tabs do.

**Test impact:** `ribbon-leave-estimating-reveals-plan.test.ts` asserts the *old* tab-leave behavior and **must be retired**. Replace with a standalone-toggle test (see Validation §): clicking Estimate → `viewMode==='estimate'` and App shows the Estimate subtree; clicking Plan → `viewMode==='plan'` and App shows the canvas; no reset side effects.

## App.tsx Shell Change (Component Decomposition — SC-1)

**Current shell** (`App.tsx:310-508`):
```
<div column>
  <TitleBar/>
  <RibbonToolbar .../>                    ← replace
  <main row>
    <div center>   Plan subtree (CanvasHeaderBar + CanvasViewport) | Estimate subtree </div>
    {viewMode==='plan' && <Splitter/> + <TotalsPanel/>}
  </main>
  <StatusBar/>                            ← becomes the single status line
</div>
```

**Target shell:**
```
<div column>
  <TitleBar/>
  <TopActionBar .../>                     ← file · page · zoom · Plan|Estimate · Totals · ⋯
  <ContextBar/>                           ← morphing sub-bar
  <main row>
    <ToolRail/>                           ← NEW first column of the stage row
    <div center>   Plan subtree (CanvasViewport, NO CanvasHeaderBar) | Estimate subtree </div>
    {viewMode==='plan' && <Splitter/> + <TotalsPanel/>}
  </main>
  <StatusLine/>                           ← consolidated (page+scale+nudge+snap-reflect)
</div>
```

**Critical constraints:**
- **ToolRail is a NEW sibling column prepended to `<main>`** (mirrors the mockup's `.stage { display:flex } → .rail + .canvaswrap + .totals`, `mockup.html:97,153-154`). It sits *before* the center `<div>` and does **not** wrap or restructure the center subtree, so the mount-preserving Konva Stage (`App.tsx:329-336` Pitfall-1 comment) is untouched. The `minWidth:0` floor on the center flex child (`:347,352`) stays.
- **`TopActionBar` + `ContextBar` replace `RibbonToolbar`** as fixed-height siblings between `TitleBar` and `<main>` (both `flexShrink:0`).
- **Preserve all prop wiring**: `onOpenClick={handleOpenClick}`, `onReplaceClick={handleReplaceClick}`, `onExportClick={handleExportClick}` move from `RibbonToolbar` (`:313-317`) to `TopActionBar`. The `handleArmTool` resume-from-totals path (`:266-297`, `:503`) and `useKeyboardShortcuts` wiring (`:299-308`) are unchanged.
- **Rail visibility in Estimate mode:** the mockup keeps the rail visible in both views (`mockup.html:132,364`). Recommendation: keep the rail always mounted/visible (simplest, matches the feel-tested prototype). Arming a markup tool while the canvas is hidden is harmless (`setActiveTool` has no visible effect without the canvas). Optional polish: dim tool buttons in Estimate mode. Flag as minor discretion.

**Decomposition recommendation: replace, don't refactor-in-place.** `RibbonToolbar.tsx` is a tab-switch shell; nothing about its structure survives the move to three co-visible surfaces. Extract the shared button chrome (from `RibbonButton.tsx:45-104` + the accent Open button `RibbonToolbar.tsx:270-312`) into small rail/bar button components, then delete `RibbonToolbar.tsx`, `RibbonButton.tsx`, and the dead legacy `Toolbar.tsx`.

## Runtime State Inventory

This is a component-replacement refactor, not a string rename, but the inventory is included for safety. **Nothing under the chrome changes.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** Snap/Arc are runtime-only, never serialized (`viewerStore:22-26`; STATE.md:181,183). Markups live in Zustand + `.clmc`, untouched. `.clmc` format unchanged (no schema field touched). | none |
| Live service config | **None** — offline desktop app, no external services. | none |
| OS-registered state | **None.** | none |
| Secrets / env vars | **None.** | none |
| Build artifacts / stale references | **Deleting `RibbonToolbar.tsx`, `RibbonButton.tsx`, `Toolbar.tsx` breaks imports.** `App.tsx:3` imports `RibbonToolbar`; 4 test files import legacy `Toolbar` (`toolbar-export-button`, `toolbar-open-prop`, `toolbar-replace-pdf`, `toolbar-saving-disabled`); `ribbon-leave-estimating-reveals-plan.test.ts` imports `RibbonToolbar`; `CanvasHeaderBar` imported at `App.tsx:9,351`. | code edit — update `App.tsx` imports/mounts; migrate or delete the 5 affected test files (see Validation §) |

**Canonical check — "after every file is updated, what still references the old components?"** Only source imports + tests (all in-repo, caught by typecheck + the test run). No runtime cache, registry, or datastore holds a reference. Verified by grep.

## Common Pitfalls

### Pitfall 1: Arc toggle can fire but cannot show its state (no read seam)
**What goes wrong:** You wire the Arc button to `getArcStickyToggleHandler()?.()` and it toggles, but the button never lights up because arc mode isn't readable outside `useMarkupTool`.
**Why:** Arc state is local React state in `useMarkupTool` (`:39-45`), exposed only as *setters* via `markup-arc-ref.ts`.
**How to avoid:** Add a read seam (`getArcSticky()`) to `markup-arc-ref.ts`; have `CanvasViewport` publish `arcMode` on change. Read it in the render path like `getChainArmedItem()`.
**Warning sign:** SC-2 review — "Snap/Arc on/off states always visible" — fails for Arc only.

### Pitfall 2: Trying to "port" the viewMode reset instead of deleting it
**What goes wrong:** Someone re-keys the reset effect on `viewMode` or a new flag and reintroduces flicker or a stuck view.
**Why:** The effect only ever made sense as a tab-leave hook.
**How to avoid:** Delete it. The standalone toggle + App display-swap are self-consistent (see viewMode Risk §).
**Warning sign:** any `useEffect` calling `setViewMode('plan')` in the new components.

### Pitfall 3: Dropping markDirty() on Show/Hide All
**What goes wrong:** Visibility changes don't mark the project dirty, so Save doesn't persist them.
**Why:** `setHiddenItemNames` is designed for hydration and does NOT `markDirty` internally (`RibbonToolbar.tsx:57-59`; STATE.md:161).
**How to avoid:** Both handlers call `markDirty()` explicitly (verbatim from `:242-258`).
**Warning sign:** a regression test that saves after Hide All and finds no dirty flag.

### Pitfall 4: Restructuring the center subtree and tearing down the Stage
**What goes wrong:** Adding the rail "inside" the plan subtree or wrapping the canvas in a new conditional unmounts the Konva Stage → PDF re-rasterizes, measures 0×0.
**Why:** Stage mount preservation is a Phase-16 locked constraint (`App.tsx:329-336`).
**How to avoid:** ToolRail is a **sibling** column of the center `<div>`, prepended to `<main>`. Never wrap the center subtree.

### Pitfall 5: Reinventing the calibration trigger in the status line
**What goes wrong:** The consolidated line hand-rolls a Set Scale trigger instead of reusing the module ref.
**Why:** `CanvasHeaderBar` was explicitly built to reuse `getCalibrationControls()?.activate()` and NOT duplicate the trigger (STATE.md:151).
**How to avoid:** Fold the exact `:69` onClick (`getCalibrationControls()?.activate()`) into the status line's uncalibrated branch.

### Pitfall 6: Fresh `[]` in a Zustand selector (infinite re-render)
**What goes wrong:** A per-page markup selector returning a new `[]` breaks snapshot equality.
**How to avoid:** module-scope `EMPTY_MARKUPS` (`CanvasHeaderBar.tsx:31`, `CanvasViewport.tsx:58`). Relevant if the status line reads per-page markups to compute `hasNonCountMarkups` for the nudge.

### Pitfall 7: Inline rename in the ContextBar re-seeding per keystroke
**What goes wrong:** A controlled name input clobbers mid-typing, or commits per keystroke.
**How to avoid:** Uncontrolled input, commit on blur/Enter, guard the store-seed effect with `document.activeElement` (MEMORY `feedback_inline_edit_commit_pattern`; Phase-16 CR-01). React 19 delegates blur as focusout and suppresses synthetic onChange after imperative `.value` sets — mirror the native-listener pattern proven in Phase-15 (STATE.md:193).

## Code Examples

### Consolidated status-line scale segment (fold CanvasHeaderBar's nudge in)
```typescript
// Source: CanvasHeaderBar.tsx:57-80 — 3-branch scale status, reuse verbatim in StatusLine.
let rightSegment: React.JSX.Element
if (pageScale !== null) {
  rightSegment = <span style={{ color: COLORS.textPrimary }}>{formatScaleRatio(pageScale.pixelsPerMm)}</span>
} else if (!hasNonCountMarkups) {
  rightSegment = <span style={{ color: COLORS.textSecondary }}>Not Set</span>
} else {
  rightSegment = (
    <span style={{ color: COLORS.warning }}>
      Page not calibrated.{' '}
      <span onClick={() => getCalibrationControls()?.activate()}
            style={{ color: COLORS.accent, textDecoration: 'underline', cursor: 'pointer' }}>
        Set Scale
      </span>
    </span>
  )
}
```

### Snap toggle (rail + context bar)
```typescript
// Read: viewerStore.snapEnabled/snapSuspended (viewerStore.ts:25-26)
const snapEnabled = useViewerStore((s) => s.snapEnabled)
const snapSuspended = useViewerStore((s) => s.snapSuspended)
// Toggle (same field F3 mutates → stays in sync):
onClick={() => useViewerStore.getState().setSnapEnabled(!snapEnabled)}
// On-state: accent when snapEnabled && !snapSuspended; dimmed when snapSuspended.
```

### Arc toggle + NEW read seam (add to markup-arc-ref.ts)
```typescript
// markup-arc-ref.ts — ADD (mirrors the existing setter-handler pattern):
let _arcSticky = false
export function setArcStickyState(on: boolean): void { _arcSticky = on }
export function getArcSticky(): boolean { return _arcSticky }

// CanvasViewport.tsx — publish on change (near the existing arc-ref registration :388-392):
useEffect(() => { setArcStickyState(markupState.arcMode === 'sticky') }, [markupState.arcMode])

// ToolRail / ContextBar Arc button:
onClick={() => getArcStickyToggleHandler()?.()}   // toggles sticky (markup-arc-ref.ts:30-31)
// on-state read at render: getArcSticky()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 7-tab Office ribbon, one panel visible at a time (`RibbonToolbar.tsx`) | Tab-less co-visible rail + top bar + context bar | Phase 18 (this) | Every inner-loop action one click; zero tab round-trips |
| Snap read-only pill; Arc no chrome (keyboard only) | Snap + Arc clickable toggles | Phase 18 | Phase-14 features become discoverable (GAP-02-DOCS) |
| Page + scale printed twice (top `CanvasHeaderBar` + bottom `StatusBar`) | One consolidated status line | Phase 18 | Removes duplicate chrome; preserves calibration nudge |
| viewMode reset coupled to tab-leave (`useEffect :170-174`) | Standalone Plan\|Estimate toggle, no reset | Phase 18 | Removes a Phase-16 workaround entirely |

**Deprecated/outdated after this phase:**
- `RibbonToolbar.tsx`, `RibbonButton.tsx` — deleted.
- `Toolbar.tsx` (legacy flat toolbar) — already dead in production (only tests import it); delete now.
- `CanvasHeaderBar.tsx` — deleted; nudge folded into the status line.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Deleting the viewMode-reset `useEffect` with **no** replacement is fully correct | viewMode Risk § | LOW — if a non-toggle path can reach `estimate` and needs reset, a stuck view could recur; mitigated by the standalone-toggle regression test |
| A2 | Show All / Hide All belong behind the reserved ⋯ overflow (no explicit spike home) | Inventory P15; Open Q1 | MEDIUM — placement is a UX call; behavior (markDirty) is fixed regardless of home |
| A3 | Bottom is the right home for the single status line | Chrome Consolidation § | LOW — explicitly the planner's call (D-06); both satisfy the criteria |
| A4 | Arc read seam via module-ref getter (Option 1) over lifting to store | Snap/Arc Wiring §; Pitfall 1 | LOW — both work; Option 1 is less churn and preserves STATE.md:183 intent |
| A5 | Rail stays visible in Estimate mode (matches mockup) | App Shell § | LOW — cosmetic; can dim/hide as polish |
| A6 | Legacy `Toolbar.tsx` is safe to delete (dead prod code) | Inventory; State of the Art | LOW — verified only tests import it; typecheck + test migration catch any miss |

## Open Questions

1. **Where do Show All / Hide All live?** The spike mockup shows no home for them (rail/top-bar/context-bar all omit them). They were in the old View tab (`RibbonToolbar.tsx:533-546`).
   - What we know: both MUST call `markDirty()` (Pitfall 3); `Hide All` disabled when `!hasMarkups`.
   - What's unclear: which surface. Candidates: the reserved **⋯ overflow menu** (natural fit — infrequent, layer-management actions), or a small pair on the **TopActionBar** near Totals, or inside the **TotalsPanel** header (where per-item visibility already lives).
   - Recommendation: park them in the ⋯ overflow this phase (keeps the top bar clean, matches "reserved home for secondary actions"), OR surface them in the Totals panel where visibility is already managed. Planner/user to confirm.

2. **ContextBar "selected markup" panel scope.** SC-4 requires name / category / Recolor / Delete when a markup is selected. The canvas already offers edit via double-click popup + right-click `MarkupContextMenu`.
   - What we know: selection is readable (`viewerStore.selectedMarkupIds`); ops exist (`editMarkup`/`recolorGroup`/`deleteMarkup`); recolor swatch UI exists in `MarkupContextMenu.tsx:116-148`.
   - What's unclear: how much of Recolor (full palette popover vs a single swatch) to surface inline, and whether category is editable here or display-only.
   - Recommendation: inline name (uncontrolled, commit-on-blur/Enter → `editMarkup`), category as a chip (display-only for parity; editing stays in the existing popup), Recolor opens the same swatch row as `MarkupContextMenu` (→ `recolorGroup`), Delete → `deleteMarkup`. Canvas popup + right-click menu remain untouched (additive surface).

3. **⋯/gear button shape + contents.** D-07 reserves it with no content this phase. Confirm it renders as an inert/disabled affordance (or opens an empty "Coming soon" popover) so it doesn't imply missing functionality.

## Environment Availability

Pure code/config change — **no NEW external dependencies.** Existing toolchain (already used every phase): Node 22 (bundled with Electron 35), electron-vite, Vitest, TypeScript, ESLint, `lucide-react`. All present and exercised by the 803-green suite (STATE.md:36). No install, service, or runtime probe needed. **Step 2.6: effectively SKIPPED (no external dependencies introduced).**

## Validation Architecture

`workflow.nyquist_validation` is `true` (`config.json:19`). Behavior parity is the acceptance bar, so the test surface is central.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom for render tests) |
| Config file | `vitest.config.ts` — include glob `src/tests/**/*.test.ts` (note: `.test.ts`, NOT `.tsx`; render tests use `React.createElement`, per STATE.md:136) |
| Render harness | `createRoot` + `act()` from `react-dom/client` (see `ribbon-leave-estimating-reveals-plan.test.ts:56-75`) |
| Konva isolation | mock `@renderer/components/CanvasViewport` to stub the module getters (pattern at `ribbon-leave-estimating-reveals-plan.test.ts:32-37`) |
| Quick run command | `npx vitest run src/tests/<file>.test.ts` |
| Full suite command | `npm test` (or `npx vitest run`) — must stay green (803 baseline) |

### Phase Requirements → Test Map (parity, not new features)
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC-1 | Tool + zoom + page all reachable with no tab; no `role="tab"` in DOM | render/unit | `npx vitest run src/tests/toolrail-tools.test.ts` | ❌ Wave 0 |
| SC-2 | Rail shows Select/Count/…/Wall/Set Scale/Snap/Arc; active tool highlighted; Snap/Arc on-state visible | render | `npx vitest run src/tests/toolrail-tools.test.ts` | ❌ Wave 0 |
| SC-2 | Chain badge renders on armed tool (`getChainArmedItem()!==null`) | render | `…/toolrail-chain-badge.test.ts` | ❌ Wave 0 |
| SC-3 | Snap toggle → `setSnapEnabled(!x)`; F3 still toggles same field | render+unit | `…/snap-toggle.test.ts` | ❌ Wave 0 |
| SC-3 | Arc toggle fires `getArcStickyToggleHandler`; `getArcSticky()` reflects state | render+unit | `…/arc-toggle.test.ts` | ❌ Wave 0 (needs read seam) |
| SC-4 | ContextBar morphs: placing→chain; selected→name/cat/recolor/delete; idle→hint | render | `…/context-bar-morph.test.ts` | ❌ Wave 0 |
| SC-4 | Selected-markup Delete → `deleteMarkup`; Recolor → `recolorGroup`; rename → `editMarkup` (commit on blur/Enter) | render | `…/context-bar-edit.test.ts` | ❌ Wave 0 |
| SC-5 | One status line shows page+scale; nudge branch → Set Scale link → `getCalibrationControls().activate()` | render | `…/status-line.test.ts` (migrate `canvas-header-bar.test.ts:206-254`) | ⚠️ migrate |
| SC-5 | No duplicate page+scale chrome; snap pill is not a read-only-only element | render | `…/status-line.test.ts` | ❌ Wave 0 |
| SC-5 | Plan\|Estimate standalone toggle sets `viewMode`; App reveals matching subtree; NO reset side effect | render | `…/view-mode-toggle.test.ts` (replaces `ribbon-leave-estimating-reveals-plan.test.ts`) | ⚠️ replace |
| SC-5 | Open/Save/SaveAs/Replace/Export disabled derivations (`saveDisabled`/`replaceDisabled`/`exportDisabled`) + prop firing | render | `…/top-action-bar-file-ops.test.ts` (migrate the 4 `toolbar-*.test.ts`) | ⚠️ migrate |
| SC-5 | Totals toggle → `setTotalsOpen`; page prev/next → `prevPage`/`nextPage` disabled at bounds; zoom via `getCanvasControls` disabled at MIN/MAX | render | `…/top-action-bar-nav.test.ts` | ❌ Wave 0 |
| SC-6 | Show All / Hide All both call `markDirty()` (Pitfall 7 guard) | render | `…/visibility-markdirty.test.ts` | ❌ Wave 0 |
| SC-6 | Keyboard shortcuts (F3/Alt/A/Shift+A, Ctrl+O/S/Shift+S/Shift+E, arrows, Ctrl+0) unchanged | unit | existing `useKeyboardShortcuts` tests remain green | ✅ existing |
| SC-6 | `chain-mode.test.ts` (useMarkupTool) unaffected — resume-from-totals arming intact | unit | existing | ✅ existing |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched test file(s).
- **Per wave merge:** full suite `npm test` green (803+ baseline).
- **Phase gate:** full suite green + `npx tsc --noEmit` + production build clean before `/gsd:verify-work`.

### Wave 0 Gaps (write these RED first)
- [ ] `src/tests/toolrail-tools.test.ts` — tool arm/disarm, active chrome, Set Scale activate/cancel + ScaleContextMenu (SC-1/2)
- [ ] `src/tests/toolrail-chain-badge.test.ts` — chain badge gate (SC-2)
- [ ] `src/tests/snap-toggle.test.ts` — snap read + toggle sync with F3 (SC-3)
- [ ] `src/tests/arc-toggle.test.ts` — arc toggle + new `getArcSticky()` seam (SC-3)
- [ ] `src/tests/context-bar-morph.test.ts` + `context-bar-edit.test.ts` — morph + edit ops (SC-4)
- [ ] `src/tests/status-line.test.ts` — consolidated line + nudge (migrate from `canvas-header-bar.test.ts`) (SC-5)
- [ ] `src/tests/view-mode-toggle.test.ts` — standalone toggle, no reset (replace `ribbon-leave-estimating-reveals-plan.test.ts`) (SC-5)
- [ ] `src/tests/top-action-bar-file-ops.test.ts` + `top-action-bar-nav.test.ts` — file/page/zoom/totals (migrate the 4 `toolbar-*.test.ts`) (SC-5)
- [ ] `src/tests/visibility-markdirty.test.ts` — Show/Hide All markDirty (SC-6)
- **Migrations/retirements:** delete `ribbon-leave-estimating-reveals-plan.test.ts`; migrate `canvas-header-bar.test.ts`; rewrite `toolbar-export-button.test.ts` / `toolbar-open-prop.test.ts` / `toolbar-replace-pdf.test.ts` / `toolbar-saving-disabled.test.ts` against `TopActionBar`; keep `status-bar-scale.test.ts` (pure selector) and extend for the merged line.

## Security Domain

`security_enforcement` is not set → treated as enabled. This is a **pure UI recomposition with no new data, IPC, network, auth, or crypto surface**, so almost every ASVS category is N/A.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | single-user offline desktop app |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minor) | ContextBar inline rename: React auto-escapes text; value flows to existing `markupStore.editMarkup`/`renameGroup` which already handle collisions (Phase 17); no new validation surface |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted text in inline rename input | Tampering | React text-node escaping + existing `editMarkup` path; no `dangerouslySetInnerHTML`, no eval |
| New IPC surface | Elevation | **None introduced** — Save/Export/Replace reuse existing `window.api` handlers unchanged |
| Persisted-state injection | Tampering | **None** — no new persisted fields; snap/arc runtime-only, `.clmc` schema untouched |

**Net:** no new attack surface. The only user-input path (inline rename) reuses a validated store operation and React's default escaping.

## Sources

### Primary (HIGH confidence — read at file:line this session)
- `RibbonToolbar.tsx:1-751` — every handler + disabled derivation + the viewMode reset effect (:170-174)
- `CanvasViewport.tsx:130-192` — module control refs (`getCanvasControls`/`getCalibrationControls`/`getChainArmedItem`/`setChainArmedFromTotals`) + arc-ref registration (:388-392)
- `App.tsx:310-508` — shell layout, mount-preserving viewMode swap (:329-476), prop + shortcut wiring
- `CanvasHeaderBar.tsx:1-107` — 3-branch scale nudge + reused calibration trigger (:69)
- `StatusBar.tsx:1-131` — filename/page/zoom/scale/snap pill (:110-128)
- `RibbonButton.tsx:1-105` — button chrome tokens
- `ScaleContextMenu.tsx:1-101` — recalibrate/verify menu
- `markup-arc-ref.ts:1-33` — setter-only arc handlers (no getter → Pitfall 1)
- `useMarkupTool.ts:39-45,75-76,403-410` — arc state ownership
- `useKeyboardShortcuts.ts:183-307` — F3/Alt/A/Shift+A (toolbar-independent)
- `viewerStore.ts:20-150` — snap flags, selection, view mode, setters
- `markupStore.ts:486,513,565,810` — deleteMarkup/recolorGroup/renameGroup/editMarkup signatures
- `lib/constants.ts:1-24` — COLORS + zoom bounds
- `mockup.html` (spike 007) — authoritative visual/interaction reference (rail :307-312, top bar :300-306, context morph :327-349, one status :351-357)
- `.planning/spikes/007-toolbar-revamp/README.md` — Direction A spec, diagnosis, locked decisions
- `.planning/phases/18-toolbar-revamp/18-CONTEXT.md` — locked decisions D-01..D-08 + code insights
- `.planning/ROADMAP.md:683-698` — 6 Success Criteria
- `.planning/STATE.md:104,151,159,181,183,193` — locked patterns (module refs, no-duplicate-trigger, chain-ref, snap/arc runtime-only, native inline-input listeners)
- test files: `ribbon-leave-estimating-reveals-plan.test.ts`, `canvas-header-bar.test.ts`, `status-bar-scale.test.ts`, `chain-mode.test.ts`, `toolbar-*.test.ts`

### Secondary / Tertiary
- None required — every claim is grounded in the repo. No external lookups were needed for this recomposition.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all modules read in-repo
- Behavior-parity inventory: HIGH — every handler mapped from source lines
- viewMode reset resolution: HIGH — delete-effect logic verified against App shell + tests
- Arc read seam: HIGH (gap is real; fix is a small mirror of existing pattern) / MEDIUM on chosen option (A4)
- Chrome consolidation home: MEDIUM — recommendation (bottom) is planner's call per D-06
- Show/Hide All home: MEDIUM — genuinely unspecified in the spike (Open Q1)

**Research date:** 2026-07-14
**Valid until:** stable indefinitely (internal refactor; no external/version-sensitive claims) — re-verify only if `CanvasViewport` module refs, `viewerStore` snap fields, or the App shell layout change before planning.
