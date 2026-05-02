---
phase: 05-boq-export
plan: 02
subsystem: api
tags: [exceljs, csv-stringify, boq-writers, atomic-write, ipc-foundation]

requires:
  - phase: 05-boq-export
    provides: BoqStructure types from Plan 00; aggregator output shape from Plan 01
  - phase: 04-project-persistence
    provides: project-io path-enforcement pattern (enforceClmcExtension)
provides:
  - buildBoqXlsx(b) — pure async (BoqStructure → Buffer) using ExcelJS streamed writeBuffer
  - buildBoqCsv(b) — pure sync (BoqStructure → string) using csv-stringify/sync
  - enforceXlsxExtension(p) / enforceCsvExtension(p) — path normalizers for Save dialog (D-16, D-17)
affects: 05-03 (IPC handlers wrap these with atomicWriteFile)

tech-stack:
  added: []
  patterns: [pure-byte-builder pattern (no fs/dialog/ipcMain imports) so IPC handlers in Plan 03 own the side-effect boundary]

key-files:
  created:
    - src/main/boq-writers.ts
  modified:
    - src/main/project-io.ts
    - src/tests/project-io.test.ts (added enforce* test cases)

key-decisions:
  - "Writers are PURE — no fs, no dialog, no ipcMain imports. Plan 03 IPC handlers wrap them with atomicWriteFile(.tmp + rename). Mirrors the assemble/extract pure-helper pattern in project-io.ts (Q5, RESEARCH §Pattern 5)"
  - "ExcelJS native-number quantity (typeof === 'number' after xlsx.load) — D-03; numFmt '0.00' for length/area, '0' for count; SUM() formulas work post-export"
  - "ARGB color format 'FF{RRGGBB}' for fills (D-13) — ExcelJS requires the alpha prefix; converter normalizes input '#0078d4' → 'FF0078D4'"
  - "Title row bold + frozen view via ws.views[{ state: 'frozen', ySplit: titleRow }] (D-10)"
  - "Subtotal/grand-total rows use light-gray fill 'FFEFEFEF' + bold (Q1)"
  - "CSV uses CRLF line endings (D-14, RESEARCH §Pitfall 4) — csv-stringify accepts record_delimiter: '\\r\\n' explicitly"
  - "CSV does NOT emit UTF-8 BOM (D-14) — pure string output, IPC handler writes Buffer.from(csvString, 'utf8') with no prefix"
  - "RFC 4180 quoting handled by csv-stringify default quote behavior (commas/quotes/newlines auto-quoted; embedded quotes doubled)"

patterns-established:
  - "Pure byte-builder pattern: writer functions take a normalized in-memory structure and return Buffer/string. IPC handlers own .tmp + rename + dialog. Testable in isolation with no electron mocks."
  - "Type-cast through unknown for ExcelJS.Buffer → Node Buffer (writeBuffer returns ExcelJS.Buffer<ArrayBufferLike>; cast `as unknown as Buffer` is safe because runtime returns a real Node Buffer per Pitfall 10)"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~5min (orchestrator-applied + post-merge typecheck fix)
completed: 2026-05-02
---

# Plan 05-02: Main-process BOQ byte/text builders — Summary

**Pure XLSX (ExcelJS) and CSV (csv-stringify) byte builders. No fs/dialog/ipcMain imports — IPC handlers in Plan 03 wrap them with atomicWriteFile.**

## Performance

- **Duration:** ~5 min (orchestrator recovery + 1 typecheck fix)
- **Tasks:** 2/2
- **Files modified:** 3 (one extra: project-io.test.ts had test cases appended)

## Accomplishments
- `buildBoqXlsx(b: BoqStructure): Promise<Buffer>` — full BOQ workbook with metadata block, frozen title row, per-name colored Item cells, per-UoM subtotals, grand totals, native-number quantities
- `buildBoqCsv(b: BoqStructure): string` — CRLF + RFC 4180 + integer-counts / 2dp-length-area
- `enforceXlsxExtension(path)` / `enforceCsvExtension(path)` — case-insensitive idempotent path normalizers
- All 7 boq-writers-xlsx tests + all 6 boq-writers-csv tests GREEN

## Task Commits

1. **Task 1: enforceXlsxExtension + enforceCsvExtension** — `271a974` (feat)
2. **Task 2: buildBoqXlsx + buildBoqCsv** — `483b143` (feat)
3. **Post-merge: writeBuffer Buffer cast through unknown** — `c766e74` (fix)

## Deviations from Plan

### Type cast for ExcelJS.Buffer → Node Buffer

ExcelJS@4.4.0 declares `writeBuffer()` as `Promise<ExcelJS.Buffer<ArrayBufferLike>>`, which TypeScript flags as not directly assignable to Node's `Buffer`. RESEARCH §Pitfall 10 documented the runtime behavior (writeBuffer returns a real Node Buffer despite the type signature), but the recommended cast `as Buffer` failed strict-mode TS. Fixed by routing through `unknown`:

```typescript
const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer
```

Functionally identical; satisfies typecheck. Committed as `c766e74` immediately after the original Task 2 commit.

### Recovery from parallel-execution usage cap

The original Plan 05-02 executor agent committed both Task 1 and Task 2 cleanly in its worktree before the usage cap fired, but never produced a SUMMARY.md. The orchestrator cherry-picked both commits onto master (`7f2cdd8` → `271a974`, `fea1d79` → `483b143`), discovered the typecheck error during the post-Wave-1 verification, fixed it inline, and authored this SUMMARY.

### Extra test cases added to project-io.test.ts

The agent appended `enforceXlsxExtension` / `enforceCsvExtension` test cases to the existing `project-io.test.ts` rather than creating a new file. Plan files_modified did not list this file but the tests are additive (no existing test was modified). Treated as an acceptable narrow extension of Plan 04's test file.

## Verification

- `npm run typecheck` passes (after the unknown-cast fix)
- 7/7 boq-writers-xlsx tests GREEN — round-trip via ExcelJS.Workbook().xlsx.load(buf), all assertions hold
- 6/6 boq-writers-csv tests GREEN — CRLF, no BOM, RFC 4180 quoting, integer/2dp formatting, row order
- 5/5 project-io.test.ts existing tests still GREEN; new enforce* tests GREEN
