---
phase: 1
slug: pdf-viewer-and-canvas-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | — | infra | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | PDF-01 | unit | `npx vitest run src/tests/ipc.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | PDF-01 | unit | `npx vitest run src/tests/pdfLoader.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | PDF-02 | unit | `npx vitest run src/tests/pageNav.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | PDF-03, PDF-04 | unit | `npx vitest run src/tests/stageTransform.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | PDF-03 | unit | `npx vitest run src/tests/zoomToCursor.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | PDF-06 | unit | `npx vitest run src/tests/pageState.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 2 | PDF-03 | manual | — | — | ⬜ pending |
| 1-04-03 | 04 | 2 | PDF-04 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitest/coverage-v8` installed as devDependencies
- [ ] `vitest.config.ts` created at project root with electron renderer environment config
- [ ] `src/tests/ipc.test.ts` — stub for IPC file-open handler (PDF-01)
- [ ] `src/tests/pdfLoader.test.ts` — stub for PDF loading and page count (PDF-01)
- [ ] `src/tests/pageNav.test.ts` — stubs for prev/next navigation logic (PDF-02)
- [ ] `src/tests/stageTransform.test.ts` — stubs for zoom/pan math (PDF-03, PDF-04)
- [ ] `src/tests/zoomToCursor.test.ts` — stub for zoom-to-cursor coordinate math (PDF-03)
- [ ] `src/tests/pageState.test.ts` — stub for per-page zoom state persistence (PDF-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF renders at readable quality on screen | PDF-01 | Visual quality judgment; no pixel-diff baseline | Open a real construction PDF; verify text and lines are sharp |
| Zoom 8x on a plan feature keeps markup pinned | PDF-03 | Requires real mouse interaction + visual verification | Place a test dot, zoom to 8x, pan; verify dot stays on feature |
| Fit-to-window shows full page without distortion | PDF-03 | Visual verification of aspect ratio | Click Fit; verify full page visible, no clipping |
| 150% Windows DPI: no blur or pointer offset | PDF-03, PDF-04 | Requires physical hardware or VM at 150% scaling | Set Windows display to 150%, open PDF, click canvas; verify pointer lands correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
