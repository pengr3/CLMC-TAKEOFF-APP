# Phase 5: BOQ Export - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 17 (7 new files, 10 modifications/extensions to existing files)
**Analogs found:** 17 / 17 (100% coverage — every new file has a strong existing analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/lib/boq-aggregator.ts` (NEW) | pure logic / utility | transform (stores → BoqStructure) | `src/renderer/src/lib/markup-math.ts` | role-match (pure module, Vitest-tested in node env) |
| `src/main/boq-writers.ts` (NEW) | pure logic / utility (main process) | transform (BoqStructure → Buffer/string) | `src/main/project-io.ts` (`assembleClmcZip` / `extractClmcZip`) | exact (pure main-process byte/text builders, no fs/dialog) |
| `src/main/project-io.ts` (EXTEND) | utility helper | path transform | existing `enforceClmcExtension` in same file | exact (literal mirror — `enforceXlsxExtension`/`enforceCsvExtension`) |
| `src/main/ipc-handlers.ts` (EXTEND — 3 new handlers) | IPC handler | request-response | existing `dialog:saveProject` + `file:writeProject` in same file | exact (same triad shape, same `atomicWriteFile`, same `ok/reason` discriminated union) |
| `src/preload/index.ts` (EXTEND — 3 new methods) | preload bridge | request-response | existing `saveProjectDialog` / `writeProject` / `hashBuffer` in same file | exact |
| `src/preload/index.d.ts` (EXTEND — 3 new types) | type declaration | n/a | existing `ElectronAPI` interface in same file | exact |
| `src/renderer/src/components/UncalibratedExportWarningModal.tsx` (NEW) | UI component (modal) | event-driven (Continue/Cancel callbacks) | `src/renderer/src/components/OpenErrorModal.tsx` (primary) + `src/renderer/src/components/ScalePopup.tsx` (secondary) | exact (same dark-theme `COLORS`, same focused button + Escape pattern) |
| `src/renderer/src/hooks/useExport.ts` (NEW) | orchestration hook | event-driven (aggregate → dialog → write → toast) | `src/renderer/src/hooks/useProject.ts` (`saveProject` + `writeSnapshotToPath`) | exact (same useCallback shape, same `setSaving(true)` try/finally pattern) |
| `src/renderer/src/components/Toolbar.tsx` (EXTEND — Export IconButton) | UI component | event-driven | `Replace Plan PDF` IconButton block, lines 259–266 in same file | exact (literal mirror) |
| `src/renderer/src/hooks/useKeyboardShortcuts.ts` (EXTEND — Ctrl+Shift+E) | hook | event-driven | existing `Ctrl+Shift+S` block, lines 63–68 in same file | exact (literal mirror with `isTextInputActive()` guard) |
| `src/renderer/src/App.tsx` (EXTEND — `handleExportClick`, modal/toast wiring) | UI orchestration | event-driven | existing `handleSaveClick` (line 117) + `handleReplaceClick` (line 128) | exact |
| `src/renderer/src/stores/projectStore.ts` (OPTIONAL EXTEND — `isExporting`) | store | state mutation | existing `isSaving: boolean` + `setSaving` action in same file | exact (literal field+action mirror) |
| `src/tests/boq-aggregator.test.ts` (NEW) | test (renderer pure logic) | unit | `src/tests/markup-math.test.ts` | exact (Vitest, default node env, deterministic fixtures) |
| `src/tests/boq-writers.test.ts` (NEW) | test (main pure logic) | unit | `src/tests/project-io.test.ts` (assemble/extract round-trip) | exact (round-trip via ExcelJS reload + structural CSV checks) |
| `src/tests/boq-export-ipc.test.ts` (NEW) | test (main IPC) | integration | `src/tests/atomic-write.test.ts` + IPC mocks in `src/tests/replace-plan-pdf.test.ts` | role-match |
| `src/tests/uncalibrated-export-warning-modal.test.ts` (NEW) | test (UI component) | unit | `src/tests/toolbar-replace-pdf.test.ts` (jsdom + createRoot + act) | role-match |
| `src/tests/toolbar-export-button.test.ts` (NEW) | test (UI component) | unit | `src/tests/toolbar-replace-pdf.test.ts` + `src/tests/toolbar-saving-disabled.test.ts` | exact |

## Pattern Assignments

### `src/renderer/src/lib/boq-aggregator.ts` (NEW — pure aggregator)

**Analog:** `src/renderer/src/lib/markup-math.ts`

**Why this analog:** Same role (pure module under `renderer/src/lib/`), same data flow (deterministic input → number/struct output), same testing strategy (default Vitest node env, no jsdom). The aggregator composes `polylineLength` / `polygonArea` / `pixelLengthToReal` / `pixelAreaToReal` directly from this file, so the import surface is already established.

**Imports pattern** (`src/renderer/src/lib/markup-math.ts:1-5`):
```typescript
import type { StagePoint } from '../hooks/useCalibrationMode'
import type { ScaleUnit } from '../types/scale'
import { MM_PER_UNIT } from '../types/scale'
import { euclideanDistance, fromMm } from './scale-math'
import { LABEL_FONT_BASE, LABEL_FONT_FLOOR } from '../types/markup'
```

**Pure function shape — copy this signature style** (`src/renderer/src/lib/markup-math.ts:7-26`):
```typescript
export function polylineLength(points: StagePoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += euclideanDistance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }
  return total
}

export function polygonArea(points: StagePoint[]): number {
  if (points.length < 3) return 0
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}
```

**Conversion helper composition** (`src/renderer/src/lib/markup-math.ts:39-50`) — this is what the aggregator calls per-markup:
```typescript
export function pixelLengthToReal(pixelLen: number, pixelsPerMm: number, unit: ScaleUnit): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  const mm = pixelLen / pixelsPerMm
  return fromMm(mm, unit)
}

export function pixelAreaToReal(pixelArea: number, pixelsPerMm: number, unit: ScaleUnit): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  const mm2 = pixelArea / (pixelsPerMm * pixelsPerMm)
  const mmPerUnit = MM_PER_UNIT[unit]
  return mm2 / (mmPerUnit * mmPerUnit)
}
```

**Store-read pattern (one-shot getState reads)** — see `src/renderer/src/hooks/useProject.ts:75-81`:
```typescript
const { currentFilePath, isSaving } = useProjectStore.getState()
```

**Inject-fixture-or-fall-back-to-store pattern** — RESEARCH.md provides the full skeleton in `05-RESEARCH.md:382-405`. Use the exact `AggregateOptions` interface so the aggregator is callable as `aggregateBoq()` from the hook AND `aggregateBoq({ markups: fixtureMarkups, ... })` from the test.

**Type re-export note (RESEARCH.md §Open Question 4):** Define `BoqStructure` / `BoqMetadata` / `BoqRowType` / `BoqItemRow` / `BoqSubtotal` / `BoqCategoryGroup` here and re-export from this file. The main-process writer (`src/main/boq-writers.ts`) imports the same types — but since `main` cannot import from `renderer/src/`, **duplicate the type declaration in `boq-writers.ts`** (kept structurally identical via the round-trip test). No new shared types module is needed; CLAUDE.md doesn't have one and adding one for two consumers is overkill.

---

### `src/main/boq-writers.ts` (NEW — XLSX + CSV byte/text builders)

**Analog:** `src/main/project-io.ts` (`assembleClmcZip` lines 85-96, `extractClmcZip` lines 104-115)

**Why this analog:** Same role (pure main-process byte/text construction with NO `fs`/`dialog`/`ipcMain` imports), same return types (`Promise<Buffer>` for binary, plain string for text), same JSDoc warning style ("NEVER call this from the renderer — main process only").

**Imports pattern** (`src/main/project-io.ts:1-4`):
```typescript
import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import { extname } from 'path'
import JSZip from 'jszip'
```
For boq-writers.ts, the parallel imports are:
```typescript
import ExcelJS from 'exceljs'
import { stringify } from 'csv-stringify/sync'
// + duplicated BoqStructure types (see aggregator note above)
```

**Pure builder function shape** (`src/main/project-io.ts:85-96`):
```typescript
export async function assembleClmcZip(
  projectJson: string,
  pdfBytes: Buffer
): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('project.json', projectJson, { compression: 'STORE' })
  zip.file('plan.pdf', pdfBytes, { compression: 'STORE' })
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE'
  })
}
```

**JSDoc "main only" guard pattern** (`src/main/project-io.ts:84`):
```typescript
 * Returns a Node Buffer ready for fs.writeFile.
 * NEVER call this from the renderer — main process only.
```
Apply to `buildBoqXlsx` (returns `Promise<Buffer>` for `atomicWriteFile`) and `buildBoqCsv` (returns string — caller wraps via `Buffer.from(csv, 'utf-8')`).

**ExcelJS / csv-stringify body** — RESEARCH.md `05-RESEARCH.md:756-797` provides the full `buildBoqXlsx` and `05-RESEARCH.md:946-989` provides `buildBoqCsv`. Both verified against `exceljs@4.4.0` and `csv-stringify@6.7.0` in this repo.

**Critical: `wb.xlsx.writeBuffer()` returns `Promise<ExcelJS.Buffer>` per types but `Buffer` at runtime in Node** — cast to `Buffer` for IPC consistency. RESEARCH.md `05-RESEARCH.md:800-804`.

---

### `src/main/project-io.ts` — EXTEND with `enforceXlsxExtension` / `enforceCsvExtension`

**Analog:** `enforceClmcExtension` in same file, lines 47-50

**Pattern to mirror exactly** (`src/main/project-io.ts:44-50`):
```typescript
/**
 * Ensure the given file path ends with the .clmc extension (case-insensitive).
 * Appends '.clmc' if the current extension is anything else (Pitfall 6).
 */
export function enforceClmcExtension(filePath: string): string {
  return extname(filePath).toLowerCase() === '.clmc' ? filePath : filePath + '.clmc'
}
```

**Add directly below as siblings:**
```typescript
export function enforceXlsxExtension(filePath: string): string {
  return extname(filePath).toLowerCase() === '.xlsx' ? filePath : filePath + '.xlsx'
}
export function enforceCsvExtension(filePath: string): string {
  return extname(filePath).toLowerCase() === '.csv' ? filePath : filePath + '.csv'
}
```

**Test mirror** (`src/tests/project-io.test.ts:26-30`) — three lines, three cases (appends, idempotent, case-insensitive):
```typescript
it('enforces .clmc extension — appends when missing', () => {
  expect(enforceClmcExtension('C:/proj/plans')).toBe('C:/proj/plans.clmc')
  expect(enforceClmcExtension('C:/proj/plans.clmc')).toBe('C:/proj/plans.clmc')
  expect(enforceClmcExtension('C:/proj/PLANS.CLMC')).toBe('C:/proj/PLANS.CLMC')
})
```

---

### `src/main/ipc-handlers.ts` — EXTEND with three new handlers

**Analog:** `dialog:saveProject` (lines 94-103) + `file:writeProject` (lines 136-149) + `file:hashBuffer` (lines 155-160) in same file

**Why this analog:** Identical IPC shape — handler receives args, opens dialog or builds bytes, writes via `atomicWriteFile`, returns either `string | null` (dialog) or `{ ok: true } | { ok: false, reason }` (write). All three new handlers reuse `atomicWriteFile` (lines 45-55) directly.

**Save-dialog pattern to mirror** (`src/main/ipc-handlers.ts:94-103`):
```typescript
ipcMain.handle('dialog:saveProject', async (event, defaultPath?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Project',
    defaultPath,
    filters: [{ name: 'CLMC Project', extensions: ['clmc'] }]
  })
  if (result.canceled || !result.filePath) return null
  return enforceClmcExtension(result.filePath)
})
```
**Adapt for `dialog:saveExport`** — two filters (`.xlsx`, `.csv`); the chosen filter index drives which `enforce*Extension` to call (use `result.filePath` extension matching to determine format if Electron returns the user's filter selection via `result.filePath`'s extension; alternatively pass `format: 'xlsx' | 'csv'` arg from renderer per D-24). Return `{ filePath, format }` discriminated object so the renderer knows which write IPC to invoke.

**Write-handler pattern to mirror** (`src/main/ipc-handlers.ts:136-149`):
```typescript
ipcMain.handle(
  'file:writeProject',
  async (
    _event,
    filePath: string,
    jsonText: string,
    pdfBytes: Uint8Array
  ): Promise<{ ok: true }> => {
    const pdfBuf = u8ToBuf(pdfBytes)
    const zipBuf = await assembleClmcZip(jsonText, pdfBuf)
    await atomicWriteFile(filePath, zipBuf)
    return { ok: true }
  }
)
```
**Adapt for `file:writeBoqXlsx` / `file:writeBoqCsv`** — but **wrap in try/catch and return `{ ok: false, reason }` on failure** (D-21 demands surfacing OS errors). The existing `file:writeProject` does NOT do this — it lets exceptions propagate to the renderer's caller. For BOQ export, mirror the `ReadProjectResult` pattern instead:

**Discriminated-union error pattern to copy** (`src/main/ipc-handlers.ts:106-133`, the `file:readProject` shape):
```typescript
ipcMain.handle(
  'file:readProject',
  async (_event, filePath: string): Promise<ReadProjectResult> => {
    try {
      // ... happy path ...
      return { kind: 'v2-zip', /* ... */ }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { kind: 'unknown', reason: message }
    }
  }
)
```
For BOQ writes, return `{ ok: true } | { ok: false, reason: string }` per D-24. The wire type goes in `ipc-handlers.ts` (export) and `preload/index.ts` (mirror) and `preload/index.d.ts` (declare).

**Atomic write helper to reuse as-is** (`src/main/ipc-handlers.ts:45-55`):
```typescript
async function atomicWriteFile(finalPath: string, data: Buffer): Promise<void> {
  const tmpPath = `${finalPath}.tmp`
  await writeFile(tmpPath, data)
  try {
    await rename(tmpPath, finalPath)
  } catch (err) {
    try { await unlink(tmpPath) } catch { /* ignore */ }
    throw err
  }
}
```
For CSV: `await atomicWriteFile(filePath, Buffer.from(csvText, 'utf-8'))`.
For XLSX: `await atomicWriteFile(filePath, await buildBoqXlsx(structure))`.

---

### `src/preload/index.ts` — EXTEND with three new `window.api` methods

**Analog:** existing `saveProjectDialog` (lines 20-21), `writeProject` (lines 28-33), and `hashBuffer` (lines 37-38) entries

**Pattern to mirror** (`src/preload/index.ts:20-33`):
```typescript
saveProjectDialog: (defaultPath?: string): Promise<string | null> =>
  ipcRenderer.invoke('dialog:saveProject', defaultPath),

readProject: (filePath: string): Promise<ReadProjectResult> =>
  ipcRenderer.invoke('file:readProject', filePath),

writeProject: (
  filePath: string,
  json: string,
  pdfBytes: Uint8Array
): Promise<{ ok: true }> =>
  ipcRenderer.invoke('file:writeProject', filePath, json, pdfBytes),
```

**Add three new methods** — copy this shape exactly:
```typescript
saveExportDialog: (defaultPath: string, format: 'xlsx' | 'csv'): Promise<{ filePath: string; format: 'xlsx' | 'csv' } | null> =>
  ipcRenderer.invoke('dialog:saveExport', defaultPath, format),
writeBoqXlsx: (filePath: string, structure: BoqStructure): Promise<{ ok: true } | { ok: false; reason: string }> =>
  ipcRenderer.invoke('file:writeBoqXlsx', filePath, structure),
writeBoqCsv: (filePath: string, csvText: string): Promise<{ ok: true } | { ok: false; reason: string }> =>
  ipcRenderer.invoke('file:writeBoqCsv', filePath, csvText),
```

**Wire-type duplication note** — `preload/index.ts:7-11` declares `ReadProjectResult` inline:
```typescript
type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }
```
Mirror by inlining `BoqStructure` (or import from a shared location — but per CLAUDE.md the renderer/main split has no shared dir; **inline-duplicate** is the established pattern here).

---

### `src/preload/index.d.ts` — EXTEND `ElectronAPI` interface

**Analog:** existing entries lines 7-18 in same file

**Pattern to mirror** (`src/preload/index.d.ts:7-18`):
```typescript
interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
  openProject: () => Promise<{ filePath: string; extension: string; fileName: string } | null>
  saveProjectDialog: (defaultPath?: string) => Promise<string | null>

  readProject: (filePath: string) => Promise<ReadProjectResult>
  writeProject: (filePath: string, json: string, pdfBytes: Uint8Array) => Promise<{ ok: true }>
  hashBuffer: (bytes: Uint8Array) => Promise<string>
  readPdfBytes: (pdfPath: string) => Promise<ArrayBuffer>
  // ...
}
```

**Add three new declarations** matching the preload bridge entries above. Keep the ambient `ReadProjectResult` declaration pattern (lines 1-4) — duplicate `BoqStructure` here too.

---

### `src/renderer/src/components/UncalibratedExportWarningModal.tsx` (NEW)

**Primary analog:** `src/renderer/src/components/OpenErrorModal.tsx` (full file — 76 lines)

**Why this analog:** Both are dark-theme inline-style modals with a `role="dialog"` + `aria-modal` + Escape-key dismissal + a focused button on mount. Identical visual language (`COLORS.secondary` background, `COLORS.border`, `boxShadow: '0 8px 24px rgba(0,0,0,0.6)'`). The only structural difference: this modal has TWO buttons (Continue + Cancel) instead of one (Close), so the secondary "Cancel" button styling comes from `ScalePopup.tsx:228-247`.

**Component scaffold to copy** (`src/renderer/src/components/OpenErrorModal.tsx:1-75`):
```typescript
import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface OpenErrorModalProps {
  message: string
  onClose: () => void
}

export function OpenErrorModal({
  message,
  onClose
}: OpenErrorModalProps): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
      }}
      onKeyDown={handleKey}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Failed to open file"
        style={{
          width: 420, padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: 12,
          fontSize: 13, lineHeight: 1.45, color: COLORS.textPrimary
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Failed to open file</div>
        <div>...message body...</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Adapt for two-button modal:**
- Title: `"Pages without scale"`.
- Body: `"Page {1, 3} have markups but no scale set. Their length / area / perimeter measurements will be excluded from the export. Counts on those pages export normally."` (interpolate the page list).
- Primary button (focused on mount, `ref={continueRef}`): label `Continue`, styling = `OpenErrorModal` Close button styling (lines 60-69 — `background: COLORS.accent`, `color: COLORS.textOnAccent`).
- Secondary button: label `Cancel`, styling from `ScalePopup.tsx:228-247`:
  ```typescript
  style={{
    height: 28, padding: '4px 8px',
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    color: COLORS.textPrimary,
    fontSize: 13, fontWeight: 600, cursor: 'pointer'
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
  ```
- Escape key → call `onCancel` (mirrors `OpenErrorModal`'s Escape → onClose).

**Props shape:**
```typescript
export interface UncalibratedExportWarningModalProps {
  uncalibratedPages: number[]   // sorted ascending
  onContinue: () => void
  onCancel: () => void
}
```

---

### `src/renderer/src/hooks/useExport.ts` (NEW — orchestration hook)

**Analog:** `src/renderer/src/hooks/useProject.ts` — specifically `saveProject` (lines 75-80) + `saveProjectAsImpl` (lines 87-96) + `writeSnapshotToPath` (lines 98-147)

**Why this analog:** Same data flow (renderer state → IPC dialog → IPC write → toast), same `useCallback` pattern, same in-flight-flag try/finally guard, same explicit `'ok' | 'canceled' | 'error'` return type so callers can route success → toast and failure → error modal.

**Header + useCallback + isSaving guard pattern** (`src/renderer/src/hooks/useProject.ts:75-96`):
```typescript
const saveProject = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
  const { currentFilePath, isSaving } = useProjectStore.getState()
  if (isSaving) return 'canceled'   // T-4.1-04-05 race guard
  if (!currentFilePath) return saveProjectAsImpl()
  return writeSnapshotToPath(currentFilePath, false)
}, [])

async function saveProjectAsImpl(): Promise<'ok' | 'canceled' | 'error'> {
  const { fileName: pdfName, totalPages } = useViewerStore.getState()
  if (totalPages === 0) return 'error'
  const dotIdx = (pdfName ?? '').lastIndexOf('.')
  const baseNoExt = dotIdx > 0 ? (pdfName as string).slice(0, dotIdx) : (pdfName ?? 'project')
  const defaultPath = `${baseNoExt}.clmc`
  const chosen = await window.api.saveProjectDialog(defaultPath)
  if (!chosen) return 'canceled'
  return writeSnapshotToPath(chosen, true)
}
```

**setSaving try/finally pattern to mirror with setExporting** (`src/renderer/src/hooks/useProject.ts:98-147`):
```typescript
async function writeSnapshotToPath(
  clmcPath: string,
  firstSave: boolean
): Promise<'ok' | 'canceled' | 'error'> {
  const setSaving = useProjectStore.getState().setSaving
  setSaving(true)
  try {
    // ... build snap, call window.api.writeProject, setSaved ...
    return 'ok'
  } catch (err) {
    console.error('[useProject] save failed:', err)
    return 'error'
  } finally {
    setSaving(false)  // T-4.1-04-01: ALWAYS reset, even on error
  }
}
```

**For useExport, the orchestration sequence** (per RESEARCH.md system architecture diagram, `05-RESEARCH.md:212-256`):
1. Call `aggregateBoq()` from `boq-aggregator.ts` → in-memory `BoqStructure`.
2. Compute uncalibrated-pages list from `pageMarkups` + `pageScales`. If non-empty, **return a discriminated `'needs-uncalibrated-confirmation'` result** (do NOT show the modal in the hook — let App.tsx own UI lifecycle, mirroring `replacePlanPdf`'s `dimension-mismatch` return at `src/renderer/src/hooks/useProject.ts:322-327`).
3. After confirmation (or no warning), build `defaultPath` from `currentFilePath` (basename, strip `.clmc`) or fallback to `pdf.originalFilename` (strip `.pdf`) — mirror `saveProjectAsImpl`'s `baseNoExt` logic.
4. `await window.api.saveExportDialog(defaultPath, 'xlsx' | 'csv')` → `{ filePath, format } | null`.
5. `setExporting(true)` (if `isExporting` field added to projectStore).
6. Branch on format: call `writeBoqXlsx(filePath, structure)` or `writeBoqCsv(filePath, csvText)`.
7. On `{ ok: false }` return `{ kind: 'error', message: result.reason }`. On `{ ok: true }` return `{ kind: 'ok', filePath }`.
8. `finally { setExporting(false) }`.

**Discriminated-union return shape to mirror** (`src/renderer/src/hooks/useProject.ts:23-34`):
```typescript
export type ProjectOpenResult =
  | { kind: 'ok' }
  | { kind: 'archive-corrupted'; validated: ProjectFileV2; pdfBytes: Uint8Array; clmcPath: string }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }
```
For `useExport`:
```typescript
export type ExportResult =
  | { kind: 'ok'; filePath: string }
  | { kind: 'needs-uncalibrated-confirmation'; uncalibratedPages: number[]; structure: BoqStructure }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }
```

---

### `src/renderer/src/components/Toolbar.tsx` — EXTEND with Export IconButton

**Analog:** existing `Replace` IconButton in same file, lines 259-266

**Pattern to mirror exactly** (`src/renderer/src/components/Toolbar.tsx:259-266`):
```typescript
<IconButton
  icon={Replace}
  label="Replace Plan PDF"
  disabled={replaceDisabled}
  onClick={() => { void onReplaceClick() }}
  title="Replace Plan PDF — markups preserved, save (Ctrl+S) to persist"
  ariaLabel="Replace Plan PDF"
/>
```

**Adapt:**
```typescript
<IconButton
  icon={Download}
  label="Export"
  disabled={exportDisabled}
  onClick={() => { void onExportClick() }}
  title="Export BOQ to Excel or CSV (Ctrl+Shift+E)"
  ariaLabel="Export"
/>
```

**Import to add at top of file** (alongside line 16 `Replace`):
```typescript
import { /* ...existing... */, Replace, Download } from 'lucide-react'
```

**ToolbarProps to extend** (`src/renderer/src/components/Toolbar.tsx:95-110`):
```typescript
export interface ToolbarProps {
  onOpenClick: () => void | Promise<void>
  onReplaceClick: () => void | Promise<void>
  // ADD:
  onExportClick: () => void | Promise<void>
}
```

**Disabled wiring** (mirror `replaceDisabled` at line 130, then add markup-count guard per D-19):
```typescript
const replaceDisabled = totalPages === 0 || isSaving                // existing
const hasMarkups = useMarkupStore((s) =>
  Object.values(s.pageMarkups).some(list => list.length > 0)
)                                                                    // NEW selector — primitive boolean
const isExporting = useProjectStore((s) => s.isExporting)            // NEW (if added)
const exportDisabled = totalPages === 0 || isSaving || isExporting || !hasMarkups
```

**Placement:** Insert after line 266 (`Replace` IconButton) so the cluster stays in `Save / SaveAs / Replace / Export` order per D-15.

---

### `src/renderer/src/hooks/useKeyboardShortcuts.ts` — EXTEND with `Ctrl+Shift+E`

**Analog:** `Ctrl+Shift+S` block in same file, lines 63-68

**Pattern to mirror exactly** (`src/renderer/src/hooks/useKeyboardShortcuts.ts:62-76`):
```typescript
// Ctrl+Shift+S: Save As (must be checked before Ctrl+S to avoid conflict)
if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.saveProjectAs()
  return
}

// Ctrl+S: Save (routes to Save As internally if currentFilePath is null — D-13)
if (e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.saveProject()
  return
}
```

**Add new block (anywhere among the Ctrl+ shortcuts; recommend immediately after Ctrl+Shift+S for grouping):**
```typescript
// Ctrl+Shift+E: Export BOQ
if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.exportBoq()
  return
}
```

**KeyboardShortcutHandlers interface to extend** (`src/renderer/src/hooks/useKeyboardShortcuts.ts:6-14`):
```typescript
interface KeyboardShortcutHandlers {
  openPdf: () => void
  openProject: () => void
  saveProject: () => void
  saveProjectAs: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
  // ADD:
  exportBoq: () => void
}
```

**`isTextInputActive()` is already exported** at line 24-39 — reuse as-is. No changes needed to that helper.

---

### `src/renderer/src/App.tsx` — EXTEND with handler + state + modal/toast wiring

**Analog:** existing `handleSaveClick` (line 117-120) + `handleReplaceClick` (line 128-146) + `saveToast` state (lines 37, 70-73, 172-194)

**handleSaveClick pattern (simple → toast)** (`src/renderer/src/App.tsx:117-120`):
```typescript
const handleSaveClick = useCallback(async () => {
  const r = await saveProject()
  if (r === 'ok') setSaveToast('Saved')
}, [saveProject])
```

**handleReplaceClick pattern (multi-result routing — closer fit for export)** (`src/renderer/src/App.tsx:128-146`):
```typescript
const handleReplaceClick = useCallback(async () => {
  const pick = await window.api.openPdf()
  if (!pick) return
  const newBytes = new Uint8Array(pick.data)
  const r = await replacePlanPdf(newBytes, pick.filePath)
  if (r.kind === 'page-count-mismatch') {
    setReplacePageAbort({ expected: r.expected, actual: r.actual })
    return
  }
  if (r.kind === 'dimension-mismatch') {
    setReplaceDimMiss({ pendingBytes: r.pendingBytes, pendingFilename: r.pendingFilename })
    return
  }
  if (r.kind === 'error') {
    setOpenError(`Replace Plan PDF failed: ${r.message}`)
    return
  }
}, [replacePlanPdf])
```
**Adapt for handleExportClick:**
```typescript
const handleExportClick = useCallback(async () => {
  const r = await exportBoq()
  if (r.kind === 'needs-uncalibrated-confirmation') {
    setUncalibratedWarning({ pages: r.uncalibratedPages, structure: r.structure })
    return
  }
  if (r.kind === 'error') {
    setExportError(`Export failed: ${r.message}`)
    return
  }
  if (r.kind === 'ok') {
    setExportToast(`Exported: ${basename(r.filePath)}`)
  }
}, [exportBoq])
```

**saveToast state + auto-dismiss pattern** (`src/renderer/src/App.tsx:37, 69-73`):
```typescript
const [saveToast, setSaveToast] = useState<string | null>(null)
// ...
useEffect(() => {
  if (!saveToast) return
  const t = window.setTimeout(() => setSaveToast(null), 2000)
  return () => window.clearTimeout(t)
}, [saveToast])
```
**Mirror for `exportToast`** with the same 2-second timer; reuse the existing inline toast JSX (lines 172-194) or extract a shared toast component if both exist (planner's call — recommend keeping them inline for symmetry with `saveToast`).

**Modal wiring pattern** (`src/renderer/src/App.tsx:198-203`):
```typescript
{openError !== null && (
  <OpenErrorModal
    message={openError}
    onClose={() => setOpenError(null)}
  />
)}
```
**Mirror for** `UncalibratedExportWarningModal` (with `onContinue` proceeding to dialog flow + `onCancel` clearing state) and a second `OpenErrorModal` for `exportError`.

**useKeyboardShortcuts call site to extend** (`src/renderer/src/App.tsx:148-156`):
```typescript
useKeyboardShortcuts({
  openPdf: handleOpenClick,
  openProject: handleOpenClick,
  saveProject: handleSaveClick,
  saveProjectAs: handleSaveAsClick,
  zoomIn: () => getCanvasControls()?.zoomIn(),
  zoomOut: () => getCanvasControls()?.zoomOut(),
  fitToWindow: () => getCanvasControls()?.fitToWindow(),
  // ADD:
  exportBoq: handleExportClick
})
```

**Toolbar prop to extend** (`src/renderer/src/App.tsx:161`):
```typescript
<Toolbar onOpenClick={handleOpenClick} onReplaceClick={handleReplaceClick} onExportClick={handleExportClick} />
```

---

### `src/renderer/src/stores/projectStore.ts` — OPTIONAL EXTEND with `isExporting`

**Analog:** existing `isSaving: boolean` field + `setSaving` action in same file, lines 9, 38, 44

**Pattern to mirror exactly** (`src/renderer/src/stores/projectStore.ts:6-44`):
```typescript
interface ProjectStoreState {
  currentFilePath: string | null
  isDirty: boolean
  isSaving: boolean         // ← LINE 9
  lastSavedAt: number | null

  setSaved: (filePath: string) => void
  setSaving: (v: boolean) => void   // ← LINE 14
  // ...
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  currentFilePath: null,
  isDirty: false,
  isSaving: false,                  // ← LINE 38
  lastSavedAt: null,
  // ...
  setSaving: (v) => set({ isSaving: v }),    // ← LINE 44
  // ...
  reset: () => set({
    currentFilePath: null,
    isDirty: false,
    isSaving: false,                // ← LINE 57
    lastSavedAt: null
  })
}))
```

**Add directly below `isSaving` / `setSaving`:**
```typescript
isExporting: false,
setExporting: (v: boolean) => set({ isExporting: v }),
```
And add `isExporting: false` to the `reset` action (line 54-59).

**Tests to extend:** `src/tests/project-store.test.ts` (covers `isSaving` race guard at line 22; mirror with `isExporting` test cases).

---

## Test File Pattern Assignments

### `src/tests/boq-aggregator.test.ts` (NEW)

**Analog:** `src/tests/markup-math.test.ts`

**Why this analog:** Pure-function aggregator with deterministic numeric inputs, runs in default Vitest node env (no jsdom needed), tests assert exact numeric outputs for math correctness.

**Header pattern** (`src/tests/markup-math.test.ts:1-10`):
```typescript
import { describe, it, expect } from 'vitest'
import {
  polylineLength,
  polygonArea,
  polygonCentroid,
  pixelLengthToReal,
  pixelAreaToReal,
  labelFontSize,
  polylineMidpointByArcLength
} from '@renderer/lib/markup-math'
```

**Test shape** (`src/tests/markup-math.test.ts:38-58`):
```typescript
describe('polygonArea', () => {
  it('returns 0 for empty array', () => {
    expect(polygonArea([])).toBe(0)
  })

  it('computes area of a 10x10 square (CCW)', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ])
    ).toBe(100)
  })
})
```

**Aggregator test cases to cover (per RESEARCH.md edge-case table at `05-RESEARCH.md:890-902`):**
- Empty project (no markups): `categories: []`, `grandTotals: []`.
- Single count markup: produces one row with quantity 1.
- Two count markups same name across two pages: produces one row with quantity 2.
- Linear + area same name → two rows with collision suffixes (D-02).
- Perimeter markup: produces TWO rows, one `(perimeter)`, one `(area)`.
- Page with markups but no scale: counts export, linear/area excluded silently (D-06).
- Mixed-UoM category: subtotals split by UoM (D-12).
- `categoryOrder` preservation across multiple categories.

**Inject fixtures via `AggregateOptions`** so tests don't touch the real Zustand stores (RESEARCH.md aggregator skeleton at `05-RESEARCH.md:382-405`).

---

### `src/tests/boq-writers.test.ts` (NEW)

**Analog:** `src/tests/project-io.test.ts` (especially the `assemble + extract round-trip` test at lines 84-93)

**Why this analog:** Pure main-process bytes/string builder; round-trip via reading the produced bytes back through ExcelJS validates the output's structural integrity. Same pattern as `assembleClmcZip → extractClmcZip` round-trip.

**Round-trip pattern to mirror** (`src/tests/project-io.test.ts:84-93`):
```typescript
it('assemble + extract round-trip preserves project.json text and pdf bytes', async () => {
  const projectJson = '{"formatVersion":2,"hello":"world"}'
  const pdfBuf = await fsP.readFile(FIXTURE)
  const zipBuf = await assembleClmcZip(projectJson, pdfBuf)
  expect(detectClmcFormat(zipBuf)).toBe('v2-zip')
  const extracted = await extractClmcZip(zipBuf)
  expect(extracted.projectJson).toBe(projectJson)
  expect(Buffer.compare(extracted.pdfBytes, pdfBuf)).toBe(0)
})
```

**XLSX round-trip test cases** (apply RESEARCH.md verification approach at `05-RESEARCH.md:617-625`):
- `buildBoqXlsx(structure)` → `Buffer` → `wb.xlsx.load(buffer)` → assert sheet name `'BOQ'`.
- Assert column widths `[36, 12, 8]`.
- Assert title row `font.bold === true`.
- Assert `worksheet.views[0].state === 'frozen'` and `ySplit === 7`.
- Assert quantity cell `typeof cell.value === 'number'` (NOT string) and `cell.numFmt` matches `'0.00'` for length and `'0'` for count.
- Assert color cell fill `cell.fill.fgColor.argb === 'FF0078D4'` for a known input color.

**CSV structural tests** (no library round-trip — assert literal string slices):
- Asserts `record_delimiter` produces `\r\n` between rows (hex-byte check `0d 0a`).
- RFC 4180 quoting: input `'Outlet, AC'` → output `"Outlet, AC"`; input `'Wire "red"'` → output `"Wire ""red"""`.
- Row-count parity with XLSX (same metadata + spacer + title + category-headings + items + subtotals + grand-totals).

---

### `src/tests/boq-export-ipc.test.ts` (NEW)

**Analog:** `src/tests/atomic-write.test.ts` (for the `.tmp + rename` write semantics) + the IPC mock pattern from `src/tests/replace-plan-pdf.test.ts:23-37`

**Why this analog:** Same shape — register the IPC handler, call it programmatically with a temp directory, assert the file lands at the final path with the expected bytes and that no `.tmp` orphan remains on success.

**IPC mock pattern** (`src/tests/replace-plan-pdf.test.ts:23-37`):
```typescript
beforeEach(() => {
  ;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window = {
    api: {
      openPdf: vi.fn(),
      readPdfBytes: vi.fn(),
      readProject: vi.fn(),
      writeProject: vi.fn(),
      openProject: vi.fn(),
      saveProjectDialog: vi.fn(),
      onCloseRequest: vi.fn(),
      offCloseRequest: vi.fn(),
      confirmClose: vi.fn()
    }
  }
})
```

**Test cases:**
- `dialog:saveExport` returns `{ filePath, format }` with the chosen extension enforced (mock `dialog.showSaveDialog` to return a no-extension path, assert the returned `filePath` ends in `.xlsx`).
- `dialog:saveExport` returns `null` when canceled.
- `file:writeBoqXlsx` happy path → file exists, `Buffer` length > 0, no `.tmp` left.
- `file:writeBoqXlsx` failure path (e.g., write to a directory that doesn't exist) → returns `{ ok: false, reason }` with non-empty reason; no `.tmp` orphan (per `atomicWriteFile` cleanup at `src/main/ipc-handlers.ts:50-54`).
- `file:writeBoqCsv` happy path → file exists, content === expected CSV string (UTF-8 read).

---

### `src/tests/uncalibrated-export-warning-modal.test.ts` (NEW)

**Analog:** `src/tests/toolbar-replace-pdf.test.ts` (jsdom + createRoot + act pattern)

**Why this analog:** Same UI test scaffold — render with React 19's `createRoot`, drive interactions with `act`, query DOM via `aria-label` selectors.

**Header pattern to copy** (`src/tests/toolbar-replace-pdf.test.ts:1-40`):
```typescript
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
```

**Test cases:**
- Renders with `role="dialog"` and `aria-modal="true"` (mirror `OpenErrorModal` accessibility contract at `src/renderer/src/components/OpenErrorModal.tsx:29-31`).
- Continue button has focus on mount.
- Continue button click invokes `onContinue` prop.
- Cancel button click invokes `onCancel` prop.
- Escape key invokes `onCancel`.
- Page list `[1, 3, 5]` renders in body text (e.g., "Page 1, 3, 5 have markups but no scale set").

---

### `src/tests/toolbar-export-button.test.ts` (NEW)

**Analog:** `src/tests/toolbar-replace-pdf.test.ts` + `src/tests/toolbar-saving-disabled.test.ts`

**Why this analog:** Same Toolbar render scaffold, same `useViewerStore.setState` setup for totalPages/etc, same `aria-label` selector pattern.

**Setup pattern to mirror** (`src/tests/toolbar-saving-disabled.test.ts:26-35`):
```typescript
beforeEach(() => {
  useViewerStore.setState({
    totalPages: 3, currentPage: 1, filePath: 'C:/x.pdf', fileName: 'x.pdf',
    pageViewports: {}, pageScales: {}, pdfDocument: null, activeTool: 'select'
  })
  useProjectStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
```

**Test cases:**
- Renders an `[aria-label="Export"]` button.
- Clicking the button invokes `onExportClick` prop (mirror `toolbar-replace-pdf.test.ts:53-63`).
- Disabled (`aria-disabled="true"`) when `totalPages === 0` (mirror `toolbar-saving-disabled.test.ts` for `totalPages`).
- Disabled when `isSaving === true` (set via `useProjectStore.setState({ isSaving: true })`).
- Disabled when no markups exist (zero markups across all pages — set via `useMarkupStore.getState().reset()` then assert).
- Disabled when `isExporting === true` (if added).

---

## Shared Patterns

### Pattern A — IPC Triad (Handler + Bridge + Type)

**Sources:**
- Handler: `src/main/ipc-handlers.ts:94-149`
- Bridge: `src/preload/index.ts:13-43`
- Type: `src/preload/index.d.ts:6-19`

**Apply to:** All three new IPC channels (`dialog:saveExport`, `file:writeBoqXlsx`, `file:writeBoqCsv`). No exceptions per CONTEXT.md "Established Patterns" → "IPC triad: every new IPC surface requires changes to `ipc-handlers.ts` (main) + `preload/index.ts` (bridge) + `preload/index.d.ts` (types). No exceptions."

### Pattern B — Discriminated-Union IPC Result with Error Surfacing

**Source:** `src/main/ipc-handlers.ts:23-26` (type) + lines 106-133 (handler)

```typescript
export type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }

ipcMain.handle('file:readProject', async (_event, filePath: string): Promise<ReadProjectResult> => {
  try {
    // ... happy paths ...
    return { kind: 'v2-zip', /* ... */ }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { kind: 'unknown', reason: message }
  }
})
```

**Apply to:** `file:writeBoqXlsx` and `file:writeBoqCsv` — return `{ ok: true } | { ok: false, reason: string }` per D-21/D-24. The renderer's `useExport` hook surfaces `reason` in the export error modal.

### Pattern C — Atomic Write (.tmp + rename + cleanup)

**Source:** `src/main/ipc-handlers.ts:45-55`

```typescript
async function atomicWriteFile(finalPath: string, data: Buffer): Promise<void> {
  const tmpPath = `${finalPath}.tmp`
  await writeFile(tmpPath, data)
  try {
    await rename(tmpPath, finalPath)
  } catch (err) {
    try { await unlink(tmpPath) } catch { /* ignore */ }
    throw err
  }
}
```

**Apply to:** Both `file:writeBoqXlsx` (data = `await buildBoqXlsx(structure)`) and `file:writeBoqCsv` (data = `Buffer.from(csvText, 'utf-8')`). Reuse — do not duplicate.

### Pattern D — Inline-Style Modal with `COLORS` Constants

**Source:** `src/renderer/src/components/OpenErrorModal.tsx` (full file) + `src/renderer/src/components/ScalePopup.tsx:228-247` (secondary button styling)

```typescript
import { COLORS } from '../lib/constants'

// Outer overlay
style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
}}

// Inner panel
style={{
  width: 420, padding: 20,
  background: COLORS.secondary,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column', gap: 12,
  fontSize: 13, lineHeight: 1.45, color: COLORS.textPrimary
}}

// Primary button (focused, accent)
style={{
  height: 28, padding: '4px 8px',
  background: COLORS.accent, border: 'none', borderRadius: 4,
  color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}}

// Secondary button (transparent border, hover surface)
style={{
  height: 28, padding: '4px 8px',
  background: 'transparent', border: `1px solid ${COLORS.border}`,
  borderRadius: 4, color: COLORS.textPrimary,
  fontSize: 13, fontWeight: 600, cursor: 'pointer'
}}
```

**Apply to:** `UncalibratedExportWarningModal` (Continue = primary, Cancel = secondary) and any export-failure modal (reuse `OpenErrorModal` directly with a custom `message`).

### Pattern E — Parent-Owned Toast Lifecycle

**Source:** `src/renderer/src/App.tsx:37, 69-73, 172-194`

```typescript
const [saveToast, setSaveToast] = useState<string | null>(null)

useEffect(() => {
  if (!saveToast) return
  const t = window.setTimeout(() => setSaveToast(null), 2000)
  return () => window.clearTimeout(t)
}, [saveToast])

// In JSX:
{saveToast !== null && (
  <div role="status" aria-live="polite" style={{ /* ... */ }}>
    <span>{saveToast}</span>
    <button onClick={() => setSaveToast(null)}>Dismiss</button>
  </div>
)}
```

**Apply to:** Export success toast in App.tsx — `exportToast` state with same shape (`Exported: {filename}` per D-20, no Open/Reveal buttons per deferred ideas).

### Pattern F — `isTextInputActive()` Keyboard Guard

**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts:24-39` (helper) + lines 55-75 (usage in each shortcut block)

```typescript
export function isTextInputActive(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  if (el instanceof HTMLInputElement) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true
    if (el.contentEditable === 'true') return true
    const attr = el.getAttribute('contenteditable')
    if (attr !== null && (attr === '' || attr.toLowerCase() === 'true')) return true
  }
  return false
}

// Usage in each Ctrl+ block:
if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.saveProjectAs()
  return
}
```

**Apply to:** New `Ctrl+Shift+E` block — same `if (isTextInputActive()) return` guard.

### Pattern G — In-Flight Flag Try/Finally

**Source:** `src/renderer/src/hooks/useProject.ts:102-147`

```typescript
const setSaving = useProjectStore.getState().setSaving
setSaving(true)
try {
  // ... async work ...
  return 'ok'
} catch (err) {
  console.error('[useProject] save failed:', err)
  return 'error'
} finally {
  setSaving(false)  // ALWAYS reset, even on error
}
```

**Apply to:** `useExport` hook with `setExporting(true)` / `setExporting(false)` if `isExporting` field is added to projectStore. Disabling the Toolbar Export button while in-flight prevents double-trigger (D-19).

---

## No Analog Found

None. Every new file in Phase 5 has at least a role-match analog already in the codebase. Phase 5 is overwhelmingly glue + polish around existing patterns — RESEARCH.md confirms this at line 11: *"Phase 5 is mostly glue and polish around three off-the-shelf libraries... The architectural skeleton already exists in the codebase — the IPC triad pattern (handler + bridge + types), the atomic .tmp + rename write, the discriminated-union IPC results, the inline-style modal styling, the parent-owned-lifecycle toast, the IconButton + Toolbar cluster, the isTextInputActive() keyboard guard — all directly reusable from Phases 4 and 4.1."*

---

## Metadata

**Analog search scope:** `src/main/`, `src/preload/`, `src/renderer/src/`, `src/tests/`
**Files scanned:** ~60 source files (24 components + 7 hooks + 6 stores + 9 lib + 4 main/preload + ~30 tests)
**Pattern extraction date:** 2026-05-02
**Confidence:** HIGH — all analogs are recent (Phase 4.1 era, 2026-04 onwards) and match both role and data flow exactly.
