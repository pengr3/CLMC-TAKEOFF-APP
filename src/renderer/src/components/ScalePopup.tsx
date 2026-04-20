import { useState, useMemo, useCallback } from 'react'
import { COLORS } from '../lib/constants'
import { computePixelsPerMm, formatScaleRatio, pixelsToRealWorld, MIN_CALIBRATION_PIXELS } from '../lib/scale-math'
import type { ScaleUnit, PageScale } from '../types/scale'

const POPUP_MIN_WIDTH = 220
const POPUP_MAX_WIDTH = 260

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
}

/**
 * Inline popup for scale calibration (confirm mode) and verify-mode read-only display.
 *
 * Confirm mode: user enters real-world distance + unit, sees live ratio preview, clicks Confirm.
 * Verify mode: shows measured real-world distance from existing pixelsPerMm, single Dismiss button.
 */
export function ScalePopup({
  mode,
  screenPos,
  containerSize,
  pixelLength,
  onConfirm,
  onCancel,
  pageScale
}: ScalePopupProps): React.JSX.Element {
  const [distanceText, setDistanceText] = useState('')
  const [unit, setUnit] = useState<ScaleUnit>('m')

  const parsedDistance = parseFloat(distanceText)
  const isValidDistance = !isNaN(parsedDistance) && parsedDistance > 0
  const isLineValid = pixelLength >= MIN_CALIBRATION_PIXELS
  const canConfirm = isValidDistance && isLineValid

  const previewRatio = canConfirm
    ? formatScaleRatio(computePixelsPerMm(pixelLength, parsedDistance, unit))
    : null

  // Clamp popup position to container bounds
  const popupStyle = useMemo(() => {
    const left = Math.min(
      Math.max(screenPos.x, 0),
      containerSize.width - POPUP_MIN_WIDTH
    )
    const top = Math.min(
      Math.max(screenPos.y, 0),
      containerSize.height - 160
    )
    return { left, top }
  }, [screenPos, containerSize])

  const handleConfirmClick = useCallback((): void => {
    if (!canConfirm || !onConfirm) return
    const ppm = computePixelsPerMm(pixelLength, parsedDistance, unit)
    onConfirm(ppm, unit)
  }, [canConfirm, onConfirm, pixelLength, parsedDistance, unit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (mode === 'confirm' && e.key === 'Enter' && canConfirm) {
      e.preventDefault()
      handleConfirmClick()
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: popupStyle.left,
    top: popupStyle.top,
    minWidth: POPUP_MIN_WIDTH,
    maxWidth: POPUP_MAX_WIDTH,
    padding: 16,
    background: COLORS.secondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
    color: COLORS.textPrimary
  }

  // Verify mode: read-only display of measured distance
  if (mode === 'verify') {
    const measured = pageScale
      ? pixelsToRealWorld(pixelLength, pageScale.pixelsPerMm, pageScale.displayUnit)
      : 0
    const measuredText = pageScale
      ? `Measured: ${measured.toFixed(2)} ${pageScale.displayUnit}`
      : 'Measured: \u2014 (no scale set)'

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verify scale measurement"
        onKeyDown={handleKeyDown}
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
    )
  }

  // Confirm mode: distance entry form
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set scale"
      onKeyDown={handleKeyDown}
      style={containerStyle}
    >
      {/* Helper hint */}
      <div style={{ color: COLORS.textSecondary }}>
        Enter real-world distance
      </div>

      {/* Distance input + unit dropdown */}
      <div>
        <label
          style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: COLORS.textPrimary }}
        >
          Distance
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            inputMode="decimal"
            value={distanceText}
            onChange={(e) => setDistanceText(e.target.value)}
            placeholder="0.00"
            autoFocus
            style={{
              flex: 1,
              height: 28,
              padding: '4px 8px',
              background: COLORS.dominant,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13,
              outline: 'none'
            }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ScaleUnit)}
            style={{
              height: 28,
              padding: '4px 8px',
              background: COLORS.dominant,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ratio preview or error */}
      {!isLineValid ? (
        <div style={{ color: COLORS.warning, fontSize: 13 }}>
          Line too short — please draw again.
        </div>
      ) : (
        <div
          style={{
            fontWeight: 600,
            color: previewRatio ? COLORS.accent : COLORS.textSecondary,
            fontFamily: 'monospace'
          }}
        >
          {previewRatio ? `Scale: ${previewRatio}` : 'Scale: \u2014'}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 28,
            padding: '4px 8px',
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
        <button
          type="button"
          onClick={handleConfirmClick}
          disabled={!canConfirm}
          style={{
            height: 28,
            padding: '4px 8px',
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
      </div>
    </div>
  )
}
