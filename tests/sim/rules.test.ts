import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../src/data/defaults';
import type { Barrier, Entrance, Project } from '../../src/data/schema';
import { assumed } from '../../src/data/schema';
import { World } from '../../src/sim/core/world';
import { tileStepCost, idx } from '../../src/sim/core/walkable';
import { getActivePhase, isArrowGroupActive, isBarrierActive } from '../../src/sim/core/rules';
import { step } from '../../src/sim/core/tick';

function baseProject(width: number, height: number): Project {
  const project = createBlankProject('Rules', width, height);
  project.demand.pedArrivalsPerBin = assumed(new Array(50).fill(0));
  return project;
}

describe('phases/barriers/arrow-groups (rules.ts)', () => {
  it('with no phases, a barrier always blocks', () => {
    const project = baseProject(10, 5);
    const barrier: Barrier = { kind: 'barrier', id: 1, cells: [{ x: 5, y: 2 }] };
    project.baseline.objects.push(barrier);
    project.baseline.terrain[idx(5, 2, 10)] = 12; // TileId.Barrier
    expect(isBarrierActive(1, project.baseline, null)).toBe(true);

    const world = new World(project, 1);
    expect(tileStepCost(world.resolvedTerrain[idx(5, 2, 10)])).toBe(Infinity);
  });

  it('a barrier only blocks during a phase that activates it', () => {
    const project = baseProject(10, 5);
    const barrier: Barrier = { kind: 'barrier', id: 1, cells: [{ x: 5, y: 2 }] };
    project.baseline.objects.push(barrier);
    project.baseline.terrain[idx(5, 2, 10)] = 12; // TileId.Barrier
    const t0 = project.demand.simStartS;
    project.baseline.phases = [
      { id: 1, name: 'Closed', startS: t0, endS: t0 + 100, activeBarrierIds: [1], activeArrowGroupIds: [], vehiclesAllowed: false, vehiclesBaysOnly: false, openEntranceIds: [], wasteClearing: false },
      { id: 2, name: 'Open', startS: t0 + 100, endS: t0 + 3600, activeBarrierIds: [], activeArrowGroupIds: [], vehiclesAllowed: true, vehiclesBaysOnly: false, openEntranceIds: [], wasteClearing: false },
    ];

    const world = new World(project, 1);
    // During phase 1, the barrier is active and blocks.
    expect(getActivePhase(project.baseline, world.t)?.id).toBe(1);
    expect(tileStepCost(world.resolvedTerrain[idx(5, 2, 10)])).toBe(Infinity);

    // Jump into phase 2, where the barrier isn't listed as active.
    world.t = t0 + 150;
    world.updatePhaseIfNeeded();
    expect(getActivePhase(project.baseline, world.t)?.id).toBe(2);
    expect(tileStepCost(world.resolvedTerrain[idx(5, 2, 10)])).toBeLessThan(Infinity);
  });

  it('an arrow is only enforced while its group is active', () => {
    const project = baseProject(10, 5);
    project.baseline.flow[idx(3, 2, 10)] = 3; // East
    project.baseline.flowGroup[idx(3, 2, 10)] = 1;
    project.baseline.arrowGroups = [{ id: 1 }];
    const t0 = project.demand.simStartS;
    project.baseline.phases = [
      { id: 1, name: 'Enforced', startS: t0, endS: t0 + 100, activeBarrierIds: [], activeArrowGroupIds: [1], vehiclesAllowed: false, vehiclesBaysOnly: false, openEntranceIds: [], wasteClearing: false },
      { id: 2, name: 'Off', startS: t0 + 100, endS: t0 + 3600, activeBarrierIds: [], activeArrowGroupIds: [], vehiclesAllowed: false, vehiclesBaysOnly: false, openEntranceIds: [], wasteClearing: false },
    ];

    const world = new World(project, 1);
    expect(world.resolvedFlow[idx(3, 2, 10)]).toBe(3);
    expect(isArrowGroupActive(1, project.baseline, getActivePhase(project.baseline, world.t))).toBe(true);

    world.t = t0 + 150;
    world.updatePhaseIfNeeded();
    expect(world.resolvedFlow[idx(3, 2, 10)]).toBe(0);
  });

  it('an entrance schedule outside its window keeps buyers from spawning there', () => {
    const project = baseProject(12, 5);
    project.demand.pedArrivalsPerBin = assumed(new Array(50).fill(500)); // heavy demand
    const t0 = project.demand.simStartS;
    const closedEntrance: Entrance = {
      kind: 'entrance',
      id: 1,
      cells: [{ x: 0, y: 2 }],
      type: 'ped_in',
      weight: assumed(1),
      schedule: [{ startS: t0 + 1000, endS: t0 + 2000 }], // not open yet at t0
    };
    project.baseline.objects.push(closedEntrance);
    const world = new World(project, 1);

    for (let i = 0; i < 20; i++) step(world);
    expect(world.metrics.spawned).toBe(0);

    world.t = t0 + 1500 - world.dt; // about to enter the open window
    for (let i = 0; i < 20; i++) step(world);
    expect(world.metrics.spawned).toBeGreaterThan(0);
  });
});
