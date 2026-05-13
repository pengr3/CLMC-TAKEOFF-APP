---
phase: 7
slug: canvas-workspace-ux-and-markup-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env default; `/** @vitest-environment jsdom */` per-file for render tests) |
| **Config file** | `vitest.config.ts` — `include: ['src/tests/**/*.test.ts']`, alias `@renderer → src/renderer/src` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 07-W0-01 | Wave 0 | 0 | MARK-03 | EditMarkupCommand execute/undo/redo symmetry; clears redoStack | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ W0 extend | ⬜ pending |
| 07-W0-02 | Wave 0 | 0 | MARK-03 | MarkupNamePopup mode='edit' renders correct labels; pre-fills from props | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ❌ W0 extend | ⬜ pending |
| 07-W0-03 | Wave 0 | 0 | MARK-03 | D-13 canonical substitution: findCategoryByName match → canonical name used | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ❌ W0 extend | ⬜ pending |
| 07-W0-04 | Wave 0 | 0 | MARK-03 | MarkupContextMenu renders 'Edit' as first item with onEdit callback | unit (jsdom) | `npx vitest run src/tests/markup-context-menu.test.ts` | ❌ W0 extend | ⬜ pending |
| 07-W0-05 | Wave 0 | 0 | VIEW-01 | TotalsPanel grand-total bar absent (data-testid not found) | unit (jsdom) | `npx vitest run src/tests/totals-panel-render.test.ts` | ❌ W0 update (Landmine 7) | ⬜ pending |
| 07-W0-06 | Wave 0 | 0 | VIEW-01 | TotalsCategoryBlock subtotal rows absent (data-testid not found) | unit (jsdom) | `npx vitest run src/tests/totals-panel-category-collapse.test.ts` | ❌ W0 update | ⬜ pending |
| 07-W1-01 | P1 canvas | 1 | UI-01 | Stage fills available container; no 800×600 lock | manual UAT | ResizeObserver not mockable in node env | N/A — manual | ⬜ pending |
| 07-W1-02 | P1 totals | 1 | VIEW-01 | Grand-total bar and subtotal rows removed; item rows intact | unit (jsdom) | `npx vitest run src/tests/totals-panel-render.test.ts` | ✅ after W0 | ⬜ pending |
| 07-W1-03 | P1 calibration | 1 | UI-01 | CalibrationDialog dropdown visible; secondary reads 'Discard Scale' | manual UAT | Chromium stacking context not mockable in jsdom | N/A — manual | ⬜ pending |
| 07-W2-01 | P2 category | 2 | MARK-03 | ArrowDown/ArrowUp nav + Enter select in CategoryAutocomplete | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ✅ after W0 | ⬜ pending |
| 07-W3-01 | P3 edit | 3 | MARK-03 | Right-click → Edit → Save Changes → pin/panel updates; Ctrl+Z reverts | unit + manual | `npx vitest run src/tests/markup-commands.test.ts` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/markup-commands.test.ts` — extend with `EditMarkupCommand` execute/undo/redo suite (mirror existing place/undo tests); add redo-stack-cleared test
- [ ] `src/tests/markup-namepopup.test.ts` — extend with `mode='edit'` render tests (header 'Edit Markup', primary 'Save Changes', secondary 'Discard Changes', pre-fill props); add D-13 canonical-substitution test
- [ ] `src/tests/markup-context-menu.test.ts` — extend with 'Edit' first-item and `onEdit` callback wiring tests
- [ ] `src/tests/totals-panel-render.test.ts` — **UPDATE** line 260: change `expect(bar).not.toBeNull()` → `expect(bar).toBeNull()` (Landmine 7 — existing test asserts bar IS present; after D-08 it must be absent)
- [ ] `src/tests/totals-panel-category-collapse.test.ts` — check for and update any `totals-subtotal-row` data-testid assertions after D-09

**Test file conventions:**
- Extension: `.test.ts` (not `.test.tsx`) — vitest.config.ts include glob is `src/tests/**/*.test.ts`
- JSX: `React.createElement(...)` — no JSX in test files
- jsdom header: `/** @vitest-environment jsdom */` required for all render tests
- localStorage polyfill: install per-test-file in `beforeEach` for tests rendering TotalsPanel (per STATE.md pattern)
- React act: `globalThis.IS_REACT_ACT_ENVIRONMENT = true` at module scope for animation tests (per STATE.md pattern)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas Stage fills available horizontal+vertical space; no 800×600 lock; dark gutters eliminated | UI-01 | ResizeObserver not mockable in Vitest node env | Open app at 1080p, open a PDF, verify canvas fills the center column end-to-end; resize window and confirm Stage tracks |
| CalibrationDialog dropdown popout fully visible; 5 unit options clickable; no clipping behind backdrop | UI-01 | Chromium stacking-context rendering not mockable in jsdom | Open Set Scale tool, click unit dropdown, confirm list appears above modal backdrop; select each unit option |
| CalibrationDialog secondary button reads 'Discard Scale' (not 'Cancel') | UI-01 | Covered by unit test but also verify visually | Open Set Scale dialog, confirm secondary button label |
| Right-click markup → Edit → popup pre-filled; Save Changes → canvas pin color updates; TotalsPanel chip updates | MARK-03 | End-to-end Konva interaction not fully mockable | Place a markup, right-click, open Edit, change name/category/color, confirm all three surfaces update |
| Ctrl+Z after Edit reverts all three fields atomically | MARK-03 | Zustand state + Konva render interaction | After Save Changes, press Ctrl+Z, confirm markup reverts to prior name/category/color simultaneously |
| Ctrl+Y re-applies the edit | MARK-03 | Same as above | After Ctrl+Z, press Ctrl+Y, confirm forward-application |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
