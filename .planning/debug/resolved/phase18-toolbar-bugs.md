---
status: resolved
trigger: "Four bugs found during Phase 18 (toolbar-revamp) human-verify checkpoint (plan 18-09, Task 4)"
created: 2026-07-15
updated: 2026-07-15
phase: 18-toolbar-revamp
resolution:
  bug1_bug2: "285f3d4 — ContextBar selected state no longer auto-focuses a rename input; read-only name + explicit click-to-rename. Kills the focus-steal that trapped keyboard focus and made F3/Shift+A/Delete bail. Focus-steal regression guard test added."
  bug3: "2176405 — verified arc write/read/draw paths consistent (no inversion, no reachable stuck-arcHeld window after 285f3d4); the intermittent desync was a downstream symptom of the focus-steal (Shift+A bailing while a rename input held focus). No drawing-code change; arc-toggle-sync.test.ts locks in the seam<->arcMode lockstep + the isTextInputActive guard behavior."
  bug4: "32e62be — React.memo on CanvasViewport (+ memoized onReopenToast prop) and EstimatePanel so a splitter width-drag no longer re-renders the Konva stage 60-120x/sec. splitter-drag-commit.test.ts added."
  gates: "typecheck PASS; vitest 845/845; npm run build clean"
  ergonomics_open: "User finds Shift+A awkward. The Phase-18 Arc toggle button (rail + context bar) already toggles arc by click (no keyboard). Shift+A is a single-press sticky toggle (not a hold). No keybind changed — offered to the user as an optional follow-up."
---

# Phase 18 Toolbar Revamp — Post-checkpoint bug batch (RESOLVED)

Four bugs reported by the user during the 18-09 human-verify checkpoint. All resolved; the
Phase 18 checkpoint can now be re-verified.

## Symptoms (user-reported)
1. ContextBar selected-state bugged — selecting a markup drops the name into a focused, select-all'd edit field (confirmed symptom "a").
2. F3 snap toggle fails while marking up.
3. Arc render desync (intermittent) — "seems fine now"; asked to verify + note Shift+A ergonomics.
4. Splitter/curtain drag lag (pre-existing Phase 6, out of scope, fix-anyway).

## Root cause
Bugs 1 + 2 shared ONE root cause: `ContextBar.SelectedPanel` rendered `InlineRenameInput`
unconditionally on selection, and `InlineRenameInput` focus+select-all's on mount
(InlineRenameInput.tsx:45-51). Mere selection stole keyboard focus; `isTextInputActive()`
then made every global shortcut (F3 / Shift+A / Delete / Ctrl+Z) bail. Bug 3's intermittent
desync was a downstream symptom (Shift+A bailing while focus was trapped). Bug 4 was an
independent per-frame re-render of the whole App tree (incl. the Konva canvas) during splitter drag.

## Fixes
- 285f3d4 fix(18-09): ContextBar selected state → read-only name + click-to-rename (no focus steal).
- 32e62be perf(canvas): React.memo CanvasViewport (+ memoized onReopenToast) + memo EstimatePanel.
- 2176405 test(arc): verify arc lockstep + Shift+A focus-guard; no drawing-code change (no reachable stuck-arcHeld window remains after 285f3d4).

## Gates
typecheck PASS · vitest 845/845 · npm run build clean.

## Open (non-blocking)
Shift+A ergonomics — the Arc toggle button already provides click-based arc toggling; Shift+A
is a single-press sticky toggle (not a hold). No keybind changed; offered as an optional follow-up.
