import { TitleBar } from './components/TitleBar'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { useViewerStore } from './stores/viewerStore'

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <TitleBar />
      <Toolbar />
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: '#1a1a1a'
        }}
      >
        {totalPages === 0 ? (
          <EmptyState />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              color: '#cccccc'
            }}
          >
            Canvas Viewport - PDF loaded
          </div>
        )}
      </main>
      <StatusBar />
    </div>
  )
}

export default App
