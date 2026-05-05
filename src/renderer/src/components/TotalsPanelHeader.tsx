import type React from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { COLORS } from '../lib/constants'
import type { BoqStructure } from '../lib/boq-types'

/**
 * TotalsPanelHeader — 5-row metadata block at the top of the TotalsPanel.
 *
 * Fields (UI-SPEC §"Copywriting Contract" + 06-PATTERNS.md TotalsPanelHeader):
 *   Project:  ← boq.metadata.projectName
 *   Plan:     ← boq.metadata.planFilename
 *   Pages:    ← boq.metadata.totalPages
 *   Markups:  ← boq.metadata.totalMarkups
 *   Page:     ← viewerStore.currentPage  (NOT BoqMetadata — must be live)
 *
 * Em-dash "—" fallback when value is empty (mirrors StatusBar.tsx empty pattern).
 * The header ALWAYS renders, even in empty states — fields show "—" when no
 * project is open.
 */
export interface TotalsPanelHeaderProps {
  boq: BoqStructure
}

export function TotalsPanelHeader({ boq }: TotalsPanelHeaderProps): React.JSX.Element {
  const currentPage = useViewerStore((s) => s.currentPage)
  const totalPages = useViewerStore((s) => s.totalPages)
  const { metadata } = boq

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Project:', value: metadata.projectName || '—' },
    { label: 'Plan:', value: metadata.planFilename || '—' },
    { label: 'Pages:', value: metadata.totalPages > 0 ? String(metadata.totalPages) : '—' },
    { label: 'Markups:', value: String(metadata.totalMarkups) },
    { label: 'Page:', value: totalPages > 0 ? String(currentPage) : '—' }
  ]

  return (
    <div
      data-testid="totals-panel-header"
      style={{
        background: COLORS.secondary,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderBottom: `1px solid ${COLORS.border}`,
        flexShrink: 0
      }}
    >
      {rows.map(({ label, value }) => (
        <div
          key={label}
          data-testid="totals-panel-header-row"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'baseline'
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.textSecondary,
              flexShrink: 0,
              minWidth: 70
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: COLORS.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
