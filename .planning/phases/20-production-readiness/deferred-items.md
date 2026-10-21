# Deferred issues discovered during plan 20-01

- Existing `src/renderer/src/App.tsx:209` page-navigation `setReopenToast(null)` effect fails `react-hooks/set-state-in-effect`. The same effect exists at baseline d0bcee9; it is unrelated to the save changes.
- Existing `src/renderer/src/hooks/useCloseGuard.ts:14` render-time `handlerRef.current = onRequest` fails `react-hooks/refs`. The assignment exists at baseline d0bcee9; the new save guard does not introduce it.
- The touched existing files have extensive inherited Prettier/CRLF warnings. New and fully rewritten files were formatted; unrelated existing formatting was retained. Scoped ESLint is therefore not a clean baseline.

These do not invalidate the passing save behavior tests or typecheck, but the lint command remains nonzero until the existing hook issues are addressed in their own task.
