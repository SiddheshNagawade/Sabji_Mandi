// Editor-time walkable graph (SPEC.md section 6.4 / 7.3), used by the layout
// linter. The simulation engine (M2) builds its own arrow/phase/vehicle-aware
// version of this at run time; this copy is deliberately simple and static.

import type { Layout } from '../data/schema';
import { FLOW_DIRS, TILE_INFO } from '../data/schema';
import { bfsReachable, idx, inBounds } from './grid';

export function isWalkable(layout: Layout, i: number): boolean {
  return TILE_INFO[layout.terrain[i]]?.walkable ?? false;
}

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** Whether a step from cell i to adjacent cell j is allowed for a pedestrian. */
export function canStep(layout: Layout, width: number, height: number, i: number, j: number, obeysArrows: boolean): boolean {
  if (!isWalkable(layout, j)) return false;
  const ix = i % width;
  const iy = Math.floor(i / width);
  const jx = j % width;
  const jy = Math.floor(j / width);
  const dx = jx - ix;
  const dy = jy - iy;
  if (dx !== 0 && dy !== 0) {
    // no squeezing diagonally through a blocked corner
    const a = idx(ix + dx, iy, width);
    const b = idx(ix, iy + dy, width);
    if (!inBounds(ix + dx, iy, width, height) || !inBounds(ix, iy + dy, width, height)) return false;
    if (!isWalkable(layout, a) || !isWalkable(layout, b)) return false;
  }
  if (obeysArrows) {
    const fi = layout.flow[i];
    if (fi !== 0) {
      const d = FLOW_DIRS[fi];
      if (dot(d.x, d.y, dx, dy) < 0) return false;
    }
    const fj = layout.flow[j];
    if (fj !== 0) {
      const d = FLOW_DIRS[fj];
      if (dot(d.x, d.y, dx, dy) < 0) return false;
    }
  }
  return true;
}

export function reachabilityFrom(layout: Layout, width: number, height: number, starts: number[], obeysArrows: boolean): Uint8Array {
  return bfsReachable(width, height, starts, (from, to) => canStep(layout, width, height, from, to, obeysArrows));
}
