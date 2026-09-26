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
});
