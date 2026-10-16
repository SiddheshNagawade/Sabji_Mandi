// Three small, hand-built demo markets — real enough to draw conclusions
// from, small enough to open and simulate in seconds. Meant as a "try it
// before you draw your own" on-ramp: every one is lint-clean (an entrance
// and an exit, every stall reachable) so Simulate/Compare work immediately.

import type { Barrier, Entrance, LayoutObject, Phase, Project, VehicleArrival, VehicleBay } from './schema';
import { TileId, assumed } from './schema';
import { createBlankProject } from './defaults';
import { idx, rasterRect } from '../editor/grid';
import { rebuildObjectLayer } from '../editor/objectLayer';
import { cellsAlong, hLine, makeStall, perimeterWalls, placeEntrance, placeStall, PRODUCE, vLine } from './layoutBuilders';
import { buildNewMandi, buildOldMandi } from './mandiProjects';

// --- Demo 1: Single Aisle Market ------------------------------------------
// The simplest possible valid market: one straight aisle, stalls on one
// side, one entrance that doubles as the exit.
function buildSingleAisleMarket(): Project {
  const WIDTH = 20;
  const HEIGHT = 10;
  const project = createBlankProject('Demo 1 — Single Aisle Market', WIDTH, HEIGHT);
  const layout = project.baseline;
  const terrain = layout.terrain;
  const cellSizeM = project.grid.cellSizeM.value;
  perimeterWalls(terrain, WIDTH, HEIGHT);
  hLine(terrain, WIDTH, HEIGHT, 5, 1, WIDTH - 2, TileId.Path);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  for (let i = 0; i < 5; i++) {
    const x0 = 2 + i * 3;
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nextId++, x0, 2, 2, 2, 'S', PRODUCE[i % PRODUCE.length], cellSizeM));
  }
  placeEntrance(objects, terrain, WIDTH, HEIGHT, {
    kind: 'entrance',
    id: nextId++,
    cells: cellsAlong(0, 5, 5, 'v'),
    type: 'ped_both',
    weight: assumed(1.0, 'frac'),
    label: 'Entrance & exit',
  });

  layout.objects = objects;
  rebuildObjectLayer(layout, WIDTH, HEIGHT);
  return project;
}

// --- Demo 2: Cross Junction Market -----------------------------------------
// Two crossing aisles, four stall clusters, and separate in/out gates so
// buyers actually walk through the market rather than in and back out the
// same door.
function buildCrossJunctionMarket(): Project {
  const WIDTH = 26;
  const HEIGHT = 20;
  const project = createBlankProject('Demo 2 — Cross Junction Market', WIDTH, HEIGHT);
  const layout = project.baseline;
  const terrain = layout.terrain;
  const cellSizeM = project.grid.cellSizeM.value;
  perimeterWalls(terrain, WIDTH, HEIGHT);
  const midY = 9;
  const midX = 12;
  hLine(terrain, WIDTH, HEIGHT, midY, 1, WIDTH - 2, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, midX, 1, HEIGHT - 2, TileId.Path);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  const quadrants: { x0: number; y0: number; frontEdge: 'N' | 'S' | 'E' | 'W' }[] = [
    { x0: 2, y0: 2, frontEdge: 'S' },
    { x0: 15, y0: 2, frontEdge: 'S' },
    { x0: 2, y0: 12, frontEdge: 'N' },
    { x0: 15, y0: 12, frontEdge: 'N' },
  ];
  let produceI = 0;
  for (const q of quadrants) {
    for (let i = 0; i < 3; i++) {
      const x0 = q.x0 + i * 3;
      const y0 = q.frontEdge === 'S' ? q.y0 : q.y0 + 3;
      placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nextId++, x0, y0, 2, 3, q.frontEdge, PRODUCE[produceI % PRODUCE.length], cellSizeM));
      produceI++;
    }
  }

  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nextId++, cells: cellsAlong(HEIGHT - 1, midX - 1, midX, 'h'), type: 'ped_in', weight: assumed(1.0, 'frac'), label: 'South gate (in)' });
  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nextId++, cells: cellsAlong(0, midX - 1, midX, 'h'), type: 'ped_out', weight: assumed(1.0, 'frac'), label: 'North gate (out)' });

  layout.objects = objects;
  rebuildObjectLayer(layout, WIDTH, HEIGHT);
  return project;
}

// --- Demo 3: Market with Deliveries -----------------------------------------
// A pedestrian aisle plus a vehicle gate with bays, and a barrier across a
// service alley that only opens during a scheduled morning-delivery phase —
// exercises the phases/vehicles machinery end to end.
function buildDeliveryMarket(): Project {
  const WIDTH = 28;
  const HEIGHT = 16;
  const project = createBlankProject('Demo 3 — Market with Deliveries', WIDTH, HEIGHT);
  const layout = project.baseline;
  const terrain = layout.terrain;
  const cellSizeM = project.grid.cellSizeM.value;
  perimeterWalls(terrain, WIDTH, HEIGHT);
  hLine(terrain, WIDTH, HEIGHT, 7, 1, WIDTH - 2, TileId.Path);
  // service alley behind the stalls, gated by a barrier
  hLine(terrain, WIDTH, HEIGHT, 3, 1, WIDTH - 2, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, WIDTH - 6, 3, 7, TileId.Path);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  for (let i = 0; i < 7; i++) {
    const x0 = 2 + i * 3;
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nextId++, x0, 4, 2, 3, 'S', PRODUCE[i % PRODUCE.length], cellSizeM));
  }

  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nextId++, cells: cellsAlong(0, 7, 7, 'v'), type: 'ped_both', weight: assumed(1.0, 'frac'), label: 'Buyer entrance' });
  const vehicleGate: Entrance = { kind: 'entrance', id: nextId++, cells: cellsAlong(WIDTH - 1, 2, 3, 'v'), type: 'veh_both', weight: assumed(1.0, 'frac'), label: 'Vehicle gate' };
  placeEntrance(objects, terrain, WIDTH, HEIGHT, vehicleGate);

  const bay1: VehicleBay = { kind: 'vehicle_bay', id: nextId++, cells: rasterRect(WIDTH - 5, 1, WIDTH - 4, 2, false), vehicleType: 'handcart', label: 'Bay 1' };
  const bay2: VehicleBay = { kind: 'vehicle_bay', id: nextId++, cells: rasterRect(WIDTH - 3, 1, WIDTH - 2, 2, false), vehicleType: 'handcart', label: 'Bay 2' };
  for (const bay of [bay1, bay2]) {
    objects.push(bay);
    for (const c of bay.cells) terrain[idx(c.x, c.y, WIDTH)] = TileId.VehicleBay;
  }

  const barrierCells = [{ x: WIDTH - 6, y: 5 }];
  const barrier: Barrier = { kind: 'barrier', id: nextId++, cells: barrierCells, label: 'Service alley gate' };
  objects.push(barrier);
  for (const c of barrier.cells) terrain[idx(c.x, c.y, WIDTH)] = TileId.Barrier;

  layout.objects = objects;
  const morningDelivery: Phase = {
    id: 1,
    name: 'Morning delivery',
    startS: 6 * 3600,
    endS: 8 * 3600,
    activeBarrierIds: [],
    activeArrowGroupIds: [],
    vehiclesAllowed: true,
    vehiclesBaysOnly: true,
    openEntranceIds: [],
    wasteClearing: false,
  };
  const marketHours: Phase = {
    id: 2,
    name: 'Market hours',
    startS: 8 * 3600,
    endS: 11 * 3600,
    activeBarrierIds: [barrier.id],
    activeArrowGroupIds: [],
    vehiclesAllowed: false,
    vehiclesBaysOnly: false,
    openEntranceIds: [],
    wasteClearing: false,
  };
  layout.phases = [morningDelivery, marketHours];

  // Handcarts scheduled through both phases: the ones during "Morning
  // delivery" (vehicles allowed) actually spawn, the ones during "Market
  // hours" (vehicles not allowed) don't — a visible demonstration of the
  // phase-gated demand.
  const vehicleArrivals: VehicleArrival[] = [];
  for (let h = 6; h < 10; h++) {
    for (const m of [0, 30]) {
      vehicleArrivals.push({ arrivalTimeS: (h * 60 + m) * 60, type: 'handcart', entranceId: vehicleGate.id });
    }
  }
  project.demand.vehicleSchedule = vehicleArrivals;

  rebuildObjectLayer(layout, WIDTH, HEIGHT);
  return project;
}

export interface DemoMarket {
  id: string;
  name: string;
  description: string;
  build: () => Project;
}

export const DEMO_MARKETS: DemoMarket[] = [
  { id: 'demo1', name: 'Single Aisle Market', description: 'The simplest layout: one aisle, five stalls, one gate in and out.', build: buildSingleAisleMarket },
  { id: 'demo2', name: 'Cross Junction Market', description: 'Two crossing aisles and four stall clusters, with separate in and out gates.', build: buildCrossJunctionMarket },
  { id: 'demo3', name: 'Market with Deliveries', description: 'Vehicle bays and a service-alley barrier that only opens during a morning delivery phase.', build: buildDeliveryMarket },
  { id: 'old-mandi', name: 'Old Mandi', description: 'Traced from a real site sketch: 120+ stalls, a single gate, and one long diagonal lane cutting through the plot.', build: buildOldMandi },
  { id: 'new-mandi', name: 'New Mandi', description: 'Traced from a real site sketch: two herringbone-stall sheds off a gated main road, plus roadside stalls.', build: buildNewMandi },
];
