---
phase: 13
slug: post-commit-step-level-undo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Derived from `13-RESEARCH.md` §"Validation Architecture" (lines 1162-1211).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 (already in devDependencies; no install needed) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/tests/markup-post-commit-reopen.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 s for the new file alone; full suite ~3 min |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/tests/markup-post-commit-reopen.test.ts src/tests/markup-shortcuts.test.ts src/tests/markup-tool-point-redo.test.ts src/tests/markup-tool-pop-last-point.test.ts` — covers the new file plus the three closest regression files.
- **After every plan wave:** Run `npx vitest run` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** ~30 s.

---

## Per-Task Verification Map

| Test ID | Behavior | Test Type | Automated Command | Wave |
|---------|----------|-----------|-------------------|------|
| SC1 | Ctrl+Z on a committed multi-point markup populates `useMarkupTool.points`, sets `mode='drawing'`, removes original from `markupStore.pageMarkups`, clears selection and vertex-edit | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC1"` | 0 |
| SC2(a) | After re-open, Ctrl+Z pops a point (Phase 10 `popLastPoint` path still works) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*point pop"` | 0 |
| SC2(b) | After re-open, Ctrl+Y re-adds the popped point (Phase 10 `repushLastPoint` still works) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*re-push"` | 0 |
| SC2(c) | Enter re-commits a modified shape with original name/category/color (and wallHeight for wall) — new markup has fresh id but same identity | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*re-commit identity"` | 0 |
| SC3 (module-ref round-trips) | `markup-reopen-ref` setMarkupReopenHandler/getMarkupReopenHandler + setReopenSnapshot/getReopenSnapshot dynamic-import round-trips | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC3"` | 0 |
| SC4 | Esc restores original markup with deep equality on points and id preserved; `undoStack` has the original `place` command back | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC4"` | 0 |
| SC5 | Undo of `reopen-recommit` restores original; redo re-applies the modified new markup (round-trip stability) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC5"` | 0 |
| EDGE-1 | Count pin commit at top of stack → re-open does NOT fire; whole-markup undo path used as today | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "count pin"` | 0 |
| EDGE-2 | Re-open while text input focused → no-op (`isTextInputActive()` guard) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "text input"` | 0 |
| EDGE-3 | Re-open while vertex-edit active (`vertexEditMarkupId !== null`) → no-op | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "vertex edit"` | 0 |
| EDGE-4 | Re-open when top of stack is from another page → no-op | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "cross-page"` | 0 |
| EDGE-5 | Wall re-open preserves `wallHeight` (e.g. 3000mm → 3000mm, NOT default 2400) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "wall height"` | 0 |
| REG-1 | Existing `markup-shortcuts.test.ts` (whole-markup undo round-trip) continues to pass | unit (existing) | `npx vitest run src/tests/markup-shortcuts.test.ts` | n/a |
| REG-2 | Existing `markup-tool-point-redo.test.ts` (Phase 10) continues to pass | unit (existing) | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | n/a |
| REG-3 | Existing `markup-tool-pop-last-point.test.ts` (Phase 3) continues to pass | unit (existing) | `npx vitest run src/tests/markup-tool-pop-last-point.test.ts` | n/a |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/markup-post-commit-reopen.test.ts` — NEW; covers SC1-SC5 + 5 edge cases. Mirror `markup-tool-point-redo.test.ts` scaffolding (HookHost / Probe / makeFakeStage, dynamic import for ref module, `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, store `setState({...})` resets in `beforeEach`).
- [ ] `src/renderer/src/types/markup.ts` — extend `MarkupCommand` union with `reopen-recommit` variant; add `isMultiPointMarkup` type guard alongside `isMarkupTool`.
- [ ] No framework install needed (Vitest 4.1.1 already in devDependencies).
- [ ] No new shared fixtures needed.

---

## Manual-Only Verifications

| Behavior | Source | Why Manual | Test Instructions |
|----------|--------|------------|-------------------|
| SC3 toast lifecycle (fires on re-open, auto-dismisses ~2.5s, clears on page-nav) | D-11 / D-19 / Pitfall 5 | App-level `setTimeout` lifecycle and JSX rendering — captured by manual UAT, not unit-testable without a heavy App.tsx mount. The module-ref round-trips that drive the toast ARE unit-tested as SC3 in the automated map above. | Open app, draw linear markup, commit with Enter, press Ctrl+Z → toast appears at bottom: 148 with text containing "Enter". Wait 2.5s → toast clears. Re-trigger and navigate to another page before 2.5s → toast clears immediately on page change. |
| Toast visual appearance + positioning (above existing toasts at ~`bottom: 148`) | D-20 | Visual / pixel-level — automated check would brittle on layout values | Open app, draw a linear markup, commit with Enter, press Ctrl+Z → toast should appear top-center / bottom-center per existing toast slot, text contains "Enter" |
| Re-open of a wall markup keeps the m² label correct on re-commit at a non-default `wallHeight` (e.g. 3000) | D-15 + EDGE-5 | End-to-end through Konva render | Calibrate page, draw wall at default 2400mm, commit with Enter, change height in MarkupNamePopup to 3000mm, re-commit, then Ctrl+Z to re-open, add a point, re-commit — confirm m² label matches `wallAreaM2(points, 3000)` |
| Re-open from any of the 5 multi-point tools (linear, area, perimeter, wall) | D-12 | Cross-tool sanity sweep | One iteration of the canonical flow per tool: commit → Ctrl+Z → add point → Enter; confirm new shape replaces original and BOQ totals update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter after the planner's coverage check passes

**Approval:** pending
