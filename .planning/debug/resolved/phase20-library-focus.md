---
status: resolved
trigger: "Authorized Phase20 native manual test: Escape after cancelling the import picker leaves Cost Library open and can reach underlying canvas shortcuts"
created: 2026-10-22T08:23:00Z
updated: 2026-10-22T09:32:07.039Z
---

## Current Focus

hypothesis: Disabling the focused import button and returning from the native picker loses DOM focus to the body. Dialog keyboard containment only handles events originating inside its portal.
test: Reproduce native picker cancellation, wait for the UI to settle, then press Escape again. Add regressions for asynchronous completion and window-focus return before changing production code.
expecting: Keyboard focus remains within the active modal through busy/idle transitions; Escape closes only an idle modal and never reaches canvas tools.
next_action: None for this defect; resolved by actual installed native verification. External release checks remain in Phase20 artifacts.
execution: Inline GSD debug under the Codex adapter's no-unrequested-agent fallback. User already authorized autonomous fixes and native manual testing; no new scope decision needed.

## Symptoms

expected: Native picker Escape cancels the picker; a second Escape closes the idle Cost Library and restores its invoker.
actual: On installed candidate3f9f6fd3/source801a532, both attempts left the idle library open. In a count-placement project the second Escape also changed the underlying selected tool to Select. Independent empty-project repetition waited for fresh state and still showed the library after the second Escape.
errors: No error dialog; cancellation message and unchanged library displayed.
reproduction: Estimate → Cost Library → Import CSV / Excel → Escape native picker → fresh capture → Escape web modal → fresh capture. Library remains visible. Visible Close works.

## Evidence

- Native repeated failure screenshot: .planning/tmp/20-manual-run/installed-library-escape-retained.png.
- CostLibraryDialog.tsx only restores previous focus on unmount and focuses on mount. Its key handler is attached to the portal overlay, with no window-focus or async-operation focus restoration.
- Existing keyboard tests dispatch directly on the dialog; they do not model native focus loss.

## Resolution

root_cause: Native picker return/disabled control can leave focus on body, outside the portal overlay's bubbling keyboard boundary. Mount-only focus did not recover it.
fix: Contain document focus and native window-focus return while mounted; reclaim escaped focus on busy transitions. Remove containment before restoring the original invoking control during cleanup. Preserve input focus already inside the modal.
verification: Four new focused regressions failed before repair and on exact old-source restoration. Repaired cancellation/error/preview/window-return and existing shortcut/focus controls passed35tests in4files29.21sec; scoped ESLint0errors0warnings; production build/both typechecks passed. Logs20-library-focus-red.log,20-library-focus-revert-red.log,20-library-focus-green2.log,20-library-focus-lint-final.log and20-library-focus-build.log.
source_commit: e61ae4a
native_manual: pass; final installerd3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180; empty/Count-armed native cancellation and Escape restore focus/preserve Count; final project archive exact-match readback passed; report20-MANUAL-TEST.md

Final parent verification2026-10-22T09:32:07.039Z: sourcee61ae4a;157files/1228tests passed420.92sec; current NSIS/ASAR inspection, measured packaged smoke,149installed-file identity and actual native focused retest passed. Source/archive originals and library hashes preserved.
