# Phase 20 context — approved internal rollout

Captured 2026-10-21 from the completed user discussion. See ../../RELEASE-HANDOVER.md. Phase 19 implemented; this phase is not yet planned/executed.

## Locked outcomes

- Approximately 12 Windows PCs; versioned installers with internally distributed manual in-place upgrades. No auto-update hosting requirement. Final stable application identity, visible version, release notes, preserved projects/local library and verified fresh install/upgrade.
- Verify/repair existing embedded-PDF .clmc support rather than implement it again. Copy only the project to another PC and retain PDF/scales/geometry/prices/ordering, without source-path setup. Retain supported legacy migration.
- Agree minimal backup/recovery behavior during planning and implement it; preserve safe interrupted/failed saves, protect unsaved work and document rollback/project compatibility.
- Review supported runtime/dependencies, scaffold metadata/placeholder update endpoint and packaged content. Ensure test scratch data/planning assets and populated libraries are not shipped.
- Test installed app offline, representative large/multi-page PDFs, measurement accuracy, Windows scaling, save/reopen, rate application and exports on a non-development PC.
- Specifically validate changing measurement display units after pricing: current name|type project rates lack a persistent unit basis. No silent incorrect cost/quantity interpretation is acceptable at release.

## Planning decisions approved 2026-10-21

<decisions>

- **D-01 — Export audience:** Keep existing internal exports. Defer client quotations; no client-export expansion in Phase 20.
- **D-02 — Minimal recovery:** Safely replace saved files, retain one last-good backup, and periodically save local recovery copies of unsaved work with a recovery prompt after restart. Recovery must retain the embedded PDF as well as project state.
- **D-03 — UI contract:** Generate the Phase 20 UI design contract, then continue planning.
- **D-04 — Autonomous continuation:** After the UI contract, proceed directly to planning. The user approves a sound reviewed plan for autonomous execution, followed by verification and a manual test run; the user explicitly authorizes driving the PC for that manual run. Routine technical choices may be resolved autonomously. Actual non-development-PC evidence and Phase 21 pilot acceptance remain distinct from local-PC tests.
- **D-05 — Runtime (2026-10-22):** User explicitly approved exact Electron 44.9.3 after comparison with 45.0.0, support dates, and explanation of the age-only package flag. Pin 44.9.3; retain full regression, sandbox/worker smoke and installed-upgrade gates. The prior proposed 45.0.0 is superseded.

</decisions>

## Handover

Actual two-PC pilot, user acceptance and remaining-ten-PC distribution belong to Phase 21. Do not claim them from local automated verification.

## Phase 19 completion carry-forward (2026-10-21)

Phase 19 UAT is accepted (11/11); plan Phase 20 without repeating its completed walkthrough. Preserve the original three-phase rollout agreement.

- Security T19-06: 10 MB compressed-file and 10,000-row limits exist, but XLSX decompression/time is not independently bounded before ExcelJS load. Medium advisory, below Phase 19's high blocking threshold; investigate and bound resource use in the runtime/dependency resilience work before production rollout. See ../19-cost-library/19-SECURITY.md.
- Existing Electron host sandbox/navigation/external-link handling belongs in the supported-runtime review; no whole-app security certification was claimed by Phase 19.
- UI review passed with minor polish recommendations (status colors, small book-button target, numeric alignment); Windows scaling/long-content checks remain required installed-app validation. See ../19-cost-library/19-UI-REVIEW.md.
- Phase 21 guide should show Excel's UTF-8 comma-delimited Text Import Wizard route for exported CSV; the formatted XLSX opens directly.
