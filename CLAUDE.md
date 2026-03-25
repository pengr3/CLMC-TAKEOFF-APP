<!-- GSD:project-start source:PROJECT.md -->
## Project

**CLMC Takeoff App**

A Windows desktop takeoff application for construction estimators. Users upload PDF floor plans, set scale, and place markups (counts, linear measurements, areas, perimeters) directly on the plan to quantify materials and items. The output is a structured BOQ/BOM sheet exported to Excel or CSV for use in project bids and client quotations.

**Core Value:** Speed up quantity takeoff — let the estimator focus on reading the plan, not doing math.

### Constraints

- **Platform**: Windows desktop — must run as an installed application on Windows
- **Offline**: Must work fully offline — no internet dependency for core features
- **PDF rendering**: Must handle real-world construction PDFs (large files, high-res scans, multi-page)
- **Markup persistence**: All markups must stay precisely positioned when zooming — this is critical to usability
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | 35.x (current: 35.0.0) | Desktop shell — wraps the web UI as a native Windows app | Bundles Chromium, so PDF.js and Konva run against a known, controlled engine. No WebView2 fragmentation risk. 60%+ of cross-platform desktop apps use it. Direct access to Node.js fs/dialog APIs in the main process. |
| React | 19.x | UI framework | Component model maps cleanly to the tool palette, markup list, and property panels. react-konva requires React. Dominant in Electron toolchains. |
| TypeScript | 5.x | Language | Mandatory for a project with complex markup data structures (polygons, polylines, counts, scale state). Catching shape mismatches at compile time saves hours. |
| electron-vite | 3.x | Build tooling | Official Electron + Vite integration. Hot reload for renderer, separate builds for main/renderer/preload, TypeScript out of the box. The de-facto standard boilerplate in 2025. |
| pdfjs-dist | 5.5.x (current: 5.5.207) | PDF parsing and rasterisation to canvas | Mozilla PDF.js is the only mature, battle-tested, open-source PDF renderer that runs in a JS environment. Used in Firefox and Chrome's built-in viewers. Handles multi-page, large construction drawings, and high-res scans. Version 5 is actively maintained. |
| Konva.js + react-konva | konva 10.2.x / react-konva 19.2.x | Interactive canvas layer for all markup shapes (count pins, polylines, polygons, scale line) | Konva gives each markup shape its own interactive node with drag, click, and transform events. Zoom/pan is applied at the Stage level, so all shapes scale together relative to the PDF underneath — critical for markup precision. Has an official "Image Labeling" sandbox that matches this use case exactly. |
| Zustand | 5.0.x (current: 5.0.12) | App-wide state (open project, markup list, active tool, scale calibration) | Minimal boilerplate, no context provider pyramid. Persist middleware can serialise state to JSON for project file save/load. Works natively in Electron's renderer process. |
| ExcelJS | 4.4.0 | Export takeoff sheet to .xlsx | Richer formatting API than SheetJS CE: column widths, bold headers, category grouping with alternating row colours. Node.js native — runs in Electron's main process. SheetJS CE is faster for read-heavy tasks; ExcelJS wins for write-formatting, which is this app's only use case. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-builder | 26.8.x (current: 26.8.1) | Package and distribute as a Windows .exe installer | Always — standard packaging tool. Produces NSIS installer (.exe) and optionally .msi. Handles code signing. |
| Tailwind CSS | 4.x | Styling the tool palette, sidebar, panels | Not for the canvas — only for React UI chrome. Prevents stylesheet sprawl for a single-developer project. |
| csv-stringify | 6.x (from csv package) | Export takeoff sheet to CSV | Simple, streaming. Use alongside ExcelJS; user may want raw CSV for older estimating tools. |
| immer | 10.x | Immutable update helpers inside Zustand reducers | Use when markup list mutations (add, delete, rename, reorder) become complex. Optional but prevents accidental state mutation bugs. |
| react-virtuoso (or Intersection Observer) | — | Virtual rendering of the PDF page list | Use when projects have 20+ pages. Prevents mounting off-screen canvases. Can defer until performance is observed to be a problem. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| electron-vite CLI | Scaffold and develop the app | `npm create electron-vite@latest` → choose React + TypeScript template |
| Vitest | Unit tests for measurement math, scale calibration, export formatting | Runs in Node.js; no DOM needed for pure calculation tests |
| Playwright (electron plugin) | End-to-end tests | Optional for v1; useful before adding complex markup interactions |
| ESLint + typescript-eslint | Linting | Include from day one; Electron's IPC boundary is a frequent source of subtle type errors |
## Installation
# Scaffold with electron-vite (React + TypeScript)
# PDF rendering
# Canvas markup layer
# State management
# Excel / CSV export
# Styling
# Packaging (dev dependency)
# Testing
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Electron 35 | Tauri 2.0 | If final binary size is a hard constraint (Tauri produces <10 MB vs Electron's ~150 MB). However, Tauri on Windows still relies on WebView2 for the renderer, which introduces version drift risk and has known issues with large canvas workloads. For this app — where PDF rendering fidelity and canvas performance are critical — Electron's bundled Chromium is the safer choice. |
| Electron 35 | WPF / WinUI 3 | If the team is C#/.NET only and JavaScript is off the table. WPF gives native Windows controls and excellent PDF via PdfSharp, but the canvas/annotation stack (InkCanvas) is far less capable than Konva, and there is no web ecosystem for the markup tooling. |
| pdfjs-dist 5.x | PDFium (via native addon) | If pdfjs-dist has performance problems with extremely large (>200 MB) scanned-raster PDFs. PDFium (used by Chrome) renders faster but requires a native C++ addon, complicating the build. Attempt pdfjs-dist first; migrate only if benchmarks fail. |
| Konva + react-konva | Fabric.js | Fabric.js is usable but has slower development cadence and weaker React integration. Konva's Stage/Layer model maps directly to the PDF background + markup overlay pattern. |
| Konva + react-konva | Plain HTML5 Canvas API | Viable but you lose per-shape event handling, hit detection, and the transformer widget for free editing. Every feature requires manual implementation. Only consider if Konva's overhead proves measurable. |
| ExcelJS | SheetJS (xlsx) CE | SheetJS CE has 40% more weekly downloads and is faster for reading workbooks. Prefer it if the app ever needs to read existing Excel files. For write-only export with formatted headers, ExcelJS is cleaner. Note: SheetJS Pro/paid tier has features the CE licence does not. |
| Zustand | Redux Toolkit | Redux Toolkit is appropriate when state logic is shared across a large team with strict action-tracing requirements. For a single-developer app this is unnecessary overhead. |
| electron-vite | Create React App + electron | CRA is deprecated. Do not use it. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Officially deprecated, no Vite support, broken peer deps in 2025 | electron-vite with react-ts template |
| Webpack-based Electron boilerplates (electron-react-boilerplate pre-2024) | Slow rebuilds, complex config, many are unmaintained | electron-vite |
| react-pdf (npm package) | Renders PDF pages as React components (good for documents), not a raw canvas — you cannot overlay a Konva stage on top of it cleanly | pdfjs-dist directly, rendering to an offscreen canvas, then displayed as an HTML canvas behind the Konva Stage |
| pdf-lib | PDF generation/editing library, not a renderer. Cannot display PDFs | pdfjs-dist |
| SheetJS xlsx (for write-formatted output) | The Community Edition has reduced formatting support; the Pro licence is paid. For simple CSV output SheetJS is fine, but for the formatted BOQ sheet ExcelJS is cleaner | ExcelJS for .xlsx, csv-stringify for .csv |
| Tauri (for this specific app) | Tauri's system WebView on Windows is WebView2, which is Chromium-based and generally fine — but it is not bundled, meaning its version depends on the user's machine. Canvas-heavy workloads and pdfjs-dist have known edge cases when WebView2 is outdated. Electron's bundled engine eliminates this variable entirely. | Electron |
| Redux / MobX | Heavier than needed for a single-user, single-window app. Zustand handles all state with less ceremony. | Zustand |
| SQLite (for project files) | Unnecessary for single-file project persistence. Adds a native addon dependency. | JSON project files written with Node.js `fs.writeFile` via IPC |
## Stack Patterns by Variant
- Render each PDF page using `pdfjs-dist` at the target resolution into an offscreen `<canvas>` element
- Draw that canvas as a Konva `Image` node on the bottom layer of the Konva Stage
- All markup shapes (count dots, polylines, polygons) live in a second Konva layer above the PDF image
- Pan/zoom is handled by transforming the Konva Stage — both the PDF image and all markup shapes move together, keeping markups pinned to the plan at all zoom levels
- User activates "Set Scale" tool → draws a line between two known points using a Konva `Line` node
- Konva returns pixel coordinates of start/end points
- User types the real-world distance (e.g., "5 metres")
- Store: `pixelsPerMeter = linePixelLength / realWorldDistance`
- All subsequent measurement calculations multiply pixel lengths by this ratio
- Plain JSON written to disk via Electron IPC (`ipcMain` handles `fs.writeFile`)
- Structure: `{ version, pdfPath, pages: [{ pageIndex, scale: { pixelsPerUnit, unit }, markups: [...] }] }`
- Markups store canvas-coordinate points (not pixel-absolute, so they survive resolution changes on re-open)
- PDF is referenced by path, not embedded — keeps project files small
- Zustand markup state → group by category → ExcelJS workbook → Electron `dialog.showSaveDialog` → `fs.writeFile`
- Separate CSV path using `csv-stringify` for users who want raw data
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-konva 19.2.x | React 19.x, konva 10.x | Peer dep on React 19 confirmed. Do not mix react-konva 18.x with React 19. |
| pdfjs-dist 5.5.x | Node 18+ / Chromium 120+ | Requires a worker script; in Electron, copy `pdfjs-dist/build/pdf.worker.mjs` to the renderer's public folder or use `vite-plugin-static-copy` |
| ExcelJS 4.4.0 | Node 18+ | Last published ~2 years ago but stable. No known issues with Electron 35 / Node 22. |
| electron-builder 26.8.x | Electron 35.x | Actively maintained; verify `electron` peer dep in package.json when upgrading Electron |
| Zustand 5.0.x | React 18+, React 19 | v5 dropped some legacy APIs from v4. No breaking changes relevant to this app. |
| Tailwind CSS 4.x | Vite 6.x | Tailwind 4 uses the `@tailwindcss/vite` plugin, not the PostCSS path. Ensure correct config. |
## Sources
- [Electron 35.0.0 release blog](https://www.electronjs.org/blog/electron-35-0) — version confirmed, Node 22.14.0, Chromium 134
- [electron-builder npm](https://www.npmjs.com/package/electron-builder) — version 26.8.1 confirmed
- [electron-vite official site](https://electron-vite.org/) — recommended Vite-based build tooling
- [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) — version 5.5.207 confirmed current (March 2026)
- [mozilla/pdfjs-dist GitHub](https://github.com/mozilla/pdfjs-dist) — release history verified
- [Konva GitHub releases](https://github.com/konvajs/konva/releases) — version 10.2.3 confirmed
- [react-konva npm](https://www.npmjs.com/package/react-konva) — version 19.2.3 confirmed current
- [Konva Image Labeling sandbox](https://konvajs.org/docs/sandbox/Image_Labeling.html) — confirms annotation-over-image pattern
- [Konva Interactive Building Map sandbox](https://konvajs.org/docs/sandbox/Interactive_Building_Map.html) — confirms floor plan use case
- [zustand npm](https://www.npmjs.com/package/zustand) — version 5.0.12 confirmed current
- [ExcelJS npm](https://www.npmjs.com/package/exceljs) — version 4.4.0 confirmed
- [SheetJS Electron demo](https://docs.sheetjs.com/docs/demos/desktop/electron/) — Electron 35.1.2 support confirmed
- [Electron vs Tauri — DoltHub 2025](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — framework comparison, WebView fragmentation risks
- [Tauri WebView versions reference](https://v2.tauri.app/reference/webview-versions/) — WebView2 dependency on Windows confirmed
- [pdfjs-dist canvas rendering — DeepWiki](https://deepwiki.com/mozilla/pdfjs-dist/4.1-canvas-rendering) — multi-threaded worker architecture, performance guidance
- [Optimizing In-Browser PDF Rendering — Joyfill](https://joyfill.io/blog/optimizing-in-browser-pdf-rendering-viewing) — render only visible pages, canvas scaling at code level
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
