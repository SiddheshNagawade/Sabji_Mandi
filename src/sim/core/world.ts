// The simulation World: a run's mutable state. Built once from a Project +
// scenario + seed (SPEC.md section 9), then advanced tick by tick by
// src/sim/core/tick.ts. No DOM, no React — must run in a worker or Vitest.

import type { BuyerType, Demand, Entrance, ProduceCategory, Project, SimParams, Stall } from '../../data/schema';
import { mulberry32 } from './rng';
import type { Rng } from './rng';
import { FlowFieldCache } from './flowfield';
import { idx } from './walkable';

export type BuyerState = 'WALK' | 'WAIT_FOR_SLOT' | 'BEING_SERVED' | 'LEAVE' | 'DESPAWNED';
export type SkipReason = 'queue' | 'blocked';

export interface Buyer {
  id: number;
  kind: 'buyer';
  state: BuyerState;
  x: number; // continuous position, cell units (for smooth rendering)
  y: number;
  cell: number; // discrete cell index, kept in sync with x/y
  budget: number;
  speedMps: number;
  obeysArrows: boolean;
  buyerTypeId: string;
  list: ProduceCategory[];
  listIndex: number;
  patienceS: number;
  waitElapsedS: number;
  blockedTicks: number;
  targetStallId: number | null;
  serviceRemainingS: number;
  spawnT: number;
  despawnT: number | null;
  cellsWalked: number;
  shortestPathAtChoice: number;
  lastSkipReason: SkipReason | null;
}

export interface StallRuntime {
  stall: Stall;
  frontCellIndices: number[];
  slots: number;
  waitingOrServedIds: Set<number>;
  servedIds: Set<number>;
  servedCount: number;
  visits: number;
  lostVisits: { queue: number; blocked: number };
}

export interface HeatAccumulators {
  occupancySeconds: Float32Array; // person-seconds per cell
  passCount: Float32Array; // distinct entries per cell
  stuckSeconds: Float32Array; // person-seconds below 30% free speed per cell
}

export interface RunMetrics {
  spawned: number;
  despawned: number;
  skipped: { queue: number; blocked: number };
  timesInMarket: number[]; // seconds, one per despawned buyer
}

export class World {
  readonly width: number;
  readonly height: number;
  readonly cellSizeM: number;
  readonly dt: number;
  readonly terrain: Uint8Array;
  readonly flow: Uint8Array;
  readonly entrancesIn: Entrance[];
  readonly entrancesOut: Entrance[];
  readonly stalls: Map<number, StallRuntime> = new Map();
  readonly stallsByProduce: Map<ProduceCategory, StallRuntime[]> = new Map();
  readonly demand: Demand;
  readonly params: SimParams;
  readonly rng: Rng;
  readonly seed: number;
  readonly flowFields: FlowFieldCache;
  readonly heat: HeatAccumulators;
  readonly metrics: RunMetrics = { spawned: 0, despawned: 0, skipped: { queue: 0, blocked: 0 }, timesInMarket: [] };

  t: number;
  agents: Map<number, Buyer> = new Map();
  nextAgentId = 1;
  occupantAgentId: Int32Array; // -1 = empty, else the occupying agent's id
  stationaryMask: Uint8Array;

  constructor(project: Project, seed: number) {
    const layout = project.baseline;
    this.width = project.grid.width;
    this.height = project.grid.height;
    this.cellSizeM = project.grid.cellSizeM.value;
    this.dt = project.params.tickS.value;
    this.terrain = layout.terrain;
    this.flow = layout.flow;
    this.demand = project.demand;
    this.params = project.params;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.t = project.demand.simStartS;

    const n = this.width * this.height;
    this.occupantAgentId = new Int32Array(n).fill(-1);
    this.stationaryMask = new Uint8Array(n);
    this.heat = {
      occupancySeconds: new Float32Array(n),
      passCount: new Float32Array(n),
      stuckSeconds: new Float32Array(n),
    };

    this.entrancesIn = layout.objects.filter((o): o is Entrance => o.kind === 'entrance' && (o.type === 'ped_in' || o.type === 'ped_both'));
    this.entrancesOut = layout.objects.filter((o): o is Entrance => o.kind === 'entrance' && (o.type === 'ped_out' || o.type === 'ped_both'));

    for (const o of layout.objects) {
      if (o.kind !== 'stall') continue;
      const frontCellIndices = o.frontCells.filter((c) => c.x >= 0 && c.y >= 0 && c.x < this.width && c.y < this.height).map((c) => idx(c.x, c.y, this.width));
      const runtime: StallRuntime = {
        stall: o,
        frontCellIndices,
        slots: Math.max(1, o.maxConcurrentCustomers),
        waitingOrServedIds: new Set(),
        servedIds: new Set(),
        servedCount: 0,
        visits: 0,
        lostVisits: { queue: 0, blocked: 0 },
      };
      this.stalls.set(o.id, runtime);
      for (const p of o.produce) {
        const arr = this.stallsByProduce.get(p) ?? [];
        arr.push(runtime);
        this.stallsByProduce.set(p, arr);
      }
    }

    this.flowFields = new FlowFieldCache({
      terrain: this.terrain,
      flow: this.flow,
      width: this.width,
      height: this.height,
      wallProximityPenaltyWeight: project.params.wallProximityPenalty.value,
    });
  }

  buyerType(id: string): BuyerType {
    return this.demand.buyerTypes.find((b) => b.id === id) ?? this.demand.buyerTypes[0];
  }

  /** Poisson-distributed arrivals for this tick, from the current 10-min bin's rate (section 9.3). */
  arrivalsThisTick(poisson: (lambda: number) => number): number {
    const bins = this.demand.pedArrivalsPerBin.value;
    const binS = this.demand.binMinutes * 60;
    const elapsed = this.t - this.demand.simStartS;
    const binIndex = Math.floor(elapsed / binS);
    const rate = bins[Math.min(Math.max(binIndex, 0), bins.length - 1)] ?? 0;
    const perSecond = rate / binS;
    const lambda = perSecond * this.dt * this.params.arrivalRateMultiplier.value;
    return poisson(lambda);
  }
}
