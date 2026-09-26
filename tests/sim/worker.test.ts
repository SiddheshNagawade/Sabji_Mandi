import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../src/data/defaults';
import { assumed } from '../../src/data/schema';
import type { Entrance, Project } from '../../src/data/schema';
import { SimRunner } from '../../src/sim/worker/runner';
import type { WorkerMessage } from '../../src/sim/worker/protocol';

function tinyProject(): Project {
  const project = createBlankProject('WorkerTest', 20, 10);
  project.demand.pedArrivalsPerBin = assumed(new Array(50).fill(30));
  project.demand.hardStopS = project.demand.simStartS + 5; // finishes fast for the test
  const inE: Entrance = { kind: 'entrance', id: 1, cells: [{ x: 0, y: 5 }], type: 'ped_in', weight: assumed(1) };
  const outE: Entrance = { kind: 'entrance', id: 2, cells: [{ x: 19, y: 5 }], type: 'ped_out', weight: assumed(1) };
  project.baseline.objects.push(inE, outE);
  return project;
}

describe('SimRunner (worker logic, no real Worker needed)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts metrics on init, frames while running, and a done message on completion', () => {
    const messages: WorkerMessage[] = [];
    const runner = new SimRunner((m) => messages.push(m));

    runner.handle({ type: 'init', project: tinyProject(), scenarioId: 'baseline', seed: 1 });
    expect(messages.some((m) => m.type === 'metrics')).toBe(true);

    runner.handle({ type: 'run' });
    vi.advanceTimersByTime(2000); // well past hardStopS at any reasonable speed
    expect(messages.some((m) => m.type === 'frame')).toBe(true);
    expect(messages.some((m) => m.type === 'done')).toBe(true);
    expect(messages.some((m) => m.type === 'error')).toBe(false);
  });

  it('stops producing frames when paused', () => {
    const messages: WorkerMessage[] = [];
    const runner = new SimRunner((m) => messages.push(m));
    const project = tinyProject();
    project.demand.hardStopS = project.demand.simStartS + 3600; // don't let it finish on its own
    runner.handle({ type: 'init', project, scenarioId: 'baseline', seed: 1 });
    runner.handle({ type: 'run' });
    vi.advanceTimersByTime(200);
    const framesBeforePause = messages.filter((m) => m.type === 'frame').length;
    expect(framesBeforePause).toBeGreaterThan(0);

    runner.handle({ type: 'pause' });
    messages.length = 0;
    vi.advanceTimersByTime(500);
    expect(messages.filter((m) => m.type === 'frame')).toHaveLength(0);
  });

  it('seek deterministically reproduces the same state as running to that time normally', () => {
    const project = tinyProject();
    project.demand.hardStopS = project.demand.simStartS + 3600;

    const direct: WorkerMessage[] = [];
    const runnerA = new SimRunner((m) => direct.push(m));
    runnerA.handle({ type: 'init', project, scenarioId: 'baseline', seed: 5 });
    runnerA.handle({ type: 'run' });
    vi.advanceTimersByTime(1000); // run for a while
    runnerA.handle({ type: 'pause' });
    const midT = (direct.filter((m) => m.type === 'metrics').pop() as { t: number }).t;

    const seeked: WorkerMessage[] = [];
    const runnerB = new SimRunner((m) => seeked.push(m));
    runnerB.handle({ type: 'init', project, scenarioId: 'baseline', seed: 5 });
    runnerB.handle({ type: 'seek', simTimeS: midT });

    const frameA = [...direct].reverse().find((m) => m.type === 'frame') as { t: number; positions: Float32Array } | undefined;
    const frameB = [...seeked].reverse().find((m) => m.type === 'frame') as { t: number; positions: Float32Array } | undefined;
    expect(frameA).toBeDefined();
    expect(frameB).toBeDefined();
    expect(frameB!.t).toBeCloseTo(frameA!.t, 5);
    expect(Array.from(frameB!.positions)).toEqual(Array.from(frameA!.positions));
  });

  it('answers inspectAgent, inspectStall and inspectCell queries', () => {
    const messages: WorkerMessage[] = [];
    const runner = new SimRunner((m) => messages.push(m));
    const project = tinyProject();
    project.demand.hardStopS = project.demand.simStartS + 3600;
    const stall = {
      kind: 'stall' as const,
      id: 99,
      cells: [{ x: 10, y: 5 }],
      frontEdge: 'S' as const,
      frontCells: [{ x: 10, y: 6 }],
      produce: ['leafy' as const],
      sellerType: 'farmer' as const,
      attractiveness: assumed(1),
      maxConcurrentCustomers: 1,
      shaded: false,
      locked: false,
    };
    project.baseline.objects.push(stall);

    runner.handle({ type: 'init', project, scenarioId: 'baseline', seed: 2 });
    runner.handle({ type: 'run' });
    vi.advanceTimersByTime(300);
    runner.handle({ type: 'pause' });

    messages.length = 0;
    runner.handle({ type: 'inspectStall', stallId: 99 });
    const stallMsg = messages.find((m) => m.type === 'stallDetail') as { found: boolean } | undefined;
    expect(stallMsg?.found).toBe(true);

    runner.handle({ type: 'inspectCell', x: 10, y: 6 });
    const cellMsg = messages.find((m) => m.type === 'cellDetail');
    expect(cellMsg).toBeDefined();

    runner.handle({ type: 'inspectAgent', agentId: 999999 });
    const agentMsg = messages.find((m) => m.type === 'agentDetail') as { found: boolean } | undefined;
    expect(agentMsg?.found).toBe(false);
  });
});
