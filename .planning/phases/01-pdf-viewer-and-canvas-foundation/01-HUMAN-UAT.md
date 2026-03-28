---
status: partial
phase: 01-pdf-viewer-and-canvas-foundation
source: [01-VERIFICATION.md]
started: 2026-03-28T17:37:00Z
updated: 2026-03-28T17:37:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Snappy page switching — verify cache eliminates blank flash
expected: Navigating to a previously visited page shows it instantly with no white frame. First-visit forward/backward navigation (N+1, N-1) is also fast because adjacent pages are pre-rendered in background.
result: [pending]

### 2. Zoom-to-cursor keeps feature pinned at all zoom levels
expected: Hold Ctrl and scroll on a specific door symbol on a construction PDF. The symbol stays exactly under the cursor as zoom increases from 25% to 800% and decreases back.
result: [pending]

### 3. 150% DPI display — no blur or pointer offset
expected: Set Windows display scaling to 150%. Open a PDF, zoom to 4x, click on a plan feature. The canvas is sharp and click events land where the cursor appears.
result: [pending]

### 4. Middle-mouse-button pan and spacebar+drag pan
expected: Hold middle mouse and drag — canvas moves 1:1 with the mouse. Hold spacebar and left-click drag — same behavior. Cursor changes to grab/grabbing.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
