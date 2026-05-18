---
phase: 9
slug: selection-model-ribbon-toolbar-modal-polish-and-markup-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-00-01 | 00 | 0 | — | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 09-00-02 | 00 | 0 | — | — | N/A | unit | `npm run test -- markupStore` | ❌ W0 | ⬜ pending |
| 09-01-01 | 01 | 1 | — | — | N/A | unit | `npm run test -- useDraggable` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | — | — | N/A | integration | `npm run test -- --run && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | — | — | N/A | unit | `npm run test -- viewerStore` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | — | — | isTextInputActive guard | unit | `npm run test -- shortcuts` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | — | — | min-point guard silent ignore | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | — | — | N/A | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-04-02 | 04 | 2 | — | — | N/A | integration | `npm run test -- --run` | ✅ | ⬜ pending |
| 09-05-01 | 05 | 3 | — | — | N/A | manual | See UAT plan | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/delete-group-command.test.ts` — RED stubs for deleteGroup action, undo, redo
- [ ] `src/tests/viewer-store-selection.test.ts` — RED stubs for selectedMarkupIds init, setSelectedMarkupIds, clearSelection, page-change clear
- [ ] `src/tests/use-draggable.test.ts` — RED stubs for useDraggable position init, pointer move, reset on mount, listener cleanup

*Existing infrastructure covers all other phase requirements — no new test framework or config changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Selection ring visible on clicked markup | SC-1 | Konva canvas not testable in jsdom | Click any markup in 'select' mode; verify blue ring appears |
| Rubber-band draws and selects | SC-2 | Canvas interaction requires E2E | Drag across canvas; verify rect appears and markups highlight |
| Modal centering + drag | SC-3 | CSS layout not testable in jsdom | Open any modal; verify it appears centered; drag title bar |
| Ribbon tabs and all buttons functional | SC-4 | Full DOM interaction | Click each tab; verify correct button set renders |
| Enter key commits markup | SC-5 | Canvas tool state | Start a linear markup; press Enter; verify markup commits |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
