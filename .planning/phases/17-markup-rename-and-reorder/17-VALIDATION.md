---
phase: 17
slug: markup-rename-and-reorder
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-09
validated: 2026-07-13
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `17-RESEARCH.md` § Validation Architecture. Per-task IDs are bound at planning.
> **Validated 2026-07-13** (`/gsd-validate-phase 17`): all planned tests exist and run green; 0 gaps. See audit trail below.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `globals: true`, `include: ['src/tests/**/*.test.ts']`, alias `@renderer → src/renderer/src`) |
| **Quick run command** | `npx vitest run src/tests/<file>.test.ts` (no `test` npm script — invoke vitest directly) |
| **Full suite command** | `npx vitest run` |
| **Typecheck gate** | `npm run typecheck` (node + web projects) |
| **Estimated runtime** | ~15–30 seconds (per-task pure-logic tests); full suite ~80s (807 tests, 107 files) |

**Conventions (verified):** pure-logic tests (aggregator, group-ops, re-key) are Node-env and inject fixtures via `opts` — no DOM. Component/render tests install an in-memory `localStorage` polyfill per file and use `React.createElement` in `.test.ts` files. Do NOT change `vitest.config.ts` mid-wave (glob is `.test.ts`). Store tests call `useMarkupStore.getState()` / `useProjectStore.getState()` directly.

---

## Sampling Rate

- **After every task commit:** Run the task's new test file — `npx vitest run src/tests/<file>.test.ts` — plus `npm run typecheck`.
- **After every plan wave:** Run the full suite — `npx vitest run` (the phase touches the shared aggregator + both stores; run everything).
- **Before `/gsd-verify-work`:** Full suite green + `npm run typecheck` clean + `npm run build` clean.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

Requirement-level map from `17-RESEARCH.md` § Phase Requirements → Test Map. Bound and verified against the delivered implementation.

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| Req 2 | Aggregator emits items in `categoryItemOrder`; unranked append in placement order; absent order → placement (not alpha) | — | unit | `npx vitest run src/tests/boq-aggregator-order.test.ts` | ✅ | ✅ green |
| Req 2 | `useBoqLive` recomputes when `categoryItemOrder` changes | — | unit | `npx vitest run src/tests/use-boq-live-order.test.ts` | ✅ | ✅ green |
| Req 2 | `categoryItemOrder` round-trips snapshot→validateV2→hydrate; old file (absent) → `{}`; no formatVersion bump | T-17-01 (V5 hydrate coercion) | unit | `npx vitest run src/tests/project-order-roundtrip.test.ts` | ✅ | ✅ green |
| Req 2 | Export writers preserve item array order (xlsx + csv) | T-17-02 (CSV formula guard unchanged) | unit | `npx vitest run src/tests/boq-writers-csv.test.ts src/tests/boq-writers-xlsx.test.ts` | ✅ (extended) | ✅ green |
| Req 2 | `reorderItems` command sets order, pushes one command, undo/redo restore (no-op guard) | — | unit | `npx vitest run src/tests/reorder-items-command.test.ts` | ✅ (supplementary) | ✅ green |
| Req 1 | `renameGroup` flips names all pages + re-keys `rates` (`old\|T`→`new\|T`) + `hiddenItemNames` (`old\|catId`→`new\|catId`) + order; ONE Ctrl+Z reverts all | — | unit | `npx vitest run src/tests/rename-group-command.test.ts` | ✅ | ✅ green |
| Req 1 | Rename collision (same type, outside group) → blocked, no store writes | — | unit | `npx vitest run src/tests/rename-group-collision.test.ts` | ✅ | ✅ green |
| Req 1 | Inline rename identity is category-scoped (group spanning two categories opens ONE editor) | MD-01 | render | `npx vitest run src/tests/rename-key-category-scope.test.ts` | ✅ (supplementary) | ✅ green |
| Req 3 | `moveGroup` reassigns categoryId all markups, appends to target order, unchanged rate; undo restores category + order | — | unit | `npx vitest run src/tests/move-group-command.test.ts` | ✅ | ✅ green |
| Req 3 | Move appends to bottom of unordered category; re-keys composite hidden key (no orphan); per-markup undo re-homes spanning groups | — | unit | `npx vitest run src/tests/group-move-order.test.ts` | ✅ (supplementary) | ✅ green |
| Req 4/5 | `copyGroup`/`duplicateGroup` create independent snapshots (new ids, deep-cloned geometry), auto-unique name, blank rate; undo removes markups + rate entry | — | unit | `npx vitest run src/tests/copy-duplicate-group.test.ts` | ✅ | ✅ green |
| Req 4/5 | `autoUniqueName` picks first-free "(n)" not colliding with same-type names; `snapshotGroup` deep-clones; `collisionExists` type-scoped | — | unit | `npx vitest run src/tests/group-ops-autoname.test.ts` | ✅ | ✅ green |
| Req 4/5 | Auto-name skips a candidate whose only claim is an orphaned rate key (no rate clobber) | — | unit | `npx vitest run src/tests/copy-orphan-rate.test.ts` | ✅ (supplementary) | ✅ green |
| Req 1/4/5 | Cross-store undo atomicity: after undo, both `useMarkupStore` and `useProjectStore` match pre-op state (all four ops, exactly one stack entry) | — | unit | `npx vitest run src/tests/group-undo-atomic.test.ts` | ✅ (**highest risk**) | ✅ green |
| Req 2 (UI) | Grip pointer-drag computes drop index + dispatches one `reorderItems`; drag only from grip; unmount removes listeners | LW-02 | render | `npx vitest run src/tests/row-reorder-drag.test.ts` | ✅ | ✅ green |
| Req 1 (UI) | Inline rename: Enter commits, Esc cancels, blank cancels, collision keeps editor mounted; stopPropagation | D-04 | render | `npx vitest run src/tests/inline-rename-input.test.ts` | ✅ | ✅ green |
| Req 1/3/4/5 (UI) | Totals panel row menu routes Rename/Move/Copy/Duplicate to the correct commands + dialogs; blank-category guard; single-click stays instant | HG-01, GRIP-CLICK | render | `npx vitest run src/tests/totals-row-group-ops.test.ts` | ✅ (supplementary) | ✅ green |
| Req 1/3/4/5 (UI) | Estimate sheet row menu routes the four group actions to the correct commands + dialogs (D-02/05/07/08) | — | render | `npx vitest run src/tests/estimate-row-group-ops.test.ts` | ✅ (supplementary) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/tests/boq-aggregator-order.test.ts` — Req 2 aggregator order (inject `categoryItemOrder` opt; assert positional order; unranked append; absent→placement).
- [x] `src/tests/rename-group-command.test.ts` + `rename-group-collision.test.ts` — Req 1 (three-key re-key: names + `rates` + `hiddenItemNames|catId`; block on collision).
- [x] `src/tests/move-group-command.test.ts` — Req 3.
- [x] `src/tests/copy-duplicate-group.test.ts` + `group-ops-autoname.test.ts` — Req 4/5.
- [x] `src/tests/group-undo-atomic.test.ts` — cross-store one-Ctrl+Z atomicity (highest-risk logic).
- [x] `src/tests/project-order-roundtrip.test.ts` — additive persistence + old-file degrade + no formatVersion bump + V5 hydrate coercion.
- [x] `src/tests/use-boq-live-order.test.ts`, `row-reorder-drag.test.ts`, `inline-rename-input.test.ts` — live recompute + UI.
- [x] Extend `boq-writers-*.test.ts` with an order-preservation assertion (xlsx + csv).
- [x] Framework install: **none** — Vitest already present.

**Supplementary tests added during execution / code-review fixes (beyond the Wave 0 plan):** `reorder-items-command.test.ts`, `rename-key-category-scope.test.ts`, `group-move-order.test.ts`, `copy-orphan-rate.test.ts`, `totals-row-group-ops.test.ts`, `estimate-row-group-ops.test.ts` (+ `rates-proto-hydrate.test.ts`, `boq-name-pipe.test.ts`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Insertion-line drop indicator + row-lift feel during drag | Req 2 (UI) | Visual/perceptual feedback; automated render test asserts index math, not pixel feel | Hover a row → grip appears on leading edge; drag from grip → grabbed row lifts, a thin accent line marks the drop position; release → order updates. Repeat on both totals panel and Estimate sheet. |
| Totals single-click cycle stays instant with rename dbl-click armed | Req 1 (UI) | Perceived-performance; `e.detail===2` guard verified in unit render test but "instant feel" is human-judged | Single-click a totals row → it cycles/arms with no delay; double-click the name → inline edit opens without a lag on the first click. |

> **UAT status (2026-07-13):** 4/4 human UAT criteria passed, 0 issues (see `17-HUMAN-UAT.md`). The two perceptual behaviors above were exercised during UAT.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (12 planned test files delivered green)
- [x] No watch-mode flags (use `vitest run`, never `vitest` watch)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (Wave 0 landed)

**Approval:** validated 2026-07-13 — Nyquist-compliant, 0 gaps.

---

## Validation Audit 2026-07-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

- **Input state:** A (existing `17-VALIDATION.md` audited against delivered implementation).
- **Full suite:** `npx vitest run` → **107 files, 803 tests passing** (0 fail, 0 flaky).
- **Coverage:** all 12 planned test files exist and target their bound behavior; 6+ supplementary tests landed during code-review fixes strengthen Req 1/2/3/4/5 coverage.
- **Auditor spawn:** not required (no MISSING/PARTIAL requirements).
- **Result:** Phase 17 is Nyquist-compliant. No new test files generated by this audit; VALIDATION.md statuses reconciled to reality only.
