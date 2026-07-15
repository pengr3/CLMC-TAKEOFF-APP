---
status: verifying
trigger: "Dragging the right-side TotalsPanel splitter is laggy / not snappy left↔right. Root cause pre-diagnosed: setTotalsDragWidth re-renders whole App subtree (incl. Konva CanvasViewport) on every pointermove."
created: 2026-07-15T00:00:00Z
updated: 2026-07-15T00:01:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Splitter drag lag is caused by the Konva CanvasViewport re-rendering on every pointermove. setTotalsDragWidth (App.tsx:63,497) sets App state ~60-120x/sec; because CanvasViewport is a plain (non-memo) function component rendered unconditionally in the Plan subtree (App.tsx:364), every App re-render re-renders the entire Konva Stage — the expensive part."
  confirming_evidence:
    - "App.tsx:64 effectiveTotalsWidth = totalsDragWidth ?? totals.width; App.tsx:497 onDragWidth={setTotalsDragWidth} — per-pointermove setState confirmed in Splitter.tsx:72 (onDragWidth(next) inside onMove)."
    - "CanvasViewport is exported as a plain function component (CanvasViewport.tsx:249), rendered unconditionally at App.tsx:364 with no React.memo — so it re-renders on every App render."
    - "Splitter itself already commits once on pointerup (Splitter.tsx:79 onCommit(lastWidth)) — it is NOT the bottleneck."
  falsification_test: "If, after memoizing CanvasViewport + stabilizing its props, a splitter drag still triggers CanvasViewport re-renders, the hypothesis is wrong. Verified via prop-stability analysis: all 4 props referentially stable during a width-only drag once onReopenToast is memoized."
  fix_rationale: "React.memo on CanvasViewport short-circuits re-render when props are shallow-equal. During a width drag none of its store subscriptions change and (after memoizing onReopenToast) none of its props change reference → the Konva Stage does not re-render. This addresses the ROOT (per-frame Konva re-render), not the symptom."
  blind_spots: "onReopenToast is an inline lambda (App.tsx:368) recreated each render → defeats memo unless wrapped in useCallback. Must confirm hoverMatches/pulse/clearPulse are stable (they are: useState values + stable useCallback in useMarkupHighlight). memo must not break CanvasViewport's module-level imperative refs (they update via effects on its own store-driven renders, unaffected by memo)."

test: typecheck + full vitest suite; prop-stability reasoning
expecting: memo + useCallback(onReopenToast) makes all CanvasViewport props stable during width drag → no per-frame Konva re-render
next_action: Wrap CanvasViewport in React.memo, memoize onReopenToast with useCallback, wrap EstimatePanel in React.memo, add width-commit regression test, run typecheck + vitest.

## Symptoms

expected: Dragging the right splitter resizes the Totals panel smoothly/snappily left↔right; final width commits on pointerup.
actual: Drag is laggy / not snappy — the whole tree re-renders each pointermove.
errors: none (performance bug, no exceptions)
reproduction: Plan view, drag the vertical divider between canvas center and Totals panel left↔right.
started: Pre-existing since Phase 6 (splitter introduction). Surfaced during Phase 18 review.

## Eliminated

- hypothesis: The Splitter component writes localStorage / commits state per pointermove.
  evidence: Splitter.tsx commits once on pointerup (onCommit at line 79); onDragWidth only calls the parent setter. Splitter contract is correct.
  timestamp: 2026-07-15T00:00:00Z

## Evidence

- timestamp: 2026-07-15T00:00:00Z
  checked: App.tsx render tree + CanvasViewport export + Splitter contract + useMarkupHighlight
  found: "CanvasViewport (Konva Stage) rendered unconditionally, no memo; onReopenToast is an inline lambda (recreated each render); hoverMatches/pulse are useState values; onPulseComplete=clearPulse is a stable useCallback (useMarkupHighlight.ts:57). All CanvasViewport-touching tests vi.mock the module; no test renders the real Konva stack."
  implication: "Memoizing CanvasViewport + memoizing onReopenToast makes all its props referentially stable during a width drag, so setTotalsDragWidth no longer re-renders the Stage. EstimatePanel takes no props → React.memo is a trivial cheap win."

## Resolution

root_cause: "Per-pointermove setTotalsDragWidth re-renders the whole App subtree; CanvasViewport (Konva Stage, expensive) is a non-memoized component rendered unconditionally, so it re-renders every frame during a splitter drag."
fix: "1) React.memo(CanvasViewport). 2) useCallback the onReopenToast prop (was an inline lambda — the one prop that changed reference each render) so it stops defeating the memo. 3) React.memo(EstimatePanel) (no props → trivially effective). Splitter contract and live-resize/clamp/commit behavior unchanged."
verification: "npm run typecheck → clean (node + web). npx vitest run → 840 tests green (837 baseline + 3 new Splitter contract tests); the sole 'error' was a fork-worker startup timeout for spacebar-text-guard.test.ts which passes 6/6 in isolation (env flake, not a regression). Prop-stability confirmed: during a width-only drag all 4 CanvasViewport props are referentially stable (hoverMatches/pulse = useState values; onPulseComplete=clearPulse stable useCallback; onReopenToast now memoized), so React.memo short-circuits the re-render and the Konva Stage no longer re-renders per frame. New splitter-drag-commit.test.ts guards the preserved contract (per-move onDragWidth, min/50% clamp, single onCommit on pointerup, listener teardown)."
files_changed:
  - "src/renderer/src/components/CanvasViewport.tsx: rename inner fn → CanvasViewportComponent; export const CanvasViewport = memo(...)"
  - "src/renderer/src/components/EstimatePanel.tsx: rename inner fn → EstimatePanelComponent; export const EstimatePanel = memo(...)"
  - "src/renderer/src/App.tsx: memoize onReopenToast via useCallback (handleReopenToast); pass it to CanvasViewport"
  - "src/tests/splitter-drag-commit.test.ts: new regression test for the Splitter width-drag/commit contract"
