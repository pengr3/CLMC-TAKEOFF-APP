---
phase: 19-cost-library
status: reviewed
score: 18/24
blockers: 0
review_mode: inline source and existing desktop walkthrough observations
reviewed: 2026-10-21
---

# Phase 19 UI review

Reviewed against 19-UI-SPEC.md, locked context, CostLibraryDialog.tsx, existing Estimate integration and the actual desktop walkthrough recorded in 19-DESKTOP-UAT.md. No fresh screenshots, mobile browser review or independent subagent review is claimed. Target is the Windows desktop app; Windows scaling remains Phase 20.

| Pillar | Score | Specific finding |
| --- | --- | --- |
| Copywriting | 3/4 | Actions and replacement/unchanged-estimate scope are explicit. WARNING: picker uses the internal tool word “count” in the scope sentence; “count items” could be made clearer in later copy polish. |
| Visuals | 3/4 | Dialog hierarchy, table, search and labeled icon meet the contract. WARNING: row book icon is only 13 px with compact 2×4 padding, a small pointer target for a frequent action. |
| Color | 3/4 | Existing COLORS, dark surfaces and accent actions are reused. WARNING: all status messages, including success/cancellation, use warning color, reducing severity distinction. |
| Typography | 3/4 | 12–13 px body/table and 17 px heading remain legible at observed desktop sizes. WARNING: numerical rate columns use the table's left alignment, reducing scanability on longer price lists. |
| Spacing | 3/4 | Bounded table scrolling and a centered dialog fit the observed desktop layout. WARNING: mixed 14/16 px gaps are local inline values rather than a shared spacing rhythm. |
| Experience design | 3/4 | Explicit preview/replace/apply, mismatch blocking, keyboard containment and focus restore passed. WARNING: only the first 100 matches (20 preview rows) display, with search guidance rather than paging; discovering broad large categories needs search refinement. |

No finding blocks Phase 19 task completion; all 11 UAT tests passed. Prior native-dialog feedback defect was repaired and user-retested before acceptance. Recommended later polish: distinguish status severity, enlarge the row book target and align numeric library columns. Minimum-height/long-text/Windows scaling combinations still need the Phase 20 installed-app checks; this review does not replace them.
