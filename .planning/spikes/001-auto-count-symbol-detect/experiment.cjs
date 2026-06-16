/*
 * Spike 001 — auto-count-symbol-detect
 *
 * Feasibility experiment: can we auto-count repeated symbols on a construction
 * plan using OFFLINE, pure-JavaScript template matching (no internet, no cloud
 * ML, no native addons)?
 *
 * Approach: Normalized Cross-Correlation (NCC) template matching over a
 * grayscale pixel buffer, with non-maximum suppression (NMS) to dedupe
 * overlapping hits.
 *
 * Self-contained: synthesizes its own grayscale raster (no PDF rasterizer),
 * uses a seeded LCG PRNG for determinism, zero npm dependencies.
 *
 * Run:  node experiment.cjs
 */

'use strict';

// ---------------------------------------------------------------------------
// Deterministic PRNG (Linear Congruential Generator). NOT Math.random().
// Numerical Recipes constants.
// ---------------------------------------------------------------------------
function makeLCG(seed) {
  let state = seed >>> 0;
  return function next() {
    // state = (a*state + c) mod 2^32
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296; // [0,1)
  };
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ---------------------------------------------------------------------------
// Grayscale image as a flat Uint8ClampedArray. 0 = black, 255 = white.
// "Plan" background is white; ink is dark.
// ---------------------------------------------------------------------------
function makeImage(w, h, fill = 255) {
  const data = new Uint8ClampedArray(w * h);
  data.fill(fill);
  return { w, h, data };
}

function px(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 255;
  return img.data[y * img.w + x];
}

function setPx(img, x, y, v) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  img.data[y * img.w + x] = v;
}

// Stamp a sub-image (template) at top-left (ox,oy). darkest-wins (min) so the
// glyph ink overrides background and overlapping clutter.
function stamp(img, glyph, ox, oy) {
  for (let y = 0; y < glyph.h; y++) {
    for (let x = 0; x < glyph.w; x++) {
      const v = glyph.data[y * glyph.w + x];
      const cur = px(img, ox + x, oy + y);
      setPx(img, ox + x, oy + y, Math.min(cur, v));
    }
  }
}

// ---------------------------------------------------------------------------
// Synthetic symbol glyph: a "crossed circle" / ringed dot — stands in for an
// electrical-outlet style plan symbol. Returns a glyph image (dark ink on
// white). S x S.
// ---------------------------------------------------------------------------
function makeSymbol(S = 24) {
  const g = makeImage(S, S, 255);
  const cx = (S - 1) / 2;
  const cy = (S - 1) / 2;
  const rOuter = S * 0.42;
  const rInner = S * 0.12;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let ink = 255;
      // outer ring (~1.6px thick)
      if (Math.abs(d - rOuter) < 1.3) ink = 20;
      // filled center dot
      if (d < rInner) ink = 0;
      // a diagonal tick (asymmetry → helps NCC discriminate from plain circles)
      if (Math.abs(dx - dy) < 1.0 && d < rOuter) ink = Math.min(ink, 40);
      g.data[y * g.w + x] = ink;
    }
  }
  return g;
}

// A "decoy" near-symbol: plain ring, no center dot, no tick. Tests precision.
function makeDecoy(S = 24) {
  const g = makeImage(S, S, 255);
  const cx = (S - 1) / 2;
  const cy = (S - 1) / 2;
  const rOuter = S * 0.42;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - rOuter) < 1.3) g.data[y * g.w + x] = 20;
    }
  }
  return g;
}

// Extract an S x S template from the image at top-left (ox,oy).
function extractTemplate(img, ox, oy, S) {
  const t = makeImage(S, S, 255);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      t.data[y * t.w + x] = px(img, ox + x, oy + y);
    }
  }
  return t;
}

// ---------------------------------------------------------------------------
// Clutter: random lines + speckle noise + decoy symbols.
// ---------------------------------------------------------------------------
function drawLine(img, x0, y0, x1, y1, ink) {
  // Bresenham
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    setPx(img, x0, y0, Math.min(px(img, x0, y0), ink));
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function addClutter(img, rng, nLines, nNoise, nDecoy, S) {
  for (let i = 0; i < nLines; i++) {
    drawLine(img,
      randInt(rng, 0, img.w - 1), randInt(rng, 0, img.h - 1),
      randInt(rng, 0, img.w - 1), randInt(rng, 0, img.h - 1),
      randInt(rng, 0, 80));
  }
  // Realistic scan speckle: sparse + faint grey (not dense full-range
  // salt-and-pepper). Real construction scans have light specks, not noise at
  // every pixel value. NCC is sensitive to in-window variance, so the noise
  // MODEL strongly affects results — we model a plausible scan, not worst case.
  for (let i = 0; i < nNoise; i++) {
    const x = randInt(rng, 0, img.w - 1);
    const y = randInt(rng, 0, img.h - 1);
    // faint grey specks (180..230); occasionally one darker fleck
    const v = (i % 25 === 0) ? randInt(rng, 90, 160) : randInt(rng, 180, 230);
    setPx(img, x, y, Math.min(px(img, x, y), v));
  }
  const decoy = makeDecoy(S);
  const decoyPos = [];
  for (let i = 0; i < nDecoy; i++) {
    const x = randInt(rng, 0, img.w - S - 1);
    const y = randInt(rng, 0, img.h - S - 1);
    stamp(img, decoy, x, y);
    decoyPos.push([x, y]);
  }
  return decoyPos;
}

// ---------------------------------------------------------------------------
// Precompute template stats for NCC.
//   NCC(window) = sum((W-meanW)*(T-meanT)) / (sqrt(sum((W-meanW)^2)) * sqrt(sum((T-meanT)^2)))
// We precompute zero-mean template and its norm once.
// ---------------------------------------------------------------------------
function prepTemplate(t) {
  const n = t.w * t.h;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += t.data[i];
  mean /= n;
  const zt = new Float64Array(n);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const v = t.data[i] - mean;
    zt[i] = v;
    ss += v * v;
  }
  return { zt, norm: Math.sqrt(ss), w: t.w, h: t.h, n };
}

// NCC at a single top-left window position (ox,oy).
function nccAt(img, prep, ox, oy) {
  const { zt, norm, w: tw, h: th, n } = prep;
  // window mean
  let sum = 0;
  for (let y = 0; y < th; y++) {
    const base = (oy + y) * img.w + ox;
    for (let x = 0; x < tw; x++) sum += img.data[base + x];
  }
  const mean = sum / n;
  let dot = 0;
  let wss = 0;
  let k = 0;
  for (let y = 0; y < th; y++) {
    const base = (oy + y) * img.w + ox;
    for (let x = 0; x < tw; x++) {
      const wv = img.data[base + x] - mean;
      dot += wv * zt[k++];
      wss += wv * wv;
    }
  }
  const denom = Math.sqrt(wss) * norm;
  if (denom === 0) return 0;
  return dot / denom; // [-1,1]
}

// Downscale an image by an integer factor using box averaging.
function downscale(img, factor) {
  const w = Math.floor(img.w / factor);
  const h = Math.floor(img.h / factor);
  const out = makeImage(w, h, 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        const base = (y * factor + dy) * img.w + x * factor;
        for (let dx = 0; dx < factor; dx++) sum += img.data[base + dx];
      }
      out.data[y * w + x] = sum / (factor * factor);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Match pass: COARSE-TO-FINE pyramid.
//
// KEY FINDING (see README): NCC peaks are needle-sharp — a true symbol scores
// ~1.0 but drops to ~0.05 just 2px off-center. So you CANNOT subsample the
// full-res image with a stride; you'd skip every peak. Instead we densely scan
// a DOWNSCALED image (peaks are wider there relative to the grid), then refine
// each coarse hit with a dense full-res scan of its small neighborhood.
// ---------------------------------------------------------------------------
function matchPass(img, prep, template, threshold, factor) {
  const tw = prep.w;
  const th = prep.h;
  const maxX = img.w - tw;
  const maxY = img.h - th;

  // Build coarse pyramid level + coarse template.
  const cImg = downscale(img, factor);
  const cTpl = downscale(template, factor);
  const cPrep = prepTemplate(cTpl);
  const cMaxX = cImg.w - cPrep.w;
  const cMaxY = cImg.h - cPrep.h;

  // Dense scan of the coarse image. Gate is lowered because averaging blurs
  // peaks (a true peak at full-res may only reach ~0.6-0.8 once downscaled).
  const coarseGate = Math.max(0.3, threshold - 0.25);
  const candidates = [];
  for (let oy = 0; oy <= cMaxY; oy++) {
    for (let ox = 0; ox <= cMaxX; ox++) {
      const s = nccAt(cImg, cPrep, ox, oy);
      if (s >= coarseGate) candidates.push([ox * factor, oy * factor]);
    }
  }

  // Refine: dense full-res scan of a neighborhood (+/- factor+1) around each
  // coarse candidate to recover the exact sharp peak.
  const refined = [];
  const R = factor + 1;
  for (const [cx, cy] of candidates) {
    let bx = cx, by = cy, bs = -2;
    for (let oy = Math.max(0, cy - R); oy <= Math.min(maxY, cy + R); oy++) {
      for (let ox = Math.max(0, cx - R); ox <= Math.min(maxX, cx + R); ox++) {
        const s = nccAt(img, prep, ox, oy);
        if (s > bs) { bs = s; bx = ox; by = oy; }
      }
    }
    if (bs >= threshold) refined.push([bx, by, bs]);
  }

  // Non-max suppression: sort by score desc, greedily keep, suppress others
  // within ~one template size.
  refined.sort((a, b) => b[2] - a[2]);
  const suppressRadius = Math.min(tw, th) * 0.7;
  const sr2 = suppressRadius * suppressRadius;
  const kept = [];
  for (const cand of refined) {
    let ok = true;
    for (const k of kept) {
      const dx = cand[0] - k[0];
      const dy = cand[1] - k[1];
      if (dx * dx + dy * dy < sr2) { ok = false; break; }
    }
    if (ok) kept.push(cand);
  }
  return kept; // array of [ox, oy, score]
}

// ---------------------------------------------------------------------------
// Evaluation: match detections to ground truth within a pixel tolerance.
// Greedy one-to-one assignment (detections already sorted by score in NMS).
// ---------------------------------------------------------------------------
function evaluate(detections, truth, S, tolPx) {
  const tol2 = tolPx * tolPx;
  // detection center vs truth center (truth stored as top-left)
  const usedTruth = new Array(truth.length).fill(false);
  let tp = 0;
  for (const [ox, oy] of detections) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < truth.length; i++) {
      if (usedTruth[i]) continue;
      const dx = ox - truth[i][0];
      const dy = oy - truth[i][1];
      const d2 = dx * dx + dy * dy;
      if (d2 < tol2 && d2 < bestD) { bestD = d2; best = i; }
    }
    if (best >= 0) { usedTruth[best] = true; tp++; }
  }
  const fp = detections.length - tp;
  const fn = truth.length - tp;
  const precision = detections.length ? tp / detections.length : 0;
  const recall = truth.length ? tp / truth.length : 0;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1, nDet: detections.length };
}

// ---------------------------------------------------------------------------
// Build one synthetic scenario.
// ---------------------------------------------------------------------------
function buildScenario(seed, w, h, nSymbols, S) {
  const rng = makeLCG(seed);
  const img = makeImage(w, h, 255);

  // clutter scaled to area
  const mp = (w * h) / 1e6;
  const nLines = Math.round(40 * mp);
  const nNoise = Math.round(20000 * mp);
  const nDecoy = Math.max(5, Math.round(8 * mp));
  addClutter(img, rng, nLines, nNoise, nDecoy, S);

  // stamp real symbols at non-overlapping random positions
  const symbol = makeSymbol(S);
  const truth = [];
  let attempts = 0;
  while (truth.length < nSymbols && attempts < nSymbols * 50) {
    attempts++;
    const x = randInt(rng, 0, w - S - 1);
    const y = randInt(rng, 0, h - S - 1);
    let clash = false;
    for (const [tx, ty] of truth) {
      if (Math.abs(tx - x) < S * 1.2 && Math.abs(ty - y) < S * 1.2) { clash = true; break; }
    }
    if (clash) continue;
    stamp(img, symbol, x, y);
    truth.push([x, y]);
  }

  return { img, truth, symbol, S };
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
function fmtMs(ms) { return ms.toFixed(0) + ' ms'; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

function run() {
  const S = 24;
  const pyrFactor = 3; // downscale factor for the coarse pyramid level
  const tolPx = 4;     // ground-truth match tolerance

  const scenarios = [
    { name: 'Medium 2000x1400 (2.8 MP)', seed: 12345, w: 2000, h: 1400, nSymbols: 40 },
    { name: 'Large  3500x2475 (8.7 MP)', seed: 999,   w: 3500, h: 2475, nSymbols: 80 },
  ];
  const thresholds = [0.55, 0.70, 0.80, 0.88];

  console.log('==========================================================');
  console.log(' Spike 001 — Offline NCC template matching auto-count');
  console.log(' Engine: pure JS, zero deps, deterministic LCG PRNG');
  console.log(` Template/symbol size: ${S}x${S}px  pyramidFactor=${pyrFactor}x  matchTol=${tolPx}px`);
  console.log('==========================================================');

  for (const sc of scenarios) {
    const tBuild = Date.now();
    const { img, truth } = buildScenario(sc.seed, sc.w, sc.h, sc.nSymbols, S);
    const buildMs = Date.now() - tBuild;

    // template = first stamped real instance (user "selects one")
    const [tx, ty] = truth[0];
    const template = extractTemplate(img, tx, ty, S);
    const prep = prepTemplate(template);

    console.log(`\n### ${sc.name}`);
    console.log(`    pixels=${(sc.w * sc.h / 1e6).toFixed(1)} MP  ground-truth symbols=${truth.length}  (synth build ${fmtMs(buildMs)})`);
    console.log('    threshold |   time   | detected | TP | FP | FN | precision | recall |  F1');
    console.log('    ----------+----------+----------+----+----+----+-----------+--------+------');

    for (const th of thresholds) {
      const t0 = Date.now();
      const det = matchPass(img, prep, template, th, pyrFactor);
      const dt = Date.now() - t0;
      const ev = evaluate(det, truth, S, tolPx);
      console.log(
        `       ${th.toFixed(2)}   | ${String(fmtMs(dt)).padStart(7)} | ` +
        `${String(ev.nDet).padStart(8)} | ${String(ev.tp).padStart(2)} | ` +
        `${String(ev.fp).padStart(2)} | ${String(ev.fn).padStart(2)} | ` +
        `${pct(ev.precision).padStart(9)} | ${pct(ev.recall).padStart(6)} | ${pct(ev.f1)}`
      );
    }
  }

  console.log('\n==========================================================');
  console.log(' Note: symbols here are axis-aligned & same-scale as the');
  console.log(' template. NCC is NOT rotation- or scale-invariant — see');
  console.log(' README verdict for real-build implications.');
  console.log('==========================================================');
}

run();
