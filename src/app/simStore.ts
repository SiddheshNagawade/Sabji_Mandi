import { create } from 'zustand';
import type { Project } from '../data/schema';
import type { AgentDetail, CellDetail, StallDetail, WorkerMessage } from '../sim/worker/protocol';
import { peakDensity } from '../metrics/collectors';

export type HeatMode = 'agents' | 'density' | 'footfall' | 'stuck';

export interface MetricsSample {
  t: number;
  peopleInMarket: number;
  spawned: number;
  despawned: number;
  skippedTotal: number;
  peakDensity: number;
}

interface InspectState {
  kind: 'agent' | 'stall' | 'cell';
  id: number | string;
  detail: AgentDetail | StallDetail | CellDetail | null;
}

interface SimState {
  worker: Worker | null;
  status: 'idle' | 'running' | 'paused' | 'done';
  speed: number;
  seed: number;
  t: number;
  simStartS: number;
  simEndSpawnS: number;
  hardStopS: number;
  gridWidth: number;
  gridHeight: number;
  cellSizeM: number;
  positions: Float32Array;
  agentIds: Int32Array;
  heat: { occupancySeconds: Float32Array; passCount: Float32Array; stuckSeconds: Float32Array } | null;
  metrics: { peopleInMarket: number; spawned: number; despawned: number; skippedQueue: number; skippedBlocked: number };
  metricsHistory: MetricsSample[];
  doneInfo: { timesInMarket: number[] } | null;
  heatMode: HeatMode;
  showTrails: boolean;
  complianceOverride: number;
  arrivalMultiplierOverride: number;
  inspect: InspectState | null;
  error: string | null;

  init: (project: Project, seed?: number) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (mult: number) => void;
  seek: (t: number) => void;
  restart: (project: Project, newSeed?: boolean) => void;
  setHeatMode: (mode: HeatMode) => void;
  toggleTrails: () => void;
  setComplianceOverride: (v: number) => void;
  setArrivalMultiplierOverride: (v: number) => void;
  inspectAgent: (id: number) => void;
  inspectStall: (id: number) => void;
  inspectCell: (x: number, y: number) => void;
  clearInspect: () => void;
  terminate: () => void;
}

function withOverrides(project: Project, compliance: number, arrivalMult: number): Project {
  return {
    ...project,
    params: {
      ...project.params,
      arrowComplianceFrac: { ...project.params.arrowComplianceFrac, value: compliance },
      arrivalRateMultiplier: { ...project.params.arrivalRateMultiplier, value: arrivalMult },
    },
  };
}

export const useSimStore = create<SimState>((set, get) => ({
  worker: null,
  status: 'idle',
  speed: 1,
  seed: 1,
  t: 0,
  simStartS: 0,
  simEndSpawnS: 0,
  hardStopS: 0,
  gridWidth: 1,
  gridHeight: 1,
  cellSizeM: 0.5,
  positions: new Float32Array(0),
  agentIds: new Int32Array(0),
  heat: null,
  metrics: { peopleInMarket: 0, spawned: 0, despawned: 0, skippedQueue: 0, skippedBlocked: 0 },
  metricsHistory: [],
  doneInfo: null,
  heatMode: 'agents',
  showTrails: false,
  complianceOverride: 1,
  arrivalMultiplierOverride: 1,
  inspect: null,
  error: null,

  init: (project, seed = 1) => {
    get().terminate();
    const worker = new Worker(new URL('../sim/worker/sim.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => handleMessage(set, get, e.data);
    worker.onerror = (e) => set({ error: e.message });
    set({
      worker,
      status: 'paused',
      seed,
      t: project.demand.simStartS,
      simStartS: project.demand.simStartS,
      simEndSpawnS: project.demand.simEndSpawnS,
      hardStopS: project.demand.hardStopS,
      gridWidth: project.grid.width,
      gridHeight: project.grid.height,
      cellSizeM: project.grid.cellSizeM.value,
      positions: new Float32Array(0),
      agentIds: new Int32Array(0),
      heat: null,
      metricsHistory: [],
      doneInfo: null,
      inspect: null,
      error: null,
    });
    const { complianceOverride, arrivalMultiplierOverride } = get();
    worker.postMessage({ type: 'init', project: withOverrides(project, complianceOverride, arrivalMultiplierOverride), scenarioId: 'baseline', seed });
  },

  play: () => {
    get().worker?.postMessage({ type: 'run' });
    set({ status: 'running' });
  },

  pause: () => {
    get().worker?.postMessage({ type: 'pause' });
    set({ status: 'paused' });
  },

  setSpeed: (mult) => {
    set({ speed: mult });
    get().worker?.postMessage({ type: 'setSpeed', multiplier: mult });
  },

  seek: (t) => {
    set({ status: 'paused', metricsHistory: [] });
    get().worker?.postMessage({ type: 'seek', simTimeS: t });
  },

  restart: (project, newSeed) => {
    const seed = newSeed ? Math.floor(Math.random() * 1_000_000) : get().seed;
    get().init(project, seed);
  },

  setHeatMode: (mode) => set({ heatMode: mode }),
  toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
  setComplianceOverride: (v) => set({ complianceOverride: v }),
  setArrivalMultiplierOverride: (v) => set({ arrivalMultiplierOverride: v }),

  inspectAgent: (id) => {
    set({ inspect: { kind: 'agent', id, detail: null } });
    get().worker?.postMessage({ type: 'inspectAgent', agentId: id });
  },
  inspectStall: (id) => {
    set({ inspect: { kind: 'stall', id, detail: null } });
    get().worker?.postMessage({ type: 'inspectStall', stallId: id });
  },
  inspectCell: (x, y) => {
    set({ inspect: { kind: 'cell', id: `${x},${y}`, detail: null } });
    get().worker?.postMessage({ type: 'inspectCell', x, y });
  },
  clearInspect: () => set({ inspect: null }),

  terminate: () => {
    get().worker?.terminate();
    set({ worker: null });
  },
}));

function handleMessage(set: (partial: Partial<SimState>) => void, get: () => SimState, msg: WorkerMessage) {
  switch (msg.type) {
    case 'frame':
      set({ t: msg.t, positions: msg.positions, agentIds: msg.agentIds, status: msg.running ? 'running' : get().status });
      break;
    case 'heat':
      set({ heat: { occupancySeconds: msg.occupancySeconds, passCount: msg.passCount, stuckSeconds: msg.stuckSeconds } });
      break;
    case 'metrics': {
      const state = get();
      const sample: MetricsSample = {
        t: msg.t,
        peopleInMarket: msg.peopleInMarket,
        spawned: msg.spawned,
        despawned: msg.despawned,
        skippedTotal: msg.skippedQueue + msg.skippedBlocked,
        peakDensity: peakDensity(state.positions, state.gridWidth, state.gridHeight, state.cellSizeM),
      };
      const history = state.metricsHistory;
      const next = [...history, sample];
      if (next.length > 600) next.shift();
      set({ metrics: { peopleInMarket: msg.peopleInMarket, spawned: msg.spawned, despawned: msg.despawned, skippedQueue: msg.skippedQueue, skippedBlocked: msg.skippedBlocked }, metricsHistory: next });
      break;
    }
    case 'done':
      set({ status: 'done', doneInfo: { timesInMarket: msg.timesInMarket } });
      break;
    case 'error':
      set({ error: msg.message });
      break;
    case 'agentDetail':
      if (get().inspect?.kind === 'agent' && get().inspect?.id === msg.agentId) {
        set({ inspect: { kind: 'agent', id: msg.agentId, detail: msg.found ? (msg.detail ?? null) : null } });
      }
      break;
    case 'stallDetail':
      if (get().inspect?.kind === 'stall' && get().inspect?.id === msg.stallId) {
        set({ inspect: { kind: 'stall', id: msg.stallId, detail: msg.found ? (msg.detail ?? null) : null } });
      }
      break;
    case 'cellDetail':
      if (get().inspect?.kind === 'cell' && get().inspect?.id === `${msg.x},${msg.y}`) {
        set({ inspect: { kind: 'cell', id: `${msg.x},${msg.y}`, detail: msg.detail } });
      }
      break;
  }
}
