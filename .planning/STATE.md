---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: milestone_complete
stopped_at: Completed 15-02 (Wave 1 — BOQ data-model + aggregator spine). rates plumbed end-to-end (projectStore.rates+setRate, ProjectFileV2.rates? additive no-bump, snapshot+hydrate w/ finite-≥0 coercion guard); rate/cost/costSubtotal/grandTotalCost on boq-types + both preload mirrors; aggregator threads cost + perimeter is length-only (arc-aware kept) AND a first-class D-02 collision member (perimeter-length→perimeter rename, perimeter-area deleted). boq-aggregator/project-serialize/project-schema GREEN (36/36); npm run typecheck clean; git grep perimeter-area|perimeter-length src/renderer/src/lib+src/preload = zero. 3 atomic commits ac1c97f/c9a5d79/85b1ade. Writers/totals-row-rate-edit/use-boq-live correctly still RED for Waves 2/3.
last_updated: "2026-06-29T10:05:20.697Z"
last_activity: 2026-06-29
progress:
  total_phases: 20
  completed_phases: 18
  total_plans: 101
  completed_plans: 99
  percent: 90
---

# Project State: CLMC Takeoff App

*Single source of truth for current project position. Updated at every phase transition and plan completion.*

---

## Project Reference

**Core Value:** Speed up quantity takeoff -- let the estimator focus on reading the plan, not doing math.

**What This Is:** Windows desktop takeoff application. Users load PDF floor plans, set scale, place count/linear/area/perimeter markups, and export a BOQ/BOM to Excel or CSV.

**Current Focus:** Phase 15 — boq-pricing-perimeter-simplification

---

## Current Position

Phase: 15 (boq-pricing-perimeter-simplification) — EXECUTING
Plan: 3 of 4

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 13 / 13 |
| Plans complete | 81 |
| Requirements delivered | 25 / 25 |
| Session count | 8 |

---
| Phase 01 P01 | 9min | 3 tasks | 19 files |
| Phase 01 P02 | 3min | 2 tasks | 8 files |
| Phase 01 P03 | 3min | 1 task | 8 files |
| Phase 02 P01 | 2min | 2 tasks | 5 files |
| Phase 02 P02 | 8min | 2 tasks (+ checkpoint) | 5 files |
| Phase 02 P02 | 8min | 2 tasks | 5 files |
| Phase 02 P02 | 8min | 3 tasks | 5 files |
| Phase 02 P03 | 7 | 3 tasks | 12 files |
| Phase 03 P01 | 7 | 3 tasks | 7 files |
| Phase 03 P02 | 3 | 2 tasks | 5 files |
| Phase 03-markup-tools-and-editing P03 | 6min | 3 tasks | 4 files |
| Phase 03 P04 | 5 | 3 tasks | 4 files |
| Phase 03.1 P01 | 6min | 3 tasks | 7 files |
| Phase 03.1 P04 | 8min | 3 tasks | 5 files |
| Phase 03.1 P02 | 6min | 3 tasks | 8 files |
| Phase 03.1 P03 | 7min | 4 tasks | 4 files |
| Phase 03.1 P05 | 10min | 4 tasks | 8 files |
| Phase 04 P00 | 2min | 2 tasks | 8 files |
| Phase 04 P01 | 4min | 4 tasks | 9 files |
| Phase 04 P02 | 8min | 2 tasks | 7 files |
| Phase 04 P03 | 5min | 3 tasks | 7 files |
| Phase 04 P04 | 11min | 3 tasks | 9 files |
| Phase 04 P05 | 5min | 3 tasks | 6 files |
| Phase 04 P07 | 4min | 3 tasks | 4 files |
| Phase 06 P00 | 6min | 2 tasks | 15 files |
| Phase 06 P01 | 18min | 2 tasks (TDD RED+GREEN paired commits) | 6 files |
| Phase 06 P02 | 12min | 2 tasks (Task 1 single feat; Task 2 TDD RED+GREEN) | 4 files |
| Phase 06 P03 | spans 2 sessions (PC restart between Task 1 GREEN + Task 2 GREEN) | 2 tasks (both TDD RED+GREEN) | 4 files |
| Phase 06.1 P01 | 15min | 2 tasks | 9 files |
| Phase 14 P01 | 6min | 3 tasks (all TDD RED+GREEN) | 5 files |
| Phase 14 P02 | 5min | 2 tasks (both TDD RED+GREEN) | 4 files |
| Phase 14 P03 | 13min | 3 tasks | 6 files |
| Phase 14 P04 | 12min | 3 tasks | 6 files |
| Phase 14 P05 | 14min | 3 tasks | 8 files |
| Phase 14 P06 | ~10min | 2 auto tasks + 1 UAT checkpoint | 8 files |
| Phase 15 P15-01 | 13min | 3 tasks | 9 files |
| Phase 15 P15-02 | 11min | 3 tasks | 8 files |

## Accumulated Context

### Key Decisions Locked

| Decision | Rationale |
|----------|-----------|
| Electron 35 + React 19 + TypeScript + electron-vite | Bundled Chromium eliminates WebView fragmentation risk; hot reload during dev |
| PDF.js + Konva.js | Canonical pattern for annotation-over-PDF; official Konva sandbox confirms use case |
| Zustand 5 with persist middleware | Minimal boilerplate; serializes project state to JSON cleanly |
| ExcelJS 4.4.0 | Richer formatting API than SheetJS CE for write-only BOQ output |
| All markup coordinates stored in PDF page space (normalized 0.0-1.0) | Prevents markup drift on zoom/pan and across save/reload cycles -- rated HIGH recovery cost if done wrong |
| Per-page scale model (not per-project) | Plans in a set have different scales; per-page is mandatory for mixed-scale PDFs |
| Command pattern for undo/redo | Far cheaper than full-snapshot undo; must be introduced with first markup, not retrofitted |
| formatVersion field in .clmc files from day one | Enables future schema migrations; omitting it makes old files unreadable after any change |
| Freehand markup naming (no item library) | Simpler UX for v1; user types item names directly |
| Standard export layout (not custom template) | Avoids template management complexity for v1 |
| Module-level ref pattern for canvas controls | Simpler than React context or Zustand function refs for cross-component communication |
| Discrete zoom steps [0.25..8] with snapping | Predictable behavior matching CAD tool conventions |
| DOM event listeners for middle-mouse pan | Avoids drag conflicts with Konva's built-in drag system |
| Stage inverse transform for page-space coords | `stage.getAbsoluteTransform().copy().invert().point(pointer)` is the canonical pattern â€” never use raw pointer coords |
| Zoom-compensated Konva overlay visuals | Divide all stroke widths and radii by currentZoom so visual sizes appear constant at all zoom levels |
| CalibrationDialog cancel keeps activeTool='scale' | User can immediately retry the line draw without re-clicking the toolbar button |
| mm-based canonical scale storage (pixelsPerMm) | Unit-independent storage enables display unit switching without recalibrating; all scale math uses a single unit |
| ConfirmationToast is pure presentational (no setTimeout) | Parent owns dismissal lifecycle via useEffect â€” avoids React cleanup race conditions with timers inside components |
| formatScaleRatio single-arg returns '1:N' ratio | Estimators read drawing scales as ratios (1:100, 1:50) â€” integer round of mm/pixel is the natural representation |
| scaleStore separate from viewerStore | Keeps scale concerns orthogonal to viewport/PDF navigation; Phase 3 markup tools import only what they need |
| MarkupCommand stores full Markup object (not just ID) | Enables undo/redo without any store lookup â€” safer and simpler for the command pattern |
| nextCountSequence uses max(existing)+1 (gap-preserving) | Deleted markups leave permanent gaps, preventing duplicate sequence numbers (Pitfall 5) |
| UNDO_STACK_MAX=50 (2.5x MARK-09 minimum) | Provides comfortable margin above the 20+ round-trip requirement for dense editing sessions |
| isMarkupTool type guard in viewer.ts | Plans 03/04 can discriminate activeTool without string literal comparisons across files |
| MarkupNamePopup emits raw categoryName string | Consumer (Plans 03/04) calls getOrCreateCategory â€” maps empty string to 'Uncategorized' |
| CategoryAutocomplete uses onMouseDown + e.preventDefault() | Prevents input onBlur from closing the dropdown list before item selection fires |
| useMarkupTool state machine uses useState+useCallback (not useReducer) | Mirrors useCalibrationMode pattern for consistency; simpler than reducer for this use case |
| recordClick places CountMarkup via Zustand getState() inside setState updater | Avoids double-render from separate dispatch; Zustand getState() is safe outside React render |
| LinearMarkup label shows only name when pageScale is null | Graceful degradation on uncalibrated page rather than showing '0 m' stub |
| finishPolygon positions popup at polygonCentroid+20px (screen-space) | Vertex average centroid is natural anchor for polygon popup |
| Layer 2 transient polygon layer separate from Layer 1 | Enables hitStrokeWidth events on start vertex without forcing Layer 1 to have listening=true |
| isOverStartPoint lives in CanvasViewport (not useMarkupTool) | Hook is isolated from Konva Layer structure; viewport owns the interactive event layer |
| PerimeterMarkup appends points[0] to polylineLength input | Includes the closing segment in perimeter calculation â€” without this, last-to-first segment is missing |
| RecolorGroup command stores oldColors dict (per-markup) not single oldColor | Preserves per-pin color drift on undo â€” D-29 uniform recolor stays reversible to exact prior state |
| MARKUP_PALETTE uses Tailwind 600-level hues (10 swatches) | Guaranteed WCAG-AA contrast against both white and black â€” enables D-23 auto-contrast pin numbers with zero palette edge cases |
| getColorForName returns most-recent (not first) markup color for a name | Matches "the last color chosen is the current color" mental model without walking full history |
| Category.color retained alongside Markup.color during 03.1 transition | Plans 03.1-02/03 migrate rendering components off category.color â€” avoiding full cascade in plan 01 keeps data-model refactor atomic |
| Pin geometry constants lifted to module scope (PIN_RADIUS_WORLD=10, NUMBER_FONT_WORLD=12) | Pure world-anchored per D-22; module-level placement makes any future zoom-division regression a single-line visible diff |
| CONTRAST_LUMINANCE_THRESHOLD = 0.179 module-level literal in color-utils.ts | WCAG break point for white text meets 4.5:1 contrast; exact value is grep-verifiable per D-23 acceptance criteria |
| polylineMidpointByArcLength walks cumulative segment distance + interpolates inside the half-mark segment | B2 fix: LinearMarkup label lands at geometric center, not an arbitrary vertex (index-based midpoint bias) |
| category.color stripped from all 4 markup render components | D-29 cascade complete; Category.name retained for BOQ grouping only (D-27) |
| MarkupNamePopup userOverrodeColor stored as useRef (not useState) | Flag participates in useEffect inheritance logic without triggering re-renders; ref avoids the stale-closure bug useState would introduce if the effect's dependency array excluded the flag |
| Render tests kept as .test.ts with React.createElement | vitest.config.ts include glob is src/tests/**/*.test.ts â€” avoids modifying config mid-wave (parallel-executor safety); mirrors existing spacebar-text-guard.test.ts pattern |
| MarkupNamePopup.onConfirm payload widened { name, categoryName, color } without touching CanvasViewport callsites | TypeScript's default method-parameter bivariance allowed the narrower commitCountName to satisfy the widened onConfirm type without casts â€” kept diff scoped to popup + hook only |
| Layer 1 split into 1a (non-listening) + 1b (listening=true) | Calibration + in-progress linear preview stay off the hit-testing graph; only committed markups cost hover work. Matches existing Layer 2 transient-polygon isolation pattern |
| Hover tooltip debounce owned by CanvasViewport not MarkupTooltip | MarkupTooltip stays pure presentational; parent holds the 200ms window.setTimeout ref and cancels on leave/context-open. Mirrors ConfirmationToast parent-owns-lifecycle pattern |
| MarkupContextMenu currentColor wired to contextMarkup.color (not getColorForName) | The pin the user right-clicked is authoritative â€” avoids UI surprise if name-group has drifted colors. recolorGroup still flips the whole name-group per D-29 |
| Konva onContextMenu handlers translate event via stage.getPointerPosition() then call e.evt.preventDefault() | Screen-space pointer is correct at any zoom because getPointerPosition reads raw mouse coords (unaffected by Stage transform); preventDefault suppresses the browser's native right-click menu on the canvas |
| useBoqLive uses 8 primitive Zustand selectors over a single useMemo wrapping aggregateBoq | Pitfall 2 in 06-RESEARCH Â§2 â€” `(s) => s` would re-render on every store change; primitive selectors trigger only on actual input changes. getColorForName captured via getState() inside the memo so identity doesn't churn. Same `categories as Record<...>` cast as boq-aggregator.ts:86 |
| useUiPanels persists to localStorage clmc.ui (NEVER inside .clmc) with defensive 5-field shape check on read | Estimator panel preferences follow the workstation, not the project file. T-06-01-01 mitigated: any parse failure or schema drift silently resets to DEFAULTS â€” no thrown errors, no console noise |
| usePageLabels casts pdfDocument selector to PDFDocumentProxy at the callsite | viewerStore types pdfDocument as `unknown | null` to keep pdfjs out of the store contract â€” established in usePdfRenderer.ts:68 and re-applied here. One widening point per consumer |
| Test harness writes captured hook value via useLayoutEffect into a holder object | eslint-plugin-react-hooks v7 forbids render-time reassignment of outer let-bindings (react-hooks/immutability + react-hooks/globals); useLayoutEffect runs after the render commit, satisfying the rule. Mirrors use-export-hook.test.ts useEffect-based assignment |
| Test files install in-memory localStorage polyfill via Object.defineProperty in beforeEach | jsdom 29 in this project ships an experimental persistent localStorage that requires --localstorage-file with a valid path; without it, getItem/setItem are undefined. Polyfilling per-test-file is parallel-executor-safe (no vitest.config.ts change) and matches the CLAUDE.md "no test infra changes mid-wave" rule |
| useMarkupHighlight passes setHoverMatches as the raw useState setter (not useCallback-wrapped) | useState setters are guaranteed-stable by React; wrapping is redundant ceremony. Only the three setters with non-trivial bodies (clearHover, triggerPulse, clearPulse) get useCallback. Matches the locked RESEARCH Â§3 lines 467-495 pattern verbatim |
| Splitter registers pointermove + pointerup on window (not on the element) | Element-scoped listeners drop events when the cursor leaves the 4px hit strip during a fast drag. Window-level capture catches every event until pointerup; both listeners removed atomically in onUp. Mitigates T-06-02-02 (DOS â€” listener leak) by preventing the retain path |
| Splitter calls onDragWidth on every pointermove but onCommit only on pointerup | Splits live-render (driven by parent local state on every frame) from persistence write (driven by useUiPanels' localStorage commit on pointerup only). Avoids 60-120 localStorage writes/sec during a single drag. Width clamp range mitigates T-06-02-01 (raw clientX tampering) |
| CanvasHeaderBar uses inline conditional render rather than StatusBar's flat scaleText/scaleColor variables | The third D-20 branch contains a clickable inline link element, not just text â€” a flat string variable doesn't fit cleanly. Three-way ternary at render keeps each branch's structure visible at a glance. Diverges from StatusBar pattern intentionally because the decision tree shape is different |
| CanvasHeaderBar reuses getCalibrationControls()?.activate() â€” does NOT duplicate the trigger code | Toolbar.tsx:173-181 establishes the canonical Set Scale entry point via the module-level ref. CanvasHeaderBar's inline link onClick uses the same callsite shape â€” exactly one functional invocation in the file. D-20 cross-cutting constraint, asserted by the canvas-header-bar.test.ts spy on getCalibrationControls |
| HoverRing uses single fat envelope-stroke for linear/area/perimeter (strokeWidth = (2+8)/zoom at 40% opacity) | Visually identical to two stacked inner+outer strokes but halves the Konva node count. Underlying markup's normal stroke shows through the 40% alpha as the implicit "inner" ring |
| PulseHighlight uses useState(progress) + rAF, NOT direct Konva node attr mutation via refs | Pure-React keeps it trivially testable through the existing react-konva mock pattern (Circle/Line stub renders as `<div data-opacity=...>` so jsdom reads live frame values). ~90 ticks per 1500ms fade are within React 19's render budget for the small render tree |
| PulseHighlight calls onComplete() inside the rAF callback at t=1 (not in a useEffect watching progress) | rAF loop runs inside React.act in tests; placing the callback there guarantees the parent's unmount lands on the same render cycle as the t=1 frame. A useEffect path would have introduced a one-frame stale-overlay flash |
| pulse-highlight-animation.test.ts sets globalThis.IS_REACT_ACT_ENVIRONMENT = true at module scope | Without it, React 19 emits "act environment not configured" warning that the unmount-cleanup test's console.error spy catches as a false positive. Per-test-file flag mirrors markup-tool-pop-last-point.test.ts:66 + markup-tool-strictmode.test.ts:91. Parallel-executor-safe â€” no vitest.config.ts change |
| HoverRing + PulseHighlight outer offsets diverge (4/zoom vs 8/zoom) | Allows the two overlays to render simultaneously over the same markup without visual overlap â€” hover ring sits inside, pulse ring sits outside |
| chainArmed boolean on MarkupDrawState (D-05) | Runtime-only chain state; not persisted; reset by cancel() via INITIAL_STATE; survives PDF page navigation (D-04). The existing count tool's 'placing' mode was the prototype â€” generalizing to linear/area/perimeter/wall meant NOT calling INITIAL_STATE reset after commitShape when chainArmed is true |
| pendingWallHeight default 2400 in INITIAL_STATE (D-08) | Chain inherits last wall height silently; Pitfall 7 â€” any partial reset that omits this field leaks stale height state into the next chain placement |
| _chainArmedItem module-ref in CanvasViewport, getChainArmedItem() in Toolbar (D-03) | Mirrors _canvasControls / _calibrationControls pattern; using Zustand would couple runtime UX state to persistent store and cause unnecessary re-renders on every placement |
| wallAreaM2 uses inline mm→m conversion (not pixelLengthToReal with 'm') | Avoids Assumption A1 risk about 'm' as ScaleUnit; D-12 walls always report m² regardless of project globalUnit |
| hiddenItemNames additive optional field on ProjectFileV2; hiddenItemSet: Set<string> derived in-memory for O(1) lookups; NO formatVersion bump (D-13) | validateV2 cast accepts the new field silently; old files load with [] default; hiddenItemSet kept in sync by toggleHiddenItem and hydrateStores. O(1) Set lookup required because skip-render runs every frame for every visible markup |
| CROSSHAIR_CURSOR module-scope IIFE computed once (D-18) | URI-encoded SVG data-URL avoids quote nesting (Pitfall 8); 24×24 SVG with hotspot 12 12 (center of cross gap); cursor fallback in CSS value chain |
| Edit popup callsite must pass toolType + initialWallHeight for wall markups (UAT bug 08-07) | MarkupNamePopup wall-height row is conditional on toolType==='wall' â€” any edit callsite that omits toolType silently drops the row. Fixed in commit 224f867; pattern: always pass toolType when opening MarkupNamePopup in mode='edit' |
| D-04 revised: single click on a line markup = vertex edit (Phase 12 post-UAT) | Original "second click" gating hid handles behind a flow most users didn't intuit. With handles serving as selection feedback for line markups, two-step activation is redundant. Count pins still require single-click select-only (no vertex edit). |
| Selection halo reserved for count pins and multi-select (Phase 12) | Single-selected line markups show vertex handles as feedback; the accent-color halo (10/zoom stroke width) visually engulfs the 8px handles at low zoom. Pins still need the halo (no vertices); rubber-band groups need it on every member. |
| markupClickedRef handoff between handleMarkupClick and handleStageClick (Phase 12) | Konva markup Groups don't set an `id` Konva attr, so `e.target.getAttr('id')` returns undefined. The ref is the only reliable way to distinguish "click landed on a markup (transition already handled)" from "click landed on empty stage (commit vertex-edit)". |
| vertexHandleLayer follows BOTH vertex-drag and body-drag previews (Phase 12) | Body-drag previously left handles behind because only `dragPreview.type === 'vertex'` was honored. Shifting every vertex by the body-drag delta keeps handles attached to the markup throughout the gesture. |
| D-09 threshold computed as `4 / currentZoom` page-space units (Phase 12) | D-09's stated intent is "4 screen pixels" — distinguishing click from drag. dx/dy are page-space (inverse stage transform), so the threshold must be zoom-compensated. Applied uniformly to vertex-drag, body-drag, and rubber-band commits in handleStageMouseUp. |
| commitVertexEdit is cleanup-only (Phase 12 blocking anti-pattern, locked) | Per-vertex moveVertex dispatch happens ONLY in handleStageMouseUp during the drag-release event. commitVertexEdit body is byte-identical across Waves 3a/3c: setDragPreview(null) + clearVertexEdit() + vertexEditOriginalRef = null. Iterating per-changed-vertex inside commitVertexEdit would create N undo entries per session. |
| move-markups command normalises count pins to oldPoints/newPoints arrays | Uniform undo reducer — count pins become single-element arrays so the same redo/undo branch handles both point-bearing and points-bearing markup types. |
| VertexHandleOverlay in own Layer above 1b (Phase 12) | Decoupled from markup components; handles are transient UI; layer ordering ensures handles intercept events before markup bodies (RESEARCH.md Pitfall 5). |
| vertex-edit state in viewerStore (not local ref) | Render-driven — handles mount/unmount based on vertexEditMarkupId; useState-backed is superior to a bare ref when state drives React renders. |
| arcs?: Record<number,{midX,midY}> additive on Linear/Area/Perimeter/Wall (14-01, D-01/D-08) | Keyed by segment start-vertex index; absent → straight edge; pre-Phase-14 .clmc files load all-straight. No formatVersion bump, no validateV2 change — rides the existing Markup[] cast exactly like wallHeight/hiddenItemNames? |
| arc-math.ts is the pure 3-point arc oracle; markup-math.ts the only consumer (14-01) | solveCircle (perp-bisector determinant + CCW major/minor sweep) / arcLength=R·sweep / circularSegmentMagnitude=(R²/2)(θ−sinθ); matches spike-003/003b to ≤1e-6; all inputs finite-guarded (NaN/Inf → chord/zero, never throw) per threat model T-14-01-01 |
| polygonArea arc sign rule: subtract sign(cross)·2·segMag from doubled signed shoelace, abs at end (14-01) | OUTWARD ⟺ sign(cross)≠sign(2·S); winding-independent; correct for both bulge directions. Both arc-aware fns keep their single-arg signature so boq-aggregator + save/load callers compile unchanged |
| snapping-engine.ts grid hash inserts segments into EVERY cell their cell-padded bbox overlaps, not endpoints only (14-02, spike-002) | A single-cell cursor query is then exhaustive for on-segment hits; endpoint-only silently misses long segments crossing a cell with distant endpoints (44–77 missed hits/2000 in spike). resolveSnap scans 3×3 for vertices, single cell for segments, vertex preferred over segment (D-04 □/△) |
| resolveSnap excludes the WHOLE in-progress markup from segment-snap; vertex-snap gated by allowVertexIndices/blockVertexIndex (14-02, D-07) | Keeps the close-the-loop affordance (caller passes allowVertexIndices=[0]) while preventing mid-draw self-snapping; blockVertexIndex drops the dragged vertex |
| findSelfIntersection counts collinear-overlap as a crossing; skips adjacent edges via (i+1)%n / (j+1)%n adjacency test (14-02, spike-003b, D-09) | Closed-boundary O(n²) sign-of-cross test; returns {i,j,point} edge indices feeding the D-09 red highlight directly; non-finite input / <4 points → null, never throws (T-14-02-02) |
| snapEnabled/snapSuspended read via useViewerStore.getState() inside resolveSnapAt, NOT subscribed in CanvasViewport (14-03, D-03) | Subscribing produced TS6133 unused-var errors and would widen pointer-callback deps; getState() reads keep deps narrow (mirrors the liveZoom getState idiom). StatusBar is the only subscriber — it needs re-render on flag change for the ON/held-off/OFF pill |
| resolveSnapAt(pt, exclude) is the single snap entry point for placement, vertex-drag, body-drag, AND the committed click (14-03, D-05/D-07) | One helper does gate-check → resolveSnap → publish glyph → return overridden page-point. Applying it to recordMarkupClick (not just the preview) guarantees the placed vertex matches the □/△ glyph; D-07 exclusion passed per-branch (start-vertex-only sentinel for placement, blockVertexIndex for vertex-drag, whole-markup for body-drag) |
| snapEnabled/snapSuspended are runtime-only viewerStore state, never serialized to .clmc (14-03, T-14-03-02) | project-serialize.ts reads explicit fields only (currentPage, per-page viewport) — the snap flags are absent from the serialize path, so snapping is a session/workstation preference that never persists into the project file |
| 3-click arc gesture via dedicated recordArcClick (14-04, D-01) | An arc edge consumes ONE extra click (start / on-arc / end) vs a straight edge; arcOnArc===null is the phase signal the viewport reads to suppress snapping on the on-arc (free) click and to mount/unmount ArcPreview. recordArcClick is a separate entry point so the straight-drawing path stays byte-for-byte unchanged (chain-mode/pop-last-point pass). On END click: append vertex + write arcs[startVertexIndex]={midX,midY}; commitShape attaches arcs only when ≥1 arc edge drawn |
| Arc-mode keys: bare A = one-off hold, Shift+A = sticky toggle (14-04, D-02) | bare A makes the next edge an arc then auto-reverts; Shift+A keeps a run on until toggled off (preserved across chained commits). Both isTextInputActive-guarded + window-blur safety net; bridged to useMarkupTool React state via markup-arc-ref.ts (arc flags are NOT in a store). No collision: Ctrl+A=select-all, F3=snap. Affordance = ARC_CROSSHAIR_CURSOR (crosshair + accent arc tick) since StatusBar is propless |
| ArcPreview samples solveCircle as a 64-segment dashed Line, never a Konva Arc (14-04, T-14-04-01) | One render path serves curved + collinear; the collinear branch degrades to a straight 2-point dashed Line so a degenerate/non-finite input can never produce a NaN-radius Arc. Re-solves every mousemove; listening=false; stroke = pending markup color; zoom-compensated |
| Arc-aware BOQ + committed-arc render via single buildArcAwareFlatPoints sampler (14-06, SC #4/#5) | boq-aggregator threads m.arcs into linear/area/perimeter(length+area)/wall math; the four renderers + their labels read the same arc-aware math so drawn curve == reported quantity. One pure 24-sample helper in arc-math.ts (closed/open, finite-guarded → straight chord on collinear/non-finite). Live drag preview passes arcs=undefined (stored arcs map mis-aligns with moved points). Perimeter closing-edge arc maps onto [...pts,pts[0]] index n-1 with no re-keying. arc-roundtrip test: arcs survive snapshot→validateV2→hydrate deep-equal + aggregateBoq reports arc-aware > chord |
| Phase 15 Wave 0 (15-01): Nyquist RED test surface written BEFORE any source — 22 failing assertions across 9 test files map 1:1 to Wave 1-3 source tasks (proofs a/b/c) | tsc stays clean (0 errors) via `as any` on rate/cost/costSubtotal/grandTotalCost/rates + `as unknown as BoqStructure` on writer fixtures, mirroring how project-schema-hidden.test.ts casts before the types land. RED = runtime assertion failures, never compile errors. 59 untouched/migrated tests stay green |
| Phase 15 (15-01): project-schema rates tests assert ADDITIVE TOLERANCE (accept + tolerate absence), NOT a thrown error | validateV2 returns `raw as ProjectFileV2` and does NOT strip unknown fields, so a rates-bearing object survives validation today — these two tests PASS, matching the pre-Phase-8 hiddenItemNames absent-field tolerance + the locked throw-free decision. The genuine persistence RED proofs (proof b) live in project-serialize (snapshot/hydrate) + use-boq-live (live cost recompute) |
| Phase 15 (15-01): perimeter one-row contract encoded — lone perimeter → ONE plain-labelled length row (no area row, no suffix) | The two perimeter aggregator cases rewritten to assert toHaveLength(1) + no '(area)'; WR-07 keeps the arc-aware LENGTH guard (300+π·R), drops the area assertion, finds by plain 'Curved'. perimeter-area/perimeter-length fixtures migrated to 'perimeter' across totals-row-cycle + totals-row-context-menu (git grep src/tests → zero split-type tokens); lone-perimeter cycle fixture relabeled 'Wall'/uom 'm'. New totals-row-rate-edit.test.ts asserts setRate(`name|type`,n) dispatch + stopPropagation (RED — no input yet) |
| Phase 15 Wave 1 (15-02): rates plumbed as a hiddenItemNames twin minus the derived Set (the map IS the O(1) lookup) | projectStore.rates + setRate (trailing get().markDirty() is load-bearing for Save) + reset-{}; ProjectFileV2.rates? additive — NO formatVersion bump, NO validateV2 branch (rides the `return raw as ProjectFileV2` cast); snapshot emits rates, hydrate restores inside the dirty-suspend bracket with a per-value finite-≥0 coercion guard (T-15-02-01: drops negative/NaN/Infinity/non-number, non-object→{}). Key is `${name}|${type}`, category-INDEPENDENT |
| Phase 15 (15-02): BoqRowType perimeter-length→perimeter RENAME + perimeter-area DELETE (row type now equals markup type) | Applied in lockstep across the 3 in-scope type-duplication files (boq-types canonical + preload/index.ts + preload/index.d.ts); preload mirrors keep their categoryId omission, preload/index.ts keeps its pre-existing 'wall' drift untouched. boq-writers.ts (4th, main-process) LEFT to Wave 2 — compiles independently so the boq-export-ipc structural lock + full typecheck stay green. rowTypeToMarkupType collapsed to identity (Rule 3 blocking fix — rename removed the literals it compared) |
| Phase 15 (15-02): aggregator threads cost + perimeter is length-only AND a first-class D-02 collision member | rate=opts.rates??store[`${name}|${type}`]??0, cost=rate×qty per row; per-category costSubtotal (Σ row costs) + project grandTotalCost (Σ subtotals), both unit-agnostic single ₱ numbers parallel to the per-UoM quantity subtotals. Perimeter LENGTH add kept verbatim (arc-aware, WR-07 300+π·R intact); area synthesis deleted; nameNonPerimTypes→nameTypes (perimeter skip removed); nonPerimeterTypeWord→typeWord (+ 'perimeter' case) under the unified suffix rule. boq-aggregator/project-serialize/project-schema GREEN; writers/totals-row-rate-edit/use-boq-live correctly still RED (Waves 2/3) |

### Critical Pitfalls to Watch

- **PDF coordinate origin**: PDF origin is bottom-left, canvas is top-left. Always use `viewport.convertToPdfPoint` -- never persist raw canvas pixel coordinates.
- **Markup drift on zoom/pan**: Maintain a single affine transform matrix; never apply scale and translate as independent steps.
- **Rotated pages**: Pages with `/Rotate: 90` swap width/height. Use PDF.js built-ins only -- never implement the transform manually.
- **HiDPI offset**: At 150% display scaling, set canvas dimensions to `cssSize * devicePixelRatio`.
- **Canvas size limit**: Chromium GPU texture cap; cap render scale or implement tiled rendering for A0/A1 at 4x zoom.
- **Scale compounding error**: Display computed scale factor for user confirmation after calibration. Warn on uncalibrated pages.

### Research Flags for Planning

- **Phase 3**: Review Konva polygon close interaction (double-click, ESC cancel), multi-segment polyline mid-point editing, and Konva Transformer widget before writing markup tools.

### Open Questions / Todos

- Verify Chromium 134 (bundled with Electron 35) canvas size limit -- may affect tiled rendering decision
- ~~Verify ExcelJS 4.4.0 compatibility with Node 22 (bundled with Electron 35) before Phase 5~~ â€” **RESOLVED** in 05-RESEARCH.md (round-trip smoke test confirmed: workbook + native-number cells with numFmt + ARGB fills + merged cells + frozen views all work; SUM() works because cells stay native numbers)

### Blockers

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260429-jov | Restore optimizeDeps exclude pdfjs-dist in electron.vite.config.ts | 2026-04-29 | 0442ebc | [260429-jov-restore-optimizedeps-exclude-pdfjs-dist-](./quick/260429-jov-restore-optimizedeps-exclude-pdfjs-dist-/) |
| 260518-k9x | Fix MMB pan broken + LMB rubber-band not selecting (phase 09 regressions) | 2026-05-18 | 0677d9d | [260518-k9x-fix-mmb-pan-and-rubber-band-select](./quick/260518-k9x-fix-mmb-pan-and-rubber-band-select/) |
| 260518-fix | Fix rubber-band click-clears-selection: Konva click after mouseup wipes selection; move rubber-band rect to correct layer; window mouseup cleanup | 2026-05-18 | pending | [260518-fix-rubber-band-click-clears-selection](./quick/260518-fix-rubber-band-click-clears-selection/) |
| 260518-uat | Fix Phase 09 UAT gaps — Test 9 (Ctrl+Z restores selection after delete-undo) + Test 11 (LMB no-pan during markup placement) | 2026-05-18 | 4db36bb | [260518-uat-fix-phase09-uat-gaps](./quick/260518-uat-fix-phase09-uat-gaps/) |
| 260518-rcp | Fix rapid-click drops — switch markup-tool click suppression from sticky-flag to delta-at-click-time (follow-up to 665835f) | 2026-05-18 | a8c37eb | [260518-rcp-fix-rapid-click-drops](./quick/260518-rcp-fix-rapid-click-drops/) |
| 260519-dbl | Remove double-click finish (Linear/Wall/Area/Perimeter); fix finishLinear/finishPolygon error paths to keep mode:'drawing' after degenerate-shape attempt | 2026-05-19 | a0d311c | debug/rapid-click-dblclick-modal.md |
| 260519-drg | Skip 4px drag-suppression guard when markup tool active — rapid clicks while hand moving now all register; guard remains for select mode (rubber-band) | 2026-05-19 | af83fc4 | debug/rapid-click-movement-threshold.md |
| 260520-p2g | Phase 11 gap — Replace ScalePopup tab-switcher with pre-choice gate dialog (Draw line / Type ratio 1:N) | 2026-05-20 | 4ec8846 | [260520-p2g-phase11-prechoice-gate](./quick/260520-p2g-phase11-prechoice-gate/) |
| 260520-rrf | Scrap ratio scale feature — revert to draw-line only; delete ScaleMethodDialog, remove pre-choice CalibMode, clean ScalePopup, strip scale-math ratio exports | 2026-05-20 | 4156dee | [260520-rrf-remove-ratio-feature](./quick/260520-rrf-remove-ratio-feature/) |

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Markup Gap Closure and Visual Redesign (URGENT) â€” supersedes MARK-08 per-category-color must-have, revises UI-SPEC D-04/D-13 count pin label format, closes 4 bugs surfaced in Plan 03-05 human verification (spacebar blocked in text inputs, Linear/Area label legibility, stale currentZoom after zoom)
- Phase 06.1 inserted after Phase 6: Remove Left Thumbnail Strip Panel â€” navigation arrows cover page switching, panel wastes horizontal space (URGENT)
- Phase 7 added: Canvas Workspace UX and Markup Editing Fixes — five live-use delinquencies: full-screen canvas, post-commit markup editing, totals panel redesign, Set Scale modal overflow fix, smart category deduplication (completed 2026-05-13)
- Phase 8 added (2026-05-14): Markup Workflow Acceleration and Wall Measurement Tool — bundles four post-v1 enhancements into a single phase: (1) per-item show/hide visibility toggle in the live totals panel, (2) continuous chain markup mode that keeps name/category/color armed across successive placements, (3) in-app crosshair cursor over the canvas, (4) new wall-area measurement tool (linear length × user-input wall height) reusing the chain pattern from item 2. v1.0 milestone reopened beyond original 25-requirement scope per user decision (chose "Extend v1.0 with Phase 8" over starting v1.1). Open design decisions reserved for `/gsd-discuss-phase 8`: chain-break trigger + visual affordance, varying-ceiling-height strategy, crosshair styling, visibility-state persistence scope.
- Phase 8 completed (2026-05-15): chain markup mode, wall measurement tool, per-item show/hide visibility (hiddenItemSet O(1)), in-app crosshair cursor â€" 4 features across 8 plans, 5 waves. One UAT bug fixed: edit popup missing toolType/initialWallHeight for wall markups (commit 224f867). v1.0 milestone complete â€" all 11 phases done, 64 plans, 25/25 requirements delivered.
- Phase 7.1 inserted after Phase 7 (2026-05-19) and completed (2026-05-19): Resume Markup Group from Totals Panel — one-click totals panel row arms the matching markup tool with that item's name, category, and color; eliminates retyping group names when adding more markups to an existing group. 7 plans across 4 waves; 7/7 UAT scenarios PASS.
- Phase 10 added (2026-05-19): Granular Undo Foundation — Ctrl+Z during in-progress multi-point drawing pops the last placed point; Ctrl+Y re-adds it; first-point Ctrl+Z cancels; post-commit undo/redo unchanged. Sets the step-level undo/redo base for future work.
- Phase 9 added (2026-05-15) and completed (2026-05-18): five UX improvements — click-to-select + Delete-key deletion, rubber-band multi-select with group delete, every modal centred + draggable, 7-tab Office-style ribbon (Home/Page/Tools/View/Estimating/Settings/Help) replacing the flat Toolbar, and Enter / double-click commit for in-progress linear / area / perimeter / wall markups. 6 plans across 3 waves; 12/12 UAT scenarios PASS after two fix loops — quick task 260518-uat (commit 4db36bb) addressed Ctrl+Z selection-restore + LMB-no-pan-during-markup, and debug session lmb-hold-drops-markup-on-release (commit 665835f) added a 4px movement-threshold click-vs-hold gate mirroring the rubber-band suppression pattern. No new v1 requirements (pure quality-of-life). v1.0-extended milestone now reads 12/12 phases, 70/70 plans, 25/25 requirements delivered.
- Phase 14 edited: Dropped Pricing and Item Library; Phase 14 redefined as Markup Geometry Precision (snapping MM-06 + curved-edge measurement MM-05), validated by spikes 002/003/003b. Pricing decisions D-16-D-22 retained in v1.1-CONTEXT.md.

## Session Continuity

**Last activity:** 2026-06-29

**Last session:** 2026-06-29T10:05:20.676Z

**Stopped at:** Completed 15-01 (Wave 0 Nyquist RED surface) — 9 test files (1 new totals-row-rate-edit.test.ts + 8 modified); 22 RED assertions across boq-aggregator/project-serialize/use-boq-live/boq-writers-xlsx/boq-writers-csv mapping to Wave 1-3; tsc clean (0 errors); git grep perimeter-area|perimeter-length src/tests = zero. 3 atomic commits b5a2751/aff8301/5e1bb96.

**Next action:** Run the Phase-14 human UAT (8 hands-on steps mapped to the 5 ROADMAP success criteria — snapping+indicator, instant-at-scale, 3-click arc coexisting with straight, true arc length+signed area, self-intersection blocked + arc round-trips save/reload+BOQ). On "approved", mark ROADMAP Phase 14 [x] + milestone complete in STATE; on failures, gap-closure via /gsd:plan-phase 14 --gaps.

**Note:** Phase 11 (Scale Ratio Input) scrapped — replaced by quick task `260520-rrf` (commit `4156dee`). Phase 13 = v1.1 Phase C from `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` (D-10/D-11/D-12 plus new D-13–D-26 added during planning).

---
*State initialized: 2026-03-25*
*Last updated: 2026-05-22 — Phase 13 complete (post-commit step-level undo; 5 CR/WR fixes applied; VERIFICATION 13/13 PASS; milestone 100% complete)*
