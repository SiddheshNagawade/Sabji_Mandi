// Pure grid math shared by the editor tools and the layout linter.
// No DOM, no React — keeps this reusable from tests too.

import type { XY } from '../data/schema';

export function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export const NEIGHBOR_8: XY[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

export const NEIGHBOR_4: XY[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Bresenham line, inclusive of both endpoints. */
export function rasterLine(x0: number, y0: number, x1: number, y1: number): XY[] {
  const pts: XY[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return pts;
}

/** Cells inside (or on the outline of) a rectangle in cell coordinates. */
export function rasterRect(x0: number, y0: number, x1: number, y1: number, outlineOnly: boolean): XY[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const pts: XY[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!outlineOnly || x === minX || x === maxX || y === minY || y === maxY) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

/** Expands a set of points by `size - 1` in a square brush (size = 1..5). */
export function applyBrushSize(points: XY[], size: number): XY[] {
  if (size <= 1) return points;
  const r = Math.floor((size - 1) / 2);
  const seen = new Set<string>();
  const out: XY[] = [];
  for (const p of points) {
    for (let dy = -r; dy <= size - 1 - r; dy++) {
      for (let dx = -r; dx <= size - 1 - r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        const key = `${x},${y}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ x, y });
        }
      }
    }
  }
  return out;
}

/** Quantize a direction vector to the nearest of 8 compass directions (1..8, see schema FLOW_DIRS). */
export function quantizeDirection(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const angle = Math.atan2(dy, dx); // -PI..PI, 0 = east
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  // 8 sectors of 45deg, starting at E=0
  const sector = Math.round(deg / 45) % 8;
  // sector 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE (screen y-down)
  const map = [3, 4, 5, 6, 7, 8, 1, 2];
  return map[sector];
}

export function floodFillIndices(
  startX: number,
  startY: number,
  width: number,
  height: number,
  matches: (i: number) => boolean,
): number[] {
  const startI = idx(startX, startY, width);
  if (!matches(startI)) return [];
  const visited = new Uint8Array(width * height);
  const stack = [startI];
  visited[startI] = 1;
  const out: number[] = [];
  while (stack.length) {
    const i = stack.pop() as number;
    out.push(i);
    const x = i % width;
    const y = Math.floor(i / width);
    for (const n of NEIGHBOR_4) {
      const nx = x + n.x;
      const ny = y + n.y;
      if (!inBounds(nx, ny, width, height)) continue;
      const ni = idx(nx, ny, width);
      if (visited[ni]) continue;
      if (!matches(ni)) continue;
      visited[ni] = 1;
      stack.push(ni);
    }
  }
  return out;
}

export function bfsReachable(width: number, height: number, starts: number[], canStep: (from: number, to: number) => boolean): Uint8Array {
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  for (const s of starts) {
    if (!reached[s]) {
      reached[s] = 1;
      queue.push(s);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = Math.floor(i / width);
    for (const n of NEIGHBOR_8) {
      const nx = x + n.x;
      const ny = y + n.y;
      if (!inBounds(nx, ny, width, height)) continue;
      const ni = idx(nx, ny, width);
      if (reached[ni]) continue;
      if (!canStep(i, ni)) continue;
      reached[ni] = 1;
      queue.push(ni);
    }
  }
  return reached;
}
