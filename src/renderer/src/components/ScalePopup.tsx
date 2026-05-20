import { useState, useCallback, useRef, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { computePixelsPerMm, formatScaleRatio, pixelsToRealWorld, MIN_CALIBRATION_PIXELS, computePixelsPerMmFromRatio, isoSheetLabel } from '../lib/scale-math'
import type { ScaleUnit, PageScale } from '../types/scale'
import { useDraggable } from '../hooks/useDraggable'

const POPUP_MIN_WIDTH = 240
const POPUP_MAX_WIDTH = 280

const UNIT_OPTIONS: ScaleUnit[] = ['mm', 'cm', 'm', 'in', 'ft']
const UNIT_LABELS: Record<ScaleUnit, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: 'in',
  ft: 'ft'
}

export interface ScalePopupProps {
  mode: 'confirm' | 'verify'
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  pixelLength: number
  onConfirm?: (pixelsPerMm: number, displayUnit: ScaleUnit) => void
  onCancel: () => void
  pageScale?: PageScale | null
  pdfDocument?: unknown
  pageWidthPx?: number
  currentPage?: number
}

/**
 * Inline popup for scale calibration (confirm mode) and verify-mode read-only display.
 *
 * Confirm mode: user enters real-world distance + unit, sees live ratio preview, clicks Confirm.
 * Verify mode: shows measured real-world distance from existing pixelsPerMm, single Dismiss button.
 */
export function ScalePopup({
  mode,
  // screenPos & containerSize: kept in the prop interface so CanvasViewport
  // callsites don't need to change, but no longer used for positioning —
  // D-10/D-14 require the popup to open centred via the overlay below.
  screenPos: _screenPos,
  containerSize: _containerSize,
  pixelLength,
  onConfirm,
  onCancel,
  pageScale,
  pdfDocument,
  pageWidthPx,
  currentPage
}: ScalePopupProps): React.JSX.Element {
  const [distanceText, setDistanceText] = useState('')
  const [unit, setUnit] = useState<ScaleUnit>('m')
  const [unitOpen, setUnitOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null)
  const unitButtonRef = useRef<HTMLButtonElement>(null)
  const { position, onPointerDown } = useDraggable()
  // Touch _screenPos / _containerSize so eslint no-unused-vars stays quiet.
  void _screenPos; void _containerSize

  // Ratio tab state
  const [activeTab, setActiveTab] = useState<'draw' | 'ratio'>('draw')
  const [denominator, setDenominator] = useState<string>('100')
  const [pageView, setPageView] = useState<{ widthPt: number; heightPt: number } | null>(null)

  useEffect(() => {
    if (!unitOpen) return
    const close = (e: MouseEvent): void => {
      if (unitButtonRef.current?.contains(e.target as Node)) return
      setUnitOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [unitOpen])

  // Async page.view fetch for ratio tab — cancelled ref guard prevents stale setState
  useEffect(() => {
    if (!pdfDocument || activeTab !== 'ratio' || currentPage == null) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pdfDocument as any).getPage(currentPage).then((page: any) => {
      if (cancelled) return
      const [x0, y0, x1, y1] = page.view as [number, number, number, number]
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

  const parsedDistance = parseFloat(distanceText)
  const isValidDistance = !isNaN(parsedDistance) && parsedDistance > 0
  const isLineValid = pixelLength >= MIN_CALIBRATION_PIXELS
  const canConfirm = isValidDistance && isLineValid

  const previewRatio = canConfirm
    ? formatScaleRatio(computePixelsPerMm(pixelLength, parsedDistance, unit))
    : null

  // Ratio tab derived values
  const parsedDenominator = parseInt(denominator, 10)
  const isValidDenominator = !isNaN(parsedDenominator) && parsedDenominator > 0 && isFinite(parsedDenominator)
  const canConfirmRatio = isValidDenominator && pageWidthPx != null && pageWidthPx > 0 && pageView !== null

  const handleConfirmClick = useCallback((): void => {
    if (!canConfirm || !onConfirm) return
    const ppm = computePixelsPerMm(pixelLength, parsedDistance, unit)
    onConfirm(ppm, unit)
  }, [canConfirm, onConfirm, pixelLength, parsedDistance, unit])

  const handleRatioConfirmClick = useCallback((): void => {
    if (!canConfirmRatio || !onConfirm || pageWidthPx == null || !pageView) return
    const ppm = computePixelsPerMmFromRatio(pageWidthPx, pageView.widthPt, parsedDenominator)
    onConfirm(ppm, unit)
  }, [canConfirmRatio, onConfirm, pageWidthPx, pageView, parsedDenominator, unit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (mode === 'confirm' && e.key === 'Enter') {
      if (activeTab === 'ratio' && canConfirmRatio) {
        e.preventDefault()
        handleRatioConfirmClick()
      } else if (activeTab === 'draw' && canConfirm) {
        e.preventDefault()
        handleConfirmClick()
      }
    }
  }

  // D-10/D-11/D-14: outer overlay is full-inset, flex-centred, pointer-events
  // disabled on the overlay itself so canvas clicks underneath still register
  // outside the inner card. zIndex retained at 10.
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
    minWidth: POPUP_MIN_WIDTH,
    maxWidth: POPUP_MAX_WIDTH,
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

  // Verify mode: read-only display of measured distance
  if (mode === 'verify') {
    const measured = pageScale
      ? pixelsToRealWorld(pixelLength, pageScale.pixelsPerMm, pageScale.displayUnit)
      : 0
    const measuredText = pageScale
      ? `Measured: ${measured.toFixed(2)} ${pageScale.displayUnit}`
      : 'Measured: — (no scale set)'

    return (
      <div style={overlayStyle}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verify scale measurement"
          onKeyDown={handleKeyDown}
          onPointerDown={onPointerDown}
          style={containerStyle}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
            {measuredText}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Dismiss"
              style={{
                height: 28,
                padding: '4px 8px',
                background: COLORS.accent,
                border: 'none',
                borderRadius: 4,
                color: COLORS.textOnAccent,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Confirm mode: distance entry form
  return (
    <div style={overlayStyle}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set scale"
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      style={containerStyle}
    >
      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
        Set Scale
      </div>

      {/* Tab switcher */}
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

      {/* Distance input — only shown on draw tab */}
      {activeTab === 'draw' && (
      <div>
        <label
          style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}
        >
          Real-world distance
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={distanceText}
          onChange={(e) => setDistanceText(e.target.value)}
          placeholder="0.00"
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 32,
            padding: '4px 10px',
            background: COLORS.dominant,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: COLORS.textPrimary,
            fontSize: 13,
            outline: 'none'
          }}
        />
      </div>
      )}

      {/* Ratio tab panel — shown only on ratio tab */}
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

      {/* Unit dropdown — position:fixed list escapes overflow:hidden ancestors */}
      <div>
        <label
          style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}
        >
          Unit
        </label>
        <button
          ref={unitButtonRef}
          type="button"
          onClick={() => {
            if (unitButtonRef.current) {
              setDropdownRect(unitButtonRef.current.getBoundingClientRect())
            }
            setUnitOpen((prev) => !prev)
          }}
          style={{
            width: '100%',
            height: 32,
            padding: '4px 10px',
            background: COLORS.dominant,
            border: `1px solid ${unitOpen ? COLORS.accent : COLORS.border}`,
            borderRadius: 4,
            color: COLORS.textPrimary,
            fontSize: 13,
            outline: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{UNIT_LABELS[unit]}</span>
          <span style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `5px solid ${COLORS.textPrimary}`,
            opacity: 0.5,
            transition: 'transform 0.1s',
            transform: unitOpen ? 'rotate(180deg)' : 'none'
          }} />
        </button>
        {unitOpen && dropdownRect && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 2,
              left: dropdownRect.left,
              width: dropdownRect.width,
              background: COLORS.secondary,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              overflow: 'hidden'
            }}
          >
            {UNIT_OPTIONS.map((u) => (
              <div
                key={u}
                onClick={() => { setUnit(u); setUnitOpen(false) }}
                style={{
                  padding: '7px 10px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: COLORS.textPrimary,
                  background: u === unit ? COLORS.accent : 'transparent',
                  fontWeight: u === unit ? 600 : 400
                }}
                onMouseEnter={(e) => {
                  if (u !== unit) e.currentTarget.style.background = COLORS.hoverSurface
                }}
                onMouseLeave={(e) => {
                  if (u !== unit) e.currentTarget.style.background = 'transparent'
                }}
              >
                {UNIT_LABELS[u]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scale preview or error — draw tab only */}
      {activeTab === 'draw' && (
        !isLineValid ? (
          <div style={{ fontSize: 12, color: COLORS.warning }}>
            Line too short — please draw again.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Scale</span>
            <span style={{
              fontWeight: 600,
              fontSize: 13,
              color: previewRatio ? COLORS.accent : COLORS.textSecondary
            }}>
              {previewRatio ?? '—'}
            </span>
          </div>
        )
      )}

      {/* Sheet size display — ratio tab only */}
      {activeTab === 'ratio' && pageView !== null && (
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

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
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
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Discard line
        </button>
        {activeTab === 'draw' ? (
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            style={{
              height: 32,
              padding: '6px 14px',
              background: canConfirm ? COLORS.accent : COLORS.border,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              opacity: canConfirm ? 1 : 0.6
            }}
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRatioConfirmClick}
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
        )}
      </div>
    </div>
    </div>
  )
}
