import { useAppStore } from '../../app/store';
import type { Entrance, EntranceType, LayoutObject, ProduceCategory, Stall } from '../../data/schema';
import { PRODUCE_COLORS } from '../../data/schema';

const PRODUCE_LIST = Object.keys(PRODUCE_COLORS) as ProduceCategory[];
const ENTRANCE_TYPES: EntranceType[] = ['ped_in', 'ped_out', 'ped_both', 'veh_in', 'veh_out', 'veh_both'];

export function PropertiesPanel() {
  const selectedObjectId = useAppStore((s) => s.selectedObjectId);
  const objects = useAppStore((s) => s.project.baseline.objects);
  const updateSelectedObject = useAppStore((s) => s.updateSelectedObject);
  const deleteSelectedObject = useAppStore((s) => s.deleteSelectedObject);

  const obj = objects.find((o) => o.id === selectedObjectId);
  if (!obj) {
    return <div className="p-2 text-xs text-neutral-400">Select an object to see its properties.</div>;
  }

  return (
    <div className="space-y-2 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold capitalize">{obj.kind.replace('_', ' ')}</span>
        <button onClick={deleteSelectedObject} className="rounded bg-red-50 px-2 py-0.5 text-red-700 hover:bg-red-100">
          Delete
        </button>
      </div>
      {obj.kind === 'stall' && <StallProps stall={obj} update={(fn) => updateSelectedObject((o) => fn(o as Stall))} />}
      {obj.kind === 'entrance' && <EntranceProps entrance={obj} update={(fn) => updateSelectedObject((o) => fn(o as Entrance))} />}
      {obj.kind === 'transect' && (
        <label className="flex flex-col gap-1">
          Label
          <input
            className="rounded border border-neutral-300 px-1 py-0.5"
            value={obj.label}
            onChange={(e) => updateSelectedObject((o) => ({ ...(o as LayoutObject & { label: string }), label: e.target.value }))}
          />
        </label>
      )}
    </div>
  );
}

function StallProps({ stall, update }: { stall: Stall; update: (fn: (o: Stall) => Stall) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        Label
        <input className="rounded border border-neutral-300 px-1 py-0.5" value={stall.label ?? ''} onChange={(e) => update((s) => ({ ...s, label: e.target.value }))} />
      </label>
      <div>
        <div className="mb-1 text-neutral-500">Produce</div>
        <div className="grid grid-cols-2 gap-1">
          {PRODUCE_LIST.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={stall.produce.includes(p)}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    produce: e.target.checked ? [...s.produce, p] : s.produce.filter((x) => x !== p),
                  }))
                }
              />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PRODUCE_COLORS[p] }} />
              {p.replace('_', ' ')}
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        Seller type
        <select className="rounded border border-neutral-300 px-1 py-0.5" value={stall.sellerType} onChange={(e) => update((s) => ({ ...s, sellerType: e.target.value as Stall['sellerType'] }))}>
          <option value="farmer">Farmer</option>
          <option value="reseller">Reseller</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span>
          Attractiveness <span className="text-neutral-400">({stall.attractiveness.source})</span>
        </span>
        <input
          type="range"
          min={0.2}
          max={2}
          step={0.1}
          value={stall.attractiveness.value}
          onChange={(e) => update((s) => ({ ...s, attractiveness: { ...s.attractiveness, value: parseFloat(e.target.value) } }))}
        />
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={stall.shaded} onChange={(e) => update((s) => ({ ...s, shaded: e.target.checked }))} />
        Shaded
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={stall.locked} onChange={(e) => update((s) => ({ ...s, locked: e.target.checked }))} />
        Locked (fixed territory — interventions may not move/delete)
      </label>
      <div className="text-neutral-400">Max concurrent customers: {stall.maxConcurrentCustomers} (derived, placeholder)</div>
    </div>
  );
}

function EntranceProps({ entrance, update }: { entrance: Entrance; update: (fn: (o: Entrance) => Entrance) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        Label
        <input className="rounded border border-neutral-300 px-1 py-0.5" value={entrance.label ?? ''} onChange={(e) => update((en) => ({ ...en, label: e.target.value }))} />
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select className="rounded border border-neutral-300 px-1 py-0.5" value={entrance.type} onChange={(e) => update((en) => ({ ...en, type: e.target.value as EntranceType }))}>
          {ENTRANCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span>
          Weight <span className="text-neutral-400">({entrance.weight.source})</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={entrance.weight.value}
          onChange={(e) => update((en) => ({ ...en, weight: { ...en.weight, value: parseFloat(e.target.value) } }))}
        />
      </label>
    </div>
  );
}
