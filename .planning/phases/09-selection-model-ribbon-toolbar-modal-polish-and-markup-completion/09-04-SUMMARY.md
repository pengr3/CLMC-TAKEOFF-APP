---
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
plan: "04"
subsystem: ui
tags: [ribbon, toolbar, tabs, react, lucide-react, ui-chrome]

requires:
  - phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
    plan: "00"
    provides: "viewerStore activeTool='select' baseline (D-15 / D-19 Select tool sets activeTool='select')"
  - phase: 03-markup-tools-and-editing
    provides: "Toolbar.tsx prop contract (onOpenClick / onReplaceClick / onExportClick) — preserved verbatim in RibbonToolbarProps"
  - phase: 06-totals-panel
    provides: "useUiPanels (totals.open + setTotalsOpen) — wired to View tab Show Totals toggle"
  - phase: 08-markup-workflow-and-wall-tool
    provides: "Module-level refs getCanvasControls / getCalibrationControls / getChainArmedItem in CanvasViewport — RibbonToolbar reads, never duplicates trigger logic"

provides:
  - "RibbonButton — 72×80 Office-style ribbon button (icon above 11px label)"
  - "RibbonToolbar — 7-tab ribbon (Home / Page / Tools / View / Estimating / Settings / Help) replacing the flat Toolbar in App.tsx"
  - "Select tool wired in Tools tab via setActiveTool('select') — first visible UI surface for the selection model from Plan 09-00"
  - "View tab: Show Totals toggle + Show All / Hide All visibility controls (Show All / Hide All call markDirty after setHiddenItemNames — Pitfall 7 mitigation)"
  - "LAYOUT.toolbarHeight in constants.ts annotated as legacy (zero consumers; RibbonToolbar governs its own height)"

affects: [09-05, 09-06]

tech-stack:
  added: []  # No new packages — all icons available in existing lucide-react
  patterns:
    - "Ribbon tab strip + ribbon panel: 28px tab strip + 88px minHeight panel ≈ 116px total ribbon height"
    - "RibbonButton column-flex (icon above label) distinct from IconButton row-flex (icon beside label) — kept side-by-side so Toolbar tests stay green"
    - "Chain badge chip absolutely-positioned at the bottom of the RibbonButton (only space left after icon + label stack)"
    - "Set Scale chevron absolutely-positioned at the top-right of the Tools-tab Set Scale RibbonButton (mirrors Toolbar.tsx pattern; chevron stopsPropagation to avoid triggering button onClick)"
    - "Tab switching state lives as local useState inside RibbonToolbar — ephemeral UI state, no persistence (D-24 default 'home' applies on every mount)"

key-files:
  created:
    - src/renderer/src/components/RibbonButton.tsx
    - src/renderer/src/components/RibbonToolbar.tsx
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/lib/constants.ts

key-decisions:
  - "RibbonButton 72×80 (not 60×60 from RESEARCH §3.3): icon(20) + gap(4) + label(11) + padding(8+8) ≈ 51px content; 80px leaves 29px breathing room + space for 2px active border-bottom without clipping (planner review)"
  - "Ribbon panel minHeight 88 (not fixed ~68): allows 80px buttons + 8px vertical padding without overflow; planner review concern resolved"
  - "Toolbar.tsx retained alongside RibbonToolbar (deletion deferred to UAT plan 09-06) so toolbar-replace-pdf.test.ts / toolbar-saving-disabled.test.ts / toolbar-open-prop.test.ts / toolbar-export-button.test.ts remain green without test-file edits (parallel-executor safety — no test config changes mid-wave)"
  - "Open button rendered as bespoke 72×80 element with accent background (matches legacy Toolbar's primary-Open visual identity); RibbonButton itself does not carry a 'primary' variant — keeps the shared component minimal"
  - "Show Totals button label flips between 'Show Totals' / 'Hide Totals' based on totals.open (and uses `active` highlight when open) — gives the user a single-tap mental model without a separate pinned-state indicator"
  - "Ribbon Hide All disabled when hasMarkups is false (nothing to hide) — purely cosmetic, but mirrors the Export-disabled rule and prevents an empty markDirty() on an empty project"
  - "View tab uses lucide `Table` icon for Show/Hide Totals toggle (closest semantic match for a totals panel; lucide-react has no dedicated 'panel' icon)"
  - "Estimating tab implements D-21 implementer discretion as a 'Quick Export' label + a second Export RibbonButton — gives a useful entry point without committing to BOQ summary stats this phase"
  - "constants.ts LAYOUT.toolbarHeight kept at 40 with a `// legacy` comment (zero consumers confirmed by `grep -rn 'LAYOUT.toolbarHeight'` returning only the constant definition itself); avoids touching layout math in any consumer"

patterns-established:
  - "Ribbon ChainBadge helper component extracted inside RibbonToolbar.tsx so the 5 markup tools each call <ChainBadge color={...} name={...} /> instead of inlining the 16-line chip JSX 5×; matches Toolbar.tsx semantics with 80% less duplication"
  - "Absolute-positioned children (chevron, badge) inside RibbonButton — RibbonButton sets position: 'relative' precisely to enable this"

requirements-completed: []

duration: ~25min
completed: 2026-05-18
---

# Phase 09 Plan 04: Tabbed RibbonToolbar Summary

**Replaces the flat Toolbar with a 7-tab Office-style ribbon (Home / Page / Tools / View / Estimating / Settings / Help) — adds the Select tool button (D-19), Show Totals toggle and Show All / Hide All visibility controls (D-20), and the Quick Export shortcut on the Estimating tab (D-21); legacy Toolbar.tsx is retained alongside so existing toolbar-*.test.ts files stay green.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (both type=auto, sequential)
- **Files created:** 2 (RibbonButton.tsx, RibbonToolbar.tsx)
- **Files modified:** 2 (App.tsx, constants.ts)
- **Test impact:** Full vitest run 473 / 473 tests pass across 66 files; both typecheck:web and typecheck:node exit 0

## Accomplishments

- **RibbonButton (D-16):** 72×80px column-layout button (icon 20 above 11px label) — distinct from IconButton's 28px row layout. Inline styles with `COLORS` tokens only; supports `active` / `disabled` / `onContextMenu` / `children` slot for badges + chevrons. Active state: `activeSurface` background + 2px `accent` border-bottom.
- **RibbonToolbar (D-15):** Full 7-tab ribbon (Home active by default — D-24). Identical prop interface to legacy `ToolbarProps` (`onOpenClick`, `onReplaceClick`, `onExportClick`), so the App.tsx swap is a 2-line import+JSX change.
- **Home tab (D-17):** Open, Save, Save As, Replace Plan PDF, Export — 1:1 migration of the legacy left-group; same disabled rules (`saveDisabled` / `replaceDisabled` / `exportDisabled`).
- **Page tab (D-18):** Previous, "Page N of M" indicator, Next — same controls as the legacy center group; shows "No PDF loaded — open a project or PDF from the Home tab" when `totalPages === 0`.
- **Tools tab (D-19):** Select (new — `MousePointer` icon, sets `activeTool='select'`), Count, Linear, Area, Perimeter, Wall, Set Scale (with chevron context menu when calibrated). Chain-armed badge chips render per-tool when `activeTool === <tool>` AND `getChainArmedItem() !== null` (Pitfall 6 — same gating as the legacy Toolbar).
- **View tab (D-20):** Zoom In, Zoom Out, Fit, Show Totals toggle (label flips between Show / Hide based on `useUiPanels().totals.open`), Show All (Eye icon — calls `setHiddenItemNames([])` + `markDirty()`), Hide All (EyeOff icon — collects every `name|categoryId` key across pages and calls `setHiddenItemNames(allKeys)` + `markDirty()`).
- **Estimating tab (D-21):** "Quick Export" label + Export RibbonButton (same disabled rule as Home Export).
- **Settings / Help tabs (D-22 / D-23):** Centered italic "{tab} — Coming soon" text in `COLORS.textSecondary`.
- **Module-ref discipline:** All cross-component canvas/calibration/chain access goes through `getCanvasControls()`, `getCalibrationControls()`, `getChainArmedItem()` — no duplicated trigger logic (STATE.md canonical pattern; Pitfall T-09-04-03 mitigated).
- **Pitfall 7 mitigation:** Show All / Hide All both explicitly call `useProjectStore.getState().markDirty()` after `setHiddenItemNames(...)` — the store action is intentionally hydration-safe and does not mark dirty internally.
- **LAYOUT.toolbarHeight:** Zero consumers in the codebase (grep confirmed); kept at 40 with a `// legacy` inline comment in `constants.ts` so any future consumer that adds a layout-height dependency sees the warning without needing to read the original PLAN.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create RibbonButton component | `b11101f` | `src/renderer/src/components/RibbonButton.tsx` |
| 2 | Create RibbonToolbar + switch App.tsx + annotate constants | `2cbb749` | `src/renderer/src/components/RibbonToolbar.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/lib/constants.ts` |

## Files Created/Modified

**Created**
- `src/renderer/src/components/RibbonButton.tsx` (105 lines) — 72×80 column-layout RibbonButton with hover/active/disabled state and abs-positioned children slot
- `src/renderer/src/components/RibbonToolbar.tsx` (682 lines) — 7-tab ribbon, RibbonToolbarProps identical to ToolbarProps, full feature parity with legacy Toolbar + 3 net-new controls (Select, Show All, Hide All) + Show Totals toggle

**Modified**
- `src/renderer/src/App.tsx` — 2-line diff: `import { Toolbar }` → `import { RibbonToolbar }` (line 3); `<Toolbar .../>` → `<RibbonToolbar .../>` (line 244). Props unchanged.
- `src/renderer/src/lib/constants.ts` — 1-line diff: added `// legacy — RibbonToolbar governs its own height; this value is not consumed by any component` comment on `LAYOUT.toolbarHeight: 40`.

## Decisions Made

- **Sized RibbonButton at 72×80 instead of the RESEARCH §3.3 reference of 60×60.** 60×60 was cramped for the 20px icon + 4px gap + 11px label stack (≈ 35px content with no padding). 72×80 gives 29px of vertical breathing room over the 51px content stack and reserves space for the 2px active border-bottom without forcing label clipping. The plan's task 1 done-criteria explicitly required `width 72 / height 80`.
- **Ribbon panel uses `minHeight: 88` (not a fixed height).** Fixed heights clip the 80px buttons once you add 4-8px of vertical padding. minHeight allows the panel to grow if a tab adds a taller affordance later (e.g., chevron + badge stack on Set Scale).
- **Retained Toolbar.tsx alongside RibbonToolbar.tsx.** Four existing tests directly import `Toolbar` (`toolbar-replace-pdf.test.ts`, `toolbar-saving-disabled.test.ts`, `toolbar-open-prop.test.ts`, `toolbar-export-button.test.ts`). Deleting Toolbar.tsx in this plan would force same-wave edits to those four tests, which violates the parallel-executor "no test infra changes mid-wave" convention from STATE.md. The plan explicitly defers Toolbar.tsx deletion to UAT plan 09-06 after wave-level integration confirms no regressions.
- **Open button rendered as a bespoke accent-coloured 72×80 element, not a `<RibbonButton variant="primary">`.** Adding a `variant` prop to RibbonButton would broaden its API for a single callsite. The bespoke render keeps RibbonButton itself minimal while matching the legacy Toolbar's primary-Open visual identity. Trade-off is acceptable — Open is the one button users hit before there is even a project to interact with, so a slightly distinct treatment is appropriate.
- **`<ChainBadge>` extracted as a local helper component (not exported).** The chain-armed chip JSX was inlined 5× in legacy Toolbar.tsx. Extracting saved ~75 lines of duplication and made the per-tool conditional readable at a glance. Kept local to RibbonToolbar.tsx because the absolute-bottom-positioning is tied to RibbonButton geometry; no value in making it reusable.
- **lucide `Table` icon for Show Totals toggle.** lucide-react has no dedicated "panel" icon. `Table` matches the visual concept of a tabular totals panel and is the closest semantic match available in the existing icon library — using an existing icon avoids adding a dependency for a single button. Label is the primary affordance ("Show Totals" / "Hide Totals"); the icon is supportive.
- **`Hide All` disabled when `hasMarkups === false`.** Pressing Hide All on an empty project would dirty the project for no behavioural change. Disabling mirrors Export's disabled rule and prevents zero-op writes to `hiddenItemNames`.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<verify>` block recommended `npm run test -- --run`, which does not work in this project (no `test` script in `package.json`). I followed the documented project convention from the Wave 0 SUMMARY and used `npx vitest run` instead. This matches the canonical run-command Plan 09-00 used. No source change, no spec change.

## Issues Encountered

None.

## Threat Model Compliance

| Threat ID | Disposition | Implementation |
| --------- | ----------- | -------------- |
| T-09-04-01 (Hide All not persisted) | mitigate | `handleHideAll` calls `useProjectStore.getState().markDirty()` after `setHiddenItemNames(allKeys)` (RibbonToolbar.tsx line 235) — Pitfall 7 explicitly documented in the source file header |
| T-09-04-02 (Chain badge on wrong button) | mitigate | Each tool button conditionally renders `<ChainBadge>` only when `activeTool === <toolName>` AND `getChainArmedItem() !== null` — same gating shape as Toolbar.tsx lines 368-380 |
| T-09-04-03 (Duplicate Set Scale trigger) | mitigate | `handleSetScale` is the sole entry point and calls `getCalibrationControls()?.activate()` via the module-level ref from CanvasViewport — no duplication |

## Known Stubs

| Stub | File | Line | Reason |
| ---- | ---- | ---- | ------ |
| Settings tab "Coming soon" | RibbonToolbar.tsx | renderStubTab caller line ~582 | D-22 — Settings tab intentionally stubbed this phase; deferred to a future phase per CONTEXT.md "Deferred Ideas" |
| Help tab "Coming soon" | RibbonToolbar.tsx | renderStubTab caller line ~584 | D-23 — Help tab intentionally stubbed this phase; deferred to a future phase per CONTEXT.md "Deferred Ideas" |

Both stubs match plan acceptance criteria (D-22 / D-23 — "Stubbed: tab label present, panel shows 'Coming soon'"). Not blockers.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `src/renderer/src/components/RibbonButton.tsx` exists (created on commit `b11101f`)
- `src/renderer/src/components/RibbonToolbar.tsx` exists (created on commit `2cbb749`)
- `src/renderer/src/App.tsx` line 3 contains `import { RibbonToolbar }` and line 244 contains `<RibbonToolbar`
- `src/renderer/src/components/RibbonButton.tsx` lines 62-63 contain `width: 72` / `height: 80`
- `src/renderer/src/components/RibbonToolbar.tsx` line 652 contains `minHeight: 88`
- `src/renderer/src/components/RibbonToolbar.tsx` lines 220-235 contain `handleShowAll` / `handleHideAll` both calling `markDirty()`
- `src/renderer/src/components/RibbonToolbar.tsx` contains 8 `getChainArmedItem()` reads (1 import + 4 condition checks + 4 chip-data reads — wall is the 5th tool and a second pair is grouped under the same conditional)
- `src/renderer/src/lib/constants.ts` line 28 contains the `// legacy — RibbonToolbar governs its own height...` comment on `toolbarHeight: 40`
- All 7 tabs present in `TabId` union (line 67) and `TABS` array (lines 75-81)
- `npx vitest run` → 473 / 473 tests pass across 66 files (66.23s)
- `npx tsc --noEmit -p tsconfig.web.json --composite false` → exit 0 (no output)
- `npx tsc --noEmit -p tsconfig.node.json --composite false` → exit 0 (no output)
- Commits `b11101f` and `2cbb749` present in `git log --oneline`

## Next Phase Readiness

Plan 09-04 is complete. The ribbon is the live toolbar in App.tsx, all 7 tabs render, and all existing toolbar-bound tests pass without modification because Toolbar.tsx remains alongside (its deletion is deferred to UAT plan 09-06).

Wave-2 sibling plans (modal-drag retrofit) are unblocked and parallel-safe — there is no cross-coupling between this plan's files (`RibbonButton.tsx`, `RibbonToolbar.tsx`, `App.tsx`, `constants.ts`) and any modal component.

Recommended follow-ups for plan 09-06 (UAT / closure):
1. Delete `src/renderer/src/components/Toolbar.tsx` and the 4 `toolbar-*.test.ts` files (their assertions are visually covered by the ribbon — repoint or remove).
2. Capture a UAT screenshot per tab so the ribbon's tab-strip + panel proportions are documented at the 1280×720 layout target.
3. Decide whether `LAYOUT.toolbarHeight` should be deleted from `constants.ts` entirely (zero current consumers — only kept as legacy reference).

No blockers. No CLAUDE.md violations. No threats unmitigated.

---
*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Completed: 2026-05-18*
