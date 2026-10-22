---
status: testing
phase: 20-production-readiness
source: [20-VERIFICATION.md]
started: 2026-10-22T04:51:28.893Z
updated: 2026-10-22T09:32:07.039Z
---

## Current Test

number:1
name:Local installed UI and complete offline workflow
expected:Complete the candidate-bound local walkthrough and retain development-machine provenance.
awaiting:remaining native edge cases and external target-PC/fixture/hardware/review evidence; both manual defects resolved

## Tests

### 1. Local installed UI and complete offline workflow
expected: On the exact installed 1.1.0 candidate, complete PDF→calibration→all markup types→Estimate→library rate application→Save/Reopen→internal XLSX/CSV. Known 10m/100m²/30m² and independently calculated prices agree. Check More/About local notes/version; long names/paths/notes; UI-01..05 empty/loading/error/populated/partial states; Tab/Shift+Tab/Enter/Escape; visible actions and independent scrolling. Record screenshots, readback outputs, tester/date and development-machine scope.
result: [pending] — core installed walkthrough passed all five markup types, independent740/962/222 pricing, actual XLSX/CSV, Save As/reopen, library application and About. Original tool-switch issue resolved by801a532, installed native retest and actual archive type/quantity readback. Broader long-content/state/keyboard coverage remains incomplete. See20-MANUAL-TEST.md.

### 2. Local controlled failed saves and saved/never-saved restart recovery
expected: Using disposable fixtures only, fail replacement/backup and interrupt after a completed recovery capture; original and valid backup hashes remain intact. Restart offers completed PDF/state snapshots; restore is dirty, Keep survives, Escape/Enter cannot delete, confirmed discard affects only its revision, and explicit successful matching save retires only that recovery. Preserve work if any stage fails.
result: [pending] — saved-work local interruption, Keep, restore-dirty, unchanged original/backup and explicit separate recovered save/retirement passed. Never-saved native interruption, destructive discard and full physical failed-save matrix not yet observed. Automated coverage is separate evidence.

### 3. Legacy rate and historical geometry inspection
expected: Open representative old formats and historical clamped/DPI projects. Raw geometry is retained without guessed historical correction; unresolved pages visibly block export, clear unverified calibration, require landmark inspection/repositioning/recalibration and explicit page confirmation. Partial rate review keeps unit/export guards active. Save Upgraded Copy/backup Save As preserve original hashes; source-free new format3 reopen retains verified geometry and money.
result: [pending]

### 4. Installed library import resilience and keyboard/overflow
expected: Exercise valid/invalid/large workbooks, a controlled timeout/resource rejection and retry. Current library and applied project rates stay unchanged until explicit Replace Library; busy/preview clears safely, large preview/table and all actions remain reachable, and the app stays responsive.
result: [pending] — native picker cancellation preserves library bytes; e61ae4a focus repair now passes native empty/Count-armed retests, restores invoking focus and preserves Count placement. Broader valid/invalid/large/timeout/overflow manual matrix remains incomplete.

### 5. Approved representative large vector, high-resolution scan and multipage plans
expected: Record approved fixture hashes/bytes/pages and independent numeric oracles. Navigate/zoom/pan/save/reopen/export; record timing and process-memory trend. Accurate landmarks/measurements and usable navigation persist; no unbounded per-page retention is observed.
result: [pending]

### 6. Physical Windows display scaling and actual monitor transition
expected: On target hardware exercise 100/125/150/200% supported Windows settings and mixed-scale monitors, recording resolution/DPR and landmark measurements across zoom/pan/reopen. Dialogs and canvas remain reachable/aligned. Unavailable 125/150/200% or second-monitor cases require the validator's explicit named external hardware disposition, never automatic pass.
result: [pending]

### 7. Actual non-development fresh installation and predecessor→candidate upgrade
expected: Inventory the real previously installed version/registration/installer/hash and preserve project/library/preferences baselines. Install candidate as the same standard user on a non-development x64 PC; one app/shortcut, correct version/notes, retained library/preferences/projects and working offline launch. Record actual provenance. If no deployed predecessor exists, obtain explicit scope resolution rather than inventing a generated predecessor.
result: [pending]

### 8. Copy ONLY .clmc to an actual other/non-development PC
expected: Remove source PDF/local-library availability and copy only the project; embedded PDF, per-page verified scales, geometry/arcs/walls/counts, prices/bases, category/item order and output values agree. Record candidate-bound machine and fixture proof.
result: [pending]

### 9. Approve internal handoff location, release/signing ownership and retained predecessor
expected: Supply actual approved read-only installer/share location, named release and signing owners, truthful signing policy for the unsigned PEs, prior installer/hash retention and rollback contact. Review upstream-unspecified buffers@0.1.1 license provenance. Re-version/rebuild if actual predecessor inventory is not older than 1.1.0.
result: [pending]

### 10. Resolve REL-01/02/04/05 unclassified edge reviews
expected: Populate four edgeReviews with reviewed status, named reviewer/date, actual existing artifact and specific disposition of identity/manual release, actual upgrade preservation, interruption/rollback and representative PDF/physical-scaling evidence. Rerun evidence validator after all required cases are recorded.
result: [pending]

### 11. Prohibition review: background recovery must never claim explicit save
expected: Explicitly review and resolve 20-01's prohibition against presenting background recovery as a saved project or hiding newer unsaved changes. Inspect periodic recovery, stale save completion, dirty asterisk and close guard. Record a human disposition for this exact item.
result: [pending]

### 12. Prohibition review: kept recovery and source projects remain under user control
expected: Explicitly resolve 20-03's prohibition against silent quota eviction or source overwrite during restore. Inspect quota refusal, Keep/restart, confirmed discard and dirty restore with no source write. Record a human disposition for this exact item.
result: [pending]

### 13. Prohibition review: local evidence cannot claim target-PC/pilot/deployment acceptance
expected: Explicitly resolve 20-09's prohibition against inferring non-development validation, real-user pilot acceptance or twelve-PC rollout from local/delegated tests. Review provenance and pending matrix; retain Phase21 pilot/distribution boundary.
result: [pending]

## Summary

total:13
passed:0
issues:0
pending:13
skipped:0
blocked:0

## Gaps

External non-development machine, actual predecessor, representative PDFs, physical scaling/monitor and named organizational reviews remain unavailable. Local results cannot satisfy them.

The initial low-disk-space installation obstacle was resolved before the completed local run. Actual NSIS installed successfully with149payload files verified. Initial perimeter bug is fixed and natively verified. Full observed core run, saved-work interruption recovery, byte-preserved library cancellation and compatible rate application are recorded in20-MANUAL-TEST.md/20-MANUAL-EVIDENCE.json. The separate native focus-return defect is fixed and verified on final candidate d3a9a6f0; no human project or original library was replaced. All target-PC cases remain pending.

## Resolved Manual Findings

Tool-switch semantics801a532 and native library focus e61ae4a both passed installed retests and independent supporting readback. Final automated157files/1228tests passed420.92sec. Zero unresolved demonstrated source defects are recorded; broad groups retain pending status until every stated subcase is observed. No external case was marked pass.
