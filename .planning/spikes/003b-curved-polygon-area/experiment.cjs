/*
 * Spike 003b — curved-polygon-area
 * Self-contained, zero-dependency Node experiment.
 *
 * Question: Given a CLOSED area/perimeter markup where one or more boundary
 * EDGES are circular arcs (carrying an on-arc midpoint), can we compute the true
 * enclosed area as:
 *
 *     area = | signedShoelace(vertices)  +  Σ signed circular_segment_area |
 *
 * matching a numerical (dense-boundary shoelace) oracle for BOTH outward- and
 * inward-bulging arcs, mixed straight+arc shapes, with the add/subtract SIGN
 * chosen AUTOMATICALLY?
 *
 * Reuses spike 003's arc solver (3-point circle -> center, radius, sweep, with
 * major/minor disambiguation via the on-arc midpoint). All geometry is in
 * page-space pixel units {x,y}, exactly like the app's polygonArea(points).
 *
 * ---------------------------------------------------------------------------
 * SIGN RULE (derived, used below):
 *
 * 1. Compute the SIGNED shoelace S over the chord polygon (the vertices).
 *    S > 0  => one winding (call it "+"), S < 0 => the other. (In page-space the
 *    y-axis may point down, but the rule is self-consistent: both S and the
 *    chord cross-product use the SAME coordinate system, so the relative
 *    orientation is all that matters.)
 *
 * 2. For an arc edge directed from -> to with on-arc midpoint m, compute the
 *    side of m relative to the directed chord:
 *        cross = (to.x-from.x)*(m.y-from.y) - (to.y-from.y)*(m.x-from.x)
 *    cross tells us which side of the travel direction the bulge sits on.
 *
 * 3. The circular segment area (always a positive magnitude) is
 *        segMag = (R^2 / 2) * (theta - sin(theta))     theta = sweep angle
 *    (valid for theta in (0, 2pi); for theta > pi this is the MAJOR segment and
 *    the same formula holds with the correct theta).
 *
 * 4. SIGNED segment contribution (in the same signed-area convention as 2*S,
 *    i.e. twice the area, to keep one division by 2 at the very end):
 *        contribution = - sign(cross) * (2 * segMag)
 *    Accumulate it into the signed shoelace sum (which we keep as 2*S). WHY this
 *    single rule works automatically for both windings AND both bulge directions
 *    (the leading MINUS was VERIFIED empirically against the dense oracle — see
 *    Results; with a plain +sign(cross) the result is the exact mirror image,
 *    i.e. outward and inward swap):
 *      - The chord polygon's signed area already "cuts the corner" along the
 *        chord. The arc then adds/removes the lune between chord and arc.
 *      - cross > 0 means the on-arc apex lies to the LEFT of the directed chord
 *        from->to. For a polygon whose signed shoelace 2*S has a given sign, an
 *        apex on the side OPPOSITE the interior (OUTWARD bulge) must ENLARGE the
 *        area. In page-space {x,y} that outward case is the one where
 *        sign(cross) is OPPOSITE sign(2*S) — hence subtracting sign(cross)*seg
 *        reinforces |2*S| for outward bulges and reduces it for inward bulges.
 *      - Equivalently: OUTWARD  <=>  sign(cross) != sign(2*S)
 *                      INWARD   <=>  sign(cross) == sign(2*S)
 *    Taking the absolute value at the end makes the result winding-independent:
 *        area = | 2*S  -  Σ sign(cross) * 2 * segMag | / 2
 *    EXACTLY one rule, no per-case branching on outward/inward or CW/CCW.
 * ---------------------------------------------------------------------------
 */

'use strict';

const EPS = 1e-9;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---- spike 003 arc solver (ported verbatim in spirit) ----------------------

function solveCircle(p1, p2, p3) {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const spread = Math.max(dist(p1, p2), dist(p2, p3), dist(p1, p3)) || 1;
  const collinearTol = EPS * spread * spread;

  if (Math.abs(d) <= collinearTol) {
    return { degenerate: true, center: null, radius: Infinity };
  }

  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;

  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  return { degenerate: false, center, radius: dist(center, p1) };
}

// Resolve sweep (radians) of the arc p1 -> p3 that PASSES THROUGH p2.
// Returns { degenerate, center, radius, sweep } where sweep in (0, 2pi).
function solveArc(p1, p2, p3) {
  const circ = solveCircle(p1, p2, p3);
  if (circ.degenerate) {
    return { degenerate: true, center: null, radius: Infinity, sweep: 0 };
  }
  const { center, radius } = circ;
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  const a3 = Math.atan2(p3.y - center.y, p3.x - center.x);

  const ccw = (from, to) => {
    let dd = to - from;
    while (dd < 0) dd += 2 * Math.PI;
    while (dd >= 2 * Math.PI) dd -= 2 * Math.PI;
    return dd;
  };
  const sweepToMid = ccw(a1, a2);
  const sweepToEnd = ccw(a1, a3);

  let sweep, dir;
  if (sweepToMid < sweepToEnd) {
    sweep = sweepToEnd; dir = +1; // CCW arc contains p2
  } else {
    sweep = 2 * Math.PI - sweepToEnd; dir = -1; // CW arc contains p2
  }
  return { degenerate: false, center, radius, sweep, a1, dir };
}

function arcLength(p1, p2, p3) {
  const s = solveArc(p1, p2, p3);
  if (s.degenerate) return dist(p1, p2) + dist(p2, p3);
  return s.radius * s.sweep;
}

// ---------------------------------------------------------------------------
// Curved polygon area — closed form (shoelace + signed segment corrections)
// ---------------------------------------------------------------------------
//
// edges: array of { from:{x,y}, to:{x,y}, mid:{x,y}|null }
//   mid === null  -> straight edge
//   mid present   -> arc edge passing through mid
// The edges form a closed loop (edge[i].to === edge[i+1].from, last.to == first.from).

function curvedPolygonArea(edges) {
  // 1. signed shoelace (accumulate 2*S) over the vertices (chord polygon).
  let twoS = 0;
  for (const e of edges) {
    twoS += e.from.x * e.to.y - e.to.x * e.from.y;
  }

  // 2. add signed segment corrections.
  let twoSegSum = 0;
  for (const e of edges) {
    if (!e.mid) continue;
    const s = solveArc(e.from, e.mid, e.to);
    if (s.degenerate) continue; // near-collinear arc -> straight, no correction
    const { radius: R, sweep: theta } = s;
    const segMag = (R * R / 2) * (theta - Math.sin(theta)); // positive magnitude
    // which side of directed chord from->to does mid sit on?
    const cross =
      (e.to.x - e.from.x) * (e.mid.y - e.from.y) -
      (e.to.y - e.from.y) * (e.mid.x - e.from.x);
    const sgn = cross >= 0 ? +1 : -1;
    // Signed contribution to the doubled signed area (2*S). See SIGN RULE note:
    // when the apex sits on the side OPPOSITE the travel-left for this winding
    // the arc bulges OUTWARD and must enlarge |area|; the cross-product side
    // relates to the shoelace sign with a NET MINUS in this convention (verified
    // empirically + against the dense oracle below), so we subtract sgn*seg.
    twoSegSum -= sgn * 2 * segMag;
  }

  return Math.abs(twoS + twoSegSum) / 2;
}

// Perimeter of the curved polygon: straight edges as chords, arc edges as arc len.
function curvedPolygonPerimeter(edges) {
  let total = 0;
  for (const e of edges) {
    total += e.mid ? arcLength(e.from, e.mid, e.to) : dist(e.from, e.to);
  }
  return total;
}

// Old straight-only polygonArea (mirror of src/renderer/src/lib/markup-math.ts).
function polygonAreaStraight(vertices) {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

// ---------------------------------------------------------------------------
// ORACLE — densify the WHOLE boundary into tiny straight chords, then shoelace.
// Arc edges sampled into `samplesPerArc` points along the TRUE arc.
// ---------------------------------------------------------------------------

function densifyBoundary(edges, samplesPerArc = 2000) {
  const pts = [];
  for (const e of edges) {
    if (!e.mid) {
      pts.push({ x: e.from.x, y: e.from.y }); // start vertex; 'to' begins next edge
      continue;
    }
    const s = solveArc(e.from, e.mid, e.to);
    if (s.degenerate) {
      pts.push({ x: e.from.x, y: e.from.y });
      continue;
    }
    const { center, radius, sweep, a1, dir } = s;
    // sample from a1 (exclusive of end; 'to' is the next edge's start)
    for (let i = 0; i < samplesPerArc; i++) {
      const t = (sweep * i) / samplesPerArc;
      const ang = a1 + dir * t;
      pts.push({ x: center.x + radius * Math.cos(ang), y: center.y + radius * Math.sin(ang) });
    }
  }
  return pts;
}

function shoelaceAbs(pts) {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function densePerimeter(edges, samplesPerArc = 2000) {
  const pts = densifyBoundary(edges, samplesPerArc);
  let total = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    total += dist(pts[i], pts[j]);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (LCG) — NO Math.random
// ---------------------------------------------------------------------------

function makeLCG(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Build an arc edge (from -> to) bulging by a given signed sagitta-ish offset.
// We pick the midpoint of the chord, push it perpendicular by `bulge` (signed),
// then derive the on-arc midpoint that actually lies on the circle through
// from, to with that bulge. Because from/mid/to are co-circular by construction
// (mid IS on the circle: the perpendicular-offset point IS the arc apex), we can
// just use the offset apex directly as the on-arc midpoint.
function makeArcEdge(from, to, bulge) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  let nx = -(to.y - from.y);
  let ny = (to.x - from.x);
  const nlen = Math.hypot(nx, ny) || 1;
  nx /= nlen; ny /= nlen;
  const mid = { x: mx + nx * bulge, y: my + ny * bulge };
  return { from, to, mid };
}

// ---------------------------------------------------------------------------
function fmt(n, d = 6) { return Number(n).toFixed(d); }
const pad = (s, n) => String(s).padEnd(n);

console.log('============================================================');
console.log('Spike 003b — curved-polygon-area');
console.log('============================================================\n');

// --- 1. Randomized batch: closed-form vs dense-boundary oracle ---------------
console.log('[1] Randomized batch — closed-form (shoelace +/- segments) vs dense oracle');
const rng = makeLCG(20260616);
const N = 1000;

let maxRelErr = 0, maxRelCase = null;
let maxInward = 0, maxOutward = 0;
let countInwardArcs = 0, countOutwardArcs = 0;
let countShapesWithInward = 0;

for (let it = 0; it < N; it++) {
  // Random convex-ish base polygon: K vertices on a circle (guarantees a simple,
  // non-self-intersecting chord polygon), random radius/center.
  const K = 3 + Math.floor(rng() * 5); // 3..7 vertices
  const cx = (rng() - 0.5) * 2000;
  const cy = (rng() - 0.5) * 2000;
  const baseR = 200 + rng() * 1500;
  // random distinct sorted angles
  const angs = [];
  for (let i = 0; i < K; i++) angs.push(rng() * 2 * Math.PI);
  angs.sort((a, b) => a - b);
  // randomly reverse winding half the time to exercise both CW & CCW
  const reverse = rng() < 0.5;
  const verts = angs.map((a) => ({ x: cx + baseR * Math.cos(a), y: cy + baseR * Math.sin(a) }));
  if (reverse) verts.reverse();

  // Build edges; randomly make a subset arcs with random signed bulge.
  // Cap bulge magnitude so arcs stay well-behaved (no self-intersection): a
  // fraction of the chord length.
  const edges = [];
  let shapeHasInward = false;
  for (let i = 0; i < verts.length; i++) {
    const from = verts[i];
    const to = verts[(i + 1) % verts.length];
    const chord = dist(from, to);
    if (rng() < 0.6 && chord > 1e-6) {
      // arc edge. Signed bulge: + and - both plenty represented.
      const mag = (0.05 + rng() * 0.45) * chord; // up to ~0.5*chord -> sweep < pi region mostly; allow some bigger
      const signed = (rng() < 0.5 ? +1 : -1) * mag;
      edges.push(makeArcEdge(from, to, signed));
    } else {
      edges.push({ from, to, mid: null });
    }
  }

  const closed = curvedPolygonArea(edges);
  // Dense oracle: 20000 samples/arc. (At 2000/arc the oracle itself carries
  // ~1e-4 discretisation error on small tight shapes; the closed form agrees to
  // ~1e-8 once the oracle is refined — see the diagnostic in Results.)
  const oracle = shoelaceAbs(densifyBoundary(edges, 20000));
  const rel = oracle > 0 ? Math.abs(closed - oracle) / oracle : 0;
  if (rel > maxRelErr) {
    maxRelErr = rel;
    maxRelCase = { closed, oracle, K, reverse };
  }

  // Classify each arc edge as inward/outward (relative to polygon interior) and
  // track worst-case error separately. We re-evaluate the sign vs polygon.
  // Signed shoelace of vertices:
  let twoS = 0;
  for (const e of edges) twoS += e.from.x * e.to.y - e.to.x * e.from.y;
  const windSign = twoS >= 0 ? +1 : -1;
  for (const e of edges) {
    if (!e.mid) continue;
    const cross =
      (e.to.x - e.from.x) * (e.mid.y - e.from.y) -
      (e.to.y - e.from.y) * (e.mid.x - e.from.x);
    const sgn = cross >= 0 ? +1 : -1;
    // Per the verified sign rule: OUTWARD <=> sgn != windSign (apex away from
    // interior enlarges area); INWARD <=> sgn == windSign (apex dips inside).
    if (sgn !== windSign) countOutwardArcs++;
    else { countInwardArcs++; shapeHasInward = true; }
  }
  if (shapeHasInward) countShapesWithInward++;

  // Per-shape error attributed to inward vs outward dominance: if the shape's
  // arcs are predominantly inward, count its error toward inward bucket, etc.
  // (We use the single relErr; bucket by whether shape had any inward arc.)
  if (shapeHasInward) { if (rel > maxInward) maxInward = rel; }
  else { if (rel > maxOutward) maxOutward = rel; }
}

console.log(`    shapes tested            : ${N} (random 3..7-gon, ~60% edges arced, mixed CW/CCW)`);
console.log(`    arc edges  outward / inward : ${countOutwardArcs} / ${countInwardArcs}`);
console.log(`    shapes containing >=1 inward arc : ${countShapesWithInward}`);
console.log(`    MAX relative error (all)     : ${maxRelErr.toExponential(3)}`);
console.log(`    MAX relative error (shapes w/ inward arcs) : ${maxInward.toExponential(3)}`);
console.log(`    MAX relative error (outward-only shapes)   : ${maxOutward.toExponential(3)}`);
console.log(`    worst case: closed=${fmt(maxRelCase.closed, 3)} oracle=${fmt(maxRelCase.oracle, 3)} K=${maxRelCase.K} reversed=${maxRelCase.reverse}`);
console.log('');

// --- 2. Named edge cases ----------------------------------------------------
console.log('[2] Named edge cases (expected vs computed)');
const rows = [];

// (a) Unit-ish square with one OUTWARD semicircular bulge on the top edge.
//     Square side L. Bulge outward => area = L^2 + (1/2)*pi*(L/2)^2.
{
  const L = 100;
  // CCW square in standard coords: (0,0)->(L,0)->(L,L)->(0,L)
  const v = [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: L },
    { x: 0, y: L },
  ];
  // Edge (L,L)->(0,L) is the "top". Outward means bulging to +y (away from interior).
  // semicircle on that edge: apex offset = L/2 outward.
  // Determine outward direction: interior is at y<L, so outward is +y.
  // makeArcEdge offset sign: perpendicular (nx,ny) for from->to where
  // from=(L,L) to=(0,L): dir=(-L,0), normal=(-(0),(-L)) = (0,-L) normalized (0,-1).
  // bulge positive pushes to (0,-1) => -y (INWARD). So outward needs NEGATIVE bulge.
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: null },
    makeArcEdge(v[2], v[3], -L / 2), // outward semicircle, apex at y=L+L/2
    { from: v[3], to: v[0], mid: null },
  ];
  const computed = curvedPolygonArea(edges);
  const oracle = shoelaceAbs(densifyBoundary(edges, 4000));
  const expected = L * L + 0.5 * Math.PI * (L / 2) * (L / 2);
  rows.push({
    name: 'square + OUTWARD semicircle',
    expected, computed, oracle,
  });
}

// (b) Same square with the bulge INWARD => area = L^2 - (1/2)*pi*(L/2)^2.
{
  const L = 100;
  const v = [
    { x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: L }, { x: 0, y: L },
  ];
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: null },
    makeArcEdge(v[2], v[3], +L / 2), // inward semicircle (apex at y=L-L/2)
    { from: v[3], to: v[0], mid: null },
  ];
  const computed = curvedPolygonArea(edges);
  const oracle = shoelaceAbs(densifyBoundary(edges, 4000));
  const expected = L * L - 0.5 * Math.PI * (L / 2) * (L / 2);
  rows.push({
    name: 'square + INWARD semicircle',
    expected, computed, oracle,
  });
}

// (c) Full circle as TWO semicircle edges between two vertices => area -> pi*R^2.
{
  const R = 137;
  const A = { x: -R, y: 0 };
  const B = { x: R, y: 0 };
  // Top semicircle A->B bulging +y (apex (0,R)); bottom semicircle B->A bulging
  // -y (apex (0,-R)). Provide on-arc midpoints directly.
  const edges = [
    { from: A, to: B, mid: { x: 0, y: R } },
    { from: B, to: A, mid: { x: 0, y: -R } },
  ];
  const computed = curvedPolygonArea(edges);
  const oracle = shoelaceAbs(densifyBoundary(edges, 4000));
  const expected = Math.PI * R * R;
  rows.push({ name: 'full circle (2 semicircle edges)', expected, computed, oracle });
}

// (d) Mixed: 2 straight + 2 arc edges. A "stadium-ish" shape:
//     rectangle with two semicircular ends.  width W (straight top/bottom),
//     two semicircle caps radius R = H/2 on left & right.
{
  const W = 200, H = 80; const R = H / 2;
  // vertices (CCW): (0,0)->(W,0)->(W,H)->(0,H)
  const v = [
    { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H },
  ];
  // bottom straight (0,0)->(W,0); right cap (W,0)->(W,H) bulge OUT +x apex (W+R,R);
  // top straight (W,H)->(0,H); left cap (0,H)->(0,0) bulge OUT -x apex (-R, R).
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: { x: W + R, y: R } },
    { from: v[2], to: v[3], mid: null },
    { from: v[3], to: v[0], mid: { x: -R, y: R } },
  ];
  const computed = curvedPolygonArea(edges);
  const oracle = shoelaceAbs(densifyBoundary(edges, 4000));
  // expected = rectangle W*H + two semicircles (= one full circle) pi*R^2
  const expected = W * H + Math.PI * R * R;
  rows.push({ name: 'mixed: 2 straight + 2 arc (stadium)', expected, computed, oracle });
}

// (e) Near-collinear (degenerate) arc edge => falls back to straight (no corr).
{
  const L = 100;
  const v = [
    { x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: L }, { x: 0, y: L },
  ];
  // top edge given an arc midpoint that is essentially ON the chord.
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: null },
    makeArcEdge(v[2], v[3], 1e-7), // negligible bulge -> degenerate solve
    { from: v[3], to: v[0], mid: null },
  ];
  const computed = curvedPolygonArea(edges);
  const oracle = shoelaceAbs(densifyBoundary(edges, 4000));
  const expected = L * L; // straight square
  rows.push({ name: 'near-collinear arc -> straight', expected, computed, oracle });
}

console.log('    ' + pad('case', 36) + pad('expected', 16) + pad('computed', 16) + pad('oracle', 16) + 'relErr(vs exp)');
console.log('    ' + '-'.repeat(110));
let allPass = true;
for (const r of rows) {
  const rel = Math.abs(r.computed - r.expected) / r.expected;
  const ok = rel < 1e-6;
  if (!ok) allPass = false;
  console.log(
    '    ' + pad(r.name, 36) + pad(fmt(r.expected, 4), 16) + pad(fmt(r.computed, 4), 16) +
    pad(fmt(r.oracle, 4), 16) + rel.toExponential(3) + (ok ? '  OK' : '  *** FAIL'),
  );
}
console.log('    ' + '-'.repeat(110));
console.log(`    all named edge cases within 1e-6 of expected: ${allPass ? 'YES' : 'NO'}`);
console.log('');

// --- 3. Perimeter check on the curved shapes --------------------------------
console.log('[3] Perimeter check — sum(straight)+sum(arc) vs dense-boundary length oracle');
{
  const checks = [];
  // reuse the stadium shape (d)
  const W = 200, H = 80; const R = H / 2;
  const v = [
    { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H },
  ];
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: { x: W + R, y: R } },
    { from: v[2], to: v[3], mid: null },
    { from: v[3], to: v[0], mid: { x: -R, y: R } },
  ];
  const cf = curvedPolygonPerimeter(edges);
  const orc = densePerimeter(edges, 4000);
  // expected = 2 straights (W each) + circumference of full circle (2*pi*R)
  const expected = 2 * W + 2 * Math.PI * R;
  checks.push({ name: 'stadium perimeter', cf, orc, expected });

  // full circle perimeter from (c)
  const Rc = 137;
  const A = { x: -Rc, y: 0 }; const B = { x: Rc, y: 0 };
  const cedges = [
    { from: A, to: B, mid: { x: 0, y: Rc } },
    { from: B, to: A, mid: { x: 0, y: -Rc } },
  ];
  checks.push({
    name: 'full circle perimeter',
    cf: curvedPolygonPerimeter(cedges),
    orc: densePerimeter(cedges, 4000),
    expected: 2 * Math.PI * Rc,
  });

  console.log('    ' + pad('case', 26) + pad('closed-form', 16) + pad('oracle', 16) + pad('expected', 16) + 'relErr');
  console.log('    ' + '-'.repeat(90));
  for (const c of checks) {
    const rel = Math.abs(c.cf - c.orc) / c.orc;
    console.log('    ' + pad(c.name, 26) + pad(fmt(c.cf, 4), 16) + pad(fmt(c.orc, 4), 16) +
      pad(fmt(c.expected, 4), 16) + rel.toExponential(3));
  }
}
console.log('');

// --- 4. Gap left by the OLD straight-only polygonArea -----------------------
console.log('[4] Error of the OLD straight-only polygonArea on a representative curved shape');
{
  // Representative: the stadium (rectangle + 2 semicircle caps). The straight-
  // only area sees only the 4 chord vertices => a plain rectangle W*H, missing
  // both caps entirely.
  const W = 200, H = 80; const R = H / 2;
  const v = [
    { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H },
  ];
  const edges = [
    { from: v[0], to: v[1], mid: null },
    { from: v[1], to: v[2], mid: { x: W + R, y: R } },
    { from: v[2], to: v[3], mid: null },
    { from: v[3], to: v[0], mid: { x: -R, y: R } },
  ];
  const trueArea = curvedPolygonArea(edges); // == oracle
  const oldArea = polygonAreaStraight(v);     // chord polygon = rectangle
  const errPct = ((trueArea - oldArea) / trueArea) * 100;
  console.log(`    stadium W=${W} H=${H} (caps R=${R})`);
  console.log(`    true curved area      : ${fmt(trueArea, 3)} px^2`);
  console.log(`    old straight-only area: ${fmt(oldArea, 3)} px^2  (just the rectangle)`);
  console.log(`    UNDER-measurement     : ${fmt(errPct, 3)} %  (gap closed by the correction)`);

  // A milder, more typical case: square with one outward semicircular bulge.
  const L = 100;
  const sv = [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: L }, { x: 0, y: L }];
  const sedges = [
    { from: sv[0], to: sv[1], mid: null },
    { from: sv[1], to: sv[2], mid: null },
    makeArcEdge(sv[2], sv[3], -L / 2),
    { from: sv[3], to: sv[0], mid: null },
  ];
  const sTrue = curvedPolygonArea(sedges);
  const sOld = polygonAreaStraight(sv);
  const sErr = ((sTrue - sOld) / sTrue) * 100;
  console.log(`    (square + 1 outward semicircle) true=${fmt(sTrue, 2)} old=${fmt(sOld, 2)} under=${fmt(sErr, 3)} %`);
}
console.log('');

console.log('============================================================');
console.log('Done.');
console.log('============================================================');
