import { useState } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { COLORS } from '../lib/constants'
import { CompatibilityDialogFrame } from './CompatibilityDialogFrame'
import { compatibilityButton } from '../lib/compatibility-ui'
import type { PriceEntry } from '../lib/boq-types'

export const LEGACY_RATE_WARNING =
  'This project was saved without rate units. Current totals use its saved measurement units. Earlier unit changes cannot be verified. Check the affected rates before relying on the estimate.'
export function LegacyRateReviewDialog({
  onClose
}: {
  onClose: () => void
}): React.JSX.Element | null {
  const rates = useProjectStore((s) => s.rates)
  const busy = useProjectStore((s) => s.isSaving)
  const [checkedRates, setCheckedRates] = useState<Record<string, PriceEntry> | null>(null)
  const checked = checkedRates === rates
  const keys = Object.keys(rates).filter((key) => rates[key].review !== 'reviewed')
  if (keys.length === 0) return null
  return (
    <CompatibilityDialogFrame
      title="Review rate units"
      busy={busy}
      onCancel={onClose}
      footer={
        <>
          <label style={{ flex: '1 1 100%', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(e) => setCheckedRates(e.target.checked ? rates : null)}
            />
            I have checked these rate units
          </label>
          <button style={compatibilityButton} disabled={busy} data-initial-focus onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!checked || busy}
            style={{
              ...compatibilityButton,
              background: COLORS.accent,
              color: COLORS.textOnAccent
            }}
            onClick={() => {
              const current = useProjectStore.getState()
              if (!checked || current.isSaving || current.rates !== rates) return
              current.acknowledgeRateBasis(keys)
              onClose()
            }}
          >
            Confirm Rate Units
          </button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px' }}>{LEGACY_RATE_WARNING}</p>
      <table
        style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}
      >
        <thead>
          <tr>
            {['Item / type', 'Rate unit', 'Material', 'Labor', 'Markup %'].map((label) => (
              <th
                key={label}
                style={{ textAlign: label === 'Item / type' ? 'left' : 'right', padding: 8, fontWeight: 600 }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const split = key.lastIndexOf('|'),
              rate = rates[key]
            return (
              <tr key={key}>
                <td style={{ padding: 8, verticalAlign: 'top' }}>
                  {key.slice(0, split)}
                  <div>{key.slice(split + 1)}</div>
                </td>
                {[rate.basis, rate.material, rate.labor, rate.markup].map((value, index) => (
                  <td
                    key={index}
                    style={{
                      padding: 8,
                      verticalAlign: 'top',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {String(value)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </CompatibilityDialogFrame>
  )
}
