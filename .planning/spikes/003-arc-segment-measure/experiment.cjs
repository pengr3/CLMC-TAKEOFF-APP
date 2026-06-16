/*
 * Spike 003 — arc-segment-measure
 * Self-contained, zero-dependency Node experiment.
 *
 * Question: Given a curved edge defined by 3 points (start, on-arc, end),
 * can we compute true arc length accurately and fold it into linear/perimeter
 * totals, robustly across edge cases?
 *
 * All geometry is in page-space pixel units (StagePoint {x,y}), exactly like
 * the app's existing polylineLength(points). Arc length comes out in the same
 * pixel units and converts to mm identically (mm = pixelLen / pixelsPerMm).
 */

'use strict';

// ---------------------------------------------------------------------------
// Core geometry
// ---------------------------------------------------------------------------

const EPS = 1e-9;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// Straight (chord/segment) length of a polyline — mirrors existing polylineLength.
function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/*
 * 3-point circle solve via perpendicular-bisector intersection.
 * Returns { degenerate, center, radius } where degenerate=true means the three
 * points are (near-)collinear and no finite circle exists.
 *
 * Uses the signed area of the triangle (the "d" determinant). When the points
 * are collinear the triangle area -> 0 and the circle radius -> infinity, so we
 * test the determinant relative to the point spread to decide degeneracy.
 */
function solveCircle(p1, p2, p3) {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  // d = 2 * signed area of triangle (a,b,c) — zero when collinear.
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  // Scale-aware collinearity test: compare |d| (~2*area) to the squared spread.
  // For a real arc, area grows with the bulge; near-collinear => area ~ 0.
  const spread =
    Math.max(dist(p1, p2), dist(p2, p3), dist(p1, p3)) || 1;
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
  const radius = dist(center, p1);
  return { degenerate: false, center, radius };
}

/*
 * Arc length through 3 points.
 *
 * The arc MUST pass through the middle point p2. We disambiguate major vs minor
 * arc by checking whether p2 lies on the minor arc (the short way from p1 to p3)
 * or the major arc. We do this with cross-product orientation: the arc from p1
 * to p3 that contains p2 is the one whose sweep direction (CW or CCW) keeps p2
 * between p1 and p3 angularly.
 *
 * Returns { mode: 'arc'|'chord', length, radius, center, sweepDeg }.
 */
function arcLength(p1, p2, p3) {
  const circ = solveCircle(p1, p2, p3);
  if (circ.degenerate) {
    // Degenerate / near-collinear: fall back to straight chord through p2.
    return {
      mode: 'chord',
      length: dist(p1, p2) + dist(p2, p3),
      radius: Infinity,
      center: null,
      sweepDeg: 0,
    };
  }

  const { center, radius } = circ;
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  const a3 = Math.atan2(p3.y - center.y, p3.x - center.x);

  // Normalize the CCW sweep from p1 to a target angle into [0, 2π).
  const ccw = (from, to) => {
    let d = to - from;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;
    return d;
  };

  // Going CCW from p1: how far to reach p2, and how far to reach p3.
  const sweepToMid = ccw(a1, a2);
  const sweepToEnd = ccw(a1, a3);

  // If p2 is encountered before p3 while sweeping CCW, the CCW arc p1->p3 passes
  // through p2 => use the CCW sweep. Otherwise the CW arc passes through p2 =>
  // the sweep is the complement (2π - sweepToEnd).
  let sweep;
  if (sweepToMid < sweepToEnd) {
    sweep = sweepToEnd; // CCW arc contains p2
  } else {
    sweep = 2 * Math.PI - sweepToEnd; // CW arc contains p2
  }

  return {
    mode: 'arc',
    length: radius * sweep,
    radius,
    center,
    sweepDeg: (sweep * 180) / Math.PI,
  };
}

/*
 * Numerical-integration oracle: independently estimate arc length by densely
 * sampling the arc into N tiny straight chords and summing them. This does NOT
 * use radius*theta — it walks along the circle, so it cross-checks the closed
 * form. We reconstruct the same sweep that arcLength() chose, then sample it.
 */
function arcLengthNumerical(p1, p2, p3, samples = 200000) {
  const circ = solveCircle(p1, p2, p3);
  if (circ.degenerate) {
    return dist(p1, p2) + dist(p2, p3);
  }
  const { center, radius } = circ;
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  const a3 = Math.atan2(p3.y - center.y, p3.x - center.x);

  const ccw = (from, to) => {
    let d = to - from;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;
    return d;
  };
  const sweepToMid = ccw(a1, a2);
  const sweepToEnd = ccw(a1, a3);

  let sweep, dir;
  if (sweepToMid < sweepToEnd) {
    sweep = sweepToEnd;
    dir = +1; // CCW
  } else {
    sweep = 2 * Math.PI - sweepToEnd;
    dir = -1; // CW
  }

  let total = 0;
  let prev = { x: p1.x, y: p1.y };
  for (let i = 1; i <= samples; i++) {
    const t = (sweep * i) / samples;
    const ang = a1 + dir * t;
    const pt = {
      x: center.x + radius * Math.cos(ang),
      y: center.y + radius * Math.sin(ang),
    };
    total += dist(prev, pt);
    prev = pt;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (LCG) — NO Math.random
// ---------------------------------------------------------------------------

function makeLCG(seed) {
  let state = seed >>> 0;
  return function next() {
    // Numerical Recipes LCG constants.
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296; // [0,1)
  };
}

// Build a random arc by choosing center, radius, and three distinct angles —
// guaranteeing p2 truly lies on the arc between p1 and p3 for that sweep.
function randomArc(rng) {
  const cx = (rng() - 0.5) * 2000;
  const cy = (rng() - 0.5) * 2000;
  const radius = 5 + rng() * 1500;

  const start = rng() * 2 * Math.PI;
  // Sweep anywhere in (0, 2π) to exercise minor AND major arcs.
  const sweep = 0.05 + rng() * (2 * Math.PI - 0.1);
  const dir = rng() < 0.5 ? +1 : -1;

  const ptAt = (frac) => {
    const ang = start + dir * sweep * frac;
    return { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) };
  };
  const p1 = ptAt(0);
  const p2 = ptAt(0.3 + rng() * 0.4); // mid point somewhere inside the sweep
  const p3 = ptAt(1);
  const trueLen = radius * sweep;
  return { p1, p2, p3, trueLen, radius, sweep };
}

// ---------------------------------------------------------------------------
// Run the experiment
// ---------------------------------------------------------------------------

function fmt(n, d = 6) {
  return Number(n).toFixed(d);
}

console.log('============================================================');
console.log('Spike 003 — arc-segment-measure');
console.log('============================================================\n');

// --- 1. Randomized batch: closed-form vs numerical oracle -------------------
console.log('[1] Randomized batch — closed-form (R*theta) vs numerical oracle');
const rng = makeLCG(20260616);
const N = 2000;
let maxRelErr = 0;
let maxRelErrCase = null;
let maxConstructRelErr = 0; // closed-form vs the KNOWN true length from construction
for (let i = 0; i < N; i++) {
  const arc = randomArc(rng);
  const closed = arcLength(arc.p1, arc.p2, arc.p3);
  const numeric = arcLengthNumerical(arc.p1, arc.p2, arc.p3, 100000);

  // closed-form vs numerical integration (independent method)
  const relNum = Math.abs(closed.length - numeric) / numeric;
  if (relNum > maxRelErr) {
    maxRelErr = relNum;
    maxRelErrCase = { closed: closed.length, numeric, sweepDeg: closed.sweepDeg, radius: closed.radius };
  }

  // closed-form vs the analytically-known length we built the arc from
  const relCon = Math.abs(closed.length - arc.trueLen) / arc.trueLen;
  if (relCon > maxConstructRelErr) maxConstructRelErr = relCon;
}
console.log(`    samples: ${N} randomized arcs (minor + major)`);
console.log(`    max relative error  closed-form vs numerical oracle : ${maxRelErr.toExponential(3)}`);
console.log(`    max relative error  closed-form vs known true length : ${maxConstructRelErr.toExponential(3)}`);
console.log(`    worst numerical case: closed=${fmt(maxRelErrCase.closed,4)} numeric=${fmt(maxRelErrCase.numeric,4)} sweep=${fmt(maxRelErrCase.sweepDeg,2)}deg R=${fmt(maxRelErrCase.radius,2)}`);
console.log('');

// --- 2. Edge cases ----------------------------------------------------------
console.log('[2] Edge cases');
const edgeCases = [];

// (a) Near-collinear -> chord fallback
{
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 0.0000001 }; // almost exactly on the line
  const p3 = { x: 200, y: 0 };
  const r = arcLength(p1, p2, p3);
  const chord = dist(p1, p2) + dist(p2, p3);
  edgeCases.push({
    name: 'near-collinear',
    mode: r.mode,
    length: r.length,
    note: `chord(p1->p2->p3)=${fmt(chord, 6)} radius=${r.radius === Infinity ? 'Inf' : fmt(r.radius)}`,
  });
}

// (b) Tiny arc (small radius implied by tiny bulge, small extent)
{
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 1, y: 0.05 };
  const p3 = { x: 2, y: 0 };
  const r = arcLength(p1, p2, p3);
  const num = arcLengthNumerical(p1, p2, p3, 50000);
  edgeCases.push({
    name: 'tiny arc',
    mode: r.mode,
    length: r.length,
    note: `numeric=${fmt(num, 6)} relErr=${(Math.abs(r.length - num) / num).toExponential(2)} R=${fmt(r.radius, 3)} sweep=${fmt(r.sweepDeg, 2)}deg`,
  });
}

// (c) ~Semicircle: p1=(0,0), p3=(100,0), p2 at top => sweep ~180deg
{
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 50, y: 50 };
  const p3 = { x: 100, y: 0 };
  const r = arcLength(p1, p2, p3);
  const num = arcLengthNumerical(p1, p2, p3, 100000);
  const expected = Math.PI * 50; // exact semicircle radius 50
  edgeCases.push({
    name: 'semicircle',
    mode: r.mode,
    length: r.length,
    note: `expected(pi*R=pi*50)=${fmt(expected, 6)} numeric=${fmt(num, 6)} sweep=${fmt(r.sweepDeg, 2)}deg`,
  });
}

// (d) Major / reflex arc: p2 placed so the arc is forced > 180deg.
//     Center at origin, radius 100. p1 and p3 close together (small chord)
//     but p2 on the FAR side => the arc must take the long way (>180deg).
{
  const R = 100;
  const a1 = (10 * Math.PI) / 180;
  const a3 = (-10 * Math.PI) / 180;
  const aMid = Math.PI; // far side
  const p1 = { x: R * Math.cos(a1), y: R * Math.sin(a1) };
  const p3 = { x: R * Math.cos(a3), y: R * Math.sin(a3) };
  const p2 = { x: R * Math.cos(aMid), y: R * Math.sin(aMid) };
  const r = arcLength(p1, p2, p3);
  const num = arcLengthNumerical(p1, p2, p3, 200000);
  edgeCases.push({
    name: 'major/reflex arc',
    mode: r.mode,
    length: r.length,
    note: `numeric=${fmt(num, 6)} relErr=${(Math.abs(r.length - num) / num).toExponential(2)} sweep=${fmt(r.sweepDeg, 2)}deg (>180 expected)`,
  });
}

// (e) Tiny radius (sharp curve)
{
  const R = 0.5;
  const cx = 10, cy = 10;
  const p1 = { x: cx + R, y: cy };
  const p2 = { x: cx, y: cy + R };
  const p3 = { x: cx - R, y: cy };
  const r = arcLength(p1, p2, p3);
  const num = arcLengthNumerical(p1, p2, p3, 100000);
  edgeCases.push({
    name: 'tiny radius',
    mode: r.mode,
    length: r.length,
    note: `expected(pi*R=pi*0.5)=${fmt(Math.PI * R, 6)} numeric=${fmt(num, 6)} R=${fmt(r.radius, 4)} sweep=${fmt(r.sweepDeg, 2)}deg`,
  });
}

// (f) Exactly collinear (true degenerate)
{
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 50, y: 0 };
  const p3 = { x: 100, y: 0 };
  const r = arcLength(p1, p2, p3);
  edgeCases.push({
    name: 'exactly collinear',
    mode: r.mode,
    length: r.length,
    note: `radius=${r.radius === Infinity ? 'Inf' : fmt(r.radius)} (chord fallback expected)`,
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log('    ' + pad('case', 20) + pad('mode', 8) + pad('length', 14) + 'detail');
console.log('    ' + '-'.repeat(90));
for (const e of edgeCases) {
  console.log('    ' + pad(e.name, 20) + pad(e.mode, 8) + pad(fmt(e.length, 6), 14) + e.note);
}
console.log('');

// --- 3. Straight-line under-measurement for a representative curve ----------
console.log('[3] Under-measurement of a straight-line takeoff (representative curve)');
{
  // A representative curved wall: a quarter-circle-ish bend, radius 2000px,
  // 90deg sweep. A pure-straight takeoff would measure the chord p1->p3.
  const R = 2000;
  const a1 = 0;
  const a3 = Math.PI / 2;
  const aMid = Math.PI / 4;
  const c = { x: 0, y: 0 };
  const p1 = { x: c.x + R * Math.cos(a1), y: c.y + R * Math.sin(a1) };
  const p2 = { x: c.x + R * Math.cos(aMid), y: c.y + R * Math.sin(aMid) };
  const p3 = { x: c.x + R * Math.cos(a3), y: c.y + R * Math.sin(a3) };

  const arc = arcLength(p1, p2, p3);
  const chord = dist(p1, p3); // what a 2-point straight takeoff would record
  const underPct = ((arc.length - chord) / arc.length) * 100;
  console.log(`    quarter-circle R=${R}px, sweep=${fmt(arc.sweepDeg, 1)}deg`);
  console.log(`    true arc length   : ${fmt(arc.length, 3)} px`);
  console.log(`    straight chord    : ${fmt(chord, 3)} px`);
  console.log(`    under-measurement : ${fmt(underPct, 3)} %  (straight-line takeoff loses this much)`);

  // Also a gentler, very common 30deg bend.
  const a3b = Math.PI / 6;
  const aMidb = Math.PI / 12;
  const q1 = p1;
  const q2 = { x: c.x + R * Math.cos(aMidb), y: c.y + R * Math.sin(aMidb) };
  const q3 = { x: c.x + R * Math.cos(a3b), y: c.y + R * Math.sin(a3b) };
  const arcB = arcLength(q1, q2, q3);
  const chordB = dist(q1, q3);
  const underB = ((arcB.length - chordB) / arcB.length) * 100;
  console.log(`    (gentle 30deg bend R=${R}px) arc=${fmt(arcB.length, 2)} chord=${fmt(chordB, 2)} under=${fmt(underB, 3)} %`);
}
console.log('');

// --- 4. Mixed polyline: straight segments + one arc segment ----------------
console.log('[4] Mixed polyline — straight segments + one arc segment');
{
  /*
   * Data model sketch for the real app: a polyline carries an array of vertices.
   * Each *segment* (vertex i -> i+1) may optionally be an arc, carrying its mid
   * point. Here we model that with an optional `arcMid` on a segment.
   *
   * vertices: A -> B -> C -> D
   *   A->B : straight
   *   B->C : ARC (bulges out, mid point Bc)
   *   C->D : straight
   */
  const A = { x: 0, y: 0 };
  const B = { x: 1000, y: 0 };
  const C = { x: 1000, y: 1000 };
  const D = { x: 2000, y: 1000 };

  // Arc on B->C: bulge to the right. Mid point chosen on a circle.
  const Bc = { x: 1300, y: 500 };

  const segments = [
    { from: A, to: B, arcMid: null },
    { from: B, to: C, arcMid: Bc },
    { from: C, to: D, arcMid: null },
  ];

  let total = 0;
  let straightOnly = 0;
  const rows = [];
  for (const s of segments) {
    let segLen, kind, detail;
    if (s.arcMid) {
      const r = arcLength(s.from, s.arcMid, s.to);
      segLen = r.length;
      kind = r.mode === 'arc' ? 'ARC' : 'arc->chord';
      detail = `R=${fmt(r.radius, 1)} sweep=${fmt(r.sweepDeg, 1)}deg`;
    } else {
      segLen = dist(s.from, s.to);
      kind = 'straight';
      detail = '';
    }
    const chordLen = dist(s.from, s.to);
    total += segLen;
    straightOnly += chordLen;
    rows.push({ kind, segLen, chordLen, detail });
  }

  console.log('    ' + pad('segment', 12) + pad('len(true)', 14) + pad('len(straight)', 16) + 'detail');
  console.log('    ' + '-'.repeat(70));
  rows.forEach((r) => {
    console.log('    ' + pad(r.kind, 12) + pad(fmt(r.segLen, 3), 14) + pad(fmt(r.chordLen, 3), 16) + r.detail);
  });
  console.log('    ' + '-'.repeat(70));
  console.log('    ' + pad('TOTAL', 12) + pad(fmt(total, 3), 14) + pad(fmt(straightOnly, 3), 16));
  const under = ((total - straightOnly) / total) * 100;
  console.log(`    arc-aware total = sum(straight) + arc = ${fmt(total, 3)} px`);
  console.log(`    pure-straight polylineLength would report ${fmt(straightOnly, 3)} px (under by ${fmt(under, 3)} %)`);
}
console.log('');

console.log('============================================================');
console.log('Done.');
console.log('============================================================');
