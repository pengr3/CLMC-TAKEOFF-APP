---
name: pdf-not-fitting-on-open
status: resolved
trigger: |
  After yesterday's gutter fix (commit ec39197), user reopened CMC_ME Layout_05-10-2026 rev.9.clmc on home terminal (different/larger monitor) and the PDF appears small with empty canvas around it. User initially thought yesterday's fix regressed.
created: 2026-05-14
updated: 2026-05-14
resolved: 2026-05-14
---

# PDF Not Fitting Canvas on Project Open (Different Monitor)

## Symptoms

**Expected:** PDF fills the canvas workspace when a .clmc project is opened (especially on a different/larger screen than where it was saved).

**Actual:** PDF appears small in the centre of the canvas with the dark dotted background visible all around. In the reported case, zoom shown as 18% on a 1920×1080 home monitor.

**Reproduction:**
1. Save a .clmc project on monitor A with the PDF zoomed to fit (e.g. 18% on the office screen).
2. Open the same .clmc on monitor B with different resolution (e.g. 1920×1080 home screen).
3. Observe: the PDF is rendered at the saved 18% zoom — too small for the new canvas.

**Timeline:** Surfaced today (2026-05-14) when opening the project at home. Yesterday's gutter fix (ec39197) addressed a different issue (canvas *background* not filling viewport).

## Current Focus

```yaml
hypothesis: |
  Project files persist per-page viewport {zoom, panX, panY}. On load, the
  restore path always applies saved viewports without checking whether saved
  zoom suits the current canvas size. CanvasViewport's auto-fit only triggers
  for never-viewed pages (vp.zoom === 1 && panX === 0 && panY === 0), so a
  loaded project never auto-fits regardless of monitor size.
test: |
  Static code trace — no runtime test needed for diagnosis:
  - project-serialize.ts:41 persists viewer.pageViewports[pageIndex]
  - project-serialize.ts:78-108 deserialises into pageViewports map
  - viewerStore.ts:98 restores pageViewports verbatim on load
  - CanvasViewport.tsx:315 fit-to-window guard: `vp.zoom === 1 && vp.panX === 0 && vp.panY === 0`
  → confirmed: loaded projects bypass auto-fit.
expecting: |
  After fix: every project open / PDF replacement triggers fit-to-window for
  each page, regardless of saved viewport.
next_action: |
  Implement Option 1 (per user decision): drop saved per-page viewport on
  load and refit each page on first display. Saved viewport in .clmc becomes
  vestigial / informational only.
reasoning_checkpoint: |
  Yesterday's fix (ec39197) is verified working from the screenshot — dark
  dotted canvas background extends across the full available area. The PDF
  being small is a separate path: persisted zoom from .clmc applied verbatim
  on load, regardless of new canvas dimensions.
```

## Evidence

- timestamp: 2026-05-14
  finding: Yesterday's fix (commit ec39197) is in master and is the running code (user confirmed `npm run dev` from source).
- timestamp: 2026-05-14
  finding: Screenshot at home shows dark dotted canvas background extending full available area → yesterday's gutter fix is working.
- timestamp: 2026-05-14
  finding: Screenshot shows zoom indicator reads 18% (status bar bottom-left). Same value as saved viewport from office monitor.
- timestamp: 2026-05-14
  finding: project-serialize.ts:41 — `viewport: viewer.pageViewports[pageIndex] ?? { zoom: 1, panX: 0, panY: 0 }` — viewport persisted per page.
- timestamp: 2026-05-14
  finding: CanvasViewport.tsx:315 — auto-fit guard `if (vp.zoom === 1 && vp.panX === 0 && vp.panY === 0)` — loaded projects don't satisfy this, so auto-fit is skipped.
- timestamp: 2026-05-14
  finding: User chose Option 1 — always fit-to-window on project open (drop saved viewport on load).

## Eliminated Hypotheses

- hypothesis: Yesterday's gutter fix (ec39197) regressed.
  why_not: Canvas dark dotted background fills full workspace in the screenshot; fix verified working.
- hypothesis: Stage size locked to 800×600 default again.
  why_not: Same as above — Stage clearly larger than 800×600 in screenshot (background extends across ~1900×800).
- hypothesis: DPI / display scaling issue.
  why_not: User reports different monitor but same OS behaviour. Zoom value (18%) matches the persisted viewport, not a scaling artefact.

## Root Cause

`pageViewports` (per-page `{zoom, panX, panY}`) is persisted to the .clmc file at save time and restored verbatim at open time. The fit-to-window auto-trigger in `CanvasViewport.tsx:315` is guarded against running for any page with a saved viewport. Opening the same .clmc on a different-sized canvas restores the saved zoom unchanged — producing a too-small PDF on a larger monitor (or a clipped PDF on a smaller one).

## Fix

**Direction (user-chosen):** Always fit-to-window on project open. Drop saved viewports on load.

**Implementation — minimum scope, one production file:**

`src/renderer/src/stores/viewerStore.ts` — `hydrate()` action now ignores `data.pageViewports` and always resets to `{}`:

```ts
hydrate: (data) =>
  set({
    currentPage: data.currentPage,
    pageViewports: {},        // intentionally drop saved viewports
    activeTool: 'select' as ActiveTool
  })
```

A JSDoc block above the action documents the contract change and the rationale (preserves forward compatibility — the .clmc file still carries a `viewport` field per page; we just ignore it on load).

**No change** to `CanvasViewport.tsx:315` — the existing auto-fit guard now fires on every page open because `pageViewports` is always empty after hydrate, so `getViewport()` returns `DEFAULT_VIEWPORT` (`zoom: 1, panX: 0, panY: 0`).

**No change** to `project-serialize.ts` — keeping the write-side intact preserves the .clmc file format and means downgrading to an older app build (which still reads `viewport`) does not break.

**Test contract change** (`src/tests/project-serialize.test.ts`):
- Renamed the round-trip test to clarify it covers markup + scale only.
- Added a new explicit test (`hydrate intentionally DROPS pageViewports`) that:
  - Asserts the snapshot still WRITES viewport (forward compat).
  - Asserts post-hydrate `pageViewports === {}` regardless of saved values.
  - Documents the contract with a comment referencing this debug file.

## Verification

- `npx vitest run` → 425/425 tests across 57 files pass.
- `npm run typecheck` (node + web tsconfigs) → 0 errors.
- `npx eslint src/renderer/src/stores/viewerStore.ts src/tests/project-serialize.test.ts` → 0 errors, 0 warnings on touched files.
- Static trace confirms:
  - On load: `hydrateStores` calls `useViewerStore.hydrate({...})` → `pageViewports: {}`.
  - On first page display: `CanvasViewport.tsx:312` calls `getViewport(currentPage)` → returns `DEFAULT_VIEWPORT` (`{zoom:1, panX:0, panY:0}`).
  - Guard at line 315 matches → `calculateFitScale()` runs and the page is sized to the current `containerSize`.
- Save/load round-trip still works for markups, categories, scales, and `currentPage`. Only `pageViewports` is intentionally not restored.

## Files Changed

- `src/renderer/src/stores/viewerStore.ts` — `hydrate()` drops `data.pageViewports`; JSDoc explains the contract.
- `src/tests/project-serialize.test.ts` — round-trip test split: viewports excluded from positive-restore assertion; new test documents the drop-on-load contract.

## Notes

- This is **not** a regression of commit ec39197 (yesterday's canvas-background fix). It is a separate bug surfaced *because* yesterday's fix made the empty area visible. Before yesterday, the same canvas-too-small-for-PDF condition existed but the empty area blended with the surrounding chrome.
- Forward compatibility preserved: .clmc files are not bumped in `formatVersion`. The `viewport` field is now write-only / informational. A future feature (e.g., "remember last view per page within a session") could read it back conditionally without a schema change.

specialist_hint: react-state-management
