# Architecture Patterns

**Domain:** Windows desktop construction takeoff application
**Researched:** 2026-03-25
**Confidence:** HIGH (core patterns), MEDIUM (framework-specific integration details)

---

## Recommended Architecture

A layered desktop application with a clear separation between the PDF rendering plane, the interactive markup canvas, the domain data model, and the I/O layer (persistence and export). The framework host (Electron or Tauri) provides the process boundary and file system access. The UI layer is a web frontend running in a controlled WebView.

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Shell                       │
│              (Electron main / Tauri core process)            │
│   File system access · Window management · IPC bridge        │
├─────────────────────────────────────────────────────────────┤
│                       Renderer Process                       │
│                   (WebView / Chromium)                       │
│                                                              │
│  ┌───────────────┐   ┌────────────────────────────────────┐  │
│  │  PDF Renderer │   │        Markup Canvas Layer          │  │
│  │  (PDF.js)     │   │  (Konva.js Stage → Layers → Shapes) │  │
│  │               │◄──┤                                    │  │
│  │  - Rasterize  │   │  - Count markers                   │  │
│  │    page to    │   │  - Linear paths                    │  │
│  │    canvas     │   │  - Area polygons                   │  │
│  │  - Viewport   │   │  - Perimeter traces                │  │
│  │    transform  │   │  - Scale calibration line          │  │
│  └───────┬───────┘   └──────────────┬─────────────────────┘  │
│          │                          │                         │
│          └──────────┬───────────────┘                         │
│                     ▼                                         │
│           ┌──────────────────┐                                │
│           │   Scale Service  │                                │
│           │  pixel ↔ real    │                                │
│           │  world units     │                                │
│           └────────┬─────────┘                                │
│                    │                                          │
│                    ▼                                          │
│           ┌──────────────────┐                                │
│           │   Domain Model   │                                │
│           │  (Project store) │                                │
│           │                  │                                │
│           │  Project         │                                │
│           │   └─ Pages[]     │                                │
│           │        └─Scale   │                                │
│           │        └─Markups │                                │
│           └────────┬─────────┘                                │
│                    │                                          │
│          ┌─────────┴──────────┐                               │
│          ▼                    ▼                               │
│  ┌──────────────┐   ┌──────────────────┐                      │
│  │  Persistence │   │   Export Engine  │                      │
│  │   Engine     │   │                  │                      │
│  │  .clmc file  │   │  ExcelJS / CSV   │                      │
│  │  (JSON)      │   │  BOQ aggregation │                      │
│  └──────────────┘   └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **App Shell (main process)** | Window lifecycle, native file dialogs (open/save), IPC bridge to renderer, OS integration | Renderer via IPC only |
| **PDF Renderer** | Load PDF bytes, rasterize one page at a time to a canvas element at the current viewport scale, expose page dimensions | Markup Canvas (provides canvas size), Scale Service (provides viewport transform) |
| **Markup Canvas Layer** | Accept pointer events, render all markup shapes on a transparent Konva stage that overlays the PDF canvas, hit-test for selection/editing | Domain Model (reads/writes markup data), Scale Service (converts pointer coords to model coords) |
| **Scale Service** | Convert between PDF page pixel coordinates and real-world units (mm, m, ft, in) based on the calibration ratio for the current page | Markup Canvas (coordinate conversion), Domain Model (persists calibration), Export Engine (provides measurements) |
| **Domain Model (Project Store)** | Single source of truth for all project state — pages, scale-per-page, all markup objects and their measured values, active page index | All UI components (read), Persistence Engine (serialise/deserialise), Export Engine (aggregate) |
| **Persistence Engine** | Serialise the Domain Model to a `.clmc` file (JSON), deserialise on open, manage "unsaved changes" state | App Shell (file path via IPC), Domain Model |
| **Export Engine** | Aggregate markup data from Domain Model grouped by category and markup type, compute totals, write an `.xlsx` / `.csv` file | Domain Model (read-only), App Shell (file path via IPC) |

---

## Data Flow

### Opening a PDF

```
User picks file (native dialog)
→ App Shell reads file bytes from disk
→ App Shell sends bytes to renderer via IPC
→ PDF Renderer initialises PDF.js document object
→ PDF Renderer rasterizes page 1 at current zoom level → canvas
→ Markup Canvas Layer renders zero shapes over page 1
→ Domain Model initialised with empty project (pages array, no markups)
```

### Setting Scale on a Page

```
User draws a "calibration line" on the canvas
→ Markup Canvas captures two endpoint pixel coordinates (in PDF page space)
→ User enters the real-world distance for that line
→ Scale Service computes ratio: realDistance / pixelDistance = units/px
→ Scale Service stores ratio against current page in Domain Model
→ All existing markups on that page recalculate their displayed measurements
```

### Placing a Markup

```
User selects markup type (count/linear/area/perimeter)
→ Markup Canvas enters "drawing mode"
→ User places points; Markup Canvas tracks pixel coordinates in PDF page space
  (coordinates are stored in page space, NOT screen space — zoom-invariant)
→ On completion, a Markup object is created:
    { id, type, name, category, pageIndex, points[], computedValue, unit }
→ Scale Service converts pixel geometry → real-world value at creation time
  AND whenever scale changes
→ Domain Model appends markup to current page's markup list
→ Markup Canvas re-renders; UI panel updates totals
```

### Zooming / Panning

```
User scrolls or pinches
→ Viewport transform (scale + offset) updates
→ PDF Renderer re-rasterizes current page at new scale (or uses cached tiles)
→ Markup Canvas stage transform is updated to match PDF viewport exactly
→ All markup shapes repaint at new screen positions
→ Markup point coordinates in Domain Model are UNCHANGED
  (they are always stored in PDF page space)
```

### Saving a Project

```
Domain Model serialised to JSON:
{
  "version": 1,
  "pdfPath": "C:/...",          // absolute path on disk
  "pages": [
    {
      "index": 0,
      "scalePxPerUnit": 12.34,
      "scaleUnit": "m",
      "markups": [ ...markup objects... ]
    }
  ]
}
→ App Shell writes JSON to .clmc file via IPC
→ "Unsaved changes" flag cleared
```

### Exporting to Excel

```
Export Engine queries Domain Model for all markups across all pages
→ Groups by category, then by markup type
→ Computes:
    - count type:     sum of count
    - linear type:    sum of lengths (in project unit)
    - area type:      sum of areas (unit²)
    - perimeter type: sum of perimeter lengths + sum of enclosed areas
→ Writes Excel rows:
    Category | Item Name | Qty | Unit
→ App Shell saves .xlsx via native save dialog
```

---

## Scale Storage and Impact

Scale is stored **per page** as a single `pxPerUnit` ratio and a unit string (e.g., `"m"`). This is deliberately simple:

- One calibration line per page is sufficient because construction PDFs use a consistent scale throughout a drawing.
- If the user sets scale mid-session (after placing markups), all markups on that page automatically recalculate by applying the new ratio to their stored pixel geometry.
- Markup coordinates are **always stored in PDF page pixel space** — they never store the computed real-world value as the authoritative position. The computed measurement is derived on-read.

---

## State Management Approach

**Recommended: Single immutable store + Command pattern for undo/redo**

Use a centralised reactive store (Zustand is appropriate for Electron/React apps) that holds the complete Domain Model tree. All mutations go through explicit action functions — no component writes directly to the store.

For undo/redo, use the **Command pattern** over the Memento pattern:

- Each user action (add markup, delete markup, move point, rename, set scale) is an object with `execute()` and `undo()` methods.
- Commands are pushed onto a history stack; undo pops and reverses.
- This avoids the memory overhead of snapshotting the full model on every change.
- Limit history depth to a reasonable cap (e.g., 50 operations) to prevent unbounded growth.

Markup canvas shape state should mirror the Domain Model — no separate canvas-internal state. When the store updates, the canvas re-renders from the store. This prevents the store and canvas drifting out of sync.

```
User action
→ Dispatch command to CommandManager
→ CommandManager.execute() → mutations to Domain Model store
→ React re-renders Markup Canvas from updated store
→ CommandManager pushes command to undo stack
```

---

## Patterns to Follow

### Pattern 1: PDF Page Space as the Canonical Coordinate System

**What:** All markup points are stored in PDF page pixel coordinates (72 DPI PDF units), not screen pixels.

**When:** Always — applies to every markup type.

**Why:** Screen pixels change with zoom level and window size. PDF page coordinates are stable. The viewport transform (a 2D affine matrix) converts page space to screen space at render time.

```typescript
// When user clicks at screen position (sx, sy):
const pageX = (sx - viewportOffset.x) / viewportScale;
const pageY = (sy - viewportOffset.y) / viewportScale;
markup.points.push({ x: pageX, y: pageY });

// When rendering markup at current zoom:
const screenX = markup.points[0].x * viewportScale + viewportOffset.x;
const screenY = markup.points[0].y * viewportScale + viewportOffset.y;
```

### Pattern 2: Derived Measurements, Not Stored Measurements

**What:** The measured value (length, area, count) is computed from geometry + scale at read time, not stored as a field.

**Why:** If the user corrects the scale, all measurements automatically update. Storing computed values creates stale-data bugs.

```typescript
function getMarkupValue(markup: Markup, scale: ScaleConfig): MeasuredValue {
  if (markup.type === 'linear') {
    const pixelLength = computePolylineLength(markup.points);
    return { value: pixelLength / scale.pxPerUnit, unit: scale.unit };
  }
  // ...
}
```

### Pattern 3: IPC Boundary Isolation

**What:** File system reads/writes and native dialog access happen exclusively in the App Shell main process. The renderer never touches the file system directly.

**Why:** Security (Tauri capability model), testability, and clean separation of concerns.

```
Renderer → invoke('save_project', { json }) → Main process → fs.writeFile()
Renderer → invoke('export_xlsx', { path, data }) → Main process → ExcelJS write
```

### Pattern 4: PDF Page Caching

**What:** Rasterized PDF page canvases are cached by (pageIndex, renderScale) tuple and invalidated only when zoom changes significantly.

**Why:** Rasterizing a high-res construction PDF page via PDF.js is expensive. Re-rasterizing on every frame during pan/zoom causes visible lag.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Markups in Canvas-Layer State

**What:** Keeping markup data inside Konva shapes or as component state rather than in the Domain Model.

**Why bad:** Canvas state and domain state diverge. Save/load requires re-hydrating from DOM. Undo/redo becomes complex and unreliable.

**Instead:** Domain Model is the single source of truth. Konva shapes are purely a rendering projection of the store.

### Anti-Pattern 2: Computing Measurements in Screen Space

**What:** Measuring the distance between markup points after applying the viewport transform (i.e., measuring screen pixels).

**Why bad:** Measurements change as the user zooms. The computed value will be wrong unless the user is at exactly 1:1 zoom.

**Instead:** Always compute measurements in PDF page space before applying the scale ratio.

### Anti-Pattern 3: Tight Coupling Between PDF Renderer and Markup Canvas

**What:** Markup Canvas reaching into the PDF.js internal API to get page dimensions or viewport info.

**Why bad:** PDF.js internals change; any PDF.js upgrade can silently break markup positioning.

**Instead:** Define a thin `ViewportState` interface (`{ pageWidth, pageHeight, scale, offsetX, offsetY }`) that PDF Renderer publishes and Markup Canvas consumes. Both components depend on this interface, not on each other.

### Anti-Pattern 4: Storing the PDF Bytes Inside the Project File

**What:** Embedding the PDF binary into the `.clmc` project file (e.g., base64-encoded).

**Why bad:** Construction PDFs range from 5–200 MB. This makes project files enormous, slow to save/load, and impractical to move.

**Instead:** Store the absolute path to the PDF file. On project open, validate the path exists and prompt the user to re-locate the file if it has moved.

### Anti-Pattern 5: Per-Markup Undo (instead of Command-level)

**What:** Implementing undo by diffing the entire Domain Model snapshot before/after each action.

**Why bad:** Full model snapshots are memory-expensive when the user has placed hundreds of markups across many pages.

**Instead:** Command pattern with targeted `undo()` — each command knows exactly what to reverse.

---

## Suggested Build Order

Dependencies flow from infrastructure to domain to UI. Build in this sequence:

```
1. App Shell + IPC scaffold
   (file open, file save dialogs; renderer ↔ main process bridge)

2. PDF Renderer + viewport state
   (load PDF, rasterize page, expose pageWidth/pageHeight/scale/offset)

3. Domain Model + Scale Service (no UI yet)
   (Project data structure, markup types, scale math, unit conversion)
   (Validate with unit tests before any canvas work)

4. Markup Canvas Layer (no persistence yet)
   (Konva stage aligned over PDF canvas; place, display, and select markups)
   (Scale calibration line + scale service integration)

5. Project Persistence Engine
   (Serialise/deserialise Domain Model; save/open .clmc files)

6. Undo/Redo via Command Manager
   (Wrap markup creation/deletion/edit in commands)

7. Export Engine
   (Aggregate BOQ data; write .xlsx and .csv)

8. UI Polish
   (Sidebar panels, category management, page navigation, keyboard shortcuts)
```

**Critical dependency:** Scale Service must be solid before any markup measurements are built. Bugs here will corrupt every computed value in the project.

---

## Scalability Considerations

| Concern | At typical scale (1 project, 20 pages, 500 markups) | At heavy scale (10 projects open, 100 pages, 5000 markups) |
|---------|------------------------------------------------------|-------------------------------------------------------------|
| PDF rendering memory | Single page rasterized at a time; manageable | Implement page tile cache with LRU eviction |
| Markup render performance | Konva handles 500 shapes with ease | At 5000+: use Konva layer caching; only re-render dirty layer |
| Project file size | < 500 KB JSON for 500 markups | < 5 MB JSON — fine; no structural change needed |
| Export time | < 1s for 500 rows | < 5s for 5000 rows — ExcelJS streaming writer if needed |
| Undo history | 50-command cap is sufficient | Same cap; no change needed |

This project operates in the "typical scale" range for v1. Heavy-scale optimisations are not needed upfront.

---

## Component Interface Contracts

These are the interface boundaries that must be stable before components can be built in parallel:

```typescript
// ViewportState — published by PDF Renderer, consumed by Markup Canvas
interface ViewportState {
  pageIndex: number;
  pageWidthPx: number;   // PDF page width in PDF user units (72 DPI)
  pageHeightPx: number;
  viewScale: number;     // current zoom multiplier
  offsetX: number;       // canvas translation X (screen px)
  offsetY: number;       // canvas translation Y (screen px)
}

// Markup — core domain entity
interface Markup {
  id: string;
  type: 'count' | 'linear' | 'area' | 'perimeter';
  name: string;
  category: string;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;  // PDF page coordinates
  count?: number;  // for count type only
}

// ScaleConfig — per-page calibration
interface ScaleConfig {
  pxPerUnit: number;   // PDF page pixels per 1 real-world unit
  unit: 'mm' | 'm' | 'ft' | 'in';
}

// IPC commands (renderer → main process)
type IpcCommand =
  | { cmd: 'open_pdf_dialog' }
  | { cmd: 'open_project_dialog' }
  | { cmd: 'save_project'; path: string; json: string }
  | { cmd: 'save_project_dialog'; json: string }
  | { cmd: 'export_xlsx'; path: string; data: BOQRow[] }
  | { cmd: 'export_csv'; path: string; data: BOQRow[] };
```

---

## Sources

- [PDF.js layer architecture and coordinate system](https://www.nutrient.io/blog/complete-guide-to-pdfjs/) — MEDIUM confidence (third-party guide, consistent with Mozilla docs)
- [PDF.js coordinate transform (viewport)](https://pdfjs.express/documentation/viewer/coordinates) — MEDIUM confidence
- [PDF.js annotation extension with Konva integration pattern](https://github.com/Laomai-codefee/pdfjs-annotation-extension) — MEDIUM confidence (real implementation reference)
- [Konva.js architecture overview (Stage → Layer → Shape)](https://konvajs.org/docs/overview.html) — HIGH confidence (official docs)
- [Konva annotation tool pattern](https://medium.com/htc-research-engineering-blog/konva-use-konva-to-create-annotation-tool-34409bfa822b) — MEDIUM confidence
- [Tauri v2 process model and IPC](https://v2.tauri.app/concept/process-model/) — HIGH confidence (official docs)
- [Tauri v2 capability / file system access control](https://v2.tauri.app/reference/acl/capability/) — HIGH confidence (official docs)
- [Command pattern for undo/redo](https://softwarepatternslexicon.com/java/behavioral-patterns/command-pattern/implementing-undo-and-redo/) — HIGH confidence (well-established pattern)
- [Electron project persistence patterns](https://rxdb.info/electron-database.html) — MEDIUM confidence
- [ExcelJS for XLSX generation](https://github.com/exceljs/exceljs) — HIGH confidence (well-maintained library, wide adoption)
- [Construction takeoff scale calibration approach](https://easytakeoffs.com/features) — MEDIUM confidence (product documentation confirming the "draw known distance" pattern is standard)
