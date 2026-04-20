---
phase: 3
slug: markup-tools-and-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 (Node environment) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/tests/markup-math.test.ts --reporter=basic` |
| **Full suite command** | `npx vitest run` |
| **Typecheck command** | `npm run typecheck` |
| **Estimated runtime** | ~5 seconds (8 existing + ~3 new test files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/<file-touched>.test.ts --reporter=basic`
- **After every plan wave:** Run `npx vitest run && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green + manual visual verification of labels at min/max zoom
- **Max feedback latency:** ~5 seconds (unit tests); manual label check is wave-end gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | W0 | 0 | MARK-02,03,04,07 | unit | `npx vitest run src/tests/markup-math.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-02 | W0 | 0 | MARK-01,05,06,08 | unit | `npx vitest run src/tests/markup-store.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-03 | W0 | 0 | MARK-09,10 | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-01 | 01 | 1 | MARK-01,05,06,08 | unit | `npx vitest run src/tests/markup-store.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | MARK-02,03,04 | unit | `npx vitest run src/tests/markup-math.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | MARK-09,10 | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | MARK-01 | unit+manual | `npx vitest run src/tests/markup-store.test.ts -t "count"` + visual | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | MARK-02 | unit+manual | `npx vitest run src/tests/markup-math.test.ts -t "polylineLength"` + visual | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | MARK-03,04 | unit+manual | `npx vitest run src/tests/markup-math.test.ts -t "polygon"` + visual | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | MARK-07,08 | unit+manual | `npx vitest run src/tests/markup-math.test.ts -t "label"` + zoom visual | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | MARK-09,10 | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ W0 | ⬜ pending |
| 3-05-01 | 05 | 3 | MARK-05,06 | unit+manual | `npx vitest run src/tests/markup-store.test.ts -t "category"` + popup visual | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/markup-math.test.ts` — stubs for MARK-02, MARK-03, MARK-04, MARK-07 (`polylineLength`, `polygonArea`, `polygonCentroid`, real-world unit conversion, label font-size floor formula)
- [ ] `src/tests/markup-store.test.ts` — stubs for MARK-01, MARK-05, MARK-06, MARK-08 (categories: auto-create, case-insensitive dedupe, palette cycling; per-page markup lists; count sequence numbering; placeMarkup stores name)
- [ ] `src/tests/markup-commands.test.ts` — stubs for MARK-09, MARK-10 (place/delete commands, undo, redo, stack depth clamp at 50, 20+ round-trip integrity, new action clears redo)

No new framework installation needed (Vitest 4.1.1 already present). No shared fixtures file needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Labels readable at all zoom levels | MARK-07 | Visual — font size floor needs human eye confirmation | Open PDF, place markup, zoom from fit-to-window to maximum; confirm label is never invisible |
| Count pins labeled correctly (dot + name + number) | MARK-01 | Visual — rendered text content not automatable | Place 3 count pins for same item; confirm labels show "Item 1", "Item 2", "Item 3" |
| Polygon fill 20% alpha visible on bright PDF | MARK-03,04 | Visual — alpha rendering varies by monitor | Place polygon over white/light region; confirm fill is visible but plan readable beneath |
| Undo/redo visual feedback — toolbar button states | MARK-09,10 | Visual — button disabled state | After undo stack empty, confirm Undo button is disabled; after redo, confirm Redo button disabled |
| Popup dismisses cleanly on Escape mid-draw | MARK-05 | Interaction — keyboard flow | Begin polyline, press Escape; confirm no markup created and tool returns to idle |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s for unit tests
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
