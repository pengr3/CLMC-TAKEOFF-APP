/** Pure admission shared by archive saves, recovery, and the renderer. No store imports. */
export function validateProjectData(input: unknown, legacyHydration = false): void {
  const fail = (field: string): never => {
    throw new Error(`Invalid project metadata: ${field}`)
  }
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const positive = (v: unknown): v is number => finite(v) && v >= 1e-12 && v <= 1e12
  const unit = (v: unknown): boolean =>
    typeof v === 'string' && ['mm', 'cm', 'm', 'in', 'ft'].includes(v)
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) &&
    v.length <= 1_000_000 &&
    v.every((s) => typeof s === 'string' && s.length <= 65_536)
  const coordinate = (v: unknown): boolean => finite(v) && Math.abs(v) <= 1e12
  const point = (v: unknown): boolean => object(v) && coordinate(v.x) && coordinate(v.y)
  if (!object(input)) fail('object')
  const d = input as Record<string, unknown>
  if (![1, 2, 3].includes(d.formatVersion as number)) fail('formatVersion (newer app required)')
  if (d.formatVersion === 3 && d.minimumReaderVersion !== 3) fail('minimumReaderVersion')
  if (
    d.minimumReaderVersion !== undefined &&
    (!Number.isInteger(d.minimumReaderVersion) || (d.minimumReaderVersion as number) > 3)
  )
    fail('minimumReaderVersion')
  if (
    d.preservedSource !== undefined &&
    d.preservedSource !== null &&
    (!object(d.preservedSource) ||
      typeof d.preservedSource.path !== 'string' ||
      !d.preservedSource.path ||
      d.preservedSource.path.includes('\0') ||
      ![1, 2, 3].includes(d.preservedSource.format as number) ||
      typeof d.preservedSource.backup !== 'boolean')
  )
    fail('preserved source')
  if (typeof d.createdAt !== 'string' || typeof d.updatedAt !== 'string') fail('timestamps')
  if (!object(d.pdf)) fail('pdf')
  const pdf = d.pdf as Record<string, unknown>
  if (
    typeof pdf.sha256 !== 'string' ||
    !Number.isInteger(pdf.totalPages) ||
    (pdf.totalPages as number) < 1 ||
    (pdf.totalPages as number) > 100_000
  )
    fail('pdf pages/checksum')
  if (
    d.formatVersion === 1
      ? typeof pdf.absolutePath !== 'string'
      : typeof pdf.originalFilename !== 'string'
  )
    fail('pdf filename')
  if (!unit(d.globalUnit)) fail('globalUnit')
  if (
    !Number.isInteger(d.currentPage) ||
    (d.currentPage as number) < 1 ||
    (d.currentPage as number) > (pdf.totalPages as number)
  )
    fail('currentPage')
  if (
    !object(d.categories) ||
    Object.keys(d.categories).length > 100_000 ||
    !strings(d.categoryOrder)
  )
    fail('categories/order')
  for (const [key, c] of Object.entries(d.categories as Record<string, unknown>)) {
    if (
      !object(c) ||
      c.id !== key ||
      typeof c.name !== 'string' ||
      typeof c.color !== 'string' ||
      !Number.isInteger(c.paletteIndex) ||
      (c.paletteIndex as number) < 0
    )
      fail('category')
  }
  const categories = d.categories as Record<string, unknown>
  const categoryOrder = d.categoryOrder as string[]
  const orderedCategories = new Set(categoryOrder)
  if (orderedCategories.size !== categoryOrder.length || categoryOrder.some(id => !Object.hasOwn(categories, id)))
    fail('category order duplicates/references')
  if (!Array.isArray(d.pages) || d.pages.length !== pdf.totalPages) fail('pages/count')
  let markups = 0,
    vertices = 0
  const ids = new Set<string>()
  for (const [index, p] of (d.pages as unknown[]).entries()) {
    if (
      !object(p) ||
      p.pageIndex !== index + 1 ||
      !object(p.dimensions) ||
      !positive(p.dimensions.width) ||
      !positive(p.dimensions.height)
    )
      fail('page dimensions/index')
    const page = p as Record<string, unknown>
    if (page.coordinateBasis !== undefined && !['pdf-base-scale-2', 'legacy-unverified'].includes(page.coordinateBasis as string))
      fail('coordinate basis (newer app required)')
    if (
      !object(page.viewport) ||
      !positive(page.viewport.zoom) ||
      !coordinate(page.viewport.panX) ||
      !coordinate(page.viewport.panY)
    )
      fail('viewport')
    if (
      page.scale !== null &&
      (!object(page.scale) || !positive(page.scale.pixelsPerMm) || !unit(page.scale.displayUnit))
    )
      fail('scale')
    if (!Array.isArray(page.markups)) fail('markups')
    for (const m of page.markups as unknown[]) {
      if (
        ++markups > 1_000_000 ||
        !object(m) ||
        typeof m.id !== 'string' ||
        ids.has(m.id) ||
        typeof m.name !== 'string' ||
        typeof m.color !== 'string' ||
        typeof m.categoryId !== 'string' ||
        m.page !== page.pageIndex ||
        !finite(m.createdAt)
      )
        fail('markup')
      const item = m as Record<string, unknown>
      if (item.categoryId !== '' && (!Object.hasOwn(categories, item.categoryId as string) || !orderedCategories.has(item.categoryId as string)))
        fail('markup category reference/order')
      ids.add(item.id as string)
      if (item.type === 'count') {
        if (!point(item.point) || !Number.isInteger(item.sequence) || (item.sequence as number) < 1)
          fail('count geometry')
      } else {
        if (
          !['linear', 'area', 'perimeter', 'wall'].includes(item.type as string) ||
          !Array.isArray(item.points) ||
          item.points.length < 2 ||
          item.points.length > 1_000_000 ||
          !item.points.every(point)
        )
          fail('markup geometry')
        const points = item.points as unknown[]
        vertices += points.length
        if (vertices > 5_000_000) fail('vertex limit')
        // Normalized points may legally extend outside the page after moving/reshaping.
        // Finite coordinates are required; clamping to [0,1] would lose valid drawings.
        if (
          item.type === 'wall' &&
          (!finite(item.wallHeight) || item.wallHeight < 0 || item.wallHeight > 1e12)
        )
          fail('wall height')
        if (item.arcs !== undefined) {
          if (!object(item.arcs)) fail('arcs')
          const closed = item.type === 'area' || item.type === 'perimeter'
          for (const [edge, a] of Object.entries(item.arcs as Record<string, unknown>)) {
            if (
              !/^\d+$/.test(edge) ||
              Number(edge) >= points.length - (closed ? 0 : 1) ||
              !object(a) ||
              !coordinate(a.midX) ||
              !coordinate(a.midY)
            )
              fail('arc geometry/index')
          }
        }
      }
    }
  }
  if (d.hiddenItemNames !== undefined && !strings(d.hiddenItemNames)) fail('visibility')
  if (d.formatVersion === 3 || !legacyHydration) {
    if (
      d.categoryItemOrder !== undefined &&
      (!object(d.categoryItemOrder) || !Object.values(d.categoryItemOrder).every(strings))
    )
      fail('item order')
    if (d.defaultMarkupPct !== undefined && (!finite(d.defaultMarkupPct) || d.defaultMarkupPct < 0))
      fail('default markup')
  }
  if (d.rates !== undefined) {
    if (
      (d.formatVersion === 3 || !legacyHydration) &&
      (!object(d.rates) || Object.keys(d.rates).length > 1_000_000)
    )
      fail('rates')
    for (const [key, rate] of Object.entries(object(d.rates) ? d.rates : {})) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
      if (!object(rate)) {
        if (d.formatVersion === 3 || (!legacyHydration && (!finite(rate) || rate < 0)))
          fail('rate object/value')
        continue
      }
      if (rate.basis === undefined && rate.review === undefined && d.formatVersion !== 3) {
        // Genuine old fields may be absent (labor→0, markup→30). Explicit malformed
        // money is rejected at file/recovery admission, even for an old version.
        if (
          !legacyHydration &&
          ['material', 'labor', 'markup'].some(
            (field) =>
              rate[field] !== undefined && (!finite(rate[field]) || (rate[field] as number) < 0)
          )
        )
          fail('legacy rate values')
        continue
      }
      const r = rate as Record<string, unknown>,
        type = key.slice(key.lastIndexOf('|') + 1)
      if (!object(rate) || ![r.material, r.labor, r.markup].every((v) => finite(v) && v >= 0))
        fail('rate values')
      const basis = r.basis,
        dim =
          type === 'count'
            ? 0
            : ['area', 'wall'].includes(type)
              ? 2
              : ['linear', 'perimeter'].includes(type)
                ? 1
                : -1
      if (
        dim === 0
          ? basis !== 'ea'
          : dim === 1
            ? !unit(basis)
            : dim === 2
              ? typeof basis !== 'string' || !basis.endsWith('²') || !unit(basis.slice(0, -1))
              : true
      )
        fail('rate basis')
      if (
        !(r.review === undefined && d.formatVersion !== 3) &&
        !['reviewed', 'legacy-unresolved'].includes(r.review as string)
      )
        fail('rate review')
    }
  }
}
