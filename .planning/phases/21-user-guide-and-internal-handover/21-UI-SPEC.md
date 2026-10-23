---
phase: "21"
slug: user-guide-and-internal-handover
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-23"
review_mode: inline_codex_adapter
---

# Phase 21 — offline guide design contract

This contract governs documentation surfaces. The installed app keeps its existing Phase 20 UI contract. Contract approval is an inline specification review, not evidence of a completed visual walkthrough.

## Design System

| Property | Value |
|---|---|
| Tool / preset | none / not applicable |
| Component and icon libraries | none; semantic HTML and text |
| Font | system-ui, sans-serif; no web fonts |
| Baseline | Existing `docs/offline-guide/index.html`; no redesign required |

## Spacing Scale

Use 4/8/16/24/32/48/64 px for new spacing. Preserve readable existing layout. Explicit inherited exceptions: main padding 28/70 px, narrow padding 20/15 px, navigation 18 px, table cells 10 px and proportional heading/list margins; these are documentation layout values, not changes to app controls.

## Typography

| Role | Size | Weight | Line height |
|---|---|---|---|
| Body | 17 px | 400 | 1.6 |
| Table labels/body | 0.93 rem | 700/400 | 1.6 |
| Heading | browser h2 default, approximately 25.5 px | 700 | 1.6 |
| Display | 2.2 rem; 1.8 rem below 600 px | 700 | 1.15 |

Do not truncate procedure steps or commands. Screenshots have descriptive alt text and visible captions. Heading order and link names identify the task.

## Color

| Role | Value | Use |
|---|---|---|
| Dominant | #ffffff / #f2f4f6 | Reading surface / outside background |
| Secondary | #edf4fa | Navigation and table headings |
| Text | #202c38 | Main copy |
| Accent | #175a96 | Links only |
| Caution | #b07921 / #fff6e6 | Trial/internal-cost guidance |
| Destructive | not applicable | Guide performs no destructive action |

## Copywriting Contract

| Element | Copy / rule |
|---|---|
| Primary link | “Worked example” or the specific destination file/task |
| Trial status | “Internal trial guide”; actual acceptance remains pending until recorded |
| No assigned contact | “Support contact pending assignment”; do not invent a name |
| Missing example or broken link | “Keep the complete guide folder together. Recopy the verified kit if a file is missing.” |
| Internal export guidance | “Exports contain internal material cost, labor cost and margin.” |
| Destructive instruction | Describe the app's existing explicit confirmation; guide links never delete or install automatically |

## Surfaces and interaction

- E1: Static guide content and quantity tables, including long paths, Unicode units and troubleshooting lists.
- E2: Contents navigation and local example/download links. Use native focusable anchors, normal browser history and visible keyboard focus; no scripts intercept navigation.
- E3: Local screenshots with useful alt text/captions. Instructions remain understandable if an image is unavailable; there is no network fetch or application loading spinner.

## Registry Safety

No registry blocks, external scripts, remote fonts, new design packages or package installation.

## Checker Sign-Off

- [x] Copywriting: specific task names, internal export audience and pending ownership.
- [x] Visuals: reuse actual screenshots and local synthetic examples; human layout review pending.
- [x] Color: explicit existing palette and limited accent use.
- [x] Typography: existing font sizes/weights and readable content contract.
- [x] Spacing: scale and inherited exceptions explicit.
- [x] Registry safety: none used.
- [x] Inventory provenance: no component design system; inventory not applicable.

Approval: 2026-10-23, inline contract review under autonomous continuation. Actual visual acceptance belongs to 21-03; no independent UI checker was dispatched.

## UI Considerations

Autonomous kind confirmation: E1 static-content + list-collection; E2 nav + interactive-control; E3 media. The compiled probe raised 16 applicable states; all retain backstop verification. Specification resolution does not mean execution evidence exists. All 16 require actual observations in 21-03-02; missing evidence remains human_needed. Raw report: `21-UI-PROBE.json`.

| Category | Element | Status | Resolution / verification |
|---|---|---|---|
| empty | E1: Guide content/tables | Backstop | What is shown when there is no data — zero items, an unfilled form, or absent media? Evidence required in 21-03-02. |
| loading | E1: Guide content/tables | Backstop | What is shown while data or content is still loading (skeleton, spinner, progressive reveal)? Evidence required in 21-03-02. |
| error | E1: Guide content/tables | Backstop | What is shown when the load or submit fails (message, retry affordance, partial fallback)? Evidence required in 21-03-02. |
| populated | E1: Guide content/tables | Backstop | What does the normal populated (happy-path) state look like at a typical volume of content? Evidence required in 21-03-02. |
| partial | E1: Guide content/tables | Backstop | What is shown for partial or incomplete data — some fields or rows present, others missing? Evidence required in 21-03-02. |
| overflow | E1: Guide content/tables | Backstop | What happens when content exceeds its container — scroll, clip, wrap, or truncate? Evidence required in 21-03-02. |
| zero-one-many | E1: Guide content/tables | Backstop | How does the layout read at zero, one, and many items (singular vs plural copy, spacing)? Evidence required in 21-03-02. |
| long-text | E1: Guide content/tables | Backstop | What happens with unusually long text — truncation, wrapping, ellipsis, or reflow? Evidence required in 21-03-02. |
| loading | E2: Navigation/local links | Backstop | What is shown while data or content is still loading (skeleton, spinner, progressive reveal)? Evidence required in 21-03-02. |
| error | E2: Navigation/local links | Backstop | What is shown when the load or submit fails (message, retry affordance, partial fallback)? Evidence required in 21-03-02. |
| overflow | E2: Navigation/local links | Backstop | What happens when content exceeds its container — scroll, clip, wrap, or truncate? Evidence required in 21-03-02. |
| long-text | E2: Navigation/local links | Backstop | What happens with unusually long text — truncation, wrapping, ellipsis, or reflow? Evidence required in 21-03-02. |
| empty | E3: Screenshots | Backstop | What is shown when there is no data — zero items, an unfilled form, or absent media? Evidence required in 21-03-02. |
| loading | E3: Screenshots | Backstop | What is shown while data or content is still loading (skeleton, spinner, progressive reveal)? Evidence required in 21-03-02. |
| error | E3: Screenshots | Backstop | What is shown when the load or submit fails (message, retry affordance, partial fallback)? Evidence required in 21-03-02. |
| populated | E3: Screenshots | Backstop | What does the normal populated (happy-path) state look like at a typical volume of content? Evidence required in 21-03-02. |
