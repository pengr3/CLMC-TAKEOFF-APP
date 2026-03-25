import { useViewerStore } from '../stores/viewerStore'

export function TitleBar(): React.JSX.Element {
  const fileName = useViewerStore((s) => s.fileName)

  const title = fileName ? `${fileName} - CLMC Takeoff` : 'CLMC Takeoff'

  return (
    <div
      style={{
        height: 32,
        background: '#1e1e1e',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        // @ts-expect-error -- app-region is a non-standard CSS property for Electron
        appRegion: 'drag',
        WebkitAppRegion: 'drag',
        flexShrink: 0
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#cccccc'
        }}
      >
        {title}
      </span>
    </div>
  )
}
