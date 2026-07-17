---
phase: quick-260717-l5f
plan: 01
subsystem: spikes/008-live-readout
tags: [spike, markup, live-readout, mm-08, type-it-exact, verify-points, feel, offline-demo]
requires:
  - .planning/spikes/008-live-readout/index.html (existing passive see-it-live demo)
  - .planning/spikes/006-area-cutouts/index.html (data-*/setX() toggler pattern mirrored)
provides:
  - "008 demo type-it-exact (Verify Points) entry mode: editable dynamic-input pill + inverse-math resolver"
affects:
  - .planning/spikes/008-live-readout/index.html
  - .planning/spikes/008-live-readout/README.md
  - .planning/spikes/MANIFEST.md
tech-stack:
  added: []          # zero new deps — one self-contained offline file, plain Canvas 2D
  patterns:
    - "data-entry + setEntry() toggler mirrors 006's data-mode/setMode + data-place/setPlace"
    - "inverse-math resolver: point = from + L*PX*(cos A, -sin A); -sin mirrors the -(dy) live-angle read"
    - "effective-in-flight-point indirection (inflightPoint()) keeps the passive path byte-for-byte"
key-files:
  created: []
  modified:
    - .planning/spikes/008-live-readout/index.html
    - .planning/spikes/008-live-readout/README.md
    - .planning/spikes/MANIFEST.md
decisions:
  - "inflightPoint() returns S.cursor by object-identity in click mode / nothing-typed → passive numbers unchanged"
  - "First vertex is always click-placed; typed fields inactive (resolveTyped null) until >=1 vertex exists"
  - "keydown only hijacks keys when (entry==='type' && points>=1); otherwise the original Enter/Backspace/Esc run verbatim"
  - "Resolution rule: typed-if-present-and-valid else live, per field; length must be finite & >=0 else UNSET, angle may be negative"
  - "Canvas-rendered pill (no HTML input overlay) — stays faithful to the on-canvas pill + fully self-contained/offline"
metrics:
  duration: ~14min
  completed: 2026-07-17
  tasks: 3
  files: 3
  commits: 3
---

# Quick Task 260717-l5f: Spike-008 Live-Readout Demo — Add Type-it-exact (Verify Points) Summary

Added a PlanSwift-style **type-it-exact (Verify Points)** point-entry mode to the spike-008 live-readout FEEL demo — an editable AutoCAD-style dynamic-input pill at the cursor — alongside (not replacing) the existing passive see-it-live readout, with the whole thing remaining one self-contained offline `index.html`.

## What Was Built

- **Point-entry toggle** (`data-entry` / `setEntry()`), mirroring 006's `data-mode`/`data-place` toggler pattern. Default **Click (by eye)**; the second button is **Type-it-exact (Verify Points)**.
- **State + inverse-math (Task 1, logic):**
  - `S.entry`, `S.typed{field,len,ang}`, `resetTyped()` (wired into `setTool`, Clear, every placement, and init).
  - `resolveTyped(cursor)` — inverse solve from the last placed vertex: `liveLenM`/`liveAng` computed with the demo's exact angle convention; per-field resolution rule (typed-if-valid else live); `point = from + L·PX·(cos A, −sin A)`. Fully NaN-guarded (lone `-`/`.`/negative length → UNSET, falls back to live). Returns `null` before the first vertex.
  - `inflightPoint()` — effective in-flight cursor; returns `S.cursor` unchanged in click mode / nothing-typed (the passive-path invariant), the resolved point otherwise.
  - Keydown rewritten to hijack keys **only** when type-it-exact is armed (digits/`.` append; `-` only in the angle field; Tab toggles fields; Backspace edits-then-undoes; Enter-with-buffer places / Enter-empty finishes; Esc clears-buffer-then-clears). Click places at the resolved-or-raw point. `logType()` forensic line added.
- **Render (Task 2):** `measure()` and `draw()` route the in-flight leg / arc preview / per-segment label / closing edge / area fill through `cur = inflightPoint()`. New `entryPill(x,y,r)` canvas widget (two labelled fields `L … m` / `∠ … °`, active field boxed + caret, live values when idle) swaps in for the passive pill in type mode, with a ghost target dot at the resolved next vertex. `hintEl()` appends a type-mode hint line.
- **Docs (Task 3):** README "Point entry" two-mode section + resolution rule + type-mode expectations; the Feel — PENDING paragraph now covers both placement and type-it-exact feel; verdict kept **VALIDATED (math + perf) · PENDING human feel-test** (no feel claim). MANIFEST 008 row gained a single type-it-exact clause; no other row touched.

## Verification

All automated `<verify>` node gates printed OK:

| Gate | Result |
|------|--------|
| Task 1 — compile (`new Function(body)`) + symbols (`data-entry`, `setEntry`, `resolveTyped`, `inflightPoint`, `S.typed`, `logType`) | OK |
| Task 1 — inverse-math round-trip (live-derived L/A back to source point) | OK, err = 1.6e-13 (< 1e-9) |
| Task 2 — compile + render symbols (`entryPill`, `inflightPoint()`) | OK |
| Task 3 — README has `type-it-exact` + `PENDING`; MANIFEST 008 row has `type-it-exact` | OK |

**Extra headless harness** (scratchpad, not committed): actually evaluated the real script body against a stubbed DOM (proving no load-time crash) and asserted 12 properties — the CRITICAL passive-path invariant holds by **object-identity** (`inflightPoint() === S.cursor` in click mode AND in type mode with empty buffers), typed length locks the radius while angle follows the mouse (and vice-versa), the no-anchor-vertex guard returns `null`, and malformed buffers (`-`, `.`, `-5`) never produce a NaN vertex. All 12 PASS.

**Human feel-test:** remains PENDING — subjective feel of both entry modes is for the user to judge by opening `index.html`; the in-app Browser MCP has been blocked again this session (same as prior spike sessions). This is not a gate for this quick task.

## Deviations from Plan

None — the plan executed exactly as written. (Implementation detail: `entryPill()` resets `ctx.textBaseline`/`ctx.textAlign` at the end so the shared pill/segLabel renderers are unaffected — within the plan's render spec, not a behavioural deviation.)

## Known Stubs

None. The passive path is untouched; the type-it-exact path is fully wired (state → resolver → render → placement → log), not a placeholder.

## Constraints Honoured

- One self-contained offline `index.html` — inline CSS+JS, plain Canvas 2D, **no imports/CDNs/web fonts**; reused the already-ported geometry (`dist`, `solveCircle`, `arcLength`).
- Passive-path invariant proven byte-for-byte (identity-equal cursor; keydown does not hijack when the toggle is OFF).
- No changes under `src/`, no `verify.cjs` change, no `ROADMAP.md` change. Three task-scoped commits touching only the three intended spike files.
- No scratch/throwaway files in the repo (harness written to the session scratchpad).

## Commits

- `ff1784c` feat(spike-008): type-it-exact entry state + inverse-math + keyboard/click placement
- `6de0abb` feat(spike-008): route in-flight preview through effective point + editable dynamic-input pill
- `e05344e` docs(spike-008): document type-it-exact entry mode; feel stays PENDING

## Self-Check: PASSED

- FOUND: `.planning/spikes/008-live-readout/index.html` (modified, committed ff1784c + 6de0abb)
- FOUND: `.planning/spikes/008-live-readout/README.md` (modified, committed e05344e)
- FOUND: `.planning/spikes/MANIFEST.md` (modified, committed e05344e)
- FOUND commit ff1784c, 6de0abb, e05344e in `git log`
- Working tree clean except the untracked quick task dir; no tracked-file deletions.
