// Canvas rendering of moving agents (SPEC.md section 11.3).
//
// Simplification: the hot per-tick frame message only carries
// (x, y, stateCode, blockedFlag) to keep it small and transferable, so the
// solid-vs-dashed "obeys arrows" outline the spec describes isn't rendered
// per agent yet — that detail is available on click via inspectAgent instead.

import type { XY } from '../data/schema';
import type { Viewport } from './renderTiles';
import { cellToScreen } from './renderTiles';

// index matches BUYER_STATE_CODE in sim/worker/protocol.ts
const STATE_COLOR = ['#2B6CB0', '#DD8B00', '#2F855A', '#2B6CB0', '#999999'];
const STUCK_COLOR = '#D7191C';

export function drawAgents(ctx: CanvasRenderingContext2D, positions: Float32Array, viewport: Viewport, selectedAgentId: number | null, agentIds: Int32Array) {
  const count = positions.length / 4;
  const r = Math.max(1.5, viewport.zoom * 0.3);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 4];
    const y = positions[i * 4 + 1];
    const stateCode = positions[i * 4 + 2];
    const blocked = positions[i * 4 + 3];
    const p = cellToScreen(viewport, x, y);
    ctx.fillStyle = blocked > 0.5 ? STUCK_COLOR : (STATE_COLOR[stateCode] ?? '#333333');
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (selectedAgentId != null && agentIds[i] === selectedAgentId) {
      ctx.strokeStyle = '#FFD23F';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// index matches VEHICLE_TYPE_CODE in sim/worker/protocol.ts: handcart, two_wheeler, tempo
const VEHICLE_COLOR = ['#8B5E34', '#6B7280', '#1E3A5F'];
const VEHICLE_DWELL_STATE_CODE = 1; // matches VEHICLE_STATE_CODE.DWELL

export function drawVehicles(ctx: CanvasRenderingContext2D, vehiclePositions: Float32Array, viewport: Viewport, selectedVehicleId: number | null, vehicleIds: Int32Array) {
  const count = vehiclePositions.length / 6;
  const z = viewport.zoom;
  for (let i = 0; i < count; i++) {
    const anchorX = vehiclePositions[i * 6];
    const anchorY = vehiclePositions[i * 6 + 1];
    const w = vehiclePositions[i * 6 + 2];
    const h = vehiclePositions[i * 6 + 3];
    const typeCode = vehiclePositions[i * 6 + 4];
    const stateCode = vehiclePositions[i * 6 + 5];
    const p = cellToScreen(viewport, anchorX, anchorY);
    ctx.fillStyle = VEHICLE_COLOR[typeCode] ?? '#444444';
    ctx.fillRect(p.x, p.y, w * z, h * z);
    if (stateCode === VEHICLE_DWELL_STATE_CODE) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      const step = Math.max(4, z * 0.5);
      for (let d = -h * z; d < w * z; d += step) {
        ctx.beginPath();
        ctx.moveTo(p.x + d, p.y + h * z);
        ctx.lineTo(p.x + d + h * z, p.y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, w * z - 1, h * z - 1);
    if (selectedVehicleId != null && vehicleIds[i] === selectedVehicleId) {
      ctx.strokeStyle = '#FFD23F';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1, p.y + 1, w * z - 2, h * z - 2);
    }
  }
}

export function drawTrails(ctx: CanvasRenderingContext2D, trails: Map<number, XY[]>, viewport: Viewport) {
  ctx.lineWidth = Math.max(1, viewport.zoom * 0.08);
  for (const points of trails.values()) {
    if (points.length < 2) continue;
    for (let i = 1; i < points.length; i++) {
      const alpha = (i / points.length) * 0.5;
      const a = cellToScreen(viewport, points[i - 1].x, points[i - 1].y);
      const b = cellToScreen(viewport, points[i].x, points[i].y);
      ctx.strokeStyle = `rgba(43,108,176,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}
