// Heat-map overlays (SPEC.md sections 10.1, 11.2).

import { LOS_RAMP } from './palettes';
import type { Viewport } from './renderTiles';
import { cellToScreen } from './renderTiles';

export function losForDensity(densityPerM2: number): { color: string; grade: string } {
  const areaPerPerson = densityPerM2 > 0 ? 1 / densityPerM2 : Infinity;
  for (const band of LOS_RAMP) {
    if (areaPerPerson <= band.max) return band;
  }
  return LOS_RAMP[LOS_RAMP.length - 1];
}

function sequentialColor(t: number): string {
  // light yellow -> orange -> dark red, t in [0,1]
  const stops: [number, number, number][] = [
    [255, 255, 204],
    [254, 178, 76],
    [227, 26, 28],
    [128, 0, 38],
  ];
  const scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const frac = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * frac);
  const g = Math.round(a[1] + (b[1] - a[1]) * frac);
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
  return `rgb(${r},${g},${bl})`;
}

export type HeatKind = 'density' | 'footfall' | 'stuck';

export function drawHeatOverlay(ctx: CanvasRenderingContext2D, kind: HeatKind, values: Float32Array, width: number, height: number, viewport: Viewport, opacity: number) {
  let max = 0;
  if (kind !== 'density') {
    for (const v of values) if (v > max) max = v;
    if (max <= 0) max = 1;
  }
  const z = viewport.zoom;
  ctx.globalAlpha = opacity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = values[y * width + x];
      if (v <= 0) continue;
      const color = kind === 'density' ? losForDensity(v).color : sequentialColor(v / max);
      const p = cellToScreen(viewport, x, y);
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, z, z);
    }
  }
  ctx.globalAlpha = 1;
}
