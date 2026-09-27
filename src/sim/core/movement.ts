// Movement and conflict resolution (SPEC.md section 9.5).

import type { Buyer, World } from './world';
import { canStepPed, idx, inBounds, NEIGHBOR_8 } from './walkable';
import { exitGoalCells } from './agents';

export interface Proposal {
  agentId: number;
  from: number;
  to: number;
}

export function computeStationaryMask(world: World) {
  world.stationaryMask.fill(0);
  for (const buyer of world.agents.values()) {
    if (buyer.state === 'WAIT_FOR_SLOT' || buyer.state === 'BEING_SERVED') {
      world.stationaryMask[buyer.cell] = 1;
    }
  }
}

export function localDensity(world: World, x: number, y: number): number {
  let occupied = 0;
  let total = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (!inBounds(xx, yy, world.width, world.height)) continue;
      total++;
      if (world.occupantAgentId[idx(xx, yy, world.width)] !== -1) occupied++;
    }
  }
  return total > 0 ? occupied / total : 0;
}

export function crowdSlowdownFactor(world: World, cell: number): number {
  const x = cell % world.width;
  const y = Math.floor(cell / world.width);
  const density = localDensity(world, x, y);
  const kappa = world.params.crowdSlowdownKappa.value;
  const minFactor = world.params.crowdSlowdownMinFactor.value;
  return Math.max(minFactor, Math.min(1, 1 - kappa * density));
}

function goalFor(world: World, buyer: Buyer): { goalId: string; cells: number[] } {
  if (buyer.targetStallId != null) {
    const runtime = world.stalls.get(buyer.targetStallId);
    return { goalId: `stall:${buyer.targetStallId}`, cells: runtime ? runtime.frontCellIndices : [] };
  }
  return { goalId: 'exit', cells: exitGoalCells(world) };
}

const STEP_COST_ORTHOGONAL = 1.0;
const STEP_COST_DIAGONAL = Math.SQRT2;

/** Returns a move proposal, or null if the agent stays put this tick (and bumps blockedTicks when it wanted to move but couldn't improve). */
export function proposeMove(world: World, buyer: Buyer): Proposal | null {
  const speedFactor = crowdSlowdownFactor(world, buyer.cell);
  buyer.budget += (buyer.speedMps * speedFactor) / world.cellSizeM * world.dt;
  if (buyer.budget < STEP_COST_ORTHOGONAL) return null;

  const { goalId, cells } = goalFor(world, buyer);
  if (cells.length === 0) return null;
  const field = world.flowFields.get({ goalId, obeysArrows: buyer.obeysArrows }, cells);
  const currentField = field[buyer.cell];
  const cx = buyer.cell % world.width;
  const cy = Math.floor(buyer.cell / world.width);

  const candidates: { cell: number; field: number; score: number; diag: boolean }[] = [];
  for (const nb of NEIGHBOR_8) {
    const nx = cx + nb.x;
    const ny = cy + nb.y;
    if (!inBounds(nx, ny, world.width, world.height)) continue;
    const ncell = idx(nx, ny, world.width);
    if (world.stationaryMask[ncell]) continue;
    if (!canStepPed(world.resolvedTerrain, world.resolvedFlow, world.width, world.height, buyer.cell, ncell, buyer.obeysArrows)) continue;
    if (world.vehicleOccupant[ncell] !== -1) continue; // vehicles are hard obstacles for pedestrians too
    const fv = field[ncell];
    if (!Number.isFinite(fv)) continue;
    const occPenalty = world.occupantAgentId[ncell] !== -1 ? world.params.occupancyPenaltyWeight.value : 0;
    const dens = localDensity(world, nx, ny);
    const score = fv + occPenalty + world.params.densityPenaltyWeight.value * dens + world.rng() * 0.001;
    candidates.push({ cell: ncell, field: fv, score, diag: nb.diag });
  }
  if (candidates.length === 0) {
    buyer.blockedTicks++;
    return null;
  }
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  if (best.field < currentField) {
    return { agentId: buyer.id, from: buyer.cell, to: best.cell };
  }

  buyer.blockedTicks++;
  if (buyer.blockedTicks > world.params.sidestepThreshold && world.rng() < world.params.sidestepProbability.value) {
    const tolerance = 1.5;
    const lateral = candidates.filter((c) => c.field <= currentField + tolerance);
    if (lateral.length > 0) {
      const pick = lateral[Math.floor(world.rng() * lateral.length)];
      return { agentId: buyer.id, from: buyer.cell, to: pick.cell };
    }
  }
  return null;
}

/**
 * Resolves all proposals into a conflict-free set: mutual face-to-face swaps
 * (gated by the deadlock threshold/probability), then same-target-cell
 * contests (random winner weighted by how long each has been stuck), then a
 * cascade so a move into a cell is only honoured once whoever is standing
 * there has itself been confirmed to be moving away.
 */
export function resolveConflicts(world: World, proposals: Proposal[]): Proposal[] {
  const dt = world.dt;
  const byAgentId = new Map(proposals.map((p) => [p.agentId, p]));
  const settledMoving = new Set<number>();
  const settledStationary = new Set<number>();
  const accepted: Proposal[] = [];

  const swapHandled = new Set<number>();
  for (const p of proposals) {
    if (swapHandled.has(p.agentId)) continue;
    const occupant = world.occupantAgentId[p.to];
    if (occupant === -1 || occupant === p.agentId) continue;
    const other = byAgentId.get(occupant);
    if (!other || other.to !== p.from || swapHandled.has(other.agentId)) continue;
    const a = world.agents.get(p.agentId)!;
    const b = world.agents.get(other.agentId)!;
    const eligible = a.blockedTicks * dt > world.params.deadlockThresholdS.value && b.blockedTicks * dt > world.params.deadlockThresholdS.value;
    swapHandled.add(p.agentId);
    swapHandled.add(other.agentId);
    if (eligible && world.rng() < world.params.swapProbability.value) {
      accepted.push(p, other);
      settledMoving.add(p.agentId);
      settledMoving.add(other.agentId);
    } else {
      settledStationary.add(p.agentId);
      settledStationary.add(other.agentId);
      a.blockedTicks++;
      b.blockedTicks++;
    }
  }

  const remaining = proposals.filter((p) => !swapHandled.has(p.agentId));
  const groups = new Map<number, Proposal[]>();
  for (const p of remaining) {
    const arr = groups.get(p.to) ?? [];
    arr.push(p);
    groups.set(p.to, arr);
  }
  const winners = new Map<number, Proposal>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      winners.set(group[0].agentId, group[0]);
      continue;
    }
    const weights = group.map((p) => 1 + world.agents.get(p.agentId)!.blockedTicks * 0.01);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = world.rng() * total;
    let winnerIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        winnerIdx = i;
        break;
      }
    }
    winners.set(group[winnerIdx].agentId, group[winnerIdx]);
    for (let i = 0; i < group.length; i++) {
      if (i !== winnerIdx) {
        settledStationary.add(group[i].agentId);
        world.agents.get(group[i].agentId)!.blockedTicks++;
      }
    }
  }

  for (const buyer of world.agents.values()) {
    if (!byAgentId.has(buyer.id) && !settledMoving.has(buyer.id)) settledStationary.add(buyer.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [agentId, p] of Array.from(winners)) {
      const occupant = world.occupantAgentId[p.to];
      if (occupant === -1 || occupant === agentId) continue;
      if (settledMoving.has(occupant)) continue;
      if (settledStationary.has(occupant) || !winners.has(occupant)) {
        winners.delete(agentId);
        settledStationary.add(agentId);
        world.agents.get(agentId)!.blockedTicks++;
        changed = true;
      }
    }
  }
  // Anything left is either free-to-move or part of a closed rotation cycle,
  // both of which are safe to execute simultaneously.
  for (const agentId of winners.keys()) settledMoving.add(agentId);
  for (const p of winners.values()) accepted.push(p);
  return accepted;
}

export function applyMoves(world: World, proposals: Proposal[]) {
  for (const p of proposals) {
    const buyer = world.agents.get(p.agentId);
    if (!buyer) continue;
    const stepCost = p.to === p.from ? 0 : Math.abs((p.to % world.width) - (p.from % world.width)) === 1 && Math.abs(Math.floor(p.to / world.width) - Math.floor(p.from / world.width)) === 1 ? STEP_COST_DIAGONAL : STEP_COST_ORTHOGONAL;
    buyer.budget = Math.max(0, buyer.budget - stepCost);
    world.occupantAgentId[p.from] = -1;
    world.occupantAgentId[p.to] = buyer.id;
    buyer.cell = p.to;
    buyer.x = p.to % world.width;
    buyer.y = Math.floor(p.to / world.width);
    buyer.cellsWalked++;
    buyer.blockedTicks = 0;
    world.heat.passCount[p.to]++;
  }
}
