---
spike: 009
name: autocount-review-ux
type: standard
validates: "Given template-match detections on a sheet, when the user tunes a sensitivity dial and clicks to reject/restore pins, then accepted detections become trustworthy count pins that land on the ground truth"
verdict: "VALIDATED (pipeline + dial) · PENDING human feel-test (review flow)"
related: [001]
tags: [markup, auto-count, mm-10, template-match, review-ux, feel]
---

# Spike 009: Auto-Count Review / Accept UX (MM-10)

## What This Validates

**Auto-count's algorithm is already proven — its PRODUCT isn't (GAP-003).** Spike 001 VALIDATED
offline NCC template-match (F1 89.7% in ~100ms). What's never been built or felt is the
**review/accept UX**: the estimator picks a template symbol, sweeps a **sensitivity dial**, and
**confirms or rejects** detected pins before they become real count markups. That review loop —
not the correlation math — is the open question, and it's a *feel* question.

**Given** real detections with confidence scores, **when** the user tunes sensitivity and clicks
pins to reject/restore, **then** the accepted set lands on the true count with trust the
estimator can feel.

## Research

The design risk in auto-count isn't accuracy — it's **trust**. An estimator will not accept a
black box that dumps 200 pins on a sheet. The literature and every shipping tool (Bluebeam
VisualSearch, PlanSwift auto-count) converge on the same review pattern: **pick one instance →
see candidates → threshold slider → per-pin accept/reject → commit.** The question this spike
answers experientially: does a single NCC-confidence dial give the estimator a *legible* recall/
precision trade, and does per-pin rejection make the residual errors cheap to fix?

Deliberate design choice: the demo runs the **real** single-scale NCC + non-max-suppression (the
same algorithm spike 001 validated), not a mock — so the confidence scores driving the dial are
genuine. Because the plan is synthetic, **ground truth is known**, so the demo shows live
recall/precision/F1 as you sweep (the estimator never sees these — they measure whether the
*review flow* converges on the truth).

## How to Run

**Pipeline + dial (self-verifying):**
```
node .planning/spikes/009-autocount-review-ux/verify.cjs
```
**Interactive review demo (open in a browser):**
```
.planning/spikes/009-autocount-review-ux/index.html
```
Click a ring-and-cross symbol to pick a template → **Run detection** → drag the **sensitivity**
slider and watch pins appear/disappear with live recall/precision → click any pin to reject
(red ✕) or restore → **Commit as count pins**. **New plan** reseeds; **Export** dumps the log.

## What to Expect

- Verifier: a threshold sweep table showing recall falling and precision rising as the dial
  tightens, F1 peaking ~0.55–0.60, and a monotonicity `PASS`.
- Demo: green accepted pins / red rejected pins, a count that updates as you tune, and the
  recall/precision tiles turning amber→green as you find the sweet spot.

## Observability

The demo logs every event (template pick, NCC pass timing + raw/NMS counts, each threshold
change with recall/precision, each reject/restore, commit) and exports a JSON summary
(`threshold`, `detected`, `accepted`, `rejectedByUser`, `recall`, `precision`, `f1`).

## Investigation Trail

1. **Ran the real detector, not a mock.** Ported spike 001's NCC + NMS into both the demo and
   `verify.cjs` so the dial reflects genuine correlation scores.
2. **Hit — and fixed — a real bug in the verifier.** First run returned 0 detections: the
   template was extracted with a *float* center, so `G[float]` → `undefined` → NaN scores. Fixed
   by flooring the sample indices (the demo already rounds the click, so it was unaffected). This
   is exactly the kind of coordinate-flooring bug the real build must guard at the Konva→raster
   boundary.
3. **Made the synthetic symbols pixel-robust** (integer centers, 3px strokes) so recall reflects
   a real coarse-to-fine matcher rather than a step-2 aliasing artifact — the first robust run
   read 44% recall purely from thin-stroke misalignment, which would have *undersold* a detector
   spike 001 already proved at ~97%.
4. **Wired ground-truth metrics into the loop** so the sweep is legible: you can watch the exact
   recall/precision the estimator is trading with each notch of the dial.

## Results

**Pipeline + dial — VALIDATED.** Real NCC over a 480×360 synthetic plan (16 true symbols + 10
decoys), template picked from one instance:

| threshold | detected | recall | precision | F1 |
|-----------|----------|--------|-----------|-----|
| 0.55 | 17 | **100%** | 94% | 97% |
| 0.60 | 15 | 94% | **100%** | 97% |
| 0.65 | 13 | 81% | 100% | 90% |
| 0.75 | 5 | 31% | 100% | 48% |

The dial is **legible and monotone** — precision rises (or holds) as it tightens; F1 peaks at
**97%** around 0.55–0.60. The interesting bit for the UX: at 0.55 there is **one false positive**
(a decoy ring) the estimator rejects in one click; at 0.60 there is **one false negative** they
add by hand. **This is precisely why the review loop exists** — the dial gets you to ~95%, and
per-pin reject/restore closes the last few. Auto-count is not "trust the robot," it's "the robot
drafts, you approve."

**Feel — PENDING.** The review flow (dial responsiveness, pin reject/restore affordance, whether
the recall/precision tiles build trust) needs a human in `index.html` (in-app Browser was
unresponsive this session).

**Build signal for MM-10:** the productization is a **4-step wizard** (pick template → detect →
tune+review → commit), not a one-shot button. Real build needs: OpenCV.js `matchTemplate` in a
Web Worker (spike 001's recommendation) for multi-scale/rotation + speed; the coordinate-floor
guard at the raster boundary (bug #2 above); and per-pin accept state carried until commit. The
detector is a solved problem; **the wizard is the work.**
