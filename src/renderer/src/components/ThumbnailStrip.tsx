import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Thumbnail } from './Thumbnail'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useMarkupStore } from '../stores/markupStore'
import { usePageLabels } from '../hooks/usePageLabels'
import { COLORS } from '../lib/constants'

export interface ThumbnailStripProps {
  open: boolean
  width: number
  onSetOpen: (open: boolean) => void
}

export function ThumbnailStrip({
  open,
  width,
  onSetOpen
}: ThumbnailStripProps): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)
  const currentPage = useViewerStore((s) => s.currentPage)
  const pageScales = useScaleStore((s) => s.pageScales)
  const pageMarkups = useMarkupStore((s) => s.pageMarkups)

  // One hook call per document load — resolves labels for all pages
  const labels = usePageLabels()

  // Collapsed slim rail
  if (!open) {
    return (
      <aside
        style={{
          width: 28,
          flexShrink: 0,
          background: COLORS.dominant,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 8,
          transition: 'width 150ms ease-out'
        }}
      >
        <button
          onClick={() => onSetOpen(true)}
          aria-label="Expand Thumbnails"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            padding: 4
          }}
        >
          <ChevronRight size={14} />
        </button>
      </aside>
    )
  }

  // Expanded strip
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: COLORS.dominant,
        borderRight: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        transition: 'width 150ms ease-out'
      }}
    >
      {/* Collapse button at top */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 4px 0 4px',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => onSetOpen(false)}
          aria-label="Collapse Thumbnails"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            padding: 4
          }}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Thumbnail tiles — one per page */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 8px',
          gap: 8  // thumbnailItemPadding = 8px
        }}
      >
        {Array.from({ length: totalPages }, (_, i) => {
          const pageNumber = i + 1
          const pageLabel = labels?.[i] ?? `Page ${pageNumber}`
          const pageScale = pageScales[pageNumber] ?? null
          const markupCount = (pageMarkups[pageNumber] ?? []).length

          return (
            <div
              key={pageNumber}
              data-thumbnail-page={pageNumber}
              style={{
                width: '100%',
                paddingTop: 8,
                paddingBottom: 8,
                // Apply active/idle border directly on wrapper for test detection
                border: currentPage === pageNumber
                  ? `2px solid ${COLORS.accent}`
                  : `1px solid ${COLORS.border}`,
                borderRadius: 2,
                background: 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => useViewerStore.getState().setPage(pageNumber)}
            >
              <Thumbnail
                pageNumber={pageNumber}
                isActive={currentPage === pageNumber}
                pageLabel={pageLabel}
                pageScale={pageScale}
                markupCount={markupCount}
              />
            </div>
          )
        })}
      </div>
    </aside>
  )
}
