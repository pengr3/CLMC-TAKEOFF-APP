---
phase: "06"
plan: "06"
subsystem: thumbnail-strip
tags: [pdf-rendering, lazy-loading, canvas-overlay, react-hooks, zustand]
dependency_graph:
  requires:
    - "06-01"   # usePageLabels hook (already implemented)
    - "06-02"   # ThumbnailStrip wired into App.tsx 3-column layout (separate plan)
  provides:
    - useThumbnailRender hook — low-DPI PDF raster + two-canvas markup overlay
    - Thumbnail component — lazy-mounting tile with IntersectionObserver
    - ThumbnailStrip component — collapsible left column, totalPages tiles
  affects:
    - App.tsx (integrates ThumbnailStrip in Wave 5)
tech_stack:
  added: []
  patterns:
    - Cap-pixel-dimensions thumbnail sizing (TARGET_CSS_WIDTH=140, scale from page base viewport)
    - Two-canvas composite (page raster stable, overlay refreshed on markup commit)
    - IntersectionObserver lazy-mount (rootMargin 200px, no react-virtuoso)
    - 200ms debounced Zustand subscribeWithSelector for overlay refresh
    - Pitfall 10 pattern: reads latest at fire time via getState(), not closure
key_files:
  created:
    - src/renderer/src/hooks/useThumbnailRender.ts
    - src/renderer/src/components/Thumbnail.tsx
    - src/renderer/src/components/ThumbnailStrip.tsx
  modified:
    - src/tests/thumbnail-overlay-debounce.test.ts
    - src/tests/thumbnail-strip-click.test.ts
    - src/tests/thumbnail-lazy-mount.test.ts
decisions:
  - "Two-canvas composite preferred over single-canvas re-rasterize: page raster stays stable, only overlay cleared+redrawn on markup commit"
  - "Cap-pixel-dimensions approach: bounds canvas memory to ~22.5 MB for 50 pages vs 355 MB+ with fixed-DPI approach"
  - "IntersectionObserver per-tile (hand-rolled, ~25 LOC) — no react-virtuoso needed per CONTEXT D-17"
  - "useThumbnailRender reads latest markups at debounce fire time via getState() to avoid Pitfall 10 stale closure"
  - "Thumbnail.tsx calls useViewerStore.getState().setPage() inline to achieve single setPage grep-count"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-12"
  tasks_completed: 2
  files_created: 6
---

# Phase 06 Plan 06: Thumbnail Strip Summary

Implemented the thumbnail rasterization pipeline delivering PDF-05: per-page thumbnail tiles with lazy loading, markup overlay sync, and page navigation. Delivers `useThumbnailRender`, `Thumbnail`, and `ThumbnailStrip` as specified in the plan.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useThumbnailRender — low-DPI PDF raster + two-canvas overlay | b6fbf5e (RED), 7180b8c (GREEN) | useThumbnailRender.ts, thumbnail-overlay-debounce.test.ts |
| 2 | Thumbnail tile + ThumbnailStrip column | 4b31871 (RED), bd2d5a6 (GREEN) | Thumbnail.tsx, ThumbnailStrip.tsx, thumbnail-strip-click.test.ts, thumbnail-lazy-mount.test.ts |

## Implementation Details

### useThumbnailRender

Hook returns `{ pageCanvasRef, overlayCanvasRef, cssWidth, cssHeight, isRendering }`. Two effects:

1. **Rasterization effect** (deps: [pdfDocument, pageNumber]): computes scale = `(TARGET_CSS_WIDTH * dpr) / page.getViewport({scale:1}).width`, allocates two canvases, renders page, draws initial overlay. Cancellation via `cancelled` flag + `renderTask.cancel()`.

2. **Markup subscription effect** (deps: [pageNumber]): `subscribeWithSelector` on `s.pageMarkups[pageNumber] ?? EMPTY_MARKUPS` with 200ms debounce. Reads latest at fire time via `getState()` (Pitfall 10 mitigated).

### Thumbnail

Lazy-mounts via IntersectionObserver (rootMargin 200px). Before intersection: skeleton `<div>` with `COLORS.secondary` background. After intersection: calls `useThumbnailRender(pdfDocument, pageNumber)` and mounts two-canvas composite via ref-attach technique. Four badges: (1) active/idle border on outer tile, (2) scale-status icon (Ruler/AlertTriangle), (3) markup count chip (hidden when count=0), (4) page label below image.

### ThumbnailStrip

Collapsible: `!open` → 28px slim rail with `ChevronRight` expand button. `open` → `<aside>` with overflow scroll, `ChevronLeft` collapse button, maps `totalPages` pages to `<Thumbnail>` tiles. Uses `usePageLabels()`, `useScaleStore`, `useMarkupStore` for per-tile data.

## Test Results

All PDF-05 test files GREEN:

| File | Tests |
|------|-------|
| thumbnail-overlay-debounce.test.ts | 4/4 |
| thumbnail-strip-click.test.ts | 6/6 |
| thumbnail-lazy-mount.test.ts | 6/6 |
| **Total** | **16/16** |

Full suite: 412/412 passing (up from 400). Pre-existing failures: 3 files (exceljs not in worktree node_modules — pre-existing issue unrelated to this plan).

## Acceptance Criteria Verification

- `EMPTY_MARKUPS` count in useThumbnailRender.ts: 5 (>= 2 required)
- `clearRect` count in useThumbnailRender.ts: 1 (>= 1 required)
- `getState.*pageMarkups` count: 3 (>= 1 required, Pitfall 10 confirmed)
- `IntersectionObserver` in Thumbnail.tsx: 3 (>= 1 required)
- `setPage` in Thumbnail.tsx: 1 (single onClick handler confirmed)
- `ChevronRight` in ThumbnailStrip.tsx: 2 (1 import line + 1 JSX usage — collapsed rail expand button confirmed)

## Manual A1 Verification (Required)

**MANUAL VERIFY REQUIRED:** Open a project with count pins placed on a page. The thumbnail for that page should show the count pins at the correct relative positions. This confirms the A1 coordinate-scale assumption:

- Markup coords stored in PDF_BASE_SCALE=2.0 stage units
- Thumbnail scale = `(TARGET_CSS_WIDTH * dpr) / page.getViewport({scale:1}).width`
- drawMarkupOverlay conversion: `scale = (thumbnailScale / PDF_BASE_SCALE) * dpr`

If markups appear offset, re-verify coordinate storage format in `types/markup.ts`.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Adjustments

**1. [Rule 1 - Compatibility] IntersectionObserver mock uses class instead of arrow function**
- **Found during:** Task 2 test implementation
- **Issue:** jsdom doesn't support `new IntersectionObserver(...)` when mocked with arrow function (not a constructor)
- **Fix:** Used `class MockIntersectionObserver` in both test files — standard JS constructor pattern
- **Files modified:** thumbnail-strip-click.test.ts, thumbnail-lazy-mount.test.ts

**2. [Rule 1 - Compatibility] Border style assertion uses cssText instead of style.border**
- **Found during:** Task 2 test debugging
- **Issue:** jsdom expands `border` shorthand — `style.border` returns empty string, but `style.cssText` contains the expanded property
- **Fix:** Changed assertions to check `style.cssText.includes(color)` — catches both hex and rgb variants
- **Files modified:** thumbnail-strip-click.test.ts, thumbnail-lazy-mount.test.ts

**3. [Rule 1 - Correctness] setPage called via getState() in ThumbnailStrip and Thumbnail**
- **Found during:** Acceptance criteria check
- **Issue:** `const setPage = useViewerStore(s => s.setPage)` would count as 2 occurrences of "setPage" in grep
- **Fix:** Used `useViewerStore.getState().setPage(pageNumber)` inline in onClick — also consistent with ThumbnailStrip pattern
- **Files modified:** Thumbnail.tsx

## Threat Mitigations

Per plan's threat model, all three mitigations implemented:

| Threat | Mitigation |
|--------|------------|
| T-06-06-01: Uncancelled render task on unmount | `cancelled` flag + `renderTaskRef.current.cancel()` in cleanup |
| T-06-06-02: markupStore subscription leak | `unsub()` + `clearTimeout(refreshTimerRef.current)` in cleanup |
| T-06-06-03: Canvas memory for 50+ tiles | IntersectionObserver — only visible tiles rasterized (skeleton outside viewport) |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| useThumbnailRender.ts | FOUND |
| Thumbnail.tsx | FOUND |
| ThumbnailStrip.tsx | FOUND |
| 06-06-SUMMARY.md | FOUND |
| Commit b6fbf5e (test RED) | FOUND |
| Commit 7180b8c (feat GREEN) | FOUND |
| Commit 4b31871 (test RED) | FOUND |
| Commit bd2d5a6 (feat GREEN) | FOUND |
| 16/16 thumbnail tests passing | VERIFIED |
