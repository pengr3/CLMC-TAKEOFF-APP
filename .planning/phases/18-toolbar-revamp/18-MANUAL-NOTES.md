# Toolbar Revamp — How-To-Manual Notes (Phase 18)

**For:** the app How-To-Manual. These notes describe the new tab-less toolbar so
every tool, gesture, and shortcut can be written up manual-ready.

The old 7-tab Office ribbon is gone. Instead of switching tabs, everything is now
**co-visible and one click away** across four persistent surfaces:

- **Tool Rail** — a slim vertical strip on the left edge (tools + Snap/Arc).
- **Top Action Bar** — a horizontal strip under the title bar (file · page · zoom · view).
- **Context Bar** — a thin strip under the Top Action Bar that *morphs* with what you're doing.
- **Status Bar** — a single line along the bottom (filename · page · zoom · scale · snap).

---

## What Moved Where

Every action from the old 7-tab ribbon now lives on one of the new surfaces. Nothing
was removed except the two "Coming soon" stub tabs (Settings / Help).

| Old ribbon tab | Old action | New home |
|----------------|-----------|----------|
| **Home** | Open · Save · Save As · Replace PDF · Export | **Top Action Bar** — left group (Open keeps its accent-blue styling) |
| **Page** | Previous / Next page · "Page N of M" | **Top Action Bar** — center group (◀ N/M ▶) |
| **View** | Zoom − / % / + · Fit | **Top Action Bar** — center group (zoom cluster) |
| **View** | Totals panel show/hide | **Top Action Bar** — right group (Totals toggle) |
| **View** | Show All / Hide All markups | **Top Action Bar** — right group, next to Totals |
| **Tools** | Select · Count · Linear · Area · Perimeter · Wall | **Tool Rail** — top group |
| **Tools** | Set Scale (calibration) | **Tool Rail** — its own tool, with the ▾ / right-click Recalibrate + Verify menu |
| **Estimating** | Plan \| Estimate workspace toggle | **Top Action Bar** — right group (segmented Plan \| Estimate control) |
| **Settings** | (was a "Coming soon" stub) | **Removed** — reserved behind the inert **⋯** overflow button (no content) |
| **Help** | (was a "Coming soon" stub) | **Removed** — reserved behind the inert **⋯** overflow button (no content) |
| _(top header)_ **Canvas Header Bar** | Page label + scale ratio + "Page not calibrated → Set Scale" nudge | **Status Bar** — folded into the single bottom line (page + scale were printed twice before; now once) |

Snap and Arc — previously keyboard-only and invisible — are now clickable toggles on
both the **Tool Rail** and the **Context Bar** (see the Snap/Arc reference below).

---

## Tool Rail Reference

The left rail holds **9 controls**, top-to-bottom, in three groups separated by hairline dividers:

| # | Control | What it does |
|---|---------|--------------|
| 1 | **Select** | Click a markup to select it; drag to rubber-band multi-select. Always available. |
| 2 | **Count** | Place pins to tally items (count takeoff). |
| 3 | **Linear** | Draw polylines to measure lengths. |
| 4 | **Area** | Trace polygons to measure surface area. |
| 5 | **Perimeter** | Trace a closed outline; measures the perimeter length. |
| 6 | **Wall** | Measure wall area (length × height) in m². |
| — | _divider_ | |
| 7 | **Set Scale** | Draw a line between two known points, then type the real distance to calibrate the page. Right-click (or click the small **▾**) for the **Recalibrate** / **Verify** menu. |
| — | _divider_ | |
| 8 | **Snap** | Toggle snapping to vertices/edges (see Snap/Arc reference). |
| 9 | **Arc** | Toggle sticky arc segments (see Snap/Arc reference). |

**Active-state chrome:**
- The **active tool** (Select or a markup tool, or Set Scale while calibrating) is
  drawn with an accent-blue fill and white icon/label.
- When a tool is **armed from Totals** (resume-from-totals), a small **chain badge**
  (color dot + item name) appears on that tool's rail button.
- **Snap / Arc** show an accent border + a small dot in the corner when **on**.
- The markup tools and Set Scale are **disabled** (dimmed, not clickable) when no PDF is open.

**Tapping a tool again** (Count → Count) disarms it and returns to Select — same behavior
as the old ribbon.

---

## Snap / Arc Toggles + Shortcuts

Snap and Arc appear in **two places** — the Tool Rail and the Context Bar. Both copies,
and their keyboard shortcuts, mutate the **same underlying state**, so they always stay in sync.

| Control | Click (rail or context bar) | Keyboard | Notes |
|---------|-----------------------------|----------|-------|
| **Snap** | Toggles snapping on/off | **F3** — on/off · **Alt (hold)** — suspend while held | On = accent chrome; while Alt is held the toggle **dims** (suspended); release Alt to resume. F3 and the click flip the same flag. |
| **Arc** | Toggles **sticky** arc segments on/off | **Shift+A** — sticky on/off · **A (hold)** — one-off arc for the next segment | The rail/context click mirrors **Shift+A**. The on-state lights up reactively, so pressing Shift+A updates the toggle chrome with no other interaction. |

- **Snap** helps vertices/edges land precisely on existing geometry.
- **Arc** lets a polyline/area segment curve instead of running straight — hold **A**
  for a single arced segment, or use **Shift+A** (or the toggle) to keep every new
  segment arced until you turn it off.

The bottom Status Bar still *reflects* the snap state (read-only indicator); the actual
toggles now live on the rail and context bar.

---

## Context Bar Morph States

The thin Context Bar under the Top Action Bar changes to match what you're doing. There
are four states:

| State | When | What it shows |
|-------|------|---------------|
| **Placing** | A markup tool (Count/Linear/Area/Perimeter/Wall) is active | A "**Placing**" tag + the tool name; if armed from Totals, the chain item's **color swatch + name**; the **Snap** and **Arc** toggles; a **Chain ●** indicator (when chaining); and the hint **"Enter to finish · Esc to cancel"**. |
| **Set Scale** | The Set Scale tool is active | A "**Set Scale**" tag + the calibration hint: draw a line over a known dimension, then type its real length. Nothing else moves — no tab change. |
| **Selected** | The Select tool is active and a markup is selected | An inline editing panel: **name** (inline rename) · **category** chip · **Recolor** · **Delete**. |
| **Idle** | Nothing active/selected | A short hint prompting you to pick a tool or click a markup — every control above is one click away. |

**Editing a selected markup** from the Context Bar (rename / recolor / delete) is
**additive** — the existing canvas double-click popup and the right-click markup menu
still work exactly as before.

---

## Notes / Gotchas

- **The ⋯ overflow button is inert.** It reserves the future home for Settings / Help
  but has **no content** in this release — clicking it does nothing yet. It is intentionally
  a placeholder, not a broken button.
- **The "Placing" item name is display-only.** While placing a markup, the name shown in
  the Context Bar cannot be edited there. To rename an item, either **select** a placed
  markup (Context Bar "Selected" state) or rename it in the **Totals** / **Estimate** panels.
- **Page + scale now appear once.** They used to be printed twice (top header + bottom
  status bar). The top header is gone; the single bottom Status Bar line carries page,
  scale ratio, and the **"Page not calibrated → Set Scale"** nudge (which still opens
  calibration when clicked).
- **No tab round-trips.** The whole markup inner loop — pick a tool, place, zoom/fit,
  flip pages, save — is now reachable without ever switching a tab or mode.
