---
phase: 20-production-readiness
plan: "08"
subsystem: pdf-rendering
tags: [pdfjs, raster-cache, dpi, coordinates, calibration, dialogs, vitest]
requires:
  - phase: 20-01
    provides: Protected coherent project snapshots and existing viewer navigation
provides:
  - Actual-byte 128 MiB raster LRU with independent displayed ownership and transient accounting
  - Canonical PDF_BASE_SCALE geometry across DPR and canvas clamp transitions
  - Cancelled-generation isolation and viewport-aware dragged dialog containment
affects: [20-09, installed-validation, measurement-accuracy]
tech-stack:
  added: []
  patterns: [Per-hook raster ownership, serialized render settlement, committed image lifetime, resolution media-query observation]
key-files:
  created:
    - src/renderer/src/lib/pdf-page-cache.ts
    - src/renderer/src/components/PdfPageImage.tsx
    - src/tests/helpers/pdf-render-harness.ts
    - src/tests/pdf-cache-dpi.test.ts
    - src/tests/coordinate-dpi-invariance.test.ts
    - src/tests/dialog-viewport.test.ts
  modified:
    - src/renderer/src/hooks/usePdfRenderer.ts
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useDraggable.ts
key-decisions:
  - Bound retained raster bytes to 134217728; oversized foreground images remain displayable without cache admission and are not prefetched.
  - Serialize foreground and adjacent work through cancellation settlement to prevent rapid navigation allocating abandoned canvases concurrently.
  - Retain displayed images until React commits their replacement; use unrounded PDF_BASE_SCALE dimensions for the image and shared markup transform.
  - Keep existing PDF document and worker ownership unchanged; cache code never calls getDocument or destroys the document.
requirements-completed: [REL-05]
coverage:
  - id: D1
    description: Byte-bounded raster retention, displayed ownership and stale generation cancellation
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/pdf-cache-dpi.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Canonical image, pointer, calibration and persisted measurement invariance across all supported simulated DPRs
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/coordinate-dpi-invariance.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Dragged dialog bounds and action reachability after layout and visual viewport changes
    requirement: REL-05
    verification:
      - kind: automated_ui
        ref: src/tests/dialog-viewport.test.ts
        status: pass
    human_judgment: false
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 665fce39d6fe14ecbd0cb1dbea7ca137845ec3be
duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 20 Plan 08: Bounded PDF Rasters and DPI Invariance Summary

**Large PDF pages retain canonical measurement geometry while raster resolution, cache retention and dragged dialog bounds adapt to DPR and viewport changes.**

## Accomplishments

- Replaced the unbounded module cache with per-consumer LRU ownership. Retention uses actual canvas width × height × 4 and a 128 MiB default. Eviction clears canvas backing only after the final displayed/pending consumer releases it. Individually oversized foreground images bypass cache admission; adjacent prefetch skips those images.
- Exposed separate retained, displayed, live, foreground/adjacent transient and peak byte measurements. The 128 MiB limit is the retained raster budget, not a claim about total Electron/PDF.js memory. An oversized visible bitmap and the single active raster can exceed that budget; the 16384-pixel dimension clamp still applies. DPR replacement may temporarily retain both old displayed and new backing images.
- Document-generation/DPR keys, per-request cancellation and a serialized render lane prevent stale foreground/adjacent completion from repopulating another document or allocating one canvas per abandoned navigation request. Null/unmount release retained/displayed backing; in-flight backing releases after cancellation settlement. Existing PDF.js document ownership, offline worker and defensive worker buffer cloning remain unchanged.
- Canonical dimensions use unrounded `getViewport({ scale: PDF_BASE_SCALE })`, independently of the DPR/clamped bitmap dimensions. `PdfPageImage`, used by CanvasViewport, explicitly binds the bitmap to those dimensions. Stable size identity preserves viewport effect behavior. Removed the old cross-page last-image fallback so current markups cannot appear over another page/document's PDF.
- Dragging measures the actual dialog rectangle, preserves existing stricter size limits, and constrains the scroll box with 24 CSS-pixel gutters. Resize, captured scroll, visualViewport resize/scroll and content ResizeObserver changes reclamp the entire dialog. Pointer cancellation and unmount remove listeners/observers. Interactive controls still suppress dragging. No animation or text/target reduction was introduced.

## Task Commits

1. Task 20-08-01 RED: `b83a7fe`; GREEN tracer: `f0899b5`.
2. Task 20-08-02 RED: `0332992`; GREEN navigation/DPI/dialogs: `a6101fa`.

## Verification

- Task 1 required tracer command: 4 files / 18 tests passed, including its post-commit feedback rerun before expansion.
- Final task 2 required command: 4 files / 34 tests passed. Includes 40 mixed-size page transitions, DPR 1/1.25/1.5/2, fractional clamp boundaries, LRU recency/eviction, oversized bypass, DPR media-query events, late getPage/render completion, adjacent cancellation, null/document replacement and unmount.
- Independent oracle: a known 1500-PDF-unit span becomes 3000 canonical page units representing 10 m. The real hook's render parameters and shared image bounds map the PDF landmark through backing resolution; real Konva inverse transforms and calibration hook recover the endpoints under pan/zoom. A 3000-unit square measures 100 m². Actual snapshotProject JSON serialization and hydrateStores preserve coordinates and pixelsPerMm after DPR changes and reopen.
- Dialog tests exercise the real hook with measured long-content bounds, footer Close, viewport shrink, visualViewport offsets/scroll, and unchanged legacy drag/interactive-control cleanup tests. jsdom controls deterministic rectangle measurements; it does not validate physical Windows layout.
- Final full regression: **136 files / 1029 tests passed**, 89.10 seconds. Final `npm run typecheck` passed both Node and renderer checks.
- Changed hook/cache/image/test files passed scoped ESLint `--quiet`; `git diff --check` passed. No dependency installation, tracked deletion or unrelated formatting sweep occurred.

## TDD Gate Compliance

Both persisted RED records returned `RED_EVIDENCE_OK` before their implementation. Task 1 asserted canonical dimensions and observed 8192 × 4915 instead of 20000 × 12000; it also exposed 1.1 GB navigation retention and absent DPR rerendering. Task 2 observed a dragged dialog right edge of 1360 against a 1176 viewport bound. Each task has a separate RED and GREEN commit. The initial Vite realpath EPERM was a discovery failure and was not accepted as RED. No separate refactor commit was necessary.

## Deviations from Plan

1. **[Rule 2 - Required lifecycle test seams]** Added `PdfPageImage.tsx` and `src/tests/helpers/pdf-render-harness.ts` so tests execute the same image binding as CanvasViewport together with the real renderer/calibration hooks and Konva transforms. Included in `f0899b5`; no new service, document owner or dependency.
2. **[Rule 1 - Stable geometry identity]** The new hook must return a stable size object across unrelated React renders, otherwise CanvasViewport's transform effect can repeatedly update state. Added frame-owned dimensions and an explicit rerender identity assertion in `a6101fa`.
3. **[Rule 3 - Verification environment]** Vite realpath EPERM prevented sandbox test discovery. The exact focused command succeeded with approved escalation; scoped Git commits and subsequent checks used that established execution environment. No failed discovery was used as behavior evidence.

## Remaining Release Evidence

Physical Windows 100/125/150/200% scaling, monitor transitions, real representative large vector/scanned PDFs, installed offline navigation/accuracy and non-development-PC validation remain Plan 09 evidence. No physical-monitor, packaged-candidate or rollout acceptance is inferred from proxy/jsdom tests. Plan 09 owns packaging and release-note inclusion; the Plan 04 handoff reference to Plan 08 packaging was a numbering typo.

The parent orchestrator owns STATE, ROADMAP and requirement progression; this executor preserved its pre-existing dirty state and untracked workflow artifacts. Existing unrelated hook lint findings remain in the phase deferred-items ledger. No new deferred failures or stubs remain, and no new network/auth/filesystem trust surface was introduced.

## Self-Check: PASSED

All six new source/test artifacts, both RED records, this summary and all four task commits were verified on disk/in Git after summary creation. The persisted plan ledger measured four task commits and 14000 chars/4 realized-diff tokens before this separate metadata commit. Shared parent files were not staged.
