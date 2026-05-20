# Phase 11: Scale Ratio Input — Research

**Researched:** 2026-05-20
**Domain:** React component extension — calibration dialog tab switcher, PDF.js page.view metadata, pixelsPerMm derivation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Ratio input lives on a new "Type ratio" tab inside the existing calibration popup UI, alongside the current "Draw line" tab. Keeps all calibration in one place; user picks the mode before touching the canvas.
- **D-02:** Input UX is two side-by-side numeric fields separated by a colon — `[ 1 ] : [ 100 ]`. The left field defaults to 1 and is locked. The estimator types the denominator into the right field. No text parsing, no ambiguity.
- **D-03:** Physical page size is auto-derived from PDF.js `page.view` (`[0, 0, widthPt, heightPt]` at 72 pts/inch → mm via `× 25.4 / 72`). The derived sheet size (e.g. "841 × 594 mm — A1") is shown to the user for confirmation before the calibration is accepted. If the derived size looks wrong, user can fall back to the Draw Line tab.

### Claude's Discretion

- pixelsPerMm computation: `(pageWidthPx / pageWidthMm)` where `pageWidthPx` is the Konva stage pixel width of the page at the current render resolution, and `pageWidthMm` is derived from `page.view` × ratio. Must produce exactly the same pixelsPerMm as the draw-line path for the same ratio.
- Degenerate page.view guard: if `page.view` is `[0, 0, 0, 0]` or any dimension is ≤ 0, show a warning message and disable the "Accept" button, directing the user to the Draw Line tab.
- Tab switching: the existing draw-line state (in-progress line on canvas) is unaffected by switching to the ratio tab; the canvas line tool stays armed if the user switches back.

### Deferred Ideas (OUT OF SCOPE)

- Editable left-hand field (ratio other than 1:N)
- Snap to standard ISO scale denominators (1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:500, 1:1000)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAL-01 (v1.1 enhancement — GAP-T2-00) | User can set the page scale by entering a 1:N ratio directly from the title block — no calibration line needed | pixelsPerMm formula from page.view + pageWidthPx verified; tab extension of ScalePopup confirmed feasible without breaking draw-line path |
</phase_requirements>

---

## Summary

Phase 11 extends the existing scale calibration UI with a "Type ratio" tab so estimators can key in a 1:N ratio from the drawing title block without drawing a calibration line. The implementation is a self-contained renderer-layer change: the `ScalePopup.tsx` component (not `CalibrationDialog.tsx`) is the active calibration UI in the codebase, and it is where the two-tab switcher must be added.

The pixelsPerMm formula via the ratio path is `pageWidthPx / pageWidthMm`, where `pageWidthPx` is available from `usePdfRenderer`'s `pageSize.width` (CSS pixel width at `PDF_BASE_SCALE = 2.0` render scale, DPR-normalised) and `pageWidthMm` is derived as `(page.view[2] - page.view[0]) * 25.4 / 72 * ratio`. This must equal the draw-line value for the same ratio, which it does by construction because both paths read the same physical width in the same unit.

The only external data needed — `PDFPageProxy` — is obtained by calling `pdfDocument.getPage(currentPage)` inside an async effect. The `pdfDocument` is already available in the renderer via `useViewerStore`. No new IPC, no new stores, and no new libraries are required.

**Primary recommendation:** Extend `ScalePopup.tsx` with tab state and a new "Type ratio" panel. Pass `pdfDocument` and `currentPage` as props from `CanvasViewport.tsx`. The ratio panel computes pixelsPerMm directly and calls the existing `onConfirm(ppm, displayUnit)` callback — identical to the draw-line path's confirm call.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab switching UI | Frontend (renderer) component | — | Pure UI state; no IPC, no persistence |
| Ratio denominator input | Frontend (renderer) component | — | Local numeric field, no store needed |
| page.view metadata access | Frontend (renderer) async | — | PDFDocumentProxy.getPage() is available in renderer; page.view is synchronous after getPage() resolves |
| pixelsPerMm computation | Frontend (renderer) pure function | — | scale-math.ts pattern; new helper function alongside existing computePixelsPerMm |
| Scale storage | scaleStore (Zustand) | — | setScale(page, pixelsPerMm, displayUnit) is already the canonical write path for both tabs |
| ISO sheet label | Frontend (renderer) pure function | — | String lookup table in component or scale-math.ts helper |

---

## Critical Discovery: CalibrationDialog vs ScalePopup

**The CONTEXT.md references `CalibrationDialog.tsx` as the dialog to extend. This component exists in the codebase but is NOT imported anywhere — it is dead code.**

The live calibration UI is `ScalePopup.tsx`, imported and rendered by `CanvasViewport.tsx`.

[VERIFIED: codebase grep — `import.*CalibrationDialog` returns zero matches. `ScalePopup` is the only component rendered at `calibState.mode === 'confirming'`]

**Implication for planning:** Phase 11 extends `ScalePopup.tsx`, not `CalibrationDialog.tsx`. The planner must use `ScalePopup` as the extension target. `CalibrationDialog.tsx` may be deleted as cleanup or left as dead code — either is acceptable; the phase does not depend on it.

---

## Standard Stack

### Core (no additions needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfjs-dist | 5.5.207 | PDFPageProxy.page.view access | Already the app's PDF renderer; page.view is a synchronous property on PDFPageProxy after getPage() resolves |
| React | 19.x | Component + hook model | Existing app framework |
| Zustand 5 | 5.0.12 | scaleStore.setScale (existing) | Existing state layer — ratio path calls the same action as draw-line path |

No new packages required. [VERIFIED: package.json read — all required libraries are already installed]

### Installation

No new npm installs needed for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
User opens CalibrationDialog (activate() called)
        |
        v
ScalePopup.tsx (rendered at calibState.mode === 'confirming')
  |
  +-- [Draw line tab] (existing)
  |     distanceText + unit → computePixelsPerMm(linePixelLength, distance, unit)
  |                                           → onConfirm(ppm, displayUnit)
  |
  +-- [Type ratio tab] (NEW — Phase 11)
        denominator input
        |
        v
        async: pdfDocument.getPage(currentPage).then(page => page.view)
        |
        page.view = [x0, y0, widthPt, heightPt]
        pageWidthMm = (widthPt - x0) * 25.4 / 72
        pageWidthPx  = pageSize.width  (from CanvasViewport prop)
        |
        pixelsPerMm = pageWidthPx / (pageWidthMm * denominator)
        |
        v
        onConfirm(pixelsPerMm, displayUnit)  ← same callback as draw-line tab
```

### Recommended Project Structure

```
src/renderer/src/
├── components/
│   └── ScalePopup.tsx         — extend with tab state + ratio panel (primary edit)
├── lib/
│   └── scale-math.ts          — add computePixelsPerMmFromRatio() + isoSheetLabel() helpers
└── tests/
    └── scale-ratio-math.test.ts   — unit tests for new helpers
```

### Pattern 1: Tab Switcher (inline, no library)

**What:** Two-button row above the existing confirm-mode content. Active tab gets `COLORS.accent` background; inactive tab gets `COLORS.dominant` background. Tab state is local `useState<'draw' | 'ratio'>('draw')`.

**When to use:** Simple two-option switcher; no routing or persistence needed. Existing app convention uses inline styles + COLORS tokens for all chrome (no Tailwind in canvas path).

```typescript
// Source: [ASSUMED — derived from existing ScalePopup.tsx inline-style pattern]
const [activeTab, setActiveTab] = useState<'draw' | 'ratio'>('draw')

// Tab row JSX (inside ScalePopup confirm-mode branch):
<div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 4, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
  {(['draw', 'ratio'] as const).map((tab) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      style={{
        flex: 1,
        padding: '6px 0',
        fontSize: 12,
        fontWeight: activeTab === tab ? 700 : 400,
        background: activeTab === tab ? COLORS.accent : COLORS.dominant,
        color: activeTab === tab ? COLORS.textOnAccent : COLORS.textSecondary,
        border: 'none',
        cursor: 'pointer'
      }}
    >
      {tab === 'draw' ? 'Draw line' : 'Type ratio'}
    </button>
  ))}
</div>
```

**Locked decision alignment:** D-01 specifies a two-tab layout. This pattern satisfies it without importing any tab library.

### Pattern 2: page.view Access

**What:** Async call to `pdfDocument.getPage(pageNumber)`, then read `page.view` synchronously.

**When to use:** Only when user switches to the "Type ratio" tab or ScalePopup mounts in ratio mode. Cache the result in local state to avoid re-fetching on re-renders.

```typescript
// Source: [VERIFIED: pdfjs-dist PDFPageProxy type — page.view is number[] on PDFPageProxy]
// Source: [VERIFIED: usePdfRenderer.ts line 41 — pdfDocument.getPage(pageNumber) pattern]
useEffect(() => {
  if (!pdfDocument || activeTab !== 'ratio') return
  let cancelled = false
  pdfDocument.getPage(currentPage).then((page) => {
    if (cancelled) return
    setPageView(page.view) // number[] — [x0, y0, widthPt, heightPt]
  })
  return () => { cancelled = true }
}, [pdfDocument, currentPage, activeTab])
```

**Key:** `page.view` is the raw PDF MediaBox in points (1 pt = 1/72 inch). For standard portrait A1: `[0, 0, 2384, 1684]` (widthPt ≈ 2384, heightPt ≈ 1684). Width in mm: `2384 * 25.4 / 72 ≈ 841 mm`. [VERIFIED: PDF specification — 1 point = 25.4/72 mm]

### Pattern 3: pixelsPerMm from Ratio

**What:** Pure function — given the page's pixel width (at current render resolution) and the derived page width in mm, compute pixelsPerMm for a 1:N ratio.

```typescript
// Source: [VERIFIED: by cross-checking with existing computePixelsPerMm in scale-math.ts]
/**
 * Compute pixelsPerMm from a 1:denominator drawing scale ratio.
 *
 * Formula derivation:
 *   The PDF is rendered at PDF_BASE_SCALE = 2.0, so pageWidthPx pixels
 *   represent the full physical page width in CSS pixels (DPR-normalised).
 *   Drawing scale 1:N means 1 mm on paper = N mm in reality.
 *   So pageWidthMm * N = physical real-world width represented by the drawing.
 *   But we only need pixelsPerMm where "mm" is in drawing space:
 *   pixelsPerMm = pageWidthPx / pageWidthMm
 *   (the ratio denominator cancels because pixelsPerMm already expresses
 *    how many rendered pixels correspond to 1 mm on the drawing paper).
 *
 *   This is numerically identical to the draw-line path for the same ratio:
 *   If you drew a line across the full page width (pageWidthPx pixels)
 *   and entered the real-world distance (pageWidthMm * denominator mm),
 *   computePixelsPerMm would return:
 *     pageWidthPx / (pageWidthMm * denominator / 1)   [in mm]
 *   which simplifies to pageWidthPx / pageWidthMm — same result.
 *   The denominator is used only to convert from real-world mm to drawing mm,
 *   which pageWidthMm already expresses directly.
 */
export function computePixelsPerMmFromRatio(
  pageWidthPx: number,   // CSS pixel width from usePdfRenderer pageSize.width
  pageViewWidthPt: number, // page.view[2] - page.view[0] in points
  _denominator: number   // 1:N ratio denominator — currently unused (see note)
): number {
  if (pageWidthPx <= 0) throw new Error('pageWidthPx must be positive')
  if (pageViewWidthPt <= 0) throw new Error('pageViewWidthPt must be positive')
  const pageWidthMm = pageViewWidthPt * 25.4 / 72
  // pixelsPerMm = pageWidthPx / pageWidthMm
  // The denominator is NOT divided here — see derivation above.
  return pageWidthPx / pageWidthMm
}
```

**CRITICAL NOTE — denominator confusion:** The denominator of the drawing scale (e.g. 100 in "1:100") does NOT appear in the pixelsPerMm formula. This surprises developers initially. The reason: `pixelsPerMm` stores how many rendered pixels equal 1 mm of *drawing paper*. The drawing paper width in mm is `pageViewWidthPt * 25.4 / 72` regardless of the scale ratio. The scale ratio only tells us how many real-world mm correspond to each drawing mm — which is what `formatScaleRatio(pixelsPerMm)` displays back to the user. The formula is correct without the denominator.

**Verification by cross-check:** Suppose A1 page (841 mm wide), rendered at `pageWidthPx = 1000 px`, scale 1:100.
- Draw-line: user draws 1000 px across the page, enters `841 * 100 = 84100 mm`. `computePixelsPerMm(1000, 84100, 'mm')` = `1000 / 84100` ≈ 0.01189 px/mm.
- Ratio path: `pageWidthPx / pageWidthMm` = `1000 / 841` ≈ 1.189 px/mm.

These are NOT equal. Re-examination:

The draw-line user enters the **real-world** dimension of the thing they measured on the drawing. If they drew across the whole page (1000 px), the real-world distance of an A1 page at 1:100 is 841 × 100 = 84100 mm. So `computePixelsPerMm(1000, 84100, 'mm') = 1000 / 84100 ≈ 0.01189`.

For the ratio path: `pageWidthMm = 841` (mm on paper). The real-world width is `841 * 100 = 84100 mm`. But we want pixelsPerMm where "mm" = real-world mm:
- `pixelsPerMm = pageWidthPx / realWorldPageWidthMm = 1000 / 84100 ≈ 0.01189`.

So the correct formula IS: `pixelsPerMm = pageWidthPx / (pageWidthMm * denominator)`. The denominator IS needed. [VERIFIED: by numerical cross-check above]

**Corrected formula:**

```typescript
export function computePixelsPerMmFromRatio(
  pageWidthPx: number,
  pageViewWidthPt: number,
  denominator: number
): number {
  if (pageWidthPx <= 0) throw new Error('pageWidthPx must be positive')
  if (pageViewWidthPt <= 0) throw new Error('pageViewWidthPt must be positive')
  if (denominator <= 0) throw new Error('denominator must be positive')
  const pageWidthMm = pageViewWidthPt * 25.4 / 72      // mm on drawing paper
  const realWorldWidthMm = pageWidthMm * denominator    // mm in reality
  return pageWidthPx / realWorldWidthMm
}
```

This matches `computePixelsPerMm(pageWidthPx, pageWidthMm * denominator, 'mm')` exactly, which confirms numerical equivalence with the draw-line path. [VERIFIED: algebraically]

### Pattern 4: ISO Sheet Size Label

**What:** Pure lookup that maps derived dimensions to an ISO size name, displayed as confirmation to the user (D-03).

```typescript
// Source: [CITED: ISO 216 standard — A-series dimensions]
// Tolerance ±5 mm to accommodate real-world PDF rounding.
const ISO_SIZES: Array<{ name: string; wMm: number; hMm: number }> = [
  { name: 'A0', wMm: 1189, hMm: 841 },
  { name: 'A1', wMm: 841,  hMm: 594 },
  { name: 'A2', wMm: 594,  hMm: 420 },
  { name: 'A3', wMm: 420,  hMm: 297 },
  { name: 'A4', wMm: 297,  hMm: 210 },
]

export function isoSheetLabel(widthMm: number, heightMm: number): string {
  const TOL = 5
  const w = Math.round(widthMm)
  const h = Math.round(heightMm)
  for (const s of ISO_SIZES) {
    // Check both portrait and landscape orientations
    if (
      (Math.abs(w - s.wMm) <= TOL && Math.abs(h - s.hMm) <= TOL) ||
      (Math.abs(w - s.hMm) <= TOL && Math.abs(h - s.wMm) <= TOL)
    ) {
      return `${w} × ${h} mm — ${s.name}`
    }
  }
  return `${w} × ${h} mm`
}
```

### Pattern 5: pageWidthPx Source

**What:** `pageSize.width` returned by `usePdfRenderer()` is the CSS pixel width of the rendered page (physical canvas pixels divided by DPR, then Math.floor'd). This is the correct value for pixelsPerMm because all Konva stage coordinates are in CSS pixels.

[VERIFIED: usePdfRenderer.ts lines 57-59 — `width: Math.floor(viewport.width)` where `viewport.width` is the CSS-pixel width at `PDF_BASE_SCALE = 2.0` before DPR multiplication]

**How to pass to ScalePopup:** `CanvasViewport.tsx` already has `displayPageSize` in its render scope. Pass it as a new prop `pageWidthPx?: number` to `ScalePopup`. The prop is optional so existing callsites (verify mode) need no change.

### Anti-Patterns to Avoid

- **Using `canvas.width` (physical pixels) instead of `pageSize.width` (CSS pixels):** canvas.width includes DPR multiplication. All Konva stage coordinates are in CSS pixels. Using canvas.width would produce a pixelsPerMm value that is DPR times too large, causing measurement errors on HiDPI displays.
- **Calling `pdfjsLib.getDocument` inside ScalePopup:** The document is already loaded in `viewerStore.pdfDocument`. Never call `getDocument` from a UI component; use the existing proxy. See Phase 4.1 detached-buffer landmine in STATE.md.
- **Reading `page.view` without checking for zero-origin pages:** Some PDFs have `page.view = [x0, y0, widthPt, heightPt]` where x0, y0 are non-zero (non-standard MediaBox origin). Always use `widthPt - x0` and `heightPt - y0`, not just `widthPt` and `heightPt`.
- **Using `stageRef.current?.scaleX()` for pageWidthPx:** Stage scale changes on zoom; page.width in page-space stays constant. Use `pageSize.width` from `usePdfRenderer`, not a zoomed stage measurement.
- **Importing Tailwind classes in ScalePopup:** The canvas path exclusively uses `COLORS` tokens + inline styles. No Tailwind in chrome path (cross-cutting constraint from Phase 6 and 7).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal draggability | Custom pointer capture logic | `useDraggable()` hook | Already used in ScalePopup.tsx line 52; same hook, same behaviour |
| Unit conversion for scale display | Custom mm→unit math | `fromMm(mm, unit)` in scale-math.ts | Already tested; covers all ScaleUnit values |
| Scale ratio display ("1:N") | Custom string format | `formatScaleRatio(pixelsPerMm)` (single-arg form) | Already in scale-math.ts:129; used for the draw-line toast |
| Pointer-event isolation | Manual stopPropagation chains | `pointerEvents: 'none'` on overlay + `pointerEvents: 'auto'` on card | ScalePopup already uses this pattern (lines 97, 109) |

---

## Common Pitfalls

### Pitfall 1: Wrong page.view Array Indexing

**What goes wrong:** Using `page.view[2]` as widthPt and `page.view[3]` as heightPt when the MediaBox origin is non-zero.

**Why it happens:** Standard PDFs have origin at `[0, 0, ...]`, so `page.view[2]` equals the actual width. But PDFs with crop boxes or unusual MediaBox origins can have `page.view = [x0, y0, x1, y1]` where width = `x1 - x0`.

**How to avoid:** Always compute `widthPt = page.view[2] - page.view[0]` and `heightPt = page.view[3] - page.view[1]`.

**Warning signs:** Sheet size display shows "2× expected value" or "negative mm" on some PDFs.

### Pitfall 2: Rotated Pages Swap Width and Height

**What goes wrong:** A PDF page with `/Rotate: 90` has `page.view = [0, 0, 594, 841]` (A1 landscape stored as portrait with rotation). After PDF.js applies the rotation, the rendered page is 841 px wide × 594 px tall. If you derive widthMm from `page.view[2] = 594`, it is transposed.

**Why it happens:** PDF.js handles rotation transparently during render — `pageSize.width` from `usePdfRenderer` is the post-rotation rendered width. But `page.view` always returns the pre-rotation MediaBox.

**How to avoid:** Use `page.getViewport({ scale: 1 }).width` (in points) as the "rendered page width" instead of `page.view[2]`. `page.getViewport` applies the rotation. Then convert: `renderedWidthPt * 25.4 / 72 = widthMm` in the orientation the user sees. Alternatively, compare the aspect ratio of `pageSize.width/pageSize.height` against `(view[2]-view[0])/(view[3]-view[1])` — if they differ significantly, the page is rotated.

**Simpler approach (recommended for v1.1):** Derive widthMm from `pageSize.width` rather than `page.view`. Since `pageSize.width` is rendered at `PDF_BASE_SCALE = 2.0`:
```
pageWidthMm = pageSize.width / (PDF_BASE_SCALE * 72 / 25.4)
            = pageSize.width * 25.4 / (2.0 * 72)
            = pageSize.width * 25.4 / 144
```
This automatically handles rotation because `pageSize.width` is post-rotation. No async `getPage()` call needed for the dimension — only the ratio computation uses it, and the sheet-size display can also use it.

**Trade-off:** If using `pageSize.width` for pageWidthMm, the `page.view` call is only needed for the "degenerate metadata" guard (D-03 fallback message). If `pageSize.width > 0` (it always is when ScalePopup renders), there is no degenerate case — the guard becomes unnecessary. This simplifies the implementation significantly.

[ASSUMED: Whether the product owner prefers showing the physical mm sheet size (from page.view) or just computing pixelsPerMm from pageSize.width. Both produce the same pixelsPerMm. The sheet-size display for user confirmation (D-03) requires page.view. See Open Questions #1.]

### Pitfall 3: ScalePopup Receives `pixelLength` for Draw-Line; Ratio Tab Does Not Use It

**What goes wrong:** Treating `pixelLength` prop (the drawn calibration line's pixel length) as available for the ratio path.

**Why it happens:** ScalePopup is currently rendered only when `calibState.mode === 'confirming'`, i.e., after the user has finished drawing a line. Ratio mode needs to show before the user draws any line.

**How to avoid:** The ratio tab is triggered from a different entry point. Two architectural options:
- **Option A (simpler):** Add a second render path in CanvasViewport that shows ScalePopup in ratio mode even when `calibState.mode === 'idle'` — triggered by a toolbar "Set Scale (ratio)" button or by a new `calibState.mode === 'ratio'` mode.
- **Option B (cleaner for D-01):** Show ScalePopup as soon as the user clicks "Set Scale" (before drawing), defaulting to the "Draw line" tab. The "Type ratio" tab is then available without needing to draw a line first.

The CONTEXT.md D-01 says the user "picks the mode before touching the canvas," which implies Option B. The existing flow is: user clicks Set Scale → `activate()` sets `calibState.mode = 'drawing'` → user draws → mode transitions to `'confirming'` → ScalePopup appears.

For Option B (D-01 compliant), a new `CalibMode` value `'ratio'` must be added, and ScalePopup must render for that mode too. Or more simply: the tab within ScalePopup is shown on `'confirming'` mode (draw-line already done) but the ratio tab is also accessible without drawing (different trigger path).

**Recommended approach:** Add a `CalibMode` value `'typing'` (or `'ratio'`). When the user selects the ratio tab from within the draw-line flow OR clicks a new entry point, set `calibMode = 'typing'`. CanvasViewport renders ScalePopup when `calibState.mode === 'confirming' || calibState.mode === 'typing'`.

Alternatively (simpler): Show the "Type ratio" tab within the ScalePopup that appears after a line IS drawn — so both tabs are always present. In ratio mode, the drawn line data is ignored. The user can choose which method to use for that session. If they switch to ratio mode and click Accept, the line drawing is discarded. This is D-01 compliant and requires the fewest code changes.

[ASSUMED: Which entry point approach the planner should use. See Open Questions #2.]

### Pitfall 4: useCalibrationMode Has No "ratio" Mode — Needs Extension

**What goes wrong:** Assuming the existing `CalibMode` type supports ratio entry without changes.

**Why it happens:** `CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying'`. None of these express "showing the ratio input tab without a drawn line."

**How to avoid:** Extend `CalibMode` in `types/scale.ts` with a `'typing'` value. Update `useCalibrationMode` with a new `activateRatio()` method. Update CanvasViewport's render guards to show ScalePopup when `calibState.mode === 'typing'`. Update Toolbar/RibbonToolbar Set Scale button to call `activate()` (existing, arms draw-line mode) — the ratio tab is accessible via tab switching inside ScalePopup, not a separate button.

**Simpler alternative:** The ratio tab is shown as part of the existing `'confirming'` ScalePopup. No new CalibMode needed. After drawing a line, both tabs appear. Ratio tab ignores the drawn line. This is the minimal-change approach. [ASSUMED — depends on D-01 interpretation]

### Pitfall 5: Async getPage() Inside Component Render

**What goes wrong:** Calling `pdfDocument.getPage(n)` without cleanup leads to stale state updates after unmount.

**How to avoid:** Use the `cancelled` ref pattern already established in `usePdfRenderer.ts` (lines 86-88). Always return a cleanup function from the `useEffect` that sets `cancelled = true`. The pattern is identical to the existing pre-render cleanup.

---

## Code Examples

Verified patterns from official sources:

### pixelsPerMm from Ratio (corrected, verified)

```typescript
// Source: [VERIFIED: algebraically cross-checked against computePixelsPerMm in scale-math.ts]
// This produces the same value as:
//   computePixelsPerMm(pageWidthPx, pageWidthMm * denominator, 'mm')
function computePixelsPerMmFromRatio(
  pageWidthPx: number,   // pageSize.width from usePdfRenderer
  pageViewWidthPt: number, // page.view[2] - page.view[0]
  denominator: number    // 1:N ratio — e.g. 100 for 1:100
): number {
  if (pageWidthPx <= 0) throw new Error('pageWidthPx must be positive')
  if (pageViewWidthPt <= 0) throw new Error('pageViewWidthPt must be positive')
  if (denominator <= 0) throw new Error('denominator must be positive')
  const pageWidthMm = pageViewWidthPt * 25.4 / 72
  return pageWidthPx / (pageWidthMm * denominator)
}
```

### pageSize-based approach (avoids rotation pitfall)

```typescript
// Source: [VERIFIED: usePdfRenderer.ts line 57 — width: Math.floor(viewport.width)]
// Constants: PDF_BASE_SCALE = 2.0, 1 point = 25.4/72 mm
// pageSize.width = Math.floor(viewport.width) where viewport is at scale PDF_BASE_SCALE
// viewport.width (in px) = widthPt * PDF_BASE_SCALE (post-rotation, DPR-independent CSS px)
// Therefore: widthMm = pageSize.width * 25.4 / (PDF_BASE_SCALE * 72) = pageSize.width * 25.4 / 144
function computePixelsPerMmFromRatioViaPageSize(
  pageWidthPx: number,   // pageSize.width — already post-rotation, CSS pixels
  denominator: number
): number {
  const PDF_BASE_SCALE = 2.0
  const pageWidthMm = pageWidthPx * 25.4 / (PDF_BASE_SCALE * 72)
  return pageWidthPx / (pageWidthMm * denominator)
  // Simplifies to: (PDF_BASE_SCALE * 72) / (25.4 * denominator)
  // = 144 / (25.4 * denominator)
}
```

This approach does NOT require an async `page.view` fetch for the pixelsPerMm computation. However, `page.view` is still needed to derive the human-readable sheet size display (D-03).

### page.view Access Pattern

```typescript
// Source: [VERIFIED: pdfjs-dist PDFPageProxy type; usePdfRenderer.ts:41 for getPage pattern]
useEffect(() => {
  if (!pdfDocument) return
  let cancelled = false
  ;(pdfDocument as PDFDocumentProxy).getPage(currentPage).then((page) => {
    if (cancelled) return
    const [x0, y0, x1, y1] = page.view
    const widthPt = x1 - x0
    const heightPt = y1 - y0
    if (widthPt > 0 && heightPt > 0) {
      setPageView({ widthPt, heightPt })
    } else {
      setPageView(null) // triggers degenerate guard
    }
  })
  return () => { cancelled = true }
}, [pdfDocument, currentPage])
```

### Degenerate Guard Display

```typescript
// Source: [ASSUMED — derived from D-03 in CONTEXT.md and COLORS token convention]
{pageView === null && activeTab === 'ratio' && (
  <div style={{ fontSize: 12, color: COLORS.warning }}>
    PDF metadata missing — page dimensions could not be read.
    Use the Draw Line tab instead.
  </div>
)}
```

---

## Calibration Flow: Current vs Extended

### Current (draw-line only)

```
activate() → calibMode='drawing' → user draws line → recordClick() → calibMode='confirming'
→ ScalePopup renders (confirm mode) → user enters distance+unit → onConfirm(ppm, displayUnit)
→ setScale(page, ppm, displayUnit) → cancel() → toast
```

### Extended (both tabs)

```
activate() → calibMode='drawing' → ScalePopup renders (both tabs visible, defaulting to 'draw')

  [Draw line tab]: user draws line → recordClick() → calibMode='confirming' (as before)
                   → user enters distance → onConfirm(ppm, displayUnit) → setScale → cancel → toast

  [Type ratio tab]: user switches tab (no canvas action needed)
                    → async: getPage() → page.view → derive sheet size
                    → user types denominator → preview shows "1:N" + sheet size
                    → user clicks Accept → onConfirm(ppm, displayUnit) → setScale → cancel → toast
```

**Trigger for ratio tab without drawing a line first:** ScalePopup must be rendered when `calibState.mode === 'drawing'` (not just `'confirming'`). Currently it only renders on `'confirming'`. This is the key structural change.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CalibrationDialog.tsx | ScalePopup.tsx (active UI) | Phase 2/7 (dialog refactored to popup) | CalibrationDialog is dead code; ScalePopup is the target |
| ScalePopup render only at 'confirming' | Render also at 'drawing' (for ratio tab) | Phase 11 | Enables ratio tab without requiring a drawn line first |
| Single calibration path (draw-line) | Two paths: draw-line + type-ratio | Phase 11 | User can skip canvas interaction when scale is known |

**Deprecated/outdated:**

- `CalibrationDialog.tsx`: No import sites; dead code. Safe to delete after Phase 11 or leave as-is.
- Old two-arg `formatScaleRatio(pixelsPerUnit, unit)` form in scale-math.ts: kept for backward compat but flagged deprecated. New code uses single-arg form.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ratio tab should be accessible before drawing any line (D-01: "picks mode before touching the canvas") — implying ScalePopup should render at `calibState.mode === 'drawing'`, not just `'confirming'` | Architecture Patterns, Pitfall 3 | If wrong: ratio tab is only available after drawing a line, which partially defeats the purpose. Low risk — either approach works; the planner must pick one. |
| A2 | ISO sizes A0–A4 with ±5 mm tolerance covers 95%+ of construction drawing formats used in Australia/NZ | Code Examples, isoSheetLabel | If wrong: some non-ISO sizes (US Arch D/E, B-series) won't label. Low risk — unlabelled sizes still show raw mm dimensions. |
| A3 | The `pageSize.width`-based formula (`pageWidthPx * 25.4 / (PDF_BASE_SCALE * 72)`) handles rotated pages correctly because `pageSize.width` is post-rotation | Pitfall 2, Code Examples | If wrong: rotated page sheet size display is transposed (width and height swapped). Only affects the display label, not pixelsPerMm computation accuracy. Medium risk for display correctness. |
| A4 | `CalibrationDialog.tsx` should remain as-is (dead code) for Phase 11 rather than being deleted | Critical Discovery section | If wrong: planner deletes it as a cleanup task; adds one small extra task but no functional risk. |
| A5 | The displayUnit passed to `setScale` from the ratio tab should use the current `scaleStore.globalUnit` (or a new unit picker on the ratio tab) | (not explicitly stated in CONTEXT.md) | If wrong: the unit shown in StatusBar after ratio calibration may not match user expectation. Recommend: copy the unit selector from the draw-line tab to the ratio tab, or default to `globalUnit`. |

---

## Open Questions

1. **Sheet size display: use `page.view` or `pageSize.width`?**
   - What we know: `page.view` gives the PDF MediaBox in points (may be affected by rotation); `pageSize.width` gives the post-rotation rendered CSS pixel width.
   - What's unclear: D-03 says "auto-derived from PDF.js `page.view`" — but for rotated pages, page.view width and rendered width differ. The sheet label (e.g. "841 × 594 mm") should match what the estimator sees on screen.
   - Recommendation: use `pageSize.width` and `pageSize.height` converted via `PDF_BASE_SCALE * 72 / 25.4` to derive mm dimensions for display. This is rotation-safe. Mention `page.view` only for the degenerate guard (if pageSize is somehow zero, which is theoretically impossible when ScalePopup is rendered, so the guard is moot). Document this deviation from CONTEXT.md D-03 verbatim language.

2. **Ratio tab entry point: at 'drawing' mode or 'confirming' mode?**
   - What we know: D-01 says "before touching the canvas." Current ScalePopup only renders at 'confirming'.
   - What's unclear: Should the ratio tab appear immediately when the user clicks Set Scale (at 'drawing'), or only after drawing a line (at 'confirming')?
   - Recommendation: Show ScalePopup at `'drawing'` mode too, defaulting to 'Draw line' tab. This matches D-01 and gives maximum flexibility. The draw-line tab prompts the user to draw the line; the ratio tab lets them skip it entirely.

3. **displayUnit for ratio accept: reuse existing unit selector or default to globalUnit?**
   - What we know: `setScale(page, pixelsPerMm, displayUnit)` requires a ScaleUnit. The draw-line tab has a unit picker.
   - What's unclear: Should the ratio tab also have a unit picker, or default to `scaleStore.globalUnit`?
   - Recommendation: Include the same unit picker on the ratio tab for consistency.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is renderer-layer only; all required libraries are already installed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (exists at project root) |
| Quick run command | `npx vitest run src/tests/scale-ratio-math.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAL-01 (ratio path) | `computePixelsPerMmFromRatio` produces same value as `computePixelsPerMm` for same ratio | unit | `npx vitest run src/tests/scale-ratio-math.test.ts` | ❌ Wave 0 |
| SCAL-01 (ratio path) | `isoSheetLabel` returns correct label for A0–A4 dimensions ± 5 mm tolerance | unit | `npx vitest run src/tests/scale-ratio-math.test.ts` | ❌ Wave 0 |
| SCAL-01 (ratio path) | Degenerate page.view guard — widthPt ≤ 0 triggers warning state | unit | `npx vitest run src/tests/scale-ratio-math.test.ts` | ❌ Wave 0 |
| SCAL-01 (ratio path) | `computePixelsPerMmFromRatio` throws for denominator ≤ 0 | unit | `npx vitest run src/tests/scale-ratio-math.test.ts` | ❌ Wave 0 |
| SCAL-01 (UI) | ScalePopup renders both tabs; switching tabs does not reset the drawn-line pixelLength | manual/render | manual UAT | — |

### Sampling Rate

- **Per task commit:** `npx vitest run src/tests/scale-ratio-math.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/scale-ratio-math.test.ts` — covers `computePixelsPerMmFromRatio`, `isoSheetLabel`, degenerate guard, throw conditions

---

## Security Domain

`security_enforcement` is absent from config.json — treated as enabled.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (denominator input) | Validate: `isNaN`, `isFinite`, `> 0`, integer-only (no decimals in denominator); reject strings |
| V6 Cryptography | no | — |

**Input validation for denominator field:** The right-hand numeric input must reject: empty string, NaN, Infinity, zero, negative values, and non-integer values (ratios are always whole numbers). Use `type="number"`, `min={1}`, `step={1}`, plus a runtime guard in the confirm handler. The left field is locked to 1 (read-only) — no validation needed.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `src/renderer/src/components/ScalePopup.tsx` — live calibration UI; CalibrationDialog is dead code
- [VERIFIED: codebase] `src/renderer/src/components/CanvasViewport.tsx` — ScalePopup render conditions, setScale callsite, calibState structure
- [VERIFIED: codebase] `src/renderer/src/hooks/usePdfRenderer.ts` — `pageSize.width` is CSS pixel width; `getPage()` pattern; `PDF_BASE_SCALE = 2.0`
- [VERIFIED: codebase] `src/renderer/src/lib/scale-math.ts` — `computePixelsPerMm` formula; `toMm`/`fromMm` helpers; `formatScaleRatio` single-arg form
- [VERIFIED: codebase] `src/renderer/src/stores/scaleStore.ts` — `setScale(page, pixelsPerMm, displayUnit)` is the canonical write action
- [VERIFIED: codebase] `src/renderer/src/types/scale.ts` — `CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying'`; `ScaleUnit` type
- [CITED: PDF specification, ISO 32000-1 §14.11.2] `page.view` is the MediaBox `[x_min, y_min, x_max, y_max]` in points (1/72 inch). Always compute `width = x_max - x_min`.
- [CITED: ISO 216] A-series sheet dimensions: A0 1189×841, A1 841×594, A2 594×420, A3 420×297, A4 297×210 mm.

### Secondary (MEDIUM confidence)

- [ASSUMED + algebraic verification] `computePixelsPerMmFromRatio` formula cross-checked against `computePixelsPerMm` numerically — confirmed equivalence.

### Tertiary (LOW confidence)

- [ASSUMED] A4 tolerance ±5 mm for ISO sheet detection covers real-world PDF rounding from point-based dimensions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all verified against installed codebase
- Architecture: HIGH — ScalePopup/CanvasViewport structure directly read; formula algebraically verified
- Pitfalls: HIGH (rotation pitfall) / MEDIUM (entry point question) — rotation is a known PDF.js concern; entry point is design choice

**Research date:** 2026-05-20
**Valid until:** 2026-07-01 (stable tech stack; no fast-moving dependencies)
