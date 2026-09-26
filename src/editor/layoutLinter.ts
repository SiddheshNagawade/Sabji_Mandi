// Layout linter (SPEC.md section 7.9). Runs entirely on the baseline layout.
//
// Not yet implemented (deferred to the milestone that introduces the model
// they depend on, and noted as such rather than silently skipped):
//   - "Vehicle bay unreachable by its vehicle type" needs the per-vehicle
//     passable mask from section 9.4, built in M4.
//   - "Intervention edits a locked cell" needs interventions, built in M5.

import type { Entrance, Layout, Stall, XY } from '../data/schema';
import { FLOW_DIRS, TileId } from '../data/schema';
import { idx, inBounds } from './grid';
import { canStep, isWalkable, reachabilityFrom } from './walkable';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintWarning {
  id: string;
  severity: LintSeverity;
  message: string;
  cells: XY[];
}

export function computeLintWarnings(layout: Layout, width: number, height: number): LintWarning[] {
  const out: LintWarning[] = [];
  const entrances = layout.objects.filter((o): o is Entrance => o.kind === 'entrance');
  const stalls = layout.objects.filter((o): o is Stall => o.kind === 'stall');

  const inCells = entrances.filter((e) => e.type === 'ped_in' || e.type === 'ped_both').flatMap((e) => e.cells);
  const outCells = entrances.filter((e) => e.type === 'ped_out' || e.type === 'ped_both').flatMap((e) => e.cells);

  // 1. No pedestrian entrance / exit
  if (inCells.length === 0) {
    out.push({ id: 'no-entrance', severity: 'error', message: 'No pedestrian entrance is defined.', cells: [] });
  }
  if (outCells.length === 0) {
    out.push({ id: 'no-exit', severity: 'error', message: 'No pedestrian exit is defined.', cells: [] });
  }

  // 3. Entrance/exit cell blocked or enclosed
  for (const e of entrances) {
    const blocked = e.cells.filter((c) => !isWalkable(layout, idx(c.x, c.y, width)));
    if (blocked.length > 0) {
      out.push({ id: `entrance-blocked-${e.id}`, severity: 'error', message: `Entrance "${e.label ?? e.id}" has ${blocked.length} blocked cell(s).`, cells: blocked });
      continue;
    }
    const starts = e.cells.map((c) => idx(c.x, c.y, width));
    const reached = reachabilityFrom(layout, width, height, starts, true);
    let reachedCount = 0;
    for (const v of reached) reachedCount += v;
    if (reachedCount <= e.cells.length) {
      out.push({ id: `entrance-enclosed-${e.id}`, severity: 'error', message: `Entrance "${e.label ?? e.id}" is enclosed — no walkable cell around it.`, cells: e.cells });
    }
  }

  // 7. Two entrances overlap
  for (let a = 0; a < entrances.length; a++) {
    for (let b = a + 1; b < entrances.length; b++) {
      const setB = new Set(entrances[b].cells.map((c) => `${c.x},${c.y}`));
      const overlap = entrances[a].cells.filter((c) => setB.has(`${c.x},${c.y}`));
      if (overlap.length > 0) {
        out.push({
          id: `entrance-overlap-${entrances[a].id}-${entrances[b].id}`,
          severity: 'warning',
          message: `Entrances "${entrances[a].label ?? entrances[a].id}" and "${entrances[b].label ?? entrances[b].id}" overlap.`,
          cells: overlap,
        });
      }
    }
  }

  // 2. Stall not reachable from any entrance
  if (inCells.length > 0) {
    const reached = reachabilityFrom(
      layout,
      width,
      height,
      inCells.map((c) => idx(c.x, c.y, width)),
      true,
    );
    for (const s of stalls) {
      const reachableFront = s.frontCells.some((c) => inBounds(c.x, c.y, width, height) && reached[idx(c.x, c.y, width)]);
      if (!reachableFront) {
        out.push({ id: `stall-unreachable-${s.id}`, severity: 'error', message: `Stall "${s.label ?? s.id}" is not reachable from any entrance.`, cells: s.frontCells });
      }
    }
  }

  // 6. Stall front edge faces a wall
  for (const s of stalls) {
    const blockedFront = s.frontCells.filter((c) => !inBounds(c.x, c.y, width, height) || !isWalkable(layout, idx(c.x, c.y, width)));
    if (blockedFront.length > 0 && blockedFront.length === s.frontCells.length) {
      out.push({ id: `stall-front-wall-${s.id}`, severity: 'warning', message: `Stall "${s.label ?? s.id}" front edge faces a wall.`, cells: blockedFront });
    }
  }

  // 4. Arrow leads into a wall or dead end (off-grid or non-walkable target)
  const wallArrowCells: XY[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const dirCode = layout.flow[i];
      if (dirCode === 0) continue;
      if (!isWalkable(layout, i)) continue;
      const d = FLOW_DIRS[dirCode];
      const nx = x + d.x;
      const ny = y + d.y;
      if (!inBounds(nx, ny, width, height) || !isWalkable(layout, idx(nx, ny, width))) {
        wallArrowCells.push({ x, y });
      }
    }
  }
  if (wallArrowCells.length > 0) {
    out.push({
      id: 'arrow-into-wall',
      severity: 'warning',
      message: `${wallArrowCells.length} arrow cell(s) point into a wall or off the grid.`,
      cells: wallArrowCells,
    });
  }

  // 5. Arrows create pockets with no directed path to any exit (simplified closed-loop check)
  if (outCells.length > 0) {
    const exitStarts = outCells.map((c) => idx(c.x, c.y, width));
    const canReachExit = new Uint8Array(width * height);
    // reverse BFS: cell `from` can reach an exit if there is a valid forward step from `from` to some cell already known to reach an exit
    const queue = [...exitStarts];
    for (const s of exitStarts) canReachExit[s] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % width;
      const cy = Math.floor(cur / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const n = idx(nx, ny, width);
          if (canReachExit[n]) continue;
          if (canStep(layout, width, height, n, cur, true)) {
            canReachExit[n] = 1;
            queue.push(n);
          }
        }
      }
    }
    let strandedCount = 0;
    const strandedSample: XY[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y, width);
        if (isWalkable(layout, i) && !canReachExit[i]) {
          strandedCount++;
          if (strandedSample.length < 25) strandedSample.push({ x, y });
        }
      }
    }
    if (strandedCount > 0) {
      out.push({
        id: 'arrow-closed-loop',
        severity: 'warning',
        message: `${strandedCount} walkable cell(s) have no directed path to an exit given current arrows (possible closed loop).`,
        cells: strandedSample,
      });
    }
  }

  // 8. Aisle narrower than 2 cells (approximate): sample Path tiles, measure the
  // local run of walkable cells through this cell along X and Y.
  const narrowSample: XY[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (layout.terrain[i] !== TileId.Path) continue;
      const runX = walkableRun(layout, width, height, x, y, 1, 0) + walkableRun(layout, width, height, x, y, -1, 0) + 1;
      const runY = walkableRun(layout, width, height, x, y, 0, 1) + walkableRun(layout, width, height, x, y, 0, -1) + 1;
      if (Math.min(runX, runY) < 2 && narrowSample.length < 40) {
        narrowSample.push({ x, y });
      }
    }
  }
  if (narrowSample.length > 0) {
    out.push({ id: 'narrow-aisle', severity: 'info', message: `${narrowSample.length}+ path cell(s) sampled at under 2 cells wide (approximate check).`, cells: narrowSample });
  }

  return out;
}

function walkableRun(layout: Layout, width: number, height: number, x: number, y: number, dx: number, dy: number): number {
  let run = 0;
  let cx = x + dx;
  let cy = y + dy;
  while (inBounds(cx, cy, width, height) && isWalkable(layout, idx(cx, cy, width)) && run < 6) {
    run++;
    cx += dx;
    cy += dy;
  }
  return run;
}
