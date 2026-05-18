---
id: 260518-rcp
title: Fix rapid-click drops — switch markup-tool click suppression from sticky-flag to delta-at-click-time
date: 2026-05-18
status: complete
mode: quick
code_commit: a8c37eb
followup_to:
  - debug_session: rapid-clicks-dropped
  - previous_commit: 665835f
---

# Quick Task 260518-rcp: Rapid-click drop fix — SUMMARY

## Outcome

Rapid-click drops in markup tools (Count, Linear, Area, Perimeter, Wall) eliminated. The 665835f LMB-hold suppression contract is preserved: a deliberate hold-and-drag to a different spot still suppresses the click. Net diff is smaller than 665835f added — the final-delta check is more compact than the mousemove sticky-flag pattern. Awaiting user live re-verify.

## Change

Single file: `src/renderer/src/components/CanvasViewport.tsx`.

- Removed `markupDraggedRef` declaration and all 5 references.
- Removed the mousemove block that flipped the sticky flag to true on >4px max travel.
- Replaced the sticky read in `handleStageClick` with a final-delta calc against `markupMouseDownPosRef`:
  ```ts
  const downPos = markupMouseDownPosRef.current
  markupMouseDownPosRef.current = null
  const wasDragged =
    downPos !== null &&
    (Math.abs(pointer.x - downPos.x) > 4 || Math.abs(pointer.y - downPos.y) > 4)
  ```
- Kept the 4px threshold and the `markupMouseDownPosRef` capture in `handleStageMouseDown`.
- Window mouseup cleanup unchanged except it now only clears the pos ref (the dragged ref is gone).

## Decision: why delta-at-click-time and not threshold-tuning or time-gating

- **Loosen-to-8px (Option 1)** would have shrunk the buggy window but kept asking the wrong question ("did the pointer wander mid-flight?"). A user who deliberately holds-and-drags 7px would now place a markup. Same bug shape, smaller frequency.
- **Time gate (Option 3)** stacks a magic-number-in-time on top of a magic-number-in-pixels — two thresholds to reason about, feels laggy on slow hardware.
- **Delta-at-click-time (Option 2 — chosen)** asks the right question: "did your finger END UP somewhere different from where you pressed?" Mid-flight wobble becomes irrelevant. Matches Illustrator / Figma / SketchUp conventions. Code is also smaller.

## Verification

- `npm run typecheck` → exit 0.
- `npx vitest run` → 66 files, **473 / 473 tests pass** (no regression).
- `grep -n markupDraggedRef src/` → no matches (clean removal).
- Live re-verify → pending user (next step).

## Commit

- Code: `a8c37eb` — `fix(09-03): rapid-click drops — replace sticky-flag with delta-at-click-time`.
- Docs: pending (this SUMMARY + STATE.md row + debug session resolution).

## Follow-ups

User to live-verify two flows in `npm run dev`:
1. **Rapid Count clicks place every time.** 10+ fast jabs in different empty spots → 10+ pins.
2. **Deliberate hold-and-drag still suppresses.** Press LMB, drag visibly across the canvas (>4px), release → no markup dropped.
