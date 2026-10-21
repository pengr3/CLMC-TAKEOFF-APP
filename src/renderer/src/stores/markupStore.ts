import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Markup, Category, MarkupCommand, CountMarkup } from '../types/markup'
import { CATEGORY_PALETTE, UNDO_STACK_MAX } from '../types/markup'
import type { StagePoint } from '../hooks/useCalibrationMode'
import { setReopenSnapshot } from '../lib/markup-reopen-ref'
import { collisionExists, autoUniqueName, snapshotGroup } from '../lib/group-ops'
import type { PriceEntry } from '../lib/boq-types'
import { DEFAULT_MARKUP_PCT } from '../lib/estimate-defaults'
import { visibleRateBasis } from '../lib/rate-units'
import { useScaleStore } from './scaleStore'
import type { ScaleUnit } from '../types/scale'
// Phase 17-02: markupStore orchestrates the projectStore side of the cross-store
// commands (rename re-keys rates/hidden; copy/dup add/remove a blank rate). This is a
// NEW markupStore→projectStore module reference, while projectStore already imports
// useMarkupStore (attachDirtyTracking) — a deliberate bidirectional cycle. It is SAFE
// because every cross-store call lives inside a deferred action/closure (invoked at
// undo/redo/rename time), so neither module dereferences the other during its own
// initialization. (FALLBACK if a build/ESM-init issue ever surfaces: resolve the store
// lazily inside applyProjectUndo/applyProjectRedo/renameGroup instead of this top import.)
import { useProjectStore } from './projectStore'

interface MarkupStoreState {
  pageMarkups: Record<number, Markup[]>
  categories: Record<string, Category>
  categoryOrder: string[]
  /**
   * Phase 17 (Req 2, D-11): persisted per-category manual item order. Key is a
   * categoryId or '__uncat__' (UNCAT_BUCKET_KEY); value is the ordered list of
   * `${name}|${type}` bucket keys. Consumed by aggregateBoq to order rows (replacing
   * the former alphabetical sort). Absent key → placement order. Additive in the
   * .clmc (no formatVersion bump); mirrors categoryOrder's wiring.
   */
  categoryItemOrder: Record<string, string[]>
  undoStack: MarkupCommand[]
  redoStack: MarkupCommand[]

  getMarkups: (page: number) => Markup[]
  findCategoryByName: (name: string) => Category | null
  getCategory: (id: string) => Category | null
  getAllCategories: () => Category[]
  nextCountSequence: (page: number, name: string) => number

  getOrCreateCategory: (name: string) => Category
  placeMarkup: (markup: Markup) => void
  deleteMarkup: (page: number, markupId: string) => void
  /**
   * Delete a group of markups as a single undoable command (D-09).
   * Pushes one 'delete-group' command onto the undoStack — undo() restores
   * every markup to its original page; redo() re-removes them.
   *
   * Empty array is a no-op (no command pushed). Selection-clear in the
   * keyboard handler (Plan 02) is the caller's responsibility; this action
   * does not reach into viewerStore (cross-store coupling avoided).
   */
  deleteGroup: (markups: Markup[]) => void
  recolorGroup: (name: string, newColor: string, page?: number) => void
  /**
   * Phase 17 (Req 2): set the persisted manual item order for a category as a single
   * undoable command. `catKey` is a categoryId or '__uncat__'; `newOrder` is the
   * ordered list of `${name}|${type}` bucket keys. Defensive no-op (no command
   * pushed, state reference unchanged) when the order is unchanged. undo() restores
   * the prior order; redo() re-applies. Single-store command — mirrors recolorGroup's
   * push-one-command / clear-redo discipline.
   */
  reorderItems: (catKey: string, newOrder: string[]) => void
  /**
   * Phase 17 (Req 1, D-03/D-04): rename a whole markup group as ONE undoable, cross-store
   * command. Flips `.name` on every markup named `oldName` (all pages) and atomically
   * re-keys the three name-keyed structures — `rates` (`old|type`→`new|type` per type),
   * `hiddenItemNames` (the COMPOSITE `old|categoryId`→`new|categoryId` per category the
   * group touches — Pitfall 1), and `categoryItemOrder` (`old|type`→`new|type`). Per-name
   * color follows automatically (getColorForName reads the renamed markups).
   *
   * Returns `{ ok: false }` with ZERO store writes when `newName` is blank/whitespace
   * (D-03), when no group named `oldName` exists, or when `newName` collides with another
   * group OF THE SAME TYPE outside the rename set (D-04 — block, never merge). Returns
   * `{ ok: true }` (no command) when `newName` equals `oldName` (trivial no-op).
   *
   * The rate/hidden re-key is applied to projectStore BEFORE the markupStore set(); one
   * Ctrl+Z reverts BOTH stores (undo() calls applyProjectUndo before its set()).
   */
  renameGroup: (oldName: string, newName: string) => { ok: boolean }
  /**
   * Phase 17 (Req 3, D-06): move a whole markup group to another category as ONE undoable
   * command. Reassigns `categoryId` to the resolved target on every markup named `name`
   * (all pages); the row LEAVES its source category's manual order and APPENDS to the
   * target's (A5). Name, quantity, color, and rate (the category-INDEPENDENT `name|type`
   * key) are all unchanged. The target category is resolved via getOrCreateCategory BEFORE
   * the set() (resolve-before-set, like editMarkup). Defensive no-op when no group named
   * `name` exists. Single-store command (no projectStore payload — the move-group undo/redo
   * branches from 17-02 revert categoryId + order with one Ctrl+Z).
   */
  moveGroup: (name: string, targetCategoryName: string) => void
  /**
   * Phase 17 (Req 4, D-07): copy a whole group into the chosen category as INDEPENDENT new
   * markups — fresh ids, DEEP-cloned geometry, fresh per-page count sequences (Pitfall 6) —
   * under an auto-unique name ("{base} (n)", first-free) with a fresh BLANK rate
   * `{ material:0, labor:0, markup: DEFAULT_MARKUP_PCT }` at a DISTINCT `name|type` key.
   * Editing the source geometry never changes the copy. Target resolved via
   * getOrCreateCategory BEFORE set(); the blank rate is seeded in projectStore BEFORE set()
   * (cross-store — one Ctrl+Z removes BOTH the new markups and their rate via the 17-02
   * copy-group undo branch). Defensive no-op when no group named `name` exists.
   */
  copyGroup: (name: string, targetCategoryName: string) => void
  /**
   * Phase 17 (Req 5, D-08): duplicate a group IN PLACE — identical to copyGroup but the
   * target is the source group's own category and there is NO dialog. The auto-unique name
   * ("{base} (n)") produces a DISTINCT bucket, so the duplicate never merges into the source
   * (no quantity doubling). One undoable, cross-store command. Defensive no-op when absent.
   */
  duplicateGroup: (name: string) => void
  editMarkup: (
    markupId: string,
    page: number,
    oldName: string,
    oldCategoryName: string,
    oldColor: string,
    newName: string,
    newCategoryName: string,
    newColor: string,
    oldWallHeight?: number,
    newWallHeight?: number
  ) => void
  /**
   * Move a single vertex of a non-count markup (linear/area/perimeter/wall).
   * Pushes one 'move-vertex' command onto undoStack, clears redoStack.
   * Defensive no-op on unknown markupId. Caller is responsible for ensuring
   * the markup is not a count pin (count markups have `point`, not `points[]`).
   */
  moveVertex: (
    markupId: string,
    page: number,
    vertexIndex: number,
    newPoint: StagePoint,
    /**
     * Phase 14 (D-08): atomic arc re-solve. When the dragged vertex is an arc
     * edge's endpoint, pass the re-solved full arc map so the points swap and the
     * arcs swap ride in ONE command (one Ctrl+Z reverts both). Omit for straight
     * edges. `oldArcs` is captured from the markup's current `arcs` field.
     */
    newArcs?: Record<number, { midX: number; midY: number }>
  ) => void
  /**
   * Replace the full per-edge arc map of a non-count markup (D-08, bulge reshape).
   * Pushes one 'reshape-arc' command onto undoStack (carrying the symmetric
   * oldArcs/newArcs), clears redoStack. Defensive no-op on unknown markupId or a
   * count pin. Mirrors moveVertex's dispatch shape: ONE command, redoStack reset.
   *
   * `newArcs` may be undefined to clear all arcs (revert every edge to straight);
   * `oldArcs` is captured from the markup's current `arcs` field so undo restores
   * the exact prior state — including removing an arc the edit added.
   */
  reshapeArc: (
    markupId: string,
    page: number,
    newArcs?: Record<number, { midX: number; midY: number }>
  ) => void
  /**
   * Translate one or more markups by replacing their points/point with the
   * supplied new values. Single-markup translate (moves.length === 1) and
   * group-move (moves.length === N) both push exactly one 'move-markups'
   * command onto undoStack and clear redoStack. Empty array is a no-op.
   *
   * For count pins: callers normalise the move as `oldPoints: [markup.point]`
   * and `newPoints: [newPoint]`. The store detects count type and writes
   * `markup.point` instead of `markup.points`.
   */
  moveMarkups: (
    moves: Array<{
      markupId: string
      page: number
      oldPoints: StagePoint[]
      newPoints: StagePoint[]
    }>
  ) => void
  /** Phase 13 (D-16): single-command commit of a re-opened markup. */
  commitReopen: (oldMarkup: Markup, newMarkup: Markup) => void
  /** Phase 13 (D-14): silent removal at re-open trigger time. NOT a command. */
  removeForReopen: (markup: Markup) => void
  /** Phase 13 (D-14): silent restoration on Esc-cancel of re-open. NOT a command. */
  restoreFromReopen: (markup: Markup) => void
  /** Phase 13 (WR-01): re-push a place command via pushCommand so UNDO_STACK_MAX is respected. */
  repushPlaceForReopenCancel: (markup: Markup) => void
  getColorForName: (name: string, page?: number) => string | null

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  hydrate: (data: {
    pageMarkups: Record<number, Markup[]>
    categories: Record<string, Category>
    categoryOrder: string[]
    /**
     * Phase 17 (Req 2): optional so pre-Phase-17 callers (and any that omit it)
     * still compile; the store coerces an absent value to {} on set. project-serialize
     * passes the V5-coerced order here.
     */
    categoryItemOrder?: Record<string, string[]>
  }) => void
  reset: () => void
}

function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}

/**
 * Order-sensitive shallow equality for the reorderItems no-op guard (Phase 17).
 * Two orders are equal iff same length and same elements in the same positions.
 */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * The categoryItemOrder bucket key for a markup's `categoryId` — the real id when set,
 * else '__uncat__'. Mirrors the aggregator's `categoryId && length>0 ? categoryId :
 * UNCAT_BUCKET_KEY` convention (boq-aggregator.ts:116/139) so the manual-order keys that
 * move/copy/duplicate write line up with the buckets the aggregator ranks. (The aggregator's
 * UNCAT_BUCKET_KEY is module-private there; this local const keeps the literal in one place.)
 */
const UNCAT_ORDER_KEY = '__uncat__'
function orderCatKey(categoryId: string): string {
  return categoryId && categoryId.length > 0 ? categoryId : UNCAT_ORDER_KEY
}

/**
 * Append `newKeys` to a category's manual order, SEEDING it to completeness first.
 *
 * Bug this fixes: the aggregator ranks listed order keys 0..n-1 and every UNLISTED bucket
 * at Infinity (so newly-placed items fall to the bottom in placement order). move/copy/
 * duplicate previously appended a single key to `categoryItemOrder[catKey]`; when that
 * category had never been drag-reordered (its order was empty/absent), the appended key
 * became the ONLY ranked entry (rank 0) while every existing item stayed unranked
 * (Infinity) — so the moved/copied/duplicated row jumped to the TOP of the category
 * instead of the bottom the "append" intent (A5/D-06) promises.
 *
 * Seeding: keep the existing order VERBATIM (a genuinely-reordered category is untouched,
 * and a stored key with no live bucket is preserved — the aggregator ignores it), then
 * back-fill any PRESENT-but-unranked bucket keys in page-scan (placement) order — matching
 * the aggregator's bucket-insertion order so the seeded ranks equal what the user sees —
 * and finally append `newKeys`. The result is a COMPLETE order with the new keys last.
 *
 * `pageMarkups` must be the state BEFORE the move/copy adds or re-homes markups, so the
 * placement scan reflects the target category's pre-existing items only (the new keys are
 * appended explicitly, never double-counted).
 */
function orderWithAppend(
  pageMarkups: Record<number, Markup[]>,
  catKey: string,
  existingOrder: string[] | undefined,
  newKeys: string[]
): string[] {
  const existing = existingOrder ?? []
  const existingSet = new Set(existing)
  const placement: string[] = []
  const seen = new Set<string>()
  const pages = Object.keys(pageMarkups)
    .map(Number)
    .sort((a, b) => a - b)
  for (const p of pages) {
    for (const m of pageMarkups[p] ?? []) {
      if (orderCatKey(m.categoryId) !== catKey) continue
      const k = `${m.name}|${m.type}`
      if (!seen.has(k)) {
        seen.add(k)
        placement.push(k)
      }
    }
  }
  const seededComplete = [...existing, ...placement.filter((k) => !existingSet.has(k))]
  const completeSet = new Set(seededComplete)
  return [...seededComplete, ...newKeys.filter((k) => !completeSet.has(k))]
}

/**
 * The independent-snapshot payload shared by copyGroup and duplicateGroup — the full new
 * markups, the fresh blank rate rows to add, and the order keys to append. Copy and
 * Duplicate build this IDENTICALLY; they differ ONLY in the target category (copy: the
 * resolved destination; duplicate: the source category) and the command discriminant.
 */
interface SnapshotPayload {
  newMarkups: Markup[]
  rateKeys: Array<{ key: string; entry: PriceEntry }>
  orderAppends: Array<{ catKey: string; itemKey: string }>
}

/**
 * Build the copy/duplicate snapshot payload (D-07/D-08). Auto-names the group first-free
 * ("{base} (n)"), deep-clones every source markup into `targetCategoryId` with fresh ids +
 * fresh per-page count sequences (snapshotGroup — Pitfall 6), and derives a fresh BLANK rate
 * `{ material:0, labor:0, markup: DEFAULT_MARKUP_PCT }` at a DISTINCT `${newName}|${type}`
 * key per type present, with captured visible basis and the matching order-append key.
 * Pure — callers inject markups/unit (no store reads), so redo retains exact metadata.
 */
function buildSnapshotPayload(
  name: string,
  targetCategoryId: string,
  allMarkups: Markup[],
  /** Existing projectStore rate keys — excluded from the auto-name so copy/duplicate never
   *  reuses a name that already carries an orphaned rate (see autoUniqueName). */
  existingRateKeys: Iterable<string> = [],
  rateUnit: ScaleUnit = 'm'
): SnapshotPayload {
  const sourceMarkups = allMarkups.filter((m) => m.name === name)
  const sourceTypes = new Set(sourceMarkups.map((m) => m.type))
  const newName = autoUniqueName(name, sourceTypes, allMarkups, existingRateKeys)
  const newMarkups = snapshotGroup(sourceMarkups, newName, targetCategoryId)
  const catKey = orderCatKey(targetCategoryId)
  const rateKeys: Array<{ key: string; entry: PriceEntry }> = []
  const orderAppends: Array<{ catKey: string; itemKey: string }> = []
  for (const t of sourceTypes) {
    const itemKey = `${newName}|${t}`
    rateKeys.push({ key: itemKey, entry: { material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT,
      basis: visibleRateBasis(t, rateUnit), review: 'reviewed' } })
    orderAppends.push({ catKey, itemKey })
  }
  return { newMarkups, rateKeys, orderAppends }
}

/**
 * The markupStore side of a copy/duplicate forward apply: add the new snapshots to their
 * pages, append the order keys, and push the copy-group / duplicate-group command (clearing
 * redo). Symmetric with the copy/duplicate REDO branch (17-02). The projectStore blank rates
 * are seeded by the caller BEFORE set() (like getOrCreateCategory / rename re-keys), so the
 * two stores land together in one Ctrl+Z unit.
 */
function snapshotForwardReducer(
  s: MarkupStoreState,
  commandType: 'copy-group' | 'duplicate-group',
  payload: SnapshotPayload
): Partial<MarkupStoreState> {
  const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
  for (const m of payload.newMarkups) {
    nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
  }
  // Seed the target order to completeness before appending so the copy/duplicate lands at
  // the BOTTOM (not the top of a never-reordered category). Group appends by catKey and
  // reads s.pageMarkups (WITHOUT the new snapshots) so their keys are appended exactly once.
  const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
  const appendsByCat = new Map<string, string[]>()
  for (const ap of payload.orderAppends) {
    const list = appendsByCat.get(ap.catKey) ?? []
    list.push(ap.itemKey)
    appendsByCat.set(ap.catKey, list)
  }
  for (const [catKey, keys] of appendsByCat) {
    nextOrder[catKey] = orderWithAppend(s.pageMarkups, catKey, nextOrder[catKey], keys)
  }
  const cmd: MarkupCommand = {
    type: commandType,
    newMarkups: payload.newMarkups,
    rateKeys: payload.rateKeys,
    orderAppends: payload.orderAppends
  }
  return {
    pageMarkups: nextPageMarkups,
    categoryItemOrder: nextOrder,
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: []
  }
}

/**
 * Return a copy of `markup` with its `arcs` field set to `arcs` (or removed
 * entirely when `arcs` is undefined). Count pins are returned unchanged (they
 * carry no edges / arcs field). Shared by the reshape-arc and move-vertex
 * (atomic endpoint re-solve) undo/redo branches so the arcs swap rides in the
 * SAME object the points swap produces — one render, one undo entry.
 */
function withArcs(
  markup: Markup,
  arcs: Record<number, { midX: number; midY: number }> | undefined
): Markup {
  if (markup.type === 'count') return markup
  if (arcs !== undefined) return { ...markup, arcs } as Markup
  const next = { ...markup } as { arcs?: unknown }
  delete next.arcs
  return next as Markup
}

/**
 * Apply the projectStore side of an UNDO, synchronously, immediately BEFORE the
 * markupStore set() in undo() (Phase 17-02 cross-store atomicity — Shared Pattern B):
 *   - rename-group → move the rate/hidden keys BACK (newKey→oldKey).
 *   - copy-/duplicate-group → remove the blank rates the forward action added.
 *   - every other command type is single-store → no-op.
 * Both this projectStore write and the following markupStore set() are synchronous, so
 * one Ctrl+Z reverts BOTH stores (React 19 batches the renders). Resolves the store via
 * useProjectStore.getState() at CALL time (deferred) — safe despite the module cycle.
 */
function applyProjectUndo(cmd: MarkupCommand): void {
  const ps = useProjectStore.getState()
  if (cmd.type === 'rename-group') {
    for (const rk of cmd.rateReKeys) ps.reKeyRate(rk.newKey, rk.oldKey)
    for (const hk of cmd.hiddenReKeys) ps.reKeyHidden(hk.newKey, hk.oldKey)
  } else if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
    for (const rk of cmd.rateKeys) ps.removeRate(rk.key)
  } else if (cmd.type === 'move-group') {
    // Reverse the visibility migration: drop the target key, restore the source keys.
    ps.setHiddenBatch(cmd.hiddenAdd, cmd.hiddenRemove)
  }
}

/**
 * Mirror of applyProjectUndo for REDO: re-apply the rename re-keys (oldKey→newKey) and
 * re-add the copy/duplicate blank rates (setPrice sets the full captured entry). Called
 * before the markupStore set() in redo(). Single-store commands are a no-op.
 */
function applyProjectRedo(cmd: MarkupCommand): void {
  const ps = useProjectStore.getState()
  if (cmd.type === 'rename-group') {
    for (const rk of cmd.rateReKeys) ps.reKeyRate(rk.oldKey, rk.newKey)
    for (const hk of cmd.hiddenReKeys) ps.reKeyHidden(hk.oldKey, hk.newKey)
  } else if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
    for (const rk of cmd.rateKeys) ps.setPrice(rk.key, rk.entry)
  } else if (cmd.type === 'move-group') {
    // Re-apply the visibility migration: drop the source keys, add the target key.
    ps.setHiddenBatch(cmd.hiddenRemove, cmd.hiddenAdd)
  }
}

// Factory kept as a function so the store is created once and REUSED across Vite
// HMR updates (see the import.meta.hot block at the end of this file). Without it,
// a hot-reload re-evaluates this module and calls create() again, leaving mounted
// components subscribed to the previous instance — the dual-store desync.
// Return type left to inference (see viewerStore.ts) so ReturnType<> stays exact.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMarkupStore = () =>
  create<MarkupStoreState>()(
    subscribeWithSelector((set, get) => ({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      categoryItemOrder: {},
      undoStack: [],
      redoStack: [],

      getMarkups: (page) => get().pageMarkups[page] ?? [],

      findCategoryByName: (name) => {
        const norm = name.trim().toLowerCase()
        for (const cat of Object.values(get().categories)) {
          if (cat.name.trim().toLowerCase() === norm) return cat
        }
        return null
      },

      getCategory: (id) => get().categories[id] ?? null,

      getAllCategories: () =>
        get()
          .categoryOrder.map((id) => get().categories[id])
          .filter((c): c is Category => Boolean(c)),

      nextCountSequence: (page, name) => {
        const existing = (get().pageMarkups[page] ?? []).filter(
          (m): m is CountMarkup => m.type === 'count' && m.name === name
        )
        return existing.length === 0 ? 1 : Math.max(...existing.map((m) => m.sequence)) + 1
      },

      getOrCreateCategory: (name) => {
        const existing = get().findCategoryByName(name)
        if (existing) return existing
        const paletteIndex = get().categoryOrder.length % CATEGORY_PALETTE.length
        const id = crypto.randomUUID()
        const cat: Category = {
          id,
          name: name.trim(),
          color: CATEGORY_PALETTE[paletteIndex],
          paletteIndex
        }
        set((s) => ({
          categories: { ...s.categories, [id]: cat },
          categoryOrder: [...s.categoryOrder, id]
        }))
        return cat
      },

      placeMarkup: (markup) =>
        set((s) => {
          const pageList = [...(s.pageMarkups[markup.page] ?? []), markup]
          return {
            pageMarkups: { ...s.pageMarkups, [markup.page]: pageList },
            undoStack: pushCommand(s.undoStack, { type: 'place', markup }),
            redoStack: []
          }
        }),

      deleteMarkup: (page, markupId) =>
        set((s) => {
          const pageList = s.pageMarkups[page] ?? []
          const target = pageList.find((m) => m.id === markupId)
          if (!target) return s
          return {
            pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markupId) },
            undoStack: pushCommand(s.undoStack, { type: 'delete', markup: target }),
            redoStack: []
          }
        }),

      deleteGroup: (markups) =>
        set((s) => {
          if (markups.length === 0) return s
          const idSet = new Set(markups.map((m) => m.id))
          const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
          for (const p of Object.keys(nextPageMarkups).map(Number)) {
            nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
          }
          return {
            pageMarkups: nextPageMarkups,
            undoStack: pushCommand(s.undoStack, { type: 'delete-group', markups }),
            redoStack: []
          }
        }),

      recolorGroup: (name, newColor, page) =>
        set((s) => {
          const pagesToScan = page !== undefined ? [page] : Object.keys(s.pageMarkups).map(Number)
          const oldColors: Record<string, string> = {}
          const idsAffected: string[] = []
          const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }

          for (const p of pagesToScan) {
            const list = s.pageMarkups[p] ?? []
            const updated = list.map((m) => {
              if (m.name === name && m.color !== newColor) {
                oldColors[m.id] = m.color
                idsAffected.push(m.id)
                return { ...m, color: newColor } as Markup
              }
              return m
            })
            nextPageMarkups[p] = updated
          }

          if (idsAffected.length === 0) return s

          const cmd: MarkupCommand = {
            type: 'recolor-group',
            name,
            newColor,
            oldColors,
            page,
            markupIdsAffected: idsAffected
          }
          return {
            pageMarkups: nextPageMarkups,
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        }),

      reorderItems: (catKey, newOrder) =>
        set((s) => {
          const oldOrder = s.categoryItemOrder[catKey] ?? []
          // Defensive no-op — an unchanged order pushes no command and leaves the state
          // reference intact (mirrors recolorGroup's `idsAffected.length === 0` guard).
          if (arraysEqual(oldOrder, newOrder)) return s
          const cmd: MarkupCommand = { type: 'reorder-items', catKey, oldOrder, newOrder }
          return {
            categoryItemOrder: { ...s.categoryItemOrder, [catKey]: newOrder },
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        }),

      renameGroup: (oldName, newName) => {
        const trimmed = newName.trim()
        if (trimmed.length === 0) return { ok: false } // D-03: blank/whitespace rejected, no writes
        if (trimmed === oldName) return { ok: true } // trivial no-op — nothing to re-key or push

        const state = get()
        const allMarkups: Markup[] = Object.values(state.pageMarkups).flat()
        const sourceMarkups = allMarkups.filter((m) => m.name === oldName)
        if (sourceMarkups.length === 0) return { ok: false } // no group to rename

        const sourceTypes = new Set(sourceMarkups.map((m) => m.type))
        const renameSetIds = new Set(sourceMarkups.map((m) => m.id))

        // D-04: BLOCK on a same-type collision with a group OUTSIDE the rename set. Only
        // reads have happened so far → returning here is a guaranteed ZERO-write no-op.
        if (collisionExists(trimmed, renameSetIds, sourceTypes, allMarkups)) {
          return { ok: false }
        }

        // Compute the three name-keyed re-keys from CURRENT projectStore + order state.
        const ps = useProjectStore.getState()

        // rates: `${name}|${type}`, category-INDEPENDENT — re-key per type actually present.
        const rateReKeys: Array<{ oldKey: string; newKey: string; entry: PriceEntry }> = []
        for (const t of sourceTypes) {
          const oldKey = `${oldName}|${t}`
          const entry = ps.rates[oldKey]
          if (entry) rateReKeys.push({ oldKey, newKey: `${trimmed}|${t}`, entry })
        }

        // hiddenItemNames: the COMPOSITE `${name}|${categoryId}` (Pitfall 1). A group can span
        // categories (Pitfall 3) → re-key per DISTINCT category the group touches. Match the
        // visibility layer's normalization (aggregator: empty/missing categoryId → '' bucket).
        const catKeyOf = (m: Markup): string =>
          m.categoryId && m.categoryId.length > 0 ? m.categoryId : ''
        const hiddenReKeys: Array<{ oldKey: string; newKey: string }> = []
        for (const cp of new Set(sourceMarkups.map(catKeyOf))) {
          const oldKey = `${oldName}|${cp}`
          if (ps.hiddenItemNames.includes(oldKey)) {
            hiddenReKeys.push({ oldKey, newKey: `${trimmed}|${cp}` })
          }
        }

        // categoryItemOrder values are `${name}|${type}` keys — re-key in every category
        // order array that contains one.
        const orderReKeys: Array<{ catKey: string; oldItemKey: string; newItemKey: string }> = []
        for (const [catKey, order] of Object.entries(state.categoryItemOrder)) {
          for (const t of sourceTypes) {
            const oldItemKey = `${oldName}|${t}`
            if (order.includes(oldItemKey)) {
              orderReKeys.push({ catKey, oldItemKey, newItemKey: `${trimmed}|${t}` })
            }
          }
        }

        // Apply the projectStore side BEFORE set() (resolve-before-set, like getOrCreateCategory).
        for (const rk of rateReKeys) ps.reKeyRate(rk.oldKey, rk.newKey)
        for (const hk of hiddenReKeys) ps.reKeyHidden(hk.oldKey, hk.newKey)

        set((s) => {
          const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
          for (const p of Object.keys(nextPageMarkups).map(Number)) {
            nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
              renameSetIds.has(m.id) ? ({ ...m, name: trimmed } as Markup) : m
            )
          }
          const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
          for (const rk of orderReKeys) {
            const arr = nextOrder[rk.catKey]
            if (arr)
              nextOrder[rk.catKey] = arr.map((k) => (k === rk.oldItemKey ? rk.newItemKey : k))
          }
          const cmd: MarkupCommand = {
            type: 'rename-group',
            oldName,
            newName: trimmed,
            markupIdsAffected: [...renameSetIds],
            rateReKeys,
            hiddenReKeys,
            orderReKeys
          }
          return {
            pageMarkups: nextPageMarkups,
            categoryItemOrder: nextOrder,
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        })
        return { ok: true }
      },

      moveGroup: (name, targetCategoryName) => {
        // HG-01: an empty/whitespace target is a safe no-op — never reach getOrCreateCategory('')
        // (which would mint a permanent, unrecoverable blank-named category). Defends any caller.
        if (targetCategoryName.trim().length === 0) return
        // Resolve the target category BEFORE set() (avoid a nested set() — mirrors editMarkup).
        const targetCat = get().getOrCreateCategory(targetCategoryName)
        const state = get()
        const sourceMarkups = Object.values(state.pageMarkups)
          .flat()
          .filter((m) => m.name === name)
        if (sourceMarkups.length === 0) return // defensive no-op (no group named `name`)

        const markupIdsAffected = sourceMarkups.map((m) => m.id)
        // Capture each markup's ORIGINAL categoryId so undo restores every markup to where it
        // actually came from. A group can span categories (same name in ≥2 categories, Pitfall 3)
        // and collapses onto the target on move; a single scalar oldCategoryId would wrongly
        // re-home them all to one category on undo. Per-id capture mirrors recolor-group.oldColors.
        const oldCategoryById: Record<string, string> = {}
        for (const m of sourceMarkups) oldCategoryById[m.id] = m.categoryId

        // Hidden/visibility re-key (the composite key is `${name}|${categoryId}` — '' for
        // uncategorized, matching TotalsRow/renameGroup, NOT the '__uncat__' order sentinel).
        // Moving a group changes categoryId, so without this a hidden group would silently
        // reappear and its stale `${name}|${sourceCat}` key would leak. Migrate every hidden
        // SOURCE key to the single target key so a hidden group stays hidden after the move.
        const ps = useProjectStore.getState()
        const hiddenCatOf = (m: Markup): string =>
          m.categoryId && m.categoryId.length > 0 ? m.categoryId : ''
        const hiddenRemove: string[] = []
        const seenHidden = new Set<string>()
        for (const m of sourceMarkups) {
          const srcRaw = hiddenCatOf(m)
          if (srcRaw === targetCat.id) continue // already in the target — nothing to migrate
          const key = `${name}|${srcRaw}`
          if (seenHidden.has(key)) continue
          seenHidden.add(key)
          if (ps.hiddenItemSet.has(key)) hiddenRemove.push(key)
        }
        // If the group was hidden in ANY source category, keep it hidden under the target key.
        const hiddenAdd = hiddenRemove.length > 0 ? [`${name}|${targetCat.id}`] : []

        // orderRemove: for each DISTINCT (source catKey, type) present, capture the item's index
        // in that category's manual order — read from the ORIGINAL array so undo can splice it
        // back exactly. Skip the target itself and any category without a manual-order entry.
        const orderRemove: Array<{ catKey: string; itemKey: string; index: number }> = []
        const seenRemove = new Set<string>()
        for (const m of sourceMarkups) {
          const srcCatKey = orderCatKey(m.categoryId)
          if (srcCatKey === targetCat.id) continue // already in the target — nothing to move out
          const itemKey = `${name}|${m.type}`
          const dedupe = `${srcCatKey}::${itemKey}`
          if (seenRemove.has(dedupe)) continue
          const arr = state.categoryItemOrder[srcCatKey]
          if (!arr) continue
          const index = arr.indexOf(itemKey)
          if (index < 0) continue
          seenRemove.add(dedupe)
          orderRemove.push({ catKey: srcCatKey, itemKey, index })
        }
        // Ascending index so the undo branch's in-order splices reconstruct the source array.
        orderRemove.sort((a, b) => a.index - b.index)

        // orderAppend: one `name|type` per DISTINCT type in the group → APPEND to the target's
        // order (A5/D-06). Skip a type already present in the target order (idempotent).
        const targetOrder = state.categoryItemOrder[targetCat.id] ?? []
        const orderAppend: Array<{ catKey: string; itemKey: string }> = []
        const seenAppend = new Set<string>()
        for (const m of sourceMarkups) {
          const itemKey = `${name}|${m.type}`
          if (seenAppend.has(itemKey) || targetOrder.includes(itemKey)) continue
          seenAppend.add(itemKey)
          orderAppend.push({ catKey: targetCat.id, itemKey })
        }

        // Apply the projectStore (visibility) side BEFORE set() — resolve-before-set, mirroring
        // renameGroup's rate/hidden re-key. One Ctrl+Z reverts both stores (undo() calls
        // applyProjectUndo before its set()).
        ps.setHiddenBatch(hiddenRemove, hiddenAdd)

        set((s) => {
          const idSet = new Set(markupIdsAffected)
          const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
          for (const p of Object.keys(nextPageMarkups).map(Number)) {
            nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
              idSet.has(m.id) ? ({ ...m, categoryId: targetCat.id } as Markup) : m
            )
          }
          // Forward order edit mirrors the move-group REDO branch: filter the moved keys out of
          // their source arrays, then SEED the target order to completeness before appending so
          // the moved row lands at the BOTTOM (not the top of a never-reordered target). Reads
          // s.pageMarkups (moved markups still carry their SOURCE categoryId here) so the target
          // seed reflects only its pre-existing items.
          const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
          for (const rm of orderRemove) {
            const arr = nextOrder[rm.catKey]
            if (arr) nextOrder[rm.catKey] = arr.filter((k) => k !== rm.itemKey)
          }
          if (orderAppend.length > 0) {
            nextOrder[targetCat.id] = orderWithAppend(
              s.pageMarkups,
              targetCat.id,
              nextOrder[targetCat.id],
              orderAppend.map((ap) => ap.itemKey)
            )
          }
          const cmd: MarkupCommand = {
            type: 'move-group',
            markupIdsAffected,
            oldCategoryById,
            newCategoryId: targetCat.id,
            orderRemove,
            orderAppend,
            hiddenRemove,
            hiddenAdd
          }
          return {
            pageMarkups: nextPageMarkups,
            categoryItemOrder: nextOrder,
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        })
      },

      copyGroup: (name, targetCategoryName) => {
        // HG-01: an empty/whitespace target is a safe no-op — never reach getOrCreateCategory('')
        // (which would mint a permanent, unrecoverable blank-named category). Defends any caller.
        if (targetCategoryName.trim().length === 0) return
        // Resolve the target category BEFORE set() (avoid a nested set() — mirrors editMarkup).
        const targetCat = get().getOrCreateCategory(targetCategoryName)
        const allMarkups = Object.values(get().pageMarkups).flat()
        if (!allMarkups.some((m) => m.name === name)) return // defensive no-op (no group named `name`)
        // Seed the fresh blank rates in projectStore BEFORE set() (resolve-before-set, like the
        // rename re-keys). The forward action does NOT flow through redo (redoStack is cleared
        // below) so applyProjectRedo never double-adds; undo removes them via applyProjectUndo.
        const ps = useProjectStore.getState()
        // Pass the current rate keys so the auto-name skips any that already carry an orphaned
        // rate (addBlankRate would otherwise clobber it and undo would delete it — data loss).
        const payload = buildSnapshotPayload(name, targetCat.id, allMarkups, Object.keys(ps.rates), useScaleStore.getState().globalUnit)
        for (const rk of payload.rateKeys) ps.setPrice(rk.key, rk.entry)
        set((s) => snapshotForwardReducer(s, 'copy-group', payload))
      },

      duplicateGroup: (name) => {
        const allMarkups = Object.values(get().pageMarkups).flat()
        const source = allMarkups.filter((m) => m.name === name)
        if (source.length === 0) return // defensive no-op (no group named `name`)
        const ps = useProjectStore.getState()
        // D-08: same category as the source (no dialog). A group spanning categories collapses
        // onto the first source category — consistent with moveGroup's single-target collapse.
        const payload = buildSnapshotPayload(
          name,
          source[0].categoryId,
          allMarkups,
          Object.keys(ps.rates),
          useScaleStore.getState().globalUnit
        )
        for (const rk of payload.rateKeys) ps.setPrice(rk.key, rk.entry)
        set((s) => snapshotForwardReducer(s, 'duplicate-group', payload))
      },

      editMarkup: (
        markupId,
        page,
        oldName,
        oldCategoryName,
        oldColor,
        newName,
        newCategoryName,
        newColor,
        oldWallHeight?,
        newWallHeight?
      ) => {
        // Resolve category BEFORE entering set() — avoids nested set() calls
        const newCat = get().getOrCreateCategory(newCategoryName)
        set((s) => {
          const pageList = s.pageMarkups[page] ?? []
          const target = pageList.find((m) => m.id === markupId)
          if (!target) return s // defensive no-op (mirrors deleteMarkup pattern)

          const updated: Markup = {
            ...target,
            name: newName,
            categoryId: newCat.id,
            color: newColor,
            ...(newWallHeight !== undefined ? { wallHeight: newWallHeight } : {})
          }
          const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

          const cmd: MarkupCommand = {
            type: 'edit-markup',
            markupId,
            page,
            oldName,
            oldCategoryName,
            oldColor,
            newName,
            newCategoryName,
            newColor,
            ...(oldWallHeight !== undefined ? { oldWallHeight, newWallHeight } : {})
          }
          return {
            pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        })
      },

      moveVertex: (markupId, page, vertexIndex, newPoint, newArcs) =>
        set((s) => {
          const pageList = s.pageMarkups[page] ?? []
          const target = pageList.find((m) => m.id === markupId)
          if (!target) return s // defensive no-op (mirrors deleteMarkup pattern)

          // move-vertex is undefined for count markups (no points[] field). Caller
          // is responsible for not calling moveVertex on a count pin; defensively
          // bail if the discriminant is wrong rather than throwing.
          if (target.type === 'count') return s

          const oldPoint = target.points[vertexIndex]
          const updatedPoints: StagePoint[] = [
            ...target.points.slice(0, vertexIndex),
            newPoint,
            ...target.points.slice(vertexIndex + 1)
          ]
          // Phase 14 (D-08): when an arc re-solve rides along, capture the prior arc
          // map and swap to the new one in the SAME object the points swap produces.
          const arcReshape = newArcs !== undefined
          const oldArcs = arcReshape ? target.arcs : undefined
          const base: Markup = { ...target, points: updatedPoints } as Markup
          const updated: Markup = arcReshape ? withArcs(base, newArcs) : base
          const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

          const cmd: MarkupCommand = {
            type: 'move-vertex',
            markupId,
            page,
            vertexIndex,
            oldPoint,
            newPoint,
            ...(arcReshape ? { oldArcs, newArcs } : {})
          }
          return {
            pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        }),

      reshapeArc: (markupId, page, newArcs) =>
        set((s) => {
          const pageList = s.pageMarkups[page] ?? []
          const target = pageList.find((m) => m.id === markupId)
          if (!target) return s // defensive no-op (mirrors moveVertex pattern)
          // reshape-arc is undefined for count markups (no edges / no arcs field).
          if (target.type === 'count') return s

          const oldArcs = target.arcs
          // Apply the new arcs map (or remove the field entirely when clearing all arcs).
          const updated: Markup = (
            newArcs !== undefined ? { ...target, arcs: newArcs } : { ...target }
          ) as Markup
          if (newArcs === undefined && 'arcs' in updated) {
            delete (updated as { arcs?: unknown }).arcs
          }
          const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

          const cmd: MarkupCommand = {
            type: 'reshape-arc',
            markupId,
            page,
            oldArcs,
            newArcs
          }
          return {
            pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        }),

      moveMarkups: (moves) =>
        set((s) => {
          if (moves.length === 0) return s

          const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
          for (const move of moves) {
            const pageList = nextPageMarkups[move.page] ?? []
            nextPageMarkups[move.page] = pageList.map((m) => {
              if (m.id !== move.markupId) return m
              if (m.type === 'count') {
                return { ...m, point: move.newPoints[0] } as Markup
              }
              return { ...m, points: move.newPoints } as Markup
            })
          }

          const cmd: MarkupCommand = {
            type: 'move-markups',
            moves: moves.map((m) => ({
              markupId: m.markupId,
              page: m.page,
              oldPoints: m.oldPoints,
              newPoints: m.newPoints
            }))
          }
          return {
            pageMarkups: nextPageMarkups,
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: []
          }
        }),

      // Phase 13 (D-14, D-16): commit a re-opened markup as a single 'reopen-recommit' command.
      // Replaces oldMarkup with newMarkup in pageMarkups; pushes ONE command; clears redoStack.
      // Idempotent w.r.t. oldMarkup presence — the caller (commitShape via reopen-ref) may
      // call after removeForReopen has already taken the markup off the page.
      commitReopen: (oldMarkup, newMarkup) =>
        set((s) => {
          const page = oldMarkup.page
          const pageList = s.pageMarkups[page] ?? []
          const filtered = pageList.filter((m) => m.id !== oldMarkup.id)
          return {
            pageMarkups: { ...s.pageMarkups, [page]: [...filtered, newMarkup] },
            undoStack: pushCommand(s.undoStack, { type: 'reopen-recommit', oldMarkup, newMarkup }),
            redoStack: []
          }
        }),

      // Phase 13 (D-14): silently remove a markup for the re-open gesture. NOT a command —
      // the snapshot in markup-reopen-ref IS the recovery path. Distinct from deleteMarkup,
      // which DOES push a 'delete' command. Defensive no-op if the markup is not present.
      removeForReopen: (markup) =>
        set((s) => {
          const page = markup.page
          const pageList = s.pageMarkups[page] ?? []
          if (!pageList.some((m) => m.id === markup.id)) return s
          return {
            pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markup.id) }
          }
        }),

      // Phase 13 (D-14, D-16): silently re-add a markup on Esc-cancel of a re-open gesture.
      // NOT a command. Idempotent — duplicate ids are not added twice.
      restoreFromReopen: (markup) =>
        set((s) => {
          const page = markup.page
          const pageList = s.pageMarkups[page] ?? []
          if (pageList.some((m) => m.id === markup.id)) return s
          return {
            pageMarkups: { ...s.pageMarkups, [page]: [...pageList, markup] }
          }
        }),

      // Phase 13 (WR-01): re-push a place command through pushCommand so UNDO_STACK_MAX
      // is respected. Direct setState callers bypass the cap; routing through this action
      // keeps the 50-command discipline enforced uniformly.
      repushPlaceForReopenCancel: (markup) =>
        set((s) => ({ undoStack: pushCommand(s.undoStack, { type: 'place', markup }) })),

      getColorForName: (name, page) => {
        const pagesToScan = page !== undefined ? [page] : Object.keys(get().pageMarkups).map(Number)
        let latest: Markup | null = null
        for (const p of pagesToScan) {
          for (const m of get().pageMarkups[p] ?? []) {
            if (m.name === name) {
              if (!latest || m.createdAt > latest.createdAt) latest = m
            }
          }
        }
        return latest ? latest.color : null
      },

      undo: () => {
        // Phase 17-02: apply the projectStore side (rate/hidden re-key for rename;
        // blank-rate removal for copy/dup) synchronously BEFORE the markupStore set() so
        // ONE Ctrl+Z reverts BOTH stores. No-op for every single-store command. The set()
        // body below is unchanged from the pre-Phase-17-02 reducer.
        const topCmd = get().undoStack.at(-1)
        if (!topCmd) return
        applyProjectUndo(topCmd)
        set((s) => {
          if (s.undoStack.length === 0) return s
          const cmd = s.undoStack[s.undoStack.length - 1]

          if (cmd.type === 'recolor-group') {
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            const pagesToScan =
              cmd.page !== undefined ? [cmd.page] : Object.keys(s.pageMarkups).map(Number)
            for (const p of pagesToScan) {
              const list = s.pageMarkups[p] ?? []
              nextPageMarkups[p] = list.map((m) =>
                cmd.oldColors[m.id] !== undefined
                  ? ({ ...m, color: cmd.oldColors[m.id] } as Markup)
                  : m
              )
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          if (cmd.type === 'edit-markup') {
            const oldCat = get().getOrCreateCategory(cmd.oldCategoryName)
            const pageList = s.pageMarkups[cmd.page] ?? []
            const nextList = pageList.map((m) =>
              m.id === cmd.markupId
                ? ({
                    ...m,
                    name: cmd.oldName,
                    categoryId: oldCat.id,
                    color: cmd.oldColor,
                    ...(cmd.oldWallHeight !== undefined ? { wallHeight: cmd.oldWallHeight } : {})
                  } as Markup)
                : m
            )
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // move-vertex / move-markups branches MUST come BEFORE the
          // `cmd.markup.page` fallthrough below — they carry their own page info
          // and have no `cmd.markup` field.
          if (cmd.type === 'move-vertex') {
            const pageList = s.pageMarkups[cmd.page] ?? []
            // Phase 14 (D-08): if this move-vertex carried an atomic arc re-solve
            // (oldArcs/newArcs present), restore the points AND the prior arc map in
            // the SAME object — one Ctrl+Z reverts both the corner and the curve.
            const arcReshape = 'newArcs' in cmd
            const nextList = pageList.map((m) => {
              if (m.id !== cmd.markupId) return m
              if (m.type === 'count') return m // defensive: count has no points[]
              const restoredPoints: StagePoint[] = [
                ...m.points.slice(0, cmd.vertexIndex),
                cmd.oldPoint,
                ...m.points.slice(cmd.vertexIndex + 1)
              ]
              const withPoints = { ...m, points: restoredPoints } as Markup
              return arcReshape ? withArcs(withPoints, cmd.oldArcs) : withPoints
            })
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // reshape-arc branch MUST come BEFORE the `cmd.markup.page` fallthrough —
          // it carries its own page info and has no `cmd.markup` field. Undo restores
          // the FULL prior arc map (oldArcs), including removing an arc the edit added.
          if (cmd.type === 'reshape-arc') {
            const pageList = s.pageMarkups[cmd.page] ?? []
            const nextList = pageList.map((m) =>
              m.id === cmd.markupId ? withArcs(m, cmd.oldArcs) : m
            )
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          if (cmd.type === 'move-markups') {
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const move of cmd.moves) {
              const pageList = nextPageMarkups[move.page] ?? []
              nextPageMarkups[move.page] = pageList.map((m) => {
                if (m.id !== move.markupId) return m
                if (m.type === 'count') {
                  return { ...m, point: move.oldPoints[0] } as Markup
                }
                return { ...m, points: move.oldPoints } as Markup
              })
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // delete-group branch MUST come BEFORE the `cmd.markup.page` access
          // below — delete-group carries `markups` (plural), not `markup`.
          if (cmd.type === 'delete-group') {
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const m of cmd.markups) {
              nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // Phase 13 (D-14, D-16): reopen-recommit branch MUST come BEFORE the
          // `cmd.markup.page` access below — reopen-recommit carries `oldMarkup`
          // and `newMarkup`, not `markup`. Undo removes newMarkup (added on commit),
          // re-adds oldMarkup (removed at re-open trigger).
          if (cmd.type === 'reopen-recommit') {
            const page = cmd.oldMarkup.page
            const pageList = s.pageMarkups[page] ?? []
            const filtered = pageList.filter((m) => m.id !== cmd.newMarkup.id)
            return {
              pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.oldMarkup] },
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // Phase 17 (Req 2): reorder-items branch MUST come BEFORE the `cmd.markup.page`
          // access below — it carries `catKey`/`oldOrder`/`newOrder`, not `markup`. Undo
          // restores the prior per-category order.
          if (cmd.type === 'reorder-items') {
            return {
              categoryItemOrder: { ...s.categoryItemOrder, [cmd.catKey]: cmd.oldOrder },
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          // Phase 17 (Req 1/3/4/5): the whole-group command branches MUST come BEFORE the
          // `cmd.markup.page` fallthrough — none carry a `cmd.markup` field. The projectStore
          // side (rate/hidden re-key for rename; blank-rate add/remove for copy/dup) is applied
          // by applyProjectUndo(cmd) BEFORE this set() (Phase 17-02 Task 2); here we revert
          // ONLY the markupStore side (names / categoryId + categoryItemOrder).
          if (cmd.type === 'rename-group') {
            const idSet = new Set(cmd.markupIdsAffected)
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
                idSet.has(m.id) ? ({ ...m, name: cmd.oldName } as Markup) : m
              )
            }
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            for (const rk of cmd.orderReKeys) {
              const arr = nextOrder[rk.catKey]
              if (arr)
                nextOrder[rk.catKey] = arr.map((k) => (k === rk.newItemKey ? rk.oldItemKey : k))
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          if (cmd.type === 'move-group') {
            const idSet = new Set(cmd.markupIdsAffected)
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
                idSet.has(m.id)
                  ? ({ ...m, categoryId: cmd.oldCategoryById[m.id] ?? '' } as Markup)
                  : m
              )
            }
            // Reverse the forward order edit: remove the appended key from the target,
            // then re-insert into the source at the captured index (exact restore).
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            for (const ap of cmd.orderAppend) {
              const arr = nextOrder[ap.catKey]
              if (arr) nextOrder[ap.catKey] = arr.filter((k) => k !== ap.itemKey)
            }
            for (const rm of cmd.orderRemove) {
              const arr = [...(nextOrder[rm.catKey] ?? [])]
              arr.splice(rm.index, 0, rm.itemKey)
              nextOrder[rm.catKey] = arr
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
            // Undo the copy: remove the added snapshots and their appended order keys.
            const idSet = new Set(cmd.newMarkups.map((m) => m.id))
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
            }
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            for (const ap of cmd.orderAppends) {
              const arr = nextOrder[ap.catKey]
              if (arr) nextOrder[ap.catKey] = arr.filter((k) => k !== ap.itemKey)
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, cmd]
            }
          }

          const page = cmd.markup.page
          const pageList = s.pageMarkups[page] ?? []
          let nextList: Markup[]
          if (cmd.type === 'place') {
            nextList = pageList.filter((m) => m.id !== cmd.markup.id)
          } else {
            nextList = [...pageList, cmd.markup]
          }
          return {
            pageMarkups: { ...s.pageMarkups, [page]: nextList },
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [...s.redoStack, cmd]
          }
        })
      },

      redo: () => {
        // Phase 17-02: mirror of undo() — re-apply the projectStore side BEFORE the set().
        const topCmd = get().redoStack.at(-1)
        if (!topCmd) return
        applyProjectRedo(topCmd)
        set((s) => {
          if (s.redoStack.length === 0) return s
          const cmd = s.redoStack[s.redoStack.length - 1]

          if (cmd.type === 'recolor-group') {
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            const pagesToScan =
              cmd.page !== undefined ? [cmd.page] : Object.keys(s.pageMarkups).map(Number)
            for (const p of pagesToScan) {
              const list = s.pageMarkups[p] ?? []
              nextPageMarkups[p] = list.map((m) =>
                cmd.markupIdsAffected.includes(m.id) ? ({ ...m, color: cmd.newColor } as Markup) : m
              )
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          if (cmd.type === 'edit-markup') {
            const newCat = get().getOrCreateCategory(cmd.newCategoryName)
            const pageList = s.pageMarkups[cmd.page] ?? []
            const nextList = pageList.map((m) =>
              m.id === cmd.markupId
                ? ({
                    ...m,
                    name: cmd.newName,
                    categoryId: newCat.id,
                    color: cmd.newColor,
                    ...(cmd.newWallHeight !== undefined ? { wallHeight: cmd.newWallHeight } : {})
                  } as Markup)
                : m
            )
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // move-vertex / move-markups branches MUST come BEFORE the
          // `cmd.markup.page` fallthrough below — they carry their own page info
          // and have no `cmd.markup` field.
          if (cmd.type === 'move-vertex') {
            const pageList = s.pageMarkups[cmd.page] ?? []
            // Phase 14 (D-08): re-apply the new arc map alongside the points when this
            // move-vertex carried an atomic arc re-solve.
            const arcReshape = 'newArcs' in cmd
            const nextList = pageList.map((m) => {
              if (m.id !== cmd.markupId) return m
              if (m.type === 'count') return m // defensive: count has no points[]
              const reappliedPoints: StagePoint[] = [
                ...m.points.slice(0, cmd.vertexIndex),
                cmd.newPoint,
                ...m.points.slice(cmd.vertexIndex + 1)
              ]
              const withPoints = { ...m, points: reappliedPoints } as Markup
              return arcReshape ? withArcs(withPoints, cmd.newArcs) : withPoints
            })
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // reshape-arc redo re-applies the new arc map (newArcs), mirroring the
          // undo branch above. MUST precede the `cmd.markup.page` fallthrough.
          if (cmd.type === 'reshape-arc') {
            const pageList = s.pageMarkups[cmd.page] ?? []
            const nextList = pageList.map((m) =>
              m.id === cmd.markupId ? withArcs(m, cmd.newArcs) : m
            )
            return {
              pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          if (cmd.type === 'move-markups') {
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const move of cmd.moves) {
              const pageList = nextPageMarkups[move.page] ?? []
              nextPageMarkups[move.page] = pageList.map((m) => {
                if (m.id !== move.markupId) return m
                if (m.type === 'count') {
                  return { ...m, point: move.newPoints[0] } as Markup
                }
                return { ...m, points: move.newPoints } as Markup
              })
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // delete-group branch MUST come BEFORE the `cmd.markup.page` access
          // below — delete-group carries `markups` (plural), not `markup`.
          if (cmd.type === 'delete-group') {
            const idSet = new Set(cmd.markups.map((m) => m.id))
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
            }
            return {
              pageMarkups: nextPageMarkups,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // Phase 13 (D-14, D-16): reopen-recommit branch MUST come BEFORE the
          // `cmd.markup.page` access below. Redo re-applies the recommit: remove
          // oldMarkup, add newMarkup, push command back onto undoStack (with cap).
          if (cmd.type === 'reopen-recommit') {
            const page = cmd.oldMarkup.page
            const pageList = s.pageMarkups[page] ?? []
            const filtered = pageList.filter((m) => m.id !== cmd.oldMarkup.id)
            return {
              pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.newMarkup] },
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // Phase 17 (Req 2): reorder-items redo re-applies the new per-category order,
          // mirroring the undo branch above. MUST precede the `cmd.markup.page` fallthrough.
          if (cmd.type === 'reorder-items') {
            return {
              categoryItemOrder: { ...s.categoryItemOrder, [cmd.catKey]: cmd.newOrder },
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          // Phase 17 (Req 1/3/4/5): whole-group redo branches MUST precede the
          // `cmd.markup.page` fallthrough. The projectStore side is re-applied by
          // applyProjectRedo(cmd) BEFORE this set() (Phase 17-02 Task 2); here we re-apply
          // ONLY the markupStore side (names / categoryId + categoryItemOrder).
          if (cmd.type === 'rename-group') {
            const idSet = new Set(cmd.markupIdsAffected)
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
                idSet.has(m.id) ? ({ ...m, name: cmd.newName } as Markup) : m
              )
            }
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            for (const rk of cmd.orderReKeys) {
              const arr = nextOrder[rk.catKey]
              if (arr)
                nextOrder[rk.catKey] = arr.map((k) => (k === rk.oldItemKey ? rk.newItemKey : k))
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          if (cmd.type === 'move-group') {
            const idSet = new Set(cmd.markupIdsAffected)
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const p of Object.keys(nextPageMarkups).map(Number)) {
              nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
                idSet.has(m.id) ? ({ ...m, categoryId: cmd.newCategoryId ?? '' } as Markup) : m
              )
            }
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            for (const rm of cmd.orderRemove) {
              const arr = nextOrder[rm.catKey]
              if (arr) nextOrder[rm.catKey] = arr.filter((k) => k !== rm.itemKey)
            }
            // Seed the target to completeness before re-appending (same as the forward action)
            // so redo lands the moved row at the bottom, not the top of an unordered target.
            if (cmd.orderAppend.length > 0 && cmd.newCategoryId) {
              nextOrder[cmd.newCategoryId] = orderWithAppend(
                s.pageMarkups,
                cmd.newCategoryId,
                nextOrder[cmd.newCategoryId],
                cmd.orderAppend.map((ap) => ap.itemKey)
              )
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
            // Re-apply the copy: re-add the snapshots and re-append their order keys. Seed the
            // target order to completeness (same as the forward reducer) so the redone copy
            // lands at the bottom. s.pageMarkups here excludes the copies (undo removed them),
            // so their keys are appended exactly once.
            const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
            for (const m of cmd.newMarkups) {
              nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
            }
            const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
            const redoAppendsByCat = new Map<string, string[]>()
            for (const ap of cmd.orderAppends) {
              const list = redoAppendsByCat.get(ap.catKey) ?? []
              list.push(ap.itemKey)
              redoAppendsByCat.set(ap.catKey, list)
            }
            for (const [catKey, keys] of redoAppendsByCat) {
              nextOrder[catKey] = orderWithAppend(s.pageMarkups, catKey, nextOrder[catKey], keys)
            }
            return {
              pageMarkups: nextPageMarkups,
              categoryItemOrder: nextOrder,
              undoStack: pushCommand(s.undoStack, cmd),
              redoStack: s.redoStack.slice(0, -1)
            }
          }

          const page = cmd.markup.page
          const pageList = s.pageMarkups[page] ?? []
          let nextList: Markup[]
          if (cmd.type === 'place') {
            nextList = [...pageList, cmd.markup]
          } else {
            nextList = pageList.filter((m) => m.id !== cmd.markup.id)
          }
          return {
            pageMarkups: { ...s.pageMarkups, [page]: nextList },
            undoStack: pushCommand(s.undoStack, cmd),
            redoStack: s.redoStack.slice(0, -1)
          }
        })
      },

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,

      hydrate: (data) => {
        setReopenSnapshot(null)
        set({
          pageMarkups: data.pageMarkups,
          categories: data.categories,
          categoryOrder: data.categoryOrder,
          categoryItemOrder: data.categoryItemOrder ?? {},
          undoStack: [],
          redoStack: []
        })
      },

      reset: () => {
        setReopenSnapshot(null)
        set({
          pageMarkups: {},
          categories: {},
          categoryOrder: [],
          categoryItemOrder: {},
          undoStack: [],
          redoStack: []
        })
      }
    }))
  )

// See viewerStore.ts for the full rationale. Prod build strips this; Vitest falls
// through to `createMarkupStore()` (double optional-chain guards the web-transform
// stub whose `import.meta.hot.data` is undefined).
export const useMarkupStore =
  (import.meta.hot?.data?.store as ReturnType<typeof createMarkupStore> | undefined) ??
  createMarkupStore()

if (import.meta.hot) {
  if (import.meta.hot.data) import.meta.hot.data.store = useMarkupStore
  import.meta.hot.accept()
}
