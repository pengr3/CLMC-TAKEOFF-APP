import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'

function basename(p: string | null): string | null {
  if (!p) return null
  return p.split(/[\\/]/).pop() ?? p
}

export function TitleBar(): React.JSX.Element {
  const fileName = useViewerStore((s) => s.fileName)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const isDirty = useProjectStore((s) => s.isDirty)
  const isSaving = useProjectStore((s) => s.isSaving)

  const displayName = basename(currentFilePath) ?? fileName ?? null
  const dirtyMark = isDirty ? ' * ' : ' '

  // Keep the dirty asterisk while a captured revision is being saved.
  const title = isSaving
    ? (displayName !== null
        ? `Saving… ${displayName}${dirtyMark}— CLMC Takeoff`
        : 'Saving… — CLMC Takeoff')
    : (displayName !== null
        ? `${displayName}${dirtyMark}— CLMC Takeoff`
        : 'CLMC Takeoff')

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
      <span title={title} style={{ fontSize: 13, fontWeight: 600, color: '#cccccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
    </div>
  )
}
