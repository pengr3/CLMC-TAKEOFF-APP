---
id: 260518-rcp
title: Fix rapid-click drops — switch markup-tool click suppression from sticky-flag to delta-at-click-time
date: 2026-05-18
status: in-progress
mode: quick
followup_to:
  - debug_session: rapid-clicks-dropped
  - previous_commit: 665835f (LMB hold-and-move suppression — introduced the sticky flag)
---

# Quick Task 260518-rcp: Rapid-click drop fix

## Description

User reported that rapid clicks against the canvas (any markup tool — Count, Linear, Area, Perimeter, Wall) were being dropped silently. Diagnosed in `.planning/debug/rapid-clicks-dropped.md` as the sticky `markupDraggedRef` introduced in commit 665835f: the flag goes true once max pointer travel exceeds 4px during the hold and never recovers, so a fast jab that returns near the press-point still has its click suppressed. Replace with delta-at-click-time so only the FINAL displacement (mousedown → mouseup) decides click-vs-drag.

## Task 1: CanvasViewport.tsx — drop sticky flag, compute final delta in handleStageClick

**Truth:** A rapid click on empty canvas places a markup. A deliberate hold-and-drag to a different spot still does not (UAT Test 11 follow-up remains satisfied).

**Action:**
- Remove the `markupDraggedRef = useRef(false)` declaration and all its references (5 sites total).
- Remove the mousemove drag-detection block (sets `markupDraggedRef.current = true` on >4px max travel).
- In `handleStageClick`, replace `const wasDragged = markupDraggedRef.current` with a direct delta calc against `markupMouseDownPosRef.current` using the click handler's pointer:
  ```ts
  const downPos = markupMouseDownPosRef.current
  markupMouseDownPosRef.current = null
  const wasDragged =
    downPos !== null &&
    (Math.abs(pointer.x - downPos.x) > 4 || Math.abs(pointer.y - downPos.y) > 4)
  ```
- Keep the 4px threshold — now measuring intent (final displacement), not noise (max travel).
- Window mouseup cleanup still clears `markupMouseDownPosRef`.

**Verify:** `npm run typecheck` clean. `npx vitest run` stays 473/473 green. Grep for `markupDraggedRef` returns zero matches across `src/`.

**Done when:** Code committed atomically; debug session moved to `.planning/debug/resolved/`; STATE.md Quick Tasks table updated.

## Files modified

- `src/renderer/src/components/CanvasViewport.tsx` — net deletion (sticky-flag pattern is smaller as a final-delta check).
- `.planning/debug/resolved/rapid-clicks-dropped.md` (moved + annotated).
- `.planning/STATE.md` — Quick Tasks row appended.
