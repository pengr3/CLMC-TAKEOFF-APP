/* Spike 002 — snapping-engine
 * Self-contained, ZERO external deps. Run: node experiment.cjs
 *
 * Goal: prove a uniform spatial grid hash finds the nearest snap candidate
 * within a zoom-compensated screen-space tolerance in well under a frame
 * budget, at scale (N up to 50k vertices), and that it matches brute force.
 *
 * Coordinate model matches the app: page-space StagePoint {x, y} (numbers).
 * Tolerance is SCREEN px / zoom => page-space radius.
 */

'use strict';

// ---------------------------------------------------------------------------
// Deterministic PRNG — Mulberry32-style LCG. No Math.random anywhere.
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Page / tolerance / zoom config (realistic)
// ---------------------------------------------------------------------------
const PAGE_W = 5000; // page-space units (x)
const PAGE_H = 4000; // page-space units (y)
const SCREEN_TOL_PX = 12; // fixed screen-space snap tolerance
const ZOOM = 1.0; // current stage zoom; page tol = SCREEN_TOL_PX / ZOOM
const PAGE_TOL = SCREEN_TOL_PX / ZOOM; // page-space snap radius
const QUERIES = 10000; // mousemove-rate query batch size

// ---------------------------------------------------------------------------
// Data generation (deterministic)
// ---------------------------------------------------------------------------
function genVertices(n, seed) {
  const rng = makeRng(seed);
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    pts[i] = { x: rng() * PAGE_W, y: rng() * PAGE_H };
  }
  return pts;
}

function genQueries(n, seed) {
  const rng = makeRng(seed);
  const qs = new Array(n);
  for (let i = 0; i < n; i++) {
    qs[i] = { x: rng() * PAGE_W, y: rng() * PAGE_H };
  }
  return qs;
}

// Build REALISTIC polyline segments: in a real takeoff, a polyline/wall is a
// chain of vertices placed near one another (short segments), not random
// endpoints spanning the whole page. We synthesise N short segments by random
// walk: pick a seed point, then step by a small delta to the next vertex.
// Segment lengths stay in the 20-120 page-unit range (realistic wall runs at
// this page scale), so each segment's tol-padded bbox covers only a few cells.
function genSegments(n, seed) {
  const rng = makeRng(seed);
  const segs = [];
  let cx = rng() * PAGE_W;
  let cy = rng() * PAGE_H;
  let runLeft = 3 + Math.floor(rng() * 8); // 3..10 verts per polyline
  for (let s = 0; s < n; s++) {
    if (runLeft <= 0) {
      // start a new polyline somewhere else on the page
      cx = rng() * PAGE_W;
      cy = rng() * PAGE_H;
      runLeft = 3 + Math.floor(rng() * 8);
    }
    const ang = rng() * Math.PI * 2;
    const len = 20 + rng() * 100; // 20..120 units
    const nx = Math.min(PAGE_W, Math.max(0, cx + Math.cos(ang) * len));
    const ny = Math.min(PAGE_H, Math.max(0, cy + Math.sin(ang) * len));
    segs.push({ a: { x: cx, y: cy }, b: { x: nx, y: ny }, i: s });
    cx = nx;
    cy = ny;
    runLeft--;
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Uniform spatial grid hash
// ---------------------------------------------------------------------------
function makeGrid(cellSize) {
  const buckets = new Map(); // key "cx,cy" -> array of indices
  function key(cx, cy) {
    return cx + ',' + cy;
  }
  function cellOf(x, y) {
    return [Math.floor(x / cellSize), Math.floor(y / cellSize)];
  }
  return {
    cellSize,
    buckets,
    key,
    cellOf,
    insert(x, y, payload) {
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const k = key(cx, cy);
      let arr = buckets.get(k);
      if (!arr) {
        arr = [];
        buckets.set(k, arr);
      }
      arr.push(payload);
    },
  };
}

function buildPointGrid(points, cellSize) {
  const grid = makeGrid(cellSize);
  for (let i = 0; i < points.length; i++) {
    grid.insert(points[i].x, points[i].y, i);
  }
  return grid;
}

// Nearest vertex within tolerance using the grid (scan 3x3 neighbourhood).
// Requires cellSize >= tolerance for 3x3 to be exhaustive within radius.
function gridNearestVertex(grid, points, qx, qy, tol) {
  const cs = grid.cellSize;
  const cx = Math.floor(qx / cs);
  const cy = Math.floor(qy / cs);
  const tol2 = tol * tol;
  let bestIdx = -1;
  let bestD2 = tol2;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const arr = grid.buckets.get(gx + ',' + gy);
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        const p = points[arr[j]];
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestIdx = arr[j];
        }
      }
    }
  }
  return bestIdx;
}

function bruteNearestVertex(points, qx, qy, tol) {
  const tol2 = tol * tol;
  let bestIdx = -1;
  let bestD2 = tol2;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - qx;
    const dy = points[i].y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Nearest point ON a segment (perpendicular projection)
// ---------------------------------------------------------------------------
function distToSegment2(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const vv = vx * vx + vy * vy;
  let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cxp = ax + t * vx;
  const cyp = ay + t * vy;
  const dx = px - cxp;
  const dy = py - cyp;
  return dx * dx + dy * dy;
}

// CORRECT segment index: insert each segment into EVERY cell its (tol-padded)
// bounding box overlaps. This guarantees that any query within `tol` of the
// segment lands in a cell that contains the segment id — so a single-cell
// query (the cell under the cursor) is exhaustive. Indexing only endpoints
// (the naive approach) misses long segments that cross a cell with both
// endpoints far away — proven below by an `endpointOnly` comparison build.
function buildSegmentGrid(segments, cellSize, tol) {
  const grid = makeGrid(cellSize);
  const pad = tol; // pad bbox by tolerance so near-misses still register
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const minX = Math.min(seg.a.x, seg.b.x) - pad;
    const maxX = Math.max(seg.a.x, seg.b.x) + pad;
    const minY = Math.min(seg.a.y, seg.b.y) - pad;
    const maxY = Math.max(seg.a.y, seg.b.y) + pad;
    const c0x = Math.floor(minX / cellSize);
    const c1x = Math.floor(maxX / cellSize);
    const c0y = Math.floor(minY / cellSize);
    const c1y = Math.floor(maxY / cellSize);
    for (let gx = c0x; gx <= c1x; gx++) {
      for (let gy = c0y; gy <= c1y; gy++) {
        const k = gx + ',' + gy;
        let arr = grid.buckets.get(k);
        if (!arr) {
          arr = [];
          grid.buckets.set(k, arr);
        }
        arr.push(s);
      }
    }
  }
  return grid;
}

// Naive endpoint-only index — kept to demonstrate the correctness failure.
function buildSegmentGridEndpointOnly(segments, cellSize) {
  const grid = makeGrid(cellSize);
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    grid.insert(seg.a.x, seg.a.y, s);
    grid.insert(seg.b.x, seg.b.y, s);
  }
  return grid;
}

// With the bbox-padded index, the single cell under the cursor already
// contains every segment within `tol`. We scan that one cell only.
function gridNearestSegment(grid, segments, qx, qy, tol) {
  const cs = grid.cellSize;
  const cx = Math.floor(qx / cs);
  const cy = Math.floor(qy / cs);
  const tol2 = tol * tol;
  let bestSeg = -1;
  let bestD2 = tol2;
  const arr = grid.buckets.get(cx + ',' + cy);
  if (arr) {
    for (let j = 0; j < arr.length; j++) {
      const sId = arr[j];
      const seg = segments[sId];
      const d2 = distToSegment2(qx, qy, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestSeg = sId;
      }
    }
  }
  return bestSeg;
}

// 3x3 query against the endpoint-only index (naive baseline for comparison).
function gridNearestSegmentEndpointOnly(grid, segments, qx, qy, tol) {
  const cs = grid.cellSize;
  const cx = Math.floor(qx / cs);
  const cy = Math.floor(qy / cs);
  const tol2 = tol * tol;
  let bestSeg = -1;
  let bestD2 = tol2;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const arr = grid.buckets.get(gx + ',' + gy);
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        const seg = segments[arr[j]];
        const d2 = distToSegment2(qx, qy, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
        if (d2 < bestD2) {
          bestD2 = d2;
          bestSeg = arr[j];
        }
      }
    }
  }
  return bestSeg;
}

function bruteNearestSegment(segments, qx, qy, tol) {
  const tol2 = tol * tol;
  let bestSeg = -1;
  let bestD2 = tol2;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const d2 = distToSegment2(qx, qy, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestSeg = s;
    }
  }
  return bestSeg;
}

// ---------------------------------------------------------------------------
// Timing helpers (ns precision)
// ---------------------------------------------------------------------------
function nowNs() {
  return Number(process.hrtime.bigint());
}

function pct(sortedArr, p) {
  const idx = Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length));
  return sortedArr[idx];
}

// ---------------------------------------------------------------------------
// Vertex snapping benchmark for one N
// ---------------------------------------------------------------------------
function benchVertices(n) {
  const points = genVertices(n, 0xC0FFEE ^ n);
  const queries = genQueries(QUERIES, 0xBADF00D ^ n);

  // Cell size = tolerance (1x) is the baseline; 3x3 scan is exhaustive when
  // cellSize >= tol because any point within `tol` of the query must lie in
  // the query cell or an adjacent cell.
  const cellSize = PAGE_TOL;

  const tb0 = nowNs();
  const grid = buildPointGrid(points, cellSize);
  const tb1 = nowNs();
  const buildMs = (tb1 - tb0) / 1e6;

  // bucket stats
  let occ = 0;
  let maxOcc = 0;
  for (const arr of grid.buckets.values()) {
    occ += arr.length;
    if (arr.length > maxOcc) maxOcc = arr.length;
  }
  const bucketCount = grid.buckets.size;
  const avgOcc = occ / bucketCount;

  // time grid queries individually for p99
  const times = new Float64Array(QUERIES);
  let hitsGrid = 0;
  for (let i = 0; i < QUERIES; i++) {
    const q = queries[i];
    const t0 = nowNs();
    const r = gridNearestVertex(grid, points, q.x, q.y, PAGE_TOL);
    const t1 = nowNs();
    times[i] = t1 - t0;
    if (r >= 0) hitsGrid++;
  }
  const sorted = Array.from(times).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < times.length; i++) sum += times[i];
  const avgNs = sum / times.length;
  const p99Ns = pct(sorted, 0.99);

  // correctness: full check across ALL queries vs brute force
  let mismatch = 0;
  for (let i = 0; i < QUERIES; i++) {
    const q = queries[i];
    const g = gridNearestVertex(grid, points, q.x, q.y, PAGE_TOL);
    const b = bruteNearestVertex(points, q.x, q.y, PAGE_TOL);
    if (g !== b) mismatch++;
  }

  return {
    n,
    buildMs,
    bucketCount,
    avgOcc,
    maxOcc,
    avgUs: avgNs / 1000,
    p99Us: p99Ns / 1000,
    hitRate: hitsGrid / QUERIES,
    mismatch,
  };
}

// ---------------------------------------------------------------------------
// Segment snapping benchmark
// ---------------------------------------------------------------------------
// Queries biased toward segments: half random, half near a random segment
// midpoint (jittered within a few tolerances) so we exercise real snap hits.
function genSegmentQueries(segments, n, seed) {
  const rng = makeRng(seed);
  const qs = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      qs[i] = { x: rng() * PAGE_W, y: rng() * PAGE_H };
    } else {
      const seg = segments[Math.floor(rng() * segments.length)];
      const t = rng();
      const mx = seg.a.x + (seg.b.x - seg.a.x) * t;
      const my = seg.a.y + (seg.b.y - seg.a.y) * t;
      qs[i] = {
        x: mx + (rng() - 0.5) * 4 * PAGE_TOL,
        y: my + (rng() - 0.5) * 4 * PAGE_TOL,
      };
    }
  }
  return qs;
}

function benchSegments(n) {
  const segments = genSegments(n, 0x5EED ^ n);
  const queries = genSegmentQueries(segments, QUERIES, 0x1234 ^ n);
  // cell = 2x tol keeps avg occupancy reasonable while bbox index stays cheap
  const cellSize = PAGE_TOL * 2;

  const tb0 = nowNs();
  const grid = buildSegmentGrid(segments, cellSize, PAGE_TOL);
  const tb1 = nowNs();
  const buildMs = (tb1 - tb0) / 1e6;

  // index footprint: total entries vs segment count (duplication factor)
  let entries = 0;
  for (const arr of grid.buckets.values()) entries += arr.length;
  const dupFactor = entries / segments.length;

  const times = new Float64Array(QUERIES);
  let hits = 0;
  for (let i = 0; i < QUERIES; i++) {
    const q = queries[i];
    const t0 = nowNs();
    const r = gridNearestSegment(grid, segments, q.x, q.y, PAGE_TOL);
    const t1 = nowNs();
    times[i] = t1 - t0;
    if (r >= 0) hits++;
  }
  const hitRate = hits / QUERIES;
  const sorted = Array.from(times).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < times.length; i++) sum += times[i];
  const avgUs = sum / times.length / 1000;
  const p99Us = pct(sorted, 0.99) / 1000;

  // correctness: bbox-padded index single-cell query MUST match brute force.
  let mismatch = 0;
  for (let i = 0; i < QUERIES; i++) {
    const q = queries[i];
    const g = gridNearestSegment(grid, segments, q.x, q.y, PAGE_TOL);
    const b = bruteNearestSegment(segments, q.x, q.y, PAGE_TOL);
    // compare by actual distance (ties between equal-distance segs are ok)
    if (g !== b) {
      const dg = g < 0 ? Infinity : distToSegment2(q.x, q.y,
        segments[g].a.x, segments[g].a.y, segments[g].b.x, segments[g].b.y);
      const db = b < 0 ? Infinity : distToSegment2(q.x, q.y,
        segments[b].a.x, segments[b].a.y, segments[b].b.x, segments[b].b.y);
      if (Math.abs(dg - db) > 1e-9) mismatch++;
    }
  }

  // demonstrate the naive endpoint-only index UNDER-counts hits
  const eGrid = buildSegmentGridEndpointOnly(segments, cellSize);
  let endpointMissedHits = 0;
  for (let i = 0; i < 2000; i++) {
    const q = queries[i];
    const e = gridNearestSegmentEndpointOnly(eGrid, segments, q.x, q.y, PAGE_TOL);
    const b = bruteNearestSegment(segments, q.x, q.y, PAGE_TOL);
    if (b >= 0 && e === -1) endpointMissedHits++;
  }

  return {
    n,
    segCount: segments.length,
    buildMs,
    dupFactor,
    avgUs,
    p99Us,
    mismatch,
    hitRate,
    endpointMissedHits,
  };
}

// ---------------------------------------------------------------------------
// Cell-size sweep (relative to tolerance) at fixed N
// ---------------------------------------------------------------------------
function sweepCellSize(n) {
  const points = genVertices(n, 0xABCDEF ^ n);
  const queries = genQueries(QUERIES, 0xFEDCBA ^ n);
  const factors = [0.5, 1.0, 2.0, 4.0];
  const rows = [];
  for (const f of factors) {
    const cellSize = PAGE_TOL * f;
    const grid = buildPointGrid(points, cellSize);

    // For cellSize < tol, a 3x3 scan is NOT exhaustive. To stay correct we
    // must widen the scan radius to ceil(tol/cellSize) cells. We compute the
    // ring radius and scan (2r+1)^2 cells so the sweep stays apples-to-apples
    // on correctness, and report the time cost of each strategy.
    const r = Math.max(1, Math.ceil(PAGE_TOL / cellSize));

    const times = new Float64Array(QUERIES);
    let mismatch = 0;
    for (let i = 0; i < QUERIES; i++) {
      const q = queries[i];
      const t0 = nowNs();
      const res = gridNearestVertexR(grid, points, q.x, q.y, PAGE_TOL, r);
      const t1 = nowNs();
      times[i] = t1 - t0;
      if (i < 1500) {
        const b = bruteNearestVertex(points, q.x, q.y, PAGE_TOL);
        if (res !== b) mismatch++;
      }
    }
    let sum = 0;
    for (let i = 0; i < times.length; i++) sum += times[i];
    const sorted = Array.from(times).sort((a, b) => a - b);
    rows.push({
      factor: f,
      cellSize: cellSize.toFixed(2),
      scanRing: r,
      cellsScanned: (2 * r + 1) * (2 * r + 1),
      buckets: grid.buckets.size,
      avgUs: sum / times.length / 1000,
      p99Us: pct(sorted, 0.99) / 1000,
      mismatch,
    });
  }
  return rows;
}

// Generalized neighbourhood query with ring radius r.
function gridNearestVertexR(grid, points, qx, qy, tol, r) {
  const cs = grid.cellSize;
  const cx = Math.floor(qx / cs);
  const cy = Math.floor(qy / cs);
  const tol2 = tol * tol;
  let bestIdx = -1;
  let bestD2 = tol2;
  for (let gx = cx - r; gx <= cx + r; gx++) {
    for (let gy = cy - r; gy <= cy + r; gy++) {
      const arr = grid.buckets.get(gx + ',' + gy);
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        const p = points[arr[j]];
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestIdx = arr[j];
        }
      }
    }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function fmt(x, d) {
  return Number(x).toFixed(d === undefined ? 3 : d);
}

console.log('=== Spike 002 — snapping-engine ===');
console.log('Page extent: ' + PAGE_W + ' x ' + PAGE_H + ' page-space units');
console.log('Screen tolerance: ' + SCREEN_TOL_PX + 'px  | zoom: ' + ZOOM +
  '  | page-space tol: ' + PAGE_TOL + ' units');
console.log('Query batch per N: ' + QUERIES);
console.log('');

console.log('--- Vertex snapping (grid cell = 1x tol, 3x3 scan) ---');
console.log('N\tbuild(ms)\tbuckets\tavgOcc\tmaxOcc\tavg(us)\tp99(us)\thitRate\tmismatch');
const Ns = [1000, 10000, 50000];
for (const n of Ns) {
  const r = benchVertices(n);
  console.log(
    r.n + '\t' + fmt(r.buildMs, 3) + '\t\t' + r.bucketCount + '\t' +
    fmt(r.avgOcc, 2) + '\t' + r.maxOcc + '\t' + fmt(r.avgUs, 3) + '\t' +
    fmt(r.p99Us, 3) + '\t' + fmt(r.hitRate, 3) + '\t' + r.mismatch
  );
}
console.log('');

console.log('--- Segment snapping (nearest point ON segment, bbox-padded grid, cell=2x tol) ---');
console.log('N\tsegs\tbuild(ms)\tdupFactor\thitRate\tavg(us)\tp99(us)\tmismatch\tendpointOnlyMissedHits/2000');
for (const n of Ns) {
  const r = benchSegments(n);
  console.log(
    r.n + '\t' + r.segCount + '\t' + fmt(r.buildMs, 3) + '\t\t' +
    fmt(r.dupFactor, 2) + '\t\t' + fmt(r.hitRate, 3) + '\t' +
    fmt(r.avgUs, 3) + '\t' + fmt(r.p99Us, 3) +
    '\t' + r.mismatch + '\t\t' + r.endpointMissedHits
  );
}
console.log('');

console.log('--- Cell-size sweep (N=50000, correct scan ring per cell size) ---');
console.log('factor\tcellSize\tscanRing\tcellsScanned\tbuckets\tavg(us)\tp99(us)\tmismatch');
const sweep = sweepCellSize(50000);
for (const row of sweep) {
  console.log(
    row.factor + 'x\t' + row.cellSize + '\t\t' + row.scanRing + '\t\t' +
    row.cellsScanned + '\t\t' + row.buckets + '\t' + fmt(row.avgUs, 3) + '\t' +
    fmt(row.p99Us, 3) + '\t' + row.mismatch
  );
}
console.log('');
console.log('Done.');
