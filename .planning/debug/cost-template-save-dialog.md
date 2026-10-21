---
status: resolved
trigger: "i started and tried to download template but nothing happened. no prompt where to save or whatever. the screen just jitters then nothing. Console also logged nothing"
created: 2026-10-21
updated: 2026-10-21
phase: 19-cost-library
uat_test: 1
---

## Symptoms

Expected: Download Excel Template opens a native Save dialog; chosen file is a blank XLSX template.
Observed: brief jitter, no Save prompt, no console output. User clarified: "Panel stays open, no message".
Reproduction: launch current app → Estimate → Cost Library → Download Excel Template.
First human UAT, never confirmed working manually. Automated smoke simulated native selection, so it did not verify real Windows dialog presentation.

## Current Focus

next_action: none for the reported dialog issue; continue Phase 19 UAT Test 3 for confirmed library replacement and restart persistence
hypotheses:
- Native save immediately returns canceled; renderer intentionally clears feedback on cancellation. This matches a remaining panel and no message, but has not been established.
- Real pointer click is lost when focus/disabled-state changes (prior tests used HTMLElement.click, not actual pointer events).
- Desktop process/preload lifecycle mismatch; would normally produce an error, so weaker given no visible feedback.

## Evidence

- Main registers costLibrary:template and preload exposes it in both source and current build.
- Template download renderer catches bridge errors and should show an error; canceled:false/file absence is currently mapped to an empty message.
- Native save defaultPath is a bare filename. Existing project/export native pickers share similar patterns; no evidence yet that this alone is the root cause.
- No attached desktop terminal available for reading current main-process logs.
- User confirmed Import CSV / Excel also opens no picker. Common native-dialog path is implicated; this is not evidence of a template-generation failure.
- Switched isolated built Electron smoke from HTMLElement.click() to real mouse-move/down/up input: all eight workflows pass, with native dialog selections still stubbed. Actual user-environment native presentation remains unverified.
- Verified the user's running process is this repository's electron-vite dev → electron.exe application; no alternate checkout/build inferred.

## Fix / verification

User confirmed UAT Test 2 with "pass" on 2026-10-21: actual Import file picker, two-item preview and cancellation now work. Both reported native-dialog symptoms are resolved by human retest. Continue the remaining library UAT; this does not establish replacement/restart persistence, which is Test 3. Exact original native cause remains unisolated.

User retest (2026-10-21): "okay now i can download and definitely can see the excel worksheet. Now let's go to next manual test". UAT Test 1 passed; original download gap resolved. Do not infer that Import is also fixed: Test 2 now covers its native picker, preview and cancellation. The original native cause remains unisolated; record successful mitigation rather than invent a diagnosis.

Confirmed feedback defect: legitimate-cancellation results and missing destination/selection were previously silently mapped to blank UI. Download and Import now show explicit cancellation feedback, distinguish missing results as errors, and emit tagged renderer/main request/result/error diagnostics without logging library contents. Both native dialogs now use Downloads as an explicit initial location to avoid relying on inherited shell location.

These are a targeted mitigation and diagnostic improvement, not a confirmed native-dialog root-cause resolution. Do not mark UAT Test 1 passed until the user actually sees the Save prompt and downloads the workbook. Main/preload changes require a full desktop-process restart; renderer HMR alone is insufficient.

Verification: 66 focused library tests pass, including five additional dialog-feedback/invalid-result/error regressions. TypeScript/production build PASS; changed production files ESLint PASS; built Electron smoke using real pointer input PASS for all eight workflows, no renderer errors, with native selections still stubbed. Native Windows prompt presentation remains pending the user's retest. No additional dependency or project/library-data changes.
