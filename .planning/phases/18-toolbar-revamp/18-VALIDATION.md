---
phase: 18
slug: toolbar-revamp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source Validation Architecture: `18-RESEARCH.md` § "Validation Architecture" (Wave 0 RED test list + migrations). The planner populates the Per-Task Verification Map below from it.

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

> Populated by the planner (Wave 0 RED tests → source tasks). Because Phase 18 is a
> behavior-parity re-home, most rows assert an existing handler still fires from the
> NEW surface. Derive rows from `18-RESEARCH.md` behavior-parity inventory (P1–P21)
> and its test-migration list.

| Task ID | Plan | Wave | Behavior (parity) | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | (planner fills — RED test surface) | unit | `npx vitest run <file>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> From `18-RESEARCH.md` test-migration scope. Expected (planner confirms):
- [ ] Retire `ribbon-leave-estimating-reveals-plan.test.ts` (premise void — R-1 / viewMode reset deleted)
- [ ] Migrate `canvas-header-bar.test.ts` → consolidated status-line tests
- [ ] Rewrite the 4 `toolbar-*.test.ts` (import the dead legacy `Toolbar.tsx`) against the new TopActionBar
- [ ] Preserve `view-mode-toggle` / `view-mode-plan` / `view-mode-estimate` testids on the new segmented control
- [ ] Add behavior-parity RED tests: tool-arm/disarm, Show/Hide All `markDirty`, scale `▾` menu, chain badge gating, resume-from-totals, Snap toggle, Arc on-state via the new `getArcSticky()` read seam (R-2)
- [ ] Keep `chain-mode.test.ts` + keyboard-shortcut tests green (unaffected)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| "Every markup-loop action is one click, no tab switch" (SC-1 feel) | Perceptual / layout | Drive the mark loop: arm a tool, zoom, flip page, save — confirm zero tab/mode switches; compare against spike mockup |
| Rail/context visual fidelity to Direction A | Visual | Compare running app to `.planning/spikes/007-toolbar-revamp/mockup.html` |

*Behavior-level parity is otherwise automated.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test migrations above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
