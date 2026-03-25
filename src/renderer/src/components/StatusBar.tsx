import { useViewerStore } from '../stores/viewerStore'

function Divider(): React.JSX.Element {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: '#3c3c3c',
        margin: '0 16px',
        flexShrink: 0
      }}
    />
  )
}

export function StatusBar(): React.JSX.Element {
  const { fileName, totalPages, currentPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)

  const hasFile = totalPages > 0
  const zoomPct = hasFile ? Math.round(getViewport(currentPage).zoom * 100) : 0

  return (
    <div
      style={{
        height: 28,
        background: '#252526',
        borderTop: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 13,
        fontWeight: 400,
        color: '#cccccc',
        flexShrink: 0
      }}
    >
      {/* Left: filename */}
      <span
        style={{
          maxWidth: 300,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {hasFile ? fileName : '\u2014'}
      </span>

      <Divider />

      {/* Center: page */}
      <span>
        {hasFile ? `Page ${currentPage} of ${totalPages}` : '\u2014'}
      </span>

      <Divider />

      {/* Right: zoom */}
      <span>{hasFile ? `Zoom: ${zoomPct}%` : '\u2014'}</span>
    </div>
  )
}
