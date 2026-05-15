---
phase: 8
slug: markup-workflow-and-wall-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vitest.config.ts` (existing — do NOT modify mid-wave) |
| **Quick run command** | `npx vitest run src/tests/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Feature | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|---------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-00-01 | 00 | 0 | Wall math RED | — | N/A | unit | `npx vitest run src/tests/wall-math.test.ts` | ❌ W0 | ⬜ pending |
| 08-00-02 | 00 | 0 | BOQ aggregator wall RED | — | N/A | unit | `npx vitest run src/tests/boq-aggregator-wall.test.ts` | ❌ W0 | ⬜ pending |
| 08-00-03 | 00 | 0 | Schema hidden RED | — | N/A | unit | `npx vitest run src/tests/project-schema-hidden.test.ts` | ❌ W0 | ⬜ pending |
| 08-00-04 | 00 | 0 | Chain mode RED | — | N/A | unit | `npx vitest run src/tests/chain-mode.test.ts` | ❌ W0 | ⬜ pending |
| 08-00-05 | 00 | 0 | TotalsRow visibility RED | — | N/A | unit | `npx vitest run src/tests/totals-row-visibility.test.ts` | ❌ W0 | ⬜ pending |
| 08-00-06 | 00 | 0 | Markup visibility RED | — | N/A | unit | `npx vitest run src/tests/markup-visibility.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-01 | 01 | 1 | Chain mode GREEN | — | N/A | unit | `npx vitest run src/tests/chain-mode.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | Schema hidden GREEN | T-08-hiddenNames | `hiddenItemNames` defaults to `[]` on old file load | unit | `npx vitest run src/tests/project-schema-hidden.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | Wall math GREEN | T-08-wallHeight | Wall height input is numeric only; NaN rejected | unit | `npx vitest run src/tests/wall-math.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | BOQ aggregator wall GREEN | — | Hidden markups still aggregate (D-15) | unit | `npx vitest run src/tests/boq-aggregator-wall.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 3 | TotalsRow lightbulb GREEN | — | `e.stopPropagation()` prevents row cycle | unit | `npx vitest run src/tests/totals-row-visibility.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 3 | Markup renderer skip-render GREEN | — | Hidden markup returns null | unit | `npx vitest run src/tests/markup-visibility.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 4 | Manual UAT | — | 10-scenario UAT checklist | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/wall-math.test.ts` — wall area unit tests: `wallAreaM2(points, heightMm, pixelsPerMm)` returns correct m²; zero-length → 0; 5m × 2.4m = 12 m²
- [ ] `src/tests/boq-aggregator-wall.test.ts` — wall markup produces m² row; hidden items still aggregate (D-15 passthrough)
- [ ] `src/tests/project-schema-hidden.test.ts` — old v2 file without `hiddenItemNames` loads as `[]`; file with `hiddenItemNames: ['Outlet']` round-trips correctly
- [ ] `src/tests/chain-mode.test.ts` — `commitShape` with `chainArmed=true` returns to `'drawing'` mode; `cancel()` resets `chainArmed` to false; wall height carried across chain commit
- [ ] `src/tests/totals-row-visibility.test.ts` — lightbulb click toggles `hiddenItemNames` in projectStore; lightbulb click does not trigger row cycle navigation (`e.stopPropagation`)
- [ ] `src/tests/markup-visibility.test.ts` — `CountPinMarkup` returns null when name in `hiddenItemNames`; `WallMarkup` returns null when name in `hiddenItemNames`

*All above are RED stubs at Wave 0 — must FAIL before implementation, must PASS after.*

---

## Manual-Only Verifications

| Behavior | Feature | Why Manual | Test Instructions |
|----------|---------|------------|-------------------|
| Wall polyline renders with 2.5× stroke + parallel offset hairline | Wall tool | CSS/Konva visual | Place wall on canvas, verify distinct from linear at 3 zoom levels |
| Crosshair cursor appears/disappears correctly | Crosshair | CSS cursor appearance | Activate count/linear/area/perimeter/wall/scale tools; verify crosshair renders; verify select tool reverts |
| Chain badge chip shows armed name + color dot | Chain mode | DOM visual | Place linear markup, verify chip appears in Toolbar; Esc → chip disappears |
| Chain persists across page navigation | Chain mode | Multi-page UX | Place linear, navigate page, verify still in drawing mode |
| BOQ export includes wall in m² + hidden items included | Wall + show/hide | File output | Export to .xlsx; verify wall row with m² unit; hide an item; export again; verify still in BOQ |
| Wall height edit via right-click → Edit | EditMarkupCommand | Undo path | Edit wall height; verify in TotalsPanel; Ctrl+Z; verify reverted |
| Save/reload preserves `hiddenItemNames` | Persistence | Requires save/load cycle | Hide item; save; reload; verify still hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
