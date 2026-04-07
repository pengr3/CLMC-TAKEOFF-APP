import { useState, useMemo, useCallback, KeyboardEvent } from 'react'
import { COLORS } from '../lib/constants'
import { UNIT_LABELS } from '../lib/scale-math'
import type { MeasurementUnit } from '../types/viewer'

export interface CalibrationDialogProps {
  pixelDistance: number
  onConfirm: (distance: number, unit: MeasurementUnit) => void
  onCancel: () => void
}

const UNIT_OPTIONS: MeasurementUnit[] = ['m', 'ft', 'mm', 'cm', 'in']

/**
 * Modal dialog shown after the user has placed two calibration points.
 * Captures the real-world distance + unit, shows a live scale preview,
 * and confirms or cancels the calibration.
 */
export function CalibrationDialog({
  pixelDistance,
  onConfirm,
  onCancel
}: CalibrationDialogProps): React.JSX.Element {
  const [distanceText, setDistanceText] = useState('')
  const [unit, setUnit] = useState<MeasurementUnit>('m')

  const parsedDistance = parseFloat(distanceText)
  const isValid = !isNaN(parsedDistance) && parsedDistance > 0

  const previewText = useMemo(() => {
    if (!isValid) return '\u2014'
    const realWorldPerPixel = parsedDistance / pixelDistance
    return `1px = ${realWorldPerPixel.toFixed(6)} ${unit}`
  }, [isValid, parsedDistance, pixelDistance, unit])

  const handleSubmit = useCallback(() => {
    if (!isValid) return
    onConfirm(parsedDistance, unit)
  }, [isValid, parsedDistance, unit, onConfirm])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 6,
          padding: '20px 24px',
          minWidth: 320,
          color: COLORS.textPrimary,
          fontSize: 13,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.textPrimary
          }}
        >
          Set Scale
        </h2>

        <div style={{ marginBottom: 12, color: COLORS.textSecondary }}>
          Pixel distance: {pixelDistance.toFixed(1)} px
        </div>

        <label
          style={{
            display: 'block',
            marginBottom: 4,
            fontWeight: 600,
            color: COLORS.textPrimary
          }}
        >
          Real-world distance
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="number"
            value={distanceText}
            onChange={(e) => setDistanceText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 5"
            min={0}
            step="any"
            autoFocus
            style={{
              flex: 1,
              background: COLORS.dominant,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              padding: '6px 8px',
              fontSize: 13,
              outline: 'none'
            }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
            style={{
              background: COLORS.dominant,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              padding: '6px 8px',
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

        <div
          style={{
            marginBottom: 16,
            padding: '8px 10px',
            background: COLORS.dominant,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: isValid ? COLORS.accent : COLORS.textSecondary,
            fontFamily: 'monospace'
          }}
        >
          Scale: {previewText}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              background: isValid ? COLORS.accent : COLORS.border,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: isValid ? 'pointer' : 'not-allowed',
              opacity: isValid ? 1 : 0.6
            }}
          >
            Accept Scale
          </button>
        </div>
      </div>
    </div>
  )
}
