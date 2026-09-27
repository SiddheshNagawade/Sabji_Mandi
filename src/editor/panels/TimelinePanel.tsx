import { useState } from 'react';
import { useAppStore } from '../../app/store';
import type { Barrier } from '../../data/schema';

function fmt(s: number): string {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseHHMM(v: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return fallback;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60;
}

const PHASE_COLORS = ['#93C5FD', '#FCA5A5', '#86EFAC', '#FCD34D', '#C4B5FD', '#67E8F9'];

export function TimelinePanel() {
  const project = useAppStore((s) => s.project);
  const layout = project.baseline;
  const phases = layout.phases;
  const barriers = layout.objects.filter((o): o is Barrier => o.kind === 'barrier');
  const addPhase = useAppStore((s) => s.addPhase);
  const updatePhase = useAppStore((s) => s.updatePhase);
  const deletePhase = useAppStore((s) => s.deletePhase);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const simStart = project.demand.simStartS;
  const simEnd = project.demand.hardStopS;
  const range = Math.max(1, simEnd - simStart);
  const selected = phases.find((p) => p.id === selectedId) ?? null;

  function handleAddPhase() {
    const lastEnd = phases.length > 0 ? Math.max(...phases.map((p) => p.endS)) : simStart;
    const start = Math.min(lastEnd, simEnd - 1);
    const end = Math.min(simEnd, start + 3600);
    if (start >= end) return;
    addPhase(`Phase ${phases.length + 1}`, start, end);
  }

  return (
    <div className="border-t border-neutral-200 bg-white px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
        <span className="font-semibold text-neutral-700">Time-rule timeline</span>
        <span>
          {fmt(simStart)} – {fmt(simEnd)}
        </span>
        <button className="ml-auto rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50" onClick={handleAddPhase}>
          + Add phase
        </button>
      </div>

      <div className="relative h-8 w-full overflow-hidden rounded border border-neutral-300 bg-neutral-100">
        {phases.map((p, i) => {
          const left = ((p.startS - simStart) / range) * 100;
          const width = ((p.endS - p.startS) / range) * 100;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
              className="absolute top-0 h-full overflow-hidden border-r border-white text-left text-[10px] text-neutral-800"
              style={{ left: `${left}%`, width: `${width}%`, background: PHASE_COLORS[i % PHASE_COLORS.length], outline: p.id === selectedId ? '2px solid #1D4ED8' : undefined }}
              title={`${p.name}: ${fmt(p.startS)}–${fmt(p.endS)}`}
            >
              <span className="block truncate px-1 pt-1">{p.name}</span>
            </button>
          );
        })}
        {phases.length === 0 && <div className="flex h-full items-center justify-center text-[11px] text-neutral-400">No phases yet — the layout behaves the same at all times.</div>}
      </div>

      {selected && (
        <div className="mt-2 grid grid-cols-2 gap-3 rounded border border-neutral-200 p-2 text-xs sm:grid-cols-4">
          <label className="flex flex-col gap-0.5">
            Name
            <input className="rounded border border-neutral-300 px-1 py-0.5" value={selected.name} onChange={(e) => updatePhase(selected.id, (p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-0.5">
            Start
            <input
              className="rounded border border-neutral-300 px-1 py-0.5"
              defaultValue={fmt(selected.startS)}
              onBlur={(e) => updatePhase(selected.id, (p) => ({ ...p, startS: parseHHMM(e.target.value, p.startS) }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            End
            <input
              className="rounded border border-neutral-300 px-1 py-0.5"
              defaultValue={fmt(selected.endS)}
              onBlur={(e) => updatePhase(selected.id, (p) => ({ ...p, endS: parseHHMM(e.target.value, p.endS) }))}
            />
          </label>
          <label className="flex items-center gap-1 self-end">
            <input type="checkbox" checked={selected.vehiclesAllowed} onChange={(e) => updatePhase(selected.id, (p) => ({ ...p, vehiclesAllowed: e.target.checked }))} />
            Vehicles allowed
          </label>

          <div className="col-span-2 sm:col-span-4">
            <div className="mb-1 text-neutral-500">Active barriers this phase</div>
            {barriers.length === 0 && <p className="text-neutral-400">No barriers drawn yet — use the Barrier tool on the map.</p>}
            <div className="flex flex-wrap gap-2">
              {barriers.map((b) => (
                <label key={b.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selected.activeBarrierIds.includes(b.id)}
                    onChange={(e) =>
                      updatePhase(selected.id, (p) => ({
                        ...p,
                        activeBarrierIds: e.target.checked ? [...p.activeBarrierIds, b.id] : p.activeBarrierIds.filter((id) => id !== b.id),
                      }))
                    }
                  />
                  {b.label ?? `Barrier ${b.id}`}
                </label>
              ))}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4">
            <button
              className="rounded bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
              onClick={() => {
                deletePhase(selected.id);
                setSelectedId(null);
              }}
            >
              Delete phase
            </button>
          </div>
        </div>
      )}
      <p className="mt-1 text-[10px] text-neutral-400">
        With no phases, barriers always block and every arrow is always enforced (unchanged from before M4). Add a phase to start restricting them by time of day.
      </p>
    </div>
  );
}
