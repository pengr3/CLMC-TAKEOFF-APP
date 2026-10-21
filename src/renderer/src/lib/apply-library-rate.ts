import {
  normalizeLibraryUnit,
  type CostLibraryItem,
  type LibraryResult
} from '../../../shared/cost-library'
import { useProjectStore } from '../stores/projectStore'
import { labelToName } from '../components/TotalsRow'
import type { BoqItemRow } from './boq-types'
import { basisMatchesType, isRateBasis } from './rate-units'

export function applyLibraryRate(
  target: BoqItemRow,
  source: CostLibraryItem
): LibraryResult<boolean> {
  const unit = normalizeLibraryUnit(target.uom)
  if (!unit || !isRateBasis(unit) || !basisMatchesType(unit, target.type) || unit !== normalizeLibraryUnit(source.unit))
    return {
      ok: false,
      reason: `Choose a rate per ${target.uom}. Rates are not automatically converted.`
    }
  if (![source.material, source.labor].every((v) => Number.isFinite(v) && v >= 0))
    return { ok: false, reason: 'This item contains an invalid rate. Import a corrected library.' }
  const project = useProjectStore.getState()
  const key = `${labelToName(target.label)}|${target.type}`
  project.setPrice(key, {
    material: source.material,
    labor: source.labor,
    markup: project.rates[key]?.markup ?? project.defaultMarkupPct,
    basis: unit,
    review: 'reviewed'
  })
  return { ok: true, value: true }
}
