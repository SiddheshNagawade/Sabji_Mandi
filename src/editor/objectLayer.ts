// The `object` layer stores, per cell, a 1-based index into layout.objects
// (0 = none). Rebuilding it from scratch whenever layout.objects changes
// keeps it correct without having to track per-object cell diffs through
// add/remove/resize edits.

import type { Layout, LayoutObject } from '../data/schema';
import { idx, inBounds } from './grid';

function cellsOfObject(obj: LayoutObject): { x: number; y: number }[] {
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

export function rebuildObjectLayer(layout: Layout, width: number, height: number) {
  layout.object.fill(0);
  layout.objects.forEach((obj, i) => {
    for (const c of cellsOfObject(obj)) {
      if (!inBounds(c.x, c.y, width, height)) continue;
      layout.object[idx(c.x, c.y, width)] = i + 1;
    }
  });
}

export function objectAtCell(layout: Layout, width: number, height: number, x: number, y: number): LayoutObject | undefined {
  if (!inBounds(x, y, width, height)) return undefined;
  const v = layout.object[idx(x, y, width)];
  return v === 0 ? undefined : layout.objects[v - 1];
}
