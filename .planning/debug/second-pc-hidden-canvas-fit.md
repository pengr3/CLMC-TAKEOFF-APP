---
status: resolved-in-installed-1.1.1
trigger: "continue with the remaining tests you can do on this PC, drive it from here"
created: 2026-10-25T11:38:00Z
updated: 2026-10-25T12:49:00Z
---

## Current Focus

hypothesis: Opening a project from Estimate hydrates Plan/default viewport before the hidden canvas's zero-size ResizeObserver state updates. Fitting subtracts 40px padding from height zero, stores zoom -40/600 = -0.0666667, and prevents subsequent default auto-fit.
test: Preserve installed evidence, reproduce at 100%, then regress unusable container sizes and defer stage/store fit until measurable.
expecting: Hidden/undersized viewports produce no fit transaction; visible canvas fits normally and keeps stored geometry/rates valid for save/recovery.
next_action: Defect repair verified in exact installed1.1.1; continue remaining full candidate-specific Phase20 case requirements and named reviews. See20-REBUILD-RETEST.md. Prior1.1.0 evidence remains historical.

## Symptoms

expected: Opening the synthetic legacy project from Estimate shows a usable Plan and permits periodic recovery.
actual: At physical Windows 150%, Plan showed -7% and a tiny drawing. The next recovery capture reported protection unavailable. Ctrl+0 restored a positive 73% view; separate Save Upgraded Copy then succeeded.
errors: Recovery copy could not be updated. Save your project now.
reproduction: Installed candidate fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544, LAPTOP-5BAM24NM. Open physical-display-copy.clmc, choose Estimate, open synthetic-legacy-units.clmc, wait for render/recovery. Raw evidence continued/075, 077, 078, 079.

## Evidence

- CanvasViewport.calculateFitScale subtracts 40px with no size guard; initial fit stores the result. viewerStore.hydrate clears viewports and switches to Plan. App keeps the canvas mounted with display:none in Estimate. ResizeObserver records hidden zero bounds.
- Installed legacy review correctly gated export, required acknowledgement, preserved the original and saved a format-3 copy after Ctrl+0. Those passing subcases do not erase the viewport failure.
- Local workspace dependencies differ from declared/candidate dependencies: Electron35.7.5 versus declared44.9.3, yauzl2.10.0 versus candidate3.4.0. Default local save suites fail due missing fromBufferPromise. All31 targeted tests pass with test-only alias to exact candidate yauzl. No installer/source fix validation is inferred from that alias.
- GSD SDK unavailable on this PC; continuing the already-authorized20-09-03 checkpoint and its targeted bug-fix deviation inline. Candidate acceptance remains blocked.

## Resolution

root_cause: Unchecked hidden container dimensions are admitted into fit scale and persisted as a negative viewport.
fix: calculateFitViewport rejects absent/invalid page sizes and hidden/undersized container bounds. Initial and explicit Fit defer without consuming the default viewport; valid fit retains original padding/centering math. Negative fit is excluded from zoom-step inputs.
verification: Nine regressions failed with original unchecked fit math; regression plus existing zoom/subscription suites now20pass. Both renderer/main TypeScript checks pass. Installed unchanged candidate reproduced at100% with ordinaryformat3 and150% with syntheticlegacy; recovery and first Save As failed. Ctrl+0 restored positive fit and a separate saved copy passed independent ZIP/PDF/geometry/rates/740-962-222 readback. No rebuilt installer or installed-source-fix verification yet; local dependencies differ from approved candidate.
files_changed: [src/renderer/src/lib/fit-viewport.ts, src/renderer/src/components/CanvasViewport.tsx, src/tests/fit-viewport.test.ts]

## Installed resolution — 2026-10-25

Built monotonic1.1.1 using restored lock dependencies Electron44.9.3/yauzl3.4.0. Installer f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e; installed ASAR b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98. Inspector/isolated packaged smoke pass;149 installed payload files match;3191 existing profile files unchanged by upgrade. Full1238 tests pass with inherited Node25 storage compatibility flag; both TypeScript checks pass. Initial host test/build failures retained with diagnosis.

Native exact triggers pass at100% (format3,142% positive fit),125% (format3,90%) and150% (legacy,72%). First new save succeeds without Fit workaround. Completed periodic recovery held valid1.42zoom/rate107; controlled restart restored dirty PDF/geometry/rates and747/971.10/224.10; separate save preserved original. Upgraded legacy copy and replacement backup exact prior SHA pass; native XLSX/CSV and independent five-project readback pass. Recovery refits positively93% rather than exact captured142%; no exact viewport-restoration claim. No recurrence of negative zoom/recovery/save failure observed. Scaling restored100%, user topology retained, clean app closed.

Full Phase20 acceptance is still pending; these are scoped candidate-specific regression passes. Source fix resolution does not accept representative workloads, remaining physical matrix or Phase21 rollout.
