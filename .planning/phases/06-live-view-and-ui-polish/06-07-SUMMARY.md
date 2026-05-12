---
phase: "06"
plan: "07"
subsystem: renderer/shell
tags: [integration, three-column-shell, canvas-overlay, prop-wiring]
dependency_graph:
  requires:
    - "06-01"  # useBoqLive, useUiPanels, useMarkupHighlight, usePageLabels
    - "06-02"  # Splitter, CanvasHeaderBar
    - "06-03"  # HoverRing, PulseHighlight
    - "06-04"  # TotalsPanel, TotalsCategoryBlock, TotalsRow
    - "06-05"  # TotalsRowContextMenu, row interaction wiring
    - "06-06"  # ThumbnailStrip, Thumbnail, useThumbnailRender
  provides:
    - "App.tsx three-column shell with all Phase 6 components wired"
    - "CanvasViewport Layer 2 HoverRing + PulseHighlight mount site"
  affects:
    - src/renderer/src/App.tsx
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
tech_stack:
  added: []
  patterns:
    - "Three-column flex shell (ThumbnailStrip | center | TotalsPanel)"
    - "App.tsx-as-orchestrator for useMarkupHighlight + useUiPanels (Q1 Option A)"
    - "Splitter live-drag via local state + commit-on-pointerup"
    - "Toast relocation into center column to prevent panel bleed"
    - "CanvasViewport optional props with safe defaults"
key_files:
  created: []
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
decisions:
  - "TotalsPanel mounts TotalsRowContextMenu internally (not App.tsx) so copy toast state is co-located with the context menu close handler"
  - "TotalsCategoryBlock threads onTriggerPulse to TotalsRow — TotalsRow already handles its own cycle navigation internally; prop is optional"
  - "CanvasViewport props are optional with safe defaults (hoverMatches=[], pulse=null) — backward compatible with existing callers before full wiring"
  - "copyToast stacked at bottom: 104px from canvas floor (above exportToast at 60px, above saveToast at 16px)"
metrics:
  duration: "~25min"
  completed: "2026-05-12"
  tasks_completed: 2
  files_modified: 4
---

# Phase 6 Plan 07: Integration — App.tsx Three-Column Shell Summary

Three-column App.tsx shell with useUiPanels + useMarkupHighlight orchestration, wiring every Phase 6 component into the running app with full prop flow from TotalsPanel row interactions to CanvasViewport overlays.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | CanvasViewport Layer 2 HoverRing + PulseHighlight mount | 8627250 | CanvasViewport.tsx |
| 2 | App.tsx three-column shell + full prop wiring | ee2f1ed | App.tsx, TotalsPanel.tsx, TotalsCategoryBlock.tsx |

## What Was Built

### Task 1: CanvasViewport Layer 2 transient block

- Added `CanvasViewportProps` interface with optional `hoverMatches`, `pulse`, `onPulseComplete` props (safe defaults so existing callers before this plan compile without changes)
- Imported `HoverRing` and `PulseHighlight` components
- Mounted the Phase 6 Layer 2 transient block between Layer 1b (committed markups) and the existing polygon-drawing Layer 2
- `listening={false}` on the new Layer and all shapes inside — overlay never steals hover events from underlying markup Groups (regression-guarded by `highlight-overlay-listening.test.ts`)
- Extended the page-change `useEffect` to call `props.onPulseComplete?.()` so stale pulses are cleared on navigation (T-06-07-02)

### Task 2: App.tsx three-column shell

**Imports added:**
- `ThumbnailStrip`, `TotalsPanel`, `CanvasHeaderBar`, `Splitter` components
- `useUiPanels`, `useMarkupHighlight` hooks
- `COLORS` constant

**State added:**
- `useUiPanels()` — localStorage-backed panel widths + open/closed state
- `useMarkupHighlight()` — transient HoverRing + PulseHighlight lifecycle
- `thumbnailsDragWidth` / `totalsDragWidth` — live Splitter drag state (local only; committed to localStorage only on pointerup)
- `containerRef` + `containerWidth` — window-width tracker for Splitter 50% max cap
- `copyToast` — Phase 6 D-14 copy confirmation with 2000ms parent-owned dismiss

**JSX `<main>` replaced with three-column flex row:**
```
ThumbnailStrip → Splitter(left) → [center column] → Splitter(right) → TotalsPanel
```

Center column has `minWidth: 0` — critical to prevent canvas's intrinsic content from blocking shrink when both side panels are open.

CanvasHeaderBar renders inside center column above CanvasViewport (only when `totalPages > 0`).

Toasts (save/export/copy) moved from direct `<main>` children into the center column's relative-positioned wrapper — they no longer bleed across side panels.

**TotalsPanel wiring:**
- `onRowHover={setHoverMatches}` — hover ring lifecycle
- `onTriggerPulse={triggerPulse}` — click pulse lifecycle
- `onCopy={(msg) => setCopyToast(msg)}` — D-14 copy toast
- `onCopyError={() => setCopyToast('Copy failed.')}` — D-14 error toast

**TotalsPanel + TotalsCategoryBlock — additive changes (deviation Rule 2):**
The `onTriggerPulse` prop was not yet threaded from TotalsPanel → TotalsCategoryBlock → TotalsRow. Added the prop to both interfaces and threaded it through. TotalsRowContextMenu was not yet mounted anywhere — added mounting to TotalsPanel body so the context menu renders at the right-click position with the copy toast callbacks wired.

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] TotalsPanel: mount TotalsRowContextMenu + thread onTriggerPulse**
- **Found during:** Task 2 implementation
- **Issue:** TotalsPanel accepted `onRowContextMenu` callback but never mounted `TotalsRowContextMenu`. The context menu would never appear on right-click. `onTriggerPulse` was not threaded from TotalsPanel → TotalsCategoryBlock → TotalsRow even though TotalsRow had the optional prop ready.
- **Fix:** Added `TotalsRowContextMenu` import and state (`contextMenuState`) to TotalsPanel; wired right-click → context menu mount → `onCopy`/`onCopyError` callbacks. Added `onTriggerPulse` prop to TotalsPanel and TotalsCategoryBlock interfaces, threaded to TotalsRow.
- **Files modified:** TotalsPanel.tsx, TotalsCategoryBlock.tsx
- **Commit:** ee2f1ed (included in Task 2 commit)

## Verification

- `npx tsc --noEmit`: exit 0 (0 TypeScript errors)
- `npx vitest run`: 412/412 tests pass (3 pre-existing exceljs missing-package failures unchanged)
- Three-column shell correct: `flex: 1, display: flex, flexDirection: row` on `<main>`
- Center column has `minWidth: 0`
- CanvasViewport receives `hoverMatches`, `pulse`, `onPulseComplete` from App.tsx
- TotalsPanel receives `onRowHover`, `onTriggerPulse`, `onCopy`, `onCopyError`
- HoverRing + PulseHighlight mounted on Layer 2 with `listening={false}`
- Page-change effect clears pulse via `onPulseComplete?.()`

## Known Stubs

None — all props are fully wired end-to-end.

## Threat Flags

No new security-relevant surface introduced beyond the threat model in the plan frontmatter. Both T-06-07-01 and T-06-07-02 are mitigated:
- T-06-07-01 (localStorage per-frame): Splitter `onDragWidth` → local state only; `onCommit` (pointerup) → `setThumbnailsWidth`/`setTotalsWidth` → localStorage. Zero localStorage writes during drag.
- T-06-07-02 (stale HoverRing on page change): CanvasViewport page-change effect calls `onPulseComplete?.()`. HoverRing renders only while `hoverMatches.length > 0`; TotalsRow `onMouseLeave` calls `onHover([])` → `setHoverMatches([])`.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/renderer/src/App.tsx | FOUND |
| src/renderer/src/components/CanvasViewport.tsx | FOUND |
| .planning/phases/06-live-view-and-ui-polish/06-07-SUMMARY.md | FOUND |
| Commit 8627250 (Task 1) | FOUND |
| Commit ee2f1ed (Task 2) | FOUND |
| TypeScript clean (0 errors) | PASS |
| 412 tests pass | PASS |
