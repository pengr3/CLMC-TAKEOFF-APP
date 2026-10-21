import { MM_PER_UNIT, type ScaleUnit } from '../types/scale'
import type { BoqRowType, PriceEntry } from './boq-types'
import { DEFAULT_MARKUP_PCT } from './estimate-defaults'

/** A rate's denominator. Area uses squared millimetre factors. */
export type RateBasis = 'ea' | ScaleUnit | `${ScaleUnit}²`
export type RateReview = 'reviewed' | 'legacy-unresolved'

export function visibleRateBasis(type: BoqRowType, unit: ScaleUnit): RateBasis {
  if (type === 'count') return 'ea'
  if (type === 'wall') return 'm²'
  return type === 'area' ? `${unit}²` : unit
}

export function rateTypeFromKey(key: string): BoqRowType | null {
  const type = key.slice(key.lastIndexOf('|') + 1)
  return ['count', 'linear', 'perimeter', 'area', 'wall'].includes(type) ? type as BoqRowType : null
}

export function isRateBasis(value: unknown): value is RateBasis {
  return typeof value === 'string' && (value === 'ea' ||
    Object.hasOwn(MM_PER_UNIT, value) ||
    (value.endsWith('²') && Object.hasOwn(MM_PER_UNIT, value.slice(0, -1))))
}

function dimension(basis: RateBasis): number {
  return basis === 'ea' ? 0 : basis.endsWith('²') ? 2 : 1
}

export function basisMatchesType(basis: RateBasis, type: BoqRowType): boolean {
  return dimension(basis) === (type === 'count' ? 0 : type === 'area' || type === 'wall' ? 2 : 1)
}

function canonicalSize(basis: RateBasis): number {
  if (basis === 'ea') return 1
  const squared = basis.endsWith('²')
  const mm = MM_PER_UNIT[(squared ? basis.slice(0, -1) : basis) as ScaleUnit]
  return squared ? mm * mm : mm
}

/** Reciprocal of quantity conversion: money per target = money per source × target/source. */
export function convertUnitRate(rate: number, from: RateBasis, to: RateBasis): number {
  if (!isRateBasis(from) || !isRateBasis(to) || dimension(from) !== dimension(to))
    throw new Error('Incompatible rate basis')
  return rate * (canonicalSize(to) / canonicalSize(from))
}

/** Both rates move together; markup and unresolved review status retain their meaning. */
export function priceInBasis(entry: PriceEntry | undefined, to: RateBasis, legacyBasis = to): PriceEntry {
  const from = entry?.basis ?? legacyBasis
  return {
    ...entry,
    material: convertUnitRate(entry?.material ?? 0, from, to),
    labor: convertUnitRate(entry?.labor ?? 0, from, to),
    markup: entry?.markup ?? DEFAULT_MARKUP_PCT,
    basis: to,
    review: entry?.review ?? (entry ? 'legacy-unresolved' : 'reviewed')
  }
}
