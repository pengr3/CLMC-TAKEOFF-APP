import type { Markup } from '../types/markup'
import type { PageScale } from '../types/scale'
import { polylineLength, polygonArea, pixelLengthToReal, pixelAreaToReal } from './markup-math'

/** Match canvas/Estimate geometry; wall quantities always use square metres. */
export function buildMarkupSummary(m: Markup, pageScale: PageScale | null): string {
  if (m.type === 'count') return `${m.name} — #${m.sequence}`
  if (!pageScale || pageScale.pixelsPerMm <= 0) return m.name
  const unit = pageScale.displayUnit
  if (m.type === 'linear') {
    const len = pixelLengthToReal(polylineLength(m.points, m.arcs), pageScale.pixelsPerMm, unit)
    return `${m.name} — ${len.toFixed(1)} ${unit}`
  }
  if (m.type === 'area') {
    const areaVal = pixelAreaToReal(polygonArea(m.points, m.arcs), pageScale.pixelsPerMm, unit)
    return `${m.name} — ${areaVal.toFixed(1)} ${unit}²`
  }
  if (m.type === 'wall') {
    if (m.wallHeight <= 0) return m.name
    const lengthM = pixelLengthToReal(polylineLength(m.points, m.arcs), pageScale.pixelsPerMm, 'm')
    const areaM2 = lengthM * (m.wallHeight / 1000)
    return `${m.name} — ${areaM2.toFixed(1)} m²`
  }
  // Appending the first vertex lets an arc on closing edge n-1 keep its index.
  const closed = [...m.points, m.points[0]]
  const perim = pixelLengthToReal(polylineLength(closed, m.arcs), pageScale.pixelsPerMm, unit)
  const areaVal = pixelAreaToReal(polygonArea(m.points, m.arcs), pageScale.pixelsPerMm, unit)
  return `${m.name} — P:${perim.toFixed(1)} ${unit}  A:${areaVal.toFixed(1)} ${unit}²`
}
