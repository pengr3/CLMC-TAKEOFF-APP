---
slug: rapid-click-dblclick-modal
status: resolved
trigger: "Rapid clicks drop on all markup tools; Linear tool triggers 'Add at least two points before ending' modal on fast clicks, tool then broken until tool switch; user wants double-click finish removed entirely"
created: "2026-05-19"
updated: "2026-05-19"
---

# Debug Session: rapid-click-dblclick-modal

## Symptoms

- **Expected**: Rapid clicks on canvas place markup vertices/pins without drops; all tools usable at fast speed
- **Actual (1)**: Rapid clicks drop on ALL tools — Count, Linear, Area/Perimeter, Wall
- **Actual (2)**: On Linear tool, fast clicks sometimes trigger "Add at least two points before ending" modal; after dismissing modal, Linear tool is broken (clicks do nothing) until user switches away and back
- **Timeline**: Persists through commit a8c37eb (delta-at-click-time fix applied 2026-05-18) — fix reduced but did not eliminate drops
- **Reproduction**: Open any markup tool, click rapidly at multiple canvas locations
- **User request**: Remove double-click finish entirely for all multi-vertex tools — use only Enter key or finish button

## Hypotheses

- **H1 (primary)**: Double-click detection interprets two fast single-clicks as a double-click, firing "finish shape" prematurely when 0 or 1 points are placed → triggers the "add at least two points" guard modal → leaves tool in corrupted/inconsistent state
- **H2**: The modal's dismiss path does not fully reset the markup tool state machine, leaving it in a partially-committed state that blocks further clicks
- **H3**: The delta-at-click-time fix (a8c37eb) guards against markup drops on mouseup but does not prevent double-click events from being synthesised by the browser when two clicks land within the OS double-click threshold (~300-500ms)

## Current Focus

```yaml
hypothesis: "H1 + H2 both confirmed — FIXED"
next_action: "complete"
```

## Evidence

- timestamp: 2026-05-19T00:00:00Z
  file: src/renderer/src/components/CanvasViewport.tsx
  finding: "handleStageDblClick callback (lines 776-784) called finishLinear() on every OS-level double-click event. When two rapid single clicks landed within the OS dblclick threshold, browser synthesised a dblclick, firing finishLinear() before 2 vertices were placed."

- timestamp: 2026-05-19T00:00:00Z
  file: src/renderer/src/hooks/useMarkupTool.ts
  finding: "finishLinear() error path (when points.length < 2) returned { mode: 'idle', points: [], errorToast: '...' }. After error, recordClick guard (prev.mode === 'drawing') blocked all further clicks. dismissError() only cleared errorToast but did not restore mode to 'drawing', leaving the tool permanently broken until tool switch."

- timestamp: 2026-05-19T00:00:00Z
  file: src/renderer/src/hooks/useMarkupTool.ts
  finding: "finishPolygon() had the same error-path bug: mode reset to 'idle' instead of staying in 'drawing'."

## Eliminated

- H3 (delta-at-click-time as root cause of drops): The hold-vs-click delta suppression was correct and not the source of dropped vertices. The drops were caused by the dblclick handler consuming two rapid clicks as a finish gesture.

## Resolution

```yaml
root_cause: "Browser synthesises a dblclick event from two rapid single-clicks within OS threshold (~300-500ms). CanvasViewport.handleStageDblClick called finishLinear() on this event, which triggered the 'add at least two points' validation guard (H1). The error path in finishLinear and finishPolygon then set mode to 'idle' instead of keeping it in 'drawing', leaving the tool unable to accept further clicks after any error (H2)."
fix: "1) Removed handleStageDblClick callback and onDblClick Stage prop from CanvasViewport.tsx entirely — double-click finish no longer exists for any tool. 2) Fixed finishLinear() and finishPolygon() error paths in useMarkupTool.ts to spread ...prev (keeping mode: 'drawing') instead of resetting to 'idle', so the tool remains live after a degenerate-shape attempt. Enter key remains the sole finish gesture for Linear/Wall (>=2 pts) and Area/Perimeter (>=3 pts)."
verification: "TypeScript build passes (tsc --noEmit clean). Manual: rapid clicks should all land as vertices; 'add at least two points' toast should no longer appear on rapid click; tool stays usable after any error; Enter key still finishes shapes; Count tool unaffected."
files_changed:
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/hooks/useMarkupTool.ts
```
