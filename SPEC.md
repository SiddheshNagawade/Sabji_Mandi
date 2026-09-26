# Mandi Flow Simulator: Product and Engineering Spec

Version 0.1. Written to be handed to Claude Code and built milestone by milestone.

---

## 0. How to read this document

**Conventions**

- **MUST / SHOULD / MAY** mean what they usually mean in specs. MUST is required for the milestone to count as done.
- **[PLACEHOLDER]** marks a default value that I chose only so the tool runs on day one. It is not a measurement and not a fact about any real mandi. Every placeholder must be replaceable from the UI and must display a visible "placeholder" badge until the user replaces it.
- **[FIELD]** marks a value that is meant to come from the user's field research (counts, measurements, interviews).
- **[VERIFY]** marks a literature reference or formula that should be checked before it is quoted in a pitch.

**Read order for Claude Code:** sections 1 to 4 (why and how it's built), then 5 to 12 (what to build), then 13 to 16 (calibration, tests, build order). Section 16 says what to build first.

---

## 1. Purpose

### 1.1 The problem this tool serves

The CORE problem statement (CORE-MKT-029) is: *transform unorganized local Sabji Mandis into structured, walkable market spaces to improve farmer livelihoods and consumer experience.*

So the simulator has two jobs, and both must show up in the outputs:

| Outcome | What the tool must let the user see |
|---|---|
| **Consumer experience** | How long shopping takes, where people get stuck, where it is too crowded, how many stalls people skip because of crowds or queues |
| **Farmer / seller livelihood** | Footfall and sales per stall, sales lost to crowding, wait time to unload and get a spot, sun exposure, unsold stock, and whether any stall is made worse off by a layout change |

A simulator that only shows crowd flow covers half the statement. Every screen, metric and report in this spec exists to keep both halves visible.

### 1.2 The core loop the tool must support

1. **Draw** the real mandi as a grid (tracing over the user's field sketch or satellite screenshot).
2. **Enter** field data as parameters (arrival counts, vehicle log, service times).
3. **Run** the baseline and check it against what was observed (calibration).
4. **Change** the design visually (arrows, barriers, stall-front lines, entrances, time rules).
5. **Run** the changed design and watch what happens (moving agents, heat maps).
6. **Compare** baseline against the changed design on both consumer and seller metrics.
7. **Explain** the result to someone else (pitch mode, exports).

### 1.3 Non-goals

- Not a photorealistic or 3D tool. It is a 2D top-down, pixel-art style grid.
- Not a predictor of real-world percentages. It is a comparison tool for layouts and rules under stated assumptions.
- No backend, accounts, or cloud storage. It runs in the browser.
- No machine learning. The model is rule-based and deterministic given a seed.
- No modelling of individual bargaining, prices, or cash.

### 1.4 Honesty rules (hard requirements)

These exist so the tool can be defended in front of a judge.

1. **Provenance badges.** Every parameter carries a source tag: `measured` (from field data), `assumed` (placeholder or guess), or `literature` (with a citation string). The UI shows the tag next to the value. Results panels show how many of the parameters behind a run are `assumed`.
2. **Uncalibrated banner.** Until the calibration check (section 13) passes at the user's chosen tolerance, every results screen and every export MUST show a visible banner: **"Baseline not validated against field data. Results are illustrative."**
3. **Simulated wording.** Result labels use "simulated" (for example "Simulated peak density"), never bare claims.
4. **Ranges, not single numbers.** Any headline metric comes from multiple random seeds and is shown as mean plus a spread (10th to 90th percentile).
5. **No fabricated history.** Snapshot timestamps are set by the system and cannot be edited in the UI.
6. **No hidden score.** There is no single "best layout score" by default. Multiple metrics are shown side by side. An optional weighted score MAY exist, but its weights are visible and user-set.

---

## 2. Users and contexts of use

- **Primary user:** the student building the project (solo). Uses it on a laptop to design, run and compare.
- **Secondary contexts:**
  - Showing a layout to vendors or a market committee. This benefits from a **tablet-friendly** layout (nice to have, not required for the first milestones).
  - Presenting to judges. This is what **pitch mode** is for.
- The user is design-trained and codes with AI help. The tool must be operable **entirely by mouse and keyboard without typing code**. Anything editable should be editable visually.

---

## 3. Scope and milestones at a glance

| Milestone | Delivers | Demo-able on its own? |
|---|---|---|
| **M0** | Project scaffold, data model, save/load | No |
| **M1** | Grid editor (tiles, arrows, stalls, entrances), undo/redo, background trace | Yes (a drawing tool) |
| **M2** | Simulation core: buyers, flow fields, movement, stall service | Yes (moving dots) |
| **M3** | Heat maps, playback, charts, agent inspect | **Yes, the core visual demo** |
| **M4** | Vehicles, time-rule timeline, barriers | Yes |
| **M5** | Full metrics, scenarios, interventions as modules, compare view | Yes |
| **M6** | Seller/livelihood layer, fairness report, signage effect | Yes |
| **M7** | Calibration panel, batch runner, sensitivity, combination search, pitch mode, exports | Yes |
| **M8** | Polish, performance, tablet layout, docs | Yes |

M1 to M3 together are the smallest thing that looks like a real simulator. Build in this order so something visual exists as early as possible.

---

## 4. Tech stack and architecture

### 4.1 Stack

- **Vite + React 18 + TypeScript (strict mode).**
- **Zustand** for app state.
- **Canvas 2D** for the map (tiles, heat map, agents). PixiJS/WebGL is NOT needed at the target scale. Revisit only if section 9.11 performance targets fail.
- **Web Workers** for the simulation, so the UI never freezes.
- **Vitest** for tests.
- **Tailwind CSS** for UI chrome. A small charting approach is fine (uPlot or Recharts, whichever is simpler).
- **IndexedDB** (via `idb-keyval` or similar) for autosave, plus JSON export/import.
- Static site. MUST run by opening a built `dist/` from any static host. No server.

### 4.2 Architecture

```
┌──────────────────────────── Main thread ─────────────────────────────┐
│  React UI (panels, toolbars, charts)                                 │
│  Zustand store  ◄── project, scenario, params, UI state              │
│  Canvas renderer (tiles cache, heat map, agents, overlays)           │
└───────────────▲──────────────────────────────┬───────────────────────┘
                │ snapshots (typed arrays,     │ commands: init, run,
                │ transferable)                │ pause, seek, setSpeed
┌───────────────┴──────────────────────────────▼───────────────────────┐
│  Simulation Worker                                                    │
│  World (grid, rules)  →  Flow-field cache  →  Tick loop  →  Stats     │
│  Recorder (trajectories, heat accumulators)                          │
└───────────────────────────────────────────────────────────────────────┘
        Batch runner = pool of headless workers running the same core
```

The simulation core (`src/sim/core`) MUST be pure TypeScript with **no DOM and no React imports**, so the same code runs in the UI worker, the batch workers, and Vitest.

### 4.3 Suggested folder structure

```
mandi-sim/
  src/
    app/            App shell, routing between screens
    data/           schema.ts, defaults.ts, io.ts (save/load/export), migrations.ts
    editor/         CanvasEditor.tsx, tools/, panels/, layoutLinter.ts
    sim/
      core/         world.ts, tick.ts, flowfield.ts, agents/, rng.ts, rules.ts
      worker/       sim.worker.ts, protocol.ts, batch.worker.ts
    metrics/        collectors.ts, aggregate.ts, fairness.ts
    viz/            renderTiles.ts, renderHeatmap.ts, renderAgents.ts, palettes.ts
    screens/        Editor, Simulate, Compare, Data, History, Pitch
    ui/             shared components
  tests/            unit + regression tests
  SPEC.md           this document
```

---

## 5. Data model

All project data lives in one JSON-serializable object. Types below are TypeScript; Claude Code MAY refine names but MUST keep the structure.

```ts
type ProvenanceTag = 'measured' | 'assumed' | 'literature';

interface Param<T = number> {
  value: T;
  unit?: string;
  source: ProvenanceTag;
  note?: string;              // e.g. "stopwatch, 12 buyers, 27 Sep", or citation string
}

interface Project {
  schemaVersion: number;
  meta: { name: string; createdAt: string; updatedAt: string };
  grid: {
    width: number;            // cells
    height: number;           // cells
    cellSizeM: Param;         // metres per cell, default 0.5 [PLACEHOLDER]
  };
  background?: {
    imageDataUrl: string;
    opacity: number;          // 0..1
    // affine placement so the image lines up with the grid
    originCell: { x: number; y: number };
    scaleCellsPerPixel: number;
    rotationDeg: number;
    calibration?: { pxA: XY; pxB: XY; realMetres: number };
  };
  baseline: Layout;
  interventions: Intervention[];     // recorded modules (section 12.1)
  scenarios: Scenario[];
  demand: Demand;
  params: SimParams;
  snapshots: Snapshot[];             // history + decision log (section 7.8)
  calibration: CalibrationSet;       // observed values from the field (section 13)
}

interface Layout {
  // Flat arrays of length width*height, row-major (index = y*width + x).
  terrain: Uint8Array;        // TileId, see section 6.3
  object: Uint16Array;        // 0 = none, else index into objects table
  flow: Uint8Array;           // 0 none, 1..8 = arrow direction (N, NE, E, SE, S, SW, W, NW)
  zone: Uint8Array;           // produce zone id, 0 = none
  shade: Uint8Array;          // 0/1 overlay
  locked: Uint8Array;         // 0/1, cells that interventions may not modify
  objects: LayoutObject[];    // stalls, entrances, bays, signs, transects, barriers
}

type LayoutObject =
  | Stall | Entrance | VehicleBay | WastePoint | WaterPoint
  | Sign | Transect | Barrier | Label;

interface Stall {
  kind: 'stall';
  id: number;
  cells: XY[];                       // body cells (blocked)
  frontEdge: Dir4;                   // side buyers stand on
  frontCells: XY[];                  // derived; the service positions
  produce: ProduceCategory[];
  sellerType: 'farmer' | 'reseller' | 'unknown';
  attractiveness: Param;             // relative weight, default 1.0 [PLACEHOLDER]
  maxConcurrentCustomers: number;    // derived default from front length [PLACEHOLDER]
  supply?: {
    vehicleType: VehicleType;
    arrivalTime: Param;              // sim seconds since start
    unloadDwellS: Param;
    setupS: Param;
    stockUnits: Param;               // relative units, calibrated from interviews
  };
  shaded: boolean;
  label?: string;
  locked: boolean;                   // true = fixed territory
}

interface Entrance {
  kind: 'entrance';
  id: number;
  cells: XY[];
  type: 'ped_in' | 'ped_out' | 'ped_both' | 'veh_in' | 'veh_out' | 'veh_both';
  weight: Param;                     // share of arrivals, from tallies
  schedule?: TimeWindow[];           // open windows; default always open
}

interface Demand {
  simStartS: number;                 // e.g. 05:00 as seconds of day
  simEndSpawnS: number;              // no new arrivals after this
  hardStopS: number;
  pedArrivalsPerBin: Param<number[]>;   // buyers per 10-min bin, all entrances, from tallies
  buyerTypes: { id: string; share: Param; listSize: Param<[number, number]>;
                walkSpeedMps: Param; serviceScale: Param; patienceS: Param }[];
  serviceTimeByProduce: Record<ProduceCategory, DistributionParam>;
  vehicleSchedule: VehicleArrival[]; // from the vehicle log
  vehicleTypes: Record<VehicleType, { footprintCells: [number, number];
                                       speedMps: Param; dwellS: DistributionParam }>;
  temperatureByHour?: Param<number[]>;  // optional, user-entered, for sun-exposure weighting
}
```

**Save format:** the whole `Project` serialized to `*.mandi.json`. Typed arrays are stored base64 or run-length encoded to keep files small. Provide `schemaVersion` and a `migrations.ts` stub from day one.

---

## 6. The grid and tile system

### 6.1 Cell size

- Default **0.5 m per cell** [PLACEHOLDER]. Rationale: a person's shoulder width is roughly half a metre, an aisle of 2 to 3 m becomes 4 to 6 cells wide, and a stall of about 2 m by 1.5 m becomes about 4 by 3 cells. This is fine enough to draw a mandi and coarse enough to simulate quickly.
- The user MAY change the cell size when creating a project, but not after (changing it would rescale every drawn object).
- Default grid size: **160 × 120 cells** (80 m × 60 m). Max supported: **300 × 300**.

### 6.2 Layers

The editor exposes five layers. Each can be shown or hidden and locked independently.

| Layer | Contents |
|---|---|
| **Terrain** | What each cell physically is (ground, path, wall, goods overflow, wet patch, etc.) |
| **Objects** | Stalls, entrances/exits, vehicle bays, waste and water points, signs, transects, barriers, labels |
| **Flow** | Direction arrows (one-way rules) |
| **Zones** | Produce zoning paint (colored wash, used for wayfinding and stall defaults) |
| **Overlays** | Shade, locked cells |

### 6.3 Tile catalog (Terrain + objects)

| Tile / object | Walkable by buyers | Blocks vehicles | Notes |
|---|---|---|---|
| **Open ground** | Yes (cost 1.0) | No | Default empty space |
| **Path / aisle** | Yes (cost 0.9 [PLACEHOLDER]) | No | Slight preference so agents follow intended aisles; mostly visual |
| **Wall / void** | No | Yes | Outside or fixed obstacles (buildings, drains, pillars) |
| **Stall body** | No | Yes | Part of a stall object |
| **Goods overflow** | No | Yes | Crates or produce on the ground in front of stalls. **This is how the user encodes "effective aisle width is smaller than nominal" from field measurements** |
| **Wet patch** | Yes (speed ×0.6 [PLACEHOLDER]) | No | Slows walking |
| **Waste pile** | No | Yes | Static; dynamic growth optional in M6 |
| **Entrance / exit** | Yes | Depends on type | Agent spawn and despawn points |
| **Vehicle bay** | Yes when free | No | Designated unloading spot |
| **Two-wheeler parking** | Yes when free | No | Small footprint bays |
| **Waste point / water point** | Yes | No | Markers; used by waste-schedule and wet-patch logic |
| **Barrier (movable)** | Blocked while active | Blocked while active | Has a schedule; drawn with a dashed pattern |
| **Arrow** (Flow layer) | Directional | Directional | See section 7.3 |
| **Sign** (object) | n/a | n/a | Wayfinding effect, section 9.3 |
| **Transect** (object) | n/a | n/a | A named line across an aisle that measures width, density and throughput |

### 6.4 Derived data (computed by the editor and worker, never hand-edited)

- **Walkable graph:** 8-neighbour graph with directed edges after arrows and active barriers are applied. Diagonal moves are disallowed if both orthogonal neighbours are blocked (no squeezing through corners).
- **Frontage cells:** for each stall, the walkable cells directly outside its `frontEdge`, up to a limit. Buyers stand here to be served.
- **Vehicle-passable mask:** for each vehicle type, the walkable mask eroded by its footprint, so large vehicles cannot enter narrow aisles.
- **Reachability:** flood-fill from each entrance, used by the layout linter.

### 6.5 Visual style

Flat top-down pixel-art look. Minecraft-like, but 2D. Each tile is a flat color with an optional tiny pixel pattern, crisp edges, no smoothing (`imageSmoothingEnabled = false`). Grid lines fade in when zoomed in enough.

| Item | Color |
|---|---|
| Open ground | `#E9E2D0` |
| Path / aisle | `#D8D2C0` |
| Wall / void | `#3A3A3A` |
| Goods overflow | `#C79A5B` with diagonal stripes |
| Wet patch | `#7FB3D5` at 60% |
| Waste pile | `#6B4F3A` |
| Vehicle bay | `#4D7CC7` hatched |
| Two-wheeler parking | `#7A8CA5` |
| Water point | `#5BC0EB` |
| Entrance marker | `#2BB673` |
| Exit marker | `#E4572E` |
| Barrier | red and white dashed `#B33A3A` |
| Shade overlay | `#1F3A5F` at 25% |
| Stall (by produce) | leafy `#4C9F50`, root/tuber `#A9743B`, fruit-veg `#D8503F`, gourd/beans `#8DB63C`, herbs/spices `#2E8B7A`, fruit `#E8A33D`, mixed/other `#8A7FB0` |

Stalls show a produce-color body, a thin darker outline, and a small marker on the front edge so the service side is obvious.

---

## 7. Editor screen

### 7.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Mandi Flow Simulator   [Editor][Simulate][Compare][Data][History][Pitch]  │
│ Project: Roorkee Mandi  Scenario: [Baseline ▾] [+]     Undo Redo  Save    │
├──────────┬────────────────────────────────────────────────┬───────────────┤
│ TOOLS    │                                                │ PROPERTIES    │
│ ▢ Select │                                                │ (selected     │
│ ✎ Brush  │              MAP CANVAS                        │  stall /      │
│ ▭ Rect   │       (pan, zoom, grid, tiles, arrows)         │  entrance /   │
│ ／ Line  │                                                │  tile)        │
│ ▨ Fill   │                                                │               │
│ ⌫ Erase  │                                                │ LAYERS        │
│ ➤ Arrow  │                                                │ ☑ Terrain     │
│ ⌂ Stall  │                                                │ ☑ Objects     │
│ ⇥ Entry  │                                                │ ☑ Flow        │
│ 📏 Measure│                                                │ ☐ Zones       │
│ ⟷ Transect│                                               │ ☑ Background  │
├──────────┤                                                │ opacity ▬▬▬   │
│ PALETTE  │                                                ├───────────────┤
│ [tiles]  │                                                │ LINTER        │
│ [stalls] │                                                │ ⚠ 2 warnings  │
├──────────┴────────────────────────────────────────────────┴───────────────┤
│ TIME RULES TIMELINE  05:00 ─────●──────────────●───────── 11:00           │
│  Phase A: vehicles allowed | Phase B: barrier on, one-way loop | Phase C  │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Tools and hotkeys

| Tool | Key | Behaviour |
|---|---|---|
| Select | `V` | Click or drag-box to select cells or objects. Move with arrow keys or drag. Copy `Ctrl+C`, paste `Ctrl+V`, delete `Del`. |
| Brush | `B` | Paints the selected tile. Brush sizes 1, 2, 3, 5 via `[` and `]`. |
| Rectangle | `R` | Drag to fill a rectangle. `Shift` = square. `Alt` = outline only. |
| Line | `L` | Drag a straight line. `Shift` snaps to 45°. |
| Fill | `F` | Flood-fill contiguous same-tile region. |
| Eraser | `E` (or right-click drag) | Resets cells to open ground. |
| Eyedropper | `I` | Picks the tile under the cursor as the current brush. |
| Arrow | `A` | See 7.3. |
| Stall | `S` | See 7.4. |
| Entrance | `N` | See 7.5. |
| Measure | `M` | Drag between two points, shows metres and cell count. Non-persistent. |
| Transect | `T` | Drag across an aisle to place a named measurement line. |
| Pan | `Space` + drag, or middle mouse | |
| Zoom | scroll wheel, `+` / `-`, `0` = fit | Zoom is centred on the cursor. |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` | Unlimited within a session (command stack; each stroke is one command). |
| Toggle grid | `G` | |
| Toggle layers | `1` to `5` | |

The tile palette is clickable, and pressing the number next to a palette item selects it. Cursor hover shows cell coordinates and the tile name in the footer.

### 7.3 Arrows and one-way flow (visual, not typed)

- **Arrow tool** works two ways:
  1. **Stroke mode:** click and drag along a path. The tool places arrow cells along the stroke, each pointing in the direction of travel (quantized to 8 directions), with a brush width of 1 to 5 cells. A one-way aisle is simply a wide arrow stroke.
  2. **Region mode:** hold `Shift`, drag a rectangle, then press an arrow key to set one direction for the whole rectangle.
- Arrows are drawn as chevrons on the cell, in a bright blue outline (`#1D6FD8`), always visible on top of tiles.
- Press `R` while the arrow tool is active to rotate the current direction by 45°.
- **Semantics (hard rule):** a move from cell A to cell B is forbidden if it goes against the direction of an arrow cell involved: entering an arrow cell with negative dot product against its direction, or leaving an arrow cell with negative dot product. Sideways movement (perpendicular) is allowed, so people can cross a one-way lane.
- **Compliance:** the Simulate screen has a **"Arrow compliance"** slider (0 to 100%). At spawn, each buyer is marked obeying or ignoring arrows with that probability. Ignoring buyers use flow fields that do not respect arrows. This lets the user test what happens at 60% compliance instead of assuming 100%.
- Arrows MAY have a schedule (active windows), same as barriers.

### 7.4 Stall placement and properties

- **Stall tool:** choose a footprint preset (for example 3×2, 4×3, 6×3 cells, all [PLACEHOLDER] until measured) or drag a custom rectangle. A ghost preview follows the cursor. `R` rotates 90°. The front edge is shown as a bold side; `F` flips it.
- Properties panel for a selected stall:
  - Produce category (multi-select)
  - Seller type: farmer / reseller / unknown
  - Attractiveness weight (slider, default 1.0, [PLACEHOLDER])
  - Shaded yes/no (or use the shade overlay)
  - Supply: vehicle type, arrival time, unload dwell, setup time, stock units
  - **Locked (fixed territory)** toggle
  - Label
- **Bulk edit:** select many stalls and set produce, seller type or shade at once.
- **Lock mode:** when a stall is locked, interventions (section 12.1) cannot move or delete it. A warning is shown if an intervention edit touches a locked cell. This encodes the real constraint that vendors' spots are fixed.
- **Goods overflow** is painted with the brush from the palette and can be tied to a stall (select stall, then "paint overflow" to attach cells in front of it).

### 7.5 Entrances, exits, bays, waste, water

- **Entrance tool:** drag a line across the gate. Set type (pedestrian in/out/both, vehicle in/out/both), a name, its share of arrivals (weight) and open schedule.
- **Vehicle bay tool:** place a rectangle sized to a chosen vehicle type. Optional stall assignment.
- **Waste / water point tool:** single-cell markers with a label.

### 7.6 Tracing over the user's field map

This is a key workflow because the user will bring a hand sketch or a Google Earth screenshot from the site.

1. **Import image** (PNG or JPG). It appears behind the grid.
2. **Calibrate scale:** click two points on the image, enter the real distance in metres. The tool computes cells per pixel.
3. **Rotate and position:** drag to move, handles to rotate, slider for opacity.
4. **Trace:** paint tiles over it. Toggle the background off to check the drawing alone.
5. The calibration stays in the project so measurements match the real world.

### 7.7 Time-rule timeline

A horizontal strip at the bottom of the editor.

- The time axis spans the sim window (default 05:00 to 11:00, [PLACEHOLDER]).
- The user drags handles to create **phases**. Each phase can toggle:
  - Which barriers are active
  - Which arrow groups are active
  - Whether vehicles may enter, and where they may stop (bays only vs aisles)
  - Which entrances are open
  - Waste-clearing on or off
- Any barrier, arrow group or entrance can also be given its own "active during" chip directly from its Properties panel. The timeline shows them as coloured bars.
- Changing a phase boundary triggers a flow-field recompute in the simulator at the moment of change.

### 7.8 Undo, autosave, snapshots and decision log

- Autosave to IndexedDB every 10 seconds and on every completed command.
- **Snapshots:** a "Save snapshot" button captures layout + params, a thumbnail, and a **required note field** with placeholder text: *"I believed X, I saw Y, so I changed to Z."* The timestamp is set by the system.
- **History screen:** a vertical timeline of snapshots with thumbnails and notes. Two snapshots can be compared visually (cell diff overlay). The list can be exported as a CSV and as a single printable page.
- Restoring a snapshot creates a new snapshot rather than deleting history.

### 7.9 Layout linter

A side panel that checks the drawn layout and lists warnings. Clicking a warning zooms to the location. Minimum checks:

| Check | Severity |
|---|---|
| No pedestrian entrance or no exit defined | Error |
| Stall not reachable from any entrance | Error |
| Entrance or exit cell blocked or enclosed | Error |
| Arrow leads into a wall or dead end | Warning |
| Arrows create a closed loop with no exit path for some cells | Warning |
| Stall front edge faces a wall | Warning |
| Two entrances overlap | Warning |
| Aisle narrower than 2 cells (1 m at default cell size) | Info |
| Vehicle bay unreachable by its vehicle type | Warning |
| Intervention edits a locked cell | Warning |

---

## 8. Parameters and demand panel (Data screen)

### 8.1 Layout

A form-style screen, not code. Groups: **Demand**, **Buyers**, **Service**, **Vehicles**, **Sellers**, **Movement**, **Environment**. Each row shows: name, value (slider plus numeric input), unit, provenance badge (click to change), and a note field for the source.

A top banner shows the count: "X parameters measured, Y assumed, Z literature".

### 8.2 CSV import

- **Arrivals by 10-min bin** (per entrance): paste or upload CSV `time,entrance,count`.
- **Vehicle log:** CSV `arrival_time,type,entrance,dwell_min,stop_location_hint`.
- **Service time samples:** CSV `produce,seconds` (the tool fits a distribution and shows the fit).
- **Path tracing:** CSV of stalls visited per buyer.
- Show a preview and validation errors before accepting an import.

### 8.3 How field measurements map to inputs

This table ties the field protocol to the simulator so nothing collected is wasted.

| Field task | Simulator input |
|---|---|
| Space map with measured aisles and stalls | Grid layout, cell size, background calibration |
| Nominal vs effective aisle width at peak | Goods-overflow tiles; also transects for validation |
| Entrance tallies per 10 min | `pedArrivalsPerBin`, entrance weights, throughput calibration |
| Vehicle log (time, type, stop place, dwell) | `vehicleSchedule`, vehicle types, dwell distributions, footprints |
| Fixed-angle snapshot photos | Calibration: density by zone at known times |
| Buyer path tracing | List size distribution, stall-choice weights, walk speed, stop durations, path efficiency |
| Waste and water observations | Waste points, wet patches, cleanup schedule |
| Seller interviews | Stock, arrival/setup times, shade, unsold share, seller type |
| Buyer interviews | Patience, time in market (calibration), skip behaviour |
| Conversation with the market authority | Locked stalls, phases, forbidden changes |

### 8.4 Default parameter sheet (all [PLACEHOLDER])

These exist only so the simulator runs before field data arrives. Every value below carries the `assumed` badge. **None is a measurement.**

| Parameter | Default | Notes |
|---|---|---|
| Cell size | 0.5 m | |
| Tick length | 0.25 s | |
| Buyer walk speed | 1.1 m/s | Free-walking literature is commonly quoted around 1.3 to 1.4 m/s [VERIFY]. A market should be slower. Replace from path-tracing stopwatch data. |
| Buyer types and mix | quick 30%, regular 50%, bulk 20% | |
| List size | quick 2 to 3, regular 4 to 6, bulk 7 to 10 stalls | |
| Service time | lognormal, median 45 s, produce-dependent | |
| Patience before skipping | 90 s | |
| Vehicle speed inside market | 0.8 m/s | |
| Handcart footprint | 2×4 cells (1×2 m) | |
| Two-wheeler footprint | 1×4 cells (0.5×2 m) | |
| Tempo / pickup footprint | 4×10 cells (2×5 m) | |
| Wet patch slowdown | ×0.6 | |
| Deadlock swap probability | 0.3 per blocked tick after 20 s | |
| Concurrent customers per stall | ceil(front length in metres / 1.0) | |

---

## 9. Simulation engine

### 9.1 Model choice

**Recommended: a cellular-automaton pedestrian model (floor-field style) on the grid, with one pedestrian per cell.**

Why this and not the alternatives:

| Option | Verdict |
|---|---|
| **Cellular automaton (floor field)** | **Chosen.** Fits a tile editor directly. Fast, deterministic, easy to test, easy to heat-map, and the drawn cells are exactly the simulated cells. Literature basis: Burstedde et al., Kirchner and Schadschneider [VERIFY]. |
| Social-force model (Helbing) | Smoother motion but many parameters, sensitive to tuning, slower, and harder to connect to a tile editor. |
| Fully continuous space with collision avoidance | Most realistic in principle; heaviest to build and calibrate. Not justified for a comparison tool. |

With cells 0.5 m wide, one person per cell caps density at 4 people per m² (0.25 m² per cell), which is near the crush range and acceptable. The visual position of an agent is interpolated between cells so motion looks smooth.

The model's known weaknesses are listed in section 17. The tool MUST expose them in the UI (an "About the model" panel).

### 9.2 Clock and tick

- Fixed **tick `dt = 0.25 s`** [PLACEHOLDER]. Simulated time only; it is independent of frame rate.
- Each frame the UI runs `ticksPerFrame = speedMultiplier × frameSeconds / dt` ticks (capped).
- Speeds: 1×, 5×, 20×, 60×, Max.
- Time of day starts at `demand.simStartS` (default 05:00). Spawning stops at `simEndSpawnS`. The run ends when all agents have left or `hardStopS` is reached.
- **Movement accumulator:** each agent has `budget`. Each tick: `budget += (speedMps × speedFactor / cellSizeM) × dt`. An agent may move to a neighbour if `budget ≥ stepCost` (1.0 orthogonal, 1.414 diagonal); the cost is deducted on moving. This lets agents move slower than one cell per tick.

### 9.3 Agents and state machines

#### Buyer

```
SPAWN ─► CHOOSE_TARGET ─► WALK ─► ARRIVED ─► WAIT_FOR_SLOT ─► BEING_SERVED ─► (more stalls?) ─► LEAVE ─► DESPAWN
                              ▲            │
                              │            └─(patience exceeded)─► SKIP (record lost visit) ─► CHOOSE_TARGET
                              └─── re-route if flow rules change
```

- **Spawn:** at each entrance, arrivals per tick are Poisson with mean `rate(t) × weight × dt`. Rate comes from `pedArrivalsPerBin` (interpolated between bins).
- **Attributes at spawn:** buyer type, list of produce categories to buy (size from the type's list size range), obeysArrows flag (from compliance), walk speed (from the type, with small random variation), patience, and an `informed` map (which categories they know locations of).
- **Choose target:** for the next needed produce category, consider stalls that sell it and are open. Score each:
  `U = -α·pathCost − β·queueAhead − γ·localCrowd + δ·attractiveness + ε·noise`
  Pick with softmax (temperature is a parameter). All weights [PLACEHOLDER], to be estimated from path-tracing data. Default attractiveness is equal, so any unevenness in footfall comes from position, not an assumption.
- **Uninformed search:** if the buyer is not informed about a category, they head toward a random stall cluster along aisles, then become informed once within view range of a matching stall (radius parameter) or a **Sign** for that category. This is how wayfinding signs are modelled (section 12.1).
- **Walk:** follow the flow field to the target's frontage cells (section 9.4).
- **Arrived / wait for slot:** if the stall has a free service slot, take it. Otherwise loiter on the nearest free walkable cell within a radius of the stall and wait. Waiting agents occupy real cells, so they physically create overflow queues in aisles (this is how the stall-front jam appears).
- **Being served:** stand for a sampled service time (by produce category and buyer type). If the stall has a stock model, reduce stock (section 9.8).
- **Skip:** if waiting longer than `patience`, or if blocked (unable to move) for longer than a threshold, the buyer skips this stall and records a **lost visit** attributed to that stall (with the reason: `queue` or `blocked`).
- **Leave:** after the list is done (or skipped), flow field to the nearest allowed exit.

#### Vehicles

Types: handcart, two-wheeler, tempo/pickup (footprints from section 8.4).

- **Spawn** from `vehicleSchedule` at vehicle entrances (or at any pedestrian entrance for handcarts, if the user sets it).
- **Destination:** the stall's assigned bay if free; otherwise the nearest allowed stopping place. If rules forbid aisle stopping and no bay is free, the vehicle queues outside and leaves after `maxWaitS` (recorded as a failed unload).
- **Movement:** rigid rectangle on the vehicle-passable mask, one step at a time, blocked by pedestrians and other vehicles. Vehicles are slower and lower priority: they yield when a pedestrian occupies the target cells.
- **Dwell:** while stopped, the vehicle's cells are blocked for pedestrians.
- **Depart:** to the nearest allowed vehicle exit.

#### Sellers (livelihood layer, M6)

Sellers are not moving agents. Each stall carries a small state machine: `WAITING_FOR_ACCESS → UNLOADING → SETUP → OPEN → CLOSED`. Timing comes from the stall's supply parameters and from whether its vehicle could reach the bay. See section 9.8.

#### Cleaners (optional, M6)

A waste-clearing job removes waste piles at scheduled windows. Without it, waste grows as a dynamic blocked area (section 9.9).

### 9.4 Navigation: flow fields

- For each **goal set** (a stall's frontage cells, an exit set, a bay), compute a **distance field** with Dijkstra from the goal over the *reverse* directed graph. Edge cost = tile cost × step length, plus a small wall-proximity penalty (so people do not hug walls).
- Cache fields per key `(goalId, obeysArrows, phaseId)`. Each key is a `Float32Array(width×height)`.
- **Two variants per goal** exist: one that respects arrows (`obeysArrows = true`) and one that ignores them.
- **Recompute** when a rule phase changes, a barrier switches, or the layout changes. Compute lazily (on first use in the new phase) and evict the old phase's fields.
- **Memory check:** 200 stalls × 2 variants × 160×120 cells × 4 bytes ≈ 30 MB for one phase. This is acceptable. If it becomes a problem, cache only for stalls that currently have interested buyers.
- **Dynamic crowd awareness** is NOT baked into the fields. It is added at decision time: when choosing the next cell, add a penalty for occupied or crowded neighbours (next section).

### 9.5 Movement and conflict resolution

Each tick, for every walking agent:

1. Increase `budget`. If `budget` is below the smallest step cost, skip movement.
2. Build candidates: the 8 neighbours that are walkable, allowed by directed edges (if obeying), unblocked by barriers, and not occupied by a *stationary* agent or vehicle.
3. Score each candidate: `fieldValue[goal][neighbour] + wOcc·(occupied by a moving agent ? 1 : 0) + wDens·localDensity(neighbour) + tiny random tie-breaker`.
4. Take the lowest-score candidate as the proposal. If the best candidate is not better than staying (field value not lower than the current cell), the agent waits and increments `blockedTicks`.
5. **Sidestep:** if `blockedTicks > k`, the agent MAY choose a lateral cell whose field value is within a tolerance of the current one, with probability `p_side`.
6. **Deadlock breaker:** if `blockedTicks × dt > deadlockThresholdS` and the blocking agent is moving the opposite direction, allow a **swap** with probability `p_swap`. This models people turning sideways to pass in narrow aisles and prevents permanent head-on freezes.
7. **Resolve conflicts:** group proposals by target cell. If two or more agents want the same cell, choose one winner at random, weighted by `1 + blockedTicks × small`. Losers wait.
8. Apply moves, deduct budget, then update per-cell occupancy and heat accumulators.

**Movement speed under crowding:** speed emerges from blocking, but a mild explicit slowdown is also applied: `speedFactor = clamp(1 − κ·localDensity, minFactor, 1)`, with κ and minFactor as parameters. A Weidmann-type fundamental diagram is a reasonable reference [VERIFY: Weidmann 1993, free speed about 1.34 m/s, jam density about 5.4 persons per m²]. Do not treat the reference values as measured for a market.

### 9.6 Stall service and queues

- Each stall has `maxConcurrentCustomers` service slots on its frontage cells.
- A buyer on a slot is served for a sampled time, then the slot is freed.
- Waiting buyers form an informal cluster in front. No explicit queue discipline is modelled beyond arrival order for slot assignment (first free slot goes to the longest waiting nearby buyer).
- **Attribution rule:** a buyer who skipped because of a queue or a blocked path counts as a **lost visit for the stall they were heading to**. This is the mechanism that turns crowding into a seller-side metric.

### 9.7 Vehicles and conflicts

- **Pedestrian–vehicle conflict event:** logged when a pedestrian is within 1 cell of a moving vehicle for at least 2 s, or a vehicle is held up by a pedestrian for at least 2 s [PLACEHOLDER thresholds]. Each event stores location, time and vehicle type for the conflict heat map.
- **Aisle blocking time:** for every aisle cell, total time it is blocked by a vehicle, parked or unloading.

### 9.8 Seller and stock model (M6)

- Stock is a relative unit, `stockUnits`, entered from interviews. Each served buyer consumes a sampled quantity (by buyer type and produce), capped by remaining stock.
- **Unsold share** at close = remaining stock / initial stock.
- **Unloading wait** = time from the stall's supply vehicle arriving at the gate to starting to unload.
- **Sun exposure hours** = simulated open hours for which the stall has no shade, optionally weighted by an hourly temperature profile the user enters. **The tool MUST NOT convert this to a spoilage percentage or a rupee loss unless the user supplies a measured conversion.** By default it reports the exposure index only.
- **Idle time** = time the stall is open with no customer served.

### 9.9 Dynamic elements (optional, M6)

- **Waste growth:** each waste point accumulates a pile at a user-set rate, expanding blocked cells outward until cleared in a cleanup window. Growth rates are [PLACEHOLDER] until measured.
- **Wet patches** may be static (painted), or created around water points at a user-set rate.

### 9.10 Determinism and randomness

- A single seeded RNG (for example `mulberry32`), created per run from `seed`. Agents are processed in a **seed-determined shuffled order** each tick to avoid systematic bias.
- Given the same project, scenario and seed, the run MUST be exactly reproducible (same metrics, same hash).
- The seed is shown in the UI and saved with each result.

### 9.11 Worker protocol and performance

**Commands (main → worker):** `init(project, scenarioId, seed)`, `run`, `pause`, `setSpeed(mult)`, `seek(t)`, `reset`, `getStats`.

**Messages (worker → main):**

- `frame`: a transferable snapshot with agent positions as `Float32Array` (x, y, type, state), plus the simulated time. Sent at most 30 times per second.
- `heat`: heat accumulator buffers (`Float32Array` per layer), sent at most 5 times per second.
- `metrics`: incremental metric updates for charts.
- `done`: final metrics and the recorded trajectory summary.

**Performance targets** (targets, not measurements; verify on the user's machine):

- 1,500 simultaneous agents at 30+ frames per second at 1× speed on a mid-range laptop.
- Headless batch runs at least 50× real time for a 6-hour scenario with about 5,000 buyers.
- If the target fails, profile before rewriting. First candidates: flow-field caching, typed arrays, avoiding per-tick allocations, spatial indexing for occupancy.

### 9.12 Tick pseudocode

```ts
function step(w: World) {
  w.t += DT;
  if (phaseChanged(w)) { invalidateFlowFields(w); }
  spawnBuyers(w);          // Poisson per entrance
  spawnVehicles(w);        // from schedule
  updateSellers(w);        // WAITING → UNLOADING → SETUP → OPEN
  updateWasteAndWet(w);    // optional dynamic elements

  const order = shuffledIds(w.agents, w.rng);

  for (const id of order) decide(w, id);    // state machine transitions, target choice, skipping

  const proposals: Proposal[] = [];
  for (const id of order) {
    const a = w.agents[id];
    if (!a.wantsToMove) continue;
    a.budget += a.speedMps * speedFactor(w, a) / w.cellSizeM * DT;
    const p = proposeMove(w, a);            // scoring in section 9.5
    if (p) proposals.push(p);
  }
  resolveConflicts(w, proposals);           // random winner per target cell
  moveVehicles(w);                          // rigid footprint moves, yield to pedestrians
  applyMoves(w);

  accumulateHeat(w);                        // occupancy, pass counts, stuck time, conflicts
  collectMetrics(w);                        // transects, throughput, per-stall counters
  despawnFinished(w);
}
```

---

## 10. Metrics

All metrics are computed by `src/metrics` from raw counters that the sim core records. Every metric has a unit, a definition, and a "who benefits" tag: **[C]** consumer, **[S]** seller, or **[B]** both.

### 10.1 Spatial metrics (heat-map layers)

| Metric | Definition | Tag |
|---|---|---|
| **Density** | People per m² per cell, smoothed over a 3×3 block and a rolling window (default 30 s [PLACEHOLDER]) | C |
| **Level of service (LoS)** | Area per person = 1 / density, binned with Fruin-style walkway thresholds A to F [VERIFY]: A above 3.3 m² per person, B 2.3 to 3.3, C 1.4 to 2.3, D 0.9 to 1.4, E 0.5 to 0.9, F below 0.5 | C |
| **Occupancy time** | Cumulative person-seconds per cell | B |
| **Pass count** | Number of distinct agent entries per cell (footfall) | S |
| **Stuck time** | Person-seconds spent with speed below 30% of free speed | C |
| **Vehicle blocking time** | Seconds each cell is blocked by a vehicle | B |
| **Conflict hot spots** | Count of pedestrian–vehicle conflict events per cell | C |

### 10.2 Consumer metrics (run-level)

| Metric | Definition |
|---|---|
| **Time in market** | Spawn to despawn, per buyer; report median and 90th percentile |
| **Shopping completion time** | Time from entering to finishing the list (excludes skipped items) |
| **Path efficiency** | Shortest possible path length ÷ actual path length, per buyer |
| **Skipped-stall rate** | Skipped visits ÷ attempted visits, split by reason (queue / blocked) |
| **List completion rate** | Share of buyers who got everything on their list |
| **Peak density and LoS** | Highest smoothed density and its location and time |
| **Time above LoS D or worse** | Person-seconds spent in areas at LoS D or worse |
| **Vehicle conflicts** | Count of pedestrian–vehicle conflict events |

### 10.3 Seller metrics (per stall and aggregated)

| Metric | Definition |
|---|---|
| **Footfall** | Distinct buyers who entered the stall's catchment (frontage cells plus one ring) |
| **Visits** | Buyers who chose this stall as a target |
| **Served** | Buyers who were served |
| **Lost visits** | Visits that ended in a skip, by reason |
| **Served units** | Total stock units sold |
| **Idle share** | Open time with no customer ÷ open time |
| **Unloading wait** | Arrival at gate to start of unloading |
| **Unsold share** | Remaining stock ÷ initial stock at close |
| **Sun exposure index** | Unshaded open hours, optionally temperature-weighted |
| **Footfall spread (Gini)** | Gini coefficient of served counts across stalls, overall and within each produce category |

### 10.4 Transect metrics

For each named transect:

- **Effective width over time** = number of unblocked, walkable cells along the line × cell size (blocked by goods overflow, waste, vehicles, stationary agents).
- **Throughput** = persons crossing per minute (in each direction).
- **Peak density** along the line.

Throughput at entrance transects is what the tool compares against the user's field tallies (section 13).

### 10.5 Comparison metrics

- **Delta per metric** between two scenarios (absolute and %), with seed spread.
- **Per-stall delta** on footfall, served and lost visits.
- **No-one-worse-off report:** the list of stalls whose served count drops by more than a threshold (default 10% [PLACEHOLDER], user-adjustable) between baseline and scenario, plus the list of stalls that gain. Shown as a table and as a map where each stall is colored red / grey / green.

---

## 11. Simulation screen (visualization)

### 11.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ⚠ Baseline not validated against field data. Results are illustrative.    │
├───────────────────────────────────────────────────────────────┬───────────┤
│                                                               │ VIEW      │
│                                                               │ ● Agents  │
│                     MAP CANVAS                                │ ○ Density │
│      (tiles + heat map + moving agents + arrows)              │ ○ Footfall│
│                                                               │ ○ Stuck   │
│                                                               │ ○ Vehicle │
│                                                               │   block   │
│                                                               │ ○ Conflict│
│                                                               │ ○ Stall   │
│                                                               │   sales   │
│                                                               │ Trails ☐  │
│                                                               │ Legend ▮▮▮│
│                                                               ├───────────┤
│                                                               │ CONTROLS  │
│                                                               │ Compliance│
│                                                               │ ▬▬▬●▬ 80% │
│                                                               │ Arrival × │
│                                                               │ ▬▬●▬▬ 1.0 │
│                                                               │ Seed [42] │
├───────────────────────────────────────────────────────────────┴───────────┤
│ ▶ ❚❚  1× 5× 20× 60× Max   05:00 ──────●──────────────────── 11:00  06:42  │
│ Charts: people in market │ peak density │ vehicles │ skipped stalls         │
└───────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Heat-map modes

- One mode active at a time, with an opacity slider, a legend with units, and optional smoothing (nearest vs bilinear).
- **Density mode** uses the LoS colour ramp: A `#2C7BB6` (blue), B `#7FBF7B`, C `#FFFFBF`, D `#FDAE61`, E `#F46D43`, F `#D7191C`.
- **Accumulated modes** (footfall, occupancy, stuck, blocking, conflicts) use a sequential ramp (light yellow to dark red).
- **Stall choropleth modes** colour each stall body by footfall, served, lost visits, or unsold share, on a diverging ramp when comparing scenarios (red = worse, green = better).
- **Time-window heat map:** the user drags a bracket on the timeline to see the accumulated map for only that window (for example the peak hour).
- **Scale lock:** when comparing scenarios, colour scales are locked to the same range, with a visible indicator, so maps are comparable.

### 11.3 Agent rendering

- Buyers are small filled circles, about 60% of a cell in diameter, coloured by state:
  - walking: blue
  - queuing / waiting: orange
  - being served: green
  - stuck (speed under threshold): red
  - obeying vs ignoring arrows: outline style (solid vs dashed)
- Vehicles are rectangles matching the footprint, coloured by type (handcart brown, two-wheeler grey, tempo dark blue), with a small heading marker. A stopped vehicle gets a hatch pattern.
- Motion is interpolated between cells across ticks for smoothness.
- Optional **trails** show the last N seconds of each agent's path as a fading line.
- Optional **flow arrows** overlay: a vector field of average movement direction per 4×4 cell block, drawn as small arrows scaled by flow rate. This shows where flow is heavy, opposing, or missing.

### 11.4 Playback and recording

- Play, pause, step one tick, speed selector.
- **Scrub bar:** drag to any time. This requires either checkpoint snapshots or full trajectory recording. Recommended: record each agent's position every 1 s (configurable) into compact `Int16` arrays. Estimated cost: about 4 bytes per sample, so a 20-minute visit is about 5 KB per agent and 5,000 agents is about 25 MB. This also powers trails and agent inspection.
- **Restart with same seed** and **new seed** buttons.
- Recording can be turned off for headless batch runs.

### 11.5 Live charts

Small time-series charts under the map, synced with the playhead:

- People in market
- Peak density over time
- Vehicles in market
- Cumulative skipped visits
- Transect throughput (selectable transect)

### 11.6 Agent and stall inspection

- **Click a buyer:** shows type, list, progress, path so far (drawn on the map), time waiting, times blocked.
- **Click a stall:** shows footfall, served, lost visits (with reasons), idle share, stock and open time; a small chart of its customers over time.
- **Click a cell:** shows density history, pass count and the reasons agents were blocked there.

### 11.7 Pitch mode

A full-screen mode with editor chrome hidden:

- Large map, large legend, big scenario title, a single row of headline metrics with spread ranges.
- **Auto-play loop** of the peak window, with a keyboard toggle.
- **Split view:** baseline on the left, scenario on the right, synchronized clock, locked colour scales.
- Persistent small footer with the validation status and the parameter provenance counts, so honesty travels with the visuals.

### 11.8 Exports

- **PNG** of the current map with legend, scenario name, seed and validation status baked in.
- **Video (WebM)** recorded from the canvas using `MediaRecorder` and `captureStream`, with a "record peak window" shortcut.
- **CSV** of metrics per scenario and per stall.
- **JSON** project export.
- **Printable HTML report** (one scenario or a comparison): layout thumbnails, headline metrics with spreads, per-stall table, no-one-worse-off list, parameter provenance summary. Designed to be printed to PDF from the browser.

---

## 12. Scenarios, comparison and experiments

### 12.1 Scenarios and interventions as recordable modules

- The **baseline** is the layout that mirrors the real mandi. It can be **locked** so it is not edited by accident.
- An **intervention** is a named, reusable module holding:
  - A cell patch (list of cell changes on any layer)
  - Optional rule changes (phases, schedules, arrow groups, barriers)
  - Optional parameter overrides (for example compliance)
  - Its intended beneficiary (consumer / seller / both) and a short rationale
- **Record mode:** the user clicks **"New intervention"**, then edits the map normally. Every edit is captured into the module instead of the baseline. Click **"Finish"** to save it. This means no special editing UI is needed; the user just draws.
- A **scenario** = the baseline + a set of enabled interventions + optional parameter overrides. Toggling interventions on and off is one click each.
- If two enabled interventions edit the same cell, the later one wins and a warning is shown.
- Edits to **locked** cells are refused with a message.
- A **diff overlay** shows changed cells in colour on the map (added vs removed vs changed).
- **Starter intervention templates** (each just a pre-drawn example the user can adapt): stall-front line, one-way aisle loop, vehicle time window, entry/exit split, produce wayfinding signs, waste pickup window, two-wheeler parking outside the aisles. These are examples of interventions the tool must support; they are not conclusions about what works.

### 12.2 Compare screen

- Choose scenario A and B (any two, baseline included).
- Views: side by side (synchronized playback), **diff heat map** (B minus A, diverging colours), and a metrics table with deltas and spreads.
- The **no-one-worse-off** report (section 10.5) appears at the top when the user is comparing against the baseline.
- Each delta shows whether the spread ranges overlap (if they do, mark the difference "not distinguishable from noise").

### 12.3 Batch runner

- The user picks scenarios, the number of seeds (default 20 [PLACEHOLDER], user-set), and which metrics to collect.
- Runs in a pool of `navigator.hardwareConcurrency − 1` workers, with a progress bar and a cancel button.
- Output: a table of mean and 10th–90th percentile per metric, plus distribution plots for chosen metrics.
- Results are stored with the scenario, the seed list and the parameter provenance counts.

### 12.4 Sensitivity analysis ("what factors affect it")

- The user picks a metric of interest and a set of parameters.
- The tool varies each parameter one at a time by ± a chosen percentage (default 20% [PLACEHOLDER]) with several seeds.
- Output: a **tornado chart** ranking parameters by effect on that metric.
- Purpose: show which assumptions matter most, so field effort can be focused on those inputs. This is the direct answer to "which factors affect the outcome."

### 12.5 Combination search and Pareto view

- For k enabled intervention modules (k up to about 6), the tool runs every on/off combination (up to 64) with several seeds.
- Output: a table of combinations with metrics, and a **Pareto plot** with a consumer metric on one axis (for example median shopping time) and a seller metric on the other (for example worst-stall change in served), highlighting non-dominated combinations.
- The user can filter out combinations that fail the no-one-worse-off check.
- No optimizer or hidden weighting is used. The user reads the trade-offs. (An optional weighted score with visible weights MAY be added later.)

### 12.6 Parameter sweeps

- Sweep a single parameter (for example arrow compliance 40% to 100%, or arrival rate ×0.8 to ×1.4) over a scenario and plot a metric against it, with spread bands.

---

## 13. Calibration and validation

### 13.1 Observed-values table

A form on the Data screen where the user enters what they actually saw in the field, each with a source note:

| Observed quantity | Compared with |
|---|---|
| Entrance counts per 10 min | Throughput at entrance transects |
| Peak density (or head counts) in named zones at known times | Simulated density in the same zones and times |
| Mean or median time in market (buyer interviews) | Simulated time in market |
| Effective aisle width at peak at named transects | Simulated effective width |
| Vehicle counts and dwell times | Simulated vehicle counts and dwell |
| Shares of buyers who skipped a stall because of the crowd (if asked) | Simulated skipped-stall rate |

### 13.2 Validation check

- Run the baseline over N seeds and compare against observed values.
- Show for each quantity: observed, simulated mean and spread, and relative error.
- The user sets a tolerance (default ±25% [PLACEHOLDER]). The status becomes:
  - **Not validated** (no observed data entered)
  - **Failing** (any required quantity outside tolerance)
  - **Passing at ±X%** (all required quantities within tolerance)
- Status feeds the banner in section 1.4. It appears in every export.

### 13.3 What to do when it fails

The Data screen suggests, but does not auto-apply, which parameters to review first (using the sensitivity ranking): typically walk speed, service time, arrival counts and overflow width. The user adjusts and re-runs. The tool MUST NOT auto-tune parameters to force a pass.

---

## 14. Seed example map

So the simulator is usable before the real mandi is drawn, ship one **synthetic example project**, clearly labeled **"SYNTHETIC EXAMPLE, NOT THE REAL MANDI."**

- Grid 120 × 80 cells (60 m × 40 m).
- A rectangular market with 2 main horizontal aisles and 3 cross aisles.
- About 40 stalls arranged in blocks with front edges facing aisles, mixed produce categories.
- 2 pedestrian entrances (one main, one side) and 1 exit, 1 vehicle entrance at one end.
- 4 vehicle bays near one edge, 1 waste point, 1 water point.
- Some goods overflow tiles in front of a few stalls.
- All parameters are the placeholder defaults, with the `assumed` badge and the uncalibrated banner visible.

Use it for demos, for automated tests, and for the first end-to-end run.

---

## 15. Testing and acceptance criteria

### 15.1 Unit and behaviour tests (Vitest)

| Test | Expected |
|---|---|
| Single agent in an empty straight corridor | Travel time ≈ length ÷ speed, within a small tolerance |
| One-way arrows | An obeying agent never moves against an arrow; a non-obeying agent may |
| Head-on flow in a 2 m wide corridor | Both groups get through; no permanent deadlock (swap and sidestep work) |
| Narrow bottleneck | Throughput falls as width falls; monotonic |
| Barrier schedule | Cells block only during the active window; flow fields recompute at boundaries |
| Determinism | Same project, scenario and seed give an identical metrics hash |
| Conservation | Spawned = despawned + still in market, at all times |
| Vehicle footprint | A tempo cannot enter an aisle narrower than its footprint |
| Stall service | A stall with 1 slot never serves 2 buyers at once |
| Lost-visit attribution | A buyer skipping due to a queue is counted against the correct stall |
| Fairness report | Known synthetic input gives the expected list of worse-off stalls |
| Save/load | Round trip of a project yields an identical layout and parameters |
| Layout linter | Each rule in section 7.9 fires on a purpose-built broken map |

### 15.2 Milestone acceptance criteria

| Milestone | Done when |
|---|---|
| **M0** | App builds and runs; a blank project saves to and loads from JSON; schema version is stored. |
| **M1** | A user can trace over an imported image with calibrated scale, paint all tile types, place stalls with front edges, draw arrows by dragging, place entrances, undo and redo, and the layout persists after reload. The linter works. |
| **M2** | With the synthetic example, buyers spawn, walk to stalls, queue, get served, and leave. Sim runs in a worker. Determinism and conservation tests pass. |
| **M3** | Density, footfall and stuck-time heat maps render live. Playback controls and scrub bar work. Charts update. Clicking an agent or a stall shows its details. The 1,500-agent frame-rate target is checked and the result reported. |
| **M4** | Vehicles work with footprints and dwell; barriers and phases work on the timeline; conflicts and vehicle blocking time show as heat maps. |
| **M5** | Interventions can be recorded as modules and toggled. Compare screen shows side-by-side, diff heat map and delta table with seed spreads. Batch runner works. |
| **M6** | Seller layer gives per-stall footfall, served, lost visits, unsold share, sun exposure index and unloading wait. No-one-worse-off report works. Signs affect buyer knowledge. Optional waste dynamics work. |
| **M7** | Calibration panel, validation banner, sensitivity tornado, combination search with Pareto plot, pitch mode, all exports. |
| **M8** | Performance and usability pass, tablet layout, "About the model" panel, README with a user guide. |

---

## 16. Build order and instructions for Claude Code

### 16.1 Working agreement

1. Read this whole spec before writing code.
2. Build **one milestone at a time**. After each, run the tests, run the app, and report what works and what does not. Do not start the next milestone until asked.
3. Keep `src/sim/core` free of DOM and React imports.
4. Every default number MUST be marked as a placeholder in code and in the UI. Do not invent new default values silently; if a needed value is missing from this spec, add it to the placeholder table with the `assumed` tag and mention it in the milestone report.
5. Prefer simple, readable code. Comments should explain *why*, not *what*.
6. Do not add features not in this spec without asking. If something in the spec seems wrong or impossible, say so in the report rather than working around it quietly.
7. Report measured performance rather than assuming it.

### 16.2 Suggested first prompts

- **Prompt 1:** "Read `SPEC.md`. Implement Milestone M0 only. Report when done."
- **Prompt 2:** "Implement Milestone M1 (editor). Include the synthetic example map from section 14 as a loadable sample."
- **Prompt 3:** "Implement M2 (simulation core, worker, buyers, flow fields, stall service) with the tests in section 15.1."
- **Prompt 4:** "Implement M3 (heat maps, playback, charts, inspect). Measure frame rate with 1,500 agents and report."

Continue with M4 onward one at a time.

### 16.3 Priority if time is short

If only part can be built before a deadline, build **M1 to M3**. That gives a drawable mandi, moving crowds and a live heat map, which is the most convincing visual. Anything shown from it must be labeled as illustrative until real field data is entered and validated.

---

## 17. Known limitations (must be visible in an "About the model" panel)

1. **One person per cell** and 8-neighbour movement produce grid artifacts (for example slight preference for axis-aligned motion).
2. **No groups.** Families and friends who walk together are modelled as individuals.
3. **Simple bargaining and browsing.** Service time is a distribution; there is no price negotiation, no impulse purchases, no pushing or carrying-load effects except through the speed and service parameters.
4. **Behaviour parameters are not universal.** Stall choice weights, patience and search behaviour are placeholders until estimated from path-tracing data.
5. **Sellers do not move** inside the market. Only their supply timing and stock are modelled.
6. **Spoilage is not predicted.** Only a sun exposure index is reported unless the user provides a measured conversion.
7. **Sales are relative units,** not rupees.
8. **Rare behaviour is absent:** fights, festivals, monsoon flooding and police actions are not modelled.
9. **Results are comparative.** The tool supports "layout B is better than layout A under these assumptions." It does not support "layout B will raise sales by X%."

---

## 18. Questions the field data must answer before results can be trusted

These are open and are NOT assumed by the tool.

1. Who actually sells: farmers, resellers, or both, and in what mix?
2. Is the biggest real problem crowding, spoilage and sun, unloading delay, or middlemen? (The simulator only speaks about the first and, partly, the third.)
3. How fixed are stall positions in practice, and which cells are truly off limits?
4. How much do buyers spend per stall, and how many stalls per visit?
5. What is the real effective aisle width at peak, versus nominal?
6. Do vehicles enter the aisles, and when?
7. What rules already exist, and who enforces them?

---

## 19. Appendix

### 19.1 Glossary

- **Cell:** one square of the grid (default 0.5 m × 0.5 m).
- **Frontage:** the walkable cells in front of a stall's service side.
- **Flow field:** a grid of distances-to-goal used to steer agents.
- **Transect:** a named line across an aisle used to measure width, density and throughput.
- **LoS (level of service):** a letter grade for pedestrian crowding, A (comfortable) to F (jammed).
- **Intervention:** a recorded layout or rule change that can be toggled on top of the baseline.
- **Provenance:** where a parameter value came from (measured, assumed, literature).

### 19.2 References to verify before quoting

- Fruin, J. J. (1971), *Pedestrian Planning and Design*. Walkway level-of-service thresholds.
- Weidmann, U. (1993), *Transporttechnik der Fussgänger*. Pedestrian speed–density relation.
- Burstedde, C. et al. (2001), "Simulation of pedestrian dynamics using a two-dimensional cellular automaton," *Physica A*.
- Helbing, D. and Molnár, P. (1995), "Social force model for pedestrian dynamics," *Physical Review E*.
- Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014 (India). Background on why vendor positions are treated as protected.

Do not quote numbers from these in the pitch until the exact source and value have been checked.

### 19.3 Keyboard cheat sheet

`V` select · `B` brush · `R` rectangle (or rotate while placing) · `L` line · `F` fill (or flip front edge while placing a stall) · `E` erase · `I` eyedropper · `A` arrow · `S` stall · `N` entrance · `M` measure · `T` transect · `G` grid · `Space` pan · `Ctrl+Z / Y` undo / redo · `0` fit to screen · `1–5` toggle layers · `P` pitch mode · `Space` (in Simulate) play / pause
