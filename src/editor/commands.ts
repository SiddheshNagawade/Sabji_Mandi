// Builders that turn a tool gesture into an EditorCommand (a cell patch plus
// its inverse, and optionally an objects-table before/after pair) so every
// stroke is exactly one undoable command, per SPEC.md section 7.2/7.8.

import type { Barrier, CellChange, Dir4, Entrance, EntranceType, Layout, LayoutObject, ProduceCategory, Stall, Transect, VehicleBay, VehicleType, XY } from '../data/schema';
import { TileId, assumed } from '../data/schema';
import type { EditorCommand, LayerName } from '../app/store';
import { idx, inBounds, rasterRect } from './grid';

export function buildMultiValuePaintCommand(layout: Layout, width: number, height: number, cells: { x: number; y: number; value: number }[], layer: LayerName, label: string): EditorCommand | null {
  const seen = new Set<number>();
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  const arr = layout[layer] as Uint8Array | Uint16Array;
  for (const c of cells) {
    if (!inBounds(c.x, c.y, width, height)) continue;
    const i = idx(c.x, c.y, width);
    if (seen.has(i)) continue;
    seen.add(i);
    const oldValue = arr[i];
    if (oldValue === c.value) continue;
    patch.push({ x: c.x, y: c.y, layer, value: c.value });
    inverse.push({ x: c.x, y: c.y, layer, value: oldValue });
  }
  if (patch.length === 0) return null;
  return { label, patch, inverse };
}

export function buildPaintCommand(layout: Layout, width: number, height: number, cells: XY[], layer: LayerName, value: number, label: string): EditorCommand | null {
  const seen = new Set<number>();
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  const arr = layout[layer] as Uint8Array | Uint16Array;
  for (const c of cells) {
    if (!inBounds(c.x, c.y, width, height)) continue;
    const i = idx(c.x, c.y, width);
    if (seen.has(i)) continue;
    seen.add(i);
    const oldValue = arr[i];
    if (oldValue === value) continue;
    patch.push({ x: c.x, y: c.y, layer, value });
    inverse.push({ x: c.x, y: c.y, layer, value: oldValue });
  }
  if (patch.length === 0) return null;
  return { label, patch, inverse };
}

function frontCellsFor(x0: number, y0: number, w: number, h: number, frontEdge: Dir4): XY[] {
  const cells: XY[] = [];
  if (frontEdge === 'N') {
    for (let x = x0; x < x0 + w; x++) cells.push({ x, y: y0 - 1 });
  } else if (frontEdge === 'S') {
    for (let x = x0; x < x0 + w; x++) cells.push({ x, y: y0 + h });
  } else if (frontEdge === 'E') {
    for (let y = y0; y < y0 + h; y++) cells.push({ x: x0 + w, y });
  } else {
    for (let y = y0; y < y0 + h; y++) cells.push({ x: x0 - 1, y });
  }
  return cells;
}

export function buildAddStallCommand(
  layout: Layout,
  width: number,
  height: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  frontEdge: Dir4,
  produce: ProduceCategory[],
  nextId: number,
): EditorCommand {
  const cells = rasterRect(x0, y0, x0 + w - 1, y0 + h - 1, false).filter((c) => inBounds(c.x, c.y, width, height));
  const frontCells = frontCellsFor(x0, y0, w, h, frontEdge).filter((c) => inBounds(c.x, c.y, width, height));
  const frontLenM = frontCells.length * 0.5;
  const stall: Stall = {
    kind: 'stall',
    id: nextId,
    cells,
    frontEdge,
    frontCells,
    produce,
    sellerType: 'unknown',
    attractiveness: assumed(1.0, ''),
    maxConcurrentCustomers: Math.max(1, Math.ceil(frontLenM / 1.0)),
    shaded: false,
    locked: false,
    label: `Stall ${nextId}`,
  };
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  for (const c of cells) {
    const i = idx(c.x, c.y, width);
    if (layout.terrain[i] === TileId.StallBody) continue;
    patch.push({ x: c.x, y: c.y, layer: 'terrain', value: TileId.StallBody });
    inverse.push({ x: c.x, y: c.y, layer: 'terrain', value: layout.terrain[i] });
  }
  return {
    label: 'Add stall',
    patch,
    inverse,
    objectsBefore: layout.objects,
    objectsAfter: [...layout.objects, stall],
  };
}

export function buildAddEntranceCommand(layout: Layout, width: number, height: number, cells: XY[], type: EntranceType, nextId: number): EditorCommand {
  const valid = cells.filter((c) => inBounds(c.x, c.y, width, height));
  const entrance: Entrance = {
    kind: 'entrance',
    id: nextId,
    cells: valid,
    type,
    weight: assumed(1.0, 'frac'),
    label: `Entrance ${nextId}`,
  };
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  for (const c of valid) {
    const i = idx(c.x, c.y, width);
    if (layout.terrain[i] === TileId.Entrance) continue;
    patch.push({ x: c.x, y: c.y, layer: 'terrain', value: TileId.Entrance });
    inverse.push({ x: c.x, y: c.y, layer: 'terrain', value: layout.terrain[i] });
  }
  return {
    label: 'Add entrance',
    patch,
    inverse,
    objectsBefore: layout.objects,
    objectsAfter: [...layout.objects, entrance],
  };
}

export function buildAddBarrierCommand(layout: Layout, width: number, height: number, cells: XY[], nextId: number): EditorCommand {
  const valid = cells.filter((c) => inBounds(c.x, c.y, width, height));
  const barrier: Barrier = { kind: 'barrier', id: nextId, cells: valid, label: `Barrier ${nextId}` };
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  for (const c of valid) {
    const i = idx(c.x, c.y, width);
    if (layout.terrain[i] === TileId.Barrier) continue;
    patch.push({ x: c.x, y: c.y, layer: 'terrain', value: TileId.Barrier });
    inverse.push({ x: c.x, y: c.y, layer: 'terrain', value: layout.terrain[i] });
  }
  return { label: 'Add barrier', patch, inverse, objectsBefore: layout.objects, objectsAfter: [...layout.objects, barrier] };
}

export function buildAddVehicleBayCommand(layout: Layout, width: number, height: number, x0: number, y0: number, w: number, h: number, vehicleType: VehicleType, nextId: number): EditorCommand {
  const cells = rasterRect(x0, y0, x0 + w - 1, y0 + h - 1, false).filter((c) => inBounds(c.x, c.y, width, height));
  const bay: VehicleBay = { kind: 'vehicle_bay', id: nextId, cells, vehicleType, label: `Bay ${nextId}` };
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  for (const c of cells) {
    const i = idx(c.x, c.y, width);
    if (layout.terrain[i] === TileId.VehicleBay) continue;
    patch.push({ x: c.x, y: c.y, layer: 'terrain', value: TileId.VehicleBay });
    inverse.push({ x: c.x, y: c.y, layer: 'terrain', value: layout.terrain[i] });
  }
  return { label: 'Add vehicle bay', patch, inverse, objectsBefore: layout.objects, objectsAfter: [...layout.objects, bay] };
}

export function buildAddTransectCommand(layout: Layout, a: XY, b: XY, nextId: number): EditorCommand {
  const transect: Transect = { kind: 'transect', id: nextId, a, b, label: `Transect ${nextId}` };
  return { label: 'Add transect', patch: [], inverse: [], objectsBefore: layout.objects, objectsAfter: [...layout.objects, transect] };
}

export function buildDeleteObjectCommand(layout: Layout, width: number, height: number, objectId: number): EditorCommand | null {
  const obj = layout.objects.find((o) => o.id === objectId);
  if (!obj) return null;
  const cells = cellsOfForDelete(obj);
  const patch: CellChange[] = [];
  const inverse: CellChange[] = [];
  for (const c of cells) {
    if (!inBounds(c.x, c.y, width, height)) continue;
    const i = idx(c.x, c.y, width);
    patch.push({ x: c.x, y: c.y, layer: 'terrain', value: TileId.OpenGround });
    inverse.push({ x: c.x, y: c.y, layer: 'terrain', value: layout.terrain[i] });
  }
  return {
    label: 'Delete object',
    patch,
    inverse,
    objectsBefore: layout.objects,
    objectsAfter: layout.objects.filter((o) => o.id !== objectId),
  };
}

function cellsOfForDelete(obj: LayoutObject): XY[] {
  switch (obj.kind) {
    case 'stall':
    case 'entrance':
    case 'vehicle_bay':
    case 'barrier':
      return obj.cells;
    case 'waste_point':
    case 'water_point':
    case 'sign':
    case 'label':
      return [obj.cell];
    case 'transect':
      return [];
  }
}

export function buildUpdateObjectCommand(layout: Layout, objectId: number, updater: (obj: LayoutObject) => LayoutObject): EditorCommand | null {
  const idx2 = layout.objects.findIndex((o) => o.id === objectId);
  if (idx2 === -1) return null;
  const before = layout.objects;
  const after = layout.objects.slice();
  after[idx2] = updater(after[idx2]);
  return { label: 'Edit object', patch: [], inverse: [], objectsBefore: before, objectsAfter: after };
}

export function nextObjectId(layout: Layout): number {
  return layout.objects.reduce((max, o) => Math.max(max, o.id), 0) + 1;
}
