# Phase 20 second-PC continuation — 26 October 2026

<!-- current-1.1.5-start -->

## Current candidate — 1.1.5

Exact 1.1.5 has **2 complete cases passed, 12 pending, 0 failed, one first-release case not applicable and one reviewed hardware limitation (200%)**. Phase 20 remains VERIFYING; 20-09-03 and all four REL reviews remain open. Phase 21 and distribution remain gated.

Installed curved-outline, curved-line and wall tooltip calculations pass their targeted regressions. Physical 150% calculation and save/readback subsets also pass. Complete display, recovery, offline, public-plan and keyboard/overflow cases still require their remaining checks.

The PC session is safely closed. All 3191 original profile files and hashes are restored; the complete disposable profile is preserved separately. CLMC is closed. D1 remains at 125% and D2 is restored to 100%. No further hands-on action is requested from Francis for this session.

The 18-file UNAPPROVED review packet is copied and independently hash-verified in Francis's specified Releases/1.1.5 folder. Its new directories have the same local protection as 1.1.4. Cloud sharing permissions and final release approval remain unverified.

See [current retest](20-1.1.5-RETEST.md) and [canonical evidence](20-INSTALLED-EVIDENCE.json). Earlier sections retain dated historical candidate results.
<!-- current-1.1.5-end -->

<!-- current-1.1.4-start -->

## Historical candidate — 1.1.4

The exact installed **1.1.4** candidate has **6 pass, 1 first-release not applicable, 1 reviewed unsupported, 1 fail and 7 pending**. Phase 20 remains **VERIFYING**, task **20-09-03** is open, and Phase 21 pilot/distribution remains gated. See [the current retest record](20-1.1.4-RETEST.md) and [canonical case evidence](20-INSTALLED-EVIDENCE.json).

At 2026-10-26T00:35:54.1992593Z, the reviewed restore helper returned all **3191 original profile files with matching hashes**, preserved the complete 1.1.4 disposable profile separately, and verified CLMC closed. The original isolation was inherited from 1.1.3; this is the actual 1.1.4 restoration, not a rewritten old restoration.

All candidate 1.1.2/1.1.1 sections below retain historical results and then-current future-work statements. The separate frozen 1.1.3 record preserves its intervening error-list failure. This checkpoint supersedes their current-position wording.

<!-- current-1.1.4-end -->

## Current continuation — frozen final-C 1.1.2; UI05 failure prompts replacement work

As of **26 October 2026, 04:24 Manila**, the [current installed record](20-INSTALLED-EVIDENCE.json) has **5 pass (fresh-install, project-only-transfer, failed-save-backup, recovery-never-saved, multipage-navigation), 1 first-release not-applicable, 1 fail and 9 pending** against final-C **1.1.2**. The exact complete record is frozen in [20-1.1.2-INSTALLED-EVIDENCE.json](20-1.1.2-INSTALLED-EVIDENCE.json), **133037 bytes**, SHA-256 `acf5e6dbf871befe09cf0edb07026c9a9d3f1092d5029f9a41289ee56f27c6d4`. Native UI05 long-content readability now fails; **1.1.3 fix/build work is in progress**, with no new artifact, inspection, smoke or installed pass claimed yet. Earlier installed passes and the JPX failure belong to the frozen 1.1.1 record below; they were not copied into new-candidate results. All four candidate-specific REL edge reviews are pending again. Phase 20 remains **VERIFYING**, with **20-09-03 open**; Phase 21 pilot/distribution remains gated.

| Final-C identity/verification | Actual result and boundary |
|---|---|
| Source | `cd9016f`; common local PDF decoder options, packaged decoder/fallback/license resources and narrow WASM CSP permission. Corrected real-renderer build/development URL coverage replaces the rejected A/B packaging layouts. |
| Installer | `dist/clmc-takeoff-1.1.2-x64-setup.exe`, **137026296 bytes**, SHA-256 `b2d27d0e75d18d1f66df839a0552faf90b17cb14275d78330ac3766f0baadec6` |
| ASAR | SHA-256 `084f96aef0b4e27ad746712efd4fca793554b82c8b0e7642bccda2d93f119416` |
| Source suite/build | **1259/1259 tests, 160 files**, `NODE_OPTIONS=--no-experimental-webstorage`, `--maxWorkers=4`, 97.33 seconds; both TypeScript checks and production build pass. Existing assertions/deadlines remain unchanged; the two new real Vite build/server integration cases have explicit 20-second deadlines. Earlier default-worker/concurrent timeout attempts and rejected packaging A/B remain preserved. This is not a clean-default-command or clean-whole-repository-lint claim. |
| Actual artifact inspection | Final C passes exact NSIS/ASAR/PE identity and package checks: **149 payload files**, **108 production dependency locations**, ten decoder/license byte identities and narrow CSP. A/B were rejected and never installed. Both PEs remain unsigned under Francis's policy. |
| Packaged smoke | Actual `dist/packaged-smoke.json` PASS, preserved exactly as `candidate-1.1.2/packaged-smoke-final-C.json`: Electron44.9.3, sandboxed packaged renderer, local notes/PDF worker/render, format3 save/read/reopen, utility import and internal XLSX/CSV. Scripted destinations, hidden developer-host execution and generated vector fixture remain explicit limits; this does not establish native offline/physical/representative-plan acceptance. |
| Fresh install — complete PASS | Actual clean precondition after removing only the disposable test installation: zero registration/executable/active profile; original3191 hashes verified and original profile preserved separately. Installer exit0, all149 payload entries match manifest, one1.1.2 registration and one Desktop/Start-menu shortcut. Native001shows installed empty1.1.2 launch,004fully loaded About/version/JPX notes,005Escape closes About and returns focus to More. This is first-release fresh installation, not a deployed predecessor upgrade. |

Native project-only transfer now passes: both pages, all 14 markups and nine ordered Estimate rows retain exact PDF/geometry/mixed scales/rates, with independent totals **1012.93 / 1160.73 / 147.80**. Separate Save As is clean; the actual reopened state is dirty after positive viewport refit, and a later ordinary Save returns clean. This is synthetic portability evidence, not physical-display or representative-plan approval. Native captures 049/050/051/057/062–067 and two independent reads anchor immutable `native/portable-first-save.clmc`, 10239 bytes, SHA-256 `096b1574b464763ba173922cc55677b20dcf2d88c461a69142720a78073d2432`. Input SHA-256 is `d35db947d071e52120797dee192c359c14ee0424bf6de7896ab1e337c480d038`; `transfer-precondition.json` and `portable-native-precondition.json` establish sole-project transfer and absent external PDF/library. Existing fixture identity/oracle is reused, with no duplicate fixture. Reopen 062–064 is actual adoption, not a pre-adoption clean frame.

Native failed-save/backup now passes actual first-save failure, Cancel/Close retention, backup/replacement preservation, unlocked retries and detached-backup Save to a separate copy. The modal Save As route was cancelled; successful first copy used Close then toolbar Save As. The specific JPX blank-render defect is resolved by installed scan rendering/registration, while the complete large-scan case remains pending. The consolidated `candidate-1.1.2/failed-save-backup-review.json` has 22 accepted checks, native 072–122 and ten independently verified immutable archives. The first absent destination is a valid 215-character component/full 256-character path; only the UUID temp component is too long. Backup failure preserves disk primary2/backup1 while live3 is dirty; retry yields primary3/backup2. Primary replacement failure leaves primary3 unchanged and validly rotates backup2 to saved primary3; retry yields primary4/backup3. Detached backup3 opens dirty/disassociated and ordinary Save produces a distinct clean three-Count copy without changing original4/3. No-backup/zero-temp claims are timestamp-bound. The chronology addendum preserves the original raw proof and correctly places live Count4 before the immutable3/2 disk copy, which still precedes failing Save109. Source Dallas marks are arbitrary and uncalibrated, with no metric/as-built accuracy claimed.

Native scan012–044 and immutable `usda-first-save-readback.json` establish both original JPX pages nonblank, one pin at Fit/800% and native save/reopen, exact full four-page PDF/CRC, and stored-point registration within one screen pixel per axis. Calibration remains unset; no independent calibrated dimension, actual pan or scan memory window is demonstrated. This performed partial is pending, rather than a continued blank-render failure.

The raw final-C evidence is under `.planning/tmp/20-completion-20261026/candidate-1.1.2/`: `source-verification.json`, `full-tests-resolved-layout.log`, `package-attempt-C.log`, `release-inspection-attempt-C.log`, `packaged-smoke-final-C.json`, `fresh-install.json`, `fresh-installed-payload.json`, `clean-install-precondition.json`, `fresh-install-independent-review.json` and native001/004/005. [The JPX investigation](20-JPX-RENDER-DEBUG.md) preserves the original failure and rejected layouts. Packaged USDA/WASM/fallback controls are supplemental; the full native high-resolution-scan case remains pending.

**Current preservation boundary:** `candidate-1.1.2/profile-restored.json` records actual restoration at **2026-10-25T20:16:41.0357511Z** (**26 October, 04:16 Manila**): all **3191 original files and hashes matched**, CLMC is closed and the restored local library is absent. The complete disposable profile is preserved in `candidate-1.1.2/test-profile`, including the saved pending-discard02 recovery state. The earlier 18:32 UTC restoration below remains specific to the completed 1.1.1 session; isolation statements in older native observations describe their historical test conditions. Last observed hardware has two active extended1920×1080 displays (D1 125%, D2 100%/main); those carried hardware facts do not pass any 1.1.2 physical calibration, pan or monitor-transition case.

Francis's recorded owner/unsigned-internal/first-release facts and `C:\Users\franc\OneDrive\Desktop\CLMC TAKEOFF FOLDER` remain applicable human facts. The 1.1.1 REL-02 technical review remains historical; it does not review the new candidate automatically. The 17-file protected **UNAPPROVED** review copy in `Releases/1.1.2` has independent byte/DACL readback; rollback/support contact, dependency/license/stability dispositions and final human release approval stay open. Local protection does not establish OneDrive cloud permissions or distribution approval. The validator remains `awaiting-evidence`; no phase completion is implied.

Frozen 1.1.2 has five accepted cases: fresh installation, project-only transfer, failed-save/backup handling, never-saved recovery and multipage navigation. Never-saved recovery restored completed revision 8 with the external PDF absent, retained one Count, scale 1:10 and **100 / 130 / 30**, and saved a separate native copy with independent exact readback. Multipage navigation retained all 14 markups, both scales and **1012.93 / 1160.73 / 147.80** across four recorded toolbar/keyboard round trips and reopen; five sparse process-memory samples over 276.068 seconds settled near baseline, without peak, leak or cache certification. The **UI05 failure** is visible unit/rate columns breaking into vertical fragments at a restored nominal 1280×720 window on Windows 100% scaling (captures 230/232; settled 233 confirms 250 items and the 100-row display cap). The 20-of-250 preview and reachable footer are subset positives; keyboard and invalid-import states are not accepted. **1.1.3 fix/build work is underway; no new artifact or pass is accepted yet.** See [frozen 1.1.2 evidence](20-1.1.2-INSTALLED-EVIDENCE.json) and [current closeout](20-CLOSEOUT.md).

The1.1.2 native recovery audits are `native/recovery-never-saved-never01/independent-never-saved-snapshot-audit.json` and `independent-never-saved-save-audit.json`. Navigation is anchored by immutable `native/portable-navigation-after-cycles.clmc`, SHA-256 `cf7478ce81fb577f1c0c042c633211f0759ee3102dedd2cb90513454dadb57f0`, and `native/portable-navigation-independent-review.json`;219–221are dirty after positive107%refit, while224settles clean after ordinarySave. Sparse private-byte observations return from477196288 to414818304 versus412987392 baseline; original sampler aggregate-zero and SHA-linked correction are retained. Saved recovery remains pending actual approved discard02. `handoff-independent-readback.json` verifies the17-file **UNAPPROVED** review copy and local DACLs under `C:\Users\franc\OneDrive\Desktop\CLMC TAKEOFF FOLDER\Releases\1.1.2`; this copy remains unapproved after the new UI05 failure.

## Historical continuation — frozen 1.1.1; JPX scan defect prompted replacement

This section retains the pre-build 1.1.1 checkpoint and its then-current repair/preservation statements. Final-C 1.1.2 status above supersedes its future-work wording; all underlying 1.1.1 results retain their own candidate identity.

The exact installed **1.1.1** candidate now has **5 pass, 1 first-release not-applicable, 1 fail and 9 pending** cases. The complete record is frozen in [20-1.1.1-INSTALLED-EVIDENCE.json](20-1.1.1-INSTALLED-EVIDENCE.json), **107602 bytes**, SHA-256 `fd9451aa65c10e4c3f6f5ef965f5ded13361db77b3dfe1dfccac6e424c04b85a`. It preserves all 1.1.0 history and the actual 1.1.1 observations before replacement-candidate work. The [working canonical record](20-INSTALLED-EVIDENCE.json) must be rebound when candidate bytes change; this frozen record remains the 1.1.1 result.

**A new blocking application defect was observed:** the genuine high-resolution USDA scanned construction PDF remains blank in the native app on pages 4 and 3 (captures 139–142). Its exact unchanged four-page source passes independent PDF checks and renders correctly in Poppler. Page 4 was still blank after approximately 31.6 seconds; page 3 was also blank. A **1.1.2 JPX decoder/resource fix is underway**, with no replacement build, inspection, smoke or installed pass claimed here. Phase 20 remains **VERIFYING**, and task **20-09-03** remains open.

| Current 1.1.1 case/disposition | Evidence and limits |
|---|---|
| Five complete PASS cases | Fresh installation, project-only transfer, never-saved recovery, failed-save/backup and large-vector. Detailed case checks and exact candidate binding are in the frozen record. |
| Large-vector PASS | The unchanged full 88-page TxDOT Dallas PDF, page 34, retained two source-derived landmark lines and one natively placed pin at 25% and 800% zoom, across 34→35→36→35→34 navigation and native saved-project reopen. Independent saved-archive readback confirms exact full PDF, calibration, geometry and page association. Landmark errors against printed dimensions are −0.01161% and −0.06839%. Calibration and the two reference lines were generated preparation, not native manual calibration; the native pin was placed in the app. Reopen positively refit and was dirty; a clean reopen or restored 800% viewport is not claimed. The qualified process-memory observation covers one earlier two-minute window, not every later operation or a leak soak. See `owner-display/dallas-large-vector-review.json`, both immutable saved-project copies and captures 105–135. |
| First-release NOT APPLICABLE | Francis attested that no predecessor has been deployed. The explicit [first-release policy](../../../docs/release-evidence-first-release.md) applies only to `actual-predecessor-upgrade`; the disposable test-installed 1.1.0 transition remains synthetic history, not an upgrade pass. |
| Large-scan FAIL | The full original USDA PDF contains four pages; pages 3 and 4 each use a 6582×5111 JPX scan. Independent source render is nonblank, while native pages 4 and 3 remain blank. The fixture is an agent-selected disposable public software-test source; no human approval as representative as-built work or measurement acceptance is invented. See `owner-display/139-*` through `142-*` and the public source inventory. |
| Nine pending cases | Saved recovery, offline workflow, multipage navigation, physical scaling 100/125/150/200%, actual monitor transition and full keyboard/overflow coverage. Existing scoped observations remain useful, but do not complete these cases. |

[Francis owns release/signing](20-RELEASE-OWNER.md), selected **unsigned internal use**, confirmed this is the **first release**, and provided **`C:\Users\franc\OneDrive\Desktop\CLMC TAKEOFF FOLDER`**. That parent folder contains existing projects/exports; none were changed. An inherited Users Modify entry means the selected location alone does not establish a protected read-only release handoff. Protection, rollback/support contact, dependency/license/stability decisions and final review remain open. [REL-02](20-REL02-REVIEW.md) is reviewed for technical first-release/identity/profile-preservation scope; it is not human release approval. REL-01/04/05 remain pending, including final representative-fixture review.

The new physical baseline is **two active extended displays**, both **1920×1080**: **D1 125%, D2 100% and main**. Settings captures 001–009 record this baseline. No DPI setting change, successful actual app move between monitors or native pan pass is claimed in this session. Earlier one-active-display observations remain dated history.

At **2026-10-25T18:32:53.9252882Z** (**26 October, 02:32 Manila**), `owner-display/profile-restored.json` confirms all **3191 original profile files and hashes matched**, the original profile was returned, the disposable test profile was preserved separately, the original local library remained absent and CLMC was closed. The 1.1.1 installer and ASAR identities below remain the frozen candidate. Prior qualified 1238/1238 tests, typechecks/build/inspection/smoke and 15 existing lint errors belong to that candidate, not a future 1.1.2 result.

The evidence validator still exits **1**, `awaiting-evidence`, for the JPX scan failure, nine pending cases and REL-01/04/05 reviews. No Phase 20 acceptance, Phase 21 pilot acceptance or distribution is claimed. Resolve and rebuild the JPX fix, retain both candidate histories, then repeat the relevant installed checks against the replacement's exact manifest and complete the remaining matrix.

An interim 26 October summary, after project-only transfer and the first-release disposition, recorded **3 pass, 1 not-applicable and 12 pending**. The frozen five-pass/one-fail result above supersedes that intermediate count; the earlier two-pass checkpoint below remains preserved too.

## Earlier 26 October continuation — historical 2-pass/14-pending checkpoint

The rest of this report preserves the earlier checkpoint before the owner/display session. Its case counts, owner decisions, one-active-display baseline and statement that no new defect had then been observed are historical; the current continuation above supersedes them.

Two complete cases now pass against the exact **1.1.1** candidate: **fresh installation** and **never-saved recovery**. Backup/replacement fault handling, detached backup copies, library safeguards and public-PDF rendering also passed the scoped checks below. No new blocking application defect was observed. **Phase 20 remains VERIFYING: 2 of 16 complete cases pass, 14 remain pending.** Pending means incomplete evidence, not a newly observed failure.

This continues task **20-09-03** under the existing GSD execution/debug workflow. The user authorized driving the second PC and identified themselves as release owner. The protected installer location and signing decision are still to be provided. No Phase 21 pilot or distribution is accepted.

## Candidate and test boundary

Same candidate as [20-REBUILD-RETEST.md](20-REBUILD-RETEST.md), with no production-source or installer changes this continuation:

| Item | Value |
|---|---|
| Installer | `dist/clmc-takeoff-1.1.1-x64-setup.exe`, 136810484 bytes |
| Installer SHA-256 | `f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e` |
| Installed ASAR SHA-256 | `b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98` |
| PC | User-confirmed second PC LAPTOP-5BAM24NM; Windows 11 Home Single Language build 22631 x64; 15.8 GiB RAM |
| Input | Native installed Windows app through Computer Use; independent archive/PDF/hash/arithmetic readback |
| Raw evidence root | `.planning/tmp/20-completion-20261026/` (ignored; preserve locally) |
| Authoritative case statuses | [20-INSTALLED-EVIDENCE.json](20-INSTALLED-EVIDENCE.json) |

The prior qualified **1238/1238 tests, 158 files**, both TypeScript checks, build, payload inspection and packaged smoke remain applicable to unchanged bytes. The Node 25 worker storage flag and 15 pre-existing lint errors remain documented in the rebuild report. They were not converted into clean-default-command or clean-lint claims.

## Native results

Artifact names in this section are relative to the raw evidence root above. Numbered JSON records include native accessibility text and corresponding JPG evidence.

| Check | Expected and actual | Evidence |
|---|---|---|
| Fresh candidate installation — full case PASS | Removed only the disposable test installation, exit 0. Verified retained original profile, then moved it aside. Before installation: zero CLMC registrations, no app executable and no active app profile. Exact candidate installed, exit 0; 149 payload hashes match, one 1.1.1 registration, one shortcut per location. Fresh launch was empty; About/local notes 1.1.1, reachable Close, Escape and focus return observed. Original profile restored after testing. | `clean-install-precondition.json`, `fresh-install.json`, `fresh-installed-payload.json`, captures 059–062, `profile-restoration.json` |
| Never-saved recovery — full case PASS | Natively calibrated the disposable grid, placed one count and applied material 100/labor 0/30% markup. Completed revision 6 at **26 Oct 00:55:16 Manila** (25 Oct 16:55:16.960 UTC), with no saved association and verified embedded PDF. Interrupted only the verified test main process and renamed its source PDF unavailable. Correct recovery time/never-saved label; Keep for Later survived another restart. Recover returned dirty with exact captured calibration/geometry and **100/130/30** cost/selling/margin. Ctrl+S required Save As; separate project saved clean. | `never-saved-exact.json`, `never-saved-embedded.pdf`, `never-saved-interruption.json`, captures 022–032, `readback.cjs`, `readback.json` |
| Backup-write failure — scoped PASS | Held only the disposable `.bak` against replacement. Save failed visibly with EPERM, retaining dirty work at **102/132.60/30.60**. Original and backup hashes unchanged; zero staging remnants. Save As cancellation retained error and dirty work. Released lock, Try Again succeeded; backup matched preceding revision 101. | captures 039–046, `backup-lock-preservation.json`, `retry102-backup.json` |
| Final replacement failure — scoped PASS | Held only the disposable primary against replacement. EPERM left dirty revision 103 and unchanged last-saved primary 102. Backup contained validated last-good 102; zero staging remnants. Released lock, Try Again succeeded. Backup publication before a failed final replacement correctly advanced to latest validated 102. | captures 048–050, `primary-lock-preservation.json`, `retry103-readback.json` |
| Detached backup — scoped PASS | Actual `.bak` opened detached and dirty. Ctrl+S required a distinct Save As. Saved copy retained one count, captured scale, material 102 and **102/132.60/30.60**, with exact embedded PDF and geometry. Primary/backup remained preserved. | captures 051–058, `detached-backup-copy.clmc`, `readback.json` |
| Project-only transfer — scoped PASS | Fresh profile had no library. Folder contained only transferred synthetic `portable.clmc`, without PDF. Native open restored embedded PDF, six quantities **10/100/100/40/30/1** and **740/962/222**. Source SHA remained `c8a466c0886ad40fb792771646b7d64f8dd7af6da26909a665ffdfa291d156cb`. | captures 069–070, `project-only/portable.clmc`, `library-project-readback.json` |
| Library import/application — scoped PASS | Empty-state guidance; invalid negative-rate CSV rejected without changing project rates. Valid two-row preview imported into the empty disposable library, leaving prior **740/962/222** snapshots unchanged. Incompatible `ea` row disabled for length; explicit `m` selection changed only Grid length to material 999/labor 1. Separate saved project read back exact geometry/PDF/other rates and **10590/13767/3177**. Escape returned to Cost Library. | captures 072–091, `library-invalid.csv`, `library-valid.csv`, `grid-library111.clmc`, `library-project-readback.json` |
| Public multipage PDF — scoped PASS | 31,148,266-byte, 150-page public housing guidance rendered pages **1→2→3→2**, zoom 46/70/75% positive. Save As/reopen returned page 2 and positively refit at 70%; replacement save succeeded. Independent ZIP CRC and embedded PDF SHA matched source exactly. No visible error in this limited sequence. | captures 095–113, `public-project-readback.json`, `worldbank150.clmc`, `public-plans/process-memory.json` |
| Public raster-bearing plan — scoped PASS | 3,494,493-byte municipal sample, one page, includes a 2200×3400 image plus vector/text. Initial fit 23%, explicit Fit 35%, zoom 50%; final native plan was readable and visually matched the Poppler reference. Separate save succeeded. | captures 117–124, `portland-site.clmc`, `public-plans/portland-reference.png`, `public-plans/provenance.json` |

The recovery project was intentionally repriced to 101/102/103 during the later fault tests. Final `readback.json` therefore reports material **103** for that project and **102** for the detached backup copy. Capture 032 preserves the original recovered/saved **100/130/30** observation. No later edits are claimed to have survived the earlier interruption.

Manual grid calibration persistence is exact; its selected span differs approximately **0.1786%** from the ideal grid. This does not pass the required 0.1% independent landmark accuracy criterion. No native pan success is claimed: the supported control API provides left-button dragging without held Space or middle-button drag, which the app requires for panning.

The public sources are the [World Bank housing guidance PDF](https://documents1.worldbank.org/curated/en/099554312202436138/pdf/IDU1f54bd272126f11472119261126d32b985e49.pdf) and [Portland Sample Site Plan](https://www.portland.gov/ppd/documents/sample-site-plan/download). Their exact source/hash/page/image inventories are preserved. They add exploratory coverage; no external representative-plan approval, sustained memory result or measurement acceptance is inferred. The municipal sample is raster-bearing, without proof that it is an actual scanned plan.

The process snapshot summed **692002816 bytes working set / 612438016 private bytes** across four app processes. These are OS process metrics at one moment; the **128 MiB retained-raster-cache budget is a different metric**. No measured navigation-latency or memory-settling threshold is claimed.

Two test-method corrections are preserved: Windows rejected a forward-slash full save path, after which the native backslash path saved normally; the library readback initially assumed a stored library-item reference, then correctly checked the detached numeric rate snapshot and passed. Neither required an application change.

## Final preservation

CLMC was closed normally from a clean saved project. Both temporary file-lock helpers completed. The disposable fresh profile, including its synthetic two-row library, was moved into the ignored `fresh-test-profile/` folder. The original profile was moved back to `%APPDATA%\clmc-takeoff`: **all 3191 files and hashes match the pre-test inventory**, and its local library is still absent. No profile was deleted. `profile-restoration.json` records the result; the installed ASAR still matches the exact candidate.

No display setting changed this continuation. Original **100% at 1920×1080**, with the user's **Show only on 2** topology, was retained from the preceding retest. CLMC 1.1.1 remains installed and closed. Original trial fixtures and the historical 1.1.0 kit/results remain preserved. Nothing was distributed to another PC.

Raw profiles, recovery data, screenshots and inventories stay ignored. Do not stage or broadly share `fresh-test-profile/`, previous private profile backups or cache/download folders. `EVIDENCE-FILES.json` indexes this continuation's non-profile artifacts for preservation; it is not a distribution authorization.

## Remaining acceptance checklist

| Required evidence | Concrete remainder |
|---|---|
| Actual deployed predecessor | Accessible actual prior installation inventory/upgrade; the synthetic test-installed 1.1.0 cannot establish deployed history. Absence requires an explicit recorded review. |
| Broader project portability | Mixed page scales, arcs and wider ordering/visibility/wall-height variants against an independent source record. |
| Saved recovery and save failures | Saved-recovery keep/discard permutations, installed first-save write failure, complete retry/save-copy/cancel/close states. Native backup/replacement locks and never-saved recovery now have current-candidate evidence. |
| Offline workflow | Actual app-network-unavailable five-tool calibration/pan/zoom/library/unit/save/reopen/internal CSV/XLSX workflow. Network stayed connected here. |
| Representative plans/performance | Approved large vector, actual high-resolution scan and multipage construction fixtures; independent known measurements, extreme zoom/reopen, mixed-page markup association, sustained timing and memory settling. Public exploratory PDFs do not close these requirements. |
| Physical display matrix | Full calibration/landmark/pan/reopen checks at 100/125/150%; actual monitor transition or reviewed limitation. 200% was unavailable in the observed dropdown; two displays enumerated but only one active, so no unsupported exception is silently accepted. |
| Full keyboard/overflow matrix | Current-candidate many-candidate recovery/discard, large/long library and remaining Tab/Shift+Tab/focus/scroll/action permutations. |
| Release review | User is release owner; protected installer location, signing policy/owner, rollback contact, dependency/license/stability decisions and named REL-01/02/04/05 dispositions remain open. `buffers@0.1.1` missing license declaration remains recorded. |

Run `node scripts/verify-release-evidence.cjs .planning/phases/20-production-readiness/20-INSTALLED-EVIDENCE.json dist/release-manifest.json`. The retained `acceptance-gate.json` has **awaiting-evidence**, exit **1**, for remaining cases/reviews. This is the intended acceptance boundary; the validator was not weakened. Continue 20-09-03 from this checklist when the remaining inputs/hardware/manual evidence are available.
