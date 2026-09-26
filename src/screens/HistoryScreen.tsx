import { useAppStore } from '../app/store';

export function HistoryScreen() {
  const snapshots = useAppStore((s) => s.project.snapshots);
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-lg font-semibold">History &amp; decision log</h2>
      {snapshots.length === 0 ? (
        <p className="text-neutral-500">No snapshots yet. Use "Save snapshot" in the Editor to start a decision log.</p>
      ) : (
        <ul className="space-y-3">
          {snapshots.map((s) => (
            <li key={s.id} className="rounded border border-neutral-300 bg-white p-3">
              <div className="text-xs text-neutral-400">{new Date(s.timestamp).toLocaleString()}</div>
              <div className="text-sm">{s.note}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
