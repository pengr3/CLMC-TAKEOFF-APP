import { useProjectStore } from '../stores/projectStore'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useMarkupStore } from '../stores/markupStore'
import { COLORS } from '../lib/constants'

/** Persistent rather than dismissible: the user must inspect every affected page. */
export function LegacyGeometryReview(): React.JSX.Element | null {
  const pending = useProjectStore(s => s.geometryReviewPages)
  const busy = useProjectStore(s => s.isSaving)
  const page = useViewerStore(s => s.currentPage)
  const scale = useScaleStore(s => s.pageScales[page])
  const markups = useMarkupStore(s => s.pageMarkups[page])
  if (!pending.length) return null
  const measured = (markups ?? []).some(m => m.type !== 'count')
  return <aside aria-label="Verify legacy geometry" style={{ padding: '8px 16px', background: COLORS.secondary, color: COLORS.textPrimary, fontSize: 13 }}>
    <p style={{ margin: 0 }}>This project's drawing coordinate basis was not recorded. Markups may be displaced. Original coordinates are retained; old calibration has been cleared. Export is blocked until review is complete. Your original project is preserved; save a copy.</p>
    <p style={{ margin: '8px 0' }}>Check every count, vertex and curved edge against the PDF landmarks on pages {pending.join(', ')}. Move or redraw displaced geometry, then set scale again on measured pages. Do not confirm from appearance alone if you cannot verify the plan.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {pending.map(p => <button key={p} disabled={busy} style={{ minHeight: 28, padding: '4px 8px' }} onClick={() => useViewerStore.getState().setPage(p)}>Review page {p}</button>)}
      <button disabled={busy || !pending.includes(page) || (measured && !scale)} style={{ minHeight: 28, padding: '4px 8px' }} onClick={() => useProjectStore.getState().verifyGeometryPage(page)}>I verified all geometry on page {page}{measured ? ' and recalibrated' : ''}</button>
    </div>
  </aside>
}
