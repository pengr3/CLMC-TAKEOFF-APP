---
slug: rapid-click-movement-threshold
status: resolved
trigger: "Rapid clicks drop when user's hand is moving during click — mouse drifts >4px between mousedown and mouseup on a fast click; 4px delta-at-click-time guard (a8c37eb) suppresses these as drags; rubber-band drag suppression should not apply in markup tool mode"
created: "2026-05-19"
updated: "2026-05-19"
---

# Debug Session: rapid-click-movement-threshold

## Symptoms

- **Expected**: Clicking rapidly to place markup vertices (Count, Linear, Area, Perimeter, Wall) registers all clicks even when the user's hand is in motion between locations
- **Actual**: Clicks that occur while the hand is still moving (i.e. mouse drifts >4px between mousedown and mouseup) are silently dropped — no vertex placed
- **Pattern**: Close-together rapid clicks work fine (hand stationary, small drift). Far-apart rapid clicks fail (hand moving, natural drift exceeds threshold)
- **All tools affected**: Count, Linear, Area, Perimeter, Wall
- **Root behavior**: a8c37eb introduced delta-at-click-time: compare mousedown pos to mouseup pos; if delta > 4px suppress as "drag". This was correct for rubber-band selection mode, but wrong for markup tool mode where rubber-band selection does not exist

## Hypotheses

- **H1 (primary)**: The 4px delta guard (a8c37eb) is applied unconditionally — it does not check whether a markup tool is active. In markup tool mode there is no rubber-band selection, so ANY mouseup should register as a vertex placement regardless of how far the mouse moved between mousedown and mouseup.
- **H2**: The correct fix is to make the drag-suppression conditional on the active tool: apply it ONLY when no markup tool is active (selection/pan mode); skip it entirely when a markup tool is active.

## Current Focus

```yaml
hypothesis: "H1 — confirmed and fixed"
next_action: "done"
```

## Evidence

- timestamp: 2026-05-19
  finding: "Guard located in handleStageClick (CanvasViewport.tsx ~line 641). wasDragged computed unconditionally from markupMouseDownPosRef without checking activeTool. isMarkupTool() already imported from '../types/viewer'."
  file: src/renderer/src/components/CanvasViewport.tsx
  lines: 641-646

## Eliminated

- H2 was not a separate hypothesis — the fix for H1 IS the tool-mode conditional

## Resolution

```yaml
root_cause: "The 4px delta guard in handleStageClick (a8c37eb) was applied unconditionally — it did not check activeTool. Rapid clicks while the hand drifts between locations (natural motion >4px between mousedown and mouseup) were being suppressed as rubber-band drags even in markup tool mode, where rubber-band selection does not exist."
fix: "Added `!isMarkupTool(activeTool) &&` to the wasDragged computation so the displacement guard is only applied in selection mode. isMarkupTool() was already imported. The rubber-band suppression remains fully intact in select mode."
verification: "tsc --noEmit clean. Manual verification checklist: (1) rapid spread-out clicks in markup mode all register, (2) rapid close clicks unchanged, (3) LMB press+drag>4px+release in select mode does NOT place markup, (4) Enter still finishes shapes."
files_changed:
  - src/renderer/src/components/CanvasViewport.tsx
```
