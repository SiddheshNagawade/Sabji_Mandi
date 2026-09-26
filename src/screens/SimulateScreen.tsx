import { useEffect } from 'react';
import { useAppStore } from '../app/store';
import { useSimStore } from '../app/simStore';
import { ValidationBanner } from '../ui/ValidationBanner';
import { SimulateCanvas } from './simulate/SimulateCanvas';
import { PlaybackBar } from './simulate/PlaybackBar';
import { ControlsPanel } from './simulate/ControlsPanel';
import { InspectPanel } from './simulate/InspectPanel';
import { Charts } from './simulate/Charts';
import { PerfTest } from './simulate/PerfTest';

export function SimulateScreen() {
  const project = useAppStore((s) => s.project);
  const worker = useSimStore((s) => s.worker);
  const status = useSimStore((s) => s.status);
  const init = useSimStore((s) => s.init);
  const terminate = useSimStore((s) => s.terminate);

  useEffect(() => {
    if (!worker) init(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => terminate(), [terminate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const s = useSimStore.getState();
        if (s.status === 'running') s.pause();
        else if (s.status !== 'done') s.play();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <ValidationBanner />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <SimulateCanvas />
        </div>
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-300 bg-white">
          <ControlsPanel />
          <InspectPanel />
          <Charts />
          <PerfTest />
        </div>
      </div>
      <PlaybackBar />
      {!worker && status === 'idle' && <div className="p-2 text-center text-xs text-neutral-400">Starting simulation worker…</div>}
    </div>
  );
}
