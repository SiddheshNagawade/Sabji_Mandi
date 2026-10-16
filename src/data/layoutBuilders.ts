// Small shared helpers for programmatically building a Layout — terrain
// lines/rects, stalls (straight-rectangular and diagonal-staircase), and
// entrances. Used by both the small hand-built demos (demoProjects.ts) and
// the larger real-world-traced markets (mandiProjects.ts).

import type { Dir4, Entrance, LayoutObject, ProduceCategory, Stall, XY } from './schema';
import { TileId, assumed } from './schema';
import { idx, inBounds, rasterLine, rasterRect, applyBrushSize } from '../editor/grid';

export function hLine(terrain: Uint8Array, width: number, height: number, y: number, x0: number, x1: number, tile: number) {
  for (const c of rasterRect(x0, y, x1, y, false)) if (inBounds(c.x, c.y, width, height)) terrain[idx(c.x, c.y, width)] = tile;
}
export function vLine(terrain: Uint8Array, width: number, height: number, x: number, y0: number, y1: number, tile: number) {
  for (const c of rasterRect(x, y0, x, y1, false)) if (inBounds(c.x, c.y, width, height)) terrain[idx(c.x, c.y, width)] = tile;
}
export function fillRect(terrain: Uint8Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number, tile: number) {
  for (const c of rasterRect(x0, y0, x1, y1, false)) if (inBounds(c.x, c.y, width, height)) terrain[idx(c.x, c.y, width)] = tile;
}
export function cellsAlong(fixed: number, a0: number, a1: number, axis: 'h' | 'v'): XY[] {
  const cells: XY[] = [];
  if (axis === 'h') for (let x = a0; x <= a1; x++) cells.push({ x, y: fixed });
  else for (let y = a0; y <= a1; y++) cells.push({ x: fixed, y });
  return cells;
}
export function perimeterWalls(terrain: Uint8Array, width: number, height: number) {
  hLine(terrain, width, height, 0, 0, width - 1, TileId.Wall);
  hLine(terrain, width, height, height - 1, 0, width - 1, TileId.Wall);
  vLine(terrain, width, height, 0, 0, height - 1, TileId.Wall);
  vLine(terrain, width, height, width - 1, 0, height - 1, TileId.Wall);
}

/**
 * Staircase-cuts a corner of the grid (pixel-art approximation of a rounded
 * or angled boundary): walls off an ever-shrinking strip, one cell shorter
 * each row/column, so the corner reads as a diagonal rather than a hard
 * right angle. `corner` says which corner it's cutting.
 */
export function staircaseCutCorner(terrain: Uint8Array, width: number, height: number, corner: 'NE' | 'NW' | 'SE' | 'SW', depth: number, tile: number) {
  for (let i = 0; i < depth; i++) {
    const run = depth - i;
    if (corner === 'NE') fillRect(terrain, width, height, width - 1 - run, i, width - 1, i, tile);
    else if (corner === 'NW') fillRect(terrain, width, height, 0, i, run, i, tile);
    else if (corner === 'SE') fillRect(terrain, width, height, width - 1 - run, height - 1 - i, width - 1, height - 1 - i, tile);
    else fillRect(terrain, width, height, 0, height - 1 - i, run, height - 1 - i, tile);
  }
}

export const PRODUCE: ProduceCategory[] = ['leafy', 'root_tuber', 'fruit_veg', 'gourd_beans', 'herbs_spices', 'fruit', 'mixed_other'];

export function makeStall(id: number, x0: number, y0: number, w: number, h: number, frontEdge: Dir4, produce: ProduceCategory, cellSizeM: number): Stall {
  const cells = rasterRect(x0, y0, x0 + w - 1, y0 + h - 1, false);
  const frontCells =
    frontEdge === 'N'
      ? cellsAlong(y0 - 1, x0, x0 + w - 1, 'h')
      : frontEdge === 'S'
        ? cellsAlong(y0 + h, x0, x0 + w - 1, 'h')
        : frontEdge === 'E'
          ? cellsAlong(x0 + w, y0, y0 + h - 1, 'v')
          : cellsAlong(x0 - 1, y0, y0 + h - 1, 'v');
  const frontLenM = frontCells.length * cellSizeM;
  return {
    kind: 'stall',
    id,
    cells,
    frontEdge,
    frontCells,
    produce: [produce],
    sellerType: 'farmer',
    attractiveness: assumed(1.0, ''),
    maxConcurrentCustomers: Math.max(1, Math.ceil(frontLenM)),
    shaded: false,
    locked: false,
    label: `Stall ${id}`,
  };
}

/**
 * A stall shaped like a thickened diagonal line (a Bresenham staircase,
 * the "pixelated diagonal" approximation of an angled stall or shed rib)
 * rather than an axis-aligned rectangle. `frontSide` picks which of the
 * line's two perpendicular sides the buyer-facing front sits on.
 */
export function makeDiagonalStall(id: number, x0: number, y0: number, x1: number, y1: number, thickness: number, frontSide: 1 | -1, produce: ProduceCategory, cellSizeM: number): Stall {
  const line = rasterLine(x0, y0, x1, y1);
  const cells = applyBrushSize(line, thickness);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * frontSide;
  const py = ux * frontSide;
  const frontOffset = Math.ceil(thickness / 2) + 1;
  const seen = new Set<string>();
  const frontCells: XY[] = [];
  for (const c of line) {
    const fx = Math.round(c.x + px * frontOffset);
    const fy = Math.round(c.y + py * frontOffset);
    const key = `${fx},${fy}`;
    if (!seen.has(key)) {
      seen.add(key);
      frontCells.push({ x: fx, y: fy });
    }
  }
  const frontEdge: Dir4 = Math.abs(px) > Math.abs(py) ? (px > 0 ? 'E' : 'W') : py > 0 ? 'S' : 'N';
  const frontLenM = frontCells.length * cellSizeM;
  return {
    kind: 'stall',
    id,
    cells,
    frontEdge,
    frontCells,
    produce: [produce],
    sellerType: 'farmer',
    attractiveness: assumed(1.0, ''),
    maxConcurrentCustomers: Math.max(1, Math.ceil(frontLenM)),
    shaded: false,
    locked: false,
    label: `Stall ${id}`,
  };
}

export function placeStall(objects: LayoutObject[], terrain: Uint8Array, width: number, height: number, stall: Stall) {
  objects.push(stall);
  for (const c of stall.cells) if (inBounds(c.x, c.y, width, height)) terrain[idx(c.x, c.y, width)] = TileId.StallBody;
}
export function placeEntrance(objects: LayoutObject[], terrain: Uint8Array, width: number, height: number, entrance: Entrance) {
  objects.push(entrance);
  for (const c of entrance.cells) if (inBounds(c.x, c.y, width, height)) terrain[idx(c.x, c.y, width)] = TileId.Entrance;
}
