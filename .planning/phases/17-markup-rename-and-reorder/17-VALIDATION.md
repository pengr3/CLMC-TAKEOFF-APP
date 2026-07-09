---
phase: 17
slug: markup-rename-and-reorder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `17-RESEARCH.md` § Validation Architecture. Per-task IDs are bound at planning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (`environment: 'node'`, `globals: true`, `include: ['src/tests/**/*.test.ts']`, alias `@renderer → src/renderer/src`) |
| **Quick run command** | `npx vitest run src/tests/<file>.test.ts` (no `test` npm script — invoke vitest directly) |
| **Full suite command** | `npx vitest run` |
| **Typecheck gate** | `npm run typecheck` (node + web projects) |
| **Estimated runtime** | ~15–30 seconds (full suite; pure-logic tests are Node-env) |

**Conventions (verified):** pure-logic tests (aggregator, group-ops, re-key) are Node-env and inject fixtures via `opts` — no DOM. Component/render tests install an in-memory `localStorage` polyfill per file and use `React.createElement` in `.test.ts` files. Do NOT change `vitest.config.ts` mid-wave (glob is `.test.ts`). Store tests call `useMarkupStore.getState()` / `useProjectStore.getState()` directly.

---

## Sampling Rate

- **After every task commit:** Run the task's new test file — `npx vitest run src/tests/<file>.test.ts` — plus `npm run typecheck`.
- **After every plan wave:** Run the full suite — `npx vitest run` (the phase touches the shared aggregator + both stores; run everything).
- **Before `/gsd-verify-work`:** Full suite green + `npm run typecheck` clean + `npm run build` clean.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

Requirement-level map from `17-RESEARCH.md` § Phase Requirements → Test Map. **Plan/Wave/Task-ID columns are bound during planning** (all tests below are new — Wave 0).

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| Req 2 | Aggregator emits items in `categoryItemOrder`; unranked append in placement order; absent order → placement (not alpha) | — | unit | `npx vitest run src/tests/boq-aggregator-order.test.ts` | ❌ W0 | ⬜ pending |
| Req 2 | `useBoqLive` recomputes when `categoryItemOrder` changes | — | unit | `npx vitest run src/tests/use-boq-live-order.test.ts` | ❌ W0 | ⬜ pending |
| Req 2 | `categoryItemOrder` round-trips snapshot→validateV2→hydrate; old file (absent) → `{}`; no formatVersion bump | T-17-01 (V5 hydrate coercion) | unit | `npx vitest run src/tests/project-order-roundtrip.test.ts` | ❌ W0 | ⬜ pending |
| Req 2 | Export writers preserve item array order (xlsx + csv) | T-17-02 (CSV formula guard unchanged) | unit | `npx vitest run src/tests/boq-writers-order.test.ts` | ❌ W0 (extend existing) | ⬜ pending |
| Req 1 | `renameGroup` flips names all pages + re-keys `rates` (`old\|T`→`new\|T`) + `hiddenItemNames` (`old\|catId`→`new\|catId`) + order; ONE Ctrl+Z reverts all | — | unit | `npx vitest run src/tests/rename-group-command.test.ts` | ❌ W0 | ⬜ pending |
| Req 1 | Rename collision (same type, outside group) → blocked, no store writes | — | unit | `npx vitest run src/tests/rename-group-collision.test.ts` | ❌ W0 | ⬜ pending |
| Req 3 | `moveGroup` reassigns categoryId all markups, appends to target order, unchanged rate; undo restores category + order | — | unit | `npx vitest run src/tests/move-group-command.test.ts` | ❌ W0 | ⬜ pending |
| Req 4/5 | `copyGroup`/`duplicateGroup` create independent snapshots (new ids, deep-cloned geometry), auto-unique name, blank rate; undo removes markups + rate entry | — | unit | `npx vitest run src/tests/copy-duplicate-group.test.ts` | ❌ W0 | ⬜ pending |
| Req 4/5 | `autoUniqueName` picks first-free "(n)" not colliding with same-type names | — | unit | `npx vitest run src/tests/group-ops-autoname.test.ts` | ❌ W0 | ⬜ pending |
| Req 1/4/5 | Cross-store undo atomicity: after undo, both `useMarkupStore` and `useProjectStore` match pre-op state | — | unit | `npx vitest run src/tests/group-undo-atomic.test.ts` | ❌ W0 (**highest risk**) | ⬜ pending |
| Req 2 (UI) | Grip pointer-drag computes drop index + dispatches one `reorderItems`; drag only from grip | — | render | `npx vitest run src/tests/row-reorder-drag.test.ts` | ❌ W0 | ⬜ pending |
| Req 1 (UI) | Inline rename: Enter commits, Esc cancels, blank cancels, totals dbl-click `e.detail===2` guard doesn't cycle | — | render | `npx vitest run src/tests/inline-rename-input.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/boq-aggregator-order.test.ts` — Req 2 aggregator order (inject `categoryItemOrder` opt; assert positional order; unranked append; absent→placement).
- [ ] `src/tests/rename-group-command.test.ts` + `rename-group-collision.test.ts` — Req 1 (three-key re-key: names + `rates` + `hiddenItemNames|catId`; block on collision).
- [ ] `src/tests/move-group-command.test.ts` — Req 3.
- [ ] `src/tests/copy-duplicate-group.test.ts` + `group-ops-autoname.test.ts` — Req 4/5.
- [ ] `src/tests/group-undo-atomic.test.ts` — cross-store one-Ctrl+Z atomicity (highest-risk logic).
- [ ] `src/tests/project-order-roundtrip.test.ts` — additive persistence + old-file degrade + no formatVersion bump + V5 hydrate coercion.
- [ ] `src/tests/use-boq-live-order.test.ts`, `row-reorder-drag.test.ts`, `inline-rename-input.test.ts` — live recompute + UI.
- [ ] Extend `boq-writers-*.test.ts` with an order-preservation assertion (xlsx + csv).
- [ ] Framework install: **none** — Vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Insertion-line drop indicator + row-lift feel during drag | Req 2 (UI) | Visual/perceptual feedback; automated render test asserts index math, not pixel feel | Hover a row → grip appears on leading edge; drag from grip → grabbed row lifts, a thin accent line marks the drop position; release → order updates. Repeat on both totals panel and Estimate sheet. |
| Totals single-click cycle stays instant with rename dbl-click armed | Req 1 (UI) | Perceived-performance; `e.detail===2` guard verified in unit render test but "instant feel" is human-judged | Single-click a totals row → it cycles/arms with no delay; double-click the name → inline edit opens without a lag on the first click. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (12 new test files listed above)
- [ ] No watch-mode flags (use `vitest run`, never `vitest` watch)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 lands)

**Approval:** pending
