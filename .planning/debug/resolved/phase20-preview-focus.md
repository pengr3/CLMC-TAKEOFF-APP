---
status: resolved
trigger: Installed manual testing: Cancel Import removes focused preview control, then Escape reaches background instead of closing modal.
created: 2026-10-23
updated: 2026-10-23
---

## Symptoms

Expected: after a valid library preview is canceled, focus stays inside Cost Library; Escape closes it and preserves the armed Count tool. Actual installed e61ae4a: Cancel Import restores old library, then Escape leaves the modal open and changes Count to Select. No error message. Reproduced with synthetic library-valid.csv and an armed Unsaved recovery count. Both states captured in .planning/tmp/20-manual-edges-20261023.

## Current Focus

hypothesis: removing the focused Cancel Import button drops focus to body without focusin or busy change, so the busy-only focus repair does not run.
next_action: resolved; retain external acceptance and regression-stability qualification.

## Evidence

- Native preview shows one Training count ea10+5; Cancel Import restores two original entries. Subsequent Escape leaves library open and resets underlying Count. Fresh observation confirms.
- Source focusin/window-focus containment and effect [busy] cover native picker completion but not preview cancellation, whose state change is only preview=null.
- Existing e61 tests cover native picker cancel/error/preview completion, not removal of the focused preview button.

## Resolution

Regression failed on old code because the modal no longer contained activeElement after focused Cancel Import removal (20-preview-focus-red.log). Extending focus repair dependencies from [busy] to [busy, preview] fixes the transition without stealing active input focus. Four related files / 38 tests passed (36.94 sec); source commit 9a0349f. Full regression/build and native candidate retest pending. The first sandbox test attempt was an infrastructure EPERM with zero tests, not the RED reproduction. Execute inline under GSD Codex adapter; user has authorized autonomous fixes and PC testing.

Native corrected-candidate retest passed on fe8d848b…: valid preview→Cancel Import→Escape closes the modal, restores its invoker, preserves Count and100/130/30. All149installed files matched. Final Save As/readback passed and test app closed cleanly. Build/types/inspection/packaged smoke passed. Full regression had4initial failures; all four files passed isolated reruns, with the parser requiring a second isolated run. No single clean full run is claimed. See20-MANUAL-EDGES.md/JSON.
