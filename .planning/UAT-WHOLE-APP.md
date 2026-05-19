# CLMC Takeoff App — Full Application User Acceptance Test

**Version:** v1.0 (covers all phases through Phase 10)
**Purpose:** Human tester runbook. Every session can be run independently or as part of a full regression.
**Audience:** Construction estimator performing acceptance testing — no coding knowledge required.

---

## Before You Start — Setup

### What you need

- A Windows PC with the CLMC Takeoff App installed (or running from the developer build: `npm run dev` in the project folder).
- Two construction PDF floor plans on your desktop:
  - **Plan A** — a multi-page PDF (at least 3 pages, ideally a real project you know). Something you can measure a known dimension on (a corridor width, a slab length, etc.).
  - **Plan B** — a second PDF with a *different number of pages* than Plan A (needed only for Session 5 recovery tests).
- A folder on your desktop called `UAT-test` — you will save files here.
- Microsoft Excel (for Session 6 export checks).

### Starting state for each session

Unless a session says otherwise, start with the app open and no project loaded (the empty "drop a PDF here" screen).

### How to read each test

- Steps are numbered. Do them in order.
- **Expected result** lines describe exactly what you should see or be able to do.
- `- [ ] Pass` — tick this box when the test passes. If it fails, note what happened instead.

---

## Session 1: Core PDF Workflow

**Goal:** Confirm the app opens PDFs correctly, navigates pages, and lets you zoom and pan so you can read a real construction drawing.

---

### Test 1-A: Open a PDF using the file picker

1. Click **Home** tab in the ribbon at the top of the app.
2. Click the **Open** button.
3. A Windows file-picker dialog appears. Navigate to and select Plan A.
4. The dialog closes.

**Expected result:** The first page of Plan A appears centered in the drawing area. The page is rendered clearly — text and lines are sharp. The bottom status bar shows the file name, "Page 1 of N", and a zoom percentage. The title bar shows the file name.

- [ ] Pass

---

### Test 1-B: Open a PDF by dragging and dropping

1. Close the current project (click **Home** > **Open** and cancel, or just relaunch the app so the empty screen appears).
2. In Windows Explorer, drag Plan A from your desktop and drop it directly onto the drawing area.

**Expected result:** The PDF loads and renders exactly as in Test 1-A.

- [ ] Pass

---

### Test 1-C: Navigate between pages

1. With Plan A open, locate the page navigation controls in the **Page** ribbon tab (or the arrow buttons visible in the page area).
2. Click the **Next** arrow (or press the right arrow key) to go to page 2.
3. The status bar updates to "Page 2 of N".
4. Click **Next** again to go to page 3.
5. Click **Previous** (or left arrow key) to return to page 2, then page 1.

**Expected result:** Each page appears when navigated to. The page counter in the status bar updates correctly. The Previous button is disabled (greyed out) when on page 1. The Next button is disabled on the last page.

- [ ] Pass

---

### Test 1-D: Zoom in and out with the mouse wheel

1. Position your cursor over a specific detail on the plan — for example, a room label or a door symbol.
2. Hold **Ctrl** and scroll the mouse wheel upward (zoom in). Scroll slowly through several steps.
3. The detail you aimed at stays under your cursor as the plan grows larger.
4. Hold **Ctrl** and scroll downward to zoom back out.

**Expected result:** The plan zooms toward the cursor point — the feature you aimed at stays pinned under your cursor throughout. Zooming in and out returns the plan to its original appearance. The zoom percentage in the status bar updates as you scroll.

**Note:** If the app window itself also zooms slightly (the outer border area shrinks), this is a known minor issue — as long as the drawing area zoom works correctly, mark it pass.

- [ ] Pass

---

### Test 1-E: Zoom in using keyboard shortcuts

1. Press **Ctrl+** (the equals/plus key) three times. The plan zooms in.
2. Press **Ctrl-** (the minus key) three times. The plan zooms out.
3. Press **Ctrl+0** (zero). The plan fits to the window.

**Expected result:** Each keyboard shortcut changes the zoom level. Ctrl+0 returns the plan to fit-the-window view with the full page visible and no distortion.

- [ ] Pass

---

### Test 1-F: Pan the drawing

1. Zoom in to about 2× or 3× so the plan does not fit in the window.
2. Hold the **middle mouse button** and drag in any direction. The plan moves with your drag.
3. Release. Hold the **spacebar**, then left-click and drag. The plan moves again.
4. Release the spacebar.

**Expected result:** Both pan methods work smoothly. The cursor changes to a grab hand while panning. When you release, the plan stays in the panned position.

- [ ] Pass

---

### Test 1-G: Zoom to fit and snap back

1. After panning in Test 1-F, press **Ctrl+0** or click the **Fit** button in the ribbon (View tab).

**Expected result:** The full page immediately re-centers and fits neatly in the window. No blank borders or distorted aspect ratio.

- [ ] Pass

---

### Test 1-H: Per-page zoom and position are remembered

1. On page 1, zoom in to 4× and pan to a corner of the plan.
2. Navigate to page 2. The view resets to fit-to-window for page 2.
3. Navigate back to page 1.

**Expected result:** Page 1 returns to exactly the same 4× zoom and pan position you left it at. The position is not reset just because you visited another page.

- [ ] Pass

---

### Test 1-I: Snappy page navigation — no blank flash

1. Navigate forward through pages 1, 2, 3, 4 (if available) one by one.
2. Navigate back through pages 4, 3, 2, 1.

**Expected result:** Pages you have already visited appear instantly — no white/blank flicker before the content appears. On first visit to a new page there may be a brief render, but returning to a previously visited page should feel instant.

- [ ] Pass

---

## Session 2: Scale Calibration

**Goal:** Confirm the app lets you tell it the real-world scale of the plan so it can calculate measurements correctly.

---

### Test 2-A: Set the scale on a page

1. Navigate to a page where you know a real-world dimension — for example, a corridor that is 2.4 m wide, or a slab that is 10 m long.
2. Click the **Tools** tab in the ribbon. Click **Set Scale**.
3. The cursor changes to a crosshair over the drawing area.
4. Click the first end of your known dimension on the plan.
5. Click the second end of that same dimension.
6. A popup appears near the line you just drew. The popup shows the pixel distance and a field to enter the real-world distance.
7. Type the real-world distance (e.g. `2400` if working in mm, or `2.4` if working in metres — match the unit shown in the popup).
8. Select the correct unit from the dropdown if needed.
9. Click **Confirm** (or **Set Scale**).

**Expected result:** The popup closes. The status bar at the bottom updates to show the scale ratio (e.g. "Scale: 1:100"). A confirmation message appears on the canvas saying the scale was set, with a "Verify" link.

- [ ] Pass

---

### Test 2-B: Each page has its own independent scale

1. After completing Test 2-A on page 1, navigate to page 2.
2. Look at the status bar.

**Expected result:** The status bar shows "Not Set" (in amber/orange text) for the scale on page 2 — it did not inherit the scale from page 1. Navigate back to page 1 and confirm it still shows the scale ratio you set.

- [ ] Pass

---

### Test 2-C: Uncalibrated page shows a warning

1. Navigate to a page that has not been calibrated.

**Expected result:** A visible "Set Scale" warning or badge appears on the drawing area — the app makes it clear you have not set a scale for this page. You cannot accidentally measure without knowing whether a scale is set.

- [ ] Pass

---

### Test 2-D: Verify the scale with a second measurement

1. On a calibrated page, click the **Verify** link in the confirmation message (or right-click the **Set Scale** button and choose **Verify scale**).
2. The cursor becomes a crosshair again.
3. Draw a line over a *different* known dimension on the same page (e.g. a 5 m wall).
4. A popup shows the measured real-world distance.
5. Click **Dismiss**.

**Expected result:** The popup shows a realistic measured value close to the real-world dimension (e.g. ~5 m for a 5 m wall). The scale in the status bar is unchanged — the verify action does not overwrite the existing calibration.

- [ ] Pass

---

### Test 2-E: Recalibrate a page (Set Scale again)

1. On a calibrated page, right-click the **Set Scale** button or click the small chevron (▾) next to it.
2. A small menu appears with "Recalibrate" and "Verify scale" options.
3. Click **Recalibrate**.
4. Draw a new calibration line and enter a new distance.
5. Confirm.

**Expected result:** The scale in the status bar updates to the new ratio. The old scale is replaced.

- [ ] Pass

---

### Test 2-F: Calibration endpoints stay the same visual size when zooming

1. With Set Scale active (crosshair cursor), click one calibration point on the plan.
2. Without clicking a second point, zoom in from 1× to 4× while the first red circle endpoint is visible.

**Expected result:** The red circle marker stays the same apparent size on screen as you zoom — it does not grow or shrink with the zoom level. (The calibration line endpoints are "zoom-compensated" so they remain readable at any zoom.)

- [ ] Pass

---

### Test 2-G: Scale confirmation toast stays visible

1. Set the scale on a page (complete a calibration).
2. After the confirmation message appears, wait at least 30 seconds without clicking anything.

**Expected result:** The confirmation message is still visible after 30 seconds. It does not automatically disappear — it stays until you click Verify or Dismiss, navigate to another page, or start a new calibration.

- [ ] Pass

---

## Session 3: All Markup Types

**Goal:** Confirm all five markup tools work correctly — count, linear, area, perimeter, and wall.

**Setup:** Calibrate at least one page before this session (Session 2).

---

### Test 3-A: Count markup — place and name a pin

1. Click the **Tools** tab. Click **Count**.
2. The cursor changes to a crosshair over the drawing area.
3. Click anywhere on the plan (e.g. on a column location). A circle with a number "1" inside appears at that location.
4. A naming popup appears in the centre of the window. Type a name, e.g. `Column`.
5. Type a category, e.g. `Structural`.
6. Click **Save** (or press Enter).
7. The popup closes. The circle shows "1" inside. If you hover over it, a tooltip shows the name.
8. Click again at another location on the plan. Another circle appears showing "2". No popup — it reuses the same name and category automatically (chain mode).
9. Click a third time. Circle "3" appears.

**Expected result:** Three "Column" count pins appear on the plan, numbered 1, 2, 3 in their circles. The totals panel (right side of the screen) shows "Column — 3 ea" under the Structural category.

- [ ] Pass

---

### Test 3-B: Count markup — the sequence number increments correctly

1. Continuing from Test 3-A, press **Esc** to stop placing counts.
2. Click the **Count** tool again.
3. Click once on the plan. A popup appears for a new item.
4. Type a different name, e.g. `Beam`. Category: `Structural`. Save.
5. Click once more for a second Beam.

**Expected result:** The first Beam shows "1" inside, the second Beam shows "2". The Column pins still show 1, 2, 3. Each named group has its own numbering sequence.

- [ ] Pass

---

### Test 3-C: Linear markup — draw a polyline and read the length

1. Click the **Tools** tab. Click **Linear**.
2. Click a starting point on the plan (e.g. the start of a wall run).
3. Click intermediate points along the wall (three or more clicks total).
4. To finish, press **Enter** OR double-click on the last point.
5. A naming popup appears. Type `Wall Run`. Category: `Civil`. Save.

**Expected result:** A polyline appears on the plan connecting all the points you clicked. A label appears on the line showing the total measured length in real-world units (e.g. "12.45 m"). The totals panel shows "Wall Run — 12.45 m" under Civil.

- [ ] Pass

---

### Test 3-D: Linear markup — label stays readable at all zoom levels

1. After placing a linear markup (Test 3-C), zoom in to 6× and find the markup.
2. Zoom out to fit-to-window.

**Expected result:** At both extremes of zoom, the length label on the line remains readable — it does not become microscopic at low zoom or run off screen at high zoom. The label stays positioned on or near the line at all zoom levels.

- [ ] Pass

---

### Test 3-E: Area markup — trace a polygon and read the area

1. Click the **Tools** tab. Click **Area**.
2. Click to place points around the perimeter of a room or slab (at least 4 points).
3. To close and finish the polygon, press **Enter** OR double-click the last point. (You can also click close to the starting point — the polygon will auto-close.)
4. A naming popup appears. Type `Ground Floor Slab`. Category: `Civil`. Save.

**Expected result:** A filled polygon appears on the plan. A label shows the enclosed area in real-world units (e.g. "48.20 m²"). The totals panel shows "Ground Floor Slab — 48.20 m²".

- [ ] Pass

---

### Test 3-F: Perimeter markup — trace a polygon and read both area and perimeter length

1. Click the **Tools** tab. Click **Perimeter**.
2. Trace a polygon as in Test 3-E (at least 4 points).
3. Finish with Enter or double-click. Name it `Roof Edge`. Category: `Civil`. Save.

**Expected result:** A polygon appears with labels showing both the enclosed area and the perimeter length (e.g. "Area: 36.0 m² | Perimeter: 24.0 m"). Both measurements are shown. The totals panel shows the perimeter length as the quantity.

- [ ] Pass

---

### Test 3-G: Wall markup — draw a wall and enter height

1. Click the **Tools** tab. Click **Wall**.
2. Click points to trace the face of a wall (at least 2 points forming a run).
3. Finish with Enter or double-click.
4. A naming popup appears with an extra field: **Wall Height (mm)**. Enter the wall height in millimetres (e.g. `2700` for a 2.7 m ceiling height).
5. Type a name, e.g. `External Wall`. Category: `Structural`. Save.

**Expected result:** The wall markup appears on the plan as a thicker line with a parallel hairline. A label shows the calculated area in m² (length × height). For example, a 5 m wall at 2700 mm = 13.5 m². The totals panel shows "External Wall — 13.50 m²".

- [ ] Pass

---

### Test 3-H: Each named group gets its own colour

1. Place two different named count markups: `Column` (Structural) and `Outlet` (Electrical).
2. Place a linear markup named `Conduit` (Electrical).

**Expected result:** "Column" count pins appear in one colour. "Outlet" count pins appear in a different colour. "Conduit" appears in yet another colour. Each distinct *name* gets a unique colour swatch — not each category. Items sharing the same name share the same colour.

- [ ] Pass

---

### Test 3-I: Markup label appears at all zoom levels

1. Place a count markup and a linear markup on the plan.
2. Zoom in to 6× and confirm both labels are readable.
3. Zoom out to fit-to-window (full page visible) and confirm both labels are still visible.

**Expected result:** Labels (name or measurement) remain visible and positioned correctly at every zoom level. They do not disappear, overlap excessively, or drift off their markup.

- [ ] Pass

---

### Test 3-J: Chain mode — successive placements without re-prompting

1. Click **Count** tool. Place one count and name it `Downlight`. Category: `Electrical`. Save.
2. Immediately click again on the plan without selecting any other tool.

**Expected result:** Another count pin appears (numbered 2) without a popup appearing. The name "Downlight" and category "Electrical" carry over automatically. A small badge or indicator near the tool confirms chain mode is active.

3. Place two more. Then press **Esc**.

**Expected result:** After pressing Esc, the chain mode ends. Clicking the tool again would prompt for a new name.

- [ ] Pass

---

### Test 3-K: Break chain by clicking the tool button again

1. Start chain mode with any markup (place one and confirm it chains).
2. Click the active tool button in the ribbon again (the same button that is already highlighted).

**Expected result:** The tool deactivates. The chain mode badge disappears. The next placement would prompt for a name again.

- [ ] Pass

---

### Test 3-L: Crosshair cursor appears during markup placement

1. Click the **Count** tool.
2. Move the cursor over the drawing area.

**Expected result:** The cursor changes to a crosshair (white crossed lines with a small gap at the centre) over the drawing area. The normal OS cursor does not show. When you switch back to the **Select** tool or press Esc, the crosshair disappears and the normal cursor returns.

- [ ] Pass

---

## Session 4: Undo and Redo

**Goal:** Confirm that both types of undo work correctly — undoing whole placed markups, and undoing individual points during in-progress drawing.

**Setup:** Have at least 3 markups already placed on page 1 from Session 3.

---

### Test 4-A: Undo a placed markup (post-commit)

1. With several markups on the page, press **Ctrl+Z** once.

**Expected result:** The most recently placed markup disappears from the plan. The totals panel updates immediately.

2. Press **Ctrl+Z** again.

**Expected result:** The next-most-recent markup disappears.

- [ ] Pass

---

### Test 4-B: Redo a removed markup

1. After undoing one or two markups (Test 4-A), press **Ctrl+Y** (or Ctrl+Shift+Z) once.

**Expected result:** The most recently undone markup reappears at its original position with the same name, category, and colour.

2. Press Ctrl+Y again.

**Expected result:** The second markup reappears.

- [ ] Pass

---

### Test 4-C: Undo and redo a delete action

1. Use the **Select** tool (Tools tab > Select).
2. Click a markup on the plan to select it (a ring appears around it).
3. Press the **Delete** key. The markup disappears.
4. Press **Ctrl+Z**.

**Expected result:** The deleted markup reappears in its original position.

5. Press **Ctrl+Y**.

**Expected result:** The markup disappears again (the delete is re-applied).

- [ ] Pass

---

### Test 4-D: In-progress undo — remove the last placed point (Phase 10)

1. Click the **Linear** tool. Click three points on the plan to begin drawing a polyline.
2. Do NOT press Enter yet — the polyline is still in progress (you can see it following your cursor).
3. Press **Ctrl+Z** once.

**Expected result:** Only the third (most recently placed) point is removed. The line now has only two points. The tool is still active — the polyline is still in progress. The cursor still shows a preview of the next segment. The first two points remain exactly where you placed them.

- [ ] Pass

---

### Test 4-E: In-progress redo — re-add the removed point (Phase 10)

1. Continuing from Test 4-D (two points in progress after one Ctrl+Z), press **Ctrl+Y** once.

**Expected result:** The third point returns. The polyline is back to three points in progress, exactly as it was before you pressed Ctrl+Z. The tool is still active.

- [ ] Pass

---

### Test 4-F: Multiple in-progress undos and redos (Phase 10)

1. Click the **Area** tool. Click four points on the plan to begin tracing a polygon.
2. Press **Ctrl+Z** three times in a row.

**Expected result:** Each Ctrl+Z removes only one point. After three presses, you are back to just the first point. The tool is still active — you have not accidentally cancelled the whole markup.

3. Press **Ctrl+Y** three times in a row.

**Expected result:** Each Ctrl+Y re-adds one point. After three presses, all four points are back in progress. The tool is still active.

- [ ] Pass

---

### Test 4-G: Ctrl+Z on the very first point cancels the whole markup (Phase 10)

1. Click the **Linear** tool. Click exactly one point on the plan.
2. Press **Ctrl+Z** once.

**Expected result:** The single point disappears AND the tool exits drawing mode entirely — the drawing canvas is blank, no in-progress line is visible, and the cursor returns to the normal state (no longer drawing). This is the same result as pressing Escape with one point.

- [ ] Pass

---

### Test 4-H: Placing a new point clears the redo stack (Phase 10)

1. Click the **Perimeter** tool. Click three points.
2. Press **Ctrl+Z** once (removes point 3).
3. Click a new point 3 in a different location.
4. Press **Ctrl+Y**.

**Expected result:** Ctrl+Y does nothing — the redo stack was cleared when you placed the new point. The markup continues with the two original points plus the new point 3 at its new location.

- [ ] Pass

---

### Test 4-I: Post-commit undo still works as whole-markup undo (Phase 10 does not change this)

1. Draw a complete Linear markup and commit it (press Enter to finish, then name and save it).
2. The markup is now on the plan.
3. Press **Ctrl+Z**.

**Expected result:** The entire markup disappears — the whole polyline is removed in one undo step, not point by point. This is the same whole-markup undo that has always existed. Phase 10 only adds point-level undo *during drawing*, not after committing.

4. Press **Ctrl+Y**.

**Expected result:** The entire markup reappears in one redo step.

- [ ] Pass

---

### Test 4-J: Undo does not fire while typing in a text field

1. Click the **Count** tool. Click on the plan. The naming popup appears with the name field focused.
2. Type `Hello World` in the name field.
3. Press **Ctrl+Z** while the name field is focused.

**Expected result:** The text in the name field is undone (browser text-undo behaviour within the input field). The markup on the canvas is NOT removed. The keyboard shortcut is suppressed when a text input is active.

- [ ] Pass

---

## Session 5: Project Save and Load

**Goal:** Confirm that saving a project to a .clmc file and reopening it restores all markups, scale, and positioning exactly.

**Setup:** Have at least 5 markups placed across 2 pages, with page 1 calibrated. Some markups should be hidden (if you completed Session 3 visibility tests).

---

### Test 5-A: Save the project

1. Press **Ctrl+S** (or click **Home** > **Save**).
2. A Windows save dialog appears. Navigate to your `UAT-test` folder.
3. Name the file `uat-test-project.clmc`. Click **Save**.

**Expected result:** During the save, the title bar briefly shows "Saving..." and the Save and Save As buttons appear dimmed. After saving, the title bar shows the file name without an asterisk (no unsaved changes indicator). A small "Saved" confirmation appears.

- [ ] Pass

---

### Test 5-B: Dirty asterisk appears when changes are made

1. After saving (Test 5-A), place one new markup on the plan.

**Expected result:** The title bar immediately gains an asterisk (e.g. `uat-test-project.clmc * — CLMC Takeoff`), indicating there are unsaved changes.

2. Press **Ctrl+S** to save again.

**Expected result:** The asterisk disappears after saving.

- [ ] Pass

---

### Test 5-C: Reopen the project and verify all markups are restored

1. Close the app completely.
2. Relaunch the app.
3. Click **Home** > **Open**. Navigate to `UAT-test` and open `uat-test-project.clmc`.

**Expected result:** All markups reappear on their correct pages at exactly the same positions. Names, categories, and colours match what you saved. Per-page scale calibrations are restored (page 1 should still show its "Scale: 1:N" reading). The page you were on when you saved is the page shown on load. No asterisk in the title bar — the project is clean.

- [ ] Pass

---

### Test 5-D: The project file is self-contained — no PDF needed separately

1. Copy `uat-test-project.clmc` to a completely different folder (e.g. `C:\UAT-portability`) that contains NO PDF files.
2. In that new folder, open `uat-test-project.clmc` in the app.

**Expected result:** The project opens normally. All markups are visible. The plan renders correctly. No "PDF not found" message appears. The .clmc file contains the PDF inside itself — you do not need the original PDF file on disk.

- [ ] Pass

---

### Test 5-E: Closing with unsaved changes shows a prompt

1. Open the project. Make a change (place a markup).
2. Without saving, close the app window (click X).

**Expected result:** A dialog asks whether you want to save before closing, with "Save", "Discard", and "Cancel" options. Clicking Cancel returns you to the app. Clicking Discard closes without saving. Clicking Save saves first, then closes.

- [ ] Pass

---

### Test 5-F: Missing PDF recovery — browse to re-link

> This test simulates a rare scenario where the project was saved with an older format or the internal PDF cannot be read. For a v2 .clmc file (current format), the PDF is embedded, so this scenario only applies if the file is somehow corrupted or to v1 legacy files.

**If you have a legacy v1 .clmc file** (plain JSON format, saved before the ZIP format was introduced):

1. Open the legacy v1 .clmc file.

**Expected result:** The project loads correctly. A dirty asterisk appears (because the app will upgrade it to the new format on next save). All markups and scale are intact. No migration prompt appears — the upgrade is silent.

2. Press Ctrl+S. The project saves cleanly as a new-format .clmc. Reopen it — it should load without the asterisk.

- [ ] Pass (or N/A if no v1 file is available)

---

### Test 5-G: Replace the embedded PDF

1. Open `uat-test-project.clmc`.
2. In the **Home** ribbon tab, click **Replace Plan PDF**.
3. A file picker opens. Select the same Plan A PDF you originally used (smoke test — same file).

**Expected result:** Markups remain visible on the plan. A dirty asterisk appears. No error occurs. Press Ctrl+S to save the update.

4. Click **Replace Plan PDF** again. This time select **Plan B** (the PDF with a different page count).

**Expected result:** A modal appears warning that the selected PDF has a different page count from the original — it shows the expected and actual page counts, with "Pick again" and "Cancel" buttons. Clicking Cancel leaves the project unchanged.

- [ ] Pass

---

### Test 5-H: Save As — save a copy with a different name

1. With a project open, click **Home** > **Save As** (or press **Ctrl+Shift+S**).
2. Save as `uat-test-project-copy.clmc`.
3. The title bar updates to show the new filename.
4. Make a change. The asterisk appears on the new filename.

**Expected result:** Save As creates a new independent copy. Changes to the copy do not affect the original.

- [ ] Pass

---

## Session 6: BOQ Export

**Goal:** Confirm that the app exports a correct, usable Bill of Quantities to Excel and CSV.

**Setup:** Have a project open with markups on at least two pages. Page 1 should be calibrated; leave page 2 uncalibrated and with at least one linear or area markup on it.

---

### Test 6-A: Export to Excel (.xlsx)

1. Click the **Estimating** tab in the ribbon. Click **Export** (or press **Ctrl+Shift+E**).
2. A save dialog opens. The filename is pre-filled with the project name plus `-BOQ.xlsx`. The filter shows "Excel Workbook (.xlsx)".
3. Click **Save** in the dialog.
4. A confirmation message appears at the bottom: "Exported: [filename].xlsx".
5. Open the saved .xlsx file in Microsoft Excel.

**Expected result in Excel:**
- The sheet tab is named "BOQ".
- The first few rows contain project metadata: project name, PDF name, export date, page count, markup count.
- A bold header row appears: **Item | Quantity | UoM**.
- This header row stays visible when you scroll down (frozen pane).
- Bold category name rows appear as group headings (e.g. "Electrical", "Civil").
- Below each category heading, rows list each markup item with its quantity and unit of measure.
- Quantity cells are right-aligned numbers — type `=SUM(B8:B30)` in any empty cell and confirm the result is a non-zero number (not #VALUE!).
- Item cell background colours match the colour of that markup on the canvas.
- At the end of each category, subtotal rows appear with a light-grey background.
- A Grand Total row appears at the very bottom with a slightly darker grey.
- Column widths are readable: the Item column is wide enough to show full names.

- [ ] Pass

---

### Test 6-B: Export to CSV

1. Click **Export** again.
2. In the save dialog, change the file type filter to "CSV (.csv)". The filename updates to end in `-BOQ.csv`.
3. Click **Save**.
4. Open the .csv in Microsoft Excel.

**Expected result:**
- The same row structure as the .xlsx (metadata, header, categories, items, subtotals, grand totals).
- Quantity column values import as numbers — `=SUM(B:B)` returns a non-zero number.
- Count quantities are whole numbers (no `.00`). Length/area quantities show two decimal places.
- Open the same .csv in Notepad — the file is readable plain text with no strange characters at the start.

- [ ] Pass

---

### Test 6-C: Uncalibrated pages warning before export

1. Confirm page 2 is uncalibrated and has at least one linear or area markup on it.
2. Click **Export**.

**Expected result (before the save dialog opens):** A warning modal appears saying something like "Pages without scale" — listing page 2. It offers "Continue" and "Cancel" buttons.

3. Press **Escape** — the modal closes, no save dialog opens.
4. Click **Export** again and click **Cancel** on the modal — same result.
5. Click **Export** a third time and click **Continue**.

**Expected result:** The save dialog opens. After saving and opening the .xlsx, the linear/area markups from uncalibrated page 2 are NOT in the export (their measurements cannot be calculated without a scale). However, any count markups on page 2 ARE included (counts don't need a scale).

- [ ] Pass

---

### Test 6-D: Export keyboard shortcut is suppressed in text inputs

1. Click the **Count** tool. Click the plan. The naming popup appears with the text field focused.
2. While the name field is active, press **Ctrl+Shift+E**.

**Expected result:** The export save dialog does NOT open. The shortcut is suppressed while a text input is active. Type a letter "E" — it types normally into the name field.

- [ ] Pass

---

### Test 6-E: Export handles a file that is already open in Excel

1. Open the previously exported `[project]-BOQ.xlsx` in Excel and leave it open.
2. Back in the takeoff app, click **Export** and try to overwrite the same filename.
3. Click **Save** (accepting any overwrite prompt from Windows).

**Expected result:** The app does not crash. An error message appears explaining that the file could not be saved (e.g. it is locked by Excel). After dismissing the error, close Excel, then export again — this time it succeeds.

- [ ] Pass

---

### Test 6-F: Hidden items still appear in the export

1. In the totals panel, click the lightbulb icon next to one item to hide it from the canvas.
2. Export to .xlsx.

**Expected result:** The hidden item still appears in the exported .xlsx with its full quantity. Hiding an item from view does not remove it from the export.

- [ ] Pass

---

## Session 7: Selection and Deletion

**Goal:** Confirm that markups can be selected, group-selected, and deleted, with full undo support.

---

### Test 7-A: Click to select a markup

1. Click the **Tools** tab. Click **Select** (the mouse pointer icon).
2. Click any markup on the canvas — a count pin, line, or polygon.

**Expected result:** An accent-coloured selection ring appears around the markup. The markup is highlighted.

3. Click a different markup.

**Expected result:** The selection ring moves to the new markup. Only one markup is selected at a time.

- [ ] Pass

---

### Test 7-B: Deselect by clicking empty space or pressing Escape

1. With a markup selected (ring visible), click on empty canvas space where there is no markup.

**Expected result:** The selection ring disappears. Nothing is selected.

2. Click a markup to select it again, then press **Escape**.

**Expected result:** The selection ring disappears.

- [ ] Pass

---

### Test 7-C: Delete a selected markup with the Delete key

1. Select any markup (Test 7-A).
2. Press the **Delete** key.

**Expected result:** The markup disappears from the plan. The totals panel updates immediately.

3. Press **Ctrl+Z**.

**Expected result:** The markup reappears at its original position. Ctrl+Z fully restores it.

- [ ] Pass

---

### Test 7-D: Select all markups on a page with Ctrl+A

1. Confirm there are at least 3 markups on the current page.
2. With **Select** tool active, press **Ctrl+A**.

**Expected result:** All markups on the current page show selection rings simultaneously.

3. Press **Delete**.

**Expected result:** All selected markups disappear at once in a single action.

4. Press **Ctrl+Z**.

**Expected result:** ALL deleted markups are restored in a single undo step — not one at a time.

- [ ] Pass

---

### Test 7-E: Rubber-band (drag) multi-select

1. With **Select** tool active, click and drag on an empty area of the canvas (left-mouse drag).
2. As you drag, a blue rectangular outline appears showing the selection area.
3. Release the mouse.

**Expected result:** Any markups whose bounding box was fully (or partially) inside the rectangle are now selected (rings visible). Markups entirely outside the rectangle are not selected.

4. Press **Delete** to remove the selected markups.
5. Press **Ctrl+Z** to restore them all in one step.

- [ ] Pass

---

### Test 7-F: Pan does not interfere with Select mode

1. With **Select** tool active, verify:
   - **Middle-mouse drag** — the canvas pans normally.
   - **Spacebar + left-mouse drag** — the canvas pans normally.
   - **Left-mouse drag alone** (no spacebar) — starts the rubber-band selection rectangle, does NOT pan the canvas.

**Expected result:** Only middle-mouse and Spacebar+left-mouse pan the canvas in Select mode. A bare left-mouse drag always starts rubber-band selection.

- [ ] Pass

---

## Session 8: UI and Navigation

**Goal:** Confirm the ribbon toolbar, modals, and page navigation work as designed.

---

### Test 8-A: Ribbon tabs switch correctly

1. Click the **Home** tab — confirm buttons: Open, Save, Save As, Replace Plan PDF, Export.
2. Click the **Page** tab — confirm: Previous Page, page number indicator, Next Page.
3. Click the **Tools** tab — confirm: Select, Count, Linear, Area, Perimeter, Wall, Set Scale.
4. Click the **View** tab — confirm: Zoom In, Zoom Out, Fit, Show Totals / Hide Totals, Hide All / Show All.
5. Click the **Estimating** tab — confirm: Export button visible.
6. Click **Settings** and **Help** tabs.

**Expected result:** Each tab changes the panel content below it. Settings and Help show a "Coming soon" placeholder. All existing tools (markup tools, zoom, open, export) remain accessible through their respective tabs.

- [ ] Pass

---

### Test 8-B: Modals open centred

1. Click **Tools** > **Set Scale** to open the calibration dialog.

**Expected result:** The dialog opens in the centre of the application window — not in a corner, not next to where you clicked.

2. Close it.
3. Click the **Count** tool and click once on the plan to open the naming popup.

**Expected result:** The naming popup also appears centred in the window — not floating next to where you clicked on the canvas.

- [ ] Pass

---

### Test 8-C: Modals are draggable

1. Open the Set Scale / Calibration dialog (or any naming popup).
2. Click and drag on the dialog's title bar area.

**Expected result:** The dialog follows your mouse pointer. You can drag it anywhere on the screen.

3. Release it in a corner.
4. Close the dialog and reopen it.

**Expected result:** The dialog recentres on reopen — it does not remember the dragged position between openings.

5. While the dialog is open, try clicking its buttons (OK, Cancel, Save) normally.

**Expected result:** Clicking buttons works normally — dragging the title bar and clicking buttons are two distinct actions with no interference.

- [ ] Pass

---

### Test 8-D: Post-commit markup editing

1. Right-click any markup already placed on the canvas.
2. A context menu appears with "Edit" (and possibly "Delete") options.
3. Click **Edit**.
4. A popup appears with the markup's name, category, and colour pre-filled.
5. Change the name to a new value. Change the category. Click **Save Changes**.

**Expected result:** The markup on the canvas updates to the new name and category. The totals panel updates. The title bar shows the asterisk (unsaved changes).

6. Press **Ctrl+Z**.

**Expected result:** All three fields revert simultaneously — name, category, and colour all return to their pre-edit values in a single undo step.

- [ ] Pass

---

### Test 8-E: Visibility toggle for individual items

1. In the totals panel on the right side of the screen, find any item row.
2. Click the lightbulb icon on that row.

**Expected result:** All markups with that item name disappear from the drawing canvas. The totals panel still shows the item with its quantity — the quantity does not change. The lightbulb icon changes to an "off" appearance.

3. Click the lightbulb again.

**Expected result:** The markups reappear on the canvas.

- [ ] Pass

---

### Test 8-F: Hidden visibility state persists across save/reload

1. Hide one item using the lightbulb toggle (Test 8-E).
2. Press Ctrl+S to save.
3. Close and relaunch the app. Reopen the project.

**Expected result:** The item you hid is still hidden — the lightbulb shows the "off" state and the markups are not visible on the canvas. The hidden state was saved.

- [ ] Pass

---

### Test 8-G: Show All / Hide All controls

1. Click the **View** tab in the ribbon.
2. Click **Hide All**.

**Expected result:** All markups on the canvas disappear simultaneously. The totals panel quantities are unchanged.

3. Click **Show All**.

**Expected result:** All markups reappear, including any that were individually hidden before you clicked Hide All.

- [ ] Pass

---

### Test 8-H: Totals panel shows live updates

1. Ensure the totals panel is visible (View tab > Show Totals if it is hidden).
2. Place a new count markup on the plan.

**Expected result:** The totals panel updates immediately when you confirm the markup name — you do not need to click anything in the panel. The new item's count appears (or the existing count increments) without any delay.

3. Press **Ctrl+Z** to undo the markup.

**Expected result:** The totals panel immediately reverts — the count decreases.

- [ ] Pass

---

### Test 8-I: Totals panel row interaction — hover and click

1. In the totals panel, hover the mouse over an item row that has a markup on the current page.

**Expected result:** A highlight ring briefly appears around that markup on the canvas to show you which item it refers to.

2. Click an item row in the totals panel.

**Expected result:** The canvas navigates to (or highlights) that markup. If the markup is not in the current view, the canvas may scroll/pan to bring it into view and highlight it briefly.

- [ ] Pass

---

### Test 8-J: Category typing — autocomplete prevents duplicate categories

1. Click the **Count** tool. Click the plan to open the naming popup.
2. In the category field, start typing a category name you already have — for example, type "elec".

**Expected result:** An autocomplete dropdown appears showing matching existing categories (e.g. "Electrical"). Clicking a suggestion or pressing the down arrow and Enter selects it.

3. Select the suggestion and save.

**Expected result:** The markup is assigned to the exact existing category — no new "elec" category is created. If you had typed "electrical" (all lowercase), the app corrects it to "Electrical" (matching the existing capitalisation).

- [ ] Pass

---

### Test 8-K: Enter key commits in-progress multi-point markup

1. Click the **Linear** tool. Click three points on the plan.
2. Instead of double-clicking, press **Enter**.

**Expected result:** The markup commits — the naming popup appears. This is identical to the result of double-clicking.

3. While the naming popup is open, with the name field focused, press **Enter** to submit.

**Expected result:** The name is saved and the popup closes. A second Enter keystroke does NOT trigger a new markup or cause any other action.

- [ ] Pass

---

### Test 8-L: Enter key does nothing with only one point

1. Click the **Linear** tool. Click exactly one point on the plan.
2. Press **Enter**.

**Expected result:** Nothing happens — no popup, no commit, no error. The tool stays in drawing mode waiting for more points (a single point cannot form a line).

- [ ] Pass

---

## Session 9: Edge Cases and Regression

**Goal:** Test behaviours that have previously failed or are known risk areas.

---

### Test 9-A: Markup positions stay precise after zoom and pan

1. Place a count pin on a very specific feature — for example, the centre of a column symbol.
2. Zoom in to 8× and confirm the pin is still exactly on the column centre.
3. Pan so the pin goes off screen, then pan back.
4. Zoom out to fit-to-window.

**Expected result:** At every zoom level and after every pan, the pin remains precisely on the feature it was placed on. Markups do not drift.

- [ ] Pass

---

### Test 9-B: Placing markups on multiple pages

1. Place markups on page 1 (3 counts).
2. Navigate to page 2. Place markups on page 2 (2 counts).
3. Navigate back to page 1.

**Expected result:** Page 1 shows only its 3 markups. Page 2 shows only its 2 markups. Markups do not bleed across pages.

- [ ] Pass

---

### Test 9-C: Scale is not shared between pages

1. Calibrate page 1 to a specific scale (e.g. 1:100).
2. Navigate to page 2 — status bar shows "Not Set".
3. Calibrate page 2 to a different scale (e.g. 1:200).
4. Navigate back to page 1 — status bar still shows 1:100.

**Expected result:** Each page's scale is completely independent. Calibrating one page never affects another.

- [ ] Pass

---

### Test 9-D: Undo does not corrupt markup data after round-trip

1. Place 5 markups.
2. Undo all 5 (press Ctrl+Z five times).
3. Redo all 5 (press Ctrl+Y five times).
4. Undo 2 (press Ctrl+Z twice).
5. Place 2 new markups.

**Expected result:** At each step, the visible markups match expectations. No markups appear from the wrong step. No error messages. The totals panel reflects the correct state throughout.

- [ ] Pass

---

### Test 9-E: Spacebar does not block text entry in naming popup

1. Click the **Count** tool. Click the plan to open the naming popup.
2. Click into the name field and type `Light Switch` (including the spacebar between the words).

**Expected result:** The space character is entered normally in the text field. The spacebar does NOT trigger the pan mode or any other canvas action while the text input is focused.

- [ ] Pass

---

### Test 9-F: Ctrl+Z during text entry stays in the text field

1. Open any naming popup. Type `Downlight` in the name field.
2. Press Ctrl+Z while the name field is focused.

**Expected result:** The text in the name field is undone (one character at a time, browser-native behaviour). No markup on the canvas is removed. The Ctrl+Z shortcut is suppressed for canvas undo while a text input is focused.

- [ ] Pass

---

### Test 9-G: Wall markup — editing the height after commit

1. Place a Wall markup with height 2700 mm. Confirm it shows the correct m² label.
2. Right-click the wall markup. Click **Edit**.
3. In the edit popup, find the wall height field. Change it to 3000 mm.
4. Click **Save Changes**.

**Expected result:** The m² label on the wall updates to reflect the new height (the length × new height). The totals panel updates. The dirty asterisk appears.

5. Press **Ctrl+Z**.

**Expected result:** The wall height reverts to 2700 mm. The m² label returns to the original value.

- [ ] Pass

---

### Test 9-H: LMB (left mouse button) hold does not drop a markup

1. Click the **Count** tool.
2. Click and hold the left mouse button on the canvas for 1–2 seconds without releasing.
3. Release the left mouse button without dragging.

**Expected result:** Nothing is placed on the canvas just from holding and releasing. A markup is only placed on a clean click (press and release within a small movement threshold). Holding the mouse does not accidentally place a markup on mouseup.

- [ ] Pass

---

### Test 9-I: LMB drag does not pan the canvas when a markup tool is active

1. With the **Count** (or any markup) tool active, click and slowly drag across the canvas with the left mouse button.

**Expected result:** The canvas does NOT pan. Only the Select tool's rubber-band selection or Spacebar+drag pans with the left mouse button. With a markup tool active, left-mouse-drag is ignored.

- [ ] Pass

---

### Test 9-J: Save during a large PDF does not freeze the UI

1. Open the largest PDF you have (ideally 30 MB or more).
2. Place a markup so the project is dirty.
3. Press **Ctrl+S** and watch the title bar carefully.

**Expected result:** The title bar shows "Saving..." during the write. The Save and Save As buttons are visibly dimmed while the save is in progress. After the save completes, the title bar returns to the filename, the asterisk disappears, and the buttons re-enable. No UI freeze occurs.

- [ ] Pass

---

### Test 9-K: Export fails gracefully if file is locked

1. Export the BOQ to `phase-uat-BOQ.xlsx`. Open that file in Microsoft Excel and leave it open.
2. In the takeoff app, export again and try to overwrite the same file.

**Expected result:** The app shows an error message explaining that the file could not be saved (it is locked by Excel). The app does not crash. After dismissing the error, close Excel and try again — the export succeeds.

- [ ] Pass

---

### Test 9-L: Category canonical substitution on save

1. Open a naming popup. In the category field, type the name of an existing category but in all lowercase (e.g. type `electrical` when the category already exists as `Electrical`).
2. Click Save.

**Expected result:** The markup is saved under `Electrical` (capital E), not `electrical`. The existing category's capitalisation is preserved. No new duplicate `electrical` category is created.

- [ ] Pass

---

### Test 9-M: Closing the naming popup with Escape cancels the markup

1. Click the **Count** tool. Click on the plan. The naming popup appears.
2. Press **Escape** (or click **Cancel** in the popup).

**Expected result:** The popup closes. The partially placed markup (if any) is removed from the canvas. You are back in idle/no-tool state.

- [ ] Pass

---

### Test 9-N: Minimum polygon vertex requirement

1. Click the **Area** tool. Click two points on the plan (only two clicks).
2. Press **Enter** to try to commit.

**Expected result:** Nothing happens — a polygon needs at least 3 vertices. The tool stays active, waiting for more points. No error message and no crash.

3. Click a third point and press Enter.

**Expected result:** The polygon commits and the naming popup appears.

- [ ] Pass

---

*Document prepared from all phase planning artifacts, UAT records, and verification reports for CLMC Takeoff App v1.*
*Covers Phases 1 through 10. Last updated: 2026-05-19.*
