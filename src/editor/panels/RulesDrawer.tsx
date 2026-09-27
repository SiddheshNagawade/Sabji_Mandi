import { useState } from 'react';
import { useAppStore } from '../../app/store';
import { TimelinePanel } from './TimelinePanel';

// Phases/barriers/vehicle schedule live behind one toggle instead of a
// permanent bottom strip — most layouts never need them.
export function RulesDrawer() {
  const [open, setOpen] = useState(false);
  const phaseCount = useAppStore((s) => s.project.baseline.phases.length);

  return (
    <div className="pointer-events-auto absolute right-4 top-16 flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium transition"
        style={{
          background: open ? 'var(--color-accent)' : 'rgba(255,255,255,0.92)',
          color: open ? '#fff' : 'var(--color-text)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span>⏱</span>
        Rules {phaseCount > 0 ? `(${phaseCount})` : ''}
      </button>
      {open && (
        <div className="w-[36rem] max-w-[80vw] overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,0.98)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              Rules & phases
            </span>
            <button onClick={() => setOpen(false)} className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
              ✕
            </button>
          </div>
          <TimelinePanel />
        </div>
      )}
    </div>
  );
}
