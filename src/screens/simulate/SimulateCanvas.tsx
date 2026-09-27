import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import { useSimStore } from '../../app/simStore';
import type { XY } from '../../data/schema';
import { TILE_INFO, TileId } from '../../data/schema';
import type { Viewport } from '../../viz/renderTiles';
import { cellToScreen, drawScene, screenToCell } from '../../viz/renderTiles';
import { drawAgents, drawTrails, drawVehicles } from '../../viz/renderAgents';
import { drawHeatOverlay } from '../../viz/renderHeatmap';
import { HoverLabel } from '../../viz/HoverLabel';
import { objectAtCell } from '../../editor/objectLayer';
import { idx, inBounds } from '../../editor/grid';
import { ENTRANCE_TYPE_LABEL, VEHICLE_TYPE_LABEL, produceLabel } from '../../editor/labels';
import { BUYER_STATE_NAME, VEHICLE_STATE_NAME, VEHICLE_TYPE_NAME } from '../../sim/worker/protocol';
import { buildOccupancyGrid, densityFromSmoothed, smoothOccupancy3x3 } from '../../metrics/collectors';

function fitToScreen(width: number, height: number, el: HTMLDivElement | null): Viewport {
  const cw = el?.clientWidth ?? 800;
  const ch = el?.clientHeight ?? 600;
  const zoom = Math.max(2, Math.min(cw / width, ch / height, 16));
  return { originX: (cw - width * zoom) / 2, originY: (ch - height * zoom) / 2, zoom };
}

export function SimulateCanvas() {
  const project = useAppStore((s) => s.project);
  const layout = project.baseline;
  const width = project.grid.width;
  const height = project.grid.height;

  const positions = useSimStore((s) => s.positions);
  const agentIds = useSimStore((s) => s.agentIds);
  const vehiclePositions = useSimStore((s) => s.vehiclePositions);
  const vehicleIds = useSimStore((s) => s.vehicleIds);
  const heat = useSimStore((s) => s.heat);
  const heatMode = useSimStore((s) => s.heatMode);
  const showTrails = useSimStore((s) => s.showTrails);
  const inspect = useSimStore((s) => s.inspect);
  const inspectAgent = useSimStore((s) => s.inspectAgent);
  const inspectStall = useSimStore((s) => s.inspectStall);
  const inspectCell = useSimStore((s) => s.inspectCell);
  const inspectVehicle = useSimStore((s) => s.inspectVehicle);
  const cellSizeM = useSimStore((s) => s.cellSizeM);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ originX: 0, originY: 0, zoom: 8 });
  const trailsRef = useRef<Map<number, XY[]>>(new Map());
  const panRef = useRef<{ active: boolean; last: XY }>({ active: false, last: { x: 0, y: 0 } });
  const [hoverScreen, setHoverScreen] = useState<XY | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 700 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport(fitToScreen(width, height, el));
  }, [width, height]);

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = el.clientWidth;
      canvas.height = el.clientHeight;
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Maintain short trails.
  useEffect(() => {
    if (!showTrails) return;
    const count = positions.length / 4;
    const seen = new Set<number>();
    for (let i = 0; i < count; i++) {
      const id = agentIds[i];
      seen.add(id);
      const pt = { x: positions[i * 4], y: positions[i * 4 + 1] };
      const arr = trailsRef.current.get(id) ?? [];
      arr.push(pt);
      if (arr.length > 12) arr.shift();
      trailsRef.current.set(id, arr);
    }
    for (const id of trailsRef.current.keys()) if (!seen.has(id)) trailsRef.current.delete(id);
  }, [positions, agentIds, showTrails]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawScene(ctx, layout, width, height, viewport, {
      showGrid: viewport.zoom >= 6,
      layerVisible: { terrain: true, object: true, flow: true, zone: false, shade: true, locked: false, background: false },
      selectedObjectId: inspect?.kind === 'stall' ? (inspect.id as number) : null,
    });
    if (heat && heatMode !== 'agents') {
      const values =
        heatMode === 'density'
          ? computeLiveDensity(positions, width, height, cellSizeM)
          : heatMode === 'footfall'
            ? heat.passCount
            : heatMode === 'stuck'
              ? heat.stuckSeconds
              : heatMode === 'vehicleBlock'
                ? heat.vehicleBlockSeconds
                : heat.conflictCount;
      drawHeatOverlay(ctx, heatMode, values, width, height, viewport, 0.6);
    }
    if (showTrails) drawTrails(ctx, trailsRef.current, viewport);
    drawVehicles(ctx, vehiclePositions, viewport, inspect?.kind === 'vehicle' ? (inspect.id as number) : null, vehicleIds);
    drawAgents(ctx, positions, viewport, inspect?.kind === 'agent' ? (inspect.id as number) : null, agentIds);
  }, [layout, width, height, viewport, positions, agentIds, vehiclePositions, vehicleIds, heat, heatMode, showTrails, inspect, cellSizeM]);

  const onWheel = useCallback((e: ReactWheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setViewport((v) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(2, Math.min(48, v.zoom * factor));
      const cellX = (sx - v.originX) / v.zoom;
      const cellY = (sy - v.originY) / v.zoom;
      return { zoom: newZoom, originX: sx - cellX * newZoom, originY: sy - cellY * newZoom };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handler(e: WheelEvent) {
      e.preventDefault();
    }
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.shiftKey) {
      panRef.current = { active: true, last: { x: e.clientX, y: e.clientY } };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // hit-test agents first (nearest within ~0.5 cell)
    const count = positions.length / 4;
    let bestId: number | null = null;
    let bestDist = 0.6;
    for (let i = 0; i < count; i++) {
      const p = cellToScreen(viewport, positions[i * 4], positions[i * 4 + 1]);
      const d = Math.hypot(p.x - sx, p.y - sy) / viewport.zoom;
      if (d < bestDist) {
        bestDist = d;
        bestId = agentIds[i];
      }
    }
    if (bestId != null) {
      inspectAgent(bestId);
      return;
    }

    // then vehicles (click anywhere inside their footprint rectangle)
    const vehicleCount = vehiclePositions.length / 6;
    for (let i = 0; i < vehicleCount; i++) {
      const anchorX = vehiclePositions[i * 6];
      const anchorY = vehiclePositions[i * 6 + 1];
      const w = vehiclePositions[i * 6 + 2];
      const h = vehiclePositions[i * 6 + 3];
      const topLeft = cellToScreen(viewport, anchorX, anchorY);
      if (sx >= topLeft.x && sx <= topLeft.x + w * viewport.zoom && sy >= topLeft.y && sy <= topLeft.y + h * viewport.zoom) {
        inspectVehicle(vehicleIds[i]);
        return;
      }
    }

    const cell = screenToCell(viewport, sx, sy);
    if (!inBounds(cell.x, cell.y, width, height)) return;
    const obj = objectAtCell(layout, width, height, cell.x, cell.y);
    if (obj?.kind === 'stall') {
      inspectStall(obj.id);
    } else {
      inspectCell(cell.x, cell.y);
    }
  }, [positions, agentIds, vehiclePositions, vehicleIds, viewport, width, height, layout, inspectAgent, inspectStall, inspectCell, inspectVehicle]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.last.x;
      const dy = e.clientY - panRef.current.last.y;
      panRef.current.last = { x: e.clientX, y: e.clientY };
      setViewport((v) => ({ ...v, originX: v.originX + dx, originY: v.originY + dy }));
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setHoverScreen({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const onPointerUp = useCallback(() => {
    panRef.current.active = false;
  }, []);

  const hoverText = hoverScreen ? describeHoverPoint(hoverScreen.x, hoverScreen.y, { positions, vehiclePositions, viewport, width, height, layout }) : null;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-pointer touch-none"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverScreen(null)}
      />
      {hoverScreen && <HoverLabel text={hoverText} x={hoverScreen.x} y={hoverScreen.y} containerWidth={containerSize.width} containerHeight={containerSize.height} />}
    </div>
  );
}

function describeHoverPoint(
  sx: number,
  sy: number,
  ctx: {
    positions: Float32Array;
    vehiclePositions: Float32Array;
    viewport: Viewport;
    width: number;
    height: number;
    layout: ReturnType<typeof useAppStore.getState>['project']['baseline'];
  },
): string | null {
  const { positions, vehiclePositions, viewport, width, height, layout } = ctx;

  const count = positions.length / 4;
  let bestAgentIdx = -1;
  let bestDist = 0.6;
  for (let i = 0; i < count; i++) {
    const p = cellToScreen(viewport, positions[i * 4], positions[i * 4 + 1]);
    const d = Math.hypot(p.x - sx, p.y - sy) / viewport.zoom;
    if (d < bestDist) {
      bestDist = d;
      bestAgentIdx = i;
    }
  }
  if (bestAgentIdx !== -1) {
    const stateCode = positions[bestAgentIdx * 4 + 2];
    return `Buyer — ${BUYER_STATE_NAME[stateCode] ?? 'unknown'}`;
  }

  const vehicleCount = vehiclePositions.length / 6;
  for (let i = 0; i < vehicleCount; i++) {
    const anchorX = vehiclePositions[i * 6];
    const anchorY = vehiclePositions[i * 6 + 1];
    const w = vehiclePositions[i * 6 + 2];
    const h = vehiclePositions[i * 6 + 3];
    const typeCode = vehiclePositions[i * 6 + 4];
    const stateCode = vehiclePositions[i * 6 + 5];
    const topLeft = cellToScreen(viewport, anchorX, anchorY);
    if (sx >= topLeft.x && sx <= topLeft.x + w * viewport.zoom && sy >= topLeft.y && sy <= topLeft.y + h * viewport.zoom) {
      const typeName = VEHICLE_TYPE_NAME[typeCode];
      const label = typeName ? VEHICLE_TYPE_LABEL[typeName] : 'Vehicle';
      return `${label} — ${VEHICLE_STATE_NAME[stateCode] ?? 'unknown'}`;
    }
  }

  const cell = screenToCell(viewport, sx, sy);
  if (!inBounds(cell.x, cell.y, width, height)) return null;
  const obj = objectAtCell(layout, width, height, cell.x, cell.y);
  if (obj) {
    switch (obj.kind) {
      case 'stall':
        return obj.produce.length > 0 ? `Stall — ${obj.produce.map(produceLabel).join(', ')}` : 'Stall (empty)';
      case 'entrance':
        return ENTRANCE_TYPE_LABEL[obj.type];
      case 'vehicle_bay':
        return `${VEHICLE_TYPE_LABEL[obj.vehicleType]} bay`;
      case 'barrier':
        return 'Barrier (movable)';
      case 'waste_point':
        return 'Waste point';
      case 'water_point':
        return 'Water point';
      case 'sign':
        return 'Sign';
      case 'label':
        return 'Label';
      case 'transect':
        return 'Transect (measurement line)';
    }
  }
  const tileId = layout.terrain[idx(cell.x, cell.y, width)];
  if (tileId === TileId.OpenGround) return null;
  return TILE_INFO[tileId]?.name ?? null;
}

function computeLiveDensity(positions: Float32Array, width: number, height: number, cellSizeM: number): Float32Array {
  const grid = buildOccupancyGrid(positions, width, height);
  const smoothed = smoothOccupancy3x3(grid, width, height);
  return densityFromSmoothed(smoothed, cellSizeM);
}
