# Phase 14 — Deferred / Out-of-Scope Items

Items discovered during execution that are NOT part of the current plan's scope.
Do not fix here; surface to the owning plan or a follow-up.

## Discovered during 14-02 (snapping-engine + self-intersection)

`npx tsc --noEmit -p tsconfig.web.json` reports pre-existing type errors in files
NOT touched by plan 14-02. These belong to other in-flight Phase 14 waves
(arc reshape / markupStore reshape-arc command, totals refactor) and are out of
scope per the executor SCOPE BOUNDARY rule. None involve `snapping-engine.ts`,
`self-intersection.ts`, or their tests (those compile clean).

| File | Line | Error | Likely owner |
|------|------|-------|--------------|
| src/renderer/src/components/CanvasViewport.tsx | 381 | TS2367 — comparing markup-tool union to `"count"` (no overlap) | Canvas wiring wave |
| src/renderer/src/components/TotalsCategoryBlock.tsx | 6,7 | TS6196 — `BoqRowType` / `MarkupType` declared but unused | Totals wave |
| src/renderer/src/stores/markupStore.ts | 508,514,638,644 | TS2339 — `.markup` missing on `reshape-arc` command union member | Arc reshape wave |

These were present before 14-02 started and are unrelated to the pure geometry
primitives this plan added.
