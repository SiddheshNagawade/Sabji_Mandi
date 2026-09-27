// Pure viewport math shared between the canvas (which owns pan/wheel-zoom)
// and the Properties panel (which drives zoom via buttons/slider), so both
// operate on the same store-held Viewport rather than duplicating state.

import type { Viewport } from '../viz/renderTiles';

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 64;

export function fitToScreen(gridWidth: number, gridHeight: number, containerWidth: number, containerHeight: number): Viewport {
  // Prefer chunky ~32px cells; only shrink below that for a grid too big to fit.
  const zoom = Math.max(MIN_ZOOM, Math.min(containerWidth / gridWidth, containerHeight / gridHeight, 32));
  return {
    originX: (containerWidth - gridWidth * zoom) / 2,
    originY: (containerHeight - gridHeight * zoom) / 2,
    zoom,
  };
}

/** Zooms by `factor`, keeping the cell under screen point (px, py) fixed. */
export function zoomAroundPoint(viewport: Viewport, factor: number, px: number, py: number): Viewport {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
  const cellX = (px - viewport.originX) / viewport.zoom;
  const cellY = (py - viewport.originY) / viewport.zoom;
  return { zoom: newZoom, originX: px - cellX * newZoom, originY: py - cellY * newZoom };
}
