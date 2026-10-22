---
phase: 20-production-readiness
fixed_at: 2026-10-22T04:08:47Z
review_path: .planning/phases/20-production-readiness/20-REVIEW.md
iteration: 2
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 20: Code Review Fix Report

**Fixed at:** 2026-10-22T04:08:47Z  
**Source review:** `.planning/phases/20-production-readiness/20-REVIEW.md` (initial review 70096c5; automatic iteration-2 review of source 83527d2)  
**Iteration:** 2, cumulative

**Summary:** 8 cumulative findings in scope; 8 fixed; 0 skipped. Eleven narrow implementation/regression commits cover eight findings; CR-01, CR-03 and WR-01 have explicit verification refinements. This report is intentionally uncommitted for the orchestrator. The six original dispositions remain recorded below; iteration 2 adds CR-05 and WR-03.

## Fixed Issues

### CR-01: Existing clamped-page projects reopen in a different coordinate space

**Status:** fixed: requires human verification  
**Files modified:** `src/renderer/src/lib/project-schema.ts`, `src/shared/project-validation.ts`, `src/renderer/src/lib/project-serialize.ts`, `src/renderer/src/stores/projectStore.ts`, `src/renderer/src/hooks/useProject.ts`, `src/renderer/src/hooks/useExport.ts`, `src/renderer/src/components/LegacyGeometryReview.tsx`, `src/renderer/src/App.tsx`, `src/tests/legacy-geometry-review.test.ts`, `src/tests/project-compatibility-ui.test.ts`, `src/tests/use-export-hook.test.ts`  
**Commits:** 20ee222; 0297d9b  
**Applied fix:** New snapshots persist an explicit per-page `pdf-base-scale-2` coordinate basis. Pages with unrecorded/unverified basis and any geometry/calibration enter a persistent visible review state; no historical DPI or dimensions are inferred. Raw points are retained, old calibration is cleared, export is blocked, and measured pages require a new scale before explicit per-page confirmation. The banner directs users to check every count/vertex/curved edge against PDF landmarks and move/redraw displaced geometry. Review state survives snapshots/recovery; blank older pages remain usable without unnecessary review. Legacy sources, including older format-3 files, remain protected by Save Copy even after verification. Unknown basis markers fail admission.

**Regression evidence:** The synthetic historical clamped-stage case (7000.25 PDF units; DPR 2; old stage width 8192; raw x=4096 pin) first failed because no quarantine/basis existed. It now preserves raw coordinates without guessing and discards untrusted calibration. Explicit verified repositioning to the canonical 14000.5-unit span plus recalibration yields 10 m / 100 m² oracle results and survives reopen. This is a faithful persisted geometry reproduction, not a claim of physical old-runtime/monitor acceptance. Further red/green coverage proves old format-3 Save Copy preserves original bytes; the real export hook rejects pending review before any save dialog or uncalibrated-export override. Human verification must inspect actual existing projects and the new review flow before rollout.

### CR-02: Future archives with additional entries are silently overwritten without a backup

**Status:** fixed: requires human verification  
**Files modified:** `src/main/project-io.ts`, `src/main/project-storage.ts`, `src/tests/future-destination-preservation.test.ts`, `src/tests/atomic-write.test.ts`  
**Commit:** 71ee666  
**Applied fix:** A separate lazy ZIP metadata reader bounds metadata bytes/entry count, checks integrity, rejects duplicate/encrypted/unsupported version metadata and inspects version before current two-member admission. Unclassifiable versions/layouts now fail closed. An existing corrupt/unclassifiable destination requires another Save As destination; neither original nor last-good backup is implicitly repair-authorized. Known current archives still use the existing protected transaction.

**Regression evidence:** Valid replacements previously overwrote all three extra-member/changed-layout/ambiguous-floor controls. Four final preservation cases now retain identical original bytes and create no backup/replacement. Existing atomic fault tests were updated to the intentional fail-closed corrupt-destination policy. 21 preservation/atomic tests and 41 compatibility/archive/save-UI tests passed.

### CR-03: Admitted category orders can double or omit estimate totals

**Status:** fixed: requires human verification  
**Files modified:** `src/shared/project-validation.ts`, `src/renderer/src/lib/boq-aggregator.ts`, `src/tests/category-financial-integrity.test.ts`, `src/tests/recovery-flow.test.ts`, `src/tests/project-store.test.ts`  
**Commits:** 7ee1705; 83527d2  
**Applied fix:** Admission requires category-order uniqueness/known IDs and every nonempty markup category to exist and appear in the order. Malformed legacy inputs are rejected without store adoption rather than silently dropping financial buckets. Aggregation defensively deduplicates order and appends every actual bucket once. Corrected an invalid existing recovery test fixture to use the application's actual empty uncategorized ID rather than the order-map sentinel.

**Regression evidence:** Seven genuine failing controls reproduced accepted duplicate/omitted/dangling categories and totals of 260/0 instead of 130. All now pass; 64 affected aggregation/schema/serialization tests and full typecheck passed. The first broad run additionally exposed an old dirty-hydration fixture with a dangling category; repaired the fixture's category definition/order, without relaxing admission, and its 13 project-store tests passed.

### CR-04: Interrupted recovery blobs can permanently prevent subsequent recovery writes

**Status:** fixed: requires human verification  
**Files modified:** `src/main/project-recovery.ts`, `src/tests/recovery-repository.test.ts`  
**Commit:** 8db7efd  
**Applied fix:** Under the repository queue, reconcile owned unreferenced blobs/UUID stages before quota charging and on startup/list. Final cleanup also removes blobs left by ordinary failed manifest transactions. Completed manifests and kept work are never evicted. Any unreadable completed manifest prevents blob deletion because its references cannot be safely disproved. Unknown files/directories/links are not recursively removed.

**Regression evidence:** Repeated manifest-rename failures and restart orphan/stage cases first reproduced the quota deadlock. Subsequent valid writes now succeed without manual cleanup. A corrupt-manifest control preserves all possibly referenced blobs and completed good work. 31 repository/recovery-flow tests passed.

### WR-01: Packaged smoke copies candidate hashes without verifying the launched candidate

**Status:** fixed: requires human verification  
**Files modified:** `scripts/smoke-packaged.cjs`, `src/tests/smoke-candidate-identity.test.ts`  
**Commits:** d9473fa; ab32b49  
**Applied fix:** Before launch, resolve the actual executable directory, require its exact manifest inventory and measure every executable/resource/unpacked file plus installer size/hash. Reject links/unsafe paths and mismatches. Match observed executable/app ASAR paths and exact Electron runtime to the inspected candidate. Re-measure after execution and emit the measured identities instead of copying unverified manifest hashes.

**Regression evidence:** Alternate-directory executable, ASAR, unpacked worker, installer and Electron mismatch controls pass. Byte substitutions deliberately preserve size and manifest version so the negative controls exercise hashing rather than merely size checks. 16 identity/evidence tests passed; final five same-size cases passed. Packaged smoke itself was not rerun against a stale installer.

### WR-02: Smoke reopening assertions are already true before reopening

**Status:** fixed: requires human verification  
**Files modified:** `scripts/smoke-packaged.cjs`, `scripts/smoke-electron-host.cjs`, `scripts/smoke-reopen.cjs`, `src/tests/smoke-reopen-transition.test.ts`  
**Commit:** d27e4d8  
**Applied fix:** Both harnesses use the same real UI transition proof. Seed distinctive persisted markup/scale/rates through the production archive writer, open and save a different red PDF, assert the target condition is false, then open the saved blue PDF. Require its rendered pixels, project title, markup row, material/labor/markup values and 187.20 computed total, without an error/decision modal. A fresh UI Save As to a previously nonexistent proof file verifies the adopted renderer PDF bytes, geometry, calibration, categories and rates. Emit reopen success only after that proof. Added `CLMC_SMOKE_FAIL_REOPEN=1` to inject an actual read/open error through the main IPC test seam.

**Regression evidence:** Both original harnesses failed the shared-transition wiring requirement; predicate controls reject an already-correct saved title, error modal and wrong scale/rate total. Current rebuilt hidden Electron host positive smoke passed with all three transition/readback flags. Actual injected read failure produced the renderer Open Error dialog and process exit 1. Eight harness unit tests passed. This developer-host result does not certify an installer or non-development PC.

### CR-05: Another app instance can prune a successfully committed recovery PDF

**Status:** fixed: requires human verification  
**Files modified:** `src/main/index.ts`, `src/tests/identity-storage.test.ts`, `src/tests/host-security.test.ts`, `src/tests/app-version.test.ts`, `src/tests/single-instance-bootstrap.test.ts`, `scripts/smoke-single-instance.cjs`  
**Commit:** 7729196  
**Applied fix:** Pin the established userData identity, then acquire Electron's cross-process single-instance lock before ready, IPC registration, window creation or shared storage initialization. A contender exits immediately. A second-launch event restores/shows/focuses the existing window and retains the normal renderer close guard; launch arguments never replace the active document. Early activation is remembered until the window is ready. Orphan reconciliation, quota admission and conservative unreadable-manifest handling remain intact under the sole storage owner.

**Regression evidence:** The new real two-Electron-process regression paused the production owner immediately before manifest publication and launched a contender using the same pinned storage. Before the fix it failed because the contender initialized shared storage/window while the owner had an unpublished blob. After the fix it reports `acknowledged:true`, `readable:true`, `activations:1`, `focuses:1`, `restores:1`, `contenderInitialized:false`; the contender's measured lock result is false. The production owner's trusted recovery write/read handlers run against real files. Unit coverage additionally proves a denied lock exits before ready/window/IPC/storage registration and activation does not bypass unsaved-work close protection. Existing 31 host/identity/recovery tests passed, plus five bootstrap/activation tests. The native regression is reproducible with `node scripts/smoke-single-instance.cjs` after building current output.

### WR-03: The legacy geometry review can consume the entire plan viewport

**Status:** fixed: requires human verification  
**Files modified:** `src/renderer/src/components/LegacyGeometryReview.tsx`, `scripts/smoke-geometry-layout.cjs`, `src/tests/helpers/geometry-layout-entry.tsx`, `src/tests/geometry-review-layout.test.ts`  
**Commit:** 38cb5d2  
**Applied fix:** Replace the full page list and wrapping per-page buttons with a compact count, native validated page-number input, Go, Next Unverified, and current-page confirmation. DOM/control count is constant regardless of flagged pages. Instructions use a disclosure inside a 25-dvh bounded scroll region; the control row remains sticky. Confirmation still requires recalibration for measured pages, retains an explicit accessible verification label, and obeys the busy guard.

**Regression evidence:** The actual production component and stores are bundled from current source and mounted in hidden Chromium in the fixed-height/hidden-overflow shell. The original 150-page banner measured 849 CSS pixels, zero canvas height, and 151 buttons at 1024×600. The fixed component measures 67 pixels/three buttons, leaving canvas heights 371 at 1024×600 and 171 at 1024×400. Expanded instructions cap the banner at 150/100 pixels, leaving canvas heights 288/138. Actual Tab/Return navigates to page 150 and confirms it, and the current-page control stays reachable after scrolling expanded instructions. This native DOM/keyboard regression is included in Vitest and can run independently as `node scripts/smoke-geometry-layout.cjs`. It is not physical-monitor/installed-PC acceptance evidence.

## Verification and Environment

- All reads/edits/commits and gates ran in the **main checkout**. The parent explicitly confirmed the canonical workflow had degraded isolation to none and requested no branch changes; no competing implementation writer, temporary branch, worktree or recovery sentinel was created. Parent-owned STATE and untracked AGENTS/runtime caches were not staged.
- Each modified section was reread before its per-finding commit; Node harness syntax checks and TypeScript checks passed. Final `npm run build` passed on the exact final source tree, including both Node/web typechecks. The actual hidden host positive transition/readback smoke passed again against that refreshed output. The narrow format-3 Save Copy polish separately passed renderer typecheck and 23 targeted tests.
- **Iteration-2 final stable-tree regression: 156 files / 1193 tests passed, exit 0, 309.06 seconds**, at source HEAD 38cb5d2, using `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot`. This includes the actual Chromium component layout/keyboard test. Iteration 1 passed 154 files / 1190 tests in 307.13 seconds at source 83527d2 after correcting its one invalid category fixture.
- Iteration-2 final `npm run build` and both Node/web typechecks passed. Actual hidden-host positive reopen/readback passed; the injected real read/open error still produced the renderer error dialog and exit 1. The final two-Electron-process publication/ownership regression passed again. All iteration-2 implementation/new-test files pass scoped lint. No installer was rebuilt.
- Scoped lint for all changed implementation files and new regression files passes after fixing the introduced apostrophe/return annotations. Expanded lint over two modified pre-existing test files reports unchanged missing-return-type errors at the existing `Host` and `TC` helpers; `git show 70096c5` confirms both predate these fixes. Existing CanvasViewport lint debt is unchanged. No broad formatting sweep was made.
- Vite test discovery initially hit sandbox realpath EPERM; the exact focused command succeeded with authorized scoped host execution. Git commits, typecheck/build, actual hidden Electron positive/negative checks and full regression used that authorized environment. No discovery error was counted as a behavior regression.

## Remaining Release Evidence

**The `dist` candidate/manifest/packaged-smoke evidence is stale relative to these product changes.** Rebuild the installer, inspect its actual payload and rebind packaged/installed evidence before claiming candidate verification. Parent owns that work and independent re-review. Neither the existing installer hashes nor the current developer-host smoke prove these fixes are installed on a non-development PC. Physical DPI transitions, real historical project/geometry review, interrupted-save/recovery observations, deployed upgrade and Phase 21 acceptance remain external gates. This report does not advance STATE/ROADMAP/requirements or mark the phase complete.

---

_Fixer: gsd-code-fixer_  
_Iteration: 2, cumulative_
