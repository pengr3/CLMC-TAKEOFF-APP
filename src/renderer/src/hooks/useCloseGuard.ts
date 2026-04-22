import { useEffect, useRef } from 'react'

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
    const stable = (): void => handlerRef.current()
    window.api.onCloseRequest(stable)
    return () => {
      window.api.offCloseRequest(stable)
    }
  }, [])
}
