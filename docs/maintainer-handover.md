# CLMC Takeoff 1.1.0 — maintainer draft

Prepared 2026-10-22 while Phase 20 remains VERIFYING. This is preparation for internal trials, not release acceptance or authority to distribute to the remaining ten PCs. The user deferred second-PC work until hardware is available. No automatic follow-up has been scheduled.

## Frozen trial candidate

Application source: `e61ae4a`; installed/manual evidence documentation: `9ae8e41`. Electron is pinned to **44.9.3**. Full Windows x64 per-user NSIS installer:

- File: `clmc-takeoff-1.1.0-x64-setup.exe`
- Bytes: `136810369`
- Installer SHA-256: `d3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180`
- ASAR SHA-256: `cf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45`
- Actual signatures: unsigned installer/executable. Publisher and signing policy/owner remain pending.

The installed development-PC payload matched all 149 manifest files. Final source passed 157 test files / 1,228 tests, production build/types, package inventory and packaged smoke. Local installed checks covered the known geometry/prices, native save/backup/recovery, exports and two corrected manual defects. These do not establish a deployed-predecessor upgrade, non-development hardware acceptance or physical display matrix.

## Build and inspection process

Use an authorized clean Windows checkout with the committed lockfile and a recorded supported Node/npm environment. Record `node --version`, `npm --version`, Windows build, checkout hash and any signing settings with each new candidate. A reproducible process does not promise identical NSIS bytes across different machines/times.

```powershell
npm ci
npx vitest run
npm run build:win
node scripts/verify-release.cjs dist
node scripts/smoke-packaged.cjs dist/win-unpacked/clmc-takeoff.exe
```

The inspector writes `dist/release-manifest.json`; packaged smoke writes `dist/packaged-smoke.json`. Inspect actual package contents, bundled notices, executable metadata and signature results. Never copy source, environment files or development artifacts into the positive package allowlist. New candidate bytes invalidate old candidate-bound installed evidence. Do not rebuild the frozen candidate just to prepare documentation.

Prepare the portable training kit from the frozen artifacts:

```powershell
node scripts/prepare-trial-kit.cjs
```

Open `dist/trial-kit/START-HERE.html`; verify with its supplied PowerShell integrity checker. The kit can be copied as a folder without installing Node on the target. Keep its complete relative folder structure. This is a trial handoff, not an approved distribution share.

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
