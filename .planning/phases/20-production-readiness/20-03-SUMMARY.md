---
phase: 20-production-readiness
plan: "03"
subsystem: recovery
tags: [electron, recovery, persistence, zustand, accessibility, vitest]
requires:
  - phase: 20-01
    provides: Coherent PDF/state capture and revision-aware protected explicit save
  - phase: 20-02
    provides: Portable rate basis and unresolved review metadata
  - phase: 20-04
    provides: More menu recovery callback and availability seam
  - phase: 20-05
    provides: Pinned userData and exact trusted top-frame sender policy
provides:
  - Completed local metadata/PDF recovery for saved and never-saved documents
  - Serialized bounded repository with PDF deduplication and exact revision retirement
  - Accessible restart, keep, recover, confirmed discard and persistent warning interactions
affects: [20-07, 20-09]
tech-stack:
  added: []
  patterns: [hash-addressed immutable PDF blobs, checksummed completed manifests, staged PDF adoption, exact session-revision retirement]
key-files:
  created:
    - src/main/project-recovery.ts
    - src/shared/reliability.ts
    - src/renderer/src/components/RecoveryDialog.tsx
    - src/tests/recovery-flow.test.ts
    - src/tests/recovery-repository.test.ts
    - src/tests/recovery-ui.test.ts
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.tsx
    - src/renderer/src/components/StatusBar.tsx
    - src/renderer/src/hooks/useProject.ts
    - src/renderer/src/hooks/usePdfDocument.ts
    - src/renderer/src/stores/projectStore.ts
    - src/tests/totals-slider-state.test.ts
key-decisions:
  - Keep all completed candidates unless explicitly discarded or retired after a successful matching save; quota pressure refuses new protection without eviction.
  - Recover by decoding the PDF before synchronous store adoption; retain saved association and dirty state without writing the source.
  - Reuse the current project serializer and migration reader inside manifest schema 1; recovery does not define a parallel project format.
  - Probe a restored destination using only its opaque recovery session ID and acquire the save lock before asynchronous availability checks.
requirements-completed: [REL-03, REL-04]
coverage:
  - id: D1
    description: Saved and never-saved PDF/state survives repository recreation and restores dirty without source or library writes
    requirement: REL-03
    verification:
      - kind: integration
        ref: src/tests/recovery-flow.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Completed recovery preserves last-good work through corruption, quota, disk-stage failures, stale deletion and exact retirement
    requirement: REL-04
    verification:
      - kind: integration
        ref: src/tests/recovery-repository.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Restart decisions, safe Keep/Discard, More reopening, keyboard focus, overflow and persistent protection feedback
    requirement: REL-04
    verification:
      - kind: automated_ui
        ref: src/tests/recovery-ui.test.ts
        status: pass
    human_judgment: true
    rationale: Actual installed Windows termination/restart, DPI readability and representative construction-plan measurements remain plan 20-09.
actuals:
  tokens: 36252
  tasks: 3
  commits: 10
commits: 10
plan_head_before: 4748a0ed72fd9740e9c35b44124648f65f707f41
duration: 24min
completed: 2026-10-22
status: complete
---

# Phase 20 Plan 03: Bounded Local Recovery Summary

**Coherent PDF/state snapshots now survive restart, restore as dirty, and stay protected until an exact successful save or deliberate discard.**

## Performance

- Started approximately 2026-10-21T23:52Z (2026-10-22 07:52 Asia/Manila).
- Three tasks completed; 18 source/test/evidence files changed.
- Actuals use chars/4 over the realized Git diff from the persisted ledger, not harness usage. Ten commits measured before this separate summary commit.

## Accomplishments

- A 60-second dirty-only schedule freezes the existing Plan 01 metadata, independent PDF bytes, document session and edit revision before awaiting hash/dimensions. Unchanged protected revisions cause no writes. Save waits for an in-flight capture; document switches/PDF replacement cannot destroy its PDF proxy. Background success never acknowledges Saved or clears dirty state.
- Main publishes only flushed, validated completed manifests with matching immutable PDF blobs. Repository recreation restores real fixture PDF bytes, markup coordinates, scales, rates/basis/review and ordering without an original source PDF. Existing monitor-independent viewport auto-fit is retained; the restored page is not reset by PDF adoption.
- Recovery validates manifest checksum, project structure/rates, PDF checksum, PDF decoding and page count before synchronous hydration. Failed validation or PDF decoding leaves the active project, PDF document/bytes and local library intact. Saved recovery retains its source association and dirty state; never-saved recovery has no destination. Restore writes no original project. Unavailable/read-only associations route Save through the native Save As picker.
- All eight UI-03 predicates are implemented: zero suppresses prompts; completed one/many entries show newest-first metadata; incomplete staging is excluded; corrupt metadata/PDF stays visible and retained; scanning/restoring/deleting blocks duplicate actions; long lists scroll with actions visible; names/paths wrap; keyboard focus is contained/restored. Keep/Escape preserves data, no background refresh repeats the prompt, More reopens kept work, and restart offers it again.
- Discard uses a separate confirmation with Keep Recovery Copy initially focused. Deletion includes the selected revision, preventing a stale list from deleting newer work. A failed deletion retains its candidate and uses truthful deletion-specific copy. Startup scan failure can be retried from More.
- Successful explicit save retires only the corresponding protected session/revision covered by that capture. Failed/canceled saves retain recovery. Explicit live discard retires its corresponding revision before close/open continues; failed retirement keeps the live project open. A newer or different candidate is protected. Persistent snapshot failures update one readable status warning with Save Project; successful retry clears it.

## Repository Limits and Retention

- Location: pinned userData/recovery, constructed only after plan 20-05 storage identity initialization.
- Defaults: **20 completed candidates, 4 GiB total logical bytes**, including existing staging, blobs, manifests and other repository contents. Metadata reads are bounded at 64 MiB; project JSON admission reserves encoding headroom.
- Admission accounts for the complete new blob (if absent) plus staged manifest while the previous manifest still exists. It refuses insufficient headroom and never evicts kept or last-good work.
- PDF SHA256 is its generated blob filename; one generated UUID manifest per document session records the latest completed revision. Metadata and identity fields have a checksum. UUID stage files are never valid advertised protection.
- Cleanup follows a successful completed transaction or explicit deletion/retirement and touches only owned unreferenced blob/stage names. An unreadable manifest suppresses blob pruning. Failed writes leave the previous completed manifest available; orphan bytes remain counted until safe cleanup.
- Measured storage smoke: the 391-byte real fixture plus 16 MiB padding is deduplicated across multiple revisions and two sessions into **one PDF blob and under 10 KiB combined manifest overhead**. This is an admission/deduplication measurement, not a representative construction-PDF performance or installed crash benchmark; those checks remain plan 20-09.

## Bridge and Integration Contracts

- Named operations: listRecovery(), writeRecovery(input), readRecovery(id), deleteRecovery(id, expectedRevision), retireRecoveryRevision(session, revision), recoveryDestinationWritable(session).
- Main reuses the exact trusted window/top-frame/URL policy from app-identity. Recovery IDs must be UUIDs; the renderer never supplies recovery filesystem paths. The destination probe resolves only the stored association for an opaque session ID.
- Manifest schema 1 embeds the existing projectJson unchanged alongside its PDF hash. Plan 20-07 must update shared serialization/migrate/parseProjectMetadata together when introducing the new project format, while retaining supported existing format-2 recovery metadata. Rate basis/review follows the shared snapshot and is never silently acknowledged.
- usePdfDocument exposes stagePdfFromBytes and adoptStagedPdf so recovery can decode before replacing the active PDF. Local library loading/replacement is outside recovery and is never invoked.
- App listens for recovery completion/retirement notifications without reopening a kept prompt, supplies the existing More availability/callback seam, and reuses Save/Discard/Cancel before replacing dirty live work.

## Task Commits

1. Task 1 RED: b8a71b9; GREEN disk-restart tracer: 0197b62; shared type import correction: 46c35b3.
2. Task 2 RED: 319d039; GREEN bounded repository/fault matrix: 51a0fc5.
3. Task 3 RED: e9f3e72; GREEN UI/lifecycle: 3613d4f; truthful deletion error: 8a7bd38; failed-scan retry: 3181d12; App harness integration: 0910070.

## Verification

- Recovery suites: **40 tests** across recovery-flow (7), recovery-repository (20), recovery-ui (13).
- Recovery plus existing save flow/guard suites passed 53 tests before the final additional scan-retry case. The final UI and affected totals-slider App shell tests passed **19/19** together after the harness correction.
- Final full regression: **141 files / 1,074 tests passed**, 137.29 seconds, using node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot.
- Final node and renderer TypeScript checks passed. npm run build passed, producing main, sandbox preload, renderer and bundled PDF worker. The existing static/dynamic PDF import chunk advisory remains non-blocking.
- Scoped ESLint: **0 errors**. Remaining 597 warnings are inherited formatting/hook-dependency advisories in touched legacy files; the new repository, shared contracts, dialog, App and status/PDF adoption files have no lint errors.
- git diff --check passed; all created artifacts and ten recorded commits exist; no unexpected tracked-file deletions. No tests were skipped, no no-tests fallback was used and no packages were installed.

## TDD Gate Compliance

All three tasks have an intentional assertion-failing RED record validated as RED_EVIDENCE_OK before GREEN:

| Task | RED behavior | GREEN |
|---|---|---|
| 20-03-01 | Recovery capture action absent before real disk-restart integration could proceed | Coherent persisted PDF/state restores dirty and Save routes to Save As |
| 20-03-02 | Unchanged writes, absent quota/fault preservation and unsafe retirement | Deduplication, full transaction admission, retained corrupt entries and exact serialized retirement |
| 20-03-03 | No separate safe discard decision and incomplete UI states | Focused safe confirmation, all UI-03 states, saved routing, persistent warnings and App integration |

The first tracer invocation hit sandbox realpath EPERM and then static import discovery for the not-yet-created module; neither was accepted as RED. The corrected named assertion failed intentionally. Records store the target flat-TAP excerpt with actual run totals. The initial tracer GREEN needed a shared type import correction; TypeScript passed before task 2 expansion.

## Deviations from Plan

1. **Sequencing adjustment:** Introduced the repository/shared contracts/thin decision component during the tracer rather than temporarily colocating them in main index/App. This allowed an actual disk-restart test against a node-owned module and avoided a throwaway alternate format. Task 2 hardened the same repository.
2. **[Rule 2 - Critical restore/save seams]** Added staged PDF decode/adoption in usePdfDocument, the shared persistent warning field in projectStore, a main-owned destination-availability probe and an availability-check save lock. These are required to preserve the active PDF on failed restore and prevent pairing another document with a recovered source destination.
3. **[Rule 1 - Integration]** Updated totals-slider-state's existing project-hook mock for the new scheduler and allowed an absent bridge in the isolated App shell. The first full regression found six harness failures plus related unhandled rejections; targeted checks and the final full rerun resolved them.
4. **Execution environment:** Exact scoped checks/commits required the established filesystem escalation for Windows Vite realpath and Git metadata. No approval rejection, authentication gate or package installation occurred.
5. **Global state ownership:** Per orchestrator instruction, this leaf executor did not run legacy SDK STATE/ROADMAP/requirement mutations because they corrupt the project's historical counters. The parent owns global reconciliation; its pre-existing dirty STATE and untracked AGENTS/runtime/cache files were preserved. Shared REL-03/REL-04 are not marked globally complete by this plan.

## Known Stubs

None. Empty initialization arrays/nulls are deliberate store/dialog state, not unwired product data.

## Next Phase Readiness

Recovery is implemented and headlessly verified. Plan 20-07 still owns format-floor/legacy-rate-review/backup-open compatibility. Installed forced termination, real construction PDFs, reduced effective viewport/DPI feel, upgrade and non-development-PC acceptance remain plan 20-09. No installed release or whole-phase REL completion is claimed.

## Self-Check: PASSED

After writing this summary, all listed source/test artifacts and ten task/test commits were verified again on disk/in Git. Final full regression passes 141 files / 1,074 tests. The parent-owned global state changes and unrelated untracked files remain outside this plan's commits.
