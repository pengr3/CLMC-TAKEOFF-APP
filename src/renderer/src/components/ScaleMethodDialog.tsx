import { useState, useEffect, useCallback, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'
import { computePixelsPerMmFromRatio, isoSheetLabel } from '../lib/scale-math'
import type { ScaleUnit } from '../types/scale'

const DIALOG_MIN_WIDTH = 300
const DIALOG_MAX_WIDTH = 360

interface ScaleMethodDialogProps {
  containerSize: { width: number; height: number }
  onDrawLine: () => void
  onConfirm: (pixelsPerMm: number, unit: ScaleUnit) => void
  onCancel: () => void
  pdfDocument?: unknown
  pageWidthPx?: number
  currentPage?: number
}

type DialogView = 'choice' | 'ratio'

/**
 * Pre-choice gate dialog for scale calibration.
 *
 * View 1 (choice): prompts user to pick "Draw line" or "Type ratio 1:N".
 * View 2 (ratio): inline ratio entry with async page.view fetch for sheet label.
 *
 * Always centred via flex overlay (same pattern as ScalePopup). Draggable via useDraggable.
 */
export function ScaleMethodDialog({
  containerSize: _containerSize,
  onDrawLine,
  onConfirm,
  onCancel,
  pdfDocument,
  pageWidthPx,
  currentPage
}: ScaleMethodDialogProps): React.JSX.Element {
  void _containerSize

  const [view, setView] = useState<DialogView>('choice')
  const [denominator, setDenominator] = useState<string>('100')
  const [pageView, setPageView] = useState<{ widthPt: number; heightPt: number } | null>(null)
  const fetchedRef = useRef(false)
  const { position, onPointerDown } = useDraggable()

  // Escape key cancels dialog
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, onCancel])

  // Async page.view fetch for ratio view — cancelled-ref guard prevents stale setState
  useEffect(() => {
    if (view !== 'ratio' || !pdfDocument || currentPage == null) return
    let cancelled = false
    fetchedRef.current = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pdfDocument as any).getPage(currentPage).then((page: any) => {
      if (cancelled) return
      fetchedRef.current = true
      const vp = page.getViewport({ scale: 1 })
      const widthPt = vp.width
      const heightPt = vp.height
      if (widthPt > 0 && heightPt > 0) {
        setPageView({ widthPt, heightPt })
      } else {
        setPageView(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [pdfDocument, currentPage, view])

  const parsedDenominator = parseInt(denominator, 10)
  const isValidDenominator =
    !isNaN(parsedDenominator) && parsedDenominator > 0 && isFinite(parsedDenominator)
  const canConfirmRatio =
    isValidDenominator &&
    pageWidthPx != null &&
    pageWidthPx > 0 &&
    pageView !== null

  const handleAccept = useCallback((): void => {
    if (!canConfirmRatio || pageWidthPx == null || !pageView) return
    const ppm = computePixelsPerMmFromRatio(pageWidthPx, pageView.widthPt, parsedDenominator)
    onConfirm(ppm, 'mm')
  }, [canConfirmRatio, pageWidthPx, pageView, parsedDenominator, onConfirm])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (view === 'ratio' && e.key === 'Enter' && canConfirmRatio) {
      e.preventDefault()
      handleAccept()
    }
  }

  // Overlay: position:absolute, inset:0, flex-centred, pointerEvents:'none', zIndex:10
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10
  }

  const containerStyle: React.CSSProperties = {
    minWidth: DIALOG_MIN_WIDTH,
    maxWidth: DIALOG_MAX_WIDTH,
    padding: '16px 20px 20px',
    background: COLORS.secondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontSize: 13,
    lineHeight: 1.4,
    color: COLORS.textPrimary,
    cursor: 'default',
    ...(position !== null
      ? {
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
        }
      : {})
  }

  const inputStyle: React.CSSProperties = {
    height: 32,
    padding: '4px 10px',
    background: COLORS.dominant,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    color: COLORS.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box'
  }

  // VIEW 1 — choice
  if (view === 'choice') {
    return (
      <div style={overlayStyle}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Set scale"
          onPointerDown={onPointerDown}
          style={containerStyle}
        >
          {/* Title */}
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
            How do you want to set scale?
          </div>

          {/* Choice buttons */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              marginTop: 4
            }}
          >
            <button
              type="button"
              onClick={onDrawLine}
              style={{
                height: 36,
                padding: '8px 20px',
                background: COLORS.accent,
                border: 'none',
                borderRadius: 4,
                color: COLORS.textOnAccent,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1a86db'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = COLORS.accent
              }}
            >
              Draw line
            </button>
            <button
              type="button"
              onClick={() => setView('ratio')}
              style={{
                height: 36,
                padding: '8px 20px',
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 4,
                color: COLORS.textPrimary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.hoverSurface
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Type ratio 1:N
            </button>
          </div>

          {/* Cancel link */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: COLORS.textSecondary,
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 8px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // VIEW 2 — ratio entry
  return (
    <div style={overlayStyle}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set scale — type ratio"
        onPointerDown={onPointerDown}
        onKeyDown={handleKeyDown}
        style={containerStyle}
      >
        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
          Drawing scale 1:N
        </div>

        {/* Ratio inputs */}
        <div>
          <label
            style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}
          >
            Drawing scale
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              value={1}
              readOnly
              style={{
                ...inputStyle,
                width: 48,
                textAlign: 'center',
                color: COLORS.textSecondary
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
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        {/* Sheet size or warning */}
        {pageView !== null ? (
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {isoSheetLabel(
              (pageView.widthPt * 25.4) / 72,
              (pageView.heightPt * 25.4) / 72
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.warning }}>
            PDF metadata missing — try &apos;Draw line&apos; instead
          </div>
        )}

        {/* Action row: Back + Accept */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setView('choice')}
            style={{
              height: 32,
              padding: '6px 14px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.hoverSurface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!canConfirmRatio}
            style={{
              height: 32,
              padding: '6px 14px',
              background: canConfirmRatio ? COLORS.accent : COLORS.border,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: canConfirmRatio ? 'pointer' : 'not-allowed',
              opacity: canConfirmRatio ? 1 : 0.6
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
