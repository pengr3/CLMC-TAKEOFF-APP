---
phase: 5
slug: boq-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/tests/<files-touched>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1–2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/<files-touched>.test.ts`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

> Filled by the planner from PLAN.md task IDs. One row per task with an `<automated>` verify command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolds the planner must inject so RED tests compile before any executor work in later waves. Filled by planner; the items below are derived from RESEARCH.md §"Test mapping" as the minimum.

- [ ] Install dev-deps from `package.json` already in stack: confirm `exceljs@4.4.0`, `csv` umbrella package (csv-stringify), `lucide-react` already resolve. **No new packages needed** (verified by smoke test in RESEARCH.md).
- [ ] `src/tests/boq-aggregator.test.ts` — NEW: deterministic fixtures covering EXPRT-01/02:
  - empty project → empty BoqStructure
  - 2-page project, mixed markup types (count + linear + area)
  - perimeter shapes synthesize two virtual rows (`{name} (perimeter)` and `{name} (area)`)
  - same name across distinct non-perimeter types triggers `(type)` suffix
  - uncalibrated page → length/area/perimeter excluded, counts kept
  - `categoryOrder` respected; empty categories excluded
  - `getColorForName(name)` value carried into the row
  - quantities use `pixelLengthToReal` / `pixelAreaToReal` against `globalUnit`
- [ ] `src/tests/boq-writers.test.ts` — NEW: round-trip XLSX and CSV writers against the same in-memory BoqStructure:
  - `buildBoqXlsx(structure) → Buffer`: load buffer back via `new ExcelJS.Workbook().xlsx.load(buf)`, assert `cell.value` is `typeof === 'number'` for quantities, assert `numFmt === '0.00'` for length/area cells, `numFmt === '0'` for count cells, ARGB fill on Item cell matches expected hex, header row is bold and `worksheet.views[0].state === 'frozen'`, merged-cell category headings present.
  - `buildBoqCsv(structure) → string`: assert RFC 4180 quoting (commas / newlines / quotes inside Item names), `\r\n` line endings, no UTF-8 BOM, structural row order matches XLSX (metadata block → blank → header → category → items → subtotal → grand total).
- [ ] `src/tests/boq-export-ipc.test.ts` — NEW: integration round trip — orchestrate aggregator → IPC handler stubs → atomic write → read-back. Exercise both `file:writeBoqXlsx` and `file:writeBoqCsv` and the `dialog:saveExport` dialog stub (return `null` for cancel; assert UX returns no toast on cancel).
- [ ] `src/tests/uncalibrated-export-warning-modal.test.ts` — NEW: D-06 modal renders the affected page list, [Continue] resolves to "proceed", [Cancel] resolves to "abort".
- [ ] `src/tests/toolbar-export-button.test.ts` — NEW: `Export` IconButton renders after `Replace Plan PDF`, disabled when `totalPages === 0 || isSaving || hasZeroMarkups`.
- [ ] `src/tests/use-keyboard-shortcuts.test.ts` — extend: `Ctrl+Shift+E` fires the export handler when no text input is active, suppressed when `isTextInputActive()` returns true.
- [ ] `src/tests/project-store.test.ts` — extend: optional `isExporting` primitive selector if the planner adds it (D-19 race protection).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Open exported `.xlsx` in Microsoft Excel and confirm rendering | EXPRT-01 | Requires real Excel runtime — Vitest can verify the bytes but not how Excel paints them | Place markups across 2+ pages and 2+ categories → Ctrl+Shift+E → save → open in Excel → confirm: header row frozen on scroll, bold category headings, Item-cell fills match canvas colors, `=SUM(B:B)` over a quantity column returns a number (not `#VALUE!`), column widths are readable. |
| Open exported `.csv` in Excel and confirm round-trip | EXPRT-02 | Excel CSV import quirks (locale, separator detection) cannot be exercised in Vitest | Same takeoff → save as `.csv` → open in Excel → confirm rows align, numeric columns import as numbers, `=SUM(...)` works on a quantity column. Repeat opening in Google Sheets / Numbers to confirm cross-tool fidelity. |
| Native Save dialog filter selection | D-16, D-17 | Requires Electron OS dialog | Click Export → confirm `.xlsx` filter is default, default filename is `{project-basename}-BOQ.xlsx`; switch filter to `.csv` → confirm extension swaps to `.csv`. Cancel → no toast, no file written. |
| Pre-export uncalibrated-page warning | D-06 | Requires multi-page calibration state | Calibrate page 1, leave page 2 uncalibrated, place a count + a linear markup on page 2 → Export → modal lists page 2, says counts will export but length/area excluded → Continue → confirm exported file omits the page-2 linear row but keeps the count row. |
| `Ctrl+Shift+E` shortcut and text-input guard | D-18 | Requires real keyboard event over the renderer | Focus is on canvas → press `Ctrl+Shift+E` → save dialog opens. Open `MarkupNamePopup` and type `Ctrl+Shift+E` while in the input → save dialog must NOT open. |
| Toast on success / error toast on failure | D-20, D-21 | Requires real success and forced-failure flow | Successful export → ConfirmationToast shows `Exported: {filename}` (basename only). Force a write failure (e.g., target `.xlsx` is open in Excel) → error surface (toast or modal) shows the OS reason and app does not crash. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
