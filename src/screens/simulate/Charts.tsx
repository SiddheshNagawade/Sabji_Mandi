import { useMemo } from 'react';
import { useSimStore } from '../../app/simStore';
import { MiniChart } from './MiniChart';

export function Charts() {
  const history = useSimStore((s) => s.metricsHistory);

  const x = useMemo(() => history.map((h) => h.t), [history]);
  const people = useMemo(() => history.map((h) => h.peopleInMarket), [history]);
  const density = useMemo(() => history.map((h) => h.peakDensity), [history]);
  const skipped = useMemo(() => history.map((h) => h.skippedTotal), [history]);
  const vehicles = useMemo(() => history.map((h) => h.vehiclesInMarket), [history]);

  return (
    <div className="p-2">
      <MiniChart title="People in market" x={x} y={people} color="#2B6CB0" />
      <MiniChart title="Simulated peak density (people/m², instantaneous)" x={x} y={density} color="#D7191C" />
      <MiniChart title="Vehicles in market" x={x} y={vehicles} color="#1E3A5F" />
      <MiniChart title="Cumulative skipped visits" x={x} y={skipped} color="#DD8B00" />
      <p className="mt-1 text-[10px] text-neutral-400">Transect throughput charts arrive with transect metrics (M5).</p>
    </div>
  );
}
