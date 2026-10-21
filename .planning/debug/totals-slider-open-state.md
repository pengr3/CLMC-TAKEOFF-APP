---
status: resolved
trigger: "Totals slider expands an empty collapsed rail and squeezes open content at minimum width"
created: 2026-10-21
updated: 2026-10-21
---

## Current Focus

hypothesis: The imperative splitter changes only DOM width; totals.open remains unchanged, and Splitter starts from the remembered width even when the visible rail is 28px.
next_action: Human verification is complete. Review and commit wrap-up is tracked by quick-261021-jqu; milestone audit follows separately.

## Symptoms

expected: Dragging the collapsed rail left reveals Totals. Dragging the panel to minimum shows the same 28px rail as the toolbar toggle or chevron.
actual: A blank expanded rail when closed; clipped full-panel content at minimum when open.
reproduction: Toggle Totals off, drag divider left; or open Totals and drag divider fully right.
errors: No error reported; user supplied screenshots of both layouts.

## Evidence

- User confirmed toolbar collapse, toolbar reopen, and panel-chevron collapse all work.
- App.handleTotalsDragWidth mutates style.width only; handleTotalsCommitWidth calls setTotalsWidth only.
- TotalsPanel selects rail vs content solely from open, not width.
- Splitter receives totals.width even when TotalsPanel renders its fixed 28px rail.
- Existing imperative-drag tests use a copied harness, so they cannot detect this App wiring defect.
- User accepted the slider fixes: "NICE. okay let's move on to the next test we have to od". Restart persistence remains a separate pending check.
- Subsequent walkthrough confirmed expanded width, collapsed state, restored width, smooth dragging, and every visibility state. No slider checks remain pending.

## Resolution

root_cause: Width and open state are independent across splitter gestures.
fix: App previews rail/content transitions only when crossing the 28px boundary; normal drag width remains imperative. Splitter starts from visible rail width when closed. setTotalsWidth atomically commits visibility and width, preserving the last expanded width on collapse. Old persisted widths at/below the rail are normalized to a closed panel with a usable reopen width.
verification: Full suite PASS (121 files, 877 tests, including 6 real-App regression tests); npm run typecheck PASS. Focused ESLint with formatting disabled reports only the pre-existing react-hooks/set-state-in-effect issue on App's unchanged setReopenToast effect. Human slider retest, restart persistence, resize smoothness, visibility controls, and pin-inside-area checks all passed. Category collapse was skipped as unnecessary by the user; its reported issue is tracked separately in quick-260820-plx-UAT.md.

## Retest / Manual Notes

1. Hide Totals using its top-bar icon, then drag the divider left: Totals content appears during the drag; release commits the open state and toolbar highlight.
2. Drag the divider fully right: it becomes the same static 28px rail with an expand chevron as hiding with the icon or chevron.
3. Click the expand chevron or toolbar toggle: restore the last expanded width, not a clipped 28px content panel.
4. Repeat with the panel's own collapse chevron. Resizing should stay smooth and preferences should persist after restart.

## Files Changed

- src/renderer/src/App.tsx
- src/renderer/src/hooks/useUiPanels.ts
- src/renderer/src/components/TotalsPanel.tsx
- src/renderer/src/lib/constants.ts
- src/tests/totals-slider-state.test.ts
