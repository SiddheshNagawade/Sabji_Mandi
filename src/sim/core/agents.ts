// Buyer state machine and target choice (SPEC.md section 9.3). Vehicles and
// sellers are not modelled yet (M4/M6).
//
// Simplification vs. the spec text: instead of a separate "loiter near the
// stall within a radius" search, a buyer transitions to WAIT_FOR_SLOT the
// moment it reaches one of the stall's frontage cells and simply stands
// there (or wherever it got blocked approaching). Combined with the normal
// movement/occupancy rules this produces the same emergent effect the spec
// asks for — a queue of stationary buyers physically fills the frontage and
// spills into the aisle — without needing a separate search step.
//
// Buyers are also treated as fully "informed" of every stall's location
// (no uninformed wandering / sign-based discovery yet); that arrives with
// the wayfinding-sign intervention in M6.

import type { Buyer, StallRuntime, World } from './world';
import { idx } from './walkable';
import { lognormalSample, normalSample, randInt, softmaxPick } from './rng';
import type { Rng } from './rng';
import type { Entrance, ProduceCategory } from '../../data/schema';

function pickWeighted<T>(rng: Rng, items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, x) => s + weight(x), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function entranceCellIndices(world: World, e: Entrance): number[] {
  return e.cells.filter((c) => c.x >= 0 && c.y >= 0 && c.x < world.width && c.y < world.height).map((c) => idx(c.x, c.y, world.width));
}

export function spawnBuyers(world: World, count: number) {
  if (count <= 0 || world.entrancesIn.length === 0) return;
  for (let n = 0; n < count; n++) {
    const entrance = pickWeighted(world.rng, world.entrancesIn, (e) => Math.max(0.01, e.weight.value));
    const cells = entranceCellIndices(world, entrance);
    const freeCell = cells.find((c) => world.occupantAgentId[c] === -1 && world.terrain[c] !== undefined);
    if (freeCell === undefined) continue; // gate is full this tick

    const type = pickWeighted(world.rng, world.demand.buyerTypes, (t) => Math.max(0.001, t.share.value));
    const categories = Array.from(world.stallsByProduce.keys());
    const [minList, maxList] = type.listSize.value;
    const listLen = Math.max(0, randInt(world.rng, minList, maxList));
    const list: ProduceCategory[] = [];
    for (let i = 0; i < listLen && categories.length > 0; i++) {
      list.push(categories[Math.floor(world.rng() * categories.length)]);
    }

    const id = world.nextAgentId++;
    const speedVariation = 1 + normalSample(world.rng, 0, 0.08);
    const buyer: Buyer = {
      id,
      kind: 'buyer',
      state: 'WALK',
      x: freeCell % world.width,
      y: Math.floor(freeCell / world.width),
      cell: freeCell,
      budget: 0,
      speedMps: Math.max(0.3, type.walkSpeedMps.value * speedVariation),
      obeysArrows: world.rng() < world.params.arrowComplianceFrac.value,
      buyerTypeId: type.id,
      list,
      listIndex: 0,
      patienceS: type.patienceS.value,
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
    world.agents.set(id, buyer);
    world.occupantAgentId[freeCell] = id;
    world.metrics.spawned++;
    chooseNextTarget(world, buyer);
  }
}

function candidateStallsFor(world: World, category: ProduceCategory): StallRuntime[] {
  return world.stallsByProduce.get(category) ?? [];
}

/** Picks the next item on the list (or heads to an exit if the list is done). */
export function chooseNextTarget(world: World, buyer: Buyer) {
  if (buyer.listIndex >= buyer.list.length) {
    buyer.targetStallId = null;
    buyer.state = 'LEAVE';
    buyer.blockedTicks = 0;
    return;
  }
  const category = buyer.list[buyer.listIndex];
  const candidates = candidateStallsFor(world, category);
  if (candidates.length === 0) {
    // nothing sells this category — treat as satisfied and move on
    buyer.listIndex++;
    chooseNextTarget(world, buyer);
    return;
  }
  const w = world.params.choiceWeights;
  const utilities: number[] = [];
  const reachable: StallRuntime[] = [];
  for (const r of candidates) {
    const field = world.flowFields.get({ goalId: `stall:${r.stall.id}`, obeysArrows: buyer.obeysArrows }, r.frontCellIndices);
    const pathCost = field[buyer.cell];
    if (!Number.isFinite(pathCost)) continue;
    const queueAhead = Math.max(0, r.waitingOrServedIds.size - r.slots);
    const localCrowd = r.frontCellIndices.length > 0 ? r.waitingOrServedIds.size / r.frontCellIndices.length : 0;
    const noise = normalSample(world.rng, 0, 1);
    const u = -w.pathCost.value * pathCost - w.queueAhead.value * queueAhead - w.localCrowd.value * localCrowd + w.attractiveness.value * r.stall.attractiveness.value + w.noiseTemp.value * noise;
    utilities.push(u);
    reachable.push(r);
  }
  if (reachable.length === 0) {
    // category exists but nothing is reachable from here — skip the item
    buyer.listIndex++;
    chooseNextTarget(world, buyer);
    return;
  }
  const chosen = softmaxPick(world.rng, reachable, utilities, 1.0);
  const field = world.flowFields.get({ goalId: `stall:${chosen.stall.id}`, obeysArrows: buyer.obeysArrows }, chosen.frontCellIndices);
  buyer.targetStallId = chosen.stall.id;
  buyer.shortestPathAtChoice = field[buyer.cell];
  buyer.state = 'WALK';
  buyer.blockedTicks = 0;
  chosen.visits++;
}

function startLeaving(buyer: Buyer) {
  buyer.targetStallId = null;
  buyer.state = 'LEAVE';
  buyer.blockedTicks = 0;
}

function skip(world: World, buyer: Buyer, reason: 'queue' | 'blocked', runtime?: StallRuntime) {
  world.metrics.skipped[reason]++;
  buyer.lastSkipReason = reason;
  if (runtime) {
    runtime.lostVisits[reason]++;
    runtime.waitingOrServedIds.delete(buyer.id);
  }
  buyer.listIndex++;
  chooseNextTarget(world, buyer);
}

/** Per-agent state transitions. Movement itself happens in movement.ts. Returns whether the agent wants to move this tick. */
export function decide(world: World, buyer: Buyer): boolean {
  switch (buyer.state) {
    case 'WALK': {
      const runtime = buyer.targetStallId != null ? world.stalls.get(buyer.targetStallId) : undefined;
      if (runtime && runtime.frontCellIndices.includes(buyer.cell)) {
        if (runtime.servedIds.size < runtime.slots) {
          runtime.servedIds.add(buyer.id);
          runtime.waitingOrServedIds.add(buyer.id);
          buyer.state = 'BEING_SERVED';
          buyer.serviceRemainingS = sampleServiceTime(world, buyer);
        } else {
          runtime.waitingOrServedIds.add(buyer.id);
          buyer.state = 'WAIT_FOR_SLOT';
          buyer.waitElapsedS = 0;
        }
        return false;
      }
      if (buyer.blockedTicks * world.dt > buyer.patienceS) {
        skip(world, buyer, 'blocked', runtime);
        return true; // chooseNextTarget always leaves the buyer in WALK or LEAVE
      }
      return true;
    }
    case 'WAIT_FOR_SLOT': {
      const runtime = buyer.targetStallId != null ? world.stalls.get(buyer.targetStallId) : undefined;
      buyer.waitElapsedS += world.dt;
      if (buyer.waitElapsedS > buyer.patienceS) {
        skip(world, buyer, 'queue', runtime);
        return true;
      }
      if (runtime && runtime.servedIds.size < runtime.slots) {
        runtime.servedIds.add(buyer.id);
        buyer.state = 'BEING_SERVED';
        buyer.serviceRemainingS = sampleServiceTime(world, buyer);
      }
      return false;
    }
    case 'BEING_SERVED': {
      buyer.serviceRemainingS -= world.dt;
      if (buyer.serviceRemainingS <= 0) {
        const runtime = buyer.targetStallId != null ? world.stalls.get(buyer.targetStallId) : undefined;
        if (runtime) {
          runtime.servedIds.delete(buyer.id);
          runtime.waitingOrServedIds.delete(buyer.id);
          runtime.servedCount++;
        }
        buyer.listIndex++;
        if (buyer.listIndex >= buyer.list.length) startLeaving(buyer);
        else chooseNextTarget(world, buyer);
      }
      return false;
    }
    case 'LEAVE': {
      const exitCells = world.entrancesOut.flatMap((e) => entranceCellIndices(world, e));
      if (exitCells.includes(buyer.cell)) {
        buyer.state = 'DESPAWNED';
        buyer.despawnT = world.t;
        world.metrics.despawned++;
        world.metrics.timesInMarket.push(world.t - buyer.spawnT);
        return false;
      }
      return true;
    }
    case 'DESPAWNED':
      return false;
  }
}

function sampleServiceTime(world: World, buyer: Buyer): number {
  const category = buyer.list[buyer.listIndex] ?? Array.from(world.stallsByProduce.keys())[0];
  const dist = world.demand.serviceTimeByProduce[category];
  const type = world.buyerType(buyer.buyerTypeId);
  const base = dist ? lognormalSample(world.rng, dist.params.value[0], dist.params.value[1] ?? 0.4) : 45;
  return Math.max(5, base * type.serviceScale.value);
}

export function exitGoalCells(world: World): number[] {
  return world.entrancesOut.flatMap((e) => entranceCellIndices(world, e));
}
