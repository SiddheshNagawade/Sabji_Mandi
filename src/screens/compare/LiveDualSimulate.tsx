// Watch two markets simulate side by side in real time, with one shared
// play/pause and speed control driving two independent sim workers — unlike
// CompareScreen's headless "Run both" (which fast-forwards at 100,000x with
// no visual), this runs at a watchable speed so you can actually see what's
// happening, the same way the single-market Simulate screen does.

import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../data/schema';
import type { RunFrame } from '../../viz/MiniLayoutPreview';
import { MiniLayoutPreview } from '../../viz/MiniLayoutPreview';
import type { WorkerMessage } from '../../sim/worker/protocol';
import { throttled } from './throttled';

const SPEEDS = [1, 5, 20, 60, 240];

interface Side {
  t: number;
  peopleInMarket: number;
  spawned: number;
  frame: RunFrame | null;
  done: boolean;
  error: string | null;
}

const INITIAL_SIDE: Side = { t: 0, peopleInMarket: 0, spawned: 0, frame: null, done: false, error: null };

function formatClock(s: number): string {
  const totalMin = Math.floor(s / 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function LiveDualSimulate({ projectA, projectB, nameA, nameB, onClose }: { projectA: Project; projectB: Project; nameA: string; nameB: string; onClose: () => void }) {
  const [status, setStatus] = useState<'running' | 'paused'>('running');
  const [speed, setSpeed] = useState(20);
  const [sideA, setSideA] = useState<Side>(INITIAL_SIDE);
  const [sideB, setSideB] = useState<Side>(INITIAL_SIDE);
  const workerARef = useRef<Worker | null>(null);
  const workerBRef = useRef<Worker | null>(null);

  function wireWorker(project: Project, setSide: (fn: (s: Side) => Side) => void): Worker {
    const worker = new Worker(new URL('../../sim/worker/sim.worker.ts', import.meta.url), { type: 'module' });
    const onFrame = throttled((frame: RunFrame) => setSide((s) => ({ ...s, frame })), 100);
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'metrics') {
        setSide((s) => ({ ...s, t: msg.t, peopleInMarket: msg.peopleInMarket, spawned: msg.spawned }));
      } else if (msg.type === 'frame') {
        onFrame({ positions: msg.positions, agentIds: msg.agentIds, vehiclePositions: msg.vehiclePositions, vehicleIds: msg.vehicleIds });
      } else if (msg.type === 'done') {
        setSide((s) => ({ ...s, done: true }));
      } else if (msg.type === 'error') {
        setSide((s) => ({ ...s, error: msg.message }));
      }
    };
    worker.onerror = (e) => setSide((s) => ({ ...s, error: e.message || 'The simulation worker crashed.' }));
    worker.postMessage({ type: 'init', project, scenarioId: 'baseline', seed: 1 });
    worker.postMessage({ type: 'setSpeed', multiplier: speed });
    worker.postMessage({ type: 'run' });
    return worker;
  }

  // (Re)start both workers whenever the pair of projects being watched changes.
  useEffect(() => {
    setSideA(INITIAL_SIDE);
    setSideB(INITIAL_SIDE);
    setStatus('running');
    workerARef.current = wireWorker(projectA, setSideA);
    workerBRef.current = wireWorker(projectB, setSideB);
    return () => {
      workerARef.current?.terminate();
      workerBRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectA, projectB]);

  function togglePlayPause() {
    const next = status === 'running' ? 'paused' : 'running';
    workerARef.current?.postMessage({ type: next === 'running' ? 'run' : 'pause' });
    workerBRef.current?.postMessage({ type: next === 'running' ? 'run' : 'pause' });
    setStatus(next);
  }

  function restart() {
    setSideA(INITIAL_SIDE);
    setSideB(INITIAL_SIDE);
    setStatus('running');
    workerARef.current?.postMessage({ type: 'reset' });
    workerBRef.current?.postMessage({ type: 'reset' });
    workerARef.current?.postMessage({ type: 'run' });
    workerBRef.current?.postMessage({ type: 'run' });
  }

  function changeSpeed(mult: number) {
    setSpeed(mult);
    workerARef.current?.postMessage({ type: 'setSpeed', multiplier: mult });
    workerBRef.current?.postMessage({ type: 'setSpeed', multiplier: mult });
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Watching live
        </h2>
        <button onClick={onClose} className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Close
        </button>
      </div>

      <div className="mb-3 flex items-center gap-3 rounded-xl p-2" style={{ background: 'var(--color-bg)' }}>
        <button
          onClick={togglePlayPause}
          disabled={sideA.done && sideB.done}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white transition disabled:opacity-50"
          style={{ background: 'var(--color-accent)' }}
          title="Play/pause"
        >
          {status === 'running' ? '❚❚' : '▶'}
        </button>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className="rounded-md px-2 py-1 text-[11px] font-medium transition"
              style={speed === s ? { background: 'var(--color-accent)', color: '#fff' } : { background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {s === 240 ? 'Max' : `${s}×`}
            </button>
          ))}
        </div>
        <button onClick={restart} className="ml-auto rounded-md px-2.5 py-1 text-[11px] font-medium transition" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          ↺ Restart
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <LiveSide name={nameA} project={projectA} side={sideA} />
        <LiveSide name={nameB} project={projectB} side={sideB} />
      </div>
    </div>
  );
}

function LiveSide({ name, project, side }: { name: string; project: Project; side: Side }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {name}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          {formatClock(side.t)} {side.done ? '· done' : ''}
        </span>
      </div>
      <MiniLayoutPreview project={project} frame={side.frame} width={420} height={260} />
      {side.error ? (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-danger)' }}>
          {side.error}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {side.peopleInMarket} in market now · {side.spawned} arrived so far
        </p>
      )}
    </div>
  );
}
