// A small non-interactive canvas that redraws a project's terrain/objects
// plus, when given one, a live frame of agent/vehicle positions. Used by
// Compare's headless-run progress cards and by the live side-by-side
// simulate view — both just want "a little live picture of this market."

import { useEffect, useMemo, useRef } from 'react';
import type { Project } from '../data/schema';
import { fitToScreen } from '../editor/viewport';
import { drawScene } from './renderTiles';
import { drawAgents, drawVehicles } from './renderAgents';

export interface RunFrame {
  positions: Float32Array;
  agentIds: Int32Array;
  vehiclePositions: Float32Array;
  vehicleIds: Int32Array;
}

export function MiniLayoutPreview({ project, frame, width = 240, height = 140 }: { project: Project; frame: RunFrame | null; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridWidth = project.grid.width;
  const gridHeight = project.grid.height;
  const viewport = useMemo(() => fitToScreen(gridWidth, gridHeight, width, height), [gridWidth, gridHeight, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    drawScene(ctx, project.baseline, gridWidth, gridHeight, viewport, {
      showGrid: false,
      layerVisible: { terrain: true, object: true, flow: false, zone: false, shade: false, locked: false, background: false },
      selectedObjectId: null,
    });
    if (frame) {
      drawVehicles(ctx, frame.vehiclePositions, viewport, null, frame.vehicleIds);
      drawAgents(ctx, frame.positions, viewport, null, frame.agentIds);
    }
  }, [project, gridWidth, gridHeight, viewport, frame, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-lg" style={{ background: '#F5F3EC', aspectRatio: `${width} / ${height}` }} />;
}
