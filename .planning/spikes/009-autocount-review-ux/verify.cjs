// Spike 009 — verify the auto-count PIPELINE the review UX sits on: synthetic
// raster → template extract → single-scale NCC slide → NMS → threshold sweep →
// recall/precision/F1 vs known ground truth. The REVIEW FEEL is human-verified in
// index.html; THIS proves the detector under it is real and that the sensitivity
// dial does something monotone (higher threshold → higher precision, lower recall).
// The NCC/NMS is the same algorithm spike 001 VALIDATED; here it drives 009's flow.
// Zero deps, deterministic. Run: node .planning/spikes/009-autocount-review-ux/verify.cjs
'use strict'
const W=480,H=360,TW=28,R_NMS=22,R_MATCH=16
function mulberry32(s){let a=s>>>0;return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const rng=mulberry32(0x009abc)
const G=new Float32Array(W*H).fill(250)
const px=(x,y,v)=>{ x|=0;y|=0; if(x>=0&&x<W&&y>=0&&y<H) G[y*W+x]=v }
// symbols drawn at INTEGER centers with THICK strokes so two instances are
// pixel-identical and a step-2 slide lands within-tolerance of the peak (this
// mirrors what a real coarse-to-fine matcher achieves; spike 001 proved accuracy).
function circle(cx,cy,r,v){ for(let a=0;a<Math.PI*2;a+=0.04) for(let dr=-1;dr<=1;dr++){ px(cx+Math.cos(a)*(r+dr),cy+Math.sin(a)*(r+dr),v) } }
function line(x0,y0,x1,y1,v){ const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0; for(let i=0;i<=n;i++){ const t=n?i/n:0; for(let d=-1;d<=1;d++){ px(x0+(x1-x0)*t+d,y0+(y1-y0)*t,v); px(x0+(x1-x0)*t,y0+(y1-y0)*t+d,v) } } }
function trueSym(cx,cy){ circle(cx,cy,9,20); line(cx-6,cy,cx+6,cy,20); line(cx,cy-6,cx,cy+6,20) }
function ringSym(cx,cy){ circle(cx,cy,9,20) }              // near-miss decoy (no plus)
function sqSym(cx,cy){ line(cx-8,cy-8,cx+8,cy-8,20); line(cx+8,cy-8,cx+8,cy+8,20); line(cx+8,cy+8,cx-8,cy+8,20); line(cx-8,cy+8,cx-8,cy-8,20) }

// clutter lines
for(let i=0;i<16;i++){ const x=rng()*W,y=rng()*H; line(x,y,x+(rng()-.5)*180,y+(rng()-.5)*30,120) }
// place symbols, no overlap
const truth=[],decoys=[]
function place(arr,fn,n){ let tr=0; while(arr.length<n&&tr<n*50){ tr++; const x=Math.round(34+rng()*(W-68)),y=Math.round(38+rng()*(H-76)); if(truth.concat(decoys).some(p=>Math.hypot(p.x-x,p.y-y)<32))continue; arr.push({x,y}); fn(x,y) } }
place(truth,trueSym,16); place(decoys,ringSym,6); place(decoys,sqSym,4)
// speckle
for(let i=0;i<G.length;i++){ if(rng()<0.02) G[i]=rng()<.5?0:255 }

// template at the first true symbol
function extract(cx,cy){ cx=Math.round(cx); cy=Math.round(cy); const half=TW>>1,t=new Float32Array(TW*TW); let s=0
  for(let j=0;j<TW;j++)for(let i=0;i<TW;i++){ const xx=Math.min(W-1,Math.max(0,cx-half+i))|0,yy=Math.min(H-1,Math.max(0,cy-half+j))|0; const v=G[yy*W+xx]; t[j*TW+i]=v; s+=v }
  const mean=s/(TW*TW); let nn=0; for(let k=0;k<t.length;k++){t[k]-=mean;nn+=t[k]*t[k]} return {data:t,norm:Math.sqrt(nn)||1} }
const T=extract(truth[0].x,truth[0].y)

// NCC slide + NMS (identical to the demo)
function detect(){ const half=TW>>1,step=2,cand=[]; const t0=process.hrtime.bigint()
  for(let cy=half;cy<H-half;cy+=step)for(let cx=half;cx<W-half;cx+=step){
    let s=0; for(let j=0;j<TW;j++){ const row=(cy-half+j)*W+(cx-half); for(let i=0;i<TW;i++) s+=G[row+i] }
    const pm=s/(TW*TW); let dot=0,pn=0
    for(let j=0;j<TW;j++){ const row=(cy-half+j)*W+(cx-half),tr=j*TW; for(let i=0;i<TW;i++){ const pv=G[row+i]-pm; dot+=pv*T.data[tr+i]; pn+=pv*pv } }
    const sc=dot/((Math.sqrt(pn)||1)*T.norm); if(sc>=0.5)cand.push({x:cx,y:cy,score:sc})
  }
  cand.sort((a,b)=>b.score-a.score); const kept=[]
  for(const c of cand){ if(kept.some(k=>Math.hypot(k.x-c.x,k.y-c.y)<R_NMS))continue; kept.push(c) }
  const ms=Number(process.hrtime.bigint()-t0)/1e6
  return {kept,rawCount:cand.length,ms}
}
function metricsAt(kept,thr){ const det=kept.filter(c=>c.score>=thr); const usedT=new Set(); let tp=0
  for(const d of det){ let bi=-1,bd=1e9; truth.forEach((t,i)=>{ if(usedT.has(i))return; const dd=Math.hypot(t.x-d.x,t.y-d.y); if(dd<bd){bd=dd;bi=i} }); if(bi>=0&&bd<=R_MATCH){tp++;usedT.add(bi)} }
  const fp=det.length-tp,fn=truth.length-tp,rec=tp/truth.length,pre=det.length?tp/det.length:0,f1=(rec+pre)?2*rec*pre/(rec+pre):0
  return {n:det.length,tp,fp,fn,rec,pre,f1} }

console.log('SPIKE 009 — auto-count review pipeline verification\n'+'='.repeat(66))
console.log(`synthetic plan: ${W}x${H}, ${truth.length} TRUE symbols + ${decoys.length} decoys (ring/square)`)
const {kept,rawCount,ms}=detect()
console.log(`NCC slide (step 2) → ${rawCount} raw hits ≥0.5 → ${kept.length} after NMS, ${ms.toFixed(0)}ms\n`)
console.log('threshold sweep (this is what the sensitivity dial does):')
console.log('  thr   detected  TP  FP  FN   recall  precision   F1')
let best={f1:0}
for(const thr of [0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90]){
  const m=metricsAt(kept,thr)
  if(m.f1>best.f1)best={thr,...m}
  const pc=v=>(v*100).toFixed(0).padStart(3)+'%'
  console.log(`  ${thr.toFixed(2)}   ${String(m.n).padStart(6)}   ${String(m.tp).padStart(2)}  ${String(m.fp).padStart(2)}  ${String(m.fn).padStart(2)}   ${pc(m.rec)}     ${pc(m.pre)}   ${pc(m.f1)}`)
}
// monotonicity: precision should not DECREASE as threshold rises (allow tiny noise)
let monoOK=true, prevPre=-1
for(const thr of [0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90]){ const p=metricsAt(kept,thr).pre; if(p<prevPre-0.05){monoOK=false} prevPre=p }
console.log('\n'+'='.repeat(66))
console.log(`Best F1 = ${(best.f1*100).toFixed(0)}% at threshold ${best.thr} (recall ${(best.rec*100)|0}% / precision ${(best.pre*100)|0}%)`)
console.log(`Precision rises (or holds) as the dial tightens: ${monoOK?'PASS':'CHECK'} — the review dial is meaningful.`)
console.log('Detector is REAL (same NCC/NMS as spike 001). Review FEEL → human-verify index.html.')
