import { describe, expect, it } from 'vitest';
import { createEmptyLayout } from '../src/data/defaults';
import { TileId, assumed } from '../src/data/schema';
import type { Entrance, Stall } from '../src/data/schema';
import { computeLintWarnings } from '../src/editor/layoutLinter';

const W = 20;
const H = 20;

function idx(x: number, y: number) {
  return y * W + x;
}

describe('layout linter', () => {
  it('flags a layout with no entrance and no exit', () => {
    const layout = createEmptyLayout(W, H);
    const warnings = computeLintWarnings(layout, W, H);
    expect(warnings.some((w) => w.id === 'no-entrance')).toBe(true);
    expect(warnings.some((w) => w.id === 'no-exit')).toBe(true);
  });

  it('flags a stall walled off from every entrance', () => {
    const layout = createEmptyLayout(W, H);
    const entrance: Entrance = { kind: 'entrance', id: 1, cells: [{ x: 0, y: 10 }], type: 'ped_both', weight: assumed(1) };
    // wall off a 3x3 pocket containing the stall's frontage
    for (let x = 15; x <= 17; x++) {
      for (let y = 9; y <= 11; y++) layout.terrain[idx(x, y)] = TileId.Wall;
    }
    layout.terrain[idx(16, 10)] = TileId.OpenGround; // one open pocket cell, still enclosed by walls
    const stall: Stall = {
      kind: 'stall',
      id: 2,
      cells: [{ x: 16, y: 10 }],
      frontEdge: 'N',
      frontCells: [{ x: 16, y: 9 }],
      produce: ['mixed_other'],
      sellerType: 'unknown',
      attractiveness: assumed(1),
      maxConcurrentCustomers: 1,
      shaded: false,
      locked: false,
    };
    layout.objects = [entrance, stall];
    const warnings = computeLintWarnings(layout, W, H);
    expect(warnings.some((w) => w.id === `stall-unreachable-${stall.id}`)).toBe(true);
  });

  it('flags two overlapping entrances', () => {
    const layout = createEmptyLayout(W, H);
    const a: Entrance = { kind: 'entrance', id: 1, cells: [{ x: 5, y: 5 }, { x: 6, y: 5 }], type: 'ped_in', weight: assumed(1) };
    const b: Entrance = { kind: 'entrance', id: 2, cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }], type: 'ped_out', weight: assumed(1) };
    layout.objects = [a, b];
    const warnings = computeLintWarnings(layout, W, H);
    expect(warnings.some((w) => w.id === 'entrance-overlap-1-2')).toBe(true);
  });

  it('flags an arrow pointing into a wall', () => {
    const layout = createEmptyLayout(W, H);
    layout.terrain[idx(5, 5)] = TileId.OpenGround;
    layout.terrain[idx(6, 5)] = TileId.Wall;
    layout.flow[idx(5, 5)] = 3; // East, straight into the wall at (6,5)
    const warnings = computeLintWarnings(layout, W, H);
    expect(warnings.some((w) => w.id === 'arrow-into-wall')).toBe(true);
  });

  it('reports no warnings for a trivially valid tiny layout', () => {
    const layout = createEmptyLayout(W, H);
    const inE: Entrance = { kind: 'entrance', id: 1, cells: [{ x: 0, y: 10 }], type: 'ped_in', weight: assumed(1) };
    const outE: Entrance = { kind: 'entrance', id: 2, cells: [{ x: 19, y: 10 }], type: 'ped_out', weight: assumed(1) };
    layout.objects = [inE, outE];
    const warnings = computeLintWarnings(layout, W, H);
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });
});
