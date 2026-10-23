---
phase: 20-production-readiness
status: local_scope_complete
date: 2026-10-23
scope: installed-development-host-only
external_acceptance: pending
---

# Additional installed manual checks

Resumed under Phase 20 execution plan 09 after explicit user authorization to drive remaining local checks. Existing source candidate e61ae4a / installer d3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180 was installed at the start. Source fix 9a0349f and replacement candidate are being verified; observations below must retain their actual candidate scope. No second-PC, deployed-predecessor, physical display or real-estimator acceptance is inferred.

Evidence folder: `.planning/tmp/20-manual-edges-20261023`. Synthetic fixtures only; original user library and previous manual project/backup recorded before the run. The existing wrapped-line edit in 20-MANUAL-TEST.md was present before this work and is preserved.

| Case | Actual observation | Result / scope |
|---|---|---|
| Never-saved capture | Opened copied PDF, natively calibrated 10 m, placed one Unsaved recovery count, set material100/labor0/markup30. Actual revision6 capture sourcePath=null / lastSavedAt=null with PDF, scale, markup and reviewed ea rate. | Pass on e61 candidate |
| Never-saved interruption | Verified installed root PID92760/path and only its three children; interrupted that disposable tree. Renamed copied PDF to source-unavailable.fixture; original path absent. Restart offered “Not yet saved as a project”, timestamp10:07:58. Recover restored PDF/count/scale dirty. | Pass on e61 candidate |
| First recovered Save | Save opened native Save As, wrote never-saved-recovered.clmc SHA2565e52dc130bf693ded2f523c0a1ef1a87e75b3177a8d0a069e108e7338e4f819c, clean title. Independent ZIP CRC/PDF hash/readback: 1count,100cost/130selling/30margin, m calibration; matching recovery retired. | Pass on e61 candidate |
| Backup lock failure | Saved a new revision to establish valid backup, then locked only that disposable backup with FileShare.Read and changed zoom. Actual save stopped with backup-preservation rename EPERM; dirty work retained. Both primary and last-good hashes unchanged. | Pass on e61 candidate |
| Failure cancel/retry | Save As from failure opened native dialog; Escape canceled it and persistent original error/dirty state remained. After lock released, Try Again saved same destination, cleared dirty/error and retained valid backup. | Pass on e61 candidate |
| Detached backup | Opened .clmc.bak through native Open; loaded PDF/count/scale dirty and detached. Save required a native Save As with offered “-copy” suffix. Saved never-saved-source-copy.clmc; primary/backup hashes unchanged. | Pass on e61 candidate |
| Invalid import | Native CSV picker loaded negative material/duplicate code/unsupported unit fixture. All three precise row/column errors displayed, nothing replaced. | Pass on e61 candidate |
| Retry valid preview | Retried valid ea10+5 CSV: actual 1-row preview and replacement warning. Cancel Import restored original two library entries. No replacement performed. | Data preservation pass |
| Preview cancel focus | Focused Cancel Import button is removed; next Escape leaves modal open and changes armed Count to Select. Fresh capture confirmed. | Defect; fix9a0349f under verification |

## Corrected candidate and further observations

Source **9a0349f** fixes the preview transition with the same guarded focus-repair effect, adding preview to its dependencies. One new UI regression failed before the fix and passed afterwards. Four related files /38tests passed36.94sec. Scoped source/test lint finished with0errors/0warnings after formatting the new regression. The parser-harness assertion was also enhanced to report the actual failure result; expected behavior and deadlines were not changed.

New full offline installer SHA256 **fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544**, **136810568bytes**; ASAR **5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd**. Build/both typechecks, actual release inspection and measured packaged smoke passed. The installer refreshed the same local trial installation; all149installed files matched the new manifest. This is a development-host same-version candidate refresh, not an actual deployed-predecessor upgrade.

| Additional native case | Actual result |
|---|---|
| Legacy safeguards (e61 candidate) | Synthetic format2 opened with raw geometry retained, calibration cleared, export blocked and rate review warning. Confirm Rate Units was disabled in accessibility state until acknowledgement. Cancel retained unresolved state. Save required Save Upgraded Copy/native distinct destination. Original SHA2560c8d6d50072382276f7bc21670241d9395d5e8fbd300adee091b7430ad2c4efa unchanged; upgraded format3/minReader3 retained legacy-unverified geometry, null scale and5legacy-unresolved rates. No unverified acknowledgement was made. |
| Preview cancel focus (new fe8 candidate) | With Count/Unsaved recovery count armed, valid preview→Cancel Import→Escape closed the library, visibly returned focus to Cost Library and retained Count and100cost/130selling/30margin. Fresh captures confirmed. |
| Corrupt XLSX (new candidate) | Native picker loaded26-byte nonarchive fixture; parser error explained retry, original two library entries retained. |
| Oversized CSV (new candidate) |10MiB-plus fixture rejected with import-limit message; original library retained, retry enabled. |
|10001-row CSV (new candidate) | Rejected with at-most10000rows guidance; original library retained, Escape closed modal and preserved Count. |
| Final native Save As (new candidate) |corrected-native-checked.clmc SHA256699c15cb052bd898c16fee1eea20adcecc20011f4166ea4e7ac5b3d71684ccdb. Independent ZIP/PDF/geometry/scale/rates/order readback matches prior disposable project,1count/100cost/130selling/30margin. Clean title; matching recovery retired; app closed cleanly and no CLMC window remained. |

## Regression qualification

The initial full run at9a0349f was **not clean**:157files,1229tests;153files/1225tests passed and4tests failed,806.37sec, while packaging was also active. Two tests hit the default5sec cap, the version test observed pending async state after its fixed50ms wait, and the real parser-process harness failed. Running those four files alone passed three files/37tests with the parser case still failing (68.49sec). A final parser-only run passed both tests (17.85sec), including actual max-workbook/timeout/reaping scenarios. Every test file therefore has a passing result across the full and isolated runs; no single all-green full run is claimed. Parser behavior was intermittent and its load attribution is an inference. Keep this stability limitation visible for release review; no timeout or success assertion was relaxed to obtain a pass.

Raw logs:20-preview-focus-full.log,20-preview-focus-isolated-recheck.log,20-preview-focus-worker-diagnostic.log,20-preview-focus-red.log,20-preview-focus-green.log,20-preview-focus-build-win.log,20-preview-focus-inspection.log and20-preview-focus-packaged-smoke.log in `.planning/tmp`.

The trial kit was refreshed to the new exact installer/manifest. The previous kit and candidate were retained separately. Original pre-run rate library, manual-final.clmc and its backup remain byte-identical.

Destructive discard and valuable-library replacement were not silently exercised. First-save/disk/power failures beyond the observed disposable backup lock, complete long-content/keyboard permutations, legacy review completion on real historical drawings, representative PDF performance and physical hardware/target-PC acceptance remain unobserved where not explicitly recorded. Target evidence, named owners/reviews and Phase21 pilot/distribution remain pending. No requirement or acceptance count is advanced by these local subcases.
