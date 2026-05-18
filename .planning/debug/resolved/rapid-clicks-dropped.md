---
status: fixed_pending_user_verify
trigger: "Rapid clicking with a markup tool active (both Count and Linear/Area/Perimeter/Wall vertex placement) drops clicks — some intended clicks register no markup placement at all. User reports this affects both tool families; uncertain when it started."
created: 2026-05-18T23:55:00Z
updated: 2026-05-18T23:00:00Z
related_phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
related_quick_task: 260518-rcp-fix-rapid-click-drops
related_debug_session: lmb-hold-drops-markup-on-release
fix_applied: true
fix_commit: a8c37eb
fix_mode: "Option 2 — delta-at-click-time (user-selected after diagnose-only walkthrough)"
mode: --diagnose (root-cause only; user then applied Option 2 in a follow-up /gsd-quick)
---

## Current Focus

hypothesis: **PRIMARY** — Commit 665835f added a 4px movement threshold (`markupDraggedRef`) to suppress click after a hold-and-move. The threshold is measured in raw screen pixels via `stage.getPointerPosition()` and is sticky: once the flag flips true at any point during the hold, the upcoming click is suppressed even if the pointer returned to within 4px by mouseup. A fast jab (the typical rapid-click gesture) almost always has 5-15px of wrist drift between mousedown and mouseup. Result: every drifty fast click is dropped silently.

**SECONDARY** — Konva fires the `click` synthetic event only when mouseup target equals mousedown target. On very fast clicks, the pointer can leave the Stage element (or land on a different listening shape) between down and up; no click fires. This is browser-native semantics and orthogonal to our threshold.

**TERTIARY (low probability)** — Hit-area interception. Once a count pin or polyline vertex is placed, its interactive Group (Layer 1b, `listening={true}`) intercepts subsequent clicks within its bounds. In Count mode this is currently a silent no-op (`handleMarkupClick:367-369` returns early when `activeTool !== 'select'`). Affects rapid clicking only when subsequent clicks land within ~10px (pin radius) of an already-placed pin.

test: User scenario report covers both Count and Linear/Area/Perimeter/Wall — universal across markup tools. The two universal causes (primary + secondary) match. Tertiary is tool-specific and would not explain Linear-vertex drops on empty canvas, so it is not the dominant cause.

expecting: User decides whether to apply a mitigation (and which mode), or accept current behavior. No code change in this session per `--diagnose` flag.

next_action: Present root-cause report + three mitigation options for user selection. On selection, open a `/gsd-quick` task to apply.

## Symptoms

expected: Every LMB click on the canvas with a markup tool active places a markup (pin / vertex) regardless of click speed. Standard estimating workflow involves rapid-fire counts.
actual: Some rapid clicks register no placement. Visually: user clicks 5 times in quick succession, expects 5 pins, gets 3 or 4. For Linear/Area/Perimeter/Wall: user clicks 5 quick vertices, ends up with 3 or 4 vertices in the resulting polygon/line.
errors: None (silent drops).
reproduction: 1) Activate Count tool (or any markup tool with a draw in progress). 2) Rapidly click 5+ times in different empty-canvas locations. 3) Compare count of pins/vertices placed to count of intended clicks.
started: Unknown per user. The 4px threshold was added 2026-05-18 in commit 665835f. Konva click-target-equality is browser-native (pre-existing). If primary cause: started today. If secondary or pre-existing: always flaky to some degree, just more noticeable now.

## Eliminated

- timestamp: 2026-05-18T23:55:00Z
  hypothesis: "React 19 StrictMode double-invocation of setState updater drops clicks"
  why_rejected: That bug was the OPPOSITE direction — one click placing TWO markups (debug session count-tool-double-click, resolved 2026-04-21 by hoisting the placeMarkup side-effect out of the setState updater). Doesn't drop clicks.

- timestamp: 2026-05-18T23:55:00Z
  hypothesis: "Konva dblclick consumes one of two rapid clicks"
  why_rejected: Konva fires `click` for BOTH the first and second click within a dblclick burst, AND fires `dblclick` after. dblclick is additive, not exclusive. For Linear/Wall, dblclick happens to commit the markup — but the two clicks still fire as `click` first and place two vertices before dblclick lands. Doesn't drop clicks.

## Evidence

- timestamp: 2026-05-18T23:55:00Z
  checked: CanvasViewport.tsx — handleStageMouseMove drag-detection block (added in 665835f) and handleStageClick wasDragged early-exit
  found: |
    handleStageMouseMove:
      const downPos = markupMouseDownPosRef.current
      if (downPos && !markupDraggedRef.current) {
        if (Math.abs(pointer.x - downPos.x) > 4 || Math.abs(pointer.y - downPos.y) > 4) {
          markupDraggedRef.current = true
        }
      }
    handleStageClick:
      const wasDragged = markupDraggedRef.current
      markupMouseDownPosRef.current = null
      markupDraggedRef.current = false
      ...
      if (markupState.mode === 'drawing' || markupState.mode === 'placing') {
        if (wasDragged) return // held-and-moved: do not place a point
        ...
      }
  implication: The flag is sticky — once max pointer travel exceeds 4px at ANY point during the hold, the upcoming click is suppressed unconditionally. There is no "compare delta at click time" path that would let a fast out-and-back gesture through.

- timestamp: 2026-05-18T23:55:00Z
  checked: Konva.Stage.prototype.getPointerPosition behavior
  found: Returns pointer position relative to the stage container in RAW screen pixels (not transformed by stage.scale). A 1px screen movement = 1 unit in the threshold comparison.
  implication: The 4px threshold is in screen pixels, not world pixels. At any zoom level, 4 screen pixels is a tiny margin — a fast hand can easily move 8-15 screen pixels between mousedown and mouseup without consciously dragging. Every such click gets dropped silently.

- timestamp: 2026-05-18T23:55:00Z
  checked: Browser-native click event semantics (Chromium 134 via Electron 35)
  found: A DOM `click` is dispatched on mouseup only when the mouseup target's element matches the mousedown target's element. Konva proxies this with `_mouseListenClick`. If the pointer's mouseup target differs (e.g. user moved off the Stage div or onto a markup Group between events), no `click` fires on the Stage.
  implication: Independent of the threshold, very fast clicks can hit this. Less impact than the threshold but contributes a baseline drop rate.

- timestamp: 2026-05-18T23:55:00Z
  checked: handleMarkupClick (CanvasViewport.tsx:366-369) and Layer 1b listening=true configuration
  found: When activeTool !== 'select', clicks on existing markup Groups are silently dropped (early return). Layer 1b is listening=true (per plan 03.1-05 SUMMARY).
  implication: A rapid-click sequence that clusters near previously-placed pins/vertices will drop additional clicks that land on the existing Groups. Lower-impact secondary cause; relevant only when clicks cluster geographically.

## Hypothesis (consolidated)

The PRIMARY cause of rapid-click drops is the 4px sticky-movement-threshold added in commit 665835f. The threshold is correct in concept (suppress click after deliberate hold-and-drag) but mis-calibrated in two dimensions for the rapid-click use case:

1. **Threshold too tight in screen pixels.** 4px is the dead-zone Konva uses for its rubber-band, where the user is making a deliberate drag gesture. A rapid placement click is a different gesture profile — the user's wrist often introduces 5-15px of unintentional drift inside a fast jab. The threshold treats these as "drags" and suppresses them.
2. **Sticky flag has no "intent recovery" path.** Once `markupDraggedRef` flips to true at any point during the hold, no later evidence can clear it. A "fast jab with brief overshoot that returns to near the down-pos" — exactly the rapid-click gesture — is treated identically to a deliberate hold-and-drag.

The SECONDARY cause (Konva click-target equality) contributes a baseline drop rate of perhaps 1-3% for very fast clicks but is not the dominant signal. It cannot be eliminated without rewriting the click pipeline to use pointerdown/pointerup directly.

## Mitigation Options (NOT APPLIED — `--diagnose` only)

### Option 1 — Loosen the threshold (lowest-risk, smallest change)
- Raise the 4px threshold to 8px (or 10px). Movement <8px is treated as a click; ≥8px still suppresses.
- Keeps the same code shape; one literal swap.
- Risk: A user who deliberately drags 5-7px to "pan" with Spacebar+LMB might still place a markup. Mostly cosmetic — Spacebar+LMB pan is gated by spaceHeld, so this doesn't actually overlap with the suppression path.
- Risk: A user who deliberately holds-and-moves 5-7px before releasing now places a markup at the release point. Could feel "less responsive" but matches the original UX before fix 665835f.

### Option 2 — Switch to delta-at-click-time (intent-recovery)
- Replace the sticky flag with a final-delta check inside handleStageClick: compare current pointer pos to markupMouseDownPosRef and suppress only if the FINAL delta exceeds the threshold.
- A fast jab with brief overshoot returning to near the down-pos = click placed.
- A deliberate hold-and-drag-to-a-different-spot = click suppressed.
- Risk: A user who deliberately drags 50px out and 50px back to almost the same spot = click placed. Vanishingly rare gesture — generally not a regression worth optimizing for.
- Code change: drop the mousemove-driven flag entirely; do the delta calculation once in handleStageClick using markupMouseDownPosRef + the click handler's pointer.

### Option 3 — Threshold + time gate (most permissive)
- Suppress only if (delta > threshold) AND (hold duration > 150ms). Quick clicks under 150ms always place even if jittery.
- Captures the user's intuition: "if it was a deliberate hold, suppress; if it was a quick jab, place".
- Risk: A user with a slightly slow click (>150ms) and >threshold drift is still suppressed. Less aggressive than Option 1+2 alone.
- Code change: add a markupMouseDownTimeRef alongside the pos ref; check both in handleStageClick.

### Recommended (if asked)
**Option 2** — delta-at-click-time. Cleanest semantics, smallest cognitive load ("only the final position matters"), preserves the hold-and-drag suppression for the genuinely-deliberate case. Mirrors how most CAD tools handle click vs. drag.

## Resolution

mode: Option 2 — delta-at-click-time (user-selected).
quick_task: 260518-rcp-fix-rapid-click-drops
fix_commit: a8c37eb
files_changed:
  - src/renderer/src/components/CanvasViewport.tsx
changes:
  - markupDraggedRef removed entirely (was a sticky boolean that flipped true once max pointer travel during the hold exceeded 4px).
  - The handleStageMouseMove block that maintained markupDraggedRef is gone.
  - handleStageClick now computes wasDragged at click time as `downPos !== null && (|dx| > 4 || |dy| > 4)` where downPos is the captured mousedown screen position.
  - 4px threshold kept — but now measures intent (final displacement) instead of noise (max travel).
verification:
  - npm run typecheck → exit 0
  - npx vitest run → 473 / 473 pass
  - grep -n markupDraggedRef src/ → no matches
  - live re-verify → pending
notes:
  - Net diff is a deletion: -5 lines vs commit 665835f.
  - Mid-flight wobble that returns near the down-pos is now placed (rapid clicks work as intended). A deliberate hold-and-drag-to-elsewhere still suppresses (UAT Test 11 follow-up contract preserved).
  - "Delta-at-click-time" pattern is the natural successor to the sticky-flag pattern any time click-vs-drag disambiguation matters — the question is always "where did you END UP", never "where did you wander".
