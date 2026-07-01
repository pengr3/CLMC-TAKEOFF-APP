---
phase: 16
slug: estimating-workspace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `16-RESEARCH.md` → Validation Architecture (proofs a–i). Mirrors the `15-VALIDATION.md` proof-first pattern.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `vitest.config.ts` (include glob `src/tests/**/*.test.ts`; `environment: 'node'`, per-file `@vitest-environment jsdom` for render tests) |
| **Quick run command** | `npx vitest run src/tests/<file>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds full suite; <5s per touched file |
| **Notes** | No `test` script in package.json — invoke `npx vitest run`. Render tests use `React.createElement` + in-memory localStorage polyfill + `IS_REACT_ACT_ENVIRONMENT=true` (parallel-safe, no config edit per CLAUDE.md). |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test file>` (<~5s)
- **After every plan wave:** `npx vitest run` (full suite) + `npm run typecheck`
- **Before `/gsd:verify-work`:** full suite green + `npm run typecheck` clean + `npm run build`
- **Max feedback latency:** ~60 seconds

---

## Proof → Test Map

Proof letters a–i are the discrete feedback samples each Wave-1..N source task must turn GREEN. SC-1..SC-6 = the six ROADMAP success criteria. Per-task IDs are assigned by the planner; each PLAN.md task's `<verify>` block must cite the proof(s) below.

| Proof | SC | Behavior to prove | Type | Automated Command | File |
|-------|----|-------------------|------|-------------------|------|
| **a** model math | SC-2,3 | `materialCost=material×qty`, `laborCost=labor×qty`, `cost=material+labor`, `price=cost×(1+markup/100)`, `margin=price−cost`; absent → material/labor 0, markup 30 | unit | `npx vitest run src/tests/boq-aggregator.test.ts` | extend |
| **a** subtotals/grand | SC-4 | Per-category Cost/Price/Margin subtotals = Σ rows; grand totals = Σ categories | unit | `npx vitest run src/tests/boq-aggregator.test.ts` | extend |
| **b** round-trip | SC-5 | `{material,labor,markup}` survives snapshot→validateV2→hydrate deep-equal; keyed `name\|type`; shared across categories | unit | `npx vitest run src/tests/project-serialize.test.ts src/tests/project-schema.test.ts` | extend |
| **b** back-compat | SC-5 | Phase-15 scalar `rates:{'X\|count':50}` loads → `{material:50,labor:0,markup:30}`; missing markup → 30; malformed dropped | unit | `npx vitest run src/tests/project-serialize.test.ts` | extend |
| **c** live recompute | SC-2,3 | Editing a price via `setPrice` recomputes cost/price/margin live through `useBoqLive` | unit (jsdom) | `npx vitest run src/tests/use-boq-live.test.ts` | update |
| **d** grid edit dispatch | SC-2,3 | Typing material/labor/markup cells (native input+blur, Enter) dispatches `setPrice('name\|type',{…})`; does NOT bubble to row handler (stopPropagation); grid re-renders | unit (jsdom) | `npx vitest run src/tests/estimate-row-edit.test.ts` | **NEW** |
| **e** panel quantity-only | SC-1 | Totals components render NO rate-input / cost / cost-subtotal / grand-total-cost nodes; quantity + lightbulb + color chip + cycle still present | unit (jsdom) | `npx vitest run src/tests/totals-panel-quantity-only.test.ts` | **NEW** |
| **f** export 9 columns | SC-6 | xlsx title `Item,Qty,UoM,Material,Labor,Cost,Markup,Price,Margin`; money cells native numbers w/ `NUMFMT_PESO`; per-category + grand Cost/Price/Margin rows; csv mirrors numerically + UTF-8 BOM line 1 | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` | extend |
| **g** view-switch keeps canvas | SC-1 | Toggling `viewMode` estimate↔plan keeps `CanvasViewport` mounted (both subtrees present, one `display:none`) — Konva Stage NOT remounted | unit (jsdom) | `npx vitest run src/tests/estimate-view-switch.test.ts` | **NEW** |
| **h** type-lock | SC-6 | 4-way `BoqItemRow`/`BoqStructure` mirrors stay structurally equal (canonical + preload ×2 + writer) | compile | `npm run typecheck` + `npx vitest run src/tests/boq-export-ipc.test.ts` | existing lock |
| **i** no dead tokens | SC-1 | No `totals-row-rate-input` / `formatCost` left in totals components | grep | `! git grep -n "totals-row-rate-input\|totals-row-cost" -- src/renderer/src/components` | — |

---

## Wave 0 Requirements

RED tests that must exist before Wave-1 source (new) or be extended (existing):

- [ ] `src/tests/estimate-row-edit.test.ts` — **NEW** (proof d) — model on `totals-row-rate-edit.test.ts`
- [ ] `src/tests/totals-panel-quantity-only.test.ts` — **NEW** (proof e)
- [ ] `src/tests/estimate-view-switch.test.ts` — **NEW** (proof g)
- [ ] `src/tests/boq-aggregator.test.ts` — **EXTEND** (proof a)
- [ ] `src/tests/project-serialize.test.ts` + `project-schema.test.ts` — **EXTEND** (proof b)
- [ ] `src/tests/use-boq-live.test.ts` — **UPDATE** (proof c)
- [ ] `src/tests/boq-writers-xlsx.test.ts` + `boq-writers-csv.test.ts` — **EXTEND** (proof f)
- [ ] `src/tests/totals-row-rate-edit.test.ts` — **DELETE** (contract removed by D-02)
- [ ] Framework install: **none** — existing Vitest infra covers all proofs

*No new conftest/fixtures; follow existing `src/tests/` fixture style. No `vitest.config.ts` change (parallel-executor-safe).*

---

## Manual-Only Verifications

| Behavior | SC | Why Manual | Test Instructions |
|----------|----|------------|-------------------|
| Estimate grid live-edit feel | SC-2,3 | GUI interaction | In the Estimate view, type a Material and Labor rate + a Markup on a row → Cost/Price/Margin update live; category subtotal + grand total update; interacting with a cell does not arm a tool or switch pages |
| Plan ⟷ Estimate view switch | SC-1 | Canvas render | Toggle `Plan | Estimate` in the Estimating tab → center swaps cleanly; returning to Plan shows the PDF + all markups intact with no re-rasterization flicker |
| Totals panel quantity-only | SC-1 | Visual | Right-side totals panel shows quantities only — no ₱ rate field, no cost, no cost subtotal or grand-total-cost bar |
| Priced export in Excel | SC-6 | External app | Export xlsx, open in Excel → Material/Labor/Cost/Markup/Price/Margin columns; ₱ formatting; `SUM()` works on the money columns (native numbers); csv opens clean with numeric columns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all NEW/EXTEND test references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 lands RED)

**Approval:** pending
