import { CompatibilityDialogFrame } from './CompatibilityDialogFrame'
import { compatibilityButton } from '../lib/compatibility-ui'
import { useProjectStore } from '../stores/projectStore'
import { COLORS } from '../lib/constants'

export const UPGRADE_WARNING =
  'Saving will use this version’s project format. Older versions may not preserve rate units correctly. Keep a separate pre-upgrade copy if you need to return to an older version.'
export function UpgradeProjectDialog({
  onKeep,
  onSave
}: {
  onKeep: () => void
  onSave: () => void
}): React.JSX.Element {
  const busy = useProjectStore((s) => s.isSaving)
  const source = useProjectStore((s) => s.preservedSource)
  return (
    <CompatibilityDialogFrame
      title="Save upgraded project copy"
      busy={busy}
      onCancel={onKeep}
      footer={
        <>
          <button data-initial-focus disabled={busy} style={compatibilityButton} onClick={onKeep}>
            Keep Original Project
          </button>
          <button
            disabled={busy}
            style={{
              ...compatibilityButton,
              background: COLORS.accent,
              color: COLORS.textOnAccent
            }}
            onClick={() => {
              if (!useProjectStore.getState().isSaving) onSave()
            }}
          >
            {busy ? 'Saving…' : 'Save Upgraded Copy'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{UPGRADE_WARNING}</p>
      {source && <p style={{ userSelect: 'text', overflowWrap: 'anywhere' }}>{source.path}</p>}
    </CompatibilityDialogFrame>
  )
}
