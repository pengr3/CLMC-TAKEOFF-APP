import type { ViewportState } from '../types/viewer'

interface Size {
  width: number
  height: number
}

/** A fit is unavailable until the mounted canvas has room for its page padding. */
export function calculateFitViewport(page: Size | null, container: Size): ViewportState | null {
  if (
    !page ||
    ![page.width, page.height, container.width, container.height].every(Number.isFinite) ||
    page.width <= 0 ||
    page.height <= 0 ||
    container.width <= 40 ||
    container.height <= 40
  ) {
    return null
  }
  const zoom = Math.min((container.width - 40) / page.width, (container.height - 40) / page.height)
  return {
    zoom,
    panX: (container.width - page.width * zoom) / 2,
    panY: (container.height - page.height * zoom) / 2
  }
}
