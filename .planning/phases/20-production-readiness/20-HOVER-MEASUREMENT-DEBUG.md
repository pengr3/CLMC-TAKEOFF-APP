# Phase 20 hover measurement discrepancy

26 October 2026, ongoing GSD 20-09-03 debug/retest continuation. Installed 1.1.4 native captures 245, 248–250 and 255 show a real discrepancy: **Curved outline — P:6.0 m A:2.0 m²** in the hover tooltip, while the canvas perimeter label is 7.1 m and the independent source geometry is **4 + π m / 2 + π/2 m²**. All 14 saved markup records, both scales, rates and estimate totals remain exact in the independent post-pan/post-reopen reads. This is an incorrect tooltip calculation, not evidence of saved geometry loss.

The existing `CanvasViewport` tooltip builder omits `m.arcs` in length and area calls. It also falls through to closed-perimeter handling for wall markups. Extracting the existing builder into a pure helper allows regression tests against independent semicircle/rectangle/height values, including a closing-edge arc and wall square-metre behavior. The initial extraction retains the old arithmetic to reproduce the failure before repair.

The faithful extraction reproduces **8 failures / 1 pass** in nine independent tooltip tests. Passing repair uses the existing arc-aware length/area functions and a distinct wall branch (open arc length × wall height, always m²). The nine tooltip tests and existing math/arc/round-trip tests pass: **56/56 in four files**, 0.867 seconds. Renderer TypeScript passes. New helper/test lint passes after formatting the new test; the initial six formatting warnings remain in the raw log. The earlier sandbox esbuild configuration denial occurred before collection and is not a product failure.

The historical 1.1.4 physical 150% test completed its pan/calibration/save/reopen/dialog checks but failed the incorrect hover quantities. At 2026-10-26T00:35:54.1992593Z (08:35 Manila), all 3191 original profile files and hashes were restored, the 64-file disposable profile was preserved separately, prior 1.1.3 test-profile hashes matched, and CLMC was closed. D1 was restored to 125%; D2 remained at 100%. The complete 1.1.4 record is frozen separately.

## Installed 1.1.5 regression result

Source commit `424a3709dc2e6e1ff91c0d00bbc0c31b16f4c8d7` passed 1268 tests in 161 files. The actual Windows build, inspected installer and packaged smoke test passed. The current installer SHA-256 is `6afc7812a98e22e84bb1b24342cc6fbd54b9ed6898b90c8de01aee30f3ea3379`; installed ASAR SHA-256 is `1eb4ea722cb8383eef13644c4cec75c1086daa200e3fdb6ee6f4794e91a39519`.

Actual installed captures 014, 016 and 024 show the corrected outline **P:7.1 m / A:3.6 m²**, curved line **3.1 m**, and curved wall **9.4 m²**. Capture 016's older filename says wall, but the observed tooltip is Arc run. The overlapping line was temporarily hidden to expose the wall and restored before saving. Two independent archive readbacks confirm all 14 markups, four arc segments, both scales, hidden-item state, ordering, rates and the complete embedded PDF remain exact. Native Save As, adopted reopen and ordinary Save also preserve cost/selling/margin totals of **1012.93 / 1160.73 / 147.80**.

Physical 150% capture 073 shows the corrected perimeter and area text near the right canvas boundary; its trailing text is clipped there. Capture 075 shows the complete curved-floor tooltip **3.6 m²** further inside the canvas. These are calculation-regression positives; they do not establish universal tooltip containment. The complete physical display and UI acceptance cases remain open until their remaining checks are recorded.

Raw evidence is under `.planning/tmp/20-completion-20261026/candidate-1.1.5/`; see `portable-hover-native-review.json` and the authoritative [current record](20-INSTALLED-EVIDENCE.json). Original-profile isolation/restoration state is recorded there. Phase 20 and release approval remain open.
