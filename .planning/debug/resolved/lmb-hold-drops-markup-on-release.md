---
status: fixed_pending_user_verify
trigger: "After commit 4db36bb (UAT Test 11 fix), holding LMB during any markup tool (count / linear / area / perimeter / wall) and releasing it drops a markup on the canvas. User wants a held-then-released LMB to do nothing — only a quick click should place."
created: 2026-05-18T22:30:00Z
updated: 2026-05-18T22:45:00Z
related_phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
related_uat_test: 11
related_quick_task: 260518-uat-fix-phase09-uat-gaps
fix_commit: 665835f
fix_mode: A (movement threshold, 4px — user-selected)
---

## Current Focus

hypothesis: CONFIRMED. Commit 4db36bb removed LMB from `Konva.dragButtons` for markup tools to fix UAT Test 11 (no LMB pan during markup). Konva fires `click` on every mouseup that wasn't preceded by an internal Stage drag. Pre-4db36bb, LMB started a Stage drag → mouseup ended the drag and suppressed `click` → no markup placed. Post-4db36bb, LMB never starts a drag → every mouseup fires `click` → `handleStageClick` (CanvasViewport.tsx:609) runs `recordMarkupClick` and places a vertex/pin. The fix removed an implicit "no-click-after-drag" gate without replacing it with an explicit one.

test: Read CanvasViewport.tsx handlers (handleStageMouseDown:665-679, handleStageMouseMove:686-709, handleStageMouseUp:717-732, handleStageClick:609-657). Confirmed:
  1. handleStageMouseDown early-returns for any non-'select' tool (line 668) — no down-position tracking for markup mode today.
  2. handleStageMouseUp early-exits on `!rb` (line 719) — only handles rubber-band, ignores markup mouseup.
  3. handleStageClick's markup branch (line 624) has no movement check — runs on every Konva click.
  4. The existing rubber-band path already uses the exact pattern needed: rubberBandDraggedRef + 4px movement threshold (lines 297-300, 720-730).

expecting: User confirms the chosen suppression mode (movement threshold vs hold-time vs both), then I apply, test, commit, ask for live re-verification.

next_action: Present the fix design (movement-threshold recommended, mirrors existing rubber-band code) and the alternative (hold-time) to the user. On selection, apply, run typecheck + vitest, commit, request live re-verify.

## Symptoms

expected: Holding LMB during a markup tool and releasing it does NOTHING — no point placed, no pin dropped. Only a quick LMB click (mousedown + mouseup, no movement) should place a markup point.
actual: Holding LMB during any markup tool and releasing it places a markup point at the release position — the same as a quick click.
errors: None.
reproduction: 1) Activate a markup tool (Count, Linear, Area, Perimeter, or Wall). 2) Press and HOLD LMB anywhere on the canvas. 3) (Optionally move the pointer.) 4) Release LMB. Observe: a markup point is committed.
started: After commit 4db36bb (2026-05-18 — Quick task 260518-uat fixing Phase 09 UAT Test 11).

## Eliminated

(none yet — single hypothesis, immediately confirmed by code read)

## Evidence

- timestamp: 2026-05-18T22:30:00Z
  checked: CanvasViewport.tsx onMouseDown / onMouseMove / onMouseUp / onClick wiring (lines 844-847) and handler bodies
  found: handleStageClick (line 609) is wired to Stage onClick. Konva onClick fires after every mouseup that wasn't a drag. handleStageMouseDown (line 665) only acts in 'select' mode — it has no equivalent down-position tracking for markup mode. handleStageMouseMove (line 686) similarly only updates rubber-band / preview. handleStageMouseUp (line 717) early-exits when `!rubberBandRef.current` — does nothing in markup mode.
  implication: There is no current path that suppresses the click after a "held" LMB during markup. Adding one mirrors the existing rubberBandDraggedRef pattern (line 300 / 720-730).

- timestamp: 2026-05-18T22:30:00Z
  checked: Pre-4db36bb behavior — `Konva.dragButtons = spaceHeld || activeTool !== 'select' ? [0, 1] : [1]` enabled LMB drag for every markup tool
  found: When LMB drag is enabled, Konva captures the mousedown, follows mousemove as a Stage drag, and the subsequent mouseup ends the drag WITHOUT firing the click event. This is the "implicit gate" that previously kept LMB-held-and-released from placing a markup.
  implication: The original Test 11 bug (LMB pans during markup) and the new bug (LMB-hold places on release) are two sides of the same coin. Fixing Test 11 by killing LMB drag exposed the always-on click path that drag had been masking. The proper fix is to add an explicit "did the pointer move while held" gate, not to re-enable LMB drag.

## Hypothesis

When a markup tool is active and LMB is pressed, Stage onClick (which fires on every mouseup unless an internal Konva drag was active) runs `recordMarkupClick` unconditionally because the implicit drag-suppresses-click protection was removed in 4db36bb. Mirroring the existing rubberBandDraggedRef pattern with a `markupDraggedRef` and a `markupMouseDownPosRef` lets `handleStageMouseMove` set a "moved >4px" flag during the hold, and `handleStageClick` early-exits when that flag is set before recording the click.

## Proposed Fix (awaiting user confirmation)

**Mode A — movement threshold (recommended, mirrors rubber-band pattern):**
- `handleStageMouseDown`: on LMB during any markup tool (and no spacebar), capture the down-pos and reset the dragged flag.
- `handleStageMouseMove`: while a markup down-pos is recorded, if pointer delta > 4px, set markupDraggedRef.
- `handleStageClick`: at top of the markup branch, if markupDraggedRef is set, clear it + the down-pos and early-exit (no point placed).
- `handleStageMouseUp` + window mouseup cleanup: clear refs on out-of-bounds release so they never leak into the next click.

**Mode B — hold-time threshold (alternative):**
- Same wiring but checks `(Date.now() - downTime) > 200ms` instead of movement delta.
- Risk: feels laggy on slow hardware; movement-based is more deterministic.

**Mode C — both:** movement OR time. Most permissive — easiest to "accidentally suppress" a real click.

Recommendation: Mode A. Threshold of 4px to match the rubber-band threshold (line 722) so the dead-zone is uniform across canvas gestures.

## Files to touch (Mode A)

- src/renderer/src/components/CanvasViewport.tsx — refs + handler edits (4 handlers)
- (potentially) test: a small unit test mirroring the rubber-band-dragged-clears-click pattern; or add to an existing markup-tool test

## Resolution

mode: A — movement threshold (≥4px), per user selection.
files_changed:
  - src/renderer/src/components/CanvasViewport.tsx
changes:
  - Added markupMouseDownPosRef + markupDraggedRef alongside rubberBandDraggedRef.
  - Extended the window-mouseup cleanup useEffect to clear both markup refs (handles release-outside-canvas).
  - handleStageMouseDown: when LMB pressed and isMarkupTool(activeTool) && !spaceHeld, record the pointer screen position and reset markupDraggedRef.
  - handleStageMouseMove: while markupMouseDownPosRef is set, flip markupDraggedRef to true once the pointer moves >4px in either axis from the down-pos.
  - handleStageClick: at the top of the handler, snapshot markupDraggedRef into wasDragged and reset both refs unconditionally. The markup branch then early-exits when wasDragged is true — no point placed.
verification:
  - npm run typecheck: clean
  - npx vitest run: 66 files / 473 tests pass (no regression)
  - live UAT re-verify: pending
notes:
  - Threshold matches the rubber-band 4px threshold (line ~722) for a uniform dead-zone across canvas gestures.
  - The refs are reset on every click invocation — a single suppressed click cannot leak into the next gesture.
  - This preserves the quick-click placement UX: mousedown + immediate mouseup with no movement still places. Only a held-and-moved LMB is silent.
