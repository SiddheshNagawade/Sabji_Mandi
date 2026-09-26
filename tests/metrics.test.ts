import { describe, expect, it } from 'vitest';
import { buildOccupancyGrid, densityFromSmoothed, peakDensity, smoothOccupancy3x3 } from '../src/metrics/collectors';
import { countProvenance } from '../src/data/provenance';
import { createBlankProject } from '../src/data/defaults';

describe('metrics/collectors', () => {
  it('builds an occupancy grid from flattened positions', () => {
    // two agents at (2,3) and (2,3) again, one at (0,0)
    const positions = new Float32Array([2, 3, 0, 0, 2, 3, 0, 0, 0, 0, 0, 0]);
    const grid = buildOccupancyGrid(positions, 5, 5);
    expect(grid[3 * 5 + 2]).toBe(2);
    expect(grid[0]).toBe(1);
  });

  it('smooths occupancy over a 3x3 block', () => {
    const grid = new Uint16Array(5 * 5);
    grid[2 * 5 + 2] = 9; // a single busy cell in the middle
    const smoothed = smoothOccupancy3x3(grid, 5, 5);
    // the centre cell's own smoothed value should be less than the raw 9 (averaged over 9 neighbours)
    expect(smoothed[2 * 5 + 2]).toBeCloseTo(1, 1);
    expect(smoothed[2 * 5 + 2]).toBeGreaterThan(0);
  });

  it('converts smoothed occupancy to people/m^2', () => {
    const smoothed = new Float32Array([4]);
    const density = densityFromSmoothed(smoothed, 0.5); // 0.25 m^2 cells
    expect(density[0]).toBeCloseTo(16, 5);
  });

  it('peakDensity finds the most crowded spot', () => {
    const positions = new Float32Array([1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0]);
    const d = peakDensity(positions, 5, 5, 0.5);
    expect(d).toBeGreaterThan(0);
  });
});

describe('data/provenance', () => {
  it('counts every parameter as assumed in a fresh blank project', () => {
    const project = createBlankProject('Prov', 10, 10);
    const counts = countProvenance(project);
    expect(counts.measured).toBe(0);
    expect(counts.literature).toBe(0);
    expect(counts.assumed).toBeGreaterThan(0);
  });

  it('picks up a measured override', () => {
    const project = createBlankProject('Prov2', 10, 10);
    project.grid.cellSizeM = { ...project.grid.cellSizeM, source: 'measured' };
    const counts = countProvenance(project);
    expect(counts.measured).toBe(1);
  });
});
