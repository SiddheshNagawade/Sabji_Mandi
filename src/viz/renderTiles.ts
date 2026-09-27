// Canvas 2D rendering of the grid: terrain, objects, flow arrows, zones and
// overlays. Flat pixel-art style per SPEC.md section 6.5 — no smoothing,
// crisp edges.

import type { Layout, LayoutObject, Stall, XY } from '../data/schema';
import { FLOW_DIRS, PRODUCE_COLORS, TILE_INFO, TileId } from '../data/schema';
import { ARROW_COLOR, ENTRANCE_BOTH_COLOR, ENTRANCE_IN_COLOR, ENTRANCE_OUT_COLOR, LOCKED_OVERLAY_COLOR, SELECTION_COLOR, SHADE_OVERLAY_COLOR, TRANSECT_COLOR } from './palettes';

// Blocks are rendered translucent (a clean, Minecraft-block-on-paper look)
// rather than fully opaque; open ground isn't painted at all, so an
// untouched cell just shows the canvas paper colour underneath.
const TERRAIN_ALPHA = 0.6;
const OBJECT_ALPHA = 0.62;
export const CANVAS_PAPER_COLOR = '#F5F3EC';

export interface Viewport {
  originX: number; // screen px of cell (0,0)'s top-left corner
  originY: number;
  zoom: number; // screen px per cell
}

export type LayerVisibility = Record<'terrain' | 'object' | 'flow' | 'zone' | 'shade' | 'locked' | 'background', boolean>;

export function cellToScreen(v: Viewport, x: number, y: number): XY {
  return { x: v.originX + x * v.zoom, y: v.originY + y * v.zoom };
}

export function screenToCell(v: Viewport, sx: number, sy: number): XY {
  return { x: Math.floor((sx - v.originX) / v.zoom), y: Math.floor((sy - v.originY) / v.zoom) };
}

export function visibleCellRange(v: Viewport, canvasW: number, canvasH: number, width: number, height: number) {
  const topLeft = screenToCell(v, 0, 0);
  const bottomRight = screenToCell(v, canvasW, canvasH);
  return {
    x0: Math.max(0, topLeft.x - 1),
    y0: Math.max(0, topLeft.y - 1),
    x1: Math.min(width - 1, bottomRight.x + 1),
    y1: Math.min(height - 1, bottomRight.y + 1),
  };
}

interface DrawOptions {
  showGrid: boolean;
  layerVisible: LayerVisibility;
  selectedObjectId: number | null;
  lintCells?: Set<string>;
  backgroundImageEl?: HTMLImageElement | null;
  backgroundOpacity?: number;
}

export function drawScene(ctx: CanvasRenderingContext2D, layout: Layout, width: number, height: number, viewport: Viewport, opts: DrawOptions) {
  const canvas = ctx.canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CANVAS_PAPER_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (opts.layerVisible.background && opts.backgroundImageEl) {
    ctx.save();
    ctx.globalAlpha = opts.backgroundOpacity ?? 1;
    const topLeft = cellToScreen(viewport, 0, 0);
    ctx.drawImage(opts.backgroundImageEl, topLeft.x, topLeft.y, opts.backgroundImageEl.width * (viewport.zoom / 1), opts.backgroundImageEl.height * (viewport.zoom / 1));
    ctx.restore();
  }

  const { x0, y0, x1, y1 } = visibleCellRange(viewport, canvas.width, canvas.height, width, height);
  const z = viewport.zoom;

  if (opts.layerVisible.terrain) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        const tileId = layout.terrain[i];
        if (tileId === TileId.OpenGround) continue; // untouched cell: show the paper underneath
        const tile = TILE_INFO[tileId];
        const p = cellToScreen(viewport, x, y);
        ctx.globalAlpha = TERRAIN_ALPHA;
        ctx.fillStyle = tile.color;
        ctx.fillRect(p.x, p.y, z, z);
        ctx.globalAlpha = 1;
        if (tile.pattern === 'diagonal') {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + z);
          ctx.lineTo(p.x + z, p.y);
          ctx.stroke();
        } else if (tile.pattern === 'hatch') {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + z, p.y + z);
          ctx.stroke();
        } else if (tile.pattern === 'dashed') {
          ctx.strokeStyle = '#fff';
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(p.x + 1, p.y + 1, z - 2, z - 2);
          ctx.setLineDash([]);
        }
      }
    }
  }

  if (opts.layerVisible.zone) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        const zoneId = layout.zone[i];
        if (zoneId === 0) continue;
        const p = cellToScreen(viewport, x, y);
        ctx.fillStyle = zoneColor(zoneId);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(p.x, p.y, z, z);
        ctx.globalAlpha = 1;
      }
    }
  }

  if (opts.layerVisible.shade) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        if (!layout.shade[i]) continue;
        const p = cellToScreen(viewport, x, y);
        ctx.fillStyle = SHADE_OVERLAY_COLOR;
        ctx.fillRect(p.x, p.y, z, z);
      }
    }
  }

  if (opts.layerVisible.object) {
    for (const obj of layout.objects) {
      drawObject(ctx, obj, viewport, opts.selectedObjectId === obj.id);
    }
  }

  if (opts.layerVisible.flow) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        const dir = layout.flow[i];
        if (dir === 0) continue;
        drawArrow(ctx, viewport, x, y, dir);
      }
    }
  }

  if (opts.layerVisible.locked) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        if (!layout.locked[i]) continue;
        const p = cellToScreen(viewport, x, y);
        ctx.fillStyle = LOCKED_OVERLAY_COLOR;
        ctx.fillRect(p.x, p.y, z, z);
      }
    }
  }

  if (opts.lintCells && opts.lintCells.size > 0) {
    ctx.strokeStyle = '#ff2d2d';
    ctx.lineWidth = 2;
    for (const key of opts.lintCells) {
      const [cx, cy] = key.split(',').map(Number);
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
      const p = cellToScreen(viewport, cx, cy);
      ctx.strokeRect(p.x + 1, p.y + 1, z - 2, z - 2);
    }
  }

  if (opts.showGrid && z >= 6) {
    ctx.strokeStyle = 'rgba(30,26,18,0.10)';
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1 + 1; x++) {
      const p = cellToScreen(viewport, x, y0);
      const p2 = cellToScreen(viewport, x, y1 + 1);
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x) + 0.5, p.y);
      ctx.lineTo(Math.round(p2.x) + 0.5, p2.y);
      ctx.stroke();
    }
    for (let y = y0; y <= y1 + 1; y++) {
      const p = cellToScreen(viewport, x0, y);
      const p2 = cellToScreen(viewport, x1 + 1, y);
      ctx.beginPath();
      ctx.moveTo(p.x, Math.round(p.y) + 0.5);
      ctx.lineTo(p2.x, Math.round(p.y) + 0.5);
      ctx.stroke();
    }
  }
}

function zoneColor(zoneId: number): string {
  const colors = Object.values(PRODUCE_COLORS);
  return colors[(zoneId - 1) % colors.length];
}

function drawArrow(ctx: CanvasRenderingContext2D, v: Viewport, x: number, y: number, dirCode: number) {
  const d = FLOW_DIRS[dirCode];
  const z = v.zoom;
  const c = cellToScreen(v, x + 0.5, y + 0.5);
  const angle = Math.atan2(d.y, d.x);
  const len = z * 0.32;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(angle);
  ctx.strokeStyle = ARROW_COLOR;
  ctx.lineWidth = Math.max(1.5, z * 0.08);
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - z * 0.15, -z * 0.15);
  ctx.moveTo(len, 0);
  ctx.lineTo(len - z * 0.15, z * 0.15);
  ctx.stroke();
  ctx.restore();
}

function polygonFromCells(v: Viewport, cells: XY[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + 1);
    maxY = Math.max(maxY, c.y + 1);
  }
  const a = cellToScreen(v, minX, minY);
  const b = cellToScreen(v, maxX, maxY);
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
}

function drawObject(ctx: CanvasRenderingContext2D, obj: LayoutObject, v: Viewport, selected: boolean) {
  const z = v.zoom;
  if (obj.kind === 'stall') {
    drawStall(ctx, obj, v, selected);
    return;
  }
  if (obj.kind === 'entrance') {
    const color = obj.type.includes('both') ? ENTRANCE_BOTH_COLOR : obj.type.includes('in') ? ENTRANCE_IN_COLOR : ENTRANCE_OUT_COLOR;
    for (const c of obj.cells) {
      const p = cellToScreen(v, c.x, c.y);
      ctx.fillStyle = color;
      ctx.globalAlpha = OBJECT_ALPHA;
      ctx.fillRect(p.x, p.y, z, z);
      ctx.globalAlpha = 1;
    }
    if (selected) strokeBounds(ctx, polygonFromCells(v, obj.cells));
    return;
  }
  if (obj.kind === 'vehicle_bay') {
    const { minX, minY, maxX, maxY } = polygonFromCells(v, obj.cells);
    ctx.globalAlpha = OBJECT_ALPHA;
    ctx.fillStyle = '#4D7CC7';
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.globalAlpha = 1;
    if (selected) strokeBounds(ctx, { minX, minY, maxX, maxY });
    return;
  }
  if (obj.kind === 'waste_point' || obj.kind === 'water_point') {
    const p = cellToScreen(v, obj.cell.x + 0.5, obj.cell.y + 0.5);
    ctx.fillStyle = obj.kind === 'waste_point' ? '#6B4F3A' : '#5BC0EB';
    ctx.beginPath();
    ctx.arc(p.x, p.y, z * 0.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (obj.kind === 'sign') {
    const p = cellToScreen(v, obj.cell.x + 0.5, obj.cell.y + 0.5);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - z * 0.3);
    ctx.lineTo(p.x + z * 0.25, p.y + z * 0.15);
    ctx.lineTo(p.x - z * 0.25, p.y + z * 0.15);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (obj.kind === 'transect') {
    const a = cellToScreen(v, obj.a.x + 0.5, obj.a.y + 0.5);
    const b = cellToScreen(v, obj.b.x + 0.5, obj.b.y + 0.5);
    ctx.strokeStyle = TRANSECT_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  if (obj.kind === 'barrier') {
    for (const c of obj.cells) {
      const p = cellToScreen(v, c.x, c.y);
      ctx.strokeStyle = '#B33A3A';
      ctx.setLineDash([3, 2]);
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1, p.y + 1, z - 2, z - 2);
      ctx.setLineDash([]);
    }
    return;
  }
  if (obj.kind === 'label') {
    const p = cellToScreen(v, obj.cell.x + 0.5, obj.cell.y + 0.2);
    ctx.fillStyle = '#111';
    ctx.font = `${Math.max(9, z * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(obj.text, p.x, p.y);
  }
}

function drawStall(ctx: CanvasRenderingContext2D, stall: Stall, v: Viewport, selected: boolean) {
  const bounds = polygonFromCells(v, stall.cells);
  const color = PRODUCE_COLORS[stall.produce[0] ?? 'mixed_other'];
  ctx.globalAlpha = OBJECT_ALPHA;
  ctx.fillStyle = color;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bounds.minX + 0.5, bounds.minY + 0.5, bounds.maxX - bounds.minX - 1, bounds.maxY - bounds.minY - 1);

  // front-edge marker
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (stall.frontEdge === 'N') {
    ctx.moveTo(bounds.minX, bounds.minY);
    ctx.lineTo(bounds.maxX, bounds.minY);
  } else if (stall.frontEdge === 'S') {
    ctx.moveTo(bounds.minX, bounds.maxY);
    ctx.lineTo(bounds.maxX, bounds.maxY);
  } else if (stall.frontEdge === 'E') {
    ctx.moveTo(bounds.maxX, bounds.minY);
    ctx.lineTo(bounds.maxX, bounds.maxY);
  } else {
    ctx.moveTo(bounds.minX, bounds.minY);
    ctx.lineTo(bounds.minX, bounds.maxY);
  }
  ctx.stroke();

  if (stall.shaded) {
    ctx.fillStyle = SHADE_OVERLAY_COLOR;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  }
  if (stall.locked) {
    ctx.fillStyle = '#111';
    ctx.font = `${Math.max(8, v.zoom * 0.4)}px sans-serif`;
    ctx.fillText('🔒', bounds.minX + 2, bounds.minY + v.zoom * 0.5);
  }
  if (selected) strokeBounds(ctx, bounds);
}

function strokeBounds(ctx: CanvasRenderingContext2D, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.minX + 1, b.minY + 1, b.maxX - b.minX - 2, b.maxY - b.minY - 2);
}
