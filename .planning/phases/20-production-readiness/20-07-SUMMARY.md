---
phase: 20-production-readiness
plan: "07"
subsystem: persistence
tags: [electron, portable-projects, migration, recovery, rate-units, accessibility]
status: complete
requires:
  - phase: 20-01
    provides: Protected saves and coherent captured revisions
  - phase: 20-02
    provides: Explicit rate basis and unresolved-rate store actions
  - phase: 20-03
    provides: Completed recovery manifests and staged PDF adoption
  - phase: 20-04
    provides: About explanation and accessible dialog conventions
  - phase: 20-05
    provides: Trusted main-process IPC boundary and supported runtime
  - phase: 20-06
    provides: Reviewed yauzl lazy streaming API
provides:
  - Semantic format 3 writer and deeply validated readers for formats 1, 2 and 3
  - Source-free embedded archive roundtrip with bounded extraction
  - Explicit legacy rate acknowledgement and export/unit-change guards
  - Original-preserving upgraded copies and detached validated backup opens
  - Unfinished upgrade protection retained through the existing recovery format
affects: [20-09, project-compatibility, rollback, installed-validation]
tech-stack:
  added: []
  patterns: [shared pure metadata admission, staged PDF commit, explicit copy destination protection]
key-files:
  created:
    - src/shared/project-validation.ts
    - src/renderer/src/components/CompatibilityDialogFrame.tsx
    - src/renderer/src/components/LegacyRateReviewDialog.tsx
    - src/renderer/src/components/UpgradeProjectDialog.tsx
    - src/renderer/src/lib/compatibility-ui.ts
    - src/renderer/src/lib/legacy-rate-guard.ts
    - src/tests/project-portability-integration.test.ts
    - src/tests/legacy-rate-review.test.ts
    - src/tests/project-compatibility-ui.test.ts
  modified:
    - src/main/project-io.ts
    - src/main/project-storage.ts
    - src/main/ipc-handlers.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/lib/project-schema.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/renderer/src/hooks/useProject.ts
    - src/renderer/src/hooks/useExport.ts
    - src/renderer/src/stores/projectStore.ts
    - src/renderer/src/stores/scaleStore.ts
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/components/OpenErrorModal.tsx
    - src/renderer/src/App.tsx
key-decisions:
  - "Write formatVersion 3 with minimumReaderVersion 3 inside the existing project.json + plan.pdf ZIP container; older 1/2 readers reject 3."
  - "Keep valid legacy scalar prices and genuinely absent labor/markup defaults readable and unresolved; reject malformed explicit stored money in every admitted file version."
  - "Preserve upgrade/backup source protection in the exact shared recovery project JSON, and remove the old source association from a successfully saved portable copy."
  - "Require a different canonical destination and reject hard-link aliases when saving an upgraded or backup copy."
patterns-established:
  - "File/recovery admission is strict; defensive direct legacy hydration keeps its prior narrow coercion/default behavior."
  - "Unit-change rejection returns a result to the calibration popup so it cannot claim a successful calibration after opening rate review."
requirements-completed: [REL-03, REL-04, REL-05]
actuals:
  tokens: 32685
  tasks: 3
  commits: 6
commits: 6
plan_head_before: 2c64fb05ac5711de548166e748c25a95515d8147
duration: 33min
completed: 2026-10-22
coverage:
  - id: D1
    description: Source-free embedded projects preserve PDF, mixed page scales, geometry, arcs, walls, prices, visibility and order.
    requirement: REL-03
    verification:
      - kind: integration
        ref: src/tests/project-portability-integration.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Legacy prices require explicit acknowledgement before exports or unit changes; restored calibration remains available.
    requirement: REL-05
    verification:
      - kind: automated_ui
        ref: src/tests/legacy-rate-review.test.ts
        status: pass
      - kind: unit
        ref: src/tests/use-keyboard-shortcuts-export.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Upgrades, backup opens and future-format failures preserve original bytes and live work.
    requirement: REL-04
    verification:
      - kind: integration
        ref: src/tests/project-compatibility-ui.test.ts
        status: pass
      - kind: integration
        ref: src/tests/recovery-flow.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Installed-app readability, Windows scaling and actual project-only transfer.
    verification: []
    human_judgment: true
    rationale: "Plan 20-09 owns installed/manual evidence; automated DOM and archive tests do not establish another-PC or DPI acceptance."
---

# Phase 20 Plan 07: Portable Projects and Safe Upgrades Summary

**Format-3 embedded projects preserve geometry and prices, require explicit legacy rate review, and save upgrades/backups through protected new copies.**

## Performance

- First on-disk test artifact: 2026-10-22T01:55:01Z; completed: 2026-10-22T02:28:04Z.
- Tasks: 3/3; realized task/evidence files: 36.
- Actual tokens are chars/4 over the realized committed diff, rounded up, on the plan estimate's scale.
- Commit count was measured from the persisted plan ledger before this summary metadata commit.

## Accomplishments

- Real assemble/write/read/extract/migrate/hydrate test deletes the source PDF and restores a two-page PDF with mixed scales, all five markup types, off-page geometry, arcs, wall heights, rate basis, prices, visibility and category/item order. No library or source-path lookup supplies restored project prices or embedded PDF bytes.
- One shared pure admission module validates supported semantic versions, finite/broadly bounded geometry, positive dimensions/scales/zoom, page counts/indices, arc edge indices, known units, collections and explicit monetary data before active state mutation. PDF decode, page count and dimensions are staged before committing stores. Missing legacy sources, invalid nested data, decode failures and future formats keep the active document.
- Project extraction admits exactly two expected entries, checks declarations and streamed bytes/CRC, and bounds metadata to 64 MiB and PDF to 1 GiB. This is independent of workbook caps. An 11 MiB byte-preservation admission test and forged oversized metadata declaration cover the resource boundary; this is not a large real-world PDF performance claim.
- The review dialog covers zero/one/many entries, partial review, busy controls, checkbox acknowledgement, long rows, scrollable content, readable tabular rates, keyboard containment, Escape and focus restoration. Warning state remains derived from unresolved prices. Both normal/confirmed exports recheck the guard, including after the native picker. Global unit changes and existing-page display-unit changes are guarded; hydration and new/restored calibration are not recursively blocked.
- Upgraded saves require Keep Original Project / Save Upgraded Copy, suggest a new filename, and use native Save As. Main rejects original/backup canonical aliases and hard links. Cancellation/failure keeps dirty work and previous failure information. Future files cannot be replaced by Save As. The native Open filter now includes backups, and validated `.clmc.bak` files open detached/dirty with their next Save routed to a different copy.

## Compatibility and Rollback Contract

- Current semantic writer: **3**, with **minimumReaderVersion: 3**. Container stays `project.json` + `plan.pdf`; the existing transport discriminator `v2-zip` still names that container.
- Normal readers support legacy plain JSON **1**, embedded **2**, and embedded **3**. Old 1/2 readers reject semantic 3; returning to an old release requires the preserved pre-upgrade original. No lossy backward writer is provided.
- Valid old scalar rates remain material-only with labor 0 and markup 30. Valid basis-less objects retain explicitly supplied nonnegative numeric fields; genuinely absent labor/markup retain defaults 0/30. Basis is inferred from saved units and remains `legacy-unresolved`, without a historical correctness claim. Negative, nonfinite, null or wrongly typed explicit stored monetary values are rejected during file/recovery admission in every supported version.
- Direct legacy `hydrateStores` calls retain defensive coercion and their absent-unit fallback for internal callers. Disk/recovery readers always perform strict admission first. Format 3 is strict even for direct hydration.
- Recovery manifest version remains **1**, embedding the exact shared project JSON and PDF hash. Existing valid format-2 recovery snapshots and new format-3 captures remain supported. Unfinished upgrade/backup protection survives restart. The destination-availability IPC still accepts only the opaque recovery session ID and resolves its association in main.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 1. Portable archive and staged admission | `7ed02b9` | `28b1161` |
| 2. Explicit legacy review and guarded boundaries | `c04b83b` | `a0619ef` |
| 3. Original-preserving upgrades and backups | `4b0a6aa` | `f2963ea` |

The final GREEN also completes strict legacy admission, recovery preservation, the actual scale-popup entry point, and fixture updates required by the new semantic writer.

## Verification

- Full regression: **147 files / 1137 tests passed**, 369.94s, `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot`.
- Final focused correction matrix: 57/57; public schema/serialization matrix: 44/44. Compatibility suite: 12/12. Initial source-free tracer verification passed before expanding to review work.
- `npm run typecheck` and gated `npm run build`: passed. Build still emits `out/main/cost-library-worker.js` for Plan 09 packaging.
- Scoped semantic lint has no introduced errors. Existing CanvasViewport findings compare identically with plan-start `2c64fb0`: 15 errors/four warnings, zero rule/message differences. Six useProject dependency warnings also match baseline exactly. Inherited formatting/CRLF noise was excluded from semantic lint; new files were formatted. Details are in `deferred-items.md`.
- No new stubs, skipped tests or unrun automated plan verifications remain. Existing React act warnings and the existing PDF static/dynamic-import build warning remain unchanged.

## TDD Gate Compliance

All three required RED/GREEN pairs exist. Each persisted `20-07-0N-red.json` passes `check tdd-red-evidence` with `RED_EVIDENCE_OK` for its named assertion failure. Vitest's TAP-flat leaf outcomes were counted into the Node-style summary required by the runtime checker; raw assertion evidence is retained. A later page-unit regression first failed with m→ft mutation and passed after the setter/popup guard fix. No separate refactor gate was needed.

## Deviations from Plan

1. **[Rule 2 - Missing critical functionality] Shared main/recovery admission and copy protection.** Added the pure shared validator and the directly necessary main/preload/store seams so renderer format 3, saved archives and existing recovery snapshots agree. Canonical path and inode checks enforce the preserved-original promise beyond renderer string comparisons. Covered by archive, compatibility and recovery integration tests; completed in `28b1161` and `f2963ea`.
2. **[Rule 2 - Missing critical functionality] Actual scale-popup entry point.** `setScale` now rejects a changed existing page unit when legacy rates remain unresolved, and CanvasViewport honors the rejection instead of closing the popup and claiming success. Hydrate/new calibration remain available. Covered by the legacy review regression; `f2963ea`.
3. **[Rule 3 - Blocking] Updated obsolete test fixtures/mocks.** Existing arc/order/rate fixtures now distinguish the format-3 writer from explicit format-2 legacy inputs, provide valid dimensions/pages, and use staged PDF mock actions. Runtime compatibility was not weakened to accommodate invalid fixtures; `28b1161` and `f2963ea`.

## Issues Encountered

- Sandbox `realpath` EPERM required exact authorized host-access retries for tests and commits.
- A deep-equality assertion over an 11 MiB Buffer exhausted the test runner's memory. The identified runner was stopped, the assertion changed to exact SHA-256 byte comparison, and the corrected test passed. Production archive behavior was unchanged by this harness fix.
- The first full run found four old tests injecting legacy values into new writer output. Explicit legacy fixtures and the defensive internal hydrate fallback corrected them; the final complete rerun passed.
- No package installs, authentication gates, new network endpoints or unplanned schema trust boundaries were introduced.

## Next Phase Readiness

Plan 20-09 can package and validate the committed format-3 app. Verify the native backup picker, upgraded-copy cancellation/error flows, rate review, long content and DPI in the installed app. Actual non-development-PC transfer and Phase 21 pilot/distribution remain separate evidence; none is claimed here. The parent orchestrator owns STATE/ROADMAP/requirements advancement; this executor preserved its dirty state file.

## Self-Check: PASSED

The summary and required new source/test artifacts exist; all six task commits resolve. The complete regression suite, typecheck and production build passed at source HEAD `f2963ea`.
