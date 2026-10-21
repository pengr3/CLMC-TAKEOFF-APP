---
phase: 20-production-readiness
plan: "04"
subsystem: ui
tags: [electron, version, offline, accessibility, release-notes]
requires:
  - phase: 20-01
    provides: Shared save outcome, dirty/Saving indicators and validated backup wire result
provides:
  - Trusted main-process installed version with explicit release-note availability and agreement
  - Visible app/version independent of truncated project names
  - Keyboard More menu and accessible offline About with recovery callback seam
affects: [20-03, 20-05, 20-07, 20-08, 20-09]
tech-stack:
  added: []
  patterns: [Named sender-validated release bridge, typed local release data, inert portal dialog]
key-files:
  created:
    - src/shared/release-info.ts
    - src/main/release-info.ts
    - src/renderer/src/hooks/useReleaseInfo.ts
    - src/renderer/src/components/AboutDialog.tsx
    - resources/release-notes.json
    - src/tests/app-version.test.ts
    - src/tests/about-release-notes.test.ts
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/components/TitleBar.tsx
    - src/renderer/src/components/TopActionBar.tsx
    - src/renderer/src/App.tsx
key-decisions:
  - Main app.getVersion is authoritative; releaseReady is false for unavailable or mismatched local notes.
  - Read resources/release-notes.json below app.getAppPath; final package and notes version remain plan 09 responsibility.
  - Keep recoveryAvailable and onRecoverClick as real-data integration props for plan 03; no fabricated candidates.
requirements-completed: [REL-01, REL-04]
coverage:
  - id: D1
    description: Main version travels through the real preload bridge to the protected title application segment
    requirement: REL-01
    verification:
      - kind: integration
        ref: src/tests/app-version.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Offline About contains focus, handles pending/error states and preserves Close outside scrolling content
    requirement: REL-01
    verification:
      - kind: automated_ui
        ref: src/tests/about-release-notes.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: More keyboard access and recovery visibility use explicit actual-candidate callbacks
    requirement: REL-04
    verification:
      - kind: automated_ui
        ref: src/tests/about-release-notes.test.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 10104
  tasks: 2
  commits: 4
plan_head_before: 1e362a542c7fe3241a351d025b7645248c6e1fc4
duration: 12min
completed: 2026-10-21
status: complete
---

# Phase 20 Plan 04: Trusted Version and Offline About Summary

**The title displays the actual main-process version, with a keyboard More menu opening locally bundled release notes and update/backup guidance in an accessible dialog.**

## Accomplishments

- Added `app:getReleaseInfo`, with no renderer-supplied arguments or paths. The handler validates the sender against the application window, requires its main frame and the exact expected renderer URL, then reads `app.getVersion()` and local JSON. Invalid/unreadable/missing notes return unavailable; a version mismatch returns `version-mismatch`; both make `releaseReady: false` without inventing a version or presenting mismatched notes.
- The preload declaration and implementation expose only `getReleaseInfo(): Promise<ReleaseInfo>`. Plan 01's optional validated `backupPath` was already synchronized in both `ReadProjectResult` declarations and was preserved. The shared hook handles transport failure and unmount without updating an obsolete component.
- Title filename text truncates independently of the nonshrinking app/version segment, with native caption-control clearance and a complete tooltip. Dirty and Saving indicators remain. Loading shows the app name without a guessed version; failure shows Version unavailable.
- More supports click, Enter, Space, arrows and Escape. Its portal avoids clipping within the horizontally scrollable toolbar. About selection restores focus to More before opening, so dialog closure returns to the invoker. The menu renders Recover Unsaved Work only when both the actual-candidate flag and callback are supplied.
- About uses local Inter/COLORS, bounded 640px width and viewport height, literal text rendering, wrapped/selectable paths, a separate internal scroll region, fixed footer Close, focus containment/restoration, inert background and keyboard propagation protection. Escape closes; backdrop clicks do not dismiss; Enter belongs to the focused control. No animation was added, so reduced-motion users receive the same static presentation.
- Bundled notes currently match package version 1.0.0 and explain manual installers, separate pre-upgrade copies, actual adjacent `${project}.bak` naming, no first-save backup, native picker recovery and recovery limits. A current project path is described conditionally as a location after a successful replacement save, without claiming an existing backup.

## Task Commits

1. Task 20-04-01 RED: `ab1e9e7`; GREEN tracer: `62e2354`.
2. Task 20-04-02 RED: `70d58b7`; GREEN offline About/menu: `f86c1c6`.

## Verification

- Task 1 required title/bridge command: 3 files / 8 tests passed; passed again after the tracer commit before expansion.
- Task 2 required About/menu/bridge command: 3 files / 14 tests passed. Final rerun after the menu-positioning lint correction also passed 14/14.
- `npm run typecheck`: node and renderer checks passed, including the final source state.
- Full regression: **133 files / 1006 tests passed**, 94.69 seconds. This ran before the final positioning-only lint correction; final focused regressions and typecheck passed after that correction.
- Scoped ESLint for the new release helper/types/hook and touched About/More/title components passed with `--quiet`. This does not claim whole-repository lint passed; previously recorded unrelated App/useCloseGuard warnings remain outside this plan.
- `git diff --check` passed. No tracked file deletion or package installation occurred.
- The current test harness mocks Electron transport, window lifecycle and unrelated IPC registration; the real main registration, preload API, local note reader and rendered title execute together. DOM tests cover loading/error, literal text, internal scrolling structure, long paths, no backdrop dismissal, Tab/Shift+Tab, Enter ownership, keyboard containment and invoker focus restoration. Installed Windows visuals/scaling are not inferred from jsdom styles.

## TDD Gate Compliance

Both named assertion failures were persisted in `20-04-01-red.json` and `20-04-02-red.json`; both returned `RED_EVIDENCE_OK` before production implementation. Task 1 failed because `getReleaseInfo` did not exist; Task 2 failed because ArrowDown could not open an About menu item. RED and GREEN commits are separate. The initial sandbox realpath EPERM was not accepted as RED. Test summary counts in the records transparently accompany the observed flat TAP target failures. No separate refactor commit was necessary.

## Integration Contracts and Remaining Phase Work

- `ReleaseInfo` contains `version: string | null`, `notes: ReleaseNotes | null`, `notesStatus: 'available' | 'unavailable' | 'version-mismatch'` and `releaseReady: boolean`. `ReleaseNotes` contains the exact installed version, nonempty text changes and compatibility explanation. Missing/mismatched notes must fail candidate acceptance in plan 09; the UI fallback is not a successful notes implementation.
- `TopActionBarProps.onAboutClick?`, `recoveryAvailable?: boolean`, `onRecoverClick?: () => void` are the plan 03 connection seam. App coordinates About against existing active modal decisions; recovery discovery remains plan 03's responsibility.
- Plan 05 may consolidate the release sender checks into its shared trusted-window policy without widening the no-argument bridge.
- The existing native picker does not yet expose `.bak`, and its open dispatch does not yet treat backups as unsaved copies. Plan 07 owns this planned backup-opening flow and must make About's native-picker instructions true before release. This dependency was reported to the parent; the current plan does not claim backup opening is already delivered.
- Plan 08 must include `resources/release-notes.json` below the packaged app root. Plan 09 owns the final package/notes version bump together and actual installed-version agreement. No final candidate, installed-PC, offline manual run, non-development-PC or rollout acceptance is claimed here.
- Shared STATE, ROADMAP and requirement progression remain the parent orchestrator's responsibility. No shared tracking files were edited by this executor.

## Deviations from Plan

1. **[Rule 2 - Required boundary seams]** Added `src/shared/release-info.ts`, `src/main/release-info.ts` and `src/renderer/src/hooks/useReleaseInfo.ts` to keep the narrow main-owned data contract consistent and make unavailable/mismatched local notes independently testable. No new service, dependency, endpoint, arbitrary file access or external URL opening was introduced. Included in `62e2354`.
2. **[Rule 1 - New UI lint issue]** Scoped review found a render-time ref read while positioning the new More portal. Moved positioning into the open effect and viewport-resize handler; scoped lint and final focused checks pass. Included in `f86c1c6`.
3. **[Rule 3 - Verification environment]** Sandboxed Vitest failed before discovery with Vite realpath EPERM. The exact command succeeded with approved escalation. Scoped Git commits and SDK temporary-file output similarly used the established required escalation. All RED/GREEN evidence comes from discovered tests.

## Known Stubs

None. The optional recovery props are the explicitly planned integration seam for plan 03. Package-version finalization, native backup opening and installed acceptance remain assigned to their later plans; no fabricated candidates, version fallback or mock product data were shipped.

## Self-Check: PASSED

All seven new production/test artifacts, both RED records and all four recorded task/test commits were verified on disk/in Git before summary creation. The four commits and 10,104 chars/4 realized-diff tokens were measured from the persisted plan ledger before this separate summary commit. The working tree contains only the parent's prior STATE/untracked workflow artifacts after task commits; none were staged by this executor.
