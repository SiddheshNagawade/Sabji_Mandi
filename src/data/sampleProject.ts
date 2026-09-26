// Synthetic example map, SPEC.md section 14. Ships so the tool is usable
// before a real mandi is drawn. Every parameter is a [PLACEHOLDER].

import type { Entrance, LayoutObject, Project, ProduceCategory, Stall, VehicleBay, WastePoint, WaterPoint } from './schema';
import { TileId, assumed } from './schema';
import { createBlankProject } from './defaults';
import { idx, inBounds, rasterRect } from '../editor/grid';
import { rebuildObjectLayer } from '../editor/objectLayer';

const WIDTH = 120;
const HEIGHT = 80;

const PRODUCE_CYCLE: ProduceCategory[] = ['leafy', 'root_tuber', 'fruit_veg', 'gourd_beans', 'herbs_spices', 'fruit', 'mixed_other'];

function fillRect(terrain: Uint8Array, width: number, x0: number, y0: number, x1: number, y1: number, tile: number) {
  for (const c of rasterRect(x0, y0, x1, y1, false)) {
    if (inBounds(c.x, c.y, width, HEIGHT)) terrain[idx(c.x, c.y, width)] = tile;
  }
}

export function createSyntheticExampleProject(): Project {
  const project = createBlankProject('SYNTHETIC EXAMPLE, NOT THE REAL MANDI', WIDTH, HEIGHT);
  project.meta.isSyntheticExample = true;
  const layout = project.baseline;
  const terrain = layout.terrain;

  // Perimeter wall
  fillRect(terrain, WIDTH, 0, 0, WIDTH - 1, 0, TileId.Wall);
  fillRect(terrain, WIDTH, 0, HEIGHT - 1, WIDTH - 1, HEIGHT - 1, TileId.Wall);
  fillRect(terrain, WIDTH, 0, 0, 0, HEIGHT - 1, TileId.Wall);
  fillRect(terrain, WIDTH, WIDTH - 1, 0, WIDTH - 1, HEIGHT - 1, TileId.Wall);

  // 2 main horizontal aisles + 3 cross aisles
  const hAisles = [
    [24, 28],
    [50, 54],
  ];
  const vAisles = [
    [18, 21],
    [58, 61],
    [98, 101],
  ];
  for (const [y0, y1] of hAisles) fillRect(terrain, WIDTH, 1, y0, WIDTH - 2, y1, TileId.Path);
  for (const [x0, x1] of vAisles) fillRect(terrain, WIDTH, x0, 1, x1, HEIGHT - 2, TileId.Path);

  // Bands (y ranges) between/around the horizontal aisles, each with an
  // internal walking lane and two facing rows of stalls.
  const bands: { y0: number; y1: number; laneY0: number; laneY1: number }[] = [
    { y0: 2, y1: 23, laneY0: 11, laneY1: 13 },
    { y0: 29, y1: 49, laneY0: 37, laneY1: 39 },
    { y0: 55, y1: 78, laneY0: 64, laneY1: 66 },
  ];
  const xBlocks: [number, number][] = [
    [2, 17],
    [22, 57],
    [62, 97],
    [102, 117],
  ];

  for (const { laneY0, laneY1 } of bands) fillRect(terrain, WIDTH, 1, laneY0, WIDTH - 2, laneY1, TileId.Path);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  let stallCount = 0;
  const STALL_TARGET = 40;
  const stallW = 4;
  const stallH = 3;
  const overflowCells: { x: number; y: number }[] = [];

  // Candidate stall slots, grouped per (band, side) so stalls end up spread
  // across all three bands and both facing rows (round-robin below), rather
  // than filling one row before ever reaching the next.
  const slotsByBand: { x: number; y: number; frontEdge: 'N' | 'S' }[][] = [];
  for (const band of bands) {
    for (const side of ['above', 'below'] as const) {
      const rowY = side === 'above' ? band.laneY0 - 1 - stallH : band.laneY1 + 1;
      if (rowY < band.y0 || rowY + stallH - 1 > band.y1) continue;
      const slots: { x: number; y: number; frontEdge: 'N' | 'S' }[] = [];
      for (const [bx0, bx1] of xBlocks) {
        for (let x = bx0; x + stallW - 1 <= bx1; x += stallW + 1) {
          slots.push({ x, y: rowY, frontEdge: side === 'above' ? 'S' : 'N' });
        }
      }
      slotsByBand.push(slots);
    }
  }

  let bandCursor = 0;
  const bandIndex = slotsByBand.map(() => 0);
  const bandDone = slotsByBand.map(() => false);
  while (stallCount < STALL_TARGET && bandDone.some((d) => !d)) {
    const slots = slotsByBand[bandCursor];
    const i = bandIndex[bandCursor];
    if (i >= slots.length) {
      bandDone[bandCursor] = true;
    } else {
      bandIndex[bandCursor]++;
      const slot = slots[i];
      const produce = PRODUCE_CYCLE[stallCount % PRODUCE_CYCLE.length];
      const sellerType = stallCount % 10 < 7 ? 'farmer' : stallCount % 10 < 9 ? 'reseller' : 'unknown';
      const stall = makeStall(nextId++, slot.x, slot.y, stallW, stallH, slot.frontEdge, produce, sellerType);
      objects.push(stall);
      for (const c of stall.cells) terrain[idx(c.x, c.y, WIDTH)] = TileId.StallBody;
      stallCount++;
      if (stallCount % 5 === 0) {
        // partial overflow only, so the stall stays reachable — this is how
        // the field observation "effective aisle narrower than nominal" gets encoded
        const partial = Math.max(0, Math.min(1, stall.frontCells.length - 2));
        for (const c of stall.frontCells.slice(0, partial)) overflowCells.push(c);
      }
    }
    bandCursor = (bandCursor + 1) % slotsByBand.length;
  }

  for (const c of overflowCells) {
    if (inBounds(c.x, c.y, WIDTH, HEIGHT) && terrain[idx(c.x, c.y, WIDTH)] === TileId.OpenGround) {
      terrain[idx(c.x, c.y, WIDTH)] = TileId.GoodsOverflow;
    }
  }

  // Entrances: one main (bottom wall), one side (left wall), one exit (top wall)
  const mainEntrance: Entrance = {
    kind: 'entrance',
    id: nextId++,
    cells: cellsAlong(HEIGHT - 1, 58, 61, 'h'),
    type: 'ped_in',
    weight: assumed(0.6, 'frac'),
    label: 'Main entrance',
  };
  const sideEntrance: Entrance = {
    kind: 'entrance',
    id: nextId++,
    cells: cellsAlong(0, 37, 40, 'v'),
    type: 'ped_in',
    weight: assumed(0.4, 'frac'),
    label: 'Side entrance',
  };
  const exit: Entrance = {
    kind: 'entrance',
    id: nextId++,
    cells: cellsAlong(0, 58, 61, 'h'),
    type: 'ped_out',
    weight: assumed(1.0, 'frac'),
    label: 'Exit',
  };
  const vehicleEntrance: Entrance = {
    kind: 'entrance',
    id: nextId++,
    cells: cellsAlong(WIDTH - 1, 37, 40, 'v'),
    type: 'veh_both',
    weight: assumed(1.0, 'frac'),
    label: 'Vehicle gate',
  };
  for (const e of [mainEntrance, sideEntrance, exit, vehicleEntrance]) {
    objects.push(e);
    for (const c of e.cells) terrain[idx(c.x, c.y, WIDTH)] = TileId.Entrance;
  }

  // 4 vehicle bays near the vehicle gate
  for (let i = 0; i < 4; i++) {
    const bx0 = WIDTH - 8;
    const by0 = 34 + i * 5;
    const bay: VehicleBay = {
      kind: 'vehicle_bay',
      id: nextId++,
      cells: rasterRect(bx0, by0, bx0 + 1, by0 + 3, false),
      vehicleType: 'handcart',
      label: `Bay ${i + 1}`,
    };
    objects.push(bay);
    for (const c of bay.cells) terrain[idx(c.x, c.y, WIDTH)] = TileId.VehicleBay;
  }

  // 1 waste point, 1 water point
  const wastePoint: WastePoint = { kind: 'waste_point', id: nextId++, cell: { x: 4, y: 4 }, label: 'Waste point' };
  const waterPoint: WaterPoint = { kind: 'water_point', id: nextId++, cell: { x: 8, y: 4 }, label: 'Water point' };
  objects.push(wastePoint, waterPoint);
  terrain[idx(wastePoint.cell.x, wastePoint.cell.y, WIDTH)] = TileId.WastePoint;
  terrain[idx(waterPoint.cell.x, waterPoint.cell.y, WIDTH)] = TileId.WaterPoint;

  layout.objects = objects;
  rebuildObjectLayer(layout, WIDTH, HEIGHT);

  return project;
}

function cellsAlong(fixed: number, a0: number, a1: number, axis: 'h' | 'v'): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  if (axis === 'h') {
    for (let x = a0; x <= a1; x++) cells.push({ x, y: fixed });
  } else {
    for (let y = a0; y <= a1; y++) cells.push({ x: fixed, y });
  }
  return cells;
}

function makeStall(id: number, x0: number, y0: number, w: number, h: number, frontEdge: 'N' | 'S' | 'E' | 'W', produce: ProduceCategory, sellerType: 'farmer' | 'reseller' | 'unknown'): Stall {
  const cells = rasterRect(x0, y0, x0 + w - 1, y0 + h - 1, false);
  const frontCells =
    frontEdge === 'N'
      ? cellsAlong(y0 - 1, x0, x0 + w - 1, 'h')
      : frontEdge === 'S'
        ? cellsAlong(y0 + h, x0, x0 + w - 1, 'h')
        : frontEdge === 'E'
          ? cellsAlong(x0 + w, y0, y0 + h - 1, 'v')
          : cellsAlong(x0 - 1, y0, y0 + h - 1, 'v');
  const frontLenM = frontCells.length * 0.5;
  return {
    kind: 'stall',
    id,
    cells,
    frontEdge,
    frontCells,
    produce: [produce],
    sellerType,
    attractiveness: assumed(1.0, ''),
    maxConcurrentCustomers: Math.max(1, Math.ceil(frontLenM / 1.0)),
    shaded: id % 4 === 0,
    locked: false,
    label: `Stall ${id}`,
  };
}
