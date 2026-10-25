# Phase 20 — repaired 1.1.1 build and second-PC retest

The hidden-canvas negative-fit defect is **fixed and verified in the installed 1.1.1 candidate** on LAPTOP-5BAM24NM. The original open-from-Estimate triggers now produce positive zoom at physical Windows100/125/150%; first Save As, periodic recovery, restart/restore and separate recovered save succeed. Phase20 remains **VERIFYING**: targeted regression passes do not accept the full release matrix or Phase21 rollout.

**26 October continuation:** [20-CLOSEOUT.md](20-CLOSEOUT.md) records two complete passes (fresh installation and never-saved recovery), native backup/replacement fault/retry/detached-copy checks, clean-profile library safeguards and public-PDF rendering/save/reopen. The canonical record now has **2 pass / 14 pending**, with user identified as release owner. All 3191 original profile files were restored exactly after fresh-profile testing. The all-pending descriptions below record the preceding retest, before this continuation; they are not the current case totals.

The user explicitly authorized rebuilding, installing and driving this PC for retesting. This continues20-09-03 and the existing debug workflow inline; `gsd-sdk` is unavailable on this host. No permission/security setting, real project or other PC was changed.

## Exact candidate and preservation

| Item | Observed value |
|---|---|
| Version / runtime |1.1.1 / Electron44.9.3, Windows x64 |
| Installer |`dist/clmc-takeoff-1.1.1-x64-setup.exe`,136810484bytes |
| Installer SHA-256 |`f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e` |
| Installed ASAR SHA-256 |`b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98` |
| Inspection |Pass: version/PE/resources/production dependency closure and installer/unpacked identity;108 production dependencies. Actual signatures remain NotSigned. |
| Installation |Per-user silent upgrade exited0;149 payload files match manifest; one1.1.1 registration, one desktop shortcut and one Start-menu shortcut. |
| Existing profile |3191 files backed up and hash-verified; all3191 remained byte-identical immediately after installation, before native launch. Local library remained absent. |
| Machine |LAPTOP-5BAM24NM, Windows11 Home Single Language22631 x64,15.8GiB; physically distinct from original Lenovo development PC. Candidate was rebuilt locally here. |

The exact1.1.0 installer remains in `dist/trial-kit/installer/`. Its protected20-file kit still verifies. **That kit remains historical1.1.0; it was not silently replaced with1.1.1.** The prior four-pass/three-fail/nine-pending record is preserved in [20-1.1.0-INSTALLED-EVIDENCE.json](20-1.1.0-INSTALLED-EVIDENCE.json) and the [original report](20-SECOND-PC-TEST.md). The observed1.1.0→1.1.1 upgrade is a synthetic test-install upgrade, not actual deployed predecessor history.

## Build and automated verification

The change defers initial and explicit Fit until page/container dimensions are finite and usable, so a hidden canvas cannot consume the default viewport and persist a negative fit. Valid padding/centering calculations are retained. Package, lock root metadata and local notes advance together to1.1.1; no dependency versions changed in the lockfile.

Restored exact locked dependencies with `npm ci --ignore-scripts`, explicitly installed approved Electron44.9.3, then ran the existing project postinstall. Actual yauzl3.4.0 is now installed; no diagnostic alias is used. Both TypeScript projects pass, and the production Windows build succeeds.

All **1238 tests across158 files pass** with `NODE_OPTIONS=--no-experimental-webstorage` inherited by Vitest workers. The initial normal run and CLI-flag-only retry each had43 `window.localStorage.clear is not a function` failures under host Node25.3.0; those outputs are preserved. No assertions or timeouts were relaxed. The initial sandboxed launch also failed on esbuild parent-directory access; the authorized outside-sandbox run resolved that restriction. This is a qualified passing test run, not a clean default-command claim.

Packaging initially failed when native app-builder tried to extract unused macOS symlinks without Windows symlink privileges. An RCEdit-path override alone did not fix its native extraction. A workspace-local builder cache was then prepared from the same official downloaded archive, excluding only `darwin/`; native app-builder resolved it and the full NSIS build succeeded. No tool package/source patch or Windows privilege change was made. Logs/provenance preserve all attempts.

Targeted ESLint remains failing with15 pre-existing CanvasViewport errors; the helper/test have no errors. Prior baseline comparison recorded matching rules, headlines and offending source lines. No broad formatting sweep or clean-lint claim. Whitespace checks pass.

`verify-release.cjs dist` passes. The repository's isolated packaged smoke passes actual Electron44.9.3 identity, preload/sandbox, real PDF worker/render, save/reopen, library worker import and internal exports, with no observed external requests and disposable app data. Its hardcoded `scripted-packaged-developer-host` classification is retained separately from the native installed observations below.

## Native installed retests

Raw artifact paths below are relative to `.planning/tmp/20-rebuild-20261025/`.

| Check | Expected / actual | Evidence |
|---|---|---|
| Format3 open from Estimate,100% |Previously−7% and failed recovery/save. Now142% positive fit, aligned PDF/markups, quantities10/100/100/40/30/1. Immediate new Save As succeeds without Ctrl+0. |`011-estimate-before-reopen100.json`, `015-positive-fit-after-estimate100.json`, `019-fixed-first-save-success.json` |
| Same trigger,125% |Actual Windows125% selected at1920×1080. New open fits90%, retains six quantities and saves a separate copy normally. |`038-windows125-applied.json`, `042-positive-fit125.json`, `046-saved125.json` |
| Original legacy trigger,150% |Actual Windows150%. Open synthetic format2 from Estimate now fits72%, rather than−7%. Review shows m/m²/m/m²/ea and correct rates; export is gated until acknowledgement. Separate upgraded format3 copy saves without Fit workaround; original legacy bytes stay unchanged. |`049-windows150-applied.json`, `055-positive-legacy-fit150.json`, `056-legacy-export-rate-guard150.json`, `059-legacy-save-copy-guard111.json`, `063-upgraded-copy-saved150.json` |
| Saved recovery after repaired open |Saved baseline rate100, unsaved107. Completed revision2 at **20:31:50 Manila on2026-10-25**, positive zoom1.42 and embedded PDF hash verified before interrupting only main PID26828/window656448. Restart offers correct source/time; restore returns dirty, six quantities and747/971.10/224.10. Separate recovered copy saves; original unchanged and no original backup created. |`saved-recovery-exact.json`, `saved-recovery-interruption.json`, `028-recovery-offer111.json`, `030-recovered-plan-positive.json`, `031-recovered-prices107.json`, `035-recovered-copy-saved.json`, `recovery-preservation.json` |
| Zoom/Fit/replacement save |Zoom75% and explicit Fit81% remain positive with aligned synthetic markups/unchanged quantities. Replacement save succeeds; adjacent backup is the exact preceding project SHA. Wheel attempt did not visibly pan, so no pan pass is recorded. |`065-zoom150.json`, `066-pan150.json`, `067-explicit-fit150.json`, `068-viewport-replacement-save150.json`, `replacement-backup111.json` |
| Native XLSX and CSV exports |Both actual installed exports independently read back: all six quantities, row costs/selling/margins and grand totals740/962/222 match explicit arithmetic. Network stayed connected. |`072-native-xlsx-written.json`, `081-native-csv-written.json`, `retest-111.xlsx`, `retest-111.csv`, `exports-readback.json` |
| About/local notes at150% |Version1.1.1 and bundled fix note agree. Long content scrolls with Close visible; Escape closes and returns focus outline to More. |`083-about-version-notes111.json`, `084-about-scroll-actions150.json`, `085-about-escape-focus-return.json` |
| Independent saved-project readback |Five actual saved projects pass ZIP CRC, embedded PDF SHA, exact geometry/calibration/order/visibility/rates and independent Euclidean/shoelace/wall/money arithmetic. Positive viewports verified. |`readback.cjs`, `independent-readback.json` |

Recovery refit to a positive93% after restart rather than retaining captured142%; exact viewport restoration is not claimed. Measurement geometry/calibration/rates remain exact. Full-case statuses and qualifications are in [20-INSTALLED-EVIDENCE.json](20-INSTALLED-EVIDENCE.json). **No full required case is automatically carried forward from1.1.0 to new bytes.** Eight scoped regression checks pass; all16 complete case definitions remain pending their remaining1.1.1 evidence. No recurrence of the repaired defect was observed in this retest.

## Remaining acceptance and final state

Still required: fresh1.1.1 installation; actual deployed predecessor or reviewed disposition; wider portability/mixed-scale/arc variants; repeat remaining recovery/save/UI permutations; actual disconnected full workflow; approved representative vector/scan/multipage plans; full calibration/independent landmark/pan/reopen display matrix; monitor transition; named release/signing/share/dependency/stability and REL edge reviews. The user has no representative plans. Physical dropdown offers100/125/150/175%, without200%; no unsupported exception is silently accepted.

Active display scaling was restored to its original **100%**,1920×1080. The user's **Show only on2** topology was retained. Settings and the clean saved CLMC session were closed normally. CLMC1.1.1 remains installed, the local library remains absent, fixtures are byte-identical and the installed ASAR still matches. Original1.1.0 installer/results, pre-upgrade private profile backup, new disposable projects/backup/recovery capture and exports are preserved. Nothing was distributed to other PCs.

The raw folder is ignored by Git. Preserve evidence separately for return to the development PC; exclude private `preupgrade-appdata/` and build/download caches from routine result sharing. Its final `EVIDENCE-FILES.json` indexes evidence separately from those private/cache folders. Phase20 release acceptance and Phase21 pilot/distribution remain open.
