// Flow fields (SPEC.md section 9.4): a distance-to-goal grid computed with
// Dijkstra over the reverse directed graph, so following steepest descent
// from any cell yields a valid forward path to the goal.

import { canStepPed, idx, inBounds, tileStepCost, wallProximity, NEIGHBOR_8 } from './walkable';

class MinHeap {
  private heap: { i: number; d: number }[] = [];

  push(i: number, d: number) {
    this.heap.push({ i, d });
    let c = this.heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.heap[p].d <= this.heap[c].d) break;
      [this.heap[p], this.heap[c]] = [this.heap[c], this.heap[p]];
      c = p;
    }
  }

  pop(): { i: number; d: number } | undefined {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = p * 2 + 2;
        let smallest = p;
        if (l < this.heap.length && this.heap[l].d < this.heap[smallest].d) smallest = l;
        if (r < this.heap.length && this.heap[r].d < this.heap[smallest].d) smallest = r;
        if (smallest === p) break;
        [this.heap[p], this.heap[smallest]] = [this.heap[smallest], this.heap[p]];
        p = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }
}

export interface FlowFieldGrids {
  terrain: Uint8Array;
  flow: Uint8Array;
  width: number;
  height: number;
  wallProximityPenaltyWeight: number;
  wallProximityCap?: number;
}

const wallDistCache = new WeakMap<Uint8Array, Uint8Array>();

function getWallProximity(terrain: Uint8Array, width: number, height: number, cap: number): Uint8Array {
  let cached = wallDistCache.get(terrain);
  if (!cached) {
    cached = wallProximity(terrain, width, height, cap);
    wallDistCache.set(terrain, cached);
  }
  return cached;
}

/**
 * Dijkstra over the reverse graph from `goalCells`. Returns a Float32Array
 * of distance-to-goal per cell (Infinity where unreachable).
 *
 * The working distances are kept in a Float64Array (plain JS number
 * precision) during the search itself: storing them as Float32 while
 * comparing against full-precision doubles made the "is this a stale heap
 * entry?" check (`d > dist[j]`) unreliable — a value that rounds *up* when
 * narrowed to float32 compares as "still smaller" against its own
 * full-precision self forever, so the same node never gets recognised as
 * finalized and is relaxed over and over. The result is still narrowed to
 * Float32Array at the end, matching the cache's memory budget (section 9.4).
 */
export function computeFlowField(grids: FlowFieldGrids, goalCells: number[]): Float32Array {
  const { terrain, flow, width, height, wallProximityPenaltyWeight } = grids;
  const cap = grids.wallProximityCap ?? 3;
  const n = width * height;
  const dist = new Float64Array(n).fill(Infinity);
  const wallDist = wallProximityPenaltyWeight > 0 ? getWallProximity(terrain, width, height, cap) : null;
  const heap = new MinHeap();
  for (const g of goalCells) {
    if (tileStepCost(terrain[g]) === Infinity) continue;
    if (dist[g] > 0) {
      dist[g] = 0;
      heap.push(g, 0);
    }
  }
  while (heap.size > 0) {
    const top = heap.pop();
    if (!top) break;
    const { i: j, d } = top;
    if (d > dist[j]) continue; // stale entry
    const jx = j % width;
    const jy = (j / width) | 0;
    for (const nb of NEIGHBOR_8) {
      const ix = jx + nb.x;
      const iy = jy + nb.y;
      if (!inBounds(ix, iy, width, height)) continue;
      const i = idx(ix, iy, width);
      // forward edge i -> j must be valid for this to help someone standing at i
      if (!canStepPed(terrain, flow, width, height, i, j, true)) continue;
      const stepLen = nb.diag ? Math.SQRT2 : 1;
      let cost = tileStepCost(terrain[j]) * stepLen;
      if (wallDist) cost += wallProximityPenaltyWeight * (cap - wallDist[j]);
      const nd = d + cost;
      if (nd < dist[i]) {
        dist[i] = nd;
        heap.push(i, nd);
      }
    }
  }
  return Float32Array.from(dist);
}

export interface FlowFieldCacheKey {
  goalId: string;
  obeysArrows: boolean;
}

export class FlowFieldCache {
  private fields = new Map<string, Float32Array>();
  private grids: FlowFieldGrids;

  constructor(grids: FlowFieldGrids) {
    this.grids = grids;
  }

  private keyFor(key: FlowFieldCacheKey): string {
    return `${key.goalId}|${key.obeysArrows ? 1 : 0}`;
  }

  get(key: FlowFieldCacheKey, goalCells: number[]): Float32Array {
    const k = this.keyFor(key);
    let field = this.fields.get(k);
    if (!field) {
      // obeysArrows=false is approximated by zeroing the flow layer for this computation
      const grids = key.obeysArrows ? this.grids : { ...this.grids, flow: new Uint8Array(this.grids.flow.length) };
      field = computeFlowField(grids, goalCells);
      this.fields.set(k, field);
    }
    return field;
  }

  clear() {
    this.fields.clear();
  }

  /** Swaps in new terrain/flow (e.g. after a phase change) and drops every cached field, which was computed against the old ones. */
  updateGrids(grids: FlowFieldGrids) {
    this.grids = grids;
    this.clear();
  }
}
