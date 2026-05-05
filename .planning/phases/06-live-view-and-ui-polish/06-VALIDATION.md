---
phase: 6
slug: live-view-and-ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `06-RESEARCH.md §10`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run -- {testFile}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (full suite, current Phase 5 baseline) |

---

## Sampling Rate

- **After every task commit:** Run the test files added by that task — `npx vitest run -- {file1}.test.ts {file2}.test.ts` (typically <2s).
- **After every plan wave:** Run all Phase 6 test files — `npx vitest run -- "*panel*" "*thumbnail*" "*highlight*" "*splitter*" "*ui-panels*" "*header-bar*"`.
- **Before `/gsd-verify-work`:** Full suite must be green — `npx vitest run`.
- **Max feedback latency:** ≤2 seconds per quick run.

---

## Per-Task Verification Map

| # | Behavior | Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|---|----------|------------------------|-----------|-------------------|-------------|--------|
| 1 | `useBoqLive()` returns `BoqStructure` matching `aggregateBoq()` snapshot | VIEW-01 | unit | `npx vitest run -- use-boq-live.test.ts` | ❌ W0 | ⬜ pending |
| 2 | TotalsPanel renders from BoqStructure with correct row count + colors | VIEW-01 | component | `npx vitest run -- totals-panel-render.test.ts` | ❌ W0 | ⬜ pending |
| 3 | TotalsRow row-click cycles through pages with matches | VIEW-01 / D-10 | component | `npx vitest run -- totals-row-cycle.test.ts` | ❌ W0 | ⬜ pending |
| 4 | TotalsRow row-hover triggers HoverRing on current page only | VIEW-01 / D-11 | component | `npx vitest run -- totals-row-hover.test.ts` | ❌ W0 | ⬜ pending |
| 5 | TotalsRow right-click → "Copy as text" emits `navigator.clipboard.writeText` | VIEW-01 / D-14 | component | `npx vitest run -- totals-row-context-menu.test.ts` | ❌ W0 | ⬜ pending |
| 6 | TotalsPanel category-heading click toggles + persists to localStorage | VIEW-01 / D-13 | component | `npx vitest run -- totals-panel-category-collapse.test.ts` | ❌ W0 | ⬜ pending |
| 7 | TotalsPanel renders all 3 empty-state variants per condition | VIEW-01 / D-09 | component | `npx vitest run -- totals-panel-empty-states.test.ts` | ❌ W0 | ⬜ pending |
| 8 | ThumbnailStrip renders one tile per page; click → setPage(N) | PDF-05 | component | `npx vitest run -- thumbnail-strip-click.test.ts` | ❌ W0 | ⬜ pending |
| 9 | Thumbnail tile lazy-mounts on IntersectionObserver intersection | PDF-05 / D-17 | component | `npx vitest run -- thumbnail-lazy-mount.test.ts` | ❌ W0 | ⬜ pending |
| 10 | Thumbnail markup overlay refreshes within 200ms±50ms after markup commit | PDF-05 / D-19 | component | `npx vitest run -- thumbnail-overlay-debounce.test.ts` | ❌ W0 | ⬜ pending |
| 11 | Thumbnail page-label resolves via `getPageLabels()`, fallback `Page N` | PDF-05 / D-16 | unit | `npx vitest run -- use-page-labels.test.ts` | ❌ W0 | ⬜ pending |
| 12 | useUiPanels reads localStorage on mount; defaults on parse failure | D-03 | unit | `npx vitest run -- use-ui-panels.test.ts` | ❌ W0 | ⬜ pending |
| 13 | useUiPanels writes localStorage on width/open change | D-03 | unit | included in `use-ui-panels.test.ts` | ❌ W0 | ⬜ pending |
| 14 | PulseHighlight fades from opacity 0.85 → ~0 over 1500ms±50ms | D-12 | unit (fake timers) | `npx vitest run -- pulse-highlight-animation.test.ts` | ❌ W0 | ⬜ pending |
| 15 | PulseHighlight cleanup cancels rAF on unmount (no React warning) | D-12 | unit | included in `pulse-highlight-animation.test.ts` | ❌ W0 | ⬜ pending |
| 16 | HoverRing + PulseHighlight render with `listening={false}` (regression guard) | D-11 / D-12 | unit | `npx vitest run -- highlight-overlay-listening.test.ts` | ❌ W0 | ⬜ pending |
| 17 | CanvasHeaderBar shows `Set Scale` link only when uncalibrated AND has non-count markups | D-20 | component | `npx vitest run -- canvas-header-bar.test.ts` | ❌ W0 | ⬜ pending |
| 18 | CanvasHeaderBar `Set Scale` link click invokes `getCalibrationControls().activate()` | D-20 | component | included in `canvas-header-bar.test.ts` | ❌ W0 | ⬜ pending |
| 19 | Aggregator silently excludes length/area/perimeter on uncalibrated pages — already covered | D-07 | unit | `npx vitest run -- boq-aggregator.test.ts` | ✅ EXISTS | ⬜ pending |
| 20 | Aggregator emits metadata block (project, plan, pages, markups) — already covered | D-08 | unit | included in `boq-aggregator.test.ts` | ✅ EXISTS | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files to scaffold before implementation:

- [ ] `src/tests/use-boq-live.test.ts` — VIEW-01 aggregator subscription
- [ ] `src/tests/totals-panel-render.test.ts` — TotalsPanel renders BoqStructure
- [ ] `src/tests/totals-row-cycle.test.ts` — D-10 cycle navigation
- [ ] `src/tests/totals-row-hover.test.ts` — D-11 hover → HoverRing
- [ ] `src/tests/totals-row-context-menu.test.ts` — D-14 Copy as text
- [ ] `src/tests/totals-panel-category-collapse.test.ts` — D-13 collapse/expand + persistence
- [ ] `src/tests/totals-panel-empty-states.test.ts` — D-09 three variants
- [ ] `src/tests/thumbnail-strip-click.test.ts` — PDF-05 click → setPage
- [ ] `src/tests/thumbnail-lazy-mount.test.ts` — D-17 IntersectionObserver gate
- [ ] `src/tests/thumbnail-overlay-debounce.test.ts` — D-19 200ms refresh
- [ ] `src/tests/use-page-labels.test.ts` — getPageLabels fallback
- [ ] `src/tests/use-ui-panels.test.ts` — D-03 localStorage parse / write / reset
- [ ] `src/tests/pulse-highlight-animation.test.ts` — D-12 1500ms fade + rAF cleanup
- [ ] `src/tests/highlight-overlay-listening.test.ts` — listening={false} regression guard
- [ ] `src/tests/canvas-header-bar.test.ts` — D-20 conditional render + Set Scale wiring

*No new shared fixture file needed — existing `src/tests/fixtures/` covers PDF + markup scaffolds. No framework install needed — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement / Decision | Why Manual | Test Instructions |
|----------|------------------------|------------|-------------------|
| Konva PulseHighlight + HoverRing zoom-compensated visuals at 1x and 8x zoom | D-11 / D-12 | Visual fidelity at multiple zoom levels — Konva canvas pixel diffs are flaky | UAT: open project, place markup, zoom to 1x and 8x, hover and click matching TotalsPanel row, verify ring visually anchors to markup geometry at both zooms |
| Panel collapse/expand persists across reload | D-02 / D-03 | Cross-session persistence; involves Electron app reload | UAT: collapse Thumbnails, resize Totals to 400px, close app, reopen — both states should restore |
| Pulse fade timing feels right (~1.5s) | D-12 | Subjective UX feel; unit test covers math but not perceived feel | UAT: click TotalsPanel row, count "one-thousand" and "two-thousand" — pulse should be gone by end of "two" |
| Live totals update is immediate during rapid markup placement (no perceived lag) | VIEW-01 success criterion 1 | Subjective performance; profile only if regressed | UAT: place 20 markups in rapid succession on a calibrated page — TotalsPanel grand-total updates without flicker |
| Three-column layout doesn't obstruct canvas on 1080p | ROADMAP success criterion 3 | Layout perception | UAT: at 1920×1080 window, both panels open at default widths → canvas occupies majority of horizontal space, plan is clearly readable |
| Thumbnail markup overlay matches main canvas on rapid edit | D-15 / D-19 | Visual diff; debounce timing | UAT: place markup, observe thumbnail update within ~200ms; undo, observe revert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (15 new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s per quick run, < 30s per full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
