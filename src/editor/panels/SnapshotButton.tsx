import { useState } from 'react';
import { useAppStore } from '../../app/store';

// A small custom modal rather than window.prompt: prompt()/confirm() are
// silently suppressed inside an Artifact preview, so a native prompt would
// look like the button does nothing there.
export function SnapshotButton() {
  const addSnapshot = useAppStore((s) => s.addSnapshot);
  const snapshotCount = useAppStore((s) => s.project.snapshots.length);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  function save() {
    const trimmed = note.trim();
    if (trimmed.length === 0) return;
    addSnapshot(trimmed);
    setNote('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Save a snapshot of this layout to the History tab"
        className="rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:brightness-95"
        style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
      >
        📌 Snapshot{snapshotCount > 0 ? ` (${snapshotCount})` : ''}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded-2xl p-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        >
          <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            What changed, and why?
          </label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
              if (e.key === 'Escape') setOpen(false);
            }}
            rows={3}
            className="mb-2 w-full rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--color-border-strong)' }}
            placeholder="e.g. Widened the main aisle after the first sim run showed congestion here."
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Cancel
            </button>
            <button onClick={save} className="rounded-lg px-2.5 py-1 text-xs font-medium text-white" style={{ background: 'var(--color-accent)' }}>
              Save snapshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
