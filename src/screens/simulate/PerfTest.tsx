import { useRef, useState } from 'react';
import { drawAgents } from '../../viz/renderAgents';

// SPEC.md section 15.2 (M3): "The 1,500-agent frame-rate target is checked
// and the result reported." This is a standalone rendering stress test —
// it draws 1,500 synthetic moving dots with the real drawAgents() code path
// at a realistic viewport size and measures actual canvas frame rate,
// independent of whether the current demand curve ever produces that many
// concurrent buyers.

const AGENT_COUNT = 1500;
const DURATION_MS = 3000;
const CANVAS_W = 900;
const CANVAS_H = 600;
const GRID_W = 160;
const GRID_H = 120;

export function PerfTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ fps: number; frames: number } | null>(null);

  function run() {
    const canvas = canvasRef.current;
    if (!canvas || running) return;
    setRunning(true);
    setResult(null);
    const ctx = canvas.getContext('2d')!;
    const viewport = { originX: 0, originY: 0, zoom: Math.min(CANVAS_W / GRID_W, CANVAS_H / GRID_H) };
    const positions = new Float32Array(AGENT_COUNT * 4);
    const velocities = new Float32Array(AGENT_COUNT * 2);
    const agentIds = new Int32Array(AGENT_COUNT);
    for (let i = 0; i < AGENT_COUNT; i++) {
      positions[i * 4] = Math.random() * GRID_W;
      positions[i * 4 + 1] = Math.random() * GRID_H;
      positions[i * 4 + 2] = Math.floor(Math.random() * 4);
      positions[i * 4 + 3] = Math.random() < 0.15 ? 1 : 0;
      velocities[i * 2] = (Math.random() - 0.5) * 0.4;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 0.4;
      agentIds[i] = i;
    }

    let frames = 0;
    const start = performance.now();
    function frame(now: number) {
      for (let i = 0; i < AGENT_COUNT; i++) {
        positions[i * 4] = (positions[i * 4] + velocities[i * 2] + GRID_W) % GRID_W;
        positions[i * 4 + 1] = (positions[i * 4 + 1] + velocities[i * 2 + 1] + GRID_H) % GRID_H;
      }
      ctx.fillStyle = '#E9E2D0';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawAgents(ctx, positions, viewport, null, agentIds);
      frames++;
      if (now - start < DURATION_MS) {
        requestAnimationFrame(frame);
      } else {
        const elapsedS = (now - start) / 1000;
        setResult({ fps: frames / elapsedS, frames });
        setRunning(false);
      }
    }
    requestAnimationFrame(frame);
  }

  return (
    <div className="border-t border-neutral-200 p-2 text-xs">
      <div className="mb-1 font-semibold text-neutral-500">Performance check (M3 acceptance)</div>
      <button className="mb-1 rounded bg-neutral-100 px-2 py-1 disabled:opacity-50" onClick={run} disabled={running}>
        {running ? 'Running…' : `Render ${AGENT_COUNT} agents for 3s`}
      </button>
      {result && (
        <p className={result.fps >= 30 ? 'text-green-700' : 'text-amber-700'}>
          Measured {result.fps.toFixed(1)} fps ({result.frames} frames) — target is 30fps+ at 1,500 agents (section 9.11).
        </p>
      )}
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="mt-1 hidden" />
    </div>
  );
}
