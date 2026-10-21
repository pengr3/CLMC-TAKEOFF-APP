import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import { useReleaseInfo } from '../hooks/useReleaseInfo'

function basename(p: string | null): string | null {
  if (!p) return null
  return p.split(/[\\/]/).pop() ?? p
}

export function TitleBar(): React.JSX.Element {
  const { info, loading } = useReleaseInfo()
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
        paddingRight: 160,
        gap: 8,
        minWidth: 0,
        // @ts-expect-error -- app-region is a non-standard CSS property for Electron
        appRegion: 'drag',
        WebkitAppRegion: 'drag',
        flexShrink: 0
      }}
    >
      <span data-testid="project-title" title={title} style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: '#cccccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isSaving ? 'Saving… ' : ''}{displayName}{displayName ? dirtyMark + '— ' : ''}
      </span>
      <span data-testid="app-version" style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: '#cccccc' }}>
        CLMC Takeoff{info?.version ? ` ${info.version}` : loading ? '' : ' — Version unavailable'}
      </span>
    </div>
  )
}
