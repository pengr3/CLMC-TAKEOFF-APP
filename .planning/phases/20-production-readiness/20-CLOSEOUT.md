# Phase 20 second-PC continuation — 26 October 2026

## Current continuation — frozen 1.1.1; JPX scan defect blocks acceptance

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
