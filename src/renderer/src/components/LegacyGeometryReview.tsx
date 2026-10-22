import { useRef } from 'react'
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
  const totalPages = useViewerStore(s => s.totalPages)
  const scale = useScaleStore(s => s.pageScales[page])
  const markups = useMarkupStore(s => s.pageMarkups[page])
  const pageInput = useRef<HTMLInputElement>(null)
  if (!pending.length) return null
  const measured = (markups ?? []).some(m => m.type !== 'count')
  const goToPage = (): void => {
    const input = pageInput.current
    const selected = Number(input?.value)
    if (input && Number.isInteger(selected) && pending.includes(selected)) {
      useViewerStore.getState().setPage(selected)
    } else if (input) {
      input.setCustomValidity('Enter a page number that still needs geometry review.')
      input.reportValidity()
    }
  }
  const button = { minHeight: 28, padding: '4px 8px' }
  return <aside aria-label="Verify legacy geometry" style={{ padding: '8px 16px', background: COLORS.secondary, color: COLORS.textPrimary, fontSize: 13, flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: 0, background: COLORS.secondary }}>
      <span style={{ flex: 1, minWidth: 160 }}>{pending.length === 1 ? '1 page needs' : `${pending.length} pages need`} geometry review. Export blocked.</span>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Page <input ref={pageInput} key={page} aria-label="Review page number" type="number" min={1} max={totalPages} defaultValue={page} disabled={busy} onInput={event => event.currentTarget.setCustomValidity('')} style={{ width: 64, minHeight: 28 }} /></label>
      <button data-testid="geometry-go" disabled={busy} style={button} onClick={goToPage}>Go</button>
      <button disabled={busy} style={button} onClick={() => useViewerStore.getState().setPage(pending.find(p => p > page) ?? pending[0])}>Next unverified</button>
      <button data-testid="geometry-confirm" aria-label={`I verified all geometry on page ${page}${measured ? ' and recalibrated' : ''}`} disabled={busy || !pending.includes(page) || (measured && !scale)} style={button} onClick={() => useProjectStore.getState().verifyGeometryPage(page)}>Confirm page {page}</button>
    </div>
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: 'pointer' }}>Review instructions{measured && !scale && pending.includes(page) ? ` — recalibrate page ${page} first` : ''}</summary>
      <p style={{ margin: '8px 0' }}>This project has no recorded coordinate basis. Markups may be displaced. Original coordinates are retained; old calibration was cleared. Your original project is preserved; save a copy.</p>
      <p style={{ margin: '8px 0' }}>Before confirming each page, check every count, vertex and curved edge against the PDF landmarks. Move or redraw displaced geometry and set scale again on measured pages. Do not confirm if you cannot verify the plan. Use Next unverified or enter a flagged page number.</p>
    </details>
  </aside>
}
