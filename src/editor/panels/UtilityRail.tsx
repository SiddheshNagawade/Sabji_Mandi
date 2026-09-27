import { useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import { computeLintWarnings } from '../layoutLinter';
import { LayersPanel } from './LayersPanel';
import { LinterPanel } from './LinterPanel';

type PopoverId = 'layers' | 'issues' | null;

// A small icon rail instead of permanent side panels — Layers and Issues
// open as popovers only when you ask for them, keeping the canvas the star.
export function UtilityRail() {
  const [open, setOpen] = useState<PopoverId>(null);
  const showGrid = useAppStore((s) => s.showGrid);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);

  const warnings = useMemo(() => computeLintWarnings(layout, width, height), [layout, width, height, layoutVersion]);
  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;
  const issueCount = errorCount + warnCount;

  function toggle(id: PopoverId) {
    setOpen((cur) => (cur === id ? null : id));
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 flex flex-col items-start gap-2">
      <div className="flex gap-1.5 rounded-2xl p-1.5" style={railStyle}>
        <RailButton label="Layers" icon="☰" active={open === 'layers'} onClick={() => toggle('layers')} />
        <RailButton
          label="Issues"
          icon={errorCount > 0 ? '⚠' : '✓'}
          tone={errorCount > 0 ? 'danger' : warnCount > 0 ? 'warn' : 'ok'}
          badge={issueCount > 0 ? issueCount : undefined}
          active={open === 'issues'}
          onClick={() => toggle('issues')}
        />
        <div className="mx-0.5 my-1 w-px" style={{ background: 'var(--color-border)' }} />
        <RailButton label="Grid" icon="#" active={showGrid} onClick={toggleGrid} />
      </div>

      {open === 'layers' && (
        <div className="w-56 overflow-hidden rounded-2xl" style={popoverStyle}>
          <PopoverHeader title="Layers & backdrop" onClose={() => setOpen(null)} />
          <div className="max-h-[70vh] overflow-y-auto">
            <LayersPanel />
          </div>
        </div>
      )}
      {open === 'issues' && (
        <div className="w-72 overflow-hidden rounded-2xl" style={popoverStyle}>
          <PopoverHeader title="Issues" onClose={() => setOpen(null)} />
          <div className="max-h-[70vh] overflow-y-auto">
            <LinterPanel />
          </div>
        </div>
      )}
    </div>
  );
}

const railStyle = { background: 'rgba(255,255,255,0.92)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', backdropFilter: 'blur(10px)' };
const popoverStyle = { background: 'rgba(255,255,255,0.98)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' };

function PopoverHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
        {title}
      </span>
      <button onClick={onClose} className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
        ✕
      </button>
    </div>
  );
}

function RailButton({
  label,
  icon,
  active,
  onClick,
  tone,
  badge,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
  tone?: 'danger' | 'warn' | 'ok';
  badge?: number;
}) {
  const toneColor = tone === 'danger' ? 'var(--color-danger)' : tone === 'warn' ? '#B8862E' : tone === 'ok' ? 'var(--color-success)' : undefined;
  return (
    <button
      title={label}
      onClick={onClick}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-sm transition"
      style={{
        background: active ? 'var(--color-accent)' : '#F0EEE7',
        color: active ? '#fff' : (toneColor ?? 'var(--color-text-muted)'),
      }}
    >
      {icon}
      {badge != null && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold text-white"
          style={{ background: 'var(--color-danger)' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
