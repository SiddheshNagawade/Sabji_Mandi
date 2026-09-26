import { describe, expect, it } from 'vitest';
import { createSyntheticExampleProject } from '../src/data/sampleProject';
import { computeLintWarnings } from '../src/editor/layoutLinter';

describe('synthetic example map', () => {
  const project = createSyntheticExampleProject();

  it('has roughly 40 stalls and the required gates', () => {
    const stalls = project.baseline.objects.filter((o) => o.kind === 'stall');
    const entrances = project.baseline.objects.filter((o) => o.kind === 'entrance');
    expect(stalls.length).toBeGreaterThanOrEqual(30);
    expect(stalls.length).toBeLessThanOrEqual(45);
    expect(entrances.some((e) => e.kind === 'entrance' && e.type === 'ped_in')).toBe(true);
    expect(entrances.some((e) => e.kind === 'entrance' && e.type === 'ped_out')).toBe(true);
  });

  it('has no linter errors', () => {
    const warnings = computeLintWarnings(project.baseline, project.grid.width, project.grid.height);
    const errors = warnings.filter((w) => w.severity === 'error');
    if (errors.length > 0) {
      console.log(errors.map((e) => e.message));
    }
    expect(errors).toHaveLength(0);
  });
});
