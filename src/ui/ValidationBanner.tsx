import { useAppStore } from '../app/store';
import { countProvenance } from '../data/provenance';

// SPEC.md section 1.4, rules 1-2: shown on every results screen and export
// until the baseline is validated against field data (section 13).
export function ValidationBanner() {
  const project = useAppStore((s) => s.project);
  const status = project.calibration.lastRunStatus;
  const counts = countProvenance(project);
  const total = counts.measured + counts.assumed + counts.literature;

  const statusText = status === 'passing' ? `Baseline validated at ±${Math.round(project.calibration.toleranceFrac.value * 100)}%.` : 'Baseline not validated against field data. Results are illustrative.';

  return (
    <div className={`flex items-center gap-3 px-3 py-1 text-xs ${status === 'passing' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
      <span aria-hidden>{status === 'passing' ? '✓' : '⚠'}</span>
      <span className="font-medium">{statusText}</span>
      <span className="ml-auto text-amber-700/80">
        {total > 0 ? `${counts.measured} measured, ${counts.assumed} assumed, ${counts.literature} literature (${total} total)` : ''}
      </span>
    </div>
  );
}
