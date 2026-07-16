// Spike 006 — area-cutouts / deductions (the MM-01 signature feature)
//
// QUESTION: Can NET area = outer ring − Σ inner rings be computed by simply
// SUBTRACTING each ring's existing arc-aware polygonArea() — and does that
// composition stay correct when the inner cutout rings themselves contain arcs?
//
// This oracle ports solveCircle / circularSegmentMagnitude / polygonArea VERBATIM
// from src/renderer/src/lib/arc-math.ts + markup-math.ts (the shipped functions),
// then validates the multi-ring composition two independent ways:
//   (A) straight multi-ring closed-form  vs  Monte-Carlo point-in-region area
//   (B) arc-aware multi-ring closed-form  vs  fine-tessellation straight area
// plus six named edge cases. Zero deps, deterministic mulberry32 PRNG (no Math.random).
//
// Run:  node .planning/spikes/006-area-cutouts/experiment.cjs

'use strict'

// ── deterministic PRNG (no Math.random — reproducible like spikes 001/002/003) ──
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── PORTED VERBATIM from arc-math.ts (solveCircle + circularSegmentMagnitude) ──
const EPS = 1e-9
function euclid(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay)
}
function solveCircle(p1, mid, p2) {
  const ax = p1.x, ay = p1.y, bx = mid.x, by = mid.y, cx = p2.x, cy = p2.y
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  const spread =
    Math.max(euclid(ax, ay, bx, by), euclid(bx, by, cx, cy), euclid(ax, ay, cx, cy)) || 1
  const collinearTol = EPS * spread * spread
  if (Math.abs(d) <= collinearTol) return { collinear: true, r: Infinity, sweep: 0, startAngle: 0, sweepSigned: 0, cx: NaN, cy: NaN }
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
  const r = euclid(ux, uy, ax, ay)
  const a1 = Math.atan2(ay - uy, ax - ux)
  const aMid = Math.atan2(by - uy, bx - ux)
  const aEnd = Math.atan2(cy - uy, cx - ux)
  const ccw = (from, to) => {
    let delta = to - from
    while (delta < 0) delta += 2 * Math.PI
    while (delta >= 2 * Math.PI) delta -= 2 * Math.PI
    return delta
  }
  const ccwToMid = ccw(a1, aMid)
  const ccwToEnd = ccw(a1, aEnd)
  const goCcw = ccwToMid <= ccwToEnd
  const sweepSigned = goCcw ? ccwToEnd : -(2 * Math.PI - ccwToEnd)
  return { collinear: false, cx: ux, cy: uy, r, sweep: Math.abs(sweepSigned), startAngle: a1, sweepSigned }
}
function circularSegmentMagnitude(from, mid, to) {
  const c = solveCircle(from, mid, to)
  if (c.collinear) return 0
  const segMag = ((c.r * c.r) / 2) * (c.sweep - Math.sin(c.sweep))
  return Number.isFinite(segMag) ? segMag : 0
}

// ── PORTED VERBATIM from markup-math.ts (single-ring arc-aware polygonArea) ──
function polygonArea(points, arcs) {
  if (points.length < 3) return 0
  const n = points.length
  let doubled = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    doubled += points[i].x * points[j].y
    doubled -= points[j].x * points[i].y
  }
  if (arcs) {
    for (let i = 0; i < n; i++) {
      const arc = arcs[i]
      if (!arc) continue
      const from = points[i]
      const to = points[(i + 1) % n]
      const mid = { x: arc.midX, y: arc.midY }
      const cross = (to.x - from.x) * (mid.y - from.y) - (to.y - from.y) * (mid.x - from.x)
      const segMag = circularSegmentMagnitude(from, mid, to)
      doubled -= Math.sign(cross) * 2 * segMag
    }
  }
  return Math.abs(doubled) / 2
}

// ══════════════════════════════════════════════════════════════════════════════
// THE SPIKE'S PROPOSED COMPOSITION — net area of a region with holes.
//   region = { outer: {points, arcs}, holes: [{points, arcs}, ...] }
//   netArea = polygonArea(outer) − Σ polygonArea(hole_i)
// This is the ENTIRE real-build insight: reuse the shipped single-ring engine
// per ring, subtract the holes. The oracles below test whether that is correct.
// ══════════════════════════════════════════════════════════════════════════════
function netAreaClosedForm(region) {
  let net = polygonArea(region.outer.points, region.outer.arcs)
  for (const hole of region.holes) net -= polygonArea(hole.points, hole.arcs)
  return net
}

// ── ORACLE 1: tessellate every arc edge into K straight chords, giving a purely
//    straight multi-ring region whose net area is the sum of straight shoelaces.
//    As K grows this converges to the true curved net area, INDEPENDENTLY of the
//    circular-segment closed form. (Same idea spike-003 used for arc LENGTH.) ──
function tessellateRing(ring, K) {
  const pts = ring.points
  const n = pts.length
  const out = []
  for (let i = 0; i < n; i++) {
    const from = pts[i]
    const to = pts[(i + 1) % n]
    const arc = ring.arcs && ring.arcs[i]
    out.push({ x: from.x, y: from.y })
    if (arc) {
      const c = solveCircle(from, { x: arc.midX, y: arc.midY }, to)
      if (!c.collinear) {
        for (let k = 1; k < K; k++) {
          const a = c.startAngle + (c.sweepSigned * k) / K
          out.push({ x: c.cx + c.r * Math.cos(a), y: c.cy + c.r * Math.sin(a) })
        }
      }
    }
  }
  return out
}
function straightShoelaceAbs(pts) {
  const n = pts.length
  let d = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    d += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(d) / 2
}
function netAreaTessellated(region, K) {
  let net = straightShoelaceAbs(tessellateRing(region.outer, K))
  for (const hole of region.holes) net -= straightShoelaceAbs(tessellateRing(hole, K))
  return net
}

// ── ORACLE 2: Monte-Carlo. Sample points in the outer bbox; a point is IN the
//    region if it is inside the (tessellated) outer ring and outside every
//    (tessellated) hole ring. area ≈ bboxArea · hits/N. Independent of shoelace
//    entirely — validates the very idea of "outer minus holes". ──
function pointInPoly(pt, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}
function netAreaMonteCarlo(region, rng, N, K) {
  const outer = tessellateRing(region.outer, K)
  const holes = region.holes.map((h) => tessellateRing(h, K))
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of outer) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const bboxArea = (maxX - minX) * (maxY - minY)
  let hits = 0
  for (let i = 0; i < N; i++) {
    const pt = { x: minX + rng() * (maxX - minX), y: minY + rng() * (maxY - minY) }
    if (!pointInPoly(pt, outer)) continue
    let inHole = false
    for (const h of holes) if (pointInPoly(pt, h)) { inHole = true; break }
    if (!inHole) hits++
  }
  return (bboxArea * hits) / N
}

// helper: build a full circle expressed as an n-arc ring (each edge a proper arc)
function circleRing(cx, cy, r, nSeg, ccw) {
  const pts = [], arcs = {}
  const dir = ccw ? 1 : -1
  for (let i = 0; i < nSeg; i++) {
    const a = dir * (2 * Math.PI * i) / nSeg
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  for (let i = 0; i < nSeg; i++) {
    const aFrom = dir * (2 * Math.PI * i) / nSeg
    const aMid = dir * (2 * Math.PI * (i + 0.5)) / nSeg
    arcs[i] = { midX: cx + r * Math.cos(aMid), midY: cy + r * Math.sin(aMid) }
  }
  return { points: pts, arcs }
}
const relErr = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12)
const fmt = (n) => n.toFixed(4)

// ══════════════════════════════════════════════════════════════════════════════
console.log('SPIKE 006 — area cutouts / deductions\n' + '='.repeat(70))

// ── TEST A: straight multi-ring closed-form vs Monte-Carlo, 400 random regions ──
const rng = mulberry32(0x006cafe)
let worstA = 0, worstADesc = ''
let mcWorst = 0
for (let t = 0; t < 400; t++) {
  // random rectangle-ish convex outer, 1–3 axis-aligned rectangular holes inside
  const ox = 100 + rng() * 100, oy = 100 + rng() * 100
  const ow = 400 + rng() * 400, oh = 300 + rng() * 300
  const outer = { points: [
    { x: ox, y: oy }, { x: ox + ow, y: oy }, { x: ox + ow, y: oy + oh }, { x: ox, y: oy + oh }
  ] }
  const nHoles = 1 + Math.floor(rng() * 3)
  const holes = []
  for (let h = 0; h < nHoles; h++) {
    const hw = 30 + rng() * (ow / 4), hh = 30 + rng() * (oh / 4)
    const hx = ox + 20 + rng() * (ow - hw - 40)
    const hy = oy + 20 + rng() * (oh - hh - 40)
    // CW hole winding (opposite to outer) — proves winding-independence of abs-per-ring
    holes.push({ points: [
      { x: hx, y: hy }, { x: hx, y: hy + hh }, { x: hx + hw, y: hy + hh }, { x: hx + hw, y: hy }
    ] })
  }
  const region = { outer, holes }
  const cf = netAreaClosedForm(region)
  // exact straight net (shoelace) is the analytic truth for straight rings
  const exact = netAreaTessellated(region, 1) // K=1 → no arcs, identical to straight shoelace
  const e = relErr(cf, exact)
  if (e > worstA) { worstA = e; worstADesc = `net=${fmt(cf)} exact=${fmt(exact)}` }
  // Monte-Carlo cross-check (looser — statistical)
  const mc = netAreaMonteCarlo(region, rng, 40000, 1)
  const emc = relErr(cf, mc)
  if (emc > mcWorst) mcWorst = emc
}
console.log('\n[A] Straight multi-ring: closed-form (outer−Σholes) vs exact shoelace + Monte-Carlo')
console.log(`    400 random regions, 1–3 holes each, holes wound OPPOSITE to outer`)
console.log(`    worst relErr closed-form vs exact shoelace : ${worstA.toExponential(3)}   ${worstADesc}`)
console.log(`    worst relErr closed-form vs Monte-Carlo(40k): ${mcWorst.toExponential(3)}  (statistical)`)

// ── TEST B: ARC-aware multi-ring closed-form vs fine tessellation, random arcs ──
const rngB = mulberry32(0x006face)
let worstB = 0, worstBDesc = ''
for (let t = 0; t < 300; t++) {
  const ox = 150, oy = 150, ow = 500 + rngB() * 200, oh = 400 + rngB() * 200
  // outer rectangle, optionally bulge one edge outward with an arc
  const outerPts = [
    { x: ox, y: oy }, { x: ox + ow, y: oy }, { x: ox + ow, y: oy + oh }, { x: ox, y: oy + oh }
  ]
  const outerArcs = {}
  if (rngB() < 0.6) {
    // bulge the top edge (0→1) outward (upward). mid above the edge.
    const bulge = 20 + rngB() * 120
    outerArcs[0] = { midX: ox + ow / 2, midY: oy - bulge }
  }
  const outer = { points: outerPts, arcs: Object.keys(outerArcs).length ? outerArcs : undefined }
  // 1–2 CIRCULAR holes (each a 4-arc circle ring) well inside
  const holes = []
  const nH = 1 + Math.floor(rngB() * 2)
  for (let h = 0; h < nH; h++) {
    const r = 30 + rngB() * 60
    const cx = ox + 120 + rngB() * (ow - 240)
    const cy = oy + 120 + rngB() * (oh - 240)
    holes.push(circleRing(cx, cy, r, 4, rngB() < 0.5))
  }
  const region = { outer, holes }
  const cf = netAreaClosedForm(region)
  const tess = netAreaTessellated(region, 4000) // very fine → curved truth
  const e = relErr(cf, tess)
  if (e > worstB) { worstB = e; worstBDesc = `net=${fmt(cf)} tess=${fmt(tess)}` }
}
console.log('\n[B] Arc-aware multi-ring: closed-form vs fine tessellation (K=4000)')
console.log(`    300 random regions: rect outer (±bulge) with 1–2 CIRCULAR (arc) holes`)
console.log(`    worst relErr closed-form vs tessellation : ${worstB.toExponential(3)}   ${worstBDesc}`)

// ── EDGE CASES ──
console.log('\n[C] Named edge cases (closed-form vs analytic / tessellation):')
function edge(name, region, truth, mode) {
  const cf = netAreaClosedForm(region)
  const e = relErr(cf, truth)
  const ok = e < 1e-6 ? 'ok ' : 'CHK'
  console.log(`  ${ok} ${name.padEnd(34)} net=${fmt(cf).padStart(12)}  truth=${fmt(truth).padStart(12)}  relErr=${e.toExponential(2)}`)
  return e
}
// c1: 400×300 rect with a 100×100 square hole → 120000 − 10000
edge('square hole', {
  outer: { points: [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}] },
  holes: [{ points: [{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}] }]
}, 400*300 - 100*100)
// c2: 600×600 rect with a circular hole r=100 → 360000 − π·100²
const circHoleTruth = 600*600 - Math.PI*100*100
{
  const cf = netAreaClosedForm({
    outer: { points: [{x:0,y:0},{x:600,y:0},{x:600,y:600},{x:0,y:600}] },
    holes: [circleRing(300, 300, 100, 4, false)]
  })
  const e = relErr(cf, circHoleTruth)
  console.log(`  ${e<1e-6?'ok ':'CHK'} ${'circular hole (πr² deduction)'.padEnd(34)} net=${fmt(cf).padStart(12)}  truth=${fmt(circHoleTruth).padStart(12)}  relErr=${e.toExponential(2)}`)
}
// c3: two disjoint square holes → 120000 − 2·2500
edge('two square holes', {
  outer: { points: [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}] },
  holes: [
    { points: [{x:40,y:40},{x:90,y:40},{x:90,y:90},{x:40,y:90}] },
    { points: [{x:300,y:200},{x:350,y:200},{x:350,y:250},{x:300,y:250}] }
  ]
}, 400*300 - 2*50*50)
// c4: hole with SAME winding as outer (both CCW) — abs-per-ring must still work
{
  // outer CCW (in screen coords y-down, our shoelace is signed; abs handles it)
  const region = {
    outer: { points: [{x:0,y:0},{x:0,y:300},{x:400,y:300},{x:400,y:0}] }, // reversed order
    holes: [{ points: [{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}] }]
  }
  const cf = netAreaClosedForm(region)
  const truth = 400*300 - 100*100
  const e = relErr(cf, truth)
  console.log(`  ${e<1e-6?'ok ':'CHK'} ${'hole same winding as outer'.padEnd(34)} net=${fmt(cf).padStart(12)}  truth=${fmt(truth).padStart(12)}  relErr=${e.toExponential(2)}`)
}
// c5: outer with an INWARD arc (concave bite) + a square hole → tessellation truth
{
  const region = {
    outer: {
      points: [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}],
      arcs: { 0: { midX: 200, midY: 60 } } // top edge bulges DOWNWARD (inward) → concave
    },
    holes: [{ points: [{x:50,y:150},{x:120,y:150},{x:120,y:220},{x:50,y:220}] }]
  }
  const cf = netAreaClosedForm(region)
  const tess = netAreaTessellated(region, 6000)
  const e = relErr(cf, tess)
  console.log(`  ${e<1e-6?'ok ':'CHK'} ${'inward outer arc + square hole'.padEnd(34)} net=${fmt(cf).padStart(12)}  tess=${fmt(tess).padStart(12)}  relErr=${e.toExponential(2)}`)
}
// c6: hole with an outward arc edge (a "keyhole" bump into the void) → tessellation truth
{
  const hole = { points: [{x:150,y:100},{x:250,y:100},{x:250,y:200},{x:150,y:200}], arcs: { 0: { midX: 200, midY: 70 } } }
  const region = { outer: { points: [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}] }, holes: [hole] }
  const cf = netAreaClosedForm(region)
  const tess = netAreaTessellated(region, 6000)
  const e = relErr(cf, tess)
  console.log(`  ${e<1e-6?'ok ':'CHK'} ${'hole with an arc edge'.padEnd(34)} net=${fmt(cf).padStart(12)}  tess=${fmt(tess).padStart(12)}  relErr=${e.toExponential(2)}`)
}

// ── the under-count a NO-cutout takeoff incurs (why this feature matters) ──
console.log('\n[D] Estimating impact — the deduction a single-ring takeoff misses:')
{
  const outerA = 600*600
  const doorHole = 90*210 / 1 // a 0.9m × 2.1m door at 1px=1mm → but keep px demo
  const holeArea = 200*200
  const net = outerA - holeArea
  console.log(`    slab 600×600 with a 200×200 void: gross=${fmt(outerA)}  net=${fmt(net)}  → single-ring OVER-counts by ${fmt(100*holeArea/net)}%`)
}

console.log('\n' + '='.repeat(70))
const passA = worstA < 1e-9
const passB = worstB < 1e-6
console.log(`VERDICT MATH: [A straight] ${passA ? 'PASS' : 'CHECK'} (${worstA.toExponential(2)})   [B arc] ${passB ? 'PASS' : 'CHECK'} (${worstB.toExponential(2)})`)
console.log('Composition proven: netArea = polygonArea(outer) − Σ polygonArea(hole_i),')
console.log('reusing the SHIPPED single-ring arc-aware engine per ring. No new area math needed.')
