---
name: canvas-not-filling-workspace
status: resolved
trigger: |
  User reports: after fixes ec39197 (yesterday's gutter fix) and 1df7e59
  (auto-refit on load), opening a project at home and manually panning/zooming
  to 50% top-left reveals "blank" area in the bottom-right of the workspace.
  User explicitly rejects "this is normal at low zoom" framing — claims it is
  a CSS layout bug, says "the canvas does not take the whole screen", warns
  about shipping to users with different resolutions.
created: 2026-05-14
updated: 2026-05-14
---

# Canvas Background Not Filling Workspace at Manual Zoom/Pan

## Symptoms

**Expected:** The dark dotted workspace background (`#141414` with `#1e1e1e` radial-gradient dots, `CanvasViewport.tsx:534-537`) extends across the entire available area between page-strip header and status bar, regardless of the PDF's zoom or pan position. Any area not covered by PDF or markups should clearly show the workspace pattern.

**Actual (per user screenshots):**
- At 18% zoom (auto-fit-on-open result) the workspace bg appears to fill the area; PDF small and centred.
- At 50% zoom manually panned to top-left: the area to the right of and below the PDF appears as plain dark (no visible dot pattern), reading as "blank" / "broken" to the user.
- User explicitly rejected the diagnoses "the dots are too subtle to see" and "this is normal" — they believe there is a real CSS layout bug.

**Reproduction:**
1. `npm run dev` on a 1920×1080 monitor with Windows display scaling.
2. Open `CMC_ME Layout_05-10-2026 rev.9.clmc` (any saved project will do).
3. Wait for auto-fit-on-open to settle (commit 1df7e59).
4. Manually zoom in to 50% (Ctrl+= or zoom-in toolbar button).
5. Pan PDF so it sits at top-left of the workspace.
6. Observe bottom-right of workspace: appears blank/black to the user.

**Yesterday's reference fixes (NOT regressed — confirmed intact):**
- `ec39197` — `CanvasViewport` outer div: `position: absolute; inset: 0`.
- `1df7e59` — `viewerStore.hydrate()` drops persisted `pageViewports`.

## Current Focus

```yaml
hypothesis: |
  Three candidates remain after exhaustive static analysis:
    (a) Konva Stage rendered at stale containerSize (default 800x600) because
        ResizeObserver fires AFTER first paint — visible as a Stage canvas
        that's narrower/shorter than the konvajs-content wrapper.
    (b) Real CSS sizing bug in the chain — some element wider/taller than
        its allotted slot at 1920x1080.
    (c) Konva canvas painting opaque pixels outside the PDF (e.g. background
        Layer fill, oversized offscreen canvas backing).
  Static analysis cannot disambiguate. Need runtime computed sizes.

probe: |
  DOM-inspection one-liner (paste into Electron DevTools console after
  reproducing the bug — i.e. at 50% zoom panned to top-left so the "blank"
  area is visible). Returns a JSON dump of the entire layout chain.

  copy(JSON.stringify((()=>{const out=[];const tag=(el,label)=>{if(!el)return;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);out.push({label,tag:el.tagName,class:el.className||null,w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.left),y:Math.round(r.top),bg:cs.backgroundColor,bgImage:cs.backgroundImage.slice(0,40),overflow:cs.overflow,position:cs.position,inlineW:el.style.width||null,inlineH:el.style.height||null});};tag(document.body,'body');tag(document.querySelector('#root'),'#root');tag(document.querySelector('#root > div'),'app-root');tag(document.querySelector('main'),'main');const center=document.querySelector('main > div:first-child');tag(center,'center-col');tag(center?.children[center.children.length-1],'canvas-wrapper');const cv=document.querySelector('[ref], div[style*="absolute"]');tag(document.querySelector('main > div:first-child > div:last-child > div'),'CanvasViewport-root');const konva=document.querySelector('.konvajs-content');tag(konva,'konvajs-content');document.querySelectorAll('.konvajs-content canvas').forEach((c,i)=>tag(c,'konva-canvas-'+i));tag(document.querySelector('[data-testid="totals-panel-rail"], [data-testid="totals-panel"]'),'totals-panel');tag(document.querySelector('[role="separator"]'),'splitter');out.push({win:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio}});return out;})(),null,2));
  // After running this, paste from clipboard (Ctrl+V into chat).

expecting: |
  Outputs that disambiguate:
  - If konva-canvas-0 width < konvajs-content width: hypothesis (a) — stale
    containerSize. Stage didn't catch up after layout finished. Fix: gate Stage
    render on a "sized" flag set after the first ResizeObserver callback, OR
    measure synchronously with useLayoutEffect on mount.
  - If konva-canvas-0 width == konvajs-content width == CanvasViewport-root
    width but main width is LESS than window.innerWidth - 32 (the splitter+rail
    budget): hypothesis (b) — CSS chain bug. Look for the offending element.
  - If all sizes match but konva-canvas-0 has a non-transparent bg color or
    the canvas itself paints solid #141414 / #1a1a1a opaque pixels: hypothesis
    (c). Fix Konva paint.
  - If konvajs-content extends fully but its bg is solid #1a1a1a (not the dotted
    #141414): the inset:0 child isn't covering — likely a stacking-order issue
    where the Stage's konva-content div is opaque and lies ABOVE the dotted div.

next_action: |
  Awaiting the probe output paste from user. Once received, pick the actual
  hypothesis and apply the targeted fix.

reasoning_checkpoint: |
  Important note on CanvasViewport structure: the outer ref'd div (line 528-540)
  is the one with the dotted bg. The Stage is rendered AS A CHILD of that div
  — Konva internally creates a .konvajs-content wrapper sized exactly to
  width × height props (= containerSize). So if the Stage's konvajs-content
  fully covers the outer div, we never see the dotted bg even if the outer
  div is sized correctly. This is plausible hypothesis (c) in disguise:
  konvajs-content is positioned absolutely by Konva and sized to containerSize,
  which IF ResizeObserver fires correctly == 100% of the outer div, fully
  occluding the dotted pattern. Then the only visible "workspace" we ever see
  is whatever the Konva canvases paint outside the PDF — which is transparent
  by default (and would show the dotted div through it). BUT — Konva creates
  a default background-color: white on .konvajs-content in some versions? Need
  to confirm via probe.
```

## Evidence (so far)

- timestamp: 2026-05-14
  finding: Commits ec39197 and 1df7e59 are both on master; user confirmed `npm run dev` from source — both fixes are in the running code.
- timestamp: 2026-05-14
  finding: CanvasViewport.tsx:77 — `const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })` — default is 800×600. ResizeObserver at lines 110-119 updates this on resize. If ResizeObserver hasn't fired yet OR setContainerSize is racing, Stage renders at 800×600.
- timestamp: 2026-05-14
  finding: CanvasViewport outer div at line 528-540 has the dotted bg correctly. `position: absolute; inset: 0` requires a non-static positioned parent — App.tsx line 265 wrapper has `position: 'relative'`. Chain is sound on paper.
- timestamp: 2026-05-14
  finding: App.tsx line 249-258 — `<main>` has `background: COLORS.dominant` which is `#1a1a1a`. CanvasViewport has `#141414`. These differ by 6 units of luminance (almost invisible by eye).
- timestamp: 2026-05-14
  finding: Splitter is 4px wide. TotalsPanel collapsed rail is 28px. Combined ~32px on the right side — not enough to cause "huge blank" but visible.
- timestamp: 2026-05-14
  finding: User rejected three other interpretations (Option 1: subtle pattern; Option 2: zoom-clamp behaviour; Option 4: other) — chose Option 3 explicitly: "genuine extra blank space beyond where the canvas should end (CSS layout bug)".
- timestamp: 2026-05-14
  finding: Stage width/height props come from `containerSize` state (CanvasViewport.tsx:544-545). Konva.Stage renders an inner div with class `konvajs-content` sized exactly to the Stage's width/height. If containerSize is stale at first paint, konvajs-content is the wrong size; if containerSize is correct, konvajs-content fully covers the outer div and the dotted bg is only visible THROUGH the Konva canvases (which are transparent by default).
- timestamp: 2026-05-14
  finding: useUiPanels DEFAULTS.totals = { open: true, width: 320 }. So on a fresh install with totals open, center-column gets `innerWidth - 320 (panel) - 4 (splitter) = 1596px` on a 1920 monitor. If user had previously dragged the panel wider (saved to localStorage), they'd get even less. This could PARTIALLY explain feeling "the canvas is small" — but does NOT explain "the bg is blank/black" since the missing area would be OCCUPIED by the totals panel, not blank.
- timestamp: 2026-05-14
  finding: PDF base scale: PDF_BASE_SCALE=2.0. Offscreen canvas is canvas.width = floor(viewport.width × dpr) where viewport.width = pdf_w × renderScale × possibly_clamped. Offscreen canvas is HTMLCanvasElement and is passed to Konva as Image; Konva draws it at `displayPageSize.width × displayPageSize.height` which is the floor of `viewport.width` at scale 2.0 (no dpr). KonvaImage backing is transparent by default. No evidence of opaque pixels outside the PDF.

## Eliminated Hypotheses

- hypothesis: My fix 1df7e59 regressed yesterday's fix ec39197.
  why_not: Code inspection shows ec39197's change is intact (CanvasViewport.tsx:528-540). 1df7e59 only touched viewerStore.hydrate(). No overlap.
- hypothesis: The PDF was just at a manually-chosen position with normal empty workspace around it.
  why_not: User explicitly rejected this framing and pointed at a specific area as a bug.

## Root Cause

**Hypothesis (a) confirmed by runtime probe.**

Probe results (1920×1080 home monitor, dpr=1, user at 50% zoom panned top-left):
- `CV-root` (outer div): 1888×904 — correctly sized, dotted bg present.
- `konvajs-content`: **800×600** — stuck at the `useState` default.
- `canvas-0/1/2` (3 Konva layers): **800×600** — same.

The Stage's `width`/`height` props are driven by `containerSize` state. The
ResizeObserver setup is in a `useEffect` with `[]` deps (CanvasViewport.tsx:110-119
before fix), which runs once on mount. But the early return at line 470
(`if (!displayCanvas || !displayPageSize) return null`) means on the FIRST
mount the component returns null, so the div with `containerRef` doesn't exist
yet and the effect bails (`if (!container) return`). When the PDF finishes
rasterizing and the component re-renders with the div, the `[]` effect never
re-runs — so the ResizeObserver is never attached, and `containerSize` is
locked at `{800, 600}` forever.

This bug has been latent since the component was written. It became visible
ONLY after fix 1df7e59 dropped persisted `pageViewports`, because before that
fix the saved viewport (from a session when the Stage happened to be sized
correctly) overrode the broken auto-fit math. With the saved viewports gone,
auto-fit-on-load now uses the stuck `containerSize` and produces a fit anchored
at the top-left of an 800×600 Stage — exactly the user's screenshot.

## Fix

Replace the `useRef` + mount-time `useEffect` with a **callback ref**. Callback
refs fire whenever the underlying element mounts or unmounts. When the early
return swaps in the div post-rasterize, the callback fires and the
ResizeObserver attaches. `containerRef.current` is kept in sync from inside
the callback so other code that reads it (e.g. `getBoundingClientRect` at
line 959) is unchanged.

Single file changed: `src/renderer/src/components/CanvasViewport.tsx`.

## Verification

- `npm run typecheck` (node + web): clean.
- `npm run test` (vitest): 425/425 passing across 57 files.
- ESLint on the touched file: no new errors (17 pre-existing, all unrelated
  to this change).
- Runtime: user to confirm via re-running the probe — `konvajs-content`
  should now report 1888×904 matching `CV-root`.

## Notes

- This is NOT a regression of ec39197 or 1df7e59. It is a pre-existing latent
  bug exposed by 1df7e59. Commit message reflects that.
- The early-return at line 470 is intentional (prevents transient blank
  frames during page changes). Keeping it; the callback ref pattern
  accommodates it.

## Files of Interest

- src/renderer/src/components/CanvasViewport.tsx (outer div + Stage + ResizeObserver)
- src/renderer/src/App.tsx (layout chain above CanvasViewport)
- src/renderer/src/components/TotalsPanel.tsx (right rail — 28px when collapsed, 320 default open)
- src/renderer/src/components/Splitter.tsx (4px between canvas and totals)
- src/renderer/src/hooks/useUiPanels.ts (DEFAULTS.totals.width = 320)
- src/renderer/src/hooks/usePdfRenderer.ts (offscreen canvas pipeline — confirmed transparent backing)
- src/renderer/src/lib/constants.ts (COLORS.dominant='#1a1a1a' on main; CanvasViewport bg is '#141414')
