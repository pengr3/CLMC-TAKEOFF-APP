import { useEffect, useState } from 'react'
import type { ReleaseInfo } from '../../../shared/release-info'

export function useReleaseInfo(): { info: ReleaseInfo | null; loading: boolean } {
  const [info, setInfo] = useState<ReleaseInfo | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => window.api.getReleaseInfo()).catch((): ReleaseInfo => ({
      version: null, notes: null, notesStatus: 'unavailable', releaseReady: false
    })).then((result) => {
      if (active) { setInfo(result); setLoading(false) }
    })
    return () => { active = false }
  }, [])
  return { info, loading }
}
