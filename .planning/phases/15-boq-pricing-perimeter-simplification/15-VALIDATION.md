---
phase: 15
slug: boq-pricing-perimeter-simplification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md` → `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <path>` (e.g. `npx vitest run src/tests/boq-aggregator.test.ts`) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds (≈590 tests today) |

> Note: there is **no `test` script** in package.json — tests run via `npx vitest run`. Wave 0 may optionally add `"test": "vitest run"` for DX, but it is not required.

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched test file(s)
- **After every plan wave:** Run the full suite `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run typecheck` clean + `npm run build`
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Requirement-level proofs (task IDs assigned by the planner; each plan task must map to one of these). Proof letters (a–d) match `15-RESEARCH.md` Validation Architecture.

| Proof | Success Criterion | Behavior to prove | Test Type | Automated Command |
|-------|-------------------|-------------------|-----------|-------------------|
| a | SC-1 | `cost = rate × quantity` at row level; category cost subtotal = Σ row costs; grand-total cost = Σ category subtotals | unit | `npx vitest run src/tests/boq-aggregator.test.ts` |
| a | SC-1 | xlsx + csv emit Rate and Cost columns + cost subtotals/grand-total in ₱ | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` |
| b | SC-2 | `rates` round-trips through .clmc save/reload keyed by `name\|type`; same (name,type) shares one rate across categories | unit | `npx vitest run src/tests/project-serialize.test.ts src/tests/project-schema.test.ts` |
| b | SC-2 | editing a rate recomputes costs live (useBoqLive subscribes to `rates`) | unit | `npx vitest run src/tests/use-boq-live.test.ts` |
| c | SC-3,5 | a perimeter markup yields exactly ONE BOQ row (length); label is plain `{name}`, suffix `(perimeter)` only on count/linear/area collision | unit | `npx vitest run src/tests/boq-aggregator.test.ts` |
| c | SC-3 | no `'perimeter-area'` token remains in source (types/aggregator/writers/totals/preload) | grep | `! git grep -n "perimeter-area" -- src` returns no matches |
| d | SC-6 | an old .clmc fixture with a perimeter markup reloads without error and produces length-only BOQ | unit | `npx vitest run src/tests/project-open-flow.test.ts` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing Vitest infrastructure covers all phase requirements — no new framework install.
- The two perimeter assertions that change from two-row → one-row are **rewrites**, not new files: `src/tests/boq-aggregator.test.ts` (perimeter two-row cases) — flagged in research.
- New assertions extend existing files: `boq-writers-xlsx.test.ts`, `boq-writers-csv.test.ts` (Rate/Cost columns), `project-serialize.test.ts` / `project-schema.test.ts` (rates round-trip), `use-boq-live.test.ts` (rates subscription).

*No new conftest/fixtures framework needed — follow existing fixture style in `src/tests/`.*

---

## Manual-Only Verifications

| Behavior | Success Criterion | Why Manual | Test Instructions |
|----------|-------------------|------------|-------------------|
| Inline ₱ rate field feel — type a rate on a totals row, cost updates live, no accidental page-cycle/arm-tool | SC-2 | UX feel + Konva/React event interplay (`e.stopPropagation` correctness) not fully assertable in unit tests | Open app, calibrate a page, place markups, set a rate inline; confirm cost updates and row-click selection still works |
| Perimeter renders as unfilled closed outline with `P: 24.6 m` label only (no fill, no `A:`) | SC-4 | Canvas visual render | Place a perimeter markup; confirm no translucent fill and label shows length only |
| xlsx opens in Excel with ₱ rendering correctly in Rate/Cost cells | SC-1 | Cross-app rendering of U+20B1 | Export xlsx, open in Excel, confirm ₱ + 2 decimals |

---

## Validation Sign-Off

- [ ] Every plan task has an `<automated>` verify command or maps to a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all rewritten/extended test files
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set once the planner's tasks satisfy the map above

**Approval:** pending
