---
phase: 20-production-readiness
status: partial
date: 2026-10-22
tester: Codex, agent-driven Windows Computer Use explicitly authorized by user
machine_classification: development
external_acceptance: pending
---

# Phase 20 Installed Manual Test

The core takeoff, pricing, export, protected-save and saved-work recovery walkthrough passed on the development PC. Manual testing found two reproducible defects: measurement tool switching (801a532) and focus after native library-picker cancellation (e61ae4a). Both are fixed and natively verified. This report does not accept the phase or its target-PC matrix.

## Provenance

- Windows10.0.26100 x64, Lenovo-X390-PC1H2FSA,15.75GiB RAM; renderer process reported device-scale-factor1. No physical scaling setting was changed or accepted.
- Actual per-user NSIS installation at2026-10-22T15:58:11+08, exit0; zero prior CLMC uninstall registrations on this PC, one registration afterward:1c30aa9b-6d24-50bf-8469-d032f8038b7f, version1.1.0.
- Executable:`C:\Users\Admin\AppData\Local\Programs\clmc-takeoff\clmc-takeoff.exe`. All149 installed payload files matched the inspected manifest by hash/size before launch.
- Core walkthrough source801a532; installer SHA256`3f9f6fd3f1057a1dfb6603c50423ca3914626f67a5f1be814117dcf80959431d`; ASAR`eefb415a719400b064372a9e9e7a25f6c0017e4d82af02fe9070d7eafc09e5eb`; Electron44.9.3. The final focus-repair candidate is recorded separately below; these historical observations retain their original hash.
- Manual input used only the Windows Computer Use skill's supported `@oai/sky` API. Native dialogs, actual pointer placement and accessibility controls were used; no hidden renderer state injection was used for these observations.
- Raw installation records, screenshots, generated fixtures and independent readback are in`.planning/tmp/20-manual-run/`. Compact retained facts are in20-MANUAL-EVIDENCE.json. Existing local library/preferences were copied to owned before-* evidence files before installation. No human project was edited.

## Known Fixture and Oracle

Generated300×300pt vector PDF:`manual-grid.pdf`, SHA256`9c0bc7b6f133905fc62b7dff8abec2e78c0beb078f3ddcdddb57c157ed025e10`. The square spans PDF50..250 on both axes, with10×10 grid and independently specified10m edges,100m² area and40m perimeter. A10m wall with3000mm height is30m². Calibration, length and first area were created in the initial native run; fixed-candidate retest reused those retained two correct markups and natively created another100m² area,40m perimeter,30m² wall and1count with snapping on.

| Item | Quantity | Material | Labor | Cost |30% selling total |
|---|---:|---:|---:|---:|---:|
| Grid length |10m|10|5|150|195|
| Grid area |100m²|2|1|300|390|
| Retest area |100m²|0|0|0|0|
| Grid perimeter |40m|1|0|40|52|
| Grid wall |30m²|4|1|150|195|
| Grid count |1ea|100|0|100|130|
| Total ||||740|962|

Margin222. Inputs commit on blur; numbers displayed before blur were not treated as committed results. Independent readback uses Euclidean length, shoelace area, height multiplication and arithmetic, importing no application aggregator/serializer. Six rows and monetary totals were checked independently in both ExcelJS workbook readback and the fixture's unambiguous CSV rows.

## Actual Observations

| Check | Actual observation | Scope/result |
|---|---|---|
| Tool semantics | Initial Area→Perimeter produced area in real archive despite active Perimeter label. Exact guard regression reproduced21 failures.801a532 removes the idle-only restriction; installed retest persisted typeperimeter and40m, plus correct wall/count metadata. | Fixed/pass; debugphase20-tool-type |
| Native Estimate | All quantities and manually entered rate bases yielded740cost/962selling/222margin. | Pass |
| Internal XLSX/CSV | Actual Export native pickers wrote`manual-final-BOQ.xlsx` and`.csv`. Independent readback matches all six rows and totals. | Pass; internal audience only |
| Save As | Actual native Save As created`manual-final.clmc`, clean title. Archive has onlyproject.json+plan.pdf; format3/minReader3, canonical coordinate basis and reviewed m/m²/ea rate bases. | Pass |
| Zoom |93%→100% retained aligned grid outlines/pin positions and quantities. Reopen auto-fit at the changed window size showed90%, retained geometry/quantities, and marked viewport changes dirty. | Pass for observed local zoom; no physical DPI acceptance |
| Last-good backup | After zoom, actual Save replaced the disposable project and created adjacent`.bak` with exactly the prior archive SHA2562d293adc8b5324a18d4741fc6e93154c0dde5e8b2601eceef713a2e0ca9c91ac. | Pass for successful replacement |
| Periodic recovery | Added a second Grid count pin without saving. Dirty title remained; actual completed revision17 recovery manifest included7markups, PDF hash, rates and source path. Saved project SHA25661bba63586305d482fed7b4671865d7a56975d3b51135ec6328b4e3ca6c26e39 and backup remained unchanged. | Pass |
| Controlled interruption | Verified the exact installed root process path/PID88096 and child processes, then terminated only that disposable app tree. Restart through actual installed executable offered4:13:35recovery versus4:12:50last save. | Pass, development host only |
| Keep/restore | Keep for Later closed the prompt; More→Recover Unsaved Work reopened it. Recover restored PDF, all geometry/rates and2counts, dirty title; Estimate840cost/1092selling/252margin. Original and backup hashes stayed unchanged. | Pass |
| Explicit recovered save | Native Save As wrote`manual-recovered.clmc`, SHA2564eea63bbc4eb479ff49a8699ee93e0eb3381d86f496aaaabbad5f85e99b2afbd. Matching recovery retired; no recovery JSON remained. | Pass |
| Reopen transition | Opened bare PDF:0markups/no scale. Saved it separately. Opened only the copied`.clmc` fromportable-only/ containing no PDF: embedded plan,6markups/1count, geometry, scale and962selling returned. | Pass for local document transition; not another-PC/source-unavailability acceptance |
| Library cancel | Existing library loaded2entries. Cancelled native import picker; explicit unchanged message and byte-identical339-byte library SHA25675b6ffc06827b76b17d86fae10e0969430e20d5dc6cc12c864698e152c17df60. | Data preservation pass |
| Library application | Compatible E001ea200material+80labor applied to Grid count; incompatiblem²entry displayedNeeds ea. Name and30% markup retained; count364selling, overall920cost/1196selling/276margin. Saved only the disposable portable copy. Library bytes unchanged. | Pass |
| About | Main-suppliedVersion1.1.0/local notes, manual updates, compatibility and recovery instructions displayed. Scroll reached lower content; Escape dismissed About and restored visible More focus. | Pass for observed local states |
| Native library return focus | After native import cancellation, second Escape left idle library open; fresh capture confirmed. Earlier count-placement run also changed underlying tool toSelect. Visible Close worked. | Fixed/pass on final candidate; debugphase20-library-focus |

Initial cancelled snap-on area input had a displaced second point. It was cancelled without saving; later snap-on area/perimeter matched all four corners. It was not repeat-confirmed or attributed to product versus automation; no independent defect or snap-performance claim is inferred.

## Final Candidate Retest

Final source e61ae4a; installer SHA256`d3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180`,136810369bytes; ASAR`cf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45`. NSIS refresh retained one registration and unchanged339-byte library; all149payload files matched. Full157files/1228tests passed420.92sec; build/typechecks, actual package inspection and measured packaged smoke passed.

After the user's resume instruction, native picker cancellation→Escape passed in both an empty workspace and a workspace with Count placement armed. The library closed, its invoker regained visible focus, and Count/Grid count remained armed. Final project reopen showed all retained quantities and740/962/222prices. Native Save As wrotefinal-native-checked.clmc (SHA256c8a466c0886ad40fb792771646b7d64f8dd7af6da26909a665ffdfa291d156cb); real ZIP readback confirms exact geometry/scale/rates/category order/PDF match to the original. The original project, its backup and local library stayed byte-identical. The saved test app was closed cleanly. Screenshotsfinal-library-escape-fixed.png,final-library-count-preserved.png,final-estimate-962.png andfinal-native-save-962.png retain the visible observations.

## Limits and Remaining Acceptance

No actual non-development PC, deployed predecessor installer, representative historical/large/scanned/multipage construction PDF or second physical monitor was available. No100/125/150/200% hardware matrix, target upgrade/rollback, real-user pilot, twelve-PC rollout, named organizational review or license/signing/share approval is claimed.

Local groups1/2/4 have observed passing subcases, with full edge/long-content/keyboard/failure/never-saved/destructive-discard coverage still pending wherever not explicitly observed. Automated filesystem fault matrices and real parser supervision are separate supporting evidence. Four edge reviews and three explicit narrative prohibition dispositions remain unresolved; agent observations do not become a human approval.

Phase20 remains in verification;20-09task03 andREL-01..05 remain pending. Phase21 retains the real-user two-PC pilot and remaining-ten distribution boundary.
