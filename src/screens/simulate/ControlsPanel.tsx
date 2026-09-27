import { useAppStore } from '../../app/store';
import { useSimStore } from '../../app/simStore';
import type { HeatMode } from '../../app/simStore';
import { LOS_RAMP } from '../../viz/palettes';

const HEAT_MODES: { id: HeatMode; label: string }[] = [
  { id: 'agents', label: 'Agents' },
  { id: 'density', label: 'Density (LoS)' },
  { id: 'footfall', label: 'Footfall' },
  { id: 'stuck', label: 'Stuck time' },
  { id: 'vehicleBlock', label: 'Vehicle blocking' },
  { id: 'conflict', label: 'Conflicts' },
];

export function ControlsPanel() {
  const project = useAppStore((s) => s.project);
  const heatMode = useSimStore((s) => s.heatMode);
  const setHeatMode = useSimStore((s) => s.setHeatMode);
  const showTrails = useSimStore((s) => s.showTrails);
  const toggleTrails = useSimStore((s) => s.toggleTrails);
  const compliance = useSimStore((s) => s.complianceOverride);
  const setCompliance = useSimStore((s) => s.setComplianceOverride);
  const arrivalMult = useSimStore((s) => s.arrivalMultiplierOverride);
  const setArrivalMult = useSimStore((s) => s.setArrivalMultiplierOverride);
  const seed = useSimStore((s) => s.seed);
  const restart = useSimStore((s) => s.restart);
  const metrics = useSimStore((s) => s.metrics);

  return (
    <div className="space-y-3 border-b border-neutral-200 p-2 text-xs">
      <div>
        <div className="mb-1 font-semibold text-neutral-500">View</div>
        <div className="grid grid-cols-2 gap-1">
          {HEAT_MODES.map((m) => (
            <button key={m.id} onClick={() => setHeatMode(m.id)} className={`rounded px-2 py-1 ${heatMode === m.id ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}>
              {m.label}
            </button>
          ))}
        </div>
        {heatMode === 'density' && (
          <div className="mt-1 flex gap-0.5">
            {LOS_RAMP.map((b) => (
              <div key={b.grade} title={`LoS ${b.grade}`} className="h-3 flex-1" style={{ background: b.color }} />
            ))}
          </div>
        )}
        <label className="mt-2 flex items-center gap-1">
          <input type="checkbox" checked={showTrails} onChange={toggleTrails} /> Trails
        </label>
      </div>

      <div>
        <label className="mb-1 flex items-center justify-between">
          <span>Arrow compliance</span>
          <span>{Math.round(compliance * 100)}%</span>
        </label>
        <input type="range" min={0} max={1} step={0.05} value={compliance} onChange={(e) => setCompliance(parseFloat(e.target.value))} className="w-full" />
      </div>
      <div>
        <label className="mb-1 flex items-center justify-between">
          <span>Arrival rate ×</span>
          <span>{arrivalMult.toFixed(1)}</span>
        </label>
        <input type="range" min={0.2} max={2} step={0.1} value={arrivalMult} onChange={(e) => setArrivalMult(parseFloat(e.target.value))} className="w-full" />
      </div>
      <div className="flex items-center justify-between">
        <span>Seed: {seed}</span>
        <div className="flex gap-1">
          <button className="rounded bg-neutral-100 px-2 py-1" onClick={() => restart(project, false)}>
            Restart
          </button>
          <button className="rounded bg-neutral-100 px-2 py-1" onClick={() => restart(project, true)}>
            New seed
          </button>
        </div>
      </div>
      <div className="border-t border-neutral-200 pt-2 text-neutral-500">
        <div>People in market: {metrics.peopleInMarket}</div>
        <div>
          Spawned / despawned: {metrics.spawned} / {metrics.despawned}
        </div>
        <div>
          Skipped: {metrics.skippedQueue} queue, {metrics.skippedBlocked} blocked
        </div>
        <div className="mt-1 border-t border-neutral-100 pt-1">
          Vehicles in market: {metrics.vehiclesInMarket} ({metrics.vehiclesSpawned} spawned, {metrics.vehiclesDespawned} despawned)
        </div>
        <div>Failed unloads: {metrics.vehiclesFailedUnloads}</div>
        <div>Pedestrian-vehicle conflicts: {metrics.vehicleConflicts}</div>
      </div>
    </div>
  );
}
