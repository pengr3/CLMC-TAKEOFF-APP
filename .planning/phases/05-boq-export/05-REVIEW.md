---
phase: 05-boq-export
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/main/boq-writers.ts
  - src/main/project-io.ts
  - src/main/ipc-handlers.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/renderer/src/hooks/useExport.ts
  - src/renderer/src/components/UncalibratedExportWarningModal.tsx
  - src/renderer/src/components/Toolbar.tsx
  - src/renderer/src/hooks/useKeyboardShortcuts.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/components/CanvasViewport.tsx
findings:
  blocker: 4
  warning: 9
  info: 5
  total: 18
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 5 delivers a clean BOQ Export pipeline that follows the IPC triad pattern, reuses `atomicWriteFile`, and respects the discriminated-union result style. Aggregator and writers are pure, testable, and well-documented. However, several correctness and security gaps were found:

- **Security (formula injection):** `safeText` only handles four leading characters; the well-known Excel "tab + formula" and CR/LF bypasses are not covered, and the function is not applied to all user-controlled strings (UoM is a constant so safe, but `pdfOriginalFilename` containing newline characters is interpolated raw). One BLOCKER is high-confidence: leading whitespace before `=` is a documented CSV-injection bypass that this implementation does not handle.
- **Atomic write recovery:** The new EPERM/EEXIST/EBUSY recovery branch silently swallows the inner failure and re-throws the original `rename` error, which is misleading for diagnostics. More importantly, the recovery path does not clean up `.tmp` if the second `rename` succeeds AFTER `unlink(finalPath)` — actually that works — but **if the first `rename` fails AND `unlink(finalPath)` throws ENOENT** (because `finalPath` doesn't exist yet), the retry path is skipped entirely even though it would have worked.
- **Race conditions:** `useExport` checks `isExporting` flags but does NOT set `setExporting(true)` until *after* the synchronous `aggregateBoq()` call AND only inside `dialogAndWrite`. Between the guard read and the `setExporting(true)` call, two `Ctrl+Shift+E` presses can both pass the guard and enter the aggregator + dialog twice (one BLOCKER and one supporting WARNING).
- **Aggregator edge cases:** The perimeter-area subtotal uses the same `globalUnit + '²'` UoM as plain area markups, so a category that mixes "area" and "perimeter-area" rows correctly co-totals them — this is intended per D-12, but the aggregator silently treats missing/null `categoryId` *and* the literal string "(Uncategorized)" identically, and does not protect against `categoryOrder` containing IDs that no longer exist in `categoriesById` (orphaned category IDs render with the wrong fallback name).
- **Type drift risk at IPC boundary:** `BoqStructure` is duplicated in 4 places (`boq-types.ts`, `boq-writers.ts`, `preload/index.ts`, `preload/index.d.ts`) but the `type` field on `BoqItemRow` is **structural metadata that the writers never read** — the writers only use `label`, `quantity`, `uom`, `color`. The `type` field is required at the IPC wire boundary but never validated, so a renderer-side schema change would compile cleanly even if the writer needs `type`.

The Modal component is sound (no XSS — page numbers are bound through React text interpolation, not `dangerouslySetInnerHTML`). Path validation in IPC handlers is essentially non-existent — the renderer can pass any absolute path to `file:writeBoqXlsx`/`file:writeBoqCsv`, and the main process writes there. This is consistent with the existing `file:writeProject` handler, so it is not a regression — but it is worth documenting as a known limitation.

## Blocker Issues

### BL-01: CSV formula-injection guard is incomplete — leading whitespace bypass

**File:** `src/main/boq-writers.ts:77-82`
**Issue:** `safeText` checks only `s[0]` against `=`, `+`, `-`, `@`. It does not handle:
1. **Leading whitespace before a formula trigger** — Excel and Google Sheets ignore leading spaces and TABs before `=`/`+`/`-`/`@` and still evaluate the cell as a formula. A markup name `" =cmd|/c calc!A1"` (leading space) bypasses `safeText` entirely and renders as a formula on open.
2. **CR/LF in label strings** — a label containing `"foo\n=evil()"` does not trigger `safeText`, but `csv-stringify` quotes the field correctly so the second line is consumed within one CSV record. When opened in Excel the string includes a literal newline followed by `=evil()` — Excel treats this as a multi-line cell and does not evaluate the second line as a formula, so this part is OK. But on the XLSX side, this is encoded as a single-cell rich string and is similarly inert. **The leading-whitespace case is the real bypass.**
3. **Tab character (`\t`) prefix** — same Excel auto-trim behaviour; bypasses the first-char check.

This applies to every user-controlled string the writer emits: `metadata.projectName`, `metadata.planFilename`, `category.name`, `item.label`. Since `pdfOriginalFilename` is OS-supplied (controlled by the user picking a file), and `projectName`/`category.name`/`item.label` are typed by the user with no validation, this is exploitable.
**Fix:**
```typescript
const FORMULA_TRIGGERS = /^[\s	
 ]*[=+\-@]/

function safeText(s: string): string {
  if (s.length === 0) return s
  if (FORMULA_TRIGGERS.test(s)) return `'${s}`
  return s
}
```
Add a Wave 0 test fixture: `safeText(' =SUM(A1:A2)')` must return `"' =SUM(A1:A2)"`. Reference: OWASP CSV Injection cheat-sheet, Microsoft Office security advisory CVE-2014-3524.

---

### BL-02: `useExport.exportBoq` race window — guard read precedes `setExporting(true)` by an async tick

**File:** `src/renderer/src/hooks/useExport.ts:72-87`, `41-69`
**Issue:** The guard pattern is:
```typescript
const exportBoq = useCallback(async (): Promise<ExportResult> => {
  const { isExporting, isSaving } = useProjectStore.getState()
  if (isExporting || isSaving) return { kind: 'canceled' }   // <-- read

  const structure = aggregateBoq()                            // <-- sync
  const uncalibrated = findUncalibratedMarkupPages()          // <-- sync
  if (uncalibrated.length > 0) {
    return { kind: 'needs-uncalibrated-confirmation', ... }   // <-- early return; setExporting NEVER called
  }

  return dialogAndWrite(structure)                            // <-- setExporting(true) happens HERE
}, [])
```
`setExporting(true)` is only called inside `dialogAndWrite` (line 43). Between the guard at line 73 and the `setExporting(true)` call at line 43, two synchronous user actions (button click + Ctrl+Shift+E) can both pass the guard. The Toolbar `exportDisabled` prop *would* prevent the second click, BUT:

- `Ctrl+Shift+E` keyboard shortcut bypasses `exportDisabled` entirely — `useKeyboardShortcuts` calls `handlers.exportBoq()` regardless of any disabled state in the Toolbar.
- The `applyExportAfterConfirm` path is even worse: `needs-uncalibrated-confirmation` returns BEFORE setting the flag, so the user can press `Ctrl+Shift+E` while the warning modal is open, which fires a second concurrent `aggregateBoq()` + dialog flow.

**Reproduction:** Open a project with uncalibrated markups → press Ctrl+Shift+E (modal appears) → press Ctrl+Shift+E again. Second invocation re-enters the aggregator and queues a second `saveExportDialog` IPC call. With timing it is observable that two save dialogs appear sequentially.

**Fix:** Set `setExporting(true)` immediately after the guard, before any async work or branching. Reset on every return path:
```typescript
const exportBoq = useCallback(async (): Promise<ExportResult> => {
  const { isExporting, isSaving, setExporting } = useProjectStore.getState()
  if (isExporting || isSaving) return { kind: 'canceled' }
  setExporting(true)
  try {
    const structure = aggregateBoq()
    const uncalibrated = findUncalibratedMarkupPages()
    if (uncalibrated.length > 0) {
      return { kind: 'needs-uncalibrated-confirmation', uncalibratedPages: uncalibrated, structure }
    }
    return await dialogAndWriteInner(structure)  // dialogAndWriteInner does NOT toggle setExporting
  } finally {
    // Only release flag when NOT routing to confirmation modal — App.tsx must clear on Cancel
    if (useProjectStore.getState().isExporting) setExporting(false)
  }
}, [])
```
Alternatively (simpler), gate the keyboard shortcut on `useProjectStore.getState().isExporting` directly inside the handler. Both `Toolbar` and shortcut paths must respect the flag.

---

### BL-03: `atomicWriteFile` recovery branch leaks `.tmp` and re-throws stale error

**File:** `src/main/ipc-handlers.ts:63-82`
**Issue:** The Windows-locked-destination recovery path has two defects:

1. **Stale error after recovery failure.** When `rename(tmp, final)` fails with EPERM, the code calls `unlink(finalPath)` then retries `rename`. If the retry ALSO fails, control flows to lines 78-80:
   ```typescript
   try { await unlink(tmpPath) } catch { /* ignore */ }
   throw err  // <-- 'err' is the ORIGINAL EPERM, not the inner retry error
   ```
   The user sees "EPERM: operation not permitted, rename" instead of e.g. "EACCES on rename to <finalPath>" from the second attempt. That is misleading for diagnosis. More subtly: if the inner `unlink(finalPath)` throws (e.g., permission denied) but we never enter that catch block because the inner rename succeeded — wait, let me re-trace:
   ```typescript
   try {
     await unlink(finalPath)        // throws → caught by inner catch (line 75)
     await rename(tmpPath, finalPath) // never runs
     return                          // never runs
   } catch {
     // empty inner catch — falls through to outer cleanup
   }
   ```
   The inner `catch {}` is a **silent failure** for the unlink. The retry is then skipped entirely because `unlink` threw before `rename` could run. The error bubbled up at line 81 is the ORIGINAL EPERM from line 67, not the unlink failure. The user has lost the ability to know whether the file was unlocked.

2. **Existence-edge case.** If the original `rename` fails with EPERM but `finalPath` does not exist yet (for example, OneDrive momentarily blocks the path due to sync-in-progress on the parent directory, even though the file itself doesn't exist), the recovery branch calls `unlink(finalPath)` which throws ENOENT. ENOENT is not in `isLockedDestError`'s set, so it is caught by the empty `catch {}`, the second `rename` is skipped, and we throw the original EPERM. The retry-after-unlink path is dead code in this scenario — `rename` should be retried even if `unlink` fails with ENOENT (the destination is already absent).

**Fix:**
```typescript
async function atomicWriteFile(finalPath: string, data: Buffer): Promise<void> {
  const tmpPath = `${finalPath}.tmp`
  await writeFile(tmpPath, data)
  try {
    await rename(tmpPath, finalPath)
    return
  } catch (firstErr) {
    if (isLockedDestError(firstErr)) {
      try {
        await unlink(finalPath)
      } catch (unlinkErr) {
        // ENOENT is fine — destination already absent — proceed to retry rename.
        // Other codes (EPERM/EBUSY) mean we cannot remove → fall through to cleanup.
        if (!(unlinkErr instanceof Error) || (unlinkErr as NodeJS.ErrnoException).code !== 'ENOENT') {
          try { await unlink(tmpPath) } catch { /* ignore */ }
          throw firstErr
        }
      }
      try {
        await rename(tmpPath, finalPath)
        return
      } catch (retryErr) {
        try { await unlink(tmpPath) } catch { /* ignore */ }
        throw retryErr  // <-- preserve the second-attempt error for diagnosis
      }
    }
    try { await unlink(tmpPath) } catch { /* ignore */ }
    throw firstErr
  }
}
```

---

### BL-04: `Ctrl+Shift+E` not gated on `isExporting` / `isSaving` — fires concurrent exports

**File:** `src/renderer/src/hooks/useKeyboardShortcuts.ts:73-78`
**Issue:** The shortcut handler unconditionally calls `handlers.exportBoq()`. The handler in `App.tsx` (`handleExportClick`) does NOT check the in-flight flag — it delegates to `useExport.exportBoq`, which does the guard but suffers from the race in BL-02. Worse: pressing `Ctrl+Shift+E` while the **uncalibrated warning modal** is showing fires a second `exportBoq()` that re-runs the aggregator and re-shows the modal (double-render of `setUncalibratedWarning` is not idempotent because `pages` and `structure` references differ — the modal's body re-renders silently from underneath the user).

Combined with BL-02, this enables observable double-export behaviour. Compare to `Ctrl+S` / `Ctrl+Shift+S` which suffer the same pattern, but `useProject.saveProject` has been hardened with the `setSaving(true)` immediate-on-entry pattern that this hook lacks.

**Fix:** Either (a) fix BL-02 in the hook, or (b) gate the keyboard shortcut on the disabled-state computation. Preferred: (a). For belt-and-braces, also add to `App.tsx`:
```typescript
const handleExportClick = useCallback(async () => {
  if (useProjectStore.getState().isExporting) return  // Reject keyboard repeats explicitly
  // ... existing body ...
}, [exportBoq])
```

---

## Warning Issues

### WR-01: `safeText` not applied to dynamic strings in `metadata` body — date and counts are pre-rendered

**File:** `src/main/boq-writers.ts:113-117`, `202-206`
**Issue:** Metadata block for XLSX/CSV interpolates date and count values into format strings:
```typescript
ws.addRow([safeText(`Project: ${b.metadata.projectName}`)])  // safeText'd
ws.addRow([safeText(`Plan: ${b.metadata.planFilename}`)])    // safeText'd
ws.addRow([`Exported: ${b.metadata.exportedDate}`])          // NOT safeText'd
ws.addRow([`Pages: ${b.metadata.totalPages}`])               // NOT safeText'd
ws.addRow([`Markups: ${b.metadata.totalMarkups}`])           // NOT safeText'd
```
`exportedDate` is `new Date().toISOString().slice(0,10)` so it cannot be malicious, but `totalPages`/`totalMarkups` are integers that always stringify to `[0-9]+` — they cannot start with `=`/`+`/`-`/`@` either. So this is **not a current vulnerability**. However, the inconsistency is a maintenance hazard: if a future change adds a free-form metadata field (e.g., user comments, author name from OS profile), the pattern of "safeText only the first two rows" guarantees the new field will be emitted unsanitized. Apply `safeText` uniformly so the contract is "all label cells go through `safeText`".

**Fix:** Either apply `safeText` to all metadata rows (defense in depth) or extract a helper `metaRow(label)` that always wraps. Same in `buildBoqCsv`.

---

### WR-02: Aggregator silently maps orphaned `categoryId` to `(Uncategorized)` — name-collision risk

**File:** `src/renderer/src/lib/boq-aggregator.ts:217-220`
**Issue:**
```typescript
const catName =
  catKey === UNCAT_BUCKET_KEY
    ? UNCATEGORIZED_LABEL
    : (categoriesById[catKey]?.name ?? UNCATEGORIZED_LABEL)
```
If a markup carries a `categoryId` that is NOT in `categoriesById` (e.g., legacy data where the category was deleted but markups weren't reassigned), the bucket key is the orphaned id, but the displayed name falls back to `'(Uncategorized)'`. This produces TWO categories named `'(Uncategorized)'` in the same export — the real uncategorized bucket AND the orphaned-id bucket — visually indistinguishable but with different items. The orderedCatKeys algorithm preserves the orphan position from `categoryOrder`, so the orphan can appear ABOVE the real uncategorized bucket.

Worse: `categoryOrder.filter((id) => buckets.has(id))` only filters by `buckets`, not by `categoriesById`. An ID present in `categoryOrder` but absent from `categoriesById` will pass through and render as `'(Uncategorized)'`, appearing in the wrong position relative to the real uncategorized rows.

**Fix:** When falling back, distinguish the case explicitly:
```typescript
const catRecord = categoriesById[catKey]
const catName =
  catKey === UNCAT_BUCKET_KEY
    ? UNCATEGORIZED_LABEL
    : (catRecord?.name ?? `(Unknown category: ${catKey.slice(0, 8)})`)
```
Or merge orphans into the uncategorized bucket up front (more defensive). Add a Wave 0 test: aggregator with `markups: [{ categoryId: 'orphan-id', ... }]` and `categoriesById: {}` must not produce two `(Uncategorized)` headings.

---

### WR-03: `dialogAndWrite` `setExporting(false)` runs in `finally` even after the dialog is canceled — flag is correct, but the *exception path* leaves stale state in the warning-modal flow

**File:** `src/renderer/src/hooks/useExport.ts:41-69`, `App.tsx:280-299`
**Issue:** When the user clicks "Cancel" on the `UncalibratedExportWarningModal`, `App.tsx` line 297 calls `setUncalibratedWarning(null)` but does NOT touch the `isExporting` flag. That is fine because `isExporting` was never set to `true` (BL-02 happens to spare us here — the flag is set inside `dialogAndWrite`, which runs only after Continue). But this is fragile: if BL-02 is fixed by setting the flag earlier in `exportBoq`, the Cancel path in App.tsx will leak `isExporting=true` forever, disabling the Export button until next reload.

Mitigation: when fixing BL-02, add explicit `setExporting(false)` in the modal's `onCancel`:
```typescript
onCancel={() => {
  setUncalibratedWarning(null)
  useProjectStore.getState().setExporting(false)  // Release flag — confirmation-modal Cancel
}}
```

---

### WR-04: `findUncalibratedMarkupPages` reads stores that may have changed between aggregation and warning-modal confirmation

**File:** `src/renderer/src/hooks/useExport.ts:72-87`, `89-96`
**Issue:** The flow is:
1. `exportBoq()` → calls `aggregateBoq()` (snapshots stores at T0) AND `findUncalibratedMarkupPages()` (re-reads stores at T0+ε).
2. Returns `{ kind: 'needs-uncalibrated-confirmation', structure, uncalibratedPages }`.
3. User reads modal, clicks Continue some time T1 later.
4. `applyExportAfterConfirm(captured.structure)` → writes the **T0 snapshot** to disk.

If the user adds/deletes markups or sets a scale on an uncalibrated page between T0 and T1, the export still uses the T0 structure. This is intentional per design — it must be, because re-aggregating in `applyExportAfterConfirm` would invalidate the page list the user just confirmed. The modal text says "Their length, area, and perimeter measurements will be excluded from the export" — and they will be, but the user might now expect them to be included.

**Fix:** Either explicitly disable canvas interaction while the warning modal is open (already true for the click-blocker overlay, but keyboard tools and Ctrl+S still work), or document this in the modal body: "Note: scale changes made while this dialog is open will not affect the export." Alternative: re-aggregate inside `applyExportAfterConfirm` to capture the latest state — but then the captured `structure` parameter is dead.

---

### WR-05: `dirnameAny` returns empty string for paths without separator — produces relative `defaultPath`

**File:** `src/renderer/src/hooks/useExport.ts:12-15`, `22-33`
**Issue:**
```typescript
function dirnameAny(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''  // <-- empty string when no separator
}

// Used:
const dir = currentFilePath ? dirnameAny(currentFilePath) : ''
const filename = `${projectBase}-BOQ.${format}`
return dir ? `${dir}/${filename}` : filename
```
If `currentFilePath` is a bare filename (no separator), `dirnameAny` returns `''`, and the function returns `${filename}` with no directory. The resulting `defaultPath` passed to `dialog.showSaveDialog` is just `'project-BOQ.xlsx'`, which Electron interprets as a relative path under `app.getAppPath()` or the CWD. This is a UX regression — the user would expect the dialog to default to the project's directory.

`currentFilePath` should always be absolute (it comes from `dialog.showOpenDialog`/`showSaveDialog`), so this shouldn't trigger in practice. But if a future migration writes a relative path into the project state (or persists something through serialization that strips the prefix), this silently degrades.

**Fix:** Defensive — log a warning when `dirnameAny` returns empty for a path that has any non-separator content, OR mix in the directory using `path.posix.join` semantics consistently. Also: the constructed path uses `/` even on Windows — Electron's `showSaveDialog` accepts mixed separators on Windows but it's inconsistent with the rest of the codebase.

---

### WR-06: `useExport` hook does NOT memoize `dialogAndWrite` — it's redefined on every render, but always closes over `useProjectStore.getState`

**File:** `src/renderer/src/hooks/useExport.ts:41-70`
**Issue:** `dialogAndWrite` is a plain function declared inside the hook body. It is not wrapped in `useCallback`, so a fresh closure is created on every render. The two `useCallback`s for `exportBoq` and `applyExportAfterConfirm` capture `dialogAndWrite` from the surrounding scope — which means the `useCallback` dependency array `[]` is misleading: the captured `dialogAndWrite` reference is fresh every render, but the memoized `exportBoq` is not. This is `react-hooks/exhaustive-deps` lint-failure territory: the linter will warn that `dialogAndWrite` is missing from the dep array.

Functionally, this still works because `dialogAndWrite` only reads `useProjectStore.getState()` (no closure-over-state), but it's a footgun. If a future change captures a state value into `dialogAndWrite` (e.g., reading `currentFilePath` from `useProjectStore((s) => s.currentFilePath)`), the captured value will be stale.

**Fix:** Either inline `dialogAndWrite` into both callers (DRY violation, but explicit), or wrap in `useCallback([])` and treat as a sibling memoized helper. Verify no ESLint exhaustive-deps suppression is needed.

---

### WR-07: `Ctrl+Shift+E` does not respect text-input-active suppression in the same order as other shortcuts — works, but inconsistent

**File:** `src/renderer/src/hooks/useKeyboardShortcuts.ts:73-78`
**Issue:** The Ctrl+Shift+E block is correctly placed (before Ctrl+S to avoid conflict), and `isTextInputActive()` is called first — this is correct. However, the dispatch order means Ctrl+Shift+E fires from inside a markup-name popup (`MarkupNamePopup` uses an `<input>` element) only if `isTextInputActive` returns true. Verified by the code in `useKeyboardShortcuts.ts:38` — `HTMLInputElement` is detected. Good.

But: the popup is rendered inside the canvas with focus management; the user could potentially trigger Ctrl+Shift+E with the canvas focused (no input active) while a count placement is mid-flight (`markupState.mode === 'placing'`). Export proceeds, dialog opens, and the markup tool state is left in `placing` mode. After save, the canvas still expects clicks to place pins. Not a bug per se (the markup tool resumes correctly) but worth confirming via UAT. Mitigation: cancel the active markup tool inside `handleExportClick` via `useViewerStore.getState().setActiveTool('select')`.

---

### WR-08: Aggregator's first-color-wins behaviour assigns by *aggregation order*, not by *most-recent* — color drift between sessions

**File:** `src/renderer/src/lib/boq-aggregator.ts:106-112`
**Issue:**
```typescript
function add(categoryId: string | null, name: string, type: BoqRowType, qty: number): void {
  const map = bucketFor(categoryId)
  const k = `${name}|${type}`
  const cur = map.get(k) ?? { quantity: 0, color: getColorForName(name) }  // <-- read once
  cur.quantity += qty
  map.set(k, cur)
}
```
`getColorForName(name)` is invoked only when the bucket is FIRST created. The implementation in `markupStore.ts:151-163` returns the latest-by-`createdAt` color, which is deterministic — but the `add` function calls it once per (cat, name, type) and reuses the result. If a name appears in multiple categories (which is allowed because the bucket key includes categoryId), each category's first encounter calls `getColorForName(name)` separately. They will all return the same value (latest-by-createdAt is global), so colors are consistent. Fine.

**Real concern:** `getColorForName` returns `null` when no markup with that name exists. But the aggregator only calls `add` when iterating over markups, so `getColorForName(name)` always finds at least one markup with that name → never returns null in practice. The `BoqItemRow.color: string | null` field's `null` branch is therefore dead. Not a bug, but the type's nullability is misleading.

**Fix:** Either tighten the type to `string` (and remove the null-guard at line 165 in boq-writers.ts), or add a comment explaining when `null` arises (e.g., reserved for future "name with no live markups" case). Currently the `null` branch in `appendItemRow` is unreachable and untested.

---

### WR-09: `Toolbar`'s `hasMarkups` selector iterates `Object.values(s.pageMarkups).some(...)` on every render — fine, but read costs scale with pages

**File:** `src/renderer/src/components/Toolbar.tsx:142-144`
**Issue:**
```typescript
const hasMarkups = useMarkupStore((s) =>
  Object.values(s.pageMarkups).some((arr) => arr.length > 0)
)
```
This is a derived selector that returns a primitive boolean. Zustand's default equality (`Object.is`) works correctly here — re-renders only when the boolean flips. Acceptable.

However, `Object.values(s.pageMarkups)` allocates a new array every selector call. Zustand calls this selector on every store change, not just renders. For large projects (50+ pages × 100+ markups), this is per-store-change CPU. Performance is out of v1 scope per review-scope rules — flagged as Info-leaning-Warning because of the cumulative effect with the existing subscriber list (markupStore has multiple subscribers).

**Fix (optional):** Maintain `hasAnyMarkups: boolean` as a derived field in markupStore, updated on `placeMarkup`/`deleteMarkup`/`hydrate`/`reset`.

---

## Info Issues

### IN-01: `boq-types.ts` declares `BoqStructure` types, then `boq-writers.ts`, `preload/index.ts`, `preload/index.d.ts` all duplicate them inline — drift is detected only by Wave 0 tests

**File:** `src/renderer/src/lib/boq-types.ts`, `src/main/boq-writers.ts:11-36`, `src/preload/index.ts:13-41`, `src/preload/index.d.ts:6-31`
**Issue:** Four-way type duplication is documented as intentional in PATTERNS.md (no shared types module per CLAUDE.md). Drift detection relies entirely on the Wave 0 boq-export-ipc test. If that test is ever removed or marked `.skip`, the four definitions can drift silently — the renderer compiles, the main process compiles, the IPC wire works at runtime even with field-name drift because `ipcRenderer.invoke` serializes through structured-clone. The receiving side gets the literal object structure regardless of TS shape.

**Fix:** Add a comment in each duplicate location pointing to the canonical definition AND to the cross-process test. Already done in `boq-writers.ts:5-10` ("NEVER let these definitions diverge from boq-types.ts without updating BOTH"). Mirror in `preload/index.ts` (already done at line 13-15) and `preload/index.d.ts` (currently no warning comment — add one).

---

### IN-02: `App.tsx` defines `fileBasename` helper inline twice — duplicate code

**File:** `src/renderer/src/App.tsx:168-171`, `290-293`
**Issue:** The `fileBasename` helper is declared inside `handleExportClick` AND inside the `UncalibratedExportWarningModal.onContinue` arrow function. The bodies are identical:
```typescript
const fileBasename = (p: string): string => {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(i + 1) : p
}
```
Same logic exists in `useExport.ts:7-10` (`basenameAny`) and `boq-aggregator.ts:25-28` (`basenameAny`).
**Fix:** Extract a single `basename` utility into `src/renderer/src/lib/path-utils.ts` (or similar). Four-place duplication invites drift if one is updated to handle a new edge case.

---

### IN-03: `Toolbar.tsx` re-imports `useMarkupStore` for one selector — could be folded into existing import block

**File:** `src/renderer/src/components/Toolbar.tsx:22`, `142-144`
**Issue:** `useMarkupStore` is imported and used only for the `hasMarkups` derived boolean (line 142). The import is fine — but the selector is the only direct use of `useMarkupStore` in `Toolbar.tsx`. As `Toolbar` grows, this single-use import should ideally migrate to a `useExportEnabled()` derived hook to keep `Toolbar` agnostic of which store powers the disabled-state logic.

**Fix:** Optional — extract:
```typescript
// in hooks/useExportEnabled.ts
export function useExportEnabled(): boolean {
  const totalPages = useViewerStore((s) => s.totalPages)
  const isSaving = useProjectStore((s) => s.isSaving)
  const isExporting = useProjectStore((s) => s.isExporting)
  const hasMarkups = useMarkupStore((s) =>
    Object.values(s.pageMarkups).some((arr) => arr.length > 0))
  return totalPages > 0 && !isSaving && !isExporting && hasMarkups
}
```

---

### IN-04: `UncalibratedExportWarningModal` does not prevent click-through to underlying canvas via the overlay

**File:** `src/renderer/src/components/UncalibratedExportWarningModal.tsx:29-35`
**Issue:** The overlay div has `position: fixed; inset: 0` and `zIndex: 100`, so clicks on the overlay backdrop are absorbed by it (not propagated to the canvas underneath). However, there is no `onClick` handler that calls `onCancel` — clicking the dimmed backdrop does nothing. This is a deliberate UX choice (force the user to choose Continue or Cancel explicitly), and matches `OpenErrorModal` behaviour. Just noting that focus is correctly trapped only via `autoFocus` on the Continue button — if the user tabs forward, focus escapes the modal. Not a regression (other modals in the codebase have the same limitation), but worth a future accessibility pass.

**Fix:** Add a focus-trap: capture `Tab`/`Shift+Tab` on the modal root and cycle focus between Continue and Cancel buttons. Optional for v1.

---

### IN-05: `boq-aggregator.ts` uses `Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))` for cross-platform basename — works, but forks from existing patterns

**File:** `src/renderer/src/lib/boq-aggregator.ts:25-28`, `src/renderer/src/hooks/useExport.ts:7-10`, `src/renderer/src/App.tsx:168-171`, `289-292`
**Issue:** Four copies of the same idiom appear across the renderer (renderer cannot import from `path` module — that's Node-only). The pattern is correct. As IN-02 notes, consolidate.

**Fix:** Extract to a `lib/path-utils.ts` module exporting `basename(p)` and `dirname(p)`. Optional but cleans up four duplicates.

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
