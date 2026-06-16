# Spike Manifest

| ID | Title | Status | Date | Key Finding |
|----|-------|--------|------|-------------|
| GAP-001 | Gap Audit — What Lacks for a Key Takeoff App | complete | 2026-05-19 | 14 gaps across 3 tiers; 5 deal-breakers identified; recommended v1.1 sequence written |
| 001 | auto-count-symbol-detect | VALIDATED | 2026-06-16 | Offline pure-JS NCC template-match: 97.5% recall / 83% precision / F1 89.7% in ~100ms (2.8MP). Feasible; real build needs coarse-to-fine pyramid + multi-scale/rotation (OpenCV.js in Worker) + sensitivity slider. → MM-10 |
| 002 | snapping-engine | VALIDATED | 2026-06-16 | Grid-hash vertex snap 2–15µs at N=1k–50k (~130× under frame budget), 0 correctness mismatches. Rule: cell = zoom-compensated tolerance; index segments by padded bbox; defer intersection snap. → MM-06 |
| 003 | arc-segment-measure | VALIDATED | 2026-06-16 | 3-point arc length accurate to ~1e-10 vs numerical oracle, robust on all edge cases. Straight-line under-measures a 90° bend ~10%. Needs per-segment arc metadata + 3-click input. → MM-05 |
| 003b | curved-polygon-area | VALIDATED | 2026-06-16 | Curved AREA = shoelace ± circular-segment, accurate to ~2.9e-8 for inward+outward bulges; all edge cases pass. Sign rule: OUTWARD ⟺ sign(cross)≠sign(shoelace). Straight-only under-measures a stadium ~24%. Guard self-intersecting inward bulges. → MM-05 |

## Spike idea (2026-06-16)
**"In terms of core measurement & markup functionality, what do we lack?"**
Gap analysis grounded in the codebase (`markup-math.ts`, `markup.ts`, `scale.ts`) produced
`.planning/BACKLOG.md` (MM-01 … MM-12). The three feasibility-uncertain gaps were spiked
(001/002/003 above); the rest are known build-work awaiting planning.
