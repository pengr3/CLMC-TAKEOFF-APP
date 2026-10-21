---
phase: 20-production-readiness
plan: "05"
subsystem: desktop-host
tags: [electron, identity, nsis, ipc, sandbox, offline]
requires:
  - phase: 20-04
    provides: Main-frame version bridge and offline release notes
provides:
  - Stable installer identity and preserved clmc-takeoff userData
  - Trusted main-frame guard for project, file, export, library and close IPC
  - Reviewed Electron 44.9.3 and yauzl 3.4.0 lockfile
  - Sandboxed offline host with reproducible actual-runtime PDF/save/library smoke
affects: [20-03, 20-06, 20-07, 20-09]
tech-stack:
  added: [electron 44.9.3, yauzl 3.4.0, tar 7.5.21 transitive override]
  patterns: [Early userData pinning, exact main-frame IPC sender validation, bundled sandbox preload]
key-files:
  created: [src/main/app-identity.ts, src/tests/identity-storage.test.ts, src/tests/host-security.test.ts, scripts/smoke-electron-host.cjs]
  modified: [src/main/index.ts, src/main/ipc-handlers.ts, src/main/cost-library-ipc.ts, electron-builder.yml, electron.vite.config.ts, package.json, package-lock.json]
key-decisions:
  - Preserve clmc-takeoff storage independently of the CLMC Takeoff product name.
  - Freeze com.clmc.takeoff appId and AUMID with per-user full NSIS retaining app data.
  - User explicitly approved Electron 44.9.3 age-only flag; yauzl 3.4.0 and tar 7.5.21 verified OK.
  - Keep electron-builder 26.8.1 and override only its compatible critical tar dependency.
requirements-completed: []
coverage:
  - id: D1
    description: Startup preserves seeded library/preferences and rejects foreign frames.
    requirement: REL-02
    verification:
      - kind: integration
        ref: src/tests/identity-storage.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Actual sandboxed Electron renders a PDF worker and saves/reopens an embedded project with preserved library data.
    requirement: REL-02
    verification:
      - kind: integration
        ref: node scripts/smoke-electron-host.cjs
        status: pass
      - kind: unit
        ref: src/tests/host-security.test.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 24305
  tasks: 3
  commits: 7
commits: 7
plan_head_before: 09e2f8ece92f78cd4ee7b7eec512c8f1d51d2c09
duration: 28min active execution across continuations
completed: 2026-10-22
status: complete
---

# Phase 20 Plan 05: Identity and Runtime Summary

**CLMC identity retains workstation data while Electron 44.9.3 runs the offline renderer in a sandbox with verified PDF worker, library IPC and embedded-project save/reopen.**

## Accomplishments

Task 01 pins `%APPDATA%/clmc-takeoff` synchronously before ready or repository construction. Installer/runtime appId and AUMID are `com.clmc.takeoff`, product is `CLMC Takeoff`, and executable/package slug is unchanged. Per-user full NSIS retains app data and stable shortcut/uninstall naming. Scaffold publisher/homepage metadata is removed; package author is the evidenced internal CLMC name.

Real temporary startup/repository integration loads seeded library and unchanged preference bytes. Project/file/export/library handlers and version bridge require the exact originating main window, main frame and renderer URL. Confirm-close now uses that guard without throwing into the send-style event loop.

Read-only elevated HKCU/HKLM/WOW6432Node uninstall inventory found no CLMC registrations on this PC. Both clmc-plan-estimator and clmc-takeoff APPDATA directories exist; only clmc-takeoff has the library. No real data was moved, merged or changed. No deployed predecessor is inferred.

Task 02 resolved the mandatory explicit package gate: user selected **Approve Electron 44.9.3 (Recommended)** after disclosure of support dates, effects and age-only flag. Exact source, scripts, integrity, engine and download evidence is in `20-DEPENDENCY-REVIEW.md`; CONTEXT D-05 records the decision. Yauzl 3.4.0 is verified OK.

Task 03 installs exact Electron **44.9.3** and yauzl **3.4.0** with lockfile. The actual launched Windows binary reports Chromium **152.0.7977.167**. Electron 44 remains supported through the official schedule's 2027-03-02 date. Its reviewed explicit installer obtains the matching checksummed binary; it has no npm postinstall. Builder remains 26.8.1. The critical build-time tar 7.5.13 advisory is removed by a verified compatible tar 7.5.21 override.

The window uses sandbox:true, contextIsolation:true and nodeIntegration:false; preload dependencies are bundled. It denies navigation, frame navigation, redirects, webviews, popups and permission request/check grants. PDF blob-worker CSP is retained.

## Actual Runtime Smoke

`npm run build` then `node scripts/smoke-electron-host.cjs` runs the actual production main/preload/renderer invisibly with disposable appData. The final smoke passed:

- Actual Electron 44.9.3 with sandbox/context isolation enabled, Node integration disabled and renderer require unavailable.
- Real cost-library IPC loads seeded data; library bytes remain unchanged.
- Actual blob PDF worker target and colored canvas pixels prove real parsing/rendering; fake-worker fallback fails the smoke.
- Actual UI Open/Save, privileged IPC, on-disk embedded PDF archive, hash/byte readback and UI project reopen.
- Parent removes scratch data after Electron exits; real workstation state is untouched.

The reproducible command is `npm run smoke:host`. This development-host evidence does not replace Plan 09's actual fresh-install/upgrade validation or Phase 21's non-development-PC pilot.

## Task Commits

| Task | Result | Commits |
| --- | --- | --- |
| 01 | Identity, preserved storage and trusted IPC | `8820aa3` RED, `3b29e53` GREEN |
| 02 | Exact package evidence and human gate disposition | `059eb6c` |
| 03 | Supported sandboxed host and actual runtime smoke | `06d242e` RED, `b4a295f` GREEN |

Interim checkpoint documentation: `a06c03c`, `4842cd7`. Measured ledger base is recorded above; 7 commits precede this final summary commit.

## Verification and TDD Gate Compliance

Task 01 RED intentionally failed on missing userData pinning and sender validation; canonical RED_EVIDENCE_OK preceded implementation. Affected tests and tracer re-verification passed. Task 03 RED intentionally failed on sandbox:false, missing denial and hostile confirm-close; canonical RED_EVIDENCE_OK preceded GREEN. Completed tasks were not repeated and the human package gate was not silently bypassed.

- Focused host/identity/version tests: **8 passed**.
- Full regression: `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot` — **138 files, 1,034 tests passed**, exit 0, 146.96 seconds.
- `npm run build` — passes node/web typecheck and production bundling.
- Scoped ESLint for new host/identity tests, host/config and smoke script — passes.
- Final actual Electron smoke — passes, including after the tar lockfile patch.
- `git diff --check` — passes; product stub scan found no stubs.

Existing app-version test lint debt and React act warnings remain in `deferred-items.md`; whole-repo lint is not represented as clean. The existing PDF static/dynamic import build warning remains.

## Dependency Advisory Review

Final audit: **36 findings, 0 critical / 24 high / 10 moderate / 2 low**. Critical archive-processing tar was patched. Remaining advisories have concrete API/platform/input dispositions in `20-DEPENDENCY-REVIEW.md`: unused ExcelJS streaming/glob/tmp APIs, jsdom-only undici, Linux AppImage builder paths, authenticated redirect preconditions and dev-server/build tooling boundaries. These are scoped reachability findings, not whole-app certification. Packaged-content verification and phase security review remain required. Plan 06 must still bound XLSX import resource use.

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Extend trust to library registration.** Required TrustedSender parameters extend library IPC and existing isolated tests use explicit test trust; no permissive production default. Included in task 01.

**2. [Rule 2 - Missing Critical] Fix critical build archive dependency.** Tar 7.5.13 can exhaust resources on malicious build archives. Official exact tar 7.5.21 metadata and canonical package gate OK preceded its compatible override; only one additional package changed. Included in `b4a295f`; WINDOWS entry 4 is fixed.

**3. [Rule 3 - Blocking] Recover build environment and test execution.** The original EBUSY lock cleared without killing the user's app; exact approved package retry succeeded. Binary extraction then hit ENOSPC. Removed only inventoried obsolete Electron 39/40 cache ZIPs, retained 35 rollback/44 current ZIPs, and used npm's verified download-cache cleanup. About 10.7 GiB became available. A stalled owned Vitest process pool was stopped and the same full suite passed with two thread workers. Environmental failures are not treated as passing tests.

## Deferred Issues and Handoff

Plan 09 retains actual installed fresh/upgrade evidence; Plan 07 verifies packaged contents. Plan 06 implements the bounded parser with reviewed yauzl. Parent orchestrator owns STATE/ROADMAP/requirements updates; the executor preserves the parent's existing STATE edits and does not mark whole-phase requirements complete.

Existing app-version.test.ts explicit-any/return-type lint debt is WINDOWS entry 3, open; other baseline hook entries remain open. No product stubs, skipped tests or unrun final verification remain. No new undocumented security surface was introduced.

## Self-Check: PASSED

Identity module, both integration/security tests, exact lockfile, dependency review and reproducible smoke script exist. All seven recorded commits exist. Task changes are committed; parent STATE changes are intentionally unstaged. This completed summary replaces the earlier halted checkpoint.
