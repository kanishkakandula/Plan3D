# Plan3D — floor plan → editable 3D house

Upload a floor-plan image, let it find the walls, rooms, doors and windows, get a real
3D model you can edit and export as GLB.

*Powered by K-Suite.*

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve dist/ on http://localhost:4173
```

Node 18+. There are no runtime network calls at all — no webfonts, no CDNs, no
telemetry — so it works offline and on an air-gapped machine. `dist/` is a static
folder you can drop on any web server.

The app opens on a built-in sample house, so there is something to look at and
click before you upload anything.

---

## 1. What currently works

**The whole loop, end to end:** upload → detect → 2D geometry → 3D walls/rooms/openings
→ edit → export.

**Upload.** PNG, JPG, WebP, GIF, BMP, and PDF (first page, rendered with pdf.js). Drag
and drop or browse. Large images are downscaled to 1500px on the long side, and **small
ones are resampled up** to at least 1100px; anything over 40 MB or 40 MP is rejected with
a reason rather than a hang.

**Detection** (all in-browser, ~250 ms on a 1000×700 plan):

- Otsu thresholding, with automatic polarity detection so inverted/dark-mode exports work.
- Despeckling, then a morphological filter that removes every stroke thinner than the walls.
- Directional morphological opening to isolate horizontal and vertical walls separately.
- Connected-component labelling → wall centre lines with measured thickness.
- **A second, ink-weighted pass re-measures the wall stroke** from the long candidates and
  re-runs the extraction. The first estimate is taken over all ink and comes out far too
  thin on a drawing carrying hatching, dimension lines and dense text.
- Collinear merging, where the gaps you merge *across* become the doors and windows.
- Centre-line and endpoint snapping, plus junction closing so corners actually meet.
- Exterior/interior classification from position on the building outline and stroke weight.
- Room solving by flood fill of the enclosed space, contour tracing, RDP simplification,
  rectilinear snapping and offsetting out to the wall centre lines.

Upsampling matters more than it sounds: every threshold is derived from the stroke
thickness, so on a 490px scan with 4px walls the kernels quantise to one or two pixels and
almost nothing survives. The same drawing goes from **13 walls and 0 rooms** to **14 walls
and 4 rooms** purely from being resampled first.

**Rejecting everything that is not a wall.** A real CAD drawing is mostly not walls, and
four independent filters deal with it:

| Filter | Catches |
|---|---|
| **Stroke width band** | Furniture outlines, fittings, extension lines — drawn finer than walls. Adjustable via the "Furniture rejection" slider. |
| **Periodicity** | Stair treads, floor tiling, hatching, louvres, bed slats. Three or more parallel segments at a near-constant pitch is a drawn pattern; walls are never laid out that way. |
| **Sheet border** | The drawing frame — hard against the image edge and spanning the whole sheet. Critical, because it touches everything and otherwise welds the title block onto the wall network. |
| **Network connectivity** | Cars, sofas, counters, the title block, the north arrow. Walls form one connected structure — that is what holding a house up means. Everything else is an island. |

**Reading the drawing (OCR).** Tesseract runs locally — the WASM core is bundled from
node_modules and the English model sits in `public/tesseract/` — so this works offline like
everything else. It is lazy-loaded: nothing is fetched until you first analyse a plan.

- Rooms are **named from their labels**: "BEDROOM 1" on the drawing becomes Bedroom 1 in
  the model. Multi-line labels ("BATH" above "ROOM 1") are stitched back together, and
  candidate stacks are scored by letter count, confidence and proximity to the room centre.
- Every text region is cropped, magnified to the cap height Tesseract wants, and laid out
  as its own row on a single tall sheet — so it is still **one** recognise call, not eighty.
  Read whole-page instead, 8px dimension strings simply do not come back at all.
- **Scale is read from the dimension chains.** Plans dimension in chains, so no single
  string is the length of any one wall — but the gap between two neighbouring strings is
  half of one span plus half of the next, which solves for scale from the text alone.
  Several chains vote. On the built-in sample this lands within 3% of the true scale with
  no user input at all.

On the built-in sample it recovers **8/8 walls, 5/5 rooms, 6/6 doors and 7/7 windows**,
each on the correct wall at the correct position, and sets the scale to within 3% from the
drawing's own dimension text. `npm run smoke` asserts exactly that and fails on regression.

**3D generation.** Real geometry, not a faked perspective. Every wall becomes an
extruded solid from its centre line, with **genuine openings** — the wall is split into
piers, sills and lintels around each door and window, so you can see and walk through
them. No CSG, no coplanar-face artefacts. Rooms get triangulated floor slabs. Doors get a
lining and a leaf shown part-open; windows get a frame, mullion, glass and a sill. An
optional flat or gable roof sits over the exterior footprint.

**Editing.** Everything is directly manipulable in the 2D view, and the 3D model updates
on the same frame:

| Action | How |
|---|---|
| Select | Click a wall, room, door or window — in *either* view |
| Move a wall | Drag its body |
| Change its length | Drag an endpoint, or type a length in mm |
| Draw a wall | `W`, then drag (ortho-snapped; hold Alt to go free) |
| Add a door / window | `D` / `N`, then click a wall |
| Slide an opening | Drag it along its wall |
| Draw a room | `R`, click corners, Enter to close |
| Add a staircase | `S`, then drag a rectangle |
| Add a balcony / terrace | `B` / `T`, then drag a rectangle |
| Add a fence | `G`, click along the line, Enter to finish |
| Reshape a structure | Drag its corner handles; drag the body to move it |
| Reshape a room | Drag its corner handles |
| Rename a room | Type in the properties panel |
| Set the scale | `M`, drag across a known length, type the real millimetres |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z`, 60 levels |

Endpoints snap to other wall endpoints; wheel zooms toward the cursor; `F` fits.

**3D view.** Orbit, pan, zoom, ISO/top/front presets, per-layer visibility toggles
(walls / floors / openings / roof), optional room labels with live areas, and a
first-person walkthrough (pointer-lock, `WASD`, `Shift` to run).

**Layout.** The 3D model gets the larger share of the window by default, and every pane can
be hidden from the **View** menu — left panel, 2D plan, 3D model, properties panel, and the
plan image itself. "3D only" (`Shift+3`) gives the model the whole window; "Full screen 3D"
takes over the display entirely.

| Shortcut | Does |
|---|---|
| `Shift+1` | Show/hide the left panel |
| `Shift+2` | Show/hide the 2D plan |
| `Shift+3` | 3D only (toggles back) |
| `Shift+4` | Show/hide the properties panel |

**Stairs, balconies, terraces and fences.** All four are "a shape on the plan, extruded
with a railing rule", so they share one generator, one property panel and one set of
handles:

| Element | Geometry |
|---|---|
| **Staircase** | A flight of solid treads running along the footprint's long axis. Set the tread count and total rise; it reports the resulting riser and going so you can sanity-check against the 175/275 mm rule of thumb. Optional balustrades. |
| **Balcony** | Slab plus a railing — posts, top rail and mid rail — around the perimeter. |
| **Terrace** | Slab plus a solid parapet. Same generator as the balcony; the difference really is just the edge treatment, which is how an architect would describe it too. |
| **Fence** | Posts at a set spacing along a polyline, with two horizontal rails. |

Each sits at its own level, so a roof terrace at wall height and a balcony projecting off
it both work. The built-in sample has one of each.

**Staircases are detected automatically.** The periodicity filter that throws out floor
tiling and hatching is looking for exactly what a stair flight is — three or more evenly
spaced parallel lines — so rather than discarding those runs, the detector counts the
treads and hands back a flight. A run has to look like a flight to qualify (a plausible
tread count, a sane width, and a run length in proportion to it), which keeps tiling out.

**Export.** GLB (binary) and glTF (JSON), both validated: correct glTF 2.0 header, a
non-empty BIN chunk, named node hierarchy (`Plan3D → Walls/Floors/Openings/Structures →
wall:<id>`), model centred and sitting on the ground plane. Opens in Blender, three.js,
Babylon, Windows 3D Viewer, anything.

The export is built **from the plan, not from the 3D viewport**. That matters: the
viewport can be hidden (the View menu makes that easy), mid-rebuild, or showing a subset
of layers, and exporting the live scene in those states wrote a technically-valid but
empty 268-byte GLB — 5 nodes, 0 meshes — which viewers reject with "this file contains no
geometry". Building fresh from the plan also means every layer is in the file regardless
of the visibility toggles. If there genuinely is nothing to export, it now says so instead
of writing the empty file, and a successful export reports the mesh and triangle count.

**Error handling.** No file, unsupported type, oversized file, unreadable PDF, blank or
all-black image, no wall-like strokes found, nothing surviving the filters, no closed
rooms, openings that match no wall, implausible scale — each produces a specific message
and, where useful, a hint about what to do instead. `npm run verify` exercises these.

**Assumptions are shown, not hidden.** A dedicated panel lists everything the pipeline
had to guess — the scale, the heights, merged duplicates, discarded openings — with a
severity and a plain-English explanation.

---

## 2. What is simulated or heuristic

Be clear-eyed about this: it is a conceptual modelling tool, not a BIM system.

| Area | Status |
|---|---|
| **Wall detection** | Real CV, but **orthogonal only**. Diagonal, curved and rounded walls are ignored entirely. |
| **Text** | Read with Tesseract, which is good but not perfect on architectural lettering — expect the odd `BEDROOM 1` → `BEDROOM I`. Common confusions are repaired per token. Rotated (vertical) dimension text is usually missed. |
| **Scale from text** | Works when the drawing carries a readable chain of dimension strings along an edge. When the chains disagree, it says so and falls back to the assumption. Every string it *did* read is offered as a one-click value in the Scale dialog. |
| **Scale otherwise** | Assumed. With no readable dimension, the building is assumed ~12 m wide and this is flagged as a warning. The Scale tool is the intended path. |
| **Furniture rejection** | Four structural filters, no object recognition. It does not know what a bed is — it knows a bed is drawn finer than a wall, is periodic, or is an island. Furniture drawn as heavily as walls and attached to them can still get through; delete it with one click, or raise the Furniture rejection slider. |
| **Door vs window** | Inferred, not recognised. Interior gap → door. Exterior gap → window, unless ink beside it on the inside face looks like a swing arc. It is right on clean CAD drawings and will be wrong sometimes; one click flips it. |
| **Door swing direction** | Always defaults to one side. Toggled per door. |
| **All heights** | Invented. A floor plan is a horizontal section — it carries no height information whatsoever. Wall height, door height, window head and sill are defaults you set globally or per element. |
| **Roof** | A massing study over the bounding box, not a roof design. |
| **Room polygons** | Traced from the flood fill, simplified and forced rectilinear. Non-orthogonal rooms come out approximated. |
| **Stair detection** | Found from tread periodicity, not by recognising a stair symbol. It gets the footprint and tread count; the rise is assumed to be one storey. A stair drawn without visible treads is not found — draw it with the Stair tool. |
| **Balcony / terrace / fence detection** | Not detected at all. They are not reliably distinguishable from other line work on a plan, so they are drawing tools rather than guesses. |
| **Furniture and fixtures** | Not detected — filtered out on purpose. |
| **Levels** | Structures carry their own level, so a roof terrace works, but the walls and rooms are a single storey. |
| **Window glass** | Simple transparency, not refractive. |

Honest failure modes: hand sketches, photographed plans, rotated or skewed scans,
heavily hatched drawings, and plans where furniture is drawn as heavily as the walls.
The manual tools exist precisely because of these.

---

## 3. Where to connect an AI vision API

**One file: `src/detection/aiVisionAdapter.ts`.** Nothing else in the application knows
which detector produced the geometry.

The contract is `DetectionProvider` in `src/detection/types.ts`:

```ts
interface DetectionProvider {
  id: string;
  label: string;
  isAvailable(): boolean;
  detect(input: DetectionInput, onProgress?: ProgressFn): Promise<DetectionResult>;
}
```

`heuristicDetector` and `aiVisionDetector` both implement it and are interchangeable —
the UI simply lists whatever is in `providers[]`, and everything downstream
(normalisation, repair, snapping, the editor, the 3D engine) is shared.

**To switch it on:**

1. Stand up a proxy you control — a serverless function is plenty. A complete worked
   example is in the comment block at the bottom of `aiVisionAdapter.ts`. It must accept
   `POST { prompt, imageDataUrl, imageWidth, imageHeight }` and return the JSON described
   in `VISION_PROMPT`.
2. Paste its URL into **AI vision (optional)** in the left panel.
3. Pick **AI vision** as the detector and press Analyse.

**Never put a model-vendor API key in the browser bundle** — that is what the proxy is
for. The `token` field is for authenticating to *your* proxy.

`parseVisionResponse()` already validates and coerces whatever the model returns, and
`geometryNormalizer.ts` repairs it afterwards, so a model that is 90% right still gives a
usable model. It is also unit-testable in isolation — pass it a JSON blob, get a
`DetectionResult`.

A vision model should beat the heuristic at: reading labels and dimension strings (which
would fix the scale problem outright), non-orthogonal walls, telling doors from windows by
their drawn symbols, hand-drawn and photographed plans, and ignoring furniture and title
blocks. It will be slower and cost money per plan.

**Hybrid is probably the right answer**: run the CV detector for precise geometry, and
the vision model only for labels, dimensions and door/window classification. The
`DetectionResult` shape makes merging the two straightforward.

---

## 4. Project structure

```
src/
  types/
    geometry.ts          Points, polygons, RDP, offsets. Defines the coordinate system.
    floorPlan.ts         The domain model: Wall, Room, Opening, Dimension, FloorPlan.
  detection/
    imageProcessor.ts    Stage 2 — load, resample, Otsu, morphology, components.
    floorPlanDetector.ts Stage 3 — the heuristic CV detector and its four filters.
    ocr.ts               Stage 3.5 — local Tesseract, strip-sheet recognition.
    textInterpreter.ts   Stage 3.5 — room names, and scale from dimension chains.
    aiVisionAdapter.ts   Stage 3 — the AI seam. START HERE to plug in a model.
    geometryNormalizer.ts Stage 4 — validate, repair, scale, produce a FloorPlan.
    types.ts             The DetectionProvider contract.
    index.ts             Stages 1–4 orchestration.
  engine/
    geometry.ts          Plan units → three.js world space.
    wallGenerator.ts     Walls with real openings, by splitting rather than CSG.
    roomGenerator.ts     Floor slabs from room polygons.
    doorGenerator.ts     Lining + swung leaf.
    windowGenerator.ts   Frame, mullion, glass, sill.
    roofGenerator.ts     Flat or gable massing.
    structureGenerator.ts Stairs, balconies, terraces and fences.
    scaleCalculator.ts   mmPerUnit, and the sanity checks on it.
    modelBuilder.ts      Stage 5 — incremental scene-graph builder.
    exporter.ts          GLB / glTF.
    materials.ts         One shared material set.
  components/
    Toolbar, FloorPlanUploader, PlanViewer, DetectionOverlay, RoomList,
    ModelViewer, PropertyPanel, SettingsPanel, ScaleDialog, StatusBar, ui, Icons
  state/
    store.ts             Zustand store, immutable mutations, undo/redo.
    samplePlan.ts        Demo mode: the synthetic drawing and its authored plan.
scripts/
  smoke.mjs              Runs detection on the sample and checks the answer.
  verify.mjs             13 end-to-end checks: export, PDF, errors, editing.
```

### The coordinate system

Geometry is stored in **plan units** — one unit = one pixel of the processed image —
with a single `scale.mmPerUnit` alongside it. Changing the scale therefore *never touches
a vertex*; it only changes one number. That is what makes the model independent of the
resolution of whatever you uploaded, and it is asserted in `verify.mjs`.

### Performance

`ModelBuilder` keeps a signature per wall and per room covering everything that affects
its geometry, and rebuilds only what changed. Dragging one wall re-tessellates one wall —
the readout in the corner of the 3D view shows `rebuilt/total` and the build time so you
can watch it. Materials are shared across the whole model, so a 40-wall house is 40 draw
calls and one shader compile. Detection runs on a downscaled copy; the morphology uses
summed-area tables, so it is O(1) per pixel regardless of kernel size.

---

## 5. Testing

```bash
npm run build
npm run preview          # in another terminal
npm run smoke            # detection accuracy against the known sample
npm run verify           # 13 end-to-end checks
```

`npm run smoke` asserts the exact detection counts and the auto-derived scale, so a
regression in the detector fails the run rather than quietly degrading.

Both need Playwright: `npm i -D playwright && npx playwright install chromium`.
Set `CHROME_PATH` to use an existing Chromium.

`window.__plan3d` exposes the store in the console — handy for poking at state:

```js
__plan3d.getState().plan.walls
await __plan3d.getState().runDetection()
```

---

## 6. What I would do next to make this production-ready

Roughly in order of value per unit of work:

1. **Run OCR and detection in a Web Worker.** OCR takes several seconds and currently
   blocks the main thread; detection joins it on a large CAD export. The pipeline is
   already pure functions over typed arrays, so this is mostly plumbing.
2. **Train the OCR on architectural lettering.** Stock Tesseract fights stencil-style
   capitals and foot/inch marks. A fine-tuned model, or just a tighter character
   whitelist per region type, would lift both room names and dimension reading.
3. **Run detection in a Web Worker.** ~200 ms on a small plan becomes several seconds on a
   3000px CAD export, and it currently blocks the main thread. The pipeline is already
   pure functions over typed arrays, so this is mostly plumbing.
3. **Non-orthogonal walls.** A proper Hough transform, or skeletonisation plus line
   fitting, to handle angled and bay walls. The `Wall` type already stores arbitrary
   endpoints — only the detector is orthogonal-only.
4. **Automatic deskew.** Detect the dominant stroke angle and rotate the image before
   detection. Would rescue most photographed and scanned plans in one step.
5. **Proper wall joins.** Walls currently overlap at corners rather than mitring. Visible
   on thick exterior walls under a low sun angle, and it matters the moment anyone tries
   to take quantities off the model.
6. **Multi-storey.** A floor stack with per-level plans and a shared datum. The
   `floorHeightMm` on rooms and `levelMm` on structures are the beginning of this, and
   the stair generator already spans a storey.
7. **Save and load.** The plan is a plain JSON object by construction — a `.plan3d` file
   is an afternoon, and it needs to exist before anyone does real work in this.
8. **Openings that survive wall edits better.** Offsets are absolute along a wall, so
   shortening a wall from its start slides its openings. Storing a normalised parameter
   plus an anchor end would fix it.
9. **Validation pass.** Flag walls that do not meet, rooms that overlap, openings wider
   than their wall, doors that open into nothing. Cheap to compute and it is exactly the
   list a user wants before exporting.
10. **Textures and a real environment.** Currently flat materials and analytic lights. An
    IBL and a few PBR materials would change how finished it looks far more than any
    geometry work.
11. **Tests as code.** The two Playwright scripts are the safety net; unit tests around
    `floorPlanDetector` and `wallGenerator` with fixture images would let the detector be
    tuned without fear.
12. **Undo granularity.** Dragging coalesces into one history entry, which is right, but
    property-panel typing does not.
