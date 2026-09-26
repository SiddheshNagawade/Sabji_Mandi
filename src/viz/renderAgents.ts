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
