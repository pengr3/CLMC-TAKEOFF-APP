---
phase: quick-260820-jru
plan: 01
subsystem: canvas-rendering
tags: [konva, z-order, hit-testing, markup, regression-lock]
status: complete
requires:
  - CanvasViewport Layer 1b (plan 03.1-05)
  - MarkupType union (types/markup.ts)
provides:
  - MARKUP_TYPE_RANK canvas stacking constant
  - Layer 1b block order locked to area -> wall -> perimeter -> linear -> count
  - src/tests/markup-canvas-z-order.test.ts regression lock
affects:
  - All markup click / hover / right-click / drag hit-testing where markups overlap
  - Visual depth of area fills relative to every other markup type
tech-stack:
  added: []
  patterns:
    - "Source-text order assertion (readFileSync + indexOf + toBeLessThan), precedent: spacebar-text-guard.test.ts"
    - "Test derives expected order FROM the constant rather than hardcoding it twice"
key-files:
  created:
    - src/tests/markup-canvas-z-order.test.ts
  modified:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - "MARKUP_TYPE_RANK lives in types/markup.ts (not lib/constants.ts) — that module already owns the MarkupType union it is keyed by, already exports markup constants, and CanvasViewport already imports from it, so no new cross-module dependency is created"
  - "Typed Record<MarkupType, number>, NOT `as const` — the explicit annotation is what makes tsc fail if a sixth markup type is added to the union without a rank"
  - "MARKUP_TYPE_RANK deliberately NOT imported into CanvasViewport.tsx — nothing there references it at runtime, so the import would be dead and trip TS6133/eslint. The invariant is documented by a JSX comment and mechanically enforced by the test"
  - "The reorder was performed by a scripted, verbatim block move rather than hand-editing, so the added-vs-removed line diff could prove ZERO removals (pure movement, no hidden prop/fill/listening edit)"
metrics:
  duration: 13min (14:20 -> 14:33, checkpoint reached)
  tasks_completed: 3 of 3 (human verification completed 2026-10-21)
  files_changed: 3
  completed: 2026-08-20
---

# Quick Task 260820-jru: Markup Canvas Z-Order Default Summary

Sank filled area markups to the back of the canvas and floated count pins to the front by
reordering five sibling JSX blocks inside Layer 1b — fixing paint depth and click priority
in a single change, because Konva hit-tests siblings in the same child order it paints them.

---

## What Was Built

### Task 1 — `MARKUP_TYPE_RANK` + Layer 1b reorder (commit `b080fa7`)

**`src/renderer/src/types/markup.ts`** — added an exported constant immediately after
`LABEL_FONT_BASE`, before `isMultiPointMarkup`:

```ts
export const MARKUP_TYPE_RANK: Record<MarkupType, number> = {
  area: 0, wall: 1, perimeter: 2, linear: 3, count: 4
}
```

Its JSDoc states the full rule: low rank = painted first = bottom; Konva paints AND
hit-tests siblings in child order so one ordering governs both depth and click priority;
`area` is lowest because `AreaMarkup` is the only filled type and a closed+filled Konva
`Line` hit-tests its entire interior; `count` is highest so pins inside an area stay
selectable; the CanvasViewport block-order INVARIANT and the test that enforces it; and
the note that a future per-markup z-order phase will consume this as the default sort key
in a `(z, typeRank, createdAt)` sort that supersedes the invariant.

**`src/renderer/src/components/CanvasViewport.tsx`** — the five committed-markup render
blocks inside `<Layer listening={true}>` now read, top-to-bottom:

| Source position | Block | Filter line (post-change) |
|-----------------|-------|---------------------------|
| 1 (painted first, bottom) | area | 2214 |
| 2 | wall | 2244 |
| 3 | perimeter | 2274 |
| 4 | linear | 2304 |
| 5 (painted last, top) | count | 2334 |

Previously: count, linear, area, perimeter, wall — which put `area` above `count`.

A four-line JSX comment now sits directly under the `<Layer listening={true}>` opening tag
stating that block order is bottom-to-top paint order and MUST match `MARKUP_TYPE_RANK`.

**Proof the move was verbatim.** The reorder was executed by a script that sliced each
block at its `{/* Committed <type> markups */}` anchor and reassembled them, so no
character inside any block could change. Verified by the sorted added-vs-removed line
diff mandated in the plan:

```
28a29,32
>               child order, so this also sets click priority. Locked by
>               in src/renderer/src/types/markup.ts — Konva paints AND hit-tests siblings in
>               src/tests/markup-canvas-z-order.test.ts. */}
>           {/* Block order below is BOTTOM-TO-TOP paint order and MUST match MARKUP_TYPE_RANK
```

Four additions (the new comment), **zero removals** — confirming no prop, cast,
`overridePoints` / `overridePoint` ternary, `getCategory` guard, `key`, fill, color,
opacity, or `listening` value was touched.

### Task 2 — regression lock (commit `2452806`)

**`src/tests/markup-canvas-z-order.test.ts`** — 5 assertions, `environment: 'node'`, no
react-konva mock, never mounts a component:

1. `MARKUP_TYPE_RANK` has exactly 5 keys and deep-equals the locked ranks.
2. `area` holds `Math.min(...ranks)` and `count` holds `Math.max(...ranks)` — asserted
   explicitly so the intent survives a future re-rank of the middle three.
3. Each `pageMarkups.filter((m) => m.type === '<type>')` token occurs **exactly once**
   (via `src.split(token).length - 1`), so a copy-pasted duplicate block cannot make
   `indexOf` silently meaningless.
4. Sorting `Object.keys(MARKUP_TYPE_RANK)` by ascending rank yields five strictly
   increasing source indices. The expected order is derived FROM the constant, not
   hardcoded a second time.
5. All five block indices sit after the `{/* Layer 1b: Committed markups` marker.

The full filter expression is used as the search token because the bare
`m.type === 'count'` substring appears in three unrelated places in the file and would
produce a false index.

**Sanity check that the test actually bites** (plan-mandated, both perturbations reverted
with `git checkout -- <file>` and re-verified green):

| Perturbation | Result |
|---|---|
| Swap `area: 0` / `count: 4` in the constant | **3 of 5 tests fail** (deep-equal, min/max, ordering) |
| Swap the area and count JSX blocks | **1 test fails** with `'wall' (rank 1) must render AFTER 'area' (rank 0) ... expected 109318 to be greater than 113202` |

The failure message names the offending pair rather than printing bare numbers.

---

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — exit 0, both `typecheck:node` and `typecheck:web` clean, zero errors |
| `npx vitest run src/tests/markup-canvas-z-order.test.ts` | **PASS** — 5/5 |
| `npx vitest run` (full suite) | **PASS — 118 files, 859/859 tests, 0 failures** |
| `git diff 4d7c23e..HEAD --name-only` | Exactly 3 paths (see below); `AreaMarkup.tsx` and all of `components/markup/` absent |
| Added-vs-removed diff on `CanvasViewport.tsx` | 4 added comment lines, **0 removed** |
| `npm run lint` — new errors | **None.** `CanvasViewport.tsx` has 19 errors both before and after, with an identical per-rule breakdown |

Changed files (all three, nothing else):
- `src/renderer/src/components/CanvasViewport.tsx`
- `src/renderer/src/types/markup.ts`
- `src/tests/markup-canvas-z-order.test.ts`

### Note on the test baseline — read this

The dispatch brief cited a baseline of **817 passing with 7 pre-existing cross-machine
localStorage env failures**. What this run actually observed is **859 passing, 0 failing,
118 files**. Reporting honestly rather than asserting a match:

- **Zero failures.** The 7 localStorage environment failures did **not** reproduce on this
  machine in this run. Nothing was done to suppress them.
- **859 > 824** (the cited 817 + 7). The suite has grown since the STATE.md entry was
  written; 5 of the delta are this task's new tests.
- No test failed, so there is no ambiguity about regressions caused here. In particular
  `highlight-overlay-listening.test.ts` is green.

### Note on the lint numbers

`npm run lint` reports 77,603 problems (317 errors, 77,286 warnings) repo-wide. This is
almost entirely a **pre-existing** prettier `Delete ␍` CRLF baseline (`core.autocrlf=true`,
no `.gitattributes`) and is untouched by this task. The meaningful check is per-file:

- `types/markup.ts` — **0 errors**
- `markup-canvas-z-order.test.ts` — **0 errors**
- `CanvasViewport.tsx` — 19 errors, byte-identical rule breakdown to the `HEAD~1` baseline
  (`explicit-function-return-type` ×4, `react-refresh/only-export-components` ×4,
  `react-hooks/refs` ×10, `no-unused-vars` ×1 for `_e` at line 1427). All sit outside the
  edited region.

Critically: **no unused-import error**, confirming `MARKUP_TYPE_RANK` was correctly NOT
imported into `CanvasViewport.tsx`.

CRLF line endings were preserved in both modified files (verified: 0 LF-only lines).

---

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed, and no
Rule 4 architectural question arose.

One implementation choice worth noting (within the plan's latitude, not a deviation): the
plan said to move the blocks using the `{/* Committed <type> markups */}` comments as
anchors. That was done via a script rather than by hand, specifically so the plan's
zero-removals diff gate could be satisfied by construction rather than by careful typing.

## Authentication Gates

None.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were
introduced.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change was
introduced. Per the plan's threat register: T-JRU-01 and T-JRU-02 are both **mitigated**
(the regression test locks block order; the zero-removals diff proves pure movement).
T-JRU-04 remains **accepted and unchanged** — `BaseMarkup` gained no `z` field,
`formatVersion` stays at 2, and no serialized field was touched, so `.clmc` files stay
byte-compatible in both directions. T-JRU-SC: zero packages installed, no `package.json`
or lockfile change.

---

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `b080fa7` | fix | Add `MARKUP_TYPE_RANK`; reorder Layer 1b to area → wall → perimeter → linear → count |
| `2452806` | test | Lock Layer 1b block order to `MARKUP_TYPE_RANK` (5 assertions) |

---

## Task 3 — Human verification completed 2026-10-21

**All six interactive checks passed, confirmed individually by the user.** Pin selection,
area selection away from pins, visible drawing depth, the pin's context menu, pin hover
feedback, and dragging the pin without moving the surrounding area were all verified in
the running app. Results are recorded in `260820-jru-UAT.md`.

The latest automated run during the walkthrough passed 877 tests in 121 files, and
TypeScript checks passed.

### Primary regression — confirmed

**Click a count pin that sits inside an area markup. The PIN must be selected, not the area.**

### Full verification steps — completed

1. Open a project (or load a PDF and calibrate a page).
2. Draw an **area** markup — a reasonably large polygon.
3. Place a **count** pin **inside** that area's filled interior.
4. Switch to the select tool and click directly on the count pin.
   **Expected:** the PIN is selected (selection halo on the pin). Before this fix the AREA
   was selected instead — this is the specific bug reproduced in the running app.
5. Click inside the area but **away from** any pin.
   **Expected:** the AREA is still selected normally — area selection is not broken.
6. Confirm depth visually: the area's translucent fill should render BEHIND the pin, the
   pin number, and any linear / wall / perimeter markup crossing the area. Nothing should
   be visually obscured by the area fill.
7. Right-click the count pin inside the area.
   **Expected:** the PIN's context menu opens, not the area's.
8. Hover the count pin inside the area.
   **Expected:** the PIN's hover tooltip and hover ring appear, not the area's.
9. Drag the count pin inside the area by its body.
   **Expected:** the PIN moves. The area does not.

**Checkpoint resolved:** user confirmed every check with "yes" during the walkthrough.

---

## Follow-ups / Not Done Here

- **Per-markup z-order control** is explicitly out of scope and not available. Depth is
  decided entirely by markup type. There is no Bring-to-Front / Send-to-Back command, and
  depth is not persisted. Documented for the manual in
  `260820-jru-MANUAL-NOTES.md`.
- **Same-type overlap** (e.g. two areas) has no user-selectable ordering.
- The upcoming z-order phase should replace the five blocks with one sorted render pass
  keyed on `(z, typeRank, createdAt)`, at which point the block-order invariant — and the
  ordering assertion in `markup-canvas-z-order.test.ts` — is superseded by the sort.

---

## Self-Check: PASSED

Files verified present on disk:
- `src/renderer/src/types/markup.ts` — FOUND (`MARKUP_TYPE_RANK` exported at line 288)
- `src/renderer/src/components/CanvasViewport.tsx` — FOUND (blocks at 2214/2244/2274/2304/2334)
- `src/tests/markup-canvas-z-order.test.ts` — FOUND
- `.planning/quick/260820-jru-fix-markup-canvas-z-order-default-so-are/260820-jru-MANUAL-NOTES.md` — FOUND

Commits verified in `git log`:
- `b080fa7` — FOUND
- `2452806` — FOUND

Working tree clean apart from the uncommitted docs artifacts (SUMMARY.md, MANUAL-NOTES.md),
which the orchestrator commits.
