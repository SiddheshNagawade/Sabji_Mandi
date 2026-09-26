import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../src/data/defaults';
import type { Entrance, Project, Stall } from '../../src/data/schema';
import { assumed } from '../../src/data/schema';
import type { Buyer } from '../../src/sim/core/world';
import { World } from '../../src/sim/core/world';
import { spawnBuyers } from '../../src/sim/core/agents';
import { step } from '../../src/sim/core/tick';
import { idx } from '../../src/sim/core/walkable';

function corridorProject(width: number, height: number): Project {
  const project = createBlankProject('Corridor', width, height);
  project.demand.pedArrivalsPerBin = assumed(new Array(200).fill(0));
  return project;
}

function addEntrance(project: Project, id: number, cells: { x: number; y: number }[], type: Entrance['type']): void {
  const e: Entrance = { kind: 'entrance', id, cells, type, weight: assumed(1) };
  project.baseline.objects.push(e);
}

describe('sim core', () => {
  it('single agent crosses an empty corridor in ~length/speed seconds', () => {
    const width = 40;
    const height = 3;
    const project = corridorProject(width, height);
    addEntrance(project, 1, colCells(0, height), 'ped_in');
    addEntrance(project, 2, colCells(width - 1, height), 'ped_out');

    const world = new World(project, 1);
    spawnBuyers(world, 1);
    const buyer = Array.from(world.agents.values())[0];
    const speedMps = buyer.speedMps;
    const startX = buyer.cell % width;

    let ticks = 0;
    while (world.agents.size > 0 && ticks < 5000) {
      step(world);
      ticks++;
    }
    expect(world.agents.size).toBe(0);
    const elapsedS = ticks * project.params.tickS.value;
    const distanceM = (width - 1 - startX) * project.grid.cellSizeM.value;
    const expectedS = distanceM / speedMps;
    expect(elapsedS).toBeGreaterThan(expectedS * 0.7);
    expect(elapsedS).toBeLessThan(expectedS * 1.5);
  });

  it('an obeying agent never crosses against a one-way arrow; a non-obeying agent may', () => {
    const width = 12;
    const height = 3;
    const project = corridorProject(width, height);
    // arrow wall at x=6 pointing East, spanning the corridor's height
    for (let y = 0; y < height; y++) project.baseline.flow[y * width + 6] = 3; // East
    addEntrance(project, 1, colCells(width - 1, height), 'ped_in');
    addEntrance(project, 2, colCells(0, height), 'ped_out');

    const world = new World(project, 2);
    spawnBuyers(world, 1);
    const obeying = Array.from(world.agents.values())[0];
    obeying.obeysArrows = true;

    spawnBuyers(world, 1);
    const nonObeying = Array.from(world.agents.values()).find((b) => b.id !== obeying.id)!;
    nonObeying.obeysArrows = false;

    for (let i = 0; i < 400; i++) step(world);

    // the obeying agent must never have crossed the arrow cell westward
    const stillIn = world.agents.get(obeying.id);
    expect(stillIn).toBeDefined();
    expect(stillIn!.cell % width).toBeGreaterThanOrEqual(6);

    // the non-obeying agent should have made it through and out
    expect(world.agents.has(nonObeying.id)).toBe(false);
  });

  it('is deterministic given the same project and seed', () => {
    const width = 30;
    const height = 20;
    const buildProject = () => {
      const project = createBlankProject('Determinism', width, height);
      addEntrance(project, 1, colCells(0, height), 'ped_in');
      addEntrance(project, 2, colCells(width - 1, height), 'ped_out');
      addStall(project, 1, 10, 10, 3, 2);
      return project;
    };

    function run(): string {
      const world = new World(buildProject(), 42);
      for (let i = 0; i < 600; i++) step(world);
      const snapshot = {
        t: world.t,
        spawned: world.metrics.spawned,
        despawned: world.metrics.despawned,
        agents: Array.from(world.agents.values())
          .map((b) => ({ id: b.id, cell: b.cell, state: b.state, listIndex: b.listIndex }))
          .sort((a, b) => a.id - b.id),
      };
      return JSON.stringify(snapshot);
    }

    expect(run()).toBe(run());
  });

  it('conserves agents: spawned = despawned + still in market, at every tick', () => {
    const width = 30;
    const height = 20;
    const project = createBlankProject('Conservation', width, height);
    addEntrance(project, 1, colCells(0, height), 'ped_in');
    addEntrance(project, 2, colCells(width - 1, height), 'ped_out');
    addStall(project, 1, 15, 10, 3, 2);

    const world = new World(project, 7);
    for (let i = 0; i < 800; i++) {
      step(world);
      expect(world.metrics.spawned).toBe(world.metrics.despawned + world.agents.size);
    }
  });

  it('never serves more buyers at a stall than it has slots', () => {
    const width = 20;
    const height = 10;
    const project = createBlankProject('OneSlot', width, height);
    project.demand.pedArrivalsPerBin = assumed(new Array(200).fill(40)); // heavy arrivals
    addEntrance(project, 1, colCells(0, height), 'ped_in');
    addEntrance(project, 2, colCells(width - 1, height), 'ped_out');
    addStall(project, 1, 10, 4, 2, 2, 1); // maxConcurrentCustomers = 1

    const world = new World(project, 3);
    for (let i = 0; i < 1500; i++) {
      step(world);
      const runtime = world.stalls.get(1)!;
      expect(runtime.servedIds.size).toBeLessThanOrEqual(1);
    }
  });
  it('lets two head-on groups in a 2m corridor both get through (swap/sidestep prevent permanent deadlock)', () => {
    const width = 30;
    const height = 6;
    const bandTop = 1;
    const bandRows = 4; // the 2 m walking band; y=0 is a shoulder row used to tuck the target stalls out of the way
    const project = createBlankProject('HeadOn', width, height);
    // One dedicated 1x1 stall per row on each side, so each buyer has its own
    // target cell — this test is about surviving head-on corridor traffic,
    // not about contention for a single stall slot.
    const rows = colCellsRange(0, bandTop, bandRows).map((c) => c.y);
    for (const y of rows) {
      addStall(project, 100 + y, width - 2, y - 1, 1, 1); // frontCell = (width-2, y)
      addStall(project, 200 + y, 1, y - 1, 1, 1); // frontCell = (1, y)
    }

    const world = new World(project, 5);
    // Placed directly (rather than through an entrance) so each group's spawn
    // side and target are unambiguous and don't depend on spawnBuyers()'s
    // random gate pick.
    const westTargets = rows.map((y) => 100 + y);
    const eastTargets = rows.map((y) => 200 + y);
    rows.forEach((y, i) => placeBuyer(world, 0, y, westTargets[i]));
    rows.forEach((y, i) => placeBuyer(world, width - 1, y, eastTargets[i]));

    const allServed = () => [...westTargets, ...eastTargets].every((id) => world.stalls.get(id)!.servedCount >= 1);
    for (let i = 0; i < 6000 && !allServed(); i++) step(world);

    for (const id of westTargets) expect(world.stalls.get(id)!.servedCount).toBe(1);
    for (const id of eastTargets) expect(world.stalls.get(id)!.servedCount).toBe(1);
  });

  it('throughput through a bottleneck falls as the bottleneck narrows (monotonic)', () => {
    // Demand is injected as a fixed number of spawnBuyers() calls (deterministic
    // counts) rather than through the Poisson arrival process, so the only thing
    // that can differ between the narrow and wide runs is the bottleneck's
    // actual capacity — not incidental RNG-stream drift from differing geometry.
    function throughputFor(chokeRows: number): number {
      const width = 26;
      const height = 5;
      const project = createBlankProject('Bottleneck', width, height);
      project.demand.pedArrivalsPerBin = assumed(new Array(200).fill(0));
      addEntrance(project, 1, colCells(0, height), 'ped_in');
      addEntrance(project, 2, colCells(width - 1, height), 'ped_out');
      const chokeStart = Math.floor((height - chokeRows) / 2);
      for (let y = 0; y < height; y++) {
        if (y >= chokeStart && y < chokeStart + chokeRows) continue;
        for (const x of [12, 13]) project.baseline.terrain[y * width + x] = 2; // Wall
      }
      const world = new World(project, 9);
      for (let i = 0; i < 2500; i++) {
        if (i < 400) spawnBuyers(world, height); // keep the gate saturated during the warmup window
        step(world);
      }
      return world.metrics.despawned;
    }

    const narrow = throughputFor(1);
    const wide = throughputFor(3);
    expect(wide).toBeGreaterThan(narrow);
  });
});

/** Drops a buyer directly at (x, y) already targeting `targetStallId`, bypassing entrances/chooseTarget entirely. */
function placeBuyer(world: World, x: number, y: number, targetStallId: number): number {
  const cell = idx(x, y, world.width);
  const id = world.nextAgentId++;
  const buyer: Buyer = {
    id,
    kind: 'buyer',
    state: 'WALK',
    x,
    y,
    cell,
    budget: 0,
    speedMps: 1.1,
    obeysArrows: true,
    buyerTypeId: world.demand.buyerTypes[0].id,
    list: [],
    listIndex: 0,
    patienceS: 999999,
    waitElapsedS: 0,
    blockedTicks: 0,
    targetStallId,
    serviceRemainingS: 0,
    spawnT: world.t,
    despawnT: null,
    cellsWalked: 0,
    shortestPathAtChoice: 0,
    lastSkipReason: null,
  };
  world.agents.set(id, buyer);
  world.occupantAgentId[cell] = id;
  world.metrics.spawned++;
  return id;
}

function colCells(x: number, height: number): { x: number; y: number }[] {
  return colCellsRange(x, 0, height);
}

function colCellsRange(x: number, y0: number, count: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = y0; y < y0 + count; y++) cells.push({ x, y });
  return cells;
}

function addStall(project: Project, id: number, x0: number, y0: number, w: number, h: number, maxConcurrent = 2): void {
  const cells = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.push({ x, y });
  const frontCells = [];
  for (let x = x0; x < x0 + w; x++) frontCells.push({ x, y: y0 + h });
  const stall: Stall = {
    kind: 'stall',
    id,
    cells,
    frontEdge: 'S',
    frontCells,
    produce: ['leafy'],
    sellerType: 'farmer',
    attractiveness: assumed(1),
    maxConcurrentCustomers: maxConcurrent,
    shaded: false,
    locked: false,
  };
  project.baseline.objects.push(stall);
}
