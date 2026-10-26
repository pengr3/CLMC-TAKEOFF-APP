# Continue Phase 20 on the development PC

26 October 2026. Continue the existing GSD 20-09-03 work from branch **codex/phase20-second-pc-test**. Source through 1.1.5 and this handoff are being synchronized through the existing origin repository. The second-PC session is closed, its original profile is restored, and its displays are back to 125%/100%.

## Pick up the branch

In the development checkout, first inspect `git status`. Preserve any local work before switching branches. Fetch the existing branch:

```powershell
git fetch origin
git switch codex/phase20-second-pc-test
git pull --ff-only origin codex/phase20-second-pc-test
```

If that local branch does not exist, use `git switch --track origin/codex/phase20-second-pc-test` after fetching. A divergent branch or uncommitted work needs reconciliation; do not reset, clean, force-pull or discard it. This synchronization does not merge the work into master.

Read this file, [the wrap-up](20-SECOND-PC-WRAP-UP.md) and [current evidence](20-INSTALLED-EVIDENCE.json) before running tests. The old `.planning/HANDOFF.json` spike checkpoint has been archived; the current handoff identifies Phase 20.

## Fixes already committed

| Commit | Change |
|---|---|
| ba2063e | Defer hidden-canvas Fit and verify installed 1.1.1 |
| cd9016f | Bundle offline PDF decoders for scanned plans; 1.1.2 |
| dce3824 | Keep Cost Library unit and rate columns readable; 1.1.3 |
| d3bb480 | Preserve the specific import-error list height; 1.1.4 |
| 424a370 | Include true arcs in hover measurements and calculate wall area separately; 1.1.5 |

The final source passed **1268/1268 tests in 161 files**, both build type checks, Windows build, actual release inspection and packaged smoke. Targeted installed measurement/library regressions pass. The complete acceptance matrix remains **2 passed / 12 pending / 0 failed / 1 first-release N/A / 1 reviewed unsupported 200% setting**. Partial positives are retained without claiming complete case passes.

## Resume only the remaining work

Prioritize the three outstanding critical areas on the development PC, using disposable work and the actual installed candidate:

1. **Saved and never-saved recovery:** preserve a completed latest recovery revision and its embedded PDF before interrupting only the verified disposable process. Exercise recovery and save, and independently compare project contents and pricing. The prepared portable input has 14 markups, four arc segments, two scales (0.1/0.2 pixels per mm), and cost/selling/margin totals **1012.93 / 1160.73 / 147.80**. Changing Fixture outlet material 100→101 across five pins with 10% markup yields **1017.93 / 1166.23 / 148.30**. Never terminate a real-work process or move this PC's existing profile with a helper bound to the other PC.
2. **Failed-save/backup behavior:** use disposable destinations and controlled write failures. Preserve the original, backup and in-memory edits; confirm readable recovery actions and a successful retry or Save As. Exact earlier candidate passes are historical references.
3. **Offline workflow:** establish that networking is actually unavailable to the tested process, then open/render, edit, save/reopen and export locally. The prior administrator check produced only Access Denied; no firewall rule was created. Do not execute the old 1.1.4 firewall helper against 1.1.5, and do not infer offline success from a smoke run that made no external requests.

Record the development machine identity and label results as **development-PC evidence**. Such results do not become second-PC or physical-display evidence. The original public-plan, scaling, monitor and keyboard/UI matrix and four REL reviews remain explicitly open. Minor hover-tooltip clipping at a canvas boundary is documented. No additional scope or version bump is assumed; finish the bounded remaining checks against 1.1.5 first.

## Candidate and small portable kit

The exact unsigned installer and its 18-file UNAPPROVED review companion are on this second PC at:

`C:\Users\franc\OneDrive\Desktop\CLMC TAKEOFF FOLDER\Releases\1.1.5`

The development PC must obtain that complete folder through the user's transfer/sync and verify its bytes. Upload completion and arrival on the development PC have not been observed. The 137 MB installer is intentionally outside Git.

| Identity | SHA-256 |
|---|---|
| Installer | 6afc7812a98e22e84bb1b24342cc6fbd54b9ed6898b90c8de01aee30f3ea3379 |
| ASAR | 1eb4ea722cb8383eef13644c4cec75c1086daa200e3fdb6ee6f4794e91a39519 |
| Manifest | 2f588ac1cb552da5e59052cbf96722556d4ae5e5427f47176cd32ddfec34f6ad |

The tracked [portable kit inventory](dev-pc-handoff/INVENTORY.json) preserves the synthetic PDF/project, independent oracle, inspected manifest, packaged-smoke result, final native archive readback, profile-restoration receipt and exact dependency comparison. It contains no preserved user profile, private construction plan or recovery snapshot. Keep kit inputs unchanged and create separate disposable test copies.

Raw screenshots, large public PDFs, build caches and the complete app profiles remain in ignored `.planning/tmp/20-completion-20261026/` on the second PC. Their historical references in evidence JSON retain their original meaning; those files are not supplied by Git. Do not execute a second-PC absolute-path helper unchanged on the development PC. A rebuild may produce different installer bytes even with the same version; retain and identify a new artifact explicitly instead of assigning it the frozen candidate's hashes.

Francis remains release/signing/support/rollback owner, selected unsigned internal first-release use and public test plans only, and accepted the dependency position whose bytes are unchanged in 1.1.5. Advisory/stability and final release approval remain pending. Phase 20 is open and Phase 21 distribution remains gated.
