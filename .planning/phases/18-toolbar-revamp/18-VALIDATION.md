---
phase: 18
slug: toolbar-revamp
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-14
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source Validation Architecture: `18-RESEARCH.md` § "Validation Architecture" (Wave 0 RED test list + migrations). The planner populated the Per-Task Verification Map below from the 9 plans.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (include glob `src/tests/**/*.test.ts`) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30–60 seconds (baseline suite ~803 tests green at Phase 17) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file(s)>`
- **After every plan wave:** Run `npx vitest run` (full suite) + `npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite green + `npm run build` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Wave 0 (plans 01–03) writes the RED tests; Wave 1/2 source plans (04–08) turn them GREEN;
> Wave 3 (09) integrates + full-suite gates. Phase 18 is a behavior-parity re-home, so most
> rows assert an existing handler still fires from the NEW surface. The single new plumbing is
> the REACTIVE Arc read seam (`getArcSticky`/`setArcStickyState`/`subscribeArcSticky`, 18-04) —
> its tests assert real reactivity (Shift+A-equivalent flip re-renders with no other interaction).

| Task ID | Plan | Wave | Behavior (parity unless noted) | Test Type | Automated Command | File Exists | Status |
|---------|------|------|--------------------------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | RED: reactive Arc seam — getArcSticky/setArcStickyState/subscribeArcSticky; listener fires on change, not on no-op, stops after unsubscribe | unit | `npx vitest run src/tests/arc-sticky-seam.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-01-02 | 01 | 0 | RED: rail tools arm/disarm-on-retap, no role=tab, chain badge gate, Set Scale activate + right-click menu | render | `npx vitest run src/tests/toolrail-tools.test.ts src/tests/toolrail-chain-badge.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-01-03 | 01 | 0 | RED: rail Snap toggle (F3-shared field) + Arc toggle; Arc on-state reactive (Shift+A-equivalent flip, no re-render) | render | `npx vitest run src/tests/snap-toggle.test.ts src/tests/arc-toggle.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-02-01 | 02 | 0 | RED: TopActionBar file ops (Open/Save/Save As/Replace/Export) + disabled derivations | render | `npx vitest run src/tests/top-action-bar-file-ops.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-02-02 | 02 | 0 | RED: TopActionBar page ◀ N/M ▶ + zoom −/%/+ / Fit + Totals nav | render | `npx vitest run src/tests/top-action-bar-nav.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-02-03 | 02 | 0 | RED: standalone Plan\|Estimate toggle (NO reset, R-1) + Show/Hide All markDirty; retire 5 obsolete Toolbar/ribbon tests | render | `npx vitest run src/tests/view-mode-toggle.test.ts src/tests/visibility-markdirty.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-03-01 | 03 | 0 | RED: ContextBar four morph states (placing/scale/selected/idle) mutually exclusive | render | `npx vitest run src/tests/context-bar-morph.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-03-02 | 03 | 0 | RED: ContextBar selected-markup edit ops (rename→renameGroup, Recolor→recolorGroup, Delete→deleteMarkup, category chip) | render | `npx vitest run src/tests/context-bar-edit.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-03-03 | 03 | 0 | RED: consolidated status line — folded 3-branch scale nudge (migrates canvas-header-bar coverage) | render | `npx vitest run src/tests/status-line.test.ts` | ✅ W0 | ❌ red (expected) |
| 18-04-01 | 04 | 1 | GREEN source: reactive getArcSticky/subscribeArcSticky seam + publish arcMode from CanvasViewport (notify on change) | unit (tdd) | `npx vitest run src/tests/arc-sticky-seam.test.ts` | ✅ W0 | ⬜ pending |
| 18-05-01 | 05 | 1 | GREEN source: TopActionBar file-ops left group + center page/zoom group | render | `npx vitest run src/tests/top-action-bar-file-ops.test.ts src/tests/top-action-bar-nav.test.ts` | ✅ W0 | ⬜ pending |
| 18-05-02 | 05 | 1 | GREEN source: right group — Plan\|Estimate (no reset) + Totals + Show/Hide All (markDirty) + inert ⋯ | render | `npx vitest run src/tests/view-mode-toggle.test.ts src/tests/visibility-markdirty.test.ts` | ✅ W0 | ⬜ pending |
| 18-06-01 | 06 | 1 | GREEN source: fold 3-branch scale nudge into StatusBar scale slot (status-bar-scale stays green) | render (tdd) | `npx vitest run src/tests/status-line.test.ts src/tests/status-bar-scale.test.ts` | ✅ W0 / existing | ⬜ pending |
| 18-07-01 | 07 | 2 | GREEN source: ToolRail tools + Select + Set Scale (context menu) + chain badges | render | `npx vitest run src/tests/toolrail-tools.test.ts src/tests/toolrail-chain-badge.test.ts` | ✅ W0 | ⬜ pending |
| 18-07-02 | 07 | 2 | GREEN source: Snap + Arc toggles; Arc via `useSyncExternalStore(subscribeArcSticky, getArcSticky)` (reactive to Shift+A) | render | `npx vitest run src/tests/snap-toggle.test.ts src/tests/arc-toggle.test.ts` | ✅ W0 | ⬜ pending |
| 18-08-01 | 08 | 2 | GREEN source: ContextBar morph shell + placing/scale/idle + Snap/Arc toggles (Arc reactive via useSyncExternalStore) | render | `npx vitest run src/tests/context-bar-morph.test.ts` | ✅ W0 | ⬜ pending |
| 18-08-02 | 08 | 2 | GREEN source: ContextBar selected-markup panel (inline rename + category chip + Recolor + Delete) | render | `npx vitest run src/tests/context-bar-edit.test.ts` | ✅ W0 | ⬜ pending |
| 18-09-01 | 09 | 3 | Integration: rewire App.tsx shell (rail column + top bar + context bar; drop ribbon + CanvasHeaderBar mount) | integration | `npx tsc --noEmit && npx vitest run` | full suite | ⬜ pending |
| 18-09-02 | 09 | 3 | Integration: delete retired components (Ribbon*, Toolbar, CanvasHeaderBar) + orphaned canvas-header-bar test; no dangling refs | integration | `npx tsc --noEmit && npx vitest run` | full suite | ⬜ pending |
| 18-09-03 | 09 | 3 | Doc gate: write 18-MANUAL-NOTES.md ("what moved where", incl. Shift+A) | doc gate | `test -f .planning/phases/18-toolbar-revamp/18-MANUAL-NOTES.md && grep -qi "what moved where" … && grep -qi "Shift+A" …` | N/A | ⬜ pending |
| 18-09-04 | 09 | 3 | Human verification: co-visible toolbar feel + behavior parity (checkpoint) | manual | human-verify (see Manual-Only) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Wave-0 rows are RED by design until their source plan lands.*

---

## Wave 0 Requirements

> RED test files created by plans 18-01 / 18-02 / 18-03 (+ retirements). Each turns GREEN when its Wave 1/2 source plan lands.

**Plan 18-01 — ToolRail + reactive Arc seam (SC-1/SC-2/SC-3):** _(all five RED files created + red — 18-01 executed)_
- [x] `src/tests/arc-sticky-seam.test.ts` — reactive Arc seam: getArcSticky/setArcStickyState/**subscribeArcSticky**; listener fires on change, not on no-op, stops after unsubscribe (→ 18-04)
- [x] `src/tests/toolrail-tools.test.ts` — rail tools arm/disarm-on-retap, NO role=tab (SC-1), Set Scale activate + right-click ScaleContextMenu (→ 18-07)
- [x] `src/tests/toolrail-chain-badge.test.ts` — chain badge gate `activeTool===tool && getChainArmedItem()!==null` (→ 18-07)
- [x] `src/tests/snap-toggle.test.ts` — rail Snap toggle ↔ `setSnapEnabled` / F3 share one field (→ 18-07)
- [x] `src/tests/arc-toggle.test.ts` — rail Arc toggle fires `getArcStickyToggleHandler`; on-state stays reactive via `subscribeArcSticky`/`getArcSticky` on a Shift+A-equivalent flip with NO manual re-render (→ 18-04 + 18-07)

**Plan 18-02 — TopActionBar (SC-4/SC-5/SC-6):** _(all four RED files created + red; 5 obsolete tests retired — 18-02 executed)_
- [x] `src/tests/top-action-bar-file-ops.test.ts` — Open/Save/Save As/Replace/Export + disabled derivations (→ 18-05)
- [x] `src/tests/top-action-bar-nav.test.ts` — page prev/next, zoom −/%/+ / Fit, Totals (→ 18-05)
- [x] `src/tests/view-mode-toggle.test.ts` — standalone Plan|Estimate toggle, NO auto-reset (R-1); preserve `view-mode-toggle`/`view-mode-plan`/`view-mode-estimate` testids (→ 18-05)
- [x] `src/tests/visibility-markdirty.test.ts` — Show All / Hide All BOTH call `markDirty()` (Pitfall 7); Hide All disabled at no-markups (→ 18-05)
- [x] **Retire** (deleted in 18-02 Task 3): `ribbon-leave-estimating-reveals-plan.test.ts` (premise void — R-1 viewMode reset deleted) + the 4 `toolbar-*.test.ts` that import the dead legacy `Toolbar.tsx` (`toolbar-open-prop`, `toolbar-export-button`, `toolbar-replace-pdf`, `toolbar-saving-disabled`)

**Plan 18-03 — ContextBar + status line (SC-4/SC-5):** _(all three RED files created + red — 18-03 executed)_
- [x] `src/tests/context-bar-morph.test.ts` — four mutually-exclusive morph states (→ 18-08)
- [x] `src/tests/context-bar-edit.test.ts` — selected rename/recolor/delete + category chip (→ 18-08)
- [x] `src/tests/status-line.test.ts` — consolidated status line with the folded 3-branch scale nudge; migrates `canvas-header-bar.test.ts` coverage (→ 18-06); `canvas-header-bar.test.ts` deleted in 18-09 Task 2

**Unaffected — must stay GREEN (no Wave 0 work):** `chain-mode.test.ts`, keyboard-shortcut tests, `status-bar-scale.test.ts` (pure selector path).

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| "Every markup-loop action is one click, no tab switch" (SC-1 feel) | Perceptual / layout | Drive the mark loop: arm a tool, zoom, flip page, save — confirm zero tab/mode switches; compare against spike mockup |
| Arc on-state chrome updates on Shift+A (SC-2/SC-3 feel) | Perceptual / live-UX | Press Shift+A with a markup tool armed; confirm BOTH the rail Arc toggle and the ContextBar Arc pill light up immediately with no other click |
| Rail/context visual fidelity to Direction A | Visual | Compare running app to `.planning/spikes/007-toolbar-revamp/mockup.html` |

*Behavior-level parity is otherwise automated (incl. the reactive Arc seam via arc-toggle.test.ts).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test migrations above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (flipped at validate-phase)

**Approval:** pending
</content>
