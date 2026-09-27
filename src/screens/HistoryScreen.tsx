import { useAppStore } from '../app/store';

export function HistoryScreen() {
  const snapshots = useAppStore((s) => s.project.snapshots);
  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          History &amp; decision log
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          A record of what changed and why — use the 📌 Snapshot button in the Editor to add an entry.
        </p>
        {snapshots.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center" style={{ borderColor: 'var(--color-border-strong)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No snapshots yet for this market. Open it in the Editor and click 📌 Snapshot to start a decision log.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {[...snapshots].reverse().map((s) => (
              <li key={s.id} className="rounded-2xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
                  {new Date(s.timestamp).toLocaleString()}
                </div>
                <div className="mt-0.5 text-sm" style={{ color: 'var(--color-text)' }}>
                  {s.note}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
