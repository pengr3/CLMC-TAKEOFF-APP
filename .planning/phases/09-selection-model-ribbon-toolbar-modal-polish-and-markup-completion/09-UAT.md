---
status: complete
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
source: 09-00-SUMMARY.md, 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Ribbon Toolbar Appears
expected: Open the app. The old flat single-row toolbar should be GONE. In its place is a new tabbed ribbon with 7 tabs visible across the top: Home / Page / Tools / View / Estimating / Settings / Help. The Home tab is active by default, showing buttons for Open, Save, Save As, Replace Plan PDF, and Export.
result: pass

### 2. Ribbon Tab Switching
expected: Click each ribbon tab and verify the panel content changes. Tools tab shows: Select, Count, Linear, Area, Perimeter, Wall, Set Scale buttons. Page tab shows: Previous, Page N of M, Next. Settings and Help tabs show a "Coming soon" message.
result: pass

### 3. Select Tool Activates
expected: In the Tools tab, click the Select button (mouse-pointer icon). It should appear highlighted/active to indicate 'select' mode is active. Switching to any other tool (e.g. Count) should deactivate the Select highlight.
result: pass

### 4. View Tab Controls
expected: Click the View tab. Verify: Zoom In / Zoom Out / Fit buttons work as before. "Show Totals" button opens/closes the totals panel and its label flips between "Show Totals" and "Hide Totals". If markups are placed, "Hide All" hides them from the canvas and "Show All" restores them.
result: pass

### 5. All Modals Are Draggable
expected: Open a modal — e.g. trigger the Set Scale / Calibration dialog. The dialog opens CENTRED in the window. Click and drag on its title/header area: the dialog follows your pointer. Release it in a corner of the screen — it stays there. Close and reopen the dialog: it recenters automatically. Also verify you can still click buttons (OK, Cancel) normally without accidentally starting a drag.
result: pass

### 6. Popups Are Centred (MarkupNamePopup)
expected: Place a count or linear markup to trigger the MarkupNamePopup (the "Name this item" popup). It should appear CENTRED in the viewport — NOT floating next to where you clicked on the canvas. It should also be draggable (drag its header to move it).
result: pass

### 7. Click Markup to Select
expected: Switch to Select mode (Tools tab → Select). Click any existing markup on the canvas (count pin, linear line, area polygon, etc.). An accent-colored ring should appear around the markup to show it is selected. Clicking a different markup should move the selection ring to the new one.
result: pass

### 8. Deselect Actions
expected: With a markup selected (selection ring visible), try two deselect actions: (a) click on empty canvas space → selection ring disappears; (b) select a markup again, then press Escape → selection ring disappears. Both should leave the canvas with no markup selected.
result: pass

### 9. Ctrl+A Select All and Delete
expected: In Select mode with at least 2 markups on the current page, press Ctrl+A → ALL markups on the page should show selection rings simultaneously. Then press Delete → all selected markups are removed at once. Press Ctrl+Z → ALL deleted markups are restored in a single undo step (not one-at-a-time undo).
result: issue
reported: "does not work"
severity: major

### 10. Rubber-band Multi-Select
expected: In Select mode, click and drag on an empty area of the canvas (LMB drag). A blue rectangular rubber-band outline should appear while dragging. Release the mouse — any markups whose ENTIRE bounding box was inside the rectangle should now show selection rings. Markups only partially inside the rectangle should NOT be selected.
result: pass

### 11. Pan Not Broken in Select Mode
expected: In Select mode, verify the two remaining pan gestures still work: (a) middle-mouse button drag → canvas pans normally; (b) hold Spacebar then LMB drag → canvas pans normally. LMB drag alone (without Spacebar) should NOT pan — it should start the rubber-band selection instead.
result: pass
note: "Bug discovered outside test scope: when a markup tool is active (non-select mode), LMB hold+drag activates pan. This should be suppressed — LMB must never pan during markup; only MMB and Spacebar+LMB should pan."

### 12. Enter to Commit Markup
expected: Start drawing a Linear markup. Place 2 or more points (clicks) on the canvas. Instead of double-clicking to finish, press Enter → the MarkupNamePopup should appear exactly as it would after a double-click. Then try starting a new Linear and placing only 1 point — pressing Enter should do nothing (silent ignore). Also verify: while the MarkupNamePopup is open and the name input is focused, pressing Enter submits the name form and does NOT trigger a second markup commit.
result: pass

## Summary

total: 12
passed: 11
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Ctrl+A selects all markups on current page; Delete removes all selected in one step; Ctrl+Z restores all in one undo step"
  status: failed
  reason: "User reported: does not work"
  severity: major
  test: 9
  root_cause: "Ctrl+Z handler in useKeyboardShortcuts calls undo() which restores markups to pageMarkups but never restores selectedMarkupIds (cleared by the Delete handler) — selection rings do not reappear after undo, making the full Ctrl+A → Delete → Ctrl+Z flow appear broken"
  artifacts:
    - path: "src/renderer/src/hooks/useKeyboardShortcuts.ts"
      issue: "Ctrl+Z handler (lines 92-99) calls undo() without peeking at the undone command; does not call setSelectedMarkupIds() to restore previously-selected IDs after a delete/delete-group undo"
  missing:
    - "Before calling undo(), peek at undoStack.at(-1); if type 'delete' extract markup.id, if type 'delete-group' extract markups.map(m=>m.id); after undo() call useViewerStore.getState().setSelectedMarkupIds(restoredIds)"
  debug_session: ""

- truth: "LMB drag must never pan the canvas when a markup tool is active — only MMB and Spacebar+LMB should pan"
  status: failed
  reason: "User reported: when a markup tool is selected and LMB is held before initial click, it introduces drag/pan functionality. Unacceptable — interferes with markup placement."
  severity: major
  test: 11
  root_cause: "useViewportControls.ts line 84 formula `spaceHeld || activeTool !== 'select' ? [0, 1] : [1]` evaluates to [0,1] (LMB+MMB) for every markup tool because activeTool !== 'select' is always true during markup — enabling LMB stage-drag during markup placement"
  artifacts:
    - path: "src/renderer/src/hooks/useViewportControls.ts"
      issue: "Line 84: Konva.dragButtons = spaceHeld || activeTool !== 'select' ? [0, 1] : [1] — the activeTool !== 'select' branch incorrectly enables LMB pan for all markup tools"
  missing:
    - "Remove activeTool !== 'select' condition entirely; restore to: Konva.dragButtons = spaceHeld ? [0, 1] : [1]"
  debug_session: ""
