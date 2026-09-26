import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../src/data/defaults';
import { deserializeProject, serializeProject } from '../src/data/io';
import { TileId } from '../src/data/schema';

describe('save/load round trip', () => {
  it('yields an identical layout and parameters', () => {
    const project = createBlankProject('Test Mandi', 20, 10);
    // paint a few cells so the arrays are not all-zero
    project.baseline.terrain[5] = TileId.Path;
    project.baseline.terrain[42] = TileId.Wall;
    project.baseline.flow[7] = 3;
    project.baseline.objects.push({
      kind: 'entrance',
      id: 1,
      cells: [{ x: 0, y: 0 }],
      type: 'ped_in',
      weight: { value: 1, source: 'assumed' },
    });

    const json = serializeProject(project);
    const restored = deserializeProject(json);

    expect(restored.schemaVersion).toBe(project.schemaVersion);
    expect(restored.grid).toEqual(project.grid);
    expect(Array.from(restored.baseline.terrain)).toEqual(Array.from(project.baseline.terrain));
    expect(Array.from(restored.baseline.flow)).toEqual(Array.from(project.baseline.flow));
    expect(restored.baseline.objects).toEqual(project.baseline.objects);
    expect(restored.params).toEqual(project.params);
    expect(restored.demand.pedArrivalsPerBin.value).toEqual(project.demand.pedArrivalsPerBin.value);
  });
});
