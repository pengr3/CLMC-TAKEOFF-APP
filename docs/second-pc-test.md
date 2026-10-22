# Second-PC trial — ready when hardware is available

Status: deferred by the user on 2026-10-22. Preparation can continue on the development PC. No second-PC result has been recorded and no release/pilot acceptance is implied.

## How the agent can test there

Run a Codex session on the second Windows PC with the project/test kit available and Computer Use enabled. Confirm that its available host and app-control tools belong to that PC before launching the test. This current session controls only the development PC; copying a chat or signing into the same account does not itself transfer local execution. Keep the second PC awake, unlocked and available during foreground computer control. Availability depends on that session's tools/account setup. See the official [Computer Use](https://learn.chatgpt.com/docs/computer-use) and [remote connections](https://learn.chatgpt.com/docs/remote-connections) guidance when online.

If agent computer control is unavailable there, the tester can follow this checklist and return screenshots, exports and the completed worksheet for review here. CLMC's offline test is independent of internet access required by an agent session: keep CLMC offline while arranging agent connectivity, or perform that portion with the tester after disconnecting. Do not disable global security controls for a trial.

Suggested continuation message on that PC:

> Continue CLMC Phase 20 using this trial kit. Check the kit hashes first, record the actual machine and tester, and drive the installed app with my permission. Use disposable training copies. Keep failed, unavailable and unobserved cases pending. Preserve existing projects, app data and library. Record evidence before changing acceptance status. Do not distribute beyond this trial.

## Before installing

1. Copy the complete `dist/trial-kit` folder to the target, preferably by USB or your approved internal transfer route. Open `START-HERE.html` and run `Check-Kit.ps1` with PowerShell under the normal local script policy. Do not bypass execution policy; if it blocks scripts, use the single-file `Get-FileHash` check displayed in START-HERE and compare the manifest manually.
2. Record actual tester/date, machine identifier, Windows build/x64, RAM, monitor count and available physical scaling settings in `TEST-RESULTS.md`. Integrity success proves matching bytes, not app acceptance.
3. Inventory any actual installed CLMC predecessor and preserve its installer/hash, project originals and app-data backup. If none exists, record that fact; leave the actual-predecessor upgrade case pending for review. Do not replace it with a freshly generated old build.
4. Obtain approved representative vector, scanned and multipage construction PDFs plus independently checked measurements. The supplied grid is synthetic training data and cannot satisfy representative-plan performance checks.

## Run in this order

| Check | Procedure and expected result |
|---|---|
| Fresh installation | On a PC without CLMC, install the exact candidate. Launch without dev tools/server, check one app/shortcut and About 1.1.0/local notes. Record actual install destination and registration. |
| Actual predecessor upgrade | Only where a real predecessor exists: capture pre/post inventory and hashes; verify one retained installation and unchanged project/library/preferences. Otherwise leave pending. |
| Project-only transfer | Copy **only** `worked-example.clmc` into an isolated target folder. Keep the supplied PDF outside that folder and unavailable to the app for this test; do not import a library. Open the project and confirm PDF plus six rows, cost 740, selling 962, margin 222. Record actual source/library absence. Also compare row quantities, order, visibility and rate bases. |
| Fresh takeoff | Open a disposable training PDF, calibrate its bold 10 m side, create all five types and compare with the guide. Test pan/zoom/reopen, matching-unit explicit library application and unchanged saved rates after library import. Do not replace a valuable existing library. |
| Save and backup | Save a disposable project, change it, save again and verify a valid adjacent backup. Open the backup as a detached copy. Exercise safe locked/unwritable disposable destinations, Retry, save-copy and cancellation; keep original/backup hashes. Leave unsafe or unobserved failure edges pending. |
| Saved recovery | Save a disposable project, edit, wait for a completed capture, interrupt only that known test process, restart and recover. Check the capture timestamp, dirty state and original/backup preservation. Test Keep for Later. Discard requires its explicit confirmation. |
| Never-saved recovery | Start from a disposable PDF, calibrate/mark/price without saving, wait for completed capture and interrupt only that test session. Make the disposable source unavailable, restart, recover the embedded PDF/quantities/rates and Save As a new file. |
| Offline exports | With CLMC offline, export XLSX/CSV from the example, reopen/check six rows and the 740/962/222 oracle. Use UTF-8/comma CSV import if needed. Keep the exported files as evidence. |
| Real PDF workload | For each approved vector/scan/multipage fixture record hash/bytes/pages, render/navigation timings, responsiveness, memory observations and known measurements before/after zoom/reopen. Synthetic stress results are separate. |
| Physical displays | At actual supported Windows 100/125/150/200% settings, check landmark accuracy and reachable dialogs/actions. Move between actual differently scaled monitors if available. Record hardware limits; unsupported exceptions need named review, not an automatic pass. |
| UI and keyboard | Check About/Menu, save busy/error/cancel, recovery choices, old-format reviews/upgrade copy and empty/valid/invalid/large library states. Test Tab/Shift+Tab/Enter/Escape, long content, scroll and reduced width. After canceling a native library file picker, Escape should close the library and preserve an armed drawing tool. |

Use [release-validation.md](release-validation.md) for the complete required 16-case definitions. A simple training project does not cover arcs, mixed page scales or every legacy/import edge; add permitted fixtures before closing those items. Compare against independent expected quantities (validation tolerance at most 0.1%), not merely against another app screen.

## Return evidence

Complete the supplied worksheet with actual results, artifact paths and hashes. Preserve screenshots/logs, reopened projects and both exports. Bring the evidence back for entry into the candidate-bound Phase 20 record and validator; do not hand-edit pending cases to pass because the installer launched. Its schema and gate utility remain in the source repository, not a Node dependency on the target PC.

Named ownership, dependency/signing review, Phase 20 acceptance and the later two-estimator/two-PC pilot remain open. The remaining ten PCs receive only the explicitly approved release after those gates are met.
