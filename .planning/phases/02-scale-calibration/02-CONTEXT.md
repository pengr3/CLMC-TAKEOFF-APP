# Phase 2: Scale Calibration - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-page scale calibration: user draws a line over a known dimension on the PDF, enters the real-world distance, and the app stores the resulting pixels-per-unit ratio. All measurement calculations in subsequent phases multiply pixel distances by this ratio. This phase delivers the math layer that every markup measurement depends on.

</domain>

<decisions>
## Implementation Decisions

### Calibration Line Interaction
- Toolbar "Set Scale" button activates a dedicated calibration mode (not always-on)
- User draws the line by clicking start point, moving, then clicking end point (click-click, CAD-style)
- After line is drawn, a small inline popup appears near the line end with a text input and unit dropdown for the real-world distance
- Popup displays the computed scale ratio (e.g. "1:100") and presents Confirm / Cancel buttons before accepting the scale

### Unit System
- Supported units: metric (mm, cm, m) and imperial (in, ft)
- Unit selection is a global app preference — one unit applies to all pages (construction projects don't mix units)
- The unit is chosen from the unit dropdown inside the Set Scale popup at calibration time
- Imperial uses decimal format only for v1 (1.5ft, 2.75in) — no fractional representation

### Scale Display and Status
- Scale is shown in the existing status bar: "Scale: 1:100" when set
- When a page has no scale, status bar shows "Scale: Not Set" in amber/orange
- The "Set Scale" toolbar button is visually highlighted (accent color) on uncalibrated pages to draw attention
- Re-calibration: clicking "Set Scale" again lets user draw a new line, which replaces the existing scale — no separate delete needed

### Data Model and Persistence
- New `scaleStore.ts` Zustand slice (separate from viewerStore) holds scale state
- Per-page data shape: `{ pixelsPerUnit: number, unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' }` keyed by page index
- The calibration line is a temporary decoration — removed after the user clicks Confirm (not persisted)
- A reset action is available to clear a page's scale back to "Not Set"

### Claude's Discretion
- Exact visual styling of the inline popup (size, shadow, position offset from line endpoint)
- Keyboard handling within the popup (Enter to confirm, Escape to cancel)
- How "Set Scale" mode is visually indicated on the canvas cursor (crosshair or ruler cursor)
- Whether the calibration line has a distinct color/style during drawing (e.g. dashed blue)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useViewerStore` (viewerStore.ts) — per-page viewport state pattern to mirror for scale store
- `CanvasViewport.tsx` — Konva Stage + Layer structure; Layer 1 (markup overlay) is where calibration line will render
- `StatusBar.tsx` — existing component for scale display; accepts new props or store subscription
- `Toolbar.tsx` + `IconButton` — existing pattern for toolbar buttons; Set Scale button follows same style
- `useViewportControls.ts` — interaction mode reference; calibration mode needs similar pointer event handling

### Established Patterns
- Zustand store per concern (viewerStore pattern) — scaleStore follows same shape
- Per-page state keyed by page index (`pageViewports: Record<number, ViewportState>`) — scale uses same pattern
- Module-level ref for cross-component imperative access (`getCanvasControls`) — calibration mode activation may use same pattern
- Inline styles only (no CSS modules or Tailwind used yet in components)

### Integration Points
- `CanvasViewport.tsx` Layer 1 — calibration line rendered here during Set Scale mode
- `StatusBar.tsx` — subscribed to scaleStore to show current scale / "Not Set"
- `Toolbar.tsx` — "Set Scale" button added; subscribes to scaleStore to highlight when uncalibrated
- `scaleStore.ts` (new) — lives alongside viewerStore.ts in `src/renderer/src/stores/`

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard approaches within the patterns established above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
