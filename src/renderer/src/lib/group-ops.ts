/**
 * group-ops.ts — pure, store-free helpers for the Phase 17 whole-group commands
 * (rename / move / copy / duplicate). Every function takes its markup input as an
 * argument (`allMarkups` / `sourceMarkups`) and imports NOTHING from `../stores/`,
 * so the logic is deterministic and Node-testable in isolation (mirrors the
 * opts-injection discipline of `aggregateBoq`).
 *
 * - `autoUniqueName`  — first-free `"{base} (n)"` name for copy/duplicate (D-07/D-08, A3).
 * - `collisionExists` — the rename BLOCK predicate (D-04, A1): a same-`(name,type)`
 *                       group outside the rename set would make two buckets indistinguishable.
 * - `snapshotGroup`   — independent deep-cloned copies for copy/duplicate (D-07/D-08).
 */
import type { Markup, MarkupType } from '../types/markup'

/**
 * First-free unique name for a copied/duplicated group (D-07/D-08, A3).
 *
 * Strips a trailing " (n)" off `sourceName` to get the base (`"Slab (2)"` → `"Slab"`,
 * so a duplicate of a duplicate stays `"Slab (3)"`, never `"Slab (2) (2)"`), then returns
 * the smallest `"{base} (n)"` (n ≥ 2) whose name is NOT already taken by a markup sharing
 * a type with the source group. "Taken" is type-scoped: a same name under a DIFFERENT type
 * does not count (the aggregator buckets by `name|type`, so only same-type names would merge).
 * Contrast `nextCountSequence` (max+1, gap-preserving) — this is FIRST-FREE.
 */
export function autoUniqueName(
  sourceName: string,
  sourceTypes: Set<MarkupType>,
  allMarkups: Markup[]
): string {
  const base = sourceName.replace(/ \(\d+\)$/, '')
  const taken = new Set(allMarkups.filter((m) => sourceTypes.has(m.type)).map((m) => m.name))
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * The rename-collision predicate (D-04, Pitfall 2 / A1).
 *
 * Returns true iff renaming the group to `newName` would collide with ANOTHER group:
 * ∃ a markup NOT in the rename set with `name === newName` AND a type in the source
 * group's type set. Type-scoped (D-04 "of the same type"), category-INDEPENDENT
 * (matches the shared `name|type` rate/bucket key), and group-exclusive (the group's
 * own markups never self-collide). This is the exact condition under which the rename
 * would make two same-`(name,type)` groups merge into one bucket (silent quantity
 * doubling). A collision returns true so the caller BLOCKS with zero store writes.
 */
export function collisionExists(
  newName: string,
  renameSetIds: Set<string>,
  sourceTypes: Set<MarkupType>,
  allMarkups: Markup[]
): boolean {
  return allMarkups.some(
    (m) => !renameSetIds.has(m.id) && m.name === newName && sourceTypes.has(m.type)
  )
}

/**
 * Build independent snapshots of a group under a new name (Copy/Duplicate, D-07/D-08,
 * Pattern 5c). Each returned markup gets a FRESH `crypto.randomUUID()` id and a fresh
 * `createdAt`, keeps its `page`/`color`/`type`, and DEEP-CLONES `point`/`points`/`arcs`
 * so later edits to the source never mutate the copy (SPEC "independent"). `categoryId`
 * is `targetCategoryId` when provided (Copy/Move-to), else the source category (Duplicate).
 * Count markups get a FRESH per-page `sequence` (1..k under the new — necessarily unique —
 * name), never the source sequence (Pitfall 6: reused sequences duplicate pin numbers).
 */
export function snapshotGroup(
  sourceMarkups: Markup[],
  newName: string,
  targetCategoryId: string | null
): Markup[] {
  const nextSeqByPage: Record<number, number> = {}
  return sourceMarkups.map((src) => {
    const base = {
      ...src,
      id: crypto.randomUUID(),
      name: newName,
      categoryId: targetCategoryId ?? src.categoryId,
      createdAt: Date.now()
    } as Markup

    if (base.type === 'count') {
      // Fresh per-page sequence under the new name (never the source sequence).
      const seq = (nextSeqByPage[base.page] ?? 0) + 1
      nextSeqByPage[base.page] = seq
      return { ...base, point: { ...base.point }, sequence: seq } as Markup
    }

    // Multi-point: deep-clone points and (if present) the per-edge arc map so the
    // copy owns brand-new array/object identities.
    const points = base.points.map((p) => ({ ...p }))
    if (base.arcs !== undefined) {
      const arcs: Record<number, { midX: number; midY: number }> = {}
      for (const [k, v] of Object.entries(base.arcs)) arcs[Number(k)] = { midX: v.midX, midY: v.midY }
      return { ...base, points, arcs } as Markup
    }
    return { ...base, points } as Markup
  })
}
