// Directed walkable graph for the simulation engine (SPEC.md sections 6.4,
// 7.3, 9.4). Deliberately self-contained (no imports from src/editor) so
// src/sim/core stays pure and independently testable/worker-safe.

import { FLOW_DIRS, TILE_INFO } from '../../data/schema';

export function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function tileStepCost(terrainId: number): number {
  const info = TILE_INFO[terrainId];
  if (!info || !info.walkable || info.speedFactor <= 0) return Infinity;
  return 1 / info.speedFactor;
}

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/**
 * Whether a pedestrian may step from cell i to adjacent cell j.
 * `terrain`/`flow` are the layers of the layout the field is being built
 * for (post barrier/phase resolution, done by the caller).
 */
export function canStepPed(terrain: Uint8Array, flow: Uint8Array, width: number, height: number, i: number, j: number, obeysArrows: boolean): boolean {
  if (tileStepCost(terrain[j]) === Infinity) return false;
  const ix = i % width;
  const iy = (i / width) | 0;
  const jx = j % width;
  const jy = (j / width) | 0;
  const dx = jx - ix;
  const dy = jy - iy;
  if (dx !== 0 && dy !== 0) {
    const ax = ix + dx;
    const ay = iy;
    const bx = ix;
    const by = iy + dy;
    if (!inBounds(ax, ay, width, height) || !inBounds(bx, by, width, height)) return false;
    if (tileStepCost(terrain[idx(ax, ay, width)]) === Infinity || tileStepCost(terrain[idx(bx, by, width)]) === Infinity) return false;
  }
  if (obeysArrows) {
    const fi = flow[i];
    if (fi !== 0) {
      const d = FLOW_DIRS[fi];
      if (dot(d.x, d.y, dx, dy) < 0) return false;
    }
    const fj = flow[j];
    if (fj !== 0) {
      const d = FLOW_DIRS[fj];
      if (dot(d.x, d.y, dx, dy) < 0) return false;
    }
  }
  return true;
}

export const NEIGHBOR_8: { x: number; y: number; diag: boolean }[] = [
  { x: 0, y: -1, diag: false },
  { x: 1, y: -1, diag: true },
  { x: 1, y: 0, diag: false },
  { x: 1, y: 1, diag: true },
  { x: 0, y: 1, diag: false },
  { x: -1, y: 1, diag: true },
  { x: -1, y: 0, diag: false },
  { x: -1, y: -1, diag: true },
];

/** Multi-source BFS distance to the nearest non-walkable cell, capped at `cap`. */
export function wallProximity(terrain: Uint8Array, width: number, height: number, cap: number): Uint8Array {
  const n = width * height;
  const dist = new Uint8Array(n).fill(cap);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (tileStepCost(terrain[i]) === Infinity) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= cap) continue;
    const x = i % width;
    const y = (i / width) | 0;
    for (const n8 of NEIGHBOR_8) {
      if (n8.diag) continue;
      const nx = x + n8.x;
      const ny = y + n8.y;
      if (!inBounds(nx, ny, width, height)) continue;
      const ni = idx(nx, ny, width);
      if (dist[ni] > d + 1) {
        dist[ni] = d + 1;
        queue.push(ni);
      }
    }
  }
  return dist;
}
