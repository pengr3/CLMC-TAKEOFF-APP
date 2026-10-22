---
phase: 20-production-readiness
reviewed: 2026-10-22T03:23:11Z
depth: standard
diff_base: d0bcee9
files_reviewed: 64
files_reviewed_list:
  - electron-builder.yml
  - electron.vite.config.ts
  - package.json
  - resources/release-notes.json
  - resources/third-party-notices.json
  - scripts/prepare-release.cjs
  - scripts/smoke-electron-host.cjs
  - scripts/smoke-packaged.cjs
  - scripts/verify-release-evidence.cjs
  - scripts/verify-release.cjs
  - src/main/app-identity.ts
  - src/main/cost-library-import.ts
  - src/main/cost-library-ipc.ts
  - src/main/cost-library-worker.ts
  - src/main/cost-library.ts
  - src/main/index.ts
  - src/main/ipc-handlers.ts
  - src/main/project-io.ts
  - src/main/project-recovery.ts
  - src/main/project-storage.ts
  - src/main/release-info.ts
  - src/main/workbook-admission.ts
  - src/main/yauzl.d.ts
  - src/preload/index.d.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/AboutDialog.tsx
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/components/CompatibilityDialogFrame.tsx
  - src/renderer/src/components/CostLibraryDialog.tsx
  - src/renderer/src/components/EstimateRow.tsx
  - src/renderer/src/components/LegacyRateReviewDialog.tsx
  - src/renderer/src/components/OpenErrorModal.tsx
  - src/renderer/src/components/PdfPageImage.tsx
  - src/renderer/src/components/RecoveryDialog.tsx
  - src/renderer/src/components/SaveCloseModal.tsx
  - src/renderer/src/components/SaveFailureDialog.tsx
  - src/renderer/src/components/StatusBar.tsx
  - src/renderer/src/components/TitleBar.tsx
  - src/renderer/src/components/TopActionBar.tsx
  - src/renderer/src/components/UpgradeProjectDialog.tsx
  - src/renderer/src/hooks/useCloseGuard.ts
  - src/renderer/src/hooks/useDraggable.ts
  - src/renderer/src/hooks/useExport.ts
  - src/renderer/src/hooks/usePdfDocument.ts
  - src/renderer/src/hooks/usePdfRenderer.ts
  - src/renderer/src/hooks/useProject.ts
  - src/renderer/src/hooks/useReleaseInfo.ts
  - src/renderer/src/lib/apply-library-rate.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/compatibility-ui.ts
  - src/renderer/src/lib/legacy-rate-guard.ts
  - src/renderer/src/lib/pdf-page-cache.ts
  - src/renderer/src/lib/project-schema.ts
  - src/renderer/src/lib/project-serialize.ts
  - src/renderer/src/lib/rate-units.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/stores/scaleStore.ts
  - src/shared/cost-library.ts
  - src/shared/project-validation.ts
  - src/shared/release-info.ts
  - src/shared/reliability.ts
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-10-22T03:23:11Z  
**Depth:** standard, explicitly selected by the workflow flag  
**Files Reviewed:** 64  
**Status:** issues_found

## Narrative Findings (AI reviewer)

The exact IR scope was reviewed against `d0bcee9`, with supporting reads of the phase context, nine plans/summaries, dependency review, relevant callers and tests. Four product defects require correction before release: legacy coordinate compatibility, future-file preservation, financial category integrity, and recovery after interrupted writes. Two smoke-harness defects weaken the recorded evidence.

The approved Electron 44.9.3 choice and internal-export/recovery scope are respected. Pending non-development-PC installation, scaling and pilot evidence is an external acceptance gate, not a code defect. Existing CanvasViewport lint debt is not reported as a phase regression. No source changes or commits were made.

## Critical Issues

### CR-01: Existing clamped-page projects reopen in a different coordinate space

**Classification:** BLOCKER  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/src/renderer/src/hooks/usePdfRenderer.ts:121-130`  
**Related:** `src/renderer/src/lib/project-schema.ts:203-219`; `src/renderer/src/lib/project-serialize.ts:113-124`; `src/renderer/src/hooks/useMarkupTool.ts:511-517`.

**Issue:** The new logical page size uses the full, unrounded `PDF_BASE_SCALE` viewport, but existing projects store raw stage-space points, arc midpoints and `pixelsPerMm`. At the review base, the renderer's stage size was the floored, DPR-clamped viewport. Migration/hydration copies those coordinates and calibration unchanged. Consequently, a valid older large-plan project now draws its markups over different PDF locations, and subsequent measurements use calibration from the old coordinate space. The new-format DPR tests create and reopen projects using the new coordinate convention, so they do not exercise this upgrade.

**Evidence:** For a 7000.25-PDF-unit-wide page at DPR 2, the old stage width is 8192 and the new width is 14000.5. A saved midpoint pin at x=4096 moves from 50% to 29.256% of the PDF width. A newly traced span representing the old calibrated 10 m reports approximately 17.09045 m. These values follow the actual old/new viewport calculations and raw-point persistence; no Windows-monitor acceptance result is inferred.

**Fix:** Add an explicit coordinate-space migration/compatibility policy before adopting legacy pages. Rebase points, count positions, arc midpoints and calibration together using a verified legacy logical basis; persist that basis for future migrations. Older files do not record the historical clamped dimensions/DPR, so require a visible verification/recalibration/repositioning flow when the basis cannot be established, rather than silently assuming the new space. Add an old-runtime-produced clamped-page fixture and verify PDF landmark alignment plus existing/new length and area measurements after upgrade.

### CR-02: Future archives with additional entries are silently overwritten without a backup

**Classification:** BLOCKER  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/src/main/project-storage.ts:66-72`  
**Related:** `src/main/project-io.ts:131-139`; `src/main/project-storage.ts:132-157`.

**Issue:** `rejectFutureOriginal` calls the current-format extractor before checking the version and treats every extraction exception as permission to repair a damaged destination. That extractor rejects any third entry. A newer project format that retains `project.json` but adds another archive member therefore bypasses the future-version guard. The subsequent last-good validation also rejects it, so replacement destroys the original without even creating its backup. This contradicts the newly implemented future-file preservation guarantee.

**Evidence:** An isolated real-filesystem reproduction created a ZIP containing `project.json` with `formatVersion: 4` / `minimumReaderVersion: 4`, `plan.pdf`, and `future-metadata.json`, then called the production protected writer with a valid format-3 snapshot. Result: `futureOriginalPreserved: false`, `backupExists: false`, `savedVersion: 3`.

**Fix:** Inspect bounded version metadata independently of the current two-entry admission rules and reject newer formats before replacement. Fail closed when an existing destination's format cannot safely be classified; do not convert an unsupported-layout exception into implicit repair authorization. Add preservation tests for future archives with extra members and changed layout, asserting identical original bytes and no replacement.

### CR-03: Admitted category orders can double or omit estimate totals

**Classification:** BLOCKER  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/src/shared/project-validation.ts:61-77`  
**Related:** `src/renderer/src/lib/boq-aggregator.ts:209-214`; `src/renderer/src/lib/boq-aggregator.ts:228-229`.

**Issue:** The new admission boundary checks only that `categoryOrder` is an array of strings. It does not require unique known category IDs, complete coverage of categories used by markups, or valid markup category references. The aggregator iterates this order directly: duplicate IDs emit and charge the same bucket twice; an omitted ID drops that bucket entirely. Such a malformed format-3 project passes admission and can be saved/recovered/exported with plausible but incorrect financial totals.

**Evidence:** A production-validator/aggregator reproduction used one count in category `c`, material 100, labor 0 and markup 30. Admission accepted `categoryOrder: ['c', 'c']`; aggregation returned 260 instead of 130. With the category omitted from the order, the same item returned 0. This is a defect in the new relational validation, not a request to change normal category ordering.

**Fix:** Validate category-order uniqueness and references, ensure every nonempty markup category exists and is represented exactly once, and reject malformed current-format input before hydration. If supported legacy data needs repair, normalize it explicitly without dropping buckets and preserve the original. Also make aggregation defensively emit each actual bucket once. Add duplicate, omitted and dangling-category admission/financial tests.

### CR-04: Interrupted recovery blobs can permanently prevent subsequent recovery writes

**Classification:** BLOCKER  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/src/main/project-recovery.ts:336-363`  
**Related:** `src/main/project-recovery.ts:237-257`; `src/main/project-recovery.ts:365-369`.

**Issue:** A write that commits its PDF blob and then fails before manifest replacement leaves the unreferenced blob behind. A process interruption can also leave stages. `usedBytes()` charges these files before quota admission, while pruning occurs only after a successful commit/deletion/retirement. Once abandoned data consumes the quota, every new snapshot fails before cleanup can run. The recovery list can be empty, leaving no candidate the user can discard to restore protection. Saving explicitly does not clean this case because the renderer has no protected revision to retire.

**Evidence:** An isolated production-repository reproduction used a proportionally reduced 3500-byte quota and a 1700-byte PDF, injected failure at `manifest-rename`, then attempted a different PDF. The list contained zero candidates; both retries returned `stage: 'quota'`; the sole remaining file was the orphan hash-named PDF. At the default quota, repeated interrupted captures of different large PDFs produce the same condition. The initial sandbox rename failure was excluded; the successful reproduction ran against real temporary files with host access and cleaned its fixtures afterward.

**Fix:** Under the repository queue, reconcile completed manifests and safely remove owned unreferenced blobs/stages before charging new quota, including after restart and failed writes. Preserve all references when metadata is unreadable, and never evict completed/kept work. Alternatively, roll back newly created unreferenced blobs on ordinary transaction failure and still reconcile crash remnants on startup. Add restart and repeated-failure tests that prove a subsequent valid snapshot can succeed without manual filesystem cleanup.

## Warnings

### WR-01: Packaged smoke copies candidate hashes without verifying the launched candidate

**Classification:** WARNING  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/scripts/smoke-packaged.cjs:60-62`  
**Related:** `scripts/smoke-packaged.cjs:286-289`; `scripts/smoke-packaged.cjs:166-180`.

**Issue:** The harness accepts an arbitrary executable argument, reads the fixed `dist/release-manifest.json`, and later copies that manifest's installer/ASAR hashes into passing evidence. It never hashes the launched executable or its associated ASAR against the inspected manifest, and it records the observed Electron version without comparing it to the approved runtime. A different same-version build, or an unpacked directory changed after inspection, can therefore produce apparently candidate-bound evidence for bytes it never executed. This does not assert that the existing recorded candidate was substituted; it identifies an unreliable evidence gate.

**Fix:** Before launch, resolve the executable's actual application resources and compare executable, ASAR and relevant unpacked hashes to the inspected manifest; verify the installer hash used in the evidence too. Assert the observed runtime matches the approved manifest runtime, and emit measured identities. Add mismatch tests for another executable directory and changed same-version resources.

### WR-02: Smoke reopening assertions are already true before reopening

**Classification:** WARNING  
**File:** `C:/Users/Admin/Roaming/CLMC TAKEOFF APP/scripts/smoke-packaged.cjs:197-199`  
**Related:** `scripts/smoke-electron-host.cjs:187-189`; `scripts/smoke-packaged.cjs:300`.

**Issue:** After Save succeeds, the title already contains `packaged-project` (or `sandbox-project`). Clicking Open and waiting for that same text can succeed immediately even if reopening never completes or subsequently fails. Both harnesses then claim save/read/reopen evidence. The preceding `readProject` call proves archive readback, but does not prove renderer staging/hydration/adoption through the UI open path.

**Fix:** Open a visibly different document before reopening the saved project, then wait for the saved PDF and distinctive persisted markup/scale/rate state to replace it, with no error modal. Include a negative control where the renderer open fails and ensure the smoke fails. Only emit the reopen success field after that transition is observed.

## React checklist applied to Electron

Applied the requested local `react-best-practices` skill as a correctness checklist. Next.js server components, SSR/hydration, network fetching, SWR adoption and performance-only suggestions were excluded from this offline desktop review.

| Area | Review performed |
| --- | --- |
| Hooks and event lifetimes | Traced save/recovery closures, effect dependencies, native rate-input rebinding, timer/listener cleanup, DPR invalidation and stale raster cancellation. |
| State and asynchronous actions | Checked captured PDF/state identity, revision acknowledgement, dirty preservation, upgraded/backup sources, modal actions and import preview ownership. Product defects are recorded above. |
| Component/input behavior | Checked stable store-derived values, visible rate basis, reciprocal conversion and both-field edits, conditional rendering and PDF image bounds. |
| Accessibility and interaction | Read new dialog focus/keyboard handling, busy actions, focus restoration, wrapped paths and scroll regions. Physical Windows readability/scaling remains pending external evidence. |
| Type/process boundaries | Traced named preload contracts, exact trusted main-frame checks, shared metadata validation and supervised parser messages. The financial relational-validation defect is CR-03. |

## Verification limits

Supporting review executions were disposable targeted reproductions of CR-02, CR-03 and CR-04 plus the independent old/new geometry calculation for CR-01. Existing regression/typecheck/build results were read as context; the reported 149-file/1163-test run was not rerun or treated as proof against these findings. No broad performance or whole-application security certification is claimed. Fixes should add the missing negative controls, rerun the affected suites, and rebuild/rebind candidate evidence when application bytes change.

---

_Reviewer: gsd-code-reviewer_  
_Depth: standard_
