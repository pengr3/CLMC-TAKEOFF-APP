# Phase 11: Scale Ratio Input - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 4
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/components/ScalePopup.tsx` | component (extension) | request-response | `src/renderer/src/components/ScalePopup.tsx` (self — extend in place) | exact |
| `src/renderer/src/hooks/useCalibrationMode.ts` | hook (extension) | event-driven | `src/renderer/src/hooks/useCalibrationMode.ts` (self — extend in place) | exact |
| `src/renderer/src/lib/scale-math.ts` | utility (extension) | transform | `src/renderer/src/lib/scale-math.ts` (self — extend in place) | exact |
| `src/tests/scale-ratio-math.test.ts` | test (new) | — | `src/tests/scale-math.test.ts` | exact |

---

## Pattern Assignments

### `src/renderer/src/components/ScalePopup.tsx` (component, request-response)

**Analog:** Self — extend the existing file in place.

**Imports pattern** (lines 1-6):
```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { computePixelsPerMm, formatScaleRatio, pixelsToRealWorld, MIN_CALIBRATION_PIXELS } from '../lib/scale-math'
import type { ScaleUnit, PageScale } from '../types/scale'
import { useDraggable } from '../hooks/useDraggable'
```
New imports to add: `computePixelsPerMmFromRatio, isoSheetLabel` from `'../lib/scale-math'`.
The `PDFDocumentProxy` type is already available via `'../lib/pdf-setup'` (as used in `usePdfRenderer.ts` line 2).

**Props extension pattern** (lines 19-27 — ScalePopupProps interface):
```typescript
export interface ScalePopupProps {
  mode: 'confirm' | 'verify'
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  pixelLength: number
  onConfirm?: (pixelsPerMm: number, displayUnit: ScaleUnit) => void
  onCancel: () => void
  pageScale?: PageScale | null
}
```
Add two new optional props for the ratio tab (both optional — existing confirm/verify callsites need no changes):
```typescript
  pdfDocument?: import('../lib/pdf-setup').PDFDocumentProxy | null
  pageWidthPx?: number   // pageSize.width from usePdfRenderer — CSS pixels
  currentPage?: number
```

**Tab state pattern** — add alongside existing `useState` declarations (after line 51):
```typescript
const [activeTab, setActiveTab] = useState<'draw' | 'ratio'>('draw')
const [denominator, setDenominator] = useState<string>('100')
const [pageView, setPageView] = useState<{ widthPt: number; heightPt: number } | null>(null)
```

**Async page.view fetch pattern** — copy the `cancelled` ref pattern from `usePdfRenderer.ts` lines 85-88:
```typescript
// Source: usePdfRenderer.ts lines 85-192 — cancelled ref guard for async pdfjs calls
useEffect(() => {
  if (!pdfDocument || activeTab !== 'ratio' || !currentPage) return
  let cancelled = false
  pdfDocument.getPage(currentPage).then((page) => {
    if (cancelled) return
    const [x0, y0, x1, y1] = page.view
    const widthPt = x1 - x0
    const heightPt = y1 - y0
    if (widthPt > 0 && heightPt > 0) {
      setPageView({ widthPt, heightPt })
    } else {
      setPageView(null)
    }
  })
  return () => { cancelled = true }
}, [pdfDocument, currentPage, activeTab])
```

**Tab switcher UI pattern** — inline button row, no library, using COLORS tokens. Follows the exact same `COLORS.dominant` / `COLORS.accent` pattern already used throughout the component (see lines 208-215 for COLORS.dominant input backgrounds and lines 345-362 for COLORS.accent primary button):
```typescript
// Tab switcher — place immediately after the "Set Scale" title div (after line 188)
{mode === 'confirm' && (
  <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
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
)}
```

**Ratio tab input pattern** — two side-by-side numeric fields, left locked to 1. Uses the same `COLORS.dominant` / `COLORS.border` / `COLORS.textPrimary` tokens as the existing distance input (lines 196-216):
```typescript
{activeTab === 'ratio' && (
  <div>
    <label style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>
      Drawing scale
    </label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        value={1}
        readOnly
        style={{
          width: 48,
          height: 32,
          padding: '4px 8px',
          background: COLORS.dominant,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          color: COLORS.textSecondary,
          fontSize: 13,
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      />
      <span style={{ color: COLORS.textSecondary, fontSize: 16, fontWeight: 600 }}>:</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={denominator}
        onChange={(e) => setDenominator(e.target.value)}
        autoFocus
        style={{
          flex: 1,
          height: 32,
          padding: '4px 10px',
          background: COLORS.dominant,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          color: COLORS.textPrimary,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    </div>
  </div>
)}
```

**Sheet size display pattern** — read-only confirmation line, follows existing error/preview display pattern (lines 307-321):
```typescript
{activeTab === 'ratio' && pageView && (
  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
    {isoSheetLabel(
      pageView.widthPt * 25.4 / 72,
      pageView.heightPt * 25.4 / 72
    )}
  </div>
)}
{activeTab === 'ratio' && pageView === null && (
  <div style={{ fontSize: 12, color: COLORS.warning }}>
    PDF metadata missing — use the Draw Line tab instead.
  </div>
)}
```

**Degenerate guard on Accept button** — follow the `canConfirm` disabled pattern (lines 348-362):
```typescript
// For ratio tab:
const parsedDenominator = parseInt(denominator, 10)
const isValidDenominator = !isNaN(parsedDenominator) && parsedDenominator > 0 && isFinite(parsedDenominator)
const canConfirmRatio = isValidDenominator && pageWidthPx != null && pageWidthPx > 0 && pageView !== null

// Ratio tab confirm handler (parallel to handleConfirmClick, lines 75-79):
const handleRatioConfirmClick = useCallback((): void => {
  if (!canConfirmRatio || !onConfirm || pageWidthPx == null || !pageView) return
  const ppm = computePixelsPerMmFromRatio(pageWidthPx, pageView.widthPt, parsedDenominator)
  onConfirm(ppm, unit)
}, [canConfirmRatio, onConfirm, pageWidthPx, pageView, parsedDenominator, unit])
```

**Overlay / pointer-events pattern** (lines 91-99 and 101-125 — no changes needed):
The existing overlay and container styles are reused exactly. The ratio tab content slots inside the same `containerStyle` div. No changes to overlay/draggable/zIndex patterns.

**CanvasViewport render condition change** (CanvasViewport.tsx lines 1247, 1264):
Change `calibState.mode === 'confirming'` to `calibState.mode === 'confirming' || calibState.mode === 'drawing'` for the confirm-mode ScalePopup. Add new props:
```typescript
// Source: CanvasViewport.tsx lines 1247-1261
// Existing:
{calibState.mode === 'confirming' && calibState.popupScreenPos && !calibState.isVerify && (
  <ScalePopup
    mode="confirm"
    ...
  />
)}

// Extended:
{(calibState.mode === 'confirming' || calibState.mode === 'drawing') && !calibState.isVerify && (
  <ScalePopup
    mode="confirm"
    screenPos={calibState.popupScreenPos ?? { x: 0, y: 0 }}
    containerSize={containerSize}
    pixelLength={calibState.linePixelLength}
    pdfDocument={pdfDocument}          // from usePdfDocument hook — already in scope
    pageWidthPx={pageSize?.width}      // from usePdfRenderer — already in scope
    currentPage={currentPage}
    onConfirm={(pixelsPerMm: number, displayUnit: ScaleUnit) => {
      setScale(currentPage, pixelsPerMm, displayUnit)
      const ratioText = formatScaleRatio(pixelsPerMm)
      cancel()
      setToast({ ratioText })
    }}
    onCancel={cancel}
  />
)}
```

---

### `src/renderer/src/hooks/useCalibrationMode.ts` (hook, event-driven)

**Analog:** Self — extend the existing file in place.

**CalibMode type extension** — source file `src/renderer/src/types/scale.ts` line 11:
```typescript
// Current:
export type CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying'

// Extended:
export type CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying' | 'typing'
```
`'typing'` is the new mode representing "ratio tab active, no drawn line required." Used to distinguish the ratio entry path from the draw-line path at the store/toolbar layer if needed. However, based on RESEARCH.md recommendation: the simpler approach is to show ScalePopup when `calibState.mode === 'drawing'` (already has an `activate()` call) so no new mode value is strictly required for Phase 11. If the planner opts for the simpler approach, skip this change and handle it purely in CanvasViewport's render condition.

**activate() pattern** (lines 70-73 — no changes needed for the simple approach):
```typescript
// Source: useCalibrationMode.ts lines 70-73
const activate = useCallback(() => {
  setState({ ...INITIAL_STATE, mode: 'drawing', isVerify: false })
  useScaleStore.getState().setCalibMode('drawing')
}, [])
```
The ratio tab will be accessible as soon as the user clicks "Set Scale" (which calls `activate()`), because `ScalePopup` will now render at `'drawing'` mode. No new `activateRatio()` method is needed unless the planner requires a dedicated ratio entry point.

**UseCalibrationModeReturn interface** (lines 23-31 — reference only, no changes for simple approach):
```typescript
export interface UseCalibrationModeReturn {
  state: CalibrationState
  activate: () => void
  activateVerify: () => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  recomputePopupPos: () => void
}
```

**Escape-key cancel pattern** (lines 86-96 — applies to ratio mode too with no changes):
```typescript
// Source: useCalibrationMode.ts lines 86-96
useEffect(() => {
  if (state.mode === 'idle') return
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [state.mode, cancel])
```

---

### `src/renderer/src/lib/scale-math.ts` (utility, transform)

**Analog:** Self — append new exported functions to the existing file.

**Existing function signature pattern to match** (lines 143-156):
```typescript
// Source: scale-math.ts lines 143-156 — computePixelsPerMm
export function computePixelsPerMm(
  linePixelLength: number,
  realWorldDistance: number,
  unit: ScaleUnit
): number {
  if (linePixelLength <= 0) {
    throw new Error('Pixel distance must be positive')
  }
  if (realWorldDistance <= 0) {
    throw new Error('Real-world distance must be positive')
  }
  const realWorldMm = toMm(realWorldDistance, unit)
  return linePixelLength / realWorldMm
}
```

**New function to add — computePixelsPerMmFromRatio** (append after line 156):
```typescript
// Source: RESEARCH.md Pattern 3 (corrected formula, algebraically verified)
/**
 * Compute the canonical scale ratio (pixels per millimetre) from a 1:N drawing scale ratio.
 *
 * Equivalent to: computePixelsPerMm(pageWidthPx, pageViewWidthPt * 25.4 / 72 * denominator, 'mm')
 *
 * pageViewWidthPt: use page.view[2] - page.view[0] (always subtract origin — see Pitfall 1).
 * denominator: the N in "1:N" (e.g. 100 for 1:100 scale).
 */
export function computePixelsPerMmFromRatio(
  pageWidthPx: number,
  pageViewWidthPt: number,
  denominator: number
): number {
  if (pageWidthPx <= 0) throw new Error('pageWidthPx must be positive')
  if (pageViewWidthPt <= 0) throw new Error('pageViewWidthPt must be positive')
  if (denominator <= 0) throw new Error('denominator must be positive')
  const pageWidthMm = pageViewWidthPt * 25.4 / 72
  const realWorldWidthMm = pageWidthMm * denominator
  return pageWidthPx / realWorldWidthMm
}
```

**New function to add — isoSheetLabel** (append after computePixelsPerMmFromRatio):
```typescript
// Source: RESEARCH.md Pattern 4; ISO 216 standard dimensions
const ISO_SIZES: Array<{ name: string; wMm: number; hMm: number }> = [
  { name: 'A0', wMm: 1189, hMm: 841 },
  { name: 'A1', wMm: 841,  hMm: 594 },
  { name: 'A2', wMm: 594,  hMm: 420 },
  { name: 'A3', wMm: 420,  hMm: 297 },
  { name: 'A4', wMm: 297,  hMm: 210 },
]

/**
 * Return a human-readable ISO sheet size label for the given dimensions.
 * Matches portrait and landscape orientations with ±5 mm tolerance.
 * Returns "W × H mm — SizeName" if matched, or "W × H mm" if no match.
 */
export function isoSheetLabel(widthMm: number, heightMm: number): string {
  const TOL = 5
  const w = Math.round(widthMm)
  const h = Math.round(heightMm)
  for (const s of ISO_SIZES) {
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

---

### `src/tests/scale-ratio-math.test.ts` (test, new file)

**Analog:** `src/tests/scale-math.test.ts` — exact match for file structure, import style, and describe/it nesting.

**File header and import pattern** (scale-math.test.ts lines 1-8):
```typescript
import { describe, it, expect } from 'vitest'
import {
  euclideanDistance,
  computePixelsPerUnit,
  // ...
} from '@renderer/lib/scale-math'
```
New test file follows the same pattern using `@renderer` path alias:
```typescript
import { describe, it, expect } from 'vitest'
import {
  computePixelsPerMmFromRatio,
  isoSheetLabel
} from '@renderer/lib/scale-math'
```

**Describe/it nesting pattern** (scale-math.test.ts lines 10-135):
```typescript
describe('computePixelsPerMmFromRatio', () => {
  it('matches computePixelsPerMm for the same ratio', () => { ... })
  it('throws for pageWidthPx <= 0', () => { ... })
  it('throws for pageViewWidthPt <= 0', () => { ... })
  it('throws for denominator <= 0', () => { ... })
  // numeric cross-check:
  it('A1 page at 1:100 scale matches draw-line path', () => { ... })
})

describe('isoSheetLabel', () => {
  it('labels A0 portrait', () => { ... })
  it('labels A1 portrait', () => { ... })
  it('labels A1 landscape', () => { ... })
  it('labels A4 portrait', () => { ... })
  it('returns raw mm for unmatched dimensions', () => { ... })
  it('matches within ±5 mm tolerance', () => { ... })
})
```

**Throw assertion pattern** (scale-math.test.ts lines 44-67):
```typescript
it('throws when pixel distance is zero', () => {
  expect(() => computePixelsPerUnit(0, 5)).toThrow(
    'Pixel distance must be positive'
  )
})
```

**Numeric cross-check pattern** (scale-math.test.ts lines 91-94):
```typescript
it('round-trips with computePixelsPerUnit', () => {
  const ppu = computePixelsPerUnit(500, 5)
  expect(pixelsToRealWorld(500, ppu)).toBeCloseTo(5, 10)
})
```
For ratio math cross-check:
```typescript
it('A1 page at 1:100 matches draw-line path', () => {
  // A1: 841mm wide. At PDF_BASE_SCALE=2, 841mm * 2 * (72/25.4) ≈ 4783 px.
  // page.view widthPt = 841 * 72 / 25.4 ≈ 2384 pt
  const pageWidthPx = 1000
  const pageViewWidthPt = 2384   // ~841mm in pt
  const denominator = 100
  const fromRatio = computePixelsPerMmFromRatio(pageWidthPx, pageViewWidthPt, denominator)
  // Draw-line path: computePixelsPerMm(1000, 841 * 100, 'mm') = 1000 / 84100
  const { computePixelsPerMm } = await import('@renderer/lib/scale-math')
  const pageWidthMm = pageViewWidthPt * 25.4 / 72  // ≈ 841
  const fromDrawLine = computePixelsPerMm(pageWidthPx, pageWidthMm * denominator, 'mm')
  expect(fromRatio).toBeCloseTo(fromDrawLine, 10)
})
```

---

## Shared Patterns

### Inline Styles + COLORS Tokens (no Tailwind in canvas path)
**Source:** `src/renderer/src/components/ScalePopup.tsx` throughout
**Apply to:** All JSX in ScalePopup.tsx additions
```typescript
// Source: ScalePopup.tsx lines 208-215 — input background
background: COLORS.dominant,
border: `1px solid ${COLORS.border}`,
borderRadius: 4,
color: COLORS.textPrimary,

// Source: ScalePopup.tsx lines 307-309 — warning/error text
color: COLORS.warning

// Source: ScalePopup.tsx lines 314-319 — preview text
color: previewRatio ? COLORS.accent : COLORS.textSecondary
```
NEVER use Tailwind classes in ScalePopup or any file in the canvas/popup path.

### Async Effect Cleanup (cancelled ref pattern)
**Source:** `src/renderer/src/hooks/usePdfRenderer.ts` lines 85-88
**Apply to:** Any `useEffect` that calls `pdfDocument.getPage()` inside ScalePopup
```typescript
let cancelled = false
// ... async work ...
return () => { cancelled = true }
```

### computePixelsPerMm Error Pattern
**Source:** `src/renderer/src/lib/scale-math.ts` lines 148-154
**Apply to:** `computePixelsPerMmFromRatio` guards in scale-math.ts
```typescript
if (linePixelLength <= 0) {
  throw new Error('Pixel distance must be positive')
}
if (realWorldDistance <= 0) {
  throw new Error('Real-world distance must be positive')
}
```

### onConfirm Callback Signature
**Source:** `src/renderer/src/components/ScalePopup.tsx` lines 24, 75-79 and `src/renderer/src/components/CanvasViewport.tsx` lines 1253-1258
**Apply to:** Ratio tab confirm handler — must call the identical callback
```typescript
// ScalePopup.tsx lines 75-79
const handleConfirmClick = useCallback((): void => {
  if (!canConfirm || !onConfirm) return
  const ppm = computePixelsPerMm(pixelLength, parsedDistance, unit)
  onConfirm(ppm, unit)
}, [canConfirm, onConfirm, pixelLength, parsedDistance, unit])
```
Ratio tab confirm must produce the same `(pixelsPerMm: number, displayUnit: ScaleUnit)` signature.

### Unit Selector (share with draw-line tab)
**Source:** `src/renderer/src/components/ScalePopup.tsx` lines 48-49, 220-303
The existing `unit` state and unit dropdown are defined at the top of the confirm-mode block. Both tabs share the same `unit` state — the ratio tab Accept button uses the same `unit` value already tracked by the existing unit picker. The unit picker JSX only needs to be conditionally shown (hide it or keep it visible in both tabs; simpler to keep it always visible so unit is always set).

---

## No Analog Found

No files in this phase lack a codebase analog. All four files have direct matches.

---

## Critical Notes for Planner

1. **ScalePopup render at 'drawing' mode:** The most important structural change is in `CanvasViewport.tsx` — changing the render condition from `calibState.mode === 'confirming'` to `calibState.mode === 'confirming' || calibState.mode === 'drawing'` for the confirm ScalePopup. This is what allows the ratio tab to be selected before drawing any line. `calibState.popupScreenPos` will be `null` at 'drawing' mode so the `?? { x: 0, y: 0 }` fallback (or omitting the screenPos guard) is needed.

2. **page.view indexing:** Always use `page.view[2] - page.view[0]` for widthPt and `page.view[3] - page.view[1]` for heightPt. Never use `page.view[2]` alone (see RESEARCH.md Pitfall 1).

3. **pdfDocument source in ScalePopup:** Pass `pdfDocument` as a prop from `CanvasViewport`. Do NOT call `pdfjsLib.getDocument` inside ScalePopup. The document is already available from `useViewerStore` in CanvasViewport scope (accessed via `usePdfDocument` hook at CanvasViewport.tsx line 9).

4. **denominator is NOT discarded:** The formula is `pageWidthPx / (pageWidthMm * denominator)` — the denominator IS used. See RESEARCH.md Pattern 3 corrected formula and the numerical cross-check in RESEARCH.md.

5. **CalibrationDialog.tsx:** Is dead code with zero import sites. Do not extend it. Leave it as-is.

6. **Test file location:** `src/tests/scale-ratio-math.test.ts` (matches existing test file placement — all tests are in `src/tests/`, not co-located with source).

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/hooks/`, `src/renderer/src/lib/`, `src/renderer/src/types/`, `src/tests/`
**Files scanned:** 7 source files read directly; 4 analog files fully read
**Pattern extraction date:** 2026-05-20
