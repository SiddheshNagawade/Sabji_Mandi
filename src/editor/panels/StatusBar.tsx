import { useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import { findBlock } from '../blocks';
import { computeLintWarnings } from '../layoutLinter';

export function StatusBar() {
  const activeBlockId = useAppStore((s) => s.activeBlockId);
  const cellSizeM = useAppStore((s) => s.project.grid.cellSizeM.value);
  const zoom = useAppStore((s) => s.viewport.zoom);
  const objectCount = useAppStore((s) => s.project.baseline.objects.length);
  const hoverCell = useAppStore((s) => s.hoverCell);
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const setFocusCell = useAppStore((s) => s.setFocusCell);
  const [issuesOpen, setIssuesOpen] = useState(false);

  const block = findBlock(activeBlockId);
  const warnings = useMemo(() => computeLintWarnings(layout, width, height), [layout, width, height, layoutVersion]);
  const errorCount = warnings.filter((w) => w.severity === 'error').length;

  return (
    <div
      className="relative flex items-center gap-3 border-t px-3 py-1.5 text-[11px]"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
    >
      <span className="font-medium" style={{ color: 'var(--color-text)' }}>
        {block.label}
      </span>
      <Sep />
      <span>{cellSizeM} m/cell</span>
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' }}>
        SNAP
      </span>
      <div className="ml-auto flex items-center gap-3">
        {issuesOpen && (
          <div className="absolute bottom-full right-24 mb-1 w-72 overflow-hidden rounded-2xl text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-faint)' }}>
              Issues
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {warnings.length === 0 && <p className="px-1 py-1 text-xs" style={{ color: 'var(--color-text-faint)' }}>No issues — ready to simulate.</p>}
              <ul className="space-y-0.5">
                {warnings.map((w) => (
                  <li key={w.id}>
                    <button
                      className="w-full rounded-lg px-2 py-1 text-left text-xs transition hover:bg-[var(--color-bg)]"
                      onClick={() => {
                        if (w.cells[0]) setFocusCell(w.cells[0]);
                        setIssuesOpen(false);
                      }}
                    >
                      {w.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <button onClick={() => setIssuesOpen((v) => !v)} className="flex items-center gap-1 transition hover:opacity-80" style={{ color: errorCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
          {errorCount > 0 ? `⚠ ${errorCount} issue${errorCount > 1 ? 's' : ''}` : '✓ No issues'}
        </button>
        <Sep />
        <span>{Math.round(zoom)}px/cell</span>
        <Sep />
        <span>{objectCount} obj</span>
        <Sep />
        <span className="tabular-nums">{hoverCell ? `${hoverCell.x}, ${hoverCell.y}` : '—'}</span>
      </div>
    </div>
  );
}

function Sep() {
  return <span style={{ color: 'var(--color-border-strong)' }}>|</span>;
}
