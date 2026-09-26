// Client-side derived metrics computed from the latest frame (SPEC.md
// section 10.1). The worker streams raw positions and cumulative heat
// accumulators; the *live* density heat map and the "peak density" chart
// are both built from the current frame here.
//
// Simplification vs. the spec text: density is computed from the current
// instantaneous frame smoothed over a 3x3 block, not a 30s rolling window
// (that would need the worker to keep and stream a time-windowed buffer).
// It is labelled "Simulated density (instantaneous)" in the UI rather than
// claiming the rolling-window definition.

export function buildOccupancyGrid(positions: Float32Array, width: number, height: number): Uint16Array {
  const grid = new Uint16Array(width * height);
  const count = positions.length / 4;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(positions[i * 4]);
    const y = Math.floor(positions[i * 4 + 1]);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    grid[y * width + x]++;
  }
  return grid;
}

/** Smooths a per-cell occupancy count over a 3x3 block, in people. */
export function smoothOccupancy3x3(grid: Uint16Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += grid[yy * width + xx];
          n++;
        }
      }
      out[y * width + x] = n > 0 ? sum / n : 0;
    }
  }
  return out;
}

/** People per m^2 for a smoothed-occupancy grid. */
export function densityFromSmoothed(smoothed: Float32Array, cellSizeM: number): Float32Array {
  const areaM2 = cellSizeM * cellSizeM;
  const out = new Float32Array(smoothed.length);
  for (let i = 0; i < smoothed.length; i++) out[i] = smoothed[i] / areaM2;
  return out;
}

export function peakDensity(positions: Float32Array, width: number, height: number, cellSizeM: number): number {
  const grid = buildOccupancyGrid(positions, width, height);
  const smoothed = smoothOccupancy3x3(grid, width, height);
  let max = 0;
  for (const v of smoothed) if (v > max) max = v;
  return max / (cellSizeM * cellSizeM);
}
