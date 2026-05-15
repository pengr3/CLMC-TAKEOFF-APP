---
phase: 8
reviewers: [gemini]
reviewed_at: 2026-05-15T00:00:00Z
plans_reviewed:
  - 08-00-PLAN.md
  - 08-01-PLAN.md
  - 08-02-PLAN.md
  - 08-03-PLAN.md
  - 08-04-PLAN.md
  - 08-05-PLAN.md
  - 08-06-PLAN.md
  - 08-07-PLAN.md
skipped:
  - claude (self — running inside Claude Code; independence rule)
  - cursor (CLI returned usage help, not a review — stdin piping not supported in this environment)
---

# Cross-AI Plan Review — Phase 8: Markup Workflow Acceleration and Wall Measurement Tool

## Gemini Review

This review evaluates the 8-plan sequence for **Phase 8: Markup Workflow Acceleration and Wall Measurement Tool**.

### 1. Summary

The overall plan is excellent, demonstrating a high degree of architectural consistency with the existing codebase. It strikes a sophisticated balance between introducing a complex new measurement type (Wall) and providing "quality of life" enhancements (Chain Mode, Visibility Toggle) that directly address estimator pain points. The use of TDD (Wave 0) ensures logic stability, while the parallel wave structure optimizes implementation speed without creating merge conflicts.

### 2. Strengths

- **Architectural Symmetry:** Reusing the `LinearMarkup` pattern for the `Wall` tool minimizes "magic" and lowers the barrier for future maintenance.
- **Decoupled Chain State:** Keeping the "armed" state in the `useMarkupTool` hook (D-05) rather than the global store is a wise choice that prevents "state pollution" while navigating the app.
- **Robust Math Strategy:** Calculating wall area inline (mm → m) avoids dependency on the `ScaleUnit` helper, which has historically been a source of floating-point confusion in the aggregator.
- **Module-Level Communication:** Using the `getChainArmedItem` module-level export pattern (from `CanvasViewport`) avoids expensive React context or prop-drilling for the toolbar badge.
- **Dirty Tracking Awareness:** Explicitly identifying that `projectStore` requires manual `markDirty()` calls (08-02) prevents a common "silent failure" where visibility changes wouldn't trigger a save prompt.

### 3. Concerns

- **[MEDIUM] SVG Cursor Compatibility:** Data-URL cursors in Electron/Chromium can be temperamental regarding the `#` character (often used in colors) and whitespace. The plan specifies encodeURIComponent, but the hotspot `12 12` syntax should be confirmed against Chromium's CSS `cursor` property parsing.
- **[MEDIUM] Race Conditions in Chain Mode:** In 08-01, reading `stateRef.current` before a `setState` call is correct for the hook logic, but ensure the `store.placeMarkup` call (Zustand) doesn't overlap with the hook's reset logic in a way that creates double-commits in React StrictMode.
- **[LOW] Performance (O(N×M) Lookups):** In 08-06, every markup component performs `hiddenItemNames.includes(markup.name)`. If a project has hundreds of markups and dozens of hidden items, this array lookup runs on every Konva render cycle — O(N²) in the worst case.
- **[LOW] Duplicate Type Risk:** The manual sync of `BoqRowType` in `boq-writers.ts` is known technical debt. Adding 'wall' there is correct, but reinforces the need for a shared types package in the future.

### 4. Suggestions

- **Optimization:** In `projectStore.ts`, store `hiddenItemNames` as `string[]` for persistence, but consider a derived `hiddenItemSet: Set<string>` for O(1) lookups in the renderers.
- **Cursor Safety:** In 08-05, ensure the SVG string uses `%23` instead of `#` if any hex colors appear in the crosshair (plan specifies white/black only, which are safe). Double-check that Chromium correctly interprets the `url("...") 12 12, crosshair` hotspot format.
- **Wall Label UX:** The plan places the m² label at `polylineMidpointByArcLength`. For very long walls, consider whether the label could scroll off-screen — viewport-clipping is likely out of scope here, but worth a UAT note.
- **Aggregator Guard:** In 08-03, add a check in the aggregator wall branch to ensure `wallHeight` is never 0 or negative, which would produce nonsensical BOQ rows (wallAreaM2 already throws on <= 0, but a crafted .clmc could bypass the popup validation).

### 5. Risk Assessment

**Overall Risk: LOW**

**Justification:** The phase is well-isolated. The Wall tool is an additive feature that doesn't break existing Count/Area tools. The Visibility Toggle is purely a rendering filter that doesn't mutate markup data — zero risk of data loss. The most complex logic (chain mode) is confined to a single hook. The TDD approach in Wave 0 provides a safety net for aggregator math, which is the most critical part of the app's value proposition.

---

## Cursor Review

*Not available — Cursor CLI returned usage help when piping stdin. Cursor agent mode does not support `cursor agent -p` stdin piping in this environment. Re-run with `--cursor` flag when Cursor IDE is open and the agent CLI is fully configured.*

---

## Consensus Summary

Only one reviewer (Gemini) returned a valid response. The following is based on that single review plus an independent synthesis.

### Agreed Strengths

- **TDD-first wave structure (Wave 0)** — RED tests before implementation is the right call for complex math (wall area) and new store fields (hiddenItemNames).
- **Architectural symmetry** — Wall reuses LinearMarkup's pattern; chain mode generalizes the existing count-tool "stay armed" behavior. Both are additive and pattern-consistent.
- **Chain state locality** — Keeping chainArmed inside useMarkupTool (not Zustand) avoids persisting transient UX state and prevents state pollution.
- **Inline mm→m conversion** — Avoids ScaleUnit abstraction risk (Assumption A1); wall math is explicit and independently testable.
- **markDirty() explicit call on toggleHiddenItem** — The plan correctly identifies the attachDirtyTracking blind spot for projectStore and closes it explicitly.

### Agreed Concerns

- **[MEDIUM] SVG cursor data-URL correctness** — encodeURIComponent is required and the plan calls for it, but this should be smoke-tested early. The `url("...") 12 12, crosshair` format and hotspot behavior in Electron Chromium need manual verification in UAT scenario 9.
- **[MEDIUM] StrictMode double-commit risk in chain mode** — Pitfall 3 (read stateRef.current before setState; dispatch store.placeMarkup outside setState) is documented but must be implemented precisely. This is the highest-probability defect site.
- **[LOW] hiddenItemNames.includes O(N) per render** — Acceptable for v1 with typical project sizes (<100 names), but the Set<string> optimization is worth tracking as a low-hanging future improvement.
- **[LOW] BoqRowType inline-dup in boq-writers.ts** — Wave 0 correctly updates both in lockstep, but the dual-declaration pattern remains fragile longer-term.

### Divergent Views

None — only one reviewer responded. The single review was internally consistent and aligned with the documented decisions.

---

*To incorporate feedback into planning: `/gsd-plan-phase 8 --reviews`*
