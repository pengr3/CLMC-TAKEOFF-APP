---
status: resolved
trigger: "Phase20 manual test: Perimeter toolbar creates Area markup after switching from Area"
created: 2026-10-22T05:15:00Z
updated: 2026-10-22T09:32:07.039Z
---

## Current Focus

bug_class: bohrbug
hypothesis: CanvasViewport's idle-only activation guard leaves useMarkupTool on the prior tool after toolbar switching during chaining.
test: Automated verification completed: production build,31-case targeted regression, exact predicate revert/reconfirm, HEAD-scoped lint comparison and157-file full regression.
expecting: Fresh out/ native run creates10m linear,100m² area,40m perimeter; format3 save/reopen preserves distinct semantic types and metadata.
next_action: None for this defect; resolved by actual installed native verification. External release checks remain in Phase20 artifacts.
reasoning_checkpoint:
  hypothesis: CanvasViewport ignores a changed measurement tool while useMarkupTool is non-idle, so toolbar activeTool and hook toolType diverge and commitShape serializes the old toolType.
  confirming_evidence:
    - CanvasViewport654 requires mode idle before activating a different tool. commitShape resets to drawing with chainArmed true and old toolType; Enter finishes according to that old tool and auto-commit uses old metadata.
    - Production ToolRail/CanvasViewport/drawing-hook regression on68803dd fails21 switching/native cases and passes10 same-type/preset controls. Example Wall→Count asserts actual wall despite Count active; native square reaches stale automatic commit instead of fresh naming.
  falsification_test: If removing the idle restriction does not make all cross-type committed archive types/quantities correct, or erases explicit same-type/preset metadata, this mechanism is incomplete.
  fix_rationale: Activate on measurement tool mismatch regardless of mode; toolType equality already protects a correctly applied preset and preserves same-type chaining.
  blind_spots: Native PC end-to-end retest remains parent-owned; tests replace PDF rasterization/Konva painting, retaining real pointer handlers, transforms, naming UI, hook/store commit and persistence.
  candidate_causes:
    - code: idle-only synchronization guard suppresses changed tool activation (confirmed by source and deterministic integration test).
    - data: malformed archive/type conversion (refuted by real in-memory committed mismatch before archive).
    - environment: dev HMR or snap flag desync (refuted by packaged native repro and unsnapped20-transition reproduction).
  and_gate: no; the single activation guard fully explains the mismatch. Existing normal non-idle chain state is a trigger, not a second defect.
known_pattern_candidate: Existing item-name-collision involved identity keys, not creation type. F3 KB entry is superseded by its resolved-session correction (duplicate keyboard listeners); production tool mismatch must be tested separately.

## Symptoms

expected: Perimeter toolbar plus four10m edges creates a perimeter markup with40m quantity; it must not create another100m² area.
actual: On candidate source68803dd, after saving Grid area100m², click Perimeter toolbar (visibly active/labelled Perimeter), trace same square and press Enter. It automatically reuses Grid area and adds another area. Totals become Grid area200m². Native Save creates format3 archive with third markup.type=area, same name/color/category as area, despite Perimeter tool shown.
errors: No error dialog. Saved/readable project, incorrect semantic type.
timeline: Found during explicitly authorized manual PC run after final automated verification; no earlier working state is asserted.
reproduction: Generated10mx10m grid PDF; calibrate top edge10m; draw linear bottom edge10m named Grid length; draw area square100m² named Grid area (snap off); F3 snap on; click Perimeter palette; trace4corners; Enter; native Save. App displays Perimeter but serializes area.

## Evidence

- timestamp: 2026-10-22T07:51:00Z
  checked: Manager's source-only commit and final scope against original00f6403 baseline
  found: Manager committed801a532140038fb903703799ac3e73cb6332df6d after all automated checks, containing only CanvasViewport guard/comment change and measurement-tool-switch.test.ts. Source hashes match the already-verified files; both source paths are clean. git diff --check00f6403 HEAD exits0. Final-scope log appends committed comparison against original baseline rather than now-fixed HEAD.
  implication: Automation results apply unchanged to the committed source. This agent performed no commit or archive; parent-owned native retest is the only remaining verification step.
- timestamp: 2026-10-22T07:50:00Z
  checked: Full regression with exact node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2 --reporter=dot
  found: Exit0;157 files and1224 tests passed in637.26s, inside900sec child timeout. Raw .planning/tmp/20-tool-type-full-regression-max2.log records start15:38:21+08 and finish15:49:03+08. Existing React act-environment warnings and intentional rejected-input diagnostics are retained. No reduced-worker retry was needed; all verification processes ended.
  implication: Adjacent and complete regression signal passes. Automated guardrail accepted with documented unavailable Stryker skip; real native workflow remains unverified by this agent.
- timestamp: 2026-10-22T07:50:00Z
  checked: Final git diff check, source diff, HEAD and compiled output identity
  found: git diff --check exits0; CanvasViewport remains exactly3 added/4 removed lines, one guard predicate plus explanatory comments. HEAD remains00f6403402a42d6a2b4d3229afabbf973ead3395. Final source/test/out SHA256 and output timestamps recorded in .planning/tmp/20-tool-type-final-scope.log. Renderer out/renderer/assets/index-PokYZ4uu.js SHA256 A963398425784F31B788EF41105FC4E0F29CE2C41A419D3D1738EFC17D81BAF5, built15:29:32+08.
  implication: Fixed predicate is restored, no bulk line-ending diff or unrelated source edit was introduced, and parent has a newly compiled production output for native retest. No commits or archival performed.
- timestamp: 2026-10-22T07:38:00Z
  checked: Bounded postprocess of raw lint diagnostics and exact HEAD-versus-working source equality
  found: Exit0. All15 functional diagnostics unchanged; no formatting warning at the modified guard/comments; new test0 errors/0 warnings. Exact source equality check confirms only the intended guard/comment replacement. Global Prettier warnings284→283. Refined raw log .planning/tmp/20-tool-type-lint-refined-comparison.log.
  implication: Scoped lint adds no functional errors or changed-hunk warnings; existing15-error lint debt remains. No CRLF conversion or bulk formatting was performed.
- timestamp: 2026-10-22T07:38:00Z
  checked: In-memory LF-normalized scoped lint on unchanged HEAD, working CanvasViewport, and new regression
  found: HEAD15 errors/284 warnings; working15 errors/283 warnings; new test0 errors/0 warnings. All15 functional errors match rule, logical line, column and message first line. Initial strict location comparison exits1 because Prettier changes its suggested edit positions in untouched regions (e.g Delete-space column15 becomes16 after the one-line hunk). Raw .planning/tmp/20-tool-type-lint-baseline-comparison.log retained; ESLint process ended after136s.
  implication: No new functional lint error or test lint finding. Refine only the saved-result comparison with exact source-hunk proof and inspect formatting diagnostics at the changed guard; do not rewrite unrelated existing formatting.
- timestamp: 2026-10-22T07:33:00Z
  checked: Targeted31-case regression after exact predicate restoration
  found: Exit0;31/31 pass in57.19s. Raw log .planning/tmp/20-tool-type-reapply-green.log. Source diff remains3 added/4 removed lines (one predicate plus explanatory comments), with no bulk line-ending change.
  implication: Revert-and-reconfirm passes: original predicate fails21 cases, restored fix passes all31. Existing prior native-shaped snapON sequence is GREEN; real native workflow remains parent-owned.
- timestamp: 2026-10-22T07:32:00Z
  checked: Exact restoration of only markupState.mode===idle followed by unchanged31-case regression
  found: Exit1;21 switching/native cases failed and10 same-type/preset controls passed in35.05s. Native-shaped case specifically received area when perimeter was selected. Log .planning/tmp/20-tool-type-revert-red.log. The fixed predicate was restored in finally immediately after completion.
  implication: The single guard predicate causally controls the defect. Targeted GREEN reapply confirmation is next; no other source edits were reverted.
- timestamp: 2026-10-22T07:30:00Z
  checked: Same serialized npm run build with narrow sandbox escalation
  found: Exit0; node and web typechecks passed; main, preload and renderer production bundles built. Renderer built in48.22s. Raw log .planning/tmp/20-tool-type-build-serialized-escalated.log records start15:28:02+08 and finish15:29:33+08. New out/ contains the fixed source build.
  implication: Reclaimed memory permits a complete build. Earlier V8 allocation failures remain environment evidence; native owner can use out/ after predicate verification restores the source fix.
- timestamp: 2026-10-22T07:28:00Z
  checked: Serialized npm run build after parent cache reclamation
  found: Both node and renderer typechecks passed. Vite failed exit1 with EPERM realpath src/shared/cost-library.ts in sandbox, without a V8 allocation failure. Raw log .planning/tmp/20-tool-type-build-serialized.log records exact exit and timestamps.
  implication: Retry the same build with narrow escalation; no code/build success claimed yet.
- timestamp: 2026-10-22T05:19:00Z
  checked: GSD knowledge-base, item-name-collision, resolved rapid-click and F3 sessions; Phase20 context/review/fix/verification/UAT; project skill discovery
  found: No matching prior resolution. Prior F3 diagnosis was corrected to duplicate listeners after clean-build testing; rapid-click fix affects pointer suppression. Phase20 source baseline1193 tests passed, native semantic switching failed. No project skills or configured gsd-debugger skills were returned.
  implication: Do not reuse stale F3/HMR theory. Investigate drawing semantic ownership first; production native evidence refutes a dev-only HMR cause. SBFL skipped because no per-test coverage is configured; manual minimal reproduction will supply the regression. No property framework configured, so use manually minimized seed and transition neighbors.
- timestamp: 2026-10-22T05:22:00Z
  checked: CanvasViewport649-659, useMarkupTool activate/preset/finish/commitShape, ToolRail tool handler; actual production integration regression
  found: The guard mode===idle prevents all cross-type switches during drawing/placing. 20 transitions plus native sequence failed;5 same-type chains and5 explicit presets passed on unchanged68803dd. Logs20-tool-type-red.log and20-tool-type-red-confirmed.log preserve RED outputs. Initial sandbox discovery EPERM was retried with the same exact command outside sandbox; it is not a behavior failure.
  implication: Root cause localized to one guard predicate; data corruption and snap/HMR are unnecessary. Tests use specified type and independent10m/100m²/40m/30m² quantities, not crash-only assertions. Manager reports mapped typescript-expert specialist skill unavailable; no specialist review claimed.
- timestamp: 2026-10-22T05:26:00Z
  checked:31-case production integration test after removing idle predicate; npm build and scoped lint
  found: All31 tests pass;20 cross-type paths extract actual format3 ZIP and hydrate stores with correct type/metadata/quantities. Same-type chain/preset controls remain correct, including3000mm wall height. Native-shaped snapON10m/100m²/40m path passes. Build passed node typecheck but web typecheck hit Windows V8 allocation failure; serialized retry pending. Scoped lint new regression clean;15 CanvasViewport errors and extensive CRLF/prettier warnings require baseline comparison.
  implication: Source behavior fixed in automated production commit path. Build/full verification not yet claimed. SnapON square regression shows semantic switching works with snapping; the separately cancelled displacement is not repeat-confirmed or diagnosed.

- timestamp: 2026-10-22T05:14:16Z
  checked: .planning/tmp/20-manual-run/manual-observation.clmc using JSZip project.json readback
  found: markups[0]linear Grid length;markups[1]area Grid area;markups[2]area Grid area;canonical coordinateBasis and scale present. Persisted third points match square corners.
  implication: Confirmed semantic tool-switch defect, not merely aggregate display.
- timestamp: 2026-10-22T05:15:00Z
  checked: .planning/tmp/20-manual-run/perimeter-created-area.png
  found: Perimeter active palette/toplabel, Grid area200m², clean saved filename.
  implication: Actual native UI evidence; this candidate is not accepted.
- timestamp: 2026-10-22T05:15:00Z
  checked: Earlier cancelled area trace
  found: SnapON second point appeared displaced from intended upper-right grid corner (approx649263 vs644225). Cancelled without saving. Redraw snapOFF produced100.00m²; subsequent snapON perimeter vertices aligned. Not yet repeat-confirmed or attributed to product versus automation.
  implication: Retain observation; do not claim independent snap accuracy acceptance from a cancelled attempt. Investigate if related/reproducible.

## Eliminated

- hypothesis: Serialization/aggregation changes Area into the wrong type.
  evidence: Real drawing/store path already retains the previous tool after toolbar switch; mismatch precedes persistence.
  timestamp: 2026-10-22T05:22:00Z
- hypothesis: Production mismatch requires F3/HMR or enabled snapping.
  evidence:20-transition regression fails with snap disabled; native packaged reproduction excludes dev HMR. Same-type/preset controls pass.
  timestamp: 2026-10-22T05:22:00Z

## Resolution

root_cause: CanvasViewport's idle-only activation guard skips different toolbar measurement tools during non-idle drawing/placing; commitShape uses the unchanged prior hook toolType and chained metadata.
oracle_type: specified (selected tool determines markup type); derived independent known-grid quantities
fix: Remove only mode===idle from CanvasViewport's changed-tool activation guard. A toolType match continues to preserve same-type chaining and explicit preset metadata.
verification:
  target_test: { result: pass, tests:31, log: .planning/tmp/20-tool-type-reapply-green.log }
  mutation_check: { result: skipped, reason_if_skipped: No Stryker dependency or configuration is installed; exact guard restoration exercised signal5 and reproduced21 switching failures. }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, reason: Removes incorrect restriction so different-tool activation is performed; does not delete measurement behavior. }
  adjacent_tests: { result: pass, suites_run: [full regression 157 files], tests: 1224, duration_seconds: 637.26, exit_code: 0, log: .planning/tmp/20-tool-type-full-regression-max2.log }
  scoped_lint: { result: no-new-functional-errors, existing_errors: 15, baseline_warnings: 284, working_warnings: 283, changed_hunk_warnings: 0, new_test_errors: 0, new_test_warnings: 0, exact_narrow_diff: true, log: .planning/tmp/20-tool-type-lint-refined-comparison.log, raw_log: .planning/tmp/20-tool-type-lint-baseline-comparison.log }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, red_tests_failed: 21, red_controls_passed: 10, red_log: .planning/tmp/20-tool-type-revert-red.log, green_log: .planning/tmp/20-tool-type-reapply-green.log }
  build: { result: pass, exit_code: 0, log: .planning/tmp/20-tool-type-build-serialized-escalated.log, prior_attempts: host-memory-allocation-failure then sandbox-EPERM }
  final_source_scope: { result: pass, diff_check_exit: 0, added_lines: 3, removed_lines: 4, log: .planning/tmp/20-tool-type-final-scope.log }
  guardrail_verdict: accepted
  native_manual: { result: pass, owner: top-level /root, candidate: 3f9f6fd3f1057a1dfb6603c50423ca3914626f67a5f1be814117dcf80959431d, installed_payload_files_matched: 149, archive: .planning/tmp/20-manual-run/manual-final.clmc, persisted_perimeter_type: perimeter, perimeter_metres: 40, wall_square_metres: 30, count: 1, independent_readback: .planning/tmp/20-manual-run/readback-evidence.json, report: .planning/phases/20-production-readiness/20-MANUAL-TEST.md }
files_changed: [src/renderer/src/components/CanvasViewport.tsx, src/tests/measurement-tool-switch.test.ts]
source_commit: 801a532140038fb903703799ac3e73cb6332df6d (manager-owned)

Final parent verification2026-10-22T09:32:07.039Z: sourcee61ae4a;157files/1228tests passed420.92sec; current NSIS/ASAR inspection, measured packaged smoke,149installed-file identity and actual native focused retest passed. Source/archive originals and library hashes preserved.
