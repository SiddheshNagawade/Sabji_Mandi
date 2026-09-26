// Main tick loop (SPEC.md section 9.12).

import type { World } from './world';
import { spawnBuyers, decide } from './agents';
import type { Proposal } from './movement';
import { applyMoves, computeStationaryMask, proposeMove, resolveConflicts } from './movement';
import { poissonSample, shuffledIndices } from './rng';

export function step(world: World) {
  world.t += world.dt;

  if (world.t <= world.demand.simEndSpawnS) {
    const n = world.arrivalsThisTick((lambda) => poissonSample(world.rng, lambda));
    if (n > 0) spawnBuyers(world, n);
  }

  computeStationaryMask(world);

  const ids = Array.from(world.agents.keys());
  const order = shuffledIndices(ids.length, world.rng).map((i) => ids[i]);

  for (const id of order) {
    const buyer = world.agents.get(id);
    if (buyer) decide(world, buyer);
  }

  const proposals: Proposal[] = [];
  for (const id of order) {
    const buyer = world.agents.get(id);
    if (!buyer || (buyer.state !== 'WALK' && buyer.state !== 'LEAVE')) continue;
    const p = proposeMove(world, buyer);
    if (p) proposals.push(p);
  }

  const accepted = resolveConflicts(world, proposals);
  applyMoves(world, accepted);

  accumulateHeat(world);
  despawnFinished(world);
  if (world.t >= world.demand.hardStopS) forceDespawnAll(world);
}

function accumulateHeat(world: World) {
  for (const buyer of world.agents.values()) {
    world.heat.occupancySeconds[buyer.cell] += world.dt;
    const isMoving = buyer.state === 'WALK' || buyer.state === 'LEAVE';
    if (isMoving && buyer.blockedTicks > 0) {
      world.heat.stuckSeconds[buyer.cell] += world.dt;
    }
  }
}

function despawnFinished(world: World) {
  for (const [id, buyer] of Array.from(world.agents)) {
    if (buyer.state === 'DESPAWNED') {
      world.occupantAgentId[buyer.cell] = -1;
      world.agents.delete(id);
    }
  }
}

function forceDespawnAll(world: World) {
  for (const [id, buyer] of Array.from(world.agents)) {
    world.occupantAgentId[buyer.cell] = -1;
    world.metrics.despawned++;
    world.metrics.timesInMarket.push(world.t - buyer.spawnT);
    world.agents.delete(id);
  }
}

export function isRunComplete(world: World): boolean {
  return world.t >= world.demand.hardStopS || (world.t > world.demand.simEndSpawnS && world.agents.size === 0);
}
