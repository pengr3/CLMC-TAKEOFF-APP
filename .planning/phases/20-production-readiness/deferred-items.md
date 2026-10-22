# Deferred issues discovered during plan 20-01

- Existing `src/renderer/src/App.tsx:209` page-navigation `setReopenToast(null)` effect fails `react-hooks/set-state-in-effect`. The same effect exists at baseline d0bcee9; it is unrelated to the save changes.
- Existing `src/renderer/src/hooks/useCloseGuard.ts:14` render-time `handlerRef.current = onRequest` fails `react-hooks/refs`. The assignment exists at baseline d0bcee9; the new save guard does not introduce it.
- The touched existing files have extensive inherited Prettier/CRLF warnings. New and fully rewritten files were formatted; unrelated existing formatting was retained. Scoped ESLint is therefore not a clean baseline.

These do not invalidate the passing save behavior tests or typecheck, but the lint command remains nonzero until the existing hook issues are addressed in their own task.

## Plan 20-05

- `src/tests/app-version.test.ts` has six pre-existing explicit-any/missing-return-type ESLint errors (lines 21, 36 and 42). Task 03 only added the session permission mock required by the hardened host. The new host/identity files and smoke harness pass scoped ESLint; this unrelated baseline debt remains.
- Full regression retains existing React act/environment warnings; production build retains the existing PDF setup static/dynamic-import warning. Neither is counted as a failing check or claimed fixed.
- Dependency audit findings and API/platform/input dispositions are recorded in `20-DEPENDENCY-REVIEW.md`; future publishing, streaming XLSX, dev-server exposure or platform changes must reopen those dispositions. Critical build-time tar was patched to 7.5.21, not deferred.

## Plan 20-07

- `CanvasViewport.tsx` retains 15 existing semantic ESLint errors and four warnings. Plan 07 changed only the scale-popup confirmation line to honor a rejected unit change. JSON lint results compared against plan-start `2c64fb0` have zero differences in rule/message multisets. The existing effects/ref handling/unused callback parameter are outside this plan's changes.
- `useProject.ts` retains six existing exhaustive-dependency warnings, verified against `2c64fb0` through ESLint stdin. The new staged-commit helper takes PDF actions explicitly at module scope; the new upgraded-copy event action reads current stores/current helpers rather than keeping a memoized stale closure. Neither introduces an additional warning. Other changed production files pass semantic ESLint (Prettier disabled for inherited formatting noise); new files are formatted.
