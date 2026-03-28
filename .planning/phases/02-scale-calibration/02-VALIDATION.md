---
phase: 02
slug: scale-calibration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SCAL-01 | unit | `npx vitest run src/tests/scale-math.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SCAL-02 | unit | `npx vitest run src/tests/scale-store.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SCAL-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | SCAL-04 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/scale-math.test.ts` — stubs for SCAL-01 (scale math functions)
- [ ] `src/tests/scale-store.test.ts` — stubs for SCAL-02 (per-page scale state)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calibration line visual appearance at all zoom levels | SCAL-01 | Requires visual inspection of Konva shapes | Draw calibration line, zoom in/out, verify consistent stroke width and endpoint visibility |
| "Not calibrated" warning visibility | SCAL-04 | Requires visual inspection | Open multi-page PDF, navigate to uncalibrated page, verify warning is visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
