// Main tick loop (SPEC.md section 9.12).

import type { World } from './world';
import { spawnBuyers, decide } from './agents';
import type { Proposal } from './movement';
import { applyMoves, computeStationaryMask, proposeMove, resolveConflicts } from './movement';
import { poissonSample, shuffledIndices } from './rng';
import { applyVehicleMove, decideVehicle, detectVehicleConflicts, proposeVehicleMove, spawnVehicles } from './vehicles';
import { vehiclesAllowedNow } from './rules';

export function step(world: World) {
  world.t += world.dt;
  world.updatePhaseIfNeeded();

  if (world.t <= world.demand.simEndSpawnS) {
    const n = world.arrivalsThisTick((lambda) => poissonSample(world.rng, lambda));
    if (n > 0) spawnBuyers(world, n);
  }

  const dueVehicles = world.vehicleArrivalsThisTick();
  if (dueVehicles.length > 0 && vehiclesAllowedNow(world.layout, world.currentPhase)) {
    spawnVehicles(world, dueVehicles);
  }

  computeStationaryMask(world);

  const ids = Array.from(world.agents.keys());
  const order = shuffledIndices(ids.length, world.rng).map((i) => ids[i]);

  for (const id of order) {
    const buyer = world.agents.get(id);
    if (buyer) decide(world, buyer);
  }

  const vehicleIds = Array.from(world.vehicles.keys());
  const vehicleOrder = shuffledIndices(vehicleIds.length, world.rng).map((i) => vehicleIds[i]);
  for (const id of vehicleOrder) {
    const v = world.vehicles.get(id);
    if (v) decideVehicle(world, v);
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

  // Vehicles move after pedestrians are settled this tick, and each is applied
  // immediately (rather than batch-resolved) — with few vehicles relative to
  // pedestrians this is simple and matches the spec's "vehicles yield to
  // pedestrians, blocked by pedestrians and other vehicles" (section 9.3/9.5).
  for (const id of vehicleOrder) {
    const v = world.vehicles.get(id);
    if (!v || (v.state !== 'APPROACH' && v.state !== 'DEPART')) continue;
    const move = proposeVehicleMove(world, v);
    if (move) applyVehicleMove(world, v, move);
  }

  detectVehicleConflicts(world);
  accumulateHeat(world);
  despawnFinished(world);
  despawnFinishedVehicles(world);
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
  for (const v of world.vehicles.values()) {
    for (const c of v.cells) world.heat.vehicleBlockSeconds[c] += world.dt;
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

function despawnFinishedVehicles(world: World) {
  for (const [id, v] of Array.from(world.vehicles)) {
    if (v.state === 'DESPAWNED') {
      for (const c of v.cells) world.vehicleOccupant[c] = -1;
      world.vehicles.delete(id);
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
  for (const [id, v] of Array.from(world.vehicles)) {
    for (const c of v.cells) world.vehicleOccupant[c] = -1;
    world.vehicleMetrics.despawned++;
    world.vehicles.delete(id);
  }
}

export function isRunComplete(world: World): boolean {
  return world.t >= world.demand.hardStopS || (world.t > world.demand.simEndSpawnS && world.agents.size === 0 && world.vehicles.size === 0);
}
