---
phase: 10
slug: granular-undo-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/tests/markup-tool-point-redo.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/markup-tool-point-redo.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 0 | MARK-09 | — | N/A | unit (RED) | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | MARK-09 | — | N/A | unit (GREEN) | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | MARK-09 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/markup-tool-point-redo.test.ts` — RED stubs for `repushLastPoint()`, `redoPoints` clearing on new click, first-point-pop-cancels behavior
- [ ] Existing `src/tests/markup-tool-pop-last-point.test.ts` — must remain GREEN throughout (no regressions)

*Existing infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All five tools (linear, area, perimeter, wall, count) point-pop in live app | MARK-09 | Canvas interaction requires live render | Draw 3+ point markup, Ctrl+Z twice, Ctrl+Y once, finish — verify correct shape committed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
