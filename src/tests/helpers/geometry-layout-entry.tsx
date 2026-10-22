import { createRoot } from 'react-dom/client'
import { LegacyGeometryReview } from '@renderer/components/LegacyGeometryReview'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
const pages = Array.from({ length: 150 }, (_, i) => i + 1)
useProjectStore.setState({ geometryReviewPages: pages })
useViewerStore.setState({ totalPages: 150, currentPage: 1 })
useMarkupStore.setState({ pageMarkups: Object.fromEntries(pages.map(page => [page, [{ id: `p${page}`, type: 'count', page, categoryId: '', name: 'Pin', point: { x: 1, y: 1 }, sequence: 1, color: '#abc', createdAt: 1 }]])) })
Object.assign(window, { __layout: { project: useProjectStore, viewer: useViewerStore } })
createRoot(document.getElementById('root')!).render(<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
  <header style={{ height: 134, flexShrink: 0 }}>Application controls</header>
  <LegacyGeometryReview />
  <main data-testid="layout-canvas" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>Plan canvas</main>
  <footer style={{ height: 28, flexShrink: 0 }}>Status</footer>
</div>)
