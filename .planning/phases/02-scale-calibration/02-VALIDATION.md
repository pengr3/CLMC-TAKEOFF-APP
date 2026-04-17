---
phase: 2
slug: scale-calibration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/tests/scale-math.test.ts src/tests/scale-store.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/scale-math.test.ts src/tests/scale-store.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-math | W0 | 0 | SCAL-01, SCAL-04 | unit | `npx vitest run src/tests/scale-math.test.ts` | ❌ W0 | ⬜ pending |
| 2-W0-store | W0 | 0 | SCAL-02, SCAL-03 | unit | `npx vitest run src/tests/scale-store.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/scale-math.test.ts` — stubs for SCAL-01, SCAL-04 pure math functions
- [ ] `src/tests/scale-store.test.ts` — stubs for SCAL-02, SCAL-03 store actions

*(No framework installation needed — Vitest 4.1.1 already installed and configured)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calibration line draws correctly on canvas with click-click | SCAL-01 | Konva canvas interaction requires visual inspection | Open PDF, activate Set Scale, click two points, verify line appears between them |
| Inline popup appears near line endpoint | SCAL-01 | DOM positioning requires visual check | After drawing line, confirm popup is visible, accessible, and near endpoint |
| Status bar shows scale ratio and "Not Set" warning | SCAL-03 | UI state requires visual inspection | Verify status bar shows "Scale: 1:N" after calibrate and "Scale: Not Set" in amber before |
| Uncalibrated page warning visible | SCAL-03 | Visual amber/orange indicator | On fresh PDF open, verify status bar shows amber "Not Set" text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
