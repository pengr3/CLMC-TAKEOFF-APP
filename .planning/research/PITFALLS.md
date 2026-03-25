# Pitfalls Research

**Domain:** Windows desktop construction takeoff application (PDF viewing, canvas markup, scale calibration, BOQ export)
**Researched:** 2026-03-25
**Confidence:** HIGH (PDF coordinate system, DPI/canvas pitfalls) | MEDIUM (scale accuracy, export edge cases) | HIGH (project file pitfalls from Electron community)

---

## Critical Pitfalls

### Pitfall 1: PDF Coordinate Origin Inversion

**What goes wrong:**
PDF documents define their origin at the bottom-left corner with the y-axis increasing upward. The HTML canvas (and PDF.js) places its origin at the top-left with the y-axis increasing downward. If you store markup coordinates in canvas/screen space and later try to match them back to PDF space (for export, re-load, or re-render at a different scale), all y-coordinates are inverted. Markups appear at the mirror-image position along the vertical axis.

**Why it happens:**
PDF.js internally performs this transform before rendering, but it is invisible to the consumer. Developers store the mouse position at the time of click — which is already in screen/canvas space — without applying the inverse transform. The bug is invisible until the page is zoomed, reloaded, or scaled differently.

**How to avoid:**
Define one canonical coordinate space for stored markup coordinates and always convert to it on write, away from it on read. The safest canonical space is normalised PDF user-space (0.0–1.0 per axis, relative to the page dimensions returned by PDF.js `page.getViewport()`). Convert every mouse/canvas event to this space immediately on capture; convert back to canvas pixels only for rendering. Never persist raw canvas pixel coordinates.

**Warning signs:**
- Markup appears correct at first load but jumps when the window is resized
- Markups are mirrored vertically on reload
- Scale calibration line appears in a different position after save/reload

**Phase to address:** PDF viewer + canvas foundation phase (must be established before any markup logic is written)

---

### Pitfall 2: Markup Position Drift on Zoom and Pan

**What goes wrong:**
When the user zooms in or out, all existing markups shift from their original positions on the plan. The drift is proportional to zoom level and gets worse the further a markup is from the zoom origin. At 4× zoom, markups can appear millimetres off their true position in screen space.

**Why it happens:**
The pan/zoom state is an affine transform (translate + scale) applied to the canvas. If markups are rendered by converting stored pixel coordinates by the same scale factor but ignoring the translate component, or using the wrong pivot point, they drift. A common mistake is `storedX * zoom` without accounting for the viewport offset and pan position.

**How to avoid:**
Maintain a single transform matrix for the viewport (scale + translation). To place a markup at render time, apply the full matrix: `screenX = storedNormX * pageWidth * scale + panOffsetX`. Never apply scale and translate as separate independent steps with different origins. Test: zoom to 4×, pan to a corner, add a markup, zoom out — the markup must remain on the same plan point at all zoom levels.

**Warning signs:**
- Markups look correct at 1× but shift at 2× or higher
- After panning and then zooming, markups are consistently offset in the pan direction
- Scale calibration line does not overlay the same two points after zoom

**Phase to address:** Canvas + zoom/pan phase, before markups are introduced

---

### Pitfall 3: Scale Calibration Error Compounds Over Distance

**What goes wrong:**
A small error in the scale calibration (e.g. 1–2% off because the user clicked slightly inside or outside the intended reference points) compounds over distance. A 2% error on a 50m wall run is 1m of error. On a large site plan, a single mis-click can produce BOQ quantities that are wrong by meaningful amounts.

**Why it happens:**
The calibration line is drawn between two mouse clicks in screen/canvas space. If the click target is a pixel or two off the intended reference (e.g. a grid line or room label), the computed pixels-per-metre ratio is slightly wrong. This error affects every subsequent measurement proportionally.

**How to avoid:**
- Implement snap-to-nearest: during calibration drawing, snap the start and end points to the nearest significant change in pixel brightness (edge detection heuristic) or to integer canvas units. Even a 2 px snap radius helps significantly.
- After calibration, display the computed scale (e.g. "1 mm = 14.3 px") and ask the user to confirm before proceeding.
- Provide a "verify scale" affordance: the user draws a second known distance and the app reports the measured vs. expected value so the user can catch errors before takeoff begins.
- Per-page scale: never inherit scale from another page silently. Each page must be calibrated explicitly or display a clear "NOT CALIBRATED" warning.

**Warning signs:**
- Measurements of known dimensions (room widths, door openings) are consistently off by the same percentage
- Scale factor displays with an implausible value (e.g. 0.001 px/mm or 1000 px/mm)
- User reports quantity totals that seem too high or too low

**Phase to address:** Scale calibration phase

---

### Pitfall 4: Rotated PDF Pages Break All Coordinate Math

**What goes wrong:**
Construction PDFs frequently have pages with a `/Rotate` entry (90°, 180°, 270°). PDF.js renders a rotated page visually correctly, but the coordinate transform it applies is non-obvious. A markup placed on a 90°-rotated page at canvas position (x, y) does not map to the same PDF-space coordinates as it would on an unrotated page. On reload, markups appear on the wrong side of the page or at wrong positions.

**Why it happens:**
The PDF page viewport returned by `page.getViewport({ scale, rotation })` incorporates the rotation into the viewport dimensions and transform matrix. Developers who extract `viewport.width` and `viewport.height` without consulting `viewport.transform` will apply an incorrect normalisation, because for a 90°-rotated page, width and height are swapped relative to the PDF MediaBox.

**How to avoid:**
Always use `viewport.convertToPdfPoint(x, y)` (PDF.js built-in) to convert canvas coordinates to PDF-space coordinates when storing markups. On load, use `viewport.convertToViewportPoint(pdfX, pdfY)` to convert back. Never manually implement this transform — the built-in handles rotation, CropBox, and MediaBox correctly. Verify with a test PDF that has a 90° rotated page.

**Warning signs:**
- Markups are correct on portrait pages but wrong on landscape pages
- A markup placed at the centre of a rotated page appears at the edge on reload
- The scale calibration line shows a plausible scale on portrait but an implausible one on landscape

**Phase to address:** PDF viewer + canvas foundation phase

---

### Pitfall 5: Canvas Size Limit Causes Silent Fallback to CSS Scaling

**What goes wrong:**
When the user zooms in to see fine detail on a large construction plan, PDF.js hits the browser's maximum canvas size limit (varies by browser/Electron version: typically 4096×4096 or 16384×16384 px). PDF.js silently falls back to CSS `transform: scale()` on the existing raster canvas. The result is pixelated, blurry rendering at high zoom — exactly where the estimator needs to read fine text and dimension annotations.

**Why it happens:**
Electron embeds Chromium, which enforces GPU texture size limits. A large A0 construction drawing rendered at 3× zoom on a 2560×1440 monitor requires a canvas larger than 16K pixels on one axis. PDF.js detects this and degrades gracefully rather than throwing an error, so there is no visible error message.

**How to avoid:**
- Set the render scale to `devicePixelRatio * desiredZoom` but cap the canvas to a safe size. Implement tiled rendering: divide the page into tiles, render each at full resolution, composite on a background canvas.
- Alternatively, restrict the maximum zoom level to what can be rendered at full resolution given the current page size and display resolution.
- Test with an A0 or A1 PDF at 4× zoom as part of acceptance criteria.

**Warning signs:**
- PDF appears sharp at 1× but blurry at 2× or higher
- No error is thrown; the degradation is silent
- `canvas.width` in devtools is smaller than expected given the zoom level

**Phase to address:** PDF viewer phase

---

### Pitfall 6: Scanned PDF Plans Have Inherently Lower Measurement Accuracy

**What goes wrong:**
Many construction PDFs are scans of paper drawings, not CAD-exported vector PDFs. On scanned plans, there is no pixel-perfect edge to snap to. Lines are several pixels wide, corners are fuzzy, and the scan may have slight warp or skew from the physical paper not lying flat. Measurement accuracy is fundamentally limited by scan quality — a user expecting sub-millimetre precision will get 1–5% error instead.

**Why it happens:**
This is a physical limitation, not a software bug. However, an app that treats scanned and vector PDFs identically, without warning the user, will produce BOQ quantities that appear authoritative but carry significant error.

**How to avoid:**
- Detect whether a PDF page is raster-dominant (no vector paths, high image content) vs. vector. PDF.js operator lists can reveal this: many `paintJpegXObject` / `paintImageXObject` calls with no `constructPath` calls indicate a scanned page.
- Display a visible warning when a scanned page is detected: "This appears to be a scanned plan. Measurement accuracy depends on scan quality. Verify scale against a known dimension."
- Do not implement snap-to-edge features on scanned pages — they will snap to fuzzy pixel edges, not true geometry.

**Warning signs:**
- PDF rendered at 1× looks slightly grainy or soft
- Zooming in reveals pixelation at 2–3×
- PDF.js operator log shows image paint ops but no path construction ops

**Phase to address:** PDF viewer phase (detection) + scale calibration phase (warning)

---

## Moderate Pitfalls

### Pitfall 7: Project File Stores Absolute PDF Path — Breaks on Move or Share

**What goes wrong:**
The saved project file records the full absolute path to the PDF (e.g. `C:\Users\Admin\Documents\Project A\plan.pdf`). When the user moves the project folder to a new location, renames the folder, or opens the project on a different machine, the PDF cannot be found and the project opens with a blank canvas.

**Why it happens:**
Using `dialog.showOpenDialog` returns an absolute path, and developers store it directly. No thought is given to what happens when that path becomes invalid.

**How to avoid:**
- Store the PDF path relative to the project file location when both files are in the same directory or a subdirectory. On open, resolve the absolute path from the project file's location.
- On open, if the resolved path does not exist, show a "PDF not found" dialog with a "Browse for PDF" button — do not silently fail or crash.
- Optionally embed a PDF page count and file size fingerprint so the app can warn if the wrong PDF is re-linked.

**Warning signs:**
- Project opens with errors if folder is renamed
- "File not found" errors when opening projects sent between team members
- App crashes instead of showing a graceful "PDF missing" message

**Phase to address:** Project save/load phase

---

### Pitfall 8: No Schema Version in Project File — Future Migration Impossible

**What goes wrong:**
The project file format (JSON or otherwise) has no version field. When the app is updated and the schema changes (new fields, renamed keys, new markup types), old project files cannot be loaded because the app cannot distinguish between format version 1 and format version 2. Either old files are silently corrupted on open, or the app crashes attempting to read fields that do not exist.

**Why it happens:**
Schema versioning feels unnecessary for a v1 MVP where there is only one format. By v3, it is too late to add retroactively because there is no way to identify which version of the format a file was saved in.

**How to avoid:**
Add `"formatVersion": 1` to every project file from the very first save. Implement a migration layer that checks this field on open and upgrades old formats before parsing. Even if the migration does nothing in v1, the infrastructure is in place.

**Warning signs:**
- Any `cannot read property of undefined` crash on project open after an app update
- Users losing work after updating the app
- Support requests: "my projects stopped loading after the update"

**Phase to address:** Project save/load phase

---

### Pitfall 9: Float Accumulation Error in Area and Linear Calculations

**What goes wrong:**
Area and linear measurements computed by summing many small coordinate differences accumulate floating-point rounding error. For a polygon with 50 vertices, each stored as a floating-point normalised coordinate, the area computation via the Shoelace formula can be off by a few square centimetres in real-world units. This is rarely visible to the user but can cause BOQ line items to show 0.00 instead of a small positive value for thin regions.

**Why it happens:**
IEEE 754 double-precision floats have ~15 significant digits. Normalised coordinates (0.0–1.0) multiplied by large page dimensions in mm then divided by scale factors produce intermediate values that exceed the precision of the final result.

**How to avoid:**
- Store coordinates with sufficient precision (do not truncate to 2 decimal places during storage).
- For display, round to the unit of measure used in BOQ output (e.g. 2 decimal places for m², 0 decimals for count). Never round during intermediate computation.
- Add a minimum non-zero threshold for display: if a computed area is < 0.001 m², display it but flag it as "very small area — verify".

**Warning signs:**
- Area shows as 0.00 for a clearly non-zero polygon
- Two identical polygons placed separately show different areas
- Summed line items in BOQ differ from manually calculated totals

**Phase to address:** Measurement calculation phase

---

### Pitfall 10: High devicePixelRatio (HiDPI) Screen Makes Markups Appear at Wrong Size

**What goes wrong:**
On HiDPI displays (Windows with 150% or 200% scaling), `window.devicePixelRatio` is 1.5 or 2.0. If the canvas is sized in CSS pixels but the mouse event coordinates are in physical pixels (or vice versa), every markup click is placed at 1.5× or 2× the wrong position. Markups appear offset from where the user clicked.

**Why it happens:**
In Electron/Chromium, mouse events report coordinates in CSS pixels (logical pixels). The canvas `width` and `height` attributes must be set to physical pixels (`cssWidth * devicePixelRatio`) while the CSS `width` and `height` style must be set to CSS pixels. If either side of this is wrong, the coordinate systems are mismatched.

**How to avoid:**
At canvas initialisation: set `canvas.width = container.offsetWidth * devicePixelRatio`, `canvas.height = container.offsetHeight * devicePixelRatio`, `canvas.style.width = container.offsetWidth + 'px'`, `canvas.style.height = container.offsetHeight + 'px'`, then scale the context: `ctx.scale(devicePixelRatio, devicePixelRatio)`. All drawing and coordinate logic then operates in CSS pixel space. Test explicitly on a 150% scaled Windows display.

**Warning signs:**
- Markups appear at correct position on 100% display scaling but offset at 125% or 150%
- Markup hit areas do not match their visual position
- Canvas appears blurry on HiDPI screens

**Phase to address:** Canvas foundation phase

---

### Pitfall 11: Excel Export Breaks on Special Characters in Item Names

**What goes wrong:**
Freehand markup names typed by the user may contain characters that cause issues in Excel exports: ampersands (`&`), angle brackets (`<`, `>`), control characters, very long strings (>255 chars in older Excel cell limits), or emoji. The export either produces a corrupt `.xlsx` file, silently truncates names, or crashes the export library.

**Why it happens:**
Excel XML format requires XML-safe strings. Some Python/Node libraries (e.g. older versions of SheetJS) do not escape all XML special characters. User input is unpredictable — a user might paste a name from a specification document that contains smart quotes, em-dashes, or Arabic/Chinese characters.

**How to avoid:**
- Sanitise all string values before passing to the export library: strip or replace control characters (U+0000–U+001F except tab/newline), ensure UTF-8 encoding throughout.
- Test the export with: item name containing `&`, `<`, `>`, `"`, `'`, a 300-character string, and a Unicode name (e.g. Arabic or Chinese characters).
- If using SheetJS (xlsx): use the latest version; older versions had XML escaping bugs that are fixed in current releases.
- Validate that the output `.xlsx` opens without repair warnings in Excel.

**Warning signs:**
- Excel opens the exported file with "file was repaired" warning
- Long item names are truncated in the output
- Export crashes with "invalid XML character" or similar error

**Phase to address:** BOQ export phase

---

### Pitfall 12: Zero-Quantity Items Exported Without Warning

**What goes wrong:**
If a user places an area polygon but accidentally closes it with zero area (three collinear points, or a double-click that produces a degenerate polygon), the BOQ export includes a line item with quantity 0. The estimator may not notice this and submit a bid with a missing quantity.

**Why it happens:**
The app has no validation step before export. Zero is a valid floating-point number, so no code error is raised. The item looks legitimate in the export.

**How to avoid:**
- Before export, scan all markups for zero or near-zero quantities.
- Present a pre-export validation summary: "3 items have zero quantity. Review before exporting." List the item names.
- Allow the user to proceed anyway (the item might legitimately be a placeholder) but require explicit acknowledgement.

**Warning signs:**
- BOQ contains line items with 0.00 in the quantity column
- User submits a bid and is asked about an item with no quantity
- Polygon markup appears as a dot or line rather than a closed shape

**Phase to address:** BOQ export phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store raw canvas pixel coordinates in project file | Simple — no coordinate conversion required | Markups drift on any window resize, zoom, or DPI change; project files are unusable on different screen resolutions | Never |
| Hardcode scale per-project (not per-page) | One calibration step per project | Pages with different scales (e.g. detail drawing vs. site plan in same PDF) are silently measured at the wrong scale | Never — a multi-page PDF can and regularly does have mixed scales |
| Skip `formatVersion` in project file | One less field to write | Impossible to migrate old project files after any schema change | Never |
| Use CSS zoom on the canvas container instead of re-rendering | Faster zoom interaction | Markup coordinates are in pre-zoom space; all interactions break; approach is fundamentally incompatible with accurate markup placement | Never for the markup canvas |
| Round stored coordinates to 2 decimal places | Smaller file size | Cumulative rounding error in area calculations; loss of sub-pixel precision | Never |
| Single global scale for all pages | Simpler UI | Multi-page PDFs with mixed drawing types will produce wrong quantities on any page with a different scale | Never for multi-page PDFs |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PDF.js `getViewport()` | Calling with `scale: 1` and then applying zoom via CSS transform on the container | Call `getViewport({ scale: desiredRenderScale })` and re-render at the new scale so the rasterised image is at the correct resolution |
| PDF.js `page.render()` | Not cancelling an in-progress render before starting a new one (triggered by rapid zoom changes) | Call `renderTask.cancel()` on the previous task before calling `page.render()` again; handle the `RenderingCancelledException` |
| PDF.js `convertToPdfPoint` / `convertToViewportPoint` | Building custom transform math instead of using the built-in methods | Always use `viewport.convertToPdfPoint(x, y)` and `viewport.convertToViewportPoint(pdfX, pdfY)`; the built-in handles rotation and CropBox |
| Excel export (SheetJS / exceljs) | Writing string quantities ("12.5 m²") instead of numeric values with a separate unit column | Store quantity as a number, unit of measure as a separate string column; allows downstream arithmetic in Excel |
| Electron `dialog.showOpenDialog` | Storing the returned absolute path directly in the project file | Store the path relative to the project file when possible; resolve absolute on load; handle missing-file gracefully |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering the PDF page on every mouse move during markup drawing | UI becomes unresponsive; CPU pegged at 100% during polygon tracing | Separate the PDF render canvas (rarely updated) from the markup overlay canvas (updated on each interaction frame); only composite them for display | Immediately on any non-trivial PDF |
| Synchronous PDF page load blocking the UI thread | App freezes for 2–10 seconds when opening a large PDF page | Use PDF.js async API throughout; show a loading spinner; never `await` page render on the main render loop | PDFs > 5 MB or > 20 pages |
| Loading all pages into memory at startup | Memory usage spikes to 1–2 GB for a 50-page PDF | Load only the currently viewed page; cache the previous and next page; evict others | PDFs > 10 pages |
| Re-computing all markup quantities on every render frame | Noticeable lag when the user has > 50 markups | Compute quantity on markup completion and cache the result; only recompute on edit | > 50 markups per page |
| Canvas `toDataURL()` or `getImageData()` on large canvases for thumbnail generation | Freezes UI for several seconds | Generate thumbnails asynchronously in a web worker or OffscreenCanvas; cap thumbnail resolution to 200×200 px | Any canvas > 1000×1000 px |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No undo for markup placement | Estimator mis-clicks and must delete and redo; frustrating on precise work | Implement Ctrl+Z undo from the first markup phase; estimators expect it |
| Calibration line invisible after it is set | User cannot verify or re-check the scale reference visually | Persist the calibration line as a faint visual on the canvas; allow the user to show/hide it |
| No per-page calibration status indicator | User forgets to calibrate a new page and takes measurements at wrong scale | Show a persistent "CALIBRATED / NOT CALIBRATED" badge per page in the page navigation UI |
| Markup name prompt appears as a modal dialog | Interrupts flow; estimator must take hands off the plan | Use an inline text field that appears at the markup location immediately after placement |
| Export overwrites previous export without confirmation | User accidentally overwrites a manually edited BOQ | Ask for a file path on every export, or detect that the file exists and ask "overwrite or save as new?" |
| No visual distinction between markup types | Difficult to review a dense plan — counts look like linear endpoints | Use distinct colours and symbols per markup type (pin for count, line for linear, filled polygon for area) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Scale calibration:** Verify that the calibration line survives a save/reload cycle and that the resulting scale factor is identical after reload — not approximately equal.
- [ ] **Markup persistence:** Verify that every markup type (count, linear, area, perimeter) appears at the exact same visual position after save, close, and reopen on a different window size.
- [ ] **Rotated page markups:** Verify that a markup placed on a 90°-rotated PDF page appears at the correct position after reload.
- [ ] **HiDPI markup placement:** Verify markup click accuracy on a machine set to 150% Windows display scaling.
- [ ] **Zero-quantity export guard:** Verify that a degenerate polygon (three collinear points) is flagged before export, not silently exported as 0.00.
- [ ] **Special character export:** Verify that an item name containing `&`, `<`, `>`, and a 200-character string produces a valid `.xlsx` that opens without Excel's repair warning.
- [ ] **Missing PDF graceful error:** Verify that renaming the PDF file and then opening the project produces a clear "PDF not found" message, not a crash.
- [ ] **Multi-page mixed scale:** Verify that calibrating page 1 does not silently apply the same scale to page 2.
- [ ] **Rapid zoom re-render:** Verify that rapidly scrolling the zoom wheel does not produce a blank canvas or a race condition between two in-flight render tasks.
- [ ] **Large PDF first load:** Verify that a 50-page, 100 MB PDF opens without freezing the UI (loading indicator must appear within 200 ms of file selection).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Coordinate space stored as canvas pixels (wrong) | HIGH | Requires data migration: reload each project, re-derive normalised coordinates from stored pixels using the original window/zoom state (often impossible without that context — may require re-doing takeoff) |
| No `formatVersion` in project file | MEDIUM | Add the field now with value 1; treat any file missing the field as version 0 in the migration layer; document what version 0 means |
| Absolute PDF paths in project files | LOW | Add path-resolution fallback logic: try absolute first, then try relative to project file location; prompt user to browse if both fail |
| Scale shared across pages (wrong) | MEDIUM | Add per-page scale storage; on migration, copy the project-level scale to all existing pages as their default, flag them as "unverified" |
| Markup quantities stored as formatted strings (e.g., "12.5 m²") | HIGH | Requires re-parsing all exported data; cannot reliably reverse-parse user-formatted strings back to numbers |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PDF coordinate origin inversion | Phase 1: PDF viewer + canvas foundation | Round-trip test: place a markup, save, reload — assert stored PDF-space coordinates are identical |
| Markup drift on zoom/pan | Phase 1: Canvas foundation (zoom/pan) | Visual regression: markup must overlay the same plan point at 1×, 2×, 4×, and after pan |
| Scale calibration compounding error | Phase 2: Scale calibration | Measure a known dimension (e.g., a door opening shown on plan) and verify it is within 1% of nominal |
| Rotated page coordinate break | Phase 1: PDF viewer | Test case: 90°-rotated page, place markup, reload, assert position unchanged |
| Canvas size limit / blur at zoom | Phase 1: PDF viewer | Test: A0 plan at 4× zoom — rendered content must be sharp, not pixelated |
| Scanned plan accuracy warning | Phase 1: PDF viewer | Test: open a scanned PDF — warning banner must appear |
| Project file absolute path break | Phase 3: Project save/load | Test: save project, rename PDF file, reopen — must show "PDF not found" not a crash |
| No schema version | Phase 3: Project save/load | Assert `formatVersion` field present in every saved file from day one |
| Float accumulation in area calc | Phase 2: Measurement calculation | Unit test: 50-vertex regular polygon area must match formula to within 0.01% |
| HiDPI coordinate mismatch | Phase 1: Canvas foundation | Manual test on 150% scaled display — markup must be placed exactly where clicked |
| Special chars in Excel export | Phase 4: BOQ export | Automated test with `&`, `<`, `>`, emoji, 300-char string — output must open without Excel repair |
| Zero-quantity export | Phase 4: BOQ export | Test: degenerate polygon must trigger pre-export validation warning |

---

## Sources

- [PDF Coordinate Systems — Apryse](https://apryse.com/blog/pdf-coordinates-and-pdf-processing)
- [PDF Rendering and Coordinate Systems — Datalogics](https://www.datalogics.com/pdf-rendering-coordinate-systems)
- [PDF Coordinate System — LeadTools](https://www.leadtools.com/help/sdk/v20/dh/to/pdf-coordinate-system.html)
- [Transform view coords to PDF coords accounting for CropBox and Rotation — Qoppa](https://kbdeveloper.qoppa.com/transform-from-view-coordinates-to-pdf-coordinates-to-take-into-account-cropbox-and-rotation-on-a-pdf-page/)
- [Critical Bug: PDF Annotation Positioning Mismatch — GitHub mattsilv/sign-pdf](https://github.com/mattsilv/sign-pdf/issues/1)
- [PDF.js Rendering Quality Complete Guide — Apryse](https://apryse.com/blog/pdf-js/guide-to-pdf-js-rendering)
- [Blurry Rendering on High DPI Display — PDF.js GitHub Issue #10509](https://github.com/mozilla/pdf.js/issues/10509)
- [Performance Issues When Rendering Large PDFs — react-pdf Discussion #1691](https://github.com/wojtekmaj/react-pdf/discussions/1691)
- [Raster PDFs vs. Vector PDFs in Bluebeam Revu — Taradigm](https://www.taradigm.com/raster-pdfs-vs-vector-pdfs-in-bluebeam-revu/)
- [Issues with Raster-Based PDFs — Bluebeam Technical Support](https://support.bluebeam.com/revu/troubleshooting/issues-with-raster-based-pdfs.html)
- [Transforming Mouse Coordinates to Canvas Coordinates — roblouie](https://roblouie.com/article/617/transforming-mouse-coordinates-to-canvas-coordinates/)
- [Zooming at the Mouse Coordinates with Affine Transformations — Medium](https://medium.com/@benjamin.botto/zooming-at-the-mouse-coordinates-with-affine-transformations-86e7312fd50b)
- [High DPI Rendering on HTML5 Canvas — cmdcolin](https://cmdcolin.github.io/posts/2014-05-22/)
- [Electron File Path Issues — GitHub electron/electron #44370](https://github.com/electron/electron/issues/44370)
- [PDF Quantity Takeoff Workflow 2025 — Planmetry](https://www.planmetry.com/blog/pdf-quantity-takeoff-workflow)
- [Construction Drawing File Types for Takeoff — TakeoffSoftware.com](https://www.takeoffsoftware.com/construction-drawing-file-types-what-do-they-mean-for-estimators-when-doing-a-takeoff/)

---
*Pitfalls research for: Windows desktop construction takeoff application*
*Researched: 2026-03-25*
