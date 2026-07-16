// Spike 008 — verify the running-readout math core (the same formulas index.html
// runs on every mousemove) against known analytic values, and benchmark the
// per-mousemove compute cost at scale. Zero deps, deterministic. The CANVAS/feel
// is human-verified in index.html; THIS proves the numbers it will show are right.
//
// Run:  node .planning/spikes/008-live-readout/verify.cjs
'use strict'
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
const EPS = 1e-9
function solveCircle(p1, mid, p2) {
  const ax=p1.x,ay=p1.y,bx=mid.x,by=mid.y,cx=p2.x,cy=p2.y
  const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
  const spread=Math.max(dist(p1,mid),dist(mid,p2),dist(p1,p2))||1
  if (Math.abs(d)<=EPS*spread*spread) return { collinear:true }
  const a2=ax*ax+ay*ay,b2=bx*bx+by*by,c2=cx*cx+cy*cy
  const ux=(a2*(by-cy)+b2*(cy-ay)+c2*(ay-by))/d, uy=(a2*(cx-bx)+b2*(ax-cx)+c2*(bx-ax))/d
  const r=Math.hypot(ux-ax,uy-ay)
  const a1=Math.atan2(ay-uy,ax-ux),aMid=Math.atan2(by-uy,bx-ux),aEnd=Math.atan2(cy-uy,cx-ux)
  const ccw=(f,t)=>{let x=t-f;while(x<0)x+=2*Math.PI;while(x>=2*Math.PI)x-=2*Math.PI;return x}
  const goCcw=ccw(a1,aMid)<=ccw(a1,aEnd)
  const sweepSigned=goCcw?ccw(a1,aEnd):-(2*Math.PI-ccw(a1,aEnd))
  return { collinear:false, r, sweep:Math.abs(sweepSigned) }
}
const arcLength=(f,m,t)=>{ const c=solveCircle(f,m,t); return c.collinear?dist(f,t):c.r*c.sweep }
const polylineLength=(p)=>{ let t=0; for(let i=1;i<p.length;i++) t+=dist(p[i-1],p[i]); return t }
const polygonArea=(p)=>{ const n=p.length; if(n<3)return 0; let d=0; for(let i=0;i<n;i++){const j=(i+1)%n; d+=p[i].x*p[j].y-p[j].x*p[i].y} return Math.abs(d)/2 }
const rel=(a,b)=>Math.abs(a-b)/Math.max(Math.abs(a),Math.abs(b),1e-12)

console.log('SPIKE 008 — running-readout math verification\n'+'='.repeat(60))
let pass=true
function check(name,got,want){ const e=rel(got,want); const ok=e<1e-9; if(!ok)pass=false; console.log(`  ${ok?'ok ':'FAIL'} ${name.padEnd(40)} got=${got.toFixed(6)} want=${want.toFixed(6)} relErr=${e.toExponential(2)}`) }

// length of a 3-4-5 right triangle's two legs → hypotenuse-style checks
check('polyline 300px + 400px', polylineLength([{x:0,y:0},{x:300,y:0},{x:300,y:400}]), 700)
check('single leg 3-4-5 = 500', dist({x:0,y:0},{x:300,y:400}), 500)
// square 200×200 → area 40000, perimeter 800
const sq=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}]
check('square area 200²', polygonArea(sq), 40000)
check('square perimeter', polylineLength(sq)+dist(sq[sq.length-1],sq[0]), 800)
// arc: semicircle radius 100 → arc length π·100
check('semicircle arc length', arcLength({x:-100,y:0},{x:0,y:100},{x:100,y:0}), Math.PI*100)
// arc vs chord: quarter circle R=200, 90° → arc 200·π/2 vs chord 200√2
const qFrom={x:200,y:0},qTo={x:0,y:200},qMid={x:200*Math.cos(Math.PI/4),y:200*Math.sin(Math.PI/4)}
check('quarter-arc R=200 length', arcLength(qFrom,qMid,qTo), 200*Math.PI/2)
console.log(`    (quarter chord would read ${(200*Math.SQRT2).toFixed(2)}px — arc-aware total avoids the ${(100*(1-200*Math.SQRT2/(200*Math.PI/2))).toFixed(1)}% under-read)`)

// ── PERF: readout compute cost per mousemove at growing polygon sizes ──
console.log('\nPerf — polygonArea+perimeter recompute per mousemove (the hot path):')
function mulberry32(s){let a=s>>>0;return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const rng=mulberry32(0x008)
for (const N of [10,100,1000,5000]) {
  const pts=[]; for(let i=0;i<N;i++)pts.push({x:rng()*5000,y:rng()*4000})
  const ITER=2000; const t=process.hrtime.bigint()
  for(let k=0;k<ITER;k++){ const live=pts.concat([{x:rng()*5000,y:rng()*4000}]); polygonArea(live); polylineLength(live) }
  const us=Number(process.hrtime.bigint()-t)/1000/ITER
  console.log(`  N=${String(N).padStart(5)} pts → ${us.toFixed(2)} µs/readout   (${us<16000?'<< 16ms frame budget':'CHECK'})`)
}
console.log('\n'+'='.repeat(60))
console.log(`VERDICT: math ${pass?'PASS':'FAIL'} — the running readout shows correct length/area/arc.`)
console.log('Feel (label placement cursor-vs-HUD, clutter, smoothness) → human-verify index.html.')
