---
status: passed
phase: 10-granular-undo-foundation
source: [10-VERIFICATION.md]
started: 2026-05-19
updated: 2026-05-19
---

# Phase 10 Human UAT — Granular In-Progress Undo/Redo

**What this tests:** While you are drawing a multi-point markup (before finishing it), Ctrl+Z now removes only the last point you placed, and Ctrl+Y puts it back. This is different from the existing whole-markup undo that fires after a markup is committed.

**Prerequisite:** Open the app, open any PDF, and set scale on page 1 (or skip scale — these tests don't measure anything).

---

## Test 10-A: Ctrl+Z removes the last point during drawing

1. Activate the **Linear** tool.
2. Click three points on the canvas — you should see a two-segment line growing as you click.
3. Press **Ctrl+Z**.

**Expected:** The last point you placed disappears. The tool is still active — you can see the rubber-band preview following your cursor. The line now has one segment (two points).

- [x] Pass

---

## Test 10-B: Ctrl+Z a second time removes the next-to-last point

Continuing from where Test 10-A left off (you have two points on the canvas):

1. Press **Ctrl+Z** again.

**Expected:** The second point disappears. The tool is still active. Only the first point remains — the rubber-band line connects the first point to your cursor.

- [x] Pass

---

## Test 10-C: Ctrl+Y re-adds the popped point

Continuing from Test 10-B (one point on the canvas, tool still active):

1. Press **Ctrl+Y**.

**Expected:** The second point comes back. The line has one segment again. Your cursor is free to add more.

2. Press **Ctrl+Y** again.

**Expected:** The third point comes back. The line has two segments again — exactly as it was before either Ctrl+Z.

- [x] Pass

---

## Test 10-D: Placing a new point clears the Ctrl+Y redo stack

1. Activate **Linear**, click three points.
2. Press **Ctrl+Z** once (third point disappears).
3. Click a new point somewhere else on the canvas.
4. Press **Ctrl+Y**.

**Expected:** Nothing happens — the redo stack was cleared when you placed the new point. The markup stays as-is with the two original points plus the new one you just clicked.

- [x] Pass

---

## Test 10-E: Ctrl+Z on the very first point cancels the whole markup

1. Activate **Linear**, click exactly one point.
2. Press **Ctrl+Z**.

**Expected:** The point disappears and the tool deactivates — you are back to the normal pointer/no-tool state. No half-finished markup remains on the canvas.

- [x] Pass

---

## Test 10-F: Post-commit Ctrl+Z still undoes the whole markup (unchanged behaviour)

1. Activate **Linear**, click three points, then press **Enter** (or double-click) to commit the markup.
2. Type a name in the popup and confirm.
3. Press **Ctrl+Z**.

**Expected:** The entire committed linear markup disappears from the canvas in one step — same as before Phase 10. This is whole-markup undo, not point-level.

4. Press **Ctrl+Y**.

**Expected:** The whole markup comes back.

- [x] Pass

---

## Test 10-G: In-progress undo works the same on Area, Perimeter, and Wall tools

1. Activate **Area**, click four points.
2. Press **Ctrl+Z** twice — two points disappear, tool stays active.
3. Press **Ctrl+Y** twice — the two points come back.
4. Repeat the same steps with **Perimeter**.
5. Repeat with **Wall**.

**Expected:** The pop/repush behaviour is identical across all three tools — no tool behaves differently.

- [x] Pass

---

## Summary

| Test | Description | Result |
|------|-------------|--------|
| 10-A | Ctrl+Z removes last in-progress point | |
| 10-B | Second Ctrl+Z removes next point | |
| 10-C | Ctrl+Y restores points in order | |
| 10-D | New click clears the Ctrl+Y stack | |
| 10-E | Ctrl+Z on first point cancels markup | |
| 10-F | Post-commit Ctrl+Z unchanged (whole-markup) | |
| 10-G | Works on Area, Perimeter, Wall tools | |

Total: 7 | Passed: 7 | Failed: 0

## Gaps

