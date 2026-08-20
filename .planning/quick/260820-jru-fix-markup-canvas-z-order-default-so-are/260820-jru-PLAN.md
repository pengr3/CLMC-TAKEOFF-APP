---
phase: quick-260820-jru
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/src/types/markup.ts
  - src/renderer/src/components/CanvasViewport.tsx
  - src/tests/markup-canvas-z-order.test.ts
autonomous: false
requirements: [QUICK-260820-JRU-01]

must_haves:
  truths:
    - "Clicking a count pin that sits inside an area markup selects the PIN, not the area"
    - "Area fills paint underneath every other markup type on the canvas"
    - "No markup props, fill values, colors, opacity, or listening flags changed"
    - "The canvas stacking rule is documented in one exported, importable constant"
    - "A test fails if the CanvasViewport JSX block order drifts from that constant"
  artifacts:
    - path: "src/renderer/src/types/markup.ts"
      provides: "Exported MARKUP_TYPE_RANK: Record<MarkupType, number> + invariant doc comment"
      contains: "MARKUP_TYPE_RANK"
    - path: "src/renderer/src/components/CanvasViewport.tsx"
      provides: "Layer 1b render blocks ordered area -> wall -> perimeter -> linear -> count"
      contains: "MARKUP_TYPE_RANK"
    - path: "src/tests/markup-canvas-z-order.test.ts"
      provides: "Regression test locking source block order to MARKUP_TYPE_RANK"
      contains: "MARKUP_TYPE_RANK"
  key_links:
    - from: "src/tests/markup-canvas-z-order.test.ts"
      to: "src/renderer/src/types/markup.ts"
      via: "import { MARKUP_TYPE_RANK } from '@renderer/types/markup'"
      pattern: "MARKUP_TYPE_RANK.*@renderer/types/markup"
    - from: "src/tests/markup-canvas-z-order.test.ts"
      to: "src/renderer/src/components/CanvasViewport.tsx"
      via: "readFileSync + indexOf of the five pageMarkups.filter tokens"
      pattern: "pageMarkups\\.filter"
---

<objective>
Fix the markup canvas z-order default so filled area markups sink below every other
markup type, and count pins float to the front.

Purpose: `AreaMarkup` is the only markup type with a filled body (a closed Konva `Line`
with `fill`), and a closed+filled Konva Line hit-tests its ENTIRE interior. Because the
`area` render block currently sits AFTER the `count` block inside the same `<Layer>`,
Konva both paints and hit-tests areas above pins. Confirmed live by the user: clicking a
count pin inside an area selects the AREA. Reordering the sibling JSX blocks fixes paint
order and hit order at once, because Konva hit-tests siblings in child order.

Output: One reordered `<Layer listening={true}>` in `CanvasViewport.tsx`, one exported
`MARKUP_TYPE_RANK` constant documenting the rule, and one regression test that fails if
the JSX block order ever drifts from that constant.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

@src/renderer/src/types/markup.ts
@src/renderer/src/components/CanvasViewport.tsx
@src/renderer/src/components/markup/AreaMarkup.tsx
@src/tests/spacebar-text-guard.test.ts
</context>

<investigation_findings>
Already investigated and CONFIRMED. Do NOT re-investigate. Plan against these facts:

1. The five markup-type render blocks are sibling JSX expressions inside ONE
   `<Layer listening={true}>` opened at `CanvasViewport.tsx:2208` and closed at `:2355`.
   Current order, each preceded by its own `{/* Committed <type> markups */}` comment:

   | Block  | Comment line | Filter line | Block span (inclusive of comment) |
   |--------|--------------|-------------|-----------------------------------|
   | count      | 2209 | 2210 | 2209-2234 |
   | linear     | 2236 | 2237 | 2236-2264 |
   | area       | 2266 | 2267 | 2266-2294 |
   | perimeter  | 2296 | 2297 | 2296-2324 |
   | wall       | 2326 | 2327 | 2326-2354 |

2. Konva paints sibling nodes in child order (later = on top) AND hit-tests in that same
   order. So `area` currently paints and hit-tests above `count`.

3. `AreaMarkup.tsx:106-113` is the ONLY filled markup body: a `<Line>` with `points`,
   `closed`, `stroke`, and a `fill` of the markup color plus a `33` alpha suffix, with NO
   `listening={false}`, inside a `<Group>` carrying onClick / onMouseDown / onMouseEnter /
   onContextMenu. Perimeter is an explicitly UNFILLED closed outline; linear and wall are
   stroke-only; their only `fill=` usages are label chips already `listening={false}`.

4. `BaseMarkup` has NO z/order field. Phase 17's `reorderItems` / `categoryItemOrder`
   reorders totals-panel list rows, NOT canvas depth. Both are out of scope here.

5. Token uniqueness (verified by grep) — these are the anchors the test must use:
   - `m.type === 'count'` alone is NOT unique (also at lines 701, 1892, 2427).
   - `pageMarkups.filter((m) => m.type === '<type>')` IS unique, exactly one occurrence
     per type, all five inside Layer 1b.

6. Test-suite facts: `vitest.config.ts` sets `environment: 'node'`, `globals: true`,
   `include: ['src/tests/**/*.test.ts']`, alias `@renderer -> src/renderer/src`.
   There is NO `npm test` script — the suite runs via `npx vitest run`.
   `src/tests/spacebar-text-guard.test.ts:53-67` is the in-repo precedent for a
   source-text order assertion (`readFileSync` + `indexOf` + `toBeLessThan`).

7. NO existing test asserts markup stacking or hit order. Grep of `src/tests/` for
   `CanvasViewport`, `AreaMarkup`, `CountPinMarkup`, `handleMarkupClick`, and
   `markupBodyDownRef` found zero stacking/hit-order assertions. The nearest neighbour,
   `highlight-overlay-listening.test.ts`, asserts overlay `listening` flags only and is
   unaffected by this change.
</investigation_findings>

<out_of_scope>
STRICTLY DO NOT do any of these. Any of them turns this from a behaviour-preserving
reorder into a risky change:

- Do NOT change any props passed to the markup child components.
- Do NOT change any fill values, colors, opacity, or `listening` flags.
- Do NOT add a `z` field to `BaseMarkup`, and do NOT touch persistence or `formatVersion`.
- Do NOT collapse the five blocks into a single sorted render pass (that is the NEXT phase).
- Do NOT touch `markupStore` `reorderItems` / `categoryItemOrder`.
- Do NOT modify unrelated layers (preview, vertex handles, snap indicator, rubber band,
  highlight overlays).
- Do NOT edit `AreaMarkup.tsx` or any other file in `src/renderer/src/components/markup/`.
- Do NOT modify `vitest.config.ts` or `package.json`.
</out_of_scope>

<tasks>

<task type="auto">
  <name>Task 1: Add MARKUP_TYPE_RANK and reorder the Layer 1b render blocks</name>
  <files>src/renderer/src/types/markup.ts, src/renderer/src/components/CanvasViewport.tsx</files>
  <action>
Two edits, one behaviour change.

EDIT A — `src/renderer/src/types/markup.ts`

Add an exported constant to the module-constants block that currently holds
`CATEGORY_PALETTE` / `UNDO_STACK_MAX` / `LABEL_FONT_FLOOR` / `LABEL_FONT_BASE`
(around lines 248-261). Place it immediately after `LABEL_FONT_BASE` and before the
`isMultiPointMarkup` helper, following this file's existing convention of grouping
constants after the type and command definitions.

This file is the correct home rather than `lib/constants.ts`: it already owns the
`MarkupType` union the record is keyed by, already exports markup constants and the
`isMultiPointMarkup` type guard, `CanvasViewport.tsx` already imports from it
(lines 55-56), and a future z-order sort helper will import `MarkupType` from here
anyway — so no new cross-module dependency is created.

Name it `MARKUP_TYPE_RANK`, typed `Record<MarkupType, number>`, with the values
`area: 0`, `wall: 1`, `perimeter: 2`, `linear: 3`, `count: 4`. Do NOT use `as const` —
the explicit `Record<MarkupType, number>` annotation is what makes TypeScript fail
compilation if a sixth markup type is ever added to the union without a rank.

Give it a JSDoc comment that states all of the following:
  - Low rank = painted first = bottom of the stack.
  - Konva paints AND hit-tests sibling nodes in child order, so this one ordering
    governs both visual depth and click priority.
  - `area` is lowest because `AreaMarkup` is the only filled type, and a closed+filled
    Konva `Line` hit-tests its entire interior — anything ranked above it stays clickable
    when it overlaps an area.
  - `count` is highest so pins placed inside an area remain selectable.
  - INVARIANT: the order of the five markup render blocks inside the
    `<Layer listening={true}>` (Layer 1b) in `CanvasViewport.tsx` MUST match this rank
    ascending. `src/tests/markup-canvas-z-order.test.ts` enforces it.
  - An upcoming per-markup z-order phase will use this as the default sort key in a
    `(z, typeRank, createdAt)` sort; that phase replaces the five blocks with one
    sorted render pass, at which point the invariant above is superseded by the sort.

Keep the comment plain prose — no nested block-comment terminators.

EDIT B — `src/renderer/src/components/CanvasViewport.tsx`

Reorder the five sibling render blocks inside the `<Layer listening={true}>` that opens
at line 2208 (preceded by the `{/* Layer 1b: Committed markups ... */}` comment on 2207)
and closes at line 2355.

New top-to-bottom source order — which is bottom-to-top paint order:

    area -> wall -> perimeter -> linear -> count

Move each block VERBATIM, including its leading `{/* Committed <type> markups */}`
comment line and its trailing blank-line separator. Not one character inside any moved
block may change: same props, same casts, same `overridePoints` / `overridePoint`
ternaries, same `getCategory` guard, same `key={m.id}`.

Use the `{/* Committed <type> markups */}` comments as anchors, NOT line numbers — line
numbers shift as soon as the first block moves.

Then add ONE short comment directly beneath the `<Layer listening={true}>` opening tag,
above the (now first) area block, stating that block order is bottom-to-top and MUST
match `MARKUP_TYPE_RANK` in `src/renderer/src/types/markup.ts`.

Do NOT add an `import { MARKUP_TYPE_RANK }` to `CanvasViewport.tsx`. Nothing in this file
references the value at runtime, so the import would be unused and fail
`npm run typecheck` (TS6133) / eslint. The invariant is documented by the comment and
mechanically enforced by the test in Task 2.
  </action>
  <verify>
    <automated>npm run typecheck</automated>
    <automated>git diff -U0 -- src/renderer/src/components/CanvasViewport.tsx > /tmp/cv.diff; grep '^+' /tmp/cv.diff | grep -v '^+++' | sed 's/^+//' | sort > /tmp/cv.added; grep '^-' /tmp/cv.diff | grep -v '^---' | sed 's/^-//' | sort > /tmp/cv.removed; diff /tmp/cv.removed /tmp/cv.added</automated>
    <automated>git diff --name-only | sort | tr '\n' ' '</automated>
  </verify>
  <done>
- `npm run typecheck` exits 0.
- The added-vs-removed line diff shows ONLY additions (the new Layer 1b comment lines)
  and ZERO removals — proving the change is pure block movement with no prop, fill,
  color, opacity, or `listening` edits inside the moved blocks.
- `git diff --name-only` lists exactly `src/renderer/src/components/CanvasViewport.tsx`
  and `src/renderer/src/types/markup.ts`. `AreaMarkup.tsx` MUST NOT appear.
- In `CanvasViewport.tsx`, the source position of
  `pageMarkups.filter((m) => m.type === 'area')` is before `'wall'`, before
  `'perimeter'`, before `'linear'`, before `'count'`.
- `MARKUP_TYPE_RANK` is exported from `types/markup.ts` with the five documented ranks.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression test locking JSX block order to MARKUP_TYPE_RANK</name>
  <files>src/tests/markup-canvas-z-order.test.ts</files>
  <behavior>
    - Test 1: `MARKUP_TYPE_RANK` has exactly 5 keys and deep-equals
      `{ area: 0, wall: 1, perimeter: 2, linear: 3, count: 4 }`.
    - Test 2: for every markup type, the token
      `pageMarkups.filter((m) => m.type === '<type>')` occurs EXACTLY ONCE in
      `CanvasViewport.tsx` (guards against a copy-pasted duplicate block making
      `indexOf` meaningless).
    - Test 3: sorting the five types by ascending `MARKUP_TYPE_RANK` yields five strictly
      increasing source indices — i.e. the JSX block order matches the rank. This is the
      assertion that fails if someone reorders the blocks without updating the constant,
      or updates the constant without reordering the blocks.
    - Test 4: all five block indices sit AFTER the `{/* Layer 1b: Committed markups`
      opening marker, confirming they are the Layer 1b blocks and not some other
      occurrence elsewhere in the file.
    - Edge case: `area` (the only filled type, whose closed Line hit-tests its whole
      interior) has the LOWEST rank, and `count` has the HIGHEST — asserted explicitly so
      the intent survives even if the middle three are ever re-ranked.
  </behavior>
  <action>
Create `src/tests/markup-canvas-z-order.test.ts`.

Mirror the source-text assertion pattern already proven in this repo at
`src/tests/spacebar-text-guard.test.ts:53-67`: dynamic `await import('node:fs')` and
`await import('node:path')`, then read
`path.resolve(process.cwd(), 'src/renderer/src/components/CanvasViewport.tsx')` with
`fs.readFileSync(..., 'utf8')`.

Import the constant through the configured alias:
`import { MARKUP_TYPE_RANK } from '@renderer/types/markup'`, plus
`import type { MarkupType } from '@renderer/types/markup'` if needed for the sort typing.

Do NOT add a `@vitest-environment jsdom` header — `vitest.config.ts` already defaults to
`environment: 'node'`, which is all this test needs. Do NOT mock `react-konva`; this test
reads source text and never mounts a component, so it stays immune to Konva mock drift.

Build the per-type search token as the full filter expression
`pageMarkups.filter((m) => m.type === '<type>')` with the type interpolated — the ONLY
form that is unique per type. The bare `m.type === 'count'` substring appears three other
places in the file (lines 701, 1892, 2427) and would silently produce a false index.

For the occurrence count, use `src.split(token).length - 1` and assert it equals 1. Do
not shell out to `grep -c`.

For the ordering assertion, derive the expected sequence from the constant itself rather
than hardcoding it a second time: take `Object.keys(MARKUP_TYPE_RANK)`, sort ascending by
rank, map each to its `src.indexOf(token)`, then assert each index is strictly greater
than the previous. Include the type names in the failure message so a regression names
the offending pair rather than printing bare numbers.

Add a file-header comment explaining WHY this test exists: Konva hit-tests siblings in
child order, so this ordering is load-bearing for click behaviour, not merely cosmetic —
a future reader must not "clean up" the block order.
  </action>
  <verify>
    <automated>npx vitest run src/tests/markup-canvas-z-order.test.ts</automated>
    <automated>npx vitest run 2>&1 | tail -20</automated>
    <automated>npm run typecheck</automated>
  </verify>
  <done>
- `npx vitest run src/tests/markup-canvas-z-order.test.ts` passes with 4+ assertions.
- The FULL suite `npx vitest run` passes at or above its prior baseline. Per STATE.md the
  known-good baseline is 817 passing with 7 pre-existing cross-machine localStorage
  environment failures; those 7 are non-blocking and pre-date this change. Any NEW
  failure is a blocker — in particular `highlight-overlay-listening.test.ts` must stay
  green.
- `npm run typecheck` exits 0.
- Sanity check the test actually bites: temporarily swap two blocks (or edit one rank),
  confirm the test FAILS, then revert. Do not commit the temporary edit.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verify — count pin inside an area is now clickable</name>
  <files>none (verification only)</files>
  <action>
Pause. Present the what-built summary and the numbered verification steps below to the
user, then wait for the resume signal. Do not proceed or self-approve — `auto_advance` is
false, and this checkpoint confirms the exact bug the user reproduced in the running app.
  </action>
  <what-built>
Reordered the five committed-markup render blocks inside Layer 1b of `CanvasViewport.tsx`
to `area -> wall -> perimeter -> linear -> count`, so filled area bodies sink to the back
of the canvas and count pins float to the front. Because Konva hit-tests siblings in the
same child order it paints them, this corrects click priority as well as visual depth.
Added `MARKUP_TYPE_RANK` to `types/markup.ts` documenting the rule, plus a regression test
that fails if the block order ever drifts from the constant.

Zero props, fills, colors, opacity values, or `listening` flags were changed. The diff on
`CanvasViewport.tsx` is pure block movement plus one new comment.
  </what-built>
  <how-to-verify>
1. Run `npm run dev` and open a project (or load a PDF and calibrate a page).
2. Draw an AREA markup — a reasonably large polygon.
3. Place a COUNT pin INSIDE that area's filled interior.
4. Switch to the select tool and click directly on the count pin.
   EXPECTED: the PIN is selected (selection halo on the pin). Before this fix the AREA
   was selected instead. This is the specific bug you confirmed in the running app.
5. Click inside the area but AWAY from any pin.
   EXPECTED: the AREA is still selected normally — area selection is not broken.
6. Confirm depth visually: the area's translucent fill should render BEHIND the pin, the
   pin number, and any linear / wall / perimeter markup crossing the area. Nothing should
   be visually obscured by the area fill.
7. Right-click the count pin inside the area.
   EXPECTED: the PIN's context menu opens, not the area's.
8. Hover the count pin inside the area.
   EXPECTED: the PIN's hover tooltip and hover ring appear, not the area's.
9. Drag the count pin inside the area by its body.
   EXPECTED: the PIN moves. The area does not.
  </how-to-verify>
  <verify>
    <human-check>Count pin inside an area selects the PIN on click; area still selects when clicking empty interior</human-check>
  </verify>
  <done>User replies "approved", or reports which markup still wins the click.</done>
  <resume-signal>Type "approved" or describe what still selects the wrong markup</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user pointer -> Konva hit graph | The only boundary this change touches. Reordering siblings changes which node wins a hit test. No data crosses a process or network boundary; no input is parsed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-JRU-01 | Tampering | CanvasViewport Layer 1b child order | mitigate | Reorder is the intended fix, but silent future drift would reintroduce the bug. `src/tests/markup-canvas-z-order.test.ts` (Task 2) locks block order to `MARKUP_TYPE_RANK` and fails CI on drift. |
| T-JRU-02 | Tampering | Moved JSX blocks | mitigate | An accidental prop/fill/`listening` edit hidden inside a large block move would change behaviour invisibly. Task 1 verify runs a sorted added-vs-removed line diff that must show ZERO removals, proving pure movement. |
| T-JRU-03 | Denial of Service | Konva render/hit path | accept | Node count, listening flags, and per-node work are all unchanged — only sibling order differs. No measurable perf delta on dense pages. |
| T-JRU-04 | Information Disclosure | `.clmc` persistence | accept | No serialized field is added or touched. `BaseMarkup` gains no `z` field and `formatVersion` stays at 2, so old and new project files stay byte-compatible in both directions. |
| T-JRU-SC | Tampering | npm installs | accept | This plan installs ZERO packages. No `package.json` or lockfile change is in scope, so the package-legitimacy gate does not apply. |
</threat_model>

<verification>
Run after both auto tasks, before the human-verify checkpoint:

1. `npm run typecheck` exits 0.
2. `npx vitest run` — full suite at or above the STATE.md baseline (817 pass / 7
   pre-existing localStorage env failures). No NEW failures.
3. `npx vitest run src/tests/markup-canvas-z-order.test.ts` passes.
4. `git diff --name-only` lists EXACTLY three paths:
   `src/renderer/src/components/CanvasViewport.tsx`,
   `src/renderer/src/types/markup.ts`,
   `src/tests/markup-canvas-z-order.test.ts`.
   `AreaMarkup.tsx` and every other file under `components/markup/` MUST be absent.
5. Sorted added-vs-removed diff on `CanvasViewport.tsx` shows only added comment lines
   and zero removed lines.
6. `npm run lint` reports no new errors (specifically: no unused-import error, confirming
   `MARKUP_TYPE_RANK` was correctly NOT imported into `CanvasViewport.tsx`).
</verification>

<success_criteria>
- Layer 1b render blocks appear in source order area, wall, perimeter, linear, count.
- `MARKUP_TYPE_RANK: Record<MarkupType, number>` exported from
  `src/renderer/src/types/markup.ts` with values `area:0 wall:1 perimeter:2 linear:3 count:4`
  and a comment covering the Konva paint+hit-order rule, the CanvasViewport block-order
  invariant, and the future `(z, typeRank, createdAt)` sort.
- `src/tests/markup-canvas-z-order.test.ts` exists, passes, and demonstrably fails when
  the block order or a rank value is perturbed.
- `npm run typecheck` clean; full vitest suite at or above baseline.
- Diff is pure block movement plus the new constant, the new comments, and the new test —
  no prop, fill, color, opacity, or `listening` change anywhere.
- Human confirms in the running app: a count pin inside an area now selects the PIN.
</success_criteria>

<output>
Create `.planning/quick/260820-jru-fix-markup-canvas-z-order-default-so-are/260820-jru-SUMMARY.md` when done.

Also append a manual-notes entry (per the project's How-To-Manual convention) recording
that markup canvas depth is fixed by type — area at the back, count pins at the front —
and that per-markup z-order control is not yet available.
</output>
