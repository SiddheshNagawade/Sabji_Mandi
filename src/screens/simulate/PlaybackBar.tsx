import { useSimStore } from '../../app/simStore';

const SPEEDS = [1, 5, 20, 60, 240];

function formatClock(simSeconds: number): string {
  const totalMin = Math.floor(simSeconds / 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function PlaybackBar() {
  const status = useSimStore((s) => s.status);
  const speed = useSimStore((s) => s.speed);
  const t = useSimStore((s) => s.t);
  const simStartS = useSimStore((s) => s.simStartS);
  const hardStopS = useSimStore((s) => s.hardStopS);
  const play = useSimStore((s) => s.play);
  const pause = useSimStore((s) => s.pause);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const seek = useSimStore((s) => s.seek);

  const range = Math.max(1, hardStopS - simStartS);
  const progress = Math.max(0, Math.min(1, (t - simStartS) / range));

  return (
    <div className="flex items-center gap-3 border-t border-neutral-200 bg-white px-3 py-2 text-xs">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-white"
        onClick={() => (status === 'running' ? pause() : play())}
        disabled={status === 'done'}
        title="Play/pause (Space)"
      >
        {status === 'running' ? '❚❚' : '▶'}
      </button>
      <div className="flex gap-1">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 ${speed === s ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}>
            {s === 240 ? 'Max' : `${s}×`}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        onChange={(e) => seek(simStartS + (parseInt(e.target.value, 10) / 1000) * range)}
        className="mx-2 flex-1"
      />
      <span className="w-32 text-right tabular-nums text-neutral-600">
        {formatClock(t)} {status === 'done' ? '(done)' : ''}
      </span>
    </div>
  );
}
