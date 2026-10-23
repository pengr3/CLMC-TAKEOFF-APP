# CLMC Takeoff 1.1.0 — maintainer draft

Updated 2026-10-23 while Phase 20 remains VERIFYING. This is preparation for internal trials, not release acceptance or authority to distribute to the remaining ten PCs. The user deferred second-PC work until hardware is available. No automatic follow-up has been scheduled.

## Frozen trial candidate

Application source: `9a0349f` (preview-cancellation focus fix); previous candidate source `e61ae4a` / documentation `9ae8e41` retained as historical evidence. Electron is pinned to **44.9.3**. Full Windows x64 per-user NSIS installer:

- File: `clmc-takeoff-1.1.0-x64-setup.exe`
- Bytes: `136810568`
- Installer SHA-256: `fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544`
- ASAR SHA-256: `5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd`
- Actual signatures: unsigned installer/executable. Publisher and signing policy/owner remain pending.

The previous e61ae4a installed development-PC payload matched all 149 manifest files and passed 157 test files / 1,228 tests, production build/types, package inventory and packaged smoke. New source 9a0349f passed 38 focused regressions, build/types, package inspection and packaged smoke; all149installed files matched. Native preview-cancel/Escape now preserves the drawing tool. The full run passed1225/1229tests with four initial failures; all four files passed isolated reruns (three together, parser separately). No timeout/expected behavior was relaxed. The initial full run was not clean; parser-harness behavior was intermittent and requires transparent review. Additional native recovery/save-failure/backup/legacy/import checks and exact run provenance are recorded in 20-MANUAL-EDGES.md. Local installed checks covered the known geometry/prices, native save/backup/recovery, exports and two corrected manual defects. These do not establish a deployed-predecessor upgrade, non-development hardware acceptance or physical display matrix.

## Build and inspection process

Use an authorized clean Windows checkout with the committed lockfile and a recorded supported Node/npm environment. Record `node --version`, `npm --version`, Windows build, checkout hash and any signing settings with each new candidate. A reproducible process does not promise identical NSIS bytes across different machines/times.

```powershell
npm ci
npx vitest run
npm run build:win
node scripts/verify-release.cjs dist
node scripts/smoke-packaged.cjs dist/win-unpacked/clmc-takeoff.exe
```

Run tests to completion before starting packaging; retain their full output and exit codes. Do not run heavy packaging alongside the regression suite. The inspector writes `dist/release-manifest.json`; packaged smoke writes `dist/packaged-smoke.json`. Inspect actual package contents, bundled notices, executable metadata and signature results. Never copy source, environment files or development artifacts into the positive package allowlist. New candidate bytes invalidate old candidate-bound installed evidence. Do not rebuild the frozen candidate just to prepare documentation.

### Candidate reproduction checklist

1. Obtain an approved clean checkout of the exact recorded source commit, including tracked training files and `package-lock.json`. Record `git rev-parse HEAD` and `git status --short`; retain any intentional delta explicitly. Never copy a developer's `node_modules`, scratch outputs, `.env` or personal app data. Build tools/package acquisition may require connectivity; this does not change offline installed-app operation.
2. Record actual Node/npm/Windows versions. The guide checks in this execution used Node **v24.13.0**; this is observed build-host provenance, not a promise for every Node version. Use the approved supported environment and the lockfile, which pins Electron **44.9.3** and builder **26.8.1**. `npm ci` must succeed without substituting package upgrades. Capture signing configuration decisions without recording secrets.
3. Run the regression suite separately, then `npm run build:win` (includes both typechecks and bundling). Record failures as failures; passing isolated retries do not rewrite the initial full-run result. Preserve the current candidate's 1225/1229 initial result and parser-intermittency qualification until the release reviewer resolves it.
4. Run inventory inspection and candidate-bound packaged smoke using the commands above. Save their manifests/logs with the source commit, version and installer/ASAR SHA-256. Inspect notices/signatures and review dependency changes against the Phase 20 dependency and security registers. The `buffers@0.1.1` license-declaration exception, unsigned publisher policy, remaining advisory dispositions and regression stability all require named decisions.
5. For a new release, deliberately update `package.json` and the lockfile version plus `resources/release-notes.json`; then repeat build/inspection/testing. About must agree with the installed version and offline notes. A documentation revision alone keeps the frozen installer; distinguish documentation revision from application source.
6. Obtain actual installed-app validation through [release-validation.md](release-validation.md), then the separate [pilot runbook](pilot-runbook.md). No manifest, unit suite or hidden smoke establishes release or estimator acceptance.

Prepare the portable training kit from the frozen artifacts:

```powershell
node scripts/prepare-trial-kit.cjs
```

Open `dist/trial-kit/START-HERE.html`; verify with its supplied PowerShell integrity checker under the normal script policy. The kit can be copied as a folder without installing Node on the target. Keep its complete relative folder structure. This is a trial handoff, not an approved distribution share.

The preparation script intentionally refuses an existing `dist/trial-kit`. Preserve that folder, manifests and returned `TEST-RESULTS.md`; never delete/overwrite them to make the command succeed. Prepare a revised kit in a separate approved clean checkout/destination and review its new manifest. The script's current destination is fixed within that checkout. The existing kit has the earlier guide/maintainer revision; the Phase 21 source documents are newer. A future revised handoff must include the reviewed guide, pilot procedure and worksheets with their actual documentation revision. Do not imply that the preserved kit already contains these updates.

## Identity, files and recovery

| Item | Location / behavior |
|---|---|
| Installer identity / AUMID | `com.clmc.takeoff` |
| Product / executable | CLMC Takeoff / `clmc-takeoff.exe` |
| Default install | `%LOCALAPPDATA%\Programs\clmc-takeoff` (installer permits another destination) |
| App-owned data | `%APPDATA%\clmc-takeoff` |
| Local library | `cost-library-v1.json` under app data |
| Recovery | `recovery` under app data; approximately 60 s, 20 candidates / 4 GiB |
| User projects | User-selected locations; format 3 embeds `project.json` and `plan.pdf` |
| Last-good backup | Adjacent `<project>.clmc.bak`; one last-good version |

Back up projects, adjacent backups and the complete app-data directory while CLMC is closed. Uninstall retains app data by configuration; keep an independent backup regardless. Do not merge the separate historical `clmc-plan-estimator` directory without a reviewed migration. The local library is independent of project rate snapshots; an import replaces it only after preview and explicit confirmation. Team rate updates must be imported on each PC.

Readers support legacy external-PDF format 1 and embedded formats 2/3; the writer uses format 3 with minimum reader 3. Older projects save through a distinct upgraded copy and may require geometry/calibration and rate-basis review. Future formats are rejected. Opening a validated backup is detached and requires another saved copy. Do not restore app data or a project blindly over newer files.

## Manual update and rollback

1. Inventory the actual predecessor installer, hash, installed version/registration, shortcut, installation directory and user-data location. Keep the approved predecessor installer and pre-upgrade projects/app data. The development PC had no actual deployed predecessor; do not invent one for an upgrade claim.
2. Close CLMC, preserve independent backups and record project/library/preference hashes. Compare the candidate with its approved manifest before installation.
3. Install as the same Windows user. Verify one retained installation/shortcut, About/local notes, preserved library/preferences and known project behavior offline. Save older work as an upgraded copy.
4. For rollback, preserve candidate-era files separately. Use the retained previous installer and a working copy of the pre-upgrade project. An old app may reject format 3; a new project is not a rollback artifact. Restore old app data only under a reviewed procedure if compatibility requires it.

No automatic updater is configured. Keep a versioned read-only internal release location, hash manifest, notes, previous installer and rollback instructions once its actual owner and location are approved.

## Triage and required ownership

Collect exact installer hash, About version, machine/Windows/display details, steps, expected/actual values, permitted project/PDF hashes and screenshots. Separate file protection or money/measurement defects from cosmetic observations. A correction to application source requires relevant tests, build, a new installer/manifest and candidate-specific retesting; documentation alone does not require a rebuild.

| Responsibility | Actual assignment / decision |
|---|---|
| Rate-file accuracy and updates | Pending internal owner |
| Release build, share and approval | Pending owner and approved location |
| Publisher/signing policy | Pending policy and owner; candidate is unsigned |
| Support and rollback | Pending named contact |
| Dependency exception | `buffers@0.1.1` has no supplied license declaration; release review pending |
| Trial acceptance | Named testers, actual results and approval pending |

Before release acceptance, complete the real target-PC evidence and review in [release-validation.md](release-validation.md), [release-compatibility.md](release-compatibility.md) and the Phase 20 evidence record. Later Phase 21 requires two real internal PCs/estimators and explicit pilot acceptance before broader distribution. This draft does not close those gates.

## Practical turnover and decision record

Record actual primary and backup names, dates, demonstrated results and approval in [the Phase 21 handover record](../.planning/phases/21-user-guide-and-internal-handover/21-HANDOVER.md). A filled name alone does not demonstrate the work. The same person may cover multiple responsibilities if the team explicitly assigns and demonstrates them.

| Responsibility | Exercise with disposable data | Evidence required |
|---|---|---|
| Release maintainer + backup | Reproduce a candidate in a separate checkout; explain lockfile/version/notes, inspect package/signature/manifests and compare hashes | Actual source/tool versions, command exits/logs, manifest/hash and observer/date |
| Rate-file owner + backup | Prepare the six-column template; demonstrate valid preview/replace and rejected invalid copy, matching-unit Apply Rates, manual override and unchanged saved-project rates after later import | Approved disposable library revision/hash, independent expected/actual prices and observer/date |
| Support/rollback owner + backup | Locate user project, adjacent backup, app-data/library/recovery; make independent closed-app copies; open a disposable backup detached and save another copy | Actual paths/hashes, unchanged originals and observer/date |
| Support/rollback owner + backup | Triage a disposable failed save or invalid import; explain capture timestamp/lost-work boundary, upgraded copies and predecessor compatibility | Issue record with expected/actual, evidence and next action; demonstrated recovery/rollback limits |
| Release approver | Review technical/stability/signing/dependency evidence; identify accepted candidate, approved read-only share, access/retention and pilot/distribution approval route | Named dated decisions, precise evidence scope and unresolved items |

For issue intake use: ID/date, reporter/contact, exact candidate/version, PC/Windows/display, affected permitted PDF/project hashes, reproduction steps, independent expected versus actual, severity, preserved originals/backup, evidence paths, assigned owner and fix/retest decision. Keep financial, measurement and file-protection blockers open until relevant checks pass. Keep customer plans within their approved access route. No messaging or upload is authorized by this checklist.

Internal share location, access administrator, previous-installer retention, backup contact, signing policy and dependency/stability dispositions remain **pending**. Distribution needs actual Phase 20 acceptance, named demonstrated owners and two-PC estimator acceptance, followed by explicit approval of the exact candidate and actual target list. See [pilot-runbook.md](pilot-runbook.md); ten pending rollout slots are preparation only.
