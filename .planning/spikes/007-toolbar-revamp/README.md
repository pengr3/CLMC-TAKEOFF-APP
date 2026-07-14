---
spike: 007
name: toolbar-revamp
type: comparison
validates: "Given the markup inner loop (pick tool → place → zoom/pan → flip page → repeat), when the toolbar is laid out with everything co-visible, then the estimator completes the loop with ZERO tab switches / mode changes"
verdict: "WINNER: A (left rail + top action bar)"
related: []
tags: [ui, toolbar, ribbon, ux, markup-efficiency, comparison]
---

# Spike 007: Toolbar Revamp — A vs B (head-to-head)

## What This Validates

**Problem (grounded in code):** the current `RibbonToolbar.tsx` is a 7-tab Office ribbon that
shows only ONE tab's buttons at a time. The markup inner loop needs tools that live on four
different tabs simultaneously:

| Loop action | Current tab | Reachable mid-markup? |
|---|---|---|
| Pick tool (Count/Linear/Area/…) | Tools | ✅ |
| Zoom in/out, Fit | View | ❌ tab round-trip |
| Next / Prev page | Page | ❌ tab round-trip |
| Save / Export | Home | ❌ tab round-trip |

An Office ribbon assumes you *dwell* in one mode. Takeoff has no dwell mode — tool + zoom +
page are continuously in play. The ribbon forces a tab round-trip (or a memorized shortcut)
on every context switch.

**North star (user):** *"seamless = everything one click away."* No tabs, no mode round-trips.

**Given/When/Then:** Given the markup inner loop, when the toolbar is laid out with the tool
palette + navigation co-visible, then the estimator completes the loop with **zero tab switches**.

## The two candidate layouts (toggle at the top of the mockup)

- **A — Left tool rail + slim top action bar.** Vertical rail (56px) on the left edge holds the
  6 tools + Set Scale + Snap/Arc toggles, always visible. Top bar holds File · Page · Zoom ·
  Plan|Estimate · Totals. A contextual sub-bar under the top bar morphs with the active tool /
  selection. Bluebeam/PlanSwift-familiar. Cost: a strip of left width.
- **B — One unified top command strip, no tabs.** A single always-visible strip with clustered
  groups (File · Page · Tools · Zoom · Snap/Arc · Plan|Estimate) separated by dividers, plus the
  same morphing context line below. Keeps the top-docked model; removes mode-switching. Cost:
  the strip gets crowded on narrow windows (the mockup scrolls it horizontally — a real tradeoff).

Both eliminate the tab metaphor entirely, so **every loop action is one click in either.**
The context bar is where Phase-14 features (Snap F3/Alt, Arc A/Shift+A) — currently invisible
keyboard-only — become clickable and discoverable.

## How to Run

Open `mockup.html` in any browser (double-click, or it appears in the app's Browser pane on save):

`.planning/spikes/007-toolbar-revamp/mockup.html`

Fully self-contained (inline CSS/JS/SVG, app's real dark palette from `constants.ts` COLORS).

## What to Expect

- Toggle **A / B** at the top — same app, two toolbar architectures, instant compare.
- Click any tool → it arms (accent highlight), the canvas cursor becomes a crosshair, and the
  **context bar swaps** to placement options: item name + color chip + Snap/Arc toggles + Chain.
- Click **Snap** or **Arc** (rail/strip OR context bar) → toggles live; status bar Snap pill flips.
- Click a placed markup (in Select) → context bar swaps to edit mode (name/category/Recolor/Delete).
- Page ◀ ▶, Zoom − +, Fit, Totals, and the **Plan | Estimate** toggle all update live.
- Count the tab switches needed to run the whole loop: **0**.

## Investigation Trail

- **2026-07-14** — Read the full chrome stack before proposing: `RibbonToolbar.tsx` (7 tabs, one
  visible at a time), `CanvasHeaderBar.tsx` (top 28px: page + scale), `StatusBar.tsx` (bottom 28px:
  file · page · zoom · scale · snap pill). Found **page + scale are printed twice** (top and bottom
  bars) — redundant chrome. Found Snap is a read-only pill (not a control) and Arc has no chrome at
  all. Diagnosis: the scatter is *mode-gating*, not button placement per se.
- Built a single combined demo with an A/B toggle (better head-to-head than two separate files —
  same canvas, instant swap) rather than the letter-suffix `007-a` / `007-b` split.
- Observed tradeoff while building B: the unified strip holds ~18 controls; at ≤1000px it needs
  horizontal scroll. A's left rail sidesteps this by moving the 8 tool/precision buttons vertical.

## Results

**WINNER: A — left rail + slim top action bar** (user feel-test, 2026-07-14: "A feels nice").
The persistent vertical tool rail beat B's unified strip; the left-width cost is acceptable and it
avoids B's strip-crowding/horizontal-scroll problem on narrow windows.

### Emerging requirements for the real build (to confirm, then → `/gsd-plan-phase`)
- **No tabs.** The 7-tab `RibbonToolbar` is replaced; the tool palette + navigation are co-visible.
- **Left tool rail (persistent):** Select · Count · Linear · Area · Perimeter · Wall · | · Set Scale · | · Snap · Arc.
- **Top action bar (persistent):** File (Open/Save/Export) · Page ◀ N/M ▶ · Zoom −/%/+ · Fit · | · Plan|Estimate · Totals.
- **Contextual sub-bar (morphs):** placing → item name + color + Snap/Arc + Chain; select+selected → name/category/Recolor/Delete; else → hint.
- **Snap and Arc become clickable controls** (not keyboard-only) and the Snap pill becomes a real toggle.
- **Consolidate duplicated chrome:** page + scale are printed by BOTH `CanvasHeaderBar` (top) and `StatusBar` (bottom) today — fold into one status line (preserve the "page not calibrated → Set Scale" nudge).

### Locked decisions (2026-07-14, user)
- **Set Scale = a left-rail tool** (choice a) — it's spatial (draw a line), so it belongs with the tools, not the top bar.
- **Settings/Help = dropped for now** (choice a) — a small `⋯`/gear button on the top bar reserves the home; no Settings/Help content built in this revamp.
