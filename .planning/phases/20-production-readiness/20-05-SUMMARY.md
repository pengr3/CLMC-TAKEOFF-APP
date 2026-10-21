---
phase: 20-production-readiness
plan: "05"
subsystem: desktop-host
tags: [electron, identity, nsis, ipc, offline]
requires:
  - phase: 20-04
    provides: Main-frame version bridge and offline release notes
provides:
  - Stable installer identity and preserved clmc-takeoff userData
  - Trusted main-frame guard for project, file, export and library handlers
  - Explicit approved Electron 44.9.3 package-gate disposition
affects: [20-03, 20-06, 20-07, 20-09]
tech-stack:
  added: []
  patterns: [Early userData pinning, exact main-frame IPC sender validation]
key-files:
  created: [src/main/app-identity.ts, src/tests/identity-storage.test.ts, src/tests/host-security.test.ts]
  modified: [src/main/index.ts, src/main/ipc-handlers.ts, src/main/cost-library-ipc.ts, electron-builder.yml]
key-decisions:
  - Preserve existing clmc-takeoff storage independently of CLMC Takeoff product name.
  - Freeze com.clmc.takeoff appId and AUMID with per-user full NSIS retaining app data.
  - User explicitly approved exact Electron 44.9.3 age-only flagged version; yauzl 3.4.0 is verified OK.
requirements-completed: []
coverage:
  - id: D1
    description: Startup preserves seeded library and preferences and privileged handlers reject foreign frames.
    requirement: REL-02
    verification:
      - kind: integration
        ref: src/tests/identity-storage.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Supported sandboxed runtime operates with actual PDF worker, save and library access.
    requirement: REL-02
    verification: []
    human_judgment: true
    rationale: Runtime installation is blocked by a running Electron instance holding icudtl.dat; smoke has not run.
actuals:
  tokens: 8310
  tasks: 2
  commits: 4
plan_head_before: 09e2f8ece92f78cd4ee7b7eec512c8f1d51d2c09
duration: 13min
completed: 2026-10-22
status: halted
---

# Phase 20 Plan 05: Identity and Runtime Summary

**Stable CLMC identity preserves workstation data and guards privileged IPC; runtime installation paused at a verified Windows file lock.**

## Accomplishments

Task 01 completed: pin `%APPDATA%/clmc-takeoff` synchronously before ready or repository construction; appId/AUMID `com.clmc.takeoff`, product `CLMC Takeoff`, unchanged executable/package slug. Per-user full NSIS retains app data, stable shortcut/uninstall naming and removes the unsupported generic publisher endpoint.

Real temporary startup/repository integration loads seeded library and unchanged preference bytes. Every project/file/export/library handler validates originating main window, exact main frame and exact renderer URL before handler execution. Main version bridge uses the same predicate.

Actual read-only elevated HKCU/HKLM/WOW6432Node uninstall inventory found no CLMC registrations on this PC. Both clmc-plan-estimator and clmc-takeoff APPDATA directories exist; only clmc-takeoff has the library. No real data was moved, merged, changed or removed. No deployed predecessor is inferred.

Task 02 completed: user selected **Approve Electron 44.9.3 (Recommended)** after disclosed support/age effects, resolving the mandatory explicit gate. Canonical exact-version check reports Electron SUS solely too-new, official repository and 5,038,969 weekly downloads; yauzl 3.4.0 OK. Exact scripts, binaries, integrity and Node engine verified. See `20-DEPENDENCY-REVIEW.md` and CONTEXT D-05.

## Task Commits

- `8820aa3` test(20-05): specify preserved identity and privileged IPC boundary
- `3b29e53` feat(20-05): preserve workstation data under stable installer identity
- `059eb6c` docs(20-05): record approved runtime and exact package review
- `06d242e` test(20-05): specify sandbox and offline host restrictions

## Verification and TDD Gate Compliance

Task 01 RED intentionally failed on missing userData pinning, canonical RED_EVIDENCE_OK, then GREEN. Affected 49 tests passed; node/web typecheck passed. Tracer feedback re-run passed 13 tests across identity-storage, cost-library-store and project-save-flow.

Task 03 RED intentionally failed on sandbox:false, missing navigation/permission denial and hostile confirm-close acceptance; canonical RED_EVIDENCE_OK recorded. GREEN remains pending. The new identity test had explicit-any/return-type lint findings; unstaged type cleanup has been applied but awaits lint verification. Existing app-version explicit-any findings predate this plan.

## Deferred Issues and Continuation

Approved command `npm install --save-dev --save-exact electron@44.9.3` failed EBUSY renaming `node_modules/electron/dist/icudtl.dat` to `node_modules/.electron-9Xa9v1yQ/dist/icudtl.dat`. No retry or alternate package install occurred; yauzl install was not reached. Installed Electron remains 35.7.5 and package.json/lockfile dependency version remains unchanged.

Read-only process inspection identifies root PID 34408 running this exact checkout's `node_modules/electron/dist/electron.exe .`, with children 37616, 36824 and 40148. Parent orchestrator will inspect dirty state and close the identified app safely before authorizing retry. No process has been killed.

Task 03 partial **unstaged** changes remain in electron.vite.config.ts, package.json, src/main/index.ts, src/tests/app-version.test.ts and src/tests/identity-storage.test.ts: sandbox:true, preload bundling, navigation/popups/webviews/permissions denial, guarded confirm-close, truthful metadata, test mocks/type cleanup. These are incomplete and not represented as GREEN.

Remaining: safely release lock; install exact approved dependencies; check actual Electron binary installation; lint/host tests/build/full suite; actual sandboxed preload/PDF worker/project save/library smoke; replace this halted summary with complete actuals. Parent owns STATE/ROADMAP updates. Installed fresh/upgrade evidence belongs to plan 09.

## Deviations from Plan

Required TrustedSender parameters extend library IPC registration and update four existing isolated test registrations to inject explicit test trust. This closes the same privileged boundary without a permissive production default (Rule 2).

No migration/copy was needed because the established root is pinned; both legacy directories remain preserved. A CLI `name@version` invocation was unsupported and gave literal-name false nonexistence; exact canonical API with `version` parameter confirmed package identities, unchanged thresholds.

## Self-Check: PASSED

Created identity module/tests, dependency review, host RED tests and both RED records exist. All four recorded commits exist on the current branch. Runtime GREEN and required smoke are explicitly incomplete; this plan is halted, not complete.
