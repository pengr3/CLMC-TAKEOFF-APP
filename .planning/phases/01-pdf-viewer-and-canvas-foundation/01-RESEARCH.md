# Phase 1: PDF Viewer and Canvas Foundation - Research

**Researched:** 2026-03-25
**Domain:** Electron desktop app scaffold, PDF rendering, interactive canvas overlay, zoom/pan
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffold of an Electron + React + TypeScript desktop app using electron-vite, followed by implementing a PDF viewer with Konva.js canvas overlay that supports zoom-to-cursor and pan. The project has no existing code -- everything starts from `npm create @quick-start/electron`.

The core technical challenge is the coordinate system integration: PDF.js renders pages into an offscreen canvas (bottom-left origin, 72 DPI base), which becomes a Konva Image on Layer 0. Zoom and pan are applied at the Konva Stage level so the PDF image and all future markup shapes transform together. HiDPI handling (150% Windows scaling) requires rendering the PDF canvas at `cssSize * devicePixelRatio` and passing a transform matrix to `page.render()`. Chromium's canvas texture size limit (16384px for GPU-accelerated, 32767px for software) constrains how large a PDF page can be rendered at high zoom -- construction A0 drawings at 8x zoom will exceed this, requiring a render-scale cap strategy.

**Primary recommendation:** Scaffold with electron-vite 5.x (React + TS template), pin Electron at 35.7.5, use `vite-plugin-static-copy` to copy `pdf.worker.mjs` to the renderer output, and implement zoom/pan via Konva Stage `scale()` + `position()` transforms with the official "Zooming Relative To Pointer" pattern.

## Project Constraints (from CLAUDE.md)

- **Platform:** Windows desktop, installed application
- **Offline:** Must work fully offline
- **PDF rendering:** Must handle real-world construction PDFs (large files, high-res scans, multi-page)
- **Markup persistence:** All markups must stay precisely positioned when zooming
- **Stack:** Electron 35.x, React 19.x, TypeScript 5.x, electron-vite 3.x+ (now 5.x), pdfjs-dist 5.5.x, Konva 10.2.x + react-konva 19.2.x, Zustand 5.0.x, Tailwind CSS 4.x
- **Avoid:** CRA, Webpack boilerplates, react-pdf npm package, pdf-lib, Tauri, Redux/MobX, SQLite
- **Worker setup:** Copy `pdfjs-dist/build/pdf.worker.mjs` to renderer public folder or use `vite-plugin-static-copy`
- **Coordinate storage:** All markup coordinates in PDF page space (normalized 0.0-1.0)
- **Per-page scale model:** Each page can have a different scale ratio

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | User can load a PDF floor plan file via a file picker | Electron IPC pattern: `ipcMain.handle` + `dialog.showOpenDialog` + `contextBridge.exposeInMainWorld`; pdfjs-dist `getDocument()` with file path |
| PDF-02 | User can navigate between pages of a multi-page PDF | pdfjs-dist `PDFDocumentProxy.getPage(pageNumber)` returns individual pages; Zustand store holds `currentPage` and `totalPages`; per-page zoom state via Map |
| PDF-03 | User can zoom in/out while markups remain pinned | Konva Stage `scale()` + `position()` zoom-to-cursor pattern; single affine transform ensures PDF image and markup layer move together |
| PDF-04 | User can pan across the plan at any zoom level | Konva Stage `draggable` for middle-mouse pan; spacebar+left-click pan via event listeners; `stage.position()` for translation |
| PDF-06 | User can see current page number/label displayed | Status bar and toolbar page counter components; `aria-live="polite"` region for accessibility |
</phase_requirements>

## Standard Stack

### Core (Phase 1)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| Electron | 35.7.5 | Desktop shell | CLAUDE.md locks to 35.x; 35.7.5 is latest patch. Bundles Chromium 134, Node 22.14.0. |
| electron-vite | 5.0.0 | Build tooling | Current version. Scaffolds main/preload/renderer with separate Vite configs. Requires Node 20.19+ or 22.12+. |
| React | 19.x | UI framework | Required by react-konva 19.2.x peer dep. |
| TypeScript | 5.x | Language | Comes with electron-vite template. |
| pdfjs-dist | 5.5.207 | PDF rendering | Current stable. Renders PDF pages to canvas via `getViewport()` + `render()`. |
| konva | 10.2.3 | Canvas engine | Stage/Layer model for PDF image + markup overlay. |
| react-konva | 19.2.3 | React bindings for Konva | Peer dep on React 19 + Konva 10.x confirmed. |
| Zustand | 5.0.12 | State management | Viewer state: current page, zoom, pan position, loaded document. |
| Tailwind CSS | 4.x | Styling | Via `@tailwindcss/vite` plugin (4.2.2 current). |
| lucide-react | 1.6.0 | Icons | UI-SPEC specifies FileUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize. |

### Supporting (Phase 1)

| Library | Version (verified) | Purpose | When to Use |
|---------|-------------------|---------|-------------|
| vite-plugin-static-copy | 4.0.0 | Copy pdf.worker.mjs to renderer output | Required at build time for PDF.js worker setup |
| @fontsource/inter | 5.2.8 | Bundle Inter font for offline use | UI-SPEC requires Inter loaded locally |
| Vitest | 4.1.1 | Unit tests | Coordinate math, zoom calculations, viewport transforms |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-static-copy | Manual cp script in package.json | Works but fragile; plugin integrates with Vite build pipeline properly |
| Konva Stage draggable | Custom mousemove/mousedown handlers | Stage.draggable handles edge cases (touch, boundaries); use it |
| Per-page zoom state in Zustand | URL params or React state | Zustand persists naturally; keeps zoom when navigating back to a page |

**Installation (Phase 1):**
```bash
# Scaffold
npm create @quick-start/electron@latest clmc-takeoff -- --template react-ts

# Core dependencies
npm install pdfjs-dist@5.5.207 konva@10.2.3 react-konva@19.2.3 zustand@5.0.12 lucide-react@1.6.0 @fontsource/inter@5.2.8

# Dev dependencies
npm install -D vite-plugin-static-copy@4.0.0 @tailwindcss/vite@4.2.2 tailwindcss@4 vitest@4.1.1

# Pin Electron to 35.x (scaffold may install latest)
npm install -D electron@35.7.5
```

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
src/
  main/
    index.ts              # BrowserWindow creation, IPC handlers, titleBarStyle config
    ipc-handlers.ts       # dialog.showOpenDialog handler, file read
  preload/
    index.ts              # contextBridge.exposeInMainWorld — expose openFile API
    api.d.ts              # TypeScript declarations for window.api
  renderer/
    src/
      App.tsx             # Root layout: TitleBar + Toolbar + CanvasViewport + StatusBar
      components/
        TitleBar.tsx       # Custom 32px title bar with window controls
        Toolbar.tsx        # Open PDF, page nav, zoom controls
        StatusBar.tsx      # Filename, page, zoom display
        CanvasViewport.tsx # Konva Stage + PDF rendering logic
        EmptyState.tsx     # Drop zone + instructions when no PDF loaded
      hooks/
        usePdfDocument.ts  # Load PDF, getPage, manage PDFDocumentProxy lifecycle
        usePdfRenderer.ts  # Render page to offscreen canvas, handle DPI scaling
        useViewportState.ts # Zoom, pan, fit-to-window calculations
      stores/
        viewerStore.ts     # Zustand: currentPage, totalPages, zoomLevel, panPosition, filePath
      lib/
        pdf-setup.ts       # GlobalWorkerOptions config, PDF.js initialization
        coordinates.ts     # Coordinate transform utilities (future-proofing for Phase 2+)
        constants.ts       # Zoom steps, canvas limits, default values
      types/
        viewer.ts          # ViewportState, PageState, ZoomLevel interfaces
    index.html
  public/
    pdf.worker.mjs        # Copied by vite-plugin-static-copy at build time
electron.vite.config.ts   # Main/preload/renderer Vite configs
```

### Pattern 1: PDF Rendering Pipeline

**What:** Render a PDF page to an offscreen canvas, then display it as a Konva Image on the bottom layer.

**When to use:** Every time a page is loaded or the render scale changes.

**Example:**
```typescript
// Source: Mozilla PDF.js official examples
import * as pdfjsLib from 'pdfjs-dist';

async function renderPage(
  page: pdfjsLib.PDFPageProxy,
  targetScale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: targetScale });
  const outputScale = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // Physical pixels for sharp rendering on HiDPI
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);

  // CSS pixels for layout sizing
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  const transform = outputScale !== 1
    ? [outputScale, 0, 0, outputScale, 0, 0] as const
    : undefined;

  await page.render({
    canvasContext: context,
    transform: transform,
    viewport: viewport,
  }).promise;

  return canvas;
}
```

### Pattern 2: Konva Stage Zoom-to-Cursor

**What:** Zoom the Konva Stage so the point under the cursor stays fixed on screen.

**When to use:** On Ctrl+scroll wheel events.

**Example:**
```typescript
// Source: https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8];

function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault();
  if (!e.evt.ctrlKey) return; // Only zoom on Ctrl+scroll

  const stage = e.target.getStage()!;
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition()!;

  // Point in stage coordinates under the cursor
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  // Find next zoom step
  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const currentIdx = ZOOM_STEPS.findIndex(s => s >= oldScale);
  const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, currentIdx + direction));
  const newScale = ZOOM_STEPS[nextIdx];

  stage.scale({ x: newScale, y: newScale });

  // Reposition so cursor point stays fixed
  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stage.position(newPos);
}
```

### Pattern 3: Electron IPC for File Dialog

**What:** Securely expose `dialog.showOpenDialog` from main process to renderer via contextBridge.

**When to use:** When user clicks "Open PDF" or presses Ctrl+O.

**Example:**
```typescript
// main/ipc-handlers.ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFile } from 'fs/promises';

ipcMain.handle('dialog:openPdf', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  const result = await dialog.showOpenDialog(win, {
    title: 'Open PDF Floor Plan',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const data = await readFile(filePath);
  return { filePath, data: data.buffer };
});

// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
});

// preload/api.d.ts (augment Window type)
interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>;
}
declare global {
  interface Window { api: ElectronAPI; }
}
```

### Pattern 4: Custom Title Bar (Windows)

**What:** Frameless window with custom draggable title bar and native window controls overlay.

**When to use:** BrowserWindow creation in main process.

**Example:**
```typescript
// Source: Electron official docs — Custom Title Bar
const win = new BrowserWindow({
  width: 1280,
  height: 720,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#1e1e1e',
    symbolColor: '#cccccc',
    height: 32,
  },
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

```css
/* Title bar div */
.titlebar {
  height: 32px;
  background: #1e1e1e;
  app-region: drag;        /* -webkit-app-region: drag for older Electron */
  display: flex;
  align-items: center;
  padding-left: 16px;
}
.titlebar button {
  app-region: no-drag;     /* Buttons must NOT be draggable */
}
```

### Pattern 5: PDF.js Worker Setup in electron-vite

**What:** Configure PDF.js web worker in Vite-based Electron renderer.

**When to use:** Application initialization, before any PDF loading.

**Example:**
```typescript
// renderer/src/lib/pdf-setup.ts
import * as pdfjsLib from 'pdfjs-dist';

// Worker file copied to renderer output by vite-plugin-static-copy
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export { pdfjsLib };
```

```typescript
// electron.vite.config.ts — renderer config section
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default {
  renderer: {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
            dest: '.',
          },
        ],
      }),
    ],
  },
};
```

**Alternative (simpler, verified to work):** Use the `?url` import suffix in Vite:
```typescript
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```
This avoids `vite-plugin-static-copy` entirely. However, behavior may differ between dev and production builds in electron-vite. Test both. If `?url` works reliably, skip the plugin.

### Anti-Patterns to Avoid

- **Separate scale and translate on Stage:** Never apply `stage.scale()` and `stage.position()` as independent operations across separate event handlers. Always compute them together in a single transform update. Separate updates cause markup drift.
- **Using react-pdf npm package:** It renders PDF pages as React components, not raw canvases. Cannot overlay a Konva Stage on top. Use pdfjs-dist directly.
- **Persisting canvas pixel coordinates:** Canvas pixels change with zoom/DPI. Store coordinates in PDF page space (normalized 0.0-1.0) from day one, even though Phase 1 has no markups yet. Build the coordinate system now.
- **Rendering PDF at zoom level:** Render PDF once at a fixed base scale (e.g., 1.5x or 2x). Use Konva Stage transform for visual zoom. Re-render PDF only when zoom exceeds the render resolution (e.g., at 4x+ zoom) to avoid blurriness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF page rendering | Custom PDF parser | pdfjs-dist `getViewport()` + `render()` | PDF spec is 1000+ pages; rotation, encryption, fonts, color spaces |
| Canvas shape interaction | Manual hit detection + event dispatch | Konva.js Stage/Layer/Shape model | Per-shape events, drag, transform, hit regions for free |
| Zoom-to-cursor math | Custom matrix math | Konva official pattern (pointer position + scale + reposition) | Edge cases with nested transforms; official pattern is battle-tested |
| HiDPI canvas scaling | Manual pixel ratio detection | `window.devicePixelRatio` + PDF.js transform parameter | OS-level DPI changes mid-session handled by Chromium |
| File dialog | Custom file picker UI | Electron `dialog.showOpenDialog` via IPC | Native OS dialog, remembers last directory, handles permissions |
| Window controls | Custom minimize/maximize/close buttons | `titleBarOverlay` on Windows | Native behavior for snap, accessibility, OS consistency |

**Key insight:** PDF rendering and interactive canvas are two domains with enormous edge-case surfaces. Using PDF.js and Konva.js avoids months of work on text encoding, font substitution, hit testing, and device input normalization.

## Common Pitfalls

### Pitfall 1: PDF Coordinate Origin Mismatch

**What goes wrong:** PDF origin is bottom-left; canvas origin is top-left. Raw coordinate values are flipped vertically.
**Why it happens:** PDF spec uses mathematical coordinates (y increases upward). HTML Canvas uses screen coordinates (y increases downward).
**How to avoid:** Always use `viewport.convertToPdfPoint()` and `viewport.convertToViewportPoint()` for conversions. Never manually flip Y coordinates.
**Warning signs:** Markups appear at mirrored vertical positions; click coordinates don't match visual positions.

### Pitfall 2: Blurry PDF on HiDPI Displays

**What goes wrong:** PDF renders at CSS pixel resolution but display expects physical pixel resolution. Text and lines appear blurry.
**Why it happens:** At 150% Windows scaling, `devicePixelRatio` is 1.5. A 1000px CSS-width canvas needs 1500px physical pixels.
**How to avoid:** Set canvas `width`/`height` attributes to `Math.floor(viewport.width * devicePixelRatio)`, set CSS `width`/`height` to viewport dimensions, pass `[dpr, 0, 0, dpr, 0, 0]` as transform to `page.render()`.
**Warning signs:** Text looks fuzzy compared to Adobe Acrobat; fine lines disappear.

### Pitfall 3: Canvas Size Exceeds GPU Texture Limit

**What goes wrong:** Rendering a large PDF (A0: ~1189x841mm at 72 DPI = ~3370x2384px) at high zoom (8x) with HiDPI (1.5x) = ~40,440x28,608px. Exceeds Chromium's 16384px GPU texture limit.
**Why it happens:** Chromium silently clips or fails to render canvases exceeding `gl.MAX_TEXTURE_SIZE`.
**How to avoid:** Cap the PDF render canvas at 16384px in either dimension. Use Konva Stage transform for visual zoom beyond the render resolution. Re-render at higher base scale only when needed, and only up to the texture limit.
**Warning signs:** Canvas appears blank or truncated at high zoom levels; no error thrown.

**Concrete cap calculation:**
```typescript
const MAX_CANVAS_DIM = 16384;
const dpr = window.devicePixelRatio || 1;

function clampedRenderScale(page: PDFPageProxy, desiredScale: number): number {
  const viewport = page.getViewport({ scale: desiredScale });
  const physicalWidth = viewport.width * dpr;
  const physicalHeight = viewport.height * dpr;
  const maxDim = Math.max(physicalWidth, physicalHeight);
  if (maxDim > MAX_CANVAS_DIM) {
    return desiredScale * (MAX_CANVAS_DIM / maxDim);
  }
  return desiredScale;
}
```

### Pitfall 4: Rotated PDF Pages

**What goes wrong:** Pages with `/Rotate: 90` or `270` swap width and height. Hardcoded aspect ratio assumptions break.
**Why it happens:** Construction PDFs often have landscape pages stored as portrait with a rotation flag.
**How to avoid:** Always use `page.getViewport({ scale, rotation: page.rotate })`. PDF.js handles the rotation transform internally. Never read `page.view` dimensions directly without accounting for rotation.
**Warning signs:** Page renders sideways; landscape drawings appear in portrait orientation.

### Pitfall 5: PDF.js Worker Not Found in Production Build

**What goes wrong:** App works in dev (`npm run dev`) but PDF loading fails after packaging with electron-builder.
**Why it happens:** `import.meta.url` resolves differently in dev vs production. The worker file may not be included in the ASAR archive or may have a wrong path.
**How to avoid:** Use `vite-plugin-static-copy` to explicitly copy the worker to a known output location. Test with `npm run build && npm run preview` before packaging. Verify the worker path resolves in both environments.
**Warning signs:** Console error "No 'GlobalWorkerOptions.workerSrc' specified" or "Failed to load worker" only in packaged app.

### Pitfall 6: Zoom State Lost on Page Navigation

**What goes wrong:** User zooms to 4x on page 3, navigates to page 4, navigates back -- page 3 is at fit-to-window again.
**Why it happens:** Storing zoom state globally instead of per-page.
**How to avoid:** Store `ViewportState` (zoom, panX, panY) per page index in a `Map<number, ViewportState>`. Restore when navigating back.
**Warning signs:** User complaints about losing their place when flipping between pages.

### Pitfall 7: Drag-and-Drop File Loading Fails

**What goes wrong:** Dragging a PDF onto the app opens it in Chromium's built-in viewer instead of the app's renderer.
**Why it happens:** Electron/Chromium default behavior navigates to dropped files.
**How to avoid:** Prevent default on `dragover` and `drop` events at the window level. Extract file path from `DataTransfer`, send via IPC to main process for reading.
**Warning signs:** App navigates away from the renderer when a file is dropped.

## Code Examples

### Fit-to-Window Zoom Calculation

```typescript
// Source: standard pattern for fit-to-container scaling
function calculateFitScale(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding: number = 20
): number {
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  const scaleX = availableWidth / pageWidth;
  const scaleY = availableHeight / pageHeight;
  return Math.min(scaleX, scaleY);
}
```

### Konva Stage Setup with PDF Image

```typescript
// Source: Konva Image Labeling sandbox pattern
import { Stage, Layer, Image as KonvaImage } from 'react-konva';

function CanvasViewport({ pdfCanvas, width, height }: Props) {
  const [image] = useImage(pdfCanvas); // or use Konva.Image with canvas directly

  return (
    <Stage
      width={width}
      height={height}
      draggable  // Enable pan via drag
      onWheel={handleWheel}
    >
      {/* Layer 0: PDF background */}
      <Layer>
        <KonvaImage image={pdfCanvas} />
      </Layer>
      {/* Layer 1: Markup overlay (empty in Phase 1) */}
      <Layer />
    </Stage>
  );
}
```

**Note on Konva Image from canvas:** `react-konva`'s `Image` component accepts an `HTMLCanvasElement` directly as the `image` prop. No need for `useImage` hook when using an offscreen canvas. Just pass the canvas element rendered by PDF.js.

### Per-Page Viewport State

```typescript
// stores/viewerStore.ts
import { create } from 'zustand';

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

interface ViewerState {
  filePath: string | null;
  fileName: string | null;
  currentPage: number;
  totalPages: number;
  pageViewports: Map<number, ViewportState>;

  setFile: (path: string, totalPages: number) => void;
  setPage: (page: number) => void;
  setViewport: (page: number, viewport: ViewportState) => void;
  getViewport: (page: number) => ViewportState | undefined;
}

const DEFAULT_VIEWPORT: ViewportState = { zoom: 1, panX: 0, panY: 0 };

export const useViewerStore = create<ViewerState>((set, get) => ({
  filePath: null,
  fileName: null,
  currentPage: 1,
  totalPages: 0,
  pageViewports: new Map(),

  setFile: (path, totalPages) => set({
    filePath: path,
    fileName: path.split(/[\\/]/).pop() ?? null,
    totalPages,
    currentPage: 1,
    pageViewports: new Map(),
  }),

  setPage: (page) => set({ currentPage: page }),

  setViewport: (page, viewport) => {
    const map = new Map(get().pageViewports);
    map.set(page, viewport);
    set({ pageViewports: map });
  },

  getViewport: (page) => get().pageViewports.get(page),
}));
```

### Spacebar + Left-Click Pan

```typescript
// Hook for spacebar pan mode
function useSpacebarPan(stageRef: React.RefObject<Konva.Stage>) {
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
        document.body.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        document.body.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // When space is held, enable stage dragging with left mouse
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.draggable(spaceHeld);
  }, [spaceHeld, stageRef]);

  return spaceHeld;
}
```

### Middle-Mouse Pan

```typescript
// Middle mouse button pan — Konva Stage config
// Set stage.draggable(true) but only respond to middle button
function configureMiddleMousePan(stage: Konva.Stage) {
  stage.on('mousedown', (e) => {
    // Button 1 = middle mouse
    if (e.evt.button === 1) {
      stage.draggable(true);
      stage.startDrag();
    }
  });
  stage.on('mouseup', (e) => {
    if (e.evt.button === 1) {
      stage.draggable(false);
    }
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-vite 3.x | electron-vite 5.0.0 | 2025-2026 | Requires Node 20.19+ or 22.12+; new `@quick-start/electron` scaffolding command |
| CRA + electron | electron-vite | 2024 | CRA deprecated; electron-vite is the standard |
| pdfjs-dist 4.x PostCSS worker | pdfjs-dist 5.x ESM worker (.mjs) | 2025 | Worker is now `pdf.worker.mjs` not `pdf.worker.js`; ESM import |
| Tailwind 3.x PostCSS | Tailwind 4.x Vite plugin | 2025 | Use `@tailwindcss/vite` plugin, not `@tailwindcss/postcss` |
| Electron `frame: false` | `titleBarStyle: 'hidden'` + `titleBarOverlay` | Electron 20+ | Native window controls overlay on Windows; no need to hand-build close/minimize/maximize |

**Deprecated/outdated:**
- `pdfjs-dist/build/pdf.worker.js` (replaced by `.mjs`)
- `@tailwindcss/postcss` approach for Vite projects (use `@tailwindcss/vite` plugin)
- `electron-vite` 3.x scaffolding command `npm create electron-vite` (now `npm create @quick-start/electron`)

## Open Questions

1. **`?url` import vs vite-plugin-static-copy for PDF.js worker**
   - What we know: Both approaches work in Vite dev mode. `?url` is simpler (no extra dependency).
   - What's unclear: Whether `?url` resolves correctly in electron-builder production ASAR bundles.
   - Recommendation: Implement `?url` first. If production build fails, fall back to `vite-plugin-static-copy`. Test early with `npm run build`.

2. **Optimal PDF base render scale**
   - What we know: PDF.js default is 72 DPI (scale 1.0). At 150% DPI on a 1920x1080 monitor, fit-to-window for an A1 drawing is roughly scale 0.7-1.2.
   - What's unclear: The sweet spot for base render scale that balances sharpness and canvas size limits.
   - Recommendation: Start with scale 2.0 (144 DPI equivalent), which gives sharp rendering up to 200% zoom via Konva transform alone. Re-render at higher scale only when zoom exceeds 200%. Always clamp to 16384px max dimension.

3. **Electron 35.x vs latest (41.x)**
   - What we know: CLAUDE.md specifies 35.x. Latest is 41.x. electron-vite 5.0.0 supports both.
   - What's unclear: Whether the user intentionally locked to 35.x or simply documented what was current at research time.
   - Recommendation: Follow CLAUDE.md and use 35.7.5. The version is locked in project decisions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite 5.x (needs 20.19+ or 22.12+) | Yes | 24.13.0 | -- |
| npm | Package installation | Yes | 11.8.0 | -- |
| Git | Version control | Yes | 2.52.0 | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

Note: Electron bundles its own Node.js (22.14.0 in Electron 35.x) and Chromium (134), so the host Node.js version is only used for development tooling. Node 24.13.0 exceeds the 22.12+ minimum for electron-vite 5.0.0.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | None -- Wave 0 creates `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | PDF document loads via pdfjs-dist from ArrayBuffer | unit | `npx vitest run src/renderer/src/__tests__/pdf-loader.test.ts -t "loads PDF"` | No -- Wave 0 |
| PDF-02 | Page navigation updates currentPage, respects bounds | unit | `npx vitest run src/renderer/src/__tests__/viewer-store.test.ts -t "navigation"` | No -- Wave 0 |
| PDF-03 | Zoom-to-cursor math keeps point fixed | unit | `npx vitest run src/renderer/src/__tests__/zoom.test.ts -t "cursor zoom"` | No -- Wave 0 |
| PDF-04 | Pan updates stage position correctly | unit | `npx vitest run src/renderer/src/__tests__/pan.test.ts -t "pan"` | No -- Wave 0 |
| PDF-06 | Page counter displays correct "Page N of M" | unit | `npx vitest run src/renderer/src/__tests__/viewer-store.test.ts -t "page counter"` | No -- Wave 0 |

Note: PDF rendering itself (PDF-01 visual output, PDF-03 visual pinning) requires a real canvas/Electron environment and is manual-verify for Phase 1. The unit tests validate the math and state logic.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- framework configuration
- [ ] `src/renderer/src/__tests__/viewer-store.test.ts` -- Zustand store navigation and zoom state
- [ ] `src/renderer/src/__tests__/zoom.test.ts` -- zoom-to-cursor math
- [ ] `src/renderer/src/__tests__/pdf-loader.test.ts` -- PDF document loading
- [ ] `src/renderer/src/__tests__/pan.test.ts` -- pan position calculations
- [ ] Vitest install: `npm install -D vitest@4.1.1`

## Sources

### Primary (HIGH confidence)
- [Mozilla PDF.js official examples](https://mozilla.github.io/pdf.js/examples/) -- getViewport, render, HiDPI pattern
- [Konva Zooming Relative To Pointer](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html) -- zoom-to-cursor math
- [Electron Custom Title Bar docs](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) -- titleBarStyle, titleBarOverlay
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) -- ipcMain.handle, contextBridge pattern
- [electron-vite official site](https://electron-vite.org/) -- v5.0.0, scaffolding, project structure
- npm registry -- all package versions verified via `npm view` on 2026-03-25

### Secondary (MEDIUM confidence)
- [Chromium canvas size limit issue](https://issues.chromium.org/issues/40349850) -- 32767px Skia limit, 16384px WebGL MAX_TEXTURE_SIZE
- [PDF.js worker Vite discussion](https://github.com/mozilla/pdf.js/discussions/19520) -- worker setup patterns for Vite
- [DoltHub Electron custom title bar guide](https://www.dolthub.com/blog/2025-02-11-building-a-custom-title-bar-in-electron/) -- implementation walkthrough

### Tertiary (LOW confidence)
- `?url` import suffix for PDF.js worker in electron-vite production builds -- needs validation in ASAR context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry on research date
- Architecture: HIGH -- patterns sourced from official Konva sandboxes and PDF.js examples
- Pitfalls: HIGH -- canvas size limits verified via Chromium issue tracker; HiDPI pattern from official PDF.js examples
- Worker setup: MEDIUM -- multiple approaches documented; production-build behavior in electron-vite needs validation

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, 30-day validity)
