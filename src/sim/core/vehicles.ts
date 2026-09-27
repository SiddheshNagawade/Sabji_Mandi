// Vehicles (SPEC.md section 9.3 "Vehicles"). Deliberately simpler than the
// buyer state machine, per the spec text: a rigid multi-cell footprint that
// moves one step at a time toward a bay, waits for pedestrians rather than
// negotiating sidesteps/swaps with them, and gives up after maxWaitS.
//
// Simplifications, noted rather than silently assumed:
//  - No footprint rotation: a vehicle always occupies footprintW x footprintH
//    cells anchored at its top-left corner, in the orientation the vehicle
//    type declares.
//  - A vehicle is not matched to a bay of its own declared type; it takes
//    the nearest free bay of any type (or the one its arrival record names,
//    if given). Type-matched bay assignment is a refinement for later.
//  - Vehicles ignore pedestrian one-way arrows (arrows are a pedestrian
//    concept per section 7.3); they are still blocked by walls/barriers and
//    by the vehicle-passable mask (footprint-fits erosion, section 9.4).
//  - No "stop in the aisle" fallback: a vehicle always needs a free bay, and
//    gives up (failed unload) after maxWaitS if one never opens up. A
//    phase's vehiclesBaysOnly flag exists in the data model for a later
//    "aisle stopping allowed" mode but isn't consulted yet.

import type { VehicleArrival, VehicleBay, VehicleType } from '../../data/schema';
import { TileId } from '../../data/schema';
import { computeFlowField } from './flowfield';
import { lognormalSample } from './rng';
import type { World } from './world';
import { idx, inBounds, tileStepCost, NEIGHBOR_8 } from './walkable';

export type VehicleRuntimeState = 'APPROACH' | 'DWELL' | 'DEPART' | 'DESPAWNED';

export interface Vehicle {
  id: number;
  kind: 'vehicle';
  vehicleType: VehicleType;
  footprintW: number;
  footprintH: number;
  anchorX: number;
  anchorY: number;
  cells: number[];
  state: VehicleRuntimeState;
  targetBayId: number | null;
  dwellRemainingS: number;
  waitTicks: number;
  budget: number;
  spawnT: number;
  despawnT: number | null;
  failedUnload: boolean;
  assignedStallId?: number;
}

export interface BayRuntime {
  bay: VehicleBay;
  anchor: number; // top-left cell index
  occupiedByVehicleId: number | null;
}

/** For each possible top-left anchor, whether a footprintW x footprintH rectangle fits on walkable ground there. */
export function vehiclePassableMask(terrain: Uint8Array, width: number, height: number, footprintW: number, footprintH: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y <= height - footprintH; y++) {
    for (let x = 0; x <= width - footprintW; x++) {
      let ok = true;
      for (let dy = 0; dy < footprintH && ok; dy++) {
        for (let dx = 0; dx < footprintW; dx++) {
          if (tileStepCost(terrain[idx(x + dx, y + dy, width)]) === Infinity) {
            ok = false;
            break;
          }
        }
      }
      if (ok) mask[idx(x, y, width)] = 1;
    }
  }
  return mask;
}

function footprintCells(anchorX: number, anchorY: number, w: number, h: number, width: number): number[] {
  const cells: number[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push(idx(anchorX + dx, anchorY + dy, width));
  return cells;
}

function bayAnchor(bay: VehicleBay, width: number): number {
  let minX = Infinity;
  let minY = Infinity;
  for (const c of bay.cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return idx(minX, minY, width);
}

export function buildBayRuntimes(world: World): Map<number, BayRuntime> {
  const map = new Map<number, BayRuntime>();
  for (const o of world.layout.objects) {
    if (o.kind !== 'vehicle_bay') continue;
    map.set(o.id, { bay: o, anchor: bayAnchor(o, world.width), occupiedByVehicleId: null });
  }
  return map;
}

function vehicleFlowField(world: World, vehicleType: VehicleType, goalId: string, goalAnchors: number[]): Float32Array {
  const key = `${vehicleType}:${goalId}:${world.currentPhaseId ?? 'none'}`;
  let field = world.vehicleFlowFields.get(key);
  if (field) return field;
  const [fw, fh] = world.demand.vehicleTypes[vehicleType].footprintCells;
  let mask = world.vehiclePassableMasks.get(`${vehicleType}:${world.currentPhaseId ?? 'none'}`);
  if (!mask) {
    mask = vehiclePassableMask(world.resolvedTerrain, world.width, world.height, fw, fh);
    world.vehiclePassableMasks.set(`${vehicleType}:${world.currentPhaseId ?? 'none'}`, mask);
  }
  const synthetic = new Uint8Array(world.width * world.height);
  for (let i = 0; i < mask.length; i++) synthetic[i] = mask[i] ? TileId.OpenGround : TileId.Wall;
  const zeroFlow = new Uint8Array(synthetic.length);
  field = computeFlowField({ terrain: synthetic, flow: zeroFlow, width: world.width, height: world.height, wallProximityPenaltyWeight: 0 }, goalAnchors);
  world.vehicleFlowFields.set(key, field);
  return field;
}

function sampleDwellS(world: World, vehicleType: VehicleType): number {
  const dist = world.demand.vehicleTypes[vehicleType].dwellS;
  return Math.max(10, lognormalSample(world.rng, dist.params.value[0], dist.params.value[1] ?? 0.4));
}

export function spawnVehicles(world: World, arrivals: VehicleArrival[]) {
  const entrances = world.layout.objects.filter((o) => o.kind === 'entrance' && (o.type === 'veh_in' || o.type === 'veh_both'));
  if (entrances.length === 0) return;
  for (const arrival of arrivals) {
    const entrance = arrival.entranceId != null ? entrances.find((e) => e.id === arrival.entranceId) : entrances[0];
    if (!entrance || entrance.kind !== 'entrance') continue;
    const [fw, fh] = world.demand.vehicleTypes[arrival.type].footprintCells;
    const anchorCell = entrance.cells[0];
    const anchorX = Math.max(0, Math.min(world.width - fw, anchorCell.x));
    const anchorY = Math.max(0, Math.min(world.height - fh, anchorCell.y));
    const cells = footprintCells(anchorX, anchorY, fw, fh, world.width);
    if (cells.some((c) => world.vehicleOccupant[c] !== -1 || world.occupantAgentId[c] !== -1)) continue; // gate blocked this tick

    const id = world.nextVehicleId++;
    const vehicle: Vehicle = {
      id,
      kind: 'vehicle',
      vehicleType: arrival.type,
      footprintW: fw,
      footprintH: fh,
      anchorX,
      anchorY,
      cells,
      state: 'APPROACH',
      targetBayId: null,
      dwellRemainingS: 0,
      waitTicks: 0,
      budget: 0,
      spawnT: world.t,
      despawnT: null,
      failedUnload: false,
      assignedStallId: arrival.stallId,
    };
    for (const c of cells) world.vehicleOccupant[c] = id;
    world.vehicles.set(id, vehicle);
    world.vehicleMetrics.spawned++;
    assignBay(world, vehicle);
  }
}

function assignBay(world: World, vehicle: Vehicle) {
  if (vehicle.assignedStallId != null) {
    for (const runtime of world.bays.values()) {
      if (runtime.bay.assignedStallId === vehicle.assignedStallId && runtime.occupiedByVehicleId == null) {
        runtime.occupiedByVehicleId = vehicle.id;
        vehicle.targetBayId = runtime.bay.id;
        return;
      }
    }
  }
  let best: BayRuntime | null = null;
  let bestDist = Infinity;
  for (const runtime of world.bays.values()) {
    if (runtime.occupiedByVehicleId != null) continue;
    const dist = Math.hypot(runtime.bay.cells[0].x - vehicle.anchorX, runtime.bay.cells[0].y - vehicle.anchorY);
    if (dist < bestDist) {
      bestDist = dist;
      best = runtime;
    }
  }
  if (best) {
    best.occupiedByVehicleId = vehicle.id;
    vehicle.targetBayId = best.bay.id;
  }
}

function vehicleExitAnchors(world: World): number[] {
  const exits = world.layout.objects.filter((o) => o.kind === 'entrance' && (o.type === 'veh_out' || o.type === 'veh_both'));
  return exits.flatMap((e) => (e.kind === 'entrance' ? e.cells.map((c) => idx(Math.min(c.x, world.width - 1), Math.min(c.y, world.height - 1), world.width)) : []));
}

export function decideVehicle(world: World, v: Vehicle): boolean {
  switch (v.state) {
    case 'APPROACH': {
      if (v.targetBayId == null) {
        assignBay(world, v);
        if (v.targetBayId == null) {
          if (v.waitTicks * world.dt > world.params.vehicleMaxWaitS.value) {
            v.failedUnload = true;
            v.state = 'DEPART';
            return true;
          }
          v.waitTicks++;
          return false;
        }
      }
      const bayRuntime = world.bays.get(v.targetBayId!);
      if (bayRuntime && v.anchorX === bayRuntime.anchor % world.width && v.anchorY === Math.floor(bayRuntime.anchor / world.width)) {
        v.state = 'DWELL';
        v.dwellRemainingS = sampleDwellS(world, v.vehicleType);
        return false;
      }
      if (v.waitTicks * world.dt > world.params.vehicleMaxWaitS.value) {
        v.failedUnload = true;
        if (bayRuntime && bayRuntime.occupiedByVehicleId === v.id) bayRuntime.occupiedByVehicleId = null;
        v.targetBayId = null;
        v.state = 'DEPART';
        return true;
      }
      return true;
    }
    case 'DWELL': {
      v.dwellRemainingS -= world.dt;
      if (v.dwellRemainingS <= 0) {
        const bayRuntime = v.targetBayId != null ? world.bays.get(v.targetBayId) : undefined;
        if (bayRuntime && bayRuntime.occupiedByVehicleId === v.id) bayRuntime.occupiedByVehicleId = null;
        v.state = 'DEPART';
        return true;
      }
      return false;
    }
    case 'DEPART': {
      const exitCells = new Set(vehicleExitAnchors(world));
      if (exitCells.has(idx(v.anchorX, v.anchorY, world.width))) {
        v.state = 'DESPAWNED';
        v.despawnT = world.t;
        world.vehicleMetrics.despawned++;
        if (v.failedUnload) world.vehicleMetrics.failedUnloads++;
        return false;
      }
      return true;
    }
    case 'DESPAWNED':
      return false;
  }
}

export function proposeVehicleMove(world: World, v: Vehicle): { anchorX: number; anchorY: number } | null {
  const speed = world.demand.vehicleTypes[v.vehicleType].speedMps.value;
  v.budget += speed / world.cellSizeM * world.dt;
  if (v.budget < 1) return null;

  let goalId: string;
  let goalAnchors: number[];
  if (v.state === 'APPROACH' && v.targetBayId != null) {
    const bayRuntime = world.bays.get(v.targetBayId);
    goalId = `bay:${v.targetBayId}`;
    goalAnchors = bayRuntime ? [bayRuntime.anchor] : [];
  } else if (v.state === 'DEPART') {
    goalId = 'vehexit';
    goalAnchors = vehicleExitAnchors(world);
  } else {
    return null;
  }
  if (goalAnchors.length === 0) return null;

  const field = vehicleFlowField(world, v.vehicleType, goalId, goalAnchors);
  const currentAnchor = idx(v.anchorX, v.anchorY, world.width);
  const currentField = field[currentAnchor];
  let best: { ax: number; ay: number; f: number } | null = null;
  for (const nb of NEIGHBOR_8) {
    const ax = v.anchorX + nb.x;
    const ay = v.anchorY + nb.y;
    if (!inBounds(ax, ay, world.width - v.footprintW + 1, world.height - v.footprintH + 1)) continue;
    const f = field[idx(ax, ay, world.width)];
    if (!Number.isFinite(f)) continue;
    if (best == null || f < best.f) best = { ax, ay, f };
  }
  if (!best || best.f >= currentField) {
    v.waitTicks++;
    return null;
  }
  const destCells = footprintCells(best.ax, best.ay, v.footprintW, v.footprintH, world.width);
  const blocked = destCells.some((c) => {
    if (v.cells.includes(c)) return false; // cell it already occupies
    return world.occupantAgentId[c] !== -1 || world.vehicleOccupant[c] !== -1;
  });
  if (blocked) {
    v.waitTicks++;
    return null;
  }
  v.waitTicks = 0;
  v.budget -= 1;
  return { anchorX: best.ax, anchorY: best.ay };
}

export function applyVehicleMove(world: World, v: Vehicle, next: { anchorX: number; anchorY: number }) {
  for (const c of v.cells) world.vehicleOccupant[c] = -1;
  v.anchorX = next.anchorX;
  v.anchorY = next.anchorY;
  v.cells = footprintCells(next.anchorX, next.anchorY, v.footprintW, v.footprintH, world.width);
  for (const c of v.cells) world.vehicleOccupant[c] = v.id;
}

export function pointsNearVehicle(v: Vehicle, cell: number, width: number, radiusCells: number): boolean {
  const cx = cell % width;
  const cy = Math.floor(cell / width);
  for (const c of v.cells) {
    const vx = c % width;
    const vy = Math.floor(c / width);
    if (Math.hypot(vx - cx, vy - cy) <= radiusCells) return true;
  }
  return false;
}

/**
 * A conflict (section 9.7) is logged once a pedestrian has stayed within
 * `vehicleConflictDistCells` of the same *moving* vehicle for at least
 * `vehicleConflictDurationS`, then the pair's counter resets so the same
 * encounter isn't re-logged every tick it continues.
 */
export function detectVehicleConflicts(world: World) {
  const radius = world.params.vehicleConflictDistCells.value;
  const thresholdTicks = Math.max(1, Math.round(world.params.vehicleConflictDurationS.value / world.dt));
  const seenPairs = new Set<string>();

  for (const v of world.vehicles.values()) {
    if (v.state !== 'APPROACH' && v.state !== 'DEPART') continue;
    for (const buyer of world.agents.values()) {
      if (!pointsNearVehicle(v, buyer.cell, world.width, radius)) continue;
      const key = `${buyer.id}:${v.id}`;
      seenPairs.add(key);
      const count = (world.conflictProximityTicks.get(key) ?? 0) + 1;
      if (count >= thresholdTicks) {
        world.vehicleMetrics.conflicts++;
        world.heat.conflictCount[buyer.cell]++;
        world.conflictProximityTicks.set(key, 0);
      } else {
        world.conflictProximityTicks.set(key, count);
      }
    }
  }
  // pairs no longer in proximity stop accumulating
  for (const key of world.conflictProximityTicks.keys()) {
    if (!seenPairs.has(key)) world.conflictProximityTicks.delete(key);
  }
}
