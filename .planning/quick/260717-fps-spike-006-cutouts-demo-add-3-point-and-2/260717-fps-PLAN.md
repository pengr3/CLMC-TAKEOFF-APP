---
phase: quick-260717-fps
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/spikes/006-area-cutouts/index.html
  - .planning/spikes/006-area-cutouts/README.md
  - .planning/spikes/MANIFEST.md
autonomous: true
requirements: [MM-01]

must_haves:
  truths:
    - "The user can reach three circle-cutout input sub-modes: 3-point (rim), 2-point (diameter), center-radius"
    - "3-point mode derives the exact center + radius from three rim clicks via the ported solveCircle; three (near-)collinear clicks are rejected (no circle committed)"
    - "2-point mode places a circle whose center is the midpoint of the two clicks and whose radius is half the span"
    - "center-radius mode still works exactly as before (first click = center, second sets radius)"
    - "A live candidate circle re-solves on every mousemove and previews before commit in all three modes"
    - "A committed circle cutout is stored as {type:'circle',cx,cy,r} → area = π·r² and NET recomputes"
    - "The readout reports inside diameter (⌀ = 2·r) for circle cutouts"
    - "The forensic log records each rim/center point placement AND the derived center/radius/diameter on commit"
    - "Everything previously working is preserved: Draw Area, poly cutouts, even-odd punch-out, NET recompute, BLOCK-vs-CLIP amber warning, Export, Clear, Enter/Esc/Backspace"
  artifacts:
    - path: ".planning/spikes/006-area-cutouts/index.html"
      provides: "Three-sub-mode circle cutout input with verbatim solveCircle port, live preview, inside-diameter readout, forensic logging"
      contains: "function solveCircle"
    - path: ".planning/spikes/006-area-cutouts/README.md"
      provides: "Updated feel-demo description covering all three circle-input methods (feel still PENDING)"
      contains: "3-point"
    - path: ".planning/spikes/MANIFEST.md"
      provides: "006 row reflecting the three circle-input methods if it references circle input"
  key_links:
    - from: ".planning/spikes/006-area-cutouts/index.html (click handler, holeCircle branch)"
      to: "solveCircle(p1,p2,p3)"
      via: "3-point commit derives center/radius"
      pattern: "solveCircle\\("
    - from: "sub-mode selector buttons (data-cmode)"
      to: "S.circleMode"
      via: "setCircleMode toggler"
      pattern: "data-cmode|circleMode"
    - from: "mousemove handler"
      to: "candidate circle re-solve + draw()"
      via: "live preview per sub-mode"
      pattern: "candidateCircle|circlePts"
---

<objective>
Improve the spike-006 area-cutouts feel demo by generalising its single circle-cutout gesture (center-then-radius) into THREE selectable input sub-modes, so the human can feel-test which precise-center method wins:

- **3-point (rim)** — PRIMARY. Click three points on the bore rim; the exact center + radius are derived via the ported `solveCircle`, dissolving the "where is the exact center?" problem.
- **2-point (diameter)** — the fast alternative. Two clicks; center = midpoint, r = half the span.
- **center-radius** — the existing method, kept as a third selectable sub-mode.

Purpose: this is throwaway, self-contained, offline SPIKE work (post-Phase-18 markup-gaps). It proves the *feel* of circle-cutout input; the underlying math is already VALIDATED (solveCircle → ~1e-10 in spike-003/arc-math). NOTHING in production `src/` changes — the `solveCircle` port is COPIED into the demo, never imported.

Output: an updated single-file `index.html` demo exercising all three methods with live preview, inside-diameter readout, and forensic logging; plus README/MANIFEST doc updates that keep the feel-test honestly PENDING.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/spikes/CONVENTIONS.md

# The demo to modify — study its state machine, click handler (holeCircle branch ~219-228),
# draw() circle-draft preview (~191-195), recompute() readout, keyboard, setMode, clear.
@.planning/spikes/006-area-cutouts/index.html

# The verdict/results to update.
@.planning/spikes/006-area-cutouts/README.md

# One-row-per-spike index — update the 006 row only if it references circle input.
@.planning/spikes/MANIFEST.md

# VERBATIM solveCircle port lives here at lines 80-95 (EPS, dist, solveCircle). COPY this exact
# block into the demo. Also shows the live re-solve-on-mousemove pattern (008 proved it is free).
@.planning/spikes/008-live-readout/index.html

<interfaces>
<!-- The solveCircle contract the demo consumes. COPY the ported version from 008 (lines 80-95);
     DO NOT import from src/. For a FULL circle only {collinear, cx, cy, r} are used — sweep /
     startAngle / sweepSigned are irrelevant here. Signature (from src/renderer/src/lib/arc-math.ts):

     solveCircle(p1, mid, p2) -> { collinear:boolean, cx, cy, r, startAngle, sweepSigned, sweep }
       - collinear:true when the three points are (near-)collinear (scale-aware EPS test) → reject.
       - cx, cy : circle center (page-space px).  r : radius (px).
     For 3 rim points clicked in order p1,p2,p3 → call solveCircle(p1, p2, p3); use cx, cy, r. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generalise the circle tool into three input sub-modes (state + selector + click/commit + keyboard)</name>
  <files>.planning/spikes/006-area-cutouts/index.html</files>
  <action>
Copy the VERBATIM solveCircle port from `.planning/spikes/008-live-readout/index.html` lines 80-95 (the `EPS`, `dist`, and `solveCircle` block) into the demo's math section near `shoelaceAbs` (~line 77). Do NOT re-implement it; do NOT import from `src/`.

Replace the single circle-draft state with a general model. In `S` (~line 84): remove `circleDraft: null`; add `circlePts: []` (placed points for the in-progress circle) and `circleMode: '3pt'` (default sub-mode — 3-point is the PRIMARY precise-center method per the locked decision). Update EVERY existing reference to `S.circleDraft` (in `draw()` ~191-195, `mousemove` ~210, the `holeCircle` click branch ~219-228, the keyboard handler ~254, `setMode` ~258, and `clear` ~264) so no dangling `circleDraft` remains — reset `circlePts` wherever `circleDraft` was reset.

Add a sub-mode selector to the Mode section (after the `#mHoleCircle` button ~line 56): three buttons with `data-cmode` attributes labelled "3-pt (rim)", "2-pt (⌀)", and "center-radius", plus a `setCircleMode(m)` toggler mirroring the existing `setMode`/`data-mode` pattern (toggle `.on`, set `S.circleMode`, reset `S.circlePts`, log the change, redraw, update hint). The sub-row must be visible ONLY when `S.mode === 'holeCircle'` (show/hide by toggling display when mode changes) and default to the '3pt' button active.

Add a helper `candidateCircle(useCursor)` that returns the circle the current `S.circlePts` (plus, when `useCursor` is true, `S.cursor` as the trailing point) imply, or null:
  - '3pt': needs ≥2 placed points; call `solveCircle(pts[0], pts[1], pts[2] || cursor)`; return null if fewer than 2 points or if the solve returns `collinear`; otherwise return {cx,cy,r}.
  - '2pt': needs ≥1 placed point; a = pts[0], b = pts[1] || cursor; cx=(a.x+b.x)/2, cy=(a.y+b.y)/2, r=dist(a,b)/2.
  - 'center': needs ≥1 placed point; cx=pts[0].x, cy=pts[0].y, r=dist(pts[0], pts[1] || cursor).

Rewrite the `holeCircle` click branch (~219-228): guard that the area is drawn first (keep existing warn). Push the clicked point to `S.circlePts` and log the placement (e.g. for 3-pt/2-pt "rim pt N @ x,y", for center-radius "circle centre set" then "radius point"). Define reqCount = (S.circleMode === '3pt') ? 3 : 2. When `S.circlePts.length` reaches reqCount, compute the final circle via `candidateCircle(false)` (placed points only, no cursor): if it returns null in '3pt' mode (collinear), pop the just-placed point, set a "points nearly collinear — no circle" hint/warn, and do NOT commit; otherwise push `{type:'circle', cx, cy, r}` to `S.holes`, reset `S.circlePts`, call `logNet()`, and log the derived center/radius/inside-diameter (Task 2 wires the exact message + ⌀).

Update the keyboard handler (~252-256): Esc must reset BOTH `S.draft` and `S.circlePts` (cancel any in-progress circle). Backspace must undo the last rim/center point when `S.circlePts.length` is non-zero (pop + log), falling back to the existing draft-vertex undo. Enter keeps its poly/area behaviour (it does not commit a circle — circles commit on reaching reqCount).

Preserve every existing behaviour: Draw Area, poly cutouts, even-odd punch-out render, NET recompute, BLOCK-vs-CLIP amber warning, Export, Clear. Keep it ONE self-contained index.html — inline CSS+JS, plain Canvas 2D, no imports, no CDNs, no web fonts.
  </action>
  <verify>
    <automated>rg -c "function solveCircle|data-cmode|S.circleMode|S.circlePts|candidateCircle" ".planning/spikes/006-area-cutouts/index.html" && ! rg -q "circleDraft" ".planning/spikes/006-area-cutouts/index.html" && echo OK</automated>
    <human-check>Open index.html, draw an area, activate ◯ Cutout (circle): all three sub-mode buttons appear and switch; 3-pt commits on the 3rd rim click; 2-pt commits on the 2nd click; center-radius still works; Esc cancels an in-progress circle; Backspace undoes the last rim point.</human-check>
  </verify>
  <done>solveCircle is ported verbatim; the three sub-modes are reachable and each commits a {type:'circle',cx,cy,r} hole (3-pt via solveCircle, rejecting collinear; 2-pt via midpoint+half-span; center-radius unchanged); no `circleDraft` reference remains; Esc/Backspace behave sensibly in the multi-click modes.</done>
</task>

<task type="auto">
  <name>Task 2: Live preview, inside-diameter readout, and forensic logging for circle cutouts</name>
  <files>.planning/spikes/006-area-cutouts/index.html</files>
  <action>
Replace the old circle-draft preview block in `draw()` (~191-195) with a general live preview driven by `candidateCircle(true)` (uses the placed points plus the hovering cursor as the trailing point). When it returns a circle, stroke it dashed in the hole colour (`#ff7a7d`, `setLineDash([4,3])`) and draw a small dot at each already-placed point in `S.circlePts`; reset the dash afterward. This gives: 3-pt → after 2 rim points the candidate circle follows the cursor to the 3rd; 2-pt → after 1 point the diameter circle follows the cursor; center-radius → the existing radius-drag feel. When `candidateCircle(true)` returns null (e.g. 3-pt with a collinear cursor position), draw only the placed dots (no circle) so the "nearly collinear" state reads visually.

Confirm the `mousemove` handler (~210) triggers a redraw while a circle is in progress: its condition must fire when `S.circlePts.length` is non-zero (in addition to the existing `S.draft.length`). 008 proved per-mousemove re-solve is free — do NOT throttle.

Update `updateHint()` (~198-206) for the holeCircle mode so the hint text names the active sub-mode AND the number of clicks it expects: 3-pt → "click THREE points on the rim"; 2-pt → "click the two ends of a diameter"; center-radius → "click the centre, then the radius". Advance the hint as points accumulate (e.g. "1 of 3 rim points placed…"), and surface the "points nearly collinear — no circle" message when a 3-pt commit is rejected.

Add inside diameter to the circle cutout readout in `recompute()` (~135-150): for holes where `h.type === 'circle'`, include `⌀ = 2·r` converted to metres (`(2*h.r)/PX_PER_M`) in that hole's row alongside its area (e.g. "− cutout N (circle)  ⌀ 0.500 m   0.196 m²"). Poly cutouts keep their existing row.

Wire the forensic commit log (from Task 1's commit path) to record the derived geometry, e.g. `3-pt circle solved c=(cx,cy) r=… px  ⌀=… m → …m²` (and the analogous line for 2-pt / center-radius). Keep the per-point placement logs from Task 1. The Export summary already carries per-hole `type`/`area_m2`/`insideOuter` — leave that intact (⌀ is derivable from area, no schema change needed).
  </action>
  <verify>
    <automated>rg -c "candidateCircle\(true\)|⌀|circle solved|circlePts.length" ".planning/spikes/006-area-cutouts/index.html" && echo OK</automated>
    <human-check>Open index.html: in each sub-mode a candidate circle previews live under the cursor before commit; the readout row for a committed circle shows its inside diameter (⌀ … m); the forensic log shows each rim/centre point placement and a "…circle solved c=… r=… ⌀=…" line on commit; NET area updates.</human-check>
  </verify>
  <done>All three sub-modes show a live re-solved preview on mousemove; the readout reports inside diameter (⌀ = 2r) for circle cutouts; the forensic log records point placements and the derived center/radius/diameter on commit; hint text states the click count per sub-mode.</done>
</task>

<task type="auto">
  <name>Task 3: Update README.md and MANIFEST.md (feel-test stays PENDING)</name>
  <files>.planning/spikes/006-area-cutouts/README.md, .planning/spikes/MANIFEST.md</files>
  <action>
Update `.planning/spikes/006-area-cutouts/README.md`:
  - In "How to Run" / "What to Expect", note the demo now exercises THREE circle-cutout input methods — 3-point (rim, derives exact center via solveCircle), 2-point (diameter), and center-radius — reachable via a sub-mode selector when the circle tool is active.
  - Add a short line under Results (or a new "Circle input methods (feel)" note) recording that the three methods are built and self-contained but the feel is still PENDING a human open-and-try — do NOT claim the feel is VALIDATED. Keep the existing verdict `VALIDATED (math) · PENDING human feel-test (demo)` accurate.
  - Document (do NOT build) the snapping caveat from the locked decisions: circle rim points are placed by eye at zoom — snapping is markup-to-markup, not raster-edge; there is no auto edge-grab of a scanned bore rim. Add it alongside the existing "Open build decisions surfaced" list.

Update `.planning/spikes/MANIFEST.md`: touch the 006 row ONLY if it references circle input. It currently reads "…Interactive `index.html` built (feel pending…". Extend that clause to note the demo now offers three circle-input methods (3-pt rim / 2-pt diameter / center-radius) with the feel still pending — keep the row to one line and preserve the existing math finding.

Do NOT touch any production `src/` file, and do NOT add a verify.cjs (out of scope for this quick pass).
  </action>
  <verify>
    <automated>rg -c "3-point|3-pt" ".planning/spikes/006-area-cutouts/README.md" && rg -q "PENDING" ".planning/spikes/006-area-cutouts/README.md" && rg -c "three circle-input|3-pt" ".planning/spikes/MANIFEST.md" && echo OK</automated>
    <human-check>README describes all three input methods and keeps the feel PENDING; the snapping caveat is documented; the MANIFEST 006 row mentions the three methods in one line.</human-check>
  </verify>
  <done>README.md reflects the three circle-input methods with the feel-test honestly PENDING and the markup-to-markup snapping caveat documented; the MANIFEST 006 row references the three methods; no src/ files and no verify.cjs touched.</done>
</task>

</tasks>

<threat_model>
Self-contained, offline, throwaway spike demo. No package installs (no npm/pip/cargo), no network I/O, no external services, no production code paths. There is no trust boundary crossed and no persisted state beyond a user-initiated JSON export.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-SC | Tampering | package installs | accept | No installs occur — the demo is a single offline index.html with inline JS, no CDNs, no dependencies. |
</threat_model>

<verification>
- `rg "circleDraft" .planning/spikes/006-area-cutouts/index.html` returns nothing (state fully generalised).
- `rg "function solveCircle" .planning/spikes/006-area-cutouts/index.html` matches (verbatim port copied, not imported).
- No `import` / CDN `<script src=...>` / web-font reference added to index.html (offline, double-click-openable).
- No file under `src/` is modified.
- Human feel-test (PENDING, per spike verdict discipline): open index.html, draw an area, and exercise 3-pt / 2-pt / center-radius circle cutouts.
</verification>

<success_criteria>
- All three circle-cutout input sub-modes (3-point rim, 2-point diameter, center-radius) are reachable and clearly labelled, and each commits a `{type:'circle',cx,cy,r}` hole → area = π·r², with NET recompute.
- 3-point mode derives the center/radius via the ported `solveCircle` and rejects (near-)collinear clicks without committing.
- A live candidate circle re-solves on every mousemove and previews before commit in all three modes.
- The readout reports inside diameter (⌀ = 2·r) for circle cutouts; the forensic log records point placements and the derived center/radius/diameter on commit.
- Every prior behaviour is preserved (Draw Area, poly cutouts, even-odd punch-out, NET, BLOCK-vs-CLIP amber warning, Export, Clear, Enter/Esc/Backspace).
- README.md and MANIFEST.md reflect the three methods with the feel-test honestly PENDING; the demo remains one self-contained offline index.html; no src/ change.
</success_criteria>

<output>
Create `.planning/quick/260717-fps-spike-006-cutouts-demo-add-3-point-and-2/260717-fps-SUMMARY.md` when done.
</output>
