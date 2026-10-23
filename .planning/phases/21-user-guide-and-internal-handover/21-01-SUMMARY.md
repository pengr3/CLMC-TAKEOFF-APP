---
phase: 21-user-guide-and-internal-handover
plan: "01"
subsystem: documentation
tags: [offline-guide, handover, validation]
requires:
  - phase: 20-production-readiness
    provides: frozen candidate and retained trial kit; acceptance still open
provides:
  - Read-only guide/reference/financial validation with negative copied controls
  - Source-audited eight-section guide ready for human walkthrough
affects: [21-02, 21-03]
actuals:
  tokens: 7367
  tasks: 2
  commits: 2
plan_head_before: bf02b28270ee216c9b76560e52cf8338dee59c50
tech-stack:
  added: []
  patterns: [reuse independent training oracle, preserve frozen candidate and kit]
key-files:
  created: [scripts/verify-handover.cjs, .planning/phases/21-user-guide-and-internal-handover/21-GUIDE-EVIDENCE.md]
  modified: [docs/offline-guide/index.html]
requirements-completed: []
requirements-prepared: [HAND-01]
duration: 20min
completed: "2026-10-23"
status: complete
---

# Plan 21-01 — offline guide preparation

**A read-only checker and source-audited guide verify the synthetic worked example without changing the frozen candidate or claiming human acceptance.**

## Accomplishments

- Checked all eight guide sections against actual source controls and retained installed evidence; refined scale labels, library scope/manual overrides, unit list, keyboard caveats and missing-file/support guidance.
- Validated 14 local references, two image alternatives and independent ZIP/PDF/geometry/rates/XLSX/CSV/HTML values: six rows, cost 740, selling 962, margin 222.
- Eight disposable corruption probes rejected; missing-link and wrong-export-value CLI probes exited 1. The intact guide passed again after changes.
- SHA-256 comparison of 32 protected example/image/kit/candidate files was unchanged. Existing kit/results and application source were preserved.

## Task commits

1. `2096d5a` — Read-only checker and provenance/negative-control evidence.
2. `7ec0cd1` — Guide corrections and eight-section source audit.

## Checks and deviations

`node scripts/verify-handover.cjs` passed repeatedly (recorded 13,770 ms, 9,541 ms and 18,757 ms). Full evidence and probe path: `21-GUIDE-EVIDENCE.md`. Syntax and scoped tooling checks are tracked with execution close-out. No app regression suite or rebuild was warranted for this documentation/checker change.

Windows native asynchronous realpath returned EPERM; the checker uses Node's canonical `realpathSync` implementation, retaining containment. Initial wrong-CSV probe targeted an unchecked subtotal; it was corrected to mutate the independently checked grand total, then confirmed as both API rejection and CLI exit 1. No new package or browser workaround was used.

`actuals.commits` measures the two task commits before this summary from the recorded base; tokens are changed diff characters / 4 rounded up, not model usage. HAND-01 is prepared, not accepted; its completed-requirement list deliberately remains empty because the actual guide walkthrough belongs to 21-03.

## Remaining human work / next plan

All 16 guide UI-probe states and actual estimator comprehension remain unobserved. The inherited browser-policy denial was respected. Phase 20 remains VERIFYING with actual target-PC/representative/historical-PDF/display and named release/dependency/signing/stability reviews pending. Continue 21-02 documentation and pending pilot/ownership/rollout materials; stop at 21-03 actual human gates.

## Self-Check: PASSED

All three declared deliverables exist; both task commits exist; focused validation and negative controls pass. Only the plan's preparation scope is complete.
