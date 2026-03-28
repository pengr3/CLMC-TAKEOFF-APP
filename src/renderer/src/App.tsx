import { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { CanvasViewport } from './components/CanvasViewport'
import { useViewerStore } from './stores/viewerStore'

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)

  // Prevent Chromium from navigating when a file is dropped onto the window
  useEffect(() => {
    const preventNav = (e: DragEvent): void => {
      e.preventDefault()
    }
    window.addEventListener('dragover', preventNav)
    window.addEventListener('drop', preventNav)
    return () => {
      window.removeEventListener('dragover', preventNav)
      window.removeEventListener('drop', preventNav)
    }
  }, [])

  // Prevent Ctrl+scroll from triggering Chromium's native page zoom.
  // All zoom is handled by Konva's viewport controls.
  useEffect(() => {
    const preventNativeZoom = (e: WheelEvent): void => {
      if (e.ctrlKey) e.preventDefault()
    }
    window.addEventListener('wheel', preventNativeZoom, { passive: false })
    return () => window.removeEventListener('wheel', preventNativeZoom)
  }, [])

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
        {totalPages === 0 ? <EmptyState /> : <CanvasViewport />}
      </main>
      <StatusBar />
    </div>
  )
}

export default App
