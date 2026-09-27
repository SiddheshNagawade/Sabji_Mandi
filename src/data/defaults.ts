// Default ("assumed") parameter values. See SPEC.md section 8.4.
// Every value here is a [PLACEHOLDER]: none is a measurement.

import { assumed } from './schema';
import type { CalibrationSet, Demand, Layout, Project, SimParams } from './schema';
import { SCHEMA_VERSION } from './schema';

// A new project starts small and chunky at the default 32px/cell zoom, then
// grows to the right/down as you draw near its edge (see editor/growGrid.ts).
// One cell is one metre, so the grid dimensions read directly as the size of
// the real market in metres.
export const DEFAULT_GRID_WIDTH = 16;
export const DEFAULT_GRID_HEIGHT = 12;
export const DEFAULT_CELL_SIZE_M = 1.0;

export function createEmptyLayout(width: number, height: number): Layout {
  const n = width * height;
  return {
    terrain: new Uint8Array(n),
    object: new Uint16Array(n),
    flow: new Uint8Array(n),
    flowGroup: new Uint8Array(n),
    zone: new Uint8Array(n),
    shade: new Uint8Array(n),
    locked: new Uint8Array(n),
    objects: [],
    phases: [],
    arrowGroups: [],
  };
}

export function defaultSimParams(seed = 1): SimParams {
  return {
    tickS: assumed(0.25, 's'),
    cellSizeM: assumed(DEFAULT_CELL_SIZE_M, 'm'),
    arrowComplianceFrac: assumed(1.0, 'frac', 'default: assume full compliance until set otherwise'),
    arrivalRateMultiplier: assumed(1.0, 'x'),
    wetPatchSpeedFactor: assumed(0.6, 'x'),
    deadlockThresholdS: assumed(20, 's'),
    swapProbability: assumed(0.3, 'per blocked tick after threshold'),
    sidestepThreshold: 8, // ticks (~2s at dt=0.25)
    sidestepProbability: assumed(0.5, 'frac'),
    crowdSlowdownKappa: assumed(0.6, ''),
    crowdSlowdownMinFactor: assumed(0.15, ''),
    occupancyPenaltyWeight: assumed(2.0, ''),
    densityPenaltyWeight: assumed(3.0, ''),
    wallProximityPenalty: assumed(0.1, ''),
    choiceWeights: {
      pathCost: assumed(1.0, ''),
      queueAhead: assumed(0.5, ''),
      localCrowd: assumed(0.5, ''),
      attractiveness: assumed(1.0, ''),
      noiseTemp: assumed(0.3, ''),
    },
    vehicleConflictDistCells: assumed(2, 'cells'),
    vehicleConflictDurationS: assumed(2, 's'),
    vehicleMaxWaitS: assumed(180, 's'),
    seed,
  };
}

export function defaultDemand(): Demand {
  return {
    simStartS: 5 * 3600,
    simEndSpawnS: 10 * 3600,
    hardStopS: 11 * 3600,
    binMinutes: 10,
    pedArrivalsPerBin: assumed(
      new Array(36).fill(0).map((_, i) => {
        // a mild single peak around bin 12 (~07:00), purely illustrative
        const peak = 12;
        const spread = 8;
        const base = 20;
        const amp = 60;
        return Math.round(base + amp * Math.exp(-((i - peak) ** 2) / (2 * spread * spread)));
      }),
      'buyers/10min',
      'synthetic placeholder curve; replace with entrance tallies',
    ),
    buyerTypes: [
      {
        id: 'quick',
        label: 'Quick',
        share: assumed(0.3, 'frac'),
        listSize: assumed([2, 3]),
        walkSpeedMps: assumed(1.1, 'm/s'),
        serviceScale: assumed(0.8, 'x'),
        patienceS: assumed(90, 's'),
      },
      {
        id: 'regular',
        label: 'Regular',
        share: assumed(0.5, 'frac'),
        listSize: assumed([4, 6]),
        walkSpeedMps: assumed(1.1, 'm/s'),
        serviceScale: assumed(1.0, 'x'),
        patienceS: assumed(90, 's'),
      },
      {
        id: 'bulk',
        label: 'Bulk',
        share: assumed(0.2, 'frac'),
        listSize: assumed([7, 10]),
        walkSpeedMps: assumed(1.0, 'm/s'),
        serviceScale: assumed(1.3, 'x'),
        patienceS: assumed(120, 's'),
      },
    ],
    serviceTimeByProduce: {
      leafy: { kind: 'lognormal', params: assumed([45, 0.4]) },
      root_tuber: { kind: 'lognormal', params: assumed([45, 0.4]) },
      fruit_veg: { kind: 'lognormal', params: assumed([45, 0.4]) },
      gourd_beans: { kind: 'lognormal', params: assumed([45, 0.4]) },
      herbs_spices: { kind: 'lognormal', params: assumed([40, 0.4]) },
      fruit: { kind: 'lognormal', params: assumed([45, 0.4]) },
      mixed_other: { kind: 'lognormal', params: assumed([45, 0.4]) },
    },
    vehicleSchedule: [],
    vehicleTypes: {
      handcart: { footprintCells: [2, 4], speedMps: assumed(0.8, 'm/s'), dwellS: { kind: 'lognormal', params: assumed([300, 0.4]) } },
      two_wheeler: { footprintCells: [1, 4], speedMps: assumed(0.8, 'm/s'), dwellS: { kind: 'lognormal', params: assumed([120, 0.4]) } },
      tempo: { footprintCells: [4, 10], speedMps: assumed(0.8, 'm/s'), dwellS: { kind: 'lognormal', params: assumed([600, 0.4]) } },
    },
  };
}

export function defaultCalibration(): CalibrationSet {
  return {
    observed: [],
    toleranceFrac: assumed(0.25, 'frac'),
    lastRunStatus: 'not_validated',
  };
}

export function createBlankProject(name = 'Untitled Mandi', width = DEFAULT_GRID_WIDTH, height = DEFAULT_GRID_HEIGHT): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    meta: { name, createdAt: now, updatedAt: now },
    grid: { width, height, cellSizeM: assumed(DEFAULT_CELL_SIZE_M, 'm') },
    baseline: createEmptyLayout(width, height),
    interventions: [],
    scenarios: [{ id: 'baseline', name: 'Baseline', interventionIds: [], isBaseline: true, locked: true }],
    demand: defaultDemand(),
    params: defaultSimParams(),
    snapshots: [],
    calibration: defaultCalibration(),
  };
}
