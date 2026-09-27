// Thin entry point: wires the environment-agnostic SimRunner to this Web
// Worker's postMessage/onmessage. No logic lives here so the runner stays
// unit-testable outside a real worker (see runner.ts).

import { SimRunner } from './runner';
import type { WorkerCommand } from './protocol';

const runner = new SimRunner((msg) => {
  // Typed arrays are transferred, not copied, for the hot frame/heat paths.
  const transfer: Transferable[] = [];
  if (msg.type === 'frame') transfer.push(msg.positions.buffer, msg.agentIds.buffer, msg.vehiclePositions.buffer, msg.vehicleIds.buffer);
  if (msg.type === 'heat') transfer.push(msg.occupancySeconds.buffer, msg.passCount.buffer, msg.stuckSeconds.buffer, msg.vehicleBlockSeconds.buffer, msg.conflictCount.buffer);
  postMessage(msg, transfer.length > 0 ? { transfer } : undefined);
});

self.onmessage = (e: MessageEvent<WorkerCommand>) => runner.handle(e.data);
