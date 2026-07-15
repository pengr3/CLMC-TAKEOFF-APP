---
status: awaiting_human_verify
trigger: "Splitter (right-side Totals) drag still laggy and 'leaves a trail' after commit 32e62be memoized CanvasViewport. Prior fix helped but was not enough."
created: 2026-07-15
updated: 2026-07-15
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Splitter onDragWidth={setTotalsDragWidth} calls React setState on EVERY pointermove (~60-120x/s). Even with CanvasViewport memoized, App re-renders each frame → the un-memoized heavy TotalsPanel (BOQ categories/rows via useBoqLive) re-renders every frame → dropped frames → 'trail'. Additionally TotalsPanel's div carries `transition: width 150ms`, so per-frame width changes ease 150ms behind the pointer, compounding the smear."
  confirming_evidence:
    - "App.tsx:63 `totalsDragWidth` useState; App.tsx:507 onDragWidth={setTotalsDragWidth} → setState per pointermove."
    - "effectiveTotalsWidth (App.tsx:64) feeds TotalsPanel.width (App.tsx:515); TotalsPanel is a plain (non-memo) component that runs useBoqLive + maps boq.categories every render."
    - "TotalsPanel.tsx:191 `transition: width 150ms ease-out` on the width-bearing div."
    - "commit 32e62be memoized only CanvasViewport — App + TotalsPanel still re-render per frame."
  falsification_test: "If, after removing the per-move setState and driving width via a DOM ref, a render-count probe on TotalsPanel shows renders during pointermove, the hypothesis is wrong."
  fix_rationale: "Drive the live panel width imperatively on the panel DOM node (ref) during onDragWidth — NO setState. Freeze the width transition during the drag so the panel tracks the pointer 1:1. Commit once on pointerup via setTotalsWidth (single re-render + single localStorage write). Zero React renders between pointerdown and pointerup → no dropped frames → no trail."
  blind_spots: "React inline-style diffing: after imperatively mutating style.transition, React won't restore it on the commit render unless the prop value changes — handled by stashing the pre-drag transition and restoring it imperatively on commit."

## Symptoms

expected: "Dragging the right Totals splitter resizes the panel smoothly with no lag/trail; canvas does not re-render during the drag."
actual: "Drag is laggy and leaves a visual 'trail'/smear even after CanvasViewport was memoized (32e62be)."
errors: "none (perf, not a crash)"
reproduction: "Plan mode → drag the right-side Totals splitter left/right quickly."
started: "Pre-existing (Phase 6 splitter); partially addressed by 32e62be but not enough."

## Eliminated

- hypothesis: "Canvas (Konva Stage) re-render is the sole cause"
  evidence: "32e62be memoized CanvasViewport; drag still lags → App + heavy TotalsPanel re-render per frame is the remaining cause."
  timestamp: 2026-07-15

## Evidence

- timestamp: 2026-07-15
  checked: "App.tsx totals-width wiring (61-64, 500-523) + Splitter contract (Splitter.tsx onMove→onDragWidth per move) + TotalsPanel width style (183, 191)"
  found: "onDragWidth is bound directly to setTotalsDragWidth → one setState per pointermove; effectiveTotalsWidth drives the non-memo TotalsPanel; panel div has a 150ms width transition."
  implication: "Must eliminate per-move setState (drive width via ref) and freeze the transition during drag."

## Resolution

root_cause: "Per-pointermove React setState (setTotalsDragWidth) re-renders App + the heavy non-memoized TotalsPanel every frame during a splitter drag; the panel div's 150ms width transition adds an easing lag. CanvasViewport memo (32e62be) fixed only the canvas, not App/TotalsPanel."
fix: "Drive the live Totals width imperatively via a forwarded ref. TotalsPanel is now forwardRef; App holds totalsPanelRef pointing at the panel's width-bearing root div. onDragWidth (handleTotalsDragWidth) writes el.style.width per pointermove AND freezes el.style.transition='none' on the first move — NO setState, so NO React render between pointerdown and pointerup. onCommit (handleTotalsCommitWidth) restores the stashed transition and calls setTotalsWidth ONCE (single re-render + single localStorage write); the committed width flows back through the normal `width` prop, which React reconciles to the exact value the drag left (no jump). Removed the totalsDragWidth useState + effectiveTotalsWidth; Splitter.panelWidth and TotalsPanel.width now read committed totals.width directly. Splitter public contract (onDragWidth/onCommit) unchanged."
verification: "npm run typecheck clean. npx vitest run → 847/847 (was 845; +2 new tests in splitter-drag-imperative.test.ts proving: (a) zero App-proxy re-renders across pointermoves while style.width tracks the pointer and transition is frozen, single re-render on pointerup with committed width reconciled and transition restored; (b) a pointerdown with no move never freezes the transition). Splitter contract tests (per-move clamp, single commit, listener teardown) still green. WHY no render during move: onDragWidth → handleTotalsDragWidth mutates el.style.width via ref with no setState; the only per-drag React state (totalsDragWidth) was deleted; Splitter's onMove calls only onDragWidth. Human-verify still needed: drag the right Totals splitter and confirm smooth resize with no trail."
files_changed:
  - "src/renderer/src/App.tsx: removed totalsDragWidth state + effectiveTotalsWidth; added totalsPanelRef + dragBaseTransitionRef + handleTotalsDragWidth/handleTotalsCommitWidth; wired Splitter (panelWidth=totals.width, new handlers) and TotalsPanel (ref, width=totals.width); refreshed onReopenToast memo comment."
  - "src/renderer/src/components/TotalsPanel.tsx: converted to forwardRef<HTMLDivElement>; ref attached to both the collapsed rail and open panel roots."
  - "src/renderer/src/components/CanvasViewport.tsx: doc comment refreshed (drag is now imperative; memo is defense-in-depth)."
  - "src/renderer/src/components/EstimatePanel.tsx: doc comment refreshed (same)."
  - "src/tests/splitter-drag-imperative.test.ts: NEW — proves imperative width drive with no per-move re-render + single commit render."
  - "src/tests/splitter-drag-commit.test.ts: doc comment refreshed to describe the imperative mechanism (assertions unchanged)."
