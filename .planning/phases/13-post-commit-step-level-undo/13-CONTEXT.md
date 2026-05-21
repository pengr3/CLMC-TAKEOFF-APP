# Phase 13: Post-Commit Step-Level Undo — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** Lifted from `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` (Phase C — decisions D-10, D-11, D-12) plus user's exact stated intent.

<domain>
## Phase Boundary

This phase extends the step-level undo contract established in **Phase 10 (Granular Undo Foundation)** from in-progress drawing to committed multi-point markups. After this phase, the first Ctrl+Z immediately following the commit of a multi-point markup (linear, area, perimeter, wall) **re-opens** that markup in `mode: 'drawing'` with all its existing vertices loaded as the in-progress point stack — undoing just the commit, not the shape.

Once re-opened, the user is back in the Phase 10 world: further Ctrl+Z pops the last point, Ctrl+Y re-adds it, Enter / dbl-click commits the (possibly modified) shape, and Esc cancels and restores the original. The whole gesture (commit → re-open → optional point edits → re-commit) must be undoable end-to-end via the existing command pattern so the user can step back across it without state corruption.

**Out of scope:**
- Count pins (single-point — re-open semantics don't apply; Ctrl+Z on a committed count pin keeps existing whole-markup undo behaviour from Phase 3).
- Edit popup (name/category/color) — already in place from Phase 7 (`EditMarkupCommand`); not touched here.
- Vertex-handle dragging on a *non-re-opened* selected shape — that's Phase 12's domain and is unchanged.
- Group-undo of multiple committed markups — undoing a multi-select delete restores the group as one command (Phase 9 contract, unchanged). Re-open applies only when the most recent undo target is a single committed multi-point markup.

</domain>

<decisions>
## Implementation Decisions

### Behavioural contract (locked from v1.1-CONTEXT.md Phase C)

- **D-10 — First-Ctrl+Z-after-commit = re-open, not delete.**
  Ctrl+Z on a **committed** multi-point markup (linear, area, perimeter, wall) **re-opens it in drawing mode with all points intact** — undoing just the commit, not removing the shape. The estimator can then add points, pop points with further Ctrl+Z, or re-commit with Enter. First Ctrl+Z after commit = "re-open"; subsequent Ctrl+Z = pop last point (Phase 10 behaviour).

- **D-11 — Brief `ConfirmationToast` on re-open.**
  When the markup re-opens, show a brief toast: *"Shape re-opened — continue drawing or press Enter to commit."* Uses the existing `ConfirmationToast` component (parent-owns-lifecycle pattern — no internal setTimeout). Ensures first-time users understand the state change without blocking experienced users.

- **D-12 — Applies to all five (current) multi-point tools.**
  Post-commit undo re-open applies to: linear, area, perimeter, wall, **and any future multi-point tool**. Count pins are excluded (single-point — first Ctrl+Z on a committed count pin keeps whole-markup undo as today).

### Re-open mechanics — supporting decisions

- **D-13 — Re-open hands off to `useMarkupTool`'s drawing state machine.**
  Re-open does NOT introduce a new state machine. It pushes the original markup's points into `MarkupDrawState.points` and transitions to `mode: 'drawing'` with the originating tool active (`activeTool` set to the markup's source tool), inheriting name/category/color so re-commit produces a markup with the same identity.

- **D-14 — Original markup is removed from the committed layer on re-open, restored on cancel.**
  The committed markup is removed from `markupStore` when re-opened (so the user can re-draw without a visual duplicate). Esc must restore the original markup **exactly** (same id, position, name, category, color, plus its place in the undo/redo stack — see D-16).

- **D-15 — Re-commit creates a new committed markup with the original markup's identity.**
  Enter / dbl-click while re-opened produces a `commitShape` that reuses the original markup's **name and category** (so BOQ grouping is preserved) and **color** (so the user's chosen palette swatch is preserved). The new markup gets a fresh `id` (commands keep their referential integrity); the BOQ aggregator groups by name so identity-by-name is what matters for totals.

- **D-16 — One undoable command for the full gesture.**
  The whole gesture is a single command on the undo stack — `ReopenAndRecommitCommand` (or equivalent name; planner's choice). Its `do()` removes the original committed markup; its `undo()` restores it exactly. The intermediate drawing state (point edits, pops, repushes) is *transient* (lives in `useMarkupTool`) and does NOT push individual commands during re-open. Only the final Enter (re-commit) or the Esc (cancel) resolves the command:
    - **Re-commit (Enter):** the command's `do()` represents "remove original + add new (modified) shape"; `undo()` reverses that pair.
    - **Cancel (Esc):** the gesture is aborted; nothing is pushed to the undo stack at all. The original markup is restored from a transient ref that was held during re-open.
  This is the central correctness contract — getting it wrong creates an undo stack that doesn't round-trip.

- **D-26 — Page navigation during an active re-open is an implicit Esc.**
  If the user navigates to another page (`currentPage` change in `viewerStore`) while a re-open gesture is active, treat it exactly as if the user pressed Esc: restore the original markup, re-push its `place` command back onto `undoStack`, clear the re-open snapshot, dismiss the toast, and `cancel()` the in-progress draw. Reasoning: the re-opened in-progress shape lives on the source page; visiting another page must not leave a dangling gesture or leak state across pages. (Resolves RESEARCH.md Open Question 1.)

### Trigger conditions — when does Ctrl+Z mean "re-open" vs "normal undo"?

- **D-17 — Re-open fires when ALL of the following are true at Ctrl+Z time:**
  1. There is no active in-progress drawing (`useMarkupTool.state.mode === 'idle'`) — so Phase 10's `popLastPoint` handler returns `false` and Ctrl+Z falls through to the store layer.
  2. The most recent undo-stack entry is a `commit` of a multi-point markup (linear / area / perimeter / wall) — peek at `markupStore.undoStack[top]` and discriminate by command type and markup type.
  3. The committed markup whose commit is at the top of the stack still exists in `markupStore.markups` (i.e. hasn't been subsequently deleted, edited, or otherwise mutated since commit).
  4. No vertex-edit mode is active (`viewerStore.vertexEditMarkupId === null`) — Phase 12's vertex-edit is its own undoable gesture and must not be combined with re-open in the same Ctrl+Z.
  5. The committed markup at the top of the stack is on the current page (`top.markup.page === currentPage`). Prevents cross-page re-open bugs (RESEARCH.md Pitfall 7 / Assumption A4).

  Any other Ctrl+Z (top of stack is delete, edit, move, recolor, group-delete, or anything but a fresh multi-point commit) follows the **existing Phase 10 + Phase 3 path** — whole-markup undo via `markupStore.undo()`.

### Toast — D-11 specifics

- **D-18 — Toast text:** *"Shape re-opened — continue drawing or press Enter to commit"* (exact wording is the planner's discretion within ±5 words; the message must mention Enter as the commit gesture, since the user could otherwise believe a click commits).
- **D-19 — Toast lifetime:** mirrors the existing `ConfirmationToast` parent-owned-lifecycle convention — parent (CanvasViewport or App) holds the `setTimeout` ref and auto-dismisses after ~2.5 s, OR on next user interaction (point placed, Ctrl+Z, Esc, Enter). Whichever comes first.
- **D-20 — Toast positioning:** reuse the existing toast slot used by Phase 4.1 "Saving…" / Phase 5 export / Phase 7.1 arm-from-totals confirmations (top-center, above the canvas header bar). No new positioning code.

### Keyboard / dispatch — extension of existing flow

- **D-21 — Reuse `useKeyboardShortcuts` Ctrl+Z dispatch tree.**
  The `getMarkupUndoHandler()` ref returns `false` when no in-progress drawing is active (Phase 10). The Ctrl+Z handler then falls through to `markupStore.undo()`. The re-open branch slots in **between** those two — after `getMarkupUndoHandler()` returns `false`, but **before** calling `markupStore.undo()`. If the top-of-stack peek matches D-17, re-open instead of undoing; otherwise undo as today.

- **D-22 — `isTextInputActive()` guard still applies.**
  The existing input-focus guard on Ctrl+Z (Phase 3 / 10) is unchanged. Re-open never fires while a text input has focus.

- **D-23 — No new keyboard binding.**
  This phase introduces no new key combo. The whole feature is "Ctrl+Z does something smarter when its top-of-stack target is a fresh multi-point commit." Commit (Enter / dbl-click) and Cancel (Esc) reuse Phase 9's commit/cancel handlers; they automatically work because re-open hands off to `useMarkupTool` in `mode: 'drawing'`.

### Selection + visibility during re-open

- **D-24 — Re-open clears selection and vertex-edit state.**
  When re-open fires, `selectedMarkupIds` is cleared and `vertexEditMarkupId` is set to `null` so the user sees a clean canvas with the re-opened in-progress shape and no leftover halos / handles. Restoring the original on Esc restores the original markup but does NOT restore selection — the user is back in `idle` mode.

- **D-25 — Visibility (`hiddenItemNames`) and color are unchanged by re-open.**
  If the markup's name is currently hidden, the re-opened in-progress shape is also hidden (skip-render branch in the renderers is unchanged). The user can toggle visibility from the totals panel as today.

### Claude's Discretion

- **Naming of the new command class** (e.g. `ReopenMarkupCommand` vs `RecommitMarkupCommand` vs splitting into `RemoveOnReopenCommand` + `AddOnRecommitCommand`) — pick whichever mirrors existing `EditMarkupCommand` / `MoveMarkupCommand` naming convention.
- **Where the transient "original markup" snapshot lives** during re-open — `useMarkupTool` state, a module-level ref (`markup-reopen-ref.ts`), or a CanvasViewport-scoped useRef. Pick whichever mirrors Phase 10's `markup-undo-ref.ts` pattern most closely.
- **Test split** between unit tests for the store command and integration tests for the CanvasViewport / keyboard dispatch wiring — follow Phase 10's `markup-tool-point-redo.test.ts` style.
- **Whether the re-opened shape uses Layer 1a (non-listening) for its preview** during drawing, or a transient Layer 2 — match the existing in-progress preview path used by Phase 3 / 10 for linear/area/perimeter, and the Phase 8 path for wall.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher + planner + executor) MUST read these before producing artifacts.**

### Phase 10 — direct prior art (re-read in full)
- `.planning/phases/10-granular-undo-foundation/10-RESEARCH.md` — establishes the `getMarkupUndoHandler` / `getMarkupRedoHandler` pattern, `redoPoints` stack on `MarkupDrawState`, and the "Ctrl+Z falls through to store after in-progress handler returns false" dispatch rule. Phase 13's re-open branch slots into this dispatch.
- `.planning/phases/10-granular-undo-foundation/10-01-PLAN.md` and `10-02-PLAN.md` — implementation surfaces touched.
- `src/renderer/src/hooks/useMarkupTool.ts` — `MarkupDrawState`, `mode: 'idle' | 'placing' | 'drawing'`, `popLastPoint`, `repushLastPoint`, `cancel`, `commitShape`, `activatePreset`, `chainArmed`.
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Ctrl+Z / Ctrl+Y dispatch tree with `isTextInputActive()` guard and the markup-undo-ref handoff.
- `src/renderer/src/lib/markup-undo-ref.ts` — module-level ref pattern; Phase 13 may add a sibling `markup-reopen-ref.ts` or reuse this module.
- `src/tests/markup-tool-point-redo.test.ts` — test style and harness conventions for Ctrl+Z/Ctrl+Y dispatch.

### Markup store — command-pattern undo/redo
- `src/renderer/src/stores/markupStore.ts` — `MarkupCommand` discriminated union (`'place'`, `'delete'`, `'delete-group'`, `'edit-markup'`, `'recolor-group'`, `'move-vertex'`, `'move-markups'`), `undoStack` / `redoStack`, `undo()` / `redo()` dispatchers, `commitShape` callsites.
- `.planning/STATE.md` §"MarkupCommand stores full Markup object (not just ID)" — undo/redo without store lookup.
- `.planning/STATE.md` §"UNDO_STACK_MAX=50 (2.5× MARK-09 minimum)" — stack size discipline.

### Markup types
- `src/renderer/src/types/markup.ts` — `BaseMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`, `CountMarkup`, `MarkupType` union, `isMultiPointMarkup` (if present — planner must verify or introduce a type guard).

### Toast + UI chrome
- `src/renderer/src/components/ConfirmationToast.tsx` — parent-owns-lifecycle pattern (no internal setTimeout).
- `src/renderer/src/App.tsx` — existing toast slot used by Saving… / Export / Arm-from-totals confirmations. Re-open toast must reuse this slot, not introduce a new one.
- `src/renderer/src/components/CanvasViewport.tsx` — `commitShape` callsites, `useMarkupTool` instance, selection state wiring, vertex-edit mount.

### Cross-cutting constraints (locked by prior phases)
- `.planning/STATE.md` §"Module-level ref pattern for canvas controls" — preferred over Zustand for cross-component runtime UX state.
- `.planning/STATE.md` §"Layer 1 split into 1a (non-listening) + 1b (listening=true)" — in-progress previews go on 1a, committed markups on 1b. Re-open removes the original from 1b and shows the in-progress shape on 1a.
- `.planning/STATE.md` §"`isTextInputActive()` guard on every global Ctrl+ shortcut" — non-negotiable.
- `.planning/STATE.md` §"Stage inverse transform for page-space coords" — non-negotiable for any pointer-driven path.
- `.planning/STATE.md` §"chainArmed boolean on MarkupDrawState (D-05)" — re-open does NOT enter chain mode; chainArmed is preserved across re-open/recommit as transient state (cleared if user explicitly disarms).

### v1.1 source-of-truth
- `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` §"Phase C — Post-Commit Step-Level Undo (Phase 10 extension)" — original decisions D-10/D-11/D-12 lifted into this CONTEXT.md.
- `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` §"Specifics — Post-Commit Undo — User intent is clear" — user's exact words: *"when a mark is placed when undo it erases the whole markup, can it be just a step-level undo?"*

</canonical_refs>

<specifics>
## Specific Ideas

### User's exact intent (source: v1.1-CONTEXT.md Specifics)
*"when a mark is placed when undo it erases the whole markup, can it be just a step-level undo?"*

This is Phase 13. Where Phase 10 made Ctrl+Z step-level **during** drawing, Phase 13 makes the first Ctrl+Z **after** commit step-level too — by re-opening the shape into the same drawing state Phase 10 already understands.

### Re-open is not "edit"
There is already an Edit popup (Phase 7) for name / category / color. Re-open is specifically for **geometry refinement** — adding or removing points on a shape that was already committed. The two paths are orthogonal:
- Edit popup → `EditMarkupCommand` (name/category/color), shape unchanged.
- Re-open → `ReopenMarkupCommand` (or equivalent), geometry changed, name/category/color preserved.

### Why not "open a new edit mode"?
Because re-using `mode: 'drawing'` from `useMarkupTool` gives us **for free**:
- Phase 10 step-level undo of points (Ctrl+Z pops, Ctrl+Y re-adds).
- The existing in-progress preview renderers (linear / area / perimeter / wall — already handle the `'drawing'` mode visualization).
- Enter / dbl-click commit (Phase 9).
- Esc cancel (Phase 3).
- `isTextInputActive()` guard (Phase 3 / 10).

A new edit mode would duplicate all of that.

### Wall tool specifics
Wall has a `wallHeight` field in `MarkupCommand.wall.*`. Re-opening a wall markup must preserve the existing `wallHeight` on the in-progress state (Phase 8's `pendingWallHeight`), so the user is not re-prompted for height on re-commit. Treat it the same as name/category/color: inherit, do not re-prompt.

### Performance
Re-open is one undo dispatch + one state machine transition. Nothing performance-critical. The only perf-sensitive surface is the in-progress preview, which Phase 3 / 8 / 10 already handle at 60fps. No new perf budget.

</specifics>

<deferred>
## Deferred Ideas

- **Re-open via right-click / context menu** — keyboard-only for v1.1. A future polish phase could add a "Re-open / Edit geometry" item to `MarkupContextMenu` that triggers the same flow without using Ctrl+Z.
- **Re-open via vertex-handle gesture** — separate from Phase 12's drag. Could be useful if the user wants to insert a vertex mid-edge; deferred to a vertex-edit polish phase.
- **Multi-markup re-open** — if multiple markups are selected, re-open the most recent commit only (D-17 already specifies single-markup). Bulk re-open is out of scope.
- **Branching undo / redo history** — accidentally Ctrl+Z'ing past the re-open and then making a different choice should be possible via Ctrl+Y; full branching history is v2.0.
- **Count pin re-open** — count pins are single-point; "re-open" has no useful meaning. If a future tool produces single-point markups with editable metadata, this decision can be revisited.

</deferred>

---

*Phase: 13-post-commit-step-level-undo*
*Context gathered: 2026-05-21 (lifted from v1.1-CONTEXT.md Phase C decisions)*
