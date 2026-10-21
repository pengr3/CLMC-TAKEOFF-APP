import { useEffect, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'

/**
 * Subscribe to the main process's 'app:close-request' signal. Fires the
 * provided handler each time the user tries to close the window.
 *
 * Pitfall 10: uses a single listener reference via useRef so StrictMode
 * double-mount + fast refresh cycles do not register duplicate listeners.
 * The stable ref is registered once per useEffect cycle and removed on cleanup.
 */
export function useCloseGuard(onRequest: () => void): void {
  const handlerRef = useRef(onRequest)
  handlerRef.current = onRequest

  useEffect(() => {
    const stable = (): void => {
      const state = useProjectStore.getState()
      if (state.isSaving || state.saveFailure || document.querySelector('[role="dialog"]')) return
      handlerRef.current()
    }
    window.api.onCloseRequest(stable)
    return () => {
      window.api.offCloseRequest(stable)
    }
  }, [])
}
