import { useMemo } from 'react';
import { useAppStore } from '../../app/store';
import { computeLintWarnings } from '../layoutLinter';
import { LINT_ERROR_COLOR, LINT_INFO_COLOR, LINT_WARNING_COLOR } from '../../viz/palettes';

const SEVERITY_COLOR = { error: LINT_ERROR_COLOR, warning: LINT_WARNING_COLOR, info: LINT_INFO_COLOR };

export function LinterPanel({ embedded = false }: { embedded?: boolean }) {
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const setFocusCell = useAppStore((s) => s.setFocusCell);

  const warnings = useMemo(() => computeLintWarnings(layout, width, height), [layout, width, height, layoutVersion]);
  const errors = warnings.filter((w) => w.severity === 'error').length;
  const warns = warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div className={embedded ? '' : 'flex flex-col overflow-hidden border-t border-neutral-200'}>
      {!embedded && (
        <div className="px-2 py-1 text-xs font-semibold text-neutral-500">
          Linter {errors > 0 ? `— ${errors} error${errors > 1 ? 's' : ''}` : warns > 0 ? `— ${warns} warning${warns > 1 ? 's' : ''}` : '— all clear'}
        </div>
      )}
      <div className={embedded ? 'max-h-52 overflow-y-auto text-xs' : 'max-h-40 overflow-y-auto px-2 pb-2 text-xs'}>
        {warnings.length === 0 && <p style={{ color: 'var(--color-text-faint)' }}>No issues found — this layout is ready to simulate.</p>}
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li key={w.id}>
              <button
                className="flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left transition hover:bg-[var(--color-bg)]"
                onClick={() => w.cells[0] && setFocusCell(w.cells[0])}
              >
                <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[w.severity] }} />
                <span>{w.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function useLintCellSet(): Set<string> {
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  return useMemo(() => {
    const warnings = computeLintWarnings(layout, width, height);
    const set = new Set<string>();
    for (const w of warnings) {
      if (w.severity === 'info') continue;
      for (const c of w.cells) set.add(`${c.x},${c.y}`);
    }
    return set;
  }, [layout, width, height, layoutVersion]);
}
