---
phase: 21-user-guide-and-internal-handover
plan: "02"
subsystem: documentation
tags: [maintainer, pilot, rollout, handover]
requires:
  - phase: 21-user-guide-and-internal-handover
    provides: 21-01 source-audited guide and independent documentation checker
provides:
  - Practical clean-checkout build, inspection, backup and triage handover
  - Pending owner exercises, two-PC pilot and ten-slot rollout records
affects: [21-03]
actuals:
  tokens: 11240
  tasks: 2
  commits: 2
plan_head_before: 3ab06eec52464c1b3dc392b840232ab623e59728
tech-stack:
  added: []
  patterns: [separate preparation and actual acceptance, candidate-bound evidence]
key-files:
  created: [docs/pilot-runbook.md, .planning/phases/21-user-guide-and-internal-handover/21-HANDOVER.md, .planning/phases/21-user-guide-and-internal-handover/21-PILOT.md, .planning/phases/21-user-guide-and-internal-handover/21-ROLLOUT.md]
  modified: [docs/maintainer-handover.md, .planning/phases/20-production-readiness/20-VERIFICATION.md]
requirements-completed: []
requirements-prepared: [HAND-02, HAND-03]
duration: not separately recorded
completed: "2026-10-23"
status: complete
---

# Plan 21-02 — maintainer and pilot preparation

**Practical maintainer exercises and candidate-bound pilot/rollout worksheets are ready, with all real owners, machine identities, results and approvals pending.**

## Accomplishments

- Extended the existing maintainer draft with clean checkout/lockfile/tool provenance, tests before packaging, version/notes, inspection/smoke, data protection, rollback, practical owner exercises and structured issue intake.
- Retained the original full-run 1225/1229 result, isolated passing reruns and intermittent parser qualification; signing/share/license/advisory/stability decisions stay pending.
- Added two actual-PC slots with estimator/hardware/fixture/oracle/expected/actual/artifact fields, a complete task matrix and all 16 guide state observations. Synthetic 740/962/222 practice remains separate from a representative job.
- Added ten unassigned rollout slots behind actual Phase 20 acceptance, demonstrated owners, two-PC estimator approval and separate explicit distribution approval.
- Reviewed the covered maintainer delta and amended Phase 20's canonical fingerprint with rationale; status/score/actual evidence were not promoted.

## Task commits

1. `16834aa` — Maintainer procedure, pending ownership/demonstration record and focused Phase 20 amendment.
2. `c76dd95` — Pilot procedure, two-PC worksheet and gated ten-slot rollout record.

## Validation

`node scripts/verify-handover.cjs` passed after both tasks (18,535 ms and 12,026 ms): 14 local guide references, two image alternatives and independent six-row financial/geometry/ZIP/PDF/XLSX/CSV/HTML checks. A separate read-only Markdown-reference/worksheet check passed for all five handover/runbook/record documents, **20 local links**, **16 state rows**, **two pilot slots** and **ten pending rollout slots**. Manual source review confirms script commands/storage/compatibility and actual approval ordering. Final SHA-256 recheck confirms all **32 protected files** still match the probe baseline. No original kit/results, app source, dependency, installer or real workstation data was changed.

Scoped ESLint, Prettier and Node syntax checks on the new checker completed with exit 0. No application suite/rebuild was run for these prose/checker changes; whole-phase regression/verification is not claimed while Plan 21-03 remains incomplete.

## Decisions and limitations

No names, devices, demonstrations, pilot observations or approvals were invented. The existing fixed-destination kit builder refuses an existing kit; the procedure uses a separate approved checkout/destination for any future revised handoff and explicitly identifies the preserved kit's older documentation. No distribution, messages, browser-policy workaround or fresh installer was produced.

`actuals` measures the two task commits from the recorded base before this summary; tokens are changed diff characters / 4 rounded up. HAND-02/03 are prepared, not accepted; completed requirements remain empty until actual human gates close.

## Next checkpoint

Plan **21-03-01** is a blocking-human checkpoint: actual fresh Phase 20 acceptance, named release/rate/support owners and documented demonstrations/decisions. Actual target hardware/representative and historical plans/physical displays, regression-stability and signing/dependency/share review are still open. Then obtain both actual estimators' guide/job acceptance; only afterwards seek explicit approval for the concrete remaining-ten distribution. No 21-03 SUMMARY or Phase 21 completion transition is warranted yet.

## Self-Check: PASSED

All five planned preparation documents exist and resolve their local links; two task commits exist; focused validation passed. Preparation is complete, while Phase 20 acceptance and all Phase 21 human/distribution gates remain open.
