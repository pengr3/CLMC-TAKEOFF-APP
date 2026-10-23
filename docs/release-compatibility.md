# CLMC Takeoff 1.1.0 compatibility and rollback

This is an internal review candidate for Windows x64. The full offline, per-user NSIS installer is `clmc-takeoff-1.1.0-x64-setup.exe`. Its exact SHA-256 and inventory are in `dist/release-manifest.json`. Core work uses local packaged resources; no update service is configured. Builds are unsigned: actual publisher/signing owner and approval of the internal handoff remain pending. Never identify an unsigned installer as signed.

## Projects and formats

| Item                     | Supported behavior                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Readers                  | Legacy external-PDF JSON format 1; embedded ZIP formats 2 and 3                                                                                       |
| Writer                   | Semantic format 3, `minimumReaderVersion: 3`                                                                                                          |
| Container                | `project.json` plus `plan.pdf`; the IPC name `v2-zip` identifies this container, not the semantic writer version                                      |
| Older project first save | Keep Original Project / Save Upgraded Copy, followed by a distinct native Save As destination; original and hard-link/path aliases cannot be replaced |
| Older saved prices       | Explicit rate-basis review before exports or changes of existing display units; acknowledgement is not proof that historical pricing was correct      |
| Backup open              | Valid `.clmc.bak` opens detached and dirty; save to a separate project copy                                                                           |
| Future format            | Rejected without replacing current work or overwriting the future file                                                                                |

Format 3 includes the PDF, scales, geometry, order, visibility and applied price snapshots. Copying only `.clmc` does not require the source PDF or a cost library. Format 1 still needs its referenced PDF for migration. Local libraries are independent: a library import replaces the local library only after preview and explicit replacement, and never automatically reprices saved projects.

## Data and protection

- Installer identity/AUMID: `com.clmc.takeoff`; visible product: `CLMC Takeoff`; executable/package: `clmc-takeoff`.
- App-owned data is explicitly pinned to `%APPDATA%\clmc-takeoff`, independent of the visible product name. Library: `cost-library-v1.json`; Electron preferences/session storage remain below that directory. Do not merge or move the separate historical `clmc-plan-estimator` directory without a reviewed data migration.
- User projects live wherever the user saves them. A successful replacement keeps one validated last-good adjacent `<project>.clmc.bak`. It is not a history of every revision. Failed writes/validation/backup/replacement preserve existing protected files and leave work dirty with a visible retry/save-copy path. Filesystem/power failure can still lose work after the last completed durable operation.
- Dirty work is captured approximately every **60 seconds**, including PDF bytes, below `%APPDATA%\clmc-takeoff\recovery`. Completed session manifests are `<session UUID>.json`, with immutable `<SHA-256>.pdf` blobs. Temporary/incomplete/corrupt snapshots are not offered as valid protection. Recovery manifest version 1 wraps the shared validated format-2/3 project metadata; it is not a new project-format fork.
- Limits are **20 completed candidates / 4 GiB total logical repository bytes**, including staging and existing contents. New protection requires full transaction headroom. Quota pressure keeps existing copies and warns rather than evicting them. Explicitly save recent work; changes since the last completed capture can be lost. Recovery success never marks the document saved.
- Recover, Keep for Later and confirmed Discard are explicit choices. Saved recovery keeps its source association unless copy protection applies; never-saved recovery requires Save As. Validated backup opens remain detached. Keep copies until a matching successful explicit save or deliberate discard retires them.
- Uninstall is configured to retain app data. This setting is not a substitute for a separate backup of projects, adjacent backups and the whole app-data directory while the app is closed.

## Manual upgrade and rollback

1. Retain the approved previous installer and its hash; inventory its actual uninstall registration, version, install location, shortcut and app-data location. No deployed CLMC predecessor was found on the developer PC; a generated older installer exercise must be labeled as such.
2. Close CLMC, preserve pre-upgrade projects and app data, and retain independent copies outside the installation directory. Record library/preference hashes. Check the candidate hash against the approved manifest using `Get-FileHash -Algorithm SHA256`.
3. Run the approved per-user full installer as the same Windows user. Test one installation/shortcut, correct About version/local notes, preserved library/preferences/projects, and the documented offline workflow. Record real target-PC evidence before acceptance.
4. First save an older project through Save Upgraded Copy. Keep its original and its PDF if it was format 1. An older release may reject format 3; **rollback requires the previous installer and the pre-upgrade project**, not the newly saved format-3 copy. No backward writer is promised.
5. For rollback, close CLMC, preserve the candidate-era files separately, restore the previously approved installer using its documented installation process, and open a working copy of the preserved pre-upgrade project. Do not overwrite newer app data blindly or assume old releases can read newer recovery data. If old data is incompatible, use the pre-upgrade app-data backup under a reviewed restore procedure.

## Internal handoff boundary

The release owner must record an approved read-only installer location, hash manifest, prior installer retention, publisher/signing policy, and a rollback contact. These actual share/publisher/signing-owner/contact fields are **pending**, not invented. Dependency notices preserve installed metadata and supplied license/readme text; upstream `buffers@0.1.1` supplies no license declaration in the installed package and remains an explicit release review item.

Approximately twelve PCs are planned for manual upgrades. Phase 21 owns the complete offline user guide/worked example, named maintainer turnover, real two-user/two-PC pilot acceptance and remaining-ten distribution. This candidate and developer-host smoke do not establish pilot, deployment or non-development-PC acceptance.
# Review safeguards added during final verification

Older projects do not record the stage coordinate basis used when their PDF was rendered. The release retains their raw markup coordinates, clears unverified old calibration, and blocks exports until each affected page is checked. Use the compact geometry review controls to inspect every count, vertex and curved edge against the PDF, reposition or redraw displaced geometry, and recalibrate measured pages before confirming. Save a copy; the original remains protected. New files record the canonical coordinate basis. Do not confirm a page whose alignment cannot be verified.

An existing destination whose format or archive layout cannot be classified safely now requires Save As. It is not implicitly treated as damaged data that may be replaced. Future-format archives remain protected even if their layout adds entries.

One application instance owns the pinned userData root. A second launch activates the existing window before it can initialize shared storage. Recovery orphan reconciliation runs under this ownership and preserves blobs whenever a manifest cannot be read safely.

Development-host installed walkthrough evidence is recorded in `.planning/phases/20-production-readiness/20-MANUAL-TEST.md`. It includes actual adjacent backup retention and saved-work restart recovery without source overwrite. Those observations do not replace the required non-development installation, actual predecessor upgrade, historical-project inspection or physical display matrix.

Additional development-host checks and the preview-cancellation repair are recorded in `.planning/phases/20-production-readiness/20-MANUAL-EDGES.md`. They include never-saved recovery with absent source, actual backup-lock failure/retry, detached backup Save As and synthetic legacy/import guards. The initial full regression had four failures; isolated reruns passed all affected files, with an intermittent parser-harness limitation retained for review. This does not accept the target-PC matrix.
