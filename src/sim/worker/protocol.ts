// Worker message protocol (SPEC.md section 9.11).

import type { Project, ProduceCategory, VehicleType } from '../../data/schema';

export type WorkerCommand =
  | { type: 'init'; project: Project; scenarioId: string; seed: number }
  | { type: 'run' }
  | { type: 'pause' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'seek'; simTimeS: number }
  | { type: 'reset' }
  | { type: 'getStats' }
  | { type: 'inspectAgent'; agentId: number }
  | { type: 'inspectStall'; stallId: number }
  | { type: 'inspectCell'; x: number; y: number }
  | { type: 'inspectVehicle'; vehicleId: number };

export interface FrameMessage {
  type: 'frame';
  t: number;
  /** [x, y, stateCode, blockedFlag] per agent, flattened. */
  positions: Float32Array;
  agentIds: Int32Array;
  /** [anchorX, anchorY, footprintW, footprintH, vehicleTypeCode, stateCode] per vehicle, flattened. */
  vehiclePositions: Float32Array;
  vehicleIds: Int32Array;
  running: boolean;
}

export interface HeatMessage {
  type: 'heat';
  occupancySeconds: Float32Array;
  passCount: Float32Array;
  stuckSeconds: Float32Array;
  vehicleBlockSeconds: Float32Array;
  conflictCount: Float32Array;
}

export interface MetricsMessage {
  type: 'metrics';
  t: number;
  peopleInMarket: number;
  spawned: number;
  despawned: number;
  skippedQueue: number;
  skippedBlocked: number;
  vehiclesInMarket: number;
  vehiclesSpawned: number;
  vehiclesDespawned: number;
  vehiclesFailedUnloads: number;
  vehicleConflicts: number;
}

export interface DoneMessage {
  type: 'done';
  finalMetrics: MetricsMessage;
  timesInMarket: number[];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface AgentDetail {
  id: number;
  state: string;
  buyerTypeId: string;
  list: ProduceCategory[];
  listIndex: number;
  targetStallId: number | null;
  speedMps: number;
  obeysArrows: boolean;
  blockedTicks: number;
  waitElapsedS: number;
  serviceRemainingS: number;
  cellsWalked: number;
  timeInMarketS: number;
  lastSkipReason: string | null;
}

export interface AgentDetailMessage {
  type: 'agentDetail';
  agentId: number;
  found: boolean;
  detail?: AgentDetail;
}

export interface StallDetail {
  id: number;
  label?: string;
  produce: ProduceCategory[];
  sellerType: string;
  visits: number;
  servedCount: number;
  currentlyServed: number;
  currentlyWaiting: number;
  lostVisitsQueue: number;
  lostVisitsBlocked: number;
  slots: number;
}

export interface StallDetailMessage {
  type: 'stallDetail';
  stallId: number;
  found: boolean;
  detail?: StallDetail;
}

export interface CellDetail {
  x: number;
  y: number;
  occupancySeconds: number;
  passCount: number;
  stuckSeconds: number;
  currentOccupantAgentId: number | null;
}

export interface CellDetailMessage {
  type: 'cellDetail';
  x: number;
  y: number;
  detail: CellDetail;
}

export interface VehicleDetail {
  id: number;
  vehicleType: VehicleType;
  state: string;
  targetBayId: number | null;
  dwellRemainingS: number;
  waitTicks: number;
  timeInMarketS: number;
  failedUnload: boolean;
}

export interface VehicleDetailMessage {
  type: 'vehicleDetail';
  vehicleId: number;
  found: boolean;
  detail?: VehicleDetail;
}

export type WorkerMessage = FrameMessage | HeatMessage | MetricsMessage | DoneMessage | ErrorMessage | AgentDetailMessage | StallDetailMessage | CellDetailMessage | VehicleDetailMessage;

export const BUYER_STATE_CODE: Record<string, number> = {
  WALK: 0,
  WAIT_FOR_SLOT: 1,
  BEING_SERVED: 2,
  LEAVE: 3,
  DESPAWNED: 4,
};

export const BUYER_STATE_NAME = ['walking', 'queuing', 'being served', 'leaving', 'despawned'];

export const VEHICLE_STATE_CODE: Record<string, number> = {
  APPROACH: 0,
  DWELL: 1,
  DEPART: 2,
  DESPAWNED: 3,
};
export const VEHICLE_STATE_NAME = ['approaching', 'dwelling', 'departing', 'despawned'];

export const VEHICLE_TYPE_CODE: Record<VehicleType, number> = {
  handcart: 0,
  two_wheeler: 1,
  tempo: 2,
};
export const VEHICLE_TYPE_NAME: VehicleType[] = ['handcart', 'two_wheeler', 'tempo'];
