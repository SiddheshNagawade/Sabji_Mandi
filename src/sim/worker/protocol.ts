// Worker message protocol (SPEC.md section 9.11).

import type { Project } from '../../data/schema';

export type WorkerCommand =
  | { type: 'init'; project: Project; scenarioId: string; seed: number }
  | { type: 'run' }
  | { type: 'pause' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'seek'; simTimeS: number }
  | { type: 'reset' }
  | { type: 'getStats' };

export interface FrameMessage {
  type: 'frame';
  t: number;
  /** [x, y, stateCode, blockedFlag] per agent, flattened. */
  positions: Float32Array;
  agentIds: Int32Array;
}

export interface HeatMessage {
  type: 'heat';
  occupancySeconds: Float32Array;
  passCount: Float32Array;
  stuckSeconds: Float32Array;
}

export interface MetricsMessage {
  type: 'metrics';
  t: number;
  peopleInMarket: number;
  spawned: number;
  despawned: number;
  skippedQueue: number;
  skippedBlocked: number;
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

export type WorkerMessage = FrameMessage | HeatMessage | MetricsMessage | DoneMessage | ErrorMessage;

export const BUYER_STATE_CODE: Record<string, number> = {
  WALK: 0,
  WAIT_FOR_SLOT: 1,
  BEING_SERVED: 2,
  LEAVE: 3,
  DESPAWNED: 4,
};
