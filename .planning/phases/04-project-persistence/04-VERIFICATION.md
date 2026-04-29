---
phase: 04-project-persistence
verified: 2026-04-29T07:50:00Z
reverified: 2026-04-29
status: complete
score: 3/3 must-haves verified; all human re-verification items passed
human_verification:
  - test: "Open a .clmc file whose linked PDF has been renamed or moved"
    expected: "MissingPdfModal appears immediately with 'PDF not found' heading and a 'Browse for PDF' button — canvas remains blank, no crash"
    result: "PASSED 2026-04-29 — MissingPdfModal appeared correctly after ENOENT guard + Toolbar onOpenClick prop fix"
  - test: "Re-link via Browse — pick a PDF with a different page count from the original"
    expected: "After Browse, PageCountAbortModal appears with 'Wrong PDF' heading showing expected vs actual page count and 'Pick again' + 'Cancel' buttons"
    result: "PASSED 2026-04-29"
  - test: "Open a .clmc file whose linked PDF has been replaced (same filename, different bytes)"
    expected: "HashMismatchModal appears with 'PDF may have changed' heading and 'Open anyway' + 'Cancel' buttons"
    result: "PASSED 2026-04-29"
  - test: "After dismissing an OpenErrorModal, successfully open a different .clmc file"
    expected: "The error state clears (no stale modal) and the new project loads normally"
    result: "PASSED 2026-04-29 — fix(04-07) clears openError in the ok branch"
---

# Phase 4: Project Persistence Verification Report

**Phase Goal:** Estimators can save their work to a .clmc file and reopen it later to continue exactly where they left off, with all markups and scale calibrations intact

**Verified:** 2026-04-29T07:50:00Z
**Re-verified:** 2026-04-29 — all human items passed after ENOENT guard, OpenErrorModal ok-branch fix, and Toolbar onOpenClick prop wiring
**Status:** complete — 3/3 automated truths verified; all 4 human re-verification items passed

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can save the current project to a .clmc file; saved file contains PDF reference, all markup positions and names, per-page scale calibrations, and a format version field | VERIFIED | `snapshotProject` in `project-serialize.ts` serializes all fields into a `ProjectFileV1` with `formatVersion: 1`, `pdf.sha256`, `pdf.absolutePath`, `pdf.relativePath`, per-page `markups`, `scale`, and `viewport`; saved via `window.api.writeProject`; 251 tests pass including project-serialize and project-io suites |
| 2 | User can reopen a saved .clmc file and every markup appears on the correct position on the correct page, indistinguishable from the state at save time | VERIFIED | `hydrateStores` in `project-serialize.ts` restores `pageMarkups`, `pageScales`, `pageViewports`, `categories`, `categoryOrder`, and `currentPage`; hydration is bracketed by `suspendDirtyTracking/resumeDirtyTracking` so `isDirty` stays false; coordinate round-trip preserved (canvas-space points not pixel-absolute); human verification Sections A-E all passed in 04-06 checkpoint |
| 3 | If the original PDF file has been moved or renamed, the app shows a clear "PDF not found" message with a Browse button to re-link it — rather than crashing or silently showing a blank canvas | VERIFIED | Human re-verification passed 2026-04-29 (Sections F, G, H). Root causes closed by: ENOENT guard in `openClmcFromPath` converting `hashPdf` throw to `missing-pdf`; Toolbar `onOpenClick` prop wiring so `handleOpenResult` routes all modal kinds (previously Toolbar called `openProjectDialog` directly and discarded the result). All recovery modals now appear correctly. |

**Score:** 2/3 truths fully verified (Truth 3 pending human confirmation)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/renderer/src/lib/project-schema.ts` | VERIFIED | Exports `ProjectFileV1` interface with all D-02 fields; `validateV1` validates required fields; `migrate` dispatches by version with descriptive error for unknown versions; 67 lines, substantive |
| `src/renderer/src/lib/project-serialize.ts` | VERIFIED | `snapshotProject` reads all three stores and serializes to `ProjectFileV1`; `hydrateStores` restores all stores with dirty-tracking suspended; 119 lines, substantive |
| `src/main/project-io.ts` | VERIFIED | `sha256File` streaming hash; `resolvePdfPath` tries absolute then relative; `computeRelativePath` with cross-drive null guard; `enforceClmcExtension`; all wired into IPC handlers |
| `src/main/ipc-handlers.ts` | VERIFIED | All IPC channels registered: `dialog:openProject`, `dialog:saveProject`, `file:readProject`, `file:writeProject`, `file:hashPdf`, `file:resolvePdfPath`, `file:computeRelativePath`, `file:checkExists`, `file:readPdfBytes` |
| `src/renderer/src/stores/projectStore.ts` | VERIFIED | `isDirty`, `currentFilePath`, `lastSavedAt`; `setSaved` sets clean; `markDirty` respects `_hydrating` guard; `attachDirtyTracking` subscribes to markup/scale/viewer stores; `suspendDirtyTracking`/`resumeDirtyTracking` exported |
| `src/renderer/src/hooks/useProject.ts` | VERIFIED | `openClmcFromPath` returns `ProjectOpenResult` for all cases; ENOENT guard on `hashPdf`; `routeOpenResult` pure helper exported; `writeSnapshotToPath` saves and calls `setSaved`; `relinkPdf`, `applyHashMismatchProceed`, `applyDimensionMismatchProceed` all implemented |
| `src/renderer/src/components/MissingPdfModal.tsx` | VERIFIED | `aria-label="PDF not found"`, "Browse for PDF" button, Escape cancels, auto-focuses Browse on mount |
| `src/renderer/src/components/HashMismatchModal.tsx` | VERIFIED | `aria-label="PDF changed warning"`, "Open anyway" button, Escape cancels |
| `src/renderer/src/components/PageCountAbortModal.tsx` | VERIFIED | `aria-label="Page count mismatch — abort required"`, shows expected vs actual page counts, "Pick again" button |
| `src/renderer/src/components/OpenErrorModal.tsx` | VERIFIED | `aria-label="Failed to open file"` (note: plan spec said "Could not open project" — actual is "Failed to open file"; the test suite tests `routeOpenResult` not DOM aria-label, so tests pass regardless); auto-focuses Close on mount; Escape closes; message displayed in monospace block |
| `src/renderer/src/App.tsx` | VERIFIED | Imports and mounts all five modals; `handleOpenResult` routes all `ProjectOpenResult.kind` values to correct modal setters; `openError` state wires to `OpenErrorModal` |
| `src/tests/project-open-flow.test.ts` | VERIFIED | 7 tests covering ok/canceled/null/missing-pdf/page-count-mismatch/hash-mismatch/error routing via `routeOpenResult`; all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useProject.openClmcFromPath` | `ProjectOpenResult.kind === 'missing-pdf'` | `resolvePdfPath` returning null | WIRED | Lines 166-174 of `useProject.ts` — confirmed in code |
| `useProject.openClmcFromPath` | `ProjectOpenResult.kind === 'missing-pdf'` (ENOENT path) | inner try/catch on `hashPdf` | WIRED | Lines 180-196 of `useProject.ts` — ENOENT guard present |
| `useProject.openClmcFromPath` | `ProjectOpenResult.kind === 'hash-mismatch'` | hash comparison | WIRED | Line 194 of `useProject.ts` — confirmed |
| `useProject.openClmcFromPath` | `ProjectOpenResult.kind === 'error'` | outer try/catch | WIRED | Lines 199-203 of `useProject.ts` |
| `App.tsx handleOpenResult` | `setOpenError` | `result.kind === 'error'` branch | WIRED | Line 96 of `App.tsx` — sets `openError` state AND console.errors |
| `App.tsx` | `OpenErrorModal` render | `openError !== null` guard | WIRED | Lines 175-181 of `App.tsx` — mounts modal when `openError` is non-null |
| `App.tsx handleOpenResult 'ok'` | clearing `setOpenError` | `ok` branch | NOT WIRED | Line 91 of `App.tsx`: `ok` branch clears `setMissing/setHashMiss/setDimMiss/setPageAbort` but does NOT call `setOpenError(null)`. In practice harmless because user must click Close to dismiss before opening another file, but technically the plan spec (Plan 04-07 Task 2, Step 2.2c) required this. |
| `ipc-handlers.ts` | `project-io.ts` functions | import + handler registration | WIRED | Line 4 imports all four `project-io` functions; all are called in their respective handlers |
| `writeSnapshotToPath` | `setSaved(clmcPath)` | call after `writeProject` | WIRED | Line 135 of `useProject.ts` — marks project clean after successful write |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `snapshotProject` | `markup.pageMarkups`, `scale.pageScales`, `viewer.pageViewports` | `useMarkupStore.getState()`, `useScaleStore.getState()`, `useViewerStore.getState()` | Yes — live Zustand state, populated by user actions | FLOWING |
| `hydrateStores` | `pageMarkups`, `pageScales`, `pageViewports` | `data.pages` array from parsed `ProjectFileV1` | Yes — deserialized from saved JSON | FLOWING |
| `sha256File` | file hash | `fs.createReadStream` over actual PDF file | Yes — streaming hash of real file | FLOWING |
| `resolvePdfPath` | resolved file path | `existsSync` + `path.resolve` on actual filesystem | Yes — real path resolution | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 251 tests pass | `npx vitest run` | 28 test files, 251 tests, 0 failures, 7.64s | PASS |
| TypeScript compiles clean | `npm run typecheck` | Both `typecheck:node` and `typecheck:web` exit 0, no errors | PASS |
| `routeOpenResult` routes all 7 kinds correctly | `npx vitest run src/tests/project-open-flow.test.ts` | 7/7 pass | PASS |
| `sha256File` is stream-based (no full file load) | Grep `createReadStream` in `project-io.ts` | Confirmed at line 12 | PASS |
| `resolvePdfPath` null on cross-drive | Grep `parse(...).root` in `project-io.ts` | Cross-drive guard at line 63 of `project-io.ts` | PASS |
| `hydrateStores` suspends dirty tracking | Grep `suspendDirtyTracking` in `project-serialize.ts` | Confirmed at line 75, resumed in `finally` at line 112 | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PERS-01 | User can save the current project (PDF file reference + all markup positions + per-page scale) to a .clmc project file | SATISFIED | `snapshotProject` serializes all required fields; `writeSnapshotToPath` saves via IPC; `setSaved` marks clean; human Sections A-B passed in 04-06 |
| PERS-02 | User can reopen a .clmc project file and continue marking up where they left off | SATISFIED (code-level); human confirmation of recovery flows pending | `hydrateStores` restores all stores; `openClmcFromPath` handles all result kinds; recovery modals exist and are wired. Sections C-E passed in 04-06. Sections F/G/H require re-run after 04-07 gap closure. |

No orphaned requirements: PERS-01 and PERS-02 are the only Phase 4 requirements in REQUIREMENTS.md, and both are claimed in plan frontmatter. The traceability table in REQUIREMENTS.md marks both as Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `App.tsx` | 91 | `handleOpenResult 'ok'` does not call `setOpenError(null)` | Warning | If user somehow triggers an open error, closes the OpenErrorModal, then successfully opens another file via a code path that calls `handleOpenResult({kind:'ok'})` without a prior `setOpenError(null)`, the stale error string persists in state. In practice unreachable because: the Close button calls `setOpenError(null)` directly, and no successful open flow would display the error modal simultaneously. |
| `useProject.ts` | 184, 201, 253 | Diagnostic logging uses `console.error` for all branches (including non-error ENOENT path at line 184) instead of `console.log` for trace branches | Info | Plan 04-07 specified `console.log` at EVERY decision branch for devtools triage. The actual implementation only logs at error/catch points, not at success/routing branches (no "read OK", "resolved PDF at", "hash matches" trace lines). Reduces debuggability for future regressions but does not block goal achievement. |

---

### Human Verification Required

The following items cannot be verified programmatically. They require running the Electron app with real files on a Windows machine.

#### 1. Section F — Missing PDF Recovery (closes PERS-02 criterion 3)

**Test:** Save a project with a PDF. Rename or move the linked PDF to a different path. Use File > Open to reopen the .clmc file.
**Expected:** MissingPdfModal appears immediately with heading "PDF not found", showing the last-known path, and a "Browse for PDF" button. The canvas behind it is blank (not a crash, not a silent blank).
**Why human:** This is the exact scenario that failed in 04-06 checkpoint step 32. Plan 04-07 added the ENOENT guard (converts `hashPdf` ENOENT throw to `missing-pdf` result) and diagnostic logging. The fix is code-level verified, but the Windows filesystem behavior (whether `resolvePdfPath` existsSync correctly returns false for the renamed file) must be confirmed in situ.

#### 2. Section G — Page Count Abort (closes PERS-02 criterion 3 follow-on)

**Test:** After Section F passes: in MissingPdfModal, click "Browse for PDF" and select a PDF with a different page count from the original project.
**Expected:** PageCountAbortModal appears with heading "Wrong PDF", showing "Selected PDF has X pages, but project expects Y". Buttons: "Pick again" and "Cancel".
**Why human:** Dependent on Section F succeeding. Requires real multi-page PDFs.

#### 3. Section H — Hash Mismatch Warning (closes PERS-02 criterion 3)

**Test:** Save a project. Replace the linked PDF at the same path with a different file (same name, different bytes). Reopen the .clmc file.
**Expected:** HashMismatchModal appears with heading "PDF may have changed", offering "Open anyway" and "Cancel".
**Why human:** Requires real file replacement on disk. The ENOENT guard in Plan 04-07 ensures a `hashPdf` throw (file locked/gone) is routed to `missing-pdf`; the hash-mismatch path (file present but different) is a separate branch that was also failing silently before — the diagnostic logging added will help triage if it still fails.

#### 4. OpenErrorModal UX after successful re-open

**Test:** Trigger an open error (e.g. corrupt .clmc file) so OpenErrorModal appears. Click "Close" to dismiss. Then open a valid .clmc file. Confirm no stale error text lingers.
**Expected:** After clicking Close and then opening successfully, no second OpenErrorModal appears.
**Why human:** The `ok` branch of `handleOpenResult` does not call `setOpenError(null)`. The workaround — Close button calls `setOpenError(null)` directly — should be sufficient, but should be confirmed to not produce double-modal or stale state.

---

### Gaps Summary

No blocking gaps remain at the code level. All three success criteria have substantive implementation:

1. **PERS-01 (save):** Full implementation — schema, serialize, IPC, dirty tracking, title-bar asterisk, Ctrl+S/Shift+S shortcuts. Human-verified in 04-06 Sections A-B.
2. **PERS-02 (reopen):** Full implementation — hydration, round-trip coordinate preservation, recovery modals for all mismatch kinds. Human-verified in Sections C-E. Sections F/G/H require re-run after gap closure.

One code-level deviation worth noting but not blocking:
- `handleOpenResult 'ok'` does not clear `openError` — classified Warning, not blocker.
- Diagnostic branch logging missing (console.error only on errors, not console.log at each routing branch) — classified Info.

Phase 4 is functionally complete but cannot be formally closed until Sections F, G, and H of the human verification checkpoint are re-executed with the 04-07 fix in place and confirmed passing.

---

_Verified: 2026-04-29T07:50:00Z_
_Verifier: Claude (gsd-verifier)_
