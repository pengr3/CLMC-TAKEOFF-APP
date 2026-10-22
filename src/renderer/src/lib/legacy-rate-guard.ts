import { useProjectStore } from '../stores/projectStore'

/** Returns true when an action must stop. The persistent warning remains store-derived. */
export function requireRateReview(): boolean {
  if (useProjectStore.getState().getUnresolvedRateKeys().length === 0) return false
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('clmc:review-rates'))
  return true
}
