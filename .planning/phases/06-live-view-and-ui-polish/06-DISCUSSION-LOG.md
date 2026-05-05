# Phase 6: Live View and UI Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 06-live-view-and-ui-polish
**Areas discussed:** Layout & screen real estate, Totals panel content & shape, Totals interactivity, Thumbnail content & polish indicators

---

## Layout & Screen Real Estate

### Q1: How should the totals panel and thumbnail strip lay out around the canvas on a 1080p screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbs left, totals right (Recommended) | Conventional takeoff layout (PlanSwift/Bluebeam). Each side dedicated to one navigator. Canvas takes center. | ✓ |
| Both on the right (stacked) | Saves left edge for canvas. Thumbnails on top half of right sidebar, totals below; or tabs. | |
| Thumbs bottom strip, totals right | Horizontal thumbnail rail across the bottom (more pages visible at once); totals on the right. | |
| Floating/draggable panels | Both panels float over the canvas; user positions them. Maximum canvas, but panels can occlude markups. | |

**User's choice:** Thumbs left, totals right.
**Notes:** Maps to D-01. Familiar PlanSwift/Bluebeam mental model.

### Q2: Default state of these panels when the app opens?

| Option | Description | Selected |
|--------|-------------|----------|
| Both open by default (Recommended) | First-time users immediately see the value of both panels. | ✓ |
| Both open, but remember last state | Open by default on first launch; thereafter restore localStorage. | |
| Both collapsed by default | Maximum canvas on first launch; user opens panels manually. | |
| Thumbnails open, totals collapsed | Page navigation matters from the very first PDF; totals matter once markups exist. | |

**User's choice:** Both open by default.
**Notes:** Combined with Q3's localStorage decision: panels are open on first launch, then state restored on subsequent launches. Maps to D-02.

### Q3: How should the user resize and toggle these panels?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag edge + collapse button per panel (Recommended) | Each panel has a draggable inner edge, plus a collapse button. Widths persist to localStorage. | ✓ |
| Fixed widths, toggle only | No drag-to-resize; sensible fixed widths. | |
| Drag edge, no collapse | Resize freely; no explicit collapse button. | |

**User's choice:** Drag edge + collapse button.
**Notes:** Maps to D-03.

### Q4: Persist UI state across sessions?

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage — not in .clmc (Recommended) | Panel widths + open/closed state survive across sessions but are per-machine. | ✓ |
| Save in .clmc project file | UI layout travels with the project. | |
| Don't persist — reset every launch | Always start fresh with defaults. | |

**User's choice:** localStorage — not in .clmc.
**Notes:** Keeps `.clmc` clean (project data only). Reinforces that opening a colleague's project should inherit the work, not their panel widths.

---

## Totals Panel — Content & Shape

### Q5: How structured should the totals panel be?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the BOQ export exactly (Recommended) | Reuse the existing BoqStructure verbatim. Live preview = export 1:1. | ✓ |
| Flat live items list | Just one row per (name, type), grouped by category heading. No subtotals. | |
| Flat list + grand totals only | Items grouped by category (no subtotals per category), single grand total. | |

**User's choice:** Mirror the BOQ export exactly.
**Notes:** Cements the "single source of truth" architecture. Maps to D-04 / D-05. Live panel reuses `boq-aggregator.ts` directly.

### Q6: How should rows colored by name-group be styled in the panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Color the item name cell only (mirrors BOQ export D-13) | Tiny color chip + name in the Item cell. Matches .xlsx export. | ✓ |
| Small color dot prefix on each row | Solid 8px circle in the row's color before the item name. | |
| Full row tinted by color | Whole row gets a faint background tint. | |
| No color indicator | Just text. | |

**User's choice:** Color the item name cell only.
**Notes:** Visual continuity canvas → panel → spreadsheet. Maps to D-06.

### Q7: What happens to markups on uncalibrated pages in the live view?

| Option | Description | Selected |
|--------|-------------|----------|
| Match export behavior (Recommended) | Same rule as BOQ export D-06: counts count normally; non-count types silently excluded. Live view = export. | ✓ |
| Show with a warning marker | Include quantities with an asterisk/icon. | |
| Show separately under an 'Uncalibrated' section | Group uncalibrated-page markups into a distinct lower section. | |

**User's choice:** Match export behavior.
**Notes:** No phantom 0 m / NaN. The user-facing "calibrate me" nudge is carried by the new CanvasHeaderBar (D-20), keeping the panel itself silent on calibration. Maps to D-07.

### Q8: What does the totals panel show when there's no project / no markups yet?

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful empty state per situation (Recommended) | Different copy for: no PDF / PDF open + zero markups / etc. | ✓ |
| Just hide the panel until there's something to show | Auto-collapse to slim rail. | |
| Show empty headers | Display column titles and blank body. | |

**User's choice:** Helpful empty state per situation.
**Notes:** Maps to D-09. Three contextual messages.

### Q9: Show the project metadata header (name, page count, total markups) at the top of the panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full header (Recommended) | Project name, total pages, total markups, current page. | ✓ |
| Just the totals — no header | Tighter use of vertical space. | |
| Compact one-liner | Single header line. | |

**User's choice:** Yes, full header.
**Notes:** Mirrors BOQ export D-09 metadata block. Maps to D-08.

---

## Totals Interactivity

### Q10: What happens when the user clicks an item row in the totals panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight markups + navigate to first occurrence (Recommended) | Jump to first page with matches; flash highlight. | ✓ |
| Highlight only (no navigation) | Highlight matching markups on current page; no page change. | |
| Navigate only (no highlight) | Jump page; no visual highlight. | |
| Read-only — no click action | Display only. | |

**User's choice:** Highlight + navigate.
**Notes:** Drives the verification workflow. Maps to D-10 / D-12.

### Q11: Anything else clickable in the panel? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Category heading collapses/expands its items | Fold a category. | ✓ |
| Copy row to clipboard on right-click / context menu | Right-click → 'Copy as text'. | ✓ |
| No additional click affordances | Item-row click is the only interaction. | ✓ (overlap) |

**User's choice:** Category heading collapse + right-click copy. (The "No additional" option was selected alongside the additive ones; treated as additive given the combined selection.)
**Notes:** Maps to D-13 / D-14.

### Q12: How should highlight + navigation behave when an item appears on multiple pages?

| Option | Description | Selected |
|--------|-------------|----------|
| Click jumps to first page; click again cycles (Recommended) | First click: page 1 matches. Second click on same row: next page. Wraps. | ✓ |
| Jump to first page only | Always first page; re-click does nothing. | |
| Show all pages with matches as clickable sub-targets | Click expands the row to show 'Pg 1 (8) • Pg 2 (12)'. | |

**User's choice:** Click jumps then cycles.
**Notes:** Maps to D-10. Cycle index is transient (not persisted).

### Q13: Hover behavior on item rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Hover faintly highlights matches on the current page (Recommended) | Subtle ring/glow on visible matches. | ✓ |
| Hover changes the cursor + row background only | Standard hover; no canvas effect. | |
| No hover effect | Plain rows. | |

**User's choice:** Hover highlights current-page matches.
**Notes:** Maps to D-11. Visually distinct from click pulse.

### Q14: How should the canvas-side highlight look?

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing ring/glow that fades out after ~1.5s (Recommended) | Soft ring pulses ~1.5s then fades. | ✓ |
| Persistent halo until user clicks elsewhere | Stays on until cleared. | |
| Brief flash, then nothing | ~300ms flash. | |

**User's choice:** Pulsing ring/glow ~1.5s.
**Notes:** Maps to D-12. Parent-owned-lifecycle pattern, zoom-compensated visuals.

---

## Thumbnail Content & Polish Indicators

### Q15: What should each thumbnail show?

| Option | Description | Selected |
|--------|-------------|----------|
| Rasterized page + markup overlay (Recommended) | Live miniature of the marked-up plan. | ✓ |
| Rasterized page only | Just the PDF page. | |
| PDF page + small markup-count badge | Page render + corner count chip. | |

**User's choice:** Rasterized page + markup overlay.
**Notes:** Maps to D-15. Refresh debounced ~200ms (D-19).

### Q16: What badges/indicators should appear on each thumbnail? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Page number / label | Page N or PDF page label below thumbnail. | ✓ |
| Markup count | Small numeric chip. | ✓ |
| Scale status icon | Calibrated vs uncalibrated icon. | ✓ |
| Active-page outline only — no badges | Outline + nothing else. | ✓ (overlap) |

**User's choice:** Page label + markup count + scale-status icon + active-page outline. (Same overlap pattern as Q11; treated as additive — all four indicators present.)
**Notes:** Maps to D-16.

### Q17: Beyond the existing StatusBar, are there any 'page/scale status indicators' you want for polish?

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar above the canvas (Recommended) | Slim strip above canvas: current page label + scale status + inline 'Set Scale' link if uncalibrated. | ✓ |
| Toast/banner when an uncalibrated page is opened | Non-blocking banner per uncalibrated visit. | |
| Just the existing StatusBar — no new polish | Keep scope tight. | |

**User's choice:** Header bar above the canvas.
**Notes:** Maps to D-20. Existing bottom StatusBar retained for redundancy.

### Q18: How should thumbnails handle very large plans (50+ pages)?

| Option | Description | Selected |
|--------|-------------|----------|
| Virtualize / lazy render — only what's visible (Recommended) | IntersectionObserver-based; placeholder skeletons for off-screen. | ✓ |
| Render all upfront with low resolution | All thumbnails generated on PDF open. | |
| Hybrid — render first 10, lazy after | Compromise. | |

**User's choice:** Virtualize / lazy render.
**Notes:** Maps to D-17. Planner can choose react-virtuoso vs hand-built.

### Q19: What size should thumbnails be?

| Option | Description | Selected |
|--------|-------------|----------|
| ~140px wide, aspect-preserved (Recommended) | Wide enough to read labels and recognize markups; many fit on 1080p. | ✓ |
| ~80–100px (compact) | More pages visible; markups harder to identify. | |
| ~200px (large) | Markups very legible; only a few thumbnails fit. | |

**User's choice:** ~140px wide, aspect-preserved.
**Notes:** Maps to D-18. Drag-resize handle adjusts on the fly.

### Q20: How fresh should the thumbnail markup overlay stay as the user works?

| Option | Description | Selected |
|--------|-------------|----------|
| Update on commit, debounced ~200ms (Recommended) | Refresh on markupStore changes after a 200ms quiet window. | ✓ |
| Update only on tool-end / page-leave | Refresh when the user finishes placing or leaves a page. | |
| Only update on save / project reload | Baked at save-time. | |

**User's choice:** Update on commit, debounced ~200ms.
**Notes:** Maps to D-19. Tracks reality without thrashing.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` § Claude's Discretion. Summary:

- Pulse/glow geometry, color, opacity curve, easing, exact duration
- Hover ring intensity (visually distinct from click pulse)
- Slim-rail width (~28–32px target)
- Splitter handle styling and hit area
- localStorage key naming (recommended `clmc.ui` namespace)
- Aggregator subscription strategy (memoized derive with stable empty fallbacks)
- Cycle-index state for row-click (local, not persisted)
- Thumbnail page-label resolution (PDF.js getPageLabels with `Page N` fallback)
- Empty-state copy wording
- Splitter / collapse animation (~150ms ease, or none)
- "Copy as text" payload format (`name\tquantity\tuom`)
- CanvasHeaderBar "Set Scale" wiring (reuse setActiveTool('scale') path)
- Thumbnail rasterization DPI (~36–60 dpi)
- Whether to add toggle keyboard shortcuts (recommend skip for v1)
- Whether category-collapsed state persists across sessions (recommend localStorage)

## Deferred Ideas

- Toggle visibility of markup categories (v2 PROD-02)
- Search / filter / sort inside TotalsPanel
- Per-thumbnail right-click context menu
- Custom precision / rounding controls
- Drag-to-reorder thumbnails
- Multi-window editing
- Keyboard shortcuts to toggle panels
- "Open Export" button on grand-total bar
- Pin-to-page / lock-to-page thumbnail behavior
- Per-page subtotal breakdown in panel
- AI-assisted auto-detection (out of project scope)
- CanvasHeaderBar zoom% / undo / dirty indicators
