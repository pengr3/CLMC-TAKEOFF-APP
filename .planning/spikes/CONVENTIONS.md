# Spike Conventions

Patterns and stack choices established across spike sessions (001–003, 006–009). New spikes
follow these unless the question requires otherwise.

## Stack

- **Math / feasibility / benchmark spikes** → a single **zero-dependency Node `.cjs` script**
  (`experiment.cjs` or `verify.cjs`). No `npm install`, no build step. Run with `node <file>`.
  Used by 001 (NCC), 002 (grid-hash), 003/003b (arc math), 006 (multi-ring area), 008/009 (verify).
- **Feel / UX / interaction spikes** → a single **self-contained `index.html`** (or `mockup.html`)
  with inline CSS + JS, **plain Canvas 2D** (no Konva/CDN — stays fully offline), opened directly
  in a browser. Used by 007 (toolbar), 006/008/009 (interactive demos).
- **Do NOT** pull in the real Electron/React/Konva stack for a spike. The geometry/logic is what
  transfers; the demo proves it in plain Canvas and the README notes the Konva port for the build.

## Structure

```
.planning/spikes/
  NNN-descriptive-name/
    README.md          # frontmatter (spike/name/type/validates/verdict/related/tags) + trail + results
    experiment.cjs     # (math spikes) self-verifying oracle, prints VERDICT line
    verify.cjs         # (feel spikes) verifies the demo's math/pipeline core headlessly
    index.html         # (feel spikes) interactive demo the user opens to FEEL it
  GAP-NNN-*.md         # analysis-only "what do we lack" audits (no code) → name spike candidates
  MANIFEST.md          # one-row-per-spike index (ID | Title | Status | Date | Key Finding)
  BACKLOG.md           # MM-series measurement/markup gaps
  CONVENTIONS.md       # this file
```

## Patterns

- **Port the SHIPPED function verbatim, don't re-implement.** 006 and 008/009 copy `solveCircle`,
  `circularSegmentMagnitude`, `polygonArea` straight out of `arc-math.ts` / `markup-math.ts` so the
  oracle tests the real engine. A spike that re-derives the math proves nothing about production.
- **Two independent oracles beat one.** 006 checked straight rings vs exact shoelace AND
  Monte-Carlo, arc rings vs fine tessellation. 003 checked closed-form vs numerical integration.
  Independence is the point — a bug shared by formula and oracle hides otherwise.
- **Deterministic PRNG, never `Math.random()`.** All scripts seed `mulberry32` (or an LCG) so runs
  are reproducible. (Also required by the workflow runtime, but it's good discipline regardless.)
- **Forensic log layer in every interactive demo.** Timestamped event log (`+Nms CAT msg`) shown in
  a side panel + an **Export** button dumping `{ summary, log }` JSON. The summary carries the
  spike's key metric (net area / readout perf / recall+precision).
- **Make the design fork a toggle, not a decision.** A feel spike exists to let the *user* choose —
  008 ships cursor-follow / HUD / both; 007 shipped layout A / B. Don't pre-pick.
- **Benchmark the hot path at scale.** Cost is uninteresting at N=4; measure N=1000–5000 (008
  readout, 002 snapping). "Is it fast enough?" is answered with µs, not adjectives.
- **Verdict discipline.** Split `VALIDATED (math/perf)` from `PENDING human feel-test` when the
  spike has both a provable core and a subjective surface. Don't claim VALIDATED on a single happy path.

## UI / styling (interactive demos)

- Dark **workspace** aesthetic matching the app: `#1e1e1e` bg with a faint dotted grid, `#252526`
  side panel, `#0078d4` accent, `#4ec9b0` for live-measurement green. (Call the dark dotted area the
  **workspace**, not "canvas".)
- Left = the interactive stage; right = a fixed control/readout/log panel (~310–330px).
- `<kbd>` chips for shortcuts; `data-*` attributes + a `setX()` toggler for mode buttons.

## Tools & Libraries

- **Node** (any 18+) for `.cjs` scripts — `process.hrtime.bigint()` for µs timing.
- **Plain Canvas 2D** for demos. `getImageData`/`putImageData` for raster work (009 NCC).
- **No** external packages, CDNs, bundlers, or web fonts (offline constraint; also keeps the file
  openable by double-click).

## Gotcha log (bugs found in spikes, guard in the real build)

- **Coordinate flooring at the raster boundary (009).** Indexing a typed-array image with a *float*
  pixel coordinate returns `undefined` → NaN. Always `Math.round`/`| 0` before `G[y*W + x]`.
- **Winding independence (006).** Per-ring `abs` area makes hole winding irrelevant — the build must
  NOT try to enforce CW holes / CCW outer.
