import { useMemo } from 'react'
import { aggregateBoq } from '../lib/boq-aggregator'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import type { BoqStructure } from '../lib/boq-types'

/**
 * useBoqLive — live, memoized BoqStructure derive over the eight Zustand
 * primitives that aggregateBoq() reads.
 *
 * Each store slice is a top-level primitive selector — never `(s) => s` —
 * so React only re-runs this component when one of those eight references
 * changes (Object.is). The aggregator is pure and synchronous; useMemo
 * captures the result with the same eight values as its dependency list,
 * so a new BoqStructure is computed exactly when (and only when) any
 * input would have caused a different result.
 *
 * `getColorForName` is intentionally NOT a selector — it's read via
 * `useMarkupStore.getState()` inside the memo so its identity does not
 * trigger spurious recomputes. The function reads the same store on
 * call, so liveness is preserved.
 *
 * Used by TotalsPanel (Phase 6 Wave 3) and any other reactive consumer of
 * the BOQ structure. Imperative export callers should keep using
 * `aggregateBoq()` directly — see useExport.ts.
 */
export function useBoqLive(): BoqStructure {
  const pageMarkups     = useMarkupStore((s) => s.pageMarkups)
  const categories      = useMarkupStore((s) => s.categories)
  const categoryOrder   = useMarkupStore((s) => s.categoryOrder)
  const pageScales      = useScaleStore((s) => s.pageScales)
  const globalUnit      = useScaleStore((s) => s.globalUnit)
  const totalPages      = useViewerStore((s) => s.totalPages)
  const fileName        = useViewerStore((s) => s.fileName)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)

  return useMemo(
    () =>
      aggregateBoq({
        markups: pageMarkups,
        pageScales,
        globalUnit,
        totalPages,
        categoriesById: categories as Record<string, { id: string; name: string }>,
        categoryOrder,
        pdfOriginalFilename: fileName ?? 'plan.pdf',
        currentFilePath,
        getColorForName: (n) => useMarkupStore.getState().getColorForName(n)
      }),
    [pageMarkups, categories, categoryOrder, pageScales, globalUnit, totalPages, fileName, currentFilePath]
  )
}
