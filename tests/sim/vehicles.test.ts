import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../src/data/defaults';
import type { Entrance, Project, VehicleBay } from '../../src/data/schema';
import { assumed } from '../../src/data/schema';
import { World } from '../../src/sim/core/world';
import { step, isRunComplete } from '../../src/sim/core/tick';
import { vehiclePassableMask, detectVehicleConflicts } from '../../src/sim/core/vehicles';
import type { Buyer } from '../../src/sim/core/world';
import { idx } from '../../src/sim/core/walkable';

function vehicleTestProject(): Project {
  const width = 24;
  const height = 10;
  const project = createBlankProject('VehicleTest', width, height);
  project.demand.pedArrivalsPerBin = assumed(new Array(200).fill(0)); // isolate vehicle behaviour
  project.demand.hardStopS = project.demand.simStartS + 3600;

  const gate: Entrance = { kind: 'entrance', id: 1, cells: [{ x: 0, y: 3 }], type: 'veh_both', weight: assumed(1) };
  project.baseline.objects.push(gate);

  const bayCells = [];
  for (let y = 3; y <= 6; y++) for (let x = 10; x <= 11; x++) bayCells.push({ x, y });
  const bay: VehicleBay = { kind: 'vehicle_bay', id: 2, cells: bayCells, vehicleType: 'handcart' };
  project.baseline.objects.push(bay);

  project.demand.vehicleSchedule = [{ arrivalTimeS: project.demand.simStartS, type: 'handcart', entranceId: 1 }];
  return project;
}

describe('vehicles', () => {
  it('spawns, drives to a bay, dwells, departs and despawns with no failed unloads', () => {
    const project = vehicleTestProject();
    const world = new World(project, 11);

    let ticks = 0;
    const seenStates = new Set<string>();
    while (!isRunComplete(world) && ticks < 20000) {
      step(world);
      for (const v of world.vehicles.values()) seenStates.add(v.state);
      ticks++;
    }

    expect(world.vehicleMetrics.spawned).toBe(1);
    expect(world.vehicleMetrics.despawned).toBe(1);
    expect(world.vehicleMetrics.failedUnloads).toBe(0);
    expect(seenStates.has('APPROACH')).toBe(true);
    expect(seenStates.has('DWELL')).toBe(true);
    expect(seenStates.has('DEPART')).toBe(true);
    expect(world.vehicles.size).toBe(0);

    // The bay saw some blocking time while the vehicle dwelled there.
    const bayCell = idx(10, 3, project.grid.width);
    expect(world.heat.vehicleBlockSeconds[bayCell]).toBeGreaterThan(0);
  });

  it('a two-cell-wide vehicle cannot pass through a one-cell-wide gap', () => {
    const width = 10;
    const height = 6;
    const terrain = new Uint8Array(width * height); // all open ground
    for (let x = 0; x < width; x++) {
      if (x === 5) continue; // a single-cell gap in an otherwise solid wall at y=3
      terrain[idx(x, 3, width)] = 2; // Wall
    }
    const mask = vehiclePassableMask(terrain, width, height, 2, 1);
    // any anchor for a 2-wide footprint here straddles the gap and a wall cell, so both are rejected
    expect(mask[idx(4, 3, width)]).toBe(0); // covers (4,3) wall + (5,3) gap
    expect(mask[idx(5, 3, width)]).toBe(0); // covers (5,3) gap + (6,3) wall
    // the gap itself only fits a 1-wide vehicle
    const mask1 = vehiclePassableMask(terrain, width, height, 1, 1);
    expect(mask1[idx(5, 3, width)]).toBe(1);
  });

  it('logs a pedestrian-vehicle conflict after sustained proximity, then stops double-counting it', () => {
    const project = vehicleTestProject();
    const world = new World(project, 3);
    const width = project.grid.width;

    const buyer: Buyer = {
      id: 1,
      kind: 'buyer',
      state: 'WALK',
      x: 5,
      y: 3,
      cell: idx(5, 3, width),
      budget: 0,
      speedMps: 1.1,
      obeysArrows: true,
      buyerTypeId: world.demand.buyerTypes[0].id,
      list: [],
      listIndex: 0,
      patienceS: 999,
      waitElapsedS: 0,
      blockedTicks: 0,
      targetStallId: null,
      serviceRemainingS: 0,
      spawnT: world.t,
      despawnT: null,
      cellsWalked: 0,
      shortestPathAtChoice: 0,
      lastSkipReason: null,
    };
    world.agents.set(buyer.id, buyer);

    world.vehicles.set(1, {
      id: 1,
      kind: 'vehicle',
      vehicleType: 'handcart',
      footprintW: 2,
      footprintH: 1,
      anchorX: 5,
      anchorY: 3,
      cells: [idx(5, 3, width), idx(6, 3, width)],
      state: 'APPROACH',
      targetBayId: null,
      dwellRemainingS: 0,
      waitTicks: 0,
      budget: 0,
      spawnT: world.t,
      despawnT: null,
      failedUnload: false,
    });

    const thresholdTicks = Math.ceil(world.params.vehicleConflictDurationS.value / world.dt);
    for (let i = 0; i < thresholdTicks - 1; i++) detectVehicleConflicts(world);
    expect(world.vehicleMetrics.conflicts).toBe(0);

    detectVehicleConflicts(world); // crosses the threshold
    expect(world.vehicleMetrics.conflicts).toBe(1);

    detectVehicleConflicts(world); // still close, but the pair's counter just reset
    expect(world.vehicleMetrics.conflicts).toBe(1);
  });
});
