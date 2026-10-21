export const PDF_RASTER_BUDGET = 128 * 1024 * 1024

export interface PageRaster {
  canvas: HTMLCanvasElement
  /** Canonical PDF_BASE_SCALE page space, independent of the backing bitmap. */
  width: number
  height: number
}

interface Ownership {
  owners: number
  rendering: 'foreground' | 'adjacent' | null
}

export interface RasterStats {
  retainedBytes: number
  displayedBytes: number
  transientBytes: number
  foregroundBytes: number
  adjacentBytes: number
  liveBytes: number
  peakBytes: number
  peakTransientBytes: number
  entries: number
}

/** Cache membership and displayed/pending consumers have separate lifetimes. */
export class PdfPageCache {
  private pages = new Map<string, PageRaster>()
  private resources = new Map<PageRaster, Ownership>()
  private peakBytes = 0
  private peakTransientBytes = 0

  constructor(readonly budget = PDF_RASTER_BUDGET) {}

  get(key: string): PageRaster | undefined {
    const raster = this.pages.get(key)
    if (raster) {
      this.pages.delete(key)
      this.pages.set(key, raster)
    }
    return raster
  }

  track(raster: PageRaster, rendering: Ownership['rendering']): void {
    this.resources.set(raster, { owners: 0, rendering })
    this.recordPeak()
  }

  finish(raster: PageRaster): void {
    const entry = this.resources.get(raster)
    if (entry) entry.rendering = null
  }

  retain(raster: PageRaster): void {
    const entry = this.resources.get(raster)
    if (!entry) throw new Error('Cannot display a released PDF raster')
    entry.owners++
  }

  release(raster: PageRaster): void {
    const entry = this.resources.get(raster)
    if (entry) entry.owners = Math.max(0, entry.owners - 1)
    this.discard(raster)
  }

  put(key: string, raster: PageRaster): boolean {
    if (this.bytes(raster) > this.budget) return false
    const previous = this.pages.get(key)
    this.pages.delete(key)
    this.pages.set(key, raster)
    if (previous && previous !== raster) this.discard(previous)
    while (this.stats().retainedBytes > this.budget) {
      const oldest = this.pages.entries().next().value!
      this.pages.delete(oldest[0])
      this.discard(oldest[1])
    }
    this.recordPeak()
    return true
  }

  discard(raster: PageRaster): void {
    const entry = this.resources.get(raster)
    if (!entry || entry.owners || entry.rendering || this.isCached(raster)) return
    raster.canvas.width = 0
    raster.canvas.height = 0
    this.resources.delete(raster)
  }

  clear(): void {
    this.pages.clear()
    for (const raster of this.resources.keys()) this.discard(raster)
  }

  stats(): RasterStats {
    let retainedBytes = 0
    let displayedBytes = 0
    let transientBytes = 0
    let foregroundBytes = 0
    let adjacentBytes = 0
    let liveBytes = 0
    for (const [raster, ownership] of this.resources) {
      const bytes = this.bytes(raster)
      liveBytes += bytes
      if (this.isCached(raster)) retainedBytes += bytes
      if (ownership.owners) displayedBytes += bytes
      if (ownership.rendering) transientBytes += bytes
      if (ownership.rendering === 'foreground') foregroundBytes += bytes
      if (ownership.rendering === 'adjacent') adjacentBytes += bytes
    }
    return { retainedBytes, displayedBytes, transientBytes, foregroundBytes, adjacentBytes,
      liveBytes, peakBytes: this.peakBytes, peakTransientBytes: this.peakTransientBytes,
      entries: this.pages.size }
  }

  private bytes(raster: PageRaster): number {
    return raster.canvas.width * raster.canvas.height * 4
  }

  private isCached(raster: PageRaster): boolean {
    return Array.from(this.pages.values()).includes(raster)
  }

  private recordPeak(): void {
    const stats = this.stats()
    this.peakBytes = Math.max(this.peakBytes, stats.liveBytes)
    this.peakTransientBytes = Math.max(this.peakTransientBytes, stats.transientBytes)
  }
}
