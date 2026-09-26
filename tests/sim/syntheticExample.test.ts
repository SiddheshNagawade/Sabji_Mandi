import { describe, expect, it } from 'vitest';
import { createSyntheticExampleProject } from '../../src/data/sampleProject';
import { World } from '../../src/sim/core/world';
import { step } from '../../src/sim/core/tick';

describe('sim core on the synthetic example map', () => {
  it('spawns buyers, walks them to stalls, serves them, and lets some leave', () => {
    const project = createSyntheticExampleProject();
    const world = new World(project, 123);

    const ticks = 4000; // ~1000 simulated seconds; enough to exercise the whole pipeline without a full 6h run
    for (let i = 0; i < ticks; i++) step(world);

    expect(world.metrics.spawned).toBeGreaterThan(0);
    expect(world.metrics.despawned).toBeGreaterThan(0);
    expect(world.metrics.spawned).toBe(world.metrics.despawned + world.agents.size);

    const totalServed = Array.from(world.stalls.values()).reduce((sum, s) => sum + s.servedCount + s.servedIds.size, 0);
    expect(totalServed).toBeGreaterThan(0);
  });
});
