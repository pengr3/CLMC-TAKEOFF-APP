---
phase: 20-production-readiness
plan: "09"
subsystem: windows-release
tags: [nsis, asar, offline, release-evidence, compatibility, electron]
status: halted
requires:
  - phase: 20-03
    provides: Bounded durable recovery
  - phase: 20-05
    provides: Stable identity and reviewed sandboxed Electron 44.9.3 runtime
  - phase: 20-06
    provides: Bounded utility-process workbook import
  - phase: 20-07
    provides: Format 3 portable projects and protected upgrades
  - phase: 20-08
    provides: Canonical geometry and bounded PDF rasters
provides:
  - Inspected unsigned 1.1.0 Windows x64 full offline NSIS candidate
  - Actual hidden packaged executable smoke with candidate-bound provenance
  - Compatibility/rollback procedure and fail-closed installed evidence matrix
affects: [phase20-verification, phase21-handover, installed-validation]
tech-stack:
  added: []
  patterns: [Positive built-output payload policy, Actual appended7z NSIS inspection, Distinct developer and non-development provenance]
key-files:
  created: [scripts/prepare-release.cjs, scripts/verify-release.cjs, scripts/smoke-packaged.cjs, scripts/verify-release-evidence.cjs, resources/third-party-notices.json, docs/release-compatibility.md, docs/release-validation.md, .planning/phases/20-production-readiness/20-INSTALLED-EVIDENCE.json]
  modified: [electron-builder.yml, package.json, package-lock.json, resources/release-notes.json]
key-decisions:
  - "Use1.1.0, monotonic from the source 1.0.0; actual deployed predecessor history remains unknown."
  - "Inspect the actual NSIS appended7z payload and compare its complete inventory plus EXE/ASAR hashes against unpacked content."
  - "Keep all real target-PC cases pending; hidden developer-host smoke cannot satisfy them."
requirements-completed: []
actuals:
  tokens: 100511
  tasks: 2
  commits: 5
commits: 5
plan_head_before: b8ac41beed43afe12b1353d9912f24e7a3a72b23
duration: 26min implementation and verification, excluding initial context loading
completed: 2026-10-22
coverage:
  - id: D1
    description: Exact full offline candidate has positive payload admission, real inventory/hashes and sandboxed packaged runtime evidence.
    verification:
      - kind: integration
        ref: node scripts/verify-release.cjs dist
        status: pass
      - kind: e2e
        ref: node scripts/smoke-packaged.cjs
        status: pass
    human_judgment: false
  - id: D2
    description: Candidate-bound evidence validation rejects pending, malformed, developer-only and wrong-candidate claims.
    verification:
      - kind: unit
        ref: src/tests/release-evidence.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Actual non-development-PC installation, deployed upgrade, transfer, interruption, offline measurements and physical scaling.
    verification: []
    human_judgment: true
    rationale: Actual target-PC access, approved representative PDFs and deployed predecessor evidence were not supplied; task 03 remains blocking-human.
---

# Phase 20 Plan 09: Windows Candidate and Evidence Checkpoint Summary

**An actual unsigned 1.1.0 offline Windows installer passes payload inspection and hidden packaged smoke; real installed non-development-PC acceptance remains blocked on external evidence.**

## Candidate

| Item | Actual result |
|---|---|
| Installer | `dist/clmc-takeoff-1.1.0-x64-setup.exe` |
| Installer bytes | 136810369 |
| Installer SHA256 | `d3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180` |
| ASAR | `dist/win-unpacked/resources/app.asar` |
| ASAR SHA256 | `cf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45` |
| Inventory/hash manifest | `dist/release-manifest.json` |
| Packaged runtime evidence | `dist/packaged-smoke.json`; actual facts also preserved in `20-INSTALLED-EVIDENCE.json` |
| Product/identity/data | CLMC Takeoff / `com.clmc.takeoff` / pinned `%APPDATA%/clmc-takeoff` |
| PE versions | Installer 1.1.0; application 1.1.0.0; product CLMC Takeoff |
| Actual signature | Both PEs `NotSigned`; no signing publisher/owner invented |
| Actual launched runtime | Electron 44.9.3, Chromium 152.0.7977.167 |

The source package was 1.0.0 and read-only developer-PC inventory previously found no registered CLMC predecessor. Version 1.1.0 is truthful against that known source baseline; no higher deployed version, actual installed predecessor, upgrade success or retained previous-release installer is fabricated. Any actual predecessor discovered later must be older, or the candidate must be re-versioned/rebuilt/rebound.

## Completed Tasks and Commits

1. **20-09-01 — Build/inspect actual candidate:** `c4e7938` RED; `727fec9` GREEN.
2. **20-09-02 — Compatibility/evidence preparation:** `5edb36a` RED; `409dc38` GREEN; `bbfe931` rejects downgrade/placeholder evidence.
3. **20-09-03 — Actual non-development-PC evidence:** pending, blocking-human; no task 03 completion commit.

Measured five commits before this checkpoint-summary metadata commit. Actuals use chars/4 over the realized committed diff, including 305158 bytes of preserved third-party notices; this explains the estimate overrun rather than mixing harness token scales.

## Initial Task Verification (historical)

- Artifact tests: 15/15. Real ASAR clean controls and contaminated archives cover planning/env/private project/PDF/dev-dependency contamination, missing worker/preload resources/notes/fonts/licenses/dependency entries/closure and version mismatch. Tests inspect actual archives, not only YAML.
- Candidate-bound evidence tests: 11/11. Required 16-case completeness, provenance, hashes/version, numerical oracle comparison, developer-only rejection, actual predecessor classification/version and explicit unsupported-hardware review are exercised. Final focused release matrix: 26/26.
- `npm run build:win` passed typechecks, production bundling and actual full NSIS generation. Final configuration-only repackaging uses `node node_modules/electron-builder/cli.js --win --publish never` after explicit `publish:null`; no product bundle bytes changed after the frozen final candidate.
- `node scripts/verify-release.cjs dist` passes on the exact candidate.4506 ASAR files /108 actual production dependency locations. Actual appended7z inventory matches the whole unpacked inventory; extracted executable and ASAR hashes match. Windows PE architecture/product/version, local PDF worker/fonts/notes, parser entry/chunks, ExcelJS/yauzl closure and Electron/Chromium license resources are inspected. Supplied dependency license/readme texts and metadata are bundled.
- Actual packaged executable smoke passed twice, including the tracer feedback rerun before task 02 expansion. Main was paused through loopback debugging solely to configure disposable appData/scripted native-dialog destinations and suppress window visibility; the unchanged executable then loaded its own ASAR main/preload/renderer. `app.isPackaged:true`, sandbox/context isolation true, Node integration false and renderer `require` unavailable were observed.
- Smoke verifies real local notes/version; real blob PDF worker and colored PDF canvas pixels; UI save/read/reopen of semantic format 3; original PDF-byte hash; real packaged utility-process XLSX preview/commit; and actual internal XLSX/CSV writes with independent 390 price readback. External renderer HTTP(S)/WS(S) requests were blocked and none occurred. Temporary app-owned data was cleaned after process exit. No user desktop was driven.
- `npm run typecheck` passes both Node and web checks. Scoped release tooling/test ESLint passes; `git diff --check` passes. Existing broad lint debt remains unchanged.
- Full regression: **149 files / 1163 tests passed**, exit 0, 268.32 seconds, `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot`. The final evidence-validator correction also passed the 26-test focused release matrix.
- Actual installed-evidence validator returns exit 1 / `awaiting-evidence` as intended: required non-development cases, handoff ownership and edge reviews are pending. This is a correctly enforced external gate, not a passing acceptance result.

## TDD Gate Compliance

Both task RED records passed canonical `check tdd-red-evidence` with `RED_EVIDENCE_OK` before production implementation. Vitest nested TAP leaves were flattened for the runtime's Node-TAP parser, with raw output retained under `.planning/tmp/20-09-0N-red.json`. Initial sandbox realpath discovery failure was never accepted as RED. Task 01's RED commit preceded successful canonical normalization, but GREEN implementation began only after the normalized evidence was accepted. The required tracer inspector/smoke rerun passed before task 02. No refactor commit was needed.

## Deviations and Environment

1. **[Rule 2 — Critical payload admission]** Real inspection caught old phase19 projects/exports under `out/`. Narrowed packaging to `out/main`, `out/preload`, `out/renderer`, named resources/package metadata and production dependencies. No scratch work was deleted; it is excluded from the candidate.
2. **[Rule 2 — Critical manual-distribution policy]** Builder inferred a GitHub `resources/app-update.yml` from the Git remote even with no explicit publish provider. Inspector rejected it. Explicit `publish:null` and final repackaging removed the endpoint; no rejected installer was accepted.
3. **[Rule 3 — Build environment]** Official winCodeSign 2.6.0 extraction failed on Darwin OpenSSL symlinks because Windows lacked symlink privilege. Extracted only its supported Windows tools into the verified builder-cache destination, excluding Darwin/Linux and retaining original archive/provenance. Archive SHA256: `cdaec7154dda7cc31f88d886e2489379a0625a737d610b5ae7f62a12f16743a4`. No system security settings or executable metadata/signing checks were disabled. Official NSIS tools were fetched by the existing reviewed builder; no npm packages were installed.
4. **[Rule 2 — Evidence correctness]** Added production notice preservation and strict downgrade/placeholder evidence rejection. Actual upstream `buffers@0.1.1` package/README provides no license declaration/grant: its author/repository/README and null declaration are retained, and release review remains explicit. No license permission is invented.

## External Checkpoint and Remaining Review

**Gate:** blocking-human. **Precondition not met:** an accessible non-development Windows PC and representative approved construction PDFs are available; candidate installer/hash and predecessor inventory are known.

`20-INSTALLED-EVIDENCE.json` retains 16 pending actual installed cases: fresh install; actual deployed-predecessor upgrade; project-only transfer; saved/never-saved recovery; failed saves/backups; full offline workflow; large vector/scan/multipage navigation; physical 100/125/150/200% scaling; actual monitor transition; and long-content keyboard/focus UI states. Physical unsupported cases require actual hardware provenance plus named external review, and are never automatically recorded as pass. All four unclassified REL-01/02/04/05 edge reviews remain open.

Actual approved internal share, release owner, publisher/signing policy/owner, rollback contact, deployed history, representative fixture oracles and target-PC test evidence remain pending. Independent code/security review and phase verification precede the parent-owned authorized local physical/manual PC run. Developer-local results cannot satisfy required non-development evidence, and nothing here claims Phase 20 acceptance or Phase 21 pilot/twelve-PC distribution.

Compatibility/validation docs specify semantic writer 3/readers 1/2/3, first Save Upgraded Copy, detached backups, preserved originals/hard-link rejection, rollback via previous installer plus pre-upgrade project/data copies, 60-second snapshot limits, 20-candidate/4 GiB quotas and exact data locations. Phase 21 retains the complete offline guide, worked example, named maintainer turnover, two-user pilot and remaining-ten distribution.

Broken-windows entry 5 records this unmet actual evidence gate. No application stubs or skipped tests were introduced; intentionally null/pending evidence fields describe unavailable observations. Existing 36-advisory dependency review remains a scoped prior disposition, not whole-app security certification. No new production endpoint/auth/schema boundary was introduced; debugger access exists only when the test harness launches with an explicit loopback inspect switch.

## State Ownership

Parent-owned pre-existing STATE edits were preserved. This executor does not advance STATE, ROADMAP or requirements, and does not mark the phase globally complete. Only this halted summary and the directly relevant WINDOWS ledger update are included in the checkpoint metadata commit.

## Self-Check: PASSED

Both validator scripts, packaged smoke harness, preparation hook, tests, notices, compatibility/validation docs, candidate installer/ASAR, manifest and pending record exist. All five task commit hashes resolve; no tracked files were deleted. Frozen installer/ASAR hashes still match the manifest. Required real target-PC cases remain explicitly pending.

## Final review, native findings and candidate refresh2026-10-22

Current source e61ae4a; current installer/ASAR hashes are in the Candidate table above. Original task checks above are historical; this section supersedes their final-run/candidate claims. Eight independent review findings were corrected and the85-file re-review was clean; source UI audit24/24 remains the last visual audit. Native testing subsequently found tool switching801a532 and library focus e61ae4a; both are fixed and verified on the installed app.

Final full regression:157files/1228tests passed, exit0,420.92seconds; raw .planning/tmp/20-library-focus-full-regression.log. Both typechecks and production build passed; final NSIS packaging, actual payload inspection and measured packaged smoke passed. All149 installed payload files matched. Focused library/keyboard35tests passed; exact old-source reversion reproduced all4new failures. Scoped changed-file ESLint0errors0warnings. Parent reviewed the narrow15-line focus repair and behavioral regressions; this is an explicit delta review, not a new85-file independent review.

Actual developer-host native tests passed quantities10m/100m²/40m/30m²/1count,740cost/962selling/222margin and actual Excel/CSV readback, protected successful replacement backup, controlled saved-work interruption/restart/Keep/Restore/Save As with unchanged source/backup, local copied-project reopen, compatible library rate application and offline About. The final candidate repeated native picker cancellation in empty and Count-armed workspaces: Escape closes the library, restores its invoker and preserves Count placement. Final native Save As archive retains exact original geometry/scale/rates/PDF and962selling.20-MANUAL-TEST.md and20-MANUAL-EVIDENCE.json preserve actual per-run candidate hashes.

Initial independent goal verification plus the parent-owned focused amendment remains human_needed. All16actual target cases, real predecessor/non-development upgrade, representative PDFs, physical scaling/monitor transition and named organizational reviews remain pending. No release acceptance or Phase21 pilot is claimed.

## Additional installed manual checks — 2026-10-23

See20-MANUAL-EDGES.md and20-MANUAL-EDGES.json for actual never-saved recovery with absent source PDF, backup-lock failure/cancel/retry and detached backup Save As, synthetic legacy safeguards/upgraded copy, invalid/corrupt/oversized/10001-row library rejection and the third manual-discovered focus fix9a0349f. New candidate installer fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544, 136810568bytes; ASAR 5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd. Build/types, inspection, measured packaged smoke,149installed payload hashes and native corrected preview-cancel/Escape/Save As passed. Earlier observations retain e61 candidate provenance.

Regression qualification: initial full157files/1229tests had4failures and1225passes (806.37sec). Four-file isolated recheck passed3files/37tests, parser still failed; parser-only rerun passed2tests17.85sec. Every file has a passing result across runs; no single clean full run or confirmed cause for the intermittent parser failure is claimed. No expectation/deadline was relaxed. This stability limitation remains visible for review. External hardware, representative/historical construction PDFs, named reviews and Phase21 pilot/distribution remain pending.
